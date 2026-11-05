# After-thinking — Turn AI conversations into traceable thinking records

> **Turn long conversations from ChatGPT, Claude, Gemini, and other AI tools into structured records of how the thinking actually developed: what came from you, what came from AI, what changed, and what you ultimately adopted.**
>
> **中文：**把 ChatGPT、Claude、Gemini 等工具上的長篇 AI 對話，整理成可追溯的思考紀錄：哪些想法是你的、哪些來自 AI、討論在哪裡轉了方向，以及你最後真正採納了什麼。

If all you need is the final answer, a normal summary is usually enough. **After-thinking is for the cases where the path matters too.**

It reconstructs where a discussion started, how it branched, where the reasoning materially changed, who introduced important ideas, whether the author adopted them, and what remains unfinished. It only works from the material you provide; thoughts that never appeared in the source are not inferred as facts.

> **中文：**如果只需要結論，一般摘要通常就夠了。After-thinking 是給「怎麼想到這裡」也值得留下的時候用的。它會根據對話紀錄，還原討論從哪裡開始、如何分支、在哪裡改變方向，以及重要觀點是由誰提出、你最後是否採納，還有哪些問題沒有走完。它只看得到你提供的內容，不會把對話之外的想法當成已知事實。

This makes it useful for research, knowledge work, decision review, and long-running human–AI collaboration where **idea provenance（觀點來源）** and the reasoning path matter.

## When is it useful?｜什麼時候用得上

- **A long AI conversation contains useful ideas, but finding them again means rereading the whole thing.**  
  **中文：**長篇 AI 對話累積了很多有用內容，之後想找某個想法時，不想重新把整串對話讀一遍。
- **You want to revisit why a hypothesis was abandoned or why a project narrowed into its current direction.**  
  **中文：**回頭查當初為什麼放棄某個假設、為什麼縮小到現在這個方向。
- **You want another AI session or collaborator to inherit not only the conclusion, but how the discussion got there.**  
  **中文：**把一段討論交給另一個 AI 或合作者接手，連同「怎麼走到這裡」一起交出去。
- **You later want to write or publish from the discussion without losing track of which ideas were yours and which came from AI.**  
  **中文：**之後要寫成文章或其他內容時，仍然分得清哪些是自己的想法、哪些來自 AI。

## What does it produce?｜會產出什麼

After-thinking uses six stages. Each stage produces one analysis file.

1. **Scope & Origin｜分析範圍＋討論起點**  
   What material is included, what triggered the discussion, what the original question was, and where the author initially stood.  
   **中文：**這段分析涵蓋哪些內容、一開始想問什麼、討論為什麼開始，以及你原本站在哪裡。

2. **Topic Map & Reasoning Trajectory｜主題地圖＋推理軌跡**  
   How the discussion divides into topics and where meaningful changes in direction occurred.  
   **中文：**討論分成哪些主題，以及哪幾處真的改變了方向。

3. **Provenance & Author Uptake｜觀點來源＋採納狀態**  
   Whether an important idea came from the author, AI, external material, or co-development — and whether the author explicitly accepted it, reserved judgment, rejected it, or never responded.  
   **中文：**每個重要觀點來自你、AI、外部資料，還是一起發展出來的；你最後是明確接受、保留、拒絕，還是沒有回應。

4. **Cognitive Structure｜認知結構**  
   Recurring concepts, distinctions, and reasoning patterns that are actually supported within this discussion. This stage is written only when there is enough evidence.  
   **中文：**整理這段討論中反覆出現的概念、區分方式和推理模式；只有證據足夠時才寫，不會硬湊人格分析。

5. **Discussion Gaps｜討論缺口**  
   Unanswered questions, missing evidence, tensions, unsupported assumptions, and branches that stopped halfway.  
   **中文：**沒回答的問題、缺的證據、彼此矛盾或尚未支撐的地方，以及走到一半的分支。

