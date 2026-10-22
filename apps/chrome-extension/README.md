# After-thinking Capture v0.4.0

把 ChatGPT、Claude 或 Gemini 網頁上的對話擷取成 After-thinking 的原文檔。
這一版是「按圖示模式」（manual_click）：只有你按下擴充功能圖示時，才會讀取目前這個分頁。

## 安裝（開發人員模式）

1. 解壓縮，得到 `after-thinking-capture` 資料夾。
2. Chrome 網址列輸入 `chrome://extensions`。
3. 打開右上角的「開發人員模式」。
4. 按「載入未封裝項目」，選擇 `after-thinking-capture` 資料夾。
5. 建議按工具列的拼圖圖示，把 After-thinking Capture 釘選出來。

## 設定 GitHub（第一次使用）

1. 在 GitHub 建立一個私人（private）倉庫，並勾選「Add a README」。
2. 在 `chrome://extensions` 找到 After-thinking Capture，按「詳細資料」→「擴充功能選項」，或在擴充功能視窗按「GitHub 設定」。
3. 依照設定頁的步驟建立 fine-grained token（只開放這個倉庫的 Contents 讀寫權限），貼上後按「儲存並測試連線」。

## 使用

1. 打開一段 ChatGPT、Claude 或 Gemini 的對話（不用自己捲動）。
2. 按擴充功能圖示。擴充功能會自動從頭捲到尾、展開被摺疊的長訊息，再捲回原位。讀取時請不要點擊其他地方，否則視窗會關閉。
3. 在清單裡檢查訊息，取消勾選不要的。
4. 按「上傳到 GitHub」，確認視窗裡的內容後按「確定上傳」。檔案會以一個提交（commit）寫入 `discussions/<討論編號>/`，包含 `source/conversation.jsonl`、`source/metadata.yaml`、`state.yaml`、`corrections.yaml`。
5. 也可以按「只下載檔案」，存到電腦的「下載」資料夾。

## 請幫忙測試並回報

每個平台各測一段短對話、一段長對話，回報這幾件事：

1. 訊息數量（你、AI 各幾則）和實際對話是否一致。
2. 第一則、最後一則是否正確。
3. 打開 `conversation.jsonl`，內容有沒有缺字、重複，或混進按鈕文字（例如「複製」「重新生成」）。
4. Claude 的回答如果有思考過程或工具結果，有沒有被一起抓進來。
5. Gemini：開啟「顯示思路」的回答，思考內容有沒有混進來；有程式碼的回答，有沒有多出「content_copy」之類的按鈕文字。

## 批量擷取 Gemini 對話（v0.4.0 新增）

對話很多、不想一段段打開時用這個。

1. 先完成上面的 GitHub 設定。
2. 按擴充功能圖示，在最下面按「批量擷取 Gemini 對話」，會打開一個新分頁。
3. 按「讀取 Gemini 對話清單」：會開一個 Gemini 視窗，自動捲完側邊欄，列出所有對話。已經抓過的會標成「已擷取」，預設不勾。
4. 按「開始擷取」：擴充功能會一段段打開對話、往上載入完整內容、上傳。每段都是一個獨立的提交，中途停止或關掉，已經上傳的都還在。
5. 擷取時讓 Gemini 視窗留在畫面上（不要縮到最小），可以去做別的事。每段大約幾十秒到兩分鐘。

上傳位置（和單段擷取的 `discussions/` 分開）：

- `inbox/gemini-<對話編號>/source/conversation.jsonl`、`source/metadata.yaml`
- `inbox/index.jsonl`：每段一行，記錄標題、網址、訊息數、字數、警告。下次批量擷取靠它跳過抓過的對話；之後分類也從這個檔案開始。

inbox 裡的對話還不是 After-thinking 的討論工作區（沒有 `state.yaml`），分類後挑出要分析的，再移到 `discussions/`。

批量擷取需要讀 Gemini 頁面的權限（`gemini.google.com`），從舊版更新時 Chrome 可能會請你同意。

## Gemini 說明

- Gemini 只會先顯示最近幾則，越早的訊息要捲到頂才會一小批一小批載入。擴充功能會自動一直往上捲，直到最早那則連續幾次都沒變才開始讀，所以長對話會比 ChatGPT、Claude 慢（可能要一兩分鐘），期間請不要點其他地方。
- Gemini 一律用捲動讀取（沒有直接讀資料的方式），所以沒有訊息時間，也偵測不到分支。
- 只擷取回答本文：思考過程、引用來源小卡、程式碼區塊上的複製按鈕都不會抓進來。上傳的檔案和生成的圖片不會擷取。

## 已知限制

- 網站改版時，擷取規則可能失效，需要更新。
- 抓到的是畫面上顯示的文字，Markdown 格式（例如粗體、表格）會變成純文字。
- 只抓畫面上目前這條路線，編輯或重新生成造成的其他分支不會被擷取。
- 網頁上沒有訊息時間，所以 `timestamp` 一律是 null。
- `metadata.yaml` 多了 `capture`（擷取資訊）欄位，After-thinking 的 `docs/source-format.md` 之後需要補上這個欄位的說明。
