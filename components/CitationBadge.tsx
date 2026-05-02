'use client';

import { useState } from 'react';
import type { VerifyResult } from '@/app/api/verify/route';

interface Props {
  num: number;
  result?: VerifyResult;
  verifying: boolean;
}

const EMOJI = {
  SUPPORTED: '✅',
  UNSUPPORTED: '🔴',
  UNREACHABLE: '🟡',
};

export default function CitationBadge({ num, result, verifying }: Props) {
  const [open, setOpen] = useState(false);

  const status = result?.status;
  const emoji = status ? EMOJI[status] : null;

  return (
    <span className="relative inline-flex items-center gap-0.5 align-baseline">
      <span className="text-[#6366f1] text-xs font-semibold cursor-pointer hover:underline">
        [{num}]
      </span>
      {verifying && !emoji && (
        <span className="text-[10px] text-gray-500 animate-pulse">…</span>
      )}
      {emoji && (
        <button
          onClick={() => setOpen(!open)}
          className="text-[11px] leading-none cursor-pointer hover:scale-110 transition-transform"
          title={status}
        >
          {emoji}
        </button>
      )}
      {open && result && status === 'UNSUPPORTED' && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-[#1e1f2e] border border-[#3e4070] rounded-xl p-3 shadow-xl text-xs text-left">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 text-gray-500 hover:text-white"
          >
            ✕
          </button>
          {result.sourceExcerpt && (
            <div className="mb-2">
              <span className="text-gray-400 font-semibold">Source says:</span>
              <p className="text-gray-300 mt-1 italic">"{result.sourceExcerpt}"</p>
            </div>
          )}
          {result.corrected && (
            <div>
              <span className="text-green-400 font-semibold">Corrected claim:</span>
              <p className="text-gray-200 mt-1">{result.corrected}</p>
            </div>
          )}
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-[#6366f1] hover:underline truncate"
          >
            View source →
          </a>
        </div>
      )}
    </span>
  );
}
