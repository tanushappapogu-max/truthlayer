"""Build the headline + breakdown tables from the four summary JSONs."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import RESULTS  # noqa: E402
from common.tables import headline_table, breakdown_table  # noqa: E402

PAPER_RESULTS = Path(__file__).resolve().parent.parent.parent / "paper" / "results"
SYSTEMS = ["signals", "nli", "tafs", "tiered", "tiered_tafs",
           "minicheck", "tiered_minicheck"]


def main():
    summaries, breakdowns = [], {}
    for system in SYSTEMS:
        path = RESULTS / f"{system}.summary.json"
        if not path.exists():
            print(f"skip {system}: no summary at {path}")
            continue
        s = json.loads(path.read_text())
        m = s["metrics"]
        # abstaining systems: headline row uses decided-case metrics + coverage;
        # full-coverage systems: decided == all cases.
        d = m.get("decided", m["default_accept"])
        summaries.append({
            "system": system,
            "bacc": d["balanced_accuracy"],
            "bacc_ci95": d["bacc_ci95"],
            "far": d["false_accept_rate"],
            "frr": d["false_reject_rate"],
            "coverage": m["coverage"],
            "ms_per_claim": s["cost"]["ms_per_claim_mean"],
            "params": s["cost"]["param_invocations_per_claim"],
        })
        breakdowns[system] = s["per_dataset"]

    headline_table(summaries, RESULTS)
    breakdown_table(breakdowns, RESULTS)

    PAPER_RESULTS.mkdir(parents=True, exist_ok=True)
    for name in ("headline.tex", "breakdown.tex"):
        if (RESULTS / name).exists():
            shutil.copy(RESULTS / name, PAPER_RESULTS / name)

    print((RESULTS / "headline.md").read_text())


if __name__ == "__main__":
    main()
