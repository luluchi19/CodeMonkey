from __future__ import annotations

import time
import requests

from app.config import settings

GOOGLE_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta"


def embed_text(text: str) -> list[float]:
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

    model = settings.embedding_model
    model_name = model if model.startswith("models/") else f"models/{model}"
    url = f"{GOOGLE_EMBED_URL}/{model_name}:embedContent"
    payload = {
        "content": {"parts": [{"text": text}]},
        "taskType": "SEMANTIC_SIMILARITY",
        "outputDimensionality": settings.embedding_dimension,
    }

    retry_limit = max(1, settings.embedding_retry_limit)
    for attempt in range(1, retry_limit + 1):
        try:
            resp = requests.post(
                url,
                params={"key": settings.google_api_key},
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["embedding"]["values"]
        except requests.RequestException as exc:
            if attempt >= retry_limit:
                raise
            wait_seconds = 2 ** (attempt - 1)
            print("embedding_request_retry", {"attempt": attempt, "error": str(exc)})
            time.sleep(wait_seconds)
