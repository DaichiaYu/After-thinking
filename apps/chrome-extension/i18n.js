// UI strings for the After-thinking Capture pages.
// Load order: i18n.js, locales/*.js, i18n-apply.js, then the page scripts.
// T("key", arg0, arg1, …) returns the string for the current language.
const ATI18n = (() => {
  const DEFAULT = "zh-TW";
  const STORAGE_KEY = "at.lang";
  // Language of text that is written into saved files (outline.json summary and notes).
  // Kept fixed so that files stay comparable across devices and UI languages.
  const STORED_LANG = "zh-TW";
  const dict = {};
  const names = { "zh-TW": "中文", en: "English" };

  function detect() {
    try {
      const saved = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
      if (saved && names[saved]) return saved;
    } catch (e) { /* storage unavailable */ }
    const nav = typeof navigator !== "undefined" && navigator.language ? navigator.language : DEFAULT;
    return /^zh\b/i.test(nav) ? "zh-TW" : "en";
  }

  const api = { lang: detect(), names, DEFAULT, STORED_LANG };

  api.add = (lang, strings) => { dict[lang] = Object.assign(dict[lang] || {}, strings); };

  api.format = (template, args) => String(template).replace(/\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g, (all, n, one, other) => {
    const v = args[+n];
    if (one === undefined) return v === undefined ? "" : String(v);
    return Number(v) === 1 ? one : other;
  });

  api.t = (key, ...args) => {
    const s = (dict[api.lang] && dict[api.lang][key]) ?? (dict[DEFAULT] && dict[DEFAULT][key]) ?? key;
    return api.format(s, args);
  };

  // Run fn with a fixed language, for text that is saved into files.
  api.withLang = (lang, fn) => {
    const prev = api.lang;
    api.lang = lang;
    try { return fn(); } finally { api.lang = prev; }
  };
  api.stored = (fn) => api.withLang(STORED_LANG, fn);

  api.setLang = (lang) => {
    if (!names[lang]) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
    location.reload();
  };

  // Fill static page text: data-i18n (text), data-i18n-html (trusted markup from the locale files),
  // data-i18n-title / -placeholder / -aria-label / -alt (attributes).
  api.applyDom = (root) => {
    root.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = api.t(n.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-html]").forEach((n) => { n.innerHTML = api.t(n.getAttribute("data-i18n-html")); });
    for (const attr of ["title", "placeholder", "aria-label", "alt"]) {
      root.querySelectorAll("[data-i18n-" + attr + "]").forEach((n) => n.setAttribute(attr, api.t(n.getAttribute("data-i18n-" + attr))));
    }
    if (root.documentElement) root.documentElement.lang = api.lang === "zh-TW" ? "zh-Hant" : api.lang;
    root.querySelectorAll("[data-lang-switch]").forEach((sel) => {
      sel.textContent = "";
      for (const [code, label] of Object.entries(names)) {
        const o = document.createElement("option");
        o.value = code; o.textContent = label; o.selected = code === api.lang;
        sel.append(o);
      }
      sel.addEventListener("change", () => api.setLang(sel.value));
    });
  };

  return api;
})();
const T = ATI18n.t;
