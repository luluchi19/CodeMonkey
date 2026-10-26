from __future__ import annotations

from dataclasses import dataclass
import json
import re
import time
from typing import Any, Callable, Literal

from langgraph.graph import END, START, StateGraph

from .state import ReviewAgentState
from .tools import TOOL_SCHEMAS, ToolContext, execute_tool


@dataclass(frozen=True)
class ReviewAgentResult:
    review: str
    tool_calls: list[dict[str, Any]]


def _extract_json_object(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, re.DOTALL)
    candidate = fenced.group(1) if fenced else cleaned
    try:
        value = json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None
    return value if isinstance(value, dict) else None


def _tool_instructions(allow_tools: bool) -> str:
    schemas = json.dumps(TOOL_SCHEMAS, ensure_ascii=False, indent=2)
    if allow_tools:
        return (
            "You are running inside a LangGraph code-review agent. Decide whether the "
            "provided evidence is sufficient. If one read-only tool is needed, return ONLY "
            "this JSON object: {\"action\":\"tool\",\"name\":\"tool_name\","
            "\"arguments\":{...}}. Otherwise return the final review markdown directly. "
            "Never invent a tool or call more than one tool per turn.\n\n"
            f"Available tools:\n{schemas}\n\n"
        )
    return (
        "Return the final review markdown now. Do not request another tool and do not wrap "
        "the answer in a JSON envelope.\n\n"
    )


def _render_tool_history(trace: list[dict[str, Any]]) -> str:
    if not trace:
        return ""
    blocks = []
    for item in trace:
        blocks.append(
            "TOOL RESULT\n"
            f"name: {item['name']}\n"
            f"arguments: {json.dumps(item['arguments'], ensure_ascii=False)}\n"
            f"result:\n{item['result']}"
        )
    return "\n\n" + "\n\n".join(blocks) + "\n\n"


def _call_generator(state: ReviewAgentState, allow_tools: bool) -> str:
    generator = state["generator"]
    prompt = (
        _tool_instructions(allow_tools)
        + state["prompt"]
        + _render_tool_history(state.get("tool_trace", []))
    )
    return generator(
        prompt,
        on_fallback=state.get("on_fallback"),
        on_success=state.get("on_success"),
    )


def _agent_node(state: ReviewAgentState) -> dict[str, Any]:
    allow_tools = state.get("tool_call_count", 0) < state.get("max_tool_calls", 3)
    response = _call_generator(state, allow_tools=allow_tools).strip()
    envelope = _extract_json_object(response) if allow_tools else None
    if envelope and envelope.get("action") == "tool":
        return {
            "pending_tool_call": {
                "name": str(envelope.get("name") or ""),
                "arguments": envelope.get("arguments") or {},
            },
            "final_review": "",
        }
    return {"pending_tool_call": None, "final_review": response}


def _tool_node(state: ReviewAgentState) -> dict[str, Any]:
    call = state.get("pending_tool_call") or {}
    name = str(call.get("name") or "")
    arguments = call.get("arguments")
    if not isinstance(arguments, dict):
        arguments = {}
    started = time.perf_counter()
    error: str | None = None
    try:
        result = execute_tool(
            name,
            arguments,
            ToolContext(
                owner=state["owner"],
                repo=state["repo"],
                token=state["token"],
                diff=state["diff"],
                changed_files=state.get("changed_files", []),
            ),
        )
    except Exception as exc:
        error = str(exc)
        result = f"Tool failed: {error}"
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    trace_item = {
        "name": name,
        "arguments": arguments,
        "result": result,
        "error": error,
        "elapsed_ms": elapsed_ms,
    }
    return {
        "pending_tool_call": None,
        "tool_call_count": state.get("tool_call_count", 0) + 1,
        "tool_trace": [*state.get("tool_trace", []), trace_item],
    }


def _route_after_agent(state: ReviewAgentState) -> Literal["tools", "done"]:
    return "tools" if state.get("pending_tool_call") else "done"


def _build_graph():
    builder = StateGraph(ReviewAgentState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", _tool_node)
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent",
        _route_after_agent,
        {"tools": "tools", "done": END},
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


REVIEW_GRAPH = _build_graph()


def run_review_agent(
    *,
    prompt: str,
    owner: str,
    repo: str,
    token: str,
    diff: str,
    changed_files: list[str],
    generator: Callable[..., str],
    max_tool_calls: int = 3,
    on_fallback: Callable[..., None] | None = None,
    on_success: Callable[..., None] | None = None,
) -> ReviewAgentResult:
    """Run the bounded LangGraph tool loop and return a normal final review."""
    initial_state: ReviewAgentState = {
        "prompt": prompt,
        "owner": owner,
        "repo": repo,
        "token": token,
        "diff": diff,
        "changed_files": changed_files,
        "max_tool_calls": max(0, max_tool_calls),
        "tool_call_count": 0,
        "pending_tool_call": None,
        "tool_trace": [],
        "final_review": "",
        "generator": generator,
        "on_fallback": on_fallback,
        "on_success": on_success,
    }
    final_state = REVIEW_GRAPH.invoke(
        initial_state,
        config={"recursion_limit": max(4, max_tool_calls * 2 + 4)},
    )
    review = str(final_state.get("final_review") or "").strip()
    if not review:
        raise RuntimeError("LangGraph agent completed without a final review")
    return ReviewAgentResult(review=review, tool_calls=final_state.get("tool_trace", []))
