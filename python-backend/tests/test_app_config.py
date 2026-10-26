from app import main


def test_pr_review_accepts_vllm_as_only_llm(monkeypatch) -> None:
    monkeypatch.setattr(main.settings, "google_api_key", "")
    monkeypatch.setattr(main.settings, "deepseek_api_key", "")
    monkeypatch.setattr(main.settings, "openrouter_api_key", "")
    monkeypatch.setattr(main.settings, "nvidia_nim_api_key", "")
    monkeypatch.setattr(main.settings, "vllm_base_url", "http://localhost:8000/v1")
    monkeypatch.setattr(main.settings, "vllm_model", "demo-model")
    valid, message = main.validate_config("pr-review")
    assert valid is True
    assert message == ""


def test_repo_index_still_requires_embedding_dependencies(monkeypatch) -> None:
    monkeypatch.setattr(main.settings, "pinecone_api_key", "")
    monkeypatch.setattr(main.settings, "google_api_key", "")
    valid, message = main.validate_config("repo-index")
    assert valid is False
    assert "PINECONE_API_KEY" in message
    assert "GOOGLE_API_KEY" in message
