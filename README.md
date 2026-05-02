# TruthLayer

**A citation verification engine for AI-generated answers.**

LLMs hallucinate citations. They return real URLs attached to claims those sources never actually make — the link exists, the information doesn't. TruthLayer intercepts answers from Perplexity's Sonar API and runs each cited claim through a groundedness check before it reaches the user. Verified claims pass through. Unsupported ones get flagged with what the source actually says and a corrected rewrite grounded only in the source text.

Think of it as spell check, but for citations.

---

## How It Works

```
User query
    │
    ▼
Perplexity Sonar API ──► answer + citation URLs
    │
    ▼
TruthLayer Verification Engine
    │
    ├── fetch source text (Wikipedia REST API / HTML)
    ├── extract claim per citation
    └── LLM-as-judge: does this source support this claim?
            │
            ├── ✅ SUPPORTED  — passes through
            ├── 🔴 UNSUPPORTED — flagged + corrected rewrite
            └── 🟡 UNREACHABLE — source blocked or unavailable
    │
    ▼
Verified answer rendered inline
```

The verification prompt forces the judge model to respond only from source text — no training knowledge, no interpolation. Corrections are rewritten using only what the source explicitly states.

---

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Perplexity Sonar API** — both the answer generation and the verification judge run on the same model, keeping the system self-contained on one infrastructure stack
- **Wikipedia REST API** — clean text extraction for Wikipedia citations without HTML scraping

---

## Features

- **Inline citation badges** — every `[1]`, `[2]` in the answer gets a live status badge post-verification
- **Click-to-inspect** — click any 🔴 badge to see what the source actually says vs. what was claimed, plus the corrected version
- **Sources sidebar** — color-coded by verification status (green / red / yellow)
- **Benchmark runner** — `/benchmark` runs 10 labeled claim/source pairs (5 faithful, 5 hallucinated) and reports precision, recall, and F1

---

## Benchmark

The `/benchmark` page evaluates the verification engine against a curated set of claim/source pairs with known ground truth labels. Each run reports:

| Metric | Definition |
|---|---|
| **Precision** | Of all flagged claims, what fraction were actually wrong |
| **Recall** | Of all wrong claims, what fraction did the engine catch |
| **F1** | Harmonic mean of precision and recall |

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
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the main interface and [http://localhost:3000/benchmark](http://localhost:3000/benchmark) for the benchmark runner.

A Perplexity API key is required. Get one at [perplexity.ai/settings/api](https://perplexity.ai/settings/api).

---

## Motivation

LLM-powered search products cite sources as a trust signal. When the attribution is wrong, users are misled by the appearance of rigor rather than the presence of it. This project explores what a lightweight, pipeline-compatible groundedness layer looks like in practice — something that could run before an answer is served rather than as a post-hoc audit tool.

---

## License

MIT
