"""MiniCheck baseline: MiniCheck-Flan-T5-Large, official scoring.

Uses the official `minicheck` package (pip install
"minicheck @ git+https://github.com/Liyan06/MiniCheck.git"). Their
default 0.5 threshold for the headline row; a dev-tuned threshold is
reported as a variant. We do NOT reimplement their prompt format — if
the package won't install, fix the install rather than improvising.
"""

from __future__ import annotations

import argparse
import gc
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import run_and_save, RESULTS  # noqa: E402
from common.data import load_aggrefact  # noqa: E402
from common.metrics import core_metrics  # noqa: E402

THRESHOLD_FILE = RESULTS / "minicheck_threshold.json"


def load_scorer():
    try:
        from minicheck.minicheck import MiniCheck
    except ImportError as e:
        raise SystemExit(
            "MiniCheck not installed. Run:\n"
            '  .venv/bin/pip install "minicheck @ git+https://github.com/Liyan06/MiniCheck.git"'
        ) from e
    return MiniCheck(model_name="flan-t5-large", enable_prefix_caching=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=str(RESULTS / "minicheck.jsonl"))
    ap.add_argument("--tune", action="store_true", help="tune threshold variant on dev")
    ap.add_argument("--tune-limit", type=int, default=0)
    args = ap.parse_args()

    scorer = load_scorer()

    if args.tune:
        pairs = load_aggrefact("dev", limit=args.tune_limit, snapshot=False)
        from tqdm import tqdm
        scores, labels = [], []
        for p in tqdm(pairs, desc="minicheck-dev-tune"):
            _, probs, _, _ = scorer.score(docs=[p.evidence], claims=[p.claim])
            scores.append(probs[0])
            labels.append(p.label)
        best_t, best_bacc = 0.5, 0.0
        for t in [i / 100 for i in range(5, 100, 5)]:
            preds = [1 if s >= t else 0 for s in scores]
            bacc = core_metrics(labels, preds)["balanced_accuracy"]
            if bacc > best_bacc:
                best_t, best_bacc = t, bacc
        THRESHOLD_FILE.write_text(json.dumps(
            {"threshold": best_t, "dev_balanced_accuracy": best_bacc, "n_dev": len(pairs)}, indent=2))
        print(f"Dev-tuned variant threshold={best_t} (dev BAcc={best_bacc:.3f})")
        return

    def predict(pair):
        t0 = time.perf_counter()
        doc = pair.evidence[:10000] if len(pair.evidence) > 10000 else pair.evidence
        _, probs, _, _ = scorer.score(docs=[doc], claims=[pair.claim])
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "pred": 1 if probs[0] >= 0.5 else 0,  # official default threshold
            "score": probs[0],
            "decided": True,
            "signal": None,
            "latency_ms": latency_ms,
        }

    run_and_save("minicheck", args, predict,
                 extra_manifest={"model": "lytang/MiniCheck-Flan-T5-Large", "threshold": 0.5})

    del scorer
    gc.collect()
    try:
        import torch
        torch.mps.empty_cache()
    except Exception:
        pass


if __name__ == "__main__":
    main()
