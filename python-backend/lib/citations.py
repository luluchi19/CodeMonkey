from __future__ import annotations

from typing import Iterable

REFERENCE_MAP: dict[str, str] = {
    "java": "https://docs.oracle.com/javase/specs/",
    "java_tutorial": "https://docs.oracle.com/javase/tutorial/",
    "java_oop": "https://www.w3schools.com/java/java_oop.asp",
    "spring": "https://spring.io/projects/spring-framework",
    "spring_boot": "https://spring.io/projects/spring-boot",
    "kotlin": "https://kotlinlang.org/docs/reference/",
    "javascript": "https://tc39.es/ecma262/",
    "typescript": "https://www.typescriptlang.org/docs/",
    "python": "https://docs.python.org/3/",
    "go": "https://go.dev/ref/spec",
    "rust": "https://doc.rust-lang.org/reference/",
    "html": "https://html.spec.whatwg.org/",
    "css": "https://developer.mozilla.org/en-US/docs/Web/CSS",
    "react": "https://react.dev/learn",
    "nextjs": "https://nextjs.org/docs",
    "fastapi": "https://fastapi.tiangolo.com/",
    "prisma": "https://www.prisma.io/docs",
}

EXTENSION_HINTS: dict[str, str] = {
    ".java": "java",
    ".kt": "kotlin",
    ".js": "javascript",
    ".jsx": "react",
    ".ts": "typescript",
    ".tsx": "react",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".html": "html",
    ".css": "css",
}

KEYWORD_HINTS: dict[str, str] = {
    "spring boot": "spring_boot",
    "spring": "spring",
    "java oop": "java_oop",
    "oop": "java_oop",
    "java": "java_tutorial",
    "html": "html",
    "css": "css",
    "fastapi": "fastapi",
    "prisma": "prisma",
    "next": "nextjs",
    "react": "react",
}


def _normalize(text: str) -> str:
    return text.lower().strip()


def collect_references(texts: Iterable[str]) -> dict[str, str]:
    matches: dict[str, str] = {}
    for text in texts:
        lowered = _normalize(text)
        for ext, key in EXTENSION_HINTS.items():
            if ext in lowered:
                matches[key] = REFERENCE_MAP[key]

        for keyword, key in KEYWORD_HINTS.items():
            if keyword in lowered:
                matches[key] = REFERENCE_MAP[key]

    return matches
