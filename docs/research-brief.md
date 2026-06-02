# TruthLayer: A Calibrated Acceptance Gate for Citation Hallucination in AI Search

## Abstract

Citation hallucination is an attribution failure: a model produces a plausible answer, attaches a real source, and still fails because the cited source does not support the local claim. TruthLayer treats this as a release-control problem. Each cited claim is checked against retrieved source evidence through a multi-stage detector pipeline, then an acceptance gate decides whether the answer should be accepted, revised, rejected, or withheld. The key contribution is not "use an LLM to fact-check" but a calibrated, inspectable gate with measurable false-accept behavior.

## Problem Statement

LLM-powered search products (Perplexity, Bing Chat, Google AI Overviews, ChatGPT with browsing) cite sources as a trust signal. When the attribution is wrong, users are misled by the *appearance* of rigor rather than the *presence* of it. This is worse than no citation at all, because the user's guard is down.

The failure modes are specific and enumerable:
- **Unsupported attribution**: the URL is real, but the cited source does not mention the claim.
- **Entity substitution**: a source supports a similar claim about a different person, organization, place, or object (e.g., "directed by Peter Jackson" → "directed by Steven Spielberg").
- **Numeric/date drift**: the claim changes a year, count, rank, percentage, or amount.
- **Relation inversion**: public/private, increase/decrease, largest/smallest, before/after.
- **Hedging escalation**: source says "sometimes" or "may", claim says "always" or "definitely".
- **Citation granularity failure**: the source supports the broad topic but not the exact local sentence.
- **Irrelevant citation**: the source is about an entirely different topic (e.g., Python snake vs. Python language).
- **Source access failure**: the citation is blocked, unreachable, or not parseable.

## Architecture

### 3-Stage Verification Pipeline

```
Claim + Source URL
     │
     ├── Fetch source text
     │     Wikipedia REST API → Jina Reader → Serper (fallback chain)
     │
     ├── Select evidence windows
     │     Token overlap + density ranking → top-3 passages
     │
     ├── Stage 1: Deterministic Detector
     │     ├── Lexical overlap (5-gram)
     │     ├── Evidence coverage
     │     ├── Numeric/date contradiction
     │     ├── Semantic contrast pairs
     │     ├── Relation mismatch ("directed by X" vs "directed by Y")
     │     ├── Entity substitution detection
     │     ├── Hedging/certainty mismatch
     │     └── Quote verbatim match
     │     → If high-confidence verdict: return (skip Stage 2+3)
     │
     ├── Stage 2: NLI Cross-Encoder (optional)
     │     cross-encoder/nli-deberta-v3-base via HuggingFace Inference API
     │     → If entailment/contradiction score > 0.82: return
     │
     └── Stage 3: LLM Judge (fallback)
           Constrained prompt over retrieved evidence only
           OpenRouter (Llama 3.1 8B free) → Perplexity Sonar (fallback)
```

The pipeline is intentionally staged so that cheap deterministic checks resolve clear cases before any API call. Each stage adds a signal to the detector report, making the full reasoning chain inspectable.

### Acceptance Gate

The gate aggregates citation-level verdicts into an answer-level decision:

| Decision | Condition |
|---|---|
| **REJECT** | Any cited claim has contradiction score ≥ 0.78 |
| **REVISE** | A citation mismatch exists but below reject threshold |
| **ABSTAIN** | >25% of claims are unresolvable (unreachable or unverifiable) |
| **ACCEPT** | Every cited claim is supported AND aggregate score ≥ 0.82 |

The gate is deterministic given the detector outputs. Thresholds are exposed and tunable for threshold sweep analysis.

## Detector Signals

| Signal | Weight | Fires On | Detects |
|---|---|---|---|
| Lexical overlap | 0.20 | 5-gram match ≥ 60% | Verbatim support |
| Evidence coverage | 0.17 | Token coverage in best window | Topical relevance |
| Numeric contradiction | 0.28 | Number in claim absent from evidence with shared context | Date/count drift |
| Contrast contradiction | 0.20 | Antonym pair (claim vs evidence) | Relation inversion |
| Relation mismatch | 0.30 | "directed by X" vs "directed by Y" | Entity-relation swap |
| Entity substitution | 0.26 | Named entity in claim absent from evidence with shared context | Person/org swap |
| Hedging mismatch | 0.12 | "always/never" in claim, "sometimes/often" in evidence | Certainty escalation |
| Quote match | 0.12 | Quoted span found verbatim in source | Direct quote support |
| NLI model | 0.32 | DeBERTa-v3-base entailment/contradiction > 0.82 | Semantic entailment |
| LLM judge | 0.25-0.30 | Constrained verdict over evidence window | Semantic judgment |

