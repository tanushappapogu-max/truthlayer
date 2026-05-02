import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  const citations: string[] = data.citations ?? [];

  return NextResponse.json({ answer: message?.content ?? '', citations });
}
