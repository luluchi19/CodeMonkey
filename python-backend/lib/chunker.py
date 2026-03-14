from __future__ import annotations

from typing import Iterable


def chunk_text(text: str, size: int) -> Iterable[str]:
    if size <= 0:
        yield text
        return

    for idx in range(0, len(text), size):
        yield text[idx : idx + size]
