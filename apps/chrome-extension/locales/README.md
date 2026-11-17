# UI strings

`zh-TW.js` and `en.js` hold every user-facing string of the conversation library and tagging pages (`tag.html` and the scripts it loads). Both files have the same keys.

- In scripts, use `T("key", arg0, arg1)`. In `tag.html`, use `data-i18n="key"` for text, `data-i18n-html="key"` for text with inline markup, and `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-aria-label` for attributes.
- `{0}` inserts an argument. `{0|one|other}` picks a word depending on whether argument 0 equals 1.
- The language is the saved choice (the switch in the top navigation), otherwise the browser language: Chinese browsers get `zh-TW`, everything else gets `en`.
- Text that is saved into `outline.json` (the summary and the numbering note) is always built in `ATI18n.STORED_LANG`, currently `zh-TW`, so saved files do not depend on the UI language.
- When adding a string, add the key to both files. `tests/i18n.test.cjs` fails if the keys or placeholders differ, or if a script uses a key that does not exist.

Not covered yet: the popup, batch capture and settings pages, `capture.js`, and the mobile tagging page.
