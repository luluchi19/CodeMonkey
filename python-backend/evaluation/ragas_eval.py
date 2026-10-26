from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
from pathlib import Path
from statistics import fmean
from typing import Any

from openai import AsyncOpenAI
from ragas.embeddings.base import embedding_factory
from ragas.llms import llm_factory
from ragas.messages import AIMessage, HumanMessage, ToolCall
from ragas.metrics.collections import (
    AgentGoalAccuracyWithReference,
    AnswerRelevancy,
    ContextPrecision,
    ContextRecall,
    Faithfulness,
    ToolCallAccuracy,
    ToolCallF1,
)


DEFAULT_DATASET = Path(__file__).parent / "datasets" / "code_review_cases.jsonl"
DEFAULT_OUTPUT = Path(__file__).parent / "results" / "ragas_report.json"


def load_cases(path: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            required = {"id", "user_input", "retrieved_contexts", "response", "reference"}
            missing = sorted(required - set(value))
            if missing:
                raise ValueError(f"{path}:{line_number} missing fields: {', '.join(missing)}")
            cases.append(value)
    if not cases:
        raise ValueError(f"Dataset is empty: {path}")
    return cases


def _tool_call(value: dict[str, Any]) -> ToolCall:
    return ToolCall(name=str(value["name"]), args=value.get("args") or {})


def _conversation(case: dict[str, Any]) -> list[HumanMessage | AIMessage]:
    calls = [_tool_call(item) for item in case.get("tool_calls", [])]
    return [
        HumanMessage(content=case["user_input"]),
        AIMessage(content=case["response"], tool_calls=calls),
    ]


async def evaluate_deterministic(case: dict[str, Any]) -> dict[str, float]:
    conversation = _conversation(case)
    reference_calls = [_tool_call(item) for item in case.get("reference_tool_calls", [])]
    accuracy = await ToolCallAccuracy(strict_order=True).ascore(
        user_input=conversation,
        reference_tool_calls=reference_calls,
    )
    f1 = await ToolCallF1().ascore(
        user_input=conversation,
        reference_tool_calls=reference_calls,
    )
    return {
        "tool_call_accuracy": float(accuracy.value),
        "tool_call_f1": float(f1.value),
    }


def _build_full_metrics():
    model = os.getenv("RAGAS_MODEL", "").strip()
    api_key = os.getenv("RAGAS_API_KEY", "").strip()
    base_url = os.getenv("RAGAS_BASE_URL", "").strip() or None
    embedding_model = os.getenv("RAGAS_EMBEDDING_MODEL", "").strip()
    embedding_api_key = os.getenv("RAGAS_EMBEDDING_API_KEY", "").strip() or api_key
    embedding_base_url = (
        os.getenv("RAGAS_EMBEDDING_BASE_URL", "").strip() or base_url
    )
    if not model or not api_key or not embedding_model:
        raise RuntimeError(
            "Full profile requires RAGAS_MODEL, RAGAS_API_KEY and "
            "RAGAS_EMBEDDING_MODEL. RAGAS_BASE_URL is optional for OpenAI-compatible APIs."
        )
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    embedding_client = AsyncOpenAI(
        api_key=embedding_api_key,
        base_url=embedding_base_url,
    )
    llm = llm_factory(model, provider="openai", client=client)
    embeddings = embedding_factory(
        "openai",
        model=embedding_model,
        client=embedding_client,
        base_url=embedding_base_url,
    )
    return {
        "faithfulness": Faithfulness(llm=llm),
        "context_precision": ContextPrecision(llm=llm),
        "context_recall": ContextRecall(llm=llm),
        "answer_relevancy": AnswerRelevancy(llm=llm, embeddings=embeddings),
        "agent_goal_accuracy": AgentGoalAccuracyWithReference(llm=llm),
    }


async def evaluate_full(case: dict[str, Any], metrics: dict[str, Any]) -> dict[str, float]:
    common = {
        "user_input": case["user_input"],
        "response": case["response"],
        "retrieved_contexts": case["retrieved_contexts"],
        "reference": case["reference"],
    }
    values = {
        "faithfulness": await metrics["faithfulness"].ascore(
            user_input=common["user_input"],
            response=common["response"],
            retrieved_contexts=common["retrieved_contexts"],
        ),
        "context_precision": await metrics["context_precision"].ascore(
            user_input=common["user_input"],
            reference=common["reference"],
            retrieved_contexts=common["retrieved_contexts"],
        ),
        "context_recall": await metrics["context_recall"].ascore(
            user_input=common["user_input"],
            reference=common["reference"],
            retrieved_contexts=common["retrieved_contexts"],
        ),
        "answer_relevancy": await metrics["answer_relevancy"].ascore(
            user_input=common["user_input"],
            response=common["response"],
        ),
        "agent_goal_accuracy": await metrics["agent_goal_accuracy"].ascore(
            user_input=_conversation(case),
            reference=common["reference"],
        ),
    }
    return {name: float(result.value) for name, result in values.items()}


def _summary(rows: list[dict[str, Any]]) -> dict[str, float | None]:
    metric_names = sorted({name for row in rows for name in row["scores"]})
    summary: dict[str, float | None] = {}
    for name in metric_names:
        values = [row["scores"][name] for row in rows if name in row["scores"]]
        finite = [value for value in values if not math.isnan(value)]
        summary[name] = round(fmean(finite), 4) if finite else None
    return summary


def _portable_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(Path(__file__).parents[1].resolve()).as_posix()
    except ValueError:
        return str(path)


async def run(dataset: Path, output: Path, profile: str) -> dict[str, Any]:
    cases = load_cases(dataset)
    full_metrics = _build_full_metrics() if profile == "full" else None
    rows = []
    for case in cases:
        scores = await evaluate_deterministic(case)
        if full_metrics:
            scores.update(await evaluate_full(case, full_metrics))
        rows.append({"id": case["id"], "scores": scores})
    report = {
        "profile": profile,
        "dataset": _portable_path(dataset),
        "case_count": len(rows),
        "summary": _summary(rows),
        "cases": rows,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CodeMonkey's RAGAS evaluation suite.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--profile",
        choices=("deterministic", "full"),
        default="deterministic",
        help="deterministic runs tool metrics offline; full adds LLM/embedding metrics.",
    )
    args = parser.parse_args()
    report = asyncio.run(run(args.dataset, args.output, args.profile))
    print(json.dumps(report["summary"], indent=2))
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
