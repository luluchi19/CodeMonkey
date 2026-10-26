"""Run a deterministic LangGraph + tool-calling demonstration without API keys."""

from __future__ import annotations

from collections.abc import Iterator
import json

from lib.agent.review_graph import run_review_agent


def scripted_generator(responses: list[str]):
    values: Iterator[str] = iter(responses)

    def generate(_: str, **__: object) -> str:
        return next(values)

    return generate


def main() -> None:
    diff = """diff --git a/app/auth.py b/app/auth.py
index 1111111..2222222 100644
--- a/app/auth.py
+++ b/app/auth.py
@@ -1,4 +1,4 @@
 def can_delete_repository(user, repository):
-    return repository.owner_id == user.id
+    return True
"""
    result = run_review_agent(
        prompt="Review the authorization change and cite evidence from the diff.",
        owner="demo",
        repo="codemonkey",
        token="not-used-by-inspect-diff",
        diff=diff,
        changed_files=["app/auth.py"],
        generator=scripted_generator(
            [
                json.dumps(
                    {
                        "action": "tool",
                        "name": "inspect_diff",
                        "arguments": {"path": "app/auth.py"},
                    }
                ),
                (
                    "## Review\n\n"
                    "**Blocker - authorization bypass:** `can_delete_repository` now returns "
                    "`True` for every caller. Restore the owner check and add a negative test for "
                    "a non-owner deletion attempt."
                ),
            ]
        ),
        max_tool_calls=2,
    )

    print("=== LangGraph execution ===")
    print("START -> agent -> tools -> agent -> END")
    print(f"Tool calls: {len(result.tool_calls)}")
    for index, call in enumerate(result.tool_calls, start=1):
        print(
            f"{index}. {call['name']}({json.dumps(call['arguments'])}) "
            f"elapsed={call['elapsed_ms']}ms error={call['error']}"
        )
        print("   evidence:", call["result"].splitlines()[-1])
    print("\n=== Final review ===")
    print(result.review)


if __name__ == "__main__":
    main()
