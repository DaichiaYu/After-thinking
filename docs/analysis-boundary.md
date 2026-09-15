# Analysis Boundary

After-thinking reconstructs and preserves a discussion. Stages 1–6 must not optimize that reconstruction for prospective publication.

A user's intention to later write a post, article, note, presentation, or other public artifact may be recorded when it is part of the discussion, but it must not change how the analysis merges Topics, selects Claims, assigns provenance, resolves uncertainty, or describes reasoning turns.

## Preserve reasoning-critical interaction transitions

Do not judge the importance of a turn only by its surface form. A local question, clarification, formatting question, example, objection, assistant explanation, or external fact may be reasoning-critical when it materially changes what the author asks, believes, doubts, generalizes, narrows, or investigates next.

When the supported trajectory is:

`author state/question A -> assistant or external input B -> later author state/question C`

preserve the role of B when removing it would make the transition from A to C materially misleading, unexplained, or appear to be author-originated without support. Do not compress such a trajectory into only A and C merely because B looks operational, local, explanatory, or non-authorial.

Preserving a transition does not transfer provenance. Assistant or external material remains assistant- or external-originated; it must not be rewritten as part of the author's prior position. Conversely, provenance separation is not a reason to omit an assistant or external turn that is supported as a trigger, constraint, contrast, or other material input to later author reasoning.

Use argumentative dependency, not message category, as the retention test. Ask: if this turn were removed, would the reconstruction materially change how a later question, hypothesis, distinction, confidence shift, scope change, or conclusion arose? If yes, preserve the transition with its source references.

Do not infer causation from chronology alone. Record a turn as a trigger or material input only when the conversation supports that relation through explicit author language, direct response structure, or a sufficiently clear argumentative dependency. Otherwise preserve the sequence while marking the dependency as uncertain, mixed, or unsupported rather than inventing a smooth causal story.

Analysis completion is a successful terminal state by itself:

```yaml
analysis_status: complete
```

No publication state or publishable output is required for analysis completion. The absence of material worth publishing must not cause the analysis to invent stronger conclusions, cleaner narratives, additional gaps, or next directions.

If the user later requests a publication transformation, that is a separate downstream workflow. Publication output is never an upstream input to Stages 1–6.
