"""Token Alignment Faithfulness Scorer (TAFS).

A training-free method that detects unfaithful paraphrases by measuring
per-token semantic alignment between claims and source documents. Each
claim token is matched to its best semantic counterpart in the source;
tokens with no good match are likely hallucinated or distorted.

Numbers and dates bypass embedding similarity (which can't distinguish
"32 million" from "28 million") and use exact string matching instead.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import torch

from .text import extract_numbers, normalize_for_match
from .types import DetectorSignal

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
SPECIAL_TOKENS = {"[CLS]", "[SEP]", "[PAD]", "[UNK]"}
FUNCTION_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "nor", "not", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "no", "only", "own", "same", "than", "too", "very", "just", "it",
    "its", "he", "she", "they", "them", "his", "her", "their", "this",
    "that", "these", "those", "which", "who", "whom", "what", "where",
    "when", "how", "if", "then", "there", "here",
}
NUMBER_RE = re.compile(r"^\d[\d,.]*%?$")


@lru_cache(maxsize=1)
def _load_model():
    from transformers import AutoModel, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).eval()
    return tokenizer, model


def _embed_tokens(text: str, max_length: int = 256) -> tuple[list[str], np.ndarray]:
    """Return (token_strings, embeddings) with shape [n_tokens, 384]."""
    tokenizer, model = _load_model()
    inputs = tokenizer(
        text, return_tensors="pt", truncation=True,
        max_length=max_length, padding=False,
    )
    with torch.no_grad():
        hidden = model(**inputs).last_hidden_state[0]
    tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
    embeddings = hidden.float().numpy()
    return tokens, embeddings


def _is_content_token(token: str) -> bool:
    """Filter out special tokens, subword prefixes, and function words."""
    if token in SPECIAL_TOKENS:
        return False
    clean = token.lstrip("▁").lower()
    if len(clean) <= 1:
        return False
    if clean in FUNCTION_WORDS:
        return False
    return True


def _is_numeric_token(token: str) -> bool:
    clean = token.lstrip("▁").strip()
    return bool(NUMBER_RE.match(clean))


def _cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Cosine similarity between every row of a and every row of b."""
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-8)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-8)
    return a_norm @ b_norm.T


def score_alignment(claim: str, source_text: str) -> dict:
    """Score faithfulness via token-level embedding alignment.

    Returns dict with: alignment_score, min_alignment, positional_coherence,
    numeric_match, token_details.
    """
    source_truncated = source_text[:5000]

    claim_tokens, claim_embeds = _embed_tokens(claim)
    source_tokens, source_embeds = _embed_tokens(source_truncated, max_length=256)

    content_indices = [i for i, t in enumerate(claim_tokens) if _is_content_token(t)]
    if not content_indices:
        return {
            "alignment_score": 0.5,
            "min_alignment": 0.5,
            "positional_coherence": 0.5,
            "numeric_match": 1.0,
            "n_content_tokens": 0,
            "n_unmatched": 0,
            "verdict": "NEUTRAL",
        }

    sim_matrix = _cosine_similarity_matrix(claim_embeds, source_embeds)

    alignments = []
    best_positions = []
    for i in content_indices:
        if _is_numeric_token(claim_tokens[i]):
            continue
        best_j = int(np.argmax(sim_matrix[i]))
        best_sim = float(sim_matrix[i, best_j])
        alignments.append(best_sim)
        best_positions.append(best_j)

    claim_numbers = extract_numbers(claim)
    source_norm = normalize_for_match(source_text)
    if claim_numbers:
        matched = sum(1 for n in claim_numbers if n in source_norm)
        numeric_match = matched / len(claim_numbers)
    else:
        numeric_match = 1.0

    if not alignments:
        mean_align = 0.5 * numeric_match
        min_align = 0.5
    else:
        mean_align = float(np.mean(alignments))
        min_align = float(np.min(alignments))

    if len(best_positions) >= 2:
        monotonic = sum(
            1 for a, b in zip(best_positions, best_positions[1:])
            if b >= a
        )
        positional_coherence = monotonic / (len(best_positions) - 1)
    else:
        positional_coherence = 1.0

    n_unmatched = sum(1 for a in alignments if a < 0.4)

    combined = (
        mean_align * 0.40
        + min_align * 0.20
        + numeric_match * 0.25
        + positional_coherence * 0.15
    )

    if combined >= 0.65 and numeric_match >= 0.5 and n_unmatched == 0:
        verdict = "SUPPORT"
    elif combined < 0.45 or numeric_match < 0.3 or n_unmatched >= 2:
        verdict = "CONTRADICT"
    else:
        verdict = "NEUTRAL"

    return {
        "alignment_score": combined,
        "min_alignment": min_align,
        "positional_coherence": positional_coherence,
        "numeric_match": numeric_match,
        "n_content_tokens": len(alignments),
        "n_unmatched": n_unmatched,
        "verdict": verdict,
    }


@dataclass(frozen=True)
class EmbeddingAlignmentSignal:
    name: str = "EMBEDDING_ALIGNMENT"
    label: str = "Token alignment"
    weight: float = 0.35

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        result = score_alignment(claim, source_text)
        if result["verdict"] == "NEUTRAL":
            return None
        rationale_parts = []
        if result["verdict"] == "SUPPORT":
            rationale_parts.append(f"Token alignment={result['alignment_score']:.2f}")
            if result["numeric_match"] < 1.0:
                rationale_parts.append(f"numeric_match={result['numeric_match']:.0%}")
        else:
            if result["n_unmatched"] > 0:
                rationale_parts.append(f"{result['n_unmatched']} claim tokens unmatched")
            if result["numeric_match"] < 0.5:
                rationale_parts.append("numbers don't match source")
            rationale_parts.append(f"alignment={result['alignment_score']:.2f}")

        return DetectorSignal(
            name=self.name,
            label=self.label,
            verdict=result["verdict"],
            score=result["alignment_score"],
            weight=self.weight,
            rationale="; ".join(rationale_parts),
            evidence=evidence,
        )
