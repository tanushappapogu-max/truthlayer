"""Dataset loaders and the unified claim/evidence schema used by every runner."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict
from pathlib import Path

RESULTS_DIR = Path(__file__).resolve().parent.parent / "e1_external_validation" / "results"


@dataclass
class ClaimEvidencePair:
    id: str
    claim: str      # the generated claim/sentence
    evidence: str   # the source document/passage
    label: int      # 1 = supported, 0 = unsupported
    dataset: str    # AggreFact sub-dataset name

    def to_dict(self) -> dict:
        return asdict(self)


def load_aggrefact(split: str = "test", limit: int = 0, snapshot: bool = True) -> list[ClaimEvidencePair]:
    """Load LLM-AggreFact and map into ClaimEvidencePair.

    Test split is for headline numbers only. Dev split is for threshold
    tuning. Never tune on test.
    """
    from datasets import load_dataset

    ds = load_dataset("lytang/LLM-AggreFact", split=split)

    pairs: list[ClaimEvidencePair] = []
    for i, row in enumerate(ds):
        pairs.append(ClaimEvidencePair(
            id=f"{split}-{i}",
            claim=row["claim"],
            evidence=row["doc"],
            label=int(row["label"]),
            dataset=row["dataset"],
        ))
        if limit and len(pairs) >= limit:
            break

    if snapshot and not limit and split == "test":
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        snap_path = RESULTS_DIR / "data_snapshot.parquet"
        if not snap_path.exists():
            ds.to_parquet(str(snap_path))

    return pairs


def dataset_hash(pairs: list[ClaimEvidencePair]) -> str:
    """Stable content hash of the loaded data, recorded in every manifest."""
    h = hashlib.sha256()
    for p in pairs:
        h.update(p.id.encode())
        h.update(p.claim.encode())
        h.update(str(p.label).encode())
    return h.hexdigest()[:16]
