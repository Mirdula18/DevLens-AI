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


def test_get_flat_files_skips_ignored_dirs(project_dir):
    files = get_flat_files(project_dir)
    assert len(files) == 3
    assert not any("node_modules" in f for f in files)


# ── rag_service ──────────────────────────────────────────────────────────────

def test_chunk_text_overlaps():
    text = "".join(str(i % 10) for i in range(250))
    chunks = rag_service._chunk_text(text, size=100, overlap=20)
    assert [len(c) for c in chunks] == [100, 100, 90, 10]
    # Each chunk starts with the last `overlap` characters of the previous one
    assert chunks[1][:20] == chunks[0][-20:]
    assert "".join(c[20:] if i else c for i, c in enumerate(chunks)) == text


def test_chunk_text_empty():
    assert rag_service._chunk_text("") == []


def test_build_context_formats_chunks():
    chunks = [
        rag_service.Chunk("a.py", "print('a')"),
        rag_service.Chunk("b.py", "print('b')"),
    ]
    assert rag_service.build_context(chunks) == "### a.py\nprint('a')\n\n### b.py\nprint('b')"


def test_cap_context():
    assert _cap_context("short", max_chars=10) == "short"
    capped = _cap_context("x" * 50, max_chars=10)
    assert capped.startswith("x" * 10)
    assert capped.endswith("[context truncated]")


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
