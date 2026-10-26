from __future__ import annotations

from collections.abc import Iterator

import pytest

from lib.agent.review_graph import run_review_agent
from lib.agent.tools import ToolContext, execute_tool


def _sequence_generator(responses: list[str]):
    values: Iterator[str] = iter(responses)

    def generate(prompt: str, **_: object) -> str:
        assert "LangGraph code-review agent" in prompt or "final review markdown" in prompt
        return next(values)

    return generate


def test_agent_executes_tool_then_returns_review(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "lib.agent.review_graph.execute_tool",
        lambda name, arguments, context: f"evidence for {arguments['path']}",
    )
    generator = _sequence_generator(
        [
            '{"action":"tool","name":"inspect_diff","arguments":{"path":"app.py"}}',
            "## Review\n\nNo blocking issues found.",
        ]
    )

    result = run_review_agent(
        prompt="Review this change",
        owner="acme",
        repo="demo",
        token="secret",
        diff="diff --git a/app.py b/app.py",
        changed_files=["app.py"],
        generator=generator,
        max_tool_calls=2,
    )

    assert result.review.startswith("## Review")
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0]["name"] == "inspect_diff"
    assert "secret" not in repr(result.tool_calls)


def test_agent_can_finish_without_tool() -> None:
    result = run_review_agent(
        prompt="Review this change",
        owner="acme",
        repo="demo",
        token="secret",
        diff="",
        changed_files=[],
        generator=_sequence_generator(["## Review\n\nLooks good."]),
        max_tool_calls=2,
    )
    assert result.review.endswith("Looks good.")
    assert result.tool_calls == []


def test_inspect_diff_is_bounded_and_path_is_validated() -> None:
    context = ToolContext(
        owner="acme",
        repo="demo",
        token="secret",
        diff=(
            "diff --git a/app.py b/app.py\n@@ -1 +1 @@\n-old\n+new\n"
            "diff --git a/other.py b/other.py\n@@ -1 +1 @@\n-a\n+b\n"
        ),
        changed_files=["app.py", "other.py"],
    )
    result = execute_tool("inspect_diff", {"path": "app.py"}, context)
    assert "+new" in result
    assert "other.py" not in result

    with pytest.raises(ValueError, match="relative repository path"):
        execute_tool("inspect_diff", {"path": "../secret"}, context)
