# Browser-only AT editor: local folder mode (experimental)

The standalone GitHub Pages editor and the Chrome extension tagging page can work **without connecting GitHub**. In supported Chromium desktop browsers, choose a local AT **conversation folder** containing:

```text
chatgpt-example-conversation/
├── source/
│   └── conversation.jsonl
├── outline.json        # optional; loaded if already present
└── outline.ai.json     # optional; not automatically imported in this mode
```

## How to use

1. Open the browser editor (or the extension's tagging library).
2. Choose **連接本機對話資料夾 / Connect a local conversation folder**.
3. Select the **individual discussion folder**, not the whole repository or `inbox/` folder. Grant read/write access in the browser permission prompt.
4. If an existing outline contains an organization mode, it opens directly in the editor. If there is an unresolved local draft, review/resume it first. Otherwise the first-time setup screen opens.
5. Use **儲存 / Save** to directly update that folder's `outline.json` (no automatic GitHub upload).
6. Use **重新開啟上次資料夾 / Reopen last folder** to request access to the previously selected folder on a later visit. Browsers may require renewed permission.

## Safety and compatibility

- Source and existing outline contents are rechecked before each save. If another editor changed either file, AT refuses to overwrite the newer content. Reopen to reconcile manually.
- The selected directory handle is stored in this browser's IndexedDB; it is **not an authorization to scan the full disk**. Access can be revoked via browser site settings. The web editor's "forget this device" control deletes its stored handle.
- No user conversation or credentials are committed into the public AT repository. Folder mode does not require a GitHub token.
- Support requires a secure context and `showDirectoryPicker` / File System Access API (principally recent desktop Chrome/Edge). Other browsers should use the existing JSONL+outline file picker or offline AT ZIP workflow.
- Folder mode is for editing **one selected discussion at a time**. Recursive listing of an entire AT repository, automatic synchronization, and local attachment previews are **not** part of this initial integration; they require separately tested enhancements.
- IndexedDB permissions and actual file write dialogs need real-browser verification beyond Node tests.
