from __future__ import annotations

try:
    import torch
    from transformers import LogitsProcessor
except ImportError:  # pragma: no cover - optional dependency path
    torch = None

    class LogitsProcessor:  # type: ignore[no-redef]
        pass


class TruthLayerRiskLogitsProcessor(LogitsProcessor):
    """Biases generation toward revision/abstention language when graph risk is high."""

    def __init__(
        self,
        risk: float,
        abstain_token_ids: list[int] | None = None,
        revise_token_ids: list[int] | None = None,
        boost: float = 2.0,
        risk_threshold: float = 0.62,
    ) -> None:
        self.risk = risk
        self.abstain_token_ids = abstain_token_ids or []
        self.revise_token_ids = revise_token_ids or []
        self.boost = boost
        self.risk_threshold = risk_threshold

    @classmethod
    def from_tokenizer(
        cls,
        tokenizer: object,
        risk: float,
        abstain_terms: tuple[str, ...] = (" cannot", " not", " unsupported"),
        revise_terms: tuple[str, ...] = (" evidence", " source", " revise"),
    ) -> "TruthLayerRiskLogitsProcessor":
        encode = getattr(tokenizer, "encode")
        abstain_ids = [ids[-1] for term in abstain_terms for ids in [encode(term, add_special_tokens=False)] if ids]
        revise_ids = [ids[-1] for term in revise_terms for ids in [encode(term, add_special_tokens=False)] if ids]
        return cls(risk=risk, abstain_token_ids=abstain_ids, revise_token_ids=revise_ids)

    def __call__(self, input_ids: "torch.LongTensor", scores: "torch.FloatTensor") -> "torch.FloatTensor":
        if torch is None:
            raise ImportError("TruthLayerRiskLogitsProcessor requires torch and transformers.")
        if self.risk < self.risk_threshold:
            return scores

        adjusted = scores.clone()
        scale = self.boost * min(1.0, max(0.0, self.risk))
        for token_id in self.abstain_token_ids:
            if 0 <= token_id < adjusted.shape[-1]:
                adjusted[:, token_id] += scale
        for token_id in self.revise_token_ids:
            if 0 <= token_id < adjusted.shape[-1]:
                adjusted[:, token_id] += scale * 0.6
        return adjusted
