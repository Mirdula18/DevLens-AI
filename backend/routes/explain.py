"""
/explain route

Streams an AI explanation of code from the local LLM using Server-Sent
Events (SSE), so the frontend can render tokens as they are generated.
Also exposes a /explain/confusion endpoint for the Confusion Detector.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
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


async def _sse_events(tokens):
    """Wrap a token stream into SSE events (error-safe)."""
    try:
        async for token in tokens:
            yield llm_service.sse({"type": "token", "data": token})
    except Exception as exc:  # noqa: BLE001
        yield llm_service.sse({"type": "error", "data": f"LLM error: {exc}. Is Ollama running? (ollama serve)"})
    finally:
        yield llm_service.sse({"type": "done"})


@router.post("")
async def explain_code(req: ExplainRequest):
    """
    Stream an explanation of *code* using the selected *mode*.

    Modes:
        normal   – structured explanation (default)
        eli5     – Explain Like I'm 5
        review   – code review (bugs / bad practices)
        optimize – performance & optimisation suggestions
    """
    stream = llm_service.stream_explain(req.code, req.mode, req.model)
    return StreamingResponse(_sse_events(stream), media_type="text/event-stream")


@router.post("/confusion")
async def detect_confusion(req: ConfusionRequest):
    """
    Stream an analysis of the most confusing / complex sections of *code*.
    """
    stream = llm_service.stream_confusion(req.code, req.model)
    return StreamingResponse(_sse_events(stream), media_type="text/event-stream")
