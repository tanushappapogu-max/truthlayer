"""Shared runner harness: arg parsing, JSONL emission, manifest, summary."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.data import ClaimEvidencePair, load_aggrefact, dataset_hash  # noqa: E402
from common.metrics import evaluate_with_abstention, per_dataset_breakdown  # noqa: E402
from common.cost import cost_summary  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"


def standard_args(system: str) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=f"Run {system} on LLM-AggreFact")
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--limit", type=int, default=0, help="0 = full split")
    ap.add_argument("--out", default=str(RESULTS / f"{system}.jsonl"))
    return ap.parse_args()


def git_commit() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:
        return "unknown"


def run_and_save(system: str, args: argparse.Namespace,
                 predict_fn, extra_manifest: dict | None = None) -> dict:
    """predict_fn(pair) -> {pred, score, decided, signal?, tier?, latency_ms}"""
    pairs = load_aggrefact(args.split, limit=args.limit)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    with open(out_path, "w") as f:
        from tqdm import tqdm
        for pair in tqdm(pairs, desc=system):
            result = predict_fn(pair)
            row = {
                "id": pair.id,
                "dataset": pair.dataset,
                "label": pair.label,
                **result,
            }
            rows.append(row)
            f.write(json.dumps(row) + "\n")

    summary = {
        "system": system,
        "split": args.split,
        "metrics": evaluate_with_abstention(rows),
        "per_dataset": per_dataset_breakdown(rows),
        "cost": cost_summary(rows, system),
    }
    manifest = {
        "system": system,
        "split": args.split,
        "limit": args.limit,
        "git_commit": git_commit(),
        "dataset_hash": dataset_hash(pairs),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **(extra_manifest or {}),
    }
    (out_path.with_suffix(".summary.json")).write_text(json.dumps(summary, indent=2))
    (out_path.with_suffix(".manifest.json")).write_text(json.dumps(manifest, indent=2))

    m = summary["metrics"]
    print(f"\n=== {system} ({args.split}, n={m['n_total']}) ===")
    print(f"coverage: {m['coverage']:.1%}")
    if "decided" in m:
        d = m["decided"]
        print(f"decided:  bacc={d['balanced_accuracy']:.3f} prec={d['precision']:.3f} "
              f"rec={d['recall']:.3f} FAR={d['false_accept_rate']:.3f} FRR={d['false_reject_rate']:.3f}")
    da = m["default_accept"]
    print(f"all(acc): bacc={da['balanced_accuracy']:.3f} FAR={da['false_accept_rate']:.3f} "
          f"FRR={da['false_reject_rate']:.3f}")
    print(f"cost: {summary['cost']['ms_per_claim_mean']:.2f} ms/claim")
    return summary
