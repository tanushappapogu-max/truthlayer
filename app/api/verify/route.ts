import { NextRequest, NextResponse } from 'next/server';

export type VerifyResult = {
  index: number;
  url: string;
  status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE' | 'UNREACHABLE';
  sourceExcerpt?: string;
  corrected?: string;
};

// Jina AI Reader — converts any URL to clean text, no API key needed
async function fetchViaJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Timeout': '10',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 6000) || null;
  } catch {
    return null;
  }
}

// Serper — Google Search fallback when URL can't be fetched
async function fetchViaSerper(claim: string, url: string): Promise<string | null> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return null;

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: claim, num: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const snippets: string[] = [];
    for (const result of data.organic ?? []) {
      if (result.snippet) snippets.push(`[${result.link}] ${result.snippet}`);
    }
    return snippets.join('\n\n') || null;
  } catch {
    return null;
  }
}

async function verifyClaim(
  claim: string,
  sourceText: string,
  url: string,
  apiKey: string
): Promise<{ status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE'; sourceExcerpt?: string; corrected?: string }> {
  const prompt = `You are a citation fact-checker. Given a CLAIM and SOURCE TEXT, determine if the source supports, contradicts, or simply does not address the claim.

SOURCE TEXT (from ${url}):
${sourceText}

CLAIM:
${claim}

Rules:
- SUPPORTED: the source explicitly confirms the claim
- UNSUPPORTED: the source explicitly contradicts or says something different
- UNVERIFIABLE: the source does not contain enough information to confirm or deny the claim

Respond in this exact JSON format with no extra text:
{
  "verdict": "SUPPORTED" or "UNSUPPORTED" or "UNVERIFIABLE",
  "sourceExcerpt": "the most relevant sentence from the source (max 150 chars, empty string if UNVERIFIABLE)",
  "corrected": "rewritten claim using only what the source says — only include if UNSUPPORTED, omit otherwise"
}`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error('Perplexity API error during verification');

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    const verdict = parsed.verdict;
    if (verdict === 'SUPPORTED') return { status: 'SUPPORTED', sourceExcerpt: parsed.sourceExcerpt };
    if (verdict === 'UNSUPPORTED') return { status: 'UNSUPPORTED', sourceExcerpt: parsed.sourceExcerpt, corrected: parsed.corrected };
    return { status: 'UNVERIFIABLE' };
  } catch {
    return { status: 'UNVERIFIABLE' };
  }
}

export async function POST(req: NextRequest) {
  const { answer, citations } = await req.json() as { answer: string; citations: string[] };

  if (!answer || !citations?.length) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing PERPLEXITY_API_KEY' }, { status: 500 });

  // For each citation [N], look backward to find the sentence it belongs to
  const claimMap: Record<number, string> = {};

  for (let i = 0; i < citations.length; i++) {
    const marker = `[${i + 1}]`;
    const markerIdx = answer.indexOf(marker);
    if (markerIdx === -1) continue;

    const before = answer.slice(0, markerIdx).trim();
    const breakAt = (str: string, sub: string) => { const i = str.lastIndexOf(sub); return i >= 0 ? i + sub.length : 0; };
    const lastBreak = Math.max(breakAt(before, '. '), breakAt(before, '! '), breakAt(before, '? '), breakAt(before, '.\n'));
    const claim = before.slice(lastBreak).replace(/\[\d+\]/g, '').trim();
    if (claim) claimMap[i] = claim;
  }

  const results = await Promise.all(
    citations.map(async (url, i): Promise<VerifyResult> => {
      const claim = claimMap[i];
      if (!claim?.trim()) return { index: i, url, status: 'UNREACHABLE' };

      // Try Jina first, fall back to Serper
      let sourceText = await fetchViaJina(url);
      if (!sourceText) sourceText = await fetchViaSerper(claim, url);
      if (!sourceText) return { index: i, url, status: 'UNREACHABLE' };

      try {
        const result = await verifyClaim(claim, sourceText, url, apiKey);
        return { index: i, url, ...result };
      } catch {
        return { index: i, url, status: 'UNREACHABLE' };
      }
    })
  );

  return NextResponse.json({ results });
}
