// After-thinking Capture — ChatGPT 專案（Projects）批量擷取用的函式
// 1. ATProject.parse：從網址認出專案（Node 測試也能用）
// 2. listChatgptProjects / listChatgptProjectChats / waitForChatgptConversation：
//    注入 ChatGPT 頁面執行，必須完全獨立（不能呼叫這個檔案裡的其他函式）。
//    先用網頁自己載入資料的內部介面（不公開、可能會改），拿不到時改讀頁面上的連結。

(function (scope) {
  "use strict";
  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const HOSTS = ["chatgpt.com", "chat.openai.com"];
  // /g/g-p-<hex>[-名稱]/project 或 /g/g-p-<hex>[-名稱]/c/<對話編號>
  const PATH = new RegExp("^/g/(g-p-[0-9a-z]{16,})((?:-[^/]*)?)/(?:project/?$|c/(" + UUID + ")/?$)", "i");

  function parse(input) {
    let u;
    try { u = new URL(String(input || "").trim()); } catch (_) { return null; }
    if (u.protocol !== "https:" || !HOSTS.includes(u.hostname.toLowerCase())) return null;
    const m = u.pathname.match(PATH);
    if (!m) return null;
    const id = m[1].toLowerCase();
    const slug = id + (m[2] || "");
    return {
      project_id: id,
      slug,
      project_url: "https://chatgpt.com/g/" + slug + "/project",
      conversation_id: m[3] ? m[3].toLowerCase() : null,
      on_project_page: !m[3]
    };
  }

  // 專案裡某段對話的網址；沒有專案資訊時用一般對話網址
  function conversationUrl(project, conversationId) {
    const slug = project && (project.slug || project.project_id);
    return slug ? "https://chatgpt.com/g/" + slug + "/c/" + conversationId : "https://chatgpt.com/c/" + conversationId;
  }

  const api = Object.freeze({ parse, conversationUrl });
  scope.ATProject = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Object.assign({}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

// ── 注入到 ChatGPT 頁面：列出自己的專案 ──
async function listChatgptProjects() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PID = /^g-p-[0-9a-z]{16,}$/i;
  const HREF = /\/g\/(g-p-[0-9a-z]{16,})((?:-[^/?#]*)?)\/project/i;
  const MORE = /^(查看更多|顯示更多|显示更多|更多|See more|Show more|More)$/i;
  const log = [];
  const found = new Map();
  const add = (id, name, slug, source) => {
    id = String(id).toLowerCase();
    const old = found.get(id);
    if (old) {
      if (!old.name && name) old.name = name;
      if (old.slug === id && slug && slug !== id) old.slug = slug;
      return;
    }
    found.set(id, { project_id: id, name: name || "", slug: slug || id, source });
  };

  // 1. 內部介面：側邊欄的專案清單
  try {
    const sres = await fetch("/api/auth/session", { credentials: "include" });
    log.push("session:" + sres.status);
    const session = sres.ok ? await sres.json() : null;
    const token = session && session.accessToken;
    if (token) {
      const walk = (o, depth) => {
        if (!o || typeof o !== "object" || depth > 8) return;
        if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
        if (typeof o.id === "string" && PID.test(o.id)) {
          const d = o.display || {};
          const name = d.name || o.name || o.title || "";
          const short = typeof o.short_url === "string" && o.short_url.toLowerCase().startsWith(o.id.toLowerCase()) ? o.short_url : null;
          add(o.id, name, short, "api");
        }
        Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === "object") walk(o[k], depth + 1); });
      };
      let cursor = null;
      for (let page = 0; page < 50; page++) {
        const url = "/backend-api/gizmos/snorlax/sidebar?owned_only=true&conversations_per_gizmo=0" +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
        const res = await fetch(url, { credentials: "include", headers: { Authorization: "Bearer " + token } });
        log.push("sidebar:" + res.status);
        if (!res.ok) break;
        const data = await res.json();
        const before = found.size;
        walk(data, 0);
        cursor = data && (data.cursor || data.next_cursor);
        if (!cursor || found.size === before) break;
      }
    } else {
      log.push("access_token:missing");
    }
  } catch (e) { log.push("api_error:" + e.message); }

  // 2. 頁面上的連結（補名稱，或介面失敗時用）
  const collect = () => {
    document.querySelectorAll('a[href*="/g/g-p-"]').forEach((a) => {
      const m = (a.getAttribute("href") || "").match(HREF);
      if (!m) return;
      const name = (a.innerText || a.textContent || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
      add(m[1], name, m[1] + (m[2] || ""), "page");
    });
    return found.size;
  };
  const started = Date.now();
  let stable = 0, last = -1;
  while (Date.now() - started < 20000 && stable < 3) {
    document.querySelectorAll('nav button, nav [role="button"]').forEach((b) => {
      if (MORE.test((b.innerText || b.textContent || "").trim())) b.click();
    });
    await sleep(1000);
    const n = collect();
    if (n === last && n > 0) stable++; else stable = 0;
    last = n;
    if (!n && Date.now() - started > 12000) break;
  }
  log.push("page_links:" + found.size);
  return {
    projects: Array.from(found.values()).map((p) => ({
      ...p, project_url: "https://chatgpt.com/g/" + p.slug + "/project"
    })),
    log
  };
}

// ── 注入到 ChatGPT 專案頁：列出這個專案裡的所有對話 ──
async function listChatgptProjectChats(projectId) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const HREF = /\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const iso = (t) => {
    if (t === null || t === undefined || t === "") return null;
    const d = typeof t === "number" ? new Date(t * 1000) : new Date(t);
    return isNaN(d) ? null : d.toISOString();
  };
  const log = [];
  const found = new Map();
  const started = Date.now();
  const progress = (n) => { try { chrome.runtime.sendMessage({ type: "list-progress", count: n }); } catch (e) {} };

  // 1. 內部介面：專案的對話清單（分頁）
  let viaApi = false;
  try {
    const sres = await fetch("/api/auth/session", { credentials: "include" });
    log.push("session:" + sres.status);
    const session = sres.ok ? await sres.json() : null;
    const token = session && session.accessToken;
    if (token) {
      let cursor = "0";
      for (let page = 0; page < 200; page++) {
        const url = "/backend-api/gizmos/" + encodeURIComponent(projectId) + "/conversations?cursor=" + encodeURIComponent(cursor);
        const res = await fetch(url, { credentials: "include", headers: { Authorization: "Bearer " + token } });
        log.push("conversations:" + res.status);
        if (!res.ok) break;
        const data = await res.json();
        const items = Array.isArray(data && data.items) ? data.items : [];
        const before = found.size;
        items.forEach((c) => {
          if (!c || typeof c.id !== "string" || !UUID.test(c.id)) return;
          const id = c.id.toLowerCase();
          if (found.has(id)) return;
          found.set(id, { id, title: c.title || "", started_at: iso(c.create_time), updated_at: iso(c.update_time) });
        });
        progress(found.size);
        const next = data && (data.cursor !== undefined ? data.cursor : data.next_cursor);
        if (next === null || next === undefined || next === "" || found.size === before) break;
        cursor = String(next);
      }
      viaApi = found.size > 0;
    } else {
      log.push("access_token:missing");
    }
  } catch (e) { log.push("api_error:" + e.message); }

  // 2. 介面拿不到時：讀專案頁上的對話連結，一直往下捲到數量不再增加
  if (!viaApi) {
    const scope = () => document.querySelector("main") || document.body;
    const collect = () => {
      scope().querySelectorAll('a[href*="/c/"]').forEach((a) => {
        if (a.closest("nav")) return;
        const href = a.getAttribute("href") || "";
        if (!href.toLowerCase().includes(String(projectId).toLowerCase())) return;
        const m = href.match(HREF);
        if (!m) return;
        const id = m[1].toLowerCase();
        const title = (a.innerText || a.textContent || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
        if (!found.has(id)) found.set(id, { id, title, started_at: null, updated_at: null });
        else if (!found.get(id).title && title) found.get(id).title = title;
      });
      return found.size;
    };
    const scroller = () => {
      const first = scope().querySelector('a[href*="/c/"]');
      let el = first ? first.parentElement : null;
      while (el && el !== document.body) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight + 10) return el;
        el = el.parentElement;
      }
      return document.scrollingElement;
    };
    let stable = 0, last = -1;
    const pageStart = Date.now();
    while (stable < 4 && Date.now() - pageStart < 3 * 60 * 1000) {
      const box = scroller();
      if (box) box.scrollTop = box.scrollHeight;
      await sleep(1200);
      const n = collect();
      if (n === last && (n > 0 || Date.now() - pageStart > 15000)) stable++; else stable = 0;
      last = n;
      progress(n);
    }
    log.push("page_links:" + found.size);
  }

  return {
    chats: Array.from(found.values()),
    via: viaApi ? "api" : "page",
    log,
    seconds: Math.round((Date.now() - started) / 1000)
  };
}

// ── 注入到 ChatGPT 對話頁：介面讀不到、要改用捲動讀取前，等訊息出現並穩定 ──
async function waitForChatgptConversation(expectedId) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const started = Date.now();
  let last = -1, stable = 0;
  while (Date.now() - started < 45000) {
    const onPage = location.pathname.toLowerCase().includes(String(expectedId).toLowerCase());
    const n = document.querySelectorAll("[data-message-author-role]").length;
    if (onPage && n > 0) {
      if (n === last) stable++; else stable = 0;
      if (stable >= 2) return { ok: true, count: n };
    }
    last = n;
    await sleep(1000);
  }
  return { ok: false, reason: location.pathname.toLowerCase().includes(String(expectedId).toLowerCase()) ? "empty" : "redirected" };
}

// Node 測試用
if (typeof module !== "undefined" && module.exports) {
  Object.assign(module.exports, { listChatgptProjects, listChatgptProjectChats, waitForChatgptConversation });
}
