# User Corrections

User corrections are persistent runtime constraints, not archival notes.

## Binding

Each correction has a stable `CR` ID, one addressable target object or field, the user's corrected constraint, source/review evidence when available, and lifecycle state.

Addressable examples:

```text
S1.scope
S1.author_initial_position
T001
R001
C001.provenance.type
CS001.scope
G001
D001
```

Lifecycle values are `active`, `superseded`, and `retired`. Active corrections remain effective across reruns and source revisions until explicitly superseded or retired.

## Direct applicability

A correction is directly applicable only to the Stage that owns its target object. Downstream Stages inherit its effect through the corrected upstream output; they do not repeat the correction ID in their own `applied_corrections` merely because they consume that output.

Examples:

- correction targeting `S1.author_initial_position` → directly applied and recorded by Stage 1 only;
- correction targeting `C004.provenance.type` → directly applied and recorded by Stage 3 only;
- correction targeting `CS002.scope` → directly applied and recorded by Stage 4 only.

If a directly applicable active correction is omitted from that Stage output's `applied_corrections`, the run is invalid.

## Corrections made during review

If the user materially changes an interpretation during review, the executor MUST persist the change as a correction before rerunning or confirming the Stage.

A pure confirmation such as "yes" or "looks correct" does not create a correction. A response such as "mostly right, but my initial position was X rather than Y" does.

Required order:

1. persist the new correction;
2. rerun the owning Stage with the correction applied;
3. propagate stale state downstream if the result changed materially;
4. present the regenerated result for review when required;
5. only then record confirmation of the current result.

Do not silently edit a reviewed output without creating the correction that must survive future reruns.

## Identity conflicts

If new source conflicts with an active correction, or the correction target is retired/split/merged and cannot be mapped without interpretation, set the owning Stage to `blocked`, record the conflict in `state.yaml`, and request explicit resolution. Never silently retarget, ignore, overwrite, or retire a correction.

When a newer correction replaces an older one, preserve both records and link them with `supersedes` / `superseded_by`.
