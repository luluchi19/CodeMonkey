from __future__ import annotations

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

    resp = requests.post(
        url,
        params={"key": settings.google_api_key},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["embedding"]["values"]
