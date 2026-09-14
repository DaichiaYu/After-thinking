# 3. 來源歸屬與認知狀態

## 目的
對每個重要觀點分開判斷：誰先提出、作者後來怎麼回應，以及目前這個觀點在作者思考中處於什麼狀態。

## A. Provenance｜來源歸屬

### 來源類型
- `Author-original`：作者在 GPT 提出前已經明確說出。
- `Author-reformulated`：作者經討論後自行重新形成的版本。
- `AI-introduced`：概念或假設首次由 GPT 提出。
- `AI-supported`：作者原本已有概念，GPT 只補術語、研究、證據或形式化。
- `Co-developed`：作者提供核心直覺，GPT 協助形式化，最終由互動共同形成。
- `External-source`：來自論文、文章、新聞或第三方。
- `Unclear provenance`：無法可靠判斷。

## B. Author Uptake｜作者接納程度

對每個重要觀點另外標記作者的反應：
- `Explicitly accepted`：明確接受。
- `Implicitly adopted`：沒有直接說接受，但後續實際採用。
- `Modified`：修改後採納。
- `Challenged`：提出質疑。
- `Rejected`：明確否定。
- `Not addressed`：沒有直接或間接回應。
- `Unclear`：無法判斷。

## C. Epistemic Status｜認知狀態

- `Stable claim`：作者目前相對穩定的主張。
- `Tentative conclusion`：作者暫時傾向接受，但仍保留修正空間。
- `New hypothesis`：作者已形成或採納為工作假設，但尚未充分驗證。
- `Unresolved question`：作者確實討論過並試圖判斷，但目前仍沒有答案。
- `Unexplored lead`：討論中出現、與主線相關、作者未否定，但也未明確採納或繼續延伸。
- `Rejected path`：作者曾考慮但後來排除的解釋。
- `Suspended judgment`：作者刻意不下判斷，認為目前證據不足。

## 關鍵規則
- 作者沒有反對，不等於作者接受。
- 作者後續談到相關內容，不等於已採納 GPT 前面提出的觀點。
- GPT 幫作者把模糊直覺形式化，不等於 GPT 創造了那個想法。
- GPT 提出而作者完全沒有接的內容，不得在最終摘要中寫成「作者認為」。
- 無法判定時應保留不確定，不得為了輸出整齊而硬分類。

## 風險確認 ③
不要求使用者逐項核准全部內容，只拉出高風險項目確認，例如：
- GPT 首先提出，但作者後續似乎有採納。
- 作者原本表達模糊，GPT 後來替其形式化。
- 同一觀點同時受作者與外部資料影響。
- 目前來源或作者接納程度仍不明確。

確認有爭議項目後進入第 4 階段。
