# 請 AI 先標一版：outline.ai.json 的寫法

使用者請你先幫一段 AI 對話標一版主題、轉向和關鍵，讓他再到 After-thinking Capture 的標記頁檢查。照這份指引做，結果寫成一個 `outline.ai.json`。

> 這個檔案由擴充功能自動產生，擴充功能更新時會一起更新。

<!-- repo-only -->
## 使用者會告訴你

- 倉庫和分支
- 資料夾（例如 `discussions/2026-11-03-chatgpt-6ae8c88a/`）
- 原文：`<資料夾>source/conversation.jsonl`，一行一則訊息（JSON），照 `order` 排序
- 這段對話有幾則訊息，以及 `source_fingerprint`

原文每一行有 `message_id`、`order`、`speaker`（`author` 是使用者，`assistant` 是 AI）、`content`。回覆時一律用 `message_id` 指訊息。
<!-- /repo-only -->

## 要做的事

1. 把整份對話從頭讀到尾，不要只讀開頭。讀完先核對訊息數和使用者說的一樣。
2. 判斷這段對話是「聊了好幾件事」（`mode: multi_topic`）還是「一直在聊同一件事」（`mode: single_topic`）。
3. `multi_topic`：把對話分成主題。每個主題用 `spans` 標出涵蓋的訊息（`from`、`to` 都填 `message_id`，包含頭尾）；同一個主題中間被別的話題打斷又回來，就寫好幾段 `spans`。
   - 使用者的每一則訊息（`speaker: author`）都必須落在某個主題的 `spans` 裡，一則都不能漏。
   - AI 的回覆預設和它前面那則使用者訊息同一個主題；某則 AI 回覆其實在講別的主題時，讓它落在那個主題的 `spans` 裡。
   - `single_topic`：`topics` 留空陣列，`single_topic` 填 `{ "name": "…", "note": "…" }`。
4. `turns`：使用者改變想法、方向、範圍或做法的地方。`message_id` 填使用者的那一則（不是 AI 的回覆）；`reason` 寫從什麼轉到什麼、根據哪句話。使用者轉向時常常不用固定的詞，AI 的下一則回覆如果在修正方向（例如「這樣差很多」「那我會大幅修改前面的…」），通常就是線索。
5. `key_points`（單則）和 `key_ranges`（一整段都是核心）：少而準，不要每則都標。AI 說的內容也可以標，填 AI 那則的 `message_id`。
6. 拿不定主意的地方寫進 `uncertain`；兩種切法都合理時，另一種放進 `alternatives`。
7. 主題名稱、說明、理由用這段對話的語言寫，簡短。理由要能在原文裡找到根據，不要推測使用者沒說出口的動機。
8. `source_fingerprint`、`message_count` 照抄使用者給的值，不要自己算。
9. 只用下面格式裡的欄位，不要加別的。沒有內容的欄位給空陣列。

<!-- repo-only -->
## 寫入規則

- 只能新增或覆寫 `<資料夾>outline.ai.json` 這一個檔案，直接提交到使用者說的分支。
- 其他檔案一律不要動，特別是 `<資料夾>outline.json`（那是使用者自己的判斷）和 `source/` 底下的原文。
- 已經有 `outline.ai.json` 時直接覆寫；舊版本會留在 Git 歷史裡。
- 寫完告訴使用者，他會在擴充功能的標記頁按「AI 寫好了，重新讀取」。
- 擴充功能匯入時會檢查格式、漏標和編號。使用者貼回「修正指令」時，只改指令裡提到的地方，再覆寫同一個檔案。
<!-- /repo-only -->

## 格式（outline.ai.json）

```json
{
  "format": "after-thinking/outline-suggestion",
  "format_version": 1,
  "generated_at": "2026-11-05T07:00:00Z",
  "generated_by": "（你的模型名稱）",
  "source_fingerprint": "（照抄使用者給的值）",
  "message_count": 24,
  "mode": "multi_topic",
  "topics": [
    { "id": "A", "name": "主題名稱", "note": "一句話說明這個主題在談什麼", "spans": [{ "from": "msg-000001", "to": "msg-000012" }] },
    { "id": "B", "name": "……", "note": "……", "spans": [{ "from": "msg-000013", "to": "msg-000018" }, { "from": "msg-000021", "to": "msg-000024" }] }
  ],
  "single_topic": null,
  "turns": [{ "message_id": "msg-000011", "reason": "從什麼轉到什麼，根據是哪句話" }],
  "key_points": [{ "message_id": "msg-000015", "reason": "為什麼重要" }],
  "key_ranges": [{ "from": "msg-000017", "to": "msg-000020", "reason": "為什麼這一整段是核心" }],
  "uncertain": [{ "message_id": "msg-000013", "question": "拿不定主意的地方，想問使用者什麼" }],
  "alternatives": [{ "label": "另一種分法的名稱", "topics": [] }]
}
```

- `id` 用大寫英文字母 A、B、C…。
- `alternatives[].topics` 的格式和上面的 `topics` 一樣。
- 這只是給使用者審閱的建議：使用者接受、修改或刪掉之後，結果才會寫進 `outline.json`。
