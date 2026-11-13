# Agent-directed capture to private GitHub (PoC)

This branch adds an **optional, user-authorized workflow** for a computer-use agent to direct the existing AT Capture extension at one specific conversation. It does not build a remote-control service or an always-on daemon.

## What it does

1. A user or computer-use agent opens AT's popup and clicks **「Agent：指定網址 → 上傳 GitHub」**. This primary GitHub path is visually separated from offline ZIP.
2. Paste the **original private conversation URL**, not a public share/snapshot URL.
3. Leave **「擷取完整就自動上傳 GitHub」** enabled (default), click **「擷取並上傳 GitHub」**, and grant Chrome permission for the selected AI website. The extension opens the exact original conversation on desktop Chrome, where the user must already be signed in.
4. The existing `captureViaApi` / `captureConversation` and `finalizeCapture` functions read messages and attempt to recover attachments.
5. The agent capture page displays the platform, conversation ID, message counts, method and warnings. **If there are no warnings, the one-click action proceeds directly to private GitHub upload.**
6. If there are warnings or auto-upload was intentionally unchecked, review and click **「確認上傳 GitHub（不下載 ZIP）」**. The existing `checkRepo`, `commitFiles`, `buildJsonl`, `buildMetadata`, `buildState` and `repoGuideFiles` create a new private repository workspace.
7. Read the on-screen result JSON, verify `phase: success`, `ok: true` and `result.github_url`, then report the GitHub folder. A separate desktop tagging link remains available.

The page also accepts a prefilling URL in `chrome-extension://<your-extension-id>/agent.html?url=<encoded-original-url>`, **but does not automatically start capture or upload on page load**. An agent still has to press the buttons and accept permissions.

## Agent intent and UI contract

When the user says "download/capture/save/backup this conversation" or 「下載／擷取／抓取／保存對話」 **without asking for a file**, the destination is the configured **private GitHub repository**, not the local Downloads folder. The legacy popup button **「僅離線備份：下載 ZIP（不上傳 GitHub）」** is reserved for requests explicitly mentioning local/offline files or ZIPs.

The agent page emits machine-readable JSON in `<pre data-at-role="agent-status">`. During the task it reports `phase` values such as `capturing`, `review_required`, `uploading`, `success`, `capture_failed` or `upload_failed`. A verified success includes `ok: true` and a `result` object with `repo`, `folder`, `github_url`, `messages`, attachment totals and warnings. The result is also visible in `#result-json` for agents that can read the page but not the extension state.

Never assert GitHub success from the existence of a ZIP. Never fall back to ZIP on error, auto-accept missing data, invent private URLs from public share IDs or generate a duplicate folder to avoid conflicts.

## Where to get the original URL

For ChatGPT, an original private chat URL commonly has the form `https://chatgpt.com/c/<conversation-uuid>`; Claude often uses `https://claude.ai/chat/<uuid>`; Gemini uses `https://gemini.google.com/app/<id>`; and Grok uses `https://grok.com/c/<uuid>`.

**Mobile app's Share button is not the same as Copy Browser URL.** It may create a public share snapshot. ChatGPT `/share/` URLs, Claude public share URLs, and Gemini `g.co/gemini/share/` URLs are not accepted by this PoC. Instead, open the *existing* chat in the mobile browser signed into the same account and copy its address bar URL. On your desktop, the same account must also be signed in.

Never assume that a public share link's UUID can be substituted into an original private conversation URL. They identify different resources.

## Quick test

1. Load the extension from this branch through `chrome://extensions` (Load unpacked), and configure a **private GitHub repository** in AT's existing settings.
2. On desktop Chrome, sign in to ChatGPT/Claude/Gemini/Grok, and manually open an eligible original conversation to confirm access.
3. Open AT's extension popup → **Agent：指定網址 → 上傳 GitHub**.
4. Paste the exact URL and click **擷取並上傳 GitHub** (auto-upload is enabled by default).
5. After Chrome opens the target, return to the AT Agent tab. If no warnings occur, it uploads automatically; otherwise it pauses.
6. If capture is incomplete, read its warning and do **not** let the Agent auto-accept it. For testing, use a disposable private repository.
7. Verify `source/conversation.jsonl` and `inbox/index.jsonl` in GitHub and check the JSON success result.

For an agent-driven trial, ask a *locally connected computer-use agent* to navigate this flow using the existing desktop browser. A cloud-only chat instance cannot see or operate the user's computer without a local connection and permission.

## Expected safeguards and limitations

- Host validation is strict: HTTPS, allowlisted AI domains and known private conversation paths only; query strings and fragments are removed.
- Page redirect/mismatch causes capture to stop rather than importing an unrelated conversation.
- Auto-upload happens **only** after pressing **擷取並上傳 GitHub** and only when no warnings are present; any capture warning pauses for review.
- Credentials stay in the extension's existing local storage; the exported JSON result does not contain the GitHub token.
- **Only new workspaces**: an existing folder causes a safe failure. Never change the folder name silently to avoid a conflict; preserve existing outlines and analysis.
- Chrome web session must already be logged in. No session/account switching, CAPTCHA bypass or 2FA automation is implemented.
- The existing per-platform parsers may change when the AI sites change; count/attachments/scroll warnings need real-world verification.
- Gemini's earlier-message capture and recovered original timestamps may still vary depending on page loading.
- The desktop AT tagging page is still an extension page; a phone-accessible tagging web app is **a separate planned feature**.
- No desktop agent/browser-control E2E test was performed here. A local browser session with the extension installed is required.

## Local static test

`node apps/chrome-extension/tests/agent-url.test.js`

This validates URL parsing and checks static wiring, **not real capture or upload**.

## Future agent-friendly interface

Once the UI PoC works, move capture+upload into a background task, expose a narrowly scoped local command/MCP tool, emit structured status and maintain a per-conversation upsert/update policy. The agent should only select a URL and execute an approved capture job; it should not need to interpret conversation content to save it.
