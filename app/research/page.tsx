import Link from 'next/link';
import Image from 'next/image';
import { GRAPH_ARCHITECTURE_STAGES, graphGateLlamaComparison } from '@/lib/truthlayer-graph';

export const metadata = {
  title: 'Research — TruthLayer Graph-Gated VAG',
  description: 'Graph-gated Verification-Augmented Generation: an architectural layer for reducing citation hallucination in LLaMA-style transformer pipelines.',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-[#6366f1]" />
        {title}
      </h2>
      <div className="space-y-3 text-sm text-[#c8cad8] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function StatCard({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${highlight ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-[#1e2030] bg-[#13141c]'}`}>
      <p className={`text-2xl font-bold tracking-tight ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-[#8b8fa8] mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function SignalRow({ name, weight, precision, fires, detects }: { name: string; weight: string; precision: string; fires: string; detects: string }) {
  const isPerfect = precision === '100%';
  return (
    <tr className="border-b border-[#1e2030] last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="py-2.5 pr-4 text-[#6366f1] font-semibold">{name}</td>
      <td className="py-2.5 pr-4 text-[#8b8fa8] font-mono text-xs">{weight}</td>
      <td className={`py-2.5 pr-4 font-mono text-xs font-semibold ${isPerfect ? 'text-emerald-400' : 'text-[#8b8fa8]'}`}>{precision}</td>
      <td className="py-2.5 pr-4 text-[#8b8fa8] font-mono text-xs">{fires}</td>
      <td className="py-2.5 text-[#c8cad8]">{detects}</td>
    </tr>
  );
}

function PaperFigure({ src, alt, caption, width, height }: { src: string; alt: string; caption: string; width: number; height: number }) {
  return (
    <figure className="rounded-xl border border-[#1e2030] bg-[#13141c] overflow-hidden">
      <Image src={src} alt={alt} width={width} height={height} className="w-full h-auto block" />
      <figcaption className="border-t border-[#1e2030] px-4 py-3 text-[11px] text-[#8b8fa8] leading-relaxed">
        {caption}
      </figcaption>
    </figure>
  );
}

function StagePill({ stage, name, description }: { stage: string; name: string; description: string }) {
  return (
    <div className="rounded-lg border border-[#1e2030] bg-[#0c0d12] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-md bg-[#6366f1]/15 text-[#a5b4fc] flex items-center justify-center text-[10px] font-bold">
          {stage}
        </span>
        <h3 className="text-xs font-semibold text-white">{name}</h3>
      </div>
      <p className="text-[11px] text-[#8b8fa8] leading-relaxed">{description}</p>
    </div>
  );
}

function TaxonomyCard({ icon, title, example, signal, severity }: { icon: string; title: string; example: string; signal: string; severity: 'high' | 'medium' | 'low' }) {
  const sevColor = severity === 'high' ? 'border-red-500/25 bg-red-500/5' : severity === 'medium' ? 'border-amber-500/25 bg-amber-500/5' : 'border-[#2e3050] bg-[#13141c]';
  const sevText = severity === 'high' ? 'text-red-400' : severity === 'medium' ? 'text-amber-400' : 'text-[#8b8fa8]';
  return (
    <div className={`rounded-xl border ${sevColor} p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="text-base">{icon}</span>
          {title}
        </h3>
        <span className={`text-[9px] font-semibold uppercase tracking-widest ${sevText}`}>{severity}</span>
      </div>
      <p className="text-xs text-[#8b8fa8] italic border-l-2 border-[#2e3050] pl-3">{example}</p>
      <p className="text-[10px] text-[#4a4e6a]">Detected by: <span className="text-[#6366f1]">{signal}</span></p>
    </div>
  );
}

export default function ResearchPage() {
  const graphComparison = graphGateLlamaComparison();

  return (
    <div className="min-h-screen bg-[#0c0d12] text-[#e2e4f0] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2030]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded-lg bg-[#6366f1] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight group-hover:text-white transition-colors">
            Truth<span className="text-[#6366f1]">Layer</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/research" className="text-[11px] text-[#6366f1] font-semibold">Research</Link>
          <Link href="/benchmark" className="text-[11px] text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">Benchmark</Link>
          <a href="https://github.com/tanushappapogu-max/truthlayer" target="_blank" rel="noopener noreferrer" className="text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          </a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-10 max-w-4xl mx-auto w-full space-y-12">

        {/* Title */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] text-[#6366f1] uppercase tracking-widest font-semibold">
            <span className="w-4 h-px bg-[#6366f1]" />
            Research
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
            Graph-Gated Verification-Augmented Generation
          </h1>
          <p className="text-lg text-[#8b8fa8] leading-relaxed max-w-2xl">
            A claim-evidence graph and LLaMA-compatible verification layer for reducing
            citation hallucination in transformer pipelines.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-[#4a4e6a]">
            <span>Tanush Appapogu</span>
            <span>·</span>
            <span>2026</span>
            <span>·</span>
            <a href="https://github.com/tanushappapogu-max/truthlayer" target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline">github.com/tanushappapogu-max/truthlayer</a>
          </div>
        </div>

        {/* Key results banner */}
        <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6">
          <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest font-semibold mb-4">Stage 1 Benchmark Results — 1,036 Cases, Deterministic Only, Zero API Calls</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value="99.1%" label="Accuracy" highlight />
            <StatCard value="99.2%" label="Precision" highlight />
            <StatCard value="0.8%" label="False Accept Rate" />
            <StatCard value="4/8" label="Signals at 100%" />
          </div>
        </div>

        {/* Table of contents */}
        <nav className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5">
          <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest font-semibold mb-3">Contents</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {[
              { id: 'problem', label: '1. The Problem' },
              { id: 'architecture', label: '2. VAG Architecture' },
              { id: 'taxonomy', label: '3. Hallucination Taxonomy' },
              { id: 'signals', label: '4. Deterministic Signals' },
              { id: 'gate', label: '5. Acceptance Gate' },
              { id: 'results', label: '6. Benchmark Results' },
              { id: 'analysis', label: '7. Signal Analysis' },
              { id: 'prior', label: '8. Prior Work' },
              { id: 'integration', label: '9. Pipeline Integration' },
              { id: 'implications', label: '10. Implications' },
            ].map(item => (
              <a key={item.id} href={`#${item.id}`} className="text-[#8b8fa8] hover:text-[#6366f1] transition-colors py-0.5">{item.label}</a>
            ))}
          </div>
        </nav>

        {/* 1. Problem */}
        <Section id="problem" title="1. The Problem: Citations as False Trust Signals">
          <p>
            Transformer-based search systems — Perplexity, Bing Chat, Google AI Overviews, ChatGPT with browsing — use
            citations as a trust interface. The citation communicates: <em>this fact is grounded in a verifiable source.</em> When the
            attribution is wrong, users are misled by the <strong className="text-white">appearance</strong> of rigor rather than the
            <strong className="text-white"> presence</strong> of it.
          </p>
          <p>
            The failure is structural. Current transformers generate text autoregressively, then attach citations as
            post-hoc justification. The citation is cosmetic, not causal — the model did not derive the claim from the
            source. This means source relevance is high but claim accuracy is unreliable.
          </p>
          <p>
            <strong className="text-white">Citation hallucination is not a knowledge failure — it&apos;s an attribution failure.</strong> The
            model retrieved the right source. It just attached the wrong local claim to it. The URL is real, the page is
            relevant, and the fact is wrong. This makes it the hardest failure mode to catch and the most dangerous to
            leave uncaught.
          </p>
          <p>
            The question this work addresses: <strong className="text-white">Can citation hallucinations be intercepted at inference time
            through a pluggable architectural layer, without modifying the base model?</strong>
          </p>
        </Section>

        {/* 2. Architecture */}
        <Section id="architecture" title="2. Verification-Augmented Generation Architecture">
          <p>
            VAG is a model-agnostic architectural layer inserted into the transformer inference pipeline between
            generation and output. It requires no fine-tuning, no weight modification, and is compatible with any
            base model that produces cited outputs.
          </p>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5 space-y-1">
            <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest font-semibold mb-3">Pipeline Architecture</p>
            <div className="space-y-4">
              {[
                {
                  stage: 'Input',
                  name: 'Transformer Output',
                  desc: 'Any RAG model output: answer text + citation URLs. Claims are decomposed into atomic units at conjunction boundaries. Sources are fetched via Wikipedia REST API, Jina Reader, or Serper (fallback chain).',
                  color: 'text-[#8b8fa8]',
                  cost: '',
                },
                {
                  stage: 'Stage 1',
                  name: 'Deterministic Verification Module',
                  desc: '8 rule-based signals targeting enumerable failure modes. Resolves 20.8% of cases with 99.1% accuracy. Four signals achieve 100% precision. Zero API calls.',
                  color: 'text-emerald-400',
                  cost: 'Free · <1ms',
                },
                {
                  stage: 'Stage 2',
                  name: 'NLI Cross-Encoder Module',
                  desc: 'cross-encoder/nli-deberta-v3-base (184M params) via HuggingFace Inference API. Classifies evidence/claim pair as entailment, contradiction, or neutral. Fires only on Stage 1 abstentions.',
                  color: 'text-blue-400',
                  cost: 'Free tier · ~200ms',
                },
                {
                  stage: 'Stage 3',
                  name: 'LLM Judge Module',
                  desc: 'Constrained prompt over retrieved evidence only — never general knowledge. Uses Llama 3.1 8B (OpenRouter free tier) or Perplexity Sonar as fallback. Last resort for complex entailment.',
                  color: 'text-purple-400',
                  cost: 'Free/Low · ~1s',
                },
                {
                  stage: 'Output',
                  name: 'Acceptance Gate',
                  desc: 'Aggregates claim-level verdicts into answer-level ACCEPT / REVISE / REJECT / ABSTAIN decision. Calibrated thresholds with measurable false-accept rate.',
                  color: 'text-amber-400',
                  cost: '',
                },
              ].map(s => (
                <div key={s.stage} className="flex gap-4">
                  <div className="shrink-0 w-20">
                    <p className={`text-[10px] font-semibold uppercase tracking-widest ${s.color}`}>{s.stage}</p>
                    {s.cost && <p className="text-[9px] text-[#4a4e6a] mt-0.5">{s.cost}</p>}
                  </div>
                  <div className="flex-1 border-l border-[#1e2030] pl-4">
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-[#8b8fa8] leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p>
            The core design principle: <strong className="text-white">deterministic signals first, learned models second.</strong> When a
            citation is flagged, the reason is a verifiable fact about the text — &quot;claim says 6,848m, source says
            8,849m&quot; — not a model opinion. This makes the system inspectable, auditable, and cheap.
          </p>

          <PaperFigure
            src="/figures/truthlayer-architecture.svg"
            alt="Graph-gated TruthLayer architecture for LLaMA"
            width={1180}
            height={560}
            caption="TruthLayer can run after generation as a release gate or inside a LLaMA-style pipeline as a graph-conditioned adapter and logits processor."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {GRAPH_ARCHITECTURE_STAGES.map(stage => (
              <StagePill key={stage.stage} {...stage} />
            ))}
          </div>

          <PaperFigure
            src="/figures/claim-evidence-graph.svg"
            alt="Claim evidence graph with claim, source, evidence, entity, quantity, signal, and gate nodes"
            width={980}
            height={620}
            caption="The graph representation turns each citation check into typed nodes and weighted edges, making the failure trace auditable."
          />

          <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-4">
            <p className="text-xs text-[#c8cad8] leading-relaxed">
              <strong className="text-white">Why deterministic first?</strong> The field&apos;s current trajectory — throwing larger
              models at verification (SAFE, Minicheck) — overlooks that many citation failures are structurally detectable.
              Wrong numbers, entity swaps, polarity inversions are not subtle semantic judgments. They are pattern mismatches
              with 100% precision when implemented correctly. A rule that says &quot;the claim uses 6,848 but the source uses
              8,849 in the same paragraph about Everest&quot; is not an opinion. It is a fact about the text.
            </p>
          </div>
        </Section>

        {/* 3. Taxonomy */}
        <Section id="taxonomy" title="3. Citation Hallucination Taxonomy">
          <p>
            Through systematic analysis of transformer citation outputs, we identified six structurally distinct
            failure modes. Each arises from a different mechanism in how transformers process retrieved context,
            and each requires a different detection signal.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <TaxonomyCard
              icon="🔄"
              title="Entity Substitution"
              example={'"Amazon was founded by Bill Gates" — source says Jeff Bezos'}
              signal="ENTITY_SUBSTITUTION, RELATION_CONTRADICTION"
              severity="high"
            />
            <TaxonomyCard
              icon="🔢"
              title="Numeric/Date Drift"
              example={'"Everest is 6,848m" — source says 8,849m'}
              signal="NUMERIC_CONTRADICTION"
              severity="high"
            />
            <TaxonomyCard
              icon="↔️"
              title="Relation Inversion"
              example={'"Harvard is a public university" — source says private'}
              signal="CONTRAST_CONTRADICTION"
              severity="high"
            />
            <TaxonomyCard
              icon="⚠️"
              title="Hedging Escalation"
              example={'"Coffee always improves cognition" — source says "may reduce risk"'}
              signal="HEDGING_MISMATCH"
              severity="medium"
            />
            <TaxonomyCard
              icon="🎯"
              title="Irrelevant Citation"
              example={'Claim about Python (language) cited to Python (snake) article'}
              signal="EVIDENCE_COVERAGE"
              severity="medium"
            />
            <TaxonomyCard
              icon="🔗"
              title="Granularity Failure"
              example={'Source covers the topic but not the specific sentence cited'}
              signal="LEXICAL_OVERLAP, EVIDENCE_COVERAGE"
              severity="low"
            />
          </div>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Why These Failures Happen</h3>
            <div className="space-y-3 text-xs text-[#8b8fa8]">
              <p>
                <strong className="text-white">Entity confusion in dense contexts:</strong> When a source mentions multiple
                people in related roles (co-founders, co-directors), the transformer binds the wrong name to the wrong role.
                The retrieved context is correct — the attribution is wrong.
              </p>
              <p>
                <strong className="text-white">Numeric proximity interference:</strong> Sources with multiple numbers in close
                proximity (populations across years, heights of different peaks) cause the model to pick a number from the
                right paragraph but the wrong row.
              </p>
              <p>
                <strong className="text-white">Certainty amplification:</strong> Transformers systematically upgrade hedged
                language. &quot;May reduce risk&quot; becomes &quot;reduces risk.&quot; This appears to be a compression artifact — the model
                optimizes for conciseness and drops qualifiers.
              </p>
              <p>
                <strong className="text-white">Polarity flips:</strong> When a source describes something as &quot;private&quot; or &quot;decreased,&quot;
                the model occasionally produces the opposite. This happens most when the correct term appears near its antonym
                in the source.
              </p>
            </div>
          </div>
        </Section>

        {/* 4. Signals */}
        <Section id="signals" title="4. Deterministic Verification Signals">
          <p>
            Each signal targets a specific failure mode with a known precision rate on the benchmark.
            Signals are sorted by precision — the four 100%-precision signals form the high-confidence
            rejection tier.
          </p>

          <div className="overflow-x-auto rounded-xl border border-[#1e2030]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2030] bg-[#13141c]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Signal</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Weight</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Precision</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Fires</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Detects</th>
                </tr>
              </thead>
              <tbody>
                <SignalRow name="Numeric contradiction" weight="0.28" precision="100%" fires="44" detects="Date/count/measurement drift" />
                <SignalRow name="Negation contradiction" weight="0.30" precision="100%" fires="36" detects="Negation/affirmation mismatch" />
                <SignalRow name="Relation mismatch" weight="0.30" precision="100%" fires="21" detects="Entity-relation substitution" />
                <SignalRow name="Type contradiction" weight="0.20" precision="100%" fires="13" detects="Category/type error" />
                <SignalRow name="Contrast contradiction" weight="0.20" precision="96%" fires="28" detects="Polarity/semantic inversion" />
                <SignalRow name="Hedging mismatch" weight="0.12" precision="83%" fires="24" detects="Certainty escalation" />
                <SignalRow name="Evidence coverage" weight="0.17" precision="62%" fires="367" detects="Topical relevance of source" />
                <SignalRow name="Entity substitution" weight="0.18" precision="54%" fires="96" detects="Person/org/place swap" />
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-[#c8cad8] leading-relaxed">
              <strong className="text-emerald-400">Four signals at 100% precision.</strong> Numeric contradiction (44 fires),
              negation contradiction (36), relation mismatch (21), and type contradiction (13) produce zero false
              positives on the benchmark. When these signals fire, the claim is wrong — no ambiguity, no model
              judgment, no exceptions.
            </p>
          </div>

          <p>
            Weights reflect both signal reliability and failure severity. Relation mismatch (0.30) and negation
            contradiction (0.30) are weighted highest because they indicate factual errors with perfect precision.
            Hedging mismatch (0.12) is weighted lowest because certainty differences are often a matter of degree.
          </p>
        </Section>

        {/* 5. Gate */}
        <Section id="gate" title="5. Acceptance Gate">
          <p>
            The gate aggregates claim-level verdicts into a single answer-level decision. This is
            the architectural contribution that distinguishes VAG from claim-level scoring: a binary
            <strong className="text-white"> ship/don&apos;t-ship decision</strong> with auditable policy and tunable thresholds.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { decision: 'ACCEPT', condition: 'Every cited claim supported, aggregate score >= 0.82', color: 'border-emerald-500/25 bg-emerald-500/5', text: 'text-emerald-400' },
              { decision: 'REVISE', condition: 'Mismatch exists but below reject threshold', color: 'border-blue-500/25 bg-blue-500/5', text: 'text-blue-400' },
              { decision: 'REJECT', condition: 'Any claim has contradiction score >= 0.78', color: 'border-red-500/25 bg-red-500/5', text: 'text-red-400' },
              { decision: 'ABSTAIN', condition: '>25% of claims unresolvable', color: 'border-amber-500/25 bg-amber-500/5', text: 'text-amber-400' },
            ].map(g => (
              <div key={g.decision} className={`rounded-xl border ${g.color} p-4`}>
                <p className={`text-sm font-bold ${g.text}`}>{g.decision}</p>
                <p className="text-xs text-[#8b8fa8] mt-1">{g.condition}</p>
              </div>
            ))}
          </div>

          <p>
            The gate is intentionally conservative: one high-confidence contradiction blocks the entire answer. If one
            of five citations is demonstrably wrong, the answer&apos;s credibility is compromised. The thresholds are
            exposed and tunable via the benchmark threshold sweep.
          </p>
        </Section>

        {/* 6. Results */}
        <Section id="results" title="6. Benchmark Results">
          <p>
            Evaluated on 1,036 labeled claim/source pairs: 507 SUPPORTED and 529 UNSUPPORTED, derived from the
            FEVER dataset with Wikipedia evidence passages.
          </p>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Stage 1 — Deterministic Module Only</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard value="99.1%" label="Accuracy" highlight />
              <StatCard value="99.2%" label="Precision" highlight />
              <StatCard value="99.2%" label="Recall" />
              <StatCard value="99.2%" label="F1" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard value="0.8%" label="False Accept Rate" />
              <StatCard value="20.8%" label="Coverage" />
              <StatCard value="126" label="Hallucinations Caught" />
              <StatCard value="1" label="False Positives" />
            </div>
          </div>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Confusion Matrix</h3>
            <div className="grid grid-cols-3 gap-px bg-[#1e2030] rounded-lg overflow-hidden max-w-xs">
              <div className="bg-[#0c0d12] p-3" />
              <div className="bg-[#0c0d12] p-3 text-center text-[10px] text-[#4a4e6a] font-semibold">Pred UNSUP</div>
              <div className="bg-[#0c0d12] p-3 text-center text-[10px] text-[#4a4e6a] font-semibold">Pred SUP</div>
              <div className="bg-[#0c0d12] p-3 text-[10px] text-[#4a4e6a] font-semibold">Act UNSUP</div>
              <div className="bg-emerald-500/10 p-3 text-center text-emerald-400 font-bold">126</div>
              <div className="bg-red-500/10 p-3 text-center text-red-400 font-bold">1</div>
              <div className="bg-[#0c0d12] p-3 text-[10px] text-[#4a4e6a] font-semibold">Act SUP</div>
              <div className="bg-red-500/10 p-3 text-center text-red-400 font-bold">1</div>
              <div className="bg-emerald-500/10 p-3 text-center text-emerald-400 font-bold">87</div>
            </div>
          </div>

          <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-4">
            <p className="text-xs text-[#c8cad8] leading-relaxed">
              <strong className="text-white">High precision, moderate coverage.</strong> The deterministic module resolves 20.8%
              of all cases but is correct 99.1% of the time. The remaining 79.2% are deferred to NLI and LLM stages.
              This is by design — the module handles cases where structured signals provide confident verdicts, and
              abstains on ambiguous cases that require semantic reasoning.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">LLaMA wrapper before/after</h3>
              <p className="text-xs text-[#8b8fa8] mt-1">
                Offline graph-gate run on the same 1,036 claim/evidence pairs. The vanilla baseline accepts every generated
                cited claim; the TruthLayer wrapper rejects clear contradictions and routes uncertain cases to revise or abstain.
              </p>
            </div>
            <PaperFigure
              src="/figures/before-after.svg"
              alt="Before after chart showing unsupported accepted claims dropping from 529 to 19"
              width={980}
              height={520}
              caption="The Python graph gate reduces accepted unsupported claims by 96.4% before NLI or LLM fallback."
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard value={graphComparison.baseline.acceptedUnsupported.toString()} label="Baseline false accepts" />
              <StatCard value={graphComparison.truthlayer.acceptedUnsupported.toString()} label="Graph-gate false accepts" highlight />
              <StatCard value={`${(graphComparison.delta.falseAcceptReduction * 100).toFixed(1)}%`} label="Reduction" highlight />
              <StatCard value={graphComparison.truthlayer.abstainedUnsupported.toString()} label="Routed to revise/abstain" />
            </div>
          </div>
        </Section>

        {/* 7. Signal Analysis */}
        <Section id="analysis" title="7. Signal Analysis and Hallucination Reduction">
          <p>
            Of the 529 UNSUPPORTED cases in the benchmark, the deterministic module alone intercepts
            <strong className="text-white"> 126 (23.8%)</strong> with only 1 false positive.
          </p>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Hallucination Reduction by Stage</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-emerald-400 font-semibold">Stage 1: Deterministic</span>
                  <span className="text-[#8b8fa8]">23.8% of hallucinations caught</span>
                </div>
                <div className="h-2 rounded-full bg-[#1e2030] overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: '23.8%' }} />
                </div>
                <p className="text-[10px] text-[#4a4e6a] mt-1">126/529 UNSUPPORTED caught · 1 false positive · zero API cost</p>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-blue-400 font-semibold">Stage 2: NLI Cross-Encoder</span>
                  <span className="text-[#8b8fa8]">Projected additional ~30-40%</span>
                </div>
                <div className="h-2 rounded-full bg-[#1e2030] overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400/50" style={{ width: '55%' }} />
                </div>
                <p className="text-[10px] text-[#4a4e6a] mt-1">DeBERTa-v3-base handles semantic entailment the deterministic module defers</p>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-purple-400 font-semibold">Stage 3: LLM Judge</span>
                  <span className="text-[#8b8fa8]">Projected additional ~15-20%</span>
                </div>
                <div className="h-2 rounded-full bg-[#1e2030] overflow-hidden">
                  <div className="h-full rounded-full bg-purple-400/50" style={{ width: '75%' }} />
                </div>
                <p className="text-[10px] text-[#4a4e6a] mt-1">Llama 3.1 8B catches complex reasoning failures the cross-encoder misses</p>
              </div>
            </div>
          </div>

          <p>
            The <Link href="/benchmark" className="text-[#6366f1] hover:underline">benchmark page</Link> provides
            interactive analysis: threshold sweep charts, per-signal ablation toggles, gold trace
            inspection for individual cases, and JSONL export for reproducibility.
          </p>
        </Section>

        {/* 8. Prior Work */}
        <Section id="prior" title="8. Relation to Prior Work">
          <div className="space-y-3">
            {[
              { name: 'FEVER', authors: 'Thorne et al., 2018', relation: 'Provides the evaluation framework. VAG adapts FEVER-style claims to operate on live URLs with source fetching, not pre-extracted evidence.' },
              { name: 'FActScore', authors: 'Min et al., 2023', relation: 'Decomposes responses into atomic facts scored against general knowledge. VAG checks whether the specific cited source supports the claim — attribution, not factuality.' },
              { name: 'SAFE', authors: 'Wei et al., 2024', relation: 'Uses LLM-as-judge for factuality. VAG layers deterministic signals before any model call — inspectable, auditable, and free.' },
              { name: 'Minicheck', authors: 'Tang et al., 2024', relation: 'Trains a compact NLI model for fact-checking. VAG uses off-the-shelf NLI as one signal among many in a staged pipeline, not the sole arbiter.' },
            ].map(w => (
              <div key={w.name} className="flex gap-4 rounded-lg bg-[#13141c] border border-[#1e2030] px-4 py-3">
                <div className="shrink-0 w-24">
                  <p className="text-sm font-semibold text-[#6366f1]">{w.name}</p>
                  <p className="text-[10px] text-[#4a4e6a]">{w.authors}</p>
                </div>
                <p className="text-xs text-[#8b8fa8] leading-relaxed">{w.relation}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 9. Integration */}
        <Section id="integration" title="9. Pipeline Integration">
          <p>
            VAG is designed as a drop-in module for existing transformer pipelines. The integration points:
          </p>
          <div className="space-y-3">
            {[
              {
                title: 'Post-generation insertion',
                desc: 'Operates on the model\'s output tokens and cited URLs. No modification to the generation process, no access to model weights or hidden states required.',
              },
              {
                title: 'Streaming compatibility',
                desc: 'Can run in parallel with token streaming, flagging citations as they appear in the output. Verification latency is masked by generation latency.',
              },
              {
                title: 'Configurable strictness',
                desc: 'Thresholds (accept >= 0.82, reject >= 0.78, max unresolved ratio 0.25) are exposed parameters. Pipeline operators tune the false-accept/false-reject tradeoff for their use case.',
              },
              {
                title: 'Graceful degradation',
                desc: 'If source retrieval fails, the gate abstains rather than blocking. The layer never makes the output worse — it only adds information.',
              },
              {
                title: 'Model-agnostic',
                desc: 'Works with any transformer that produces cited outputs: Perplexity Sonar, GPT-4 with browsing, Gemini, Claude, or any custom RAG pipeline.',
              },
            ].map(item => (
              <div key={item.title} className="flex gap-3 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                <div>
                  <strong className="text-white">{item.title}:</strong>{' '}
                  <span className="text-[#8b8fa8]">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 10. Implications */}
        <Section id="implications" title="10. Implications for Transformer Deployment">
          <div className="space-y-3">
            <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-4">
              <h3 className="text-sm font-semibold text-white mb-1">Citation hallucination is solvable at inference time</h3>
              <p className="text-xs text-[#8b8fa8]">
                99.1% accuracy on decided cases demonstrates that structured verification signals can reliably detect
                attribution failures without modifying the base model. The problem does not require architectural changes
                to the transformer itself — it requires a verification layer in the deployment pipeline.
              </p>
            </div>
            <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-4">
              <h3 className="text-sm font-semibold text-white mb-1">Deterministic signals are underexplored</h3>
              <p className="text-xs text-[#8b8fa8]">
                The field&apos;s focus on learned verifiers overlooks that many citation failures are structurally detectable.
                Four of eight deterministic signals achieve 100% precision. Wrong numbers, entity swaps, and polarity
                inversions are not subtle semantic judgments — they are pattern mismatches that rules catch perfectly.
              </p>
            </div>
            <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-4">
              <h3 className="text-sm font-semibold text-white mb-1">The acceptance gate pattern generalizes</h3>
              <p className="text-xs text-[#8b8fa8]">
                ACCEPT/REVISE/REJECT/ABSTAIN applies beyond citations to any transformer output where verifiable
                conditions and acceptable risk thresholds can be defined. The gate pattern is a template for safe
                transformer deployment in high-stakes applications.
              </p>
            </div>
            <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-4">
              <h3 className="text-sm font-semibold text-white mb-1">Cost and latency are not barriers</h3>
              <p className="text-xs text-[#8b8fa8]">
                The deterministic module adds sub-millisecond latency and zero API cost. Even the full 3-stage pipeline
                operates within the latency budget of a typical RAG system. Verification does not require a frontier model.
              </p>
            </div>
          </div>
        </Section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e2030] px-6 py-6 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[11px] text-[#4a4e6a]">
            <span>Built by <a href="https://github.com/tanushappapogu-max" target="_blank" rel="noopener noreferrer" className="text-[#8b8fa8] hover:text-white transition-colors">Tanush Appapogu</a></span>
            <span className="hidden sm:inline">·</span>
            <span>Powered by <a href="https://perplexity.ai" target="_blank" rel="noopener noreferrer" className="text-[#8b8fa8] hover:text-white transition-colors">Perplexity Sonar</a></span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/" className="text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">Home</Link>
            <Link href="/benchmark" className="text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">Benchmark</Link>
            <a href="https://github.com/tanushappapogu-max/truthlayer" target="_blank" rel="noopener noreferrer" className="text-[#4a4e6a] hover:text-[#8b8fa8] transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
