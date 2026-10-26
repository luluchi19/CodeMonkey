"""Wait until a deployed Modal vLLM revision is healthy with the expected config."""

from __future__ import annotations

import argparse
import time

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--quantization", required=True)
    parser.add_argument("--chunked-prefill", choices=("true", "false"), required=True)
    parser.add_argument("--block-size", required=True)
    parser.add_argument("--timeout", type=float, default=900)
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    deadline = time.time() + args.timeout
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        try:
            health = httpx.get(f"{base_url}/health", timeout=60)
            config = (
                httpx.get(f"{base_url}/internal/config", timeout=60)
                if health.status_code == 200
                else None
            )
            payload = config.json() if config and config.status_code == 200 else {}
            print(
                f"attempt={attempt} health={health.status_code} "
                f"quantization={payload.get('quantization', '-')} "
                f"chunked={payload.get('chunked_prefill', '-')} "
                f"block={payload.get('block_size', '-')}",
                flush=True,
            )
            expected = (
                payload.get("quantization") == args.quantization
                and payload.get("chunked_prefill") == args.chunked_prefill
                and payload.get("block_size") == args.block_size
            )
            if health.status_code == 200 and expected:
                print(payload, flush=True)
                return
        except Exception as exc:
            print(f"attempt={attempt} error={type(exc).__name__}: {exc}", flush=True)
        time.sleep(10)
    raise SystemExit("Modal vLLM did not reach the expected configuration before timeout")


if __name__ == "__main__":
    main()
