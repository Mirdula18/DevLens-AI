"""
Unit tests for the service and utility layers.

These exercise pure helpers directly (no HTTP, no model loading), so they
stay fast and pin down the behaviour the routes build on.
"""

import asyncio
import json

from routes.chat import _cap_context
from services import llm_service, rag_service
from services.file_parser import get_flat_files, parse_project
from services.stats_service import compute_stats, language_for
from utils import file_utils

# ── file_utils ───────────────────────────────────────────────────────────────

def test_is_allowed_file_by_extension(tmp_path):
    ok = tmp_path / "main.py"
    ok.write_text("print(1)\n", encoding="utf-8")
    bad = tmp_path / "image.png"
    bad.write_bytes(b"\x89PNG")
    assert file_utils.is_allowed_file(ok)
    assert not file_utils.is_allowed_file(bad)


def test_is_allowed_file_by_full_name(tmp_path):
    env_example = tmp_path / ".env.example"
    env_example.write_text("KEY=value\n", encoding="utf-8")
    real_env = tmp_path / ".env"
    real_env.write_text("SECRET=1\n", encoding="utf-8")
    assert file_utils.is_allowed_file(env_example)
    assert not file_utils.is_allowed_file(real_env)


def test_is_allowed_file_rejects_large_and_missing(tmp_path):
    big = tmp_path / "big.py"
    big.write_bytes(b"x" * (file_utils.MAX_FILE_SIZE + 1))
    assert not file_utils.is_allowed_file(big)
    assert not file_utils.is_allowed_file(tmp_path / "missing.py")


def test_safe_read_truncates_and_replaces_bad_bytes(tmp_path):
    f = tmp_path / "data.py"
    f.write_bytes(b"abc\xffdef")
    assert file_utils.safe_read(f, max_bytes=3) == "abc"
    assert file_utils.safe_read(f) == "abc�def"


def test_safe_read_missing_file_returns_placeholder(tmp_path):
    result = file_utils.safe_read(tmp_path / "nope.py")
    assert result.startswith("[Error")
    assert str(tmp_path) not in result  # no internal paths leaked


