from __future__ import annotations

from typing import Any
import json

from app.config import settings
from .llm import generate_text


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp_score(value: Any) -> float:
    score = _safe_float(value, 0.0)
    return max(0.0, min(5.0, round(score, 2)))


def _extract_json(raw_text: str) -> dict[str, Any] | None:
    text = raw_text.strip()
    if not text:
        return None

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        parsed = json.loads(text[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _build_eval_prompt(
    title: str,
    description: str,
    diff: str,
    context: list[str],
    review_text: str,
    pr_additions: int | None = None,
    pr_deletions: int | None = None,
    pr_files_changed: int | None = None,
) -> str:
    context_preview = "\n\n".join(context[:4])
    context_preview = context_preview[:8000]
    diff_preview = diff[:12000]

    # Calculate PR size metrics for evaluator context
    pr_size_info = ""
    if pr_additions is not None and pr_deletions is not None:
        churn = pr_additions + pr_deletions
        size_label = "small" if churn < 100 else "medium" if churn < 500 else "large"
        pr_size_info = f"\nPR Size Context: {churn} total lines changed (+{pr_additions}/-{pr_deletions}), {size_label} PR"
        if pr_files_changed:
            pr_size_info += f", {pr_files_changed} files modified"

    return (
        "You are an evaluator for AI pull-request reviews.\n"
        "Score strictly from 0 to 5 with one decimal point.\n"
        "Return ONLY valid JSON with keys:\n"
        "groundedness, relevance, context_relevance, actionability, false_positive_risk, readability, brevity, coverage, "
        "reasoning, key_issues_missed, notes\n\n"
        "Metric Definitions:\n"
        "- groundedness: claims are supported by diff/context (0=unsupported, 5=well-grounded)\n"
        "- relevance: comments focus on this specific PR (0=off-topic, 5=highly relevant)\n"
        "- context_relevance: retrieved context helped review accuracy (0=useless, 5=essential)\n"
        "- actionability: concrete and feasible suggestions (0=vague, 5=very actionable)\n"
        "- false_positive_risk: likelihood of misleading/incorrect claims (0=trustworthy, 5=many errors)\n"
        "- readability: clear, professional language (0=incomprehensible, 5=excellent clarity)\n"
        "- brevity: concise without losing key points (0=verbose, 5=perfectly concise)\n"
        "- coverage: captures important issues likely present (0=misses critical issues, 5=comprehensive)\n\n"
        "Additional fields:\n"
        "- reasoning: brief explanation for why you gave these scores (why/what made you score this way)\n"
        "- key_issues_missed: list any critical issues the review should have mentioned but didn't\n"
        "- notes: overall assessment <= 2 sentences\n\n"
        f"PR Context:{pr_size_info}\n"
        f"Title: {title}\n"
        f"Description: {description or 'No description'}\n\n"
        f"Diff (preview):\n```diff\n{diff_preview}\n```\n\n"
        f"Retrieved codebase context:\n{context_preview or 'No context'}\n\n"
        f"AI Review to evaluate:\n{review_text}\n"
    )


def evaluate_review_metrics(
    title: str,
    description: str,
    diff: str,
    context: list[str],
    review_text: str,
    pr_additions: int | None = None,
    pr_deletions: int | None = None,
    pr_files_changed: int | None = None,
) -> dict[str, Any] | None:
    """
    Comprehensive review quality evaluation combining LLM scoring + PR metadata metrics.
    
    LLM-scored metrics (0-5 scale):
    - groundedness, relevance, context_relevance, actionability, false_positive_risk
    - readability, brevity, coverage, honestHelpful (composite)
    
    Metadata metrics (computed, no LLM needed):
    - codeChurnRatio: (additions + deletions) / estimated_total_lines [0-1, lower better for large PRs]
    - reviewCoverage: lines_mentioned_in_review / total_changed_lines [0-1, higher better]
    - suggestionDensity: number_of_suggestions / PR_size [0-1, adjusted for PR size]
    - filesChanged: raw count of files modified
    
    Returns: dict with all metrics, reasoning, and key_issues_missed, or None if evaluation failed.
    """
    if not settings.evaluation_enabled:
        return None

    prompt = _build_eval_prompt(title, description, diff, context, review_text, pr_additions, pr_deletions, pr_files_changed)
    response = generate_text(prompt, model_override=settings.evaluation_model)
    parsed = _extract_json(response)
    if not parsed:
        return None

    # LLM-scored metrics
    groundedness = _clamp_score(parsed.get("groundedness"))
    relevance = _clamp_score(parsed.get("relevance"))
    context_relevance = _clamp_score(parsed.get("context_relevance"))
    actionability = _clamp_score(parsed.get("actionability"))
    false_positive_risk = _clamp_score(parsed.get("false_positive_risk"))
    readability = _clamp_score(parsed.get("readability"))
    brevity = _clamp_score(parsed.get("brevity"))
    coverage = _clamp_score(parsed.get("coverage"))

    # Composite score: favors truthful, relevant, and actionable reviews while penalizing false positives.
    honest_helpful = round(
        (
            groundedness
            + relevance
            + context_relevance
            + actionability
            + coverage
            + (5.0 - false_positive_risk)
        )
        / 6.0,
        2,
    )

    # Extract structured reasoning and missed issues from LLM response
    reasoning = parsed.get("reasoning")
    reasoning_text = reasoning if isinstance(reasoning, str) else ""
    
    key_issues_missed = parsed.get("key_issues_missed")
    key_issues_text = key_issues_missed if isinstance(key_issues_missed, (str, list)) else ""

    notes = parsed.get("notes")
    note_text = notes if isinstance(notes, str) else ""

    # Compute PR metadata metrics (no LLM needed, deterministic)
    metadata = {}
    if pr_additions is not None and pr_deletions is not None:
        churn = pr_additions + pr_deletions
        # Estimate total lines in PR (rough: churn * 2, since additions+deletions show net change)
        estimated_total_lines = max(churn * 2, 100)  # min 100 to avoid division issues
        
        # codeChurnRatio: measure of PR size complexity (0-1, lower is smaller PR)
        code_churn_ratio = round(min(churn / max(estimated_total_lines, 1), 1.0), 3)
        metadata["codeChurnRatio"] = code_churn_ratio
        
        # reviewCoverage: estimate % of changed lines mentioned in review
        # Count mentions of specific line patterns or function names from diff
        review_mentions = 0
        for line in diff.split("\n"):
            if line.startswith("+") or line.startswith("-"):
                # Simple heuristic: if review mentions key identifiers from diff, count it
                stripped = line[1:].strip()
                if stripped and len(stripped) > 3 and stripped in review_text:
                    review_mentions += 1
        
        review_coverage = round(min(review_mentions / max(churn, 1), 1.0), 3) if churn > 0 else 0.0
        metadata["reviewCoverage"] = review_coverage
        
        # suggestionDensity: #suggestions per PR size (higher density on small PRs is good)
        suggestion_count = review_text.count("suggest") + review_text.count("should") + review_text.count("consider")
        suggestion_density = round(suggestion_count / max(churn / 10, 1), 2)  # normalize per 10-line chunk
        metadata["suggestionDensity"] = suggestion_density

    if pr_files_changed is not None:
        metadata["filesChanged"] = pr_files_changed

    return {
        "groundedness": groundedness,
        "relevance": relevance,
        "contextRelevance": context_relevance,
        "actionability": actionability,
        "falsePositiveRisk": false_positive_risk,
        "readability": readability,
        "brevity": brevity,
        "coverage": coverage,
        "honestHelpful": honest_helpful,
        "reasoning": reasoning_text[:500],
        "keyIssuesMissed": key_issues_text if isinstance(key_issues_text, str) else json.dumps(key_issues_text)[:500],
        "notes": note_text[:500],
        "model": settings.evaluation_model,
        **metadata,  # Include all computed metadata metrics
    }
