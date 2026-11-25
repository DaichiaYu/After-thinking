# After-thinking — Browser annotation workspace (mobile and desktop)

Preserve and annotate AI conversations as reusable thinking assets. This responsive browser workspace edits the same AT `outline.json` used by the Chrome extension, without requiring the extension. Save your source-linked annotations in your own GitHub repository or supported local files, then reuse them for AI handoff, development, research or writing. Deeper AT analysis is optional; article composition belongs to display-AT.

[繁體中文版](#繁體中文版)

# 繁體中文版

## After-thinking 網頁標記工作台（手機與桌面）

將 AI 對話整理成可保存、可追溯、可重複利用的思考資產。在自己的 GitHub 倉庫或支援的本機檔案保存與原文對應的標記，再交給其他 AI 或工具，用於接續討論、開發、研究或寫作，不必先執行六階段分析。

這是 **AT 主倉庫**的 GitHub Pages 響應式標記網頁，桌面可直接連接 GitHub 使用，**不必安裝 Chrome 插件**。與桌面插件共用 outline.json 第 6 版資料格式；小螢幕使用觸控版佈局，寬螢幕有三欄標記工作台。
文章轉換功能屬於另外的 display-AT 專案，本頁不負責文章生成。

## 部署與使用

1. 在 AT 倉庫的 **Settings → Pages** 將 Build and deployment 的 Source 設為 **GitHub Actions**。
2. 將經過測試的分支合併到 main 後，由 `.github/workflows/mobile-pages.yml` 發布 `apps/mobile-web/`，網址以 GitHub Pages 實際提供為準。
3. 使用者在電腦或手機開啟網站，**自行輸入**資料倉庫（owner/repository）、分支及 Fine-grained Personal Access Token。
4. 該 Token 只需授權使用者選定的資料倉庫，Repository permission → Contents: Read and write。**切勿**把 Token 寫入公開程式碼、Issues、網址或分享給其他人。
5. 清單沿用 AT 原有的對話標題、搜尋、時間排序、已標記與已整理等狀態。預覽提問可以在同一個清單項目展開或收合。
6. 進入標記頁後可編輯主要主題、其他相關主題、整則關鍵、轉向、備註及 AI 小節重點，審查 AI 已產生的建議。
7. 儲存會寫回原資料倉庫內相同對話資料夾的 `outline.json`，成功後嘗試更新 `inbox/index.jsonl` 的標記時間。

## 公開專案與私人資料隔離

- AT 公開倉庫只包含通用介面、資料格式、程式邏輯及**虛構測試資料（只在獨立測試程式）**；正式網頁不內建任何示範對話。
- 正式網頁**不預設任何人的 GitHub 帳號、私人資料倉庫、對話內容、真實標記或憑證**。
- 使用者輸入的 Token 預設只保存在該瀏覽器分頁的 JavaScript 記憶體，重新整理後需要重新輸入；不會寫入網址或遠端伺服器。
- 勾選「**記住這台裝置**」（預設不勾）後，Token 會存在該瀏覽器的 localStorage，下次打開自動連線。取消勾選再連接、Token 被 GitHub 拒絕（401），或在「更多」按「中斷連線並忘記這台裝置」時會刪除。共用裝置請不要勾。
- 倉庫名稱與分支不是機密，連線成功後會記在該瀏覽器，方便下次少打兩欄。
- 連線表單可讓手機的密碼管理員儲存與自動填入 Token，作為不勾選「記住」時的替代做法。
- **未儲存的標記會自動留一份草稿在該瀏覽器**（每段對話一份）。分頁被系統回收或不小心關掉後，重新開啟該對話會詢問要接著用還是丟掉；儲存成功後草稿自動刪除。草稿只在本機，不會同步到其他裝置。
- GitHub Pages 是公開可讀的靜態網站，因此**不能**在程式裡保存 OAuth Client Secret。若日後改成 GitHub App 登入，必須另設安全授權服務。
- 對話透過瀏覽器直接向 GitHub REST API 讀取，頁面不會把私人原文提交到 AT 公開倉庫。

## 讀寫格式與避免覆蓋

- 讀：`inbox/index.jsonl`、可選的 `inbox/labels.json`、每段對話的 `source/conversation.jsonl` 與可選的 `outline.json`。
- 寫：只寫該段對話的 `outline.json`，成功後嘗試更新索引中的 `outline_updated_at` 與 `outline_mode`；不修改原文。
- 保存前重新讀取原文的 Git blob SHA，確認原文未變；也用 outline 原 SHA 做**樂觀並行控制**。如果其他裝置修改過原文或 outline，停止寫入。
- 若已有的 outline 與原文內容指紋不同，拒絕直接覆寫。無法安全還原的小節標記仍留在 `unmatched_section_key_points`，留待人工核對。
- 保留既有 outline 欄位，例如 key_ranges、turn_hints、ai_suggestion、origin、rejected 與 notes，不用新版 UI 的操作擅自刪除。
- labels.json 的 **已整理／不用整理／自訂標籤** 在手機版目前僅顯示與篩選，不做編輯；「已標記」由 outline_updated_at 判斷，兩者分開。

## 目前範圍

- 手動選檔模式：同時載入 conversation.jsonl 與 outline.json，之後下載 outline.json，不會寫 GitHub。
- 桌面網頁的三欄工作台包含主題結構、原文搜尋、標記檢查器、關鍵段落起訖編輯、AI 審查與標記摘要；手機保留原本的觸控標記面板。
- 附件資訊會在原訊息下方呈現。已保存原檔的圖片與純文字可透過 GitHub 授權或本機資料夾授權按需預覽；其他格式提供下載；未保存原檔者顯示狀態。
- 本機資料夾模式使用桌面 Chromium 的資料夾授權直接存回 outline.json；不支援的瀏覽器仍可手動匯入 JSONL/JSON。詳見 [本機資料夾指南](../../docs/local-folder-editor.md)。
- 目前仍未包含完整 ZIP 匯入、自訂標籤管理，以及與插件完全一致的附件進階功能；桌面插件原有功能不受影響。
- 對話閱讀每次載入 20 則，並保留上下導航、Markdown 小節展開及個別小節標重點。
- 目前已具備程式測試與 Pages 部署；真實 Chrome/Safari 操作、授權提示及 GitHub 寫入仍應使用測試資料倉庫做端對端驗證。

## 驗證

```sh
node --check apps/mobile-web/core.js
node --check apps/mobile-web/github.js
node --check apps/mobile-web/device.js
node --check apps/mobile-web/app.js
node --test tests/mobile-web.test.cjs
```

GitHub Actions 測試及部署流程：`.github/workflows/mobile-pages.yml`。
GitHub Pages 發布流程：`.github/workflows/mobile-pages.yml`。
