from __future__ import annotations

import time

import requests
from litellm import completion

from app.config import settings

GOOGLE_GEN_URL = "https://generativelanguage.googleapis.com/v1beta"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
NVIDIA_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"


def _parse_fallback_order() -> list[str]:
    raw = settings.llm_fallback_order or "gemini"
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def _provider_model(provider: str, model_override: str | None = None) -> str:
    if provider == "gemini":
        return model_override or settings.genai_model
    if provider == "openrouter":
        return f"openrouter/{settings.openrouter_model}"
    if provider == "nvidia":
        return f"openai/{settings.nvidia_nim_model}"
    return "unknown"


def _generate_gemini(prompt: str, model: str) -> str:
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

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


def _generate_openai_compatible(
    prompt: str,
    model: str,
    api_base: str,
    api_key: str,
) -> str:
    if not api_key:
        raise RuntimeError("API key is not set for fallback provider")

    response = completion(
        model=model,
        api_base=api_base,
        api_key=api_key,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    choices = response.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return message.get("content") or ""


def generate_text(
    prompt: str,
    model_override: str | None = None,
    on_fallback: callable | None = None,
    on_success: callable | None = None,
) -> str:
    providers = _parse_fallback_order()
    last_error: Exception | None = None

    for index, provider in enumerate(providers):
        retry_limit = max(1, settings.llm_retry_limit)
        for attempt in range(1, retry_limit + 1):
            try:
                if provider == "gemini":
                    model = _provider_model(provider, model_override)
                    result = _generate_gemini(prompt, model)
                    print("llm_provider_selected", {"provider": provider, "model": model})
                    if on_success:
                        on_success(provider, model)
                    return result
                if provider == "openrouter":
                    model = _provider_model(provider, model_override)
                    result = _generate_openai_compatible(
                        prompt,
                        model,
                        OPENROUTER_BASE_URL,
                        settings.openrouter_api_key,
                    )
                    print("llm_provider_selected", {"provider": provider, "model": model})
                    if on_success:
                        on_success(provider, model)
                    return result
                if provider == "nvidia":
                    model = _provider_model(provider, model_override)
                    result = _generate_openai_compatible(
                        prompt,
                        model,
                        NVIDIA_NIM_BASE_URL,
                        settings.nvidia_nim_api_key,
                    )
                    print("llm_provider_selected", {"provider": provider, "model": model})
                    if on_success:
                        on_success(provider, model)
                    return result

                raise RuntimeError(f"Unknown LLM provider: {provider}")
            except Exception as exc:
                last_error = exc
                if attempt >= retry_limit:
                    print(
                        "llm_provider_failed",
                        {"provider": provider, "attempt": attempt, "error": str(exc)},
                    )
                else:
                    print(
                        "llm_retry_failed",
                        {"provider": provider, "attempt": attempt, "error": str(exc)},
                    )
                    time.sleep(2 ** (attempt - 1))

        next_provider = providers[index + 1] if index + 1 < len(providers) else None
        if next_provider:
            from_model = _provider_model(provider, model_override)
            to_model = _provider_model(next_provider, model_override)
            print(
                "llm_fallback",
                {
                    "from": provider,
                    "to": next_provider,
                    "fromModel": from_model,
                    "toModel": to_model,
                    "error": str(last_error),
                },
            )
            if on_fallback:
                on_fallback(provider, next_provider, from_model, to_model, str(last_error))

    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")
