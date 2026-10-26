from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def _bool_column(series: pd.Series) -> pd.Series:
    return series.astype(str).str.lower().map({"true": True, "false": False})


def main() -> None:
    parser = argparse.ArgumentParser(description="Create measured vLLM benchmark charts.")
    parser.add_argument("--input", type=Path, default=Path("results/benchmark.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("results/charts"))
    args = parser.parse_args()
    frame = pd.read_csv(args.input)
    if frame.empty:
        raise ValueError("Benchmark CSV contains no measured rows")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for column in ("prefix_caching", "chunked_prefill", "speculative_decoding"):
        frame[column] = _bool_column(frame[column])

    vram = frame.groupby("quantization", as_index=True)["peak_vram_gib"].max().dropna()
    if {"bf16", "fp8"}.issubset(vram.index):
        saving = (vram["bf16"] - vram["fp8"]) / vram["bf16"] * 100
        pd.DataFrame(
            [{
                "bf16_peak_vram_gib": vram["bf16"],
                "fp8_peak_vram_gib": vram["fp8"],
                "saving_percent": saving,
            }]
        ).to_csv(args.output_dir / "vram_comparison.csv", index=False)
        axis = vram.loc[["bf16", "fp8"]].plot(kind="bar", color=["#64748b", "#14b8a6"])
        axis.set_ylabel("Peak VRAM (GiB)")
        axis.set_title(f"Measured peak VRAM — FP8 saves {saving:.1f}%")
        axis.tick_params(axis="x", rotation=0)
        plt.tight_layout()
        plt.savefig(args.output_dir / "vram_bf16_vs_fp8.png", dpi=180)
        plt.close()

    ttft_source = frame[
        (frame["quantization"] == "fp8")
        & (frame["block_size"] == 16)
        & (frame["concurrency"] == 1)
        & frame["prefix_caching"]
        & ~frame["speculative_decoding"]
    ]
    ttft = (
        ttft_source.groupby(["requested_prompt_tokens", "chunked_prefill"])["ttft_ms"]
        .quantile(0.95)
        .unstack()
        .sort_index()
    )
    axis = ttft.plot(marker="o")
    axis.set_xlabel("Requested prompt length (tokens)")
    axis.set_ylabel("P95 TTFT (ms)")
    axis.set_title("Chunked prefill: measured P95 TTFT")
    axis.legend(["off" if not value else "on" for value in ttft.columns], title="Chunked prefill")
    plt.tight_layout()
    plt.savefig(args.output_dir / "ttft_chunked_prefill.png", dpi=180)
    plt.close()
    if {False, True}.issubset(ttft.columns):
        ttft_median = (
            ttft_source.groupby(["requested_prompt_tokens", "chunked_prefill"])["ttft_ms"]
            .median()
            .unstack()
            .sort_index()
        )
        ttft_comparison = pd.DataFrame(
            {
                "chunked_off_p50_ms": ttft_median[False],
                "chunked_on_p50_ms": ttft_median[True],
                "p50_reduction_ms": ttft_median[False] - ttft_median[True],
                "p50_reduction_percent": (ttft_median[False] - ttft_median[True]) / ttft_median[False] * 100,
                "chunked_off_p95_ms": ttft[False],
                "chunked_on_p95_ms": ttft[True],
                "p95_reduction_ms": ttft[False] - ttft[True],
                "p95_reduction_percent": (ttft[False] - ttft[True]) / ttft[False] * 100,
            }
        )
        ttft_comparison.to_csv(args.output_dir / "ttft_comparison.csv")

    throughput_source = frame[
        (frame["quantization"] == "fp8")
        & frame["chunked_prefill"]
        & (frame["concurrency"] == frame["concurrency"].max())
        & ~frame["speculative_decoding"]
    ]
    throughput = (
        throughput_source.groupby(["block_size", "concurrency"])["output_tokens_per_second"]
        .mean()
        .unstack()
        .sort_index()
    )
    axis = throughput.plot(marker="o")
    axis.set_xlabel("KV-cache block_size (tokens)")
    axis.set_ylabel("Mean output tokens/s per request")
    axis.set_title("Decode throughput by KV-cache allocation block")
    axis.legend(title="Concurrency")
    plt.tight_layout()
    plt.savefig(args.output_dir / "throughput_by_block_size.png", dpi=180)
    plt.close()

    summary = frame.groupby("config_label").agg(
        requests=("request_index", "count"),
        p50_ttft_ms=("ttft_ms", "median"),
        p95_ttft_ms=("ttft_ms", lambda values: values.quantile(0.95)),
        mean_output_tokens_per_second=("output_tokens_per_second", "mean"),
        peak_vram_gib=("peak_vram_gib", "max"),
    )
    summary.to_csv(args.output_dir / "summary.csv")

    startup_path = args.input.parent / "startup_metrics.csv"
    if startup_path.exists():
        startup = pd.read_csv(startup_path).set_index("quantization")
        if {"bf16", "fp8"}.issubset(startup.index):
            model_saving = (
                (startup.loc["bf16", "model_load_gib"] - startup.loc["fp8", "model_load_gib"])
                / startup.loc["bf16", "model_load_gib"]
                * 100
            )
            kv_gain = (
                (startup.loc["fp8", "kv_cache_tokens"] - startup.loc["bf16", "kv_cache_tokens"])
                / startup.loc["bf16", "kv_cache_tokens"]
                * 100
            )
            pd.DataFrame(
                [
                    {
                        "bf16_model_load_gib": startup.loc["bf16", "model_load_gib"],
                        "fp8_model_load_gib": startup.loc["fp8", "model_load_gib"],
                        "model_memory_saving_percent": model_saving,
                        "bf16_kv_cache_tokens": startup.loc["bf16", "kv_cache_tokens"],
                        "fp8_kv_cache_tokens": startup.loc["fp8", "kv_cache_tokens"],
                        "kv_cache_capacity_gain_percent": kv_gain,
                    }
                ]
            ).to_csv(args.output_dir / "startup_comparison.csv", index=False)

            axis = startup.loc[["bf16", "fp8"], "model_load_gib"].plot(
                kind="bar", color=["#64748b", "#14b8a6"]
            )
            axis.set_ylabel("Model load memory (GiB)")
            axis.set_title(f"Measured model memory - FP8 saves {model_saving:.1f}%")
            axis.tick_params(axis="x", rotation=0)
            plt.tight_layout()
            plt.savefig(args.output_dir / "model_memory_bf16_vs_fp8.png", dpi=180)
            plt.close()

            axis = startup.loc[["bf16", "fp8"], "kv_cache_tokens"].plot(
                kind="bar", color=["#64748b", "#14b8a6"]
            )
            axis.set_ylabel("KV-cache token capacity")
            axis.set_title(f"Measured KV-cache capacity - FP8 adds {kv_gain:.1f}%")
            axis.tick_params(axis="x", rotation=0)
            plt.tight_layout()
            plt.savefig(args.output_dir / "kv_cache_capacity_bf16_vs_fp8.png", dpi=180)
            plt.close()
    print(f"Wrote measured summaries to {args.output_dir}")


if __name__ == "__main__":
    main()
