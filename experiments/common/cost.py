"""Latency and cost accounting.

Cost model: measured ms/claim plus a hardware-independent
"model-parameter-invocations per claim" figure:
  signals   = 0 params
  NLI       = 184M params x invocations
  MiniCheck = 783M params x invocations
"""

from __future__ import annotations

import time
from contextlib import contextmanager

PARAMS = {
    "signals": 0,
    "nli": 184_000_000,
    "minicheck": 783_000_000,
}


@contextmanager
def timer(bucket: dict, key: str = "latency_ms"):
    t0 = time.perf_counter()
    yield
    bucket[key] = (time.perf_counter() - t0) * 1000


def cost_summary(rows: list[dict], system: str) -> dict:
    """rows must carry latency_ms and (for tiered) tier per case."""
    lat = [r["latency_ms"] for r in rows]
    n = len(rows)

    if system == "tiered":
        # params only invoked on cases that escalated to NLI
        nli_invocations = sum(1 for r in rows if r.get("tier") == "nli")
        param_invocations = PARAMS["nli"] * nli_invocations
    else:
        param_invocations = PARAMS.get(system, 0) * n

    return {
        "system": system,
        "n": n,
        "ms_per_claim_mean": sum(lat) / n if n else 0.0,
        "ms_per_claim_p50": sorted(lat)[n // 2] if n else 0.0,
        "ms_per_1k_claims": (sum(lat) / n) * 1000 if n else 0.0,
        "param_invocations_per_claim": param_invocations / n if n else 0,
    }
