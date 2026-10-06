"""
/stats route

Returns codebase metrics (languages, line counts, largest files) for the
currently loaded project. Used by the Insights panel.
"""

from fastapi import APIRouter

from routes.upload import get_project_root
from services.stats_service import compute_stats_async

router = APIRouter()


@router.get("")
async def get_stats():
    """Return language breakdown, totals and the largest files of the project."""
    root = await get_project_root()
    return await compute_stats_async(root)
