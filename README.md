# After-thinking (AT) — Turn AI conversations into reusable thinking assets

> Preserve, trace, and reuse the thinking developed through human–AI conversations, across models, sessions, and downstream workflows.

Valuable ideas, decisions, and reasoning often remain buried in long AI chats. After-thinking (AT) is an open-source, user-controlled workflow and data format for turning those conversations into reusable thinking assets. Keep the original evidence, mark what matters, and hand the material to another AI or tool without having to reconstruct the entire discussion from scratch.

A summary is useful when you only need the conclusion. AT is for when the path to that conclusion also matters: what changed, who introduced an idea, what the author adopted or rejected, and what remains unresolved. The same record can support project development, research, writing, or a later discussion.

[繁體中文版](#繁體中文版)

## How AT works

| Layer | What it produces | Why it matters |
| --- | --- | --- |
| Source | `source/conversation.jsonl`, metadata, available attachments | Preserve the original evidence independently of the chat platform |
| Annotation | `outline.json` | Record topics, key passages, reasoning turns, cross-topic links and author notes |
| Structured reconstruction | Stages 1–3 | Reconstruct scope, reasoning trajectory, provenance and author uptake |
| Derived analysis | Stages 4–6 | Identify supported cognitive patterns, gaps and useful follow-up directions |

The capture-and-annotation workflow is useful on its own: you can stop at the source and outline, share them with a coding agent, resume a discussion in another AI, or process them with your own tools. A deeper reconstruction is available when needed. The current official six-stage workflow remains sequential, with explicit dependencies; the later stages are not yet independently packaged skills.

AT does not provide a universal context-injection service or a one-click autonomous analysis engine. It provides portable files, a capture and annotation interface, and documented analysis contracts that an AI executor can follow.

## When is it useful?

- You want to turn a product discussion into reusable project context for a coding agent without treating every AI suggestion as a decision.
- You want to supply different tools with the same evidence: for example, [display-AT](https://github.com/DaichiaYu/display-AT) for writing, or an AI executor for research and development.
- A long AI conversation contains useful ideas, but finding one again would mean rereading the whole thing.
- You want to revisit why a hypothesis was abandoned or why a project narrowed into its current direction.
- You want another AI session or collaborator to inherit not only the conclusion, but how the discussion got there.
- You later want to write or publish from the discussion while still knowing which ideas were yours and which came from AI.

## Optional deeper reconstruction: the six-stage workflow

When you need a deeper record beyond the source and annotations, After-thinking's official analysis workflow uses six stages, with one output file for each stage:

1. **Scope & Origin** — what material is included, what the original question was, why the discussion started, and where you initially stood
2. **Topic Map & Reasoning Trajectory** — how the discussion divides into topics and where meaningful changes in direction occurred
3. **Provenance & Author Uptake** — whether an important idea came from you, AI, external material, or co-development; and whether you explicitly accepted it, reserved judgment, rejected it, or never responded
4. **Cognitive Structure** — recurring concepts, distinctions, and reasoning patterns that are actually supported within this discussion; written only when there is enough evidence
5. **Discussion Gaps** — unanswered questions, missing evidence, tensions, unsupported assumptions, and branches that stopped halfway
6. **Next Discussion Directions** — traceable next questions derived from existing gaps, only when useful

Uncertainty is a valid result. If something cannot be determined from the source, it is marked as uncertain rather than forced into a conclusion. Having no supported cognitive pattern, no gap, or no next direction can also be a successful outcome.

Stages 1–2 require explicit user confirmation before continuing. Later stages ask for input only when there is a material question the user can actually resolve. Corrections made by the user are persisted so they are not silently overwritten by later reruns.

A claim record can look like this:

```yaml
- id: C002
  claim: "Provenance and author uptake should be tracked separately."
  provenance:
    type: AI-introduced          # This idea was first introduced by AI
  author_uptake:
    status: Explicitly accepted  # The author explicitly accepted it
```

Who introduced an idea and whether you accepted it are two different questions.

See the complete small example in [`examples/simple-discussion/`](examples/simple-discussion/).

## Getting started

For capture, annotation and handoff, use [After-thinking Capture](apps/chrome-extension/) and the [responsive annotation workspace](apps/mobile-web/). Save the source and outline to your own repository or local files. Hand off only the material your next task needs; no six-stage analysis is required for this use.

If you want the official deeper reconstruction, the six stages are carried out by the AI tool you choose according to the repository rules.

You can start in **two ways**:

### Option A — Start directly from the conversation you are already in

If you have already discussed a topic with your AI and the relevant conversation is still available in the current chat, you can simply ask that AI to use this repository's method and write the analysis into a repository you specify.

For example:

> Read the After-thinking repository, follow its method, and organize this conversation into my specified analysis repository. Start from `AGENTS.md`.

**Advantages**
- No export or capture step is required.
- Fastest way to start while the discussion context is still available.
- Useful when you want to organize a conversation immediately after finishing it.

**Limitations**
- The AI may not have reliable access to the entire earlier conversation if the chat is extremely long, truncated, or moved across sessions.
- The original source is less portable and less reproducible if you later want another AI or collaborator to rerun the analysis.
- If the AI cannot write to your GitHub repository directly, you still need to save the generated files yourself.

### Option B — Capture or export the conversation first *(recommended for long-term use)*

Use After-thinking Capture or another export method to save the conversation as source files, then let your AI analyze those files according to this repository.

**Advantages**
- Creates a stable source snapshot that can be reviewed, rerun, and handed to another AI later.
- Better for long conversations, source revisions, missing-message recovery, and repeated analysis.
- Makes it easier to audit what the analysis was actually based on.

**Limitations**
- Requires an extra capture/download/upload step before analysis.
- Slightly more setup than starting directly in the current chat.

In either case:

1. Prepare a GitHub repository for the analysis results. A private repository is recommended for personal conversations.
2. Let your AI read this method repository and your analysis repository. Ask it to start from [`AGENTS.md`](AGENTS.md) and execute the current stage.
3. Progress is stored in `state.yaml`. In a later session, ask the AI to read it first and continue from the saved next action.

When a single captured conversation is uploaded through the extension, it can automatically create a `discussions/<discussion-id>/` workspace. Gemini batch captures are first placed in `inbox/`; move the conversations you want to analyze into `discussions/`.

## Capture extension: After-thinking Capture

After-thinking Capture extracts conversations from the web versions of ChatGPT, Claude, Gemini, and Grok and saves them in the source format expected by After-thinking.

- **How it works**: Open a conversation and click the extension icon. It can scroll through the conversation and expand collapsed long messages.
- **Tagging and AI-assisted review (v0.8.0)**: Preview all your questions before choosing multiple topics, one topic, or “no need to organize.” Mark key messages or ranges, reasoning turns, cross-topic relevance, and notes. The tagging page itself does not call an AI; optionally import an AI draft (`outline.ai.json`), review it, then save `outline.json`. Stages 1–2 build on the saved outline ([`docs/user-outline.md`](docs/user-outline.md)).
- **Short AI-draft prompts (v0.8.1)**: When an AI has GitHub access, the copied prompt only points it to this conversation and a full rule file, `guides/outline-ai.md`, created in **your analysis repository** by the extension. If you download the request instead, the same rules and the numbered conversation are included in one Markdown file. The canonical source for both is [`apps/chrome-extension/outline-ai-guide.md`](apps/chrome-extension/outline-ai-guide.md); this changes how the prompt is delivered, not the `outline.ai.json` format or the review process.
- **Conversation list (v0.8.0)**: Search and preview captured discussions; sort by conversation, capture, or last-tagged time; record to-do/done/skip status, custom labels, and notes in `inbox/labels.json`.
- **Grok (v0.8.0)**: Capture conversations at `grok.com`, including available original times and the selected conversation path. Grok inside X is not supported.
- **Where it saves**: Upload to a GitHub repository you choose, or download the files only to your computer.
- **Attachments (v0.8.0)**: All four platforms attempt to save uploaded files, images, and AI-generated images to `source/attachments/`. Files that cannot be recovered are explicitly marked; recovery is not guaranteed.
- **Gemini**: Multiple conversations can be captured in a batch.
- **Installation**: It is currently loaded manually through Chrome Developer Mode and is not yet published in the Chrome Web Store.

After-thinking itself does **not** operate a central server that receives your conversation content.

Detailed instructions: [`apps/chrome-extension/README.md`](apps/chrome-extension/README.md)

## Where does your data go?

- The extension reads the conversation page itself and the original images and attached files in the conversation. Apart from that, it connects only to GitHub when you choose repository upload.
- GitHub access can be limited to the single repository you choose.
- If you choose **download only**, the captured files stay on your computer.
- During analysis, the conversation is processed by whichever AI tool you choose to use.
- This public repository contains only the method, templates, code, and de-identified examples — not your conversations.

## Adding missing source or rerunning

If you later add omitted messages or rerun an analysis, existing stable IDs are preserved where possible, and user corrections remain in effect. Adding missing material does not require blindly renumbering everything that already exists.

Implementation details and formal rules live in [`docs/`](docs/) and [`specs/`](specs/).

## Browser annotation workspace (mobile and desktop)

The [responsive browser tagging editor](apps/mobile-web/) is a static GitHub Pages client for the existing AT annotation format. It is intended to connect directly to a **repository selected by each user**, with GitHub read/write permission granted in that user's browser. The published AT repository contains **only application code**, not private conversation records or repository-specific credentials.

It preserves the captured conversation's original title, supports expandable question previews, and edits the same `outline.json` v6 records **without installing the Chrome extension**. On desktop, the browser provides a three-column workbench with topic management, source search, inline message marking, a contextual inspector, AI review, key ranges, and an export summary; on phones, it keeps the touch-oriented layout. Captured attachment metadata and authorized previews remain tied to each original message. See the [mobile editor setup, privacy model, and limitations](docs/mobile-web.md). The Pages link is provided only after deployment completes. The article-generation project remains separate.


## Feedback

Questions, bugs, and suggestions are welcome through [GitHub Issues](../../issues).

You can also find me on X: [@daisyyu0214](https://x.com/daisyyu0214).

---

# 繁體中文版

## After-thinking（AT）：讓 AI 對話成為可重複利用的思考資產

> 讓人類與 AI 共同產生的思考過程，成為可保存、可追溯、可重複利用的資料資產，跨模型、跨工作階段、跨不同應用延續使用。

有價值的想法、決策與推理，常常散落在冗長的 AI 對話裡。After-thinking（AT）是一套開源、由使用者掌控的工作流與資料格式，將這些對話轉化成可以反覆利用的思考資產。保留原始證據，標出重要內容，再交給其他 AI 或工具使用，不必每次重新解釋整段討論。

如果只需要結論，一般摘要通常就夠了。AT 更關心「怎麼想到這裡」：討論在哪裡轉向、誰提出觀點、作者採納或拒絕了什麼，以及還有哪些問題沒有解決。同一份資料可以用於專案開發、研究、文章創作或延續討論。

## AT 怎麼運作

| 資料層級 | 產出 | 用途 |
| --- | --- | --- |
| 原始資料 | `source/conversation.jsonl`、來源資訊、可取得的附件 | 脫離原平台保存原始證據 |
| 標記資料 | `outline.json` | 記錄主題、關鍵段落、推理轉向、跨主題關聯與作者備註 |
| 結構化思考紀錄 | 第 1–3 階段 | 還原討論起點、推理軌跡、觀點來源與採納狀態 |
| 衍生分析 | 第 4–6 階段 | 分析有證據支持的認知模式、討論缺口與後續方向 |

擷取與標記本身就是一套可獨立使用的完整工作流。你可以在保存原文與標記後停止，直接交給程式開發 Agent、換一個 AI 接續討論，或用自己的工具處理。需要更深入的結構化資料時，再執行分析。目前官方六階段工作流仍依序執行，具有明確的階段依賴；後三階段尚未封裝成可獨立呼叫的技能模組。

AT 目前提供的是可攜式檔案、擷取與標記介面，以及供 AI 執行的分析規格，並不是通用的自動上下文注入服務，也沒有一鍵自主分析引擎。

## 什麼時候用得上

- 把產品討論交給程式開發 Agent 接手，不必重新說明背景，也不必把每個 AI 建議都當成已確定需求。
- 同一份思考資料交給不同工具使用，例如 [display-AT](https://github.com/DaichiaYu/display-AT) 轉成文章，或交給 AI 執行研究與開發任務。
- 長篇 AI 對話累積了很多有用內容，之後想找某個想法時，不想重新把整串對話讀一遍
- 回頭查當初為什麼放棄某個假設、為什麼縮小到現在這個方向
- 把一段討論交給另一個 AI 或合作者接手，連同「怎麼走到這裡」一起交出去
- 之後要寫成文章或其他內容時，仍然分得清哪些是自己的想法、哪些來自 AI

## 選用的深度整理：六階段分析工作流

需要比原文與標記更深入的思考紀錄時，可以執行 AT 官方六階段分析工作流，每個階段產出一個檔案：

1. **分析範圍＋討論起點**：這段分析涵蓋哪些內容、一開始想問什麼、討論為什麼開始，以及你原本站在哪裡
2. **主題地圖＋推理軌跡**：分成哪些主題，哪幾處真的改變了方向
3. **觀點來源＋採納狀態**：每個重要觀點來自你、AI、外部資料，還是一起發展出來的；你最後是明確接受、保留、拒絕，還是沒有回應
4. **認知結構**：整理這段討論中反覆出現的概念、區分方式和推理模式；只有證據足夠時才寫
5. **討論缺口**：沒回答的問題、缺的證據、彼此矛盾或尚未支撐的地方，以及走到一半的分支
6. **下一次可繼續討論方向**：從既有缺口延伸出可以接著討論的問題；有需要才寫

判斷不出來時會直接標成不確定，這也算完成。沒有足夠證據形成認知結構、沒有缺口，甚至沒有下一步，同樣都可以是正常結果，不需要為了把欄位填滿而硬生內容。

第 1、2 階段要你確認後才往下走；之後的階段只在出現你能回答的實質疑問時才問你。你修正過的判斷會被保存，之後重跑不會悄悄被蓋掉。

產出的樣子（範例中的一條觀點紀錄，節錄）：

```yaml
- id: C002
  claim: "Provenance and author uptake should be tracked separately."
  provenance:
    type: AI-introduced          # 這個觀點是 AI 先提出的
  author_uptake:
    status: Explicitly accepted  # 你明確接受了
```

這裡刻意把「誰先提出這個觀點」和「你後來有沒有接受」分開記錄。AI 先提出，不代表它就自動算成你的立場；你後來明確採納，也應該另外記錄。

完整的小型範例見 [`examples/simple-discussion/`](examples/simple-discussion/)。

## 開始使用

如果只需要擷取、標記及交接，可以使用 [After-thinking Capture 擴充功能](apps/chrome-extension/) 與[響應式標記工作台](apps/mobile-web/)，將原文與標記保存到自己的倉庫或本機，再依下一個任務的需求交接資料，不必執行六階段分析。

如果需要官方的深度整理流程，六個階段由你選用的 AI 按照倉庫規格執行。

你有 **兩種開始方式**：

### 方法 A：直接從現在這個對話開始

如果你已經和 AI 討論完某個主題，而且相關內容仍然在目前這個對話裡，可以直接請現在這個 AI 讀取 After-thinking 倉庫，按照裡面的規格整理目前對話，並把結果寫到你指定的分析倉庫。

例如可以直接說：

> 請讀取 After-thinking 倉庫，按照裡面的方式整理目前這段對話，寫入我指定的分析倉庫，從 `AGENTS.md` 開始執行。

**優點**
- 不需要先下載或擷取對話，最快可以直接開始。
- 剛討論完就能立刻整理，操作成本最低。
- 很適合單次討論結束後，順手把思考過程保存下來。

**限制**
- 如果對話非常長、較早內容已經超出 AI 當下能可靠讀取的範圍，分析來源可能不完整。
- 之後如果想換另一個 AI、換工作階段或重新驗證，比較不容易完整重現當時的原始來源。
- 如果目前使用的 AI 不能直接寫入 GitHub，仍需要自己把它產出的檔案存回分析倉庫。

### 方法 B：先擷取或匯出對話，再開始分析（長期使用較推薦）

先用 After-thinking Capture 或其他匯出方式把對話保存成檔案，再讓 AI 根據這些檔案執行 After-thinking。

**優點**
- 有一份固定的原始對話，可以反覆檢查、重跑，也能換另一個 AI 接手。
- 對超長對話、之後補漏訊息、版本更新或重新分析更穩定。
- 比較容易確認「這次分析到底是根據哪些原始內容做的」。

**限制**
- 分析前多一道擷取、下載或上傳步驟。
- 比直接在原對話裡開始稍微麻煩一點。

不論用哪一種方式：

1. 準備一個放分析結果的 GitHub 倉庫，個人對話建議設為私人。
2. 讓 AI 讀這個方法倉庫和你的分析倉庫，請它從 [`AGENTS.md`](AGENTS.md) 開始執行目前階段。
3. 進度記在工作區的 `state.yaml`。下次換新對話或新工作階段時，先讓 AI 讀它，就能從上次停下的位置接著做。

用擴充功能擷取單段對話並上傳時，可以自動建立 `discussions/<討論編號>/` 工作區。批量擷取的 Gemini 對話會先放在 `inbox/`，挑出要分析的再移到 `discussions/`。

## 擷取擴充功能：After-thinking Capture

從 ChatGPT、Claude、Gemini、Grok 網頁版擷取對話，存成 After-thinking 需要的原始檔。

- **用法**：打開對話，按擴充功能圖示。會自動捲完整段對話、展開被摺疊的長訊息。
- **標記與 AI 建議審查（v0.8.0）**：先預覽自己問過的問題，再選「分成多個主題」、「一直在聊同一件事」或「這篇不用整理」。可以標出關鍵訊息／段落、推理轉向、也跟其他主題相關的訊息與備註。標記頁本身不會呼叫 AI；也可以先請外部 AI 提供 `outline.ai.json` 草稿，逐項審查後存成 `outline.json`。第一、二階段會依保存的標記骨架分析（見 [`docs/user-outline.md`](docs/user-outline.md)）。
- **精簡 AI 草稿指令（v0.8.1）**：AI 能讀寫 GitHub 時，複製的指令只提供這段對話的位置和必要辨識資料，完整規則由擴充功能寫入**你的分析資料倉庫** `guides/outline-ai.md`，供 AI 讀取；若用下載檔案方式，規則和編號後的完整對話會放在同一份 Markdown。兩種方式共用的原始規則在 [`apps/chrome-extension/outline-ai-guide.md`](apps/chrome-extension/outline-ai-guide.md)。這次改的是指令傳遞方式，沒有改變 `outline.ai.json` 格式或審查流程。
- **對話清單（v0.8.0）**：搜尋、預覽擷取過的對話，依對話／擷取／最近標記時間排序，記錄未處理、已整理、不用整理、自訂標籤和備註，保存在 `inbox/labels.json`。
- **Grok（v0.8.0）**：擷取 `grok.com` 對話、可取得的原始時間與目前選擇的對話路線；不支援 X 站內的 Grok。
- **存到哪**：上傳到你自己的 GitHub 倉庫，或只下載到電腦。
- **附件（v0.8.0）**：四個平台都會嘗試把上傳的檔案、圖片和 AI 生成圖保存在 `source/attachments/`；讀不到的原檔會留下明確標記，不能保證每份附件都能取得。
- **批次擷取**：支援 Gemini 側邊欄，以及實驗性的 ChatGPT 專案批次擷取（一次一個專案）；ChatGPT 網頁內部介面可能改版，仍需實機驗證。
- **安裝**：目前用 Chrome 的開發人員模式手動載入，還沒上架 Chrome 線上應用程式商店。

After-thinking 本身沒有中央伺服器在背後接收你的對話內容。你可以只下載到本機，也可以選擇把檔案寫進自己的 GitHub 倉庫。

詳細步驟見 [`apps/chrome-extension/README.md`](apps/chrome-extension/README.md)。

## 資料去哪裡

- 擴充功能除了讀取對話網頁本身，以及對話裡的圖片／附件原檔之外，只有在你選擇上傳時才會連到 GitHub。
- GitHub 權限可以限制只開放你指定的那一個倉庫。
- 選「只下載檔案」時，擷取結果只存在你的電腦。
- 跑分析時，對話內容會交給你選用的 AI 工具處理。
- 這個公開倉庫只放方法、範本、程式碼與去識別化範例，不存你的私人對話。

## 補資料與重跑

之後補進漏掉的訊息或重跑分析時，既有的穩定編號會盡量保留，你做過的修正也會繼續生效；不需要因為中間多補一段內容，就把前面所有編號整批打掉重來。

規則細節見 [`docs/`](docs/) 和 [`specs/`](specs/)。

## 回饋

使用上的問題、錯誤回報或建議，歡迎開 [issue](../../issues)，或在 X 找我：[@daisyyu0214](https://x.com/daisyyu0214)。

## 網頁標記工作台（手機與電腦）

AT 響應式標記網頁（手機與電腦皆可使用、不必安裝插件）會部署在 AT 的 GitHub Pages，讓使用者自行連接自己的對話資料倉庫。公開倉庫只放程式，不預設私人倉庫或儲存對話及憑證；正式部署方式及使用限制請見[手機版說明](docs/mobile-web.md)。

