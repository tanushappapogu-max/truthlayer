"""TAFS baseline: Token Alignment Faithfulness Scorer standalone.

Scores every claim with embedding alignment. Threshold tuned on dev
for balanced accuracy, then applied to test.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import run_and_save, RESULTS  # noqa: E402
from common.data import load_aggrefact  # noqa: E402
from common.metrics import core_metrics  # noqa: E402
from truthlayer.embedding import score_alignment  # noqa: E402

THRESHOLD_FILE = RESULTS / "tafs_threshold.json"


def tune_threshold(limit: int = 0) -> float:
    pairs = load_aggrefact("dev", limit=limit, snapshot=False)
    scores, labels = [], []
    from tqdm import tqdm
    for p in tqdm(pairs, desc="tafs-dev-tune"):
        result = score_alignment(p.claim, p.evidence)
        scores.append(result["alignment_score"])
        labels.append(p.label)

    best_t, best_bacc = 0.5, 0.0
    for t in [i / 100 for i in range(20, 90)]:
        preds = [1 if s >= t else 0 for s in scores]
        bacc = core_metrics(labels, preds)["balanced_accuracy"]
        if bacc > best_bacc:
            best_t, best_bacc = t, bacc

    THRESHOLD_FILE.parent.mkdir(parents=True, exist_ok=True)
    THRESHOLD_FILE.write_text(json.dumps(
        {"threshold": best_t, "dev_balanced_accuracy": best_bacc, "n_dev": len(pairs)},
        indent=2,
    ))
    print(f"Tuned threshold={best_t} (dev BAcc={best_bacc:.3f}) -> {THRESHOLD_FILE}")
    return best_t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=str(RESULTS / "tafs.jsonl"))
    ap.add_argument("--tune", action="store_true", help="tune threshold on dev and exit")
    ap.add_argument("--tune-limit", type=int, default=0)
    args = ap.parse_args()

    if args.tune:
        tune_threshold(limit=args.tune_limit)
        return

    if not THRESHOLD_FILE.exists():
        raise SystemExit("No tuned threshold. Run: python run_tafs.py --tune")
    threshold = json.loads(THRESHOLD_FILE.read_text())["threshold"]

    def predict(pair):
        t0 = time.perf_counter()
        result = score_alignment(pair.claim, pair.evidence)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "pred": 1 if result["alignment_score"] >= threshold else 0,
            "score": result["alignment_score"],
            "decided": True,
            "signal": None,
            "latency_ms": latency_ms,
        }

    run_and_save("tafs", args, predict,
                 extra_manifest={"model": "all-MiniLM-L6-v2", "threshold": threshold})


if __name__ == "__main__":
    main()
