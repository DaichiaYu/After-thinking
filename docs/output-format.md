# Stage Output Format

Every Stage output carries run metadata so a later executor can verify which source revision and corrections produced it.

## Markdown stages

Stages 1, 2, 4, and 6 use YAML front matter followed by the Stage content.

```markdown
---
workflow_version: "0.1"
stage: 1
source_revision: 1
applied_corrections: []
---

# Stage 1 — Scope & Origin

...
```

After a correction is applied:

```yaml
applied_corrections:
  - CR001
  - CR004
```

## YAML stages

Stages 3 and 5 store run metadata at the top level.

```yaml
metadata:
  workflow_version: "0.1"
  stage: 3
  source_revision: 2
  applied_corrections:
    - CR001

claims:
  - id: C001
    claim: "..."
```

Stage 5 uses the same pattern with a top-level `gaps` collection.

## State synchronization

After the Stage output is written successfully, copy the Stage's current `source_revision` and `applied_corrections` into its entry in `state.yaml`, then set its execution and review fields according to the runtime rules.

If the output metadata and `state.yaml` disagree, the Stage must not be treated as a valid current result until the mismatch is resolved.
