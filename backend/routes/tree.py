"""
/tree route

Returns the parsed file-tree for the currently loaded project.

The parse is cached at upload time, so repeated calls do not re-scan the
filesystem (which is the hot path when the frontend re-fetches the tree).
"""

from fastapi import APIRouter, HTTPException

from services.file_parser import parse_project_async
from routes.upload import get_project_root, get_cached_tree

router = APIRouter()


@router.get("")
async def get_tree():
    """Return the full file-tree JSON for the active project."""
    try:
        root = await get_project_root()
    except HTTPException:
        raise

    cached = await get_cached_tree(root)
    if cached is not None:
        return cached

    try:
        result = await parse_project_async(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to parse project tree: {exc}") from exc

    return result