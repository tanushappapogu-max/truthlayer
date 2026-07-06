"""Decompose-and-Ground (DAG) Stage 2.

Convert document-level faithfulness checking into the sentence-level
NLI problem the pretrained judge is actually good at:

  1. A small local LLM splits the claim into atomic facts.
  2. The evidence selector finds the best window for each atom.
  3. Sentence-level NLI judges each (window, atom) pair.
  4. Weakest-link aggregation: the claim is only as faithful as its
     least-supported atom.
"""

from __future__ import annotations

import re

from .evidence import EvidenceSelector
from .roundtrip import nli_probs
from .vag import ollama_generate

DECOMPOSE_PROMPT = """Split the claim below into its individual facts. Write one short, self-contained sentence per fact. Output only the numbered facts, nothing else.

Claim: {claim}

Facts:"""

_selector = EvidenceSelector(window_limit=1)


def decompose(claim: str, model: str = "llama3.2:3b") -> list[str]:
    raw = ollama_generate(DECOMPOSE_PROMPT.format(claim=claim),
                          model=model, temperature=0.0)
    atoms = []
    for line in raw.split("\n"):
        line = re.sub(r"^\s*(?:\d+[.)]|[-*•])\s*", "", line).strip()
        if len(line) > 10:
            atoms.append(line)
    return atoms[:8] or [claim]


def score_decompose(claim: str, doc: str, model: str = "llama3.2:3b") -> dict:
    atoms = decompose(claim, model=model)
    atom_scores = []
    for atom in atoms:
        windows = _selector.select(atom, doc)
        window = windows[0].text if windows else doc[:700]
        probs = nli_probs(window, atom)
        atom_scores.append({
            "atom": atom,
            "entailment": probs["entailment"],
            "contradiction": probs["contradiction"],
        })

    entailments = [a["entailment"] for a in atom_scores]
    contradictions = [a["contradiction"] for a in atom_scores]
    min_ent = min(entailments)
    mean_ent = sum(entailments) / len(entailments)
    max_con = max(contradictions)

    score = (0.6 * min_ent + 0.4 * mean_ent) * (1.0 - 0.5 * max_con)
    return {
        "dag_score": score,
        "n_atoms": len(atoms),
        "min_entailment": min_ent,
        "mean_entailment": mean_ent,
        "max_contradiction": max_con,
        "atoms": atom_scores,
    }
