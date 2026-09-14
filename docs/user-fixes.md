# User fixes

User fixes are persistent runtime constraints, not merely archival notes.

## Storage
A discussion workspace should include a machine-readable `corrections.yaml` file. Human-readable history can still be kept under `revisions/`.

## Binding
Each fix needs:
- a stable correction ID such as `CR001`;
- a target object or field;
- the user's corrected constraint;
- lifecycle status.

Examples of addressable targets:

```text
S1.scope
S1.trigger
S1.initial_question
S1.underlying_question
S1.author_initial_position
S1.initial_uncertainty
T001
R001
C001.provenance.type
G001
D001
```

## Lifecycle
A correction may be:
- `active`
- `superseded`
- `retired`

Active corrections remain effective across reruns and source revisions until explicitly superseded or retired.

If a later correction replaces an earlier one, keep both records. The newer record points backward with `supersedes`; the older one points forward with `superseded_by`.

## Required rerun behavior
Before any Stage runs or reruns, the executor must load all active corrections applicable to that Stage or its input objects.

Corrections are control inputs, not previous analysis outputs. Stage 1 must therefore read applicable corrections even though it does not depend on previous analysis files.

Every Stage output must record at least:

```yaml
source_revision: <number>
workflow_version: <version>
applied_corrections:
  - CR001
```

If an applicable active correction is missing from `applied_corrections`, that run is invalid.

If new source material conflicts with an active correction, or if a correction's target no longer exists, the executor must stop and request explicit resolution. It must not silently ignore, overwrite, or retire the correction.
