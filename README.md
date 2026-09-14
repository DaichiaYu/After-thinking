# After-thinking

After-thinking reconstructs how reasoning changes across long AI-assisted discussions instead of reducing the discussion to a flat summary.

The current workflow has six stages: Scope and Origin; Topic Map and Reasoning Trajectory; Provenance and Epistemic Status; Cognitive Structure; Discussion Gaps; and Next Discussion Directions.

Stages 1 and 2 require review. Stages 3 through 5 use risk-based review. Stage 6 requires no review. The status `confirmed` is reserved for explicit human confirmation; low-risk completed work uses `not_required`.

## Storage

The method repository is separate from the analysis workspace. The analysis destination is selected when a discussion is initialized.

Raw conversation material is stored in `source/conversation.jsonl`. Each source item has a stable role-independent message ID such as `msg-000001`, while speaker role is stored separately. Existing IDs are never renumbered.

Each discussion also has `source/metadata.yaml`, `state.yaml`, `corrections.yaml`, an `analysis/` directory for Stage outputs, and `revisions/` for readable correction history.

`state.yaml` tracks source revision, workflow progress, review state, applied corrections, stale outputs, and the next action. `corrections.yaml` stores active correction constraints that must be loaded on reruns until replaced or retired.

## Documentation

See `docs/workspace-write-contract.md` for destination and write rules, `docs/source-format.md` for raw source format, `docs/runtime.md` and `docs/state-semantics.md` for workflow behavior, `docs/user-fixes.md` for correction lifecycle, `docs/input-contracts.md` for Stage inputs, and `docs/output-format.md` for output metadata. Starter files live under `templates/` and Stage definitions under `specs/`.

Executable orchestration is still under development.

---

# 繁體中文版

After-thinking 不只摘要一場 AI 對話，而是重建思考怎麼從起點一路變成目前的狀態，包括推理轉折、觀點來源、作者是否採納、仍未解決的缺口，以及下一次可以繼續的方向。

目前共有六個 Stage。Stage 1、2 必須確認；Stage 3–5 採風險式確認；Stage 6 不需確認。`confirmed` 只能來自明確人工確認，沒有需要人工判斷的低風險結果使用 `not_required`。

方法 repository 與實際分析 workspace 分開。原始對話使用 `source/conversation.jsonl`，每則 source item 使用穩定且與角色分離的 message ID，例如 `msg-000001`；speaker 另外保存。新增材料不重新編號既有訊息。

每個 discussion 另外保存 `source/metadata.yaml`、`state.yaml`、`corrections.yaml`、Stage 分析輸出與修正歷史。`corrections.yaml` 中仍 active 的修正，在後續 rerun 時必須真的被讀取，而不是只有歸檔。

完整規則請依 `docs/` 下的 workspace write、source format、runtime、state semantics、user fixes、input contracts 與 output format 文件執行；初始化範本位於 `templates/`。
