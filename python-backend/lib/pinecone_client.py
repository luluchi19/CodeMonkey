from __future__ import annotations

from pinecone import Pinecone

from app.config import settings


class PineconeClient:
    def __init__(self) -> None:
        if not settings.pinecone_api_key:
            raise RuntimeError("PINECONE_API_KEY is not set")

        self._client = Pinecone(api_key=settings.pinecone_api_key)
        self._index = self._client.Index(settings.pinecone_index)

    def upsert(self, records: list[dict]) -> None:
        if not records:
            return
        self._index.upsert(vectors=records)

    def query(self, vector: list[float], repo_id: str, top_k: int) -> list[dict]:
        results = self._index.query(
            vector=vector,
            top_k=top_k,
            filter={"repoId": repo_id},
            include_metadata=True,
        )
        return list(results.get("matches", []))
