# Uncertainty Semantics

Uncertainty is a valid analytical result, not a failure state.

A Stage must not force a classification when the supplied evidence does not support one. The workflow may complete with uncertain, mixed, or unresolved results when those results faithfully represent the source.

Examples of valid states include:

- `Unclear provenance`
- `Co-developed`
- `Not addressed`
- `Unclear` author uptake
- `Suspended judgment`
- low-confidence interpretations
- no supported cognitive pattern
- an empty gap or next-direction list

Low confidence alone does not make a Stage incomplete and does not automatically require user review.

For risk-based review, uncertainty should distinguish whether the user can actually resolve it:

```yaml
uncertainty:
  reason: insufficient_evidence
  user_resolvable: false
```

or:

```yaml
uncertainty:
  reason: ambiguous_author_intent
  user_resolvable: true
```

Only uncertainty that materially affects downstream interpretation and is plausibly resolvable by the user should trigger review.

A completed Stage may therefore contain non-blocking uncertainties. Those uncertainties must be preserved rather than silently converted into definitive claims.
