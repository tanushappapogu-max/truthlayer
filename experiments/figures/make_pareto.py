"""Pareto frontier: balanced accuracy (y) vs ms-per-claim log scale (x)."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RESULTS = Path(__file__).resolve().parent.parent / "e1_external_validation" / "results"
PAPER = Path(__file__).resolve().parent.parent.parent / "paper" / "results"

# colorblind-safe (Okabe-Ito)
COLORS = {"signals": "#009E73", "nli": "#0072B2", "minicheck": "#D55E00", "tiered": "#CC79A7"}
LABELS = {"signals": "Signals only", "nli": "NLI (DeBERTa-v3)",
          "minicheck": "MiniCheck-FT5-L", "tiered": "TruthLayer tiered"}


def main():
    fig, ax = plt.subplots(figsize=(5.2, 3.6), dpi=300)
    for system in ["signals", "nli", "minicheck", "tiered"]:
        path = RESULTS / f"{system}.summary.json"
        if not path.exists():
            continue
        s = json.loads(path.read_text())
        m = s["metrics"]
        d = m.get("decided", m["default_accept"])
        x = max(s["cost"]["ms_per_claim_mean"], 0.01)
        y = d["balanced_accuracy"] * 100
        ax.scatter(x, y, s=70, color=COLORS[system], zorder=3)
        note = f" (cov {m['coverage']:.0%})" if m["coverage"] < 0.999 else ""
        ax.annotate(LABELS[system] + note, (x, y), textcoords="offset points",
                    xytext=(8, 4), fontsize=8)

    ax.set_xscale("log")
    ax.set_xlabel("Latency (ms/claim, log scale)")
    ax.set_ylabel("Balanced accuracy (%)")
    ax.set_title("Accuracy vs cost on LLM-AggreFact (test)")
    ax.grid(True, alpha=0.25)
    fig.tight_layout()

    PAPER.mkdir(parents=True, exist_ok=True)
    fig.savefig(RESULTS / "pareto.pdf")
    fig.savefig(PAPER / "pareto.pdf")
    fig.savefig(RESULTS / "pareto.png")
    print(f"wrote {RESULTS/'pareto.pdf'} and {PAPER/'pareto.pdf'}")


if __name__ == "__main__":
    main()
