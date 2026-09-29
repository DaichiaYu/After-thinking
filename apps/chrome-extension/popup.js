// After-thinking Capture v0.1.1 — 按圖示模式（manual_click）
// 只在使用者按下擴充功能圖示時讀取目前這個分頁，不會背景監聽。

const VERSION = "0.2.0";

function detectPlatform(url) {
  const host = new URL(url).hostname;
  if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
  if (host === "claude.ai") return "claude";
  return null;
}

// ── 注入到對話頁面執行的函式：直接讀網站本身載入的對話資料（優先使用） ──
// 用的是你已登入的頁面向自己網站要資料的同一種方式，只讀這一段對話。
// 這些是網站內部介面，隨時可能改變；失敗時會回傳原因，由捲動讀取接手。
async function captureViaApi(platform) {
  const log = { tried: true, ok: false, steps: [] };
  const note = (step, status) => log.steps.push(step + ":" + status);
  const iso = (t) => {
    if (t === null || t === undefined || t === "") return null;
    const d = typeof t === "number" ? new Date(t * 1000) : new Date(t);
    return isNaN(d) ? null : d.toISOString();
  };
  const getJson = async (url, headers) => {
    const res = await fetch(url, { credentials: "include", headers: headers || {} });
    note(url.split("?")[0].replace(/[0-9a-f-]{36}/g, "<id>"), res.status);
    if (!res.ok) return null;
    return res.json();
  };
  const result = (items, extra) => ({
    items, strategy: extra.strategy, cleaning: [], title: document.title, url: location.href,
    scroll: null, api: { ...log, ok: true }, branches: extra.branches, conversation_created_at: extra.created
  });

  try {
    if (platform === "chatgpt") {
      const m = location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
      if (!m) { note("conversation_id", "not_found"); return { api: log }; }
      const session = await getJson("/api/auth/session");
      if (!session || !session.accessToken) { note("access_token", "missing"); return { api: log }; }
      const conv = await getJson("/backend-api/conversation/" + m[1], { Authorization: "Bearer " + session.accessToken });
      if (!conv || !conv.mapping || !conv.current_node) { note("mapping", "missing"); return { api: log }; }

      // 從目前停留的最後一則往回找，得到畫面上這條路線
      const path = [];
      for (let id = conv.current_node, guard = 0; id && conv.mapping[id] && guard < 100000; guard++) {
        path.push(conv.mapping[id]);
        id = conv.mapping[id].parent;
      }
      path.reverse();

      const visible = (node) => {
        const msg = node.message;
        if (!msg || !msg.author || !msg.content) return false;
        const role = msg.author.role;
        if (role !== "user" && role !== "assistant") return false;
        if (msg.metadata && msg.metadata.is_visually_hidden_from_conversation) return false;
        if (role === "assistant" && msg.recipient && msg.recipient !== "all") return false;
        return msg.content.content_type === "text" || msg.content.content_type === "multimodal_text";
      };
      const items = [];
      path.filter(visible).forEach((node) => {
        const msg = node.message;
        const parts = Array.isArray(msg.content.parts) ? msg.content.parts : [];
        const text = parts.filter((x) => typeof x === "string").join("\n").trim();
        const attachments = parts.filter((x) => typeof x !== "string").length;
        if (!text && !attachments) return;
        const speaker = msg.author.role === "user" ? "author" : "assistant";
        const prev = items[items.length - 1];
        // 同一輪回答被網站拆成好幾段時，合併成一則
        if (prev && prev.speaker === "assistant" && speaker === "assistant") {
          prev.content = (prev.content + "\n\n" + text).trim();
          prev.platform_message_id += " " + msg.id;
          prev.attachments += attachments;
          return;
        }
        items.push({ speaker, content: text, platform_message_id: msg.id, timestamp: iso(msg.create_time), attachments });
      });

      // 分支點：有兩個以上「看得見的」後續訊息的位置
      let branchPoints = 0;
      Object.values(conv.mapping).forEach((node) => {
        const kids = (node.children || []).filter((k) => conv.mapping[k] && conv.mapping[k].message &&
          ["user", "assistant"].includes(conv.mapping[k].message.author.role));
        if (kids.length > 1) branchPoints++;
      });
      return result(items, { strategy: "chatgpt:backend-api", branches: branchPoints, created: iso(conv.create_time) });
    }

    if (platform === "claude") {
      const m = location.pathname.match(/\/chat\/([0-9a-f-]{36})/i);
      if (!m) { note("conversation_id", "not_found"); return { api: log }; }
      const cookieOrg = (document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]{36})/) || [])[1];
      let orgIds = cookieOrg ? [cookieOrg] : [];
      if (!orgIds.length) {
        const orgs = await getJson("/api/organizations");
        orgIds = Array.isArray(orgs) ? orgs.map((o) => o.uuid).filter(Boolean) : [];
      }
      let conv = null;
      for (const org of orgIds) {
        conv = await getJson("/api/organizations/" + org + "/chat_conversations/" + m[1] +
          "?tree=True&rendering_mode=messages&render_all_tools=true");
        if (conv && Array.isArray(conv.chat_messages)) break;
      }
      if (!conv || !Array.isArray(conv.chat_messages)) { note("chat_messages", "missing"); return { api: log }; }

      const byId = Object.fromEntries(conv.chat_messages.map((x) => [x.uuid, x]));
      let path = [];
      if (conv.current_leaf_message_uuid && byId[conv.current_leaf_message_uuid]) {
        for (let id = conv.current_leaf_message_uuid, guard = 0; id && byId[id] && guard < 100000; guard++) {
          path.push(byId[id]);
          id = byId[id].parent_message_uuid;
        }
        path.reverse();
      } else {
        note("current_leaf", "missing_used_index_order");
        path = conv.chat_messages.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
      }

      const textOf = (msg) => {
        if (Array.isArray(msg.content) && msg.content.length) {
          return msg.content.filter((b) => b && b.type === "text" && typeof b.text === "string")
            .map((b) => b.text).join("\n\n").trim();
        }
        return (msg.text || "").trim();
      };
      const items = [];
      path.forEach((msg) => {
        if (msg.sender !== "human" && msg.sender !== "assistant") return;
        const text = textOf(msg);
        const attachments = (msg.attachments || []).length + (msg.files || msg.files_v2 || []).length;
        if (!text && !attachments) return;
        items.push({ speaker: msg.sender === "human" ? "author" : "assistant", content: text,
          platform_message_id: msg.uuid, timestamp: iso(msg.created_at), attachments });
      });

      const childCount = {};
      conv.chat_messages.forEach((x) => { childCount[x.parent_message_uuid] = (childCount[x.parent_message_uuid] || 0) + 1; });
      const branchPoints = Object.values(childCount).filter((n) => n > 1).length;
      return result(items, { strategy: "claude:api", branches: branchPoints, created: iso(conv.created_at) });
    }
  } catch (e) {
    note("error", String(e && e.message || e).slice(0, 80));
  }
  return { api: log };
}

