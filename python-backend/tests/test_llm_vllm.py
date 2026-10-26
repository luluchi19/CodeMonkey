from lib import llm


def test_generate_text_uses_openai_compatible_vllm(monkeypatch) -> None:
    captured = {}

    def fake_completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "review result"}}]}

    monkeypatch.setattr(llm, "completion", fake_completion)
    monkeypatch.setattr(llm.settings, "llm_fallback_order", "vllm")
    monkeypatch.setattr(llm.settings, "llm_retry_limit", 1)
    monkeypatch.setattr(llm.settings, "vllm_base_url", "http://localhost:8000/v1")
    monkeypatch.setattr(llm.settings, "vllm_api_key", "token-not-needed")
    monkeypatch.setattr(llm.settings, "vllm_model", "local-code-model")

    selected = []
    result = llm.generate_text(
        "review this",
        on_success=lambda provider, model: selected.append((provider, model)),
    )

    assert result == "review result"
    assert captured["api_base"] == "http://localhost:8000/v1"
    assert captured["model"] == "openai/local-code-model"
    assert selected == [("vllm", "openai/local-code-model")]
