# After-thinking

> **Turn long AI-assisted discussions into structured, traceable thinking records.**

After-thinking organizes a discussion without flattening it into a conventional summary. It reconstructs where the discussion started, how topics branched, which reasoning turns mattered, who introduced each important idea, what the author actually adopted, what remains uncertain, and what is still open.

[繁體中文版](#繁體中文版)

## What it does

After-thinking can reconstruct the original question and starting position; separate a long conversation into Topics and recurring branches; identify meaningful reasoning turns; distinguish author-, AI-, external-, and co-developed ideas; track author uptake; preserve uncertainty; identify supported recurring concepts; record unresolved questions and unfinished branches; derive traceable next-discussion directions when useful; preserve user corrections across reruns; and resume later from saved workflow state.

A complete reasoning record is already a valid endpoint. It does not need to become a post, article, or other public artifact.

## Six-stage workflow

1. **Scope & Origin** — source boundary, trigger, initial question, starting position, uncertainty.
2. **Topic Map & Reasoning Trajectory** — Topics, recurring source spans, and material reasoning turns.
3. **Provenance & Epistemic Status** — material Claims, origin, author uptake, current status, evidence, uncertainty.
4. **Cognitive Structure** — source-bounded recurring concepts, distinctions, and reasoning patterns.
5. **Discussion Gaps** — unresolved questions, missing evidence, tensions, unsupported hypotheses, unfinished branches.
6. **Next Discussion Directions** — traceable next questions derived from existing Gaps when useful.

Each file under [`specs/`](specs/) is the canonical contract for one Stage: inputs, object shape, legal values, execution exit criteria, and review policy.

The workflow stops when a Stage is sufficiently supported, not when every possible interpretation has been exhausted. Unclear provenance, co-development, low confidence, no supported recurring pattern, `gaps: []`, and no next direction can all be successful results.

## Review model

Stages 1–2 require explicit user confirmation. Stages 3–5 use risk-based review. Stage 6 requires no review by default.

`confirmed` always refers to the current result and requires explicit user confirmation. A substantive rerun clears old confirmation. Low confidence alone does not trigger review; review is reserved for material uncertainty that the user can plausibly resolve.

If the user materially corrects an interpretation during review, the correction is persisted before rerun so it cannot silently disappear on a later source revision.

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
   └─ analysis/
      ├─ 01-scope-origin.md
      ├─ 02-topic-map.md
      ├─ 03-claims.yaml
      ├─ 04-cognitive-structure.md
      ├─ 05-gaps.yaml
      └─ 06-next-directions.md
```

Raw source uses stable message identity plus a separate canonical `order`, so omitted material can be inserted later without renumbering IDs. `source/metadata.yaml.source_revision` is authoritative; `state.yaml` mirrors it for resume. Git history provides file revision history.

Analysis objects use stable IDs (`T`, `R`, `C`, `CS`, `G`, `D`) that survive ordinary reruns. Split/merge operations retire old identities rather than silently reusing them.

## Quick setup

After-thinking currently provides a workflow specification, runtime contracts, templates, and a filled example workspace; executable orchestration is still under development.

1. Select the repository that will hold the analysis.
2. Provide the conversation, notes, article, or mixed source material.
3. Create a stable discussion ID.
4. Initialize from [`templates/`](templates/).
5. Run the current Stage using its file under [`specs/`](specs/).
6. On a later session, read `state.yaml` and resume from its structured `next_action`.

See [`examples/simple-discussion/`](examples/simple-discussion/) for a complete small run.

## Capture extension

[`apps/chrome-extension/`](apps/chrome-extension/) is a Chrome extension (After-thinking Capture) that prepares the source material:

- **Capture** a ChatGPT, Claude, or Gemini conversation into `source/conversation.jsonl` and `source/metadata.yaml`, uploaded to your own private GitHub repository or downloaded. Gemini also supports batch capture, attachment files, and original message times.
- **Tag** a captured conversation yourself before any AI analysis: group it into topics or mark key points, turns, and notes, saved as `outline.json` next to `source/`. For long conversations, an AI of your choice can draft the tags first (`outline.ai.json`); you review them in the extension. Stages 1–2 build on the outline's segmentation instead of re-guessing it ([`docs/user-outline.md`](docs/user-outline.md)).

Languages: the extension's interface is Traditional Chinese only. Conversations in any language can be captured as-is. The site's own interface should be in Traditional Chinese, Simplified Chinese, or English for collapsed long messages to expand automatically. The tagging page's "possible turn" hints recognize Traditional Chinese, Simplified Chinese, English, and Japanese. See the [extension README](apps/chrome-extension/README.md) for details.

## Why use it?

Long AI conversations often contain more than a final answer: an original intuition, several branches, an AI-generated counterexample, a correction, a reframed question, an abandoned hypothesis, and conclusions that only make sense because of the route taken to reach them.

A normal summary is useful when only the result matters. After-thinking is useful when the path matters too.

The structured record can later support research or design work, decision review, hypothesis comparison, personal knowledge notes, handoff to another AI session or collaborator, or — if the author chooses — extraction into posts, articles, presentations, or other personal content. Those later uses do not control the reconstruction itself.

## Repository guide

- [`AGENTS.md`](AGENTS.md) — executor entry point and read order.
- [`specs/`](specs/) — canonical Stage contracts, inputs, and object schemas.
- [`docs/runtime.md`](docs/runtime.md) — cross-Stage runtime entry point.
- [`docs/state-semantics.md`](docs/state-semantics.md) — execution/review transitions and confirmation evidence.
- [`docs/source-format.md`](docs/source-format.md) — source identity, order, mutation, revision authority.
- [`docs/id-lifecycle.md`](docs/id-lifecycle.md) — stable analysis object identity across reruns.
- [`docs/user-fixes.md`](docs/user-fixes.md) — persistent correction lifecycle.
- [`docs/uncertainty-semantics.md`](docs/uncertainty-semantics.md) — uncertainty semantics.
- [`docs/output-format.md`](docs/output-format.md) — common output metadata.
- [`docs/analysis-boundary.md`](docs/analysis-boundary.md) — analysis/publication boundary.
- [`docs/workspace-write-contract.md`](docs/workspace-write-contract.md) — destination and write order.
- [`docs/user-outline.md`](docs/user-outline.md) — the author's optional pre-analysis outline and how Stages 1–2 use it.
- [`templates/`](templates/) — starter workspace files.
- [`examples/simple-discussion/`](examples/simple-discussion/) — filled end-to-end example.
- [`apps/chrome-extension/`](apps/chrome-extension/) — After-thinking Capture: capture and tag conversations.

---

# 繁體中文版

> **把長篇 AI 協作討論整理成有結構、可追溯、可以繼續使用的思考紀錄。**

After-thinking 整理的是討論本身，而不只是把聊天縮短：它重建從哪裡開始、後來分成哪些主題、哪裡真的發生推理轉折、重要觀點是誰提出、作者有沒有採納、哪些仍不確定，以及還有哪些地方沒有走完。

## 可以整理出什麼？

它可以重建原始問題與作者起點、拆分 Topic、整理 reasoning turns、區分作者／AI／外部來源／共同發展的觀點、追蹤作者對 AI 提議的反應、保存無法判斷與低 confidence 的內容、整理有證據支持的反覆概念與推理模式、找出討論缺口，並在確實有需要時整理下一次可繼續討論的方向。

使用者曾經修正過的判斷會保存成 runtime correction；之後重跑不能假裝沒看過。分析狀態也會保存，因此下一次可以從原本進度繼續。

## 六階段

1. 分析範圍＋討論起點
2. 主題地圖＋推理軌跡
3. 觀點來源＋認知狀態
4. 認知結構
5. 討論缺口
6. 下一次可繼續討論方向

`specs/` 裡六份文件分別是六個 Stage 的唯一正式 Stage 規格，包含輸入、輸出長相、合法值、停止條件與 review policy。

Stage 1–2 必須由使用者確認；Stage 3–5 採風險式確認；Stage 6 預設不需確認。舊的 confirmation 不會在實質重跑後自動沿用。

不確定是正式結果。來源不明、共同發展、低 confidence、沒有足夠證據形成反覆模式、沒有 gap，甚至沒有下一步，都可以正常完成。

## 儲存與續跑

After-thinking repository 保存方法本身，實際分析寫入使用者指定的 repository。Raw source 的 message ID 代表永久身分，`order` 另外代表閱讀順序，因此之後補進漏掉的前段或中段資料時，不需要重編既有 ID。

分析物件使用 `T / R / C / CS / G / D` 穩定 ID；一般重跑保留同一物件的 ID，真正 split / merge 時才退休舊 ID。`state.yaml` 保存目前 Stage、review、ID counters、conflict 與 structured `next_action`。

## 擷取擴充功能

[`apps/chrome-extension/`](apps/chrome-extension/) 是 Chrome 擴充功能 After-thinking Capture，負責準備原文：

- **擷取**：把 ChatGPT、Claude 或 Gemini 的對話存成 `source/conversation.jsonl` 和 `source/metadata.yaml`，上傳到你自己的私人 GitHub 倉庫，或下載到電腦。Gemini 另外支援批量擷取、附件原檔和原始時間。
- **標記**：在交給 AI 分析之前，自己先分主題，或標出關鍵、轉向和備註，存成 `source/` 旁邊的 `outline.json`。對話太長時，可以先請你喜歡的 AI 標一版（`outline.ai.json`），再到擴充功能裡檢查。第一、二階段會照這份骨架分析，不再自己重新切分（見 [`docs/user-outline.md`](docs/user-outline.md)）。

支援語言：擴充功能的介面目前只有繁體中文；對話內容任何語言都能照原文擷取；網站本身的介面設成繁體中文、簡體中文或英文時，摺疊的長訊息才能自動展開；標記頁的「可能轉向」提示認得繁體中文、簡體中文、英文和日文。詳細說明見[擴充功能的 README](apps/chrome-extension/README.md)。

## 為什麼需要它？

如果只需要結論，一般摘要通常就夠了；如果連「怎麼想到這裡」都值得留下，After-thinking 才有用。

整理後的結果可以拿來繼續研究或設計、回顧決策、比較假設變化、建立個人知識筆記、交接給下一個 AI session 或協作者；如果作者另外有需要，也可以再從裡面提取貼文、文章、簡報或其他個人內容。但這些都是後續用途，不會反過來控制 Stage 1–6 的分析。
