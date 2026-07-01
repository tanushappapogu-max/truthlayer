import {
  buildAcceptanceGate,
  clip,
  deriveDeterministicVerdict,
  runDeterministicDetector,
  tokenize,
  type DetectorReport,
  type DetectorSignal,
  type GateDecision,
  type VerifyResult,
} from '@/lib/truthlayer';

export type EvidenceGraphNodeKind =
  | 'claim'
  | 'source'
  | 'evidence'
  | 'entity'
  | 'quantity'
  | 'relation'
  | 'signal'
  | 'gate';

export type EvidenceGraphEdgeKind =
  | 'cites'
  | 'contains'
  | 'mentions'
  | 'grounds'
  | 'supports'
  | 'contradicts'
  | 'routes'
  | 'attenuates';

export type EvidenceGraphNode = {
  id: string;
  kind: EvidenceGraphNodeKind;
  label: string;
  score?: number;
  detail?: string;
};

export type EvidenceGraphEdge = {
  source: string;
  target: string;
  kind: EvidenceGraphEdgeKind;
  weight: number;
  label: string;
};

export type EvidenceGraph = {
  claim: string;
  sourceUrl?: string;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  report: DetectorReport;
  gate: {
    decision: GateDecision;
    support: number;
    risk: number;
    summary: string;
  };
};

export type LlamaComparison = {
  baseline: {
    name: string;
    acceptedUnsupported: number;
    falseAcceptRate: number;
    description: string;
  };
  truthlayer: {
    name: string;
    acceptedUnsupported: number;
    falseAcceptRate: number;
    interceptedUnsupported: number;
    abstainedUnsupported: number;
    description: string;
  };
  delta: {
    falseAcceptReduction: number;
    unsupportedInterceptedAtZeroModelCost: number;
  };
};

export const GRAPH_ARCHITECTURE_STAGES = [
  {
    stage: '0',
    name: 'LLaMA candidate',
    description: 'A standard decoder-only transformer produces an answer draft with citations or retrieved context.',
  },
  {
    stage: '1',
    name: 'Claim-evidence graph',
    description: 'TruthLayer converts the answer, cited sources, entities, numbers, relations, and detector signals into a typed graph.',
  },
  {
    stage: '2',
    name: 'Graph message passing',
    description: 'Signal, entity, and evidence nodes pass support/contradiction mass to each claim node.',
  },
  {
    stage: '3',
    name: 'Risk-conditioned decoding',
    description: 'A small adapter or logits processor biases generation away from unsupported spans and toward revision or abstention.',
  },
  {
    stage: '4',
    name: 'Acceptance gate',
    description: 'The graph-level gate releases, revises, rejects, or abstains with an auditable trace.',
  },
] as const;

const NUMBER_PATTERN = /\b\d[\d,]*(?:\.\d+)?%?\b/g;
const RELATION_PATTERN = /\b(?:founded|created|directed|written|produced|invented|composed|designed|organized|reviewed)\s+by\s+([^.;,\n]{2,70})/gi;

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function extractGraphEntities(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g) ?? [];
  return unique(matches)
    .filter(entity => !['The', 'This', 'That', 'There', 'Here', 'According'].includes(entity))
    .slice(0, 8);
}

function extractGraphNumbers(text: string): string[] {
  return unique((text.match(NUMBER_PATTERN) ?? []).map(number => number.replace(/,/g, ''))).slice(0, 8);
}

function extractGraphRelations(text: string): string[] {
  return unique([...text.matchAll(RELATION_PATTERN)].map(match => clip(match[0], 80))).slice(0, 5);
}

function nodeId(kind: EvidenceGraphNodeKind, label: string, index: number): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
  return `${kind}:${slug || index}`;
}

function addNode(nodes: EvidenceGraphNode[], node: EvidenceGraphNode) {
  if (!nodes.some(existing => existing.id === node.id)) nodes.push(node);
}

function addEdge(edges: EvidenceGraphEdge[], edge: EvidenceGraphEdge) {
  if (!edges.some(existing =>
    existing.source === edge.source &&
    existing.target === edge.target &&
    existing.kind === edge.kind
  )) {
    edges.push(edge);
  }
}

