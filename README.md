# TruthLayer

A verification layer that catches citation hallucinations in LLM outputs before they reach users.

When a model like Perplexity or ChatGPT cites a source, the URL is usually real and the page is usually relevant — but the specific claim attached to the citation is often wrong. The model says 6,848m, the source says 8,849m. The model says "public university," the source says private. TruthLayer checks every cited claim against its source and blocks answers that don't hold up.

The core idea: most citation errors are structurally detectable with deterministic checks — no model needed. Wrong numbers, swapped names, flipped polarity are pattern mismatches, not subtle semantic judgments. TruthLayer runs eight rule-based signals first and only escalates to an NLI model or LLM judge when the rules can't decide.

## Results

On a 1,036-case benchmark (FEVER-derived claim/source pairs):

| Metric | Value |
|---|---|
| Accuracy (decided cases) | 99.1% |
| Precision | 99.2% |
| False accept rate | 0.8% |
| Coverage | 20.8% (rest escalates to later stages) |

Four of the eight signals — numeric, negation, relation, and type contradiction — had zero false positives across the benchmark.

Against a pass-through baseline that accepts everything, the gate cuts accepted unsupported claims from 529/529 to 19/529.

## How it works

```
LLM output (answer + citation URLs)
    │
    ├── Split answer into atomic claims
    ├── Fetch sources (Wikipedia API → Jina Reader → Serper)
    │
    ├── Stage 1: deterministic signals          free, <1ms
    │     numeric / negation / relation / type contradiction,
    │     contrast pairs, hedging, evidence coverage, entity substitution
    │
    ├── Stage 2: NLI cross-encoder              nli-deberta-v3-base
    ├── Stage 3: LLM judge                      Llama 3.1 8B (fallback only)
    │
    └── Acceptance gate
          ACCEPT / REVISE / REJECT / ABSTAIN
```

Each cited claim gets a full trace: which signals fired, what evidence they matched, and why. When a claim is rejected, the reason is a verifiable fact about the text ("claim says 6,848, source says 8,849"), not a model opinion.

The gate aggregates claim-level verdicts into one answer-level decision. One high-confidence contradiction blocks the whole answer — if one of five citations is provably wrong, the answer isn't trustworthy.

## Signal precision

| Signal | Catches | Precision |
|---|---|---|
| Numeric contradiction | wrong dates/counts/measurements | 100% (44/44) |
| Negation contradiction | claim negates what the source says | 100% (36/36) |
| Relation mismatch | "directed by X" vs "directed by Y" | 100% (21/21) |
| Type contradiction | wrong category ("is a film" vs "is a series") | 100% (13/13) |
| Contrast contradiction | polarity flips (public/private) | 96% (27/28) |
| Hedging mismatch | "always" vs "sometimes" | 83% (20/24) |
| Evidence coverage | irrelevant/off-topic source | 62% |
| Entity substitution | wrong person/org | 54% |

## Repo layout

```
app/               Next.js demo — search UI, /benchmark eval suite, /research writeup
lib/truthlayer.ts  TypeScript detector used by the web app
truthlayer/        Python package — signals, evidence selection, graph, gate, pipeline, CLI
truthlayer_llama/  Hugging Face integration — wrapper, adapter, logits processor
experiments/       eval scripts
docs/              research brief
```

## Usage

Python:

```python
from truthlayer import TruthLayerPipeline

result = TruthLayerPipeline().verify(claim, evidence)
print(result.decision, result.reason)
```

CLI:

```bash
python3 -m truthlayer verify \
  --claim "Mount Everest is 6848 meters tall." \
  --evidence "Mount Everest is Earth's highest mountain, with an elevation of 8,849 meters."

python3 -m truthlayer bench   # run the offline benchmark
```

Web app:

```bash
npm install
npm run dev
```

Requires `PERPLEXITY_API_KEY` in `.env.local`. Optional: `HUGGINGFACE_API_KEY` (enables the NLI stage), `OPENROUTER_API_KEY` (enables the LLM judge).

- Search interface: http://localhost:3000
- Benchmark suite: http://localhost:3000/benchmark — confusion matrix, threshold sweep, per-signal ablation, per-case traces, JSONL export
- Research writeup: http://localhost:3000/research

## Notes

The full writeup — failure taxonomy, signal design, gate policy, comparison to FEVER / FActScore / SAFE / MiniCheck — is in [docs/research-brief.md](docs/research-brief.md).

The internal benchmark is author-constructed from FEVER; external validation against LLM-AggreFact and decode-time gating experiments are in progress under `experiments/`.

## License

MIT
