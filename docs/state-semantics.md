# State Semantics

Workflow progress and human review are separate dimensions.

| Dimension | Values |
|---|---|
| execution_status | pending, draft, completed, stale, blocked |
| review_policy | mandatory, risk_based, none |
| review_status | pending, confirmed, not_required |

`confirmed` means explicit user review.

A Stage may be marked `completed` only when its Stage-specific exit criteria are met. A Stage is usable when:

- execution is `completed`;
- `completion.exit_criteria_met` is `true`;
- review is `confirmed` or `not_required`;
- no correction conflict remains unresolved.

Non-blocking uncertainty is compatible with `completed` and usable state.

Default review policies:

- Stage 1: mandatory
- Stage 2: mandatory
- Stage 3: risk_based
- Stage 4: risk_based
- Stage 5: risk_based
- Stage 6: none

For a risk-based Stage, low confidence alone does not require review. Keep review `pending` only when an uncertainty materially affects downstream interpretation and is plausibly resolvable by the user. Otherwise use `not_required` after the exit criteria are met.

A Stage with review policy `none` uses `not_required`.
