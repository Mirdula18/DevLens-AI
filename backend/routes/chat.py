"""
/chat route

Handles codebase Q&A using Retrieval-Augmented Generation (RAG).

Flow:
1. User sends a natural-language question.
2. The question is embedded and the closest code chunks are retrieved
   from the FAISS index.
3. The retrieved chunks + question are sent to the LLM.
4. The answer is returned along with source file references.
"""

from fastapi import APIRouter, HTTPException
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
    Answer *req.question* using RAG over the loaded project.
    """
    # Validation already done by Pydantic validators

    root = await get_project_root()

    # Retrieve relevant chunks
    try:
        chunks = rag_service.search(root, req.question, top_k=req.top_k)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"RAG search error: {exc}") from exc

    if not chunks:
        return {
            "answer": "I could not find any relevant code in the project for your question.",
            "sources": [],
        }

    context = _cap_context(rag_service.build_context(chunks))

    try:
        answer = await llm_service.answer_with_rag(req.question, context, req.model)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    sources = list({c.file_path for c in chunks})  # unique source files

    return {"answer": answer, "sources": sources}
