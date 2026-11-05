// After-thinking Capture — 共用的擷取與輸出程式（popup.js 和 batch.js 都會用到）

const VERSION = "0.8.0";

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
  // 附件和圖片不下載，只在內容裡留下記號，並另外記在 attachments 欄位
  const marker = (a) => a.kind === "generated_image" ? "[AI 生成的圖片]"
    : a.kind === "image" ? "[圖片" + (a.name ? "：" + a.name : "") + "]"
    : "[附件：" + (a.name || "未知檔名") + "]";
  const withMarkers = (text, atts, speaker) => {
    if (!atts.length) return text;
    const marks = atts.map(marker).join("\n");
    if (!text) return marks;
    return speaker === "author" ? marks + "\n\n" + text : text + "\n\n" + marks;
  };
  // <chatgpt-markup>
  // ChatGPT 的回覆夾著它自己的版面語法（<box>、<row>、<text>、<Cite/>、<Link/>…），網站上畫成卡片，
  // 存成文字就是雜訊。轉成一般文字：容器標籤拿掉、連結變 [標題](網址)、引用留簡短記號、圖表留標題。
  // 只認得下面列的標籤名稱，其他 <...> 原樣保留；``` 程式碼區塊和 `行內程式碼` 都不動。
  const cleanChatgptMarkup = (text) => {
    const NAMES = "box|row|col|column|stack|grid|grid-item|list|list-item|text|caption|title|badge|card|icon|favicon|divider|spacer|Cite|MemoryCite|FileCite|Entity|Link|AsyncImage|Image|Chart";
    const KNOWN = new RegExp("^(" + NAMES + ")$");
    const CONTAINERS = /^(box|row|col|column|stack|grid|grid-item|list|list-item|text|caption|title|badge|card)$/;
    if (!new RegExp("</?(" + NAMES + ")[\\s/>]").test(text)) return { text, changed: false };
    const str = (raw, name) => { const m = raw.match(new RegExp("\\b" + name + "=\"([^\"]*)\"")); return m ? m[1] : ""; };
    const num = (raw, name) => { const m = raw.match(new RegExp("\\b" + name + "=\\{\\s*(\\d+)\\s*\\}")); return m ? m[1] : ""; };
    const jsonStr = (raw, key) => { const m = raw.match(new RegExp("\"" + key + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")); return m ? m[1] : ""; };
    // 讀一個標籤：屬性裡可能有 {...}、引號，裡面的 > 不算結尾
    const readTag = (s, at) => {
      const m = /^<(\/?)([A-Za-z][\w-]*)/.exec(s.slice(at, at + 40));
      if (!m || !KNOWN.test(m[2])) return null;
      let k = at + m[0].length, depth = 0, quote = null;
      for (; k < s.length; k++) {
        const c = s[k];
        if (quote) { if (c === "\\") k++; else if (c === quote) quote = null; continue; }
        if (c === "\"") { quote = c; continue; }
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (k >= s.length) return null;
      const raw = s.slice(at + m[0].length, k);
      return { end: k + 1, name: m[2], closing: m[1] === "/", selfClosing: /\/\s*$/.test(raw), raw };
    };
    const render = (t) => {
      const n = t.name, raw = t.raw;
      if (t.closing) return n === "badge" ? "）" : "";
      if (CONTAINERS.test(n)) {
        if (t.selfClosing) return "";
        return n === "badge" ? "（" : n === "list-item" ? "- " : "";
      }
      if (n === "Link") { const u = str(raw, "url"), ti = str(raw, "title"); return u && ti ? "[" + ti + "](" + u + ")" : (u || ti); }
      if (n === "Cite") return "[來源]";
      if (n === "MemoryCite") return "[引用記憶]";
      if (n === "FileCite") { const a = num(raw, "line_range_start"), b = num(raw, "line_range_end"); return a && b ? "[引用附件第 " + a + "–" + b + " 行]" : "[引用附件]"; }
      if (n === "Entity") return str(raw, "value");
      if (n === "AsyncImage" || n === "Image") { const q = str(raw, "query") || str(raw, "alt"); return q ? "[網路圖片：" + q + "]" : "[網路圖片]"; }
      if (n === "Chart") { const ti = jsonStr(raw, "title") || jsonStr(raw, "description"); return ti ? "[圖表：" + ti + "]" : "[圖表]"; }
      if (n === "divider") return "\n---\n";
      return "";   // icon、favicon、spacer
    };
    const cleanPart = (part) => {
      let out = "", depth = 0, inCode = false, lineStart = true;
      for (let k = 0; k < part.length;) {
        const c = part[k];
        if (lineStart && depth > 0 && (c === " " || c === "\t")) { k++; continue; }   // 卡片裡的縮排拿掉
        lineStart = false;
        if (c === "\n") { out += c; k++; lineStart = true; inCode = false; continue; }
        if (c === "`") { inCode = !inCode; out += c; k++; continue; }
        if (c === "<" && !inCode) {
          const t = readTag(part, k);
          if (t) {
            out += render(t);
            if (CONTAINERS.test(t.name) && !t.selfClosing) depth = Math.max(0, depth + (t.closing ? -1 : 1));
            k = t.end;
            continue;
          }
        }
        out += c; k++;
      }
      return out;
    };
    const cleaned = text.split(/(```[\s\S]*?```)/).map((part, k) => (k % 2 ? part : cleanPart(part))).join("")
      .replace(/^[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
    return { text: cleaned, changed: cleaned !== text };
  };
  // </chatgpt-markup>
  const result = (items, extra) => ({
    items, strategy: extra.strategy, cleaning: extra.cleaning || [], title: document.title, url: location.href,
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
      const isImagePart = (x) => x && typeof x === "object" && /image/.test(x.content_type || "");
      // 工具產生的圖片（例如畫圖）掛在工具訊息上，接到下一則 AI 回答
      let pendingGenerated = [];
      path.forEach((node) => {
        const msg = node.message;
        if (!msg || !msg.author || msg.author.role !== "tool" || !msg.content) return;
        const parts = Array.isArray(msg.content.parts) ? msg.content.parts : [];
        parts.filter(isImagePart).forEach(() => { node.__generated = (node.__generated || 0) + 1; });
      });
      path.forEach((node) => {
        if (node.__generated) {
          for (let k = 0; k < node.__generated; k++) pendingGenerated.push({ kind: "generated_image", name: null });
          return;
        }
        if (!visible(node)) return;
        const msg = node.message;
        const parts = Array.isArray(msg.content.parts) ? msg.content.parts : [];
        const text = parts.filter((x) => typeof x === "string").join("\n").trim();
        const speaker = msg.author.role === "user" ? "author" : "assistant";
        let atts = [];
        const listed = (msg.metadata && Array.isArray(msg.metadata.attachments)) ? msg.metadata.attachments : [];
        if (listed.length) {
          atts = listed.map((a) => ({ kind: /^image\//.test(a.mime_type || "") ? "image" : "file", name: a.name || null }));
        } else {
          atts = parts.filter(isImagePart).map(() => ({ kind: speaker === "author" ? "image" : "generated_image", name: null }));
        }
        if (speaker === "assistant" && pendingGenerated.length) { atts = atts.concat(pendingGenerated); pendingGenerated = []; }
        if (!text && !atts.length) return;
        const prev = items[items.length - 1];
        // 同一輪回答被網站拆成好幾段時，合併成一則
        if (prev && prev.speaker === "assistant" && speaker === "assistant") {
          prev.text = (prev.text + "\n\n" + text).trim();
          prev.platform_message_id += " " + msg.id;
          prev.attachments = prev.attachments.concat(atts);
          return;
        }
        items.push({ speaker, text, platform_message_id: msg.id, timestamp: iso(msg.create_time), attachments: atts });
      });
      if (pendingGenerated.length) {
        const last = items.filter((i) => i.speaker === "assistant").pop();
        if (last) last.attachments = last.attachments.concat(pendingGenerated);
      }
      let markupCleaned = 0;
      items.forEach((i) => {
        if (i.speaker === "assistant") { const c = cleanChatgptMarkup(i.text); if (c.changed) { i.text = c.text; markupCleaned++; } }
      });
      items.forEach((i) => { i.content = withMarkers(i.text, i.attachments, i.speaker); delete i.text; });

      // 分支點：有兩個以上「看得見的」後續訊息的位置
      let branchPoints = 0;
      Object.values(conv.mapping).forEach((node) => {
        const kids = (node.children || []).filter((k) => conv.mapping[k] && conv.mapping[k].message &&
          ["user", "assistant"].includes(conv.mapping[k].message.author.role));
        if (kids.length > 1) branchPoints++;
      });
      return result(items, { strategy: "chatgpt:backend-api", branches: branchPoints, created: iso(conv.create_time),
        cleaning: markupCleaned ? ["chatgpt_ui_markup"] : [] });
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
        const speaker = msg.sender === "human" ? "author" : "assistant";
        const atts = (msg.attachments || []).map((a) => ({ kind: "file", name: a.file_name || null }))
          .concat((msg.files_v2 || msg.files || []).map((f) => ({
            kind: f.file_kind === "image" ? "image" : "file", name: f.file_name || null })));
        if (!text && !atts.length) return;
        items.push({ speaker, content: withMarkers(text, atts, speaker),
          platform_message_id: msg.uuid, timestamp: iso(msg.created_at), attachments: atts });
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

  // 附件和圖片不下載，只在內容裡留下記號，並另外記在 attachments 欄位
  const marker = (a) => a.kind === "generated_image" ? "[AI 生成的圖片]"
    : a.kind === "image" ? "[圖片" + (a.name ? "：" + a.name : "") + "]"
    : "[附件：" + (a.name || "未知檔名") + "]";
  const withMarkers = (text, atts, speaker) => {
    if (!atts.length) return text;
    const marks = atts.map(marker).join("\n");
    if (!text) return marks;
    return speaker === "author" ? marks + "\n\n" + text : text + "\n\n" + marks;
  };

  // 放到畫面外讀文字（innerText 需要元素在畫面上才會分行）
  function offscreenText(copy, width) {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-100000px;top:0;width:" + Math.max(300, width) + "px;";
    box.appendChild(copy);
    document.body.appendChild(box);
    const text = copy.innerText;
    box.remove();
    return text;
  }
  const looksLikeFile = (s) => /^[^\n]{1,200}\.[a-z0-9]{1,8}$/i.test(s);

  // 使用者上傳的檔案和圖片：在 user-query 裡、但不在提問文字裡
  // 使用者上傳的檔案和圖片：在 user-query 裡、但不在提問文字裡。
  // src 是之後下載原檔用的網址（可能是 https、blob 或 data）
  const imgSrc = (img) => img.currentSrc || img.getAttribute("src") || null;
  function geminiUserAttachments(uq) {
    // 先列檔案、再列圖片
    const files = [];
    const images = [];
    const qt = uq.querySelector(".query-text");
    const outside = (el) => !(qt && qt.contains(el)) && !el.closest(GEMINI_NOISE);
    uq.querySelectorAll("img").forEach((img) => {
      if (!outside(img)) return;
      const alt = (img.getAttribute("alt") || "").trim();
      images.push({ kind: "image", name: looksLikeFile(alt) ? alt : null, src: imgSrc(img) });
    });
    // 檔案卡：文字剛好像檔名（例如「報告.pdf」）的最內層元素；旁邊有連結的話記下來當下載網址
    const seen = new Set(images.map((a) => a.name).filter(Boolean));
    uq.querySelectorAll("*").forEach((el) => {
      if (!outside(el) || el.tagName === "IMG") return;
      // 只看元素「自己」的文字，不含子元素（避免把「報告.pdf」和旁邊的「PDF」標籤黏在一起）
      const t = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").trim();
      if (!looksLikeFile(t) || seen.has(t)) return;
      seen.add(t);
      let link = el.closest("a[href]");
      for (let p = el.parentElement, k = 0; !link && p && p !== uq && k < 3; p = p.parentElement, k++) {
        link = p.querySelector("a[href]");
      }
      files.push({ kind: "file", name: t, src: link ? link.href : null });
    });
    return files.concat(images);
  }

  // 回答裡的圖片（生成的圖、搜尋到的圖）；排除思考過程、來源小卡和小圖示
  function geminiResponseImages(r) {
    const atts = [];
    r.querySelectorAll("img").forEach((img) => {
      if (img.closest("model-thoughts, " + GEMINI_NOISE)) return;
      const rect = img.getBoundingClientRect();
      const w = rect.width || img.naturalWidth || Number(img.getAttribute("width")) || 0;
      if (w && w < 64) return;
      const src = img.currentSrc || img.getAttribute("src") || "";
      const generated = !!img.closest("generated-image, .generated-image, .generated-images") || /googleusercontent\.com\/gg\//.test(src);
      atts.push({ kind: generated ? "generated_image" : "image", name: null, src: src || null });
    });
    return atts;
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
        const uq = turn.querySelector("user-query");
        const q = turn.querySelector("user-query .query-text") || uq;
        if (q) {
          const lines = q.querySelectorAll(".query-text-line");
          const text = lines.length ? Array.from(lines).map((l) => l.innerText).join("\n") : geminiText(q);
          out.push({ node: q, speaker: "author", raw: text, platform_message_id: null,
            attachments: uq ? geminiUserAttachments(uq) : [],
            key: turnKey ? "turn:" + turnKey + ":q" : null });
        }
        const r = turn.querySelector("model-response");
        if (r) {
          // 只拿回答本文；思考過程（model-thoughts）不在這個區塊裡
          const body = r.querySelector(".model-response-text .markdown") || r.querySelector("message-content .markdown") ||
            r.querySelector(".model-response-text") || r.querySelector("message-content");
          if (body) out.push({ node: body, speaker: "assistant", raw: geminiText(body), platform_message_id: null,
            attachments: geminiResponseImages(r),
            key: turnKey ? "turn:" + turnKey + ":r" : null });
        }
      });
    }
    return out.map((m) => {
      const atts = m.attachments || [];
      const text = clean(stripButtons(m.raw));
      const content = withMarkers(text, atts, m.speaker);
      return { node: m.node, speaker: m.speaker, content, text, platform_message_id: m.platform_message_id, key: m.key || null,
        attachments: atts, truncated: TRUNCATED_TAIL.test(text) };
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
    // Gemini 的對話區塊即使內容還沒多到能捲，也是負責載入舊訊息的那一層
    if (platform === "gemini" && first) {
      const known = first.node.closest("#chat-history, infinite-scroller");
      if (known) {
        const oy = getComputedStyle(known).overflowY;
        if (oy === "auto" || oy === "scroll" || oy === "overlay") return known;
      }
    }
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
    // 內容還不夠長、捲不動時，瀏覽器不會發出「捲動了」的通知，這裡補發一次讓網站去載入舊訊息
    if (isGemini) scroller.dispatchEvent(new Event("scroll"));
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
    items: acc.map((m) => ({ speaker: m.speaker, content: m.content, text: m.text, platform_message_id: m.platform_message_id,
      attachments: m.attachments || [], truncated: m.truncated })),
    strategy,
    cleaning: Array.from(cleaning),
    title: document.title,
    url: location.href,
    scroll: log
  };
}

// 只回報頁面結構和字數，不回傳任何對話文字。
// ── 產生輸出檔 ──

// 從網址取出對話編號，用來比對「抓過了沒」
function conversationIdFromUrl(platform, url) {
  const path = new URL(url).pathname;
  const pattern = { chatgpt: /\/c\/([0-9a-f-]{36})/i, claude: /\/chat\/([0-9a-f-]{36})/i,
    gemini: /\/(?:app|gem\/[^/]+)\/([0-9a-f]{10,})/i }[platform];
  const m = pattern ? path.match(pattern) : null;
  return m ? m[1].toLowerCase() : null;
}

// 清單頁的預覽：使用者問過的問題，存開頭幾個和最後幾個（對話常越聊越偏，最後問的最能看出停在哪）。
// 每個最多存 PREVIEW_CHARS 字；要看全部時清單頁再讀原文。i 是訊息位置（0 起），和標記頁的編號一致
const PREVIEW_HEAD = 5, PREVIEW_TAIL = 2, PREVIEW_CHARS = 200;
function previewQuestions(items) {
  const qs = [];
  items.forEach((m, i) => {
    if (m.speaker !== "author") return;
    const text = String(m.content || "").replace(/\s+/g, " ").trim();
    qs.push({ i, text: text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) + "…" : (text || "（只有附件）") });
  });
  const pick = qs.length <= PREVIEW_HEAD + PREVIEW_TAIL ? qs : qs.slice(0, PREVIEW_HEAD).concat(qs.slice(-PREVIEW_TAIL));
  return { preview_questions: pick, preview_version: 1 };
}

// 擷取紀錄（inbox/index.jsonl）的一行
function buildCaptureEntry(platform, conversationId, title, url, folder, items, page, mode) {
  const warnings = [];
  if (page.scroll && page.scroll.timed_out) warnings.push("timed_out");
  if (page.scroll && page.scroll.gaps) warnings.push("possible_gaps");
  if (items.some((i) => i.truncated)) warnings.push("truncated_messages");
  const allAtts = items.reduce((list, i) => list.concat(Array.isArray(i.attachments) ? i.attachments : []), []);
  const attachments = allAtts.length;
  return {
    platform,
    conversation_id: conversationId,
    title,
    url,
    folder,
    mode,
    messages: items.length,
    author_messages: items.filter((i) => i.speaker === "author").length,
    chars: items.reduce((n, i) => n + i.content.length, 0),
    attachments,
    attachments_saved: allAtts.filter((a) => a.file).length,
    attachments_missing: allAtts.filter((a) => a.missing).length,
    started_at: page.conversation_created_at || null,
    updated_at: page.conversation_updated_at || null,
    warnings,
    ...previewQuestions(items),
    captured_at: new Date().toISOString(),
    extension_version: VERSION
  };
}

function defaultDiscussionId(platform, url, startedAt) {
  const d = startedAt ? new Date(startedAt) : new Date();
  const date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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
    ...(Array.isArray(item.attachments) && item.attachments.length ? { attachments: item.attachments } : {})
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
    "  conversation_updated_at: " + (page.conversation_updated_at ? q(page.conversation_updated_at) : "null"),
    "  time_source: " + (page.time_source ? q(page.time_source) : (page.api && page.api.ok ? q("site_api") : "null")),
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

// ── 擷取後處理（在擴充功能頁面執行）：原始時間、附件原檔 ──

// 讓 Gemini 頁面一開始載入就啟動記錄器。只對「之後載入」的頁面有效。
async function ensureGeminiRecorder() {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ["at-gemini-recorder"] });
    if (existing.length) return;
    await chrome.scripting.registerContentScripts([{
      id: "at-gemini-recorder", matches: ["https://gemini.google.com/*"], js: ["gemini-recorder.js"],
      runAt: "document_start", world: "MAIN", persistAcrossSessions: true
    }]);
  } catch (e) { /* 註冊失敗只會少了時間，不影響擷取 */ }
}

// 注入 MAIN world：取出記錄器存的資料
function readGeminiRecorded() {
  return window.__atRecorder ? window.__atRecorder.responses.slice() : null;
}

// 解析 Gemini 的 batchexecute 回應，找出「對話編號 → 時間」和「每一輪 → 時間」。
// 格式沒有公開，所以用寬鬆的規則：時間是 [秒, 奈秒] 這種兩個整數的組合。
function parseGeminiRecorded(raws) {
  const isTs = (a) => Array.isArray(a) && a.length === 2 && Number.isInteger(a[0]) && Number.isInteger(a[1]) &&
    a[0] > 1.4e9 && a[0] < 2.2e9 && a[1] >= 0 && a[1] < 1e9;
  const toMs = (a) => a[0] * 1000 + Math.floor(a[1] / 1e6);
  const payloads = [];
  (raws || []).forEach((raw) => {
    raw.replace(/^\)\]\}'\s*/, "").split("\n").forEach((line) => {
      const l = line.trim();
      if (!l.startsWith("[")) return;
      let arr;
      try { arr = JSON.parse(l); } catch (e) { return; }
      (Array.isArray(arr) ? arr : []).forEach((e) => {
        if (Array.isArray(e) && e[0] === "wrb.fr" && typeof e[2] === "string") {
          try { payloads.push({ rpc: e[1], data: JSON.parse(e[2]) }); } catch (err) {}
        }
      });
    });
  });

  const conversations = {};   // 編號 → [毫秒…]
  const turns = [];           // { ms, strings }
  const findTs = (node, depth, out) => {
    if (!Array.isArray(node) || depth > 4) return;
    if (isTs(node)) { out.push(toMs(node)); return; }
    node.forEach((c) => findTs(c, depth + 1, out));
  };
  const strings = (node, depth, out) => {
    if (depth > 6) return;
    if (typeof node === "string") {
      if (node.length > 0 && !/^(c|r|rc)_[0-9a-f]+$/i.test(node) && !/^https?:\/\//.test(node)) out.push(node);
    } else if (Array.isArray(node)) node.forEach((c) => strings(c, depth + 1, out));
  };
  const walk = (node, depth) => {
    if (!Array.isArray(node) || depth > 40) return;
    if (typeof node[0] === "string" && /^c_[0-9a-f]{8,}$/i.test(node[0])) {
      const ts = [];
      findTs(node, 0, ts);
      if (ts.length) {
        const id = node[0].slice(2).toLowerCase();
        conversations[id] = (conversations[id] || []).concat(ts);
      }
    }
    const direct = node.find(isTs);
    if (direct) {
      const s = [];
      node.forEach((c) => { if (c !== direct) strings(c, 0, s); });
      if (s.length) turns.push({ ms: toMs(direct), strings: s });
    }
    node.forEach((c) => walk(c, depth + 1));
  };
  payloads.forEach((p) => walk(p.data, 0));
  return { conversations, turns, payloads: payloads.length };
}

// 把時間對到畫面上抓到的訊息：用提問文字比對，同樣的文字（例如「繼續」）依時間先後分配
function applyGeminiTimes(page, conversationId, parsed) {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const used = new Set();
  const turns = parsed.turns.slice().sort((a, b) => a.ms - b.ms);
  const normed = turns.map((t) => t.strings.map(norm));
  let matched = 0;
  let lastMs = null;
  page.items.forEach((item) => {
    if (item.speaker !== "author") {
      if (lastMs !== null) item.timestamp = new Date(lastMs).toISOString();
      return;
    }
    lastMs = null;
    const q = norm(item.text !== undefined ? item.text : item.content);
    if (!q) return;
    const head = q.slice(0, 80);
    const k = turns.findIndex((t, i) => !used.has(i) && normed[i].some((s) => s === q || (head.length >= 20 && s.startsWith(head))));
    if (k < 0) return;
    used.add(k);
    lastMs = turns[k].ms;
    item.timestamp = new Date(lastMs).toISOString();
    matched++;
  });
  const stamps = page.items.map((i) => i.timestamp).filter(Boolean).sort();
  const listed = (parsed.conversations[conversationId] || []).slice().sort((a, b) => a - b);
  page.conversation_created_at = stamps[0] || (listed.length ? new Date(listed[0]).toISOString() : null);
  page.conversation_updated_at = stamps[stamps.length - 1] || (listed.length ? new Date(listed[listed.length - 1]).toISOString() : null);
  page.time_source = matched ? "gemini:recorded_turns" : listed.length ? "gemini:recorded_list" : null;
  return matched;
}

// 注入對話頁面：在頁面裡讀附件（blob:、data: 只能在頁面裡讀；https 也先試試看）
async function fetchAttachmentsInPage(urls, maxBytes) {
  const out = {};
  const toB64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) { out[url] = { error: "http_" + res.status }; continue; }
      const blob = await res.blob();
      if (blob.size > maxBytes) { out[url] = { error: "too_large" }; continue; }
      out[url] = { b64: await toB64(blob), type: blob.type || res.headers.get("content-type") || "" };
    } catch (e) {
      out[url] = { error: "fetch_failed" };
    }
  }
  return out;
}

