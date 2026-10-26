# Python Backend (CodeMonkey)

Minimal FastAPI app for AI processing.

## Local setup

1. Create venv: `python -m venv .venv`
2. Activate: `.venv\Scripts\Activate.ps1`
3. Install deps: `pip install -r requirements.txt`
4. Run: `uvicorn app.main:app --reload`

## Environment

Copy `.env.example` to `.env` and fill values.

Required for indexing:
- `GOOGLE_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX` (default: codemonkey-vector-embeddings-v2)
- `EMBEDDING_MODEL` (default: models/embedding-001)

Required for review pipeline:
- `GENAI_MODEL` (default: models/gemini-2.0-flash)
- `LANGGRAPH_ENABLED` (default: true)
- `LANGGRAPH_MAX_TOOL_CALLS` (default: 3)
- `DEEPSEEK_API_KEY` (optional fallback provider)
- `DEEPSEEK_MODEL` (default: deepseek-v4-flash)
- `LLM_FALLBACK_ORDER` (default: gemini,deepseek,nvidia,openrouter)
- `MAX_CONTEXT_CHUNKS` (default: 6)
- `DIFF_MAX_CHARS` (default: 20000)

Optional vLLM provider (OpenAI-compatible server):
- `VLLM_BASE_URL` (for example `http://localhost:8000/v1`)
- `VLLM_API_KEY` (default: `token-not-needed`)
- `VLLM_MODEL`
- Add `vllm` to `LLM_FALLBACK_ORDER` only while the endpoint is available.

Optional indexing improvements:
- `USE_TREE_SITTER` (default: true)
- `MAX_SYMBOLS_PER_FILE` (default: 80)

Tree-sitter currently supports JS/TS/TSX/JSX/Python for semantic chunks. Files outside these fall back to character chunking.

Optional review cost transparency:
- `TOKEN_ESTIMATE_DIVISOR` (default: 4)
- `COST_INPUT_PER_1K` (set to your provider pricing if desired)
- `COST_OUTPUT_PER_1K` (set to your provider pricing if desired)
- `MAX_PROMPT_TOKENS_ESTIMATE` (cap prompt size)
- `MAX_OUTPUT_TOKENS_ESTIMATE` (cap output size)
- `APP_BASE_URL` (Next.js base URL for saving reviews)

Optional review evaluation:
- `EVALUATION_ENABLED` (default: true)
- `EVALUATION_MODEL` (default: models/gemini-2.5-flash-lite)
- `EVALUATION_USE_TRULENS` (default: false)

## LangGraph tests and RAGAS

Install the separate evaluation dependencies and run the offline suite:

```powershell
pip install -r requirements-dev.txt -r requirements-eval.txt
pytest -q
python -m evaluation.ragas_eval --profile deterministic
```

The full RAGAS profile and vLLM benchmark procedure are documented in:

- `../docs/RAGAS_EVALUATION.md`
- `../docs/INFERENCE_BENCHMARK.md`

## Evaluation outputs

- Python backend logs review evaluation scores as `Review evaluation completed` events.
- Export periodic report from Next.js API:
	- JSON: `GET /api/reviews/eval-report`
	- CSV: `GET /api/reviews/eval-report?format=csv`

## TruLens dashboard helper

After installing dependencies, run:

`python scripts/run_trulens_dashboard.py`
