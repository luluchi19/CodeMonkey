from __future__ import annotations

from typing import Any

from app.config import settings
import hmac
import json
from hashlib import sha256
import time
import math

import requests

from .github_client import get_pull_request_data, get_pull_request_diff, post_review_comment
from .citations import collect_references
from .retriever import retrieve_context
from .llm import generate_text
from .review_evaluator import evaluate_review_metrics
from .trulens_recorder import record_trulens_review


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


SECTION_ORDER = [
    "walkthrough",
    "sequence_diagram",
    "summary",
    "strengths",
    "issues",
    "suggestions",
    "tests",
    "references",
    "risk_score",
    "poem",
]

SECTION_INSTRUCTIONS = {
    "walkthrough": "Walkthrough (file-by-file, explain intent + effect)",
    "sequence_diagram": "Sequence Diagram (Mermaid sequence diagram if flow changes apply). Use a ```mermaid``` block. Keep labels simple, no quotes/braces in notes.",
    "summary": "Summary (3-6 bullet points)",
    "strengths": "Strengths (at least 3 bullets)",
    "issues": "Issues (bugs, security, code smells) with severity labels [high|medium|low]",
    "suggestions": "Suggestions (specific code improvements; mention file path and line numbers and include examples code when possible)",
    "tests": "Tests & Verification (what to run/what to watch)",
    "references": "References (include a markdown list of links; use [ref:key] tags to select from provided references)",
    "risk_score": "Risk Score (0-5) with one-line justification and a label: 0 Masterpiece, 1 Very Safe, 2 Steady, 3 Caution, 4 Risky, 5 Super Dangerous",
    "poem": "Poem (short creative summary at the end)",
}

REVIEW_EVAL_MODEL = "models/gemini-2.5-flash-lite"


def _build_review_eval_prompt(review_text: str) -> str:
    return (
        "You are a senior code review editor. Improve the AI review for accuracy and usefulness.\n"
        "Remove hallucinations, fix unclear claims, and keep the same structure/sections.\n"
        "If no changes are needed, return the original review exactly.\n\n"
        "Return ONLY the final review markdown, with no extra commentary.\n\n"
        "AI Review:\n"
        f"{review_text}\n"
    )


def _evaluate_review(
    review_text: str,
    on_fallback: callable | None = None,
    on_success: callable | None = None,
) -> str | None:
    if not review_text:
        return None

    prompt = _build_review_eval_prompt(review_text)
    return generate_text(
        prompt,
        model_override=REVIEW_EVAL_MODEL,
        on_fallback=on_fallback,
        on_success=on_success,
    )


