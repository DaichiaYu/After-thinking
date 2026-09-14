# Discussion Workspace 儲存模型

After-thinking 工具倉庫只保存方法與模板。每次實際分析應寫入使用者指定的分析工作區倉庫。

## 建議目錄

```text
discussions/
└─ <discussion-id>/
   ├─ source/
   │  ├─ conversation.md
   │  └─ metadata.yaml
   ├─ state.yaml
   ├─ analysis/
   │  ├─ 01-scope-origin.md
   │  ├─ 02-topic-map.md
   │  ├─ 03-claims.yaml
   │  ├─ 04-cognitive-structure.md
   │  ├─ 05-gaps.yaml
   │  └─ 06-next-directions.md
   └─ revisions/
```

## 資料角色

### Source
`source/` 保存本次分析使用的原始證據。分析開始後，不應由 AI 靜默改寫。

原始對話使用穩定訊息 ID：
- `U001`：作者／使用者訊息。
- `A001`：AI／助理訊息。
- `E001`：可獨立辨識的外部材料或引用。

後續分析應盡量用這些 ID 回指原始內容。

### State
`state.yaml` 只保存流程狀態：目前階段、各 Stage 狀態、source revision、哪些輸出過期，以及下一步要執行什麼。不要把大量分析正文塞進 state。

### Analysis
`analysis/` 保存正式分析產物。

| Stage | 檔案 | 格式 |
|---|---|---|
| 1 | `01-scope-origin.md` | Markdown |
| 2 | `02-topic-map.md` | Markdown |
| 3 | `03-claims.yaml` | YAML |
| 4 | `04-cognitive-structure.md` | Markdown |
| 5 | `05-gaps.yaml` | YAML |
| 6 | `06-next-directions.md` | Markdown |

敘事與高階解讀使用 Markdown；需要穩定欄位、後續篩選或機器處理的 claim / gap 使用 YAML。

## 穩定 ID

- Topic：`T001`, `T002` …
- Reasoning turn：`R001`, `R002` …
- Claim：`C001`, `C002` …
- Gap：`G001`, `G002` …
- Direction：`D001`, `D002` …

ID 一旦建立，不因重新排序而更換；只有物件本身被判定為誤建時才廢止。

## Revision Notes

Git commit history 保存一般版本差異，因此 `revisions/` 不需要複製每個舊版本。

只有當使用者明確糾正 AI 對作者思想、來源或推理結構的理解時，才新增 correction note，記錄：
- 原判斷。
- 使用者修正。
- 修正理由。
- 受影響的 Topic / Claim / Gap。
- 哪些下游 Stage 需要重新計算。

## Source Revision

如果分析開始後原始材料被新增或修改，`source_revision` 應增加。

第一版原則：不要把新材料靜默混入已確認分析。應明確選擇「建立新 discussion」或「擴充現有 discussion」，再重新判斷哪些 Stage 需要更新。
