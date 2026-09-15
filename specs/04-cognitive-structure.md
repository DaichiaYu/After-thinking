# Stage 4 — Cognitive Structure｜認知結構

This file is the normative Stage 4 contract.

## Purpose
整理本段材料中反覆出現的核心概念、區分方式與推理特徵。描述的是 supplied material 中可觀察的 pattern，不是作者永久人格。

## Inputs
- `source/*`
- usable Stage 2
- usable Stage 3
- active corrections targeting `CS*`

## Output
`analysis/04-cognitive-structure.md` with common YAML front matter.

Each supported observation is an addressable `CS` object:

```markdown
## CS001 — <short pattern name>
- kind: core_concept | recurring_distinction | reasoning_pattern
- observation: ...
- scope: supplied_material
- topic_ids: [T001]
- claim_ids: [C001]
- reasoning_turn_ids: [R001]
- evidence_refs: [msg-000001, msg-000004]
- confidence: high | medium | low
- uncertainty: null
```

If needed, `uncertainty` uses the common `{reason, user_resolvable}` shape.

## What may be observed
Repeated core questions; distinctions the author repeatedly protects; evidence that changes or fails to change judgment; handling of exceptions/counterexamples; recurring moves such as adding variables, splitting Topics, narrowing scope, or redefining a question; concepts that survive multiple turns; repeated corrections of AI framing.

Avoid personality claims such as "the author is logical". Prefer source-bounded statements such as "in this material, the author repeatedly distinguishes original hypotheses from later evidence."

## Execution exit criteria
Execution is sufficient when every reported recurring observation has evidence anchors and appropriate confidence/uncertainty, and isolated events have not been generalized without support. If no recurring pattern is supportable, explicitly record that result and complete with zero `CS` objects.

## Review and advance gate
`review_policy: risk_based`. Keep review pending only for material, user-resolvable high-inference interpretations; otherwise use `not_required`. Explicit user confirmation is required for `confirmed`.

Stable ID behavior follows `docs/id-lifecycle.md`.
