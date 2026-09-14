# Stage Exit Criteria

Exit criteria are satisficing, not maximizing. A Stage stops when it contains enough supported structure for the next Stage to operate safely. The executor must not continue searching merely to make an analysis more exhaustive.

Every Stage output records:

```yaml
completion:
  exit_criteria_met: true
  blocking_items: []
  nonblocking_uncertainties: []
  stop_reason: "Why this Stage is sufficient to advance."
```

A Stage cannot become `completed` when `exit_criteria_met` is false. Non-blocking uncertainty is compatible with completion.

## Stage 1 — Scope & Origin

Safe to advance when:

- the analysis scope and relevant source roles are identified, or explicitly marked unknown;
- trigger, initial question, author initial position, and initial uncertainty have supported findings or explicit uncertainty;
- an underlying question is recorded only when supportable;
- required source references are present;
- mandatory user review is confirmed.

Do not infer hidden motives merely to make the origin story complete.

## Stage 2 — Topic Map & Reasoning Trajectory

Safe to advance when:

- material discussion content is assigned to a Topic, marked out of scope, or explicitly left uncertain;
- major reasoning turns that change the author's position, question, or framing are represented;
- Topic relationships are sufficient for downstream Claim provenance analysis;
- mandatory user review is confirmed.

Not every sentence needs a Topic and not every conversational change is a reasoning turn.

## Stage 3 — Claims, Provenance & Epistemic Status

Safe to advance when:

- material Claims that affect the reconstructed reasoning are represented;
- each material Claim has provenance, introduction point, author uptake, epistemic status, evidence, and confidence, or an explicit uncertainty state where evidence is insufficient;
- user-resolvable high-risk ambiguity that materially affects downstream interpretation has been reviewed;
- unresolved non-user-resolvable uncertainty is preserved as non-blocking uncertainty.

Do not create a Claim for every statement. `Unclear provenance`, `Co-developed`, and low confidence are valid completed results.

## Stage 4 — Cognitive Structure

Safe to advance when:

- every reported recurring distinction or reasoning pattern has evidence anchors;
- high-inference observations carry confidence and uncertainty where needed;
- isolated events are not generalized into recurring traits without support;
- user-resolvable high-risk interpretation has been reviewed.

If the source does not support a recurring cognitive pattern, record that result and complete the Stage rather than inventing a fingerprint.

## Stage 5 — Discussion Gaps

Safe to advance when:

- open loops already exposed by the preceding analysis and material to understanding or continuation are represented;
- each Gap is traceable to source, Topic, Claim, or cognitive-structure evidence as appropriate;
- duplicate or equivalent gaps are merged;
- unresolved classification uncertainty is preserved explicitly.

Do not search for additional gaps merely to populate the output. `gaps: []` is valid.

## Stage 6 — Next Discussion Directions

Safe to finish when:

- every formal Direction is traceable to an existing Gap;
- each Direction records the next question, why it matters, expected impact, required input, and priority;
- no unsupported Direction is created simply to keep the workflow going.

If no Gap warrants continuation, record that no next discussion direction is required and finish successfully.

Stage 6 completion means the analysis workflow is complete. Publication is not required.
