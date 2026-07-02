# E1 Results — Kill Criteria (pre-committed before any full run)

Written before running the experiments. These are the conditions under
which the paper's framing changes. No tuning on test to rescue a number.

1. **Signals precision floor.** If signals-only precision on decided
   cases drops below **90%** on LLM-AggreFact test, the "near-perfect
   deterministic signals" framing is dead. Reframe as a high-recall
   pre-filter and report the external numbers honestly next to the
   internal ones.

2. **Tiered efficiency claim.** If the tiered system (signals -> NLI)
   does not come within **3 balanced-accuracy points** of MiniCheck at
   materially lower cost (ms/claim and param-invocations), the
   efficiency claim is dead. Report whatever happens.

Threshold discipline: NLI and MiniCheck-variant thresholds are tuned on
the dev split only, frozen, then applied to test. The headline MiniCheck
row uses their official 0.5 default.
