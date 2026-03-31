"""
/upload route

Accepts a JSON body with the absolute path to a local project folder,
parses it, and stores the root path in the app state so other routes
can reference it.

Note: `_state` is a module-level dict protected by `_state_lock`.
This is appropriate for a single-user local tool; a multi-user production
deployment would use a proper database or request-scoped state.
"""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.file_parser import parse_project
from services import rag_service

router = APIRouter()

# Simple in-process store – guarded by an async lock
_state: dict[str, str] = {}
_state_lock = asyncio.Lock()


class UploadRequest(BaseModel):
    path: str  # absolute path on the user's machine


@router.post("")
async def upload_project(req: UploadRequest):
    """
    Parse the project at *req.path* and cache the root for subsequent calls.
    """
    try:
        result = parse_project(req.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Invalidate any previously cached RAG index for this project
    rag_service.invalidate_cache(req.path)

    async with _state_lock:
        _state["project_root"] = req.path

    return {
        "message": "Project uploaded successfully",
        "root": result["root"],
        "file_count": result["file_count"],
        "path": req.path,
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
    return root
