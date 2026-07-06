"""Compose the tiered signals->MiniCheck system from existing runs.

Stage 1 decisions come from signals.jsonl; cases where signals
abstained take MiniCheck's prediction from minicheck.jsonl. Latency
for escalated cases is the sum of both stages. No model calls —
pure composition of already-measured runs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import RESULTS  # noqa: E402
from common.metrics import evaluate_with_abstention, per_dataset_breakdown  # noqa: E402
from common.cost import cost_summary  # noqa: E402

OUT = RESULTS / "tiered_minicheck.jsonl"


def main():
    signals = {r["id"]: r for r in map(json.loads, open(RESULTS / "signals.jsonl"))}
    minicheck = {r["id"]: r for r in map(json.loads, open(RESULTS / "minicheck.jsonl"))}
    assert set(signals) == set(minicheck), "run id sets differ"

    rows = []
    with open(OUT, "w") as f:
        for id_, sig in signals.items():
            if sig["decided"]:
                row = {**sig, "tier": "signals"}
            else:
                mc = minicheck[id_]
                row = {
                    "id": id_,
                    "dataset": mc["dataset"],
                    "label": mc["label"],
                    "pred": mc["pred"],
                    "score": mc["score"],
                    "decided": True,
                    "tier": "minicheck",
                    "signal": None,
                    "latency_ms": sig["latency_ms"] + mc["latency_ms"],
                }
            rows.append(row)
            f.write(json.dumps(row) + "\n")

    summary = {
        "system": "tiered_minicheck",
        "split": "test",
        "metrics": evaluate_with_abstention(rows),
        "per_dataset": per_dataset_breakdown(rows),
        "cost": cost_summary(rows, "tiered_minicheck"),
    }
    OUT.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2))

    n_sig = sum(1 for r in rows if r["tier"] == "signals")
    m = summary["metrics"]["decided"]
    mean_ms = summary["cost"]["ms_per_claim_mean"]
    print(f"tiered_minicheck: bacc={m['balanced_accuracy']:.3f} "
          f"prec={m['precision']:.3f} FAR={m['false_accept_rate']:.3f} "
          f"FRR={m['false_reject_rate']:.3f}")
    print(f"tier split: signals={n_sig} ({n_sig/len(rows):.1%}), "
          f"minicheck={len(rows)-n_sig}")
    print(f"cost: {mean_ms:.1f} ms/claim mean")


if __name__ == "__main__":
    main()
