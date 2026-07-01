from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

VerifyStatus = Literal["SUPPORTED", "UNSUPPORTED", "UNVERIFIABLE", "UNREACHABLE"]
GateDecision = Literal["ACCEPT", "REVISE", "REJECT", "ABSTAIN"]
DetectorVerdict = Literal["SUPPORT", "CONTRADICT", "INSUFFICIENT", "NEUTRAL"]
NodeKind = Literal["claim", "source", "evidence", "entity", "quantity", "relation", "signal", "gate"]
EdgeKind = Literal["cites", "contains", "mentions", "grounds", "supports", "contradicts", "routes", "attenuates"]


@dataclass(frozen=True)
class EvidenceWindow:
    text: str
    overlap: float
    coverage: float
    position: int


@dataclass(frozen=True)
class DetectorSignal:
    name: str
    label: str
    verdict: DetectorVerdict
    score: float
    weight: float
    rationale: str
    evidence: str = ""


@dataclass(frozen=True)
class DetectorReport:
    signals: list[DetectorSignal]
    evidence_windows: list[EvidenceWindow]
    support_score: float
    contradiction_score: float
    evidence_coverage: float


@dataclass(frozen=True)
class EvidenceNode:
    id: str
    kind: NodeKind
    label: str
    score: float = 0.0
    detail: str = ""


@dataclass(frozen=True)
class EvidenceEdge:
    source: str
    target: str
    kind: EdgeKind
    weight: float
    label: str = ""


@dataclass
class EvidenceGraph:
    claim: str
    source_id: str
    nodes: list[EvidenceNode] = field(default_factory=list)
    edges: list[EvidenceEdge] = field(default_factory=list)
    support_score: float = 0.0
    contradiction_score: float = 0.0
    coverage: float = 0.0
    report: DetectorReport | None = None


@dataclass(frozen=True)
class GraphDecision:
    decision: GateDecision
    support: float
    risk: float
    reason: str


@dataclass(frozen=True)
class VerificationResult:
    claim: str
    status: VerifyStatus
    decision: GateDecision
    confidence: float
    support_score: float
    contradiction_score: float
    evidence_coverage: float
    source_excerpt: str
    signals: list[DetectorSignal]
    graph: EvidenceGraph
    reason: str

    def to_dict(self) -> dict:
        return asdict(self)
