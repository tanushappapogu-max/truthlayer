"""Emit results as markdown and LaTeX (booktabs) tables."""

from __future__ import annotations

from pathlib import Path


def _fmt(v, pct=False):
    if isinstance(v, float):
        return f"{v * 100:.1f}" if pct else f"{v:.1f}"
    return str(v)


def headline_table(summaries: list[dict], out_dir: Path) -> None:
    """summaries: [{system, bacc, bacc_ci95, far, frr, coverage, ms_per_claim, params}]"""
    out_dir.mkdir(parents=True, exist_ok=True)

    header = ["System", "BAcc", "95% CI", "FAR", "FRR", "Coverage", "ms/claim", "Params invoked"]
    md_rows, tex_rows = [], []
    for s in summaries:
        ci = f"[{s['bacc_ci95'][0] * 100:.1f}, {s['bacc_ci95'][1] * 100:.1f}]"
        row = [
            s["system"],
            _fmt(s["bacc"], pct=True),
            ci,
            _fmt(s["far"], pct=True),
            _fmt(s["frr"], pct=True),
            _fmt(s["coverage"], pct=True),
            f"{s['ms_per_claim']:.2f}",
            f"{s['params']:,.0f}",
        ]
        md_rows.append(row)
        tex_rows.append(row)

    md = "| " + " | ".join(header) + " |\n"
    md += "|" + "|".join(["---"] * len(header)) + "|\n"
    for r in md_rows:
        md += "| " + " | ".join(r) + " |\n"
    (out_dir / "headline.md").write_text(md)

    tex = "\\begin{tabular}{l" + "r" * (len(header) - 1) + "}\n\\toprule\n"
    tex += " & ".join(header) + " \\\\\n\\midrule\n"
    for r in tex_rows:
        tex += " & ".join(v.replace("%", "\\%") for v in r) + " \\\\\n"
    tex += "\\bottomrule\n\\end{tabular}\n"
    (out_dir / "headline.tex").write_text(tex)


def breakdown_table(breakdowns: dict[str, dict[str, dict]], out_dir: Path) -> None:
    """breakdowns: {system: {sub_dataset: metrics}}. Emits BAcc per sub-dataset."""
    out_dir.mkdir(parents=True, exist_ok=True)
    systems = list(breakdowns.keys())
    sub_datasets = sorted({ds for b in breakdowns.values() for ds in b})

    header = ["Dataset"] + systems
    md = "| " + " | ".join(header) + " |\n"
    md += "|" + "|".join(["---"] * len(header)) + "|\n"
    tex_body = ""
    for ds in sub_datasets:
        row = [ds] + [
            _fmt(breakdowns[s].get(ds, {}).get("balanced_accuracy", float("nan")), pct=True)
            for s in systems
        ]
        md += "| " + " | ".join(row) + " |\n"
        tex_body += " & ".join(row) + " \\\\\n"
    (out_dir / "breakdown.md").write_text(md)

    tex = "\\begin{tabular}{l" + "r" * len(systems) + "}\n\\toprule\n"
    tex += " & ".join(header) + " \\\\\n\\midrule\n" + tex_body
    tex += "\\bottomrule\n\\end{tabular}\n"
    (out_dir / "breakdown.tex").write_text(tex)
