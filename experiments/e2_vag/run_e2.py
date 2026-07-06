"""E2: Does Verification-Augmented Generation reduce hallucination?

Setup: sample documents from the E1 snapshot, ask a local Llama
(llama3.2:3b via Ollama) to summarize each one. Two conditions:

  raw  — Llama's answer, released as-is
  vag  — same model wrapped in the TruthLayer verification loop
         (verify each claim, regenerate on failure, strip claims
         that still fail)

Every output claim in both conditions is graded against the source
document by MiniCheck-Flan-T5-Large (the external judge). The metric
is the fraction of released claims MiniCheck marks unsupported.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd  # noqa: E402

from truthlayer.text import split_sentences  # noqa: E402
from truthlayer.vag import VerificationAugmentedGenerator, ollama_generate  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"
SNAPSHOT = (Path(__file__).resolve().parent.parent
            / "e1_external_validation" / "results" / "data_snapshot.parquet")

QUESTION = "Summarize the key facts of this document in 2-3 sentences."

REFUSAL_MARKERS = ("i cannot", "i can't", "i'm unable", "is there anything else")


def claims_of(answer: str) -> list[str]:
    sentences = split_sentences(answer)
    if not sentences and answer.strip():
        sentences = [answer.strip()]
    return [s for s in sentences
            if not any(m in s.lower() for m in REFUSAL_MARKERS)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-docs", type=int, default=60)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--model", default="llama3.2:3b")
    ap.add_argument("--out", default=str(RESULTS / "e2_vag.jsonl"))
    ap.add_argument("--no-grade", action="store_true",
                    help="generation only; grade later with grade_e2.py")
    args = ap.parse_args()

    df = pd.read_parquet(SNAPSHOT)
    docs = (
        df[(df["doc"].str.len() > 500) & (df["doc"].str.len() < 3000)]
        .drop_duplicates(subset="doc")
        .sample(n=args.n_docs, random_state=args.seed)["doc"]
        .tolist()
    )

    vag = VerificationAugmentedGenerator(model=args.model)
    rows = []
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating raw + VAG answers for {len(docs)} docs...")
    with open(out_path, "w") as f:
        for i, doc in enumerate(docs):
            t0 = time.perf_counter()
            raw = ollama_generate(vag._prompt(doc, QUESTION), args.model)
            result = vag.generate(doc, QUESTION)
            row = {
                "doc_index": i,
                "doc": doc,
                "raw_answer": raw,
                "vag_answer": result.final_answer,
                "vag_regenerations": result.regenerations,
                "vag_blocked": result.blocked,
                "vag_n_unsupported_caught": result.n_unsupported,
                "latency_s": time.perf_counter() - t0,
            }
            rows.append(row)
            f.write(json.dumps(row) + "\n")
            if (i + 1) % 10 == 0:
                print(f"  {i + 1}/{len(docs)} done")

    if args.no_grade:
        print(f"Generation done -> {out_path}. Grade with grade_e2.py when ready.")
        return

    print("Grading all claims with MiniCheck...")
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
    for row in rows:
        rb, rt = grade(row["doc"], row["raw_answer"])
        vb, vt = grade(row["doc"], row["vag_answer"])
        raw_bad += rb; raw_total += rt
        vag_bad += vb; vag_total += vt
        graded.append({**row, "raw_unsupported": rb, "raw_claims": rt,
                       "vag_unsupported": vb, "vag_claims": vt})

    with open(out_path, "w") as f:
        for row in graded:
            f.write(json.dumps(row) + "\n")

    summary = {
        "n_docs": len(docs),
        "model": args.model,
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
