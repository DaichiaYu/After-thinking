# Stage Contracts 01–03

All stages must load applicable active corrections before execution and record `source_revision`, `workflow_version`, and `applied_corrections`.

## Stage 1
Input: source, metadata, active corrections.
Output: `analysis/01-scope-origin.md`.

Required content: scope, sources/roles, trigger, initial question, underlying question when supportable, author initial position, initial uncertainty, source references.

State:
- execution: `completed`
- review policy: `mandatory`
- review: `pending` until user confirmation, then `confirmed`

If Stage 1 changes materially, Stages 2–6 become stale.

## Stage 2
Input: source, usable Stage 1, active corrections.
Output: `analysis/02-topic-map.md`.

Each Topic needs a stable ID, type, parent, source range, relation, and standalone flag. Each reasoning turn needs a stable ID, before, trigger, trigger source, author response, after, why, and source references.

State:
- execution: `completed`
- review policy: `mandatory`
- review: `pending` until user confirmation, then `confirmed`

If Stage 2 changes materially, Stages 3–6 become stale.

## Stage 3
Input: source, usable Stage 1, usable Stage 2, active corrections.
Output: `analysis/03-claims.yaml`.

Each Claim needs: `id`, `claim`, `topic_ids`, provenance, introduction point, author uptake, epistemic status, evidence, confidence.

Review policy is `risk_based`.

If no high-risk provenance or uptake item exists:
- execution: `completed`
- review: `not_required`

If high-risk items exist:
- execution: `completed`
- review: `pending`

Only explicit user review may change `pending` to `confirmed`. The system must never self-assign `confirmed`.

If Stage 3 changes materially, Stages 4–6 become stale. If Stage 3 reveals an upstream error, rollback to Stage 1 or 2 instead of patching around it.
