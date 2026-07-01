# TruthLayer Paper Assets

Primary paper source:

- `truthlayer_graph_gated_vag.tex`
- `truthlayer_graph_gated_vag.md`
- `references.bib`

Figures are served from `../public/figures/` so the same visuals can be used by the app and the paper:

- `truthlayer-architecture.svg`
- `claim-evidence-graph.svg`
- `before-after.svg`

The LLaMA experiment code lives in `../truthlayer_llama/` and `../experiments/`.

Quick local graph-gate eval:

```bash
python3 -m truthlayer bench
```

Inspect one claim:

```bash
python3 -m truthlayer verify --claim "..." --evidence-file evidence.txt --include-graph
```

Single-model before/after run, after installing `torch` and `transformers`:

```bash
python3 experiments/run_llama_before_after.py \
  --model meta-llama/Llama-3.2-1B-Instruct \
  --prompt "Answer the question with citations..." \
  --evidence-file evidence.txt
```
