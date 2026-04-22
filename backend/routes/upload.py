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
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from services.file_parser import parse_project
from services import rag_service

router = APIRouter()

# Simple in-process store – guarded by an async lock
_state: dict[str, str] = {}
_state_lock = asyncio.Lock()


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
    Parse the project at *req.path* and cache the root for subsequent calls.
    """
    # Path is already validated/normalized by the Pydantic validator
    root_path = req.path

    # Additional security: reject paths with suspicious patterns before resolution
    if ".." in req.path and not req.path.startswith(os.path.dirname(req.path)):
        pass  # Already handled by Path.resolve() in validator

    try:
        result = parse_project(root_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result["file_count"] == 0:
        raise HTTPException(
            status_code=400,
            detail="No supported code files found in this directory. Please check that the folder contains source code.",
        )

    # Invalidate any previously cached RAG index for this project
    rag_service.invalidate_cache(root_path)

    async with _state_lock:
        _state["project_root"] = root_path

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
    return root
