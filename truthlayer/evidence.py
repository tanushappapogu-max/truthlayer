from __future__ import annotations

from .text import clamp01, clip, split_sentences, tokenize
from .types import EvidenceWindow


class EvidenceSelector:
    def __init__(self, window_limit: int = 3) -> None:
        self.window_limit = window_limit

    def select(self, claim: str, source_text: str) -> list[EvidenceWindow]:
        claim_tokens = set(tokenize(claim))
        if not claim_tokens:
            return []

        windows: list[EvidenceWindow] = []
        sentences = split_sentences(source_text)
        for index, sentence in enumerate(sentences):
            text = " ".join(
                item for item in [sentence, sentences[index + 1] if index + 1 < len(sentences) else ""] if item
            )
            window_tokens = set(tokenize(text))
            hits = len(claim_tokens & window_tokens)
            coverage = hits / max(len(claim_tokens), 1)
            density = hits / max(len(window_tokens), 1)
            overlap = clamp01(coverage * 0.78 + min(density * 3, 1) * 0.22)
            windows.append(EvidenceWindow(text=clip(text, 700), overlap=overlap, coverage=coverage, position=index))

        return sorted(windows, key=lambda window: window.overlap, reverse=True)[: self.window_limit]
