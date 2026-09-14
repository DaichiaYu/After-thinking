# State semantics

This document separates workflow execution progress from human review results.

| Dimension | Values |
|---|---|
| execution_status | pending, draft, completed, stale, blocked |
| review_policy | mandatory, risk_based, none |
| review_status | pending, confirmed, not_required |

The term `confirmed` means that a user explicitly reviewed the result. A stage that does not require review uses `not_required` instead.

A stage is considered usable by a later stage when its execution is completed, its review result is either confirmed or not_required, and there is no unresolved correction conflict.

Stage 1 and Stage 2 use mandatory review. Stage 3 uses risk-based review. If Stage 3 contains no high-risk items, it may finish as completed plus not_required. If high-risk items exist, the review remains pending until the user resolves them.
