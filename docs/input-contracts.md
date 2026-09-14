# Stage Input Contracts

每個 Stage 只讀必要上游資料與原始證據，避免後段只是不斷摘要 AI 自己先前的解讀。

## Stage 1
輸入：
- `source/conversation.md`
- `source/metadata.yaml`（若存在）

不得依賴任何既有分析檔。

## Stage 2
輸入：
- `source/*`
- 已確認的 `analysis/01-scope-origin.md`

主要任務：建立 Topic 與 Reasoning turn。

## Stage 3
輸入：
- `source/*`
- 已確認的 Stage 1
- 已確認的 Stage 2

主要任務：建立 Claim，判定 provenance、author uptake 與 epistemic status。

## Stage 4
輸入：
- `source/*`
- Stage 2
- 已確認的 Stage 3

主要任務：從已建立的主題、推理轉折與 Claim 中重建核心概念與本段材料的認知結構。

## Stage 5
輸入：
- `source/*`
- Stage 3
- Stage 4

主要任務：把未解問題、未延伸線索、缺證、張力與中止分支建立成 Gap。

## Stage 6
輸入：
- Stage 2
- Stage 3
- Stage 5
- 必要時回查 `source/*`

主要任務：根據既有 Gap 產生下一輪可繼續討論方向，不重新開啟無關的新題目。

## 額外讀取規則
若某 Stage 必須讀取契約之外的上游資料，應明確記錄原因。不得預設把整個 workspace 全部放入模型上下文。
