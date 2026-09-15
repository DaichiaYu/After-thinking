# State Semantics

Workflow progress and human review are separate dimensions.

| Dimension | Values |
|---|---|
| execution_status | `pending`, `draft`, `completed`, `stale`, `blocked` |
| review_policy | `mandatory`, `risk_based`, `none` |
| review_status | `pending`, `confirmed`, `not_required` |

## Execution states

- `pending`: Stage has not started for the current source/upstream state.
- `draft`: execution started but exit criteria are not yet met.
- `completed`: exit criteria are met and a current output exists.
- `stale`: a previously produced output is invalidated by a material upstream/source change.
- `blocked`: execution cannot continue because a required input, identity mapping, correction conflict, or other explicit dependency needs resolution.

## Review states

`confirmed` means explicit user confirmation of the current Stage result. It must have confirmation evidence in state.

A Stage is usable when execution is `completed`, `completion.exit_criteria_met` is true, review is `confirmed` or `not_required`, and no correction conflict remains unresolved.

Default policies: Stage 1–2 `mandatory`; Stage 3–5 `risk_based`; Stage 6 `none`.

For risk-based review, low confidence alone does not require review. Use `pending` only when uncertainty materially affects downstream interpretation and is plausibly user-resolvable. Otherwise use `not_required` after exit criteria are met.

## Stale and rerun transition

When a completed Stage becomes stale, its old review result is historical only. On rerun:

1. set execution to `draft` when work starts;
2. reset `review_status` to `pending` for `mandatory` and `risk_based` Stages;
3. clear current confirmation evidence;
4. produce the new output;
5. set execution to `completed` only after exit criteria are met;
6. for `mandatory`, remain `pending` until the user confirms the new result;
7. for `risk_based`, set `not_required` if no material user-resolvable ambiguity remains, otherwise remain `pending` until explicit confirmation;
8. for `none`, use `not_required`.

A prior `confirmed` value must never be copied onto substantively regenerated content.

## Confirmation evidence

For `confirmed` results, state records:

```yaml
confirmation:
  type: explicit_user_confirmation
  confirmed_at: "2026-09-15T10:20:00+08:00"
  interaction_ref: null
  note: "User explicitly confirmed the current Stage result."
```

Use a stable interaction/message reference when the host provides one; otherwise `interaction_ref` may be null. `confirmed` without `confirmation.type: explicit_user_confirmation` is invalid.

## Next action

`next_action` is structured, not free text:

```yaml
next_action:
  type: run_stage
  stage: 1
  reason: initialized
```

Allowed `type` values are `run_stage`, `rerun_stage`, `review_stage`, `resolve_conflict`, and `analysis_complete`. `stage` is null only for `analysis_complete` or when a conflict is not owned by one Stage.
