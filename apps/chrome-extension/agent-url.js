// AT Agent URL validation, also usable in Node tests.
// Only original, authenticated conversation URLs are accepted. Public share
// links and arbitrary sites must never be silently fetched by the extension.
(function (scope) {
  "use strict";
  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const rules = {
    "chatgpt.com": { platform: "chatgpt", path: new RegExp("^(?:/g/[^/]+)?/c/(" + UUID + ")/?$", "i") },
    "chat.openai.com": { platform: "chatgpt", path: new RegExp("^(?:/g/[^/]+)?/c/(" + UUID + ")/?$", "i") },
    "claude.ai": { platform: "claude", path: new RegExp("^/chat/(" + UUID + ")/?$", "i") },
    "gemini.google.com": { platform: "gemini", path: /^\/(?:app|gem\/[^/]+)\/([0-9a-f]{10,})\/?$/i },
    "grok.com": { platform: "grok", path: new RegExp("^/c/(" + UUID + ")/?$", "i") }
  };
  function inspect(input) {
    if (typeof input !== "string" || !input.trim() || input.length > 4096)
      return { ok: false, reason: "請提供有效的原始對話網址。" };
    let u;
    try { u = new URL(input.trim()); }
    catch (_) { return { ok: false, reason: "網址格式不正確。" }; }
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return { ok: false, reason: "只允許 HTTPS 原始對話網址，不允許憑證、連接埠或其他協定。" };
    const rule = rules[u.hostname.toLowerCase()];
    if (!rule) return { ok: false, reason: "只支援 ChatGPT、Claude、Gemini、Grok 的原始對話網址。" };
    if (/^\/(?:share|s)\//i.test(u.pathname) || u.pathname.includes("/share/"))
      return { ok: false, reason: "這是公開分享頁面。請改用登入後的私人對話網址。" };
    const match = u.pathname.match(rule.path);
    if (!match) return { ok: false, reason: "這不是可識別的原始對話網址。請在瀏覽器開啟該對話後，複製網址列的連結。" };
    // Strip query/fragment to avoid leaking tokens and unrelated parameters.
    return {
      ok: true,
      platform: rule.platform,
      conversation_id: match[1].toLowerCase(),
      url: u.origin + u.pathname.replace(/\/$/, ""),
      origin_pattern: u.origin + "/*"
    };
  }
  const api = Object.freeze({ inspect });
  scope.ATTarget = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
