'use client';

import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import AnswerPanel from '@/components/AnswerPanel';
import SourcesSidebar from '@/components/SourcesSidebar';
import type { VerifyResult } from '@/app/api/verify/route';
import Link from 'next/link';

type SearchState = 'idle' | 'searching' | 'verifying' | 'done';

export default function Home() {
  const [state, setState] = useState<SearchState>('idle');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  const [verifyResults, setVerifyResults] = useState<VerifyResult[]>([]);
  const [error, setError] = useState('');

  async function handleSearch(q: string) {
    setQuery(q);
    setAnswer('');
    setCitations([]);
    setVerifyResults([]);
    setError('');
    setState('searching');

    try {
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const searchData = await searchRes.json();
      if (!searchRes.ok) throw new Error(searchData.error ?? 'Search failed');

      setAnswer(searchData.answer);
      setCitations(searchData.citations ?? []);
      setState('verifying');

      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: searchData.answer, citations: searchData.citations ?? [] }),
      });
      const verifyData = await verifyRes.json();
      setVerifyResults(verifyData.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setState('done');
    }
  }

  const loading = state === 'searching' || state === 'verifying';

  return (
    <div className="min-h-screen bg-[#12131f] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e1f2e]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            Truth<span className="text-[#6366f1]">Layer</span>
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#6366f1]/20 text-[#6366f1] uppercase tracking-widest">
            beta
          </span>
        </div>
        <Link
          href="/benchmark"
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Benchmark →
        </Link>
      </header>

      {/* Main */}
      <main className="flex flex-col items-center flex-1 px-6 py-12">
        {state === 'idle' && (
          <div className="flex flex-col items-center gap-6 mt-24">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">
                Truth<span className="text-[#6366f1]">Layer</span>
              </h1>
              <p className="text-gray-400 text-sm">
                Perplexity answers. Every citation verified.
              </p>
            </div>
            <SearchBar onSearch={handleSearch} loading={loading} />
            <p className="text-[11px] text-gray-600 text-center max-w-sm">
              Powered by Perplexity Sonar · Citations verified against source before they reach you
            </p>
          </div>
        )}

        {state !== 'idle' && (
          <div className="w-full max-w-5xl flex flex-col gap-6">
            <SearchBar onSearch={handleSearch} loading={loading} />

            {state === 'searching' && (
              <div className="flex items-center gap-2 text-gray-400 text-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-bounce" />
                Searching...
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {answer && (
              <div>
                <p className="text-xs text-gray-500 mb-4 font-medium">{query}</p>
                <div className="flex gap-8">
                  <AnswerPanel
                    answer={answer}
                    verifyResults={verifyResults}
                    verifying={state === 'verifying'}
                  />
                  {citations.length > 0 && (
                    <SourcesSidebar
                      citations={citations}
                      verifyResults={verifyResults}
                      verifying={state === 'verifying'}
                    />
                  )}
                </div>

                {state === 'done' && verifyResults.length > 0 && (
                  <div className="mt-6 flex gap-4 text-xs text-gray-500 border-t border-[#1e1f2e] pt-4">
                    <span>✅ {verifyResults.filter((r) => r.status === 'SUPPORTED').length} verified</span>
                    <span>🔴 {verifyResults.filter((r) => r.status === 'UNSUPPORTED').length} flagged</span>
                    <span>🟡 {verifyResults.filter((r) => r.status === 'UNREACHABLE').length} unreachable</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
