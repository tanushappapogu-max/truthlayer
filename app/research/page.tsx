import Link from 'next/link';

export const metadata = {
  title: 'Research — TruthLayer',
  description: 'Reverse-engineering citation hallucination: taxonomy, detector methodology, and acceptance gate design.',
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

function SignalRow({ name, weight, fires, detects }: { name: string; weight: string; fires: string; detects: string }) {
  return (
    <tr className="border-b border-[#1e2030] last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="py-2.5 pr-4 text-[#6366f1] font-semibold">{name}</td>
      <td className="py-2.5 pr-4 text-[#8b8fa8] font-mono text-xs">{weight}</td>
      <td className="py-2.5 pr-4 text-[#8b8fa8]">{fires}</td>
      <td className="py-2.5 text-[#c8cad8]">{detects}</td>
    </tr>
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
            Reverse-Engineering Citation Hallucination
          </h1>
          <p className="text-base text-[#8b8fa8] leading-relaxed max-w-2xl">
            How AI search systems produce plausible but wrong citations, why existing approaches miss them,
            and how a calibrated acceptance gate can catch them before they reach users.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-[#4a4e6a]">
            <span>Tanush Appapogu</span>
            <span>·</span>
            <span>2025</span>
            <span>·</span>
            <a href="https://github.com/tanushappapogu-max/truthlayer" target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline">github.com/tanushappapogu-max/truthlayer</a>
          </div>
        </div>

        {/* Table of contents */}
        <nav className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5">
          <p className="text-[10px] text-[#4a4e6a] uppercase tracking-widest font-semibold mb-3">Contents</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {[
              { id: 'problem', label: '1. The Problem' },
              { id: 'taxonomy', label: '2. Hallucination Taxonomy' },
              { id: 'reverse', label: '3. Reverse Engineering' },
              { id: 'pipeline', label: '4. Detection Pipeline' },
              { id: 'signals', label: '5. Detector Signals' },
              { id: 'gate', label: '6. Acceptance Gate' },
              { id: 'evaluation', label: '7. Evaluation' },
              { id: 'prior', label: '8. Prior Work' },
              { id: 'implications', label: '9. Implications' },
            ].map(item => (
              <a key={item.id} href={`#${item.id}`} className="text-[#8b8fa8] hover:text-[#6366f1] transition-colors py-0.5">{item.label}</a>
            ))}
          </div>
        </nav>

        {/* 1. Problem */}
        <Section id="problem" title="1. The Problem: Citations as False Trust Signals">
          <p>
            LLM-powered search products — Perplexity, Bing Chat, Google AI Overviews, ChatGPT with browsing — cite sources
            as a trust signal. The citation says: <em>this fact comes from a real source, and you can check it.</em> When the
            attribution is wrong, users are misled by the <strong className="text-white">appearance</strong> of rigor rather than the
            <strong className="text-white"> presence</strong> of it.
          </p>
          <p>
            This is worse than no citation at all. Without a citation, a reader applies their own skepticism. With a citation
            to a real URL, the reader&apos;s guard is down. The source exists. The page loads. The topic is relevant. But the
            specific claim attached to that citation marker is wrong.
          </p>
          <p>
            The core insight: <strong className="text-white">citation hallucination is not a retrieval failure — it&apos;s an attribution failure.</strong> The
            model retrieved a relevant source. It just attached the wrong local claim to it. The URL is real, the page is
            relevant, and the fact is wrong. This makes it much harder to catch than a hallucinated URL or a completely
            irrelevant source.
          </p>
        </Section>

        {/* 2. Taxonomy */}
        <Section id="taxonomy" title="2. Hallucination Taxonomy">
          <p>
            By systematically testing AI search outputs against their cited sources, I identified six distinct failure modes.
            Each has different detection characteristics and requires different signals to catch:
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
        </Section>

        {/* 3. Reverse Engineering */}
        <Section id="reverse" title="3. Reverse-Engineering the Failure Mechanism">
          <p>
            To build an effective detector, I needed to understand <em>why</em> these failures happen — not just <em>what</em> they look like.
            Through systematic analysis of Perplexity Sonar outputs against their cited sources, several patterns emerged:
          </p>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Entity confusion in dense contexts</h3>
              <p className="text-xs text-[#8b8fa8]">
                When a source mentions multiple people in related roles (co-founders, co-directors, collaborators), the model
                frequently swaps one for another. The retrieved context is correct — the model just binds the wrong name to the
                wrong role. This is why entity substitution detection must check not just whether an entity exists in the source,
                but whether it appears in the same <em>relational context</em> as the claim.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Numeric proximity interference</h3>
              <p className="text-xs text-[#8b8fa8]">
                Sources about demographics, statistics, or measurements often contain multiple numbers in close proximity —
                population in different years, heights of different peaks, multiple financial figures. The model picks a number from the
                right paragraph but the wrong row. This is why contextual number contradiction — checking that the number appears
                in the same local context, not just anywhere in the source — is essential.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Certainty amplification</h3>
              <p className="text-xs text-[#8b8fa8]">
                Models systematically upgrade hedged language. A source that says &quot;may reduce risk&quot; becomes &quot;reduces risk&quot; or
                &quot;prevents.&quot; A source that says &quot;one of the largest&quot; becomes &quot;the largest.&quot; This appears to be a compression artifact —
                the model optimizes for conciseness and drops qualifiers. The hedging mismatch detector catches this by comparing
                certainty markers between claim and evidence.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Polarity flips in relational claims</h3>
              <p className="text-xs text-[#8b8fa8]">
                When a source describes something as &quot;private,&quot; &quot;smallest,&quot; or &quot;decreased,&quot; the model occasionally produces the
                opposite — &quot;public,&quot; &quot;largest,&quot; &quot;increased.&quot; This happens most when the correct term appears near its antonym in the source
                (e.g., &quot;not the largest but one of the largest&quot;). The contrast pair detector maintains a curated set of antonym pairs
                with morphological stemming to catch these.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Topic-adjacent source confusion</h3>
              <p className="text-xs text-[#8b8fa8]">
                Homonyms and disambiguation failures lead to sources about entirely different topics. &quot;Python&quot; the programming
                language gets cited to &quot;Pythonidae&quot; (snakes). &quot;Apple&quot; the company gets cited to &quot;Apple&quot; the fruit.
                Evidence coverage — measuring what fraction of claim tokens appear in any source passage — reliably catches these
                because the topical overlap is near zero for the specific claim terms.
              </p>
            </div>
          </div>
        </Section>

        {/* 4. Pipeline */}
        <Section id="pipeline" title="4. Detection Pipeline">
          <p>
            Based on the reverse-engineering analysis, the detector is structured as a 3-stage pipeline
            where each stage is more expensive and more capable than the last. Clear cases resolve early; ambiguous
            cases escalate.
          </p>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5">
            <div className="space-y-4">
              {[
                {
                  stage: 'Stage 1',
                  name: 'Deterministic Detector',
                  desc: '8 rule-based signals: lexical overlap, evidence coverage, numeric contradiction, contrast pairs, relation mismatch, entity substitution, hedging mismatch, quote match. Zero API calls. Resolves ~60% of cases.',
                  color: 'text-emerald-400',
                  cost: 'Free',
                },
                {
                  stage: 'Stage 2',
                  name: 'NLI Cross-Encoder',
                  desc: 'cross-encoder/nli-deberta-v3-base via HuggingFace Inference API. Classifies evidence/claim pair as entailment, contradiction, or neutral. Fires only when Stage 1 is inconclusive.',
                  color: 'text-blue-400',
                  cost: 'Free tier',
                },
                {
                  stage: 'Stage 3',
                  name: 'LLM Judge',
                  desc: 'Constrained prompt over retrieved evidence only — not general knowledge. Uses Llama 3.1 8B via OpenRouter (free) or Perplexity Sonar as fallback. Last resort for complex cases.',
                  color: 'text-purple-400',
                  cost: 'Free/Low',
                },
              ].map(s => (
                <div key={s.stage} className="flex gap-4">
                  <div className="shrink-0 w-16">
                    <p className={`text-[10px] font-semibold uppercase tracking-widest ${s.color}`}>{s.stage}</p>
                    <p className="text-[9px] text-[#4a4e6a] mt-0.5">{s.cost}</p>
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
            The key design principle: <strong className="text-white">deterministic signals first, models second.</strong> This makes the system
            inspectable — when a citation is flagged, you can trace exactly which signal fired and why, not just
            &quot;the model said so.&quot; It also makes the system cheap: most clear-cut hallucinations (wrong number, wrong name,
            opposite polarity) are caught without any API call.
          </p>
        </Section>

        {/* 5. Signals */}
        <Section id="signals" title="5. Detector Signals">
          <div className="overflow-x-auto rounded-xl border border-[#1e2030]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2030] bg-[#13141c]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Signal</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Weight</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Fires on</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a4e6a] uppercase tracking-wider">Detects</th>
                </tr>
              </thead>
              <tbody>
                <SignalRow name="Lexical overlap" weight="0.20" fires="5-gram match >= 60%" detects="Verbatim or near-verbatim support" />
                <SignalRow name="Evidence coverage" weight="0.17" fires="Token coverage in best window" detects="Topical relevance of source" />
                <SignalRow name="Numeric contradiction" weight="0.28" fires="Number in claim absent from evidence with shared context" detects="Date/count/measurement drift" />
                <SignalRow name="Contrast contradiction" weight="0.20" fires="Antonym pair between claim and evidence" detects="Polarity/relation inversion" />
                <SignalRow name="Relation mismatch" weight="0.30" fires={'"X by Y" vs "X by Z"'} detects="Entity-relation substitution" />
                <SignalRow name="Entity substitution" weight="0.26" fires="Named entity absent from evidence with shared context" detects="Person/org/place swap" />
                <SignalRow name="Hedging mismatch" weight="0.12" fires={'"always/never" vs "sometimes/often"'} detects="Certainty escalation" />
                <SignalRow name="Quote match" weight="0.12" fires="Quoted span found verbatim" detects="Direct quote accuracy" />
                <SignalRow name="NLI model" weight="0.32" fires="DeBERTa entailment/contradiction > 0.82" detects="Semantic entailment" />
                <SignalRow name="LLM judge" weight="0.25" fires="Constrained verdict over evidence" detects="Complex semantic judgment" />
              </tbody>
            </table>
          </div>

          <p>
            Weights reflect both signal reliability and the severity of what it catches. Relation mismatch (0.30) and
            numeric contradiction (0.28) are weighted highest because they indicate clear factual errors with high precision.
            Hedging mismatch (0.12) is weighted lowest because certainty differences are often a matter of degree rather than
            a binary factual error.
          </p>
        </Section>

        {/* 6. Gate */}
        <Section id="gate" title="6. Acceptance Gate">
          <p>
            The gate aggregates citation-level verdicts into a single answer-level decision.
            This is the core contribution: not just scoring claims, but making a binary <strong className="text-white">ship/don&apos;t-ship
            decision</strong> with auditable policy and tunable thresholds.
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
            The gate is intentionally conservative: one high-confidence contradiction blocks the entire answer. This matches
            the use case — if a user sees five cited claims and one is demonstrably wrong, the entire answer&apos;s credibility
            is compromised. The thresholds are exposed and tunable via the benchmark threshold sweep.
          </p>
        </Section>

        {/* 7. Evaluation */}
        <Section id="evaluation" title="7. Evaluation">
          <p>
            The benchmark runs 1,036 labeled claim/source pairs: 500 FEVER-SUPPORTED, 500 FEVER-UNSUPPORTED,
            and 36 hand-crafted adversarial cases targeting each hallucination type.
          </p>

          <div className="rounded-xl border border-[#1e2030] bg-[#13141c] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Key metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'False Accept Rate', desc: 'Hallucinations the gate lets through', highlight: true },
                { label: 'Precision', desc: 'Of flagged claims, fraction actually wrong', highlight: false },
                { label: 'Recall', desc: 'Of wrong claims, fraction caught', highlight: false },
                { label: 'ECE', desc: 'Does confidence track empirical accuracy?', highlight: false },
              ].map(m => (
                <div key={m.label} className={`rounded-lg p-3 ${m.highlight ? 'bg-red-500/5 border border-red-500/20' : 'bg-[#0c0d12] border border-[#1e2030]'}`}>
                  <p className={`font-semibold ${m.highlight ? 'text-red-400' : 'text-white'}`}>{m.label}</p>
                  <p className="text-[#8b8fa8] mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#8b8fa8]">
              The <strong className="text-white">false accept rate</strong> is the primary metric: it measures how often a hallucination
              passes through the gate unchallenged. This is what matters for a production system — the cost of a missed
              hallucination is much higher than the cost of a false alarm.
            </p>
          </div>

          <p>
            The <Link href="/benchmark" className="text-[#6366f1] hover:underline">benchmark page</Link> provides
            interactive analysis: confusion matrix, threshold sweep charts, per-signal ablation toggles, gold trace
            inspection for individual cases, and JSONL export for reproducibility.
          </p>
        </Section>

        {/* 8. Prior Work */}
        <Section id="prior" title="8. Relation to Prior Work">
          <div className="space-y-3">
            {[
              { name: 'FEVER', authors: 'Thorne et al., 2018', relation: 'Provides the evaluation framework. TruthLayer adapts FEVER-style claims to operate on live URLs rather than pre-extracted evidence.' },
              { name: 'FActScore', authors: 'Min et al., 2023', relation: 'Decomposes responses into atomic facts. TruthLayer uses claim decomposition but focuses on citation-level rather than response-level scoring.' },
              { name: 'SAFE', authors: 'Wei et al., 2024', relation: 'Uses LLM-as-judge for factuality. TruthLayer layers deterministic signals before the LLM to reduce cost and increase inspectability.' },
              { name: 'Minicheck', authors: 'Tang et al., 2024', relation: 'Trains a compact NLI model for fact-checking. TruthLayer uses off-the-shelf NLI as one signal among many, not the sole arbiter.' },
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

          <p>
            The novel contribution is the <strong className="text-white">acceptance gate as a release control mechanism</strong> — not just scoring
            individual claims, but making a ship/don&apos;t-ship decision with calibrated thresholds, inspectable signals,
            and measurable false-accept behavior.
          </p>
        </Section>

        {/* 9. Implications */}
        <Section id="implications" title="9. Implications for AI Search">
          <p>
            Citation hallucination is not an edge case — it&apos;s a structural property of how current LLMs handle attribution.
            The model generates text first, then attaches citations as a post-hoc justification. This means:
          </p>
          <ul className="space-y-2 list-none">
            {[
              'The citation is cosmetic, not causal — the model did not derive the claim from the source.',
              'Source relevance is high but claim accuracy is unreliable — the hardest failure mode to catch.',
              'Users trust cited claims more than uncited ones, making false citations more dangerous than no citations.',
              'A lightweight, pipeline-compatible verification layer can catch the majority of failures before they reach users.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            TruthLayer is a proof of concept that this verification layer is both feasible and useful. It runs in a
            Perplexity Sonar pipeline with sub-second latency for deterministic checks, and the acceptance gate gives
            product teams a concrete, auditable decision point for citation quality.
          </p>
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
