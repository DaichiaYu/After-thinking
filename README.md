# After-thinking

> **Don’t just summarize the conversation. Reconstruct how the thinking changed.**

After-thinking is a workflow for turning long AI-assisted discussions into a traceable reasoning record: where the author started, what changed, why it changed, which ideas came from whom, what remains uncertain, and where the discussion can continue next.

[繁體中文版](#繁體中文版)

## Why does this exist?

A normal summary can tell you what was discussed while quietly destroying the structure that made the discussion useful.

It may blur whether an idea came from the author, the AI, or an external source. It may turn an unanswered AI suggestion into something the author supposedly believes. It may preserve the final conclusion but erase the moment a missing variable, counterexample, or distinction changed the reasoning. It may also force Topic A and a later Topic B into one artificial argument simply because they occurred in the same chat.

After-thinking therefore starts with a different question:

> **What actually happened in this thinking process?**

A central rule is: **no objection is not the same as acceptance.** If the AI introduces an idea and the author never adopts it, that idea must not later be rewritten as the author’s position.

Publication comes later, if the author wants it. Reconstruction and publication are deliberately separate.

## Workflow

The current analysis workflow has six stages:

1. **Scope & Origin** — reconstruct the source boundary, trigger, initial question, author’s starting position, and initial uncertainty. Review is mandatory.
2. **Topic Map & Reasoning Trajectory** — split the material into meaningful topics and identify actual reasoning turns rather than summarizing every message. Review is mandatory.
3. **Provenance & Epistemic Status** — separate who introduced a claim, how the author responded, and what status the claim currently has. Review is risk-based.
4. **Cognitive Structure** — identify recurring concepts, distinctions, and reasoning patterns observable within the supplied material, without turning them into permanent personality claims. Review is risk-based.
5. **Discussion Gaps** — identify unresolved questions, unexplored leads, unsupported hypotheses, missing evidence, tensions, and interrupted branches without solving them automatically. Review is risk-based.
6. **Next Discussion Directions** — convert existing gaps into traceable next questions. This is not free-form brainstorming. No review is required by default.

Workflow progress and human review are separate dimensions. `confirmed` is reserved for explicit human confirmation. A risk-based Stage with no item requiring human judgment uses `not_required`; the system must never self-assign `confirmed`.

## Storage model

The method repository is separate from the actual analysis workspace.

```text
After-thinking repository
(method, specs, runtime contracts, templates)
              ↓
Selected analysis repository
(source, reasoning, claims, gaps, state)
              ↓ optional
Publication repository
(final public outputs)
```

The After-thinking repository is not the default destination for discussion data. When a new discussion is initialized, the analysis repository is selected explicitly. The root inside that repository defaults to `discussions/`, and each analysis receives a stable discussion ID.

Canonical discussion workspace:

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

Analysis and publication are separate because **“I considered this idea” is not the same as “I publicly claim this.”**

## Canonical source

Raw conversation material is stored in UTF-8 JSON Lines at `source/conversation.jsonl`.

Each source item has a stable, role-independent message ID such as `msg-000001`. Speaker role is stored separately as `author`, `assistant`, or `external`. New material receives new IDs; existing IDs are never renumbered.

The original source content is preserved as supplied. Analysis stages reference source IDs instead of repeatedly rewriting the raw conversation into new summaries.

## State, corrections, and reruns

`state.yaml` records the workspace location, source revision, current Stage, execution and review state, output paths, applied corrections, stale state, and the next action.

`corrections.yaml` stores corrections as runtime constraints rather than archival notes. An active correction must be loaded on later runs and reruns until it is explicitly superseded or retired. If new source conflicts with an active correction, or a correction target no longer exists, execution stops for explicit resolution instead of silently ignoring the correction.

A material upstream change marks affected downstream outputs `stale` and reruns them from the earliest affected Stage. Formatting-only edits do not trigger stale propagation.

Every Stage output records its workflow version, source revision, and applied correction IDs. Stages 1, 2, 4, and 6 use Markdown with YAML front matter; Stages 3 and 5 use YAML.

## Setup

After-thinking currently provides a workflow specification, runtime contracts, and starter templates. Executable orchestration is still under development.

To use the current specification:

1. Choose the repository that will hold the analysis workspace.
2. Provide the conversation, notes, article, or mixed source material.
3. Create a stable discussion ID.
4. Initialize the discussion from the starter files under [`templates/`](templates/).
5. Preserve raw conversation source as `source/conversation.jsonl`.
6. Run Stages 1–6 according to the input, review, and runtime contracts.
7. When returning later, read `state.yaml` first and resume from the correct Stage instead of starting over.

Each Stage has an input contract so the executor reads only the source and usable upstream outputs it actually needs. This reduces interpretation drift and prevents the model from repeatedly summarizing its own previous summaries.

## Design principles

**Reconstruction before publication.** Do not optimize the analysis for a polished final narrative.

**Provenance before fluency.** A less elegant but correctly attributed idea is better than a beautifully written distortion.

**No response is not agreement.** AI-introduced material remains AI-introduced unless the author actually adopts it.

**Keep important judgments traceable.** Claims and higher-level interpretations should point back to source IDs or usable reasoning objects.

**Corrections must execute, not merely archive.** A correction that is stored but ignored by a future rerun is a broken correction system.

**Interrupt at propagation risks.** Human confirmation belongs where a wrong interpretation would contaminate downstream work, not after every routine output.

## Repository guide

- [`specs/`](specs/) — Stage 1–6 definitions.
- [`docs/workspace-write-contract.md`](docs/workspace-write-contract.md) — destination and write behavior.
- [`docs/source-format.md`](docs/source-format.md) — canonical source format.
- [`docs/runtime.md`](docs/runtime.md) — rollback and stale propagation.
- [`docs/state-semantics.md`](docs/state-semantics.md) — execution, review, and usability semantics.
- [`docs/user-fixes.md`](docs/user-fixes.md) — persistent correction lifecycle.
- [`docs/input-contracts.md`](docs/input-contracts.md) — allowed Stage inputs.
- [`docs/output-format.md`](docs/output-format.md) — output metadata and formats.
- [`templates/`](templates/) — starter source, metadata, state, and correction files.

---

# 繁體中文版

> **不要只摘要對話，而是重建「思考到底怎麼變成現在這樣」。**

After-thinking 把長篇 AI 協作對話整理成可追溯的思考紀錄：作者從哪裡開始、哪裡發生轉折、為什麼改變、哪些想法來自誰、哪些仍然不確定，以及下一次可以從哪裡繼續。

## 為什麼需要它？

一般摘要很容易保留「聊了什麼」，卻弄丟真正重要的結構：作者原本就有的判斷、AI 後來補進來的內容、作者到底有沒有採納、推理在哪裡轉向，以及討論什麼時候其實已經長出另一個可以獨立處理的題目。

核心規則是：**沒有反對，不等於接受。** AI 提出一個說法，而作者沒有接球，不能在最後整理時偷偷變成「作者認為」。

After-thinking 因此先重建思考，再決定要不要發布。

## 六階段流程

1. **分析範圍＋討論起點** — 必須確認。
2. **主題地圖＋推理軌跡** — 必須確認。
3. **來源歸屬＋認知狀態** — 風險式確認。
4. **認知結構** — 風險式確認。
5. **討論缺口** — 風險式確認。
6. **下一次可繼續討論方向** — 預設不需確認。

`confirmed` 只能來自明確人工確認。風險式 Stage 沒有需要人工判斷的項目時使用 `not_required`，不能由系統自己把結果標成 `confirmed`。

## 儲存方式

After-thinking repository 保存方法本身；實際分析寫入另外指定的 analysis repository。每個 discussion 保存 raw source、state、corrections 與 Stage outputs。

Canonical raw source 是 `source/conversation.jsonl`。每則 source item 使用穩定且與角色分離的 message ID，例如 `msg-000001`；speaker 另外保存為 `author`、`assistant` 或 `external`。新增材料不重新編號既有訊息，也不在分析階段偷偷改寫原始內容。

`state.yaml` 保存 source revision、Stage 狀態、review 狀態、applied corrections、stale 狀態與下一步。

`corrections.yaml` 不是單純修正歷史，而是之後 rerun 必須載入的 runtime constraints。Active correction 在被 supersede 或 retire 前持續有效；如果後續材料與 correction 衝突，流程必須停下來處理，不能默默忽略。

上游發生實質修改時，受影響的下游結果先標成 `stale`，再從最早受影響的 Stage 重跑。

分析與發布分離，因為：**「我曾經考慮過這個想法」不等於「這是我公開主張的內容」。**

## 怎麼開始？

目前 After-thinking 已有 workflow specification、runtime contracts 與 starter templates，但 executable orchestration 仍在開發。

先指定分析 workspace、提供原始材料、建立 discussion ID，再使用 [`templates/`](templates/) 初始化。Raw conversation 保存為 `source/conversation.jsonl`，之後依序執行 Stage 1–6。下次回來先讀 `state.yaml`，從正確的位置繼續，而不是重新從頭摘要。

## 最短版

普通摘要保存答案。

After-thinking 想保存的是：

> 原本怎麼想 → 什麼挑戰了它 → 哪裡改變 → 哪些仍然是作者自己的 → 哪些來自 AI → 哪些還沒解完 → 下一步值得看什麼。

**先把思考留下來，再決定要不要發。**
