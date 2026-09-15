# State Semantics

Workflow progress and human review are separate dimensions. Stage-specific review policy is defined only by the current file under `specs/`.

| Dimension | Values |
|---|---|
| execution_status | `pending`, `draft`, `completed`, `stale`, `blocked` |
| review_policy | `mandatory`, `risk_based`, `none` |
| review_status | `pending`, `confirmed`, `not_required` |

## Execution states

- `pending`: not started for the current source/upstream state.
- `draft`: started but execution exit criteria are not yet met.
- `completed`: the current Stage spec's execution exit criteria are met and a current output exists.
- `stale`: a prior output was invalidated by a material source/upstream change.
- `blocked`: execution cannot continue because an explicit dependency or conflict needs resolution.

A Stage is usable when execution is `completed`, `completion.exit_criteria_met` is true, review is `confirmed` or `not_required`, and no correction conflict remains unresolved.

For `risk_based` review, low confidence alone does not require review. Use `pending` only when uncertainty materially affects downstream interpretation and is plausibly user-resolvable. For `none`, use `not_required`.

## Stale and rerun transition

A stale Stage's old review result is historical only. On substantive rerun:

1. set execution to `draft` when work starts;
2. reset review to `pending` for `mandatory` and `risk_based`;
3. clear current confirmation evidence;
4. produce the new output;
5. set execution to `completed` only after execution exit criteria are met;
6. apply the current Stage spec's review policy to the regenerated result.

A prior `confirmed` value must never be copied onto substantively regenerated content.

## Confirmation evidence

`confirmed` requires:

```yaml
confirmation:
  type: explicit_user_confirmation
  confirmed_at: "2026-09-15T10:20:00+08:00"
  interaction_ref: null
  note: "User explicitly confirmed the current Stage result."
```

Use a stable interaction/message reference when available; otherwise it may be null. `confirmed` without `confirmation.type: explicit_user_confirmation` is invalid.

## Next action

`next_action` is structured:

```yaml
next_action:
  type: run_stage
  stage: 1
  reason: initialized
```

Allowed types: `run_stage`, `rerun_stage`, `review_stage`, `resolve_conflict`, `analysis_complete`. `stage` may be null only for `analysis_complete` or a conflict not owned by one Stage.
