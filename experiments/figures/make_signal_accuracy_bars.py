"""Per-signal decided-case accuracy under the original 8-rule config.

The figure behind the pruning decision: five signals sit at or below
coin-flip accuracy (they were removed); the kept signals are the ones
doing real work.
"""

from __future__ import annotations

import json
from pathlib import Path

import style
style.apply()
import matplotlib.pyplot as plt

RESULTS = Path(__file__).resolve().parent.parent / "e1_external_validation" / "results"
PAPER = Path(__file__).resolve().parent.parent.parent / "paper" / "results"

PRETTY = {
    "NEGATION_CONTRADICTION": "Negation mismatch",
    "CONTRAST_CONTRADICTION": "Antonym contrast",
    "ENTITY_SUBSTITUTION": "Entity substitution",
    "NUMERIC_CONTRADICTION": "Number mismatch",
    "HEDGING_MISMATCH": "Hedging mismatch",
    "LEXICAL_OVERLAP": "Lexical overlap",
    "SOURCE_RETRIEVAL": "Source retrieval",
    "EVIDENCE_COVERAGE": "Evidence coverage",
}


def main():
    data = json.loads((RESULTS / "signal_accuracy_8rule.json").read_text())
    items = sorted(data.items(), key=lambda kv: kv[1]["accuracy"])

    fig, ax = plt.subplots(figsize=(6.4, 3.9), dpi=300)
    ys = range(len(items))
    for y, (name, v) in zip(ys, items):
        kept = v["kept"]
        color = "#009E73" if kept else "#D55E00"
        ax.barh(y, v["accuracy"] * 100, height=0.62, color=color,
                alpha=0.92, zorder=3)
        ax.annotate(f"{v['accuracy']:.0%}", (v["accuracy"] * 100, y),
                    textcoords="offset points", xytext=(6, 0),
                    va="center", fontsize=9.5, fontweight="bold")
        ax.annotate(f"n={v['total']:,}", (112, y), ha="right", va="center",
                    fontsize=8, color="#777777")

    ax.axvline(50, color="#333333", linestyle=(0, (4, 3)), linewidth=1.1, zorder=4)
    ax.annotate("coin flip", (50, len(items) - 0.35), fontsize=8.5,
                color="#333333", ha="center", va="bottom",
                annotation_clip=False,
                bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="none"))

    ax.set_yticks(list(ys))
    ax.set_yticklabels([PRETTY.get(n, n) for n, _ in items], fontsize=9.5)
    ax.set_xlabel("Decided-case accuracy (%)")
    ax.set_xlim(0, 112)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_title("Per-signal accuracy, original 8-rule config (test)")
    handles = [plt.Rectangle((0, 0), 1, 1, color="#009E73"),
               plt.Rectangle((0, 0), 1, 1, color="#D55E00")]
    ax.legend(handles, ["kept", "removed"], loc="lower center",
              bbox_to_anchor=(0.66, 0.02), fontsize=9, frameon=False)
    ax.grid(True, axis="x")
    fig.tight_layout()

    PAPER.mkdir(parents=True, exist_ok=True)
    for out in (RESULTS / "signal_accuracy_bars.pdf",
                RESULTS / "signal_accuracy_bars.png",
                PAPER / "signal_accuracy_bars.pdf"):
        fig.savefig(out)
    print(f"wrote {RESULTS/'signal_accuracy_bars.png'}")


if __name__ == "__main__":
    main()
