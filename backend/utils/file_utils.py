"""
Utility helpers shared across the backend.

- Allowed code-file extensions
- File-size limit
- Path-safety check
"""

import os
from pathlib import Path

import aiofiles

# Extensions we are willing to parse / send to the LLM
ALLOWED_EXTENSIONS: set[str] = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".html", ".css", ".java", ".cpp", ".c",
    ".h", ".go", ".rb", ".rs", ".php",
    ".json", ".yaml", ".yml", ".toml", ".md",
    ".sh", ".bat", ".env.example",
}

# Directories that should always be skipped
IGNORED_DIRS: set[str] = {
    "node_modules", ".git", "__pycache__", ".venv",
    "venv", "env", "dist", "build", ".next", ".nuxt",
    "coverage", ".cache", ".idea", ".vscode",
}

# Max bytes we will read from a single file (100 KB)
MAX_FILE_SIZE: int = 100 * 1024


def is_allowed_file(path: str | Path) -> bool:
    """Return True if the file has an allowed extension and is not too large."""
    p = Path(path)
    if p.suffix.lower() not in ALLOWED_EXTENSIONS:
        return False
    try:
        if os.path.getsize(p) > MAX_FILE_SIZE:
            return False
    except OSError:
        return False
    return True


def safe_read(path: str | Path, max_bytes: int = MAX_FILE_SIZE) -> str:
    """
    Read a text file safely, truncating if it exceeds *max_bytes*.

    Returns the decoded content. Returns a generic error placeholder
    (without internal details) if the file cannot be read.
    """
    try:
        with open(path, "rb") as fh:
            raw = fh.read(max_bytes)
        return raw.decode("utf-8", errors="replace")
    except OSError:
        return "[Error: file could not be read]"


async def safe_read_async(path: str | Path, max_bytes: int = MAX_FILE_SIZE) -> str:
    """
    Async (non-blocking) variant of :func:`safe_read` using aiofiles.
    Keeps the event loop free while reading from disk.
    """
    try:
        async with aiofiles.open(path, "rb") as fh:
            raw = await fh.read(max_bytes)
        return raw.decode("utf-8", errors="replace")
    except OSError:
        return "[Error: file could not be read]"
