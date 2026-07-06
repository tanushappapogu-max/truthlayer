"""Per-signal decided-case accuracy under the original 8-rule config.

Reconstructs the diagnostic that motivated removing the four net-negative
contradiction signals: run the full 8-rule engine on the test split and
attribute each decision to the signal that drove it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import RESULTS  # noqa: E402
from common.data import load_aggrefact  # noqa: E402
from truthlayer.signals import (  # noqa: E402
    ContrastContradictionSignal,
    DeterministicSignalEngine,
    EntitySubstitutionSignal,
    EvidenceCoverageSignal,
    HedgingMismatchSignal,
    LexicalOverlapSignal,
    NegationContradictionSignal,
    NumericContradictionSignal,
    SourceRetrievalSignal,
)
from truthlayer.graph import EvidenceGraphBuilder  # noqa: E402
from truthlayer import TruthLayerPipeline  # noqa: E402

ALL_8_RULES = (
    SourceRetrievalSignal(),
    LexicalOverlapSignal(),
    EvidenceCoverageSignal(),
    NumericContradictionSignal(),
    ContrastContradictionSignal(),
    NegationContradictionSignal(),
    EntitySubstitutionSignal(),
    HedgingMismatchSignal(),
)

KEPT = {"SOURCE_RETRIEVAL", "LEXICAL_OVERLAP", "EVIDENCE_COVERAGE"}


def main():
    pairs = load_aggrefact("test", limit=0)
    engine = DeterministicSignalEngine(rules=ALL_8_RULES)
    pipeline = TruthLayerPipeline(graph_builder=EvidenceGraphBuilder(signal_engine=engine))

    from tqdm import tqdm
    per_signal: dict[str, dict[str, int]] = {}
    for pair in tqdm(pairs, desc="8-rule-signals"):
        result = pipeline.verify(pair.claim, pair.evidence)
        if result.status not in ("SUPPORTED", "UNSUPPORTED"):
            continue
        contradicts = [s for s in result.signals if s.verdict == "CONTRADICT"]
        top = max(contradicts or result.signals, key=lambda s: s.score) if result.signals else None
        if top is None:
            continue
        pred = 1 if result.status == "SUPPORTED" else 0
        bucket = per_signal.setdefault(top.name, {"correct": 0, "total": 0})
        bucket["total"] += 1
        bucket["correct"] += int(pred == pair.label)

    out = {
        name: {
            **counts,
            "accuracy": counts["correct"] / counts["total"] if counts["total"] else 0.0,
            "kept": name in KEPT,
        }
        for name, counts in sorted(per_signal.items())
    }
    path = RESULTS / "signal_accuracy_8rule.json"
    path.write_text(json.dumps(out, indent=2))
    for name, v in sorted(out.items(), key=lambda kv: kv[1]["accuracy"]):
        flag = "KEPT" if v["kept"] else "REMOVED"
        print(f"{name:26s} acc={v['accuracy']:.3f} n={v['total']:5d}  [{flag}]")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
