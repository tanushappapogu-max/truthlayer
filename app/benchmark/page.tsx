'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { VerifyStatus, DetectorSignal, SignalName, ConfusionMatrix, ThresholdPoint } from '@/lib/truthlayer';
import { computeConfusionMatrix, computeBenchmarkAnalysis, computeThresholdSweep } from '@/lib/truthlayer';

type Filter = 'all' | 'correct' | 'wrong' | 'unverifiable' | 'unreachable';
type BenchmarkTab = 'results' | 'matrix' | 'sweep' | 'ablation' | 'trace';

interface RawCase {
  claim: string;
  url: string;
  expected: 'SUPPORTED' | 'UNSUPPORTED';
  evidence: string;
  category?: string;
}

interface BenchmarkCase extends RawCase {
  id: number;
}

interface BenchmarkResult extends BenchmarkCase {
  predicted: VerifyStatus | null;
  confidence?: number;
  signals?: DetectorSignal[];
  tier?: number;
  sourceExcerpt?: string;
}

const BATCH = 4;
const PAGE_SIZE = 50;

const ALL_SIGNALS: { name: SignalName; label: string }[] = [
  { name: 'SOURCE_RETRIEVAL', label: 'Source retrieval' },
  { name: 'LEXICAL_OVERLAP', label: 'Lexical overlap' },
  { name: 'EVIDENCE_COVERAGE', label: 'Evidence coverage' },
  { name: 'NUMERIC_CONTRADICTION', label: 'Numeric contradiction' },
  { name: 'CONTRAST_CONTRADICTION', label: 'Contrast contradiction' },
  { name: 'RELATION_CONTRADICTION', label: 'Relation mismatch' },
  { name: 'ENTITY_SUBSTITUTION', label: 'Entity substitution' },
  { name: 'HEDGING_MISMATCH', label: 'Hedging mismatch' },
  { name: 'QUOTE_MATCH', label: 'Quote match' },
  { name: 'LLM_JUDGE', label: 'LLM judge' },
  { name: 'NLI_MODEL', label: 'NLI model' },
];

const STATUS_STYLE: Record<VerifyStatus, { bg: string; text: string; label: string }> = {
  SUPPORTED:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Supported' },
  UNSUPPORTED:  { bg: 'bg-red-500/15',     text: 'text-red-400',     label: 'Flagged'   },
  UNVERIFIABLE: { bg: 'bg-purple-500/15',  text: 'text-purple-400',  label: 'Uncertain' },
  UNREACHABLE:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: 'Unreachable' },
};

function pct(value: number) { return `${(value * 100).toFixed(1)}%`; }

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[#13141c] border border-[#1e2030] rounded-xl p-4 flex flex-col gap-1">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-white">{label}</p>
      <p className="text-[11px] text-[#4a4e6a] leading-tight">{sub}</p>
    </div>
  );
}

// --- Confusion Matrix visualization ---

