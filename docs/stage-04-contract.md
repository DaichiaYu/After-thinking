# Stage 4 Contract｜認知結構

## Input
- Source
- Usable Stage 2
- Usable Stage 3
- Applicable active corrections

Stage 4 must not require Stage 3 to be `confirmed` when Stage 3 review was legitimately `not_required`.

## Output
寫入 `analysis/04-cognitive-structure.md`：
- Core concepts
- 反覆出現的概念區分
- 可觀察到的 reasoning patterns
- Evidence references
- 高推論內容的 confidence
- Run metadata：source revision、workflow version、applied corrections

## Save / Review
預設：
- execution: `completed`
- review policy: `none`
- review: `not_required`

若高推論內容需要人工確認，可將 review 升級為 `pending`；只有使用者確認後才可標記 `confirmed`。

## Rollback
若只是本階段過度推論，修正 Stage 4 並將 Stage 5–6 標為 stale。若問題來自 Topic 或 Claim，回到 Stage 2 或 3。
