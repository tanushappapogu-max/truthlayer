from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .evidence_graph import EvidenceGraph, EvidenceGraphBuilder, GraphDecision, decide_from_graph
from .logits_processor import TruthLayerRiskLogitsProcessor


@dataclass(frozen=True)
class GenerationResult:
    text: str
    graph: EvidenceGraph | None = None
    decision: GraphDecision | None = None
    revised: bool = False


class TruthLayerLlama:
    """A minimal before/after wrapper for Hugging Face LLaMA-family models."""

    def __init__(self, model: Any, tokenizer: Any, graph_builder: EvidenceGraphBuilder | None = None) -> None:
        self.model = model
        self.tokenizer = tokenizer
        self.graph_builder = graph_builder or EvidenceGraphBuilder()

    @classmethod
    def from_pretrained(cls, model_id: str, **kwargs: Any) -> "TruthLayerLlama":
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:  # pragma: no cover - optional dependency path
            raise ImportError("Install transformers and torch to load a LLaMA model.") from exc

        tokenizer = AutoTokenizer.from_pretrained(model_id, **kwargs.pop("tokenizer_kwargs", {}))
        model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
        return cls(model=model, tokenizer=tokenizer)

    def generate_baseline(self, prompt: str, **generate_kwargs: Any) -> GenerationResult:
        text = self._generate(prompt, **generate_kwargs)
        return GenerationResult(text=text)

    def generate_verified(
        self,
        prompt: str,
        evidence: str,
        source_id: str = "retrieved-source",
        **generate_kwargs: Any,
    ) -> GenerationResult:
        baseline = self.generate_baseline(prompt, **generate_kwargs)
        graph = self.graph_builder.build(baseline.text, evidence=evidence, source_id=source_id)
        decision = decide_from_graph(graph)

        if decision.decision == "ACCEPT":
            return GenerationResult(text=baseline.text, graph=graph, decision=decision, revised=False)

        repair_prompt = self._repair_prompt(prompt, baseline.text, evidence, decision)
        processor = TruthLayerRiskLogitsProcessor.from_tokenizer(self.tokenizer, risk=decision.risk)
        repaired = self._generate(repair_prompt, logits_processor=[processor], **generate_kwargs)
        repaired_graph = self.graph_builder.build(repaired, evidence=evidence, source_id=source_id)
        repaired_decision = decide_from_graph(repaired_graph)
        return GenerationResult(text=repaired, graph=repaired_graph, decision=repaired_decision, revised=True)

    def _generate(self, prompt: str, **generate_kwargs: Any) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt")
        device = getattr(self.model, "device", None)
        if device is not None:
            inputs = {key: value.to(device) for key, value in inputs.items()}
        output = self.model.generate(**inputs, **generate_kwargs)
        return self.tokenizer.decode(output[0][inputs["input_ids"].shape[-1] :], skip_special_tokens=True).strip()

    @staticmethod
    def _repair_prompt(prompt: str, draft: str, evidence: str, decision: GraphDecision) -> str:
        return f"""You are generating a cited answer, but a verification graph flagged the draft.

Original prompt:
{prompt}

Draft:
{draft}

Verification decision:
{decision.decision} - {decision.reason}

Use only the evidence below. If the evidence does not support the answer, say that the cited source does not support the claim.

Evidence:
{evidence}

Revised answer:"""
