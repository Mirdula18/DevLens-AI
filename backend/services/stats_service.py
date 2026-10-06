"""
Stats service – codebase metrics for the Insights panel.

Computes per-language file / line counts and the largest files for a
project. Everything is derived from the same allowlisted files the rest of
the app uses, so the numbers match what the file tree shows.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from pathlib import Path
from typing import Any

from services.file_parser import get_flat_files
from utils.file_utils import ALLOWED_FILENAMES, safe_read

# Extension → display language (several extensions can share one language)
LANGUAGES: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".html": "HTML", ".css": "CSS",
    ".java": "Java",
    ".c": "C", ".h": "C", ".cpp": "C++",
    ".go": "Go", ".rb": "Ruby", ".rs": "Rust", ".php": "PHP",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".md": "Markdown",
    ".sh": "Shell", ".bat": "Batch",
}

# How many entries the "largest files" list holds
TOP_FILES = 5


def language_for(path: str | Path) -> str:
    p = Path(path)
    if p.name in ALLOWED_FILENAMES:
        return "Config"
    return LANGUAGES.get(p.suffix.lower(), "Other")


def _count_lines(text: str) -> int:
    return len(text.splitlines())


def compute_stats(root_path: str) -> dict[str, Any]:
    """
    Return metrics for the project at *root_path*:

        {
            "total_files": int,
            "total_lines": int,
            "total_bytes": int,
            "languages": [{"name", "files", "lines", "percent"}, ...],   # by lines, desc
            "largest_files": [{"path", "lines", "language"}, ...],
        }
    """
    root = Path(root_path).resolve()
    by_language: dict[str, dict[str, int]] = defaultdict(lambda: {"files": 0, "lines": 0})
    files: list[dict[str, Any]] = []
    total_bytes = 0

    for abs_path in get_flat_files(str(root)):
        content = safe_read(abs_path)
        lines = _count_lines(content)
        language = language_for(abs_path)
        by_language[language]["files"] += 1
        by_language[language]["lines"] += lines
        total_bytes += len(content.encode("utf-8"))
        files.append({
            "path": Path(abs_path).relative_to(root).as_posix(),
            "lines": lines,
            "language": language,
        })

    total_lines = sum(v["lines"] for v in by_language.values())
    languages = [
        {
            "name": name,
            "files": v["files"],
            "lines": v["lines"],
            "percent": round(100 * v["lines"] / total_lines, 1) if total_lines else 0.0,
        }
        for name, v in by_language.items()
    ]
    languages.sort(key=lambda lang: (-lang["lines"], lang["name"]))

    files.sort(key=lambda f: (-f["lines"], f["path"]))

    return {
        "total_files": len(files),
        "total_lines": total_lines,
        "total_bytes": total_bytes,
        "languages": languages,
        "largest_files": files[:TOP_FILES],
    }


async def compute_stats_async(root_path: str) -> dict[str, Any]:
    """Async wrapper around :func:`compute_stats` (reads files in a thread)."""
    return await asyncio.to_thread(compute_stats, root_path)
