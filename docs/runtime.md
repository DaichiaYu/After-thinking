# Workflow Runtime

The workflow is linear and rollback-aware: Stage 1 → 2 → 3 → 4 → 5 → 6.

The six files under `../specs/` are the normative Stage contracts. Read only the current Stage spec during execution.

Cross-Stage normative rules:

- `state-semantics.md` — execution/review transitions, confirmation evidence, structured next actions.
- `source-format.md` — source identity, ordering, mutations, and revision authority.
- `id-lifecycle.md` — stable analysis object identity across reruns.
- `user-fixes.md` — persistent user corrections and direct applicability.
- `uncertainty-semantics.md` — uncertainty as a valid result.
- `input-contracts.md` — allowed Stage inputs.
- `output-format.md` — common run metadata.
- `analysis-boundary.md` — analysis is independent from publication.
- `workspace-write-contract.md` — destination and write ordering.

## Runtime invariants

- Do not force certainty when evidence is insufficient.
- Stop when the current Stage spec's exit criteria are met; do not maximize completeness.
- Do not optimize Stages 1–6 for later publication.
- Analysis may finish successfully with uncertainty, no supported cognitive pattern, no gaps, no next directions, and no publishable material.
- A substantive rerun never inherits an old confirmation.
- A material correction made during review is persisted before rerun or confirmation.
- Object IDs represent logical identity and are never reused.

## Rollback and stale propagation

Do not repair an upstream interpretation inside a downstream Stage. Return to the earliest incorrect Stage.

Material change propagation:

- Stage 1 → Stages 2–6 stale
- Stage 2 → Stages 3–6 stale
- Stage 3 → Stages 4–6 stale
- Stage 4 → Stages 5–6 stale
- Stage 5 → Stage 6 stale

When a stale Stage is rerun, follow the review reset rules in `state-semantics.md`. Formatting-only changes do not trigger stale.
