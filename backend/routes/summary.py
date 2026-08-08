"""
/summary route

Builds a representative snapshot of the project (concurrent, non-blocking
reads) and streams a high-level project report from the LLM via SSE.
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from routes.upload import get_project_root
from services.file_parser import get_flat_files_async
from services import llm_service
from utils.file_utils import safe_read_async

router = APIRouter()

# Maximum total characters sent to the LLM for the summary
MAX_SNAPSHOT_CHARS = 40_000

# Per-file excerpt length
_EXCERPT_BYTES = 2000


async def _build_snapshot(root: str) -> str:
    """
    Collect a representative snapshot of all project files.

    Reads happen concurrently with a bound on how many files are open at
    once, keeping the event loop responsive.
    """
    file_paths = await get_flat_files_async(root)

    if not file_paths:
        raise HTTPException(status_code=400, detail="No supported files found in the project.")

    sem = asyncio.Semaphore(32)

    async def read_excerpt(abs_path: str) -> str:
        async with sem:
            return await safe_read_async(abs_path, max_bytes=_EXCERPT_BYTES)

    contents = await asyncio.gather(*(read_excerpt(fp) for fp in file_paths))

    snapshot_parts: list[str] = []
    total_chars = 0
    for fp, content in zip(file_paths, contents):
        if content.strip():
            rel = Path(fp).relative_to(root).as_posix()
            entry = f"### {rel}\n{content}"
            snapshot_parts.append(entry)
            total_chars += len(entry)
        if total_chars >= MAX_SNAPSHOT_CHARS:
            break

    if not snapshot_parts:
        raise HTTPException(
            status_code=400,
            detail="No readable code files found. All files may be empty or unreadable.",
        )

    return "\n\n".join(snapshot_parts)


class SummaryRequest(BaseModel):
    model: str = llm_service.DEFAULT_MODEL


@router.post("")
async def generate_summary(req: SummaryRequest):
    """
    Stream a structured project report built from a snapshot of the codebase.
    """
    root = await get_project_root()

    try:
        snapshot = await _build_snapshot(root)
    except HTTPException:
        raise

    return StreamingResponse(_summary_events(snapshot, req.model), media_type="text/event-stream")


async def _summary_events(snapshot: str, model: str):
    try:
        async for token in llm_service.stream_summary(snapshot, model):
            yield llm_service.sse({"type": "token", "data": token})
    except Exception as exc:  # noqa: BLE001
        yield llm_service.sse({"type": "error", "data": f"LLM error: {exc}"})
    finally:
        yield llm_service.sse({"type": "done"})