"""Grade E2 generations with MiniCheck (run after run_e2.py).

Separate process so the judge model doesn't fight the generator for
memory.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from truthlayer.text import split_sentences  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"

REFUSAL_MARKERS = ("i cannot", "i can't", "i'm unable", "is there anything else")


def claims_of(answer: str) -> list[str]:
    sentences = split_sentences(answer)
    if not sentences and answer.strip():
        sentences = [answer.strip()]
    return [s for s in sentences
            if not any(m in s.lower() for m in REFUSAL_MARKERS)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default=str(RESULTS / "e2_vag.jsonl"))
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(args.inp)]

    from minicheck.minicheck import MiniCheck
    scorer = MiniCheck(model_name="flan-t5-large", enable_prefix_caching=False)

    def grade(doc: str, answer: str) -> tuple[int, int]:
        claims = claims_of(answer)
        if not claims:
            return 0, 0
        preds, _, _, _ = scorer.score(docs=[doc[:10000]] * len(claims), claims=claims)
        return sum(1 for p in preds if p == 0), len(claims)

    raw_bad = raw_total = vag_bad = vag_total = 0
    graded = []
    for i, row in enumerate(rows):
        rb, rt = grade(row["doc"], row["raw_answer"])
        vb, vt = grade(row["doc"], row["vag_answer"])
        raw_bad += rb; raw_total += rt
        vag_bad += vb; vag_total += vt
        graded.append({**row, "raw_unsupported": rb, "raw_claims": rt,
                       "vag_unsupported": vb, "vag_claims": vt})
        if (i + 1) % 10 == 0:
            print(f"graded {i + 1}/{len(rows)}")

    out_path = Path(args.inp)
    with open(out_path, "w") as f:
        for row in graded:
            f.write(json.dumps(row) + "\n")

    summary = {
        "n_docs": len(rows),
        "raw": {
            "claims": raw_total,
            "unsupported": raw_bad,
            "hallucination_rate": raw_bad / raw_total if raw_total else 0.0,
        },
        "vag": {
            "claims": vag_total,
            "unsupported": vag_bad,
            "hallucination_rate": vag_bad / vag_total if vag_total else 0.0,
            "regenerations": sum(r["vag_regenerations"] for r in rows),
            "blocked": sum(1 for r in rows if r["vag_blocked"]),
            "caught_by_verifier": sum(r["vag_n_unsupported_caught"] for r in rows),
        },
    }
    (out_path.with_suffix(".summary.json")).write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    r, v = summary["raw"]["hallucination_rate"], summary["vag"]["hallucination_rate"]
    if r > 0:
        print(f"\nHallucination rate: raw={r:.1%} -> vag={v:.1%} "
              f"({(r - v) / r:.0%} relative reduction)")


if __name__ == "__main__":
    main()
