'use client';

import { useState } from 'react';
import Link from 'next/link';

type Verdict = 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE' | 'UNREACHABLE';

interface BenchmarkCase {
  id: number;
  claim: string;
  sourceUrl: string;
  groundTruth: 'SUPPORTED' | 'UNSUPPORTED';
  category: string;
}

interface BenchmarkResult extends BenchmarkCase {
  predicted: Verdict | null;
  correct: boolean | null;
}

const CASES: BenchmarkCase[] = [
  // --- SUPPORTED (true claims, verifiable from source) ---
  {
    id: 1,
    claim: 'NASA was founded in 1958.',
    sourceUrl: 'https://www.nasa.gov/history/',
    groundTruth: 'SUPPORTED',
    category: 'Government',
  },
  {
    id: 2,
    claim: 'The WHO declared COVID-19 a pandemic on March 11, 2020.',
    sourceUrl: 'https://www.who.int/director-general/speeches/detail/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020',
    groundTruth: 'SUPPORTED',
    category: 'Health',
  },
  {
    id: 3,
    claim: 'OpenAI released GPT-4 in March 2023.',
    sourceUrl: 'https://openai.com/research/gpt-4',
    groundTruth: 'SUPPORTED',
    category: 'AI',
  },
  {
    id: 4,
    claim: 'Apple became the first U.S. company to reach a $1 trillion market cap.',
    sourceUrl: 'https://www.bbc.com/news/business-45100234',
    groundTruth: 'SUPPORTED',
    category: 'Business',
  },
  {
    id: 5,
    claim: 'The Pfizer-BioNTech COVID-19 vaccine received FDA emergency use authorization in December 2020.',
    sourceUrl: 'https://www.fda.gov/emergency-preparedness-and-response/coronavirus-disease-2019-covid-19/pfizer-biontech-covid-19-vaccines',
    groundTruth: 'SUPPORTED',
    category: 'Health',
  },
  {
    id: 6,
    claim: 'The Paris Agreement was adopted in 2015 to limit global warming.',
    sourceUrl: 'https://unfccc.int/process-and-meetings/the-paris-agreement',
    groundTruth: 'SUPPORTED',
    category: 'Policy',
  },
  {
    id: 7,
    claim: 'Python was created by Guido van Rossum.',
    sourceUrl: 'https://docs.python.org/3/faq/general.html',
    groundTruth: 'SUPPORTED',
    category: 'Tech',
  },
  {
    id: 8,
    claim: 'The James Webb Space Telescope launched on December 25, 2021.',
    sourceUrl: 'https://www.nasa.gov/mission/webb/',
    groundTruth: 'SUPPORTED',
    category: 'Science',
  },
  // --- UNSUPPORTED (hallucinated claims) ---
  {
    id: 9,
    claim: 'Elon Musk founded Tesla Motors in 2003.',
    sourceUrl: 'https://www.tesla.com/about',
    groundTruth: 'UNSUPPORTED',
    category: 'Business',
  },
  {
    id: 10,
    claim: 'The iPhone was first released in 2008.',
    sourceUrl: 'https://www.apple.com/newsroom/2007/01/09apple-reinvents-the-phone-with-iphone/',
    groundTruth: 'UNSUPPORTED',
    category: 'Tech',
  },
  {
    id: 11,
    claim: 'ChatGPT was released by Google in November 2022.',
    sourceUrl: 'https://openai.com/blog/chatgpt',
    groundTruth: 'UNSUPPORTED',
    category: 'AI',
  },
  {
    id: 12,
    claim: 'The Moderna COVID-19 vaccine is 100% effective against all variants.',
    sourceUrl: 'https://www.cdc.gov/coronavirus/2019-ncov/vaccines/different-vaccines/Moderna.html',
    groundTruth: 'UNSUPPORTED',
    category: 'Health',
  },
  {
    id: 13,
    claim: 'Amazon was founded in Seattle in 1997.',
    sourceUrl: 'https://www.aboutamazon.com/about-us',
    groundTruth: 'UNSUPPORTED',
    category: 'Business',
  },
  {
    id: 14,
    claim: 'The Artemis I mission successfully landed astronauts on the Moon.',
    sourceUrl: 'https://www.nasa.gov/missions/artemis/artemis-i/',
    groundTruth: 'UNSUPPORTED',
    category: 'Science',
  },
  {
    id: 15,
    claim: 'Python 4.0 was released in 2023.',
    sourceUrl: 'https://docs.python.org/3/whatsnew/index.html',
    groundTruth: 'UNSUPPORTED',
    category: 'Tech',
  },
];

const STATUS_COLORS: Record<Verdict, string> = {
  SUPPORTED: 'bg-green-500/20 text-green-400',
  UNSUPPORTED: 'bg-red-500/20 text-red-400',
  UNVERIFIABLE: 'bg-purple-500/20 text-purple-400',
  UNREACHABLE: 'bg-yellow-500/20 text-yellow-400',
};

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
        // UNVERIFIABLE = we skip from scoring (not a wrong call, just insufficient source)
        const scorable = predicted !== 'UNREACHABLE' && predicted !== 'UNVERIFIABLE';
        const correct = scorable ? predicted === c.groundTruth : null;
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

  const scored = results.filter((r) => r.predicted && r.predicted !== 'UNREACHABLE' && r.predicted !== 'UNVERIFIABLE');
  const tp = scored.filter((r) => r.predicted === 'UNSUPPORTED' && r.groundTruth === 'UNSUPPORTED').length;
  const fp = scored.filter((r) => r.predicted === 'UNSUPPORTED' && r.groundTruth === 'SUPPORTED').length;
  const fn = scored.filter((r) => r.predicted === 'SUPPORTED' && r.groundTruth === 'UNSUPPORTED').length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const unverifiable = results.filter((r) => r.predicted === 'UNVERIFIABLE').length;
  const unreachable = results.filter((r) => r.predicted === 'UNREACHABLE').length;

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
              {CASES.length} real-world claim/source pairs across AI, health, science, business, and policy.
              Sourced from nasa.gov, openai.com, bbc.com, cdc.gov, and more.
            </p>
          </div>
          <button
            onClick={runBenchmark}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-50 text-sm font-medium transition-colors shrink-0"
          >
            {running ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>

        {done && (
          <>
            <div className="w-full grid grid-cols-3 gap-4 mb-4">
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
            <div className="w-full flex gap-4 text-xs text-gray-500 mb-8">
              <span className="text-purple-400">{unverifiable} unverifiable (excluded from score — source insufficient)</span>
              <span className="text-yellow-400">{unreachable} unreachable (fetch failed)</span>
              <span className="text-gray-400">{scored.length} scored</span>
            </div>
          </>
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2e3050] text-gray-400 uppercase tracking-wide">{r.category}</span>
                    </div>
                    <p className="text-gray-200">{r.claim}</p>
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
                      r.groundTruth === 'SUPPORTED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      Truth: {r.groundTruth}
                    </span>
                    {r.predicted ? (
                      <span className={`px-2 py-0.5 rounded font-medium ${STATUS_COLORS[r.predicted]}`}>
                        Got: {r.predicted}
                      </span>
                    ) : (
                      <span className="text-gray-600 animate-pulse text-[11px]">testing...</span>
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