// ── 注入到對話頁面執行的函式：必須完全獨立，不能引用外部變數 ──

// 兩個網站都只會把「螢幕附近」的訊息放進網頁（虛擬捲動），
// 所以這裡會自動從頂端捲到底，一邊展開被摺疊的長訊息，一邊收集，最後捲回原位。
async function captureConversation(platform) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const progress = (text) => { try { chrome.runtime.sendMessage({ type: "capture-progress", text }); } catch (e) {} };

  const PUA = /[\ue000-\uf8ff]/g;
  const EXPAND = /^(顯示較多|顯示更多|显示更多|展開|Show more|Show full message|See more)$/i;
  const COLLAPSE_TAIL = /\n+(顯示較少|顯示更少|显示更少|收合|Show less)\s*$/i;
  const TRUNCATED_TAIL = /\n*…?\s*\n+(顯示較多|顯示更多|显示更多|Show more)\s*$/i;
  const cleaning = new Set();
  const clean = (t) => (t || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  function stripStatusHeader(text) {
    let t = text;
    for (let i = 0; i < 3; i++) {
      const m = t.match(/^([^\n]{1,200})\n[\ue000-\uf8ff]\n\1\n+/);
      if (!m) break;
      t = t.slice(m[0].length);
      cleaning.add("strip_status_header");
    }
    if (/[\ue000-\uf8ff]/.test(t)) cleaning.add("strip_icon_glyphs");
    return t.replace(PUA, "");
  }
  function stripRoleHeading(text) {
    const m = text.match(/^(You said:|ChatGPT said:|你說：|你说：|ChatGPT 說：|ChatGPT 说：)\s*\n?/);
    if (m) cleaning.add("strip_role_heading");
    return m ? text.slice(m[0].length) : text;
  }
  function stripButtons(text) {
    if (COLLAPSE_TAIL.test(text)) { cleaning.add("strip_collapse_button"); text = text.replace(COLLAPSE_TAIL, ""); }
    return text;
  }
  const outermost = (nodes) => nodes.filter((n) => !nodes.some((o) => o !== n && o.contains(n)));

  let strategy = "none";

  // 讀取目前網頁上「已經產生」的訊息，依畫面順序回傳
  function snapshot() {
    const out = [];
    if (platform === "chatgpt") {
      const byRole = document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]');
      const units = outermost(Array.from(document.querySelectorAll("[data-chatgpt-search-unit-key]")));
      if (units.length) {
        strategy = "chatgpt:search-unit-key";
        units.forEach((node) => {
          const isUser = !!node.querySelector("[data-user-message-bubble]") || node.hasAttribute("data-user-message-bubble");
          const id = node.getAttribute("data-chatgpt-search-message-ids");
          out.push({ node, speaker: isUser ? "author" : "assistant",
            raw: stripRoleHeading(clean(node.innerText)), platform_message_id: id ? id.split(/\s+/)[0] : null });
        });
      } else if (byRole.length) {
        strategy = "chatgpt:data-message-author-role";
        byRole.forEach((node) => out.push({ node,
          speaker: node.getAttribute("data-message-author-role") === "user" ? "author" : "assistant",
          raw: clean(node.innerText), platform_message_id: node.getAttribute("data-message-id") }));
      }
    }
    if (platform === "claude") {
      strategy = "claude:user-message+font-claude-response";
      const USER = '[data-testid="user-message"]';
      const nodes = outermost(Array.from(document.querySelectorAll(USER + ", .font-claude-response, .font-claude-message")));
      nodes.forEach((node) => out.push({ node, speaker: node.matches(USER) ? "author" : "assistant",
        raw: stripStatusHeader(node.innerText), platform_message_id: null }));
    }
    return out.map((m) => {
      const content = clean(stripButtons(m.raw));
      return { node: m.node, speaker: m.speaker, content, platform_message_id: m.platform_message_id,
        truncated: TRUNCATED_TAIL.test(content) };
    }).filter((m) => m.content.length > 0);
  }

  // 點開畫面上被摺疊的長訊息（只找按鈕文字剛好是「顯示較多」這類的按鈕）
  async function expandCollapsed() {
    const scope = document.querySelector("main") || document.body;
    let clicked = 0;
    scope.querySelectorAll('button, [role="button"]').forEach((b) => {
      if (EXPAND.test((b.innerText || b.textContent || "").trim())) { b.click(); clicked++; }
    });
    if (clicked) { cleaning.add("expanded_collapsed_messages"); await sleep(250); await frame(); }
    return clicked;
  }

  // 找出真正負責捲動的容器（只看高度，不看 CSS 設定，避免漏掉）
  function findScroller() {
    const first = snapshot()[0];
    let el = first ? first.node.parentElement : null;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if (oy !== "visible" && oy !== "hidden" && el.scrollHeight > el.clientHeight + 20) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  const keyOf = (m) => m.platform_message_id ? "id:" + m.platform_message_id : m.speaker + ":" + m.content;

  // 把新看到的一批訊息接在已收集的清單後面：找出重疊的部分，只加上新的
  let gaps = 0;
  function merge(acc, snap) {
    if (!snap.length) return;
    if (!acc.length) { snap.forEach((m) => acc.push(m)); return; }
    const snapKeys = snap.map(keyOf);
    for (let p = Math.max(0, acc.length - snap.length); p < acc.length; p++) {
      let ok = true;
      for (let j = 0; p + j < acc.length && j < snap.length; j++) {
        if (keyOf(acc[p + j]) !== snapKeys[j]) { ok = false; break; }
      }
      if (ok) {
        for (let j = 0; p + j < acc.length && j < snap.length; j++) {
          if (snap[j].content.length > acc[p + j].content.length) acc[p + j] = snap[j];
        }
        snap.slice(acc.length - p).forEach((m) => acc.push(m));
        return;
      }
    }
    const known = new Set(acc.map(keyOf));
    const fresh = snap.filter((m) => !known.has(keyOf(m)));
    if (fresh.length) { gaps++; fresh.forEach((m) => acc.push(m)); }
  }

  if (!snapshot().length) {
    return { items: [], strategy, cleaning: [], title: document.title, url: location.href, scroll: null };
  }

  const scroller = findScroller();
  const originalTop = scroller.scrollTop;
  const started = Date.now();
  const TIME_LIMIT = 5 * 60 * 1000; // 最多讀 5 分鐘，避免卡死
  const log = {
    scroller: scroller === (document.scrollingElement || document.documentElement) ? "document"
      : scroller.tagName.toLowerCase() + (scroller.getAttribute("data-testid") ? "[" + scroller.getAttribute("data-testid") + "]" : ""),
    flex_direction: getComputedStyle(scroller).flexDirection,
    initial: { top: Math.round(originalTop), height: scroller.scrollHeight, client: scroller.clientHeight },
    top_rounds: 0, top_min_seen: Math.round(originalTop), down_steps: 0, gaps: 0, timed_out: false, seconds: 0
  };

  // 1. 往上捲到開頭。
  //    有些網站的捲動是倒過來的（最底部是 0、往上是負數），
  //    所以這裡不設定「位置 0」，而是設一個極小的值，讓瀏覽器自己停在真正的頂端。
  //    較舊的訊息常是捲到頂才開始載入，所以要等到「最早那則」連續幾次都沒變才算完成。
  let stable = 0, lastFirst = null, lastHeight = -1;
  while (stable < 3 && log.top_rounds < 200 && Date.now() - started < TIME_LIMIT) {
    scroller.scrollTop = -1e9;
    await sleep(600); await frame();
    log.top_rounds++;
    log.top_min_seen = Math.min(log.top_min_seen, Math.round(scroller.scrollTop));
    const snap = snapshot();
    const firstKey = snap.length ? keyOf(snap[0]) : null;
    if (firstKey === lastFirst && scroller.scrollHeight === lastHeight) stable++;
    else stable = 0;
    lastFirst = firstKey; lastHeight = scroller.scrollHeight;
    progress("正在往上載入較舊的訊息（第 " + log.top_rounds + " 次）…");
  }

  // 2. 一路往下捲，邊展開邊收集。捲不動了就代表到底。
  const acc = [];
  const stepSize = Math.max(200, Math.floor(scroller.clientHeight * 0.75));
  while (log.down_steps < 3000) {
    if (Date.now() - started > TIME_LIMIT) { log.timed_out = true; break; }
    await expandCollapsed();
    merge(acc, snapshot());
    progress("已讀取 " + acc.length + " 則訊息…");
    const before = scroller.scrollTop;
    scroller.scrollTop = before + stepSize;
    await sleep(220); await frame();
    log.down_steps++;
    if (Math.abs(scroller.scrollTop - before) < 1) break;
  }
  await sleep(300); await frame();
  await expandCollapsed();
  merge(acc, snapshot());
  log.gaps = gaps;
  log.seconds = Math.round((Date.now() - started) / 1000);

  // 3. 捲回使用者原本的位置
  scroller.scrollTop = originalTop;

  return {
    items: acc.map((m) => ({ speaker: m.speaker, content: m.content, platform_message_id: m.platform_message_id, truncated: m.truncated })),
    strategy,
    cleaning: Array.from(cleaning),
    title: document.title,
    url: location.href,
    scroll: log
  };
}

