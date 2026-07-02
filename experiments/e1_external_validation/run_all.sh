#!/usr/bin/env bash
# Reproduces every E1 table from scratch. One model in memory at a time.
set -euo pipefail
cd "$(dirname "$0")"
PY=../../.venv/bin/python

echo "== 1/6 signals (test) =="
$PY run_signals.py --split test

echo "== 2/6 NLI threshold tune (dev) =="
$PY run_nli.py --tune

echo "== 3/6 NLI (test) =="
$PY run_nli.py --split test

echo "== 4/6 MiniCheck (test, official 0.5 threshold) =="
$PY run_minicheck.py --split test

echo "== 5/6 tiered (test) =="
$PY run_tiered.py --split test

echo "== 6/6 ablation + tables + figures =="
$PY ablation.py
$PY make_tables.py
$PY ../figures/make_pareto.py
$PY ../figures/make_signal_bars.py

echo "Done. Tables in results/ and paper/results/."
