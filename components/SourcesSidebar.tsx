'use client';

import type { VerifyResult } from '@/app/api/verify/route';

interface Props {
  citations: string[];
  verifyResults: VerifyResult[];
  verifying: boolean;
}

const STATUS = {
  SUPPORTED:    { dot: 'bg-emerald-400', ring: 'border-emerald-500/25 bg-emerald-500/5', label: 'Verified' },
  UNSUPPORTED:  { dot: 'bg-red-400',     ring: 'border-red-500/25 bg-red-500/5',         label: 'Flagged'  },
  UNVERIFIABLE: { dot: 'bg-purple-400',  ring: 'border-purple-500/25 bg-purple-500/5',   label: 'Uncertain'},
  UNREACHABLE:  { dot: 'bg-amber-400',   ring: 'border-amber-500/25 bg-amber-500/5',     label: 'No source'},
};

function getFavicon(url: string) {
  try {
    const { origin } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
  } catch { return null; }
}

function getHostname(url: string) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

export default function SourcesSidebar({ citations, verifyResults, verifying }: Props) {
  return (
    <div className="w-56 shrink-0">
      <p className="text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-widest mb-3 px-1">Sources</p>
      <div className="flex flex-col gap-1.5">
        {citations.map((url, i) => {
          const result = verifyResults.find(r => r.index === i);
          const status = result?.status;
          const s = status ? STATUS[status] : null;
          const host = getHostname(url);
          const favicon = getFavicon(url);

          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs
                transition-all duration-150 hover:scale-[1.01]
                ${s ? `${s.ring} border` : 'border-[#1e2030] bg-[#13141c] hover:bg-[#1a1b26] hover:border-[#2e3050]'}
              `}
            >
              {/* Number */}
              <span className="text-[10px] font-bold text-[#4a4e6a] shrink-0 w-4 text-center">{i + 1}</span>

              {/* Favicon + host */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {favicon && (
                  <img src={favicon} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0 opacity-80" />
                )}
                <span className="text-[#8b8fa8] group-hover:text-gray-300 truncate transition-colors">{host}</span>
              </div>

              {/* Status dot */}
              {verifying && !status && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2e3050] animate-pulse shrink-0" />
              )}
              {status && s && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} title={s.label} />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
