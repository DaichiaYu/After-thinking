# Common Stage Output Format

This document defines metadata shared by all Stage outputs. Stage-specific object shape, enums, and execution exit criteria are defined only in the corresponding file under `specs/`.

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
  stop_reason: "Why execution is sufficient."
```

`completion.exit_criteria_met` describes execution sufficiency, not human review. A Stage may be execution-complete while waiting for mandatory/risk-based review; downstream usability is determined by `docs/state-semantics.md`.

`applied_corrections` contains only active corrections directly targeting objects owned by this Stage. Do not copy upstream correction IDs into downstream outputs.

Stages 1, 2, 4, and 6 use YAML front matter followed by the Markdown object shape in their Stage spec. Stages 3 and 5 store common metadata under top-level `metadata`, followed by their canonical YAML objects.

## State synchronization

Write the Stage output first. After that succeeds, synchronize its source revision, directly applied corrections, completion state, execution state, and review state into `state.yaml`.

If output metadata and state disagree, the Stage is not a valid current result until reconciled.
