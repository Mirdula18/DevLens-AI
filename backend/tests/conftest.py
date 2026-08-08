"""
Shared pytest fixtures.

All Ollama HTTP calls are replaced with a mocked transport so tests run
offline, deterministically, and fast. Sentence-transformers / FAISS are
never loaded (RAG pre-warming and search are stubbed out).
"""

import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

import main  # noqa: E402
from routes import upload  # noqa: E402
from services import rag_service  # noqa: E402


def ollama_handler(request: httpx.Request) -> httpx.Response:
    """Mock the Ollama HTTP API (both /api/tags and /api/generate)."""
    path = request.url.path
    if path == "/api/tags":
        return httpx.Response(200, json={"models": [{"name": "mock:latest"}]})
    if path == "/api/generate":
        # One streamed token followed by the done marker.
        payload = b'{"response": "fake reply", "done": false}\n'
        payload += b'{"response": "", "done": true}\n'
        return httpx.Response(200, content=payload)
    return httpx.Response(404, text="not found")


async def _noop_warm(root_path: str) -> None:
    """Stand-in for rag_service.warm_index (avoids loading the model)."""
    return None


@pytest.fixture()
def client(monkeypatch):
    """A TestClient whose Ollama calls are mocked and no project is loaded."""
    from services import llm_service

    mocked = httpx.AsyncClient(
        transport=httpx.MockTransport(ollama_handler),
        base_url="http://127.0.0.1",
    )

    monkeypatch.setattr(llm_service, "_get_client", lambda: mocked)
    monkeypatch.setattr(upload, "_state", {})
    monkeypatch.setattr(rag_service, "_index_cache", {})
    monkeypatch.setattr(rag_service, "warm_index", _noop_warm)

    with TestClient(main.app) as tc:
        yield tc


@pytest.fixture()
def project_dir(tmp_path):
    """A small project directory with supported + ignored files."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "app.py").write_text(
        "def hello():\n"
        "    \"\"\"Say hello.\"\"\"\n"
        "    return 'hello'\n",
        encoding="utf-8",
    )
    (src / "config.json").write_text('{"name": "demo"}\n', encoding="utf-8")
    (tmp_path / "README.md").write_text("# Demo\nJust a test file.\n", encoding="utf-8")

    ignored = tmp_path / "node_modules"
    ignored.mkdir()
    (ignored / "dep.js").write_text("ignored\n", encoding="utf-8")

    return str(tmp_path)


def first_file_path(tree):
    """Return the relative path of the first file node in a parsed tree."""
    for node in tree:
        if node["type"] == "file":
            return node["path"]
    return None


def sse_events(response):
    """Extract the list of parsed SSE events from a TestClient stream."""
    import json

    events = []
    for line in response.iter_lines():
        if line.startswith("data:"):
            events.append(json.loads(line[5:].strip()))
    return events
