# Discussion Workspace 儲存模型

每次實際分析應寫入使用者指定的分析工作區倉庫。

```text
discussions/<discussion-id>/
├─ source/
│  ├─ conversation.md
│  └─ metadata.yaml
├─ state.yaml
├─ corrections.yaml
├─ analysis/
│  ├─ 01-scope-origin.md
│  ├─ 02-topic-map.md
│  ├─ 03-claims.yaml
│  ├─ 04-cognitive-structure.md
│  ├─ 05-gaps.yaml
│  └─ 06-next-directions.md
└─ revisions/
```

## Source
原始證據使用穩定 ID：`U001`、`A001`、`E001` 等。分析開始後不應被 AI 靜默改寫。

## State
`state.yaml` 保存流程狀態、source revision、stale 狀態與下一步，不保存大量分析正文。

## Corrections
`corrections.yaml` 保存會約束未來 rerun 的 active user corrections。只要 correction 尚未被 supersede 或 retire，相關 Stage 執行前就必須載入。

Correction 使用穩定 ID `CR001`、`CR002` …，並綁定可尋址 target。

Stage 1 固定 anchors：
- `S1.scope`
- `S1.trigger`
- `S1.initial_question`
- `S1.underlying_question`
- `S1.author_initial_position`
- `S1.initial_uncertainty`

其他物件沿用 `T`、`R`、`C`、`G`、`D` stable IDs，也可綁定特定 field，例如 `C001.provenance.type`。

Correction lifecycle 與 rerun 行為見 [`user-fixes.md`](user-fixes.md)。

## Analysis
Stage 1、2、4、6 以 Markdown 為主；Stage 3 claims 與 Stage 5 gaps 使用 YAML。

## Revisions
`revisions/` 只保存人可讀的修正歷史。真正會影響 runtime 的目前有效修正以 `corrections.yaml` 為準。

## Source revision
原始材料擴充或修改時增加 `source_revision`。Active corrections 預設跨 source revisions 持續有效，除非使用者明確取代或撤銷。
