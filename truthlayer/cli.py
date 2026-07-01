from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path

from .benchmark import BenchmarkRunner
from .pipeline import TruthLayerPipeline


def _read_text(value: str | None, file: Path | None) -> str:
    if file:
        return file.read_text(encoding="utf-8")
    if value:
        return value
    raise SystemExit("Provide inline text or a file.")


def verify_command(args: argparse.Namespace) -> None:
    claim = _read_text(args.claim, args.claim_file)
    evidence = _read_text(args.evidence, args.evidence_file)
    result = TruthLayerPipeline().verify(claim, evidence, source_id=args.source_id)
    payload = result.to_dict()
    if not args.include_graph:
        payload.pop("graph", None)
    print(json.dumps(payload, indent=2))


def bench_command(args: argparse.Namespace) -> None:
    runner = BenchmarkRunner()
    cases = runner.load_cases(args.data)
    summary = runner.run(cases, limit=args.limit)
    print(json.dumps(summary.to_dict(), indent=2))


def graph_command(args: argparse.Namespace) -> None:
    claim = _read_text(args.claim, args.claim_file)
    evidence = _read_text(args.evidence, args.evidence_file)
    result = TruthLayerPipeline().verify(claim, evidence, source_id=args.source_id)
    print(json.dumps(asdict(result.graph), indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="truthlayer", description="Python-first TruthLayer verification engine.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    verify = subcommands.add_parser("verify", help="Verify one claim against evidence text.")
    verify.add_argument("--claim")
    verify.add_argument("--claim-file", type=Path)
    verify.add_argument("--evidence")
    verify.add_argument("--evidence-file", type=Path)
    verify.add_argument("--source-id", default="source:0")
    verify.add_argument("--include-graph", action="store_true")
    verify.set_defaults(func=verify_command)

    graph = subcommands.add_parser("graph", help="Emit the claim-evidence graph for one claim.")
    graph.add_argument("--claim")
    graph.add_argument("--claim-file", type=Path)
    graph.add_argument("--evidence")
    graph.add_argument("--evidence-file", type=Path)
    graph.add_argument("--source-id", default="source:0")
    graph.set_defaults(func=graph_command)

    bench = subcommands.add_parser("bench", help="Run the local benchmark JSON.")
    bench.add_argument("--data", type=Path, default=Path("public/benchmark-data.json"))
    bench.add_argument("--limit", type=int, default=0)
    bench.set_defaults(func=bench_command)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)
