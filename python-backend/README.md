# Python Sidecar (CodeMonkey)

Minimal FastAPI app for the AI sidecar.

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
- `MAX_CONTEXT_CHUNKS` (default: 6)
- `DIFF_MAX_CHARS` (default: 20000)

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
