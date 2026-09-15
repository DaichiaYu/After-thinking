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

A reasoning turn may be interaction-driven. If a local author question or an assistant/external reply materially changes the author's later framing, hypothesis, confidence, distinction, scope, or next question, preserve that intervening turn in `trigger`, `response`, `why`, and `source_refs` as appropriate. Do not reduce the trajectory to two author states while dropping the interaction that explains the change.

The retention test is argumentative dependency: if removing a turn would materially change or obscure how the later author state arose, that turn belongs in the reconstructed reasoning trajectory even when its surface form is a formatting question, clarification, example, objection, or operational detail.

Do not infer dependency from adjacency alone. If the source does not support that a turn materially shaped the later state, keep the sequence without claiming a trigger relationship, or mark the trigger source/dependency as unclear.

## Segmentation rule
Judge both semantic relation and argumentative relation. Low semantic similarity can remain in one reasoning chain when the argumentative dependency is strong; similar wording can still be a separate Topic when it answers a different question.

## Execution exit criteria
Execution is sufficient when material discussion content is assigned to a Topic, marked out of scope, or explicitly uncertain; major reasoning turns are represented, including supported interaction-driven transitions whose omission would distort how later author states emerged; and Topic relationships are sufficient for downstream Claim analysis. Not every sentence needs a Topic.

## Review and advance gate
`review_policy: mandatory`. After execution completes, keep review pending until explicit user confirmation of the current Topic map/reasoning trajectory. Persist material review corrections before rerun. Only a usable Stage 2 may feed Stage 3.

Stable ID behavior follows `docs/id-lifecycle.md`.
