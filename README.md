# After-thinking: Turn AI conversations into traceable thinking records

> Turn long conversations from ChatGPT, Claude, Gemini, Grok, and other AI tools into traceable records of how the thinking developed: which ideas came from you, which came from AI, what changed, and what you ultimately adopted.

If all you need is the conclusion, a normal summary is usually enough. After-thinking is for the cases where **how you got there** is worth keeping too.

It reconstructs where a discussion started, how it branched, where the reasoning materially changed, who introduced important ideas, whether you adopted them, and what remains unfinished. The source can be the conversation you are already in, or captured conversation files. Thoughts that never appeared in the available source are not treated as known facts.

[繁體中文版](#繁體中文版)

## When is it useful?

- A long AI conversation contains useful ideas, but finding one again would mean rereading the whole thing.
- You want to revisit why a hypothesis was abandoned or why a project narrowed into its current direction.
- You want another AI session or collaborator to inherit not only the conclusion, but how the discussion got there.
- You later want to write or publish from the discussion while still knowing which ideas were yours and which came from AI.

## What does it produce?

After-thinking uses six stages, with one output file for each stage:

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

After-thinking currently provides the method specification, templates, examples, and a capture extension. There is not yet a one-click analysis program; the six stages are carried out by the AI tool you choose according to the repository rules.

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

## Feedback

Questions, bugs, and suggestions are welcome through [GitHub Issues](../../issues).

You can also find me on X: [@daisyyu0214](https://x.com/daisyyu0214).

---

# 繁體中文版

## After-thinking：把 AI 對話整理成可追溯的思考紀錄

> 把 ChatGPT、Claude、Gemini、Grok 上的長篇 AI 對話，整理成可追溯的思考紀錄：哪些想法是你的、哪些來自 AI、討論在哪裡轉了方向，以及你最後真正採納了什麼。

如果只需要結論，一般摘要通常就夠了。After-thinking 是給「怎麼想到這裡」也值得留下的時候用的。

它會根據對話紀錄，還原討論從哪裡開始、如何分支、在哪裡改變方向，以及重要觀點是由誰提出、你最後是否採納，還有哪些問題沒有走完。分析來源可以是你正在使用的這個對話框，也可以是另外擷取下來的對話檔案；沒有出現在可用來源裡的想法，它不會當成已知事實。

## 什麼時候用得上

- 長篇 AI 對話累積了很多有用內容，之後想找某個想法時，不想重新把整串對話讀一遍
- 回頭查當初為什麼放棄某個假設、為什麼縮小到現在這個方向
- 把一段討論交給另一個 AI 或合作者接手，連同「怎麼走到這裡」一起交出去
- 之後要寫成文章或其他內容時，仍然分得清哪些是自己的想法、哪些來自 AI

## 會產出什麼

分六個階段，每個階段產出一個檔案：

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

目前提供的是方法規格、範本、範例和擷取擴充功能，還沒有一鍵執行的分析程式；六個階段由你選用的 AI 按照倉庫規格執行。

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
- **對話清單（v0.8.0）**：搜尋、預覽擷取過的對話，依對話／擷取／最近標記時間排序，記錄未處理、已整理、不用整理、自訂標籤和備註，保存在 `inbox/labels.json`。
- **Grok（v0.8.0）**：擷取 `grok.com` 對話、可取得的原始時間與目前選擇的對話路線；不支援 X 站內的 Grok。
- **存到哪**：上傳到你自己的 GitHub 倉庫，或只下載到電腦。
- **附件（v0.8.0）**：四個平台都會嘗試把上傳的檔案、圖片和 AI 生成圖保存在 `source/attachments/`；讀不到的原檔會留下明確標記，不能保證每份附件都能取得。
- **Gemini**：可以一次批量擷取多段對話。
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
