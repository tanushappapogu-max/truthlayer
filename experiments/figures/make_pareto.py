"""Pareto frontier: balanced accuracy (y) vs ms-per-claim log scale (x)."""

from __future__ import annotations

import json
from pathlib import Path

import style
style.apply()
import matplotlib.pyplot as plt

RESULTS = Path(__file__).resolve().parent.parent / "e1_external_validation" / "results"
PAPER = Path(__file__).resolve().parent.parent.parent / "paper" / "results"

# colorblind-safe (Okabe-Ito)
COLORS = {
    "signals": "#009E73",
    "nli": "#0072B2",
    "minicheck": "#D55E00",
    "tiered": "#CC79A7",
    "tafs": "#56B4E9",
    "tiered_tafs": "#E69F00",
    "tiered_minicheck": "#1a1a1a",
}
LABELS = {
    "signals": "Signals only",
    "nli": "NLI (DeBERTa-v3)",
    "minicheck": "MiniCheck-FT5-L",
    "tiered": "Tiered: sig→NLI",
    "tafs": "TAFS",
    "tiered_tafs": "Tiered: sig→TAFS",
    "tiered_minicheck": "Tiered: sig→MiniCheck",
}
# per-point label placement: (dx, dy) points, horizontal alignment
OFFSETS = {
    "signals": (10, -3, "left"),
    "nli": (10, -3, "left"),
    "tafs": (10, -3, "left"),
    "tiered": (10, -3, "left"),
    "tiered_tafs": (0, 12, "center"),
    "minicheck": (10, 4, "left"),
    "tiered_minicheck": (-12, -6, "right"),
}


def main():
    fig, ax = plt.subplots(figsize=(6.4, 4.2), dpi=300)

    for system in ["signals", "nli", "tafs", "tiered", "tiered_tafs",
                   "minicheck", "tiered_minicheck"]:
        path = RESULTS / f"{system}.summary.json"
        if not path.exists():
            continue
        s = json.loads(path.read_text())
        m = s["metrics"]
        d = m.get("decided", m["default_accept"])
        x = max(s["cost"]["ms_per_claim_mean"], 0.01)
        y = d["balanced_accuracy"] * 100

        star = system == "tiered_minicheck"
        ax.scatter(x, y, s=260 if star else 110,
                   color=COLORS[system], marker="*" if star else "o",
                   edgecolors="white", linewidths=1.2, zorder=4)

        note = f" (cov {m['coverage']:.0%})" if m["coverage"] < 0.999 else ""
        dx, dy, ha = OFFSETS.get(system, (10, -3, "left"))
        ax.annotate(LABELS[system] + note, (x, y), textcoords="offset points",
                    xytext=(dx, dy), fontsize=8.5, ha=ha,
                    fontweight="bold" if star else "normal")

    # "better" direction cue (kept clear of the data)
    ax.annotate("", xy=(0.36, 0.90), xytext=(0.46, 0.78),
                xycoords="axes fraction",
                arrowprops=dict(arrowstyle="->", color="#999999", lw=1.2))
    ax.annotate("better", xy=(0.455, 0.84), xycoords="axes fraction",
                fontsize=9.5, color="#999999", style="italic")

    ax.set_xscale("log")
    ax.set_xlim(0.3, 3000)
    ax.set_xlabel("Latency (ms per claim, log scale)")
    ax.set_ylabel("Balanced accuracy (%)")
    ax.set_title("Accuracy vs. cost on LLM-AggreFact (test, n=29,320)")
    ax.grid(True, which="both")
    fig.tight_layout()

    PAPER.mkdir(parents=True, exist_ok=True)
    fig.savefig(RESULTS / "pareto.pdf")
    fig.savefig(PAPER / "pareto.pdf")
    fig.savefig(RESULTS / "pareto.png")
    print(f"wrote {RESULTS/'pareto.pdf'} and {PAPER/'pareto.pdf'}")


if __name__ == "__main__":
    main()
