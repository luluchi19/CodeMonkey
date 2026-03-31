from __future__ import annotations

from typing import Any

from app.config import settings
from .chunker import chunk_text
from .tree_sitter_chunker import chunk_with_tree_sitter
from .embedding import embed_text
from .github_client import get_default_branch, get_file_content, get_repo_tree, iter_file_paths
from .pinecone_client import PineconeClient


def _is_text_path(path: str) -> bool:
    return not path.lower().endswith(
        (
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".svg",
            ".ico",
            ".pdf",
            ".zip",
            ".tar",
            ".gz",
        )
    )


def _build_record(repo_id: str, path: str, chunk: str, chunk_index: int) -> dict:
    record_id = f"{repo_id}-{path.replace('/', '_')}-{chunk_index}"
    return {
        "id": record_id,
        "values": embed_text(chunk),
        "metadata": {
            "repoId": repo_id,
            "path": path,
            "content": chunk,
            "chunkIndex": chunk_index,
        },
    }


async def index_repository(payload: dict[str, Any]) -> dict[str, Any]:
    owner = payload.get("owner")
    repo = payload.get("repo")
    token = payload.get("token")

    if not owner or not repo or not token:
        raise ValueError("Missing owner/repo/token in payload")

    repo_id = f"{owner}/{repo}"
    branch = get_default_branch(token, owner, repo)
    tree = get_repo_tree(token, owner, repo, branch)

    if not tree:
        return {
            "repo": repo_id,
            "filesIndexed": 0,
            "records": 0,
            "warning": "Repository is empty or tree is unavailable",
        }

    files_indexed = 0
    records: list[dict] = []
    pinecone_client = PineconeClient()

    for path in iter_file_paths(tree):
        if not _is_text_path(path):
            continue

        if files_indexed >= settings.max_files:
            break

        content = get_file_content(token, owner, repo, path)
        if not content:
            continue

        if len(content.encode("utf-8")) > settings.max_file_bytes:
            continue

        if settings.use_tree_sitter:
            chunks = chunk_with_tree_sitter(path, content, settings.max_symbols_per_file)
        else:
            chunks = []

        if chunks:
            for chunk_index, chunk in enumerate(chunks):
                try:
                    full_text = f"File: {path}\nSymbol: {chunk.name}\n\n{chunk.text}"
                    record = _build_record(repo_id, path, full_text, chunk_index)
                    records.append(record)
                except Exception:
                    continue
        else:
            full_text = f"File: {path}\n\n{content}"
            for chunk_index, chunk in enumerate(chunk_text(full_text, settings.chunk_chars)):
                try:
                    record = _build_record(repo_id, path, chunk, chunk_index)
                    records.append(record)
                except Exception:
                    continue

        files_indexed += 1

    batch_size = 100
    for i in range(0, len(records), batch_size):
        pinecone_client.upsert(records[i : i + batch_size])

    return {"repo": repo_id, "filesIndexed": files_indexed, "records": len(records)}
