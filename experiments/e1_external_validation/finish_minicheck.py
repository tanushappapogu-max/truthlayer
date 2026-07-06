"""Resume-capable MiniCheck baseline runner.

Appends to results/minicheck.jsonl, skipping already-scored examples,
so crashes (OOM, hangs) only cost the current example. Writes the
harness-compatible summary + manifest when the split is complete.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import RESULTS, git_commit  # noqa: E402
from common.data import load_aggrefact, dataset_hash  # noqa: E402
from common.metrics import evaluate_with_abstention, per_dataset_breakdown  # noqa: E402
from common.cost import cost_summary  # noqa: E402

OUT = RESULTS / "minicheck.jsonl"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--flush-every", type=int, default=1)
    args = ap.parse_args()

    pairs = load_aggrefact(args.split, limit=0)
    done: set[str] = set()
    if OUT.exists():
        for line in open(OUT):
            try:
                done.add(json.loads(line)["id"])
            except (json.JSONDecodeError, KeyError):
                continue
    remaining = [p for p in pairs if p.id not in done]
    print(f"{len(done)} already scored, {len(remaining)} remaining")

    if remaining:
        from minicheck.minicheck import MiniCheck
        scorer = MiniCheck(model_name="flan-t5-large", enable_prefix_caching=False)

        from tqdm import tqdm
        with open(OUT, "a") as f:
            for pair in tqdm(remaining, desc="minicheck-resume"):
                doc = pair.evidence[:10000]
                t0 = time.perf_counter()
                _, probs, _, _ = scorer.score(docs=[doc], claims=[pair.claim])
                latency_ms = (time.perf_counter() - t0) * 1000
                row = {
                    "id": pair.id,
                    "dataset": pair.dataset,
                    "label": pair.label,
                    "pred": 1 if probs[0] >= 0.5 else 0,
                    "score": probs[0],
                    "decided": True,
                    "signal": None,
                    "latency_ms": latency_ms,
                }
                f.write(json.dumps(row) + "\n")
                f.flush()

    # Rebuild summary from the complete file
    rows = [json.loads(l) for l in open(OUT)]
    by_id = {r["id"]: r for r in rows}
    ordered = [by_id[p.id] for p in pairs if p.id in by_id]
    if len(ordered) != len(pairs):
        print(f"WARNING: only {len(ordered)}/{len(pairs)} scored; summary is partial")

    summary = {
        "system": "minicheck",
        "split": args.split,
        "metrics": evaluate_with_abstention(ordered),
        "per_dataset": per_dataset_breakdown(ordered),
        "cost": cost_summary(ordered, "minicheck"),
    }
    manifest = {
        "system": "minicheck",
        "split": args.split,
        "limit": 0,
        "git_commit": git_commit(),
        "dataset_hash": dataset_hash(pairs),
        "model": "lytang/MiniCheck-Flan-T5-Large",
        "threshold": 0.5,
        "doc_truncation_chars": 10000,
    }
    OUT.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2))
    OUT.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2))

    m = summary["metrics"]["decided"]
    print(f"minicheck ({len(ordered)} rows): bacc={m['balanced_accuracy']:.3f} "
          f"prec={m['precision']:.3f} FAR={m['false_accept_rate']:.3f} "
          f"FRR={m['false_reject_rate']:.3f}")


if __name__ == "__main__":
    main()
