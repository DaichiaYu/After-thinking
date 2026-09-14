# Stage Output Format

Every Stage output carries run metadata and completion evidence so a later executor can verify both how the result was produced and why the Stage stopped.

## Required run metadata

Every output records:

```yaml
workflow_version: "0.1"
stage: 1
source_revision: 1
applied_corrections: []
completion:
  exit_criteria_met: true
  blocking_items: []
  nonblocking_uncertainties: []
  stop_reason: "The Stage has enough supported structure to advance safely."
```

`exit_criteria_met` must be true before execution can become `completed`. `nonblocking_uncertainties` may contain object IDs or short descriptions and do not prevent completion.

## Markdown stages

Stages 1, 2, 4, and 6 use YAML front matter followed by Stage content.

## YAML stages

Stages 3 and 5 store the same run metadata under a top-level `metadata` object, followed by `claims` or `gaps`.

## State synchronization

Write the Stage output first. After that write succeeds, copy its current `source_revision`, `applied_corrections`, and completion state into the Stage entry in `state.yaml`, then set execution and review fields according to the runtime rules.

If output metadata and `state.yaml` disagree, the Stage is not a valid current result until the mismatch is resolved.
