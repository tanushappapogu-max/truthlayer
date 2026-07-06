"""Verification-Augmented Generation (VAG).

Wraps a local LLM with the TruthLayer verification pipeline. Every
generated claim is checked against the source context before release;
answers containing unsupported claims are regenerated with feedback,
and claims that still fail are stripped from the final output.

Works with any Ollama-served model (default: llama3.2:3b).
"""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass, field

from .pipeline import TruthLayerPipeline
from .text import split_sentences
from .types import VerificationResult

OLLAMA_URL = "http://localhost:11434/api/generate"


@dataclass
class ClaimVerdict:
    claim: str
    status: str
    confidence: float
    reason: str


@dataclass
class VAGResult:
    question: str
    raw_answer: str
    final_answer: str
    verdicts: list[ClaimVerdict] = field(default_factory=list)
    regenerations: int = 0
    n_claims: int = 0
    n_supported: int = 0
    n_unsupported: int = 0
    n_unverifiable: int = 0
    blocked: bool = False


def ollama_generate(prompt: str, model: str = "llama3.2:3b",
                    temperature: float = 0.3, timeout: int = 120) -> str:
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }).encode()
    req = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())["response"].strip()


class VerificationAugmentedGenerator:
    """LLM + inline claim verification + regeneration loop."""

    def __init__(self, model: str = "llama3.2:3b", max_regenerations: int = 1,
                 pipeline: TruthLayerPipeline | None = None) -> None:
        self.model = model
        self.max_regenerations = max_regenerations
        self.pipeline = pipeline or TruthLayerPipeline()

    def _prompt(self, context: str, question: str, feedback: str = "") -> str:
        base = (
            "Answer the question using ONLY the information in the context. "
            "Do not add facts that are not in the context.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}\n"
        )
        if feedback:
            base += (
                "\nYour previous answer contained claims not supported by the "
                f"context:\n{feedback}\n"
                "Rewrite the answer using only supported information.\n"
            )
        return base + "\nAnswer:"

    def _verify_answer(self, answer: str, context: str) -> list[VerificationResult]:
        claims = split_sentences(answer)
        if not claims and answer.strip():
            claims = [answer.strip()]
        return [self.pipeline.verify(claim, context) for claim in claims]

    def generate(self, context: str, question: str) -> VAGResult:
        raw_answer = ollama_generate(self._prompt(context, question), self.model)
        answer = raw_answer
        regenerations = 0
        results = self._verify_answer(answer, context)

        while regenerations < self.max_regenerations:
            failing = [r for r in results if r.status == "UNSUPPORTED"]
            if not failing:
                break
            feedback = "\n".join(f"- {r.claim} ({r.reason})" for r in failing[:5])
            answer = ollama_generate(
                self._prompt(context, question, feedback), self.model
            )
            regenerations += 1
            results = self._verify_answer(answer, context)

        # Final gate: strip any claims that still fail verification.
        kept = [r for r in results if r.status != "UNSUPPORTED"]
        final_answer = " ".join(r.claim for r in kept).strip()
        blocked = not final_answer

        verdicts = [
            ClaimVerdict(r.claim, r.status, r.confidence, r.reason) for r in results
        ]
        return VAGResult(
            question=question,
            raw_answer=raw_answer,
            final_answer=final_answer if not blocked else "",
            verdicts=verdicts,
            regenerations=regenerations,
            n_claims=len(results),
            n_supported=sum(1 for r in results if r.status == "SUPPORTED"),
            n_unsupported=sum(1 for r in results if r.status == "UNSUPPORTED"),
            n_unverifiable=sum(1 for r in results if r.status == "UNVERIFIABLE"),
            blocked=blocked,
        )
