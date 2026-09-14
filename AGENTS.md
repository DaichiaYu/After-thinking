# After-thinking executor guide

For an analysis run, first read `docs/workspace-write-contract.md`, `docs/source-format.md`, and `docs/runtime.md`. The runtime points to the normative state, uncertainty, exit-criteria, analysis-boundary, correction, and input rules.

User analysis belongs in the `analysis_repository` selected by the user. The After-thinking repository contains the method and templates; it is not the default destination for discussion data.

Initialize the selected workspace from the files under `templates/`. Before each Stage, read state and applicable active corrections, then only the inputs allowed by that Stage contract.

Do not force classification when evidence is insufficient. Unclear, mixed, co-developed, low-confidence, empty, or unresolved results may be valid completed outputs. Do not keep analyzing after the Stage exit criteria are met merely to increase completeness.

Each output records `source_revision`, `workflow_version`, `applied_corrections`, and completion evidence. Update `state.yaml` only after the Stage output is successfully written.

`confirmed` is reserved for explicit user confirmation. Low confidence alone does not require review.

Stages 1–6 reconstruct the discussion and must not optimize it for later publication. Stage 6 may end with no next direction; a usable Stage 6 sets `analysis_status: complete` whether or not any later publication work exists.
