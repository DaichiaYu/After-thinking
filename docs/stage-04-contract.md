# Stage 4 Contract｜認知結構

## Input
- Source
- Usable Stage 2
- Usable Stage 3
- Applicable active corrections

Stage 4 does not require Stage 3 to be `confirmed` when Stage 3 review was legitimately `not_required`.

## Output
Write `analysis/04-cognitive-structure.md` with core concepts, recurring distinctions, observable reasoning patterns, evidence references, confidence for high-inference content, and run metadata.

## Review
- execution: `completed`
- review policy: `risk_based`

If no high-inference item needs user judgment, set review to `not_required`. If review is needed, keep it `pending`; explicit user review may then set it to `confirmed`.

## Rollback
If the problem is Stage 4 over-inference, correct Stage 4 and mark Stages 5–6 stale. If the problem comes from Topic or Claim structure, return to Stage 2 or 3.
