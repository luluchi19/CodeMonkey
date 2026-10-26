#!/usr/bin/env bash
set -euo pipefail

: "${VLLM_MODEL:?Set VLLM_MODEL to a Hugging Face model id or local path}"

args=(
  serve "$VLLM_MODEL"
  --host "${VLLM_HOST:-0.0.0.0}"
  --port "${VLLM_PORT:-8000}"
  --api-key "${VLLM_API_KEY:-token-not-needed}"
  --max-model-len "${VLLM_MAX_MODEL_LEN:-32768}"
  --gpu-memory-utilization "${VLLM_GPU_MEMORY_UTILIZATION:-0.90}"
  --block-size "${VLLM_BLOCK_SIZE:-16}"
  --max-num-batched-tokens "${VLLM_MAX_NUM_BATCHED_TOKENS:-8192}"
)

if [[ "${VLLM_PREFIX_CACHING:-1}" == "1" ]]; then
  args+=(--enable-prefix-caching)
else
  args+=(--no-enable-prefix-caching)
fi

if [[ "${VLLM_CHUNKED_PREFILL:-1}" == "1" ]]; then
  args+=(--enable-chunked-prefill)
else
  args+=(--no-enable-chunked-prefill)
fi

if [[ -n "${VLLM_QUANTIZATION:-}" ]]; then
  args+=(--quantization "$VLLM_QUANTIZATION")
fi

if [[ -n "${VLLM_SPECULATIVE_CONFIG:-}" ]]; then
  args+=(--speculative-config "$VLLM_SPECULATIVE_CONFIG")
fi

exec vllm "${args[@]}"
