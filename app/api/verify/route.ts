import { NextRequest, NextResponse } from 'next/server';
import {
  buildAcceptanceGate,
  decomposeClaimAtomics,
  deriveDeterministicVerdict,
  runDeterministicDetector,
} from '@/lib/truthlayer';
import type { DetectorReport, DetectorSignal, VerifyResult } from '@/lib/truthlayer';

const MAX_CITATIONS_PER_REQUEST = 8;
const MAX_SOURCE_CHARS = 4000;

// --- Source fetchers ---

function isWikipediaUrl(url: string): boolean {
  return /^https?:\/\/(en|www)\.wikipedia\.org\/wiki\//.test(url);
}

async function fetchViaWikipedia(url: string): Promise<string | null> {
  const match = url.match(/wikipedia\.org\/wiki\/(.+)/);
  if (!match) return null;
  const title = decodeURIComponent(match[1].split('#')[0]);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&titles=${encodeURIComponent(title)}&explaintext=true&redirects=1&format=json&exlimit=1&origin=*`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'TruthLayer/1.0 (citation-verification-research)' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 800));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0] as { extract?: string } | undefined;
      const text = page?.extract ?? '';
      if (text.length > 100) return text.slice(0, 8000);
      break;
    } catch {
      if (attempt === 2) return null;
    }
  }
  return null;
}

async function fetchViaJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-Timeout': '10' },
      signal: AbortSignal.timeout(14000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 6000) || null;
  } catch {
    return null;
  }
}

async function fetchViaSerper(claim: string): Promise<string | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: claim, num: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts: string[] = [];
    if (data.answerBox?.answer) parts.push(`Answer: ${data.answerBox.answer}`);
    if (data.answerBox?.snippet) parts.push(`Answer: ${data.answerBox.snippet}`);
    for (const r of data.organic ?? []) {
      if (r.snippet) parts.push(`[${r.link}] ${r.snippet}`);
    }
    return parts.join('\n\n') || null;
  } catch {
    return null;
  }
}

async function fetchPageText(url: string, claim: string): Promise<{ pageText: string | null; serperText: string | null }> {
  if (isWikipediaUrl(url)) {
    const wikiText = await fetchViaWikipedia(url);
    if (wikiText) return { pageText: wikiText, serperText: null };
    const jinaText = await fetchViaJina(url);
    return { pageText: jinaText, serperText: null };
  }
  const [jinaText, serperText] = await Promise.all([fetchViaJina(url), fetchViaSerper(claim)]);
  return { pageText: jinaText, serperText };
}

// --- Stage 1: deterministic detector ---

type ClaimVerification = Omit<VerifyResult, 'index' | 'url' | 'claim' | 'atomicClaims'>;

function signalFromJudge(
  result: { status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE'; sourceExcerpt?: string },
): DetectorSignal {
  if (result.status === 'SUPPORTED') {
    return {
      name: 'LLM_JUDGE',
      label: 'LLM judge',
      verdict: 'SUPPORT',
      score: 0.78,
      weight: 0.25,
      rationale: 'The judge found the claim supported by the retrieved evidence.',
      evidence: result.sourceExcerpt,
    };
  }

  if (result.status === 'UNSUPPORTED') {
    return {
      name: 'LLM_JUDGE',
      label: 'LLM judge',
      verdict: 'CONTRADICT',
      score: 0.84,
      weight: 0.3,
      rationale: 'The judge found a mismatch between the claim and the cited source.',
      evidence: result.sourceExcerpt,
    };
  }

  return {
    name: 'LLM_JUDGE',
    label: 'LLM judge',
    verdict: 'INSUFFICIENT',
    score: 0.45,
    weight: 0.16,
    rationale: 'The judge could not verify the claim from the retrieved evidence.',
    evidence: result.sourceExcerpt,
  };
}

function attachDetector(
  result: ClaimVerification,
  detector: DetectorReport,
  extraSignals: DetectorSignal[] = [],
): ClaimVerification {
  const confidence = result.confidence ?? (result.status === 'SUPPORTED' ? 0.78 : result.status === 'UNSUPPORTED' ? 0.84 : 0.45);
  const supportScore =
    result.status === 'SUPPORTED'
      ? Math.max(detector.supportScore, confidence)
      : result.status === 'UNSUPPORTED'
        ? Math.min(detector.supportScore, 0.25)
        : detector.supportScore;
  const contradictionScore =
    result.status === 'UNSUPPORTED'
      ? Math.max(detector.contradictionScore, confidence)
      : detector.contradictionScore;

  return {
    ...result,
    confidence,
    supportScore,
    contradictionScore,
    evidenceCoverage: detector.evidenceCoverage,
    signals: [...detector.signals, ...extraSignals],
    evidenceWindows: detector.evidenceWindows,
  };
}

// --- Stage 2: NLI via HuggingFace Inference API ---

async function stage2NLI(
  claim: string,
  sourceText: string,
): Promise<{ verdict: 'SUPPORTED' | 'UNSUPPORTED'; confidence: number } | null> {
  if (process.env.ENABLE_NLI_STAGE !== 'true') return null;

  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) return null;

  try {
    const { selectEvidenceWindows } = await import('@/lib/truthlayer');
    const windows = selectEvidenceWindows(claim, sourceText, 1);
    const premise = windows[0]?.text ?? sourceText.slice(0, 512);

    const res = await fetch(
      'https://api-inference.huggingface.co/models/cross-encoder/nli-deberta-v3-base',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `${premise} [SEP] ${claim}`,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();

    // HF returns [{label, score}, ...] sorted by score
    const labels: Array<{ label: string; score: number }> = Array.isArray(data)
      ? (Array.isArray(data[0]) ? data[0] : data)
      : [];

    const entailment = labels.find(l => l.label?.toLowerCase().includes('entail'));
    const contradiction = labels.find(l => l.label?.toLowerCase().includes('contradict'));

    if (entailment && entailment.score > 0.82) {
      return { verdict: 'SUPPORTED', confidence: entailment.score };
    }
    if (contradiction && contradiction.score > 0.82) {
      return { verdict: 'UNSUPPORTED', confidence: contradiction.score };
    }

    return null;
  } catch {
    return null;
  }
}

// --- Stage 3: LLM judge ---

const JUDGE_PROMPT = (claim: string, sourceText: string) => `You are a strict citation fact-checker. A claim needs to be verified against its source.

SOURCE TEXT (from the cited URL):
${sourceText}

CLAIM TO VERIFY:
${claim}

Rules:
- SUPPORTED: the source confirms the claim is accurate
- UNSUPPORTED: the source contradicts the claim (wrong date, wrong person, wrong number, wrong fact)
- UNVERIFIABLE: the source has zero relevant information about this specific claim

Be decisive. Prefer SUPPORTED or UNSUPPORTED over UNVERIFIABLE whenever the source gives you enough context to judge.

Respond with ONLY valid JSON, no extra text:
{"verdict":"SUPPORTED","sourceExcerpt":"most relevant quote (max 150 chars)"}
or
{"verdict":"UNSUPPORTED","sourceExcerpt":"most relevant quote","corrected":"what the source actually says"}
or
{"verdict":"UNVERIFIABLE"}`;

async function judgeViaOpenRouter(
  claim: string,
  sourceText: string,
): Promise<{ status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE'; sourceExcerpt?: string; corrected?: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('No OpenRouter key');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://truthlayer.vercel.app',
      'X-Title': 'TruthLayer',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [{ role: 'user', content: JUDGE_PROMPT(claim, sourceText) }],
      temperature: 0,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return parseVerdict(data.choices?.[0]?.message?.content ?? '{}');
}

async function judgeViaPerplexity(
  claim: string,
  sourceText: string,
  apiKey: string,
): Promise<{ status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE'; sourceExcerpt?: string; corrected?: string }> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: JUDGE_PROMPT(claim, sourceText) }],
      temperature: 0,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  return parseVerdict(data.choices?.[0]?.message?.content ?? '{}');
}

function parseVerdict(raw: string): { status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE'; sourceExcerpt?: string; corrected?: string } {
  try {
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    const v = json.verdict;
    if (v === 'SUPPORTED') return { status: 'SUPPORTED', sourceExcerpt: json.sourceExcerpt };
    if (v === 'UNSUPPORTED') return { status: 'UNSUPPORTED', sourceExcerpt: json.sourceExcerpt, corrected: json.corrected };
    return { status: 'UNVERIFIABLE' };
  } catch {
    return { status: 'UNVERIFIABLE' };
  }
}

async function stage3LLM(
  claim: string,
  sourceText: string,
  perplexityKey?: string,
): Promise<{ status: 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE'; sourceExcerpt?: string; corrected?: string }> {
  if (process.env.ENABLE_LLM_JUDGE !== 'true') return { status: 'UNVERIFIABLE' };

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await judgeViaOpenRouter(claim, sourceText);
    } catch {
      // fall through to Perplexity
    }
  }
  if (!perplexityKey) return { status: 'UNVERIFIABLE' };
  try {
    return await judgeViaPerplexity(claim, sourceText, perplexityKey);
  } catch {
    return { status: 'UNVERIFIABLE' };
  }
}

// --- Orchestrator ---

async function verifyClaim(
  claim: string,
  sourceText: string,
  perplexityKey?: string,
): Promise<ClaimVerification> {
  const detector = runDeterministicDetector(claim, sourceText);

  const s1 = deriveDeterministicVerdict(detector);
  if (s1) {
    return attachDetector(
      { status: s1.status, tier: 1, confidence: s1.confidence, sourceExcerpt: s1.sourceExcerpt },
      detector
    );
  }

  const s2 = await stage2NLI(claim, sourceText);
  if (s2) {
    return attachDetector(
      { status: s2.verdict, tier: 2, confidence: s2.confidence },
      detector,
      [{
        name: 'NLI_MODEL',
        label: 'NLI model',
        verdict: s2.verdict === 'SUPPORTED' ? 'SUPPORT' : 'CONTRADICT',
        score: s2.confidence,
        weight: 0.32,
        rationale: `NLI cross-encoder classified the evidence/claim pair (${(s2.confidence * 100).toFixed(0)}% confidence).`,
        evidence: detector.evidenceWindows[0]?.text,
      }]
    );
  }

  const s3 = await stage3LLM(claim, sourceText, perplexityKey);
  return attachDetector({ ...s3, tier: 3 }, detector, [signalFromJudge(s3)]);
}

// --- Route handler ---

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    answer: string;
    citations: string[];
    disabledSignals?: string[];
  };
  const { answer, citations, disabledSignals } = body;

  if (!answer || !citations?.length) {
    const gate = buildAcceptanceGate([]);
    return NextResponse.json({ results: [], gate });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;

  const claimMap: Record<number, string> = {};
  for (let i = 0; i < citations.length; i++) {
    const marker = `[${i + 1}]`;
    const markerIdx = answer.indexOf(marker);
    if (markerIdx === -1) continue;
    const before = answer.slice(0, markerIdx).trim();
    const breakAt = (s: string, sub: string) => { const j = s.lastIndexOf(sub); return j >= 0 ? j + sub.length : 0; };
    const lastBreak = Math.max(breakAt(before, '. '), breakAt(before, '! '), breakAt(before, '? '), breakAt(before, '.\n'));
    const claim = before.slice(lastBreak).replace(/\[\d+\]/g, '').trim();
    if (claim) claimMap[i] = claim;
  }

  const results: VerifyResult[] = [];

  for (let i = 0; i < citations.length; i++) {
    const url = citations[i];
    if (i >= MAX_CITATIONS_PER_REQUEST) {
      results.push({
        index: i,
        url,
        status: 'UNVERIFIABLE',
        sourceExcerpt: `Skipped by local safety cap (${MAX_CITATIONS_PER_REQUEST} citations per request).`,
      });
      continue;
    }

      const claim = claimMap[i];
      if (!claim?.trim()) {
        results.push({ index: i, url, status: 'UNVERIFIABLE' });
        continue;
      }

      const { pageText, serperText } = await fetchPageText(url, claim);

      const parts: string[] = [];
      if (pageText) parts.push(`--- SOURCE (${url}) ---\n${pageText.slice(0, MAX_SOURCE_CHARS)}`);
      if (serperText) parts.push(`--- WEB SEARCH ---\n${serperText}`);
      const sourceText = parts.join('\n\n') || null;

      if (!sourceText) {
        results.push({ index: i, url, claim, status: 'UNREACHABLE' });
        continue;
      }

      try {
        const atomicClaims = decomposeClaimAtomics(claim);
        let result = await verifyClaim(claim, sourceText, apiKey);

        // Filter disabled signals for ablation studies
        if (disabledSignals?.length && result.signals) {
          const filteredSignals = result.signals.filter(s => !disabledSignals.includes(s.name));
          result = { ...result, signals: filteredSignals };
        }

        results.push({ index: i, url, claim, atomicClaims: atomicClaims.length > 1 ? atomicClaims : undefined, ...result });
      } catch {
        results.push({
          index: i,
          url,
          claim,
          status: 'UNVERIFIABLE',
          sourceExcerpt: sourceText.slice(0, 240),
        });
      }
  }

  const gate = buildAcceptanceGate(results);
  return NextResponse.json({ results, gate });
}
