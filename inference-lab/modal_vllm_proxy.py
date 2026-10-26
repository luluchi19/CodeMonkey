"""Small streaming proxy that exposes vLLM plus measured GPU-memory usage."""

from __future__ import annotations

import os
import subprocess
import threading
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
from starlette.background import BackgroundTask


UPSTREAM = os.environ.get("CODEMONKEY_VLLM_UPSTREAM", "http://127.0.0.1:8001")
app = FastAPI(title="CodeMonkey Modal vLLM benchmark proxy")
_peak_mib = 0.0
_stop = threading.Event()


def _gpu_used_mib() -> float | None:
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


def _sample_gpu() -> None:
    global _peak_mib
    while not _stop.is_set():
        current = _gpu_used_mib()
        if current is not None:
            _peak_mib = max(_peak_mib, current)
        _stop.wait(0.1)


@app.on_event("startup")
async def start_sampler() -> None:
    threading.Thread(target=_sample_gpu, daemon=True).start()


@app.on_event("shutdown")
async def stop_sampler() -> None:
    _stop.set()


@app.get("/health")
async def health() -> dict[str, object]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{UPSTREAM}/health")
        response.raise_for_status()
    return {"status": "ok", "upstream": "vllm"}


@app.get("/internal/gpu-memory")
async def gpu_memory() -> dict[str, float | None]:
    current = _gpu_used_mib()
    return {
        "current_vram_gib": round(current / 1024, 4) if current is not None else None,
        "peak_vram_gib": round(_peak_mib / 1024, 4),
    }


@app.get("/internal/config")
async def config() -> dict[str, str]:
    return {
        "model": os.environ.get("CODEMONKEY_MODEL", ""),
        "quantization": os.environ.get("CODEMONKEY_QUANTIZATION", ""),
        "block_size": os.environ.get("CODEMONKEY_BLOCK_SIZE", ""),
        "chunked_prefill": os.environ.get("CODEMONKEY_CHUNKED_PREFILL", ""),
        "prefix_caching": os.environ.get("CODEMONKEY_PREFIX_CACHING", ""),
        "max_num_batched_tokens": os.environ.get("CODEMONKEY_MAX_BATCHED_TOKENS", ""),
    }


@app.api_route("/v1/{path:path}", methods=["GET", "POST"])
async def proxy_vllm(path: str, request: Request):
    client = httpx.AsyncClient(timeout=None)
    upstream_request = client.build_request(
        request.method,
        f"{UPSTREAM}/v1/{path}",
        headers={
            key: value
            for key, value in request.headers.items()
            if key.lower() not in {"host", "content-length"}
        },
        content=await request.body(),
    )
    response = await client.send(upstream_request, stream=True)

    async def close() -> None:
        await response.aclose()
        await client.aclose()

    headers = {
        key: value
        for key, value in response.headers.items()
        if key.lower() not in {"content-length", "content-encoding", "transfer-encoding"}
    }
    if response.status_code >= 400:
        body = await response.aread()
        await close()
        return JSONResponse(
            status_code=response.status_code,
            content={"upstream_error": body.decode(errors="replace")},
        )
    return StreamingResponse(
        response.aiter_raw(),
        status_code=response.status_code,
        headers=headers,
        background=BackgroundTask(close),
    )
