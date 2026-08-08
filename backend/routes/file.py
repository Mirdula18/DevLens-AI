"""
/file route

Returns the content of a single file within the loaded project.
"""

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from routes.upload import get_project_root
from utils.file_utils import is_allowed_file, safe_read_async

router = APIRouter()


def _resolve_safe_path(root: str, relative: str) -> Path:
    """
    Resolve *relative* against *root* and verify the result is still
    inside *root* (prevents path-traversal attacks).

    Raises HTTPException 403 if the resolved path escapes the root.
    """
    root_resolved = Path(root).resolve()

    # Strip leading slashes/dots to normalize relative paths
    relative_clean = relative.lstrip("/\\")
    if relative_clean.startswith(".."):
        raise HTTPException(status_code=403, detail="Access denied: path traversal detected.")

    # Normalise and resolve without following symlinks out of root
    full_path = (root_resolved / Path(relative_clean)).resolve()

    # Ensure the resolved path is inside the project root
    try:
        full_path.relative_to(root_resolved)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Access denied: path traversal detected.",
        ) from None

    return full_path


@router.get("")
async def get_file(path: str = Query(..., description="Relative path within the project")):
    """
    Return the raw text content of the file at *path* (relative to project root).
    """
    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="Path parameter is required.")

    root = await get_project_root()
    full_path = _resolve_safe_path(root, path)

    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    if not is_allowed_file(full_path):
        raise HTTPException(status_code=400, detail="File type not supported or file too large.")

    content = await safe_read_async(full_path)
    return {
        "path": path,
        "name": full_path.name,
        "content": content,
        "size": os.path.getsize(full_path),
    }