def _normalize_review_sections(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return list(SECTION_ORDER)

    normalized = [item for item in raw if isinstance(item, str)]
    selected = [key for key in SECTION_ORDER if key in normalized]
    return selected or list(SECTION_ORDER)




def _build_prompt(
    owner: str,
    repo: str,
    pr_number: int,
    title: str,
    description: str,
    diff: str,
    context: list[str],
    review_language: str,
    references: dict[str, str],
    review_sections: list[str],
    base_ref: str | None,
    context_warning: str | None,
) -> str:
    context_block = "\n\n".join(context) if context else "No additional context found."
    if context_warning:
        context_block = f"{context_warning}\n\n{context_block}"
    diff_block = diff[: settings.diff_max_chars]
    files = _extract_diff_files(diff)
    file_list = "\n".join(f"- {path}" for path in files) if files else "- (none)"
    language_line = (
        "Write the review in Vietnamese."
        if review_language == "vi"
        else "Write the review in English."
    )
    if references:
        reference_lines = "\n".join(
            f"- [ref:{key}] {url}" for key, url in references.items()
        )
        reference_block = (
            "Reference links (use [ref:key] when relevant):\n" + reference_lines
        )
    else:
        reference_block = "Reference links: (none)"

    sections = [
        SECTION_INSTRUCTIONS[key]
        for key in review_sections
        if key in SECTION_INSTRUCTIONS
    ]
    if not sections:
        sections = [SECTION_INSTRUCTIONS[key] for key in SECTION_ORDER]

    sections_block = "\n".join(
        f"{idx}. {text}" for idx, text in enumerate(sections, start=1)
    )

    repo_url = f"https://github.com/{owner}/{repo}"
    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_number}"
    base_ref_line = base_ref or "main"

    formatting_rules = (
        "Output format requirements:\n"
        "- Start with a single summary badges line: 🐞 Bugs (n) | 🧯 Risks (n) | ✅ Tests (n) | 💡 Suggestions (n).\n"
        "- Use <details><summary><strong>Section Title</strong></summary> blocks for every requested section.\n"
        "- Use concise bullets for issues with [high|medium|low].\n"
        "- For code references, include a GitHub blob link using the base branch:"
        f" https://github.com/{owner}/{repo}/blob/{base_ref_line}/{{path}}#Lx-Ly .\n"
        "- For code blocks, wrap with fenced blocks and include the language.\n"
        "- Keep tone professional and actionable.\n"
    )

    return (
        "You are an expert code reviewer. Analyze the pull request and provide a detailed, constructive review.\n"
        "Be thorough and specific. Provide actionable feedback with concrete examples.\n"
        "Use LAURA-style guidance: focus on logic, security, and performance.\n"
        "Reduce false positives by grounding claims in the provided context/diff.\n\n"
        f"{language_line}\n\n"
        f"Repository URL: {repo_url}\n"
        f"PR URL: {pr_url}\n"
        f"PR Title: {title}\n"
        f"PR Description: {description or 'No description provided'}\n\n"
        f"Base branch: {base_ref_line}\n"
        "Files Changed:\n"
        f"{file_list}\n\n"
        "Context from Codebase:\n"
        f"{context_block}\n\n"
        "Code Changes:\n"
        "```diff\n"
        f"{diff_block}\n"
        "```\n\n"
        f"{reference_block}\n\n"
        f"{formatting_rules}\n\n"
        "Please provide (markdown):\n"
        f"{sections_block}\n"
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
    owner: str,
    repo: str,
    pr_number: int,
    title: str,
    description: str,
    diff: str,
    context: list[str],
    review_language: str,
    references: dict[str, str],
    review_sections: list[str],
    base_ref: str | None,
    context_warning: str | None,
) -> tuple[list[str], int]:
    trimmed = list(context)
    prompt = _build_prompt(
        owner,
        repo,
        pr_number,
        title,
        description,
        diff,
        trimmed,
        review_language,
        references,
        review_sections,
        base_ref,
        context_warning,
    )
    tokens = _estimate_tokens(prompt)

    while trimmed and tokens > settings.max_prompt_tokens_estimate:
        trimmed.pop()
        prompt = _build_prompt(
            owner,
            repo,
            pr_number,
            title,
            description,
            diff,
            trimmed,
            review_language,
            references,
            review_sections,
            base_ref,
            context_warning,
        )
        tokens = _estimate_tokens(prompt)

    return trimmed, tokens


def _post_review_to_app(payload: dict[str, Any], review_text: str, metrics: dict[str, Any]) -> bool:
    if not settings.app_base_url:
        print("review_ingest_skipped", "APP_BASE_URL not set")
        return False

    ts = str(int(__import__("time").time()))
    body = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(
        settings.shared_secret.encode("utf-8"),
        f"{ts}.".encode("utf-8") + body.encode("utf-8"),
        sha256,
    ).hexdigest()

    url = f"{settings.app_base_url.rstrip('/')}/api/reviews/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-cm-timestamp": ts,
        "x-cm-signature": signature,
    }

    for attempt in range(1, 4):
        try:
            resp = requests.post(url, data=body, headers=headers, timeout=20)
            if resp.ok:
                return True
            print(
                "review_ingest_failed",
                {"attempt": attempt, "status": resp.status_code, "body": resp.text},
            )
        except requests.RequestException as exc:
            print("review_ingest_error", {"attempt": attempt, "error": str(exc)})

        if attempt < 3:
            time.sleep(2 ** (attempt - 1))

    return False


def _render_references(review: str, references: dict[str, str]) -> str:
    if not review or not references:
        return review

    used_keys: list[str] = []
    for key, url in references.items():
        token = f"[ref:{key}]"
        if token in review:
            review = review.replace(token, f"[{key}]({url})")
            used_keys.append(key)

    if "references" not in review.lower():
        reference_lines = "\n".join(
            f"- [{key}]({url})" for key, url in references.items()
        )
        review = f"{review}\n\n### References\n{reference_lines}"

    return review


