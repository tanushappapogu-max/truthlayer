# TruthLayer

**Graph-Gated Verification-Augmented Generation: an architectural layer for reducing citation hallucination in LLaMA-style transformer pipelines.**

Citation hallucination is an attribution failure — the model retrieves a real source, the URL loads, the topic is relevant, but the specific claim attached to the citation marker is wrong. TruthLayer proposes a model-agnostic verification layer that integrates into transformer-based RAG pipelines at inference time, using deterministic signals and a claim-evidence graph as the primary detection mechanism with learned models as fallback.

On a 1,036-case benchmark, the deterministic layer achieves **99.1% accuracy** on decided cases with a **0.8% false accept rate** — using zero model calls. Four of eight signals achieve **100% precision**.

The new Python graph-gated engine adds a before/after path: a vanilla pass-through baseline accepts **529/529 unsupported claims**, while the TruthLayer graph gate accepts **19/529**, a **96.4% reduction** before NLI or LLM fallback.

---

## Benchmark Results

### Stage 1 — Deterministic Only
| Metric | Value |
|---|---|
| Accuracy | **99.1%** |
| Precision | **99.2%** |
| Recall | 99.2% |
| F1 | 99.2% |
| False Accept Rate | **0.8%** |
| Coverage | 20.8% (215/1036 decided) |
| False Positives | 1 |

### LLaMA Wrapper — Offline Graph Gate
| System | Accepted unsupported claims | False accept rate |
|---|---:|---:|
| Vanilla LLaMA / RAG pass-through | 529 / 529 | 100.0% |
| TruthLayer Python graph gate | **19 / 529** | **3.6%** |

---

## Architecture

![TruthLayer graph-gated architecture](public/figures/truthlayer-architecture.svg)

```
LLaMA / Transformer Output (answer + citation URLs)
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

Deterministic signals first, graph release control second, learned models third. When a citation is flagged, the reason is a verifiable fact about the text — not a model opinion.

### Claim-Evidence Graph

![Claim evidence graph](public/figures/claim-evidence-graph.svg)

TruthLayer models each cited claim as a typed graph:

- **Nodes:** claim, source, evidence window, entity, quantity, relation, signal, gate
- **Edges:** cites, contains, mentions, grounds, supports, contradicts, routes, attenuates
- **Gate:** `ACCEPT | REVISE | REJECT | ABSTAIN`

The graph can run as:

- a **post-generation release gate** around any RAG model
- a **LLaMA wrapper** that regenerates unsafe drafts from evidence-only prompts
- a **graph adapter / logits processor** for Hugging Face generation

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

The Python engine can be run directly:

```bash
python3 -m truthlayer verify \
  --claim "Mount Everest is 6848 meters tall." \
  --evidence "Mount Everest is Earths highest mountain above sea level, with an elevation of 8,849 meters."
```

The offline graph-gate eval can be run with:

```bash
python3 -m truthlayer bench
```

For a real model before/after run:

```bash
python3 experiments/run_llama_before_after.py \
  --model meta-llama/Llama-3.2-1B-Instruct \
  --prompt "Answer the question with citations..." \
  --evidence-file evidence.txt
```

---

## Stack

- **Next.js 16** (App Router)
- **Tailwind CSS**
- **TruthLayer graph gate** — typed claim/evidence graph + risk-conditioned release control
- **Python core package** — `truthlayer` modules for signals, graph, gate, pipeline, benchmark, and CLI
- **Optional LLaMA integration** — Hugging Face wrapper, graph adapter, logits processor
- **Perplexity Sonar API** — answer generation
- **HuggingFace Inference API** — NLI cross-encoder (Stage 2)
- **OpenRouter** — LLM judge (Stage 3)
- **Wikipedia REST API, Jina Reader, Serper** — source retrieval

## Python Package Structure

```text
truthlayer/
  types.py       # dataclasses and literals for verifier outputs
  text.py        # normalization, tokenization, entity/number helpers
  evidence.py    # evidence-window selection
  signals.py     # deterministic signal registry
  graph.py       # claim-evidence graph builder
  gate.py        # ACCEPT / REVISE / REJECT / ABSTAIN policy
  pipeline.py    # one-call verification API
  benchmark.py   # local benchmark runner
  cli.py         # python -m truthlayer

truthlayer_llama/
  adapter.py          # graph-conditioned hidden-state adapter
  logits_processor.py # Hugging Face risk logits processor
  llama_wrapper.py    # baseline vs verified LLaMA wrapper
```

Use it as a library:

```python
from truthlayer import TruthLayerPipeline

result = TruthLayerPipeline().verify(claim, evidence)
print(result.decision, result.reason)
```

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

See:

- [paper/truthlayer_graph_gated_vag.tex](paper/truthlayer_graph_gated_vag.tex) — arXiv-style paper source
- [paper/references.bib](paper/references.bib) — BibTeX bibliography
- [docs/research-brief.md](docs/research-brief.md) — web-oriented research brief

The paper covers:

- Verification-Augmented Generation architecture
- Claim-evidence graph modeling
- Python-first verification engine
- LLaMA wrapper, graph adapter, and logits processor integration
- Before/after graph-gate evaluation
- Deterministic signal design with per-signal precision analysis
- Benchmark methodology and results
- Hallucination reduction analysis
- Relation to FEVER, FActScore, SAFE, Minicheck

---

## License

MIT

## Author

Created and maintained by **Tanush Appapogu**.
