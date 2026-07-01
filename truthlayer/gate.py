from __future__ import annotations

from .graph import decide_from_graph
from .types import EvidenceGraph, GateDecision, GraphDecision


class AcceptanceGate:
    def decide(self, graph: EvidenceGraph) -> GraphDecision:
        return decide_from_graph(graph)

    def aggregate(self, decisions: list[GraphDecision]) -> GateDecision:
        if not decisions:
            return "ABSTAIN"
        if any(decision.decision == "REJECT" for decision in decisions):
            return "REJECT"
        unresolved = [decision for decision in decisions if decision.decision in {"ABSTAIN", "REVISE"}]
        if len(unresolved) / len(decisions) > 0.25:
            return "ABSTAIN"
        if all(decision.decision == "ACCEPT" for decision in decisions):
            return "ACCEPT"
        return "REVISE"
