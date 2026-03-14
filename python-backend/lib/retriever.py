from __future__ import annotations

from app.config import settings
from .embedding import embed_text
from .pinecone_client import PineconeClient


def retrieve_context(query: str, repo_id: str) -> list[str]:
    vector = embed_text(query)
    pinecone_client = PineconeClient()
    matches = pinecone_client.query(vector, repo_id, settings.max_context_chunks)

    contexts: list[str] = []
    for match in matches:
        metadata = match.get("metadata") or {}
        content = metadata.get("content")
        if isinstance(content, str) and content:
            contexts.append(content)

    return contexts
