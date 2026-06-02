'use client';

import { useState, useRef, useEffect } from 'react';
import type { VerifyResult, DetectorVerdict } from '@/lib/truthlayer';

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

const VERDICT_COLOR: Record<DetectorVerdict, string> = {
  SUPPORT: 'text-emerald-400',
  CONTRADICT: 'text-red-400',
  INSUFFICIENT: 'text-amber-400',
  NEUTRAL: 'text-[#4a4e6a]',
};

const VERDICT_DOT: Record<DetectorVerdict, string> = {
  SUPPORT: 'bg-emerald-400',
  CONTRADICT: 'bg-red-400',
  INSUFFICIENT: 'bg-amber-400',
  NEUTRAL: 'bg-[#4a4e6a]',
};

export default function CitationBadge({ num, result, verifying }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const status = result?.status;
  const cfg = status ? CONFIG[status] : null;
  const topSignals = result?.signals?.slice().sort((a, b) => (b.score * b.weight) - (a.score * a.weight)).slice(0, 6) ?? [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-0.5 mx-0.5 align-baseline">
      <button
        onClick={() => status && setOpen(o => !o)}
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold
          transition-all duration-150 align-baseline
          ${cfg
            ? `${cfg.bg} ${cfg.text} border ${cfg.border} cursor-pointer hover:opacity-80`
            : 'text-[#6366f1] cursor-default'
          }
        `}
      >
        {num}
        {cfg && <span className="opacity-70 text-[9px] font-bold">{cfg.icon}</span>}
        {verifying && !cfg && <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />}
      </button>

      {open && status && cfg && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-[#13141c] border border-[#2e3050] rounded-xl shadow-2xl shadow-black/50 text-left overflow-hidden">
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-b border-[#1e2030] ${cfg.bg}`}>
            <span className={`text-xs font-semibold ${cfg.text} flex items-center gap-1.5`}>
              <span>{cfg.icon}</span> {cfg.label} citation [{num}]
            </span>
            <div className="flex items-center gap-2">
              {result?.tier && (
                <span className="text-[9px] text-[#4a4e6a] bg-[#0c0d12] px-1.5 py-0.5 rounded">Stage {result.tier}</span>
              )}
              <button onClick={() => setOpen(false)} className="text-[#4a4e6a] hover:text-white text-xs transition-colors">✕</button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Claim */}
            {result?.claim && (
              <div>
                <p className="text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider mb-1">Claim</p>
                <p className="text-gray-200 text-xs leading-relaxed">{result.claim}</p>
              </div>
            )}

            {/* Atomic decomposition */}
            {result?.atomicClaims && result.atomicClaims.length > 1 && (
              <div>
                <p className="text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider mb-1">Atomic claims</p>
                <div className="space-y-1">
                  {result.atomicClaims.map((ac, i) => (
                    <p key={i} className="text-[11px] text-[#8b8fa8] flex items-start gap-1.5">
                      <span className="text-[#6366f1] shrink-0">{i + 1}.</span>
                      {ac}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Best evidence */}
            {result?.sourceExcerpt && (
              <div>
                <p className="text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider mb-1">Best evidence</p>
                <p className="text-gray-300 text-xs leading-relaxed italic border-l-2 border-[#2e3050] pl-3">
                  &quot;{result.sourceExcerpt}&quot;
                </p>
              </div>
            )}

            {/* Corrected claim */}
            {result?.corrected && (
              <div>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Corrected claim</p>
                <p className="text-gray-200 text-xs leading-relaxed">{result.corrected}</p>
              </div>
            )}

            {/* Detector signals */}
            {topSignals.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider mb-1.5">Detector signals</p>
                <div className="space-y-1.5">
                  {topSignals.map((signal, i) => (
                    <div key={`${signal.name}-${i}`} className="rounded-lg bg-[#0c0d12]/70 px-2.5 py-2 border border-[#1e2030]">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${VERDICT_DOT[signal.verdict]}`} />
                          <p className="text-[11px] font-semibold text-gray-200">{signal.label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-semibold uppercase ${VERDICT_COLOR[signal.verdict]}`}>
                            {signal.verdict}
                          </span>
                          <span className="text-[10px] font-semibold text-[#6366f1]">
                            {Math.round(signal.score * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#8b8fa8] leading-relaxed">{signal.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score summary */}
            {(result?.supportScore != null || result?.contradictionScore != null) && (
              <div className="flex gap-3 text-[10px]">
                {result.supportScore != null && (
                  <div className="flex-1 rounded-lg bg-[#0c0d12] border border-[#1e2030] px-2.5 py-1.5">
                    <p className="text-[#4a4e6a] uppercase tracking-widest">Support</p>
                    <p className="text-emerald-400 font-semibold text-sm">{Math.round(result.supportScore * 100)}%</p>
                  </div>
                )}
                {result.contradictionScore != null && (
                  <div className="flex-1 rounded-lg bg-[#0c0d12] border border-[#1e2030] px-2.5 py-1.5">
                    <p className="text-[#4a4e6a] uppercase tracking-widest">Contradiction</p>
                    <p className="text-red-400 font-semibold text-sm">{Math.round(result.contradictionScore * 100)}%</p>
                  </div>
                )}
                {result.evidenceCoverage != null && (
                  <div className="flex-1 rounded-lg bg-[#0c0d12] border border-[#1e2030] px-2.5 py-1.5">
                    <p className="text-[#4a4e6a] uppercase tracking-widest">Coverage</p>
                    <p className="text-[#6366f1] font-semibold text-sm">{Math.round(result.evidenceCoverage * 100)}%</p>
                  </div>
                )}
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