// 只回報頁面結構和字數，不回傳任何對話文字。
function diagnosePage() {
  const count = (sel) => { try { return document.querySelectorAll(sel).length; } catch (e) { return "error"; } };
  const selectors = [
    "[data-message-author-role]", '[data-message-author-role="user"]', '[data-message-author-role="assistant"]',
    "article", 'article[data-testid^="conversation-turn"]', "article[data-turn]",
    '[data-testid="user-message"]', ".font-claude-response", ".font-claude-message",
    "[data-is-streaming]", "[data-test-render-count]", "main", "[role=main]"
  ];
  const testids = {};
  document.querySelectorAll("[data-testid]").forEach((el) => {
    const v = el.getAttribute("data-testid").replace(/\d+/g, "#");
    testids[v] = (testids[v] || 0) + 1;
  });
  const dataAttrs = {};
  document.querySelectorAll("*").forEach((el) => {
    for (const a of el.attributes) {
      if (a.name.startsWith("data-") && /message|turn|role|author|chat|convers/i.test(a.name)) {
        dataAttrs[a.name] = (dataAttrs[a.name] || 0) + 1;
      }
    }
  });
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    testid: el.getAttribute("data-testid"),
    classes: (el.getAttribute("class") || "").slice(0, 120),
    text_length: (el.innerText || "").length,
    in_main: !!el.closest("main, [role=main]")
  });
  // 相關屬性的「值」範例（例如 user／assistant），只取前 40 個字元，不含對話文字。
  const attrValues = {};
  Object.keys(dataAttrs).forEach((name) => {
    const values = new Set();
    document.querySelectorAll("[" + name + "]").forEach((el) => {
      if (values.size < 6) values.add((el.getAttribute(name) || "").slice(0, 40));
    });
    attrValues[name] = Array.from(values);
  });
  const probe = (sel) => Array.from(document.querySelectorAll(sel)).slice(0, 3).map((el) => ({
    tag: el.tagName.toLowerCase(),
    text_length: (el.innerText || "").length,
    data_attributes: Array.from(el.attributes).filter((a) => a.name.startsWith("data-")).map((a) => a.name),
    contains_user_bubble: !!el.querySelector("[data-user-message-bubble]"),
    inside_user_bubble: !!el.closest("[data-user-message-bubble]"),
    inside_turn_key: !!(el.parentElement && el.parentElement.closest("[data-turn-key]")),
    children_with_unit_key: el.querySelectorAll("[data-chatgpt-search-unit-key]").length
  }));
  const probes = Object.fromEntries([
    "[data-chatgpt-search-unit-key]", "[data-user-message-bubble]", "[data-conversation-role]",
    "[data-turn-key]", "[data-chatgpt-agent-turn-start]"
  ].map((sel) => [sel, probe(sel)]));
  const samples = Array.from(document.querySelectorAll(
    '[data-testid="user-message"], .font-claude-response, .font-claude-message, article, [data-message-author-role]'
  ));
  return {
    host: location.hostname,
    path_shape: location.pathname.replace(/[0-9a-f-]{8,}/gi, "<id>"),
    ready_state: document.readyState,
    user_agent: navigator.userAgent,
    selector_counts: Object.fromEntries(selectors.map((s) => [s, count(s)])),
    data_testids: Object.fromEntries(Object.entries(testids).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    related_data_attributes: dataAttrs,
    attribute_value_samples: attrValues,
    probes,
    first_candidates: samples.slice(0, 4).map(describe),
    last_candidates: samples.slice(-4).map(describe)
  };
}

