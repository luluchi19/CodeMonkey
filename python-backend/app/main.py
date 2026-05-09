from fastapi import FastAPI, Header, HTTPException, Request
import traceback

from app.config import settings
from app.security import verify_signature
from lib.indexer import delete_repository_vectors, index_repository
from lib.review_pipeline import run_review

app = FastAPI(title="CodeMonkey Python Sidecar")


def validate_config() -> tuple[bool, str]:
    """
    Validate required config before processing.
    Returns (is_valid, error_message)
    """
    issues = []
    
    if not settings.pinecone_api_key:
        issues.append("PINECONE_API_KEY not configured")
    if not settings.google_api_key:
        issues.append("GOOGLE_API_KEY not configured")
    if not settings.embedding_model:
        issues.append("Embedding model not specified")
    
    if issues:
        return False, "; ".join(issues)
    return True, ""


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/inngest/repo-index")
async def repo_index(
    request: Request,
    x_cm_timestamp: str | None = Header(default=None),
    x_cm_signature: str | None = Header(default=None),
) -> dict:
    body = await request.body()
    if not x_cm_timestamp or not x_cm_signature:
        raise HTTPException(status_code=401, detail="missing signature headers")

    if not verify_signature(body, x_cm_timestamp, x_cm_signature):
        raise HTTPException(status_code=401, detail="invalid signature")

    # Pre-flight validation: check config BEFORE processing
    is_valid, error_msg = validate_config()
    if not is_valid:
        print("config_validation_failed", {"endpoint": "repo-index", "error": error_msg})
        raise HTTPException(status_code=400, detail=f"Configuration error: {error_msg}")

    payload = await request.json()

    try:
        result = await index_repository(payload)
        return {"ok": True, "handler": "repo-index", "result": result}
    except Exception as exc:
        error_str = str(exc)[:200]
        print("repo_index_error", {
            "error": error_str,
            "type": type(exc).__name__,
            "suggestion": "Check Modal logs, API keys, and Pinecone connection"
        })
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Indexing failed: {error_str}") from exc


@app.post("/inngest/repo-disconnect")
async def repo_disconnect(
    request: Request,
    x_cm_timestamp: str | None = Header(default=None),
    x_cm_signature: str | None = Header(default=None),
) -> dict:
    body = await request.body()
    if not x_cm_timestamp or not x_cm_signature:
        raise HTTPException(status_code=401, detail="missing signature headers")

    if not verify_signature(body, x_cm_timestamp, x_cm_signature):
        raise HTTPException(status_code=401, detail="invalid signature")

    # Pre-flight validation: check config BEFORE processing
    is_valid, error_msg = validate_config()
    if not is_valid:
        print("config_validation_failed", {"endpoint": "repo-disconnect", "error": error_msg})
        raise HTTPException(status_code=400, detail=f"Configuration error: {error_msg}")

    payload = await request.json()

    try:
        result = await delete_repository_vectors(payload)
        return {"ok": True, "handler": "repo-disconnect", "result": result}
    except Exception as exc:
        error_str = str(exc)[:200]
        print("repo_disconnect_error", {
            "error": error_str,
            "type": type(exc).__name__,
            "suggestion": "Check Pinecone connection"
        })
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Disconnection failed: {error_str}") from exc


@app.post("/inngest/pr-review")
async def pr_review(
    request: Request,
    x_cm_timestamp: str | None = Header(default=None),
    x_cm_signature: str | None = Header(default=None),
) -> dict:
    body = await request.body()
    if not x_cm_timestamp or not x_cm_signature:
        raise HTTPException(status_code=401, detail="missing signature headers")

    if not verify_signature(body, x_cm_timestamp, x_cm_signature):
        raise HTTPException(status_code=401, detail="invalid signature")

    # Pre-flight validation: check config BEFORE processing
    is_valid, error_msg = validate_config()
    if not is_valid:
        print("config_validation_failed", {"endpoint": "pr-review", "error": error_msg})
        raise HTTPException(status_code=400, detail=f"Configuration error: {error_msg}")

    payload = await request.json()

    try:
        result = await run_review(payload)
        return {"ok": True, "handler": "pr-review", "result": result}
    except Exception as exc:
        error_str = str(exc)[:200]
        print("pr_review_error", {
            "error": error_str,
            "type": type(exc).__name__,
            "suggestion": "Check Modal logs, API keys (GOOGLE_API_KEY), and Pinecone connection"
        })
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Review generation failed: {error_str}") from exc
