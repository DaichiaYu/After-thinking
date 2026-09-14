# Stage 5

Input: source, usable Stage 3, usable Stage 4, and applicable active corrections.

Output: `analysis/05-gaps.yaml`.

Each gap stores a stable ID, type, evidence references, current state, and why it remains open. Include required run and completion metadata.

Stage 5 becomes `completed` only after its criteria in `stage-exit-criteria.md` are met. Record material open loops already exposed by the analysis; do not search for extra gaps merely to populate the file. `gaps: []` is a valid completed result.

Review policy is `risk_based`. Low confidence alone does not require review. Use `pending` only when a material classification can plausibly be resolved by the user; otherwise use `not_required` after exit criteria are met.

A material Stage 5 change marks Stage 6 stale.