function signalEdgeKind(signal: DetectorSignal): EvidenceGraphEdgeKind {
  if (signal.verdict === 'CONTRADICT') return 'contradicts';
  if (signal.verdict === 'SUPPORT') return 'supports';
  if (signal.verdict === 'INSUFFICIENT') return 'attenuates';
  return 'routes';
}

export function buildClaimEvidenceGraph(input: {
  claim: string;
  sourceText: string;
  sourceUrl?: string;
}): EvidenceGraph {
  const report = runDeterministicDetector(input.claim, input.sourceText);
  const deterministic = deriveDeterministicVerdict(report);
  const result: VerifyResult = {
    index: 0,
    url: input.sourceUrl ?? 'local-evidence',
    claim: input.claim,
    status: deterministic?.status ?? 'UNVERIFIABLE',
    tier: deterministic ? 1 : undefined,
    confidence: deterministic?.confidence,
    supportScore: report.supportScore,
    contradictionScore: report.contradictionScore,
    evidenceCoverage: report.evidenceCoverage,
    sourceExcerpt: deterministic?.sourceExcerpt ?? report.evidenceWindows[0]?.text,
    signals: report.signals,
    evidenceWindows: report.evidenceWindows,
  };
  const gateReport = buildAcceptanceGate([result]);

  const nodes: EvidenceGraphNode[] = [];
  const edges: EvidenceGraphEdge[] = [];
  const claimId = 'claim:0';
  const sourceId = 'source:0';
  const gateId = 'gate:0';

  addNode(nodes, { id: claimId, kind: 'claim', label: clip(input.claim, 80), score: gateReport.score });
  addNode(nodes, { id: sourceId, kind: 'source', label: input.sourceUrl ? clip(input.sourceUrl, 60) : 'Retrieved evidence' });
  addNode(nodes, { id: gateId, kind: 'gate', label: gateReport.decision, score: gateReport.score, detail: gateReport.summary });
  addEdge(edges, { source: claimId, target: sourceId, kind: 'cites', weight: 1, label: 'cites' });
  addEdge(edges, { source: claimId, target: gateId, kind: 'routes', weight: gateReport.score, label: 'gate input' });

  report.evidenceWindows.forEach((window, index) => {
    const evidenceId = `evidence:${index}`;
    addNode(nodes, {
      id: evidenceId,
      kind: 'evidence',
      label: `Evidence window ${index + 1}`,
      score: window.coverage,
      detail: window.text,
    });
    addEdge(edges, {
      source: sourceId,
      target: evidenceId,
      kind: 'contains',
      weight: window.overlap,
      label: `${Math.round(window.coverage * 100)}% coverage`,
    });
    addEdge(edges, {
      source: evidenceId,
      target: claimId,
      kind: window.coverage >= 0.62 ? 'grounds' : 'routes',
      weight: window.coverage,
      label: 'grounds claim',
    });
  });

  const combinedEvidence = report.evidenceWindows.map(window => window.text).join(' ');
  const claimTokens = new Set(tokenize(input.claim));
  const evidenceTokens = new Set(tokenize(combinedEvidence));

  extractGraphEntities(input.claim).forEach((entity, index) => {
    const id = nodeId('entity', entity, index);
    const inEvidence = evidenceTokens.has(entity.toLowerCase()) || combinedEvidence.includes(entity);
    addNode(nodes, { id, kind: 'entity', label: entity, score: inEvidence ? 1 : 0.25 });
    addEdge(edges, { source: claimId, target: id, kind: 'mentions', weight: 0.9, label: 'mentions' });
    addEdge(edges, {
      source: id,
      target: report.evidenceWindows[0] ? 'evidence:0' : sourceId,
      kind: inEvidence ? 'grounds' : 'attenuates',
      weight: inEvidence ? 0.9 : 0.3,
      label: inEvidence ? 'found in evidence' : 'missing from evidence',
    });
  });

  extractGraphNumbers(input.claim).forEach((number, index) => {
    const id = nodeId('quantity', number, index);
    const inEvidence = extractGraphNumbers(combinedEvidence).includes(number);
    addNode(nodes, { id, kind: 'quantity', label: number, score: inEvidence ? 1 : 0.2 });
    addEdge(edges, { source: claimId, target: id, kind: 'mentions', weight: 0.9, label: 'uses number' });
    addEdge(edges, {
      source: id,
      target: report.evidenceWindows[0] ? 'evidence:0' : sourceId,
      kind: inEvidence ? 'grounds' : 'contradicts',
      weight: inEvidence ? 0.9 : 0.75,
      label: inEvidence ? 'number matched' : 'number missing',
    });
  });

  extractGraphRelations(input.claim).forEach((relation, index) => {
    const id = nodeId('relation', relation, index);
    const relationTokens = tokenize(relation);
    const hits = relationTokens.filter(token => claimTokens.has(token) || evidenceTokens.has(token)).length;
    const score = relationTokens.length ? hits / relationTokens.length : 0;
    addNode(nodes, { id, kind: 'relation', label: relation, score });
    addEdge(edges, { source: claimId, target: id, kind: 'mentions', weight: 0.8, label: 'relation' });
    addEdge(edges, {
      source: id,
      target: report.evidenceWindows[0] ? 'evidence:0' : sourceId,
      kind: score > 0.7 ? 'grounds' : 'routes',
      weight: score,
      label: 'relation evidence',
    });
  });

  report.signals.forEach((signal, index) => {
    if (signal.verdict === 'NEUTRAL') return;
    const id = `signal:${signal.name.toLowerCase()}:${index}`;
    addNode(nodes, {
      id,
      kind: 'signal',
      label: signal.label,
      score: signal.score,
      detail: signal.rationale,
    });
    addEdge(edges, {
      source: id,
      target: claimId,
      kind: signalEdgeKind(signal),
      weight: signal.score * signal.weight,
      label: signal.verdict.toLowerCase(),
    });
    addEdge(edges, {
      source: id,
      target: gateId,
      kind: signal.verdict === 'CONTRADICT' ? 'contradicts' : 'routes',
      weight: signal.score,
      label: 'gate signal',
    });
  });

  return {
    claim: input.claim,
    sourceUrl: input.sourceUrl,
    nodes,
    edges,
    report,
    gate: {
      decision: gateReport.decision,
      support: gateReport.score,
      risk: gateReport.risk,
      summary: gateReport.summary,
    },
  };
}

