# TruthLayer

**Verification-Augmented Generation: an architectural layer for reducing citation hallucination in transformer pipelines.**

Citation hallucination is an attribution failure — the model retrieves a real source, the URL loads, the topic is relevant, but the specific claim attached to the citation marker is wrong. TruthLayer proposes a model-agnostic verification layer that integrates directly into transformer-based RAG pipelines at inference time, using deterministic signals as the primary detection mechanism with learned models as fallback.

On a 1,036-case benchmark, the deterministic layer achieves **99.1% accuracy** on decided cases with a **0.8% false accept rate** — using zero model calls. Four of eight signals achieve **100% precision**.

---

## Benchmark Results (Stage 1 — Deterministic Only)

| Metric | Value |
|---|---|
| Accuracy | **99.1%** |
| Precision | **99.2%** |
| Recall | 99.2% |
| F1 | 99.2% |
| False Accept Rate | **0.8%** |
| Coverage | 20.8% (215/1036 decided) |
| False Positives | 1 |

---

## Architecture

```
Transformer Output (answer + citation URLs)
    │
    ├── Claim decomposition → atomic claims
    │
    ├── Source retrieval
    │       Wikipedia REST API → Jina Reader → Serper
    │
    ├── Stage 1: Deterministic Verification Module
    │       ├── numeric contradiction (100% precision)
    │       ├── negation contradiction (100% precision)
    │       ├── relation mismatch (100% precision)
    │       ├── type contradiction (100% precision)
    │       ├── contrast contradiction (96% precision)
    │       ├── hedging mismatch (83% precision)
    │       ├── evidence coverage
    │       └── entity substitution
    │       → High-confidence verdict? Return. Otherwise escalate.
    │
    ├── Stage 2: NLI Cross-Encoder (184M params)
    │       └── cross-encoder/nli-deberta-v3-base
    │
    ├── Stage 3: LLM Judge (fallback)
    │       └── Llama 3.1 8B via OpenRouter / Perplexity Sonar
    │
    └── Acceptance Gate
            ├── ACCEPT  — all claims supported, score ≥ 0.82
            ├── REVISE  — mismatch found, below reject threshold
            ├── REJECT  — high-confidence contradiction (≥ 0.78)
            └── ABSTAIN — insufficient evidence (>25% unresolved)
```

Deterministic signals first, learned models second. When a citation is flagged, the reason is a verifiable fact about the text — not a model opinion.

---

## Citation Hallucination Taxonomy

| Failure Mode | Mechanism | Signal | Benchmark Precision |
|---|---|---|---|
| Numeric drift | Model picks number from right paragraph, wrong row | `NUMERIC_CONTRADICTION` | **100%** |
| Negation flip | Claim negates what evidence states | `NEGATION_CONTRADICTION` | **100%** |
| Relation swap | "directed by X" → source says "directed by Y" | `RELATION_CONTRADICTION` | **100%** |
| Type error | "is a [type A]" → source says "is a [type B]" | `TYPE_CONTRADICTION` | **100%** |
| Polarity inversion | "public" → source says "private" | `CONTRAST_CONTRADICTION` | 96% |
| Hedging escalation | "always" → source says "sometimes" | `HEDGING_MISMATCH` | 83% |
| Entity substitution | Wrong person/org in same context | `ENTITY_SUBSTITUTION` | 54% |
| Irrelevant citation | Topic mismatch (homonym/disambiguation) | `EVIDENCE_COVERAGE` | 62% |

---

## Evaluation Suite

The `/benchmark` page runs **1,036 labeled claim/source pairs** and provides:

- **Confusion matrix** — TP/FP/FN/TN visualization
- **Threshold sweep** — precision/recall/F1 curves across confidence thresholds
- **Per-signal ablation** — disable any signal to measure its contribution
- **Gold trace** — inspect the full pipeline for any individual case
- **JSONL export** — reproducible results with per-case signals

---

## Stack

- **Next.js 16** (App Router)
- **Tailwind CSS**
- **Perplexity Sonar API** — answer generation
- **HuggingFace Inference API** — NLI cross-encoder (Stage 2)
- **OpenRouter** — LLM judge (Stage 3)
- **Wikipedia REST API, Jina Reader, Serper** — source retrieval

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
- Research: [http://localhost:3000/research](http://localhost:3000/research)
- Benchmark suite: [http://localhost:3000/benchmark](http://localhost:3000/benchmark)

---

## Research

See [docs/research-brief.md](docs/research-brief.md) for the full research writeup:
- Verification-Augmented Generation architecture
- Deterministic signal design with per-signal precision analysis
- Benchmark methodology and results
- Hallucination reduction analysis
- Relation to FEVER, FActScore, SAFE, Minicheck

---

## License

MIT
