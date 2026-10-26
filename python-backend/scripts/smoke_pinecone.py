"""Read-only Pinecone index and retrieval smoke test."""

from __future__ import annotations

import argparse

from pinecone import Pinecone

from app.config import settings
from lib.retriever import retrieve_context


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect Pinecone and retrieve real code chunks.")
    parser.add_argument("--repo-id", required=True, help="Repository filter, for example owner/repo.")
    parser.add_argument(
        "--query",
        default="Review authentication and authorization checks around user session access",
    )
    args = parser.parse_args()

    index = Pinecone(api_key=settings.pinecone_api_key).Index(settings.pinecone_index)
    stats = index.describe_index_stats()
    namespaces = getattr(stats, "namespaces", {}) or {}
    print("=== Pinecone index ===")
    print("index:", settings.pinecone_index)
    print("dimension:", getattr(stats, "dimension", None))
    print("total_vector_count:", getattr(stats, "total_vector_count", None))
    print("namespace_count:", len(namespaces))

    contexts, warning = retrieve_context(args.query, args.repo_id)
    print("\n=== Live retrieval ===")
    print("repo_id:", args.repo_id)
    print("retrieved_context_count:", len(contexts))
    print("warning:", warning)
    for index_number, context in enumerate(contexts, 1):
        first_line = context.splitlines()[0] if context else "<empty>"
        print(f"{index_number}. {first_line}")


if __name__ == "__main__":
    main()
