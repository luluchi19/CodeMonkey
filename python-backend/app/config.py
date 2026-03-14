from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    env: str = "local"
    shared_secret: str = ""
    google_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_index: str = "codemonkey-vector-embeddings-v2"
    embedding_model: str = "text-embedding-004"
    embedding_dimension: int = 768
    genai_model: str = "models/gemini-2.0-flash"
    max_context_chunks: int = 6
    diff_max_chars: int = 20000
    max_file_bytes: int = 256000
    max_files: int = 200
    chunk_chars: int = 8000
    use_tree_sitter: bool = True
    max_symbols_per_file: int = 80
    token_estimate_divisor: int = 4
    cost_input_per_1k: float = 0.0
    cost_output_per_1k: float = 0.0
    max_prompt_tokens_estimate: int = 8000
    max_output_tokens_estimate: int = 2000
    app_base_url: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
