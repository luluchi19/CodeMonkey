from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

from ..github_client import get_file_content
from ..retriever import retrieve_context


TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "search_code",
        "description": "Retrieve repository chunks relevant to a code question.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "changed_files_only": {"type": "boolean", "default": True},
            },
            "required": ["query"],
        },
    },
    {
        "name": "read_code",
        "description": "Read a bounded line range from a repository file.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "start_line": {"type": "integer", "minimum": 1},
                "end_line": {"type": "integer", "minimum": 1},
            },
            "required": ["path"],
        },
    },
    {
        "name": "inspect_diff",
        "description": "Return the patch for one changed file from the current PR diff.",
        "parameters": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
]


@dataclass(frozen=True)
class ToolContext:
    owner: str
    repo: str
    token: str
    diff: str
    changed_files: list[str]

    @property
    def repo_id(self) -> str:
        return f"{self.owner}/{self.repo}"


def _safe_repo_path(raw_path: str) -> str:
    path = raw_path.strip().replace("\\", "/")
    pure = PurePosixPath(path)
    if not path or pure.is_absolute() or ".." in pure.parts:
        raise ValueError("path must be a relative repository path")
    return str(pure)


def _read_code(arguments: dict[str, Any], context: ToolContext) -> str:
    path = _safe_repo_path(str(arguments.get("path") or ""))
    start_line = max(1, int(arguments.get("start_line") or 1))
    requested_end = int(arguments.get("end_line") or (start_line + 199))
    end_line = max(start_line, min(requested_end, start_line + 249))
    content = get_file_content(context.token, context.owner, context.repo, path)
    if content is None:
        return f"File not found: {path}"

    lines = content.splitlines()
    selected = lines[start_line - 1 : end_line]
    if not selected:
        return f"No lines in requested range for {path}. File has {len(lines)} lines."
    rendered = "\n".join(
        f"{line_number:>5}: {line}"
        for line_number, line in enumerate(selected, start=start_line)
    )
    return f"FILE {path} lines {start_line}-{start_line + len(selected) - 1}\n{rendered}"


def _inspect_diff(arguments: dict[str, Any], context: ToolContext) -> str:
    path = _safe_repo_path(str(arguments.get("path") or ""))
    marker = f"diff --git a/{path} b/{path}"
    start = context.diff.find(marker)
    if start < 0:
        return f"No patch found for changed file: {path}"
    next_file = context.diff.find("\ndiff --git ", start + len(marker))
    patch = context.diff[start : next_file if next_file >= 0 else None]
    return patch[:12000]


def _search_code(arguments: dict[str, Any], context: ToolContext) -> str:
    query = str(arguments.get("query") or "").strip()
    if not query:
        raise ValueError("query is required")
    changed_only = arguments.get("changed_files_only", True) is not False
    file_list = context.changed_files if changed_only else None
    chunks, warning = retrieve_context(query, context.repo_id, file_list)
    if not chunks:
        return warning or "No matching repository context was found."
    body = "\n\n--- retrieved chunk ---\n\n".join(chunks)
    prefix = f"WARNING: {warning}\n\n" if warning else ""
    return (prefix + body)[:16000]


def execute_tool(name: str, arguments: dict[str, Any], context: ToolContext) -> str:
    """Execute one allow-listed, read-only agent tool."""
    if name == "search_code":
        return _search_code(arguments, context)
    if name == "read_code":
        return _read_code(arguments, context)
    if name == "inspect_diff":
        return _inspect_diff(arguments, context)
    raise ValueError(f"Unknown tool: {name}")
