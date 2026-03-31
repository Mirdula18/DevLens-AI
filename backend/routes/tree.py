"""
/tree route

Returns the parsed file-tree for the currently loaded project.
"""

from fastapi import APIRouter

from services.file_parser import parse_project
from routes.upload import get_project_root

router = APIRouter()


@router.get("")
async def get_tree():
    """Return the full file-tree JSON for the active project."""
    root = await get_project_root()
    result = parse_project(root)
    return result
