# 這個倉庫是什麼

這是用 After-thinking Capture（Chrome 擴充功能）擷取下來的 AI 對話原文，私人存放。
整理方法來自 After-thinking：https://github.com/DaichiaYu/After-thinking

> 這個檔案由擴充功能自動產生，擴充功能更新時會一起更新。想自己寫指引的話，刪掉第一行的標記，之後就不會再被覆蓋。

## 資料夾

```
AGENTS.md                      這份地圖
inbox/
  index.jsonl                  擷取紀錄：每擷取一次一行（從這裡開始找）
  2026-10/                     依「對話開始的月份」分的資料夾
    gemini-<對話編號>/
      source/
        conversation.jsonl     對話原文，一行一則訊息
        metadata.yaml          擷取資訊（平台、網址、時間、擷取方式、警告）
        attachments/           對話裡的圖片和檔案原檔（有抓到才會有）
      outline.json             使用者自己做的標記：主題分組或關鍵（有標才會有）
      outline.ai.json          AI 先標的建議，給使用者審閱用（有請 AI 標才會有）
  undated/                     找不到原始時間的對話
  gemini-<對話編號>/           較早版本擷取的對話（還沒依月份分）
{{ROOT}}<討論編號>/            已經挑出來、要用 After-thinking 分析的討論
  source/                      同上
  outline.json                 同上（有標才會有）
  outline.ai.json              同上（有請 AI 標才會有）
  state.yaml                   分析進度
  corrections.yaml             使用者的修正
  analysis/                    分析結果
```

- `inbox/` 是還沒整理的原始擷取；`{{ROOT}}` 是挑出來正式分析的。同一段對話可能兩邊都有。
- 舊版擷取的對話直接放在 `inbox/gemini-<編號>/`，沒有月份資料夾；以 `index.jsonl` 的 `folder` 欄位為準。

## inbox/index.jsonl（擷取紀錄）

每行一個 JSON：

| 欄位 | 意思 |
|---|---|
| `platform` | `gemini`、`chatgpt` 或 `claude` |
| `conversation_id` | 平台上的對話編號（網址裡那段） |
| `title` | 對話標題 |
| `url` | 原始對話網址 |
| `folder` | 存放位置（相對於倉庫根目錄） |
| `mode` | `batch`（批量）或 `manual_click`（單段） |
| `started_at` / `updated_at` | 對話開始／最後一則的原始時間（UTC，找不到是 null） |
| `captured_at` | 擷取的時間 |
| `messages` / `author_messages` / `chars` | 訊息數、使用者訊息數、總字數 |
| `attachments` / `attachments_saved` / `attachments_missing` | 附件數、有存原檔的、沒拿到原檔的 |
| `warnings` | 擷取時的警告，例如 `timed_out`、`possible_gaps`、`truncated_messages` |
| `outline_updated_at` / `outline_mode` | 使用者最後一次儲存標記的時間、標記方式（有標才會有） |

同一段對話可能有好幾行（例如先批量進 inbox，之後又單段擷取進討論資料夾）。

## outline.json（使用者的標記）

使用者在擴充功能的「標記對話」頁自己做的。除了 `turn_hints`，**都是使用者的判斷，不是 AI 的推測**。整理這段對話時，有這個檔案就先讀它，照它的分組和重點走。

- `mode`：`multi_topic`（聊了好幾件事，看 `topics`）或 `single_topic`（一直在聊同一件事，看 `single_topic`）。兩種都可能有 `key_points`。
- `topics[]`：`id`（A、B…）、`name`、`note`（使用者的補充說明）、`messages`（屬於這個主題的 `message_id`，照順序）。AI 回覆預設和上一句使用者發言同組，使用者也可以把某則 AI 回覆另外分到別組。
- `untagged`：還沒分到主題的訊息。
- `key_points[]`：使用者逐則標的關鍵，`speaker` 分出是使用者說的（`author`）還是 AI 說的（`assistant`）。
- `key_ranges[]`：使用者整段標成關鍵的段落（`from_message_id`、`to_message_id`、`messages`）。意思是「這一整段是核心」，不是段落裡每一句都逐句判斷過。
- `turns[]`：**使用者確認過**的轉向（`source: user`）。`hinted_by` 是確認前程式提示的理由（空的代表使用者自己標的）。
- `turn_hints[]`：程式提示、**使用者還沒確認**的可能轉向（`message_id`、`reasons`）。`reasons` 有 `keyword`（使用者的用詞，例如「其實」「不對」）和 `ai_response`（緊接著的 AI 回覆開頭像在修正方向）。只是提示，不能當成使用者的判斷。
- `dismissed_auto_turns[]`：程式提示過、使用者說不是轉向的。
- `notes[]`：使用者寫在某則訊息上的備註。
- `summary`：同樣內容的文字版，編號是依 `order` 排序後的位置（001 是第一則）。
- **每一項的來源**（v4 起）：`origin` 是 `user`（使用者自己標的）、`ai_confirmed`（AI 建議、使用者確認或改過）或 `ai_unreviewed`（AI 建議、使用者沒動，預設當作同意）。`ai_unreviewed` 另外有 `seen`：`false` 代表從沒出現在使用者的畫面上，可靠度較低。主題分配的來源在 `topics[].ai_unreviewed_messages`、`ai_confirmed_messages`、`unseen_ai_messages`，沒列到的是使用者自己標的；主題本身的來源在 `name_origin`。
- `ai_suggestion`：根據哪一版 AI 建議整理的（`generated_by`、`generated_at`、`content_fingerprint`、`snapshot`），以及 `rejected`：使用者改掉或刪掉的 AI 建議。被否決的建議，不要再當成使用者沒考慮過而提出來。

