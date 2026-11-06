# After-thinking Capture v0.8.0

> **Capture ChatGPT, Claude, Gemini, and Grok conversations as After-thinking source files, then tag them yourself before any AI analysis.**

[繁體中文版](#繁體中文版)

After-thinking Capture is the Chrome extension for [After-thinking](../../README.md). It handles the first two steps of the workflow:

1. **Capture** — copy a whole ChatGPT, Claude, Gemini, or Grok conversation into After-thinking source files (`conversation.jsonl` and `metadata.yaml`), uploaded to your own private GitHub repository or downloaded to your computer.
2. **Tag** — before handing the conversation to an AI for analysis, decide its skeleton yourself: group it into topics, mark key points, key segments, turns, and notes. The result is saved as `outline.json`, and After-thinking's Stages 1–2 follow it instead of re-segmenting the conversation. For long conversations, an AI of your choice can draft the tags first (`outline.ai.json`); you review them, and every tag keeps a record of whether it came from you or from the AI.

The extension reads the current tab only when you click its icon (`manual_click` mode); it never listens in the background. Conversations go only to the GitHub repository you configure, with no other server in between.

The extension's interface is in Traditional Chinese. Button and label names below are quoted in Chinese with an English gloss.

## What's new in v0.8.0

- **Attachment originals on all four platforms**: files and images in ChatGPT, Claude, and Grok conversations are now downloaded into `source/attachments/` like Gemini's, instead of leaving only a marker. [Details](#files-and-images-v080-all-platforms)
- **Grok support** (`grok.com`): single capture reads the full conversation from Grok's own data, including original times. Grok's citation tags are turned into `[來源]` markers. [Details](#grok-notes-v080)
- **Preview before choosing**: the tagging page opens with every question you asked (numbered; ones longer than 50 characters are collapsed), so you can see the conversation before deciding "several topics" or "one topic". If an AI has already drafted tags, its view is shown there too.
- **「這篇不用整理」 (no need to organize)**: a third choice for small talk, duplicates, or conversations with little in them. Pick a reason; no `outline.json` is written, and the list shows the status.
- **Also related to another topic**: a message keeps one main topic, and can additionally be marked as related to other topics (`also_messages` in `outline.json`).
- **Review tools**: on the tagging page, jump up and down through pending key points and turns (AI suggestions you haven't touched, plus program hints), and confirm or reject them in place. A collapsible outline on the right lists every key point and turn.
- **Conversation list**: sort by conversation time, capture time, last tagged time, or label order, grouped by date; preview the questions in each conversation; set a status (未處理 to do / 已整理 done / 不用整理 skip), your own labels, and a note; open the original chat. [Details](#conversation-list-v080)
- The 「連選」 (range select) switch is gone: Shift-click, or 「選到這裡」 (select to here) on the message you want to stop at.
- The popup shows 「打開標記頁」 (open tagging page) when the conversation you're on was already captured.

## What's new in v0.7.0

- **Tagging page**: pick a captured conversation and tag it yourself — topics (by time or by topic view), key points and **key segments**, turns, and notes. AI replies follow your previous message by default and can be categorized separately. [Details](#tagging-conversations-new-in-v070)
- **Let an AI draft the tags first**: give instructions to an AI with GitHub access, or download a request file for any AI; import its `outline.ai.json`, check it, and apply. Untouched suggestions count as agreed but stay marked as AI-generated; changed or removed ones are recorded as rejected. [Details](#let-an-ai-draft-the-tags-first)
- **Turn hints**: keyword hints in Traditional Chinese, Simplified Chinese, English, and Japanese, plus hints when the AI's reply opens like a course correction. Hints only count once you confirm them.
- **Safe re-capture**: tags store content fingerprints and platform message IDs, so they never silently point at the wrong message after a re-capture.
- **ChatGPT layout markup** (`<box>`, `<Cite/>`, `<Link/>` …) is converted to plain text while capturing. [Details](#chatgpt-layout-markup-v070)
- **Capture log fix**: batch capture, single capture, and the tagging page no longer overwrite each other's records in `inbox/index.jsonl`.

## Features

| Feature | What it does |
|---|---|
| Single capture | Open a conversation and click the icon. It scrolls through, expands collapsed long messages, and lets you untick messages you don't want |
| Batch capture (Gemini) | Reads every conversation in Gemini's sidebar and captures them one by one into `inbox/`, skipping ones already captured |
| Attachment originals | Downloads uploaded files and images and AI-generated images on all four platforms (v0.8.0; Gemini since v0.6.0) |
| Original times (Gemini) | Recovers each message's original time |
| Capture log | `inbox/index.jsonl` records every capture, so you know what has been captured and what has been tagged |
| Tagging | Preview your questions first, then group into topics or mark key points, key segments, turns, and notes; saved as `outline.json` (v0.7.0; preview, also-related topics and review tools in v0.8.0) |
| Conversation list | Sort and group captured conversations, preview their questions, track status, labels, and notes in `inbox/labels.json` (v0.8.0) |
| AI-drafted tags | Let any AI draft the tags as `outline.ai.json`, then accept, edit, or reject them on the tagging page; each tag records its origin (v0.7.0) |
| ChatGPT markup cleanup | Converts ChatGPT's layout markup to plain text with short markers while capturing (v0.7.0) |
| Repository guide | Writes an `AGENTS.md` at the repository root so any AI reading your data later knows how it is organized |

## Supported platforms and languages

| Item | Support |
|---|---|
| Platforms | ChatGPT, Claude, Gemini, Grok (`grok.com`; Grok inside X is not supported) (batch capture and recovered original times are Gemini-only for now) |
| Extension interface | Traditional Chinese only, for now |
| Conversation content | Any language. Text is copied as-is, never translated or rewritten |
| Site interface language | Traditional Chinese, Simplified Chinese, English. The extension must recognize the site's "Show more" / "Show less" buttons to expand collapsed long messages, and Gemini batch capture must recognize the sidebar's "Show more". If the site is set to another language (e.g. Japanese): ChatGPT, Claude, and Grok are read from the site's own data first and are unaffected; on Gemini, or whenever scroll reading is used, collapsed long messages may stay collapsed and may not be detected — check message lengths after capturing |
| "Possible turn" hints on the tagging page | Traditional Chinese, Simplified Chinese, English, Japanese — for your wording and for the AI's response (word lists under "Tagging conversations") |
| AI drafting the tags | Any AI. Writing directly into the repository needs an AI that can read and write GitHub; the download-a-file route works with any AI that accepts a file |

## Install (developer mode)

1. Unzip to get the `after-thinking-capture` folder.
2. Go to `chrome://extensions`.
3. Turn on "Developer mode" (top right).
4. Click "Load unpacked" and choose the `after-thinking-capture` folder.
5. Optionally pin After-thinking Capture from the puzzle-piece icon in the toolbar.

## GitHub setup (first time)

1. Create a **private** repository on GitHub and tick "Add a README".
2. In `chrome://extensions`, find After-thinking Capture → "Details" → "Extension options", or click 「GitHub 設定」 (GitHub settings) in the extension popup.
3. Follow the steps on the settings page to create a fine-grained token with read and write access to that repository's Contents only, paste it, and click 「儲存並測試連線」 (save and test connection).

## Usage

1. Open a ChatGPT, Claude, Gemini, or Grok conversation (no need to scroll).
2. Click the extension icon. It scrolls from top to bottom, expands collapsed long messages, then scrolls back. Don't click elsewhere while it reads, or the popup will close.
3. Check the message list and untick anything you don't want.
4. Click 「上傳到 GitHub」 (upload to GitHub), review the confirmation, then click 「確定上傳」 (confirm). The files are written in one commit to `discussions/<discussion-id>/`: `source/conversation.jsonl`, `source/metadata.yaml`, `state.yaml`, `corrections.yaml`.
5. Or click 「只下載檔案」 (download only) to save them to your Downloads folder.
6. After uploading, click 「標記這段對話」 (tag this conversation) to tag it right away (see "Tagging conversations").

## Please test and report

Try one short and one long conversation on each platform and report:

1. Whether the message counts (yours and the AI's) match the real conversation.
2. Whether the first and last messages are correct.
3. Whether `conversation.jsonl` has missing text, duplicates, or stray button text (such as "Copy" or "Regenerate").
4. For Claude: whether thinking or tool results got mixed into answers.
5. For Gemini: whether "Show thinking" content got mixed in, and whether answers with code picked up button text such as "content_copy".

## Tagging conversations (new in v0.7.0)

Read through a conversation yourself before handing it to an AI, and group it into topics or mark what matters. The page itself **never calls an AI**: numbering, truncation, and turn hints are all done by plain code. If you want an AI to draft the tags first, see "Let an AI draft the tags first" below.

Three ways to open it (each opens a new tab):

- After a single capture finishes uploading, click 「標記這段對話」 (tag this conversation).
- At the bottom of the extension popup, click 「標記擷取過的對話」 (tag captured conversations) and pick one from the list (tagged ones are marked; you can search titles).
- After a batch capture finishes, click 「開始標記對話」 (start tagging).

Without GitHub, use 「從電腦開啟 conversation.jsonl」 (open conversation.jsonl from your computer) on the list page; select `outline.json` (and an AI's `outline.ai.json`, if you have one) at the same time to continue earlier tagging.

### How to tag

1. The page opens with a preview: every question you asked, numbered, with ones over 50 characters collapsed (「全部展開」 expands all). Dividers show long breaks; an orange edge marks questions where a turn may have happened. If an AI has drafted tags, a line above says how it sees the conversation. Then choose (you can change this later; tags are kept):
   - 「聊了好幾件事」 (**several topics**): group messages with topic tags; important messages can still be marked as key.
   - 「一直在聊同一件事」 (**one topic throughout**): no grouping, just mark key content.
   - 「這篇不用整理」 (**no need to organize**): pick a reason (small talk, duplicate, little information, other) and an optional note. Nothing is written to `outline.json`; the status goes into `inbox/labels.json` and shows on the list. Only for conversations opened from GitHub.
2. Every message is numbered (from 001). Your messages are shown in full (collapsed only past 1,500 characters); AI replies show the first 200 characters, with 「展開全文」 (show full text) to expand.
3. Several topics:
   - Click the topic tag next to a message to change it; the menu also has 「＋ 新主題」 (new topic).
   - AI replies follow your previous message by default. When the AI drifts off-topic or answers several questions at once, click 「另外分類」 (categorize separately) on that reply; 「改回跟著 00X」 (follow 00X again) in the menu undoes it.
   - To change many messages at once: click a number to select it, then Shift-click another number, or click 「選到這裡」 (select to here, shown when you point at a message), to select everything in between.
   - **Also related**: a message has one main topic. When it also matters to another topic, open its topic menu and add 「也跟這些主題有關」 (also related to these topics). It stays in its main topic; in the by-topic view it also appears, dashed, under the other topic. After-thinking groups by main topic and consults these messages when working on the other topic.
   - Topic names and notes can be edited on the topic cards or directly in the headings of the 「照主題」 (by topic) view. Click × to delete a topic; its messages go back to 「還沒標」 (untagged).
   - The by-topic view puts each topic together while keeping message order, and shows what was skipped, e.g. 「中間跳過 007–008（B 養貓花費）」 (skipped 007–008, topic B).
4. Key points (both modes): any message can be marked with 「標為關鍵」 (mark as key). They are split automatically by speaker into 「你說的關鍵」 (your key points) and 「AI 說的關鍵」 (the AI's key points). In one-topic mode you can filter to key points only.
   - When a whole stretch matters, mark it as a **key segment**: click the number of its first message, Shift-click the last one (or use 「選到這裡」), then 「★ 整段標成關鍵」 (mark whole segment as key). The segment runs to the AI's reply after the last selected message, and is shown with a yellow bar on the right and a 「★ 關鍵段落 013–018」 (key segment) label on its first message (× removes it). Overlapping or adjacent segments are merged. This works in both modes.
5. Also in both modes:
   - 「＋備註」 (add note): write why a message matters.
   - Turns: the page shows 「可能轉向？（程式提示：…）」 (possible turn? — program hint) on your message in two cases: your message contains one of the words below (「你的用詞」, your wording), or the AI's reply right after it opens like a course correction (「AI 的回應像在修正方向」, e.g. "That changes things a lot, earlier I assumed…", "Then I'll substantially revise my earlier recommendation"). People often change direction without any fixed phrase, but the AI's acknowledgement is usually obvious. Click 「確認」 (confirm) for it to count as your judgment, or × if it isn't a turn. You can also add one yourself with 「＋標轉向」 (mark turn). Unconfirmed hints are listed separately as "possible turns (program hints, not confirmed by you)" and never mixed with your confirmed turns. AI replies themselves are never marked as turns.

     | Language | Hint words |
     |---|---|
     | Chinese (Traditional) | 其實、不對、改成、改為、算了、等等、等一下、回到剛剛、回到前面、重新想、換個方向 |
     | Chinese (Simplified) | 其实、不对、改为、回到刚刚、换个方向 (words written the same in both scripts, such as 改成 and 算了, also match) |
     | English | actually, on second thought, wait, (with a comma), no wait, never mind, nevermind, scratch that, I was wrong, let me rethink, instead, change of plan(s) |
     | Japanese | 実は、やっぱり、やはり、いや、(with a comma)、待って、訂正、考え直 (考え直す, 考え直したい…) |

     English is case-insensitive and matches whole words only (`instead` does not match `insteadOf`). These words also appear in sentences that aren't turns (e.g. "Actually, that's right"), so they are only hints for you to confirm.

     Phrases checked in the first 150 characters of the AI's reply:

     | Language | AI response phrases |
     |---|---|
     | Chinese (Traditional) | 這樣差很多、我前面是、我剛剛是、修改前面、大幅修改、調整前面、放到旁邊、那我反而、我誤會了、誤解了、原來是這樣 |
     | Chinese (Simplified) | 这样差很多、我刚刚是、调整前面、放到旁边、我误会了、误解了、原来是这样 (plus the shared forms above) |
     | English | I misunderstood, my mistake, that changes, in that case, let me revise, I'll revise, revise my, set aside |
     | Japanese | 誤解して、失礼しました、それなら、それでしたら、見直し、修正します、前の提案 |
   - When two messages are more than 6 hours apart, a divider such as 「隔了 1 天」 (1 day later) is shown (requires original times).
   - **Key point vs. turn**: a key point means the content of that message matters, and is read first. A turn means the direction changed there: the message itself may say little, but what comes before and after must be understood separately, and earlier conclusions may no longer hold.
6. Review tools (both modes), in the bar that stays at the top while you scroll:
   - Choose what to step through: 「待確認」 (pending: AI-suggested key points, key segments, and turns you haven't touched, plus program turn hints), 「關鍵」 (key), 「轉向」 (turns), or 「全部」 (all). Topic assignments are not included, since after an AI draft every message would be pending.
   - ↑ / ↓ (or the K / J keys) jump to the previous or next one, keeping the surrounding messages on screen. For a pending item, 「確認」 (confirm) or 「不是」 (reject) acts on it and moves to the next.
   - 「目錄」 (outline) opens a panel listing every key point and turn with its number, topic, source (yours, AI suggestion, AI suggestion you confirmed, program hint), and the start of the message. Click one to jump to it; pending ones can be confirmed or rejected there. It stays closed unless you open it.
7. Click 「儲存到 GitHub」 (save to GitHub), or press ⌘S / Ctrl+S. Until you save, a draft is kept on this computer; if you close and reopen the page, it asks whether to continue the draft. Edits made while a save is in progress are not treated as saved; you'll be asked to save again.

### Let an AI draft the tags first

For long conversations you don't want to read from the top, ask an AI of your choice to tag a first draft, then review it here. The AI's suggestion is saved as `outline.ai.json` and never written into `outline.json` directly. The 「請 AI 先標一版」 (let an AI draft first) panel at the top of the tagging page offers two ways:

- **Let the AI write into the repository** (for AIs that can read and write GitHub, such as Claude Code, Codex, or Claude with GitHub connected): click 「複製指令」 (copy instructions) and paste them to the AI. The instructions name the repository, branch, folder and format, and allow it to write only `<folder>/outline.ai.json`. When it's done, click 「AI 寫好了，重新讀取」 (the AI is done, reload). The page also reads the latest `outline.ai.json` every time it opens.
- **Download a file for any AI**: click 「下載給 AI 的檔案」 (download file for AI) to get a Markdown file with the instructions and the full numbered conversation, and give it to any AI together with the suggested one-line prompt. Then import the `outline.ai.json` it returns with 「匯入 AI 給的檔案」 (import file), or paste its reply. You can also select `outline.ai.json` together with `conversation.jsonl` on the list page.

Before showing anything, the page checks the suggestion: format, message IDs that don't exist, your messages the AI left out of every topic, and whether the AI saw the same version of the conversation (source fingerprint). Problems are listed, with 「複製給 AI 的修正指令」 (copy fix instructions) to send back to the same AI. If the source doesn't match, the suggestion can only be applied with an explicit warning.

Applying: 「套用 AI 建議」 (apply) when you haven't tagged anything; otherwise 「只補我還沒標的地方」 (fill only what I haven't tagged) or 「整份換成 AI 建議」 (replace everything). AI alternative splits can be switched to with one click, and places the AI was unsure about are listed with links to the messages.

After applying, AI suggestions are shown with dashed borders and a 「建議 ·」 prefix, with the AI's reasons under the message:

- **Leave it**: counts as agreement. It is saved as `ai_unreviewed` ("AI-generated, the user did not object"), together with whether it was ever on your screen.
- **✓ / 確認 (confirm)**, choosing the same topic again, or editing a topic name: saved as `ai_confirmed`. 「全部確認」 (confirm all) does this for everything still untouched.
- **Change or remove it**: becomes your own tag, and the AI suggestion is recorded as rejected.

When the AI writes a new `outline.ai.json` later, the panel shows 「有新的 AI 建議」 (new AI suggestion) and lists how it differs from the version you reviewed. Old versions stay in the repository's Git history. How analysis uses each origin is defined in After-thinking's [`docs/user-outline.md`](../../docs/user-outline.md).

`outline.ai.json` format:

```json
{
  "format": "after-thinking/outline-suggestion",
  "format_version": 1,
  "generated_at": "2026-11-05T07:00:00Z",
  "generated_by": "model name",
  "source_fingerprint": "copied from the instructions",
  "message_count": 24,
  "mode": "multi_topic",
  "topics": [{ "id": "A", "name": "…", "note": "…", "spans": [{ "from": "msg-000001", "to": "msg-000012" }] }],
  "single_topic": null,
  "turns": [{ "message_id": "msg-000011", "reason": "…" }],
  "key_points": [{ "message_id": "msg-000017", "reason": "…" }],
  "key_ranges": [{ "from": "msg-000013", "to": "msg-000018", "reason": "…" }],
  "uncertain": [{ "message_id": "msg-000013", "question": "…" }],
  "alternatives": [{ "label": "…", "topics": [] }]
}
```

Every message of yours must fall inside some topic's `spans`; an AI reply belongs with your previous message unless a span puts it elsewhere. Turns are placed on your message. Display numbers (`"013"`) are accepted as well as message IDs.

### What gets saved

- `<folder>/outline.json` inside the discussion folder; `source/` is never touched.
- Messages are referenced by `message_id`, plus a `summary` that matches the 「交給下一步的資料」 (data for the next step) text at the bottom of the page.
- A content fingerprint is stored for every message. Re-capturing renumbers `message_id` by position, so if an earlier missing message is captured later, every following ID shifts to a different message. When tags are opened, fingerprints are checked: tags are kept only where the content still matches; moved messages are found again by content, or by the platform's own message ID (ChatGPT and Claude have one) when the text itself was cleaned up, and marked 「原文變過，請確認」 (source changed, please check); anything not found is dropped, and the page says how many of each. Tags never silently point at the wrong message.
- Tip: tags saved before this version have no platform message IDs. Before re-capturing a conversation you already tagged, open its tags with this version and save once.
- The matching line in `inbox/index.jsonl` gets `outline_updated_at` and `outline_mode`, which the list page uses to show 「已標記」 (tagged).
- Messages also related to another topic are listed under that topic as `also_messages` (outline version 5). They are not moved out of their main topic.

## Conversation list (v0.8.0)

The page you get from 「標記擷取過的對話」 (tag captured conversations) in the popup.

- **Sort**: 「對話時間」 (conversation time, grouped by month), 「擷取時間」 (capture time, grouped by day, handy for checking what you just did), 「最後標記時間」 (last tagged, by day), or 「標籤順序」 (label order, see below). Your choice is remembered.
- **Question preview**: each conversation shows the first five and last two questions you asked (the end often shows where it ended up), each collapsed past 50 characters. 「看全部 N 個問題」 (see all N questions) reads the conversation and lists every question. Previews are written into `inbox/index.jsonl` at capture time (`preview_questions`); for conversations captured before v0.8.0, 「補上預覽」 (add previews) reads each one once and writes them back.
- **Filter and search**: by status, by 「還沒標記」 (not tagged yet), and by label; search covers titles, previewed questions, and notes.
- **Status, labels, notes**: 「狀態、標籤、備註」 (status, labels, notes) on each conversation. Status is 未處理 (to do), 已整理 (done), or 不用整理 (no need to organize, with a reason). Labels are your own: create, rename, recolor, reorder, and delete them in 「管理標籤」 (manage labels). The order of labels is their priority: with 「標籤順序」 sorting, conversations with the top label come first. Changes save to GitHub automatically after a moment.
- **Back to the original**: 「打開原對話 ↗」 (open original chat) on each conversation and at the top of the tagging page. In the other direction, when you open the popup on a chat that was already captured, it offers 「打開標記頁」 (open tagging page).

Status, labels, and notes are saved in `inbox/labels.json`, separate from the capture log, so the two never overwrite each other:

```json
{
  "format": "after-thinking/conversation-labels",
  "format_version": 1,
  "labels": [{ "id": "l3x9a", "name": "先整理", "color": 0 }],
  "conversations": {
    "inbox/2026-10/gemini-abc123/": { "status": "skip", "skip_reason": "chat", "skip_note": "", "labels": ["l3x9a"], "note": "…", "updated_at": "…" }
  }
}
```

`status` is `done` or `skip` (missing means to do); `skip_reason` is `chat`, `duplicate`, `no_info`, or `other`. The `labels` array order is the priority order.

## Batch capture of Gemini conversations (new in v0.4.0)

Use this when you have many conversations and don't want to open them one by one.

1. Finish the GitHub setup above.
2. Click the extension icon, then 「批量擷取 Gemini 對話」 (batch capture Gemini conversations) at the bottom. A new tab opens.
3. Click 「讀取 Gemini 對話清單」 (read Gemini conversation list). A Gemini window opens, scrolls through the sidebar, and lists every conversation. Ones already captured are marked 「已擷取」 (captured) and unticked by default.
4. Click 「開始擷取」 (start capture). The extension opens each conversation, loads it fully, and uploads it. Each conversation is its own commit, so anything already uploaded is kept if you stop or close the page midway.
5. Keep the Gemini window visible (not minimized) while capturing; you can do other things. Each conversation takes from a few dozen seconds to two minutes.

Upload locations (separate from single capture's `discussions/`):

- `inbox/<year-month>/gemini-<conversation-id>/source/`: `conversation.jsonl`, `metadata.yaml`, and `attachments/` when there are attachments
- The month is **the month the conversation started** (original time); conversations without an original time go to `inbox/undated/`
- `inbox/index.jsonl`: the capture log, one line per capture (title, URL, folder, batch or single, conversation start and last times, message count, characters, attachment count, warnings). Later sorting also starts from this file.
- Conversations captured before v0.5.0 are in `inbox/gemini-<conversation-id>/` (no month); `index.jsonl` is authoritative for locations.

## Knowing what has been captured (v0.5.0)

- Single captures uploaded to GitHub are also logged in `inbox/index.jsonl`, so both capture modes recognize each other.
- Batch list: captured conversations show 「已擷取 10/25（批量）」 (captured Oct 25, batch) or 「（單段）」 (single), greyed out and unticked by default. Tick one again to re-capture it; it overwrites the same folder.
- Single capture popup: opening a conversation that was captured before shows, at the top, when it was captured, how many messages it had, where it is stored, and how many messages have been added since.
- Conversations saved with "download only" are not logged.

## Files and images (v0.8.0: all platforms)

Images and files in conversations are downloaded to `source/attachments/`. Their original position in the message gets a marker pointing to the file, and they are also listed in the `attachments` field of `conversation.jsonl`:

- Files you uploaded: `[附件：報告.pdf → attachments/01.pdf]`, `[圖片：attachments/02.png]`, placed at the start of your message.
- Images the AI generated: `[AI 生成的圖片：attachments/03.png]`, placed at the end of that answer.
- Originals that couldn't be fetched are written as `[附件：報告.pdf（未取得原檔）]` (original not fetched); the capture log's `attachments_missing` counts them, and the batch page mentions them when finished. You can put the files into that `attachments/` folder yourself later.
- Files over 20 MB are not downloaded.
- How each platform is fetched, using the page you are signed in to:
  - **Gemini**: the files and images shown on the page.
  - **ChatGPT**: asks ChatGPT for each file's download link (uploads and generated images), then downloads it. Files made by code execution (`sandbox:/mnt/data/…` links) are not included yet.
  - **Claude**: images and PDFs from Claude's file previews. Claude keeps only the extracted text of pasted text and of some documents (e.g. Word); that text is saved instead — under the original name for text formats (`notes.md`), otherwise as `.txt`, and the `attachments` entry gets `"content_note": "extracted_text"`.
  - **Grok**: uploads and generated images from `assets.grok.com`.
  - Scroll reading (when a site's data can't be read): images visible in the messages are downloaded; file cards are not.
- `metadata.yaml` records `capture.attachments: {total, saved, missing}`; "Copy diagnostic report" in the popup includes the reasons files were missed (no file contents).
- Downloading needs permission for `files.oaiusercontent.com` (ChatGPT) and `assets.grok.com` (Grok). Chrome may ask you to approve this when updating.

## Original times (v0.6.0, Gemini)

Gemini doesn't show times on screen. When a Gemini page loads, the extension listens in on the conversation data the page itself fetches from Google and recovers each turn's time from it (no extra requests are sent; the data stays in that tab).

- Recovered times go into each message's `timestamp`, and into `conversation_created_at`, `conversation_updated_at`, and `time_source` in `metadata.yaml`.
- Gemini's data format isn't public, so times may not be found after Google changes it; such conversations go into `inbox/undated/` and everything else works as usual.
- Single capture: after installing a new version, reload any Gemini page that was already open before times can be captured (the popup tells you).

## Root guide file (AGENTS.md)

On the first upload, an `AGENTS.md` (folder map, file formats, how to find things, rules for AI) is created at the repository root, plus a `CLAUDE.md` pointing to it. Any AI looking through your data later reads it first to understand the repository.

- The file is updated together with the extension when the guide changes.
- To write your own, delete the marker on the first line of `AGENTS.md` and it will never be overwritten. An existing `CLAUDE.md` is never touched.

Conversations in `inbox/` are not yet After-thinking discussion workspaces (no `state.yaml`). After sorting, move the ones you want to analyze into `discussions/`.

Batch capture needs permission to read Gemini pages (`gemini.google.com`); downloading images needs permission for Google image URLs (`googleusercontent.com`, `usercontent.google.com`). Chrome may ask you to approve these when updating from an older version.

## Gemini notes

- Gemini shows only the latest few messages at first; earlier ones load in small batches only when you scroll to the top. The extension keeps scrolling up until the earliest message stays the same several times in a row before reading, so long conversations are slower than on ChatGPT or Claude (possibly a minute or two). Don't click elsewhere meanwhile.
- Gemini is always read by scrolling, and branches can't be detected. For message times, see "Original times".
- Only answer text is captured: thinking, source citation cards, and copy buttons on code blocks are left out. Uploaded files and generated images are saved as originals (see "Files and images").

## ChatGPT layout markup (v0.7.0)

ChatGPT replies can contain its own layout markup (`<box>`, `<row>`, `<text>`, `<badge>`, `<Cite/>`, `<Link/>`, `<Chart/>` …) that the site draws as cards. Captured as text, it was noise. It is now converted while capturing:

- Layout tags are removed and their text kept; card indentation is removed so it isn't mistaken for code.
- `<Link url="…" title="…"/>` → `[title](url)`; `<Entity value="Google"/>` → `Google`; badges → `（text）`; dividers → `---`.
- Citations become short markers: `[來源]` (source), `[引用記憶]` (from memory), `[引用附件第 133–168 行]` (attachment lines 133–168).
- `<AsyncImage query="…"/>` → `[網路圖片：…]` (web image); `<Chart/>` → `[圖表：title]` (chart).
- Only these tag names are touched; any other `<…>`, code blocks, and inline code are left as they are. `metadata.yaml` lists `chatgpt_ui_markup` under `capture.cleaning` when this happened.
- Conversations captured before this version still contain the markup; re-capture them to clean it (see the tip under "What gets saved" first).

## Grok notes (v0.8.0)

- Only `grok.com` is supported. Grok inside X (`x.com/i/grok`) uses a different page and is not captured.
- Grok is read from the site's own data (`/rest/app-chat/…`), the same way the page loads it, so long conversations don't need scrolling and every message keeps its original time. If that fails, the extension falls back to scroll reading, which keeps no times.
- Branches: when you regenerate or edit a message, Grok keeps several versions. The extension captures the path whose messages are on screen; if it can't tell from the page, it takes the newest path and says so in the popup. `metadata.yaml` records which: `capture.branch_captured` is `on_screen_path`, `on_screen_path_then_latest` (continued past what was on screen by taking the newest reply at each fork), `url_rid_path`, or `latest_path`.
- Only answer text is captured; thinking and search steps are left out. Grok's `<grok:render …>` tags are removed, citations become `[來源]` (source) markers, and `metadata.yaml` lists `grok_render_markup` under `capture.cleaning`. Code blocks are left as they are.
- Uploaded files, images, and generated images are downloaded (see "Files and images"). Grok doesn't publish its file fields, so the extension looks for them broadly; if files show as missing, send the diagnostic report.
- Batch capture is Gemini-only for now.

## Known limitations

- Capture rules may break when the sites change and will need updating.
- What's captured is the text shown on screen; Markdown formatting (bold, tables, etc.) becomes plain text.
- Only the path currently shown is captured; other branches created by editing or regenerating are not.
- ChatGPT and Claude times come from the site's data; when scroll reading is used, `timestamp` is null. For Gemini, see "Original times".
- `metadata.yaml` has a new `capture` field; After-thinking's `docs/source-format.md` still needs to document it.
- Re-capturing renumbers `message_id` by position, which `docs/source-format.md` does not allow for curated sources. Tags survive it through content fingerprints (see "What gets saved"), but analysis files that cite message IDs are not remapped.
- Turn hints are exact word matches: they miss turns phrased differently and can match unrelated words (「不對稱」 contains 「不對」), which is why they only count once confirmed.

---

# 繁體中文版

After-thinking Capture 是 [After-thinking](../../README.md) 的 Chrome 擴充功能，負責整理流程最前面的兩步：

1. **擷取**：把 ChatGPT、Claude、Gemini 或 Grok 網頁上的對話完整抓下來，存成 After-thinking 的原文檔（`conversation.jsonl` 和 `metadata.yaml`），上傳到你自己的私人 GitHub 倉庫，或下載到電腦。
2. **標記**：在交給 AI 分析之前，自己先決定這段對話的骨架：分主題，標出關鍵、關鍵段落、轉向和備註。結果存成 `outline.json`，After-thinking 的第一、二階段會照它分析，不再自己重新切分。對話太長時，可以先請你喜歡的 AI 標一版（`outline.ai.json`），你再檢查；每個標記都會記下是你標的還是 AI 標的。

只有你按下擴充功能圖示時才會讀取目前這個分頁（「按圖示模式」，manual_click），不會在背景監聽。對話只會送到你自己設定的 GitHub 倉庫，不經過其他伺服器。

## v0.8.0 新功能

- **四個平台都存附件原檔**：ChatGPT、Claude、Grok 對話裡的檔案和圖片，現在也和 Gemini 一樣下載到 `source/attachments/`，不再只留記號。（見「檔案和圖片」）
- **支援 Grok**（`grok.com`）：單段擷取直接讀 Grok 網站本身的對話資料，連原始時間一起保存。Grok 的引用標籤會換成 `[來源]` 記號。（見「Grok 說明」）
- **先預覽再選**：標記頁一打開先列出你問過的所有問題（有編號，超過 50 字先收起來），看過再決定是「聊了好幾件事」還是「一直在聊同一件事」。AI 已經先標過的話，也會在這裡說它怎麼看。
- **這篇不用整理**：第三個選項，給閒聊、重複、沒什麼資訊的對話。選個理由就好，不產生 `outline.json`，清單上會顯示狀態。
- **也跟別的主題有關**：一句只有一個主要主題，但可以另外標「也跟 B 有關」（`outline.json` 的 `also_messages`）。
- **檢查工具**：標記頁上方可以用上下鍵在待確認的關鍵、轉向之間跳（AI 建議你還沒動的，加上程式提示），直接確認或否決。右邊有可以收起來的目錄，列出所有關鍵和轉向。
- **對話清單**：可以照對話時間、擷取時間、最後標記時間或標籤順序排，依日期分組；預覽每段對話問過的問題；設定狀態（未處理／已整理／不用整理）、自訂標籤和備註；打開原對話。（見「對話清單」）
- 拿掉「連選」開關：按住 Shift 點，或在要選到的那句按「選到這裡」。
- 在已經擷取過的對話上打開擴充功能，會顯示「打開標記頁」。

## v0.7.0 新功能

- **標記頁**：挑一段擷取過的對話自己標記：分主題（照時間或照主題檢視）、關鍵和**關鍵段落**、轉向、備註。AI 回覆預設跟著你的前一句，也可以另外分類。（見「標記對話」）
- **請 AI 先標一版**：把指令給能讀寫 GitHub 的 AI，或下載檔案給任何 AI；匯入它的 `outline.ai.json`，檢查後套用。沒動的建議當作同意，但保留「這是 AI 標的」紀錄；改掉或刪掉的記成你否決了。（見「請 AI 先標一版」）
- **轉向提示**：認得繁體中文、簡體中文、英文、日文的用詞，也會在 AI 的回覆開頭像在修正方向時提示。提示要你確認才算數。
- **重新擷取也不會指錯**：標記存了內容指紋和平台的訊息編號，重新擷取後不會悄悄指到錯的訊息。
- **ChatGPT 的版面語法**（`<box>`、`<Cite/>`、`<Link/>`…）在擷取時轉成一般文字。（見「ChatGPT 的版面語法」）
- **擷取紀錄修正**：批量擷取、單段擷取、標記頁同時寫 `inbox/index.jsonl` 時，不會再互相蓋掉。

## 功能一覽

| 功能 | 說明 |
|---|---|
| 單段擷取 | 打開一段對話，按圖示。自動捲完、展開被摺疊的長訊息，可以取消勾選不要的訊息 |
| 批量擷取（Gemini） | 讀 Gemini 側邊欄的所有對話，一段段抓進 `inbox/`，抓過的自動跳過 |
| 附件原檔 | 四個平台都下載上傳的檔案、圖片和 AI 生成的圖（v0.8.0；Gemini 從 v0.6.0 開始） |
| 原始時間（Gemini） | 補上每一則的原始時間 |
| 擷取紀錄 | `inbox/index.jsonl` 記下每次擷取，知道哪些抓過、哪些已標記 |
| 標記對話 | 先預覽你問過的問題，再分主題或標關鍵、關鍵段落、轉向、備註，存成 `outline.json`（v0.7.0；預覽、也相關的主題、檢查工具是 v0.8.0） |
| 對話清單 | 排序、分組、預覽問題，記處理狀態、自訂標籤和備註（`inbox/labels.json`）（v0.8.0） |
| 請 AI 先標一版 | 讓任何 AI 先標成 `outline.ai.json`，再到標記頁接受、修改或否決；每個標記都記來源（v0.7.0） |
| 清掉 ChatGPT 的版面語法 | 擷取時把 ChatGPT 的版面語法轉成一般文字和簡短記號（v0.7.0） |
| 倉庫指引 | 在倉庫根目錄寫一份 `AGENTS.md`，讓之後來讀資料的 AI 知道怎麼用 |

## 支援的平台和語言

| 項目 | 支援 |
|---|---|
| 平台 | ChatGPT、Claude、Gemini、Grok（`grok.com`；X 裡面的 Grok 不支援）（批量擷取、補原始時間目前只有 Gemini） |
| 擴充功能的介面 | 繁體中文（目前只有這個） |
| 對話內容 | 任何語言都可以，原文照抄，不翻譯也不改寫 |
| 網站本身的介面語言 | 繁體中文、簡體中文、英文。擴充功能要認得網站上「顯示更多」「顯示較少」之類的按鈕，才能自動展開摺疊的長訊息，Gemini 批量擷取也要認得側邊欄的「顯示更多」。網站設成其他語言（例如日文）時：ChatGPT、Claude、Grok 優先直接讀網站資料，不受影響；但 Gemini，以及改用捲動讀取的時候，摺疊的長訊息可能沒展開、也不一定偵測得到，擷取後請檢查訊息長度 |
| 標記頁的「可能轉向」提示 | 繁體中文、簡體中文、英文、日文，看你的用詞和 AI 的回應（提示詞見下方「標記對話」） |
| 請 AI 先標一版 | 任何 AI 都可以。直接寫進倉庫需要能讀寫 GitHub 的 AI；下載檔案的做法，只要 AI 能讀附檔就行 |

## 安裝（開發人員模式）

1. 解壓縮，得到 `after-thinking-capture` 資料夾。
2. Chrome 網址列輸入 `chrome://extensions`。
3. 打開右上角的「開發人員模式」。
4. 按「載入未封裝項目」，選擇 `after-thinking-capture` 資料夾。
5. 建議按工具列的拼圖圖示，把 After-thinking Capture 釘選出來。

## 設定 GitHub（第一次使用）

1. 在 GitHub 建立一個私人（private）倉庫，並勾選「Add a README」。
2. 在 `chrome://extensions` 找到 After-thinking Capture，按「詳細資料」→「擴充功能選項」，或在擴充功能視窗按「GitHub 設定」。
3. 依照設定頁的步驟建立 fine-grained token（只開放這個倉庫的 Contents 讀寫權限），貼上後按「儲存並測試連線」。

## 使用

1. 打開一段 ChatGPT、Claude、Gemini 或 Grok 的對話（不用自己捲動）。
2. 按擴充功能圖示。擴充功能會自動從頭捲到尾、展開被摺疊的長訊息，再捲回原位。讀取時請不要點擊其他地方，否則視窗會關閉。
3. 在清單裡檢查訊息，取消勾選不要的。
4. 按「上傳到 GitHub」，確認視窗裡的內容後按「確定上傳」。檔案會以一個提交（commit）寫入 `discussions/<討論編號>/`，包含 `source/conversation.jsonl`、`source/metadata.yaml`、`state.yaml`、`corrections.yaml`。
5. 也可以按「只下載檔案」，存到電腦的「下載」資料夾。
6. 上傳後可以直接按「標記這段對話」開始標記（見「標記對話」）。

## 請幫忙測試並回報

每個平台各測一段短對話、一段長對話，回報這幾件事：

1. 訊息數量（你、AI 各幾則）和實際對話是否一致。
2. 第一則、最後一則是否正確。
3. 打開 `conversation.jsonl`，內容有沒有缺字、重複，或混進按鈕文字（例如「複製」「重新生成」）。
4. Claude 的回答如果有思考過程或工具結果，有沒有被一起抓進來。
5. Gemini：開啟「顯示思路」的回答，思考內容有沒有混進來；有程式碼的回答，有沒有多出「content_copy」之類的按鈕文字。

## 標記對話（v0.7.0 新增）

在交給 AI 整理之前，自己先看一遍對話，分主題或標出關鍵。標記頁本身**不會呼叫 AI**：編號、截短、轉向提示都是程式做的。想先請 AI 標一版，見下方「請 AI 先標一版」。

打開方式（三種都會開一個新分頁）：

- 單段擷取上傳完成後，按「標記這段對話」。
- 擴充功能視窗最下面按「標記擷取過的對話」，從清單裡挑（已標記的會標出來，可以搜尋標題）。
- 批量擷取完成後，按「開始標記對話」。

沒有用 GitHub 的話，可以在清單頁「從電腦開啟 conversation.jsonl」；要接著標之前的結果，同時選 `outline.json`（有 AI 給的 `outline.ai.json` 也可以一起選）。

### 怎麼標

1. 打開先是預覽：列出你問過的所有問題，有編號，超過 50 字的先收起來（「全部展開」一次打開）。隔很久的地方有分隔線，左邊有橘線的是程式覺得可能轉向的地方。AI 先標過的話，上方會說它怎麼看。看完再選（之後可以改，標記會留著）：
   - **聊了好幾件事**：用主題標籤分組，重要的句子一樣可以標成關鍵。
   - **一直在聊同一件事**：不分組，只標出關鍵內容。
   - **這篇不用整理**：選理由（閒聊、重複了、沒什麼資訊、其他），可以補一句說明。不會寫 `outline.json`，狀態存在 `inbox/labels.json`，清單上會顯示。只有從 GitHub 打開的對話可以用。
2. 每一則都有編號（001 起）。你的發言顯示全文（超過 1500 字才摺疊），AI 的回覆先顯示 200 字，按「展開全文」看完整內容。
3. 聊了好幾件事：
   - 點每句旁邊的主題標籤直接改，選單裡也可以「＋ 新主題」。
   - AI 的回覆預設跟著上一句你的發言。AI 岔題、或一次回答好幾個問題時，按那則回覆的「另外分類」單獨改；選單裡的「改回跟著 00X」可以恢復。
   - 一次改很多句：點編號選取，再按住 Shift 點另一個編號，或在那句按「選到這裡」（滑鼠移到句子上才出現），中間整串一起選。
   - **也跟別的主題有關**：一句只有一個主要主題。它也跟別的主題有關時，打開它的主題選單，在「也跟這些主題有關」加上去。它還是留在主要主題；「照主題」檢視裡，也會用虛線出現在另一個主題下。After-thinking 照主要主題分組，整理另一個主題時也會參考這一句。
   - 主題名稱和補充說明可以在上面的主題卡改，也可以在「照主題」檢視的標題直接改。按 × 刪除主題，那些句子會變回「還沒標」。
   - 「照主題」檢視把同主題放在一起，組內仍照編號排，中間跳過的會顯示「中間跳過 007–008（B 養貓花費）」。
4. 關鍵（兩種方式都可以）：每一句都可以按「標為關鍵」，會照發言的人自動分成「你說的關鍵」和「AI 說的關鍵」。「一直在聊同一件事」的上方可以只看關鍵。
   - 一整段都重要時，標成**關鍵段落**：點第一句的編號，按住 Shift 再點最後一句（或按「選到這裡」），按「★ 整段標成關鍵」。段落會延伸到最後一句之後的 AI 回覆，右邊有一條黃線，第一則上標「★ 關鍵段落 013–018」（按 × 移除）。重疊或相連的段落會合併。兩種方式都可以用。
5. 兩種方式都可以：
   - 「＋備註」：寫下這句為什麼重要。
   - 轉向：兩種情況程式會在你的發言上提示「可能轉向？（程式提示：…）」：你的發言裡有下面這些詞（「你的用詞」），或緊接著的 AI 回覆開頭像在修正方向（「AI 的回應像在修正方向」，例如「這樣差很多耶，我前面是用…」「那我會大幅修改前面的推薦」）。轉向時常常不會用固定的詞，AI 的回應反而比較明顯。按「確認」才算你的判斷，按 × 表示不是；也可以自己按「＋標轉向」。沒確認的提示會另外列成「可能轉向（程式提示，你還沒確認）」，不會混進你確認的轉向。AI 的回覆本身不會被標成轉向。

     | 語言 | 提示詞 |
     |---|---|
     | 中文（繁體） | 其實、不對、改成、改為、算了、等等、等一下、回到剛剛、回到前面、重新想、換個方向 |
     | 中文（簡體） | 其实、不对、改为、回到刚刚、换个方向（和繁體字形相同的也會對到，例如改成、算了） |
     | English | actually, on second thought, wait,（後面接逗號）, no wait, never mind, nevermind, scratch that, I was wrong, let me rethink, instead, change of plan(s) |
     | 日本語 | 実は、やっぱり、やはり、いや、（後面接逗號）、待って、訂正、考え直（考え直す、考え直したい…） |

     英文不分大小寫，而且要是完整的單字（`instead` 不會抓到 `insteadOf`）。這些詞也常出現在不是轉向的句子裡（例如 "Actually, that's right"），所以只當提示，要你確認。

     AI 回覆開頭 150 字內檢查這些說法：

     | 語言 | AI 的回應 |
     |---|---|
     | 中文（繁體） | 這樣差很多、我前面是、我剛剛是、修改前面、大幅修改、調整前面、放到旁邊、那我反而、我誤會了、誤解了、原來是這樣 |
     | 中文（簡體） | 这样差很多、我刚刚是、调整前面、放到旁边、我误会了、误解了、原来是这样（和繁體字形相同的也會對到） |
     | English | I misunderstood, my mistake, that changes, in that case, let me revise, I'll revise, revise my, set aside |
     | 日本語 | 誤解して、失礼しました、それなら、それでしたら、見直し、修正します、前の提案 |
   - 兩則訊息相隔超過 6 小時，會畫一條「隔了 1 天」的分隔線（要有原始時間才有）。
   - **關鍵和轉向差在哪**：關鍵是「這句的內容重要」，整理時優先讀。轉向是「方向從這裡改了」：這句本身不一定重要，但前後要分開理解，前面的結論可能已經不算數。
6. 檢查工具（兩種方式都有），在捲動時固定在上方的那一條：
   - 選要跳的種類：「待確認」（AI 建議、你還沒動的關鍵、關鍵段落、轉向，加上程式提示的可能轉向）、「關鍵」、「轉向」、「全部」。主題分配不算在內，因為 AI 標過之後每一句都會是待確認。
   - ↑／↓（或鍵盤 K／J）跳到上一個、下一個，前後文都還在畫面上。待確認的可以直接按「確認」或「不是」，按完自動跳到下一個。
   - 「目錄」打開右邊的清單：每個關鍵和轉向的編號、主題、來源（你標的、AI 建議、AI 建議你確認過、程式提示）和開頭幾個字，點了跳過去，待確認的也可以在這裡確認或否決。不打開就不佔位置。
7. 按「儲存到 GitHub」（或 ⌘S／Ctrl+S）。還沒儲存前會自動存草稿在這台電腦，關掉再開會問要不要接著用。儲存途中又改的地方不會被當成已儲存，會提示你再存一次。

### 請 AI 先標一版

對話太長、不想從頭看時，可以請你喜歡的 AI 先標一版，再到這裡檢查。AI 的建議存成 `outline.ai.json`，不會直接寫進 `outline.json`。標記頁上方的「請 AI 先標一版」有兩種做法：

- **讓 AI 直接寫進倉庫**（能讀寫 GitHub 的 AI，例如 Claude Code、Codex、有接 GitHub 的 Claude）：按「複製指令」貼給 AI。指令裡寫好倉庫、分支、資料夾和格式，而且只准它寫 `<資料夾>/outline.ai.json`。它寫好後按「AI 寫好了，重新讀取」。之後每次打開標記頁，也都會讀最新的 `outline.ai.json`。
- **下載檔案給任何 AI**：按「下載給 AI 的檔案」，得到一個包含說明和編號好完整對話的 Markdown 檔，連同建議的那句提示詞一起丟給 AI。再用「匯入 AI 給的檔案」匯入它給的 `outline.ai.json`，或貼上它的回覆。也可以在清單頁和 `conversation.jsonl` 一起選。

顯示之前會先檢查：格式、原文裡沒有的編號、你有哪些訊息 AI 沒分到主題、AI 看的是不是同一版原文（原文指紋）。有問題會列出來，並提供「複製給 AI 的修正指令」，貼回同一個 AI。原文對不上時，只能在明確警告下套用。

套用：還沒標過時按「套用 AI 建議」；已經標過時可以選「只補我還沒標的地方」或「整份換成 AI 建議」。AI 另外提的分法可以一鍵切換；AI 拿不定主意的地方會列出來，點編號跳到那則訊息。

套用後，AI 的建議用虛線和「建議 ·」標示，AI 的理由顯示在訊息下方：

- **不動它**：當作你同意，存成 `ai_unreviewed`（「自動生成，使用者沒有反駁」），並記下它有沒有出現在你的畫面上過。
- **按 ✓ 或「確認」**、再選一次同一個主題、或改了主題名稱：存成 `ai_confirmed`。「全部確認」會把還沒動的全部確認。
- **改掉或刪掉**：變成你自己的標記，並記下你否決了這個 AI 建議。

AI 之後又寫了新的 `outline.ai.json`，會顯示「有新的 AI 建議」，並列出和你處理過的那版差在哪。舊版本留在倉庫的 Git 歷史裡。分析時怎麼看待這幾種來源，寫在 After-thinking 的 [`docs/user-outline.md`](../../docs/user-outline.md)。

`outline.ai.json` 的格式見上方英文版。你的每一則訊息都要落在某個主題的 `spans` 裡；AI 回覆預設跟著你的前一則，除非 spans 把它放到別的主題。轉向標在你的訊息上。除了 message_id，也接受顯示編號（`"013"`）。

### 存成什麼

- 存在討論資料夾裡：`<資料夾>/outline.json`，不會動到 `source/`。
- 檔案裡用 `message_id` 指向訊息，另外附一段 `summary`，是畫面最下方「交給下一步的資料」那段文字。
- 也存每則訊息的內容指紋。重新擷取後 `message_id` 是照位置重新編的，前面補抓到一則，後面的編號就會換人；打開標記時會用指紋核對：內容一樣才沿用，換位置的照內容找回來；內容被整理過（例如清掉 ChatGPT 的版面語法）的，用平台自己的訊息編號找回來（ChatGPT、Claude 有）。找回來的標「原文變過，請確認」，找不到的略過，並在上方說明各有幾個。不會悄悄指錯。
- 提醒：這一版以前存的標記沒有平台的訊息編號。已經標過的對話要重新擷取前，先用這一版打開標記、按一次儲存。
- `inbox/index.jsonl` 裡對應的那行會加上 `outline_updated_at`、`outline_mode`，清單頁用它顯示「已標記」。
- 也跟別的主題有關的句子，列在那個主題的 `also_messages`（標記格式第 5 版），不會從主要主題搬走。

## 對話清單（v0.8.0）

從擴充功能視窗的「標記擷取過的對話」打開的那一頁。

- **排序**：「對話時間」（依月份分組）、「擷取時間」（依日期分組，方便確認剛剛做了什麼）、「最後標記時間」（依日期）、「標籤順序」（見下面）。會記住你上次選的。
- **預覽問題**：每段對話列出你問的前五個和最後兩個問題（對話常越聊越偏，最後問的最能看出停在哪），超過 50 字先收起來。「看全部 N 個問題」會讀原文列出全部。預覽在擷取時就寫進 `inbox/index.jsonl`（`preview_questions`）；v0.8.0 以前擷取的，按「補上預覽」讀一次原文補上。
- **篩選和搜尋**：可以依狀態、「還沒標記」、標籤篩選；搜尋會找標題、預覽的問題和備註。
- **狀態、標籤、備註**：每段對話的「狀態、標籤、備註」。狀態有未處理、已整理、不用整理（附理由）。標籤自己取名，在「管理標籤」新增、改名、換顏色、調順序、刪除。標籤的順序就是優先順序：排序選「標籤順序」時，有最上面那個標籤的對話先列出。改完過一下會自動存到 GitHub。
- **回到原對話**：每段對話和標記頁上方都有「打開原對話 ↗」。反過來，在已經擷取過的對話上打開擴充功能，會出現「打開標記頁」。

狀態、標籤和備註存在 `inbox/labels.json`，跟擷取紀錄分開，兩邊不會互相蓋掉。格式見上方英文版：`status` 是 `done` 或 `skip`（沒有就是未處理），`skip_reason` 是 `chat`、`duplicate`、`no_info`、`other`，`labels` 陣列的順序就是優先順序。

## 批量擷取 Gemini 對話（v0.4.0 新增）

對話很多、不想一段段打開時用這個。

1. 先完成上面的 GitHub 設定。
2. 按擴充功能圖示，在最下面按「批量擷取 Gemini 對話」，會打開一個新分頁。
3. 按「讀取 Gemini 對話清單」：會開一個 Gemini 視窗，自動捲完側邊欄，列出所有對話。已經抓過的會標成「已擷取」，預設不勾。
4. 按「開始擷取」：擴充功能會一段段打開對話、往上載入完整內容、上傳。每段都是一個獨立的提交，中途停止或關掉，已經上傳的都還在。
5. 擷取時讓 Gemini 視窗留在畫面上（不要縮到最小），可以去做別的事。每段大約幾十秒到兩分鐘。

上傳位置（和單段擷取的 `discussions/` 分開）：

- `inbox/<年-月>/gemini-<對話編號>/source/`：`conversation.jsonl`、`metadata.yaml`，有附件時還有 `attachments/`
- 月份是**對話開始的月份**（原始時間）；找不到原始時間的放 `inbox/undated/`
- `inbox/index.jsonl`：擷取紀錄。每擷取一次記一行（標題、網址、存放位置、批量或單段、對話開始和最後的時間、訊息數、字數、附件數、警告）。之後分類也從這個檔案開始。
- v0.5.0 以前抓的對話放在 `inbox/gemini-<對話編號>/`（沒有月份），位置以 `index.jsonl` 為準。

## 怎麼知道哪些抓過了（v0.5.0）

- 單段擷取上傳到 GitHub 時，也會記進 `inbox/index.jsonl`。所以不管用哪種方式抓過，兩邊都認得。
- 批量頁的清單：抓過的會顯示「已擷取 10/25（批量）」或「（單段）」，灰色、預設不勾。想重抓可以手動勾回來，會覆蓋同一個資料夾。
- 單段擷取視窗：打開抓過的對話時，最上面會提示什麼時候抓的、當時幾則、存在哪裡，以及之後多了幾則。
- 只用「只下載檔案」存到電腦的，不會記進紀錄。

## 檔案和圖片（v0.8.0：四個平台）

對話裡的圖片和檔案會下載原檔，存在 `source/attachments/`，訊息裡原本的位置留下指向檔案的記號，另外記在 `conversation.jsonl` 的 `attachments` 欄位：

- 你上傳的：`[附件：報告.pdf → attachments/01.pdf]`、`[圖片：attachments/02.png]`，放在你那則訊息的開頭。
- AI 產生的圖：`[AI 生成的圖片：attachments/03.png]`，放在那則回答的結尾。
- 拿不到原檔的寫成 `[附件：報告.pdf（未取得原檔）]`，擷取紀錄的 `attachments_missing` 會記數量，批量頁完成時也會提示。之後可以自己把檔案放進那個 `attachments/` 資料夾。
- 單一檔案超過 20 MB 不下載。
- 各平台怎麼拿（都是用你已登入的頁面）：
  - **Gemini**：頁面上顯示的檔案和圖片。
  - **ChatGPT**：向 ChatGPT 要每個檔案的下載連結（上傳的檔案和生成的圖），再下載。程式執行產生的檔案（`sandbox:/mnt/data/…` 連結）目前還不抓。
  - **Claude**：圖片和 PDF 從 Claude 的檔案預覽下載。貼上的長文和部分文件（例如 Word），Claude 只留抽出來的文字，就存這份文字：文字格式用原檔名（`notes.md`），其他存成 `.txt`，`attachments` 裡記 `"content_note": "extracted_text"`。
  - **Grok**：上傳的檔案和生成的圖從 `assets.grok.com` 下載。
  - 改用捲動讀取時（讀不到網站資料）：訊息裡看得到的圖片會下載，檔案卡片不會。
- `metadata.yaml` 記 `capture.attachments: {total, saved, missing}`；視窗裡「複製診斷報告」會附上沒拿到的原因（不含檔案內容）。
- 下載需要 `files.oaiusercontent.com`（ChatGPT）和 `assets.grok.com`（Grok）的權限，更新時 Chrome 可能會請你同意。

## 原始時間（v0.6.0，Gemini）

Gemini 畫面上不顯示時間。擴充功能會在 Gemini 頁面載入時「旁聽」頁面自己向 Google 拿的對話資料，從裡面找出每一輪的時間（不會另外送出請求，資料只留在那個分頁裡）。

- 找到的時間寫進每則訊息的 `timestamp`，以及 `metadata.yaml` 的 `conversation_created_at`、`conversation_updated_at`、`time_source`。
- Gemini 的資料格式沒有公開，Google 改版時可能會找不到時間；這時對話會放進 `inbox/undated/`，其他照常。
- 單段擷取：裝好新版之後，已經開著的 Gemini 頁面要先重新整理一次，才抓得到時間（視窗會提示）。

## 根目錄的指引檔（AGENTS.md）

第一次上傳時，會在倉庫根目錄建立 `AGENTS.md`（資料夾地圖、檔案格式、怎麼找資料、給 AI 的規則）和一個指向它的 `CLAUDE.md`。之後查資料的 AI 先讀它就知道倉庫怎麼用。

- 擴充功能更新指引內容時會一起更新這個檔案。
- 想自己改寫的話，刪掉 `AGENTS.md` 第一行的標記，之後就不會被覆蓋。已經存在的 `CLAUDE.md` 不會被動到。

inbox 裡的對話還不是 After-thinking 的討論工作區（沒有 `state.yaml`），分類後挑出要分析的，再移到 `discussions/`。

批量擷取需要讀 Gemini 頁面的權限（`gemini.google.com`）；下載圖片需要讀 Google 圖片網址的權限（`googleusercontent.com`、`usercontent.google.com`）。從舊版更新時 Chrome 可能會請你同意。

## Gemini 說明

- Gemini 只會先顯示最近幾則，越早的訊息要捲到頂才會一小批一小批載入。擴充功能會自動一直往上捲，直到最早那則連續幾次都沒變才開始讀，所以長對話會比 ChatGPT、Claude 慢（可能要一兩分鐘），期間請不要點其他地方。
- Gemini 一律用捲動讀取，偵測不到分支。訊息時間見「原始時間」。
- 只擷取回答本文：思考過程、引用來源小卡、程式碼區塊上的複製按鈕都不會抓進來。上傳的檔案和生成的圖片會存原檔（見「檔案和圖片」）。

## ChatGPT 的版面語法（v0.7.0）

ChatGPT 的回覆裡會夾著它自己的版面語法（`<box>`、`<row>`、`<text>`、`<badge>`、`<Cite/>`、`<Link/>`、`<Chart/>`…），網站上畫成卡片，存成文字就是雜訊。現在擷取時會轉成一般文字：

- 版面標籤拿掉、留下裡面的文字；卡片的縮排也拿掉，免得被當成程式碼。
- `<Link url="…" title="…"/>` → `[標題](網址)`；`<Entity value="Google"/>` → `Google`；標籤（badge）→ `（文字）`；分隔線 → `---`。
- 引用留簡短記號：`[來源]`、`[引用記憶]`、`[引用附件第 133–168 行]`。
- `<AsyncImage query="…"/>` → `[網路圖片：…]`；`<Chart/>` → `[圖表：標題]`。
- 只處理這些標籤名稱，其他 `<…>`、程式碼區塊、行內程式碼都不動。有處理時，`metadata.yaml` 的 `capture.cleaning` 會記 `chatgpt_ui_markup`。
- 這一版以前擷取的對話還留著這些語法，重新擷取就會清掉（重新擷取前先看「存成什麼」的提醒）。

## Grok 說明（v0.8.0）

- 只支援 `grok.com`。X 裡面的 Grok（`x.com/i/grok`）是不同的頁面，目前抓不到。
- Grok 直接讀網站本身的對話資料（`/rest/app-chat/…`，和頁面自己載入對話的方式一樣），長對話不用捲動，每一則都有原始時間。讀不到時會改用捲動讀取，那樣就沒有時間。
- 分支：重新生成或編輯訊息後，Grok 會留好幾個版本。擴充功能抓畫面上正在顯示的那條；從畫面判斷不出來時，抓最新的那條，視窗上會說明。`metadata.yaml` 的 `capture.branch_captured` 記下是哪一種：`on_screen_path`（畫面上的路線）、`on_screen_path_then_latest`（畫面以下的部分，在每個分岔取最新的回覆）、`url_rid_path`（網址指定的回覆）、`latest_path`（最新的路線）。
- 只抓回答本文，思考過程和搜尋步驟不抓。Grok 的 `<grok:render …>` 標籤會拿掉，引用換成 `[來源]`，`metadata.yaml` 的 `capture.cleaning` 會記 `grok_render_markup`。程式碼區塊不動。
- 上傳的檔案、圖片和生成的圖片會下載原檔（見「檔案和圖片」）。Grok 沒有公開檔案欄位，擴充功能會廣泛地找；如果顯示沒拿到，請把診斷報告傳過來。
- 批量擷取目前只有 Gemini。

## 已知限制

- 網站改版時，擷取規則可能失效，需要更新。
- 抓到的是畫面上顯示的文字，Markdown 格式（例如粗體、表格）會變成純文字。
- 只抓畫面上目前這條路線，編輯或重新生成造成的其他分支不會被擷取。
- ChatGPT、Claude 從網站資料讀時間；改用捲動讀取時 `timestamp` 是 null。Gemini 見「原始時間」。
- `metadata.yaml` 多了 `capture`（擷取資訊）欄位，After-thinking 的 `docs/source-format.md` 之後需要補上這個欄位的說明。
- 重新擷取時 `message_id` 會照位置重新編號，這不符合 `docs/source-format.md` 對整理過原文的規定。標記能靠內容指紋對回去（見「存成什麼」），但已經寫好、引用了訊息編號的分析檔不會自動跟著改。
- 轉向提示是精確比對字詞：換個說法就抓不到，也可能誤抓含有這些字的詞（「不對稱」裡有「不對」），所以要你確認才算數。
