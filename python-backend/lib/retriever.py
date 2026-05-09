from __future__ import annotations

from app.config import settings
from .embedding import embed_text
from .pinecone_client import PineconeClient


def retrieve_context(query: str, repo_id: str, file_list: list[str] | None = None) -> tuple[list[str], str | None]:
    """
    Retrieve context for a query. If `file_list` is provided, prioritize retrieval from those files.
    Returns (contexts, warning) where warning is a short string or None.
    """
    try:
        vector = embed_text(query)
    except Exception as exc:
        print("context_fallback", {"error": str(exc)})
        return [], "Context unavailable; fallback to diff-only review."

    pinecone_client = PineconeClient()
    contexts: list[str] = []

    # If file_list provided, query per-file to prioritize those files' chunks
    if file_list:
        # Small PRs benefit from slightly broader per-file recall; large PRs stay focused.
        per_file_top_k = 2 if len(file_list) <= 3 else 1
        remaining = settings.max_context_chunks
        for path in file_list:
            if remaining <= 0:
                break
            try:
                top_k = min(per_file_top_k, remaining)
                matches = pinecone_client.query(vector, repo_id, top_k, path=path)
            except Exception as exc:
                print("pinecone_query_error", {"path": path, "error": str(exc)})
                continue

            for match in matches:
                metadata = match.get("metadata") or {}
                content = metadata.get("content")
                if isinstance(content, str) and content and content not in contexts:
                    contexts.append(content)
                    remaining -= 1
                    if remaining <= 0:
                        break

        if contexts:
            return contexts, None

    # Fallback: global retrieval across the repo
    try:
        matches = pinecone_client.query(vector, repo_id, settings.max_context_chunks)
    except Exception as exc:
        print("pinecone_query_error", {"error": str(exc)})
        return [], "Context unavailable; fallback to diff-only review."

    for match in matches:
        metadata = match.get("metadata") or {}
        content = metadata.get("content")
        if isinstance(content, str) and content:
            contexts.append(content)

    return contexts, None
