'use client';

import { useState } from 'react';
import Link from 'next/link';

type Verdict = 'SUPPORTED' | 'UNSUPPORTED' | 'UNREACHABLE';

interface BenchmarkCase {
  id: number;
  question: string;
  claim: string;
  sourceUrl: string;
  groundTruth: 'SUPPORTED' | 'UNSUPPORTED';
}

interface BenchmarkResult extends BenchmarkCase {
  predicted: Verdict | null;
  correct: boolean | null;
}

// 10 real-world cases drawn from known Perplexity hallucination patterns
const CASES: BenchmarkCase[] = [
  {
    id: 1,
    question: 'What is the speed of light?',
    claim: 'The speed of light in a vacuum is approximately 299,792,458 meters per second.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Speed_of_light',
    groundTruth: 'SUPPORTED',
  },
  {
    id: 2,
    question: 'When was the Eiffel Tower built?',
    claim: 'The Eiffel Tower was completed in 1889 and stands 330 meters tall.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
    groundTruth: 'SUPPORTED',
  },
  {
    id: 3,
    question: 'What is GPT-4?',
    claim: 'GPT-4 was released by OpenAI in March 2023.',
    sourceUrl: 'https://en.wikipedia.org/wiki/GPT-4',
    groundTruth: 'SUPPORTED',
  },
  {
    id: 4,
    question: 'Population of Japan',
    claim: 'Japan has a population of approximately 125 million people.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Japan',
    groundTruth: 'SUPPORTED',
  },
  {
    id: 5,
    question: 'What does DNA stand for?',
    claim: 'DNA stands for Deoxyribonucleic acid.',
    sourceUrl: 'https://en.wikipedia.org/wiki/DNA',
    groundTruth: 'SUPPORTED',
  },
  {
    id: 6,
    question: 'Who invented the telephone?',
    claim: 'Thomas Edison invented the telephone in 1876.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Telephone',
    groundTruth: 'UNSUPPORTED',
  },
  {
    id: 7,
    question: 'What is the boiling point of water?',
    claim: 'Water boils at 90 degrees Celsius at standard atmospheric pressure.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Boiling_point',
    groundTruth: 'UNSUPPORTED',
  },
  {
    id: 8,
    question: 'How many bones in the human body?',
    claim: 'The human body has 206 bones in adults.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Human_skeleton',
    groundTruth: 'SUPPORTED',
  },
  {
    id: 9,
    question: 'What is the largest planet?',
    claim: 'Saturn is the largest planet in our solar system.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Jupiter',
    groundTruth: 'UNSUPPORTED',
  },
  {
    id: 10,
    question: 'When did World War II end?',
    claim: 'World War II ended in 1943 with the Allied victory.',
    sourceUrl: 'https://en.wikipedia.org/wiki/World_War_II',
    groundTruth: 'UNSUPPORTED',
  },
];

export default function BenchmarkPage() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function runBenchmark() {
    setRunning(true);
    setDone(false);
    setResults(CASES.map((c) => ({ ...c, predicted: null, correct: null })));

    for (const c of CASES) {
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answer: `${c.claim} [1]`,
            citations: [c.sourceUrl],
          }),
        });
        const data = await res.json();
        const predicted: Verdict = data.results?.[0]?.status ?? 'UNREACHABLE';
        const correct = predicted !== 'UNREACHABLE' && predicted === c.groundTruth;
        setResults((prev) =>
          prev.map((r) => (r.id === c.id ? { ...r, predicted, correct } : r))
        );
      } catch {
        setResults((prev) =>
          prev.map((r) => (r.id === c.id ? { ...r, predicted: 'UNREACHABLE', correct: false } : r))
        );
      }
    }

    setRunning(false);
    setDone(true);
  }

  const scored = results.filter((r) => r.predicted && r.predicted !== 'UNREACHABLE');
  const tp = scored.filter((r) => r.predicted === 'UNSUPPORTED' && r.groundTruth === 'UNSUPPORTED').length;
  const fp = scored.filter((r) => r.predicted === 'UNSUPPORTED' && r.groundTruth === 'SUPPORTED').length;
  const fn = scored.filter((r) => r.predicted === 'SUPPORTED' && r.groundTruth === 'UNSUPPORTED').length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return (
    <div className="min-h-screen bg-[#12131f] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e1f2e]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            Truth<span className="text-[#6366f1]">Layer</span>
          </span>
        </Link>
        <span className="text-xs text-gray-400">Hallucination Benchmark</span>
      </header>

      <main className="flex flex-col items-center flex-1 px-6 py-12 max-w-4xl mx-auto w-full">
        <div className="w-full mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold mb-1">Citation Verification Benchmark</h1>
            <p className="text-gray-400 text-sm">
              10 claim/source pairs — 5 faithful, 5 hallucinated. Measures precision, recall, and F1.
            </p>
          </div>
          <button
            onClick={runBenchmark}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {running ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>

        {done && (
          <div className="w-full grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Precision', value: precision, desc: 'Of flagged claims, how many were actually wrong' },
              { label: 'Recall', value: recall, desc: 'Of all wrong claims, how many did we catch' },
              { label: 'F1 Score', value: f1, desc: 'Harmonic mean of precision and recall' },
            ].map((m) => (
              <div key={m.label} className="bg-[#1e1f2e] border border-[#2e3050] rounded-xl p-4">
                <p className="text-2xl font-bold text-[#6366f1]">{(m.value * 100).toFixed(1)}%</p>
                <p className="text-sm font-medium text-white mt-1">{m.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="w-full flex flex-col gap-3">
            {results.map((r) => (
              <div
                key={r.id}
                className={`border rounded-xl p-4 text-sm transition-colors ${
                  r.correct === true
                    ? 'border-green-500/30 bg-green-500/5'
                    : r.correct === false
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-[#2e3050] bg-[#1e1f2e]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300">{r.claim}</p>
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#6366f1] hover:underline mt-1 block truncate"
                    >
                      {r.sourceUrl}
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-xs">
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      r.groundTruth === 'SUPPORTED'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      Truth: {r.groundTruth}
                    </span>
                    {r.predicted ? (
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        r.predicted === 'SUPPORTED'
                          ? 'bg-green-500/20 text-green-400'
                          : r.predicted === 'UNSUPPORTED'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        Got: {r.predicted}
                      </span>
                    ) : (
                      <span className="text-gray-600 animate-pulse">testing...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
