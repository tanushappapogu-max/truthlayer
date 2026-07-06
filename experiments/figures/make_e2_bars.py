"""E2 figure: hallucination rate, raw Llama vs VAG-wrapped, with 95% CIs."""

from __future__ import annotations

import json
import math
from pathlib import Path

import style
style.apply()
import matplotlib.pyplot as plt

RESULTS = Path(__file__).resolve().parent.parent / "e2_vag" / "results"
PAPER = Path(__file__).resolve().parent.parent.parent / "paper" / "results"


def wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return 0.0, 0.0
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return center - half, center + half


def main():
    s = json.loads((RESULTS / "e2_vag_500.summary.json").read_text())
    conditions = [
        ("Raw\nLlama-3.2-3B", s["raw"]["unsupported"], s["raw"]["claims"], "#D55E00"),
        ("+ TruthLayer\n(VAG)", s["vag"]["unsupported"], s["vag"]["claims"], "#009E73"),
    ]

    fig, ax = plt.subplots(figsize=(4.6, 4.0), dpi=300)
    rates = []
    for i, (label, k, n, color) in enumerate(conditions):
        rate = k / n * 100
        rates.append(rate)
        lo, hi = wilson_ci(k, n)
        ax.bar(i, rate, width=0.52, color=color, zorder=3)
        ax.errorbar(i, rate, yerr=[[rate - lo * 100], [hi * 100 - rate]],
                    fmt="none", ecolor="#333333", elinewidth=1.4,
                    capsize=6, capthick=1.4, zorder=4)
        ax.annotate(f"{rate:.1f}%", (i, hi * 100), textcoords="offset points",
                    xytext=(0, 8), ha="center", fontsize=13, fontweight="bold")
        ax.annotate(f"{k}/{n} claims", (i, rate / 2), ha="center", va="center",
                    fontsize=8.5, color="white", fontweight="semibold")

    # relative-reduction bracket
    rel = (rates[0] - rates[1]) / rates[0]
    y_br = 17.8
    ax.plot([0, 0, 1, 1], [y_br - 0.35, y_br, y_br, y_br - 0.35],
            color="#333333", lw=1.1, zorder=5)
    ax.annotate(f"−{rel:.0%} relative  (p = 0.017)", (0.5, y_br),
                textcoords="offset points", xytext=(0, 5),
                ha="center", fontsize=9.5, fontweight="semibold")

    ax.set_xticks(range(len(conditions)))
    ax.set_xticklabels([c[0] for c in conditions], fontsize=10)
    ax.set_ylabel("Hallucinated claims (%, MiniCheck judge)")
    ax.set_ylim(0, 20.5)
    ax.set_title("Generation-time verification (n=500 docs)")
    ax.grid(True, axis="y")
    fig.tight_layout()

    PAPER.mkdir(parents=True, exist_ok=True)
    for out in (RESULTS / "e2_bars.pdf", RESULTS / "e2_bars.png", PAPER / "e2_bars.pdf"):
        fig.savefig(out)
    print(f"wrote {RESULTS/'e2_bars.png'}")


if __name__ == "__main__":
    main()
