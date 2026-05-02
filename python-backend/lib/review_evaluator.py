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
) -> str:
    context_preview = "\n\n".join(context[:4])
    context_preview = context_preview[:8000]
    diff_preview = diff[:12000]

    return (
        "You are an evaluator for AI pull-request reviews.\n"
        "Score strictly from 0 to 5 with one decimal point.\n"
        "Return ONLY valid JSON with keys:\n"
        "groundedness, relevance, context_relevance, actionability, false_positive_risk, readability, brevity, coverage, notes\n"
        "Definitions:\n"
        "- groundedness: claims are supported by diff/context\n"
        "- relevance: comments focus on this PR\n"
        "- context_relevance: retrieved context is useful for this PR\n"
        "- actionability: concrete and feasible suggestions\n"
        "- false_positive_risk: higher means more likely misleading/wrong claims\n"
        "- readability: clear language\n"
        "- brevity: concise without losing key points\n"
        "- coverage: captures important issues likely present\n"
        "notes should be <= 2 sentences.\n\n"
        f"PR title:\n{title}\n\n"
        f"PR description:\n{description or 'No description'}\n\n"
        f"Diff:\n```diff\n{diff_preview}\n```\n\n"
        f"Retrieved context:\n{context_preview or 'No context'}\n\n"
        f"AI review:\n{review_text}\n"
    )


def evaluate_review_metrics(
    title: str,
    description: str,
    diff: str,
    context: list[str],
    review_text: str,
) -> dict[str, Any] | None:
    if not settings.evaluation_enabled:
        return None

    prompt = _build_eval_prompt(title, description, diff, context, review_text)
    response = generate_text(prompt, model_override=settings.evaluation_model)
    parsed = _extract_json(response)
    if not parsed:
        return None

    groundedness = _clamp_score(parsed.get("groundedness"))
    relevance = _clamp_score(parsed.get("relevance"))
    context_relevance = _clamp_score(parsed.get("context_relevance"))
    actionability = _clamp_score(parsed.get("actionability"))
    false_positive_risk = _clamp_score(parsed.get("false_positive_risk"))
    readability = _clamp_score(parsed.get("readability"))
    brevity = _clamp_score(parsed.get("brevity"))
    coverage = _clamp_score(parsed.get("coverage"))

    # Composite score favors truthful and practical comments while penalizing false positives.
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

    notes = parsed.get("notes")
    note_text = notes if isinstance(notes, str) else ""

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
        "notes": note_text[:500],
        "model": settings.evaluation_model,
    }
