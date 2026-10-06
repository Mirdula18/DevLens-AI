"""
RAG (Retrieval-Augmented Generation) service.

Workflow:
1. Index  – chunk all project files → embed with sentence-transformers
             → store in an in-memory FAISS index.
2. Search – embed the user question → find top-k closest chunks.
3. Answer – send retrieved chunks + question to the LLM.

The index is stored in a module-level dict keyed by project root path so
that repeated queries don't re-index the same project.
"""

from __future__ import annotations

import asyncio
import threading
from pathlib import Path
from typing import NamedTuple

import faiss

from services.file_parser import get_flat_files
from utils.file_utils import safe_read

# Lazy import so the heavy model is loaded only when RAG is first used
_model = None

# Guards index construction so concurrent requests don't double-build
_index_lock = threading.Lock()


def _get_model():
    global _model  # noqa: PLW0603
    if _model is None:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


# ── Data structures ───────────────────────────────────────────────────────────

class Chunk(NamedTuple):
    file_path: str       # relative path shown to the user
    content: str         # the actual text chunk
    start_line: int = 1  # first line of the chunk (1-based, inclusive)
    end_line: int = 1    # last line of the chunk (inclusive)


class ProjectIndex(NamedTuple):
    chunks: list[Chunk]
    index: faiss.IndexFlatL2


# Module-level cache  { root_path: ProjectIndex }
_index_cache: dict[str, ProjectIndex] = {}

# Max characters per chunk (roughly 400 tokens)
CHUNK_SIZE = 1500
# Lines repeated at the start of the next chunk, so code that straddles a
# boundary is still retrievable as a unit
CHUNK_OVERLAP_LINES = 3


# ── Chunking ──────────────────────────────────────────────────────────────────

def _split_lines(text: str, size: int) -> list[tuple[int, str]]:
    """
    Return ``(line_number, text)`` pairs for *text*, keeping line endings.
    Lines longer than *size* (e.g. minified files) are cut into pieces that
    share the same line number.
    """
    pieces: list[tuple[int, str]] = []
    for number, line in enumerate(text.splitlines(keepends=True), start=1):
        for start in range(0, len(line), size):
            pieces.append((number, line[start:start + size]))
    return pieces


def _chunk_lines(
    text: str,
    size: int = CHUNK_SIZE,
    overlap_lines: int = CHUNK_OVERLAP_LINES,
) -> list[tuple[int, int, str]]:
    """
    Split *text* into chunks of whole lines, each at most *size* characters.

    Returns ``(start_line, end_line, content)`` tuples (1-based, inclusive).
    Consecutive chunks share *overlap_lines* lines of context.
    """
    pieces = _split_lines(text, size)
    chunks: list[tuple[int, int, str]] = []
    i = 0
    while i < len(pieces):
        j, length = i, 0
        while j < len(pieces) and (j == i or length + len(pieces[j][1]) <= size):
            length += len(pieces[j][1])
            j += 1
        content = "".join(piece for _, piece in pieces[i:j])
        chunks.append((pieces[i][0], pieces[j - 1][0], content))
        if j >= len(pieces):
            break
        # Step back for overlap, but always make progress
        i = max(j - overlap_lines, i + 1)
    return chunks


# ── Indexing ──────────────────────────────────────────────────────────────────

def build_index(root_path: str) -> ProjectIndex:
    """
    Build (or retrieve cached) FAISS index for the project at *root_path*.

    The index is cached per project root; a lock prevents concurrent
    rebuilds when multiple requests hit an uncached project at once.
    """
    root_path = str(Path(root_path).resolve())
    cached = _index_cache.get(root_path)
    if cached is not None:
        return cached

    with _index_lock:
        cached = _index_cache.get(root_path)
        if cached is not None:
            return cached

        model = _get_model()
        file_paths = get_flat_files(root_path)

        all_chunks: list[Chunk] = []
        for abs_path in file_paths:
            content = safe_read(abs_path)
            if not content.strip():
                continue
            rel = Path(abs_path).relative_to(root_path).as_posix()
            for start, end, chunk in _chunk_lines(content):
                all_chunks.append(Chunk(rel, chunk, start, end))

        if not all_chunks:
            # Return empty index
            dim = 384  # all-MiniLM-L6-v2 output dimension
            idx = faiss.IndexFlatL2(dim)
            proj = ProjectIndex(chunks=[], index=idx)
            _index_cache[root_path] = proj
            return proj

        texts = [c.content for c in all_chunks]
        embeddings = model.encode(texts, show_progress_bar=False).astype("float32")

        dim = embeddings.shape[1]
        idx = faiss.IndexFlatL2(dim)
        idx.add(embeddings)

        proj = ProjectIndex(chunks=all_chunks, index=idx)
        _index_cache[root_path] = proj
        return proj


def invalidate_cache(root_path: str) -> None:
    """Remove cached index for *root_path* (e.g. after re-upload)."""
    key = str(Path(root_path).resolve())
    _index_cache.pop(key, None)


# ── Search ────────────────────────────────────────────────────────────────────

def search(root_path: str, question: str, top_k: int = 5) -> list[Chunk]:
    """
    Return the *top_k* most relevant chunks for *question*.
    """
    proj = build_index(root_path)
    if not proj.chunks:
        return []

    model = _get_model()
    q_vec = model.encode([question], show_progress_bar=False).astype("float32")
    distances, indices = proj.index.search(q_vec, min(top_k, len(proj.chunks)))

    results: list[Chunk] = []
    for idx in indices[0]:
        if idx != -1:
            results.append(proj.chunks[idx])
    return results


async def search_async(root_path: str, question: str, top_k: int = 5) -> list[Chunk]:
    """
    Async wrapper around :func:`search`.

    Runs the expensive embedding and FAISS look-up in a worker thread so the
    event loop stays responsive for other requests.
    """
    return await asyncio.to_thread(search, root_path, question, top_k)


async def warm_index(root_path: str) -> None:
    """Pre-build the index for *root_path* in a worker thread (fire-and-forget)."""
    await asyncio.to_thread(build_index, root_path)


def build_context(chunks: list[Chunk]) -> str:
    """Format retrieved chunks into a single context string for the LLM."""
    parts: list[str] = []
    for chunk in chunks:
        parts.append(f"### {chunk.file_path} (lines {chunk.start_line}-{chunk.end_line})\n{chunk.content}")
    return "\n\n".join(parts)


def source_refs(chunks: list[Chunk]) -> list[dict]:
    """
    Unique source references for *chunks*, in relevance order, as dicts with
    ``path``, ``start_line`` and ``end_line`` (sent to the UI as citations).
    """
    seen: set[tuple[str, int, int]] = set()
    refs: list[dict] = []
    for c in chunks:
        key = (c.file_path, c.start_line, c.end_line)
        if key not in seen:
            seen.add(key)
            refs.append({"path": c.file_path, "start_line": c.start_line, "end_line": c.end_line})
    return refs
