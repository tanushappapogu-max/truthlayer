from __future__ import annotations

from .gate import AcceptanceGate
from .graph import EvidenceGraphBuilder
from .types import VerificationResult, VerifyStatus


class TruthLayerPipeline:
    def __init__(self, graph_builder: EvidenceGraphBuilder | None = None, gate: AcceptanceGate | None = None) -> None:
        self.graph_builder = graph_builder or EvidenceGraphBuilder()
        self.gate = gate or AcceptanceGate()

    def verify(self, claim: str, evidence: str, source_id: str = "source:0") -> VerificationResult:
        graph = self.graph_builder.build(claim, evidence, source_id=source_id)
        decision = self.gate.decide(graph)
        status: VerifyStatus
        if decision.decision == "ACCEPT":
            status = "SUPPORTED"
        elif decision.decision == "REJECT":
            status = "UNSUPPORTED"
        else:
            status = "UNVERIFIABLE"

        report = graph.report
        source_excerpt = report.evidence_windows[0].text if report and report.evidence_windows else evidence[:240]
        confidence = max(decision.support, 1 - decision.risk if decision.decision == "ACCEPT" else decision.risk)
        return VerificationResult(
            claim=claim,
            status=status,
            decision=decision.decision,
            confidence=confidence,
            support_score=graph.support_score,
            contradiction_score=graph.contradiction_score,
            evidence_coverage=graph.coverage,
            source_excerpt=source_excerpt,
            signals=report.signals if report else [],
            graph=graph,
            reason=decision.reason,
        )
