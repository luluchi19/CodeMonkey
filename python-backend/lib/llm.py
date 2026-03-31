from __future__ import annotations

import time

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

    for attempt in range(1, 4):
        try:
            # External API: use retries to handle transient Gemini errors.
            resp = requests.post(
                url,
                params={"key": settings.google_api_key},
                json=payload,
                timeout=75,
            )

            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(
                    f"Gemini transient error {resp.status_code}: {resp.text}",
                    response=resp,
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
        except requests.RequestException as exc:
            if attempt >= 3:
                raise
            wait_seconds = 2 ** (attempt - 1)
            print("gemini_request_retry", {"attempt": attempt, "error": str(exc)})
            time.sleep(wait_seconds)

    return ""
