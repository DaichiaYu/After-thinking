# After-thinking Capture v0.6.0

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

- `inbox/<年-月>/gemini-<對話編號>/source/`：`conversation.jsonl`、`metadata.yaml`，有附件時還有 `attachments/`
- 月份是**對話開始的月份**（原始時間）；找不到原始時間的放 `inbox/undated/`
- `inbox/index.jsonl`：擷取紀錄。每擷取一次記一行（標題、網址、存放位置、批量或單段、對話開始和最後的時間、訊息數、字數、附件數、警告）。之後分類也從這個檔案開始。
- v0.5.0 以前抓的對話放在 `inbox/gemini-<對話編號>/`（沒有月份），位置以 `index.jsonl` 為準。

## 怎麼知道哪些抓過了（v0.5.0）

- 單段擷取上傳到 GitHub 時，也會記進 `inbox/index.jsonl`。所以不管用哪種方式抓過，兩邊都認得。
- 批量頁的清單：抓過的會顯示「已擷取 10/25（批量）」或「（單段）」，灰色、預設不勾。想重抓可以手動勾回來，會覆蓋同一個資料夾。
- 單段擷取視窗：打開抓過的對話時，最上面會提示什麼時候抓的、當時幾則、存在哪裡，以及之後多了幾則。
- 只用「只下載檔案」存到電腦的，不會記進紀錄。

## 檔案和圖片（v0.6.0：Gemini 會存原檔）

Gemini 對話裡的圖片和檔案會下載原檔，存在 `source/attachments/`，訊息裡原本的位置留下指向檔案的記號，另外記在 `conversation.jsonl` 的 `attachments` 欄位：

- 你上傳的：`[附件：報告.pdf → attachments/01.pdf]`、`[圖片：attachments/02.png]`，放在你那則訊息的開頭。
- AI 產生的圖：`[AI 生成的圖片：attachments/03.png]`，放在那則回答的結尾。
- 拿不到原檔的寫成 `[附件：報告.pdf（未取得原檔）]`，擷取紀錄的 `attachments_missing` 會記數量，批量頁完成時也會提示。之後可以自己把檔案放進那個 `attachments/` 資料夾。
- 單一檔案超過 20 MB 不下載。
- ChatGPT、Claude 目前仍然只留記號（`[附件：檔名]`），還沒下載原檔。

## 原始時間（v0.6.0，Gemini）

Gemini 畫面上不顯示時間。擴充功能會在 Gemini 頁面載入時「旁聽」頁面自己向 Google 拿的對話資料，從裡面找出每一輪的時間（不會另外送出請求，資料只留在那個分頁裡）。

- 找到的時間寫進每則訊息的 `timestamp`，以及 `metadata.yaml` 的 `conversation_created_at`、`conversation_updated_at`、`time_source`。
- Gemini 的資料格式沒有公開，Google 改版時可能會找不到時間；這時對話會放進 `inbox/undated/`，其他照常。
- 單段擷取：裝好新版之後，已經開著的 Gemini 頁面要先重新整理一次，才抓得到時間（視窗會提示）。

## 根目錄的指引檔（AGENTS.md）

第一次上傳時，會在倉庫根目錄建立 `AGENTS.md`（資料夾地圖、檔案格式、怎麼找資料、給 AI 的規則）和一個指向它的 `CLAUDE.md`。之後查資料的 AI 先讀它就知道倉庫怎麼用。

- 擴充功能更新指引內容時會一起更新這個檔案。
- 想自己改寫的話，刪掉 `AGENTS.md` 第一行的標記，之後就不會被覆蓋。已經存在的 `CLAUDE.md` 不會被動到。

inbox 裡的對話還不是 After-thinking 的討論工作區（沒有 `state.yaml`），分類後挑出要分析的，再移到 `discussions/`。

批量擷取需要讀 Gemini 頁面的權限（`gemini.google.com`）；下載圖片需要讀 Google 圖片網址的權限（`googleusercontent.com`、`usercontent.google.com`）。從舊版更新時 Chrome 可能會請你同意。

## Gemini 說明

- Gemini 只會先顯示最近幾則，越早的訊息要捲到頂才會一小批一小批載入。擴充功能會自動一直往上捲，直到最早那則連續幾次都沒變才開始讀，所以長對話會比 ChatGPT、Claude 慢（可能要一兩分鐘），期間請不要點其他地方。
- Gemini 一律用捲動讀取，偵測不到分支。訊息時間見「原始時間」。
- 只擷取回答本文：思考過程、引用來源小卡、程式碼區塊上的複製按鈕都不會抓進來。上傳的檔案和生成的圖片會存原檔（見「檔案和圖片」）。

## 已知限制

- 網站改版時，擷取規則可能失效，需要更新。
- 抓到的是畫面上顯示的文字，Markdown 格式（例如粗體、表格）會變成純文字。
- 只抓畫面上目前這條路線，編輯或重新生成造成的其他分支不會被擷取。
- ChatGPT、Claude 從網站資料讀時間；改用捲動讀取時 `timestamp` 是 null。Gemini 見「原始時間」。
- `metadata.yaml` 多了 `capture`（擷取資訊）欄位，After-thinking 的 `docs/source-format.md` 之後需要補上這個欄位的說明。
