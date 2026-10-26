# RAGAS evaluation

## Evaluation pillars

| Pillar | RAGAS metric | Inputs | Range | Direction |
| --- | --- | --- | --- | --- |
| Retrieval relevance | Context Precision | user input, reference, retrieved contexts | 0–1 | Higher is better |
| Retrieval completeness | Context Recall | user input, reference, retrieved contexts | 0–1 | Higher is better |
| Grounding | Faithfulness | user input, response, retrieved contexts | 0–1 | Higher is better |
| Answer quality | Answer Relevancy | user input, response | 0–1 | Higher is better |
| Tool selection | Tool Call Accuracy | predicted and reference tool calls | 0–1 | Higher is better |
| Tool coverage | Tool Call F1 | predicted and reference tool calls | 0–1 | Higher is better |
| Agent outcome | Agent Goal Accuracy | conversation and reference outcome | 0–1 | Higher is better |

Code-review-specific metrics such as valid file/line citations and false-positive risk remain separate from RAGAS because they require deterministic repository checks or a code-review rubric.

## Install

From `python-backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-eval.txt
```

RAGAS 0.4.3 is pinned. Its current VertexAI compatibility import requires `langchain-community==0.3.31`, which is pinned only in the evaluation dependency set.

## Offline deterministic profile

```powershell
.\.venv\Scripts\python.exe -m evaluation.ragas_eval --profile deterministic
```

This profile runs real RAGAS `ToolCallAccuracy` and `ToolCallF1` metrics without an external judge. The included four fixtures currently score `1.0`; that result validates dataset/schema wiring, not production review quality.

## Full profile

Configure an OpenAI-compatible judge and embedding endpoint:

```dotenv
RAGAS_MODEL=<judge-model-name>
RAGAS_API_KEY=<judge-key>
RAGAS_BASE_URL=https://example.com/v1
RAGAS_EMBEDDING_MODEL=<embedding-model-name>

# Optional when embeddings use a different endpoint.
RAGAS_EMBEDDING_API_KEY=<embedding-key>
RAGAS_EMBEDDING_BASE_URL=https://embedding.example.com/v1
```

Then run:

```powershell
.\.venv\Scripts\python.exe -m evaluation.ragas_eval --profile full
```

The output is written to `evaluation/results/ragas_report.json`. Open `notebooks/ragas_report.ipynb` to compare per-case and mean scores.

## Dataset contract

Each JSONL record contains:

```json
{
  "id": "stable-case-id",
  "user_input": "review task",
  "retrieved_contexts": ["bounded evidence"],
  "response": "generated review",
  "reference": "expected outcome",
  "tool_calls": [{"name": "read_code", "args": {"path": "app.py"}}],
  "reference_tool_calls": [{"name": "read_code", "args": {"path": "app.py"}}]
}
```

Before using scores in a CV, replace or extend the seed fixtures with at least 15–30 frozen PR cases, run the full profile, record the judge model, and manually audit a sample. Thresholds should be set from that baseline rather than chosen after seeing a candidate run.

References: [RAGAS metrics](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/) and [RAGAS 0.4 migration](https://docs.ragas.io/en/stable/howtos/migrations/migrate_from_v03_to_v04/).
