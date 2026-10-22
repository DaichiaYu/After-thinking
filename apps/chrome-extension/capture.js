// After-thinking Capture — 共用的擷取與輸出程式（popup.js 和 batch.js 都會用到）

const VERSION = "0.4.0";

function detectPlatform(url) {
  const host = new URL(url).hostname;
  if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
  if (host === "claude.ai") return "claude";
  if (host === "gemini.google.com") return "gemini";
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
    if (platform === "gemini") {
      // Gemini 沒有穩定可用的對話資料介面，直接交給捲動讀取
      note("api", "not_supported");
      return { api: log };
    }
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
  // 等畫面重畫一次。分頁不在前景時瀏覽器不會重畫，所以最多等 120 毫秒就繼續，避免卡住。
  const frame = () => new Promise((r) => {
    let done = false;
    const finish = () => { if (!done) { done = true; r(); } };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 120);
  });
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

  // Gemini 的回答裡夾著按鈕和圖示文字（例如程式碼區塊上方的「content_copy」）。
  // 做法：複製一份放到畫面外，拿掉這些元素後再讀文字，原本的頁面不受影響。
  const GEMINI_NOISE = ".code-block-decoration, mat-icon, button, .cdk-visually-hidden, " +
    "sources-carousel-inline, source-inline-chip, .source-inline-chip-container";
  function geminiText(node) {
    if (!node.querySelector(GEMINI_NOISE)) return node.innerText;
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-100000px;top:0;width:" + Math.max(300, node.clientWidth) + "px;";
    const copy = node.cloneNode(true);
    copy.querySelectorAll(GEMINI_NOISE).forEach((el) => el.remove());
    box.appendChild(copy);
    document.body.appendChild(box);
    const text = copy.innerText;
    box.remove();
    cleaning.add("strip_gemini_controls");
    return text;
  }

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
    if (platform === "gemini") {
      strategy = "gemini:conversation-container";
      const turns = document.querySelectorAll("#chat-history .conversation-container, .conversation-container");
      outermost(Array.from(turns)).forEach((turn, i) => {
        const turnKey = turn.id || null;
        const q = turn.querySelector("user-query .query-text") || turn.querySelector("user-query");
        if (q) {
          const lines = q.querySelectorAll(".query-text-line");
          const text = lines.length ? Array.from(lines).map((l) => l.innerText).join("\n") : geminiText(q);
          out.push({ node: q, speaker: "author", raw: text, platform_message_id: null,
            key: turnKey ? "turn:" + turnKey + ":q" : null });
        }
        const r = turn.querySelector("model-response");
        if (r) {
          // 只拿回答本文；思考過程（model-thoughts）不在這個區塊裡
          const body = r.querySelector(".model-response-text .markdown") || r.querySelector("message-content .markdown") ||
            r.querySelector(".model-response-text") || r.querySelector("message-content");
          if (body) out.push({ node: body, speaker: "assistant", raw: geminiText(body), platform_message_id: null,
            key: turnKey ? "turn:" + turnKey + ":r" : null });
        }
      });
    }
    return out.map((m) => {
      const content = clean(stripButtons(m.raw));
      return { node: m.node, speaker: m.speaker, content, platform_message_id: m.platform_message_id, key: m.key || null,
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

  const keyOf = (m) => m.key || (m.platform_message_id ? "id:" + m.platform_message_id : m.speaker + ":" + m.content);

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
  //    Gemini 每次只補一小批舊訊息、而且載入比較慢，所以等久一點，
  //    並且每次先往下推一點再回到頂端，確保網站收到「又捲到頂了」的訊號。
  const isGemini = platform === "gemini";
  const TOP_WAIT = isGemini ? 1500 : 600;
  const TOP_STABLE = isGemini ? 4 : 3;
  let stable = 0, lastFirst = null, lastHeight = -1;
  while (stable < TOP_STABLE && log.top_rounds < 200 && Date.now() - started < TIME_LIMIT) {
    if (isGemini && scroller.scrollTop <= 1) { scroller.scrollTop = 80; await frame(); }
    scroller.scrollTop = -1e9;
    await sleep(TOP_WAIT); await frame();
    log.top_rounds++;
    log.top_min_seen = Math.min(log.top_min_seen, Math.round(scroller.scrollTop));
    const snap = snapshot();
    const firstKey = snap.length ? keyOf(snap[0]) : null;
    if (firstKey === lastFirst && scroller.scrollHeight === lastHeight) stable++;
    else stable = 0;
    lastFirst = firstKey; lastHeight = scroller.scrollHeight;
    progress("正在往上載入較舊的訊息（第 " + log.top_rounds + " 次，目前載入 " + snap.length + " 則）…");
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

function buildMetadata(kept, detected, platform, page, mode) {
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
    "  mode: " + (mode || "manual_click"),
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

// ── 批量擷取用：注入到 Gemini 頁面執行的函式（必須完全獨立） ──

// 讀側邊欄的對話清單：一直往下捲（必要時按「顯示更多」），直到數量連續幾次不再增加。
async function listGeminiChats() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ID = /\/(?:app|gem\/[^/?#]+)\/([0-9a-f]{10,})/i;
  const MORE = /^(顯示更多|顯示較多|显示更多|Show more|See more|More)$/i;
  const found = new Map();

  function collect() {
    document.querySelectorAll('a[href*="/app/"], a[href*="/gem/"]').forEach((a) => {
      const m = (a.getAttribute("href") || "").match(ID);
      if (!m) return;
      const titleNode = a.querySelector(".conversation-title, [data-test-id='conversation-title']") || a;
      const title = (titleNode.innerText || titleNode.textContent || "").replace(/\s+/g, " ").trim();
      const id = m[1].toLowerCase();
      if (!found.has(id) || (!found.get(id).title && title)) {
        found.set(id, { id, title, url: new URL(a.getAttribute("href"), location.origin).href.split("?")[0] });
      }
    });
    // 有些版本的清單項目不是連結，編號藏在 jslog 屬性裡
    document.querySelectorAll('[data-test-id="conversation"]').forEach((el) => {
      if (el.closest("a")) return;
      const m = (el.getAttribute("jslog") || "").match(/c_([0-9a-f]{10,})/i);
      if (!m) return;
      const id = m[1].toLowerCase();
      const titleNode = el.querySelector(".conversation-title") || el;
      const title = (titleNode.innerText || "").replace(/\s+/g, " ").trim();
      if (!found.has(id)) found.set(id, { id, title, url: location.origin + "/app/" + id });
    });
    return found.size;
  }

  function sidebarScroller() {
    const first = document.querySelector('a[href*="/app/"], [data-test-id="conversation"]');
    let el = first ? first.parentElement : null;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight + 10) return el;
      el = el.parentElement;
    }
    return null;
  }

  // 側邊欄收起來時先打開
  if (!collect()) {
    const menu = document.querySelector('[data-test-id="side-nav-menu-button"], button[aria-label*="主選單"], button[aria-label*="Main menu"]');
    if (menu) { menu.click(); await sleep(1200); }
  }

  const started = Date.now();
  let stable = 0, last = -1, rounds = 0;
  while (stable < 4 && rounds < 400 && Date.now() - started < 5 * 60 * 1000) {
    rounds++;
    const nav = sidebarScroller();
    if (nav) nav.scrollTop = nav.scrollHeight;
    const scope = (nav || document).querySelectorAll ? (nav || document) : document;
    scope.querySelectorAll('button, [role="button"]').forEach((b) => {
      if (MORE.test((b.innerText || b.textContent || "").trim())) b.click();
    });
    await sleep(1200);
    const n = collect();
    if (n === last) stable++; else stable = 0;
    last = n;
    try { chrome.runtime.sendMessage({ type: "list-progress", count: n }); } catch (e) {}
  }
  return { chats: Array.from(found.values()), rounds, seconds: Math.round((Date.now() - started) / 1000) };
}

// 打開一段對話後，等訊息出現、數量穩定下來再開始擷取。
async function waitForGeminiConversation(expectedId) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const started = Date.now();
  let last = -1, stable = 0;
  while (Date.now() - started < 45000) {
    const onPage = location.pathname.toLowerCase().includes(expectedId);
    const n = document.querySelectorAll(".conversation-container").length;
    if (onPage && n > 0) {
      if (n === last) stable++; else stable = 0;
      if (stable >= 3) return { ok: true, count: n };
    }
    last = n;
    await sleep(500);
  }
  return { ok: false, reason: location.pathname.toLowerCase().includes(expectedId) ? "no_messages" : "redirected" };
}
