export type VerifyStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIABLE' | 'UNREACHABLE';

export type GateDecision = 'ACCEPT' | 'REVISE' | 'REJECT' | 'ABSTAIN';

export type DetectorVerdict = 'SUPPORT' | 'CONTRADICT' | 'INSUFFICIENT' | 'NEUTRAL';

export type SignalName =
  | 'SOURCE_RETRIEVAL'
  | 'LEXICAL_OVERLAP'
  | 'EVIDENCE_COVERAGE'
  | 'NUMERIC_CONTRADICTION'
  | 'CONTRAST_CONTRADICTION'
  | 'RELATION_CONTRADICTION'
  | 'ENTITY_SUBSTITUTION'
  | 'HEDGING_MISMATCH'
  | 'QUOTE_MATCH'
  | 'LLM_JUDGE'
  | 'NLI_MODEL';

export type DetectorSignal = {
  name: SignalName;
  label: string;
  verdict: DetectorVerdict;
  score: number;
  weight: number;
  rationale: string;
  evidence?: string;
};

export type EvidenceWindow = {
  text: string;
  overlap: number;
  coverage: number;
  position: number;
};

export type DetectorReport = {
  signals: DetectorSignal[];
  evidenceWindows: EvidenceWindow[];
  supportScore: number;
  contradictionScore: number;
  evidenceCoverage: number;
};

export type VerifyResult = {
  index: number;
  url: string;
  claim?: string;
  atomicClaims?: string[];
  status: VerifyStatus;
  tier?: 1 | 2 | 3;
  confidence?: number;
  supportScore?: number;
  contradictionScore?: number;
  evidenceCoverage?: number;
  sourceExcerpt?: string;
  corrected?: string;
  signals?: DetectorSignal[];
  evidenceWindows?: EvidenceWindow[];
};

export type AcceptanceGateReport = {
  methodVersion: string;
  decision: GateDecision;
  label: string;
  score: number;
  risk: number;
  summary: string;
  counts: Record<VerifyStatus, number> & { total: number };
  thresholds: {
    acceptScore: number;
    rejectContradiction: number;
    maxUnresolvedRatio: number;
  };
  policy: string[];
  failureModes: string[];
};

// --- Benchmark analysis types ---

export type ConfusionMatrix = {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
};

export type BenchmarkAnalysis = {
  matrix: ConfusionMatrix;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  falseAcceptRate: number;
  falseRejectRate: number;
  abstentionRate: number;
  coverageConditionedAccuracy: number;
  calibrationError: number;
  perSignalContribution: Record<string, { fires: number; correct: number; incorrect: number }>;
};

export type ThresholdPoint = {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  falseAcceptRate: number;
  falseRejectRate: number;
};

// --- Text utilities ---

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'was', 'were', 'are',
  'has', 'had', 'have', 'its', 'his', 'her', 'their', 'about', 'into', 'than',
  'then', 'also', 'only', 'according', 'source', 'claim', 'been', 'being',
  'which', 'who', 'whom', 'where', 'when', 'what', 'how', 'does', 'did',
  'not', 'but', 'can', 'will', 'would', 'could', 'should', 'may', 'might',
]);

const CONTRAST_PAIRS: Array<[string, string]> = [
  ['public', 'private'],
  ['increase', 'decrease'],
  ['increased', 'decreased'],
  ['increases', 'decreases'],
  ['expanded', 'contracted'],
  ['expansion', 'contraction'],
  ['largest', 'smallest'],
  ['larger', 'smaller'],
  ['first', 'last'],
  ['before', 'after'],
  ['football', 'baseball'],
  ['soccer', 'baseball'],
  ['directed', 'produced'],
  ['atheist', 'minister'],
  ['confirmed', 'denied'],
  ['approved', 'rejected'],
  ['winner', 'loser'],
  ['highest', 'lowest'],
  ['majority', 'minority'],
  ['ancient', 'modern'],
  ['domestic', 'international'],
  ['fictional', 'real'],
  ['voluntary', 'mandatory'],
  ['urban', 'rural'],
  ['offensive', 'defensive'],
  ['protagonist', 'antagonist'],
  ['independent', 'dependent'],
];