def _post_review_event(review_id: str | None, level: str, message: str, meta: dict[str, Any]) -> None:
    if not settings.app_base_url or not review_id:
        return

    ts = str(int(__import__("time").time()))
    payload = {
        "reviewId": review_id,
        "level": level,
        "message": message,
        "meta": meta,
    }
    body = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(
        settings.shared_secret.encode("utf-8"),
        f"{ts}.".encode("utf-8") + body.encode("utf-8"),
        sha256,
    ).hexdigest()

    url = f"{settings.app_base_url.rstrip('/')}/api/reviews/logs"
    headers = {
        "Content-Type": "application/json",
        "x-cm-timestamp": ts,
        "x-cm-signature": signature,
    }

    for attempt in range(1, 4):
        try:
            resp = requests.post(url, data=body, headers=headers, timeout=15)
            if resp.ok:
                return
            print(
                "review_event_failed",
                {"attempt": attempt, "status": resp.status_code, "body": resp.text},
            )
        except requests.RequestException as exc:
            print("review_event_error", {"attempt": attempt, "error": str(exc)})

        if attempt < 3:
            time.sleep(2 ** (attempt - 1))


async def run_review(payload: dict[str, Any]) -> dict[str, Any]:
    owner = payload.get("owner")
    repo = payload.get("repo")
    pr_number = payload.get("prNumber")
    token = payload.get("token")
    review_id = payload.get("reviewId")
    subscription_tier = payload.get("subscriptionTier") or "FREE"
    review_language = payload.get("reviewLanguage") or "en"
    review_sections = _normalize_review_sections(payload.get("reviewSections"))
    review_audit_enabled = (
        payload.get("reviewAuditEnabled") is True
        and payload.get("reviewAuditEnabledSource") == "user"
    )
    max_pr_tokens = payload.get("maxPrTokens")

    if not owner or not repo or not pr_number or not token:
        raise ValueError("Missing owner/repo/prNumber/token in payload")

    start_time = time.monotonic()
    total_steps = 6

    def elapsed_ms() -> int:
        return int((time.monotonic() - start_time) * 1000)

    def eta_ms(step_index: int) -> int:
        if step_index <= 0:
            return 0
        remaining = total_steps - step_index
        if remaining <= 0:
            return 0
        return int(elapsed_ms() * (remaining / step_index))

    try:
        print(
            "llm_key_presence",
            {
                "openrouter": bool(settings.openrouter_api_key),
                "nvidia": bool(settings.nvidia_nim_api_key),
            },
        )
        _post_review_event(
            review_id,
            "info",
            "Review started",
            {"elapsedMs": elapsed_ms(), "etaMs": eta_ms(1)},
        )

        pr_data = get_pull_request_data(token, owner, repo, int(pr_number))
        title = pr_data.get("title") or ""
        description = pr_data.get("body") or ""
        author_login = pr_data.get("user", {}).get("login")
        base_ref = pr_data.get("base", {}).get("ref")

        _post_review_event(
            review_id,
            "info",
            "Fetched PR metadata",
            {"elapsedMs": elapsed_ms(), "etaMs": eta_ms(2)},
        )

        diff = get_pull_request_diff(token, owner, repo, int(pr_number))
        _post_review_event(
            review_id,
            "info",
            "Loaded PR diff",
            {"elapsedMs": elapsed_ms(), "etaMs": eta_ms(3)},
        )

        references = collect_references([title, description, diff])
        context, context_warning = retrieve_context(
            f"{title}\n{description}", f"{owner}/{repo}"
        )
        context, input_tokens = _trim_context_to_budget(
            owner,
            repo,
            int(pr_number),
            title,
            description,
            diff,
            context,
            review_language,
            references,
            review_sections,
            base_ref,
            context_warning,
        )
        token_multiplier = settings.token_estimate_multiplier or 1.0

        if context_warning:
            _post_review_event(
                review_id,
                "warn",
                context_warning,
                {"elapsedMs": elapsed_ms(), "etaMs": eta_ms(4)},
            )
        else:
            _post_review_event(
                review_id,
                "info",
                "Retrieved codebase context",
                {"elapsedMs": elapsed_ms(), "etaMs": eta_ms(4)},
            )

        estimated_total = math.ceil(
            (input_tokens + settings.max_output_tokens_estimate) * token_multiplier
        )
        if (
            subscription_tier == "FREE"
            and max_pr_tokens
            and estimated_total > int(max_pr_tokens)
        ):
            message = (
                "This pull request is too large for the free plan. "
                f"Estimated {estimated_total} tokens exceeds the limit of {int(max_pr_tokens)}."
            )
            ingest_ok = _post_review_to_app(
                {
                    "owner": owner,
                    "repo": repo,
                    "prNumber": int(pr_number),
                    "prTitle": title,
                    "prUrl": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                    "review": message,
                    "status": "failed",
                    "reviewId": review_id,
                    "inputTokens": math.ceil(input_tokens * token_multiplier),
                    "outputTokens": 0,
                    "estimatedCost": 0.0,
                },
                message,
                {},
            )

            if not ingest_ok:
                _post_review_event(
                    review_id,
                    "error",
                    "Review failed (ingest failed)",
                    {
                        "finalStatus": "failed",
                        "reviewText": message,
                    },
                )
            return {
                "repo": f"{owner}/{repo}",
                "prNumber": pr_number,
                "posted": False,
                "status": "failed",
                "reason": message,
                "inputTokens": math.ceil(input_tokens * token_multiplier),
                "outputTokens": 0,
                "estimatedCost": 0.0,
            }

        prompt = _build_prompt(
            owner,
            repo,
            int(pr_number),
            title,
            description,
            diff,
            context,
            review_language,
            references,
            review_sections,
            base_ref,
            context_warning,
        )

        _post_review_event(
            review_id,
            "info",
            "Generating review",
            {"elapsedMs": elapsed_ms(), "etaMs": eta_ms(5)},
        )
        def _fallback_logger(
            source: str,
            target: str,
            source_model: str,
            target_model: str,
            error: str,
        ) -> None:
            _post_review_event(
                review_id,
                "warn",
                "LLM fallback triggered",
                {
                    "from": source,
                    "to": target,
                    "fromModel": source_model,
                    "toModel": target_model,
                    "error": error,
                    "elapsedMs": elapsed_ms(),
                },
            )

        selected_provider: str | None = None
        selected_model: str | None = None
        audit_provider: str | None = None
        audit_model: str | None = None

        def _success_logger(source: str, model: str) -> None:
            nonlocal selected_provider, selected_model
            selected_provider = source
            selected_model = model
            _post_review_event(
                review_id,
                "info",
                "LLM provider selected",
                {"provider": source, "model": model, "elapsedMs": elapsed_ms()},
            )

        def _audit_success_logger(source: str, model: str) -> None:
            nonlocal audit_provider, audit_model
            audit_provider = source
            audit_model = model
            _post_review_event(
                review_id,
                "info",
                "LLM audit provider selected",
                {"provider": source, "model": model, "elapsedMs": elapsed_ms()},
            )

        review = generate_text(
            prompt,
            on_fallback=_fallback_logger,
            on_success=_success_logger,
        )
        review = _render_references(review, references)

        review_eval = None
        if subscription_tier == "PRO" and review_audit_enabled:
            _post_review_event(
                review_id,
                "info",
                "Evaluating review quality",
                {"elapsedMs": elapsed_ms(), "etaMs": 0},
            )
            try:
                review_eval = _evaluate_review(
                    review,
                    on_fallback=_fallback_logger,
                    on_success=_audit_success_logger,
                )
                if review_eval:
                    cleaned_eval = review_eval.strip()
                    cleaned_review = review.strip()
                    if cleaned_eval == cleaned_review:
                        _post_review_event(
                            review_id,
                            "info",
                            "Review quality check made no changes",
                            {"elapsedMs": elapsed_ms(), "etaMs": 0},
                        )
                    else:
                        _post_review_event(
                            review_id,
                            "info",
                            "Review quality check updated review",
                            {"elapsedMs": elapsed_ms(), "etaMs": 0},
                        )
                    review = cleaned_eval
                _post_review_event(
                    review_id,
                    "info",
                    "Review quality check completed",
                    {"elapsedMs": elapsed_ms(), "etaMs": 0},
                )
            except Exception as exc:
                _post_review_event(
                    review_id,
                    "warn",
                    "Review quality check failed",
                    {"elapsedMs": elapsed_ms(), "error": str(exc)},
                )

        evaluation_metrics = None
        try:
            evaluation_metrics = evaluate_review_metrics(
                title,
                description,
                diff,
                context,
                review,
                pr_additions=pr_data.get("additions"),
                pr_deletions=pr_data.get("deletions"),
                pr_files_changed=pr_data.get("changed_files"),
            )
            if evaluation_metrics:
                _post_review_event(
                    review_id,
                    "info",
                    "Review evaluation completed",
                    {
                        "elapsedMs": elapsed_ms(),
                        "scores": evaluation_metrics,
                    },
                )
        except Exception as exc:
            _post_review_event(
                review_id,
                "warn",
                "Review evaluation failed",
                {"elapsedMs": elapsed_ms(), "error": str(exc)},
            )

        if settings.evaluation_use_trulens:
            try:
                ok, message = record_trulens_review(
                    {
                        "repo": f"{owner}/{repo}",
                        "prNumber": pr_number,
                        "title": title,
                        "description": description,
                        "diff": diff[:20000],
                        "context": context[:4],
                        "review": review,
                        "scores": evaluation_metrics,
                    }
                )
                _post_review_event(
                    review_id,
                    "info" if ok else "warn",
                    "TruLens recording" if ok else "TruLens recording skipped",
                    {"detail": message, "elapsedMs": elapsed_ms()},
                )
            except Exception as exc:
                _post_review_event(
                    review_id,
                    "warn",
                    "TruLens recording failed",
                    {"elapsedMs": elapsed_ms(), "error": str(exc)},
                )

        _post_review_event(
            review_id,
            "info",
            "Review generated",
            {
                "elapsedMs": elapsed_ms(),
                "etaMs": eta_ms(6),
                "provider": selected_provider,
                "model": selected_model,
            },
        )

        output_tokens = min(_estimate_tokens(review), settings.max_output_tokens_estimate)
        billable_input_tokens = int(math.ceil(input_tokens * token_multiplier))
        billable_output_tokens = int(math.ceil(output_tokens * token_multiplier))
        estimated_cost = _estimate_cost(billable_input_tokens, billable_output_tokens)
        print(
            "review_token_estimate",
            {
                "inputTokens": billable_input_tokens,
                "outputTokens": billable_output_tokens,
                "maxPromptTokens": settings.max_prompt_tokens_estimate,
                "maxOutputTokens": settings.max_output_tokens_estimate,
            },
        )
        metrics = {
            "inputTokens": billable_input_tokens,
            "outputTokens": billable_output_tokens,
            "estimatedCost": estimated_cost,
        }
        cost_line = (
            f"Usage (est.): input {billable_input_tokens} tok, "
            f"output {billable_output_tokens} tok"
        )
        if settings.cost_input_per_1k or settings.cost_output_per_1k:
            cost_line += f", cost ${estimated_cost:.6f}"

        if review:
            mention_line = (
                f"@{author_login} your review is ready.\n\n"
                if author_login
                else ""
            )
            comment_body = (
                "## 🤖 AI CodeMonkey Review\n\n"
                f"{mention_line}"
                f"{review}\n\n---\n"
                f"{cost_line}\n"
                "*Powered by CodeMonkey*"
            )
            post_review_comment(token, owner, repo, int(pr_number), comment_body)

            _post_review_event(
                review_id,
                "info",
                "Posted review to GitHub",
                {"elapsedMs": elapsed_ms(), "etaMs": 0},
            )

            ingest_ok = _post_review_to_app(
                {
                    "owner": owner,
                    "repo": repo,
                    "prNumber": int(pr_number),
                    "prTitle": title,
                    "prUrl": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                    "review": review,
                    "status": "completed",
                    "reviewId": review_id,
                    "evaluation": evaluation_metrics,
                    **metrics,
                },
                review,
                metrics,
            )

            _post_review_event(
                review_id,
                "info",
                "Review finalized",
                {
                    "finalStatus": "completed",
                    "reviewText": review,
                    "provider": selected_provider,
                    "model": selected_model,
                    "auditProvider": audit_provider,
                    "auditModel": audit_model,
                },
            )

            if not ingest_ok:
                _post_review_event(
                    review_id,
                    "warn",
                    "Review stored via fallback",
                    {
                        "finalStatus": "completed",
                        "reviewText": review,
                    },
                )

        return {
            "repo": f"{owner}/{repo}",
            "prNumber": pr_number,
            "posted": bool(review),
            "llmProvider": selected_provider,
            "llmModel": selected_model,
            "auditProvider": audit_provider,
            "auditModel": audit_model,
            "evaluation": evaluation_metrics,
            **metrics,
        }
    except Exception as exc:
        message = f"Review failed: {exc}"
        _post_review_event(
            review_id,
            "error",
            "Review failed",
            {"elapsedMs": elapsed_ms(), "error": str(exc)},
        )
        ingest_ok = _post_review_to_app(
            {
                "owner": owner,
                "repo": repo,
                "prNumber": int(pr_number),
                "prTitle": "Review failed",
                "prUrl": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                "review": message,
                "status": "failed",
                "reviewId": review_id,
            },
            message,
            {},
        )

        _post_review_event(
            review_id,
            "error",
            "Review finalized",
            {
                "finalStatus": "failed",
                "reviewText": message,
            },
        )

        if not ingest_ok:
            _post_review_event(
                review_id,
                "error",
                "Review failed (ingest failed)",
                {
                    "finalStatus": "failed",
                    "reviewText": message,
                },
            )
        raise
