from __future__ import annotations

from app.config import settings
from .embedding import embed_text
from .pinecone_client import PineconeClient


def retrieve_context(query: str, repo_id: str) -> tuple[list[str], str | None]:
    try:
        vector = embed_text(query)
    except Exception as exc:
        print("context_fallback", {"error": str(exc)})
        return [], "Context unavailable; fallback to diff-only review."

    pinecone_client = PineconeClient()
    matches = pinecone_client.query(vector, repo_id, settings.max_context_chunks)

    contexts: list[str] = []
    for match in matches:
        metadata = match.get("metadata") or {}
        content = metadata.get("content")
        if isinstance(content, str) and content:
            contexts.append(content)

    return contexts, None
