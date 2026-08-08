"""
End-to-end route tests.

These hit the FastAPI app via TestClient. All LLM calls are mocked in
``conftest.py``; nothing calls a real model or a real filesystem mount.
"""


def _events(stream_resp):
    """Parse the SSE events from an open TestClient stream into a list."""
    import json

    events = []
    for line in stream_resp.iter_lines():
        if line.startswith("data:"):
            events.append(json.loads(line[5:].strip()))
    return events


# â”€â”€ Health & models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_health_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in {"ok", "degraded"}
    assert "llm" in body


def test_models(client):
    resp = client.get("/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "mock:latest" in data["models"]
    assert data["default"]


# â”€â”€ Project upload & tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_upload_and_tree(client, project_dir):
    resp = client.post("/upload", json={"path": project_dir})
    assert resp.status_code == 200
    assert resp.json()["file_count"] == 3  # node_modules ignored

    tree = client.get("/tree")
    assert tree.status_code == 200
    all_paths = collect_file_paths(tree.json()["tree"])
    assert "src/app.py" in all_paths
    assert not any("node_modules" in p for p in all_paths)


def collect_file_paths(nodes):
    paths = []
    for node in nodes:
        if node["type"] == "file":
            paths.append(node["path"])
        else:
            paths.extend(collect_file_paths(node.get("children", [])))
    return paths


def test_upload_rejects_bad_path(client):
    resp = client.post("/upload", json={"path": r"Z:\missing\dir"})
    assert resp.status_code == 400


def test_upload_rejects_empty_dir(client, tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    resp = client.post("/upload", json={"path": str(empty)})
    assert resp.status_code == 400


def test_tree_without_project(client):
    resp = client.get("/tree")
    assert resp.status_code == 400


# â”€â”€ File endpoint & security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_file_read(client, project_dir):
    client.post("/upload", json={"path": project_dir})
    resp = client.get("/file", params={"path": "src/app.py"})
    assert resp.status_code == 200
    assert "hello" in resp.json()["content"]


def test_file_missing(client, project_dir):
    client.post("/upload", json={"path": project_dir})
    resp = client.get("/file", params={"path": "nope.py"})
    assert resp.status_code == 404


def test_file_traversal_blocked(client, project_dir):
    client.post("/upload", json={"path": project_dir})
    for bad in ("../secrets.txt", "..\\secrets.txt", "../../etc/passwd"):
        resp = client.get("/file", params={"path": bad})
        assert resp.status_code in (403, 400), bad


def test_file_without_project(client):
    resp = client.get("/file", params={"path": "a.py"})
    assert resp.status_code == 400


# â”€â”€ /explain (streams) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_explain_streams(client):
    with client.stream(
        "POST", "/explain",
        json={"code": "def f():\n    return 1\n", "mode": "normal"},
    ) as resp:
        assert resp.status_code == 200
        assert "event-stream" in resp.headers["content-type"]
        events = _events(resp)
    text = "".join(e["data"] for e in events if e["type"] == "token")
    assert "fake reply" in text
    assert events[-1]["type"] == "done"


def test_explain_validation(client):
    resp = client.post("/explain", json={"code": "", "mode": "normal"})
    assert resp.status_code == 400
    resp = client.post("/explain", json={"code": "x", "mode": "bogus"})
    assert resp.status_code == 400


def test_confusion_streams(client):
    with client.stream(
        "POST", "/explain/confusion",
        json={"code": "x = 1\n"},
    ) as resp:
        assert resp.status_code == 200
        events = _events(resp)
        assert any(e["type"] == "token" for e in events)


# â”€â”€ /summary (streams) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_summary_streams(client, project_dir):
    client.post("/upload", json={"path": project_dir})
    with client.stream("POST", "/summary", json={"model": "mock:latest"}) as resp:
        assert resp.status_code == 200
        events = _events(resp)
        assert any(e.get("type") == "token" for e in events)


def test_summary_without_project(client):
    resp = client.post("/summary", json={"model": "mock:latest"})
    assert resp.status_code == 400


# â”€â”€ /chat (RAG, streams) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_chat_streams_with_sources(client, project_dir, monkeypatch):
    from services import rag_service

    async def fake_search(root, question, top_k=5):
        return [rag_service.Chunk("src/app.py", "def hello(): return 'hello'\n")]

    monkeypatch.setattr(rag_service, "search_async", fake_search)
    client.post("/upload", json={"path": project_dir})

    with client.stream(
        "POST", "/chat", json={"question": "where is hello?", "top_k": 3},
    ) as resp:
        assert resp.status_code == 200
        events = _events(resp)
        tokens = [e["data"] for e in events if e["type"] == "token"]
        assert "fake reply" in "".join(tokens)
        sources_events = [e for e in events if e["type"] == "sources"]
        assert sources_events and "src/app.py" in sources_events[0]["data"]
        assert events[-1]["type"] == "done"


def test_chat_validation(client):
    resp = client.post("/chat", json={"question": "   "})
    assert resp.status_code == 400
    resp = client.post("/chat", json={"question": "hi", "top_k": 999})
    assert resp.status_code == 400


def test_chat_without_project(client):
    resp = client.post("/chat", json={"question": "hello"})
    assert resp.status_code == 400
