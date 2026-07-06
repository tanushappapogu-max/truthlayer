"""Kill test for Decompose-and-Ground on the same escalated dev cases
used by eval_roundtrip.py (ids are read from rtf_dev.jsonl so both
candidates face identical cases). Kill criterion: < 0.70 best BAcc.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.data import load_aggrefact  # noqa: E402
from common.metrics import core_metrics  # noqa: E402
from truthlayer.decompose import score_decompose  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(RESULTS / "dag_dev.jsonl"))
    args = ap.parse_args()

    ids = [json.loads(l)["id"] for l in open(RESULTS / "rtf_dev.jsonl")]
    pairs = {p.id: p for p in load_aggrefact("dev", limit=0, snapshot=False)}
    cases = [pairs[i] for i in ids if i in pairs]
    print(f"{len(cases)} escalated dev cases (same as RTF eval)")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    from tqdm import tqdm
    rows = []
    with open(out_path, "w") as f:
        for pair in tqdm(cases, desc="dag-dev"):
            t0 = time.perf_counter()
            try:
                r = score_decompose(pair.claim, pair.evidence)
            except Exception as e:
                r = {"dag_score": 0.5, "n_atoms": 0, "min_entailment": 0.5,
                     "mean_entailment": 0.5, "max_contradiction": 0.0,
                     "atoms": [], "error": str(e)}
            row = {
                "id": pair.id,
                "dataset": pair.dataset,
                "label": pair.label,
                "score": r["dag_score"],
                "n_atoms": r["n_atoms"],
                "min_entailment": r["min_entailment"],
                "max_contradiction": r["max_contradiction"],
                "latency_ms": (time.perf_counter() - t0) * 1000,
            }
            rows.append(row)
            f.write(json.dumps(row) + "\n")
            f.flush()

    labels = [r["label"] for r in rows]
    scores = [r["score"] for r in rows]
    best_t, best_bacc = 0.5, 0.0
    for t in [i / 100 for i in range(2, 99)]:
        preds = [1 if s >= t else 0 for s in scores]
        bacc = core_metrics(labels, preds)["balanced_accuracy"]
        if bacc > best_bacc:
            best_t, best_bacc = t, bacc

    mean_ms = sum(r["latency_ms"] for r in rows) / len(rows)
    summary = {"n": len(rows), "best_threshold": best_t,
               "best_bacc": best_bacc, "ms_per_claim": mean_ms,
               "bar_minicheck_escalated": 0.716}
    (out_path.with_suffix(".summary.json")).write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    verdict = "SURVIVES" if best_bacc >= 0.70 else "KILLED"
    print(f"\n=== {verdict}: DAG dev BAcc {best_bacc:.3f} vs kill line 0.70 ===")


if __name__ == "__main__":
    main()