function ConfusionMatrixView({ matrix }: { matrix: ConfusionMatrix }) {
  const total = matrix.tp + matrix.fp + matrix.fn + matrix.tn;
  const cellColor = (value: number, isCorrect: boolean) => {
    const intensity = total > 0 ? Math.min(value / (total * 0.35), 1) : 0;
    if (isCorrect) return `rgba(52, 211, 153, ${intensity * 0.4})`;
    return `rgba(248, 113, 113, ${intensity * 0.5})`;
  };

  return (
    <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Confusion Matrix</h3>
      <div className="flex gap-6 items-start">
        <div className="flex flex-col items-center">
          <div className="text-[10px] text-[#4a4e6a] uppercase tracking-widest mb-2 -ml-12">Predicted ↓ / Actual →</div>
          <div className="grid grid-cols-3 gap-0.5 text-xs">
            <div />
            <div className="text-center py-2 px-4 text-[#8b8fa8] font-semibold text-[10px] uppercase tracking-wider">Actually False</div>
            <div className="text-center py-2 px-4 text-[#8b8fa8] font-semibold text-[10px] uppercase tracking-wider">Actually True</div>

            <div className="flex items-center justify-end pr-3 text-[#8b8fa8] font-semibold text-[10px] uppercase tracking-wider">Flagged</div>
            <div
              className="rounded-lg p-4 text-center border border-[#1e2030] transition-all"
              style={{ background: cellColor(matrix.tp, true) }}
            >
              <p className="text-2xl font-bold text-emerald-400">{matrix.tp}</p>
              <p className="text-[10px] text-[#8b8fa8] mt-1">True Positive</p>
            </div>
            <div
              className="rounded-lg p-4 text-center border border-[#1e2030] transition-all"
              style={{ background: cellColor(matrix.fp, false) }}
            >
              <p className="text-2xl font-bold text-red-400">{matrix.fp}</p>
              <p className="text-[10px] text-[#8b8fa8] mt-1">False Positive</p>
            </div>

            <div className="flex items-center justify-end pr-3 text-[#8b8fa8] font-semibold text-[10px] uppercase tracking-wider">Verified</div>
            <div
              className="rounded-lg p-4 text-center border border-[#1e2030] transition-all"
              style={{ background: cellColor(matrix.fn, false) }}
            >
              <p className="text-2xl font-bold text-red-400">{matrix.fn}</p>
              <p className="text-[10px] text-[#8b8fa8] mt-1">False Negative</p>
            </div>
            <div
              className="rounded-lg p-4 text-center border border-[#1e2030] transition-all"
              style={{ background: cellColor(matrix.tn, true) }}
            >
              <p className="text-2xl font-bold text-emerald-400">{matrix.tn}</p>
              <p className="text-[10px] text-[#8b8fa8] mt-1">True Negative</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="rounded-lg bg-[#0c0d12] border border-[#1e2030] p-3">
            <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest mb-1">Interpretation</p>
            <p className="text-xs text-[#8b8fa8] leading-relaxed">
              <span className="text-emerald-400 font-semibold">TP:</span> correctly caught a hallucination.{' '}
              <span className="text-red-400 font-semibold">FP:</span> flagged a true claim (false alarm).{' '}
              <span className="text-red-400 font-semibold">FN:</span> missed a hallucination (false accept).{' '}
              <span className="text-emerald-400 font-semibold">TN:</span> correctly passed a true claim.
            </p>
          </div>
          <div className="rounded-lg bg-[#0c0d12] border border-[#1e2030] p-3">
            <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest mb-1">Paper metric</p>
            <p className="text-xs text-[#8b8fa8] leading-relaxed">
              False Accept Rate = FN / (FN + TP) = {matrix.tp + matrix.fn > 0 ? pct(matrix.fn / (matrix.fn + matrix.tp)) : '—'}.
              This is the fraction of hallucinations the gate lets through.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Threshold Sweep visualization ---

function ThresholdSweepView({ points }: { points: ThresholdPoint[] }) {
  const height = 200;
  const width = 400;
  const pad = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const line = (data: ThresholdPoint[], accessor: (p: ThresholdPoint) => number, color: string) => {
    const points = data.map((p, i) => {
      const x = pad.left + (i / (data.length - 1)) * chartW;
      const y = pad.top + (1 - accessor(p)) * chartH;
      return `${x},${y}`;
    });
    return <polyline key={color} points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" opacity="0.8" />;
  };

  const bestF1 = points.reduce((best, p) => p.f1 > best.f1 ? p : best, points[0]);

  return (
    <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6">
      <h3 className="text-sm font-semibold text-white mb-1">Threshold Sweep</h3>
      <p className="text-[11px] text-[#4a4e6a] mb-4">Precision, recall, F1 as a function of confidence threshold</p>

      <div className="flex gap-6 items-start">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[400px]">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <g key={v}>
              <line x1={pad.left} y1={pad.top + (1-v)*chartH} x2={pad.left + chartW} y2={pad.top + (1-v)*chartH} stroke="#1e2030" strokeWidth="1" />
              <text x={pad.left - 5} y={pad.top + (1-v)*chartH + 4} textAnchor="end" fill="#4a4e6a" fontSize="9">{(v*100).toFixed(0)}%</text>
            </g>
          ))}

          {/* X axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <text key={`x-${v}`} x={pad.left + v * chartW} y={height - 5} textAnchor="middle" fill="#4a4e6a" fontSize="9">{v.toFixed(2)}</text>
          ))}
          <text x={pad.left + chartW / 2} y={height} textAnchor="middle" fill="#6366f1" fontSize="9">Confidence threshold</text>

          {/* Lines */}
          {line(points, p => p.precision, '#34d399')}
          {line(points, p => p.recall, '#60a5fa')}
          {line(points, p => p.f1, '#a78bfa')}

          {/* Best F1 marker */}
          {bestF1 && (
            <circle
              cx={pad.left + (bestF1.threshold) * chartW}
              cy={pad.top + (1 - bestF1.f1) * chartH}
              r="4"
              fill="#a78bfa"
              stroke="#0c0d12"
              strokeWidth="2"
            />
          )}
        </svg>

        <div className="space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 bg-emerald-400 rounded" />
            <span className="text-[#8b8fa8]">Precision</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 bg-blue-400 rounded" />
            <span className="text-[#8b8fa8]">Recall</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 bg-purple-400 rounded" />
            <span className="text-[#8b8fa8]">F1 score</span>
          </div>
          {bestF1 && (
            <div className="mt-3 rounded-lg bg-[#0c0d12] border border-[#1e2030] p-2.5 text-[11px]">
              <p className="text-[#4a4e6a] uppercase tracking-widest mb-1">Optimal</p>
              <p className="text-white font-semibold">θ = {bestF1.threshold.toFixed(2)}</p>
              <p className="text-purple-400">F1 = {pct(bestF1.f1)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Signal Ablation view ---

function SignalAblationView({ signalStats }: { signalStats: Record<string, { fires: number; correct: number; incorrect: number }> }) {
  const entries = Object.entries(signalStats).sort((a, b) => b[1].fires - a[1].fires);
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6">
        <h3 className="text-sm font-semibold text-white mb-2">Per-Signal Contribution</h3>
        <p className="text-xs text-[#4a4e6a]">Run the benchmark to see signal-level analysis.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6">
      <h3 className="text-sm font-semibold text-white mb-1">Per-Signal Contribution</h3>
      <p className="text-[11px] text-[#4a4e6a] mb-4">How often each signal fires and whether it helps or hurts accuracy</p>

      <div className="space-y-2">
        {entries.map(([name, stats]) => {
          const accuracy = stats.fires > 0 ? stats.correct / stats.fires : 0;
          const label = ALL_SIGNALS.find(s => s.name === name)?.label ?? name;

          return (
            <div key={name} className="flex items-center gap-3 rounded-lg bg-[#0c0d12] border border-[#1e2030] px-3 py-2">
              <span className="text-[11px] font-semibold text-gray-200 w-40 shrink-0">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-[#1e2030] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${accuracy >= 0.7 ? 'bg-emerald-400' : accuracy >= 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: pct(accuracy) }}
                />
              </div>
              <span className={`text-[11px] font-semibold w-12 text-right ${accuracy >= 0.7 ? 'text-emerald-400' : accuracy >= 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                {pct(accuracy)}
              </span>
              <span className="text-[10px] text-[#4a4e6a] w-16 text-right">{stats.fires} fires</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Gold Trace view ---

function GoldTraceView({ result }: { result: BenchmarkResult }) {
  if (!result.predicted) return null;

  const isCorrect = result.predicted === result.expected;
  const signals = result.signals?.slice().sort((a, b) => (b.score * b.weight) - (a.score * a.weight)) ?? [];

  return (
    <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Gold Trace #{result.id + 1}</h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isCorrect ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          {isCorrect ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      {/* Pipeline flow */}
      <div className="space-y-3">
        {/* Claim */}
        <div className="rounded-lg bg-[#0c0d12] border border-[#1e2030] p-3">
          <p className="text-[10px] text-[#6366f1] uppercase tracking-widest font-semibold mb-1">1. Claim</p>
          <p className="text-xs text-gray-200 leading-relaxed">{result.claim}</p>
        </div>

        <div className="flex justify-center"><span className="text-[#2e3050] text-lg">↓</span></div>

        {/* Evidence */}
        <div className="rounded-lg bg-[#0c0d12] border border-[#1e2030] p-3">
          <p className="text-[10px] text-[#6366f1] uppercase tracking-widest font-semibold mb-1">2. Evidence window</p>
          <p className="text-xs text-gray-300 leading-relaxed italic border-l-2 border-[#2e3050] pl-3">{result.evidence}</p>
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#4a4e6a] hover:text-[#6366f1] mt-1 block truncate">{result.url}</a>
        </div>

        <div className="flex justify-center"><span className="text-[#2e3050] text-lg">↓</span></div>

        {/* Signals */}
        <div className="rounded-lg bg-[#0c0d12] border border-[#1e2030] p-3">
          <p className="text-[10px] text-[#6366f1] uppercase tracking-widest font-semibold mb-2">3. Detector signals</p>
          {signals.length > 0 ? (
            <div className="space-y-1.5">
              {signals.map((signal, i) => (
                <div key={`${signal.name}-${i}`} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    signal.verdict === 'SUPPORT' ? 'bg-emerald-400' :
                    signal.verdict === 'CONTRADICT' ? 'bg-red-400' :
                    signal.verdict === 'INSUFFICIENT' ? 'bg-amber-400' : 'bg-[#4a4e6a]'
                  }`} />
                  <span className="text-gray-300 font-medium w-36 shrink-0">{signal.label}</span>
                  <span className="text-[#4a4e6a] flex-1 truncate">{signal.rationale}</span>
                  <span className="text-[#6366f1] font-semibold shrink-0">{Math.round(signal.score * 100)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#4a4e6a]">No signal data available</p>
          )}
        </div>

        <div className="flex justify-center"><span className="text-[#2e3050] text-lg">↓</span></div>

        {/* Verdict */}
        <div className="rounded-lg bg-[#0c0d12] border border-[#1e2030] p-3">
          <p className="text-[10px] text-[#6366f1] uppercase tracking-widest font-semibold mb-1">4. Verdict</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-[#4a4e6a] mb-0.5">Predicted</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[result.predicted].bg} ${STATUS_STYLE[result.predicted].text}`}>
                {result.predicted}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-[#4a4e6a] mb-0.5">Expected</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${result.expected === 'SUPPORTED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {result.expected}
              </span>
            </div>
            {result.confidence != null && (
              <div>
                <p className="text-[10px] text-[#4a4e6a] mb-0.5">Confidence</p>
                <span className="text-xs font-semibold text-[#6366f1]">{pct(result.confidence)}</span>
              </div>
            )}
            {result.tier != null && (
              <div>
                <p className="text-[10px] text-[#4a4e6a] mb-0.5">Tier</p>
                <span className="text-xs font-semibold text-[#8b8fa8]">Stage {result.tier}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---

export default function BenchmarkPage() {
  const [cases, setCases] = useState<BenchmarkCase[]>([]);
  const [results, setResults] = useState<Map<number, { verdict: VerifyStatus; confidence?: number; signals?: DetectorSignal[]; tier?: number; sourceExcerpt?: string }>>(new Map());
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<BenchmarkTab>('results');
  const [traceId, setTraceId] = useState<number | null>(null);
  const [disabledSignals, setDisabledSignals] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);

  useEffect(() => {
    fetch('/benchmark-data.json')
      .then(r => r.json())
      .then((raw: RawCase[]) => {
        setCases(raw.map((c, i) => ({ ...c, id: i })));
      })
      .catch(() => setLoadError('Failed to load benchmark-data.json'));
  }, []);

  async function runBenchmark() {
    if (!cases.length) return;
    abortRef.current = false;
    setRunning(true);
    setDone(false);
    setResults(new Map());
    setProgress(0);
    setPage(0);
    setFilter('all');

    let completed = 0;
    const total = cases.length;

    for (let i = 0; i < total; i += BATCH) {
      if (abortRef.current) break;
      const batch = cases.slice(i, i + BATCH);

      if (i > 0) await new Promise(r => setTimeout(r, 300));

      await Promise.all(batch.map(async (c) => {
        try {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              answer: `${c.claim} [1]`,
              citations: [c.url],
              disabledSignals: [...disabledSignals],
            }),
          });
          const data = await res.json();
          const r = data.results?.[0];
          setResults(prev => new Map(prev).set(c.id, {
            verdict: r?.status ?? 'UNREACHABLE',
            confidence: r?.confidence,
            signals: r?.signals,
            tier: r?.tier,
            sourceExcerpt: r?.sourceExcerpt,
          }));
        } catch {
          setResults(prev => new Map(prev).set(c.id, { verdict: 'UNREACHABLE' }));
        }
        completed++;
        setProgress(completed);
      }));
    }

    setRunning(false);
    setDone(true);
  }

  function stopBenchmark() {
    abortRef.current = true;
    setRunning(false);
    setDone(true);
  }

  const exportJSONL = useCallback(() => {
    const lines: string[] = [];
    for (const c of cases) {
      const r = results.get(c.id);
      if (!r) continue;
      lines.push(JSON.stringify({
        id: c.id,
        claim: c.claim,
        url: c.url,
        expected: c.expected,
        predicted: r.verdict,
        confidence: r.confidence,
        tier: r.tier,
        signals: r.signals?.map(s => ({ name: s.name, verdict: s.verdict, score: s.score, weight: s.weight })),
        category: c.category,
      }));
    }
    const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truthlayer-benchmark-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cases, results]);

  // Compute stats
  const allResults: BenchmarkResult[] = cases.map(c => {
    const r = results.get(c.id);
    return { ...c, predicted: r?.verdict ?? null, confidence: r?.confidence, signals: r?.signals, tier: r?.tier, sourceExcerpt: r?.sourceExcerpt };
  });
  const completedResults = allResults.filter(r => r.predicted !== null);

  const predictions = completedResults
    .filter((r): r is BenchmarkResult & { predicted: VerifyStatus } => r.predicted !== null)
    .map(r => ({
      predicted: r.predicted,
      expected: r.expected,
      confidence: r.confidence,
      signals: r.signals,
    }));

  const analysis = predictions.length > 0 ? computeBenchmarkAnalysis(predictions) : null;
  const matrix = predictions.length > 0 ? computeConfusionMatrix(predictions) : null;
  const sweepPoints = predictions.length > 0 ? computeThresholdSweep(predictions) : [];

  const scored = completedResults.filter(r => r.predicted === 'SUPPORTED' || r.predicted === 'UNSUPPORTED');
  const correctCount = scored.filter(r => r.predicted === r.expected).length;
  const wrongCount = scored.filter(r => r.predicted !== r.expected).length;
  const unverifiableCount = completedResults.filter(r => r.predicted === 'UNVERIFIABLE').length;
  const unreachableCount = completedResults.filter(r => r.predicted === 'UNREACHABLE').length;

  // Filter + paginate
  const filtered = completedResults.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'correct') return r.predicted === r.expected;
    if (filter === 'wrong') return r.predicted !== r.expected && r.predicted !== 'UNVERIFIABLE' && r.predicted !== 'UNREACHABLE';
    if (filter === 'unverifiable') return r.predicted === 'UNVERIFIABLE';
    if (filter === 'unreachable') return r.predicted === 'UNREACHABLE';
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const progressPct = cases.length > 0 ? (progress / cases.length) * 100 : 0;

  const traceResult = traceId !== null ? allResults.find(r => r.id === traceId) ?? null : null;

  return (
    <div className="min-h-screen bg-[#0c0d12] text-[#e2e4f0] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2030]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded-lg bg-[#6366f1] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight group-hover:text-white transition-colors">
            Truth<span className="text-[#6366f1]">Layer</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/research" className="text-[11px] text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">Research</Link>
          <span className="text-[11px] text-[#6366f1] font-semibold">Benchmark</span>
          <a href="https://github.com/tanushappapogu-max/truthlayer" target="_blank" rel="noopener noreferrer" className="text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          </a>
        </nav>
      </header>

      <main className="flex flex-col flex-1 px-6 py-8 max-w-6xl mx-auto w-full">

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Citation Verification Benchmark</h1>
          <p className="text-[#8b8fa8] text-sm">
            {cases.length > 0 ? cases.length.toLocaleString() : '...'} labeled claims from{' '}
            <span className="text-[#6366f1]">FEVER + adversarial</span> — Wikipedia as source.
            Confusion matrix, threshold sweep, per-signal ablation, and JSONL export.
          </p>
          {loadError && <p className="text-red-400 text-xs mt-1">{loadError}</p>}
        </div>

        {/* Control bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {!running ? (
            <button
              onClick={runBenchmark}
              disabled={cases.length === 0 || !!loadError}
              className="px-5 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-40 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            >
              {done ? 'Re-run Benchmark' : `Run ${cases.length.toLocaleString()} Cases`}
            </button>
          ) : (
            <button
              onClick={stopBenchmark}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-all"
            >
              Stop
            </button>
          )}
          {done && (
            <button
              onClick={exportJSONL}
              className="px-4 py-2.5 rounded-xl border border-[#2e3050] bg-[#13141c] hover:bg-[#1a1b26] text-sm text-[#8b8fa8] hover:text-white transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export JSONL
            </button>
          )}
          {(running || done) && (
            <span className="text-xs text-[#4a4e6a]">
              {progress.toLocaleString()} / {cases.length.toLocaleString()} completed
            </span>
          )}
        </div>

        {/* Disabled signals (ablation) */}
        {!running && (
          <div className="mb-5">
            <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest mb-2">Ablation: disable signals before running</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SIGNALS.map(s => {
                const isDisabled = disabledSignals.has(s.name);
                return (
                  <button
                    key={s.name}
                    onClick={() => {
                      setDisabledSignals(prev => {
                        const next = new Set(prev);
                        if (isDisabled) next.delete(s.name);
                        else next.add(s.name);
                        return next;
                      });
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                      isDisabled
                        ? 'border-red-500/30 bg-red-500/10 text-red-400 line-through'
                        : 'border-[#2e3050] bg-[#13141c] text-[#8b8fa8] hover:text-white hover:border-[#4a4e6a]'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {(running || (done && progress > 0)) && (
          <div className="mb-6">
            <div className="h-1.5 bg-[#1e2030] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6366f1] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats grid */}
        {(running || done) && progress > 0 && analysis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <StatCard label="Accuracy" value={pct(analysis.accuracy)} sub={`${correctCount}/${scored.length} scored`} color="text-[#6366f1]" />
            <StatCard label="Precision" value={pct(analysis.precision)} sub="Flagged correctly" color="text-emerald-400" />
            <StatCard label="Recall" value={pct(analysis.recall)} sub="Hallucinations caught" color="text-blue-400" />
            <StatCard label="F1 Score" value={pct(analysis.f1)} sub="Harmonic mean" color="text-purple-400" />
            <StatCard label="False Accept" value={pct(analysis.falseAcceptRate)} sub="Missed hallucinations" color="text-red-400" />
            <StatCard label="False Reject" value={pct(analysis.falseRejectRate)} sub="False alarms" color="text-amber-400" />
            <StatCard label="Abstention" value={pct(analysis.abstentionRate)} sub="Unresolvable" color="text-[#4a4e6a]" />
            <StatCard label="ECE" value={pct(analysis.calibrationError)} sub="Calibration error" color="text-pink-400" />
          </div>
        )}

        {/* Tab navigation */}
        {(running || done) && progress > 0 && (
          <div className="flex items-center gap-1 mb-5 border-b border-[#1e2030] pb-px">
            {([
              { key: 'results' as BenchmarkTab, label: 'Results' },
              { key: 'matrix' as BenchmarkTab, label: 'Confusion Matrix' },
              { key: 'sweep' as BenchmarkTab, label: 'Threshold Sweep' },
              { key: 'ablation' as BenchmarkTab, label: 'Signal Analysis' },
              { key: 'trace' as BenchmarkTab, label: 'Gold Trace' },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`text-xs px-4 py-2.5 rounded-t-lg transition-all ${
                  tab === t.key
                    ? 'bg-[#13141c] text-[#6366f1] font-semibold border border-[#1e2030] border-b-[#13141c] -mb-px'
                    : 'text-[#4a4e6a] hover:text-[#8b8fa8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab: Confusion Matrix */}
        {tab === 'matrix' && matrix && (
          <ConfusionMatrixView matrix={matrix} />
        )}

        {/* Tab: Threshold Sweep */}
        {tab === 'sweep' && sweepPoints.length > 0 && (
          <ThresholdSweepView points={sweepPoints} />
        )}

        {/* Tab: Signal Analysis */}
        {tab === 'ablation' && analysis && (
          <SignalAblationView signalStats={analysis.perSignalContribution} />
        )}

        {/* Tab: Gold Trace */}
        {tab === 'trace' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#4a4e6a]">Select a case to inspect the full pipeline:</p>
              <select
                value={traceId ?? ''}
                onChange={e => setTraceId(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-[#13141c] border border-[#1e2030] rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#6366f1]"
              >
                <option value="">Choose case...</option>
                {completedResults.slice(0, 200).map(r => {
                  const isCorrect = r.predicted === r.expected;
                  return (
                    <option key={r.id} value={r.id}>
                      #{r.id + 1} {isCorrect ? '✓' : '✗'} — {r.claim.slice(0, 60)}...
                    </option>
                  );
                })}
              </select>
            </div>
            {traceResult && traceResult.predicted && (
              <GoldTraceView result={traceResult as BenchmarkResult & { predicted: VerifyStatus }} />
            )}
          </div>
        )}

        {/* Tab: Results */}
        {tab === 'results' && (
          <>
            {/* Detail breakdown */}
            {completedResults.length > 0 && (
              <div className="flex items-center gap-4 mb-5 text-[11px] flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {scored.filter(r => r.predicted === 'SUPPORTED').length} verified
                </span>
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {scored.filter(r => r.predicted === 'UNSUPPORTED').length} flagged
                </span>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  {unverifiableCount} uncertain (excluded)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {unreachableCount} unreachable (excluded)
                </span>
              </div>
            )}

            {/* Filter tabs */}
            {completedResults.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {([
                  { key: 'all' as Filter, label: `All (${completedResults.length})` },
                  { key: 'correct' as Filter, label: `Correct (${correctCount})` },
                  { key: 'wrong' as Filter, label: `Wrong (${wrongCount})` },
                  { key: 'unverifiable' as Filter, label: `Uncertain (${unverifiableCount})` },
                  { key: 'unreachable' as Filter, label: `Unreachable (${unreachableCount})` },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => { setFilter(f.key); setPage(0); }}
                    className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                      filter === f.key
                        ? 'border-[#6366f1] bg-[#6366f1]/15 text-[#6366f1]'
                        : 'border-[#1e2030] text-[#4a4e6a] hover:border-[#2e3050] hover:text-[#8b8fa8]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Results table */}
            {pageItems.length > 0 && (
              <>
                <div className="flex flex-col gap-1.5">
                  {pageItems.map(r => {
                    const isCorrect = r.predicted === r.expected;
                    const isScored = r.predicted !== 'UNVERIFIABLE' && r.predicted !== 'UNREACHABLE' && r.predicted !== null;
                    const predicted = r.predicted as VerifyStatus;
                    const ps = predicted ? STATUS_STYLE[predicted] : null;

                    return (
                      <div
                        key={r.id}
                        onClick={() => { setTraceId(r.id); setTab('trace'); }}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs transition-colors cursor-pointer hover:border-[#6366f1]/30 ${
                          !isScored
                            ? 'border-[#1e2030] bg-[#13141c]'
                            : isCorrect
                              ? 'border-emerald-500/20 bg-emerald-500/5'
                              : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        <span className={`mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black ${
                          !isScored ? 'bg-[#1e2030] text-[#4a4e6a]' : isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {!isScored ? '~' : isCorrect ? '✓' : '✗'}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-gray-300 leading-relaxed">{r.claim}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[10px] text-[#4a4e6a] hover:text-[#6366f1] truncate transition-colors"
                            >
                              {r.url}
                            </a>
                            {r.tier && <span className="text-[9px] text-[#2e3050] shrink-0">T{r.tier}</span>}
                            {r.category && <span className="text-[9px] text-[#6366f1]/50 shrink-0">{r.category}</span>}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.expected === 'SUPPORTED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {r.expected === 'SUPPORTED' ? 'True' : 'False'}
                          </span>
                          {ps && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ps.bg} ${ps.text}`}>
                              {ps.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 rounded-lg text-xs border border-[#1e2030] text-[#8b8fa8] disabled:opacity-30 hover:border-[#2e3050] transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-[#4a4e6a]">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 rounded-lg text-xs border border-[#1e2030] text-[#8b8fa8] disabled:opacity-30 hover:border-[#2e3050] transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {running && (
              <div className="flex items-center gap-2 text-xs text-[#4a4e6a] mt-4">
                <svg className="w-3.5 h-3.5 animate-spin text-[#6366f1]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Verifying {BATCH} claims concurrently...
              </div>
            )}
          </>
        )}

        {/* Method footer */}
        {done && (
          <div className="mt-8 pt-4 border-t border-[#1e2030] text-[10px] text-[#4a4e6a] space-y-1">
            <p>TruthLayer gate v0.3 — 3-stage pipeline: deterministic detector → NLI cross-encoder → LLM judge</p>
            <p>Signals: lexical overlap, evidence coverage, numeric contradiction, contrast contradiction, relation mismatch, entity substitution, hedging mismatch, quote match</p>
            <p>Gate policy: REJECT at contradiction &ge; 0.78, ACCEPT at score &ge; 0.82 with all claims supported, ABSTAIN at &gt;25% unresolved</p>
          </div>
        )}
      </main>
    </div>
  );
}
