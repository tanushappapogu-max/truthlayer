# TruthLayer

**A calibrated acceptance gate for citation hallucination in AI search.**

LLMs hallucinate citations. They return real URLs attached to claims those sources never actually make — the link exists, the information doesn't. TruthLayer intercepts answers from Perplexity's Sonar API and runs each cited claim through a multi-stage groundedness detector before it reaches the user. Verified claims pass through. Unsupported ones get flagged with what the source actually says, which detector signals fired, and a corrected rewrite grounded only in the source text.

An answer-level acceptance gate then makes a ship/don't-ship decision: **ACCEPT**, **REVISE**, **REJECT**, or **ABSTAIN**.

---

## Architecture

```
User query
    │
    ▼
Perplexity Sonar API ──► answer + citation URLs
    │
    ▼
TruthLayer 3-Stage Pipeline
    │
    ├── Stage 1: Deterministic Detector
    │       ├── lexical overlap (5-gram)
    │       ├── evidence coverage
    │       ├── numeric/date contradiction
    │       ├── semantic contrast pairs
    │       ├── relation mismatch
    │       ├── entity substitution
    │       ├── hedging/certainty mismatch
    │       └── quote verbatim match
    │
    ├── Stage 2: NLI Cross-Encoder (optional)
    │       └── cross-encoder/nli-deberta-v3-base
    │
    ├── Stage 3: LLM Judge (fallback)
    │       └── Llama 3.1 8B via OpenRouter / Perplexity Sonar
    │
    └── Acceptance Gate
            ├── ACCEPT  — all cited claims supported, score ≥ 0.82
            ├── REVISE  — mismatch found, below reject threshold
            ├── REJECT  — high-confidence contradiction (≥ 0.78)
            └── ABSTAIN — too little source evidence (>25% unresolved)
```

The pipeline is staged so cheap deterministic checks resolve clear cases before any API call. Each stage adds signals to an inspectable detector report.

---

## Hallucination Taxonomy

| Failure Mode | Example | Detector Signal |
|---|---|---|
| Entity substitution | "directed by Spielberg" → source says "directed by Jackson" | `ENTITY_SUBSTITUTION`, `RELATION_CONTRADICTION` |
| Numeric drift | "population 200,000" → source says "145,170" | `NUMERIC_CONTRADICTION` |
| Relation inversion | "public university" → source says "private" | `CONTRAST_CONTRADICTION` |
| Hedging escalation | "always improves" → source says "may improve" | `HEDGING_MISMATCH` |
| Irrelevant citation | Claim about Python (language) → source about Python (snake) | `EVIDENCE_COVERAGE` |
| Source access failure | URL returns 403/timeout | `SOURCE_RETRIEVAL` |

---

## Evaluation Suite

The `/benchmark` page runs **1,036 labeled claim/source pairs** (FEVER + adversarial) and reports:

| Metric | Description |
|---|---|
| Accuracy | Overall correctness on decided cases |
| Precision | Of flagged claims, fraction actually wrong |
| Recall | Of wrong claims, fraction caught |
| F1 | Harmonic mean |
| **False Accept Rate** | Fraction of hallucinations the gate lets through |
| False Reject Rate | Fraction of true claims incorrectly blocked |
| Abstention Rate | Fraction unresolvable |
| ECE | Expected Calibration Error |

### Analysis tools:
- **Confusion matrix** — TP/FP/FN/TN visualization
- **Threshold sweep** — precision/recall/F1 curves across confidence thresholds
- **Per-signal ablation** — disable any detector signal to measure its contribution
- **Gold trace** — inspect the full pipeline for any individual case
- **JSONL export** — reproducible results for external analysis

---

## Stack

- **Next.js 16** (App Router)
- **Tailwind CSS**
- **Perplexity Sonar API** — answer generation + optional judge
- **OpenRouter** — free LLM judge tier
- **Wikipedia REST API** — clean text extraction
- **HuggingFace Inference API** — NLI cross-encoder (optional)

---

## Getting Started

```bash
git clone https://github.com/tanushappapogu-max/truthlayer.git
cd truthlayer
npm install
```

Create `.env.local`:

```
PERPLEXITY_API_KEY=your_key_here

# Optional — enables NLI stage
HUGGINGFACE_API_KEY=your_key_here

# Optional — enables free LLM judge
OPENROUTER_API_KEY=your_key_here
```

```bash
npm run dev
```

- Main interface: [http://localhost:3000](http://localhost:3000)
- Benchmark suite: [http://localhost:3000/benchmark](http://localhost:3000/benchmark)

A Perplexity API key is required. Get one at [perplexity.ai/settings/api](https://perplexity.ai/settings/api).

---

## Research Brief

See [docs/research-brief.md](docs/research-brief.md) for the full research writeup including:
- Problem statement and hallucination taxonomy
- Detector signal weights and thresholds
- Evaluation methodology
- Relation to prior work (FEVER, FActScore, SAFE, Minicheck)
- Reproducibility format

---

## License

MIT
