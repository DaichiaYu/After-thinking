# Workflow Runtime

The workflow is linear and rollback-aware: Stage 1 → 2 → 3 → 4 → 5 → 6.

Normative runtime rules are split into:

- [`state-semantics.md`](state-semantics.md): execution status, review policy, review status, and downstream usability.
- [`uncertainty-semantics.md`](uncertainty-semantics.md): uncertainty as a valid result and when it is review-blocking.
- [`stage-exit-criteria.md`](stage-exit-criteria.md): safe-to-advance stopping conditions for every Stage.
- [`analysis-boundary.md`](analysis-boundary.md): analysis as an independent terminal workflow, separate from publication.
- [`user-fixes.md`](user-fixes.md): persistent user corrections, correction targets, rerun requirements, and correction lifecycle.
- [`input-contracts.md`](input-contracts.md): Stage-specific allowed inputs.

## Runtime invariants

- Do not force certainty when evidence is insufficient.
- Do not continue a Stage merely to maximize completeness after its exit criteria are met.
- Do not optimize Stages 1–6 for a possible future post, article, presentation, or other publication artifact.
- Analysis may finish successfully with uncertainty, no supported cognitive pattern, no gaps, no next directions, and no publishable material.

## Rollback

Do not silently repair an upstream interpretation inside a downstream Stage. Return to the earliest incorrect Stage and rerun affected downstream stages.

## Stale propagation

- Stage 1 material change → Stages 2–6 stale
- Stage 2 material change → Stages 3–6 stale
- Stage 3 material change → Stages 4–6 stale
- Stage 4 material change → Stages 5–6 stale
- Stage 5 material change → Stage 6 stale

Formatting-only changes do not trigger stale.
