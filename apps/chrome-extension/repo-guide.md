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
  undated/                     找不到原始時間的對話
  gemini-<對話編號>/           較早版本擷取的對話（還沒依月份分）
{{ROOT}}<討論編號>/            已經挑出來、要用 After-thinking 分析的討論
  source/                      同上
  outline.json                 同上（有標才會有）
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

使用者在擴充功能的「標記對話」頁自己做的，**是使用者的判斷，不是 AI 的推測**。整理這段對話時，有這個檔案就先讀它，照它的分組和重點走。

- `mode`：`multi_topic`（聊了好幾件事，看 `topics`）或 `single_topic`（一直在聊同一件事，看 `single_topic` 和 `key_points`）。
- `topics[]`：`id`（A、B…）、`name`、`note`（使用者的補充說明）、`messages`（屬於這個主題的 `message_id`，照順序）。
- `untagged`：還沒分到主題的訊息。
- `key_points[]`：使用者標的關鍵，`speaker` 分出是使用者說的（`author`）還是 AI 說的（`assistant`）。
- `turns[]`：轉向的地方。`source: auto` 是程式依關鍵字找到、使用者沒有刪掉的；`manual` 是使用者自己標的。
- `notes[]`：使用者寫在某則訊息上的備註。
- `summary`：同樣內容的文字版，編號是依 `order` 排序後的位置（001 是第一則）。
- `source.source_revision`：做標記時的原文版本。和 `source/metadata.yaml` 的 `source_revision` 不同時，標記可能已經對不上，先跟使用者確認。

## source/conversation.jsonl（對話原文）

每行一則訊息：`message_id`、`order`、`speaker`（`author` 是使用者，`assistant` 是 AI）、`content`、`timestamp`（找不到是 null）、`platform_message_id`，有附件時另有 `attachments`。

`content` 裡的附件記號：

- `[附件：報告.pdf → attachments/01.pdf]`：使用者上傳的檔案，原檔在 `source/attachments/01.pdf`
- `[圖片：attachments/02.png]`：使用者上傳的圖片
- `[AI 生成的圖片：attachments/03.png]`：AI 畫的圖
- 後面寫「（未取得原檔）」的，原檔沒有抓到

使用者上傳的附件放在那則訊息開頭，AI 生成的放在那則回答結尾。

## 怎麼找東西

- 依時間：看 `inbox/<年-月>/`，或用 `index.jsonl` 的 `started_at`。
- 依主題：先讀 `index.jsonl` 的 `title`；標題不清楚時打開 `conversation.jsonl` 看前幾則。
- 依內容：在 `inbox/` 底下搜尋 `conversation.jsonl`。
- 圖片和檔案：`attachments/` 裡的原檔，對應到訊息裡的記號。

## 給 AI 的規則

- `source/` 底下的檔案是原始紀錄，不要修改。
- 分類、摘要、整理的結果另外寫成新檔案，不要寫進 `source/`。
- `outline.json` 是使用者的標記，不要自己改寫；有不同看法時另外提出，讓使用者決定。
- 要分析某段討論時，依照 After-thinking 倉庫的 `AGENTS.md` 執行。
