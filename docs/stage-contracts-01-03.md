# Stage Contracts 01–03

## Stage 1｜分析範圍與討論起點

### Input
- 原始對話與附加材料。
- Source metadata（若有）。

### Output
寫入 `analysis/01-scope-origin.md`，至少包含：
- 分析範圍與排除範圍。
- 角色／來源列表。
- Trigger。
- Initial question。
- Underlying question（若可可靠判定）。
- Author initial position。
- Initial uncertainty。
- 對應 Source IDs。

### Save
初稿寫入後，Stage 1 設為 `needs_review`。

### Checkpoint
必須由使用者確認：
- 是否抓對討論起點。
- 是否抓對作者原始立場。
- 是否誤把後來的 AI／外部資訊算成作者原始想法。

確認後設為 `confirmed`。

### Rollback
後續若發現 Stage 1 的分析邊界或初始立場有實質錯誤，回到 Stage 1；修正後 Stage 2–6 全部標記 `stale`。

---

## Stage 2｜討論地圖與推理軌跡

### Input
- Source。
- Confirmed Stage 1。

### Output
寫入 `analysis/02-topic-map.md`。

每個 Topic 至少包含：
- Topic ID。
- 核心問題。
- 類型：main / subtopic / branch / standalone / workflow-meta。
- Parent topic。
- Source range。
- 與前一 Topic 的 relation。
- 是否可獨立理解。

每個 Reasoning turn 至少包含：
- Reasoning ID。
- Before。
- Trigger。
- Trigger source。
- Author response。
- After。
- Why。
- 對應 Source IDs。

### Save
初稿寫入後設為 `needs_review`。

### Checkpoint
使用者確認：
- 哪些題目該合併／拆分。
- 哪些是真轉折。
- 是否漏掉重要支線。

確認後設為 `confirmed`。

### Rollback
Stage 3 以後若發現 Topic 或 Reasoning turn 結構錯誤，回到 Stage 2。確認修正後 Stage 3–6 標記 `stale`。

---

## Stage 3｜來源歸屬與認知狀態

### Input
- Source。
- Confirmed Stage 1。
- Confirmed Stage 2。

### Output
寫入 `analysis/03-claims.yaml`。

每個 Claim 至少包含：
- `id`
- `claim`
- `topic_ids`
- `provenance.type`
- `provenance.introduced_at`
- `author_uptake.status`
- `epistemic_status.type`
- `evidence`
- `confidence`

### Save
先完成全部 Claim，再辨識高風險項目。

若沒有高風險項目，Stage 可直接設為 `confirmed` 前仍需最小風險確認紀錄；若存在高風險項目，設為 `needs_review`。

### Risk Checkpoint
只呈現需要人判斷的項目，例如：
- AI 首提、作者後續疑似採納。
- 作者原始表達模糊，AI 後來形式化。
- 同一 Claim 同時受作者與外部材料影響。
- provenance 或 uptake 信心不足。

使用者確認後設為 `confirmed`。

### Rollback
如果 Claim 分析顯示 Stage 1 或 Stage 2 本身有錯，不能只在 claims 裡補救；應回到對應上游 Stage。Stage 3 自身實質修正後，Stage 4–6 標記 `stale`。
