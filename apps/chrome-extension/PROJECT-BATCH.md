# ChatGPT Project batch capture (experimental)

This feature extends the existing Gemini batch page to capture conversations from **one selected ChatGPT Project**. It uses the user's own logged-in Chrome session, and uploads to the already-configured **private GitHub repository**.

## User flow

1. Open the Chrome extension's **Batch capture** page and choose **ChatGPT Project**, or open a ChatGPT Project page and use **Batch capture this project**.
2. Grant Chrome the requested `chatgpt.com` site access. The feature does not automatically require broad access to other AI platforms.
3. Select a Project, load its conversation list, review which discussions will be captured and start.
4. Each successful capture is saved in `inbox/` with its source; existing captures are skipped using `inbox/index.jsonl`. The project identifier is also recorded in capture metadata.
5. Review any failures and verify the destination repository instead of assuming that seeing a browser preview means an upload succeeded.

## Implementation and limits

- `chatgpt-project.js` handles Project URL parsing, Project discovery, conversation listing and load checks.
- `batch.js` implements the Gemini/ChatGPT source switch, processing and repository writes.
- Project discovery may try an **undocumented ChatGPT internal endpoint**, with DOM fallback. The endpoint and page markup can change without warning.
- Static JavaScript/Node tests do **not** prove authenticated end-to-end correctness. Real Chrome testing should cover permissions, Projects with many threads, pagination, duplicate detection, attachment recovery, and partial failures.
- Never silently change destinations or upload user conversations into the public After-thinking method repository.
- The Agent URL capture path is a separate flow and should remain a distinct entry point; batch capture must not overwrite or substitute Agent results.
