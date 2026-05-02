'use client';

import { useState } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import AnswerPanel from '@/components/AnswerPanel';
import SourcesSidebar from '@/components/SourcesSidebar';
import type { VerifyResult } from '@/app/api/verify/route';

type Stage = 'idle' | 'searching' | 'verifying' | 'done';

const SUGGESTIONS = [
  'What are the health effects of microplastics?',
  'What caused the 2008 financial crisis?',
  'How does mRNA vaccine technology work?',
  'What is the current state of nuclear fusion?',
];

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle');
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
    setStage('searching');

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
      setStage('verifying');

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
      setStage('done');
    }
  }

  const loading = stage === 'searching' || stage === 'verifying';
  const verified   = verifyResults.filter(r => r.status === 'SUPPORTED').length;
  const flagged    = verifyResults.filter(r => r.status === 'UNSUPPORTED').length;
  const uncertain  = verifyResults.filter(r => r.status === 'UNVERIFIABLE').length;
  const unreachable = verifyResults.filter(r => r.status === 'UNREACHABLE').length;

  return (
    <div className="min-h-screen bg-[#0c0d12] text-[#e2e4f0] flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2030]">
        <button onClick={() => setStage('idle')} className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded-lg bg-[#6366f1] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight group-hover:text-white transition-colors">
            Truth<span className="text-[#6366f1]">Layer</span>
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#6366f1]/15 text-[#6366f1] uppercase tracking-widest">
            beta
          </span>
        </button>
        <Link href="/benchmark" className="text-[11px] text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors flex items-center gap-1">
          Benchmark
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </header>

      <main className="flex flex-col flex-1 px-6">

        {/* IDLE */}
        {stage === 'idle' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8 pb-24">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-white">
                Truth<span className="text-[#6366f1]">Layer</span>
              </h1>
              <p className="text-[#8b8fa8] text-base max-w-sm">
                Ask anything. Every citation verified against its source before it reaches you.
              </p>
            </div>

            <SearchBar onSearch={handleSearch} loading={loading} />

            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#1e2030] text-[#8b8fa8] hover:border-[#2e3050] hover:text-[#e2e4f0] hover:bg-[#13141c] transition-all duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE */}
        {stage !== 'idle' && (
          <div className="max-w-5xl w-full mx-auto flex flex-col gap-5 py-6">

            <SearchBar onSearch={handleSearch} loading={loading} compact />

            {/* Searching state */}
            {stage === 'searching' && (
              <div className="flex items-center gap-3 text-[#8b8fa8] text-sm py-8">
                <svg className="w-4 h-4 animate-spin text-[#6366f1]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Searching Perplexity...
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-sm text-red-400">
                <span className="shrink-0 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            {/* Answer */}
            {answer && (
              <div>
                {/* Query label */}
                <p className="text-[11px] text-[#4a4e6a] font-medium mb-5 flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {query}
                </p>

                {/* Answer + sidebar */}
                <div className="flex gap-8">
                  <AnswerPanel answer={answer} verifyResults={verifyResults} verifying={stage === 'verifying'} />
                  {citations.length > 0 && (
                    <SourcesSidebar citations={citations} verifyResults={verifyResults} verifying={stage === 'verifying'} />
                  )}
                </div>

                {/* Stats bar */}
                {stage === 'done' && verifyResults.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-[#1e2030] flex items-center gap-5 text-[11px]">
                    {verified   > 0 && <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>{verified} verified</span>}
                    {flagged    > 0 && <span className="flex items-center gap-1.5 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400"/>{flagged} flagged</span>}
                    {uncertain  > 0 && <span className="flex items-center gap-1.5 text-purple-400"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"/>{uncertain} uncertain</span>}
                    {unreachable > 0 && <span className="flex items-center gap-1.5 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>{unreachable} unreachable</span>}
                    <span className="ml-auto text-[#4a4e6a]">Powered by Perplexity Sonar</span>
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
