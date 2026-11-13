# Agent-directed capture by original conversation URL (PoC)

This branch adds an **optional, user-authorized workflow** for a computer-use agent to direct the existing AT Capture extension at one specific conversation. It does not build a remote-control service or an always-on daemon.

## What it does

1. A human or agent opens the extension popup and clicks **「依網址擷取（Agent / 遠端操作）」**.
2. Paste the **original private conversation URL**, not a public share/snapshot URL.
3. Click **「開啟原始對話並擷取」** and grant Chrome permission **only for that conversation's AI website**. The extension opens exactly that conversation in a new desktop Chrome tab, where the user must already be authenticated.
4. The existing `captureViaApi` / `captureConversation` and `finalizeCapture` functions read messages and attempt to recover attachments.
5. Return to the Agent capture tab; it shows the platform, conversation ID, message counts, capture method and missing-file warnings.
6. Click **「確認上傳私人 GitHub」**. Existing `checkRepo`, `commitFiles`, `buildJsonl`, `buildMetadata`, `buildState` and `repoGuideFiles` create a new workspace with the ordinary capture index record. A public repo is rejected.
7. Copy the resulting JSON (including GitHub folder URL) for the agent, or click the extension's desktop tagging link.

The page also accepts a prefilling URL in `chrome-extension://<your-extension-id>/agent.html?url=<encoded-original-url>`, **but does not automatically start capture or upload on page load**. An agent still has to press the buttons and accept permissions.

## Where to get the original URL

For ChatGPT, an original private chat URL commonly has the form `https://chatgpt.com/c/<conversation-uuid>`; Claude often uses `https://claude.ai/chat/<uuid>`; Gemini uses `https://gemini.google.com/app/<id>`; and Grok uses `https://grok.com/c/<uuid>`.

**Mobile app's Share button is not the same as Copy Browser URL.** It may create a public share snapshot. ChatGPT `/share/` URLs, Claude public share URLs, and Gemini `g.co/gemini/share/` URLs are not accepted by this PoC. Instead, open the *existing* chat in the mobile browser signed into the same account and copy its address bar URL. On your desktop, the same account must also be signed in.

Never assume that a public share link's UUID can be substituted into an original private conversation URL. They identify different resources.

## Quick test

1. Load the extension from this branch through `chrome://extensions` (Load unpacked), and configure a **private GitHub repository** in AT's existing settings.
2. On desktop Chrome, sign in to ChatGPT/Claude/Gemini/Grok, and manually open an eligible original conversation to confirm access.
3. Open AT's extension popup → **依網址擷取**.
4. Paste the exact URL and click **開啟原始對話並擷取**.
5. After Chrome opens the target, switch back to the AT Agent capture tab and examine the counts.
6. If the capture is incomplete, read the warning before checking the exception box. If you are testing GitHub uploads, use a disposable private test repository.
7. Confirm upload; verify `source/conversation.jsonl` plus `inbox/index.jsonl` in GitHub. Copy the JSON report and check the GitHub URL.

For an agent-driven trial, ask a *locally connected computer-use agent* to navigate this flow using the existing desktop browser. A cloud-only chat instance cannot see or operate the user's computer without a local connection and permission.

## Expected safeguards and limitations

- Host validation is strict: HTTPS, allowlisted AI domains and known private conversation paths only; query strings and fragments are removed.
- Page redirect/mismatch causes capture to stop rather than importing an unrelated conversation.
- No auto-upload: target and message count are visible before GitHub upload; incomplete captures require explicit acknowledgement.
- Credentials stay in the extension's existing local storage; the exported JSON result does not contain the GitHub token.
- **Only new workspaces**: if the folder already exists, this PoC refuses to overwrite it. Safe incremental recapture and preserving existing outlines require a later change.
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
