from __future__ import annotations

from typing import Any

from app.config import settings
import hmac
import json
from hashlib import sha256

import requests

from .github_client import get_pull_request_data, get_pull_request_diff, post_review_comment
from .retriever import retrieve_context
from .llm import generate_text


def _extract_diff_files(diff: str) -> list[str]:
    files: list[str] = []
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            parts = line.split()
            if len(parts) >= 4:
                path = parts[2].replace("a/", "", 1)
                if path not in files:
                    files.append(path)
    return files


def _build_prompt(title: str, description: str, diff: str, context: list[str]) -> str:
    context_block = "\n\n".join(context) if context else "No additional context found."
    diff_block = diff[: settings.diff_max_chars]
    files = _extract_diff_files(diff)
    file_list = "\n".join(f"- {path}" for path in files) if files else "- (none)"

    return (
        "You are an expert code reviewer. Analyze the pull request and provide a detailed, constructive review.\n"
        "Be thorough and specific. Provide actionable feedback with concrete examples.\n"
        "Use LAURA-style guidance: focus on logic, security, and performance.\n"
        "Reduce false positives by grounding claims in the provided context/diff.\n\n"
        f"PR Title: {title}\n"
        f"PR Description: {description or 'No description provided'}\n\n"
        "Files Changed:\n"
        f"{file_list}\n\n"
        "Context from Codebase:\n"
        f"{context_block}\n\n"
        "Code Changes:\n"
        "```diff\n"
        f"{diff_block}\n"
        "```\n\n"
        "Please provide (markdown):\n"
        "1. Walkthrough (file-by-file, explain intent + effect)\n"
        "2. Sequence Diagram (Mermaid sequence diagram if flow changes apply). Use a ```mermaid``` block. Keep labels simple, no quotes/braces in notes.\n"
        "3. Summary (3-6 bullet points)\n"
        "4. Strengths (at least 3 bullets)\n"
        "5. Issues (bugs, security, code smells) with severity labels [high|medium|low]\n"
        "6. Suggestions (specific code improvements, include examples when possible)\n"
        "7. Tests & Verification (what to run/what to watch)\n"
        "8. Risk Score (0-5) with one-line justification\n"
        "9. Poem (short creative summary at the end)\n"
        "If you are uncertain, say so and explain assumptions."
    )


def _estimate_tokens(text: str) -> int:
    divisor = settings.token_estimate_divisor or 4
    return max(1, int(len(text) / divisor)) if text else 0


def _estimate_cost(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1000.0) * settings.cost_input_per_1k + (
        output_tokens / 1000.0
    ) * settings.cost_output_per_1k


def _trim_context_to_budget(
    title: str, description: str, diff: str, context: list[str]
) -> tuple[list[str], int]:
    trimmed = list(context)
    prompt = _build_prompt(title, description, diff, trimmed)
    tokens = _estimate_tokens(prompt)

    while trimmed and tokens > settings.max_prompt_tokens_estimate:
        trimmed.pop()
        prompt = _build_prompt(title, description, diff, trimmed)
        tokens = _estimate_tokens(prompt)

    return trimmed, tokens


def _post_review_to_app(payload: dict[str, Any], review_text: str, metrics: dict[str, Any]) -> None:
    if not settings.app_base_url:
        print("review_ingest_skipped", "APP_BASE_URL not set")
        return

    ts = str(int(__import__("time").time()))
    body = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(
        settings.shared_secret.encode("utf-8"),
        f"{ts}.".encode("utf-8") + body.encode("utf-8"),
        sha256,
    ).hexdigest()

    url = f"{settings.app_base_url.rstrip('/')}/api/reviews/ingest"
    resp = requests.post(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-cm-timestamp": ts,
            "x-cm-signature": signature,
        },
        timeout=20,
    )

    if not resp.ok:
        print("review_ingest_failed", {"status": resp.status_code, "body": resp.text})


async def run_review(payload: dict[str, Any]) -> dict[str, Any]:
    owner = payload.get("owner")
    repo = payload.get("repo")
    pr_number = payload.get("prNumber")
    token = payload.get("token")

    if not owner or not repo or not pr_number or not token:
        raise ValueError("Missing owner/repo/prNumber/token in payload")

    pr_data = get_pull_request_data(token, owner, repo, int(pr_number))
    title = pr_data.get("title") or ""
    description = pr_data.get("body") or ""

    diff = get_pull_request_diff(token, owner, repo, int(pr_number))
    context = retrieve_context(f"{title}\n{description}", f"{owner}/{repo}")
    context, input_tokens = _trim_context_to_budget(title, description, diff, context)

    prompt = _build_prompt(title, description, diff, context)
    review = generate_text(prompt)

    output_tokens = min(_estimate_tokens(review), settings.max_output_tokens_estimate)
    estimated_cost = _estimate_cost(input_tokens, output_tokens)
    metrics = {
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "estimatedCost": estimated_cost,
    }
    cost_line = f"Usage (est.): input {input_tokens} tok, output {output_tokens} tok"
    if settings.cost_input_per_1k or settings.cost_output_per_1k:
        cost_line += f", cost ${estimated_cost:.6f}"

    if review:
        comment_body = (
            "## 🤖 AI CodeMonkey Review\n\n"
            f"{review}\n\n---\n"
            f"{cost_line}\n"
            "*Powered by CodeMonkey*"
        )
        post_review_comment(token, owner, repo, int(pr_number), comment_body)

        _post_review_to_app(
            {
                "owner": owner,
                "repo": repo,
                "prNumber": int(pr_number),
                "prTitle": title,
                "prUrl": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                "review": review,
                "status": "completed",
                **metrics,
            },
            review,
            metrics,
        )

    return {
        "repo": f"{owner}/{repo}",
        "prNumber": pr_number,
        "posted": bool(review),
        **metrics,
    }
