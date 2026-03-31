"""
/summary route

Generates a high-level project summary by sending a snapshot of the
codebase to the LLM.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routes.upload import get_project_root
from services.file_parser import get_flat_files
from services import llm_service
from utils.file_utils import safe_read

router = APIRouter()

# Maximum total characters sent to the LLM for the summary
MAX_SNAPSHOT_CHARS = 40_000


class SummaryRequest(BaseModel):
    model: str = llm_service.DEFAULT_MODEL


@router.post("")
async def generate_summary(req: SummaryRequest):
    """
    Collect a representative snapshot of all project files and ask the LLM
    to produce a structured project report.
    """
    root = await get_project_root()
    file_paths = get_flat_files(root)

    if not file_paths:
        raise HTTPException(status_code=400, detail="No supported files found in the project.")

    snapshot_parts: list[str] = []
    total_chars = 0

    for fp in file_paths:
        if total_chars >= MAX_SNAPSHOT_CHARS:
            break
        rel = Path(fp).relative_to(root).as_posix()
        content = safe_read(fp, max_bytes=2000)  # short excerpt per file
        entry = f"### {rel}\n{content}"
        snapshot_parts.append(entry)
        total_chars += len(entry)

    snapshot = "\n\n".join(snapshot_parts)

    try:
        summary = await llm_service.summarise_project(snapshot, req.model)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return {"summary": summary, "files_analysed": len(snapshot_parts)}
