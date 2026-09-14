# Workflow Runtime

第一版使用可回滾的線性流程：Stage 1 → 2 → 3 → 4 → 5 → 6。

## Stage 狀態
- `pending`：尚未開始
- `draft`：已有草稿
- `needs_review`：等待使用者確認
- `confirmed`：已由使用者確認
- `completed`：不需強制確認且已完成
- `stale`：上游已變更，現有結果不能再視為最新
- `blocked`：缺少必要輸入

`confirmed` 只能來自使用者確認。

## Checkpoint
- Stage 1：強制確認分析範圍、討論起點、作者初始立場。
- Stage 2：強制確認主題切分與主要推理轉折。
- Stage 3：只確認高風險來源歸屬與作者接納判定。
- Stage 4–6：預設自動完成；若推論風險高則升級為 `needs_review`。

## 回滾
若下游發現上游理解有重大問題，不可偷偷在下游修正。應回到最早出錯的 Stage，讓使用者確認修正，再重新計算受影響下游。

## Stale 傳遞
- Stage 1 實質修改：2–6 stale
- Stage 2 實質修改：3–6 stale
- Stage 3 實質修改：4–6 stale
- Stage 4 實質修改：5–6 stale
- Stage 5 實質修改：6 stale

純排版、錯字且不改變語意的修改，不觸發 stale。

## 每階段儲存順序
1. 讀取允許的輸入。
2. 產生完整草稿。
3. 寫入對應分析檔。
4. 更新 `state.yaml`。
5. 需要確認時設為 `needs_review` 並停止。
6. 確認後設為 `confirmed`；無強制確認的 Stage 完成後設為 `completed`。

Git commit history 保留一般版本差異；只有使用者明確糾正 AI 對思想、來源或推理結構的理解時，才另外建立 revision note。
