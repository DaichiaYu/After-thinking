# After-thinking Capture v0.1.6

把 ChatGPT 或 Claude 網頁上的對話擷取成 After-thinking 的原文檔。
這一版是「按圖示模式」（manual_click）：只有你按下擴充功能圖示時，才會讀取目前這個分頁。

## 安裝（開發人員模式）

1. 解壓縮，得到 `after-thinking-capture` 資料夾。
2. Chrome 網址列輸入 `chrome://extensions`。
3. 打開右上角的「開發人員模式」。
4. 按「載入未封裝項目」，選擇 `after-thinking-capture` 資料夾。
5. 建議按工具列的拼圖圖示，把 After-thinking Capture 釘選出來。

## 使用

1. 打開一段 ChatGPT 或 Claude 的對話（不用自己捲動）。
2. 按擴充功能圖示。擴充功能會自動從頭捲到尾、展開被摺疊的長訊息，再捲回原位。讀取時請不要點擊其他地方，否則視窗會關閉。
3. 在清單裡檢查訊息，取消勾選不要的。
4. 按「下載原文檔」。檔案會出現在「下載」資料夾的 `after-thinking/<討論編號>/source/`。

## 請幫忙測試並回報

每個平台各測一段短對話、一段長對話，回報這幾件事：

1. 訊息數量（你、AI 各幾則）和實際對話是否一致。
2. 第一則、最後一則是否正確。
3. 打開 `conversation.jsonl`，內容有沒有缺字、重複，或混進按鈕文字（例如「複製」「重新生成」）。
4. Claude 的回答如果有思考過程或工具結果，有沒有被一起抓進來。

## 已知限制

- 網站改版時，擷取規則可能失效，需要更新。
- 抓到的是畫面上顯示的文字，Markdown 格式（例如粗體、表格）會變成純文字。
- 只抓畫面上目前這條路線，編輯或重新生成造成的其他分支不會被擷取。
- 網頁上沒有訊息時間，所以 `timestamp` 一律是 null。
- `metadata.yaml` 多了 `capture`（擷取資訊）欄位，After-thinking 的 `docs/source-format.md` 之後需要補上這個欄位的說明。
