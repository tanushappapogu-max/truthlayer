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

// Serper — Google Search results for the claim (runs in parallel with Jina, not just fallback)
async function fetchViaSerper(claim: string): Promise<string | null> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return null;

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: claim, num: 6 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const parts: string[] = [];
    if (data.answerBox?.answer) parts.push(`Answer box: ${data.answerBox.answer}`);
    if (data.answerBox?.snippet) parts.push(`Answer box: ${data.answerBox.snippet}`);
    for (const r of data.organic ?? []) {
      if (r.snippet) parts.push(`[${r.link}] ${r.snippet}`);
    }
    return parts.join('\n\n') || null;
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
  const prompt = `You are a strict citation fact-checker. You are given a CLAIM and SOURCE TEXT (from the cited URL and/or Google search results). Determine whether the claim is accurate.

SOURCE TEXT:
${sourceText}

CLAIM:
${claim}

Rules:
- SUPPORTED: the source confirms the claim is accurate
- UNSUPPORTED: the source contradicts the claim or the claim contains a clearly wrong fact (wrong date, wrong person, wrong number, wrong company, etc.)
- UNVERIFIABLE: use ONLY when the source genuinely contains zero relevant information — not when you are uncertain

Be decisive. If the search results give you enough context to judge the claim, use SUPPORTED or UNSUPPORTED. Only fall back to UNVERIFIABLE if the sources are completely silent on the topic.

Respond in this exact JSON format with no extra text:
{
  "verdict": "SUPPORTED" or "UNSUPPORTED" or "UNVERIFIABLE",
  "sourceExcerpt": "the most relevant quote from the source (max 150 chars)",
  "corrected": "corrected version of the claim based only on the source — only if UNSUPPORTED"
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

      // Fetch URL and search in parallel — combine for maximum context
      const [jinaText, serperText] = await Promise.all([
        fetchViaJina(url),
        fetchViaSerper(claim),
      ]);

      const parts: string[] = [];
      if (jinaText) parts.push(`--- FROM CITED URL (${url}) ---\n${jinaText.slice(0, 3000)}`);
      if (serperText) parts.push(`--- FROM WEB SEARCH ---\n${serperText}`);
      const sourceText = parts.join('\n\n') || null;

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
