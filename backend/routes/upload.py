"""
/upload route

Registers a JSON body absolute path to a local project folder, parses it,
and stores the root path + parsed tree in the app state so other routes
can reference them without re-scanning the disk on every request.

Note: `_state` is a module-level dict protected by `_state_lock`.
This is appropriate for a single-user local tool; a multi-user production
deployment would use a proper database or request-scoped state.
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from services import rag_service
from services.file_parser import parse_project_async

router = APIRouter()

# Simple in-process store – guarded by an async lock
_state: dict = {}
_state_lock = asyncio.Lock()

# References to background tasks so they are kept alive until they finish
_background_tasks: set[asyncio.Task] = set()


def _on_background_done(task: asyncio.Task) -> None:
    """Drop finished tasks and retrieve exceptions to avoid warnings."""
    _background_tasks.discard(task)
    if task.cancelled():
        return
    try:
        task.exception()
    except asyncio.CancelledError:
        pass


class UploadRequest(BaseModel):
    path: str  # absolute path on the user's machine

    @field_validator("path")
    @classmethod
    def validate_path(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Path cannot be empty")
        # Normalize and check if absolute
        normalized = Path(v).resolve()
        if not normalized.is_absolute():
            raise ValueError(f"Path must be absolute: {v}")
        if not normalized.exists():
            raise ValueError(f"Path does not exist: {v}")
        if not normalized.is_dir():
            raise ValueError(f"Path is not a directory: {v}")
        return str(normalized)


@router.post("")
async def upload_project(req: UploadRequest):
    """
    Parse the project at *req.path* and cache the root + parsed tree for
    subsequent calls. The RAG index is pre-warmed in the background so the
    first chat query starts from a warm cache.
    """
    # Path is already validated/normalized by the Pydantic validator
    root_path = req.path

    try:
        # Run the recursive scan in a worker thread (keeps the event loop free)
        result = await parse_project_async(root_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result["file_count"] == 0:
        raise HTTPException(
            status_code=400,
            detail="No supported code files found in this directory. Please check that the folder contains source code.",
        )

    async with _state_lock:
        # Invalidate any previously cached RAG index for this project
        rag_service.invalidate_cache(root_path)
        _state["project_root"] = root_path
        _state["parsed_for"] = root_path
        _state["parse_result"] = result

    # Pre-warm the RAG index in the background so /chat responds quickly.
    # The task is retained so it is not garbage-collected mid-execution.
    warm_task = asyncio.create_task(rag_service.warm_index(root_path))
    _background_tasks.add(warm_task)
    warm_task.add_done_callback(_on_background_done)

    return {
        "message": "Project uploaded successfully",
        "root": result["root"],
        "file_count": result["file_count"],
        "path": root_path,
    }


async def get_project_root() -> str:
    """Helper used by other route modules to retrieve the active project root."""
    async with _state_lock:
        root = _state.get("project_root")
    if not root:
        raise HTTPException(
            status_code=400,
            detail="No project loaded. Please upload a project first.",
        )
    return str(root)


async def get_cached_tree(root_path: str):
    """
    Return the previously parsed tree for *root_path* if it is still cached,
    otherwise None. Avoids re-scanning the filesystem on repeated /tree calls.
    """
    async with _state_lock:
        if _state.get("parsed_for") != root_path:
            return None
        return _state.get("parse_result")
