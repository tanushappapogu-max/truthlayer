"""TruthLayer tiered pipeline: Stage 1 signals; escalate undecided to NLI.

The headline system. Two tiers only (no LLM judge) so cost accounting is
clean and no API keys are needed. Records which tier decided each case.
Requires the NLI threshold tuned on dev (run_nli.py --tune) first.
"""

from __future__ import annotations

import argparse
import gc
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import run_and_save, RESULTS  # noqa: E402
from run_nli import load_model, score_pair, THRESHOLD_FILE  # noqa: E402
from truthlayer import TruthLayerPipeline  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=str(RESULTS / "tiered.jsonl"))
    args = ap.parse_args()

    if not THRESHOLD_FILE.exists():
        raise SystemExit("No tuned NLI threshold. Run: python run_nli.py --tune")
    threshold = json.loads(THRESHOLD_FILE.read_text())["threshold"]

    pipeline = TruthLayerPipeline()
    tok, model, device = load_model()

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

        # Stage 1 abstained -> escalate to NLI
        s = score_pair(tok, model, device, pair.claim, pair.evidence)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "pred": 1 if s["entailment"] >= threshold else 0,
            "score": s["entailment"],
            "decided": True,
            "tier": "nli",
            "signal": None,
            "latency_ms": latency_ms,
        }

    summary = run_and_save("tiered", args, predict,
                           extra_manifest={"nli_threshold": threshold})

    # tier split
    rows = [json.loads(l) for l in open(args.out)]
    n_sig = sum(1 for r in rows if r.get("tier") == "signals")
    print(f"tier split: signals={n_sig} ({n_sig/len(rows):.1%}), nli={len(rows)-n_sig}")

    del model
    gc.collect()
    try:
        import torch
        torch.mps.empty_cache()
    except Exception:
        pass
    return summary


if __name__ == "__main__":
    main()
