'use client';

import CitationBadge from './CitationBadge';
import type { VerifyResult } from '@/lib/truthlayer';

interface Props {
  answer: string;
  verifyResults: VerifyResult[];
  verifying: boolean;
}

// Splits a text segment on inline patterns and renders bold, italic, code, and citation badges
function renderInline(text: string, verifyResults: VerifyResult[], verifying: boolean, keyPrefix: string) {
  const parts = text.split(/(\[\d+\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    const cit = part.match(/^\[(\d+)\]$/);
    if (cit) {
      const num = parseInt(cit[1]);
      return <CitationBadge key={key} num={num} result={verifyResults.find(r => r.index === num - 1)} verifying={verifying} />;
    }
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={key} className="font-semibold text-white">{bold[1]}</strong>;

    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) return <em key={key} className="italic text-gray-300">{italic[1]}</em>;

    const code = part.match(/^`([^`]+)`$/);
    if (code) return <code key={key} className="font-mono text-xs bg-white/8 text-indigo-300 px-1.5 py-0.5 rounded">{code[1]}</code>;

    return part ? <span key={key}>{part}</span> : null;
  });
}

function renderTable(rows: string[], verifyResults: VerifyResult[], verifying: boolean, key: string) {
  const dataRows = rows.filter(r => !/^\|[-| :]+\|$/.test(r.trim()));
  if (dataRows.length === 0) return null;
  const [headerRow, ...bodyRows] = dataRows;
  const headers = headerRow.split('|').slice(1, -1).map(c => c.trim());
  return (
    <div key={key} className="my-5 overflow-x-auto rounded-lg border border-[#1e2030]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e2030] bg-[#13141c]">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-[#8b8fa8] uppercase tracking-wider whitespace-nowrap">
                {renderInline(h, verifyResults, verifying, `th-${key}-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => {
            const cells = row.split('|').slice(1, -1).map(c => c.trim());
            return (
              <tr key={ri} className="border-b border-[#1e2030]/50 last:border-0 hover:bg-white/2 transition-colors">
                {cells.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-gray-300 align-top leading-relaxed">
                    {renderInline(cell, verifyResults, verifying, `td-${key}-${ri}-${ci}`)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderBlocks(answer: string, verifyResults: VerifyResult[], verifying: boolean) {
  const lines = answer.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // H1
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      nodes.push(
        <h1 key={i} className="text-2xl font-bold text-white mt-8 mb-3 leading-tight">
          {renderInline(trimmed.slice(2), verifyResults, verifying, `h1-${i}`)}
        </h1>
      );
      i++; continue;
    }

    // H2
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      nodes.push(
        <h2 key={i} className="text-lg font-semibold text-white mt-7 mb-2 leading-snug">
          {renderInline(trimmed.slice(3), verifyResults, verifying, `h2-${i}`)}
        </h2>
      );
      i++; continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="text-base font-semibold text-white mt-6 mb-2 leading-snug">
          {renderInline(trimmed.slice(4), verifyResults, verifying, `h3-${i}`)}
        </h3>
      );
      i++; continue;
    }

    // Table block
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      nodes.push(renderTable(tableLines, verifyResults, verifying, `table-${i}`));
      continue;
    }

    // List block
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        const content = lines[i].trim().slice(2);
        items.push(
          <li key={i} className="flex gap-2.5 leading-relaxed text-gray-300">
            <span className="mt-2 w-1 h-1 rounded-full bg-[#6366f1] shrink-0" />
            <span>{renderInline(content, verifyResults, verifying, `li-${i}`)}</span>
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="my-3 space-y-2">{items}</ul>);
      continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} className="leading-[1.85] text-gray-300 mb-1">
        {renderInline(trimmed, verifyResults, verifying, `p-${i}`)}
      </p>
    );
    i++;
  }

  return nodes;
}

export default function AnswerPanel({ answer, verifyResults, verifying }: Props) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[15px] space-y-1">
        {renderBlocks(answer, verifyResults, verifying)}
      </div>
      {verifying && (
        <div className="mt-5 flex items-center gap-2 text-xs text-[#6366f1]">
          <span className="flex gap-0.5">
            {[0, 1, 2].map(n => (
              <span key={n} className="w-1 h-1 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: `${n * 150}ms` }} />
            ))}
          </span>
          Verifying citations against sources...
        </div>
      )}
    </div>
  );
}
