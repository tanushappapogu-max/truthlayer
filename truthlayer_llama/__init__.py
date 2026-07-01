"""TruthLayer adapters for LLaMA-style Hugging Face models.

The package is intentionally optional. Importing it does not require PyTorch or
Transformers until a model wrapper or adapter is instantiated.
"""

from .evidence_graph import (
    EvidenceEdge,
    EvidenceGraph,
    EvidenceGraphBuilder,
    EvidenceNode,
    GraphDecision,
    decide_from_graph,
)
from .llama_wrapper import GenerationResult, TruthLayerLlama

__all__ = [
    "EvidenceEdge",
    "EvidenceGraph",
    "EvidenceGraphBuilder",
    "EvidenceNode",
    "GenerationResult",
    "GraphDecision",
    "TruthLayerLlama",
    "decide_from_graph",
]
