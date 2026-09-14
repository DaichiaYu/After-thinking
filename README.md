# After-thinking

> **Turn long AI-assisted discussions into structured, traceable thinking records.**

After-thinking is a workflow for organizing a discussion without flattening it into a conventional summary. It reconstructs where the discussion started, how topics branched, which reasoning turns mattered, who introduced each important idea, what the author actually adopted, what remains uncertain, and what is still worth exploring.

It is designed for conversations that became useful enough that you do not want to lose the thinking process inside the chat history.

[繁體中文版](#繁體中文版)

## What it does

After-thinking can:

- reconstruct the original question, starting position, and uncertainty;
- separate one long conversation into Topics instead of treating the whole chat as one argument;
- identify meaningful reasoning turns and why the thinking changed;
- distinguish author-originated, AI-originated, external, and co-developed ideas;
- track whether an AI suggestion was adopted, rejected, left unanswered, or remains unclear;
- preserve uncertain and low-confidence findings instead of forcing a clean classification;
- identify recurring concepts and reasoning patterns only when the source supports them;
- record unresolved questions, missing evidence, tensions, and interrupted branches;
- turn existing gaps into traceable directions for a later discussion;
- preserve user corrections across reruns so the same known interpretation error is not silently recreated;
- resume an analysis later from saved state instead of summarizing the entire conversation again.

The result is not required to become a post, article, or other public artifact. A complete reasoning record is already a valid endpoint.

## Six-stage workflow

1. **Scope & Origin** — establish the source boundary, trigger, initial question, starting position, and initial uncertainty.
2. **Topic Map & Reasoning Trajectory** — separate meaningful Topics and identify actual reasoning turns.
3. **Provenance & Epistemic Status** — track who introduced material Claims, how the author responded, and what status those Claims currently have.
4. **Cognitive Structure** — identify supported recurring concepts, distinctions, and reasoning patterns within the supplied material.
5. **Discussion Gaps** — record unresolved questions, unsupported hypotheses, missing evidence, tensions, and unfinished branches.
6. **Next Discussion Directions** — turn existing Gaps into traceable next questions when continuation is useful.

Each Stage has explicit exit criteria. The goal is not to analyze until nothing else could possibly be said; it is to produce enough supported structure for the next Stage to operate safely.

Stages may complete with uncertainty. `Unclear provenance`, `Co-developed`, low confidence, no supported recurring pattern, `gaps: []`, or no next direction can all be valid results.

## Review model

Workflow progress and human review are separate.

Stages 1 and 2 require user confirmation because an early scope or Topic error can distort everything downstream. Stages 3–5 use risk-based review. Stage 6 requires no review by default.

`confirmed` always means explicit user confirmation. A Stage that does not need review uses `not_required`.

Low confidence alone does not trigger review. Review is reserved for uncertainty that materially affects downstream interpretation and can plausibly be resolved by the user.

## Storage and resume

The After-thinking repository stores the method. Actual discussion analysis is stored in a repository selected by the user.

```text
Selected analysis repository
└─ discussions/<discussion-id>/
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

Raw conversation material is preserved in `source/conversation.jsonl` with stable message IDs. `state.yaml` records the current workflow state, source revision, review state, applied corrections, and next action. `corrections.yaml` stores active user corrections that must continue to constrain later reruns until replaced or retired.

When source material changes, affected downstream outputs become stale and are regenerated from the earliest affected Stage.

## Quick setup

After-thinking currently provides a workflow specification, runtime contracts, and starter templates; executable orchestration is still under development.

To use the specification:

1. Select the repository that will hold the analysis.
2. Provide the conversation, notes, article, or mixed source material.
3. Create a stable discussion ID.
4. Initialize the workspace from [`templates/`](templates/).
5. Run Stages 1–6 according to their input, review, uncertainty, and exit rules.
6. On a later session, read `state.yaml` and resume from the recorded state.

## Why use it?

Long AI conversations often contain more than a final answer. They may contain an original intuition, several branches, an AI-generated counterexample, a correction, a reframed question, an abandoned hypothesis, and a conclusion that only makes sense because of the route taken to reach it.

A normal summary is useful when only the result matters. After-thinking is useful when the path matters too.

The structured record can later support many different uses: resuming research or design work, reviewing how a decision developed, comparing changes in a hypothesis, building personal knowledge notes, handing a discussion to another AI session or collaborator, or — if the author chooses — extracting material for posts, articles, presentations, or other personal content.

Those later uses do not control the analysis. Stages 1–6 reconstruct the discussion as faithfully as possible even when nothing in it is worth publishing.

## Core rules

**Uncertainty is a result, not a failure.** Do not force a classification the evidence cannot support.

**No response is not agreement.** An AI-introduced idea does not become the author's position merely because the author did not reject it.

**Stop when the Stage is sufficient.** Exit criteria are satisficing, not maximizing.

**Corrections must execute.** A stored correction that a future rerun ignores is a broken correction system.

**Analysis stands on its own.** No publishable material is a valid successful outcome.

## Repository guide

- [`docs/runtime.md`](docs/runtime.md) — runtime entry point and invariants.
- [`docs/uncertainty-semantics.md`](docs/uncertainty-semantics.md) — valid uncertainty states and review behavior.
- [`docs/stage-exit-criteria.md`](docs/stage-exit-criteria.md) — stopping conditions for Stages 1–6.
- [`docs/analysis-boundary.md`](docs/analysis-boundary.md) — boundary between analysis and later publication work.
- [`docs/workspace-write-contract.md`](docs/workspace-write-contract.md) — destination and write behavior.
- [`docs/source-format.md`](docs/source-format.md) — canonical raw source format.
- [`docs/state-semantics.md`](docs/state-semantics.md) — execution, review, and usability semantics.
- [`docs/user-fixes.md`](docs/user-fixes.md) — persistent correction lifecycle.
- [`docs/input-contracts.md`](docs/input-contracts.md) — allowed Stage inputs.
- [`docs/output-format.md`](docs/output-format.md) — output metadata and completion evidence.
- [`templates/`](templates/) — starter workspace files.

---

# 繁體中文版

> **把長篇 AI 協作討論整理成有結構、可追溯、可以繼續使用的思考紀錄。**

After-thinking 不是單純把聊天內容縮短，而是整理討論本身：從哪裡開始、後來分成哪些主題、哪些地方真的發生推理轉折、重要觀點是誰提出的、作者有沒有採納、哪些仍然不確定，以及還有哪些問題值得繼續。

它適合那些「聊完之後覺得裡面有東西，不想讓整段思考直接沉進聊天紀錄」的對話。

## 可以整理出什麼？

After-thinking 可以重建原始問題與作者起點、拆分 Topic、整理 reasoning turns、區分作者／AI／外部來源／共同發展的觀點、追蹤作者是否接受 AI 提議、保存低信心與無法判斷的內容、整理反覆出現的概念與推理模式、找出尚未完成的問題與缺口，並在確實有需要時整理下一次可繼續討論的方向。

使用者曾經糾正過的判斷會另外保存成 runtime correction，之後重跑不能假裝沒看過。分析狀態也會保存，因此下一次可以從原本進度繼續，不必重新把整段對話摘要一次。

分析完成本身就是有效終點，不需要最後一定產出貼文、文章或其他公開內容。

## 六階段流程

1. **分析範圍＋討論起點**
2. **主題地圖＋推理軌跡**
3. **觀點來源＋認知狀態**
4. **認知結構**
5. **討論缺口**
6. **下一次可繼續討論方向**

每個 Stage 都有明確停止條件。目標不是「分析到再也找不到任何東西」，而是做到足以讓下一層安全運作就停止。

不確定也是正式結果。來源不明、共同發展、低 confidence、沒有足夠證據形成反覆模式、沒有 gap，甚至沒有下一步，都可以是成功完成的分析。

## 確認機制

Stage 1–2 必須由使用者確認；Stage 3–5 採風險式確認；Stage 6 預設不需確認。

`confirmed` 只能代表使用者真的確認過。低 confidence 本身不等於需要人工介入；只有會實質影響後續判斷，而且使用者有機會解決的不確定性，才應中斷要求確認。

## 儲存與續跑

After-thinking repository 保存方法本身，實際分析寫入使用者指定的 repository。每個 discussion 保存 raw source、`state.yaml`、`corrections.yaml` 與六個 Stage 的分析結果。

Raw conversation 使用 `source/conversation.jsonl` 保存，既有 message ID 不重新編號。`state.yaml` 記錄目前做到哪裡、source revision、review、corrections 與下一步；`corrections.yaml` 保存之後重跑仍必須生效的使用者修正。

上游資料或判斷發生實質變更時，受影響的下游結果會先變成 `stale`，再從最早受影響的位置重跑。

## 為什麼需要它？

長篇 AI 討論裡有價值的往往不只是最後答案，還包括原本的直覺、岔出去的題目、AI 補進來的反例、作者的糾正、重新定義問題的那一刻，以及最後沒有繼續追下去的假設。

如果只需要結論，一般摘要通常就夠了；如果連「怎麼想到這裡」都值得留下，After-thinking 才有用。

整理後的結果可以拿來繼續研究或設計、回顧決策怎麼形成、比較假設如何改變、建立個人知識筆記、交接給下一個 AI session 或其他協作者；如果作者另外有需要，也可以再從裡面提取適合做成貼文、文章、簡報或其他個人內容的材料。

但那些用途都是後續用途，不會反過來決定 Stage 1–6 應該怎麼整理。即使最後完全沒有值得公開的內容，分析依然可以正常完成。
