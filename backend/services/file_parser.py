"""
File-parser service.

Responsible for:
- Recursively scanning a project directory.
- Building a JSON-serialisable file-tree.
- Providing a flat list of file paths for downstream services.
"""

import asyncio
import os
from pathlib import Path
from typing import Any

from utils.file_utils import ALLOWED_EXTENSIONS, IGNORED_DIRS, is_allowed_file


def _build_tree(root: Path, base: Path) -> list[dict[str, Any]]:
    """
    Recursively build a tree structure for *root*.

    Each node is a dict with keys:
        name  – file/folder name
        path  – path relative to the project root
        type  – "file" | "folder"
        children – (folders only) list of child nodes
    """
    nodes: list[dict[str, Any]] = []

    try:
        entries = sorted(os.scandir(root), key=lambda e: (e.is_file(), e.name.lower()))
    except PermissionError:
        return nodes

    for entry in entries:
        relative = Path(entry.path).relative_to(base).as_posix()

        if entry.is_dir(follow_symlinks=False):
            if entry.name in IGNORED_DIRS:
                continue
            children = _build_tree(Path(entry.path), base)
            nodes.append(
                {
                    "name": entry.name,
                    "path": relative,
                    "type": "folder",
                    "children": children,
                }
            )
        elif entry.is_file(follow_symlinks=False):
            p = Path(entry.path)
            if p.suffix.lower() in ALLOWED_EXTENSIONS and is_allowed_file(p):
                nodes.append(
                    {
                        "name": entry.name,
                        "path": relative,
                        "type": "file",
                    }
                )

    return nodes


def parse_project(root_path: str) -> dict[str, Any]:
    """
    Parse *root_path* and return:
        {
            "root": "<folder name>",
            "tree": [ <tree nodes> ],
            "file_count": <int>,
        }

    Raises ValueError if *root_path* does not point to an existing directory.
    """
    root = Path(root_path).resolve()
    if not root.is_dir():
        raise ValueError(f"Not a directory: {root_path}")

    tree = _build_tree(root, root)
    file_count = _count_files(tree)

    return {
        "root": root.name,
        "tree": tree,
        "file_count": file_count,
    }


def _count_files(nodes: list[dict[str, Any]]) -> int:
    total = 0
    for node in nodes:
        if node["type"] == "file":
            total += 1
        else:
            total += _count_files(node.get("children", []))
    return total


def get_flat_files(root_path: str) -> list[str]:
    """
    Return a flat list of absolute paths for all allowed files under
    *root_path*.  Used by the RAG / summary services.
    """
    result: list[str] = []
    root = Path(root_path).resolve()

    for dirpath, dirnames, filenames in os.walk(root):
        # Prune ignored directories in-place so os.walk skips them
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

        for fname in filenames:
            full = Path(dirpath) / fname
            if is_allowed_file(full):
                result.append(str(full))

    return result


async def get_flat_files_async(root_path: str) -> list[str]:
    """Async wrapper around :func:`get_flat_files` (runs the walk in a thread)."""
    return await asyncio.to_thread(get_flat_files, root_path)


async def parse_project_async(root_path: str) -> dict[str, Any]:
    """Async wrapper around :func:`parse_project` (runs the scan in a thread)."""
    return await asyncio.to_thread(parse_project, root_path)
