# Workspace Write Contract

User analysis is written to the `analysis_repository` selected by the user. `analysis_root` defaults to `discussions/`; each analysis has a stable `discussion_id`.

The After-thinking repository stores the method and is not the default destination for user discussion data.

## Workspace

```text
<analysis_root>/<discussion_id>/
├─ source/
│  ├─ conversation.jsonl
│  └─ metadata.yaml
├─ state.yaml
├─ corrections.yaml
├─ analysis/
│  ├─ 01-scope-origin.md
│  ├─ 02-topic-map.md
│  ├─ 03-claims.yaml
│  ├─ 04-cognitive-structure.md
│  ├─ 05-gaps.yaml
│  └─ 06-next-directions.md
└─ revisions/
```

Raw source follows `source-format.md`. State and correction files follow the templates under `templates/`.

## Initialize

1. Resolve `analysis_repository`, `analysis_root`, and `discussion_id`.
2. Write raw source and source metadata.
3. Create `state.yaml` and `corrections.yaml`.
4. Set source revision to 1.
5. Begin Stage 1.

## Stage writes

Before every run, read state and applicable active corrections, then read only the allowed Stage inputs. Write the Stage output first; update `state.yaml` only after that write succeeds. Record source revision and applied correction IDs according to `output-format.md`.

Stage paths are fixed as `analysis/01-scope-origin.md`, `02-topic-map.md`, `03-claims.yaml`, `04-cognitive-structure.md`, `05-gaps.yaml`, and `06-next-directions.md`.

## Source updates

Append new JSONL items with new stable message IDs and do not renumber existing items. Increment source revision and mark affected downstream outputs stale before rerunning them. Active corrections remain applicable.

If the selected repository cannot be written, stop rather than choosing another repository.

Publication uses a separately selected destination and is outside this analysis write contract.
