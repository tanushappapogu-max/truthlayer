'use client';

import type { VerifyResult } from '@/app/api/verify/route';

interface Props {
  citations: string[];
  verifyResults: VerifyResult[];
  verifying: boolean;
}

const STATUS_COLORS = {
  SUPPORTED: 'border-green-500/40 bg-green-500/5',
  UNSUPPORTED: 'border-red-500/40 bg-red-500/5',
  UNREACHABLE: 'border-yellow-500/40 bg-yellow-500/5',
};

const STATUS_DOT = {
  SUPPORTED: 'bg-green-400',
  UNSUPPORTED: 'bg-red-400',
  UNREACHABLE: 'bg-yellow-400',
};

export default function SourcesSidebar({ citations, verifyResults, verifying }: Props) {
  return (
    <div className="w-64 shrink-0">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Sources</h3>
      <div className="flex flex-col gap-2">
        {citations.map((url, i) => {
          const result = verifyResults.find((r) => r.index === i);
          const status = result?.status;
          const hostname = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();

          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs transition-colors hover:border-[#6366f1]/50 ${
                status ? STATUS_COLORS[status] : 'border-[#2e3050] bg-transparent'
              }`}
            >
              <span className="mt-1 shrink-0 text-gray-500 font-semibold">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-gray-300 truncate">{hostname}</p>
                <p className="text-gray-500 truncate text-[10px]">{url}</p>
              </div>
              {verifying && !status && (
                <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse mt-1" />
              )}
              {status && (
                <span className={`ml-auto shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${STATUS_DOT[status]}`} />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
