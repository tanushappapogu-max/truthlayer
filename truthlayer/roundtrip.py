"""Round-Trip Faithfulness (RTF): verification by grounded re-generation.

Thesis: hallucinations are unfaithful paraphrases. A faithful claim
survives being re-paraphrased from the source; an unfaithful one cannot,
because the source will not let the re-writer reproduce the error.

Method: ask a small grounded LLM to rewrite the claim using ONLY the
document. Then judge entailment between the rewrite (premise) and the
original claim (hypothesis) with a sentence-level NLI model — a task
squarely inside the NLI model's training distribution, unlike
document-level judging. Numbers are additionally checked exactly.
"""

from __future__ import annotations

import re

from .text import extract_numbers, normalize_for_match
from .vag import ollama_generate

REWRITE_PROMPT = """Rewrite the claim below so it states only what the document supports. Keep it to one sentence. If the document says something different from the claim, state what the document actually says. Do not add explanations.

Document:
{doc}

Claim: {claim}

Rewrite:"""


_nli_cache: dict = {}


def _nli():
    if "model" not in _nli_cache:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        name = "cross-encoder/nli-deberta-v3-base"
        _nli_cache["tok"] = AutoTokenizer.from_pretrained(name)
        _nli_cache["model"] = AutoModelForSequenceClassification.from_pretrained(name).eval()
    return _nli_cache["tok"], _nli_cache["model"]


def nli_probs(premise: str, hypothesis: str) -> dict:
    import torch
    tok, model = _nli()
    inputs = tok([(premise, hypothesis)], return_tensors="pt",
                 truncation=True, max_length=512, padding=True)
    with torch.no_grad():
        probs = torch.softmax(model(**inputs).logits.float(), dim=-1)[0]
    label_map = {v.lower(): k for k, v in model.config.id2label.items()}
    return {
        "entailment": probs[label_map["entailment"]].item(),
        "contradiction": probs[label_map["contradiction"]].item(),
    }


def clean_rewrite(text: str) -> str:
    text = text.strip().split("\n")[0].strip()
    text = re.sub(r"^(rewrite|answer|claim)\s*:\s*", "", text, flags=re.I)
    return text.strip().strip('"')


def score_roundtrip(claim: str, doc: str, model: str = "llama3.2:3b") -> dict:
    """Returns rtf_score in [0,1]: high = claim survives grounded rewrite."""
    rewrite = clean_rewrite(ollama_generate(
        REWRITE_PROMPT.format(doc=doc[:6000], claim=claim), model=model,
        temperature=0.0,
    ))
    if not rewrite:
        return {"rtf_score": 0.5, "rewrite": "", "entailment": 0.5,
                "contradiction": 0.0, "numeric_match": 1.0}

    # sentence-level NLI: does the grounded rewrite entail the original claim?
    probs = nli_probs(rewrite, claim)

    # numbers in the claim must survive the round trip
    claim_numbers = extract_numbers(claim)
    if claim_numbers:
        rewrite_norm = normalize_for_match(rewrite)
        kept = sum(1 for n in claim_numbers if n in rewrite_norm)
        numeric_match = kept / len(claim_numbers)
    else:
        numeric_match = 1.0

    score = probs["entailment"] * (0.5 + 0.5 * numeric_match)
    if probs["contradiction"] > 0.5:
        score *= 0.25

    return {
        "rtf_score": score,
        "rewrite": rewrite,
        "entailment": probs["entailment"],
        "contradiction": probs["contradiction"],
        "numeric_match": numeric_match,
    }
