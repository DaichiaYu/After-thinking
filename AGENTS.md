# After-thinking executor guide

For an analysis run, first read `docs/workspace-write-contract.md`, `docs/runtime.md`, `docs/state-semantics.md`, `docs/user-fixes.md`, and `docs/input-contracts.md`.

User analysis belongs in the `analysis_repository` selected by the user. The After-thinking repository contains the method and templates; it is not the default destination for discussion data.

Initialize the selected discussion workspace from `templates/state.yaml` and `templates/corrections.yaml`. Source belongs under `source/`; Stage outputs belong under `analysis/` at the canonical paths in the write contract.

Before each Stage, read the discussion state and applicable active corrections, then read only the inputs allowed by that Stage contract. Each output records `source_revision`, `workflow_version`, and `applied_corrections`. Update `state.yaml` after the Stage output is successfully written.

`confirmed` is reserved for explicit user confirmation. A completed result that does not require review uses `not_required`.
