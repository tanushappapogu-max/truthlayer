from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .text import extract_entities, extract_numbers, normalize_for_match, ngram_overlap, token_coverage, tokenize
from .types import DetectorReport, DetectorSignal, EvidenceWindow

CONTRAST_PAIRS = {
    ("public", "private"),
    ("increase", "decrease"),
    ("increased", "decreased"),
    ("largest", "smallest"),
    ("highest", "lowest"),
    ("first", "last"),
    ("before", "after"),
    ("approved", "rejected"),
    ("confirmed", "denied"),
    ("majority", "minority"),
    ("urban", "rural"),
    ("domestic", "international"),
    ("fictional", "real"),
}

NEGATIONS = {"not", "no", "never", "without", "cannot", "cant", "couldnt", "wouldnt", "isnt", "arent", "doesnt", "dont"}
STRONG_HEDGES = {"always", "never", "all", "none", "every", "completely", "definitely", "exclusively", "only"}
WEAK_HEDGES = {"sometimes", "often", "usually", "may", "might", "can", "some", "many", "approximately", "roughly"}


class SignalRule(Protocol):
    name: str
    label: str
    weight: float

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        ...


@dataclass(frozen=True)
class SourceRetrievalSignal:
    name: str = "SOURCE_RETRIEVAL"
    label: str = "Source retrieval"
    weight: float = 0.08

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal:
        enough = len(source_text) > 200
        return DetectorSignal(
            name=self.name,
            label=self.label,
            verdict="NEUTRAL" if enough else "INSUFFICIENT",
            score=min(len(source_text) / 2000, 1.0),
            weight=self.weight,
            rationale="Readable source text was retrieved." if enough else "The retrieved source text is too short.",
            evidence=evidence,
        )


@dataclass(frozen=True)
class LexicalOverlapSignal:
    name: str = "LEXICAL_OVERLAP"
    label: str = "Claim/source overlap"
    weight: float = 0.20

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal:
        score = ngram_overlap(claim, source_text)
        return DetectorSignal(
            name=self.name,
            label=self.label,
            verdict="SUPPORT" if score >= 0.6 else "NEUTRAL",
            score=score,
            weight=self.weight,
            rationale="Most claim n-grams appear in the source." if score >= 0.6 else "Semantic verification is needed.",
            evidence=evidence,
        )


@dataclass(frozen=True)
class EvidenceCoverageSignal:
    name: str = "EVIDENCE_COVERAGE"
    label: str = "Evidence coverage"
    weight: float = 0.17

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal:
        score = token_coverage(claim, evidence)
        if score >= 0.65:
            verdict = "SUPPORT"
            rationale = "A compact evidence window covers most claim terms."
        elif score <= 0.18:
            verdict = "INSUFFICIENT"
            rationale = "No retrieved passage covers enough of the claim."
        else:
            verdict = "NEUTRAL"
            rationale = "The source has partial topical overlap with the claim."
        return DetectorSignal(self.name, self.label, verdict, score, self.weight, rationale, evidence)


@dataclass(frozen=True)
class NumericContradictionSignal:
    name: str = "NUMERIC_CONTRADICTION"
    label: str = "Number/date mismatch"
    weight: float = 0.28

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        claim_numbers = extract_numbers(claim)
        if not claim_numbers:
            return None
        evidence_numbers = extract_numbers(evidence)
        if not evidence_numbers:
            return None
        missing = [number for number in claim_numbers if number not in evidence_numbers]
        if missing and token_coverage(claim, evidence) >= 0.35:
            return DetectorSignal(
                self.name,
                self.label,
                "CONTRADICT",
                0.88,
                self.weight,
                f"Claim uses {', '.join(missing[:3])}, but the strongest evidence uses {', '.join(evidence_numbers[:3])}.",
                evidence,
            )
        return None


