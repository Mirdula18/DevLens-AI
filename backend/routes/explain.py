"""
/explain route

Sends code to the local LLM and returns an explanation.
Also exposes a /explain/confusion endpoint for the Confusion Detector feature.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import llm_service

router = APIRouter()

VALID_MODES = {"normal", "eli5", "review", "optimize"}


class ExplainRequest(BaseModel):
    code: str
    mode: str = "normal"
    model: str = llm_service.DEFAULT_MODEL


class ConfusionRequest(BaseModel):
    code: str
    model: str = llm_service.DEFAULT_MODEL


@router.post("")
async def explain_code(req: ExplainRequest):
    """
    Explain the provided *code* using the selected *mode*.

    Modes:
        normal   – structured explanation (default)
        eli5     – Explain Like I'm 5
        review   – code review (bugs / bad practices)
        optimize – performance & optimisation suggestions
    """
    if req.mode not in VALID_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{req.mode}'. Choose from: {sorted(VALID_MODES)}",
        )
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code must not be empty.")

    try:
        explanation = await llm_service.explain_code(req.code, req.mode, req.model)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"LLM error: {exc}. Is Ollama running? (ollama serve)",
        ) from exc

    return {"mode": req.mode, "explanation": explanation}


@router.post("/confusion")
async def detect_confusion(req: ConfusionRequest):
    """
    Identify the most confusing / complex sections of the provided code.
    """
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code must not be empty.")

    try:
        result = await llm_service.detect_confusion(req.code, req.model)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return {"confusion_analysis": result}
