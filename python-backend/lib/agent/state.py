from __future__ import annotations

from typing import Any, Callable, TypedDict


class ReviewAgentState(TypedDict, total=False):
    prompt: str
    owner: str
    repo: str
    token: str
    diff: str
    changed_files: list[str]
    max_tool_calls: int
    tool_call_count: int
    pending_tool_call: dict[str, Any] | None
    tool_trace: list[dict[str, Any]]
    final_review: str
    generator: Callable[..., str]
    on_fallback: Callable[..., None] | None
    on_success: Callable[..., None] | None
