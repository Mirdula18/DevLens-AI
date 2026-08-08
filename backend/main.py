"""
DevLens AI – FastAPI entry point.

Starts the server and registers all route modules.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import chat, explain, file, models, summary, tree, upload
from services import llm_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle – closes pooled HTTP connections on shutdown."""
    try:
        yield
    finally:
        await llm_service.aclose_client()

app = FastAPI(
    title="DevLens AI",
    description="Offline AI-powered codebase explainer",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Vite dev-server (port 5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(tree.router, prefix="/tree", tags=["tree"])
app.include_router(file.router, prefix="/file", tags=["file"])
app.include_router(explain.router, prefix="/explain", tags=["explain"])
app.include_router(summary.router, prefix="/summary", tags=["summary"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(models.router, prefix="/models", tags=["models"])


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Standardized validation error response."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "validation_error", "details": errors},
    )


@app.get("/health")
async def health_check():
    """Liveness probe plus a check that the local Ollama server is reachable."""
    llm_ok = await llm_service.is_ollama_available()
    return {
        "status": "ok" if llm_ok else "degraded",
        "llm": "ok" if llm_ok else "unreachable",
    }
