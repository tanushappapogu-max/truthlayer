'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type Verdict = 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE' | 'UNREACHABLE';
type Filter = 'all' | 'correct' | 'wrong' | 'unverifiable' | 'unreachable';

interface RawCase {
  claim: string;
  url: string;
  expected: 'SUPPORTED' | 'UNSUPPORTED';
  evidence: string;
}

interface BenchmarkCase extends RawCase {
  id: number;
}

interface BenchmarkResult extends BenchmarkCase {
  predicted: Verdict | null;
}

const BATCH = 8;
const PAGE_SIZE = 50;

const STATUS_STYLE: Record<Verdict, { bg: string; text: string; label: string }> = {
  SUPPORTED:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Supported' },
  UNSUPPORTED:  { bg: 'bg-red-500/15',     text: 'text-red-400',     label: 'Flagged'   },
  UNVERIFIABLE: { bg: 'bg-purple-500/15',  text: 'text-purple-400',  label: 'Uncertain' },
  UNREACHABLE:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: 'Unreachable' },
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[#13141c] border border-[#1e2030] rounded-xl p-4 flex flex-col gap-1">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-white">{label}</p>
      <p className="text-[11px] text-[#4a4e6a] leading-tight">{sub}</p>
    </div>
  );
}

export default function BenchmarkPage() {
  const [cases, setCases] = useState<BenchmarkCase[]>([]);
  const [results, setResults] = useState<Map<number, Verdict>>(new Map());
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [loadError, setLoadError] = useState('');
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

      await Promise.all(batch.map(async (c) => {
        try {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              answer: `${c.claim} [1]`,
              citations: [c.url],
            }),
          });
          const data = await res.json();
          const predicted: Verdict = data.results?.[0]?.status ?? 'UNREACHABLE';
          setResults(prev => new Map(prev).set(c.id, predicted));
        } catch {
          setResults(prev => new Map(prev).set(c.id, 'UNREACHABLE'));
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

  // Compute stats
  const scored: BenchmarkResult[] = [];
  let unverifiableCount = 0;
  let unreachableCount = 0;
  let correctCount = 0;
  let wrongCount = 0;

  for (const c of cases) {
    const predicted = results.get(c.id) ?? null;
    if (predicted === 'UNVERIFIABLE') unverifiableCount++;
    else if (predicted === 'UNREACHABLE') unreachableCount++;
    else if (predicted !== null) {
      scored.push({ ...c, predicted });
      if (predicted === c.expected) correctCount++;
      else wrongCount++;
    }
  }

  const tp = scored.filter(r => r.predicted === 'UNSUPPORTED' && r.expected === 'UNSUPPORTED').length;
  const fp = scored.filter(r => r.predicted === 'UNSUPPORTED' && r.expected === 'SUPPORTED').length;
  const fn = scored.filter(r => r.predicted === 'SUPPORTED' && r.expected === 'UNSUPPORTED').length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = scored.length > 0 ? correctCount / scored.length : 0;

  // Filter + paginate display
  const allResults: BenchmarkResult[] = cases.map(c => ({
    ...c,
    predicted: results.get(c.id) ?? null,
  })).filter(r => r.predicted !== null);

  const filtered = allResults.filter(r => {
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
        <span className="text-[11px] text-[#4a4e6a] font-medium uppercase tracking-widest">FEVER Benchmark</span>
      </header>

      <main className="flex flex-col flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Citation Verification Benchmark</h1>
          <p className="text-[#8b8fa8] text-sm">
            {cases.length > 0 ? cases.length.toLocaleString() : '...'} labeled claims from the{' '}
            <span className="text-[#6366f1]">FEVER dataset</span> — 500 true, 500 false.
            Wikipedia as source. Accuracy, precision, recall, F1 computed live.
          </p>
          {loadError && <p className="text-red-400 text-xs mt-1">{loadError}</p>}
        </div>

        {/* Control bar */}
        <div className="flex items-center gap-3 mb-6">
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
          {(running || done) && (
            <span className="text-xs text-[#4a4e6a]">
              {progress.toLocaleString()} / {cases.length.toLocaleString()} completed
            </span>
          )}
        </div>

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
        {(running || done) && progress > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Accuracy"
              value={scored.length > 0 ? `${(accuracy * 100).toFixed(1)}%` : '—'}
              sub={`${correctCount} correct of ${scored.length} scored`}
              color="text-[#6366f1]"
            />
            <StatCard
              label="Precision"
              value={scored.length > 0 ? `${(precision * 100).toFixed(1)}%` : '—'}
              sub="Of flagged: how many were actually wrong"
              color="text-emerald-400"
            />
            <StatCard
              label="Recall"
              value={scored.length > 0 ? `${(recall * 100).toFixed(1)}%` : '—'}
              sub="Of all wrong claims: how many caught"
              color="text-blue-400"
            />
            <StatCard
              label="F1 Score"
              value={scored.length > 0 ? `${(f1 * 100).toFixed(1)}%` : '—'}
              sub="Harmonic mean of precision & recall"
              color="text-purple-400"
            />
          </div>
        )}

        {/* Detail breakdown */}
        {(running || done) && progress > 0 && (
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
            {done && (
              <span className="ml-auto text-[#4a4e6a]">
                FEVER dataset · {cases.length.toLocaleString()} cases
              </span>
            )}
          </div>
        )}

        {/* Filter tabs */}
        {allResults.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {([
              { key: 'all', label: `All (${allResults.length})` },
              { key: 'correct', label: `Correct (${correctCount})` },
              { key: 'wrong', label: `Wrong (${wrongCount})` },
              { key: 'unverifiable', label: `Uncertain (${unverifiableCount})` },
              { key: 'unreachable', label: `Unreachable (${unreachableCount})` },
            ] as { key: Filter; label: string }[]).map(f => (
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
                const isScored = r.predicted !== 'UNVERIFIABLE' && r.predicted !== 'UNREACHABLE';
                const predicted = r.predicted as Verdict;
                const ps = STATUS_STYLE[predicted];

                return (
                  <div
                    key={r.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs transition-colors ${
                      !isScored
                        ? 'border-[#1e2030] bg-[#13141c]'
                        : isCorrect
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    {/* Correctness indicator */}
                    <span className={`mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black ${
                      !isScored ? 'bg-[#1e2030] text-[#4a4e6a]' : isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {!isScored ? '~' : isCorrect ? '✓' : '✗'}
                    </span>

                    {/* Claim */}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 leading-relaxed">{r.claim}</p>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#4a4e6a] hover:text-[#6366f1] truncate block mt-0.5 transition-colors"
                      >
                        {r.url}
                      </a>
                    </div>

                    {/* Labels */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.expected === 'SUPPORTED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {r.expected === 'SUPPORTED' ? 'True' : 'False'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ps.bg} ${ps.text}`}>
                        {ps.label}
                      </span>
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

        {/* In-progress spinner for pending items */}
        {running && (
          <div className="flex items-center gap-2 text-xs text-[#4a4e6a] mt-4">
            <svg className="w-3.5 h-3.5 animate-spin text-[#6366f1]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Verifying {BATCH} claims concurrently...
          </div>
        )}
      </main>
    </div>
  );
}
