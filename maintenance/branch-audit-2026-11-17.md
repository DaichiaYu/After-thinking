# Branch audit — 2026-11-17

> Point-in-time maintenance note, based on `main` at `830631af414e777976e627acff220912a5e225a0`.
> This is a **branch classification and static source review**, not a claim that real Chrome/GitHub workflows have passed end-to-end tests. Do not merge or delete branches just because they appear in this list.
>
> 維護備註：本文件將「歷史分支」與「仍有待整合功能」分開列出；僅做程式碼與 Git 歷史檢查，未宣稱真實瀏覽器流程已實測完成。

## Needs integration or targeted follow-up

| Branch | Comparison to audit base (`main...branch`) | Classification | Next action |
| --- | --- | --- | --- |
| `feat/i18n-tagging` | ahead 1 / behind 0 | **Unmerged, current candidate** | Fix the localization issues below, run regression checks, then consider a focused merge |
| `feat/agent-url-capture-poc` | ahead 22 / behind 18 | **Unmerged, active PoC** (PR #6 open) | Update from main, review overlapping popup/manifest changes, test real browser permission + capture + private GitHub write before merging |
| `feat/chatgpt-project-batch` | ahead 10 / behind 18 | **Unmerged, experimental** | Preserve ChatGPT Project batch discovery/capture separately; do not merge the entire branch blindly because it also contains an earlier version of Agent capture |
| `docs-readme-v0.8-review` | ahead 1 / behind 74 | **Historical v0.8 documentation draft with selectively useful corrections** | Do not wholesale merge outdated README text. Selectively restore factual fixes noted below |

### Why Agent and ChatGPT Project branches are not interchangeable

Both branches contain Agent capture UI changes. Comparing `feat/agent-url-capture-poc...feat/chatgpt-project-batch` gives **ahead 1 / behind 13**: the Project branch has distinct batch functionality, but its shared Agent code is older than the Agent PoC branch.

Recommended sequence: start from current main; integrate and verify the Agent workflow; then port the **Project-only** changes (`chatgpt-project.js`, Gemini/ChatGPT batch selection and corresponding UI/tests) into that updated baseline. Project discovery uses a ChatGPT internal endpoint (`/backend-api/gizmos/.../conversations`) with DOM fallback; verify against the live site before claiming support.

## Historical branches — do not re-merge

These five branch heads are direct ancestors of the audited main (`ahead 0`). They are historical checkpoints, not missing features.

| Branch | Comparison to main | Note |
| --- | --- | --- |
| `capture-v0.7.0-tagging` | ahead 0 / behind 88 | Historical capture/tagging milestone; PR #1 merged |
| `capture-v0.8.0-review` | ahead 0 / behind 79 | Historical v0.8 integration milestone |
| `feat/mobile-tagging-pages-clean` | ahead 0 / behind 8 | Intermediate mobile Pages preparation |
| `feat/mobile-tagging-pages` | ahead 0 / behind 6 | Mobile Pages work; PR #7 merged |
| `feat/mobile-remember-device` | ahead 0 / behind 3 | Device remembering and unsaved drafts already contained in main |

These two branches are also **historical PRs**, but have diverged commit histories after their PR content was integrated. Their positive ahead counts alone **do not prove missing features**:

| Branch | Comparison | Evidence |
| --- | --- | --- |
| `feat/tagging-workspace-v2` | ahead 6 / behind 25 | PR #2 merged; main includes workspace/portable ZIP modules and tests |
| `feat/tagging-attachment-preview` | ahead 12 / behind 19 | PR #5 merged; main includes attachment preview modules and tests |

For both: prefer present-day main over an old wholesale branch merge. Recheck any individual change before porting it. No branch has been deleted.

## Internationalization audit — `feat/i18n-tagging`

What is implemented:

- The desktop **conversation library/tagging page** (`apps/chrome-extension/tag.html` and its dependent tagging scripts) uses `ATI18n.t()`, `data-i18n`, and `data-i18n-*`.
- `locales/zh-TW.js` and `locales/en.js` each have **525 matching keys**. Static inspection found matching placeholder indices and no Chinese characters in English values; all referenced keys resolve, including the dynamically selected date-format keys.
- Language preference uses `localStorage["at.lang"]`, then `navigator.language`; browser Chinese variants use `zh-TW`, other languages default to English. Switching reloads the tagging page.
- Saved `outline.json` summary/numbering text is intentionally generated in fixed `zh-TW` via `ATI18n.stored()`, independently of the UI language.

Open issues / merge checks:

1. **Coverage incomplete:** popup, batch capture, GitHub settings/options, capture-side messages, manifest description and the **mobile Pages app** are not internationalized by this branch. The locale README explicitly excludes most of these. Language switching from the tagging page into an untranslated extension page produces a mixed-language experience.
2. **English summary display still Chinese:** `tag.js` calls `outputText()` to render the visible summary, while `outputText()` always delegates to `ATI18n.stored(outputTextBody)`. Consequently the on-screen preview is fixed in Traditional Chinese even with English selected. Separate the display-localized summary from the persisted summary rather than changing the file format by accident.
3. **Locale-dependent persisted reason:** `tag-workspace-data.js` produces `S.unmatchedSections[].reason` with `T(...)`, then copies those objects to `outline.json` as `unmatched_section_key_points`. The saved reason text can thus change with UI language despite the fixed-language storage policy. Prefer a stable reason code and translate it only when rendering; preserve backward compatibility for older outlines.
4. **Runtime coverage still needed:** the existing `tests/i18n.test.cjs` checks dictionary parity, placeholders, reference keys, browser detection and formatting, but not live DOM translation, unsaved edits during a switch, navigation across pages, or save/load output across both languages.
5. **Documentation:** after merging i18n, update any README statements that claim the entire extension is Traditional-Chinese-only; distinguish tagging-page coverage from full-product support.

### Documentation correction from the old v0.8 branch

`docs-readme-v0.8-review` contains a useful factual caveat missing from the opening of main's extension README: after first use, `ensureGeminiRecorder()` registers the `at-gemini-recorder` content script with `persistAcrossSessions: true` on Gemini pages. Therefore “the extension **never listens in the background**” is too categorical. Clarify the Gemini-only recorder exception and its local/no-external-transmission behavior.

The old branch also clarifies installation from the repository's `apps/chrome-extension` folder, while main's README still suggests only a standalone `after-thinking-capture` folder. Port that instruction if packaging remains as currently structured, without reverting other newer README changes.

## Suggested order

1. Fix the two i18n language/storage inconsistencies and run both-language tagging regressions.
2. Merge the scoped desktop tagging localization once verified, and update its README scope.
3. Rebase/reconcile Agent PoC against the new main; test permission prompts, unsupported/share URLs, incomplete capture warnings, duplicate prevention, and authenticated GitHub uploads.
4. Port ChatGPT Project batch functionality onto the updated Agent/main baseline, with an explicit warning about unstable internal-site APIs.
5. Expand locale coverage to popup, batch, settings, Agent, and mobile Pages in separate changes. Keep the source conversation text unchanged.
6. Apply the useful v0.8 README factual corrections without reviving its older product descriptions.

**Historical classification is informational:** it is not a recommendation to delete branch refs. Re-run comparisons after any merge because ahead/behind counts are relative to the audit snapshot.

## Integration update — 2026-11-17

All three primary candidate workstreams were reconciled against the current main and merged:

- PR #8 (desktop localization and stable storage): `77b6d6ec63cfd06c847bfcc31d3cc76393619cfb`; Node tests passed. Also corrected local-vs-central ZIP header validation exposed by the existing corruption test.
- PR #9 (Agent private-URL capture): `3106257289bac973a8a5615f3cfc2cbaf254dbdd`; brought forward without replacing newer popup/tagging functions.
- PR #10 (ChatGPT Project batch): `6e5a119e6b3cac542789d7b515e4d5f9c51dc859`; integrated Project-only functionality after Agent, keeping Gemini batch.

These are **code integration results**, not evidence of full authenticated Chrome end-to-end testing. The original experiment branches and earlier Git comparison counts above remain as historical snapshots. Popup, batch, settings, Agent and mobile interface localization is still incomplete; this is the next separate follow-up.