export function beforeAfterLlamaComparison(): LlamaComparison {
  const unsupported = 529;
  const caught = 126;
  const falseAccepts = 1;
  const abstainedUnsupported = unsupported - caught - falseAccepts;

  return {
    baseline: {
      name: 'Vanilla LLaMA / RAG pass-through',
      acceptedUnsupported: unsupported,
      falseAcceptRate: 1,
      description: 'A generation-only baseline has no release gate, so every unsupported cited claim is allowed through.',
    },
    truthlayer: {
      name: 'TruthLayer-gated LLaMA',
      acceptedUnsupported: falseAccepts,
      falseAcceptRate: falseAccepts / (caught + falseAccepts),
      interceptedUnsupported: caught,
      abstainedUnsupported,
      description: 'The graph gate rejects high-confidence contradictions and abstains on cases that need learned verification.',
    },
    delta: {
      falseAcceptReduction: 1 - falseAccepts / unsupported,
      unsupportedInterceptedAtZeroModelCost: caught / unsupported,
    },
  };
}

export function graphGateLlamaComparison(): LlamaComparison {
  const unsupported = 529;
  const rejected = 103;
  const falseAccepts = 19;
  const abstainedUnsupported = 407;

  return {
    baseline: {
      name: 'Vanilla LLaMA / RAG pass-through',
      acceptedUnsupported: unsupported,
      falseAcceptRate: 1,
      description: 'A generation-only baseline has no release gate, so every unsupported cited claim is allowed through.',
    },
    truthlayer: {
      name: 'TruthLayer graph gate',
      acceptedUnsupported: falseAccepts,
      falseAcceptRate: falseAccepts / unsupported,
      interceptedUnsupported: rejected,
      abstainedUnsupported,
      description: 'The lightweight graph gate rejects high-confidence contradictions and routes uncertain cases to revise or abstain.',
    },
    delta: {
      falseAcceptReduction: 1 - falseAccepts / unsupported,
      unsupportedInterceptedAtZeroModelCost: (rejected + abstainedUnsupported) / unsupported,
    },
  };
}
