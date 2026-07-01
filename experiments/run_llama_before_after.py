#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from truthlayer_llama import TruthLayerLlama


def main() -> None:
    parser = argparse.ArgumentParser(description="Run vanilla LLaMA vs TruthLayer-gated LLaMA on one evidence-grounded prompt.")
    parser.add_argument("--model", required=True, help="Hugging Face model id, for example meta-llama/Llama-3.2-1B-Instruct")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--evidence", help="Evidence text. Use this or --evidence-file.")
    parser.add_argument("--evidence-file", type=Path)
    parser.add_argument("--source-id", default="retrieved-source")
    parser.add_argument("--max-new-tokens", type=int, default=160)
    parser.add_argument("--temperature", type=float, default=0.2)
    args = parser.parse_args()

    evidence = args.evidence
    if args.evidence_file:
        evidence = args.evidence_file.read_text(encoding="utf-8")
    if not evidence:
        raise SystemExit("Provide --evidence or --evidence-file.")

    model = TruthLayerLlama.from_pretrained(args.model, device_map="auto")
    baseline = model.generate_baseline(
        args.prompt,
        max_new_tokens=args.max_new_tokens,
        do_sample=args.temperature > 0,
        temperature=args.temperature,
    )
    verified = model.generate_verified(
        args.prompt,
        evidence=evidence,
        source_id=args.source_id,
        max_new_tokens=args.max_new_tokens,
        do_sample=args.temperature > 0,
        temperature=args.temperature,
    )

    print(json.dumps({
        "baseline": {"text": baseline.text},
        "truthlayer": {
            "text": verified.text,
            "revised": verified.revised,
            "decision": verified.decision.decision if verified.decision else None,
            "support": verified.decision.support if verified.decision else None,
            "risk": verified.decision.risk if verified.decision else None,
            "nodes": len(verified.graph.nodes) if verified.graph else 0,
            "edges": len(verified.graph.edges) if verified.graph else 0,
        },
    }, indent=2))


if __name__ == "__main__":
    main()
