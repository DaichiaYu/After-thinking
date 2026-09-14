# Workspace Write Contract

This document defines where an After-thinking executor writes user analysis and what it must do before Stage 1 begins.

## 1. The user chooses the analysis repository

After-thinking itself stores the method. User analysis must be written to a repository selected by the user.

Before creating a new discussion, the executor needs:

- `analysis_repository`: required, in `owner/repository` form.
- `analysis_root`: optional. Default: `discussions/`.
- `discussion_id`: required. It should be stable and filesystem-safe.

Example:

```yaml
analysis_repository: example-user/private-thinking
analysis_root: discussions/
discussion_id: ai-semantic-drift-2026-09-14
```

The resulting discussion path is:

```text
discussions/ai-semantic-drift-2026-09-14/
```

The executor must not silently use the After-thinking repository as the analysis repository.

## 2. Required workspace layout

When a discussion is initialized, create or maintain this structure in the selected repository:

```text
<analysis_root>/<discussion_id>/
├─ source/
│  ├─ conversation.md
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

Files for later stages may be absent until that stage runs.

## 3. Initialization order

For a new discussion:

1. Confirm the user-selected analysis repository.
2. Resolve `analysis_root` and `discussion_id`.
3. Write the supplied material into `source/` using stable source IDs.
4. Create `state.yaml` from the template.
5. Create `corrections.yaml` with an empty `corrections` list.
6. Set `source_revision` to `1`.
7. Begin Stage 1.

Do not create analysis output before the source and state files exist.

## 4. Source format

Conversation source uses stable IDs:

- `U001`, `U002`... for author/user messages.
- `A001`, `A002`... for AI/assistant messages.
- `E001`, `E002`... for external material treated as a separate source item.

IDs must remain stable across reruns. Appending new source material creates new IDs; existing IDs should not be renumbered.

## 5. Stage output locations

| Stage | Write path |
|---|---|
| 1 | `analysis/01-scope-origin.md` |
| 2 | `analysis/02-topic-map.md` |
| 3 | `analysis/03-claims.yaml` |
| 4 | `analysis/04-cognitive-structure.md` |
| 5 | `analysis/05-gaps.yaml` |
| 6 | `analysis/06-next-directions.md` |

Every Stage output must record:

- `source_revision`
- `workflow_version`
- `applied_corrections`

Markdown outputs should store these fields in YAML front matter. YAML outputs store them as top-level metadata.

## 6. Write sequence for every Stage

Before executing a Stage:

1. Read `state.yaml`.
2. Read `corrections.yaml` and select all applicable active corrections.
3. Run correction preflight. Stop if there is an unresolved correction conflict.
4. Read only the inputs allowed by the Stage Input Contract.
5. Generate the complete Stage output.
6. Write or replace the Stage output file.
7. Update the Stage entry in `state.yaml`.
8. Record the correction IDs actually applied.
9. Stop for review when required; otherwise continue only if the Stage is usable.

The analysis output and `state.yaml` must agree. If a write partially fails, the executor must not pretend the Stage is complete.

## 7. Updating source material

When the user expands an existing discussion:

1. Append or update source material without renumbering existing source IDs.
2. Increment `source_revision`.
3. Load active corrections before rerunning any affected Stage.
4. Mark affected downstream outputs `stale` before regenerating them.
5. Preserve correction history and object IDs where the same logical object still exists.

Do not silently merge new source into previously confirmed analysis.

## 8. Corrections

`corrections.yaml` is a runtime control file. It is not optional history.

Applicable active corrections must be loaded on every run and rerun. If an expected correction is not listed under `applied_corrections`, the run is invalid.

Human-readable explanation may additionally be stored under `revisions/`, but `revisions/` does not replace `corrections.yaml`.

## 9. Repository permissions and failure behavior

If the executor cannot write to the selected repository, it must stop and report that the workspace cannot be initialized or updated.

It must not silently fall back to another repository.

## 10. Publication is separate

This contract covers the Stage 1–6 analysis workspace only.

A publication repository may later be selected separately. Analysis content should not automatically be copied into a publication repository.
