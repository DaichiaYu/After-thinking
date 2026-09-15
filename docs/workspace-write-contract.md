# Workspace Write Contract

User analysis is written to the `analysis_repository` selected by the user. `analysis_root` defaults to `discussions/`; each analysis has a stable `discussion_id`. The After-thinking repository stores the method, not user discussion data.

## Workspace

```text
<analysis_root>/<discussion_id>/
├─ source/
│  ├─ conversation.jsonl
│  └─ metadata.yaml
├─ state.yaml
├─ corrections.yaml
└─ analysis/
   ├─ 01-scope-origin.md
   ├─ 02-topic-map.md
   ├─ 03-claims.yaml
   ├─ 04-cognitive-structure.md
   ├─ 05-gaps.yaml
   └─ 06-next-directions.md
```

Git history is the version history for workspace files. Do not maintain a parallel `revisions/` directory by default.

## Initialize

1. Resolve `analysis_repository`, `analysis_root`, and `discussion_id`.
2. Write raw source and source metadata.
3. Create `state.yaml` and `corrections.yaml`.
4. Set authoritative source revision to 1 in metadata and mirror it in state.
5. Begin Stage 1.

## Stage writes

Before every run, read state, the current Stage spec, directly applicable active corrections, and only the allowed Stage inputs. Write the Stage output first; update `state.yaml` only after that write succeeds.

Stage paths are fixed as shown above. Object shape and enums come from the canonical Stage spec under `specs/`.

## Source updates

Follow `source-format.md` for append, insert, edit, delete, ordering, message identity, and revision authority. After a semantic source change, increment the authoritative source revision, mirror it to state, evaluate stale propagation, reset review state on affected reruns, and preserve active corrections.

If the selected repository cannot be written, stop rather than choosing another repository. Publication is outside this analysis write contract.
