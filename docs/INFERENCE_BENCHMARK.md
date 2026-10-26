# vLLM latency and memory benchmark

This lab is intentionally separate from the Windows web/backend runtime. Run the vLLM server on a dedicated Linux NVIDIA GPU, then run the benchmark client either on that host or over a low-latency network.

## Metrics

| Metric | Definition |
| --- | --- |
| TTFT | Request start to first streamed content token |
| End-to-end latency | Request start to final streaming event |
| Decode throughput | Completion tokens divided by time after the first token |
| Peak VRAM | Sum of `nvidia-smi` compute-process memory samples on a dedicated GPU |
| FP8 saving | `(BF16 peak - FP8 peak) / BF16 peak * 100` |

The product UI still publishes one complete review. Streaming is enabled only in the benchmark client so TTFT can be measured accurately.

## Modal Serverless L40S

The repository includes `inference-lab/modal_vllm.py`, an OpenAI-compatible vLLM server for a Modal L40S (48 GiB, Ada). This makes FP8 W8A8 practical without relying on the local RTX 3050 Ti 4 GiB. The server also exposes `/internal/gpu-memory`, sampled inside the GPU container, so peak VRAM is measured rather than inferred.

Install the deployment CLI once:

```powershell
cd python-backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
cd ..
```

Deploy a BF16 baseline:

```powershell
$env:PYTHONUTF8 = "1"
$env:MODAL_VLLM_QUANTIZATION = "bf16"
$env:MODAL_VLLM_CHUNKED_PREFILL = "0"
$env:MODAL_VLLM_BLOCK_SIZE = "16"
.\python-backend\.venv\Scripts\python.exe -m modal deploy inference-lab\modal_vllm.py
```

Deploy the comparable FP8 server by changing only quantization:

```powershell
$env:MODAL_VLLM_QUANTIZATION = "fp8_per_tensor"
.\python-backend\.venv\Scripts\python.exe -m modal deploy inference-lab\modal_vllm.py
```

Modal prints the server URL after deployment. Measure it with:

```powershell
.\python-backend\.venv\Scripts\python.exe inference-lab\benchmark_vllm.py `
  --base-url "https://<modal-server-url>/v1" `
  --api-key "codemonkey-modal-benchmark" `
  --model "Qwen/Qwen2.5-Coder-7B-Instruct" `
  --config-label "modal-l40s-fp8-p16k-c1" `
  --quantization fp8 `
  --prefix-caching `
  --chunked-prefill `
  --block-size 16 `
  --prompt-tokens 16384 `
  --requests 8 `
  --warmup 1 `
  --remote-vram-url "https://<modal-server-url>/internal/gpu-memory" `
  --output inference-lab/results/benchmark.csv