// ── 產生輸出檔 ──

function defaultDiscussionId(platform, url) {
  const date = new Date().toISOString().slice(0, 10);
  const match = new URL(url).pathname.match(/([0-9a-f]{8})[0-9a-f-]*\/?$/i);
  return [date, platform, match ? match[1].toLowerCase() : "chat"].join("-");
}

function sanitizeId(id) {
  return id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildJsonl(items) {
  return items.map((item, i) => JSON.stringify({
    message_id: "msg-" + String(i + 1).padStart(6, "0"),
    order: (i + 1) * 10,
    speaker: item.speaker,
    content: item.content,
    timestamp: item.timestamp || null,
    platform_message_id: item.platform_message_id,
    ...(item.attachments ? { attachments: item.attachments } : {})
  })).join("\n") + "\n";
}

function buildMetadata(kept, detected, platform, page) {
  const q = (s) => JSON.stringify(s); // JSON 字串也是合法的 YAML 字串
  const list = (arr) => (arr.length ? "[" + arr.join(", ") + "]" : "[]");
  return [
    "source_revision: 1",
    "source_type: conversation",
    "source_format: jsonl",
    "source_files:",
    "  - path: source/conversation.jsonl",
    "    role: primary",
    'message_id_scheme: "msg-000001"',
    "message_id_counter: " + kept,
    "order_field: order",
    "allowed_speakers:",
    "  - author",
    "  - assistant",
    "  - external",
    "capture:",
    "  method: extension",
    "  mode: manual_click",
    "  platform: " + platform,
    "  strategy: " + q(page.strategy),
    "  cleaning: " + list(page.cleaning),
    "  branch_points_detected: " + (page.branches === undefined || page.branches === null ? "null" : page.branches),
    "  branch_captured: current_path",
    "  conversation_created_at: " + (page.conversation_created_at ? q(page.conversation_created_at) : "null"),
    "  api_fallback_reason: " + (page.api && !page.api.ok ? q(page.api.steps.join(", ")) : "null"),
    "  auto_scroll: " + (page.scroll ? "{down_steps: " + page.scroll.down_steps + ", gaps: " + page.scroll.gaps + ", timed_out: " + page.scroll.timed_out + "}" : "null"),
    "  items_still_truncated: " + page.items.filter((i) => i.truncated).length,
    "  items_detected: " + detected,
    "  items_excluded_by_user: " + (detected - kept),
    "  source_url: " + q(page.url),
    "  page_title: " + q(page.title),
    "  captured_at: " + q(new Date().toISOString()),
    "  extension_version: " + q(VERSION),
    "notes: null",
    ""
  ].join("\n");
}

// 用 Blob 網址下載，並等下載真正完成才回報成功。
function download(path, text) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
    chrome.downloads.download({ url, filename: path, conflictAction: "uniquify", saveAs: false }, (id) => {
      if (chrome.runtime.lastError || id === undefined) {
        URL.revokeObjectURL(url);
        reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : "unknown"));
        return;
      }
      const listener = (delta) => {
        if (delta.id !== id || !delta.state) return;
        if (delta.state.current === "complete" || delta.state.current === "interrupted") {
          chrome.downloads.onChanged.removeListener(listener);
          URL.revokeObjectURL(url);
          if (delta.state.current !== "complete") { reject(new Error("下載被中斷")); return; }
          chrome.downloads.search({ id }, (found) => resolve(found && found[0] ? found[0].filename : ""));
        }
      };
      chrome.downloads.onChanged.addListener(listener);
    });
  });
}

