"""
/tree route

Returns the parsed file-tree for the currently loaded project.
"""

from fastapi import APIRouter, HTTPException

from services.file_parser import parse_project
from routes.upload import get_project_root

router = APIRouter()


@router.get("")
async def get_tree():
    """Return the full file-tree JSON for the active project."""
    try:
        root = await get_project_root()
    except HTTPException:
        raise

    try:
        result = parse_project(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse project tree: {exc}") from exc

    return result
