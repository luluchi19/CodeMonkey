from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

import pandas as pd


def test_plotter_creates_required_charts(tmp_path: Path, monkeypatch) -> None:
    script = Path(__file__).parents[2] / "inference-lab" / "plot_benchmarks.py"
    spec = importlib.util.spec_from_file_location("plot_benchmarks", script)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    rows = []
    for quantization, vram in (("bf16", 15.0), ("fp8", 9.0)):
        for chunked in (False, True):
            for block_size in (8, 16, 32):
                rows.append(
                    {
                        "config_label": f"{quantization}-{chunked}-{block_size}",
                        "quantization": quantization,
                        "prefix_caching": True,
                        "chunked_prefill": chunked,
                        "speculative_decoding": False,
                        "block_size": block_size,
                        "requested_prompt_tokens": 8192,
                        "concurrency": 1,
                        "request_index": 0,
                        "prompt_tokens": 8192,
                        "output_tokens": 64,
                        "ttft_ms": 900 - (100 if chunked else 0),
                        "e2e_ms": 1500,
                        "decode_ms": 600,
                        "output_tokens_per_second": 80 + block_size,
                        "peak_vram_gib": vram,
                    }
                )
    input_path = tmp_path / "benchmark.csv"
    output_dir = tmp_path / "charts"
    pd.DataFrame(rows).to_csv(input_path, index=False)
    monkeypatch.setattr(
        sys,
        "argv",
        ["plot_benchmarks.py", "--input", str(input_path), "--output-dir", str(output_dir)],
    )
    module.main()

    assert (output_dir / "vram_bf16_vs_fp8.png").is_file()
    assert (output_dir / "ttft_chunked_prefill.png").is_file()
    assert (output_dir / "throughput_by_block_size.png").is_file()
    assert (output_dir / "summary.csv").is_file()
    assert (output_dir / "vram_comparison.csv").is_file()
    assert (output_dir / "ttft_comparison.csv").is_file()
