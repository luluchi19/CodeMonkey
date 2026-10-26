"""Deploy an OpenAI-compatible vLLM server on a Modal L40S for honest GPU benchmarks.

Deployment-time environment variables select the experiment configuration, so the
same app can be redeployed for BF16/FP8, chunked-prefill, and block-size A/B runs.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

import modal


MODEL = os.environ.get("MODAL_VLLM_MODEL", "Qwen/Qwen2.5-Coder-7B-Instruct")
_quantization = os.environ.get("MODAL_VLLM_QUANTIZATION", "fp8_per_tensor")
QUANTIZATION = "" if _quantization.lower() in {"", "none", "bf16"} else _quantization
BLOCK_SIZE = int(os.environ.get("MODAL_VLLM_BLOCK_SIZE", "16"))
CHUNKED_PREFILL = os.environ.get("MODAL_VLLM_CHUNKED_PREFILL", "1") == "1"
PREFIX_CACHING = os.environ.get("MODAL_VLLM_PREFIX_CACHING", "1") == "1"
MAX_MODEL_LEN = int(os.environ.get("MODAL_VLLM_MAX_MODEL_LEN", "32768"))
MAX_BATCHED_TOKENS = int(os.environ.get("MODAL_VLLM_MAX_BATCHED_TOKENS", "8192"))
EFFECTIVE_MAX_BATCHED_TOKENS = (
    MAX_BATCHED_TOKENS if CHUNKED_PREFILL else max(MAX_BATCHED_TOKENS, MAX_MODEL_LEN)
)
API_KEY = os.environ.get("MODAL_VLLM_API_KEY", "codemonkey-modal-benchmark")
PORT = 8000
VLLM_PORT = 8001

app = modal.App("codemonkey-vllm-benchmark")
hf_cache = modal.Volume.from_name("codemonkey-huggingface-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("codemonkey-vllm-cache", create_if_missing=True)
proxy_path = Path(__file__).with_name("modal_vllm_proxy.py")

image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.32.0", "httpx")
    .env(
        {
            "HF_XET_HIGH_PERFORMANCE": "1",
            "VLLM_LOG_STATS_INTERVAL": "1",
            "CODEMONKEY_VLLM_UPSTREAM": f"http://127.0.0.1:{VLLM_PORT}",
            "CODEMONKEY_MODEL": MODEL,
            "CODEMONKEY_QUANTIZATION": QUANTIZATION or "bf16",
            "CODEMONKEY_BLOCK_SIZE": str(BLOCK_SIZE),
            "CODEMONKEY_CHUNKED_PREFILL": str(CHUNKED_PREFILL).lower(),
            "CODEMONKEY_PREFIX_CACHING": str(PREFIX_CACHING).lower(),
            "CODEMONKEY_MAX_BATCHED_TOKENS": str(EFFECTIVE_MAX_BATCHED_TOKENS),
            "MODAL_VLLM_MODEL": MODEL,
            "MODAL_VLLM_QUANTIZATION": QUANTIZATION or "bf16",
            "MODAL_VLLM_BLOCK_SIZE": str(BLOCK_SIZE),
            "MODAL_VLLM_CHUNKED_PREFILL": "1" if CHUNKED_PREFILL else "0",
            "MODAL_VLLM_PREFIX_CACHING": "1" if PREFIX_CACHING else "0",
            "MODAL_VLLM_MAX_MODEL_LEN": str(MAX_MODEL_LEN),
            "MODAL_VLLM_MAX_BATCHED_TOKENS": str(MAX_BATCHED_TOKENS),
        }
    )
    .add_local_file(str(proxy_path), "/root/modal_vllm_proxy.py")
)


@app.server(
    image=image,
    gpu="L40S",
    port=PORT,
    target_concurrency=16,
    scaledown_window=60,
    startup_timeout=15 * 60,
    volumes={
        "/root/.cache/huggingface": hf_cache,
        "/root/.cache/vllm": vllm_cache,
    },
    unauthenticated=True,
)
class Server:
    @modal.enter()
    def start(self) -> None:
        command = [
            "vllm",
            "serve",
            MODEL,
            "--host",
            "127.0.0.1",
            "--port",
            str(VLLM_PORT),
            "--api-key",
            API_KEY,
            "--served-model-name",
            MODEL,
            "--dtype",
            "bfloat16",
            "--max-model-len",
            str(MAX_MODEL_LEN),
            "--gpu-memory-utilization",
            "0.90",
            "--block-size",
            str(BLOCK_SIZE),
            "--max-num-batched-tokens",
            str(EFFECTIVE_MAX_BATCHED_TOKENS),
        ]
        command.append("--enable-prefix-caching" if PREFIX_CACHING else "--no-enable-prefix-caching")
        command.append("--enable-chunked-prefill" if CHUNKED_PREFILL else "--no-enable-chunked-prefill")
        if QUANTIZATION:
            command.extend(["--quantization", QUANTIZATION])

        print(
            "CODemonkey vLLM config:",
            json.dumps(
                {
                    "model": MODEL,
                    "quantization": QUANTIZATION or "bf16",
                    "block_size": BLOCK_SIZE,
                    "chunked_prefill": CHUNKED_PREFILL,
                    "prefix_caching": PREFIX_CACHING,
                    "max_model_len": MAX_MODEL_LEN,
                }
            ),
        )
        self.vllm_process = subprocess.Popen(command)
        deadline = time.monotonic() + 14 * 60
        health_url = f"http://127.0.0.1:{VLLM_PORT}/health"
        while time.monotonic() < deadline:
            if self.vllm_process.poll() is not None:
                raise RuntimeError(f"vLLM exited with code {self.vllm_process.returncode}")
            try:
                with urllib.request.urlopen(health_url, timeout=2) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(2)
        else:
            raise TimeoutError("vLLM did not become healthy before startup timeout")

        self.proxy_process = subprocess.Popen(
            [
                "uvicorn",
                "modal_vllm_proxy:app",
                "--host",
                "0.0.0.0",
                "--port",
                str(PORT),
            ],
            cwd="/root",
        )

    @modal.exit()
    def stop(self) -> None:
        for process in (getattr(self, "proxy_process", None), getattr(self, "vllm_process", None)):
            if process is not None:
                process.terminate()


@app.local_entrypoint()
def print_config() -> None:
    print(
        json.dumps(
            {
                "model": MODEL,
                "quantization": QUANTIZATION or "bf16",
                "block_size": BLOCK_SIZE,
                "chunked_prefill": CHUNKED_PREFILL,
                "prefix_caching": PREFIX_CACHING,
                "gpu": "L40S",
            },
            indent=2,
        )
    )
