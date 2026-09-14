# State semantics

Workflow progress and human review are separate dimensions.

| Dimension | Values |
|---|---|
| execution_status | pending, draft, completed, stale, blocked |
| review_policy | mandatory, risk_based, none |
| review_status | pending, confirmed, not_required |

`confirmed` means explicit user review.

A Stage is usable when execution is completed, review is confirmed or not_required, and no correction conflict remains unresolved.

Default review policies:

- Stage 1: mandatory
- Stage 2: mandatory
- Stage 3: risk_based
- Stage 4: risk_based
- Stage 5: risk_based
- Stage 6: none

For a risk-based Stage, start with review pending. After execution, use not_required when no item needs user judgment; otherwise keep pending until the user reviews it. Only explicit user review produces confirmed.

A Stage with review policy none uses not_required.
