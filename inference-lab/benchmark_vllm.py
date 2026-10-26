from __future__ import annotations

import argparse
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import statistics
import subprocess
import threading
import time
from typing import Any

import httpx


@dataclass
class RequestMetrics:
    config_label: str
    model: str
    quantization: str
    prefix_caching: bool
    chunked_prefill: bool
    speculative_decoding: bool
    block_size: int
    max_num_batched_tokens: int
    draft_model: str
    draft_quantization: str
    requested_prompt_tokens: int
    concurrency: int
    request_index: int
    prompt_tokens: int
    output_tokens: int
    ttft_ms: float
    e2e_ms: float
    decode_ms: float
    output_tokens_per_second: float
    peak_vram_gib: float | None


class VramSampler:
    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled
        self.peak_mib: float | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def _sample_once(self) -> float | None:
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-compute-apps=used_memory",
                    "--format=csv,noheader,nounits",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            values = [float(line.strip()) for line in result.stdout.splitlines() if line.strip()]
            return sum(values) if values else 0.0
        except (FileNotFoundError, subprocess.CalledProcessError, ValueError):
            return None

    def _run(self) -> None:
        while not self._stop.is_set():
            value = self._sample_once()
            if value is not None:
                self.peak_mib = value if self.peak_mib is None else max(self.peak_mib, value)
            self._stop.wait(0.1)

    def __enter__(self) -> "VramSampler":
        if self.enabled:
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
        return self

    def __exit__(self, *_: object) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    @property
    def peak_gib(self) -> float | None:
        return round(self.peak_mib / 1024, 4) if self.peak_mib is not None else None


def build_prompt(target_tokens: int, suffix: str) -> str:
    stable_line = (
        "Repository rule: cite exact files, ground every finding in supplied code, "
        "and do not invent behavior. Architecture: Next.js calls a Python review sidecar.\n"
    )
    target_chars = max(256, target_tokens * 4)
    stable_prefix = (stable_line * ((target_chars // len(stable_line)) + 1))[:target_chars]
    return stable_prefix + f"\nReview request: {suffix}"


def _endpoint(base_url: str) -> str:
    root = base_url.rstrip("/")
    return f"{root}/chat/completions" if root.endswith("/v1") else f"{root}/v1/chat/completions"


def run_request(
    *,
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    max_tokens: int,
    timeout: float,
) -> tuple[int, int, float, float, float]:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": max_tokens,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    start = time.perf_counter()
    first_token_at: float | None = None
    text_parts: list[str] = []
    usage: dict[str, Any] = {}
    with httpx.stream(
        "POST",
        _endpoint(base_url),
        headers=headers,
        json=payload,
        timeout=timeout,
    ) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            event = json.loads(data)
            if event.get("usage"):
                usage = event["usage"]
            choices = event.get("choices") or []
            if choices:
                content = (choices[0].get("delta") or {}).get("content") or ""
                if content:
                    if first_token_at is None:
                        first_token_at = time.perf_counter()
                    text_parts.append(content)
    end = time.perf_counter()
    if first_token_at is None:
        raise RuntimeError("The server completed without streaming a content token")
    prompt_tokens = int(usage.get("prompt_tokens") or max(1, len(prompt) // 4))
    output_text = "".join(text_parts)
    output_tokens = int(usage.get("completion_tokens") or max(1, len(output_text) // 4))
    ttft_ms = (first_token_at - start) * 1000
    e2e_ms = (end - start) * 1000
    decode_seconds = max((end - first_token_at), 0.001)
    return prompt_tokens, output_tokens, ttft_ms, e2e_ms, output_tokens / decode_seconds


def append_rows(path: Path, rows: list[RequestMetrics]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(asdict(rows[0]).keys()))
        if write_header:
            writer.writeheader()
        writer.writerows(asdict(row) for row in rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure TTFT and decode throughput from vLLM.")
    parser.add_argument("--base-url", default="http://localhost:8000/v1")
    parser.add_argument("--api-key", default="token-not-needed")
    parser.add_argument("--model", required=True)
    parser.add_argument("--config-label", required=True)
    parser.add_argument("--quantization", default="bf16")
    parser.add_argument("--prefix-caching", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--chunked-prefill", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--speculative-decoding", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--block-size", type=int, choices=(8, 16, 32), default=16)
    parser.add_argument("--max-num-batched-tokens", type=int, default=8192)
    parser.add_argument("--draft-model", default="")
    parser.add_argument("--draft-quantization", default="")
    parser.add_argument("--prompt-tokens", type=int, default=16384)
    parser.add_argument("--max-tokens", type=int, default=128)
    parser.add_argument("--requests", type=int, default=8)
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--warmup", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=300)
    parser.add_argument("--sample-vram", action="store_true")
    parser.add_argument(
        "--remote-vram-url",
        default="",
        help="Optional Modal proxy endpoint ending in /internal/gpu-memory.",
    )
    parser.add_argument("--output", type=Path, default=Path("results/benchmark.csv"))
    args = parser.parse_args()

    # All requests share the exact long prefix; only this suffix changes.
    for index in range(args.warmup):
        run_request(
            base_url=args.base_url,
            api_key=args.api_key,
            model=args.model,
            prompt=build_prompt(args.prompt_tokens, f"warm-up {index}"),
            max_tokens=min(args.max_tokens, 32),
            timeout=args.timeout,
        )

    raw_results: list[tuple[int, tuple[int, int, float, float, float]]] = []
    with VramSampler(args.sample_vram) as sampler:
        with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            futures = {
                pool.submit(
                    run_request,
                    base_url=args.base_url,
                    api_key=args.api_key,
                    model=args.model,
                    prompt=build_prompt(args.prompt_tokens, f"measured request {index}"),
                    max_tokens=args.max_tokens,
                    timeout=args.timeout,
                ): index
                for index in range(args.requests)
            }
            for future in as_completed(futures):
                raw_results.append((futures[future], future.result()))
    peak_vram = sampler.peak_gib
    if args.remote_vram_url:
        response = httpx.get(args.remote_vram_url, timeout=args.timeout)
        response.raise_for_status()
        remote_peak = response.json().get("peak_vram_gib")
        peak_vram = float(remote_peak) if remote_peak is not None else None

    rows = []
    for index, values in sorted(raw_results):
        prompt_tokens, output_tokens, ttft_ms, e2e_ms, output_tps = values
        rows.append(
            RequestMetrics(
                config_label=args.config_label,
                model=args.model,
                quantization=args.quantization,
                prefix_caching=args.prefix_caching,
                chunked_prefill=args.chunked_prefill,
                speculative_decoding=args.speculative_decoding,
                block_size=args.block_size,
                max_num_batched_tokens=args.max_num_batched_tokens,
                draft_model=args.draft_model,
                draft_quantization=args.draft_quantization,
                requested_prompt_tokens=args.prompt_tokens,
                concurrency=args.concurrency,
                request_index=index,
                prompt_tokens=prompt_tokens,
                output_tokens=output_tokens,
                ttft_ms=round(ttft_ms, 3),
                e2e_ms=round(e2e_ms, 3),
                decode_ms=round(max(e2e_ms - ttft_ms, 0), 3),
                output_tokens_per_second=round(output_tps, 3),
                peak_vram_gib=peak_vram,
            )
        )
    append_rows(args.output, rows)
    print(
        json.dumps(
            {
                "rows": len(rows),
                "output": str(args.output),
                "p50_ttft_ms": round(statistics.median(row.ttft_ms for row in rows), 3),
                "peak_vram_gib": peak_vram,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
