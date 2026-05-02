'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onSearch: (query: string) => void;
  loading: boolean;
}

export default function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim() && !loading) onSearch(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask anything..."
          className="w-full bg-[#1e1f2e] border border-[#2e3050] rounded-full px-6 py-3.5 pr-14 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="absolute right-3 p-2 rounded-full bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </form>
  );
}