## Evaluation

### Benchmark Dataset

- **1,036 labeled claim/source pairs**
- 500 FEVER-SUPPORTED from Wikipedia
- 500 FEVER-UNSUPPORTED from Wikipedia (entity swaps, wrong facts, wrong relations)
- 36 adversarial cases hand-crafted for specific failure modes:
  - 8 entity substitution (wrong person/founder/inventor)
  - 8 numeric/date swap (wrong year/count/measurement)
  - 6 relation inversion (public/private, largest/smallest)
  - 4 irrelevant citation (topic mismatch)
  - 4 hedging escalation (always vs sometimes)
  - 6 true-positive controls

### Metrics

| Metric | Definition | Why It Matters |
|---|---|---|
| Accuracy | (TP + TN) / scored | Overall correctness on decided cases |
| Precision | TP / (TP + FP) | Of flagged claims, how many are actually wrong |
| Recall | TP / (TP + FN) | Of all wrong claims, how many are caught |
| F1 | Harmonic mean of P & R | Balanced measure |
| **False Accept Rate** | FN / (FN + TP) | **Fraction of hallucinations the gate lets through** |
| False Reject Rate | FP / (FP + TN) | Fraction of true claims incorrectly blocked |
| Abstention Rate | (Unverifiable + Unreachable) / Total | Coverage limitation |
| ECE | Expected Calibration Error (10 bins) | Does confidence track empirical accuracy? |

The **false accept rate** is the paper's primary metric: it measures how often a hallucination passes through the gate unchallenged.

### Analysis Tools

The `/benchmark` page provides:
- **Confusion matrix** with TP/FP/FN/TN visualization
- **Threshold sweep** chart showing precision/recall/F1 as a function of confidence threshold
- **Per-signal contribution** analysis: how often each signal fires and whether it helps or hurts
- **Signal ablation toggles**: disable any signal before running to measure its contribution
- **Gold trace view**: inspect the full pipeline (claim → evidence → signals → verdict) for any case
- **JSONL export**: full results with signals for external analysis

## Reproducibility

Every benchmark run can be exported as JSONL with the following fields per case:
```json
{
  "id": 0,
  "claim": "...",
  "url": "...",
  "expected": "SUPPORTED",
  "predicted": "SUPPORTED",
  "confidence": 0.87,
  "tier": 1,
  "signals": [
    {"name": "LEXICAL_OVERLAP", "verdict": "SUPPORT", "score": 0.72, "weight": 0.20}
  ]
}
```

## Stack

- Next.js 16 (App Router)
- Tailwind CSS
- Perplexity Sonar API (answer generation + optional judge)
- OpenRouter (free LLM judge tier)
- Wikipedia REST API (clean text extraction)
- HuggingFace Inference API (NLI cross-encoder, optional)
- No external databases or vector stores

## Relation to Prior Work

- **FEVER** (Thorne et al., 2018): provides the evaluation framework and dataset structure. TruthLayer adapts FEVER-style claims to test a pipeline that operates on live URLs, not pre-extracted evidence.
- **FActScore** (Min et al., 2023): decomposes responses into atomic facts for fine-grained evaluation. TruthLayer uses claim decomposition for multi-fact sentences but focuses on citation-level rather than response-level scoring.
- **SAFE** (Wei et al., 2024): uses LLM-as-judge for factuality. TruthLayer layers deterministic signals before the LLM to reduce cost and increase inspectability.
- **Minicheck** (Tang et al., 2024): trains a compact NLI model for grounded fact-checking. TruthLayer uses an off-the-shelf NLI cross-encoder as one signal among many, rather than as the sole arbiter.

The novel angle is the **acceptance gate as a release control mechanism** — not just scoring individual claims, but making a binary ship/don't-ship decision with calibrated thresholds and measurable false-accept behavior.

## Pitch

TruthLayer is a pre-answer citation firewall for AI search. It does not try to solve all truth. It solves a narrower and commercially sharp problem: before a cited answer ships, verify whether each citation actually supports the sentence that points to it, then gate the answer based on calibrated risk.

That is directly relevant to products where citations are part of the trust interface.
