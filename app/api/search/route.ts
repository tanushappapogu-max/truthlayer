import { NextRequest, NextResponse } from 'next/server';

function cleanProviderError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const message = parsed?.error?.message ?? parsed?.message;
    const code = parsed?.error?.code ?? parsed?.code;

    if (code === 401 || code === '401' || String(message).toLowerCase().includes('quota')) {
      return 'Perplexity API quota exceeded. Add billing or use a different PERPLEXITY_API_KEY in .env.local.';
    }

    if (message) return String(message);
  } catch {
    // Fall through to the plain-text response.
  }

  return raw || 'Search provider request failed.';
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query) return NextResponse.json({ error: 'No query provided' }, { status: 400 });

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing PERPLEXITY_API_KEY' }, { status: 500 });

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: query }],
      return_citations: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: cleanProviderError(err) }, { status: res.status });
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  const citations: string[] = data.citations ?? [];

  return NextResponse.json({ answer: message?.content ?? '', citations });
}
