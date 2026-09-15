# Stage 3 — Provenance & Epistemic Status｜來源歸屬與認知狀態

This file is the normative Stage 3 contract.

## Inputs
- `source/*`
- usable Stage 1
- usable Stage 2
- active corrections targeting `C*`

## Output
`analysis/03-claims.yaml`

Canonical shape:

```yaml
metadata: <common metadata from docs/output-format.md>
claims:
  - id: C001
    status: active
    claim: "..."
    topic_ids: [T001]
    provenance:
      type: Author-original
      evidence_refs: [msg-000001]
    introduction:
      source_ref: msg-000001
    author_uptake:
      status: Not applicable
      evidence_refs: []
    epistemic_status: Stable claim
    confidence: high
    uncertainty: null
    evidence_refs: [msg-000001]
```

When needed, use the common uncertainty shape from `docs/uncertainty-semantics.md`.

## Provenance enum
`Author-original`, `Author-reformulated`, `AI-introduced`, `AI-supported`, `Co-developed`, `External-source`, `Unclear provenance`.

## Author uptake enum
`Explicitly accepted`, `Implicitly adopted`, `Modified`, `Challenged`, `Rejected`, `Not addressed`, `Unclear`, `Not applicable`.

Use `Not applicable` when the Claim is author-originated and there is no distinct later uptake event to classify. If the author later modifies, challenges, or rejects their own earlier Claim, use that later response instead.

## Epistemic status enum
`Stable claim`, `Tentative conclusion`, `New hypothesis`, `Unresolved question`, `Unexplored lead`, `Rejected path`, `Suspended judgment`.

`confidence`: `high`, `medium`, or `low`.

## Rules
- No response is not acceptance.
- Later discussion of related material is not automatically uptake of an earlier AI idea.
- AI formalization of an author's prior intuition is not automatically AI introduction.
- AI-only material with no author uptake must not be written as the author's belief.
- Preserve uncertainty or non-applicability rather than forcing a clean classification.
- Do not create a Claim for every statement; only material Claims affecting reconstructed reasoning need `C` objects.

## Execution exit criteria
Execution is sufficient when all material Claims have provenance, introduction point, author uptake (including `Not applicable` where appropriate), epistemic status, evidence, and confidence, or explicit uncertainty where evidence cannot support a definitive value. Non-user-resolvable uncertainty is non-blocking.

## Review and advance gate
`review_policy: risk_based`. Low confidence alone does not require review. If a material ambiguity is user-resolvable, keep review pending; otherwise use `not_required`. `confirmed` requires explicit user confirmation of the current result.

Stable ID behavior follows `docs/id-lifecycle.md`.
