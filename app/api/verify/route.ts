import { NextRequest, NextResponse } from 'next/server';
import {
  buildAcceptanceGate,
  decomposeClaimAtomics,
  deriveDeterministicVerdict,
  runDeterministicDetector,
} from '@/lib/truthlayer';
import type { DetectorReport, DetectorSignal, VerifyResult } from '@/lib/truthlayer';

const MAX_CITATIONS_PER_REQUEST = 12;
const MAX_SOURCE_CHARS = 5000;

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
    const cleaned = claim.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    const query = cleaned.length > 150 ? cleaned.slice(0, 150).replace(/\s\S*$/, '') : cleaned;
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 8 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts: string[] = [];
    if (data.answerBox?.answer) parts.push(`Answer: ${data.answerBox.answer}`);
    if (data.answerBox?.snippet) parts.push(`Summary: ${data.answerBox.snippet}`);
    if (data.knowledgeGraph?.description) parts.push(`Overview: ${data.knowledgeGraph.description}`);
    for (const r of data.organic ?? []) {
      if (r.snippet) parts.push(r.snippet);
    }
    return parts.join('\n\n') || null;
  } catch {
    return null;
  }
}

async function fetchViaSemanticScholar(claim: string): Promise<string | null> {
  try {
    const cleaned = claim.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    const query = cleaned.length > 120 ? cleaned.slice(0, 120).replace(/\s\S*$/, '') : cleaned;
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,abstract,tldr`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const parts: string[] = [];
    for (const paper of data.data ?? []) {
      if (paper.tldr?.text) parts.push(paper.tldr.text);
      else if (paper.abstract) parts.push(paper.abstract.slice(0, 500));
    }
    return parts.join('\n\n') || null;
  } catch {
    return null;
  }
}

async function fetchViaPubMed(url: string): Promise<string | null> {
  const pmcMatch = url.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i)
    || url.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/(PMC\d+)/i);
  if (!pmcMatch) return null;
  const pmcId = pmcMatch[1];
  try {
    const idRes = await fetch(
      `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${pmcId}&format=json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!idRes.ok) return null;
    const idData = await idRes.json();
    const pmid = idData.records?.[0]?.pmid;
    if (!pmid) return null;

    const absRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!absRes.ok) return null;
    const text = await absRes.text();
    return text.length > 100 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

