from pathlib import Path

from evaluation.ragas_eval import load_cases


def test_ragas_fixture_dataset_is_valid() -> None:
    dataset = Path(__file__).parents[1] / "evaluation" / "datasets" / "code_review_cases.jsonl"
    cases = load_cases(dataset)
    assert len(cases) >= 4
    assert all(case["retrieved_contexts"] for case in cases)
    assert all(case.get("reference_tool_calls") for case in cases)
