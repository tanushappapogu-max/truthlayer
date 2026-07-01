#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from truthlayer import BenchmarkRunner


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline before/after eval using benchmark claim/evidence pairs.")
    parser.add_argument("--data", type=Path, default=Path("public/benchmark-data.json"))
    parser.add_argument("--limit", type=int, default=0, help="Optional case limit. 0 means all cases.")
    args = parser.parse_args()

    runner = BenchmarkRunner()
    cases = runner.load_cases(args.data)
    summary = runner.run(cases, limit=args.limit)
    print(json.dumps({
        "cases": summary.cases,
        "supported": summary.supported,
        "unsupported": summary.unsupported,
        "baseline": {
            "accepted_unsupported": summary.unsupported,
            "false_accept_rate": 1.0,
        },
        "truthlayer_graph_gate": {
            "accepted_unsupported": summary.accepted_unsupported,
            "accepted_supported": summary.accepted_supported,
            "rejected_unsupported": summary.rejected_unsupported,
            "abstained_or_revised_unsupported": summary.revised_or_abstained_unsupported,
            "abstained_or_revised_supported": summary.revised_or_abstained_supported,
            "false_rejects": summary.rejected_supported,
            "false_accept_rate": summary.false_accept_rate,
        },
    }, indent=2))


if __name__ == "__main__":
    main()
