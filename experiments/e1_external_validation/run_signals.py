"""Stage 1 deterministic signals only. Zero model calls.

Decision rule: pipeline returns SUPPORTED/UNSUPPORTED -> decided;
UNVERIFIABLE (REVISE/ABSTAIN gate outcomes) -> abstain.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))  # repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))         # experiments/

from harness import standard_args, run_and_save  # noqa: E402
from truthlayer import TruthLayerPipeline  # noqa: E402

pipeline = TruthLayerPipeline()


def predict(pair):
    t0 = time.perf_counter()
    result = pipeline.verify(pair.claim, pair.evidence)
    latency_ms = (time.perf_counter() - t0) * 1000

    decided = result.status in ("SUPPORTED", "UNSUPPORTED")
    top_signal = None
    if result.signals:
        contradicts = [s for s in result.signals if s.verdict == "CONTRADICT"]
        top = max(contradicts or result.signals, key=lambda s: s.score)
        top_signal = top.name

    return {
        "pred": 1 if result.status == "SUPPORTED" else 0,
        "score": result.confidence,
        "decided": decided,
        "signal": top_signal,
        "latency_ms": latency_ms,
    }


if __name__ == "__main__":
    args = standard_args("signals")
    run_and_save("signals", args, predict)
