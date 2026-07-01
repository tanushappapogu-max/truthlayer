"""Compatibility exports for the LLaMA adapter package.

The actual graph implementation now lives in the Python-first `truthlayer`
package. This module keeps existing imports stable.
"""

from truthlayer.graph import EvidenceGraphBuilder, decide_from_graph
from truthlayer.types import EvidenceEdge, EvidenceGraph, EvidenceNode, GraphDecision

__all__ = [
    "EvidenceEdge",
    "EvidenceGraph",
    "EvidenceGraphBuilder",
    "EvidenceNode",
    "GraphDecision",
    "decide_from_graph",
]
