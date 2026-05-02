from fastapi import FastAPI, Header, HTTPException, Request
import traceback

from app.config import settings
from app.security import verify_signature
from lib.indexer import delete_repository_vectors, index_repository
from lib.review_pipeline import run_review

app = FastAPI(title="CodeMonkey Python Sidecar")


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

    payload = await request.json()
    if not settings.google_api_key or not settings.pinecone_api_key:
        raise HTTPException(status_code=500, detail="Missing embedding or Pinecone config")

    try:
        result = await index_repository(payload)
        return {"ok": True, "handler": "repo-index", "result": result}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"repo-index failed: {exc}") from exc


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

    payload = await request.json()
    if not settings.pinecone_api_key:
        raise HTTPException(status_code=500, detail="Missing Pinecone config")

    try:
        result = await delete_repository_vectors(payload)
        return {"ok": True, "handler": "repo-disconnect", "result": result}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"repo-disconnect failed: {exc}") from exc


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

    payload = await request.json()
    if not settings.google_api_key or not settings.pinecone_api_key:
        raise HTTPException(status_code=500, detail="Missing embedding or Pinecone config")

    try:
        result = await run_review(payload)
        return {"ok": True, "handler": "pr-review", "result": result}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"pr-review failed: {exc}") from exc
