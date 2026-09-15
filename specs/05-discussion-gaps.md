# Stage 5 — Discussion Gaps｜討論缺口

This file is the normative Stage 5 contract.

## Inputs
- `source/*`
- usable Stage 2
- usable Stage 3
- usable Stage 4
- active corrections targeting `G*`

Stage 2 is required because Topic/reasoning structure may be necessary to identify interrupted branches and preserve traceability.

## Output
`analysis/05-gaps.yaml`

Canonical shape:

```yaml
metadata: <common metadata from docs/output-format.md>
gaps:
  - id: G001
    status: active
    name: "..."
    primary_type: Unresolved question
    secondary_types: []
    topic_ids: [T001]
    reasoning_turn_ids: [R001]
    claim_ids: [C001]
    cognitive_structure_ids: []
    evidence_refs: [msg-000004]
    current_state: "..."
    why_open: "..."
    origin_status: author
    confidence: high
    uncertainty: null
```

Gap types: `Unresolved question`, `Unexplored lead`, `Unsupported hypothesis`, `Missing evidence`, `Tension`, `Interrupted branch`.

`origin_status` may be `author`, `assistant`, `external`, `mixed`, or `unclear`. Preserve source/uptake limits: an AI-only suggestion is not automatically the author's unresolved question.

## Execution exit criteria
Execution is sufficient when material open loops already exposed by the preceding analysis are represented, each Gap is traceable to source and relevant upstream objects, duplicates are merged, and unresolved classification uncertainty is explicit. Do not search for extra gaps merely to populate the file. `gaps: []` is valid.

## Review and advance gate
`review_policy: risk_based`. Keep review pending only when a material classification changes whether the author is treated as having proposed/adopted/pursued something and the user can plausibly resolve it. Otherwise use `not_required`.

Stable ID behavior follows `docs/id-lifecycle.md`.
