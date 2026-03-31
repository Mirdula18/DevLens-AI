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
from pydantic import BaseModel

from routes.upload import get_project_root
from services import rag_service, llm_service

router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    top_k: int = 5
    model: str = llm_service.DEFAULT_MODEL


@router.post("")
async def chat(req: ChatRequest):
    """
    Answer *req.question* using RAG over the loaded project.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty.")

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

    context = rag_service.build_context(chunks)

    try:
        answer = await llm_service.answer_with_rag(req.question, context, req.model)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    sources = list({c.file_path for c in chunks})  # unique source files

    return {"answer": answer, "sources": sources}