6. **Next Discussion Directions｜下一次可繼續討論方向**  
   Traceable next questions derived from existing gaps, only when useful.  
   **中文：**從既有缺口延伸出下一次可以接著討論的問題；沒有必要時可以不產生。

Uncertainty is a valid result. If something cannot be determined from the source, it is marked as uncertain rather than forced into a conclusion. Having no supported cognitive pattern, no gap, or no next direction can also be a successful outcome.

> **中文：**判斷不出來時會直接標成不確定，這也算完成。沒有足夠證據形成認知結構、沒有缺口，甚至沒有下一步，都可以是正常結果，不需要為了把欄位填滿而硬生內容。

Stages 1–2 require explicit user confirmation before continuing. Later stages ask for input only when there is a material question the user can actually resolve. Corrections made by the user are persisted so they are not silently overwritten by later reruns.

> **中文：**第 1、2 階段要你確認後才往下走；後面的階段只在出現你能回答的實質疑問時才問你。你修正過的判斷會被保存，之後重跑不會悄悄蓋掉。

### A small example｜小型範例

One claim record can look like this:

```yaml
- id: C002
  claim: "Provenance and author uptake should be tracked separately."
  provenance:
    type: AI-introduced          # This idea was first introduced by AI
  author_uptake:
    status: Explicitly accepted  # The author explicitly accepted it
```

The point is simple: **who introduced an idea and whether you accepted it are two different questions.**

> **中文：**這裡刻意把「誰先提出這個觀點」和「你後來有沒有接受」分開記錄。AI 先提出，不代表它就自動算成你的立場；反過來，你明確採納後，也不能只因為起點來自 AI 就忽略你的接受狀態。

See the complete small example in [`examples/simple-discussion/`](examples/simple-discussion/).

## Getting started｜開始使用

After-thinking currently provides the method specification, templates, examples, and a capture extension. **There is not yet a one-click analysis program**; the six analysis stages are carried out by the AI tool you choose according to the repository rules.

> **中文：**目前已經有方法規格、範本、完整範例與對話擷取擴充功能，但還沒有「按一下就自動跑完六階段」的分析程式。六個階段仍由你選用的 AI 按照倉庫規格執行。

1. **Capture the conversation.** Install the browser extension described below and save the conversation as source files.  
   **中文：**先用下面的瀏覽器擴充功能把對話存成原始檔。

2. **Prepare an analysis repository.** A private GitHub repository is recommended for personal conversations. When a single captured discussion is uploaded through the extension, it can create a `discussions/<discussion-id>/` workspace automatically.  
   **中文：**準備一個存放分析結果的 GitHub 倉庫，個人對話建議設為私人。用擴充功能上傳單段對話時，可以自動建立 `discussions/<討論編號>/` 工作區。

3. **Let your AI read both repositories.** Ask it to start from [`AGENTS.md`](AGENTS.md) and execute the current stage. If your AI tool can read GitHub repositories directly, provide the repositories; otherwise upload the required files. If it cannot write back to GitHub, save its generated files into the workspace yourself.  
   **中文：**讓 AI 同時讀這個方法倉庫和你的分析倉庫，從 [`AGENTS.md`](AGENTS.md) 開始執行目前階段。你的 AI 工具如果能直接讀 GitHub，就直接提供倉庫；不能的話，再把需要的檔案上傳給它。AI 不能直接寫回 GitHub 時，把它產出的檔案存回工作區即可。

4. **Resume from saved state.** Progress is stored in `state.yaml`. In a later session, ask the AI to read it first and continue from the structured next action.  
   **中文：**進度會記在 `state.yaml`。下次換新對話或新工作階段時，先讓 AI 讀它，就能從上次停下的位置接著做。

For Gemini batch capture, conversations are first placed in `inbox/`; move the ones you want to analyze into `discussions/`.

> **中文：**Gemini 批量擷取的對話會先放在 `inbox/`，挑出真正要分析的內容後再移到 `discussions/`。

## After-thinking Capture｜對話擷取擴充功能

