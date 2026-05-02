import { NextRequest, NextResponse } from 'next/server';

export type VerifyResult = {
  index: number;
  url: string;
  status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNREACHABLE';
  sourceExcerpt?: string;
  corrected?: string;
};

async function fetchSourceText(url: string): Promise<string | null> {
  // Wikipedia blocks HTML scraping — use their REST API instead
  const wikiMatch = url.match(/en\.wikipedia\.org\/wiki\/(.+)/);
  if (wikiMatch) {
    try {
      const title = wikiMatch[1].split('#')[0];
      const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'TruthLayer/1.0 (citation-verifier)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.extract ?? null;
    } catch {
      return null;
    }
  }

  // Generic HTML fetch for non-Wikipedia sources
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TruthLayer/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
    return text || null;
  } catch {
    return null;
  }
}

async function verifyClaim(
  claim: string,
  sourceText: string,
  url: string,
  apiKey: string
): Promise<{ status: 'SUPPORTED' | 'UNSUPPORTED'; sourceExcerpt?: string; corrected?: string }> {
  const prompt = `You are a citation fact-checker. Given a CLAIM and a SOURCE, determine if the source actually supports the claim.

SOURCE TEXT (from ${url}):
${sourceText}

CLAIM:
${claim}

Respond in this exact JSON format with no extra text:
{
  "verdict": "SUPPORTED" or "UNSUPPORTED",
  "sourceExcerpt": "the most relevant sentence from the source (max 150 chars)",
  "corrected": "rewritten claim using only what the source says — only include if UNSUPPORTED"
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
    return {
      status: parsed.verdict === 'SUPPORTED' ? 'SUPPORTED' : 'UNSUPPORTED',
      sourceExcerpt: parsed.sourceExcerpt,
      corrected: parsed.corrected,
    };
  } catch {
    return { status: 'UNSUPPORTED' };
  }
}

export async function POST(req: NextRequest) {
  const { answer, citations } = await req.json() as { answer: string; citations: string[] };

  if (!answer || !citations?.length) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing PERPLEXITY_API_KEY' }, { status: 500 });

  // Extract sentences that contain citation markers like [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g;
  const claimMap: Record<number, string> = {};

  const sentences = answer.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const matches = [...sentence.matchAll(citationPattern)];
    for (const match of matches) {
      const idx = parseInt(match[1]) - 1;
      if (idx >= 0 && idx < citations.length) {
        claimMap[idx] = (claimMap[idx] ?? '') + ' ' + sentence.replace(citationPattern, '').trim();
      }
    }
  }

  const results = await Promise.all(
    citations.map(async (url, i): Promise<VerifyResult> => {
      const claim = claimMap[i];
      if (!claim?.trim()) return { index: i, url, status: 'UNREACHABLE' };

      const sourceText = await fetchSourceText(url);
      if (!sourceText) return { index: i, url, status: 'UNREACHABLE' };

      try {
        const result = await verifyClaim(claim.trim(), sourceText, url, apiKey);
        return { index: i, url, ...result };
      } catch {
        return { index: i, url, status: 'UNREACHABLE' };
      }
    })
  );

  return NextResponse.json({ results });
}
