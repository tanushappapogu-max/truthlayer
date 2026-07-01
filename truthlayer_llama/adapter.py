from __future__ import annotations

import hashlib

from .evidence_graph import EvidenceGraph

try:
    import torch
    from torch import nn
except ImportError:  # pragma: no cover - optional dependency path
    torch = None
    nn = None


def _hash_bucket(text: str, buckets: int) -> int:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % buckets


def graph_to_feature_rows(graph: EvidenceGraph, feature_size: int = 64) -> list[list[float]]:
    kind_offsets = {
        "claim": 0,
        "source": 7,
        "evidence": 14,
        "entity": 21,
        "quantity": 28,
        "relation": 35,
        "signal": 42,
        "gate": 49,
    }
    rows: list[list[float]] = []
    for node in graph.nodes:
        row = [0.0 for _ in range(feature_size)]
        row[kind_offsets[node.kind] % feature_size] = 1.0
        row[_hash_bucket(node.label, feature_size)] += 0.5
        row[-3] = node.score
        row[-2] = graph.support_score
        row[-1] = graph.contradiction_score
        rows.append(row)
    return rows or [[0.0 for _ in range(feature_size)]]


if nn is not None:

    class GraphVerificationAdapter(nn.Module):
        """Tiny graph adapter that can be inserted next to a decoder hidden state.

        It is intentionally lightweight: node features are projected to the LLaMA
        hidden size, message-passed over the claim-evidence graph, pooled, and used
        as a residual gate over the decoder states.
        """

        def __init__(self, hidden_size: int, node_feature_size: int = 64, message_steps: int = 2) -> None:
            super().__init__()
            self.hidden_size = hidden_size
            self.node_feature_size = node_feature_size
            self.message_steps = message_steps
            self.node_projection = nn.Sequential(
                nn.Linear(node_feature_size, hidden_size),
                nn.SiLU(),
                nn.LayerNorm(hidden_size),
            )
            self.message_projection = nn.Linear(hidden_size, hidden_size)
            self.gate_projection = nn.Linear(hidden_size, hidden_size)
            self.risk_head = nn.Linear(hidden_size, 1)

        def forward(
            self,
            hidden_states: "torch.Tensor",
            node_features: "torch.Tensor",
            edge_index: "torch.Tensor | None" = None,
            edge_weight: "torch.Tensor | None" = None,
        ) -> tuple["torch.Tensor", "torch.Tensor"]:
            if node_features.dim() == 2:
                node_features = node_features.unsqueeze(0).expand(hidden_states.shape[0], -1, -1)

            node_states = self.node_projection(node_features.to(hidden_states.dtype))
            for _ in range(self.message_steps):
                node_states = node_states + self._message_pass(node_states, edge_index, edge_weight)
                node_states = torch.nn.functional.layer_norm(node_states, (self.hidden_size,))

            graph_context = node_states.mean(dim=1)
            gate = torch.sigmoid(self.gate_projection(graph_context)).unsqueeze(1)
            adapted = hidden_states + gate * graph_context.unsqueeze(1)
            graph_risk = torch.sigmoid(self.risk_head(graph_context)).squeeze(-1)
            return adapted, graph_risk

        def _message_pass(
            self,
            node_states: "torch.Tensor",
            edge_index: "torch.Tensor | None",
            edge_weight: "torch.Tensor | None",
        ) -> "torch.Tensor":
            if edge_index is None or edge_index.numel() == 0:
                return self.message_projection(node_states.mean(dim=1, keepdim=True)).expand_as(node_states)

            batch, nodes, hidden = node_states.shape
            messages = torch.zeros((batch, nodes, hidden), dtype=node_states.dtype, device=node_states.device)
            weights = edge_weight
            if weights is None:
                weights = torch.ones(edge_index.shape[1], dtype=node_states.dtype, device=node_states.device)
            for edge_pos in range(edge_index.shape[1]):
                src = int(edge_index[0, edge_pos])
                dst = int(edge_index[1, edge_pos])
                if src >= nodes or dst >= nodes:
                    continue
                messages[:, dst, :] += node_states[:, src, :] * weights[edge_pos].to(node_states.dtype)
            return self.message_projection(messages)

        @staticmethod
        def features_from_graph(graph: EvidenceGraph, device: "torch.device | str | None" = None) -> "torch.Tensor":
            return torch.tensor(graph_to_feature_rows(graph), dtype=torch.float32, device=device)

        @staticmethod
        def edge_index_from_graph(graph: EvidenceGraph, device: "torch.device | str | None" = None) -> tuple["torch.Tensor", "torch.Tensor"]:
            node_positions = {node.id: index for index, node in enumerate(graph.nodes)}
            pairs: list[tuple[int, int]] = []
            weights: list[float] = []
            for edge in graph.edges:
                if edge.source not in node_positions or edge.target not in node_positions:
                    continue
                pairs.append((node_positions[edge.source], node_positions[edge.target]))
                weights.append(edge.weight)
            if not pairs:
                return (
                    torch.empty((2, 0), dtype=torch.long, device=device),
                    torch.empty((0,), dtype=torch.float32, device=device),
                )
            return (
                torch.tensor(pairs, dtype=torch.long, device=device).t().contiguous(),
                torch.tensor(weights, dtype=torch.float32, device=device),
            )

else:

    class GraphVerificationAdapter:  # pragma: no cover - optional dependency path
        def __init__(self, *args: object, **kwargs: object) -> None:
            raise ImportError("GraphVerificationAdapter requires PyTorch. Install torch to use the LLaMA adapter.")
