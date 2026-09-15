# Storage Model

Canonical workspace paths and write order are defined in `workspace-write-contract.md`; raw source structure is defined in `source-format.md`. This file only names the storage roles.

- `source/` — authoritative raw material and source-level metadata.
- `state.yaml` — resumable workflow state, review state, ID counters, retired-object registry, conflicts, and next action.
- `corrections.yaml` — persistent user corrections that constrain future reruns.
- `analysis/` — current Stage outputs. Git history provides prior file versions.

Stable analysis object families are `T` (Topic), `R` (reasoning turn), `C` (Claim), `CS` (cognitive-structure observation), `G` (Gap), and `D` (Direction). Stage 1 uses fixed `S1.*` anchors; corrections use `CR` IDs. Identity lifecycle is defined in `id-lifecycle.md`.

Stages 1, 2, 4, and 6 use Markdown with YAML front matter. Stages 3 and 5 use YAML. Common run metadata comes from `output-format.md`; Stage-specific object shape comes only from `../specs/`.
