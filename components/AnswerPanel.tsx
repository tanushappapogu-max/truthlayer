'use client';

import CitationBadge from './CitationBadge';
import type { VerifyResult } from '@/app/api/verify/route';

interface Props {
  answer: string;
  verifyResults: VerifyResult[];
  verifying: boolean;
}

function renderWithBadges(
  answer: string,
  verifyResults: VerifyResult[],
  verifying: boolean
) {
  const parts = answer.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const num = parseInt(match[1]);
      const result = verifyResults.find((r) => r.index === num - 1);
      return (
        <CitationBadge
          key={i}
          num={num}
          result={result}
          verifying={verifying}
        />
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AnswerPanel({ answer, verifyResults, verifying }: Props) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-gray-200 text-sm leading-7 whitespace-pre-wrap">
        {renderWithBadges(answer, verifyResults, verifying)}
      </div>
      {verifying && (
        <p className="mt-4 text-xs text-gray-500 animate-pulse flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-bounce" />
          Verifying citations...
        </p>
      )}
    </div>
  );
}
