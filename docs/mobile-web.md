# After-thinking Mobile Tagging (GitHub Pages)

> **Repository boundary:** This web interface belongs to After-thinking. It does not build articles; that is a separate display-AT project. The AT repository is public, while the GitHub conversation repository is selected by each individual user at runtime.

## What this is

A mobile-first browser editor for After-thinking conversation records, served as static assets from `apps/mobile-web/`. It uses the **existing AT data layout and `outline.json` v6 schema**, not a separate backend or a second annotation format.

Workflow:

1. Open the mobile editor from the AT GitHub Pages site.
2. Enter a **user-chosen** conversation repository (`owner/repository`), branch, and a narrow-scope fine-grained GitHub personal access token. Nothing is prefilled with an individual's private repository.
3. The browser reads `inbox/index.jsonl` and optionally `inbox/labels.json`.
4. The library displays the **original captured conversation title**, metadata and tagging/processing statuses. User questions can be expanded and collapsed **inside the list**, or the full question list can be loaded from the source conversation.
5. Select a conversation to read `source/conversation.jsonl` and any existing `outline.json`. The reader supports direct topic, key-point, turn, note, and assistant-heading annotations. A primary topic and multiple related topics map to the existing `topics[].messages` and `topics[].also_messages`.
6. The app serializes the compatible `outline.json` version 6 format and writes it into **the selected private data repository**, not into the public AT code repository. It attempts to refresh `inbox/index.jsonl` after saving.
7. Users may alternatively load local `conversation.jsonl` and `outline.json` and download the updated outline without connecting GitHub.

## Deployment

The GitHub Actions workflow `.github/workflows/mobile-pages.yml` validates the app on pull requests and, after merging to `main`, deploys **only** `apps/mobile-web/` to the repository's GitHub Pages site.

A repository administrator must select **Settings → Pages → Build and deployment → Source: GitHub Actions**. This cannot be inferred from repository code alone. A successful deployment will show its actual URL under the workflow run and Pages settings. Do not assume a link is active before the workflow succeeds.

The published artifact contains `index.html`, `style.css`, `app.js`, `core.js` and `github.js`. No conversation dataset, GitHub token, personal repository name or personal profile is bundled.

## Authentication and privacy

- A public GitHub Pages site cannot securely store an OAuth client secret. The first release uses a **fine-grained personal access token** entered directly by the user into the site.
- Limit the token to **only the selected data repository**, with **Contents: Read and write** permission. Do not grant access to all repositories.
- The token is held in JavaScript memory for the current tab session and sent only to `https://api.github.com` using the Authorization header. It is not written into query parameters, browser localStorage, source code, or a GitHub commit.
- Closing or refreshing the page ends this login; re-entry is expected.
- The static editor explicitly uses a Content Security Policy with same-origin scripts and only the GitHub REST API as an external connection.
- The public page is a **publicly readable application**, but its presence does not make a user's private data repository public. However, never enter private tokens on an untrusted fork or an unfamiliar domain.
- Future authorization with a GitHub App would require an additional trusted authorization service. A static Pages site alone is not that service.

## Source protection

1. Reads and saves the **source file's SHA**. Before write, source SHA must still match.
2. Reads and saves the **outline file's SHA**. Before write, both the checked SHA and GitHub's native conditional update must match; otherwise the editor refuses to overwrite.
3. For existing outlines, compares their source fingerprint, message count and boundary IDs against the current conversation. Ambiguous or unknown future outline versions are blocked from rewriting.
4. Preserves existing unrelated v6 fields (e.g. key ranges, provenance, custom fields), and keeps unresolved section markers available for manual review.
5. Marks changes occurring during an in-flight save as unsaved so they can be saved again.
6. A successful outline write followed by a failed index update is reported as a **partial success**, not a total save failure.
7. Credentials and conversation data remain in volatile browser state; an unsaved-edit warning is shown before navigating away.

## First-release scope and known limitations

Available: original-title conversation library, compact/expanded question preview, search/sort/status filters, continuous reading, native Markdown and conservative numbered-heading outline, per-message primary and related topics, key point, turn, note, per-section key markers, topic overview, AI suggestion confirmation/rejection, keyboard J/K navigation, local JSONL import, outline export, guarded GitHub save.

Not yet editable from mobile: conversation processing statuses/custom labels in `inbox/labels.json`, **new** multi-message key-range creation, full AI suggestion file import, packed ZIP editing, and manual reattachment of unmatched section marks. Those fields are preserved when possible rather than silently deleted. Complex source reconciliation remains a desktop task.

This is a production-data-connected **candidate**; end-to-end testing on a separate throwaway GitHub repository and actual mobile Safari/Chrome devices is still required before merging.

## 中文摘要

- 手機版放在公開的 AT 主倉庫；文章生成仍由 display-AT 負責。
- **公開網站只放程式，不放任何人的對話、倉庫預設名稱或 Token。**
- 對話、標記資料仍在使用者自己指定的 GitHub 倉庫中，瀏覽器透過 GitHub API 直接讀寫。
- 清單使用原始對話標題，並可原地展開／收合使用者提問；標記頁保留一個主要主題＋多個相關主題、關鍵、轉向、備註、AI 小節重點。
- 儲存前核對來源及標記檔版本，遇到衝突不覆蓋。關閉分頁不保留 Token；私人資料不要提交到公開 AT。
- 網站需在 AT 倉庫的 Settings → Pages → Source 選 GitHub Actions，合併及部署成功後才能正式取得網址。
