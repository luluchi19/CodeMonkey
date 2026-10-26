from lib.tree_sitter_chunker import chunk_with_tree_sitter


def test_symbol_chunks_have_stable_source_spans() -> None:
    source = """def first():
    return 1

def second():
    return 2
"""
    chunks = chunk_with_tree_sitter("example.py", source, max_symbols=10)
    assert [chunk.name for chunk in chunks] == ["first", "second"]
    assert [(chunk.start_line, chunk.end_line) for chunk in chunks] == [(1, 2), (4, 5)]