def test_safe_read_async_matches_sync(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("hello world\n", encoding="utf-8")
    assert asyncio.run(file_utils.safe_read_async(f)) == file_utils.safe_read(f)


# ── file_parser ──────────────────────────────────────────────────────────────

def test_parse_project_structure(project_dir):
    result = parse_project(project_dir)
    assert result["file_count"] == 3
    names = [n["name"] for n in result["tree"]]
    # Folders are listed before files, node_modules is skipped
    assert names == ["src", "README.md"]
    src = result["tree"][0]
    assert src["type"] == "folder"
    assert [c["path"] for c in src["children"]] == ["src/app.py", "src/config.json"]


def test_parse_project_rejects_non_directory(tmp_path):
    f = tmp_path / "file.py"
    f.write_text("x = 1\n", encoding="utf-8")
    try:
        parse_project(str(f))
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for a non-directory path")


def test_parse_project_skips_tool_caches(project_dir, tmp_path):
    for cache in (".pytest_cache", ".ruff_cache", ".mypy_cache"):
        d = tmp_path / cache
        d.mkdir()
        (d / "README.md").write_text("cache\n", encoding="utf-8")
    result = parse_project(project_dir)
    assert result["file_count"] == 3
    assert not any(n["name"].startswith(".") for n in result["tree"])


def test_get_flat_files_skips_ignored_dirs(project_dir):
    files = get_flat_files(project_dir)
    assert len(files) == 3
    assert not any("node_modules" in f for f in files)


# ── rag_service ──────────────────────────────────────────────────────────────

def test_chunk_lines_tracks_line_ranges_with_overlap():
    text = "".join(f"line {i:02d}\n" for i in range(1, 21))  # 20 lines x 8 chars
    chunks = rag_service._chunk_lines(text, size=40, overlap_lines=1)
    # 5 lines fit per chunk; each chunk repeats the previous chunk's last line
    assert [(s, e) for s, e, _ in chunks] == [(1, 5), (5, 9), (9, 13), (13, 17), (17, 20)]
    for start, end, content in chunks:
        assert content.splitlines() == [f"line {i:02d}" for i in range(start, end + 1)]
        assert len(content) <= 40


def test_chunk_lines_splits_very_long_lines():
    text = "short\n" + "x" * 250 + "\nend\n"
    chunks = rag_service._chunk_lines(text, size=100, overlap_lines=0)
    assert all(len(c) <= 100 for _, _, c in chunks)
    assert "".join(c for _, _, c in chunks) == text
    # Pieces of the long line all report line 2
    assert [(s, e) for s, e, _ in chunks] == [(1, 1), (2, 2), (2, 2), (2, 3)]


def test_chunk_lines_always_progresses():
    # Overlap larger than a chunk must not loop forever
    chunks = rag_service._chunk_lines("a\nb\nc\n", size=2, overlap_lines=5)
    assert [(s, e) for s, e, _ in chunks] == [(1, 1), (2, 2), (3, 3)]


def test_chunk_lines_empty():
    assert rag_service._chunk_lines("") == []


def test_build_context_formats_chunks():
    chunks = [
        rag_service.Chunk("a.py", "print('a')", 1, 1),
        rag_service.Chunk("b.py", "print('b')", 3, 4),
    ]
    assert rag_service.build_context(chunks) == (
        "### a.py (lines 1-1)\nprint('a')\n\n### b.py (lines 3-4)\nprint('b')"
    )


def test_source_refs_dedupes_in_order():
    chunks = [
        rag_service.Chunk("b.py", "x", 10, 20),
        rag_service.Chunk("a.py", "y", 1, 5),
        rag_service.Chunk("b.py", "x", 10, 20),
    ]
    assert rag_service.source_refs(chunks) == [
        {"path": "b.py", "start_line": 10, "end_line": 20},
        {"path": "a.py", "start_line": 1, "end_line": 5},
    ]


def test_cap_context():
    assert _cap_context("short", max_chars=10) == "short"
    capped = _cap_context("x" * 50, max_chars=10)
    assert capped.startswith("x" * 10)
    assert capped.endswith("[context truncated]")


# ── stats_service ────────────────────────────────────────────────────────────

def test_language_for():
    assert language_for("a/b/App.TSX") == "TypeScript"
    assert language_for("x.yml") == language_for("x.yaml") == "YAML"
    assert language_for(".env.example") == "Config"


def test_compute_stats_empty_project(tmp_path):
    stats = compute_stats(str(tmp_path))
    assert stats["total_files"] == 0
    assert stats["languages"] == []
    assert stats["largest_files"] == []


def test_compute_stats_limits_largest_files(tmp_path):
    for i in range(8):
        (tmp_path / f"f{i}.py").write_text("x\n" * (i + 1), encoding="utf-8")
    stats = compute_stats(str(tmp_path))
    assert [f["lines"] for f in stats["largest_files"]] == [8, 7, 6, 5, 4]
    assert stats["languages"] == [{"name": "Python", "files": 8, "lines": 36, "percent": 100.0}]


# ── llm_service ──────────────────────────────────────────────────────────────

def test_sse_format_round_trips():
    msg = llm_service.sse({"type": "token", "data": "héllo\nworld"})
    assert msg.startswith("data: ") and msg.endswith("\n\n")
    # Newlines inside the payload are JSON-escaped, so one event = one line
    assert "\n" not in msg[:-2]
    assert json.loads(msg[6:]) == {"type": "token", "data": "héllo\nworld"}


def test_explain_prompt_per_mode():
    for mode in ("normal", "eli5", "review", "optimize"):
        prompt = llm_service.make_explain_prompt("x = 1", mode)
        assert "x = 1" in prompt
        assert prompt == llm_service.MODE_PROMPTS[mode].format(code="x = 1")
    # Unknown modes fall back to the normal template
    assert llm_service.make_explain_prompt("y", "bogus") == llm_service.make_explain_prompt("y")


def test_rag_prompt_contains_question_and_context():
    prompt = llm_service.make_rag_prompt("Where is auth?", "### auth.py\ncode")
    assert "Where is auth?" in prompt
    assert "### auth.py" in prompt
    assert "Conversation so far" not in prompt


def test_rag_prompt_includes_history():
    prompt = llm_service.make_rag_prompt("And tests?", "ctx", "Developer: Where is auth?")
    assert "Conversation so far" in prompt
    assert "Developer: Where is auth?" in prompt
    assert prompt.index("Conversation so far") < prompt.index("Question: And tests?")
