# LangGraph review agent

## Scope

CodeMonkey uses one bounded review agent instead of a multi-agent hierarchy. The graph adds explicit state, read-only tools, a maximum number of tool calls, and an auditable trace while keeping the existing Gemini/LiteLLM provider fallback.

```text
START -> agent -> [final review] -> END
             \-> [tool call] -> tool -> agent
```

The model requests a tool with a provider-neutral JSON envelope. LangGraph routes the request, executes the allow-listed tool, appends the result to state, and asks the model for either another tool or the final Markdown review. This works across the existing providers without coupling the graph to a provider-specific tool-call response format.

## Read-only tools

| Tool | Purpose | Guardrail |
| --- | --- | --- |
| `search_code` | Retrieve relevant Pinecone chunks | Bounded by the existing retrieval limit |
| `read_code` | Read a repository file range from GitHub | Relative paths only; at most 250 lines |
| `inspect_diff` | Inspect one changed-file patch | Current PR diff only; output capped at 12,000 characters |

The GitHub token remains in graph state only. It is never included in tool traces or review events.

## Context and chunking

Repository indexing keeps Tree-sitter function/class boundaries, symbol names, and exact start/end lines. Unsupported languages fall back to bounded character chunks. Retrieval prioritizes changed files, preserves a deterministic file order, and then falls back to a repository-wide query. This provides citation-friendly chunks without introducing a separate graph database.

Repositories indexed before this change must be disconnected/re-indexed once to populate the new symbol and line-span metadata.

For vLLM re-reviews, the prompt keeps policies and repository context before the changing diff. Identical leading tokens can therefore use Automatic Prefix Caching; the first request after a server restart acts as the warm-up.

## Runtime configuration

```dotenv
LANGGRAPH_ENABLED=true
LANGGRAPH_MAX_TOOL_CALLS=3

# Optional local/OpenAI-compatible vLLM provider. Add `vllm` to
# LLM_FALLBACK_ORDER only while the server is reachable.
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_API_KEY=token-not-needed
VLLM_MODEL=Qwen/Qwen2.5-Coder-7B-Instruct
LLM_FALLBACK_ORDER=vllm,gemini,deepseek,nvidia,openrouter
```

Set `LANGGRAPH_ENABLED=false` to use the original single-generation path. A successful graph run emits `LangGraph review agent completed` with tool names, arguments, durations, and errors; raw tool results are intentionally not posted to the web event log.

## Why there is no multi-agent layer

A planner/retriever/reviewer multi-agent split would make the same model run several more times, raising latency and cost without providing a distinct authority boundary. The current graph makes the orchestration and tool-use knowledge visible with less failure surface. Multi-agent routing should be added only if later evaluation proves that specialized models or independent verification improves the frozen review dataset.

## Source files

- `python-backend/lib/agent/state.py`
- `python-backend/lib/agent/tools.py`
- `python-backend/lib/agent/review_graph.py`
- `python-backend/tests/test_review_agent.py`

Reference: [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview).
