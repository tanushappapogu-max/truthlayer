'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';

interface Props {
  onSearch: (query: string) => void;
  loading: boolean;
  compact?: boolean;
}

export default function SearchBar({ onSearch, loading, compact }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim() && !loading) onSearch(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full ${compact ? 'max-w-2xl' : 'max-w-2xl'}`}>
      <div className="relative flex items-center group">
        {/* Search icon */}
        <div className="absolute left-4 text-[#4a4e6a] group-focus-within:text-[#6366f1] transition-colors pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Ask anything..."
          disabled={loading}
          className={`
            w-full bg-[#13141c] border border-[#1e2030]
            ${compact ? 'rounded-xl py-3 text-sm' : 'rounded-2xl py-4 text-base'}
            pl-11 pr-14 text-white placeholder-[#4a4e6a]
            focus:outline-none focus:border-[#6366f1] focus:bg-[#1a1b26]
            group-hover:border-[#2e3050]
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-150
          `}
        />

        <button
          type="submit"
          disabled={loading || !value.trim()}
          className={`
            absolute right-2.5
            ${compact ? 'p-1.5' : 'p-2'}
            rounded-lg bg-[#6366f1] hover:bg-[#5254cc]
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-150 hover:scale-105 active:scale-95
          `}
        >
          {loading ? (
            <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