```

The benchmark endpoint is intended for short-lived experiments. It is public at the Modal routing layer but requires the vLLM API key shown above; replace that default with a secret before any long-running deployment. Modal scales the container to zero after 60 idle seconds.

Stop the benchmark deployment explicitly when finished:

```powershell
$env:PYTHONUTF8 = "1"
.\python-backend\.venv\Scripts\python.exe -m modal app stop codemonkey-vllm-benchmark
```

## Measured Modal snapshot (2026-10-26)

Hardware and workload: one Modal L40S, vLLM 0.32.0, `Qwen/Qwen2.5-Coder-7B-Instruct`, 13,144 actual input tokens, 4 measured requests, concurrency 1, one warm-up request, Automatic Prefix Caching and Chunked Prefill enabled.

| Precision | Model load | Available KV cache | KV token capacity | P50 TTFT | Mean decode tok/s | Peak process VRAM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BF16 | 14.29 GiB | 23.88 GiB | 447,072 | 2,160.01 ms | 47.65 | 40.7559 GiB |
| FP8 per-tensor | 8.17 GiB | 29.68 GiB | 555,760 | 1,886.15 ms | 48.82 | 40.4668 GiB |

Measured deltas: FP8 saved 42.8% of model-load memory, increased KV token capacity by 24.3%, reduced P50 TTFT by 12.7%, and increased mean per-request decode throughput by 2.5%. Total process peak changed by only 0.7% because `gpu-memory-utilization=0.90` intentionally lets vLLM reserve the released memory for KV cache.

Additional measured experiments:

| Experiment | Result | Boundary |
| --- | --- | --- |
| Chunked Prefill, FP8, 16K requested tokens, concurrency 1 | P50 improved by 40.16 ms (2.1%); P95 regressed by 808.21 ms (36.1%) | 4 requests per side; the off run requires `max_num_batched_tokens=32768`, while on uses 8192 |
| KV `block_size=16`, FP8, 8K, concurrency 4 | 69.52 mean tokens/s/request | 8 requests |
| KV `block_size=32`, same workload | 60.41 mean tokens/s/request; block 16 was 15.1% higher | 8 requests |
| KV `block_size=8` | Unsupported by all CUDA attention backends selected by vLLM 0.32 on this L40S run | No synthetic substitute was added |

Raw evidence and generated charts are under `inference-lab/results/`. These values are a small reproducible portfolio snapshot, not universal model/GPU performance claims.

## Server setup

Use Linux with a supported NVIDIA driver/CUDA environment:

```bash
python -m venv .venv-vllm
source .venv-vllm/bin/activate
pip install -r inference-lab/requirements-vllm.txt
cp inference-lab/.env.example inference-lab/.env
set -a && source inference-lab/.env && set +a
bash inference-lab/serve_vllm.sh
```

For a BF16 run, leave `VLLM_QUANTIZATION` empty. For online FP8 on compatible hardware:

```bash
export VLLM_QUANTIZATION=fp8_per_tensor
bash inference-lab/serve_vllm.sh
```

FP8 W8A8 acceleration requires suitable hardware; older GPUs may use a weight-only fallback. Native FP4/MXFP4 behavior is also hardware/backend dependent. Record the selected kernel printed by vLLM at startup instead of inferring the effective precision from a flag.

## Required A/B matrix

Keep the model, GPU, driver, vLLM version, output length, seed, and request count constant.

| Experiment | Values |
| --- | --- |
| Weight precision | BF16, FP8 |
| Prompt length | 8K, 16K, 32K |
| Prefix cache | off, on with one warm-up request |
| Chunked prefill | off, on |
| `block_size` | 8, 16, 32 |
| Concurrency | 1, 4, 8 |
| Speculative decoding | off, optional compatible draft model |

Example client run:

```bash
python inference-lab/benchmark_vllm.py \
  --model Qwen/Qwen2.5-Coder-7B-Instruct \
  --config-label fp8-apc-chunked-b16-p16k-c1 \
  --quantization fp8 \
  --prefix-caching \
  --chunked-prefill \
  --block-size 16 \
  --max-num-batched-tokens 8192 \
  --prompt-tokens 16384 \
  --concurrency 1 \
  --requests 8 \
  --warmup 1 \
  --sample-vram
```

`--sample-vram` is meaningful only when the client runs on the same dedicated GPU host. Otherwise record peak VRAM separately and add it to the CSV before plotting.

## Automatic Prefix Caching and warm-up

The benchmark generates one long, byte-identical stable prefix and changes only a short suffix. The warm-up request populates the prefix cache before measured requests. This mirrors the production layout:

```text
stable prefix = review policy + repository summary + unchanged architecture context
new suffix    = PR diff + retrieved symbols + current review request
```

Cache reuse avoids repeated prefill work for an identical prefix. It does not accelerate generation of new output tokens, and the cache is not assumed to survive a server restart.

## Chunked prefill

Chunked prefill is a scheduler trade-off, not a guaranteed fixed TTFT reduction. Compare measured P50/P95 TTFT at each prompt length and keep `max_num_batched_tokens` in the experiment metadata. Smaller token budgets may improve inter-token latency while larger budgets can improve TTFT/throughput.

## Speculative decoding

Only enable a draft model after the BF16/FP8 baseline is stable:

```bash
export VLLM_SPECULATIVE_CONFIG='{"method":"draft_model","model":"<compatible-draft-model>","num_speculative_tokens":5,"quantization":"mxfp4"}'
bash inference-lab/serve_vllm.sh
```

Use an FP4 draft only when the GPU and model checkpoint actually support the selected FP4 kernel. Otherwise use an explicitly labelled INT4/AWQ/GPTQ draft. Report acceptance rate, TTFT, decode throughput, and the draft model's added VRAM.

## Generate the required charts

After collecting all measured rows:

```bash
python inference-lab/plot_benchmarks.py \
  --input inference-lab/results/benchmark.csv \
  --output-dir inference-lab/results/charts
```

Outputs:

- `vram_bf16_vs_fp8.png` with measured percentage saving.
- `ttft_chunked_prefill.png` with P95 TTFT by prompt length.
- `throughput_by_block_size.png` with a line per concurrency.
- `summary.csv` with per-configuration aggregates.
- `vram_comparison.csv` and `ttft_comparison.csv` with the exact percentage/ms deltas used by the charts.

The plotter refuses an empty dataset and does not invent missing BF16/FP8 measurements.

References: [vLLM serve CLI](https://docs.vllm.ai/en/latest/cli/serve/), [FP8](https://docs.vllm.ai/en/latest/features/quantization/fp8/), [online quantization](https://docs.vllm.ai/en/latest/features/quantization/online/), [automatic prefix caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/), and [speculative decoding](https://docs.vllm.ai/en/latest/features/speculative_decoding/).
