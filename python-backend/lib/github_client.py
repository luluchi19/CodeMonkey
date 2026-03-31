from __future__ import annotations

import base64
from typing import Iterable

import requests

GITHUB_API = "https://api.github.com"


def _headers(token: str, accept: str | None = None) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": accept or "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def get_default_branch(token: str, owner: str, repo: str) -> str:
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}", headers=_headers(token), timeout=30
    )
    resp.raise_for_status()
    return resp.json()["default_branch"]


def get_repo_tree(token: str, owner: str, repo: str, branch: str) -> list[dict]:
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}",
        headers=_headers(token),
        params={"recursive": "1"},
        timeout=60,
    )
    if resp.status_code == 409:
        return []
    if resp.status_code in (403, 404):
        raise ValueError(
            "Repository tree is not доступible. Ensure the GitHub token has repo access "
            "and the user has permission to the private repository."
        )
    resp.raise_for_status()
    return resp.json().get("tree", [])


def iter_file_paths(tree: Iterable[dict]) -> Iterable[str]:
    for node in tree:
        if node.get("type") == "blob":
            yield node.get("path")


def get_file_content(token: str, owner: str, repo: str, path: str) -> str | None:
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        headers=_headers(token),
        timeout=30,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    if data.get("type") != "file" or not data.get("content"):
        return None

    content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
    return content


def get_pull_request_data(token: str, owner: str, repo: str, pr_number: int) -> dict:
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}",
        headers=_headers(token),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_pull_request_diff(token: str, owner: str, repo: str, pr_number: int) -> str:
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}",
        headers=_headers(token, accept="application/vnd.github.v3.diff"),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.text


def post_review_comment(
    token: str, owner: str, repo: str, pr_number: int, review: str
) -> None:
    resp = requests.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/issues/{pr_number}/comments",
        headers=_headers(token),
        json={"body": review},
        timeout=30,
    )
    resp.raise_for_status()
