from __future__ import annotations

import re
from typing import Iterable

STOPWORDS = {
    "the",
    "and",
    "for",
    "that",
    "this",
    "with",
    "from",
    "was",
    "were",
    "are",
    "has",
    "had",
    "have",
    "its",
    "his",
    "her",
    "their",
    "about",
    "into",
    "than",
    "then",
    "also",
    "only",
    "according",
    "source",
    "claim",
    "been",
    "being",
    "which",
    "who",
    "whom",
    "where",
    "when",
    "what",
    "how",
    "does",
    "did",
    "but",
    "can",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
}


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def normalize(text: str) -> str:
    return (
        text.lower()
        .encode("ascii", "ignore")
        .decode("ascii")
        .replace("\u2019", "'")
    )


def normalize_for_match(text: str) -> str:
    clean = normalize(text)
    clean = re.sub(r"[^a-z0-9.\s\"'%-]", " ", clean)
    return re.sub(r"\s+", " ", clean).strip()


def tokenize(text: str) -> list[str]:
    return [
        token
        for token in re.sub(r"[^a-z0-9\s]", " ", normalize_for_match(text)).split()
        if len(token) > 2 and token not in STOPWORDS
    ]


def unique(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        clean = item.strip()
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        out.append(clean)
    return out


def clip(text: str, limit: int = 220) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    return clean if len(clean) <= limit else f"{clean[: limit - 3].rstrip()}..."


def split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    return [s.strip() for s in re.findall(r"[^.!?]+[.!?]+|[^.!?]+$", normalized) if len(s.strip()) > 20]


def extract_entities(text: str, limit: int = 10) -> list[str]:
    matches = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}", text)
    blocked = {"The", "This", "That", "There", "Here", "According", "Although", "However"}
    return [entity for entity in unique(matches) if entity not in blocked][:limit]


def extract_numbers(text: str, limit: int = 10) -> list[str]:
    numbers = [match.replace(",", "").rstrip("%") for match in re.findall(r"\b\d[\d,]*(?:\.\d+)?%?\b", text)]
    return unique(numbers)[:limit]


def extract_relations(text: str, limit: int = 8) -> list[str]:
    pattern = r"\b(?:founded|created|directed|written|produced|invented|composed|designed|organized|reviewed)\s+by\s+([^.;,\n]{2,70})"
    return unique(match.group(0) for match in re.finditer(pattern, text, flags=re.I))[:limit]


def token_coverage(claim: str, evidence: str) -> float:
    claim_tokens = set(tokenize(claim))
    if not claim_tokens:
        return 0.0
    evidence_tokens = set(tokenize(evidence))
    return len(claim_tokens & evidence_tokens) / len(claim_tokens)


def ngram_overlap(claim: str, source_text: str, n: int = 5) -> float:
    words = tokenize(claim)
    if len(words) < n:
        return 0.0
    source = normalize_for_match(source_text)
    grams = [" ".join(words[i : i + n]) for i in range(len(words) - n + 1)]
    return len([gram for gram in grams if gram in source]) / max(len(grams), 1)
