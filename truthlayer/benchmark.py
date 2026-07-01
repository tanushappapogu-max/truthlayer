from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any

from .pipeline import TruthLayerPipeline


@dataclass(frozen=True)
class BenchmarkSummary:
    cases: int
    supported: int
    unsupported: int
    accepted_supported: int
    accepted_unsupported: int
    rejected_supported: int
    rejected_unsupported: int
    revised_or_abstained_supported: int
    revised_or_abstained_unsupported: int

    @property
    def false_accept_rate(self) -> float:
        return self.accepted_unsupported / max(self.unsupported, 1)

    @property
    def false_reject_rate(self) -> float:
        return self.rejected_supported / max(self.supported, 1)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["false_accept_rate"] = self.false_accept_rate
        data["false_reject_rate"] = self.false_reject_rate
        return data


class BenchmarkRunner:
    def __init__(self, pipeline: TruthLayerPipeline | None = None) -> None:
        self.pipeline = pipeline or TruthLayerPipeline()

    def load_cases(self, path: Path) -> list[dict[str, Any]]:
        return json.loads(path.read_text(encoding="utf-8"))

    def run(self, cases: list[dict[str, Any]], limit: int = 0) -> BenchmarkSummary:
        if limit > 0:
            cases = cases[:limit]

        accepted_supported = accepted_unsupported = 0
        rejected_supported = rejected_unsupported = 0
        routed_supported = routed_unsupported = 0
        supported = sum(1 for case in cases if case["expected"] == "SUPPORTED")
        unsupported = sum(1 for case in cases if case["expected"] == "UNSUPPORTED")

        for case in cases:
            result = self.pipeline.verify(case["claim"], case["evidence"], source_id=case.get("url", "benchmark-source"))
            expected = case["expected"]
            if expected == "SUPPORTED" and result.decision == "ACCEPT":
                accepted_supported += 1
            elif expected == "UNSUPPORTED" and result.decision == "ACCEPT":
                accepted_unsupported += 1
            elif expected == "SUPPORTED" and result.decision == "REJECT":
                rejected_supported += 1
            elif expected == "UNSUPPORTED" and result.decision == "REJECT":
                rejected_unsupported += 1
            elif expected == "SUPPORTED":
                routed_supported += 1
            else:
                routed_unsupported += 1

        return BenchmarkSummary(
            cases=len(cases),
            supported=supported,
            unsupported=unsupported,
            accepted_supported=accepted_supported,
            accepted_unsupported=accepted_unsupported,
            rejected_supported=rejected_supported,
            rejected_unsupported=rejected_unsupported,
            revised_or_abstained_supported=routed_supported,
            revised_or_abstained_unsupported=routed_unsupported,
        )
