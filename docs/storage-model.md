# Discussion Workspace Storage

Actual analysis is stored in the analysis repository selected by the user.

```text
discussions/<discussion-id>/
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

`source/conversation.jsonl` is the canonical raw source. See `source-format.md`. Each item has a stable role-independent message ID such as `msg-000001`; speaker is stored separately.

`state.yaml` stores workflow and review state, source revision, stale state, correction application, and next action.

`corrections.yaml` stores active corrections that constrain future reruns. Correction IDs use `CR001`, `CR002`, and bind to addressable targets. Stage 1 uses fixed anchors such as `S1.author_initial_position`; later objects use stable `T`, `R`, `C`, `G`, and `D` IDs.

`revisions/` is readable history. Runtime correction behavior comes from `corrections.yaml`.

Stages 1, 2, 4, and 6 use Markdown. Stages 3 and 5 use YAML. Output metadata follows `output-format.md`.

Source changes increment `source_revision`. Existing message IDs are never renumbered. Active corrections remain effective until superseded or retired.

Destination and write-order rules are defined in `workspace-write-contract.md`.
