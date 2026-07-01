"""Python-first TruthLayer verification engine."""

from .benchmark import BenchmarkRunner, BenchmarkSummary
from .gate import AcceptanceGate
from .graph import EvidenceGraphBuilder, decide_from_graph
from .pipeline import TruthLayerPipeline
from .types import (
    DetectorReport,
    DetectorSignal,
    EvidenceEdge,
    EvidenceGraph,
    EvidenceNode,
    EvidenceWindow,
    GateDecision,
    GraphDecision,
    VerificationResult,
    VerifyStatus,
)

__all__ = [
    "AcceptanceGate",
    "BenchmarkRunner",
    "BenchmarkSummary",
    "DetectorReport",
    "DetectorSignal",
    "EvidenceEdge",
    "EvidenceGraph",
    "EvidenceGraphBuilder",
    "EvidenceNode",
    "EvidenceWindow",
    "GateDecision",
    "GraphDecision",
    "TruthLayerPipeline",
    "VerificationResult",
    "VerifyStatus",
    "decide_from_graph",
]