const HEDGING_STRONG = ['always', 'never', 'all', 'none', 'every', 'no one', 'nobody', 'entirely', 'completely', 'absolutely', 'certainly', 'undoubtedly', 'definitely', 'exclusively', 'solely', 'only'];
const HEDGING_WEAK = ['sometimes', 'often', 'usually', 'generally', 'frequently', 'occasionally', 'rarely', 'seldom', 'some', 'many', 'most', 'few', 'several', 'partly', 'partially', 'arguably', 'possibly', 'potentially', 'approximately', 'roughly', 'nearly', 'almost'];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.\s"'%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

function uniqueTokens(text: string): Set<string> {
  return new Set(tokenize(text));
}

export function clip(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}...`;
}

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const matches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return matches.map(sentence => sentence.trim()).filter(sentence => sentence.length > 20);
}

// --- Entity extraction ---

function extractEntities(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [];
  const filtered = matches.filter(e => {
    const lower = e.toLowerCase();
    return e.length > 2 && !['The', 'This', 'That', 'These', 'Those', 'There', 'Here', 'What', 'When', 'Where', 'Which', 'However', 'Although', 'According', 'Also', 'After', 'Before', 'During', 'Since', 'While', 'Because', 'Therefore', 'Furthermore', 'Moreover', 'Nevertheless', 'Meanwhile'].map(w => w.toLowerCase()).includes(lower);
  });
  return [...new Set(filtered)];
}

function normalizeEntity(entity: string): string {
  return entity.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// --- Claim decomposition ---

export function decomposeClaimAtomics(claim: string): string[] {
  const conjunctions = claim.split(/\b(?:and|as well as|in addition to|while also|additionally)\b/i);
  if (conjunctions.length <= 1) return [claim.trim()];

  return conjunctions
    .map(part => part.trim())
    .filter(part => part.length > 15 && tokenize(part).length >= 3);
}

// --- Evidence selection ---

export function selectEvidenceWindows(claim: string, sourceText: string, limit = 3): EvidenceWindow[] {
  const claimTokens = [...uniqueTokens(claim)];
  if (claimTokens.length === 0) return [];

  const sentences = splitSentences(sourceText);
  const windows: EvidenceWindow[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const text = [sentences[i], sentences[i + 1]].filter(Boolean).join(' ');
    const windowTokens = uniqueTokens(text);
    const hits = claimTokens.filter(token => windowTokens.has(token)).length;
    const coverage = hits / claimTokens.length;
    const density = hits / Math.max(windowTokens.size, 1);
    const overlap = clamp01(coverage * 0.78 + Math.min(density * 3, 1) * 0.22);

    windows.push({
      text: clip(text, 520),
      overlap,
      coverage,
      position: i,
    });
  }

  return windows
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);
}

// --- Detector signals ---

function ngramOverlap(claim: string, sourceText: string, n = 5): number {
  const claimWords = tokenize(claim);
  if (claimWords.length < n) return 0;

  const source = normalizeText(sourceText);
  const grams: string[] = [];
  for (let i = 0; i <= claimWords.length - n; i++) {
    grams.push(claimWords.slice(i, i + n).join(' '));
  }

  const matchCount = grams.filter(gram => source.includes(gram)).length;
  return grams.length > 0 ? matchCount / grams.length : 0;
}

function extractNumbers(text: string): string[] {
  // Extract from original text (before normalization strips commas)
  return [...text.matchAll(/\b\d[\d,]*(?:\.\d+)?%?\b/g)].map(match =>
    match[0].replace(/,/g, '')
  );
}

function contextualNumberContradiction(claim: string, evidenceText: string): string | null {
  const claimMatches = [...claim.matchAll(/\b\d[\d,]*(?:\.\d+)?%?\b/g)];
  if (claimMatches.length === 0) return null;

  const evidenceNumbers = extractNumbers(evidenceText);
  if (evidenceNumbers.length === 0) return null;
  const evidenceTokenSet = uniqueTokens(evidenceText);

  for (const match of claimMatches) {
    const rawNumber = match[0];
    const normalizedNumber = rawNumber.replace(/,/g, '');
    if (evidenceNumbers.includes(normalizedNumber)) continue;

    const idx = match.index ?? 0;
    const context = claim.slice(Math.max(0, idx - 90), Math.min(claim.length, idx + 90));
    const contextHits = tokenize(context).filter(token => evidenceTokenSet.has(token)).length;
    if (contextHits >= 2) {
      return `Claim uses ${rawNumber}, but the nearest evidence uses ${evidenceNumbers.slice(0, 3).join(', ')}.`;
    }
  }

  return null;
}

function stemToken(token: string): string {
  return token
    .replace(/(?:ly|ed|ing|tion|ment|ness|ity|ous|ive|ful|less|able|ible|ally|ily)$/, '')
    .replace(/i$/, 'y'); // privately -> privat -> privaty? No: just match root
}

function hasTokenOrVariant(tokens: Set<string>, target: string): boolean {
  if (tokens.has(target)) return true;
  const targetStem = stemToken(target);
  if (targetStem.length < 3) return false;
  for (const t of tokens) {
    if (stemToken(t) === targetStem) return true;
    // Also check if one contains the other (e.g., "privately" contains "private")
    if (t.length >= 4 && target.length >= 4 && (t.startsWith(target) || target.startsWith(t))) return true;
  }
  return false;
}

function contrastContradiction(claim: string, evidenceText: string): string | null {
  const claimTokens = uniqueTokens(claim);
  const evidenceTokens = uniqueTokens(evidenceText);

  for (const [left, right] of CONTRAST_PAIRS) {
    if (hasTokenOrVariant(claimTokens, left) && hasTokenOrVariant(evidenceTokens, right) && !hasTokenOrVariant(evidenceTokens, left)) {
      return `Claim says "${left}", while the strongest evidence says "${right}".`;
    }
    if (hasTokenOrVariant(claimTokens, right) && hasTokenOrVariant(evidenceTokens, left) && !hasTokenOrVariant(evidenceTokens, right)) {
      return `Claim says "${right}", while the strongest evidence says "${left}".`;
    }
  }

  return null;
}

function cleanRelationObject(value: string): string {
  return normalizeText(value)
    .split(/\b(?:and|with|from|through|for|as|starring|written|produced|directed)\b/)[0]
    .replace(/\b(?:the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRelationObject(text: string, relation: string): string | null {
  const normalized = normalizeText(text);
  const match = normalized.match(new RegExp(`\\b${relation}\\s+by\\s+([^.;,\\n]{2,90})`));
  if (!match) return null;
  const cleaned = cleanRelationObject(match[1]);
  return cleaned.length > 2 ? cleaned : null;
}

function relationContradiction(claim: string, evidenceText: string): string | null {
  for (const relation of ['directed', 'written', 'produced', 'created', 'founded', 'invented', 'composed', 'designed']) {
    const claimObject = extractRelationObject(claim, relation);
    const evidenceObject = extractRelationObject(evidenceText, relation);
    if (!claimObject || !evidenceObject) continue;

    const claimTokens = uniqueTokens(claimObject);
    const evidenceTokens = uniqueTokens(evidenceObject);
    const shared = [...claimTokens].filter(token => evidenceTokens.has(token)).length;

    if (shared === 0) {
      return `Claim says ${relation} by "${claimObject}", but source says ${relation} by "${evidenceObject}".`;
    }
  }

  return null;
}

function entitySubstitution(claim: string, evidenceText: string): string | null {
  const claimEntities = extractEntities(claim);
  const evidenceEntities = extractEntities(evidenceText);
  if (claimEntities.length === 0 || evidenceEntities.length === 0) return null;

  const evidenceNormalized = new Set(evidenceEntities.map(normalizeEntity));
  const evidenceTokenSet = uniqueTokens(evidenceText);
  const claimTokens = tokenize(claim);

  for (const entity of claimEntities) {
    const normalized = normalizeEntity(entity);
    if (normalized.length < 4) continue;
    if (evidenceNormalized.has(normalized)) continue;

    const entityTokens = normalized.split(/\s+/);
    const anyPartialMatch = entityTokens.some(t => evidenceNormalized.has(t) || [...evidenceNormalized].some(en => en.includes(t) || t.includes(en)));
    if (anyPartialMatch) continue;

    const contextTokens = claimTokens.filter(t => t !== normalized && !entityTokens.includes(t));
    const contextInEvidence = contextTokens.filter(t => evidenceTokenSet.has(t)).length;
    const contextRatio = contextTokens.length > 0 ? contextInEvidence / contextTokens.length : 0;

    if (contextRatio >= 0.35 && contextTokens.length >= 2) {
      const candidates = evidenceEntities
        .filter(e => normalizeEntity(e) !== normalized)
        .slice(0, 3)
        .map(e => `"${e}"`)
        .join(', ');

      if (candidates) {
        return `Entity "${entity}" not found in source. Evidence mentions ${candidates} in similar context.`;
      }
    }
  }

  return null;
}

function hedgingMismatch(claim: string, evidenceText: string): string | null {
  const claimLower = claim.toLowerCase();
  const evidenceLower = evidenceText.toLowerCase();

  for (const strong of HEDGING_STRONG) {
    if (!claimLower.includes(strong)) continue;
    for (const weak of HEDGING_WEAK) {
      if (evidenceLower.includes(weak)) {
        return `Claim uses strong language ("${strong}"), but source hedges with "${weak}".`;
      }
    }
  }

  return null;
}

// --- Detector orchestration ---

export function runDeterministicDetector(claim: string, sourceText: string): DetectorReport {
  const evidenceWindows = selectEvidenceWindows(claim, sourceText);
  const primaryEvidence = evidenceWindows[0]?.text ?? clip(sourceText, 520);
  const signals: DetectorSignal[] = [];

  signals.push({
    name: 'SOURCE_RETRIEVAL',
    label: 'Source retrieval',
    verdict: sourceText.length > 200 ? 'NEUTRAL' : 'INSUFFICIENT',
    score: clamp01(sourceText.length / 2000),
    weight: 0.08,
    rationale: sourceText.length > 200 ? 'Readable source text was retrieved.' : 'The retrieved source text is too short.',
    evidence: clip(sourceText, 180),
  });

  const overlap = ngramOverlap(claim, sourceText);
  signals.push({
    name: 'LEXICAL_OVERLAP',
    label: 'Claim/source overlap',
    verdict: overlap >= 0.6 ? 'SUPPORT' : 'NEUTRAL',
    score: overlap,
    weight: 0.2,
    rationale:
      overlap >= 0.6
        ? 'Most claim n-grams appear in the source.'
        : 'The claim is not present verbatim; semantic verification is needed.',
    evidence: primaryEvidence,
  });

  const coverage = evidenceWindows[0]?.coverage ?? 0;
  signals.push({
    name: 'EVIDENCE_COVERAGE',
    label: 'Evidence coverage',
    verdict: coverage >= 0.65 ? 'SUPPORT' : coverage <= 0.18 ? 'INSUFFICIENT' : 'NEUTRAL',
    score: coverage,
    weight: 0.17,
    rationale:
      coverage >= 0.65
        ? 'A compact evidence window covers most claim terms.'
        : coverage <= 0.18
          ? 'No retrieved passage covers enough of the claim.'
          : 'The source has partial topical overlap with the claim.',
    evidence: primaryEvidence,
  });

  const quotedMatch = claim.match(/"([^"]{8,})"/);
  if (quotedMatch) {
    const hasQuote = normalizeText(sourceText).includes(normalizeText(quotedMatch[1]));
    signals.push({
      name: 'QUOTE_MATCH',
      label: 'Quoted text',
      verdict: hasQuote ? 'SUPPORT' : 'INSUFFICIENT',
      score: hasQuote ? 0.97 : 0.15,
      weight: 0.12,
      rationale: hasQuote ? 'The quoted span appears in the source.' : 'The quoted span was not found in the source.',
      evidence: hasQuote ? `"${quotedMatch[1]}"` : primaryEvidence,
    });
  }

  const numberContradiction = contextualNumberContradiction(claim, primaryEvidence);
  if (numberContradiction) {
    signals.push({
      name: 'NUMERIC_CONTRADICTION',
      label: 'Number/date mismatch',
      verdict: 'CONTRADICT',
      score: 0.88,
      weight: 0.28,
      rationale: numberContradiction,
      evidence: primaryEvidence,
    });
  }

  const contrast = contrastContradiction(claim, primaryEvidence);
  if (contrast) {
    signals.push({
      name: 'CONTRAST_CONTRADICTION',
      label: 'Semantic contrast',
      verdict: 'CONTRADICT',
      score: 0.82,
      weight: 0.2,
      rationale: contrast,
      evidence: primaryEvidence,
    });
  }

  const relation = relationContradiction(claim, primaryEvidence);
  if (relation) {
    signals.push({
      name: 'RELATION_CONTRADICTION',
      label: 'Relation mismatch',
      verdict: 'CONTRADICT',
      score: 0.9,
      weight: 0.3,
      rationale: relation,
      evidence: primaryEvidence,
    });
  }

  const entitySub = entitySubstitution(claim, primaryEvidence);
  if (entitySub) {
    signals.push({
      name: 'ENTITY_SUBSTITUTION',
      label: 'Entity substitution',
      verdict: 'CONTRADICT',
      score: 0.85,
      weight: 0.26,
      rationale: entitySub,
      evidence: primaryEvidence,
    });
  }

  const hedging = hedgingMismatch(claim, primaryEvidence);
  if (hedging) {
    signals.push({
      name: 'HEDGING_MISMATCH',
      label: 'Certainty mismatch',
      verdict: 'CONTRADICT',
      score: 0.62,
      weight: 0.12,
      rationale: hedging,
      evidence: primaryEvidence,
    });
  }

  const supportScore = clamp01(
    signals
      .filter(signal => signal.verdict === 'SUPPORT')
      .reduce((sum, signal) => sum + signal.score * signal.weight, 0) /
      Math.max(
        signals.filter(signal => signal.verdict === 'SUPPORT').reduce((sum, signal) => sum + signal.weight, 0),
        0.01
      )
  );

  const contradictionScore = clamp01(
    signals
      .filter(signal => signal.verdict === 'CONTRADICT')
      .reduce((max, signal) => Math.max(max, signal.score), 0)
  );

  return {
    signals,
    evidenceWindows,
    supportScore,
    contradictionScore,
    evidenceCoverage: coverage,
  };
}

export function deriveDeterministicVerdict(
  report: DetectorReport
): { status: 'SUPPORTED' | 'UNSUPPORTED'; confidence: number; sourceExcerpt?: string } | null {
  const contradiction = report.signals
    .filter(signal => signal.verdict === 'CONTRADICT')
    .sort((a, b) => b.score - a.score)[0];

  if (contradiction && contradiction.score >= 0.82) {
    return {
      status: 'UNSUPPORTED',
      confidence: contradiction.score,
      sourceExcerpt: contradiction.evidence,
    };
  }

  const hasStrongOverlap = report.signals.some(
    signal => signal.name === 'LEXICAL_OVERLAP' && signal.verdict === 'SUPPORT' && signal.score >= 0.72
  );
  const hasStrongCoverage = report.evidenceCoverage >= 0.62;
  const hasVeryStrongCoverage = report.evidenceCoverage >= 0.78 && report.contradictionScore < 0.2;
  const hasQuoteMatch = report.signals.some(
    signal => signal.name === 'QUOTE_MATCH' && signal.verdict === 'SUPPORT' && signal.score >= 0.95
  );

  if (hasQuoteMatch || hasVeryStrongCoverage || (hasStrongOverlap && hasStrongCoverage)) {
    return {
      status: 'SUPPORTED',
      confidence: Math.max(report.supportScore, 0.84),
      sourceExcerpt: report.evidenceWindows[0]?.text,
    };
  }

  return null;
}

// --- Acceptance gate ---

function scoreResult(result: VerifyResult): { support: number; contradiction: number; unresolved: number } {
  if (result.status === 'SUPPORTED') {
    return {
      support: clamp01(result.supportScore ?? result.confidence ?? 0.78),
      contradiction: clamp01(result.contradictionScore ?? 0),
      unresolved: 0,
    };
  }

  if (result.status === 'UNSUPPORTED') {
    return {
      support: clamp01(result.supportScore ?? 0.12),
      contradiction: clamp01(result.contradictionScore ?? result.confidence ?? 0.82),
      unresolved: 0,
    };
  }

  if (result.status === 'UNVERIFIABLE') {
    return { support: 0.42, contradiction: 0.25, unresolved: 1 };
  }

  return { support: 0.2, contradiction: 0.35, unresolved: 1 };
}

export function buildAcceptanceGate(results: VerifyResult[]): AcceptanceGateReport {
  const counts = {
    SUPPORTED: results.filter(result => result.status === 'SUPPORTED').length,
    UNSUPPORTED: results.filter(result => result.status === 'UNSUPPORTED').length,
    UNVERIFIABLE: results.filter(result => result.status === 'UNVERIFIABLE').length,
    UNREACHABLE: results.filter(result => result.status === 'UNREACHABLE').length,
    total: results.length,
  };

  const thresholds = {
    acceptScore: 0.82,
    rejectContradiction: 0.78,
    maxUnresolvedRatio: 0.25,
  };

  if (results.length === 0) {
    return {
      methodVersion: 'truthlayer-gate-v0.3',
      decision: 'ABSTAIN',
      label: 'No citations',
      score: 0,
      risk: 1,
      summary: 'No cited claims were available for verification.',
      counts,
      thresholds,
      policy: gatePolicy(),
      failureModes: ['No citations supplied'],
    };
  }

  const scored = results.map(scoreResult);
  const averageSupport = scored.reduce((sum, item) => sum + item.support, 0) / scored.length;
  const maxContradiction = scored.reduce((max, item) => Math.max(max, item.contradiction), 0);
  const unresolvedRatio = scored.reduce((sum, item) => sum + item.unresolved, 0) / scored.length;
  const penalty = maxContradiction * 0.55 + unresolvedRatio * 0.25;
  const score = clamp01(averageSupport - penalty);
  const risk = clamp01(1 - score + maxContradiction * 0.25 + unresolvedRatio * 0.18);

  let decision: GateDecision;
  let label: string;
  const failureModes: string[] = [];

  if (counts.UNSUPPORTED > 0 && maxContradiction >= thresholds.rejectContradiction) {
    decision = 'REJECT';
    label = 'Blocked';
    failureModes.push('High-confidence contradiction found');
  } else if (counts.UNSUPPORTED > 0) {
    decision = 'REVISE';
    label = 'Needs revision';
    failureModes.push('At least one citation does not support its claim');
  } else if (unresolvedRatio > thresholds.maxUnresolvedRatio || counts.UNREACHABLE > 0) {
    decision = 'ABSTAIN';
    label = 'Insufficient evidence';
    failureModes.push('Too many claims could not be verified');
  } else if (score >= thresholds.acceptScore && counts.SUPPORTED === counts.total) {
    decision = 'ACCEPT';
    label = 'Accepted';
  } else {
    decision = 'REVISE';
    label = 'Borderline';
    failureModes.push('Support score below acceptance threshold');
  }

  return {
    methodVersion: 'truthlayer-gate-v0.3',
    decision,
    label,
    score,
    risk,
    summary: gateSummary(decision, counts, score, risk),
    counts,
    thresholds,
    policy: gatePolicy(),
    failureModes,
  };
}

function gatePolicy(): string[] {
  return [
    'REJECT if any cited claim has high-confidence contradiction evidence (score >= 0.78).',
    'REVISE if a citation mismatch exists but confidence is below the reject threshold.',
    'ABSTAIN if source retrieval or evidence coverage leaves >25% of claims unresolved.',
    'ACCEPT only when every cited claim is supported and aggregate score >= 0.82.',
  ];
}

function gateSummary(
  decision: GateDecision,
  counts: AcceptanceGateReport['counts'],
  score: number,
  risk: number
): string {
  const pct = Math.round(score * 100);
  const riskPct = Math.round(risk * 100);

  if (decision === 'ACCEPT') {
    return `All ${counts.total} cited claims cleared the gate (${pct}% support, ${riskPct}% residual risk).`;
  }
  if (decision === 'REJECT') {
    return `${counts.UNSUPPORTED} cited claim${counts.UNSUPPORTED === 1 ? '' : 's'} contradicted source evidence (${riskPct}% risk).`;
  }
  if (decision === 'ABSTAIN') {
    return `${counts.UNVERIFIABLE + counts.UNREACHABLE} cited claim${counts.UNVERIFIABLE + counts.UNREACHABLE === 1 ? '' : 's'} lacked enough evidence to verify.`;
  }
  return `The answer needs revision before release (${pct}% support, ${riskPct}% risk).`;
}

// --- Benchmark analysis ---

export function computeConfusionMatrix(
  predictions: Array<{ predicted: VerifyStatus; expected: 'SUPPORTED' | 'UNSUPPORTED' }>
): ConfusionMatrix {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const { predicted, expected } of predictions) {
    if (predicted === 'UNVERIFIABLE' || predicted === 'UNREACHABLE') continue;
    if (predicted === 'UNSUPPORTED' && expected === 'UNSUPPORTED') tp++;
    else if (predicted === 'UNSUPPORTED' && expected === 'SUPPORTED') fp++;
    else if (predicted === 'SUPPORTED' && expected === 'UNSUPPORTED') fn++;
    else if (predicted === 'SUPPORTED' && expected === 'SUPPORTED') tn++;
  }
  return { tp, fp, fn, tn };
}

export function computeBenchmarkAnalysis(
  predictions: Array<{
    predicted: VerifyStatus;
    expected: 'SUPPORTED' | 'UNSUPPORTED';
    confidence?: number;
    signals?: DetectorSignal[];
  }>
): BenchmarkAnalysis {
  const matrix = computeConfusionMatrix(predictions);
  const { tp, fp, fn, tn } = matrix;
  const scored = tp + fp + fn + tn;
  const total = predictions.length;

  const accuracy = scored > 0 ? (tp + tn) / scored : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const falseAcceptRate = fn + tn > 0 ? fn / (fn + tp) : 0;
  const falseRejectRate = fp + tn > 0 ? fp / (fp + tn) : 0;

  const abstentionCount = predictions.filter(p => p.predicted === 'UNVERIFIABLE' || p.predicted === 'UNREACHABLE').length;
  const abstentionRate = total > 0 ? abstentionCount / total : 0;

  const coverageConditionedAccuracy = scored > 0 ? (tp + tn) / scored : 0;

  // Calibration error (ECE with 10 bins)
  let calibrationError = 0;
  const bins = 10;
  for (let b = 0; b < bins; b++) {
    const lower = b / bins;
    const upper = (b + 1) / bins;
    const binItems = predictions.filter(p => {
      const conf = p.confidence ?? 0.5;
      return conf >= lower && conf < upper && p.predicted !== 'UNVERIFIABLE' && p.predicted !== 'UNREACHABLE';
    });
    if (binItems.length === 0) continue;
    const avgConf = binItems.reduce((sum, p) => sum + (p.confidence ?? 0.5), 0) / binItems.length;
    const avgAcc = binItems.filter(p => p.predicted === p.expected).length / binItems.length;
    calibrationError += (Math.abs(avgConf - avgAcc) * binItems.length) / scored;
  }

  // Per-signal contribution
  const perSignalContribution: Record<string, { fires: number; correct: number; incorrect: number }> = {};
  for (const p of predictions) {
    if (!p.signals) continue;
    for (const signal of p.signals) {
      if (signal.verdict === 'NEUTRAL' || signal.verdict === 'INSUFFICIENT') continue;
      if (!perSignalContribution[signal.name]) {
        perSignalContribution[signal.name] = { fires: 0, correct: 0, incorrect: 0 };
      }
      const entry = perSignalContribution[signal.name];
      entry.fires++;
      const signalSaysUnsupported = signal.verdict === 'CONTRADICT';
      const actuallyUnsupported = p.expected === 'UNSUPPORTED';
      if (signalSaysUnsupported === actuallyUnsupported) entry.correct++;
      else entry.incorrect++;
    }
  }

  return {
    matrix,
    accuracy,
    precision,
    recall,
    f1,
    falseAcceptRate,
    falseRejectRate,
    abstentionRate,
    coverageConditionedAccuracy,
    calibrationError,
    perSignalContribution,
  };
}

export function computeThresholdSweep(
  predictions: Array<{
    predicted: VerifyStatus;
    expected: 'SUPPORTED' | 'UNSUPPORTED';
    confidence?: number;
  }>,
  steps = 20
): ThresholdPoint[] {
  const points: ThresholdPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const threshold = i / steps;
    let tp = 0, fp = 0, fn = 0, tn = 0;

    for (const p of predictions) {
      if (p.predicted === 'UNVERIFIABLE' || p.predicted === 'UNREACHABLE') continue;
      const conf = p.confidence ?? 0.5;
      const predUnsupported = p.predicted === 'UNSUPPORTED' && conf >= threshold;
      const actualUnsupported = p.expected === 'UNSUPPORTED';

      if (predUnsupported && actualUnsupported) tp++;
      else if (predUnsupported && !actualUnsupported) fp++;
      else if (!predUnsupported && actualUnsupported) fn++;
      else tn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const falseAcceptRate = tp + fn > 0 ? fn / (tp + fn) : 0;
    const falseRejectRate = fp + tn > 0 ? fp / (fp + tn) : 0;

    points.push({ threshold, precision, recall, f1, falseAcceptRate, falseRejectRate });
  }

  return points;
}
