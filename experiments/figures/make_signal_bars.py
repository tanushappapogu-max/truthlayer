"""Per-signal precision bars: internal 1,036-case benchmark vs AggreFact external.

The honesty figure — shows where external data is harsher than the
author-constructed benchmark.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

RESULTS = Path(__file__).resolve().parent.parent / "e1_external_validation" / "results"
PAPER = Path(__file__).resolve().parent.parent.parent / "paper" / "results"

# internal benchmark precision (1,036-case FEVER-derived, from repo benchmark run)
INTERNAL = {
    "NUMERIC_CONTRADICTION": 1.00,
    "NEGATION_CONTRADICTION": 1.00,
    "RELATION_CONTRADICTION": 1.00,
    "TYPE_CONTRADICTION": 1.00,
    "CONTRAST_CONTRADICTION": 0.96,
    "HEDGING_MISMATCH": 0.83,
    "EVIDENCE_COVERAGE": 0.62,
    "ENTITY_SUBSTITUTION": 0.54,
}


def external_precision() -> dict[str, tuple[float, int]]:
    """Per-signal precision on AggreFact from the signals.jsonl run.

    A signal is 'correct' when it fired as the top contradiction signal on a
    case the system rejected and the label was unsupported.
    """
    path = RESULTS / "signals.jsonl"
    if not path.exists():
        return {}
    fires = defaultdict(lambda: [0, 0])  # signal -> [correct, total]
    for line in open(path):
        r = json.loads(line)
        if not r["decided"] or r["pred"] != 0 or not r.get("signal"):
            continue
        fires[r["signal"]][1] += 1
        if r["label"] == 0:
            fires[r["signal"]][0] += 1
    return {k: (c / t, t) for k, (c, t) in fires.items() if t > 0}


def main():
    ext = external_precision()
    signals = list(INTERNAL.keys())

    x = np.arange(len(signals))
    width = 0.38

    fig, ax = plt.subplots(figsize=(7.2, 3.8), dpi=300)
    ax.bar(x - width / 2, [INTERNAL[s] * 100 for s in signals], width,
           label="Internal (1,036 FEVER-derived)", color="#0072B2")
    ext_vals = [ext.get(s, (float("nan"), 0))[0] * 100 for s in signals]
    ax.bar(x + width / 2, ext_vals, width,
           label="External (LLM-AggreFact test)", color="#D55E00")

    for i, s in enumerate(signals):
        if s in ext:
            ax.text(i + width / 2, ext_vals[i] + 1, f"n={ext[s][1]}",
                    ha="center", fontsize=6)

    ax.set_xticks(x)
    ax.set_xticklabels([s.replace("_CONTRADICTION", "").replace("_", "\n").title()
                        for s in signals], fontsize=7)
    ax.set_ylabel("Precision when firing (%)")
    ax.set_ylim(0, 108)
    ax.legend(fontsize=8)
    ax.grid(True, axis="y", alpha=0.25)
    fig.tight_layout()

    PAPER.mkdir(parents=True, exist_ok=True)
    fig.savefig(RESULTS / "signal_bars.pdf")
    fig.savefig(PAPER / "signal_bars.pdf")
    fig.savefig(RESULTS / "signal_bars.png")
    print(f"wrote {RESULTS/'signal_bars.pdf'} and {PAPER/'signal_bars.pdf'}")


if __name__ == "__main__":
    main()