// ── 畫面 ──

function showError(message) {
  document.getElementById("platform").hidden = true;
  const el = document.getElementById("error");
  el.textContent = message;
  el.hidden = false;
}

function renderMessages(items, selected) {
  const list = document.getElementById("messages");
  const shape = document.getElementById("shape");
  list.textContent = "";
  shape.textContent = "";

  const refresh = () => {
    const kept = items.filter((_, i) => selected[i]);
    document.getElementById("count-author").textContent = kept.filter((i) => i.speaker === "author").length;
    document.getElementById("count-assistant").textContent = kept.filter((i) => i.speaker === "assistant").length;
    const excluded = items.length - kept.length;
    document.getElementById("count-excluded").textContent = excluded ? "（已排除 " + excluded + " 則）" : "";
    items.forEach((_, i) => {
      list.children[i].classList.toggle("off", !selected[i]);
      shape.children[i].classList.toggle("off", !selected[i]);
    });
  };

  items.forEach((item, i) => {
    const bar = document.createElement("span");
    if (item.speaker === "author") bar.className = "author";
    shape.appendChild(bar);

    const li = document.createElement("li");
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selected[i];
    box.addEventListener("change", () => { selected[i] = box.checked; refresh(); });

    const body = document.createElement("span");
    const who = document.createElement("span");
    who.className = "who " + item.speaker;
    who.textContent = (item.speaker === "author" ? "你" : "AI") + "　";
    const text = document.createElement("span");
    text.className = "text";
    const flat = item.content.replace(/\s+/g, " ") || "（只有附件）";
    text.textContent = flat.length > 60 ? flat.slice(0, 60) + "…" : flat;
    body.append(who, text);

    const len = document.createElement("span");
    len.className = "len";
    len.textContent = item.content.length + " 字";

    label.append(box, body, len);
    li.appendChild(label);
    list.appendChild(li);
  });
  refresh();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

let lastScrollLog = null;
let lastApiLog = null;

document.getElementById("diagnose").addEventListener("click", async () => {
  const status = document.getElementById("diagnose-status");
  try {
    const tab = await getActiveTab();
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: diagnosePage });
    const report = { extension_version: VERSION, last_capture_api: lastApiLog, last_capture_scroll: lastScrollLog, ...injection.result };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    status.textContent = "已複製診斷報告，可以直接貼上。";
  } catch (e) {
    status.textContent = "無法產生診斷報告：" + e.message;
  }
});

