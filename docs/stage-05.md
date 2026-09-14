# Stage 5

Input: source, usable Stage 3, usable Stage 4, and applicable active corrections.

Output: `analysis/05-gaps.yaml`.

Each gap stores a stable ID, type, evidence references, current state, and why it remains open. Include run metadata required by `output-format.md`.

Review policy: `risk_based`.

After execution, use `not_required` when gap classification is sufficiently supported. If classification needs user judgment, keep review `pending` until explicit user review.

A material Stage 5 change marks Stage 6 stale.
