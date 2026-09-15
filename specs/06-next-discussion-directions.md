# Stage 6 — Next Discussion Directions｜下一次討論方向

This file is the normative Stage 6 contract.

## Purpose
Only when useful, turn existing Stage 5 Gaps into traceable questions for a later discussion. This is not generic brainstorming and does not create work merely to keep the workflow alive.

## Inputs
- usable Stage 2
- usable Stage 3
- usable Stage 5
- source lookup when necessary
- active corrections targeting `D*`

## Output
`analysis/06-next-directions.md` with common YAML front matter.

Canonical object shape:

```markdown
## D001 — <short name>
- related_gap: G001
- derived_from: unresolved_question | unexplored_lead | unsupported_hypothesis | tension | missing_evidence | interrupted_branch
- next_question: ...
- why_this_matters: ...
- expected_impact: ...
- required_input: ...
- priority: High | Medium | Low
```

Every formal Direction must resolve to an existing Gap. If a direction comes from AI/external material not adopted by the author, preserve that status instead of treating it as the author's intended next step.

## Execution exit criteria
Execution is sufficient when every formal Direction is traceable to an existing Gap and contains the required fields, and no unsupported Direction was created merely for completeness. If no Gap warrants continuation, explicitly record that no next discussion direction is required and create zero `D` objects.

## Review and terminal state
`review_policy: none`; successful execution uses `review_status: not_required`. When Stage 6 is usable, set `analysis_status: complete` and `next_action.type: analysis_complete`.

Analysis completion does not require publication, publishable material, gaps, or next directions. Publication is a separate downstream workflow.

Stable ID behavior follows `docs/id-lifecycle.md`.