async function main() {
  const tab = await getActiveTab();
  const platform = tab && tab.url ? detectPlatform(tab.url) : null;
  if (!platform) {
    showError("這個頁面不是 ChatGPT 或 Claude 的對話。請先打開要整理的對話，再按一次圖示。");
    return;
  }

  // 讀取中持續顯示經過秒數，讓使用者知道程式還在跑
  const statusLine = document.getElementById("platform");
  const startedAt = Date.now();
  const elapsed = () => Math.round((Date.now() - startedAt) / 1000);
  let phase = "正在讀取…";
  const renderPhase = () => {
    statusLine.textContent = "";
    const spin = document.createElement("span");
    spin.className = "spinner";
    spin.setAttribute("aria-hidden", "true");
    statusLine.append(spin, phase + "　已經過 " + elapsed() + " 秒");
  };
  const setPhase = (text) => { phase = text; renderPhase(); };
  const ticker = setInterval(renderPhase, 1000);
  const stopTicker = () => clearInterval(ticker);
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "capture-progress") setPhase(msg.text + "（請不要點擊其他地方）");
  });

  let page;
  try {
    setPhase("正在向網站讀取完整對話資料，請不要點擊其他地方…");
    const [apiInjection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: captureViaApi, args: [platform]
    });
    const viaApi = apiInjection.result || { api: { tried: true, ok: false, steps: ["no_result"] } };
    lastApiLog = viaApi.api;
    if (viaApi.items && viaApi.items.length) {
      page = viaApi;
    } else {
      setPhase("改用捲動讀取，請不要點擊其他地方…");
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: captureConversation, args: [platform]
      });
      page = injection.result;
      page.api = viaApi.api;
    }
    lastScrollLog = page.scroll;
  } catch (e) {
    stopTicker();
    showError("無法讀取這個頁面：" + e.message);
    return;
  }

  stopTicker();
  if (!page.items.length) {
    showError("在這個頁面找不到對話訊息。請按下方「複製診斷報告」，把報告貼給開發者。");
    return;
  }

  const items = page.items;
  // 很短的 AI 訊息很可能是誤抓的頁面文字（例如專案名稱），預設不勾選，讓使用者決定。
  // 直接讀取資料時不會混入頁面文字，全部預設勾選
  const viaApi = !!(page.api && page.api.ok);
  const selected = items.map((item) => viaApi || !(item.speaker === "assistant" && item.content.length <= 10));

  const truncated = items.filter((i) => i.truncated).length;
  document.getElementById("platform").textContent =
    (platform === "chatgpt" ? "ChatGPT" : "Claude") + "｜" + page.title +
    (page.api && page.api.ok ? "｜已直接讀取完整資料" : "｜使用捲動讀取") +
    "｜用時 " + elapsed() + " 秒" +
    (page.branches ? "｜這段對話有 " + page.branches + " 個分支點，只擷取目前這條路線" : "") +
    (page.scroll && page.scroll.gaps ? "｜注意：捲動時可能跳過部分訊息，請檢查清單" : "") +
    (page.scroll && page.scroll.timed_out ? "｜注意：讀取超過 5 分鐘，已提前停止" : "") +
    (truncated ? "｜注意：有 " + truncated + " 則長訊息沒能完整展開" : "");
  renderMessages(items, selected);

  const idInput = document.getElementById("discussion-id");
  idInput.value = defaultDiscussionId(platform, page.url);
  document.getElementById("result").hidden = false;

  const status = document.getElementById("status");
  const uploadBtn = document.getElementById("upload");
  const target = document.getElementById("upload-target");
  const confirmBox = document.getElementById("confirm");
  const openResult = document.getElementById("open-result");

  document.getElementById("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

  // 讀取勾選結果，並檢查討論編號
  const prepare = () => {
    const id = sanitizeId(idInput.value);
    const kept = items.filter((_, i) => selected[i]);
    if (!id) { status.textContent = "請輸入 Discussion ID，只能用英文小寫、數字和連字號。"; return null; }
    if (!kept.length) { status.textContent = "至少要勾選一則訊息。"; return null; }
    idInput.value = id;
    return { id, kept };
  };

  const config = await loadConfig();
  if (config && config.repo && config.token) {
    target.textContent = "上傳到 " + config.repo + " 的 " + normalizeRoot(config.root) + "<討論編號>/";
  } else {
    uploadBtn.disabled = true;
    target.textContent = "還沒設定 GitHub。請按下方「GitHub 設定」。";
  }

  let pending = null;
  uploadBtn.addEventListener("click", async () => {
    const prepared = prepare();
    if (!prepared) return;
    uploadBtn.disabled = true;
    openResult.hidden = true;
    status.textContent = "檢查倉庫中…";
    try {
      const check = await checkRepo(config);
      if (!check.ok) throw new Error(check.message);
      const root = normalizeRoot(config.root);
      const folder = root + prepared.id + "/";
      if (await pathExists(config, check.branch, folder)) {
        throw new Error("倉庫裡已經有「" + folder + "」。為了不覆蓋既有的分析，請換一個討論編號。（接續更新同一段對話會在之後的版本支援）");
      }
      pending = { ...prepared, branch: check.branch, folder };
      document.getElementById("confirm-text").textContent =
        "即將上傳 " + prepared.kept.length + " 則訊息到 " + config.repo + "（私人倉庫）的 " + folder +
        "，會建立 4 個檔案：conversation.jsonl、metadata.yaml、state.yaml、corrections.yaml。確定嗎？";
      confirmBox.hidden = false;
      status.textContent = "";
    } catch (e) {
      status.textContent = "無法上傳：" + e.message;
      uploadBtn.disabled = false;
    }
  });

  document.getElementById("confirm-no").addEventListener("click", () => {
    pending = null;
    confirmBox.hidden = true;
    uploadBtn.disabled = false;
    status.textContent = "已取消，沒有上傳任何東西。";
  });

  document.getElementById("confirm-yes").addEventListener("click", async (event) => {
    if (!pending) return;
    event.target.disabled = true;
    status.textContent = "上傳中…";
    const { id, kept, branch, folder } = pending;
    try {
      await commitFiles(config, branch, [
        { path: folder + "source/conversation.jsonl", content: buildJsonl(kept) },
        { path: folder + "source/metadata.yaml", content: buildMetadata(kept.length, items.length, platform, page) },
        { path: folder + "state.yaml", content: buildState(config, id) },
        { path: folder + "corrections.yaml", content: CORRECTIONS_TEMPLATE }
      ], "After-thinking: capture " + id + " (" + platform + ", " + kept.length + " messages)");
      confirmBox.hidden = true;
      status.textContent = "已上傳 " + kept.length + " 則訊息到 " + config.repo + " 的 " + folder;
      const url = "https://github.com/" + config.repo + "/tree/" + encodeURIComponent(branch) + "/" +
        folder.split("/").filter(Boolean).map(encodeURIComponent).join("/");
      openResult.hidden = false;
      openResult.onclick = () => chrome.tabs.create({ url });
      pending = null;
    } catch (e) {
      status.textContent = "上傳失敗：" + e.message + "（倉庫沒有被修改）";
      event.target.disabled = false;
    }
  });

  document.getElementById("download").addEventListener("click", async (event) => {
    const prepared = prepare();
    if (!prepared) return;
    const { id, kept } = prepared;
    event.target.disabled = true;
    status.textContent = "下載中…";
    const base = "after-thinking/" + id + "/source/";
    try {
      const saved = await download(base + "conversation.jsonl", buildJsonl(kept));
      await download(base + "metadata.yaml", buildMetadata(kept.length, items.length, platform, page));
      const normalized = saved.replace(/\\/g, "/");
      if (normalized.endsWith(base + "conversation.jsonl")) {
        status.textContent = "已下載 " + kept.length + " 則訊息到「下載」資料夾的 after-thinking/" + id + "/source/";
      } else {
        status.textContent = "已下載，但 Chrome 沒有採用指定的檔名，實際存成：" + saved +
          "。通常是其他會接管下載的擴充功能造成的，請回報給開發者。";
      }
    } catch (e) {
      status.textContent = "下載失敗：" + e.message;
    }
    event.target.disabled = false;
  });
}

main();
