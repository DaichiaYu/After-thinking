# After-thinking: Turn AI conversations into traceable thinking records

> Turn long conversations from ChatGPT, Claude, Gemini, and other AI tools into traceable records of how the thinking developed: which ideas came from you, which came from AI, what changed, and what you ultimately adopted.

If all you need is the conclusion, a normal summary is usually enough. After-thinking is for the cases where **how you got there** is worth keeping too.

It reconstructs where a discussion started, how it branched, where the reasoning materially changed, who introduced important ideas, whether you adopted them, and what remains unfinished. It only works from the source material you provide; thoughts that never appeared in the conversation are not treated as known facts.

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

1. Install the capture extension described below and save the conversation as source files.
2. Prepare a GitHub repository for the analysis results. A private repository is recommended for personal conversations. When a single captured conversation is uploaded through the extension, it can automatically create a `discussions/<discussion-id>/` workspace.
3. Let your AI read both this method repository and your analysis repository. Ask it to start from [`AGENTS.md`](AGENTS.md) and execute the current stage. If your AI tool can read GitHub repositories directly, provide the repositories; otherwise upload the required files. If it cannot write back to GitHub, save the generated files into the workspace yourself.
4. Progress is stored in `state.yaml`. In a later session, ask the AI to read it first and continue from the saved next action.

Gemini batch captures are first placed in `inbox/`; move the conversations you want to analyze into `discussions/`.

## Capture extension: After-thinking Capture

After-thinking Capture extracts conversations from the web versions of ChatGPT, Claude, and Gemini and saves them in the source format expected by After-thinking.

- **How it works**: Open a conversation and click the extension icon. It can scroll through the conversation and expand collapsed long messages.
- **Where it saves**: Upload to a GitHub repository you choose, or download the files only to your computer.
- **Gemini**: Multiple conversations can be captured in a batch, including original images and attached files where supported.
- **Installation**: It is currently loaded manually through Chrome Developer Mode and is not yet published in the Chrome Web Store.

After-thinking itself does **not** operate a central server that receives your conversation content.

Detailed instructions: [`apps/chrome-extension/README.md`](apps/chrome-extension/README.md)

## Where does your data go?

- The extension reads the conversation page itself and, for supported Gemini content, the original images or attached files. Apart from that, it connects only to GitHub when you choose repository upload.
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

> 把 ChatGPT、Claude、Gemini 上的長篇 AI 對話，整理成可追溯的思考紀錄：哪些想法是你的、哪些來自 AI、討論在哪裡轉了方向，以及你最後真正採納了什麼。

如果只需要結論，一般摘要通常就夠了。After-thinking 是給「怎麼想到這裡」也值得留下的時候用的。

它會根據對話紀錄，還原討論從哪裡開始、如何分支、在哪裡改變方向，以及重要觀點是由誰提出、你最後是否採納，還有哪些問題沒有走完。它只看得到你提供的內容；你在對話之外想過的事，它不會知道，也不會當成已知事實。

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

1. 安裝擷取擴充功能（見下一節），把對話存成檔案。
2. 準備一個放分析結果的 GitHub 倉庫，個人對話建議設為私人。用擴充功能擷取單段對話並上傳時，可以自動建立 `discussions/<討論編號>/` 工作區。
3. 讓 AI 同時讀這個方法倉庫和你的分析倉庫，請它從 [`AGENTS.md`](AGENTS.md) 開始執行目前階段。你的 AI 工具如果能直接讀 GitHub，就直接提供倉庫；不能的話，再把需要的檔案上傳給它。AI 不能直接寫回 GitHub 時，把它產出的檔案存回工作區即可。
4. 進度記在工作區的 `state.yaml`。下次換新對話或新工作階段時，先讓 AI 讀它，就能從上次停下的位置接著做。

批量擷取的 Gemini 對話會先放在 `inbox/`，挑出要分析的再移到 `discussions/`。

## 擷取擴充功能：After-thinking Capture

從 ChatGPT、Claude、Gemini 網頁版擷取對話，存成 After-thinking 需要的原始檔。

- **用法**：打開對話，按擴充功能圖示。會自動捲完整段對話、展開被摺疊的長訊息。
- **存到哪**：上傳到你自己的 GitHub 倉庫，或只下載到電腦。
- **Gemini**：可以一次批量擷取多段對話，也會保存支援的圖片和檔案原檔。
- **安裝**：目前用 Chrome 的開發人員模式手動載入，還沒上架 Chrome 線上應用程式商店。

After-thinking 本身沒有中央伺服器在背後接收你的對話內容。你可以只下載到本機，也可以選擇把檔案寫進自己的 GitHub 倉庫。

詳細步驟見 [`apps/chrome-extension/README.md`](apps/chrome-extension/README.md)。

## 資料去哪裡

- 擴充功能除了讀取對話網頁本身，以及支援的 Gemini 圖片／附件原檔之外，只有在你選擇上傳時才會連到 GitHub。
- GitHub 權限可以限制只開放你指定的那一個倉庫。
- 選「只下載檔案」時，擷取結果只存在你的電腦。
- 跑分析時，對話內容會交給你選用的 AI 工具處理。
- 這個公開倉庫只放方法、範本、程式碼與去識別化範例，不存你的私人對話。

## 補資料與重跑

之後補進漏掉的訊息或重跑分析時，既有的穩定編號會盡量保留，你做過的修正也會繼續生效；不需要因為中間多補一段內容，就把前面所有編號整批打掉重來。

規則細節見 [`docs/`](docs/) 和 [`specs/`](specs/)。

## 回饋

使用上的問題、錯誤回報或建議，歡迎開 [issue](../../issues)，或在 X 找我：[@daisyyu0214](https://x.com/daisyyu0214)。