**After-thinking Capture** captures conversations from the web versions of ChatGPT, Claude, and Gemini and saves them in the source format expected by After-thinking.

- **How it works｜怎麼用：** Open a conversation and click the extension icon. It can scroll through the full conversation and expand collapsed long messages.  
  **中文：**打開對話後按擴充功能圖示，它會嘗試捲完整段對話並展開被摺疊的長訊息。
- **Where it saves｜存到哪：** Upload to a GitHub repository you choose, or download files only to your computer.  
  **中文：**可以上傳到你自己指定的 GitHub 倉庫，也可以只下載到電腦。
- **Gemini batch capture｜Gemini 批量擷取：** Multiple conversations can be captured in a batch, including original images and attached files where supported.  
  **中文：**可以一次擷取多段 Gemini 對話，並保存對話中的圖片與檔案原檔。
- **Installation｜安裝：** It is currently loaded manually through Chrome Developer Mode and is not yet published in the Chrome Web Store.  
  **中文：**目前使用 Chrome 開發人員模式手動載入，還沒上架 Chrome 線上應用程式商店。

**After-thinking itself does not operate a central server that receives your conversation content.**

> **中文：**After-thinking 本身沒有一個中央伺服器在背後接收你的對話內容。你可以只下載到本機，也可以選擇把檔案寫進自己的 GitHub 倉庫。

Detailed instructions: [`apps/chrome-extension/README.md`](apps/chrome-extension/README.md)

## Where does your data go?｜資料去哪裡

- The extension reads the conversation page itself and, for supported Gemini content, the original images or attached files. Apart from that, it connects only to GitHub when you choose repository upload.  
  **中文：**擴充功能除了讀取對話網頁本身，以及支援的 Gemini 圖片／附件原檔之外，只有在你選擇上傳時才會連到 GitHub。
- GitHub access can be limited to the single repository you choose.  
  **中文：**GitHub 權限可以限制只開放你指定的那一個倉庫。
- If you choose **download only**, the captured files stay on your computer.  
  **中文：**選「只下載檔案」時，擷取結果只存在你的電腦。
- During analysis, the conversation is processed by whichever AI tool you choose to use.  
  **中文：**真正跑分析時，對話內容會交給你自己選用的 AI 工具處理。
- This public repository contains only the method, templates, code, and de-identified examples — **not your conversations**.  
  **中文：**這個公開倉庫只放方法、範本、程式碼與去識別化範例，不會存放你的私人對話。

## Adding missing source or rerunning｜補資料與重跑

If you later add omitted messages or rerun an analysis, existing stable IDs are preserved where possible, and user corrections remain in effect. The system is designed so that adding missing material does not require blindly renumbering everything that already exists.

> **中文：**之後補進漏掉的訊息或重跑分析時，既有的穩定編號會盡量保留，你做過的修正也會繼續生效；不需要因為中間多補一段內容，就把前面所有編號整批打掉重來。

Implementation details and formal rules live in [`docs/`](docs/) and [`specs/`](specs/).

## Repository guide｜倉庫導覽

- [`AGENTS.md`](AGENTS.md) — executor entry point and reading order｜AI 執行入口與閱讀順序
- [`specs/`](specs/) — canonical stage specifications｜六階段正式規格
- [`docs/`](docs/) — runtime, state, uncertainty, IDs, corrections, and other implementation rules｜執行狀態、不確定性、編號、修正等細節
- [`templates/`](templates/) — starter workspace files｜工作區起始範本
- [`examples/simple-discussion/`](examples/simple-discussion/) — complete small example｜完整的小型示範
- [`apps/chrome-extension/`](apps/chrome-extension/) — After-thinking Capture extension｜對話擷取擴充功能

## Feedback｜回饋

Questions, bugs, and suggestions are welcome through [GitHub Issues](../../issues).

You can also find me on X: [@daisyyu0214](https://x.com/daisyyu0214)

> **中文：**使用上的問題、錯誤回報或建議，都歡迎直接開 GitHub Issue；也可以在 X 找我。
