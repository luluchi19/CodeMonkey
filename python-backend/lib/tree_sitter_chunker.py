from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from tree_sitter_languages import get_parser


@dataclass
class CodeChunk:
    name: str
    text: str


def _language_for_path(path: str) -> str | None:
    lower = path.lower()
    if lower.endswith(".ts"):
        return "typescript"
    if lower.endswith(".tsx"):
        return "tsx"
    if lower.endswith(".js"):
        return "javascript"
    if lower.endswith(".jsx"):
        return "javascript"
    if lower.endswith(".py"):
        return "python"
    if lower.endswith(".java"):
        return "java"
    if lower.endswith((".kt", ".kts")):
        return "kotlin"
    if lower.endswith(".go"):
        return "go"
    if lower.endswith(".cs"):
        return "c_sharp"
    if lower.endswith((".c", ".h")):
        return "c"
    if lower.endswith((".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx")):
        return "cpp"
    if lower.endswith(".rs"):
        return "rust"
    return None


def _extract_symbol_name(node, source: bytes) -> str:
    for child in node.children:
        if child.type == "identifier":
            return source[child.start_byte : child.end_byte].decode("utf-8", errors="ignore")
    return "anonymous"


def _query_nodes(lang: str, root) -> Iterable:
    targets = {
        "javascript": {"function_declaration", "class_declaration", "method_definition"},
        "typescript": {"function_declaration", "class_declaration", "method_definition"},
        "tsx": {"function_declaration", "class_declaration", "method_definition"},
        "python": {"function_definition", "class_definition"},
        "java": {"class_declaration", "interface_declaration", "method_declaration", "constructor_declaration"},
        "kotlin": {"class_declaration", "object_declaration", "interface_declaration", "function_declaration"},
        "go": {"function_declaration", "method_declaration", "type_declaration"},
        "c_sharp": {"class_declaration", "struct_declaration", "interface_declaration", "method_declaration", "constructor_declaration"},
        "c": {"function_definition"},
        "cpp": {"function_definition", "class_specifier", "struct_specifier"},
        "rust": {"function_item", "impl_item", "struct_item", "enum_item", "trait_item"},
    }
    wanted = targets.get(lang, set())
    if not wanted:
        return []

    stack = [root]
    found = []
    while stack:
        node = stack.pop()
        if node.type in wanted:
            found.append(node)
        stack.extend(node.children)
    return found


def chunk_with_tree_sitter(path: str, content: str, max_symbols: int) -> list[CodeChunk]:
    lang = _language_for_path(path)
    if not lang:
        return []

    try:
        parser = get_parser(lang)
        source = content.encode("utf-8")
        tree = parser.parse(source)
    except Exception as exc:
        print("tree_sitter_fallback", {"path": path, "error": str(exc)})
        return []

    chunks: list[CodeChunk] = []
    for idx, node in enumerate(_query_nodes(lang, tree.root_node)):
        if idx >= max_symbols:
            break
        text = source[node.start_byte : node.end_byte].decode("utf-8", errors="ignore")
        name = _extract_symbol_name(node, source)
        chunks.append(CodeChunk(name=name, text=text))

    return chunks
