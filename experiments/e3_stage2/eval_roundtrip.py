"""Kill test for Round-Trip Faithfulness on escalated dev cases.

Runs the signals pipeline over the dev split, takes the first N cases
where Stage 1 abstains, scores each with RTF, and reports the best-
threshold balanced accuracy. Bar to approach: MiniCheck's 0.716 on
escalated test cases. Kill criterion: < 0.70 optimistic-bound BAcc.
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
from truthlayer import TruthLayerPipeline  # noqa: E402
from truthlayer.roundtrip import score_roundtrip  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    ap.add_argument("--out", default=str(RESULTS / "rtf_dev.jsonl"))
    args = ap.parse_args()

    pairs = load_aggrefact("dev", limit=0, snapshot=False)
    pipeline = TruthLayerPipeline()

    escalated = []
    for pair in pairs:
        result = pipeline.verify(pair.claim, pair.evidence)
        if result.status not in ("SUPPORTED", "UNSUPPORTED"):
            escalated.append(pair)
        if len(escalated) >= args.n:
            break
    print(f"collected {len(escalated)} escalated dev cases")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    from tqdm import tqdm
    rows = []
    with open(out_path, "w") as f:
        for pair in tqdm(escalated, desc="rtf-dev"):
            t0 = time.perf_counter()
            try:
                r = score_roundtrip(pair.claim, pair.evidence)
            except Exception as e:
                r = {"rtf_score": 0.5, "rewrite": f"ERROR: {e}",
                     "entailment": 0.5, "contradiction": 0.0, "numeric_match": 1.0}
            row = {
                "id": pair.id,
                "dataset": pair.dataset,
                "label": pair.label,
                "score": r["rtf_score"],
                "entailment": r["entailment"],
                "contradiction": r["contradiction"],
                "numeric_match": r["numeric_match"],
                "rewrite": r["rewrite"][:200],
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
    print(f"\n=== {verdict}: RTF dev BAcc {best_bacc:.3f} vs kill line 0.70 "
          f"(MiniCheck escalated: 0.716) ===")


if __name__ == "__main__":
    main()
