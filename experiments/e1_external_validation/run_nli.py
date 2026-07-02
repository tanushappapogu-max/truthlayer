"""NLI baseline: cross-encoder/nli-deberta-v3-base.

Score = P(entailment), premise=evidence, hypothesis=claim.
Long evidence is chunked into overlapping ~400-token windows; take max
entailment and max contradiction across windows.

Threshold is tuned on the dev split for balanced accuracy, frozen, then
applied to test. Run with --split dev --tune first (or let run_all.sh
do it); the tuned threshold is stored in results/nli_threshold.json.
"""

from __future__ import annotations

import argparse
import gc
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness import run_and_save, RESULTS  # noqa: E402
from common.data import load_aggrefact  # noqa: E402
from common.metrics import core_metrics  # noqa: E402

MODEL = "cross-encoder/nli-deberta-v3-base"
THRESHOLD_FILE = RESULTS / "nli_threshold.json"
BATCH = 8
WINDOW_TOKENS = 400
STRIDE_TOKENS = 200


def load_model():
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL, torch_dtype=torch.float16 if device == "mps" else torch.float32
    ).to(device).eval()
    return tok, model, device


def chunk_evidence(tok, evidence: str) -> list[str]:
    ids = tok.encode(evidence, add_special_tokens=False)
    if len(ids) <= WINDOW_TOKENS:
        return [evidence]
    chunks = []
    for start in range(0, len(ids), STRIDE_TOKENS):
        window = ids[start:start + WINDOW_TOKENS]
        if len(window) < 50 and chunks:
            break
        chunks.append(tok.decode(window))
        if start + WINDOW_TOKENS >= len(ids):
            break
    return chunks


def score_pair(tok, model, device, claim: str, evidence: str) -> dict:
    """Max entailment / max contradiction probability across evidence windows."""
    import torch

    chunks = chunk_evidence(tok, evidence)
    max_ent, max_con = 0.0, 0.0
    label_map = {v.lower(): k for k, v in model.config.id2label.items()}
    ent_idx = label_map["entailment"]
    con_idx = label_map["contradiction"]

    for i in range(0, len(chunks), BATCH):
        batch = chunks[i:i + BATCH]
        inputs = tok([(c, claim) for c in batch], return_tensors="pt",
                     truncation=True, max_length=512, padding=True).to(device)
        with torch.no_grad():
            probs = torch.softmax(model(**inputs).logits.float(), dim=-1)
        max_ent = max(max_ent, probs[:, ent_idx].max().item())
        max_con = max(max_con, probs[:, con_idx].max().item())

    return {"entailment": max_ent, "contradiction": max_con}


def tune_threshold(tok, model, device, limit: int = 0) -> float:
    """Grid-search the entailment threshold on dev for balanced accuracy."""
    pairs = load_aggrefact("dev", limit=limit, snapshot=False)
    scores, labels = [], []
    from tqdm import tqdm
    for p in tqdm(pairs, desc="nli-dev-tune"):
        scores.append(score_pair(tok, model, device, p.claim, p.evidence)["entailment"])
        labels.append(p.label)

    best_t, best_bacc = 0.5, 0.0
    for t in [i / 100 for i in range(5, 100, 5)]:
        preds = [1 if s >= t else 0 for s in scores]
        bacc = core_metrics(labels, preds)["balanced_accuracy"]
        if bacc > best_bacc:
            best_t, best_bacc = t, bacc

    THRESHOLD_FILE.parent.mkdir(parents=True, exist_ok=True)
    THRESHOLD_FILE.write_text(json.dumps(
        {"threshold": best_t, "dev_balanced_accuracy": best_bacc, "n_dev": len(pairs)}, indent=2))
    print(f"Tuned threshold={best_t} (dev BAcc={best_bacc:.3f}) -> {THRESHOLD_FILE}")
    return best_t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="test", choices=["test", "dev"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=str(RESULTS / "nli.jsonl"))
    ap.add_argument("--tune", action="store_true", help="tune threshold on dev and exit")
    ap.add_argument("--tune-limit", type=int, default=0)
    args = ap.parse_args()

    tok, model, device = load_model()

    if args.tune:
        tune_threshold(tok, model, device, limit=args.tune_limit)
        return

    if not THRESHOLD_FILE.exists():
        raise SystemExit("No tuned threshold. Run: python run_nli.py --tune  (uses dev split)")
    threshold = json.loads(THRESHOLD_FILE.read_text())["threshold"]

    def predict(pair):
        t0 = time.perf_counter()
        s = score_pair(tok, model, device, pair.claim, pair.evidence)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "pred": 1 if s["entailment"] >= threshold else 0,
            "score": s["entailment"],
            "decided": True,
            "signal": None,
            "latency_ms": latency_ms,
        }

    run_and_save("nli", args, predict,
                 extra_manifest={"model": MODEL, "threshold": threshold,
                                 "window_tokens": WINDOW_TOKENS, "batch": BATCH})

    del model
    gc.collect()
    try:
        import torch
        torch.mps.empty_cache()
    except Exception:
        pass


if __name__ == "__main__":
    main()
