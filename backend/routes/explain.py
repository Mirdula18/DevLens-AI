"""
/explain route

Sends code to the local LLM and returns an explanation.
Also exposes a /explain/confusion endpoint for the Confusion Detector feature.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from services import llm_service

router = APIRouter()

VALID_MODES = {"normal", "eli5", "review", "optimize"}

# Maximum characters to send to LLM (prevents timeout/memory issues)
MAX_CODE_LENGTH = 50_000


class ExplainRequest(BaseModel):
    code: str
    mode: str = "normal"
    model: str = llm_service.DEFAULT_MODEL

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Code must not be empty")
        if len(v) > MAX_CODE_LENGTH:
            raise ValueError(f"Code exceeds maximum length of {MAX_CODE_LENGTH} characters")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in VALID_MODES:
            raise ValueError(f"Invalid mode '{v}'. Choose from: {sorted(VALID_MODES)}")
        return v


class ConfusionRequest(BaseModel):
    code: str
    model: str = llm_service.DEFAULT_MODEL

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Code must not be empty")
        if len(v) > MAX_CODE_LENGTH:
            raise ValueError(f"Code exceeds maximum length of {MAX_CODE_LENGTH} characters")
        return v


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
    # Validation already done by Pydantic validators

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
    # Validation already done by Pydantic validators

    try:
        result = await llm_service.detect_confusion(req.code, req.model)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return {"confusion_analysis": result}