@dataclass(frozen=True)
class ContrastContradictionSignal:
    name: str = "CONTRAST_CONTRADICTION"
    label: str = "Semantic contrast"
    weight: float = 0.20

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        claim_norm = normalize_for_match(claim)
        evidence_norm = normalize_for_match(evidence)
        for left, right in CONTRAST_PAIRS:
            if left in claim_norm and right in evidence_norm and left not in evidence_norm:
                return DetectorSignal(self.name, self.label, "CONTRADICT", 0.82, self.weight, f"Claim says {left}, while evidence says {right}.", evidence)
            if right in claim_norm and left in evidence_norm and right not in evidence_norm:
                return DetectorSignal(self.name, self.label, "CONTRADICT", 0.82, self.weight, f"Claim says {right}, while evidence says {left}.", evidence)
        return None


@dataclass(frozen=True)
class NegationContradictionSignal:
    name: str = "NEGATION_CONTRADICTION"
    label: str = "Negation mismatch"
    weight: float = 0.30

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        claim_tokens = set(normalize_for_match(claim).split())
        evidence_tokens = set(normalize_for_match(evidence).split())
        if bool(claim_tokens & NEGATIONS) != bool(evidence_tokens & NEGATIONS) and token_coverage(claim, evidence) >= 0.55:
            return DetectorSignal(self.name, self.label, "CONTRADICT", 0.90, self.weight, "Negation appears on only one side of the claim/evidence pair.", evidence)
        return None


@dataclass(frozen=True)
class EntitySubstitutionSignal:
    name: str = "ENTITY_SUBSTITUTION"
    label: str = "Entity substitution"
    weight: float = 0.18

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        entities = extract_entities(claim)
        if not entities:
            return None
        evidence_norm = normalize_for_match(evidence)
        missing = [entity for entity in entities if normalize_for_match(entity) not in evidence_norm]
        if missing and token_coverage(claim, evidence) >= 0.45:
            return DetectorSignal(self.name, self.label, "CONTRADICT", 0.72, self.weight, f"Entity missing from evidence: {missing[0]}.", evidence)
        return None


@dataclass(frozen=True)
class HedgingMismatchSignal:
    name: str = "HEDGING_MISMATCH"
    label: str = "Certainty mismatch"
    weight: float = 0.12

    def evaluate(self, claim: str, source_text: str, evidence: str) -> DetectorSignal | None:
        claim_tokens = set(normalize_for_match(claim).split())
        evidence_tokens = set(normalize_for_match(evidence).split())
        strong = claim_tokens & STRONG_HEDGES
        weak = evidence_tokens & WEAK_HEDGES
        if strong and weak:
            return DetectorSignal(self.name, self.label, "CONTRADICT", 0.62, self.weight, f"Claim uses strong certainty ({next(iter(strong))}); evidence hedges ({next(iter(weak))}).", evidence)
        return None


DEFAULT_SIGNAL_RULES: tuple[SignalRule, ...] = (
    SourceRetrievalSignal(),
    LexicalOverlapSignal(),
    EvidenceCoverageSignal(),
    NumericContradictionSignal(),
    ContrastContradictionSignal(),
    NegationContradictionSignal(),
    EntitySubstitutionSignal(),
    HedgingMismatchSignal(),
)


class DeterministicSignalEngine:
    def __init__(self, rules: tuple[SignalRule, ...] = DEFAULT_SIGNAL_RULES) -> None:
        self.rules = rules

    def run(self, claim: str, source_text: str, evidence_windows: list[EvidenceWindow]) -> DetectorReport:
        primary = evidence_windows[0].text if evidence_windows else source_text[:700]
        signals = [signal for rule in self.rules if (signal := rule.evaluate(claim, source_text, primary))]
        support_signals = [signal for signal in signals if signal.verdict == "SUPPORT"]
        contradict_signals = [signal for signal in signals if signal.verdict == "CONTRADICT"]

        support_weight = sum(signal.weight for signal in support_signals)
        support_score = (
            sum(signal.score * signal.weight for signal in support_signals) / max(support_weight, 0.01)
        )
        contradiction_score = max((signal.score for signal in contradict_signals), default=0.0)
        coverage = evidence_windows[0].coverage if evidence_windows else 0.0
        return DetectorReport(signals, evidence_windows, support_score, contradiction_score, coverage)
