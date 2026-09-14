# Workflow Runtime

The workflow remains linear and rollback-aware: Stage 1 → 2 → 3 → 4 → 5 → 6.

Normative runtime rules are split into:

- [`state-semantics.md`](state-semantics.md): execution status, review policy, review status, and downstream usability.
- [`user-fixes.md`](user-fixes.md): persistent user corrections, correction targets, rerun requirements, and correction lifecycle.
- [`input-contracts.md`](input-contracts.md): Stage-specific allowed inputs.

## Rollback
Do not silently repair an upstream interpretation inside a downstream Stage. Return to the earliest incorrect Stage and rerun affected downstream stages.

## Stale propagation
- Stage 1 material change → Stages 2–6 stale
- Stage 2 material change → Stages 3–6 stale
- Stage 3 material change → Stages 4–6 stale
- Stage 4 material change → Stages 5–6 stale
- Stage 5 material change → Stage 6 stale

Formatting-only changes do not trigger stale.
