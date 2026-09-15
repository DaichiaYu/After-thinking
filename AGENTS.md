# After-thinking executor guide

This file is the executor entry point. Do not treat README prose as runtime rules.

## Read order

1. Read `docs/runtime.md`.
2. Read `state.yaml` in the selected discussion workspace.
3. Resolve `next_action` and the current Stage.
4. Read that Stage's canonical spec under `specs/`.
5. Read only the cross-Stage documents referenced by the runtime/spec.
6. Load only the inputs listed by the current Stage spec.

The six files under `specs/` are the normative Stage contracts. They define Stage inputs, fields, enums, output shape, review policy, and execution exit criteria.

Cross-Stage rules live under `docs/`: source identity and mutation, state transitions, stable object IDs, corrections, uncertainty, analysis boundaries, common output metadata, and workspace writes.

User analysis belongs in the `analysis_repository` selected by the user. This repository contains the method, templates, and de-identified examples; it is not the default destination for user discussion data.

Initialize a workspace from `templates/`. Write a Stage output before updating `state.yaml`. Never reuse a retired object ID. Never preserve an old `confirmed` status across a substantive rerun.

If the user changes an interpretation during review, persist that material change in `corrections.yaml` before rerunning or confirming the Stage.
