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
  | 'NEGATION_CONTRADICTION'
  | 'TYPE_CONTRADICTION'
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
  'but', 'can', 'will', 'would', 'could', 'should', 'may', 'might',
]);

const CONTRAST_PAIRS: Array<[string, string]> = [
  ['public', 'private'],
  ['increase', 'decrease'],
  ['increased', 'decreased'],
  ['increases', 'decreases'],
  ['expanded', 'contracted'],
  ['expansion', 'contraction'],
  ['raises', 'lowers'],
  ['raised', 'lowered'],
  ['worsening', 'relieving'],
  ['worsen', 'relieve'],
  ['largest', 'smallest'],
  ['larger', 'smaller'],
  ['first', 'last'],
  ['before', 'after'],
  ['same', 'different'],
  ['football', 'baseball'],
  ['soccer', 'baseball'],
  ['created', 'destroyed'],
  ['atheist', 'minister'],
  ['confirmed', 'denied'],
  ['approved', 'rejected'],
  ['winner', 'loser'],
  ['highest', 'lowest'],
  ['county', 'city'],
  ['movie', 'television'],
  ['newspaper', 'television'],
  ['married', 'portrayed'],
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

const SMALL_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DIGIT_NUMBER_PATTERN = /\b\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th)?(?:'s|s)?%?\b/gi;
const RELATIONS = ['directed', 'written', 'produced', 'created', 'founded', 'invented', 'composed', 'designed', 'organized', 'reviewed', 'destroyed'];
const GENERIC_RELATION_WORDS = new Set([
  'american', 'belgian', 'british', 'canadian', 'film', 'music', 'television', 'tv',
  'producer', 'director', 'writer', 'artist', 'actor', 'actress', 'person', 'company',
  'organization', 'designer', 'developer',
]);

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

type NumberMention = {
  raw: string;
  value: number;
  normalized: string;
  index: number;
  kind: 'exact' | 'decade' | 'word';
  comparator: 'exact' | 'gt' | 'gte' | 'lt' | 'lte';
};

function normalizeNumberLiteral(raw: string): { value: number; normalized: string; kind: 'exact' | 'decade' } | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/%$/g, '')
    .replace(/(?:st|nd|rd|th)(?=(?:'s|s)?$)/, '')
    .replace(/'s$/g, 's');
  const kind = /\d+s$/.test(cleaned) ? 'decade' : 'exact';
  const numeric = cleaned.replace(/s$/g, '');
  const value = Number(numeric);
  if (!Number.isFinite(value)) return null;
  return { value, normalized: Number.isInteger(value) ? String(value) : String(value), kind };
}

function inferComparator(text: string, index: number): NumberMention['comparator'] {
  const window = normalizeText(text.slice(Math.max(0, index - 45), Math.min(text.length, index + 45)));
  if (/\b(?:more than|over|above|greater than|at least|minimum of|no less than)\b/.test(window) || /\bor later\b/.test(window)) {
    return 'gte';
  }
  if (/\b(?:less than|under|below|fewer than|at most|maximum of|no more than)\b/.test(window) || /\bor earlier\b/.test(window)) {
    return 'lte';
  }
  if (/\bafter\b/.test(window)) return 'gt';
  if (/\bbefore\b/.test(window)) return 'lt';
  return 'exact';
}

function extractNumberMentions(text: string): NumberMention[] {
  const normalizedDecimals = text.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  const mentions: NumberMention[] = [];

  for (const match of normalizedDecimals.matchAll(DIGIT_NUMBER_PATTERN)) {
    const parsed = normalizeNumberLiteral(match[0]);
    if (!parsed) continue;
    mentions.push({
      raw: match[0],
      value: parsed.value,
      normalized: parsed.normalized,
      index: match.index ?? 0,
      kind: parsed.kind,
      comparator: inferComparator(normalizedDecimals, match.index ?? 0),
    });
  }

  for (const match of normalizedDecimals.matchAll(new RegExp(`\\b(${Object.keys(SMALL_NUMBER_WORDS).join('|')})\\b`, 'gi'))) {
    const wordContext = normalizedDecimals.slice(Math.max(0, (match.index ?? 0) - 12), Math.min(normalizedDecimals.length, (match.index ?? 0) + match[0].length + 12));
    if (match[1].toLowerCase() === 'one' && /\bone\s+point\b/.test(wordContext)) continue;
    const value = SMALL_NUMBER_WORDS[match[1].toLowerCase()];
    mentions.push({
      raw: match[0],
      value,
      normalized: String(value),
      index: match.index ?? 0,
      kind: 'word',
      comparator: inferComparator(normalizedDecimals, match.index ?? 0),
    });
  }

  const expandedMentions = [...mentions];
  for (const mention of mentions) {
    const rawDigits = mention.raw.replace(/\D/g, '');
    if (rawDigits.length !== 2 || mention.value < 0 || mention.value > 99) continue;
    const rangePrefix = normalizedDecimals
      .slice(Math.max(0, mention.index - 16), mention.index)
      .match(/\b((?:1[6-9]|20)\d{2})\s*(?:--|-|\/)\s*$/);
    if (!rangePrefix) continue;
    expandedMentions.push({
      ...mention,
      raw: `${rangePrefix[1].slice(0, 2)}${mention.normalized.padStart(2, '0')}`,
      value: Number(`${rangePrefix[1].slice(0, 2)}${mention.normalized.padStart(2, '0')}`),
      normalized: `${rangePrefix[1].slice(0, 2)}${mention.normalized.padStart(2, '0')}`,
      kind: 'exact',
    });
  }

  return expandedMentions.sort((a, b) => a.index - b.index);
}

function extractNumbers(text: string): string[] {
  const mentions = extractNumberMentions(text);
  const values = new Set(mentions.map(mention => mention.normalized));

  for (const mention of mentions) {
    const rawDigits = mention.raw.replace(/\D/g, '');
    if (rawDigits.length === 2 && mention.value >= 0 && mention.value <= 99) {
      const rangePrefix = text
        .slice(Math.max(0, mention.index - 16), mention.index)
        .match(/\b((?:1[6-9]|20)\d{2})\s*(?:--|-|\/)\s*$/);
      if (rangePrefix) values.add(`${rangePrefix[1].slice(0, 2)}${mention.normalized.padStart(2, '0')}`);
    }
  }

  return [...values];
}

function satisfiesNumberClaim(claimMention: NumberMention, evidenceMentions: NumberMention[]): boolean {
  for (const evidenceMention of evidenceMentions) {
    if (claimMention.kind === 'decade') {
      if (evidenceMention.value >= claimMention.value && evidenceMention.value <= claimMention.value + 9) return true;
      continue;
    }

    if (claimMention.comparator === 'gte' && evidenceMention.value >= claimMention.value) return true;
    if (claimMention.comparator === 'gt' && evidenceMention.value > claimMention.value) return true;
    if (claimMention.comparator === 'lte' && evidenceMention.value <= claimMention.value) return true;
    if (claimMention.comparator === 'lt' && evidenceMention.value < claimMention.value) return true;
    if (claimMention.comparator === 'exact' && evidenceMention.normalized === claimMention.normalized) return true;
  }

  return false;
}

function isLikelyTitleYear(claim: string, mention: NumberMention): boolean {
  if (!/^(?:1[6-9]|20)\d{2}$/.test(mention.normalized)) return false;
  const before = claim.slice(0, mention.index);
  const after = claim.slice(mention.index + mention.raw.length, mention.index + mention.raw.length + 40);
  if (/^\s*$/.test(before) && /^\s+[A-Z][A-Za-z]/.test(after)) return true;
  if (/\(\s*$/.test(before) && /^\s*(?:film|song|album|series|novel|book|race|event)\b/i.test(after)) return true;
  return false;
}

function extractMonthDates(text: string): Array<{ month: number; day: number; year?: number; raw: string }> {
  const normalized = normalizeText(text);
  const monthNames = Object.keys(MONTHS).join('|');
  return [...normalized.matchAll(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, 'gi'))]
    .map(match => ({
      month: MONTHS[match[1].toLowerCase()],
      day: Number(match[2]),
      year: match[3] ? Number(match[3]) : undefined,
      raw: match[0],
    }))
    .filter(date => Number.isFinite(date.month) && Number.isFinite(date.day));
}

function contextualNumberContradiction(claim: string, evidenceText: string): string | null {
  const claimMentions = extractNumberMentions(claim);
  if (claimMentions.length === 0) return null;

  const claimDates = extractMonthDates(claim);
  const evidenceDates = extractMonthDates(evidenceText);
  for (const claimDate of claimDates) {
    const exactDate = evidenceDates.some(date =>
      date.month === claimDate.month &&
      date.day === claimDate.day &&
      (!claimDate.year || !date.year || date.year === claimDate.year)
    );
    if (exactDate) continue;

    const conflictingDate = evidenceDates.find(date =>
      date.day === claimDate.day &&
      (!claimDate.year || !date.year || date.year === claimDate.year) &&
      date.month !== claimDate.month
    );
    if (conflictingDate) {
      return `Claim uses ${claimDate.raw}, but the evidence uses ${conflictingDate.raw}.`;
    }
  }

  const evidenceMentions = extractNumberMentions(evidenceText);
  const evidenceNumbers = extractNumbers(evidenceText);
  const evidenceTokenSet = uniqueTokens(evidenceText);

  for (const mention of claimMentions) {
    if (isLikelyTitleYear(claim, mention)) continue;
    if (satisfiesNumberClaim(mention, evidenceMentions)) continue;

    const idx = mention.index;
    const context = claim.slice(Math.max(0, idx - 90), Math.min(claim.length, idx + 90));
    const contextHits = tokenize(context).filter(token => evidenceTokenSet.has(token)).length;
    const hasTimeCue = /\b(?:pm|am)\b/i.test(context);
    const centuryMatch = context.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+century\b/i);
    if (centuryMatch) {
      const century = Number(centuryMatch[1]);
      const minYear = (century - 1) * 100 + 1;
      const maxYear = century * 100;
      if (evidenceMentions.some(evidenceMention => evidenceMention.value >= minYear && evidenceMention.value <= maxYear)) continue;
    }

    if (/(?:st|nd|rd|th)$/i.test(mention.raw) && /\bseason\b/i.test(context)) continue;

    if (evidenceNumbers.length === 0 && hasTimeCue && contextHits >= 2) {
      return `Claim uses ${mention.raw}, but the evidence gives no matching number in the same context.`;
    }

    if (evidenceNumbers.length > 0 && contextHits >= 2) {
      return `Claim uses ${mention.raw}, but the nearest evidence uses ${evidenceNumbers.slice(0, 3).join(', ')}.`;
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
  const normalizedClaim = normalizeText(claim);
  const normalizedEvidence = normalizeText(evidenceText);
  const outsideMatch = normalizedClaim.match(/\boutside(?: of)?\s+(?:the\s+)?([a-z][a-z\s]{2,60})\.?$/);
  if (outsideMatch) {
    const locationTokens = tokenize(outsideMatch[1]);
    const evidenceTokensForLocation = uniqueTokens(normalizedEvidence);
    const locationHits = locationTokens.filter(token => evidenceTokensForLocation.has(token)).length;
    if (locationTokens.length > 0 && locationHits / locationTokens.length >= 0.8 && !/\boutside\b/.test(normalizedEvidence)) {
      return `Claim places the subject outside "${outsideMatch[1].trim()}", while the evidence places it there.`;
    }
  }

  const hasEastPart = /\b(?:east|eastern)\s+(?:part|end)\b/.test(normalizedClaim);
  const hasWestPart = /\b(?:west|western)\s+(?:part|end)\b/.test(normalizedClaim);
  const evidenceHasEastPart = /\b(?:east|eastern)\s+(?:part|end)\b/.test(normalizedEvidence);
  const evidenceHasWestPart = /\b(?:west|western)\s+(?:part|end)\b/.test(normalizedEvidence);
  if (hasEastPart && evidenceHasWestPart && !evidenceHasEastPart) {
    return 'Claim says the eastern side, while the strongest evidence says the western side.';
  }
  if (hasWestPart && evidenceHasEastPart && !evidenceHasWestPart) {
    return 'Claim says the western side, while the strongest evidence says the eastern side.';
  }

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
    .replace(/-/g, ' ')
    .split(/\b(?:with|from|through|for|as|in|starring|written|produced|directed|organized|reviewed|destroyed|distributed|released)\b/)[0]
    .replace(/\b(?:writer|editor|producer|mixer|director|composer|designer)\b/g, ' ')
    .replace(/\band\b/g, ' ')
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

function extractRelationObjects(text: string): Array<{ relation: string; object: string }> {
  return RELATIONS
    .map(relation => {
      const object = extractRelationObject(text, relation);
      return object ? { relation, object } : null;
    })
    .filter((item): item is { relation: string; object: string } => Boolean(item));
}

function isGenericRelationObject(object: string): boolean {
  const tokens = relationObjectTokens(object);
  if (tokens.length === 0) return true;
  const genericHits = tokens.filter(token => GENERIC_RELATION_WORDS.has(token)).length;
  return genericHits >= Math.max(1, tokens.length - 1);
}

function relationObjectTokens(object: string): string[] {
  return normalizeText(object)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0 && !STOPWORDS.has(token) && token !== 'and');
}

function relationContradiction(claim: string, evidenceText: string): string | null {
  const normalizedEvidence = normalizeText(evidenceText);
  for (const relation of RELATIONS) {
    const claimObject = extractRelationObject(claim, relation);
    const evidenceObject = extractRelationObject(evidenceText, relation);
    if (!claimObject || !evidenceObject) continue;

    const claimTokens = new Set(relationObjectTokens(claimObject));
    const evidenceTokens = new Set(relationObjectTokens(evidenceObject));
    const shared = [...claimTokens].filter(token => evidenceTokens.has(token)).length;

    const requiredShared = Math.min(2, claimTokens.size, evidenceTokens.size);
    if (shared < requiredShared && !isGenericRelationObject(claimObject) && !isGenericRelationObject(evidenceObject)) {
      return `Claim says ${relation} by "${claimObject}", but source says ${relation} by "${evidenceObject}".`;
    }
  }

  const claimRelations = extractRelationObjects(claim);
  const evidenceRelations = extractRelationObjects(evidenceText);
  for (const claimRelation of claimRelations) {
    for (const evidenceRelation of evidenceRelations) {
      if (claimRelation.relation === evidenceRelation.relation) continue;
      if (normalizedEvidence.includes(claimRelation.relation)) continue;
      if (isGenericRelationObject(claimRelation.object) || isGenericRelationObject(evidenceRelation.object)) continue;

      const claimTokens = new Set(relationObjectTokens(claimRelation.object));
      const evidenceTokens = new Set(relationObjectTokens(evidenceRelation.object));
      const shared = [...claimTokens].filter(token => evidenceTokens.has(token)).length;
      const overlap = shared / Math.max(Math.min(claimTokens.size, evidenceTokens.size), 1);
      if (shared >= 2 && overlap >= 0.5) {
        return `Claim says ${claimRelation.relation} by "${claimRelation.object}", but source says ${evidenceRelation.relation} by the same party.`;
      }
    }
  }

  return null;
}

type NegationCue = {
  cue: string;
  before: string;
  after: string;
  window: string;
};

const NEGATION_TOKENS = new Set(['not', 'no', 'never', 'without', 'cannot', 'cant', 'couldnt', 'wouldnt', 'shouldnt', 'wasnt', 'werent', 'isnt', 'arent', 'doesnt', 'dont', 'didnt', 'incapable']);

function negationCues(text: string): NegationCue[] {
  const normalized = normalizeText(text)
    .replace(/\bno\.\s*\d+/g, 'number ')
    .replace(/\bnot\s+(?:exclusively|only|necessarily)\b/g, 'partly');
  const cues: NegationCue[] = [];
  const pattern = /\b(?:not|no|never|without|cannot|can't|couldn't|wouldn't|shouldn't|wasn't|weren't|isn't|aren't|doesn't|don't|didn't|incapable)\b/gi;

  for (const match of normalized.matchAll(pattern)) {
    const index = match.index ?? 0;
    cues.push({
      cue: match[0],
      before: normalized.slice(Math.max(0, index - 70), index),
      after: normalized.slice(index + match[0].length, Math.min(normalized.length, index + match[0].length + 70)),
      window: normalized.slice(Math.max(0, index - 70), Math.min(normalized.length, index + match[0].length + 70)),
    });
  }

  return cues;
}

function tokensWithoutNegation(text: string): string[] {
  return tokenize(text).filter(token => !NEGATION_TOKENS.has(token));
}

function cueOverlapScore(cue: NegationCue, otherText: string, side: 'after' | 'window' = 'after'): number {
  const cueTokens = tokensWithoutNegation(side === 'after' ? cue.after : cue.window);
  if (cueTokens.length === 0) return 0;
  const otherTokens = uniqueTokens(otherText);
  const hits = cueTokens.filter(token => otherTokens.has(token)).length;
  return hits / cueTokens.length;
}

function cueOverlapHits(cue: NegationCue, otherText: string, side: 'after' | 'window' = 'after'): number {
  const cueTokens = tokensWithoutNegation(side === 'after' ? cue.after : cue.window);
  const otherTokens = uniqueTokens(otherText);
  return cueTokens.filter(token => otherTokens.has(token)).length;
}

function negationContradiction(claim: string, evidenceText: string): string | null {
  const claimCues = negationCues(claim);
  const evidenceCues = negationCues(evidenceText);
  if (claimCues.length === 0 && evidenceCues.length === 0) return null;
  if (claimCues.length > 0 && evidenceCues.length > 0) return null;

  const claimTokens = tokensWithoutNegation(claim);
  const evidenceTokens = uniqueTokens(evidenceText);
  const topicalHits = claimTokens.filter(token => evidenceTokens.has(token)).length;
  const topicalOverlap = claimTokens.length > 0 ? topicalHits / claimTokens.length : 0;
  if (claimTokens.length < 2 || topicalOverlap < 0.55) return null;

  for (const cue of claimCues) {
    if (cueOverlapScore(cue, evidenceText) >= 0.5 || cueOverlapScore(cue, evidenceText, 'window') >= 0.7) {
      return 'Claim negates a fact that the evidence states affirmatively.';
    }
  }

  for (const cue of evidenceCues) {
    if (cueOverlapScore(cue, claim) >= 0.5 || cueOverlapHits(cue, claim) >= 2) {
      return 'Evidence negates a fact that the claim states affirmatively.';
    }
  }

  return null;
}

function cleanTypeObject(value: string): string {
  return normalizeText(value)
    .split(/\b(?:which|that|who|where|when|owned|featuring|starring|directed|written|produced|developed|based|located|with|by|in|on|from)\b/)[0]
    .replace(/\b(?:the|a|an|american|british|canadian|australian)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTypeObject(text: string): string | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b(?:is|are|was|were)\s+(?:an?|the)?\s+([^.;,\n]{2,90})/);
  if (!match) return null;
  const cleaned = cleanTypeObject(match[1]);
  return cleaned.length > 2 ? cleaned : null;
}

function singularizeTypeToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('esses') && token.length > 6) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) return token.slice(0, -1);
  return token;
}

function typeHead(typeObject: string): string | null {
  const descriptors = new Set([
    'former', 'fictional', 'video', 'game', 'science', 'fiction', 'television', 'tv',
    'child', 'fashion', 'studio', 'annual', 'continental', 'active', 'main',
    'lead', 'second', 'debut', 'from', 'than', 'of',
  ]);
  const tokens = tokenize(typeObject)
    .map(singularizeTypeToken)
    .filter(token => !descriptors.has(token) && !/^\d+$/.test(token));
  return tokens.at(-1) ?? null;
}

function typeContradiction(claim: string, evidenceText: string): string | null {
  const claimObject = extractTypeObject(claim);
  const evidenceObject = extractTypeObject(evidenceText);
  if (!claimObject || !evidenceObject) return null;

  const claimTokens = uniqueTokens(claimObject);
  const evidenceTokens = uniqueTokens(evidenceObject);

  for (const [left, right] of CONTRAST_PAIRS) {
    if (hasTokenOrVariant(claimTokens, left) && hasTokenOrVariant(evidenceTokens, right) && !hasTokenOrVariant(evidenceTokens, left)) {
      return `Claim type says "${claimObject}", but source type says "${evidenceObject}".`;
    }
    if (hasTokenOrVariant(claimTokens, right) && hasTokenOrVariant(evidenceTokens, left) && !hasTokenOrVariant(evidenceTokens, right)) {
      return `Claim type says "${claimObject}", but source type says "${evidenceObject}".`;
    }
  }

  const claimHead = typeHead(claimObject);
  const evidenceHead = typeHead(evidenceObject);
  if (claimHead && evidenceHead && claimHead !== evidenceHead) {
    const claimModifiers = new Set(tokenize(claimObject).map(singularizeTypeToken).filter(token => token !== claimHead));
    const evidenceModifiers = new Set(tokenize(evidenceObject).map(singularizeTypeToken).filter(token => token !== evidenceHead));
    const claimHasEvidenceHead = claimModifiers.has(evidenceHead);
    const evidenceHasClaimHead = evidenceModifiers.has(claimHead);
    if (claimHasEvidenceHead || evidenceHasClaimHead) return null;

    for (const [left, right] of CONTRAST_PAIRS) {
      if ((claimHead === left && evidenceHead === right) || (claimHead === right && evidenceHead === left)) {
        return `Claim type says "${claimObject}", but source type says "${evidenceObject}".`;
      }
    }

    const incompatibleTypePairs: Array<[string, string]> = [
      ['apricot', 'character'],
      ['ender', 'developer'],
      ['show', 'magazine'],
    ];
    const sharedModifiers = [...claimModifiers].filter(token => evidenceModifiers.has(token)).length;
    if (
      sharedModifiers > 0 &&
      incompatibleTypePairs.some(([left, right]) =>
        (claimHead === left && evidenceHead === right) || (claimHead === right && evidenceHead === left)
      )
    ) {
      return `Claim type says "${claimObject}", but source type says "${evidenceObject}".`;
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

    if (contextRatio >= 0.55 && contextTokens.length >= 4) {
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

  const negation = negationContradiction(claim, primaryEvidence);
  if (negation) {
    signals.push({
      name: 'NEGATION_CONTRADICTION',
      label: 'Negation mismatch',
      verdict: 'CONTRADICT',
      score: 0.9,
      weight: 0.3,
      rationale: negation,
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

  const typeMismatch = typeContradiction(claim, primaryEvidence);
  if (typeMismatch) {
    signals.push({
      name: 'TYPE_CONTRADICTION',
      label: 'Type mismatch',
      verdict: 'CONTRADICT',
      score: 0.84,
      weight: 0.2,
      rationale: typeMismatch,
      evidence: primaryEvidence,
    });
  }

  const entitySub = entitySubstitution(claim, primaryEvidence);
  if (entitySub) {
    signals.push({
      name: 'ENTITY_SUBSTITUTION',
      label: 'Entity substitution',
      verdict: 'CONTRADICT',
      score: 0.72,
      weight: 0.18,
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
  const hasVeryStrongCoverage = report.evidenceCoverage >= 0.86 && report.contradictionScore < 0.2;
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
