"""
/chat route

Answers codebase Q&A using Retrieval-Augmented Generation (RAG) and
streams the result token-by-token via SSE.

Flow:
1. User sends a natural-language question.
2. The question is embedded and the closest code chunks are retrieved
   from the FAISS index (in a worker thread, off the event loop).
3. The retrieved chunks + question stream to the LLM.
4. Source file references are sent after the answer.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from routes.upload import get_project_root
from services import rag_service, llm_service

router = APIRouter()

# Bounds for top_k to prevent excessive retrieval or empty results
MIN_TOP_K = 1
MAX_TOP_K = 20

# Maximum total characters of context sent to the LLM (prevents prompt overflow)
MAX_CONTEXT_CHARS = 30_000


def _cap_context(context: str, max_chars: int = MAX_CONTEXT_CHARS) -> str:
    """Truncate the RAG context to stay within the LLM's prompt budget."""
    if len(context) <= max_chars:
        return context
    return context[:max_chars].rstrip() + "\n\n[context truncated]"


class ChatRequest(BaseModel):
    question: str
    top_k: int = 5
    model: str = llm_service.DEFAULT_MODEL

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Question must not be empty")
        return v

    @field_validator("top_k")
    @classmethod
    def validate_top_k(cls, v: int) -> int:
        if v < MIN_TOP_K:
            raise ValueError(f"top_k must be at least {MIN_TOP_K}")
        if v > MAX_TOP_K:
            raise ValueError(f"top_k must be at most {MAX_TOP_K}")
        return v


@router.post("")
async def chat(req: ChatRequest):
    """
    Stream an answer to *req.question* using RAG over the loaded project.
    """
    root = await get_project_root()

    # Retrieve relevant chunks (embedding + FAISS run in a worker thread)
    try:
        chunks = await rag_service.search_async(root, req.question, top_k=req.top_k)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"RAG search error: {exc}") from exc

    if not chunks:
        return StreamingResponse(
            _fallback_events("I could not find any relevant code in the project for your question."),
            media_type="text/event-stream",
        )

    context = _cap_context(rag_service.build_context(chunks))
    return StreamingResponse(
        _rag_events(req.question, context, chunks, req.model),
        media_type="text/event-stream",
    )


async def _fallback_events(message: str):
    yield llm_service.sse({"type": "token", "data": message})
    yield llm_service.sse({"type": "sources", "data": []})
    yield llm_service.sse({"type": "done"})


async def _rag_events(question: str, context: str, chunks, model: str):
    failed = False
    try:
        async for token in llm_service.stream_rag(question, context, model):
            yield llm_service.sse({"type": "token", "data": token})
    except Exception as exc:  # noqa: BLE001
        failed = True
        yield llm_service.sse({"type": "error", "data": f"LLM error: {exc}"})

    if not failed:
        # Source references (unique files) after the answer
        yield llm_service.sse({"type": "sources", "data": list({c.file_path for c in chunks})})
    yield llm_service.sse({"type": "done", "data": "ok"})