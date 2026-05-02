'use client';

import { useState, useRef, useEffect } from 'react';
import type { VerifyResult } from '@/app/api/verify/route';

interface Props {
  num: number;
  result?: VerifyResult;
  verifying: boolean;
}

const CONFIG = {
  SUPPORTED:    { icon: '✓', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Verified' },
  UNSUPPORTED:  { icon: '✗', bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Flagged'  },
  UNVERIFIABLE: { icon: '?', bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/30',  label: 'Uncertain'},
  UNREACHABLE:  { icon: '~', bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'No source'},
};

export default function CitationBadge({ num, result, verifying }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const status = result?.status;
  const cfg = status ? CONFIG[status] : null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-0.5 mx-0.5 align-baseline">
      {/* Citation number */}
      <button
        onClick={() => status === 'UNSUPPORTED' && setOpen(o => !o)}
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold
          transition-all duration-150 align-baseline
          ${cfg
            ? `${cfg.bg} ${cfg.text} border ${cfg.border} ${status === 'UNSUPPORTED' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`
            : 'text-[#6366f1] cursor-default'
          }
        `}
      >
        {num}
        {cfg && <span className="opacity-70 text-[9px] font-bold">{cfg.icon}</span>}
        {verifying && !cfg && <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />}
      </button>

      {/* Popup for flagged citations */}
      {open && status === 'UNSUPPORTED' && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-80 bg-[#13141c] border border-[#2e3050] rounded-xl shadow-2xl shadow-black/50 text-left overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2030] bg-red-500/5">
            <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
              <span>✗</span> Citation mismatch — source [{num}]
            </span>
            <button onClick={() => setOpen(false)} className="text-[#4a4e6a] hover:text-white text-xs transition-colors">✕</button>
          </div>

          <div className="p-4 space-y-3">
            {result?.sourceExcerpt && (
              <div>
                <p className="text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider mb-1">Source actually says</p>
                <p className="text-gray-300 text-xs leading-relaxed italic border-l-2 border-[#2e3050] pl-3">
                  "{result.sourceExcerpt}"
                </p>
              </div>
            )}
            {result?.corrected && (
              <div>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Corrected claim</p>
                <p className="text-gray-200 text-xs leading-relaxed">{result.corrected}</p>
              </div>
            )}
            <a
              href={result?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-[#6366f1] hover:text-indigo-300 transition-colors"
            >
              View source
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </span>
  );
}
