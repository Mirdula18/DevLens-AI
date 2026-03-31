"""
DevLens AI – FastAPI entry point.

Starts the server and registers all route modules.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import upload, tree, file, explain, summary, chat

app = FastAPI(
    title="DevLens AI",
    description="Offline AI-powered codebase explainer",
    version="1.0.0",
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


@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
