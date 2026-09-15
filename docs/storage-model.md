# Discussion Workspace Storage

Actual analysis is stored in the analysis repository selected by the user.

```text
discussions/<discussion-id>/
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

Git history provides file revision history; no parallel `revisions/` directory is required by default.

`source/conversation.jsonl` is canonical raw source. Message identity and order are separate; see `source-format.md`.

Stable analysis object prefixes are `T` (Topic), `R` (reasoning turn), `C` (Claim), `CS` (cognitive-structure observation), `G` (Gap), and `D` (Direction). Stage 1 uses fixed `S1.*` anchors. Correction IDs use `CR`. Full identity lifecycle rules are in `id-lifecycle.md`.

`state.yaml` stores workflow/review state, a mirror of source revision, monotonic ID counters, correction conflicts, and structured next action. `corrections.yaml` stores persistent user corrections.

Stages 1, 2, 4, and 6 use Markdown with YAML front matter. Stages 3 and 5 use YAML. Output metadata follows `output-format.md`; Stage-specific object shape comes from `specs/`.
