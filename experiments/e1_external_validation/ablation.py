"""Leave-one-signal-out ablation for the signals-only system on AggreFact test.

For each deterministic signal rule, remove it, recompute signals-only
metrics, and report marginal contribution (delta coverage, delta precision).
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import RESULTS  # noqa: E402
from common.data import load_aggrefact  # noqa: E402
from common.metrics import evaluate_with_abstention  # noqa: E402
from truthlayer.signals import DEFAULT_SIGNAL_RULES, DeterministicSignalEngine  # noqa: E402
from truthlayer.graph import EvidenceGraphBuilder  # noqa: E402
from truthlayer import TruthLayerPipeline  # noqa: E402


def run_variant(pairs, engine) -> dict:
    pipeline = TruthLayerPipeline(graph_builder=EvidenceGraphBuilder(signal_engine=engine))
    rows = []
    for pair in pairs:
        result = pipeline.verify(pair.claim, pair.evidence)
        rows.append({
            "label": pair.label,
            "dataset": pair.dataset,
            "pred": 1 if result.status == "SUPPORTED" else 0,
            "decided": result.status in ("SUPPORTED", "UNSUPPORTED"),
        })
    return evaluate_with_abstention(rows)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    pairs = load_aggrefact("test", limit=args.limit)

    t0 = time.perf_counter()
    full = run_variant(pairs, DeterministicSignalEngine())
    print(f"full: coverage={full['coverage']:.3f} "
          f"prec={full.get('decided', {}).get('precision', 0):.3f} "
          f"({time.perf_counter()-t0:.0f}s)")

    results = {"full": full, "leave_one_out": {}}
    for rule in DEFAULT_SIGNAL_RULES:
        name = getattr(rule, "name", type(rule).__name__)
        reduced = tuple(r for r in DEFAULT_SIGNAL_RULES if r is not rule)
        variant = run_variant(pairs, DeterministicSignalEngine(rules=reduced))
        results["leave_one_out"][name] = variant
        d_cov = variant["coverage"] - full["coverage"]
        d_prec = (variant.get("decided", {}).get("precision", 0)
                  - full.get("decided", {}).get("precision", 0))
        print(f"-{name}: delta_coverage={d_cov:+.3f} delta_precision={d_prec:+.3f}")

    out = RESULTS / "ablation.json"
    out.write_text(json.dumps(results, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
