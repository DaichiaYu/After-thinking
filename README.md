# After-thinking

> **Don’t just summarize the conversation. Reconstruct how the thinking changed.**
>
> After-thinking is a workflow for turning long AI-assisted conversations into a traceable record of reasoning: where the author started, what changed, why it changed, which ideas came from whom, what remains uncertain, and where the discussion can continue next.

[繁體中文版](#繁體中文版)

---

## What is After-thinking?

Long conversations with AI often contain useful thinking that is difficult to recover later.

A normal summary can tell you **what was discussed**, but it often destroys the parts that matter most:

- what the author already believed before the AI responded;
- which idea was introduced by the author, the AI, or an external source;
- which AI suggestions the author accepted, modified, challenged, ignored, or rejected;
- where the reasoning actually changed;
- when the conversation quietly moved from Topic A to a mostly separate Topic B;
- which conclusions are stable, tentative, unresolved, or still only hypotheses.

After-thinking is designed to preserve that structure.

It does **not** begin by asking, “How can I turn this into a good post?”

It begins by asking:

> **What actually happened in this thinking process?**

Only after the reasoning has been reconstructed should the material be turned into a post, note, article, research memo, or other public output.

---

## Why does this exist?

AI is very good at producing fluent summaries. Fluency is also the problem.

When a long discussion is compressed too early, several kinds of distortion can happen:

### 1. Provenance gets blurred

The author may begin with an original intuition, ask the AI for evidence, and later refine the idea. A conventional summary may flatten this into:

> “After reviewing the evidence, the author concluded that…”

That changes the origin of the idea.

### 2. “The AI said it” can quietly become “the author believes it”

An AI can introduce a plausible explanation that the author never directly responds to. If the final summary includes it as part of the author’s position, the record is already contaminated.

**No objection is not the same as acceptance.**

### 3. Reasoning turns disappear

The most valuable part of a discussion may not be the final conclusion. It may be the moment when the author noticed a missing variable, rejected an explanation, split one problem into two, or changed the conditions under which a claim would hold.

A flat summary usually keeps the destination and throws away the route.

### 4. Topic drift gets mistaken for one coherent argument

Real conversations branch. Topic B may be triggered by Topic A while still becoming independent enough to deserve its own analysis or publication.

After-thinking distinguishes between **semantic similarity** and **argumentative dependency** instead of assuming that everything discussed in one chat belongs in one article.

### 5. Publishing pressure can distort analysis

If the model knows from the beginning that it must produce a polished post, it has an incentive to smooth gaps, close open questions, remove awkward contradictions, and create a cleaner narrative than the source actually supports.

After-thinking therefore separates **reconstruction** from **publication**.

---

## Core idea

After-thinking treats a conversation as a reasoning trace rather than a block of text to summarize.

The current analysis workflow has six stages:

```text
Source material
    ↓
1. Scope & Origin
    ↓ user confirmation
2. Topic Map & Reasoning Trajectory
    ↓ user confirmation
3. Provenance & Epistemic Status
    ↓ risk-based confirmation
4. Cognitive Structure
    ↓
5. Discussion Gaps
    ↓
6. Next Discussion Directions
    ↓
Analysis complete
```

### Stage 1 — Scope & Origin

Establish what material is being analyzed and reconstruct the starting point:

- What triggered the discussion?
- What was the author’s initial question?
- What did the author already believe, suspect, or distinguish before the AI contributed?
- What was genuinely uncertain at the beginning?

### Stage 2 — Topic Map & Reasoning Trajectory

Split the conversation into meaningful topics and identify real reasoning changes rather than summarizing every message.

A reasoning turn records roughly:

```text
Before → Trigger → Author response → After → Why it changed
```

This stage also decides whether Topic B is:

- part of the same argument;
- a branch of Topic A;
- a new standalone topic;
- or simply workflow/meta discussion.

### Stage 3 — Provenance & Epistemic Status

For each important claim, separate three questions:

1. **Who introduced it?**
2. **How did the author respond to it?**
3. **What status does it currently have?**

Examples of provenance include `Author-original`, `AI-introduced`, `AI-supported`, `Co-developed`, and `External-source`.

Author uptake is tracked separately: accepted, modified, challenged, rejected, not addressed, or unclear.

The claim may then be classified as a stable claim, tentative conclusion, new hypothesis, unresolved question, unexplored lead, rejected path, or suspended judgment.

### Stage 4 — Cognitive Structure

Identify recurring reasoning characteristics observable **within the supplied material**:

- distinctions the author repeatedly preserves;
- what kinds of evidence cause revisions;
- what kinds of explanations the author rejects;
- recurring ways of handling exceptions, variables, or competing explanations;
- core concepts that survive across multiple branches of the discussion.

This is not a personality profile. After-thinking does not infer permanent traits from a single conversation.

### Stage 5 — Discussion Gaps

Identify what is still unfinished without trying to solve it automatically:

- unresolved questions;
- unexplored leads;
- unsupported hypotheses;
- missing evidence;
- tensions between existing claims;
- branches that were opened and then abandoned.

### Stage 6 — Next Discussion Directions

Turn those gaps into concrete next questions.

Each proposed direction should explain where it came from, why it matters, what existing claim it could change, and what additional input may be required.

This makes it possible to return later and continue the reasoning without rereading the entire original conversation.

---

## What After-thinking is not

After-thinking is **not**:

- a generic conversation summarizer;
- a tool that automatically decides what the author “really believes”;
- a long-term personality model;
- a memory system that silently accumulates everything a user says;
- an automatic content-marketing pipeline;
- a system that assumes every discussion should become public content.

The workflow analyzes the material explicitly supplied for a discussion. Publication is a separate, optional stage.

---

## Storage model

After-thinking separates the method from the user’s actual thinking.

The recommended model has three layers:

```text
After-thinking repository
(method, workflow, schemas, templates)
              ↓
Analysis workspace repository
(source, reasoning, claims, gaps, state)
              ↓ optional
Publication repository
(posts, articles, research notes, final outputs)
```

### 1. After-thinking repository

This repository contains the workflow itself. It should not become an unlimited archive of user conversations.

### 2. Analysis workspace repository

The user chooses where actual analysis is stored. A discussion workspace is expected to look roughly like this:

```text
discussions/
└─ <discussion-id>/
   ├─ source/
   │  ├─ conversation.md
   │  └─ metadata.yaml
   ├─ state.yaml
   ├─ analysis/
   │  ├─ 01-scope-origin.md
   │  ├─ 02-topic-map.md
   │  ├─ 03-claims.yaml
   │  ├─ 04-cognitive-structure.md
   │  ├─ 05-gaps.yaml
   │  └─ 06-next-directions.md
   └─ revisions/
```

### 3. Publication repository — optional

If the user later decides to publish something, the final output may be written to a different repository.

This separation matters because:

> **“I considered this idea” is not the same as “I publicly claim this.”**

A private reasoning trace and a public knowledge base should not be forced into the same storage boundary.

---

## How to set it up

> **Project status:** After-thinking is currently being developed as a workflow specification. The repository defines how the analysis should behave and how its state should be stored. It is not yet a finished one-command application.

### Step 1 — Prepare an analysis workspace

Create or choose a repository where you want your actual discussion analyses to live.

This can be private or public depending on the material you plan to analyze. For personal conversations and unfinished thinking, a private repository is usually the safer default.

You may use the same repository for final publications, but keeping analysis and publication separate is recommended.

### Step 2 — Choose the source material

Provide the conversation, notes, article, or mixed text you want to analyze.

The source should be preserved as evidence rather than repeatedly rewritten by later stages.

For conversations, stable message identifiers are recommended:

```text
U001  author/user message
A001  AI/assistant message
E001  external material or quotation
```

Later stages can then point back to the exact source instead of relying on memory or on previous AI summaries.

### Step 3 — Create a discussion workspace

Each analysis should receive its own discussion ID and folder.

Example:

```text
discussions/ai-semantic-drift-2026-09-14/
```

The workspace contains the source, current workflow state, analysis outputs, and any explicit correction notes.

### Step 4 — Run the stages in order

The current workflow is deliberately linear but rollback-aware:

```text
1 → 2 → 3 → 4 → 5 → 6
```

Stages 1 and 2 require user confirmation because errors there would distort everything downstream.

Stage 3 uses risk-based confirmation: the user does not need to approve every claim, only ambiguous or high-risk provenance judgments.

Stages 4–6 can normally continue from confirmed upstream material.

### Step 5 — Preserve state

The discussion’s `state.yaml` records where the workflow currently is, which stages are confirmed, and which outputs need to be recalculated.

If an upstream interpretation changes, downstream files should not be silently rewritten and treated as valid. They should first be marked **stale** and then regenerated from the corrected state.

### Step 6 — Continue later without starting over

When returning to a discussion, the system should read the state file first and resume from the correct stage.

The goal is not to feed the entire history back into the model every time. Each stage has an **input contract** defining the minimum source and confirmed upstream outputs it is allowed to use.

This reduces interpretation drift and prevents the model from repeatedly summarizing its own previous summaries.

---

## Design principles

**Reconstruction before publication.**  
Do not optimize the analysis for a polished final narrative.

**Provenance before fluency.**  
A less elegant but correctly attributed idea is better than a beautifully written distortion.

**No response is not agreement.**  
AI-introduced material remains AI-introduced unless the author actually adopts it.

**Keep claims traceable.**  
Important interpretations should point back to source messages or previously confirmed reasoning nodes.

**Separate evidence from interpretation.**  
Raw source, structured claims, higher-level cognitive interpretation, and publication output should not be collapsed into one file.

**Keep the author in control at high-risk points.**  
The system should ask for confirmation where a wrong interpretation would propagate, not interrupt the user thirteen times for routine approvals.

---

## Repository guide

- [`specs/`](specs/) — definitions for Stages 1–6.
- [`docs/storage-model.md`](docs/storage-model.md) — discussion workspace and storage design.
- [`docs/runtime.md`](docs/runtime.md) — workflow states, rollback, and stale-output behavior.
- [`docs/input-contracts.md`](docs/input-contracts.md) — what each stage is allowed to read.
- [`docs/`](docs/) — stage execution contracts and implementation notes.

The schemas, templates, and executable implementation are still being developed.

---

## Short version

After-thinking exists because useful ideas often emerge **during** an AI conversation, not only at the end of it.

A normal summary preserves the answer.

After-thinking tries to preserve the **path**:

> what you thought → what challenged it → what changed → what remained yours → what came from the AI → what is still open → what to examine next.

That reasoning trace can later become a post, a research note, a project decision, or nothing public at all.

The analysis comes first.

---

# 繁體中文版

> **不要只摘要對話，而是重建「思考到底怎麼變成現在這樣」。**
>
> After-thinking 是一套把長篇 AI 協作對話整理成「可追溯思考狀態」的工作流程：作者從哪裡開始、途中發生哪些轉折、為什麼改變、哪些想法是誰提出的、目前哪些事情仍不確定，以及下一次可以從哪裡繼續。

---

## After-thinking 是什麼？

和 AI 長時間討論之後，真正有價值的內容常常很難重新撈出來。

一般摘要可以告訴你「聊了什麼」，但很容易同時抹掉最重要的東西：

- 作者在 AI 回答之前，本來就已經相信或懷疑什麼；
- 一個觀點最早來自作者、AI，還是外部資料；
- AI 提出的內容，作者究竟接受、修改、質疑、忽略還是否定；
- 哪些地方真的發生了推理轉折；
- 討論什麼時候已經從 A 題走到了關聯不高、可以獨立處理的 B 題；
- 哪些是穩定主張、暫時結論、未解問題或仍待驗證的假設。

After-thinking 想保留的就是這些結構。

它不會一開始就問：

> 「我要怎麼把這串聊天整理成一篇好看的貼文？」

它會先問：

> **「這場思考實際上發生了什麼？」**

把思考重建好之後，才決定要不要把其中一部分轉成貼文、文章、研究筆記或其他公開內容。

---

## 為什麼需要它？

AI 很擅長寫流暢的摘要，而「太流暢」本身就是問題之一。

如果太早把長對話壓成漂亮結論，很容易出現幾種扭曲。

### 1. 想法來源被模糊

作者可能原本就有一個直覺，只是請 AI 幫忙找證據，最後再修正自己的想法。

一般摘要卻可能寫成：

> 「作者閱讀相關證據後形成了……」

這已經改變了想法真正的來源。

### 2. 「AI 說過」偷偷變成「作者認為」

AI 可能提出一個合理的解釋，但作者根本沒有直接回應。

如果最後摘要直接把它收進作者立場，紀錄就已經被污染。

**沒有反對，不等於接受。**

### 3. 真正的推理轉折消失

一場討論最有價值的部分不一定是最後答案。

可能是作者突然發現少了一個變數、否定原本解釋、把一個問題拆成兩個，或重新限制某個主張成立的條件。

一般摘要常常留下目的地，卻把路徑全部丟掉。

### 4. 話題漂移被誤當成同一條論證

真實對話本來就會分支。

B 題可能確實是由 A 題引發，但後來已經足以獨立討論甚至獨立成文。

After-thinking 不只看字面是否相似，也會區分 **語義關聯** 與 **論證依賴**。

### 5. 「最後要寫成文章」反過來污染分析

如果模型一開始就知道最後必須交出一篇漂亮貼文，它很容易主動把缺口補齊、替未解問題下結論、刪掉不漂亮的矛盾，最後形成一條比原始對話更乾淨、但也更假的敘事。

因此 After-thinking 把 **思考重建** 與 **發布編輯** 分開。

---

## 核心流程

目前分析流程分成六個階段：

```text
原始材料
    ↓
1. 分析範圍＋討論起點
    ↓ 使用者確認
2. 主題地圖＋推理軌跡
    ↓ 使用者確認
3. 來源歸屬＋認知狀態
    ↓ 高風險項目確認
4. 認知結構
    ↓
5. 討論缺口
    ↓
6. 下一次可繼續討論方向
    ↓
分析完成
```

### Stage 1 — 分析範圍與討論起點

先確認這次到底分析哪些材料，以及作者在討論一開始的位置：

- 什麼觸發這場討論？
- 作者最初問的是什麼？
- AI 介入之前，作者已經有哪些判斷、懷疑或概念區分？
- 當時真正不確定的是什麼？

### Stage 2 — 主題地圖與推理軌跡

把長對話切成真正有意義的主題，並只抓實際發生認知變化的節點，而不是逐句摘要。

一個推理轉折大致會記成：

```text
原本怎麼想 → 什麼觸發 → 作者怎麼回應 → 後來怎麼想 → 為什麼改
```

這一步也會判斷 B 題究竟是 A 題的一部分、延伸分支、獨立新題，還是單純在談發布或工具流程。

### Stage 3 — 來源歸屬與認知狀態

每個重要觀點拆成三個不同問題：

1. **最早是誰提出的？**
2. **作者後來怎麼回應？**
3. **目前它在作者思考中是什麼狀態？**

來源可能是作者原創、AI 首先提出、AI 補充、共同形成或外部資料。

作者的反應則另外判斷：接受、修改、質疑、否定、沒有回應或無法判定。

最後再標記它目前是穩定主張、暫時結論、新生假設、未解問題、未延伸線索、已否定路徑或暫緩判斷。

### Stage 4 — 認知結構

整理**只在本次材料中可以觀察到**的反覆推理特徵，例如：

- 作者持續保留哪些概念區分；
- 哪些證據會讓作者改變判斷；
- 哪種解釋容易被作者否定；
- 作者如何處理例外、變數與競爭解釋；
- 哪些核心概念橫跨不同分支仍然存在。

這不是人格測驗，也不會因為一段對話就推論作者具有永久性格特徵。

### Stage 5 — 討論缺口

找出還沒有走完的地方，但這一步不急著替作者回答：

- 未解問題；
- 未延伸線索；
- 尚未驗證的假設；
- 缺失證據；
- 不同主張之間尚未處理的張力；
- 曾經開出去、後來中斷的分支。

### Stage 6 — 下一次可繼續討論方向

把前面的缺口轉成真正可以接著問的問題。

每個方向都應說明它從哪裡來、為什麼值得繼續、回答之後可能改變哪一個現有判斷，以及還需要哪些額外資料。

因此下次回來時，不需要重新把整串聊天再讀一次才能想起「上次到底聊到哪」。

---

## After-thinking 不是什麼

After-thinking 不是普通對話摘要器，也不是自動替作者決定「你真正相信什麼」的工具。

它不建立長期人格模型、不默默累積所有使用者內容、不預設每場討論最後都要拿去行銷，也不要求所有分析都變成公開文章。

它只對這一次明確提供的材料負責。

發布是另一個可選流程。

---

## 儲存方式

After-thinking 把「方法」和「使用者實際思考內容」分開。

建議分成三層：

```text
After-thinking 工具倉庫
（方法、流程、schema、template）
              ↓
分析工作區倉庫
（原始內容、推理、claims、gaps、state）
              ↓ 可選
發布倉庫
（貼文、文章、研究筆記、正式產物）
```

### 1. After-thinking 工具倉庫

這個 repository 保存方法本身，不應該無限堆積所有使用者聊天紀錄。

### 2. 分析工作區倉庫

實際分析內容由使用者自行指定要放在哪裡。

一個 discussion workspace 預計長這樣：

```text
discussions/
└─ <discussion-id>/
   ├─ source/
   │  ├─ conversation.md
   │  └─ metadata.yaml
   ├─ state.yaml
   ├─ analysis/
   │  ├─ 01-scope-origin.md
   │  ├─ 02-topic-map.md
   │  ├─ 03-claims.yaml
   │  ├─ 04-cognitive-structure.md
   │  ├─ 05-gaps.yaml
   │  └─ 06-next-directions.md
   └─ revisions/
```

### 3. 發布倉庫（可選）

如果之後真的決定公開其中某些內容，可以再把正式輸出寫到另一個 repository。

這個分離很重要，因為：

> **「我曾經考慮過這個想法」不等於「這是我公開主張的內容」。**

私人思考軌跡和公開知識庫，不應該被迫綁在同一個資料邊界裡。

---

## 要怎麼設定？

> **目前狀態：** After-thinking 現在仍在 workflow specification（工作流程規格）階段。這個 repository 目前主要定義「分析應該怎麼運作」以及「狀態應該怎麼保存」，還不是一個可以一行指令安裝完成的一鍵式產品。

### Step 1 — 準備分析工作區

建立或指定一個 repository，用來存放實際的 discussion analysis。

如果內容包含私人對話或還沒成熟的想法，通常比較建議用 private repository。

分析和最後發布可以放同一個 repo，但預設建議分開。

### Step 2 — 指定原始材料

提供想分析的對話、筆記、文章或混合文字。

原始資料應被視為 evidence（證據）保存，而不是在每一階段被 AI 重新改寫一次。

如果是對話，建議使用穩定訊息 ID：

```text
U001  作者／使用者訊息
A001  AI／助理訊息
E001  外部材料或引用
```

這樣後續分析才能直接回指原始內容，而不是依賴 AI 記憶或上一輪摘要。

### Step 3 — 建立 discussion workspace

每次分析建立自己的 discussion ID 與資料夾，例如：

```text
discussions/ai-semantic-drift-2026-09-14/
```

裡面保存原始材料、流程狀態、各階段分析輸出，以及必要的使用者修正紀錄。

### Step 4 — 依序執行 Stage 1–6

目前採取可回滾的線性流程：

```text
1 → 2 → 3 → 4 → 5 → 6
```

Stage 1、2 必須由使用者確認，因為這兩層如果理解錯，後面所有分析都會跟著歪。

Stage 3 採高風險確認，不需要逐條核准，只確認來源歸屬或作者接納程度模糊的地方。

Stage 4–6 通常可以根據前面已確認結果繼續執行。

### Step 5 — 保存流程狀態

`state.yaml` 用來記錄目前做到哪一階段、哪些已確認，以及哪些結果需要重新計算。

如果上游理解被修正，下游內容不能偷偷改完就假裝一直都正確，而應先標成 **stale（已過期、需要重算）**，再根據新的上游狀態重新生成。

### Step 6 — 下次從正確的位置繼續

重新打開某個 discussion 時，系統應先讀 `state.yaml`，而不是重新從 Stage 1 開始。

也不應每一階段都把所有歷史文件重新塞給模型。

每個 Stage 都有自己的 **Input Contract（輸入契約）**，只讀原始材料和真正需要的上游確認結果，以降低 interpretation drift（解讀漂移）以及 AI 不斷摘要自己先前摘要的問題。

---

## 設計原則

**先重建，再發布。**  
不要從一開始就為了文章漂亮而整理思考。

**來源正確優先於文字漂亮。**  
一個稍微難看、但歸屬正確的觀點，比一個流暢卻扭曲作者的摘要更有價值。

**沒回應不等於同意。**  
AI 提出的內容，在作者真的接納之前都仍然只是 AI 提出的內容。

**重要判斷必須能追溯。**  
盡量讓 claims、推理轉折與高階解讀都能回指原始訊息或已確認節點。

**證據和解讀分開。**  
原始材料、結構化 claim、高階認知分析與最終發布內容，不應全部揉成同一份文件。

**只在真正高風險的地方打斷使用者。**  
系統應該在錯一次就會污染後續的地方要求確認，而不是逼使用者連續確認十三次。

---

## Repository 導覽

- [`specs/`](specs/) — Stage 1–6 的概念與判定規格。
- [`docs/storage-model.md`](docs/storage-model.md) — discussion workspace 與儲存模型。
- [`docs/runtime.md`](docs/runtime.md) — 流程狀態、回滾與 stale 規則。
- [`docs/input-contracts.md`](docs/input-contracts.md) — 每個 Stage 可以讀哪些資料。
- [`docs/`](docs/) — Stage execution contracts 與其他實作文件。

Schema、template 與真正可執行的 implementation 仍在開發中。

---

## 最短版

After-thinking 存在的原因很簡單：

很多真正有價值的想法，是在和 AI 討論的**途中**長出來的，不只存在最後答案裡。

普通摘要保存答案。

After-thinking 想保存的是這條路：

> 原本怎麼想 → 什麼挑戰了它 → 哪裡改變 → 哪些仍然是作者自己的 → 哪些來自 AI → 哪些還沒解完 → 下一步值得看什麼。

這條思考軌跡之後可以變成貼文、研究筆記、專案決策，也可以什麼都不公開。

**先把思考留下來，再決定要不要發。**
