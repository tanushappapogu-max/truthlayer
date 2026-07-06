from __future__ import annotations

import math
import re

from .evidence import EvidenceSelector
from .signals import DeterministicSignalEngine
from .text import clip, extract_entities, extract_numbers, extract_relations, normalize_for_match, token_coverage
from .types import DetectorReport, EdgeKind, EvidenceEdge, EvidenceGraph, EvidenceNode, GateDecision, GraphDecision, NodeKind


def node_id(kind: NodeKind, label: str, index: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:32]
    return f"{kind}:{slug or index}"


class EvidenceGraphBuilder:
    def __init__(
        self,
        evidence_selector: EvidenceSelector | None = None,
        signal_engine: DeterministicSignalEngine | None = None,
    ) -> None:
        self.evidence_selector = evidence_selector or EvidenceSelector()
        self.signal_engine = signal_engine or DeterministicSignalEngine()

    def build(self, claim: str, evidence: str, source_id: str = "source:0") -> EvidenceGraph:
        windows = self.evidence_selector.select(claim, evidence)
        report = self.signal_engine.run(claim, evidence, windows)
        graph = EvidenceGraph(
            claim=claim,
            source_id=source_id,
            coverage=report.evidence_coverage,
            support_score=report.support_score,
            contradiction_score=report.contradiction_score,
            report=report,
        )

        self._add_node(graph, EvidenceNode("claim:0", "claim", clip(claim), report.support_score))
        self._add_node(graph, EvidenceNode("source:0", "source", source_id, 1.0))
        self._add_edge(graph, EvidenceEdge("claim:0", "source:0", "cites", 1.0, "cites"))

        for index, window in enumerate(windows):
            evidence_id = f"evidence:{index}"
            self._add_node(graph, EvidenceNode(evidence_id, "evidence", f"Evidence window {index + 1}", window.coverage, window.text))
            self._add_edge(graph, EvidenceEdge("source:0", evidence_id, "contains", window.overlap, f"{window.coverage:.0%} coverage"))
            self._add_edge(graph, EvidenceEdge(evidence_id, "claim:0", "grounds" if window.coverage >= 0.62 else "routes", window.coverage, "grounds claim"))

        primary = windows[0].text if windows else evidence[:900]
        self._add_entity_nodes(graph, claim, evidence)
        self._add_quantity_nodes(graph, claim, evidence)
        self._add_relation_nodes(graph, claim, primary)
        self._add_signal_nodes(graph, report)
        self._score_graph(graph)
        return graph

    def _add_entity_nodes(self, graph: EvidenceGraph, claim: str, evidence: str) -> None:
        evidence_norm = normalize_for_match(evidence)
        for index, entity in enumerate(extract_entities(claim)):
            entity_id = node_id("entity", entity, index)
            found = normalize_for_match(entity) in evidence_norm
            self._add_node(graph, EvidenceNode(entity_id, "entity", entity, 1.0 if found else 0.25))
            self._add_edge(graph, EvidenceEdge("claim:0", entity_id, "mentions", 0.9, "mentions"))
            self._add_edge(
                graph,
                EvidenceEdge(entity_id, "evidence:0", "grounds" if found else "attenuates", 0.9 if found else 0.35, "entity match" if found else "entity missing"),
            )

    def _add_quantity_nodes(self, graph: EvidenceGraph, claim: str, evidence: str) -> None:
        evidence_numbers = set(extract_numbers(evidence))
        for index, number in enumerate(extract_numbers(claim)):
            quantity_id = node_id("quantity", number, index)
            found = number in evidence_numbers
            self._add_node(graph, EvidenceNode(quantity_id, "quantity", number, 1.0 if found else 0.2))
            self._add_edge(graph, EvidenceEdge("claim:0", quantity_id, "mentions", 0.9, "uses number"))
            self._add_edge(
                graph,
                EvidenceEdge(quantity_id, "evidence:0", "grounds" if found else "contradicts", 0.9 if found else 0.78, "number match" if found else "number missing"),
            )

    def _add_relation_nodes(self, graph: EvidenceGraph, claim: str, evidence: str) -> None:
        for index, relation in enumerate(extract_relations(claim)):
            relation_id = node_id("relation", relation, index)
            score = token_coverage(relation, evidence)
            self._add_node(graph, EvidenceNode(relation_id, "relation", clip(relation, 90), score))
            self._add_edge(graph, EvidenceEdge("claim:0", relation_id, "mentions", 0.8, "relation"))
            self._add_edge(graph, EvidenceEdge(relation_id, "evidence:0", "grounds" if score >= 0.7 else "routes", score, "relation evidence"))

    def _add_signal_nodes(self, graph: EvidenceGraph, report: DetectorReport) -> None:
        for index, signal in enumerate(report.signals):
            if signal.verdict == "NEUTRAL":
                continue
            signal_id = f"signal:{signal.name.lower()}:{index}"
            edge_kind: EdgeKind = "routes"
            if signal.verdict == "SUPPORT":
                edge_kind = "supports"
            elif signal.verdict == "CONTRADICT":
                edge_kind = "contradicts"
            elif signal.verdict == "INSUFFICIENT":
                edge_kind = "attenuates"
            self._add_node(graph, EvidenceNode(signal_id, "signal", signal.label, signal.score, signal.rationale))
            self._add_edge(graph, EvidenceEdge(signal_id, "claim:0", edge_kind, signal.score * signal.weight, signal.verdict.lower()))

    def _score_graph(self, graph: EvidenceGraph) -> None:
        support_mass = 0.0
        support_weight = 0.0
        contradiction = graph.contradiction_score
        for edge in graph.edges:
            if edge.kind in {"supports", "grounds"}:
                support_mass += edge.weight
                support_weight += 1.0
            elif edge.kind == "contradicts":
                contradiction = max(contradiction, edge.weight)
            elif edge.kind == "attenuates":
                contradiction = max(contradiction, edge.weight * 0.45)
        graph.support_score = max(graph.support_score, support_mass / max(support_weight, 1.0))
        graph.contradiction_score = min(1.0, contradiction)
        self._add_node(graph, EvidenceNode("gate:0", "gate", "Gate", graph.support_score, f"risk={graph.contradiction_score:.2f}"))
        self._add_edge(graph, EvidenceEdge("claim:0", "gate:0", "routes", graph.support_score, "release control"))

    @staticmethod
    def _add_node(graph: EvidenceGraph, node: EvidenceNode) -> None:
        if not any(existing.id == node.id for existing in graph.nodes):
            graph.nodes.append(node)

    @staticmethod
    def _add_edge(graph: EvidenceGraph, edge: EvidenceEdge) -> None:
        if not math.isnan(edge.weight):
            graph.edges.append(edge)


def decide_from_graph(graph: EvidenceGraph) -> GraphDecision:
    risk = min(1.0, graph.contradiction_score + max(0.0, 0.55 - graph.coverage) * 0.3)
    if graph.contradiction_score >= 0.78:
        return GraphDecision("REJECT", graph.support_score, risk, "High-confidence contradiction edge reached the gate.")
    if graph.coverage < 0.18:
        return GraphDecision("ABSTAIN", graph.support_score, risk, "Evidence graph does not cover enough of the claim.")
    if graph.support_score >= 0.78 and graph.coverage >= 0.74 and graph.contradiction_score < 0.25:
        return GraphDecision("ACCEPT", graph.support_score, risk, "Claim is grounded by the strongest evidence window.")
    return GraphDecision("REVISE", graph.support_score, risk, "Evidence is partial or mixed; regenerate with stricter grounding.")
