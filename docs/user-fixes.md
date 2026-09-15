# User Corrections

User corrections are persistent runtime constraints, not archival notes.

## Binding

Each correction has a stable `CR` ID, one addressable target object or field, the user's corrected constraint, source/review evidence when available, and lifecycle state.

Addressable examples: `S1.scope`, `S1.author_initial_position`, `T001`, `R001`, `C001.provenance.type`, `CS001.scope`, `G001`, `D001`.

Lifecycle values are `active`, `superseded`, and `retired`. Active corrections remain effective across reruns and source revisions until explicitly superseded or retired.

## Direct applicability

A correction is directly applicable only to the Stage that owns its target object. Downstream Stages inherit its effect through the corrected upstream output; they do not repeat the correction ID in their own `applied_corrections` merely because they consume that output.

Examples: a correction targeting `S1.author_initial_position` is recorded by Stage 1 only; `C004.provenance.type` by Stage 3 only; `CS002.scope` by Stage 4 only.

If a directly applicable active correction is omitted from that Stage output's `applied_corrections`, the run is invalid.

## Corrections made during review

If the user materially changes an interpretation during review, persist the change as a correction before rerunning or confirming the Stage.

A pure confirmation such as "yes" does not create a correction. "Mostly right, but my initial position was X rather than Y" does.

Required order: persist correction → rerun owning Stage → propagate stale state if materially changed → present regenerated result for required review → record confirmation of the current result.

Do not silently edit a reviewed output without creating the correction that must survive future reruns.

## Identity conflicts

If new source conflicts with an active correction, or the target is retired/split/merged and cannot be mapped without interpretation, set the owning Stage to `blocked`, set `next_action.type: resolve_conflict`, and record:

```yaml
correction_state:
  unresolved_conflicts:
    - correction_id: CR001
      stage: 3
      reason: target_retired
      target: C003
      candidate_targets: [C007, C008]
      detected_at_source_revision: 2
```

`candidate_targets` may be empty. Candidate replacements never authorize automatic retargeting. Request explicit user resolution; never silently ignore, overwrite, retarget, or retire the correction.

When a newer correction replaces an older one, preserve both records and link them with `supersedes` / `superseded_by`.
