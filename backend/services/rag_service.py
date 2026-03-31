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

import re
from pathlib import Path
from typing import NamedTuple

import faiss
import numpy as np

from utils.file_utils import safe_read
from services.file_parser import get_flat_files

# Lazy import so the heavy model is loaded only when RAG is first used
_model = None


def _get_model():
    global _model  # noqa: PLW0603
    if _model is None:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


# ── Data structures ───────────────────────────────────────────────────────────

class Chunk(NamedTuple):
    file_path: str   # relative path shown to the user
    content: str     # the actual text chunk


class ProjectIndex(NamedTuple):
    chunks: list[Chunk]
    index: faiss.IndexFlatL2


# Module-level cache  { root_path: ProjectIndex }
_index_cache: dict[str, ProjectIndex] = {}

# Characters per chunk (roughly 400 tokens)
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200


# ── Chunking ──────────────────────────────────────────────────────────────────

def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split *text* into overlapping fixed-size chunks."""
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


# ── Indexing ──────────────────────────────────────────────────────────────────

def build_index(root_path: str) -> ProjectIndex:
    """
    Build (or retrieve cached) FAISS index for the project at *root_path*.
    """
    root_path = str(Path(root_path).resolve())
    if root_path in _index_cache:
        return _index_cache[root_path]

    model = _get_model()
    file_paths = get_flat_files(root_path)

    all_chunks: list[Chunk] = []
    for abs_path in file_paths:
        content = safe_read(abs_path)
        if not content.strip():
            continue
        rel = Path(abs_path).relative_to(root_path).as_posix()
        for chunk in _chunk_text(content):
            all_chunks.append(Chunk(file_path=rel, content=chunk))

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


def build_context(chunks: list[Chunk]) -> str:
    """Format retrieved chunks into a single context string for the LLM."""
    parts: list[str] = []
    for chunk in chunks:
        parts.append(f"### {chunk.file_path}\n{chunk.content}")
    return "\n\n".join(parts)
