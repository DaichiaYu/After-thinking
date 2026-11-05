# User Outline (`outline.json`)

[繁體中文摘要](#繁體中文摘要)

A discussion workspace may contain `outline.json`: the author's own pre-analysis structure, made in the After-thinking Capture extension's tagging page before any Stage runs. It records where topics begin and end, where the author's direction turned, which messages or stretches matter, and short notes.

The outline settles the **skeleton** of the discussion that Stage 2 would otherwise have to guess and then confirm through review. It does not replace Stage 1 or Stage 2: it contains no core questions, topic relations, initial position, or turn explanations. Stages still produce their full outputs; they build them on the outline's skeleton instead of re-segmenting.

The workspace may also contain `outline.ai.json`, an AI-produced suggestion that the extension imports into the tagging page. `outline.ai.json` is input to the author's review, never an analysis input in its own right. Stages read `outline.json` only.

## Where it fits

- Optional. Absence of `outline.json` changes nothing.
- Read after `source/*` and before Stage 1 and Stage 2 execution.
- It is author material about the source, not source. It never rewrites `source/conversation.jsonl`, and it is not a correction (`corrections.yaml` remains the only persistent constraint mechanism; see `user-fixes.md`).

## Origin of each item

Every topic assignment, topic name, key point, key segment, and turn in `outline.json` carries an origin:

| Origin | Meaning | Authority |
|---|---|---|
| `user` | The author made it | Author judgment |
| `ai_confirmed` | An AI suggested it and the author explicitly confirmed or edited it | Author judgment |
| `ai_unreviewed` | An AI suggested it and the author left it unchanged | Accepted by default; the author did not object. `seen: false` means it was never displayed on the author's screen |
| — (`turn_hints`) | Keyword or AI-response hints from the extension, not confirmed | Not author judgment; a lead only |

Items rejected by the author during review are listed under `ai_suggestion.rejected`. A rejected suggestion must not be reintroduced as if the author had not considered it.

When an output relies on an `ai_unreviewed` item for a material conclusion, state the reliance in the relevant field (for example in `why` or as uncertainty), especially when `seen: false`.

## Stage 1 — Scope & Origin

- Key points, key segments, and notes indicate what the author considers important. Use them to locate evidence; do not cite them as the author's initial position, trigger, or uncertainty. Those still require source evidence (`source_refs` into `source/conversation.jsonl`).
- Messages the author left untagged in a multi-topic outline are not thereby out of scope. Scope is still decided by Stage 1 from the source.
- Key points with `speaker: assistant` mark AI contributions the author found important. They support the "do not turn an AI idea into an author idea" rule; they are not author positions.

## Stage 2 — Topic Map & Reasoning Trajectory

- **Segmentation follows the outline.** Each outline topic maps to a Topic (`T`), and its messages become the Topic's `source_spans` / `source_refs`. A topic recurring after others is one Topic with several spans, as the spec already allows.
- Stage 2 may add structure the outline lacks (type, `core_question`, `parent`, relations, subtopics within an outline topic). It must not merge, split, or move outline topics on its own judgment. If the source strongly contradicts an outline boundary, keep the outline segmentation and raise the disagreement for review as an explicit question.
- **Confirmed turns** (`turns[]` with origin `user` or `ai_confirmed`) each require a Reasoning-turn object (`R`), or an explicit review note explaining why the turn is not a material cognitive change. `ai_unreviewed` turns are treated the same way, with their origin stated.
- `turn_hints` are leads only. Create an `R` object from a hint only when the spec's own test (material cognitive change, argumentative dependency) is met by source evidence.
- Key segments (`key_ranges`) mean "this stretch is central", not that every message in it was judged individually.
- **Review** (`review_policy: mandatory`) still applies. Present segmentation as taken from the outline, so review can concentrate on what Stage 2 added: core questions, relations, and turn explanations.

## Staleness and identity

The capture extension may renumber `message_id` when a conversation is re-captured, which `source-format.md` does not allow for curated sources. Therefore, before using an outline:

1. Compare `outline.json.source.fingerprint` with the fingerprint of the current `source/conversation.jsonl`.
2. If they differ, map each outline reference by content using `source.message_fingerprints` (`[message_id, fingerprint]` or `[message_id, fingerprint, platform_message_id]`, in order). A reference whose fingerprint no longer appears may be mapped by `platform_message_id`; that means the same message with changed text and needs author confirmation.
3. Never use an unmatched reference by position or ID alone. Report it and ask.

Fingerprint: the string `speaker + "\n" + content`, measured in UTF-16 code units (JavaScript string `length` and `charCodeAt`; in Python, encode as `utf-16-le` and take 2 bytes per unit). FNV-1a 32-bit over the units (offset `0x811c9dc5`, XOR then multiply by `0x01000193`, mod 2^32), written as `<unit count in base 36>-<8 lowercase hex digits>`. The whole-source fingerprint applies the same function to the per-message fingerprints joined with `|`, using `all` as the speaker.

## `outline.ai.json` (AI suggestion)

Produced by an AI on the author's request, either written directly into the workspace by an AI with repository access or returned as a file and imported. The extension validates it (format, unknown message IDs, coverage of author messages, source fingerprint) before showing it as suggestions. Its format is defined by the extension (`apps/chrome-extension/README.md`). Git history keeps earlier versions; `outline.json.ai_suggestion` records which version the author reviewed (`content_fingerprint`) and a compact snapshot of it.

Analysis must not read `outline.ai.json` as author judgment, and must not prefer it over `outline.json`.

---

## 繁體中文摘要

`outline.json` 是作者在分析之前，用 After-thinking Capture 擴充功能的標記頁自己做的骨架：主題在哪裡切、方向在哪裡轉、哪些訊息或段落重要，以及備註。

- **它決定骨架，不取代第一、二階段。** 裡面沒有核心問題、主題關係、起點立場、轉向的前因後果；各階段照樣產出完整結果，只是建立在這份骨架上，不再自己重新切分。
- **每一項都記來源。**
  - `user`：作者自己標的。
  - `ai_confirmed`：AI 建議、作者確認或改過的。
  - 這兩種都算作者的判斷。
  - `ai_unreviewed`：AI 建議、作者沒有動的，預設當作同意；`seen: false` 代表從沒出現在作者的畫面上。
  - `turn_hints`：程式提示，不算作者的判斷。
  - 被作者否決的 AI 建議記在 `ai_suggestion.rejected`，不能當成作者沒考慮過。
- **第一階段**：關鍵和備註只用來找證據，不能當成作者的起點立場；沒標主題不代表不在範圍內。
- **第二階段**：主題切分照骨架走，可以補結構，但不能自己合併、拆開、搬動主題，有不同看法要提出來問。確認過的轉向都要有轉向紀錄（`R`），不成立的要說明理由；`turn_hints` 只是線索。確認流程照舊，但重點放在 AI 補上的內容。
- **原文變過時**：先比對內容指紋，用指紋或平台訊息編號對回去，對不上的要問，不能只照編號或位置用。
- **`outline.ai.json`** 是 AI 的建議，只給作者審閱用，分析時不讀，也不能優先於 `outline.json`。