## outline.ai.json（AI 的建議）

AI 依使用者的要求先標的一版，格式是 `after-thinking/outline-suggestion`。**這只是給使用者審閱的建議，不是使用者的判斷**：分析時不要讀它當依據，也不能優先於 `outline.json`。使用者在擴充功能裡接受、修改或刪掉之後，結果才寫進 `outline.json`。

如果使用者請你（AI）寫這個檔案：只寫 `<資料夾>/outline.ai.json`，不要動 `outline.json` 和 `source/`；照擴充功能給的指令和格式寫，`source_fingerprint` 照抄指令裡的值。分析時怎麼用 `outline.json`，見 After-thinking 倉庫的 `docs/user-outline.md`。
- `source.fingerprint`、`source.message_fingerprints`：做標記時原文的內容指紋（`[message_id, 指紋]`，有平台訊息編號時是 `[message_id, 指紋, platform_message_id]`，照順序）。內容對不上、但 `platform_message_id` 對得上的，是同一則訊息被重新整理過（例如清掉 ChatGPT 的版面語法），請使用者確認。重新擷取時 `message_id` 會照位置重編，同一個編號可能換成別的內容。讀標記前先比對：`source.fingerprint` 和目前原文算出來的不同時，代表原文變過，標記要用指紋對回去，對不上的先跟使用者確認，不要直接照編號用。
  - 指紋算法：字串 `說話者 + "\n" + 內容`，以 **UTF-16 編碼單位**（JavaScript 字串的 `length` 和 `charCodeAt`）計算。對每個單位做 FNV-1a 32 位元雜湊（起始值 `0x811c9dc5`，先 XOR 再乘 `0x01000193`，取 32 位元），寫成「單位數的 36 進位-8 位小寫十六進位」，例如 `40-56c897f4`。
  - 注意：不是 Python 的 `len()`。emoji 等字在 UTF-16 是 2 個單位，用字元數算會對不上。Python 要先 `s.encode("utf-16-le")`，每 2 bytes 當一個單位。
  - 整份的指紋：把每則的指紋照順序用 `|` 接起來當作內容，說話者當作 `all`，再算一次。
- `source.source_revision`：目前重新擷取不一定會增加這個數字，所以判斷原文有沒有變，以內容指紋為準。

## source/conversation.jsonl（對話原文）

每行一則訊息：`message_id`、`order`、`speaker`（`author` 是使用者，`assistant` 是 AI）、`content`、`timestamp`（找不到是 null）、`platform_message_id`，有附件時另有 `attachments`。

`content` 裡的附件記號：

- `[附件：報告.pdf → attachments/01.pdf]`：使用者上傳的檔案，原檔在 `source/attachments/01.pdf`
- `[圖片：attachments/02.png]`：使用者上傳的圖片
- `[AI 生成的圖片：attachments/03.png]`：AI 畫的圖
- 後面寫「（未取得原檔）」的，原檔沒有抓到

使用者上傳的附件放在那則訊息開頭，AI 生成的放在那則回答結尾。

ChatGPT 回覆裡的版面語法在擷取時已經轉成一般文字（`metadata.yaml` 的 `capture.cleaning` 有 `chatgpt_ui_markup`），留下這些記號：`[來源]`（引用來源，原本的網址沒有保留）、`[引用記憶]`（ChatGPT 用了它對使用者的記憶）、`[引用附件第 a–b 行]`、`[網路圖片：搜尋詞]`、`[圖表：標題]`；`（文字）` 原本是標籤。較早擷取的對話可能還留著 `<box>`、`<Cite/>` 這類原始語法。

Grok 回覆裡的 `<grok:render …>` 標籤在擷取時也已拿掉（`capture.cleaning` 有 `grok_render_markup`），引用換成 `[來源]`，原本的網址沒有保留。Grok 有分支時，`capture.branch_captured` 記下抓的是哪一條路線（`on_screen_path`、`on_screen_path_then_latest`、`url_rid_path`、`latest_path`）。

## 怎麼找東西

- 依時間：看 `inbox/<年-月>/`，或用 `index.jsonl` 的 `started_at`。
- 依主題：先讀 `index.jsonl` 的 `title`；標題不清楚時打開 `conversation.jsonl` 看前幾則。
- 依內容：在 `inbox/` 底下搜尋 `conversation.jsonl`。
- 圖片和檔案：`attachments/` 裡的原檔，對應到訊息裡的記號。

## 給 AI 的規則

- `source/` 底下的檔案是原始紀錄，不要修改。
- 分類、摘要、整理的結果另外寫成新檔案，不要寫進 `source/`。
- `outline.json` 是使用者的標記，不要自己改寫；有不同看法時另外提出，讓使用者決定。要提建議，就寫成 `outline.ai.json`。
- 要分析某段討論時，依照 After-thinking 倉庫的 `AGENTS.md` 執行。
