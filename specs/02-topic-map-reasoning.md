# Stage 2 — Topic Map & Reasoning Trajectory｜主題地圖與推理軌跡

This file is the normative Stage 2 contract.

## Purpose
把長對話整理成主題結構與真正發生過的認知轉折，而不是逐句摘要。

## Inputs
- `source/*`
- usable Stage 1
- active corrections targeting `T*` or `R*`

## Output
`analysis/02-topic-map.md` with common YAML front matter.

### Topic shape

```markdown
## T001 — <short name>
- type: Main topic | Subtopic | Branch | Standalone topic | Workflow/meta topic
- core_question: ...
- parent: null | Txxx
- relation_to_previous: ...
- standalone: true | false
- source_spans:
  - start: msg-000001
    end: msg-000004
  - start: msg-000010
    end: msg-000012
- source_refs: []
```

A Topic may recur after other Topics. Use multiple `source_spans` and/or discrete `source_refs`; never assume one continuous range.

### Reasoning-turn shape

```markdown
## R001 — <short description>
- topic_ids: [T001]
- before: ...
- trigger: ...
- trigger_source: author | assistant | external | mixed | unclear
- response: ...
- after: ...
- why: ...
- source_refs: [msg-000003, msg-000004]
```

Only create `R` objects for material cognitive change. Rewording alone is not necessarily a reasoning turn.

## Segmentation rule
Judge both semantic relation and argumentative relation. Low semantic similarity can remain in one reasoning chain when the argumentative dependency is strong; similar wording can still be a separate Topic when it answers a different question.

## Execution exit criteria
Execution is sufficient when material discussion content is assigned to a Topic, marked out of scope, or explicitly uncertain; major reasoning turns are represented; and Topic relationships are sufficient for downstream Claim analysis. Not every sentence needs a Topic.

## Review and advance gate
`review_policy: mandatory`. After execution completes, keep review pending until explicit user confirmation of the current Topic map/reasoning trajectory. Persist material review corrections before rerun. Only a usable Stage 2 may feed Stage 3.

Stable ID behavior follows `docs/id-lifecycle.md`.