async function fetchAttachmentHere(url, maxBytes) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return { error: "http_" + res.status };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) return { error: "too_large" };
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), type: res.headers.get("content-type") || "" };
  } catch (e) {
    return { error: "fetch_failed" };
  }
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function attachmentExt(att, type, url) {
  const fromName = att.name && att.name.match(/\.([a-z0-9]{1,8})$/i);
  if (fromName) return fromName[1].toLowerCase();
  const map = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
    "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv" };
  const t = (type || "").split(";")[0].trim().toLowerCase();
  if (map[t]) return map[t];
  const fromUrl = (url || "").match(/\.([a-z0-9]{2,5})(?:[?#=]|$)/i);
  if (fromUrl && !/^(com|html?)$/i.test(fromUrl[1])) return fromUrl[1].toLowerCase();
  return att.kind === "file" ? "bin" : "png";
}

// 下載附件原檔，回傳要寫進 source/ 的檔案；訊息裡的記號改成指向檔案
async function downloadAttachments(tabId, items) {
  const targets = [];
  items.forEach((item) => (item.attachments || []).forEach((att) => { if (att.src) targets.push(att); }));
  const files = [];
  if (!targets.length) return files;
  const urls = Array.from(new Set(targets.map((a) => a.src)));
  let got = {};
  try {
    const [inj] = await chrome.scripting.executeScript({ target: { tabId }, func: fetchAttachmentsInPage, args: [urls, MAX_ATTACHMENT_BYTES] });
    got = (inj && inj.result) || {};
  } catch (e) { got = {}; }
  // 頁面裡讀不到的 https 網址（通常是跨網域限制），改由擴充功能自己讀
  for (const url of urls) {
    const r = got[url];
    if (/^https:/.test(url) && (!r || (r.error && r.error !== "too_large"))) got[url] = await fetchAttachmentHere(url, MAX_ATTACHMENT_BYTES);
  }
  const pathOf = {};
  let n = 0;
  targets.forEach((att) => {
    const r = got[att.src];
    if (r && r.b64) {
      if (!pathOf[att.src]) {
        n++;
        pathOf[att.src] = "attachments/" + String(n).padStart(2, "0") + "." + attachmentExt(att, r.type, att.src);
        files.push({ path: pathOf[att.src], base64: r.b64 });
      }
      att.file = pathOf[att.src];
    } else {
      att.missing = (r && r.error) || "not_found";
    }
    delete att.src;
  });
  return files;
}

// 附件記號：有原檔就寫路徑（相對於 source/），拿不到就標「未取得原檔」
function attachmentMarker(a) {
  const tail = a.file ? (a.name ? "：" + a.name + " → " + a.file : "：" + a.file)
    : (a.name ? "：" + a.name : "") + (a.missing ? "（未取得原檔）" : "");
  if (a.kind === "generated_image") return "[AI 生成的圖片" + tail + "]";
  if (a.kind === "image") return "[圖片" + tail + "]";
  return "[附件" + (tail || "：未知檔名") + "]";
}

function renderItemContent(item) {
  if (item.text === undefined) return item.content;
  const atts = item.attachments || [];
  if (!atts.length) return item.text;
  const marks = atts.map(attachmentMarker).join("\n");
  if (!item.text) return marks;
  return item.speaker === "author" ? marks + "\n\n" + item.text : item.text + "\n\n" + marks;
}

// 擷取完成後一律呼叫：Gemini 補時間、下載附件；回傳要一起上傳的附件檔
async function finalizeCapture(tabId, platform, page) {
  let files = [];
  if (platform === "gemini") {
    const conversationId = conversationIdFromUrl(platform, page.url);
    try {
      const [inj] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: readGeminiRecorded });
      const raws = inj && inj.result;
      page.recorder = raws ? "active" : "not_loaded";
      if (raws && raws.length) applyGeminiTimes(page, conversationId, parseGeminiRecorded(raws));
    } catch (e) { page.recorder = "error"; }
    files = await downloadAttachments(tabId, page.items);
  }
  page.items.forEach((item) => {
    item.content = renderItemContent(item);
    delete item.text;
  });
  return files;
}

// 資料夾用的日期：對話開始的日期（本地時間），沒有原始時間就是 null
function folderMonth(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
