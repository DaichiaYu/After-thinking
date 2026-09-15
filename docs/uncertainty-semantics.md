# Uncertainty Semantics

Uncertainty is a valid analytical result, not a failure state.

A Stage must not force a classification when evidence does not support one. Stage-specific uncertain enum values belong in the relevant file under `specs/`; this document defines only cross-Stage behavior.

Canonical uncertainty shape when an object needs explicit uncertainty metadata:

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

`reason` is concise free text or a stable implementation label. `user_resolvable` controls whether uncertainty is a candidate for risk-based review.

Low confidence alone does not make a Stage incomplete and does not automatically require review. Only uncertainty that materially affects downstream interpretation and is plausibly resolvable by the user should block risk-based review.

A completed Stage may contain non-blocking uncertainties, mixed attribution, unresolved status, no supported pattern, or an empty object set when those results faithfully represent the source. Preserve these limits rather than silently converting them into definitive claims.
