"""
/models route

Returns the list of LLM models available in the local Ollama instance.
Used by the frontend to populate the model dropdown.
"""

from fastapi import APIRouter, HTTPException

from services import llm_service

router = APIRouter()


@router.get("")
async def get_models():
    """Return the names of the models currently installed in Ollama."""
    try:
        models = await llm_service.list_models()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not reach Ollama: {exc}") from exc

    return {"models": models, "default": llm_service.DEFAULT_MODEL}
