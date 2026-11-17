# After-thinking executor guide

This file is the executor entry point. Do not treat README prose as runtime rules.

## Conversation capture / download requests (Agent default)

This section applies **before any Stage execution** when an agent is asked to save an existing ChatGPT, Claude, Gemini, or Grok conversation.

- Interpret "下載對話", "抓對話", "擷取對話", "保存到 AT", "備份對話", "capture/download/save this conversation" as **capture the original conversation into the user's already-configured private GitHub analysis repository**, unless the user explicitly requests a local/offline file or ZIP.
- Use the extension popup's **「Agent：指定網址 → 上傳 GitHub」** button to open `apps/chrome-extension/agent.html`. Do **not** choose the similarly named **「僅離線備份：下載 ZIP（不上傳 GitHub）」** control. A downloaded ZIP is *not* proof of GitHub upload.
- Supply the user's **original private conversation URL**. A public share/snapshot link is not interchangeable with the user's private URL; never invent a matching private ID.
- The agent entry's default **「擷取並上傳 GitHub」** action captures and directly uploads when no capture warnings are present. If a warning is present, pause for review and explicit confirmation; do not auto-accept missing messages or attachments.
- Verify success using the agent page's structured result: `phase: "success"`, `ok: true`, and an actual `github_url`/`folder`. Report message and attachment counts and warnings. Never claim upload succeeded solely because a local file exists or a capture preview appeared.
- If GitHub is not configured, the target folder already exists, or the upload fails, **report the specific blocker**. Do not silently fall back to ZIP, change repository, generate a duplicate folder, or overwrite analysis.
- Only generate/download a local ZIP when the user explicitly asks for an offline file, ZIP, or file to send elsewhere.

See [Agent capture flow](apps/chrome-extension/AGENT-CAPTURE.md) for the precise UI contract. AT's six analysis stages begin only after capture if explicitly requested.

## Read order

1. Read `docs/runtime.md`.
2. Read `state.yaml` in the selected discussion workspace.
3. Resolve `next_action` and the current Stage.
4. Read that Stage's canonical spec under `specs/`.
5. Read only the cross-Stage documents referenced by the runtime/spec.
6. Load only the inputs listed by the current Stage spec.

The six files under `specs/` are the normative Stage contracts. They define Stage inputs, fields, enums, output shape, review policy, and execution exit criteria.

Cross-Stage rules live under `docs/`: source identity and mutation, state transitions, stable object IDs, corrections, uncertainty, analysis boundaries, common output metadata, and workspace writes.

User analysis belongs in the `analysis_repository` selected by the user. This repository contains the method, templates, and de-identified examples; it is not the default destination for user discussion data.

Initialize a workspace from `templates/`. Write a Stage output before updating `state.yaml`. Never reuse a retired object ID. Never preserve an old `confirmed` status across a substantive rerun.

If the user changes an interpretation during review, persist that material change in `corrections.yaml` before rerunning or confirming the Stage.
