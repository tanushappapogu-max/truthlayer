"""Metrics for claim verification: balanced accuracy, FAR/FRR, coverage, bootstrap CIs.

Label convention: 1 = supported, 0 = unsupported.
Prediction convention: pred 1 = accept (supported), pred 0 = reject (unsupported).
The "positive class" for precision/recall/F1 is the UNSUPPORTED class (0),
since catching unsupported claims is the point of the system.
"""

from __future__ import annotations

import numpy as np


def core_metrics(labels: list[int], preds: list[int]) -> dict:
    y = np.asarray(labels)
    p = np.asarray(preds)

    # unsupported class = 0. tp = correctly flagged unsupported.
    tp = int(((p == 0) & (y == 0)).sum())
    fp = int(((p == 0) & (y == 1)).sum())
    fn = int(((p == 1) & (y == 0)).sum())
    tn = int(((p == 1) & (y == 1)).sum())

    recall_unsup = tp / (tp + fn) if tp + fn else 0.0   # sensitivity on unsupported
    recall_sup = tn / (tn + fp) if tn + fp else 0.0      # specificity
    precision_unsup = tp / (tp + fp) if tp + fp else 0.0

    return {
        "n": len(labels),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "balanced_accuracy": (recall_unsup + recall_sup) / 2,
        "accuracy": (tp + tn) / len(labels) if labels else 0.0,
        "precision": precision_unsup,
        "recall": recall_unsup,
        "f1": (2 * precision_unsup * recall_unsup / (precision_unsup + recall_unsup))
              if precision_unsup + recall_unsup else 0.0,
        "false_accept_rate": fn / (fn + tp) if fn + tp else 0.0,  # unsupported passed
        "false_reject_rate": fp / (fp + tn) if fp + tn else 0.0,  # supported blocked
    }


def bootstrap_ci(labels: list[int], preds: list[int], metric: str = "balanced_accuracy",
                 n_resamples: int = 1000, seed: int = 42) -> tuple[float, float]:
    """95% bootstrap CI on a metric."""
    rng = np.random.default_rng(seed)
    y = np.asarray(labels)
    p = np.asarray(preds)
    n = len(y)
    vals = []
    for _ in range(n_resamples):
        idx = rng.integers(0, n, n)
        vals.append(core_metrics(y[idx].tolist(), p[idx].tolist())[metric])
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def evaluate_with_abstention(rows: list[dict]) -> dict:
    """Full evaluation honoring abstention.

    Each row: {label, pred, decided}. Reports metrics three ways:
      decided        — only cases the system decided (plus coverage)
      default_accept — undecided counted as accept (pred=1)
      default_escalate — undecided counted as reject/flag (pred=0)
    """
    decided = [r for r in rows if r["decided"]]
    coverage = len(decided) / len(rows) if rows else 0.0

    out = {"coverage": coverage, "n_total": len(rows), "n_decided": len(decided)}

    if decided:
        out["decided"] = core_metrics([r["label"] for r in decided], [r["pred"] for r in decided])
        lo, hi = bootstrap_ci([r["label"] for r in decided], [r["pred"] for r in decided])
        out["decided"]["bacc_ci95"] = [lo, hi]

    for mode, default_pred in (("default_accept", 1), ("default_escalate", 0)):
        labels = [r["label"] for r in rows]
        preds = [r["pred"] if r["decided"] else default_pred for r in rows]
        out[mode] = core_metrics(labels, preds)
        lo, hi = bootstrap_ci(labels, preds)
        out[mode]["bacc_ci95"] = [lo, hi]

    return out


def per_dataset_breakdown(rows: list[dict], mode_default_pred: int = 1) -> dict[str, dict]:
    """Per-sub-dataset metrics (undecided counted with the given default)."""
    by_ds: dict[str, list[dict]] = {}
    for r in rows:
        by_ds.setdefault(r["dataset"], []).append(r)
    return {
        name: core_metrics(
            [r["label"] for r in group],
            [r["pred"] if r["decided"] else mode_default_pred for r in group],
        )
        for name, group in sorted(by_ds.items())
    }
