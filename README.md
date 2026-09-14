# After-thinking

After-thinking 是一套把既有對話／文字重新整理成「可追溯的思考狀態」的工作流程。

它的目的不是直接替作者摘要、寫貼文或建立人格模型，而是先忠實重建：作者從哪裡開始、如何轉折、哪些觀點屬於誰、目前各觀點處於什麼狀態，以及下一次可以從哪裡繼續。

## 核心原則

1. **先重建，再發布。** 分析流程與發布流程分離；本倉庫目前只定義分析階段 1–6。
2. **來源歸屬優先於文字流暢。** 不得為了讓摘要好看，把 GPT、外部資料或共同形成的內容改寫成作者原創。
3. **作者沒有反對，不等於作者接受。** 必須另外判斷作者是否明確採納、修改、質疑、否定或根本沒有回應。
4. **主題切分不能只靠語義相似度。** 同時判斷語義關聯與論證關聯。
5. **只對本次提供的材料負責。** 不建立長期人格推測，不把本次可觀察到的推理特徵泛化成作者永久特質。
6. **分析必須可回溯。** 後續結論應盡可能能回指原始內容，而不是一層層只摘要 AI 自己前一次的摘要。
7. **工作流擁有方法，內容工作區擁有思考。** 實際使用者資料應寫入使用者指定的分析工作區，而不是無限堆積在本工具倉庫。

## 分析流程 1–6

```text
輸入材料
  ↓
1. 確認分析範圍＋討論起點
  ↓ 使用者確認
2. 建立討論地圖＋推理軌跡
  ↓ 使用者確認
3. 來源歸屬＋認知狀態
  ↓ 僅針對高風險項目確認
4. 重建本段內容的認知結構
  ↓
5. 找出還沒走完的地方
  ↓
6. 產生下次可繼續討論方向
  ↓
分析完成
```

## 規格文件

- [`specs/01-scope-origin.md`](specs/01-scope-origin.md)
- [`specs/02-topic-map-reasoning.md`](specs/02-topic-map-reasoning.md)
- [`specs/03-provenance-epistemic-status.md`](specs/03-provenance-epistemic-status.md)
- [`specs/04-cognitive-structure.md`](specs/04-cognitive-structure.md)
- [`specs/05-discussion-gaps.md`](specs/05-discussion-gaps.md)
- [`specs/06-next-discussion-directions.md`](specs/06-next-discussion-directions.md)

## 儲存邊界

建議實際使用時至少區分：

- **After-thinking 工具倉庫**：規格、工作流程、schema、prompt、範例。
- **分析工作區倉庫**：原始材料、討論地圖、推理軌跡、來源歸屬、認知結構、未解問題。
- **發布倉庫（可選）**：之後真正要公開的文章、串文、研究筆記或其他成品。

分析工作區與發布倉庫可以是不同 repository；若使用者只想自己使用，也可以是同一 repository 的不同資料夾，但預設建議分離。
