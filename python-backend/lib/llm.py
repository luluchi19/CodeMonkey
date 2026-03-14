from __future__ import annotations

import requests

from app.config import settings

GOOGLE_GEN_URL = "https://generativelanguage.googleapis.com/v1beta"


def generate_text(prompt: str) -> str:
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

    model = settings.genai_model
    model_name = model if model.startswith("models/") else f"models/{model}"
    url = f"{GOOGLE_GEN_URL}/{model_name}:generateContent"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ]
    }

    resp = requests.post(
        url,
        params={"key": settings.google_api_key},
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""

    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    if not parts:
        return ""

    text = parts[0].get("text")
    return text or ""
