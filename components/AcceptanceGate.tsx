'use client';

import { useState } from 'react';
import type { AcceptanceGateReport, GateDecision } from '@/lib/truthlayer';

interface Props {
  gate: AcceptanceGateReport | null;
  verifying: boolean;
}

const STYLE: Record<GateDecision, { dot: string; border: string; bg: string; text: string; icon: string }> = {
  ACCEPT: {
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/8',
    text: 'text-emerald-400',
    icon: '✓',
  },
  REVISE: {
    dot: 'bg-blue-400',
    border: 'border-blue-500/25',
    bg: 'bg-blue-500/8',
    text: 'text-blue-400',
    icon: '⟳',
  },
  REJECT: {
    dot: 'bg-red-400',
    border: 'border-red-500/25',
    bg: 'bg-red-500/8',
    text: 'text-red-400',
    icon: '✗',
  },
  ABSTAIN: {
    dot: 'bg-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/8',
    text: 'text-amber-400',
    icon: '?',
  },
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function AcceptanceGate({ gate, verifying }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (verifying && !gate) {
    return (
      <section className="rounded-xl border border-[#1e2030] bg-[#13141c] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-[#6366f1]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
          Running acceptance gate...
        </div>
      </section>
    );
  }

  if (!gate) return null;

  const style = STYLE[gate.decision];
  const supported = gate.counts.SUPPORTED;
  const flagged = gate.counts.UNSUPPORTED;
  const unresolved = gate.counts.UNVERIFIABLE + gate.counts.UNREACHABLE;

  return (
    <section className={`rounded-xl border ${style.border} ${style.bg} px-4 py-4 transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${style.bg} ${style.text} border ${style.border}`}>
              {style.icon}
            </span>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest ${style.text}`}>
                {gate.label}
              </p>
              <p className="text-[10px] text-[#4a4e6a]">{gate.methodVersion}</p>
            </div>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed mt-1">{gate.summary}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest">Gate score</p>
          <p className={`text-2xl font-bold ${style.text}`}>{pct(gate.score)}</p>
          <p className="text-[10px] text-[#4a4e6a]">{pct(gate.risk)} risk</p>
        </div>
      </div>

      {/* Score bars */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <div className="h-1.5 rounded-full bg-[#0c0d12] overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: pct(gate.score) }} />
          </div>
          <p className="mt-1 text-[#8b8fa8]">{supported} supported</p>
        </div>
        <div>
          <div className="h-1.5 rounded-full bg-[#0c0d12] overflow-hidden">
            <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: pct(gate.risk) }} />
          </div>
          <p className="mt-1 text-[#8b8fa8]">{flagged} flagged</p>
        </div>
        <div>
          <div className="h-1.5 rounded-full bg-[#0c0d12] overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: gate.counts.total > 0 ? pct(unresolved / gate.counts.total) : '0%' }}
            />
          </div>
          <p className="mt-1 text-[#8b8fa8]">{unresolved} unresolved</p>
        </div>
      </div>

      {/* Failure modes */}
      {gate.failureModes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {gate.failureModes.map(mode => (
            <span key={mode} className="rounded-md border border-[#2e3050] bg-[#0c0d12]/60 px-2 py-1 text-[10px] text-[#8b8fa8]">
              {mode}
            </span>
          ))}
        </div>
      )}

      {/* Expandable policy */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-[10px] text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Gate policy
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 pl-4 border-l border-[#1e2030]">
          {gate.policy.map((rule, i) => (
            <p key={i} className="text-[10px] text-[#8b8fa8] leading-relaxed">{rule}</p>
          ))}
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded bg-[#0c0d12] px-2 py-1">
              <span className="text-[#4a4e6a]">Accept θ:</span>{' '}
              <span className="text-[#8b8fa8] font-mono">{gate.thresholds.acceptScore}</span>
            </div>
            <div className="rounded bg-[#0c0d12] px-2 py-1">
              <span className="text-[#4a4e6a]">Reject θ:</span>{' '}
              <span className="text-[#8b8fa8] font-mono">{gate.thresholds.rejectContradiction}</span>
            </div>
            <div className="rounded bg-[#0c0d12] px-2 py-1">
              <span className="text-[#4a4e6a]">Unresolved max:</span>{' '}
              <span className="text-[#8b8fa8] font-mono">{gate.thresholds.maxUnresolvedRatio}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
