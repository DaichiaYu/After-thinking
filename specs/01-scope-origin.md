# Stage 1 — Scope & Origin｜分析範圍與討論起點

This file is the normative Stage 1 contract.

## Purpose
建立分析邊界，重建作者在 AI／外部資料介入前已經知道、相信、懷疑與不確定的內容，並保留後續問題或假設如何由討論中的實質互動轉折生成。

## Inputs
- `source/conversation.jsonl`
- `source/metadata.yaml`
- active corrections targeting Stage 1 anchors

## Output
`analysis/01-scope-origin.md`

Use common YAML front matter from `docs/output-format.md`, then these fixed addressable sections:

```markdown
## S1.scope
...

## S1.trigger
...

## S1.initial_question
...

## S1.underlying_question
...

## S1.author_initial_position
...

## S1.initial_uncertainty
...
```

Each section records supporting `source_refs` or explicitly states that the source is insufficient. `S1.underlying_question` may be unknown.

## Rules
- Do not turn an author idea that was later checked with AI into an AI-originated idea.
- Do not treat an AI restatement as the author's original position.
- Preserve a reasoning-critical interaction when an assistant/external turn materially helps explain how a later author question, hypothesis, scope, distinction, or uncertainty arose. Do not omit it merely because it looks like a local clarification, formatting question, example, or operational detail.
- When a later author question or hypothesis depends on an intervening assistant/external contribution, preserve the supported A -> B -> C trajectory while keeping B's provenance separate from the author's position.
- Do not infer that an intervening turn caused a later shift from chronology alone. Use explicit author language, direct response structure, or sufficiently clear argumentative dependency; otherwise state that the dependency is uncertain.
- Do not invent causal links or hidden motives for narrative smoothness.
- Unknown source/origin is a valid result.

## Execution exit criteria
Execution is sufficient when scope and relevant source roles are identified or explicitly unknown; trigger, initial question, initial position, and initial uncertainty have supported findings or explicit uncertainty; supported reasoning-critical origin transitions needed to explain later question formation are preserved; the underlying question is included only when supportable; and required source references are present.

Stop when these conditions are met. Do not infer additional origin detail merely for completeness.

## Review and advance gate
`review_policy: mandatory`. After execution completes, keep `review_status: pending` until the user explicitly confirms the current result. A material correction made during review must be persisted before rerun. Only a usable Stage 1 may feed Stage 2.
