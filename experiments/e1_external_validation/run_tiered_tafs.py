"""TruthLayer tiered pipeline: Stage 1 signals; escalate undecided to TAFS.

The headline system. Two tiers: deterministic signals for triage,
Token Alignment Faithfulness Scorer for semantic judgment. No API keys,
no fine-tuning — just pre-trained embeddings and heuristics.
Requires the TAFS threshold tuned on dev (run_tafs.py --tune) first.
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
from run_tafs import THRESHOLD_FILE  # noqa: E402
from truthlayer import TruthLayerPipeline  # noqa: E402
from truthlayer.embedding import score_alignment  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=str(RESULTS / "tiered_tafs.jsonl"))
    args = ap.parse_args()

    if not THRESHOLD_FILE.exists():
        raise SystemExit("No tuned TAFS threshold. Run: python run_tafs.py --tune")
    threshold = json.loads(THRESHOLD_FILE.read_text())["threshold"]

    pipeline = TruthLayerPipeline()

    def predict(pair):
        t0 = time.perf_counter()
        result = pipeline.verify(pair.claim, pair.evidence)

        if result.status in ("SUPPORTED", "UNSUPPORTED"):
            latency_ms = (time.perf_counter() - t0) * 1000
            contradicts = [s for s in result.signals if s.verdict == "CONTRADICT"]
            top = max(contradicts or result.signals, key=lambda s: s.score) if result.signals else None
            return {
                "pred": 1 if result.status == "SUPPORTED" else 0,
                "score": result.confidence,
                "decided": True,
                "tier": "signals",
                "signal": top.name if top else None,
                "latency_ms": latency_ms,
            }

        # Stage 1 abstained -> escalate to TAFS
        tafs_result = score_alignment(pair.claim, pair.evidence)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "pred": 1 if tafs_result["alignment_score"] >= threshold else 0,
            "score": tafs_result["alignment_score"],
            "decided": True,
            "tier": "tafs",
            "signal": None,
            "latency_ms": latency_ms,
        }

    summary = run_and_save("tiered_tafs", args, predict,
                           extra_manifest={"tafs_threshold": threshold})

    # tier split
    rows = [json.loads(l) for l in open(args.out)]
    n_sig = sum(1 for r in rows if r.get("tier") == "signals")
    print(f"tier split: signals={n_sig} ({n_sig/len(rows):.1%}), tafs={len(rows)-n_sig}")
    return summary


if __name__ == "__main__":
    main()
