# Stage Contracts 01–03

All Stages load applicable active corrections before execution and record `source_revision`, `workflow_version`, `applied_corrections`, and completion evidence. A Stage becomes `completed` only after its criteria in [`stage-exit-criteria.md`](stage-exit-criteria.md) are met.

## Stage 1

Input: source, metadata, active corrections.
Output: `analysis/01-scope-origin.md`.

Required content: scope, sources/roles, trigger, initial question, underlying question when supportable, author initial position, initial uncertainty, source references.

Review policy: `mandatory`. Review remains `pending` until explicit user confirmation.

Stage 1 must preserve unsupported origin details as uncertain rather than infer hidden motives. If Stage 1 changes materially, Stages 2–6 become stale.

## Stage 2

Input: source, usable Stage 1, active corrections.
Output: `analysis/02-topic-map.md`.

Each Topic needs a stable ID, type, parent, source range, relation, and standalone flag. Each material reasoning turn needs a stable ID, before, trigger, trigger source, author response, after, why, and source references.

Review policy: `mandatory`. Review remains `pending` until explicit user confirmation.

Not every sentence requires a Topic and not every conversational change is a reasoning turn. If Stage 2 changes materially, Stages 3–6 become stale.

## Stage 3

Input: source, usable Stage 1, usable Stage 2, active corrections.
Output: `analysis/03-claims.yaml`.

Each material Claim needs: `id`, `claim`, `topic_ids`, provenance, introduction point, author uptake, epistemic status, evidence, and confidence. Do not create a Claim for every statement.

`Unclear provenance`, `Co-developed`, unresolved uptake, and low confidence are valid analytical results when supported by the evidence limits.

Review policy: `risk_based`. Low confidence alone does not require review. If no materially important user-resolvable ambiguity exists, use `not_required`; otherwise keep review `pending` until explicit user review. The system never self-assigns `confirmed`.

If Stage 3 changes materially, Stages 4–6 become stale. If Stage 3 reveals an upstream error, rollback to Stage 1 or 2 instead of patching around it.