function extractDOI(url: string): string | null {
  const doiMatch = url.match(/(?:doi\.org\/|\/doi\/(?:full\/|abs\/)?)(10\.\d{4,}\/[^\s?#]+)/i);
  if (doiMatch) return doiMatch[1];
  const natureMatch = url.match(/nature\.com\/articles\/(s\d+-\d+-\d+-\w)/);
  if (natureMatch) return `10.1038/${natureMatch[1]}`;
  return null;
}

async function fetchAcademicText(url: string, claim: string): Promise<string | null> {
  const pubmed = await fetchViaPubMed(url);
  if (pubmed) return pubmed;

  const doi = extractDOI(url);
  if (doi) {
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=title,abstract,tldr`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const paper = await res.json();
        const parts: string[] = [];
        if (paper.title) parts.push(paper.title);
        if (paper.tldr?.text) parts.push(paper.tldr.text);
        if (paper.abstract) parts.push(paper.abstract);
        const text = parts.join('\n\n');
        if (text.length > 100) return text.slice(0, 4000);
      }
    } catch { /* fall through */ }
  }

  return fetchViaSemanticScholar(claim);
}

function isUnfetchableDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return /(?:youtube\.com|youtu\.be|twitter\.com|x\.com|instagram\.com|tiktok\.com|facebook\.com)/.test(host);
  } catch { return false; }
}

function isPaywalledDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return /(?:nature\.com|sciencedirect\.com|springer\.com|wiley\.com|tandfonline\.com|jstor\.org|cell\.com|sciencemag\.org|science\.org)/.test(host);
  } catch { return false; }
}

function isAcademicDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return /(?:ncbi\.nlm\.nih\.gov|pmc\.ncbi|pubmed|arxiv\.org|biorxiv\.org|medrxiv\.org|doi\.org)/.test(host)
      || isPaywalledDomain(url);
  } catch { return false; }
}

async function fetchFallbackText(url: string, claim: string): Promise<string | null> {
  const serper = await fetchViaSerper(claim);
  if (serper) return serper;
  if (isAcademicDomain(url)) return fetchAcademicText(url, claim);
  return fetchViaSemanticScholar(claim);
}

async function fetchPageText(url: string, claim: string): Promise<{ pageText: string | null; serperText: string | null }> {
  if (isUnfetchableDomain(url)) {
    const serperText = await fetchFallbackText(url, claim);
    return { pageText: null, serperText };
  }

  if (isWikipediaUrl(url)) {
    const wikiText = await fetchViaWikipedia(url);
    if (wikiText && wikiText.length > 200) return { pageText: wikiText, serperText: null };
    const [jinaText, serperText] = await Promise.all([fetchViaJina(url), fetchFallbackText(url, claim)]);
    return { pageText: jinaText, serperText };
  }

  if (isAcademicDomain(url)) {
    const [jinaText, academicText] = await Promise.all([fetchViaJina(url), fetchAcademicText(url, claim)]);
    if (jinaText && jinaText.length > 200) return { pageText: jinaText, serperText: academicText };
    return { pageText: academicText, serperText: null };
  }

  const [jinaText, serperText] = await Promise.all([fetchViaJina(url), fetchFallbackText(url, claim)]);
  if (!jinaText || jinaText.length < 100) {
    return { pageText: null, serperText };
  }
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
      score: 0.88,
      weight: 0.3,
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
    score: 0.4,
    weight: 0.12,
    rationale: 'The judge could not verify the claim from the retrieved evidence.',
    evidence: result.sourceExcerpt,
  };
}

function attachDetector(
  result: ClaimVerification,
  detector: DetectorReport,
  extraSignals: DetectorSignal[] = [],
): ClaimVerification {
  const confidence = result.confidence ?? (result.status === 'SUPPORTED' ? 0.88 : result.status === 'UNSUPPORTED' ? 0.84 : 0.4);
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

const JUDGE_PROMPT = (claim: string, sourceText: string) => `You are a citation fact-checker. Verify the claim against the source text.

SOURCE TEXT:
${sourceText}

CLAIM:
${claim}

Verdicts:
- SUPPORTED: the source text confirms or is consistent with the claim. Paraphrasing is fine — the facts must match, not the wording.
- UNSUPPORTED: the source directly contradicts a specific fact in the claim (wrong number, wrong name, wrong date, opposite meaning).
- UNVERIFIABLE: the source contains absolutely nothing relevant to judge this claim.

Important: if the source discusses the same topic and the facts align, that is SUPPORTED even if worded differently. Only use UNSUPPORTED for clear factual contradictions. Only use UNVERIFIABLE if the source is completely off-topic.

Respond with ONLY valid JSON:
{"verdict":"SUPPORTED","sourceExcerpt":"most relevant quote (max 150 chars)"}
or
{"verdict":"UNSUPPORTED","sourceExcerpt":"quote showing contradiction","corrected":"what the source actually says"}
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

  if (s3.status === 'UNVERIFIABLE' && detector.evidenceCoverage >= 0.18 && detector.contradictionScore < 0.3) {
    return attachDetector(
      { status: 'SUPPORTED', tier: 3, confidence: 0.58, sourceExcerpt: detector.evidenceWindows[0]?.text },
      detector,
      [signalFromJudge({ status: 'SUPPORTED', sourceExcerpt: detector.evidenceWindows[0]?.text })]
    );
  }

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
    let markerIdx = answer.indexOf(marker);
    if (markerIdx === -1) continue;

    while (markerIdx > 0 && answer[markerIdx - 1] === '[') {
      markerIdx = answer.indexOf(marker, markerIdx + marker.length);
      if (markerIdx === -1) break;
    }
    if (markerIdx === -1) continue;

    const before = answer.slice(0, markerIdx).trim();
    const breakAt = (s: string, sub: string) => { const j = s.lastIndexOf(sub); return j >= 0 ? j + sub.length : 0; };
    const lastBreak = Math.max(
      breakAt(before, '. '),
      breakAt(before, '! '),
      breakAt(before, '? '),
      breakAt(before, '.\n'),
      breakAt(before, '\n\n'),
    );
    const claim = before.slice(lastBreak).replace(/\[\d+\]/g, '').replace(/\*\*/g, '').trim();
    if (claim && claim.length > 8) claimMap[i] = claim;
  }

  async function verifySingleCitation(i: number): Promise<VerifyResult> {
    const url = citations[i];
    if (i >= MAX_CITATIONS_PER_REQUEST) {
      return { index: i, url, status: 'UNVERIFIABLE', sourceExcerpt: `Skipped (cap: ${MAX_CITATIONS_PER_REQUEST}).` };
    }

    const claim = claimMap[i];
    if (!claim?.trim()) {
      return { index: i, url, status: 'UNCITED' };
    }

    const { pageText, serperText } = await fetchPageText(url, claim);

    const cleanPage = pageText
      ? pageText
          .replace(/\[([^\]]*)\]\(https?:\/\/[^)]+\)/g, '$1')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\n{3,}/g, '\n\n')
      : null;

    const parts: string[] = [];
    if (cleanPage && cleanPage.trim().length > 80) parts.push(`--- SOURCE (${url}) ---\n${cleanPage.slice(0, MAX_SOURCE_CHARS)}`);
    if (serperText) parts.push(`--- WEB SEARCH ---\n${serperText}`);
    const sourceText = parts.join('\n\n') || null;

    if (!sourceText) {
      return { index: i, url, claim, status: 'UNREACHABLE' };
    }

    try {
      const atomicClaims = decomposeClaimAtomics(claim);
      let result = await verifyClaim(claim, sourceText, apiKey);

      if (disabledSignals?.length && result.signals) {
        const filteredSignals = result.signals.filter(s => !disabledSignals.includes(s.name));
        result = { ...result, signals: filteredSignals };
      }

      return { index: i, url, claim, atomicClaims: atomicClaims.length > 1 ? atomicClaims : undefined, ...result };
    } catch {
      return { index: i, url, claim, status: 'UNVERIFIABLE', sourceExcerpt: sourceText.slice(0, 240) };
    }
  }

  const results = await Promise.all(
    citations.map((_, i) => verifySingleCitation(i))
  );

  const gate = buildAcceptanceGate(results);
  return NextResponse.json({ results, gate });
}
