// After-thinking Capture — 共用的擷取與輸出程式（popup.js 和 batch.js 都會用到）

const VERSION = "0.9.1";

function detectPlatform(url) {
  const host = new URL(url).hostname;
  if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
  if (host === "claude.ai") return "claude";
  if (host === "gemini.google.com") return "gemini";
  if (host === "grok.com") return "grok";
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
  // 此階段先保留附件線索；finalizeCapture 後續嘗試下載原檔，取不到會記錄失敗原因
  const marker = (a) => a.kind === "generated_image" ? "[AI 生成的圖片]"
    : a.kind === "image" ? "[圖片" + (a.name ? "：" + a.name : "") + "]"
    : "[附件：" + (a.name || "未知檔名") + "]";
  const withMarkers = (text, atts, speaker) => {
    if (!atts.length) return text;
    const marks = atts.map(marker).join("\n");
    if (!text) return marks;
    return speaker === "author" ? marks + "\n\n" + text : text + "\n\n" + marks;
  };
  // <source-links>
  // AI 回答引用的網址：存成每則訊息的 sources 清單（編號、網址、標題），
  // 文字裡的引用記號改成 [來源 n]，n 對得上同一則訊息的清單。
  // 網站沒給網址時寫 [來源：未取得網址]，不留看不出是什麼的空白記號。
  // 分兩種：
  //   list  = 文字裡有記號指到的（被引用的），跟著訊息存在 conversation.jsonl
  //   extra = 網站列出「這則回答參考過」但沒對到特定句子的網頁（常常幾十個），另外存成獨立檔案，
  //           不塞進對話原文，免得原文被網址清單撐大
  const SOURCE_UNRESOLVED = "[來源：未取得網址]";
  const makeSources = () => {
    const list = [], extra = [];
    const add = (url, title, inline) => {
      let href = null;
      try { const u = new URL(String(url || "")); if (u.protocol === "https:" || u.protocol === "http:") href = u.href; } catch (e) {}
      if (!href) return null;
      const t = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 300) : "";
      let s = list.find((x) => x.url === href);
      const k = extra.findIndex((x) => x.url === href);
      if (s) { if (!s.title && t) s.title = t; return s.n; }
      if (!inline) {
        if (k < 0) extra.push({ url: href, title: t || null });
        else if (!extra[k].title && t) extra[k].title = t;
        return null;
      }
      // 被引用了：如果先前只列在「參考過」，移過來
      const moved = k >= 0 ? extra.splice(k, 1)[0] : null;
      s = { n: list.length + 1, url: href, title: t || (moved && moved.title) || null, inline: true };
      list.push(s);
      return s.n;
    };
    const mark = (ns) => {
      const u = (ns || []).filter((n, k, all) => n && all.indexOf(n) === k);
      return u.length ? "[來源 " + u.join("、") + "]" : SOURCE_UNRESOLVED;
    };
    return { list, extra, add, mark };
  };
  // ChatGPT：引用資料在 metadata.content_references，文字裡是一串看不見的記號（matched_text）。
  const chatgptSources = (text, metadata, reg) => {
    const md = metadata || {};
    let out = text;
    (Array.isArray(md.content_references) ? md.content_references : []).forEach((ref) => {
      if (!ref || typeof ref !== "object") return;
      const type = String(ref.type || "");
      const found = [];
      const push = (o) => { if (o && typeof o === "object" && o.url) found.push([o.url, o.title || o.attribution || null]); };
      push(ref);
      (Array.isArray(ref.items) ? ref.items : []).forEach((it) => {
        push(it);
        (Array.isArray(it && it.supporting_websites) ? it.supporting_websites : []).forEach(push);
      });
      (Array.isArray(ref.sources) ? ref.sources : []).forEach(push);
      const matched = typeof ref.matched_text === "string" ? ref.matched_text : "";
      // 只替換網站自己的隱藏記號；matched_text 是一般文字時不動原文，只把網址收進清單
      const anchored = /[\ue000-\uf8ff]/.test(matched) && out.includes(matched);
      const swap = (to) => { out = out.split(matched).join(to); };
      if (/image|video|product/i.test(type)) { if (anchored && typeof ref.alt === "string") swap(ref.alt); return; }
      const ns = found.map((f) => reg.add(f[0], f[1], anchored)).filter(Boolean);
      if (!anchored) return;
      if (ns.length) swap(reg.mark(ns));
      else if (typeof ref.alt === "string" && ref.alt.trim()) swap(ref.alt);
      else if (/cit|webpage|source/i.test(type)) swap(SOURCE_UNRESOLVED);
      else if (ref.alt === "") swap("");
    });
    // 舊格式：metadata.citations
    (Array.isArray(md.citations) ? md.citations : []).forEach((c) => {
      const m = c && c.metadata;
      if (m && m.url) reg.add(m.url, m.title || null, false);
    });
    return out;
  };
  // ChatGPT 的另一種引用：回答文字裡是 <Cite ref="turn12search3"/>，網址放在別則（搜尋工具）訊息的資料裡。
  // 這裡把給定的訊息節點掃一遍，凡是同時帶「引用編號」和 url 的物件都記下來：編號 → 網址。
  // 引用編號（turn0search3）每一輪重新數，所以要「每一輪」各建一份（issue #45）：
  //   nodes 傳該輪的節點；不傳就掃整個 mapping（含沒選用的分支，只適合診斷）。
  // conflicts：同一個編號在掃過的範圍裡指到不同網址 → 不能拿來跨輪對。
  // urls：掃到的所有「有編號的網址」，沒被引用的當成「參考過」（issue #47）。
  // paths 只記欄位路徑（不含任何內容），對不到時寫進診斷報告，方便照實際結構修正。
  const chatgptRefIndex = (conv, nodes) => {
    const map = {}, conflicts = new Set(), urls = [], paths = new Set(), keys = new Set();
    const idOf = (r) => {
      if (typeof r === "string") return /^turn\d+[a-z_]+\d+$/i.test(r) ? r : null;
      if (r && typeof r === "object" && r.turn_index !== undefined && r.ref_type !== undefined && r.ref_index !== undefined) {
        return "turn" + r.turn_index + r.ref_type + r.ref_index;
      }
      return null;
    };
    const walk = (o, path, depth) => {
      if (!o || typeof o !== "object" || depth > 14) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, path + "[]", depth + 1)); return; }
      // 先走到最裡面：越裡面的物件，網址和編號的對應越精確
      Object.keys(o).forEach((k) => walk(o[k], path + "." + k, depth + 1));
      const ids = [];
      if (o.ref_id !== undefined) { ids.push(idOf(o.ref_id)); paths.add(path + ".ref_id"); }
      if (Array.isArray(o.refs)) { o.refs.forEach((r) => ids.push(idOf(r))); paths.add(path + ".refs"); }
      if (typeof o.url !== "string" || !o.url) return;
      const title = typeof o.title === "string" ? o.title : null;
      const own = ids.filter(Boolean);
      if (own.length) urls.push({ url: o.url, title });
      own.forEach((id) => {
        if (!map[id]) map[id] = { url: o.url, title };
        else if (map[id].url !== o.url) conflicts.add(id);
      });
    };
    (Array.isArray(nodes) ? nodes : Object.values((conv && conv.mapping) || {})).forEach((node) => {
      const m = node && node.message;
      if (!m) return;
      Object.keys(m.metadata || {}).forEach((k) => keys.add(k));
      walk(m.metadata, "metadata", 0);
      if (m.author && m.author.role === "tool") walk(m.content, "tool_content", 0);
    });
    return { map, conflicts, urls, paths: Array.from(paths).slice(0, 40), keys: Array.from(keys).sort().slice(0, 80) };
  };
  // Claude：引用掛在文字區塊的 citations，位置用 end_index 標在該區塊文字裡。
  const claudeBlockText = (block, reg) => {
    let text = block.text;
    const cites = (Array.isArray(block.citations) ? block.citations : []).map((c) => {
      if (!c || typeof c !== "object") return null;
      const d = (c.details && typeof c.details === "object") ? c.details : {};
      const m = (c.metadata && typeof c.metadata === "object") ? c.metadata : {};
      const src = (c.source && typeof c.source === "object") ? c.source : {};
      const end = Number.isInteger(c.end_index) && c.end_index >= 0 && c.end_index <= text.length ? c.end_index : text.length;
      return { url: c.url || d.url || m.url || src.url || null, title: c.title || m.title || d.title || src.title || null, end };
    }).filter(Boolean);
    if (!cites.length) return text;
    cites.sort((a, b) => a.end - b.end);
    const at = new Map();
    cites.forEach((c) => { if (!at.has(c.end)) at.set(c.end, []); at.get(c.end).push(reg.add(c.url, c.title, true)); });
    Array.from(at.keys()).sort((a, b) => b - a).forEach((end) => {
      text = text.slice(0, end) + reg.mark(at.get(end)) + text.slice(end);
    });
    return text;
  };
  // Grok：引用標籤帶 card_id，網址在同一則回應的 cardAttachmentsJson。
  // 回傳給 cleanGrokMarkup 用的函式；對不到網址的引用會計數，之後把搜尋結果清單補進來。
  const grokCiter = (r, reg) => {
    const cards = {};
    (Array.isArray(r.cardAttachmentsJson) ? r.cardAttachmentsJson : []).forEach((raw) => {
      try { const c = typeof raw === "string" ? JSON.parse(raw) : raw; if (c && c.id) cards[c.id] = c; } catch (e) {}
    });
    const results = [].concat(Array.isArray(r.citedWebSearchResults) ? r.citedWebSearchResults : [],
      Array.isArray(r.webSearchResults) ? r.webSearchResults : []).filter((x) => x && x.url);
    const titleOf = (url) => { const hit = results.find((x) => x.url === url); return hit ? hit.title || null : null; };
    const cite = (tag) => {
      const id = (tag.match(/\bcard_id="([^"]+)"/) || [])[1];
      const card = id ? cards[id] : null;
      const url = card ? (card.url || (card.webSearchResult && card.webSearchResult.url) || null) : null;
      const n = url ? reg.add(url, (card && card.title) || titleOf(url), true) : null;
      cite.tags++;
      if (!n) cite.unresolved++;
      return reg.mark([n]);
    };
    cite.unresolved = 0;
    cite.tags = 0;
    cite.results = results.length;
    cite.cards = Object.keys(cards).length;
    cite.listAll = () => results.forEach((x) => reg.add(x.url, x.title || null, false));
    return cite;
  };
  // </source-links>
  // <chatgpt-markup>
  // ChatGPT 的回覆夾著它自己的版面語法（<box>、<row>、<text>、<Cite/>、<Link/>…），網站上畫成卡片，
  // 存成文字就是雜訊。轉成一般文字：容器標籤拿掉、連結變 [標題](網址)、引用留簡短記號、圖表留標題。
  // 只認得下面列的標籤名稱，其他 <...> 原樣保留；``` 程式碼區塊和 `行內程式碼` 都不動。
  const cleanChatgptMarkup = (text, cite) => {
    const NAMES = "box|row|col|column|stack|grid|grid-item|list|list-item|text|caption|title|badge|card|icon|favicon|divider|spacer|Cite|MemoryCite|FileCite|Entity|Link|AsyncImage|Image|Chart|checkbox|button|input|select|radio|radio-group|slider|date-picker|textarea|segmented-control|pressable|label|bold|italic|escape";
    const KNOWN = new RegExp("^(" + NAMES + ")$");
    const CONTAINERS = /^(box|row|col|column|stack|grid|grid-item|list|list-item|text|caption|title|badge|card|checkbox|button|pressable|label|bold|italic|escape|radio|radio-group)$/;
    if (!new RegExp("</?(" + NAMES + ")[\\s/>]").test(text) && !/\{@body|\{@const|\{#each|\{#if|<svg\b/i.test(text)) return { text, changed: false };
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
      if (n === "checkbox") return t.selfClosing ? "- [互動選項]\n" : "- [ ] ";
      if (n === "button" && t.selfClosing) return "[互動按鈕]";
      if (CONTAINERS.test(n)) {
        if (t.selfClosing) return "";
        return n === "badge" ? "（" : n === "list-item" ? "- " : "";
      }
      if (n === "Link") { const u = str(raw, "url"), ti = str(raw, "title"); return u && ti ? "[" + ti + "](" + u + ")" : (u || ti || "[動態連結，網址未保留]"); }
      if (n === "Cite") {
        const ref = str(raw, "ref") || str(raw, "refs") || (raw.match(/\brefs?=\{([^}]+)\}/) || [])[1] || "";
        // 有對照表時換成 [來源 n]；沒有（或這個編號查不到網址）就明講沒取得
        if (cite) return cite(ref.match(/turn\d+[a-z_]+\d+/gi) || []);
        return ref ? "[來源：" + ref + "]" : "[來源（原始引用標記）]";
      }
      if (n === "MemoryCite") return "[引用記憶]";
      if (n === "FileCite") { const a = num(raw, "line_range_start"), b = num(raw, "line_range_end"); return a && b ? "[引用附件第 " + a + "–" + b + " 行]" : "[引用附件]"; }
      if (n === "Entity") return str(raw, "value");
      if (n === "AsyncImage" || n === "Image") { const q = str(raw, "query") || str(raw, "alt"); return q ? "[網路圖片：" + q + "]" : "[網路圖片]"; }
      if (n === "Chart") { const ti = jsonStr(raw, "title") || jsonStr(raw, "description"); return ti ? "[圖表：" + ti + "]" : "[圖表]"; }
      
       if (n === "input" || n === "select" || n === "slider" || n === "date-picker" || n === "textarea") return "[互動輸入欄位]";
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
    // 只轉換顯示層的動態模板，不執行任何 JavaScript：資料只用下面的字面值解析器讀（陣列、物件、字串、數字），
    // 讀不懂的就原樣留著，不刪掉，免得圖示裡的文字整段消失。
    // ChatGPT 畫圖示時常把文字放在 {@body const items = [{t:"…", s:"…"}]} 裡，再用 {#each items as item}…{item.t}…{/each} 展開。
    const readLiteral = (s, at) => {
      let k = at;
      const ws = () => {
        for (;;) {
          while (k < s.length && /\s/.test(s[k])) k++;
          if (s.startsWith("//", k)) { while (k < s.length && s[k] !== "\n") k++; continue; }
          if (s.startsWith("/*", k)) { const e = s.indexOf("*/", k + 2); k = e < 0 ? s.length : e + 2; continue; }
          return;
        }
      };
      const fail = () => { throw new Error("literal"); };
      const quoted = () => {
        const q = s[k++];
        let out = "";
        while (k < s.length) {
          const c = s[k++];
          if (c === q) return out;
          if (q === "`" && c === "$" && s[k] === "{") fail();   // 模板字串裡的運算式不展開
          if (c !== "\\") { out += c; continue; }
          const e = s[k++];
          if (e === "u" && /^[0-9a-f]{4}$/i.test(s.slice(k, k + 4))) { out += String.fromCharCode(parseInt(s.slice(k, k + 4), 16)); k += 4; }
          else out += e === "n" ? "\n" : e === "t" ? "\t" : e === "\n" ? "" : e;
        }
        fail();
      };
      const value = (depth) => {
        if (depth > 24) fail();
        ws();
        const c = s[k];
        if (c === "[") {
          k++;
          const arr = [];
          for (;;) {
            ws();
            if (s[k] === "]") { k++; return arr; }
            arr.push(value(depth + 1));
            ws();
            if (s[k] === ",") { k++; continue; }
            if (s[k] === "]") { k++; return arr; }
            fail();
          }
        }
        if (c === "{") {
          k++;
          const obj = Object.create(null);
          for (;;) {
            ws();
            if (s[k] === "}") { k++; return obj; }
            let key;
            if (s[k] === "\"" || s[k] === "'") key = quoted();
            else { const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(k, k + 200)); if (!m) fail(); key = m[0]; k += key.length; }
            ws();
            if (s[k] !== ":") fail();
            k++;
            obj[key] = value(depth + 1);
            ws();
            if (s[k] === ",") { k++; continue; }
            if (s[k] === "}") { k++; return obj; }
            fail();
          }
        }
        if (c === "\"" || c === "'" || c === "`") return quoted();
        const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(k, k + 40));
        if (m) { k += m[0].length; return Number(m[0]); }
        for (const [w, v] of [["true", true], ["false", false], ["null", null]]) {
          if (s.startsWith(w, k) && !/[\w$]/.test(s[k + w.length] || "")) { k += w.length; return v; }
        }
        fail();
      };
      try { const v = value(0); ws(); return { value: v, end: k }; } catch (e) { return null; }
    };
    // 從 at 的「{」找到對應的「}」：引號裡的括號不算
    const braceEnd = (s, at) => {
      let depth = 0, quote = null;
      for (let k = at; k < s.length; k++) {
        const c = s[k];
        if (quote) { if (c === "\\") k++; else if (c === quote) quote = null; continue; }
        if (c === "\"" || c === "'" || c === "`") { quote = c; continue; }
        if (c === "{") depth++;
        else if (c === "}" && --depth === 0) return k + 1;
      }
      return -1;
    };
    const lookup = (expr, scope) => {
      const m = /^\s*([A-Za-z_$][\w$]*)((?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[\s*(?:\d+|"[^"]*"|'[^']*')\s*\]))*)\s*$/.exec(expr);
      if (!m || !(m[1] in scope)) return undefined;
      let v = scope[m[1]];
      const steps = m[2].match(/\.\s*[A-Za-z_$][\w$]*|\[\s*(?:\d+|"[^"]*"|'[^']*')\s*\]/g) || [];
      for (const st of steps) {
        if (v === null || typeof v !== "object") return undefined;
        const key = st[0] === "." ? st.slice(1).trim() : st.slice(1, -1).trim().replace(/^["']|["']$/g, "");
        if (!Object.prototype.hasOwnProperty.call(v, key)) return undefined;
        v = v[key];
      }
      return v;
    };
    const shown = (v) => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : undefined;
    const DEF = /^\{@(?:body|const)\s+(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*/;
    const EACH = /^\{#each\s+([\s\S]+?)\s+as\s+(\{[^}]*\}|\[[^\]]*\]|[A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*))?\s*(?:\([^)]*\))?\s*\}$/;
    // 找出跟這個 {#each} 配對的 {/each}（中間可能還有一層 {#each}）
    const eachBlock = (s, at) => {
      let depth = 0;
      const re = /\{#each\b|\{\/each\}/g;
      re.lastIndex = at;
      for (let m; (m = re.exec(s));) {
        if (m[0] === "{#each") depth++;
        else if (--depth === 0) return { bodyEnd: m.index, end: m.index + m[0].length };
      }
      return null;
    };
    const expand = (s, scope, stats) => {
      let out = "";
      for (let k = 0; k < s.length;) {
        const open = s.indexOf("{", k);
        if (open < 0) { out += s.slice(k); break; }
        out += s.slice(k, open);
        // 模板語法（{@…}、{#…}、{:…}、{/…}）才照括號配對讀到底；一般的 {…} 只看同一行最近的 }
        const simple = /^\{[^{}\n]*\}/.exec(s.slice(open, open + 400));
        const close = /[@#:/]/.test(s[open + 1] || "") ? braceEnd(s, open) : simple ? open + simple[0].length : -1;
        if (close < 0) { out += "{"; k = open + 1; continue; }
        const tag = s.slice(open, close);
        if (s[open - 1] === "$") { out += tag; k = close; continue; }   // JS 模板字串裡的 ${…}（例如 d={`M${x-4} 26`}）：不是網站模板，不替換
        const def = DEF.exec(tag);
        if (def) {
          const lit = readLiteral(tag, def[0].length);
          if (lit && /^;?\s*\}$/.test(tag.slice(lit.end))) {
            scope[def[1]] = lit.value;
            stats.data++;
            out = out.replace(/[ \t]*$/, "");
            k = close;
            if (s[k] === "\n" && /(^|\n)$/.test(out)) k++;   // 獨佔一行的定義：連同換行拿掉
            continue;
          }
          out += tag; k = close; stats.kept++;            // 不是單純資料（例如計算式）：原樣保留
          continue;
        }
        if (tag.startsWith("{#each")) {
          const head = EACH.exec(tag), block = eachBlock(s, open);
          if (!head || !block) { out += tag; k = close; stats.kept++; continue; }
          const body = s.slice(close, block.bodyEnd);
          let list = lookup(head[1], scope);
          if (list === undefined) { const lit = readLiteral(head[1], 0); if (lit && lit.end === head[1].length) list = lit.value; }
          if (!Array.isArray(list)) {
            // 資料來源看不懂：內容照留一份，標明重複的資料沒有還原
            out += "[重複區塊：資料未能還原]\n" + expand(body, scope, stats);
            stats.kept++;
            k = block.end;
            continue;
          }
          // 舊式互動清單：選項是字串、內容是勾選框，照舊列成勾選清單
          if (/<(checkbox|radio)\b/.test(body) && list.every((x) => typeof x === "string")) {
            out += list.map((x) => "- [ ] " + x).join("\n");
            k = block.end;
            continue;
          }
          out += list.map((item, idx) => {
            const inner = Object.assign(Object.create(null), scope);
            const name = head[2];
            if (/^[{[]/.test(name)) {
              const keys = name.slice(1, -1).split(",").map((x) => x.split(/[:=]/)[0].trim()).filter(Boolean);
              keys.forEach((key, j) => { inner[key] = name[0] === "[" ? (Array.isArray(item) ? item[j] : undefined) : (item && typeof item === "object" ? item[key] : undefined); });
            } else inner[name] = item;
            if (head[3]) inner[head[3]] = idx;
            return expand(body, inner, stats);
          }).join("");
          stats.expanded++;
          k = block.end;
          continue;
        }
        if (/^\{[#:/](?:if|else|each)\b/.test(tag) || /^\{:else\b/.test(tag)) { k = close; continue; }   // 條件分支：每一支的內容都留著
        if (/^\{(?:selected|value|checked)\./.test(tag)) { out += "[互動值未保存]"; k = close; continue; }
        const v = shown(lookup(tag.slice(1, -1), scope));
        const plus = /^\{\s*([A-Za-z_$][\w$]*)\s*\+\s*(\d+)\s*\}$/.exec(tag);
        if (v !== undefined) out += v;
        else if (plus && typeof scope[plus[1]] === "number") out += String(scope[plus[1]] + Number(plus[2]));
        else out += tag;
        k = close;
      }
      return out;
    };
    const prepareInteractive = (raw, stats) => {
      if (!/\{@body|\{@const|\{#each|\{#if/.test(raw)) return raw;
      return raw.split(/(```[\s\S]*?```)/).map((part, k) => (k % 2 ? part : expand(part, Object.create(null), stats))).join("");
    };
    // <svg> 圖示：網站畫成流程圖、示意圖，存成文字時只剩一堆座標。
    // 換成 [圖示] 加上圖裡的文字（每個 <text> 一行，照原本順序）；沒有文字的純裝飾圖（箭頭、連接線）整段拿掉。
    const ENTITY = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
    const decode = (t) => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => e[0] === "#"
      ? String.fromCodePoint(parseInt(e[1].toLowerCase() === "x" ? e.slice(2) : e.slice(1), e[1].toLowerCase() === "x" ? 16 : 10))
      : (ENTITY[e.toLowerCase()] !== undefined ? ENTITY[e.toLowerCase()] : all));
    const svgText = (svg) => {
      const lines = [];
      let cur = "", skip = 0, title = "";
      const flush = () => { const t = decode(cur).replace(/\s+/g, " ").trim(); if (t) lines.push(t); cur = ""; };
      const re = /<(\/?)([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|\{[^}]*\}|[^>"'{])*)>|([^<]+)/g;
      let titleNext = false;
      for (let m; (m = re.exec(svg));) {
        if (m[4] !== undefined) {
          if (skip) continue;
          if (titleNext && !title) { title = decode(m[4]).replace(/\s+/g, " ").trim(); continue; }
          cur += m[4];
          continue;
        }
        const closing = m[1] === "/", name = m[2].toLowerCase(), self = /\/\s*$/.test(m[3]);
        if (name === "style" || name === "script") { if (!self) skip += closing ? -1 : 1; continue; }
        if (name === "title" && !self) { titleNext = !closing; if (!closing) flush(); continue; }
        if (name === "tspan" && !closing && /\b(?:dy|y|x)\s*=/.test(m[3])) { flush(); continue; }
        if (name === "tspan") continue;
        flush();   // 其他元素的邊界（<text>、<g>…）都當成換行
      }
      flush();
      return { title, lines };
    };
    const svgOut = (svg, stats) => {
      const { title, lines } = svgText(svg);
      stats.visuals++;
      if (!lines.length && !title) return "";
      return "\n[圖示" + (title ? "：" + title : "") + "]\n" + lines.map((t) => "- " + t).join("\n") + "\n";
    };
    // 不能先用反引號切出行內程式碼：<svg> 的屬性也會用 JS 模板字串（d={`M${x-4} 26`}），會把一張圖切斷。
    // 改成逐一找 <svg>，只有它前面同一行的反引號是奇數個（真的在 `…` 裡）才跳過。
    const convertSvg = (seg, stats) => {
      if (!/<svg\b/i.test(seg)) return seg;
      let out = "", k = 0;
      const re = /<svg\b|<\/svg\s*>/gi;
      for (;;) {
        re.lastIndex = k;
        let m = re.exec(seg);
        while (m && m[0][1] === "/") m = re.exec(seg);   // 前面多出來的 </svg> 不算
        if (!m) return out + seg.slice(k);
        const start = m.index;
        const lineStart = Math.max(k, seg.lastIndexOf("\n", start - 1) + 1);
        if ((seg.slice(lineStart, start).match(/`/g) || []).length % 2) {
          const tick = seg.indexOf("`", start), nl = seg.indexOf("\n", start);
          const stop = tick >= 0 && (nl < 0 || tick < nl) ? tick + 1 : nl < 0 ? seg.length : nl;
          out += seg.slice(k, stop);
          k = stop;
          continue;
        }
        let depth = 1, end = -1;
        while (depth && (m = re.exec(seg))) {
          if (m[0][1] === "/") { if (--depth === 0) end = m.index + m[0].length; }
          else depth++;   // 圖裡還有一層 <svg>：取到最外層的結尾
        }
        if (end < 0) return out + seg.slice(k);   // 沒有結尾：不是完整的圖，原樣保留
        out += seg.slice(k, start) + svgOut(seg.slice(start, end), stats);
        k = end;
      }
    };
    const stats = { data: 0, expanded: 0, kept: 0, visuals: 0 };
    const prepared = prepareInteractive(text, stats);
    const cleaned = prepared.split(/(```[\s\S]*?```)/).map((part, k) => (k % 2 ? part : cleanPart(convertSvg(part, stats)))).join("")
      .replace(/^[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
    return { text: cleaned, changed: cleaned !== text, visuals: stats.visuals, unresolved: stats.kept };
  };
  // </chatgpt-markup>
  // <grok-markup>
  // Grok 的回答夾著 <grok:render …>…</grok:render> 這種標籤（網站上畫成引用小卡等）。
  // 引用換成 [來源 n]（網址收進這則訊息的 sources），其他整段拿掉；``` 程式碼區塊和 `行內程式碼` 都不動。
  const cleanGrokMarkup = (text, cite) => {
    const citeOf = cite || (() => SOURCE_UNRESOLVED);
    if (!/<grok:[a-z_]+/i.test(text)) return { text, changed: false };
    const cleanPart = (part) => part.split(/(`[^`\n]*`)/).map((seg, k) => k % 2 ? seg : seg
      .replace(/<grok:([a-z_]+)\b[^>]*?\/>/gi, (all) => /citation/i.test(all) ? citeOf(all) : "")
      .replace(/<grok:([a-z_]+)\b([^>]*)>[\s\S]*?<\/grok:\1>/gi, (all, name, attrs) => /citation/i.test(attrs) ? citeOf(all) : "")
    ).join("");
    const cleaned = text.split(/(```[\s\S]*?```)/).map((part, k) => (k % 2 ? part : cleanPart(part))).join("")
      .replace(/[ \t]+(\[來源[ ：])/g, "$1").replace(/^[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
    return { text: cleaned, changed: cleaned !== text };
  };
  // </grok-markup>
  const result = (items, extra) => ({
    items, strategy: extra.strategy, cleaning: extra.cleaning || [], title: document.title, url: location.href,
    scroll: null, api: { ...log, ok: true }, branches: extra.branches, conversation_created_at: extra.created,
    ...(extra.branchCaptured ? { branch_captured: extra.branchCaptured } : {})
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
      // 一輪 = 一則看得見的使用者訊息，到下一則之前（中間的搜尋工具訊息、AI 回答都算這輪）
      let turnNo = 0;
      const turns = {};
      path.forEach((node) => {
        const msg = node.message;
        if (msg && msg.author && msg.author.role === "user" && visible(node)) turnNo++;
        node.__turn = turnNo;
        (turns[turnNo] = turns[turnNo] || []).push(node);
      });
      const items = [];
      const isImagePart = (x) => x && typeof x === "object" && /image/.test(x.content_type || "");
      const pointerId = (x) => String((x && x.asset_pointer) || "").replace(/^[a-z-]+:\/\//i, "") || null;
      // 工具產生的圖片（例如畫圖）掛在工具訊息上，接到下一則 AI 回答
      let pendingGenerated = [];
      path.forEach((node) => {
        const msg = node.message;
        if (!msg || !msg.author || msg.author.role !== "tool" || !msg.content) return;
        const parts = Array.isArray(msg.content.parts) ? msg.content.parts : [];
        const imgs = parts.filter(isImagePart);
        if (imgs.length) node.__generated = imgs.map(pointerId);
      });
      path.forEach((node) => {
        if (node.__generated) {
          node.__generated.forEach((id) => pendingGenerated.push({ kind: "generated_image", name: null, platform_file_id: id }));
          return;
        }
        if (!visible(node)) return;
        const msg = node.message;
        const parts = Array.isArray(msg.content.parts) ? msg.content.parts : [];
        const speaker = msg.author.role === "user" ? "author" : "assistant";
        const prev = items[items.length - 1];
        const joins = !!(prev && prev.speaker === "assistant" && speaker === "assistant");
        // 同一輪被拆成好幾段時共用同一份來源清單，編號才不會重複
        const reg = joins && prev.__reg ? prev.__reg : makeSources();
        let text = parts.filter((x) => typeof x === "string").join("\n").trim();
        if (speaker === "assistant") text = chatgptSources(text, msg.metadata, reg).trim();
        let atts = [];
        const listed = (msg.metadata && Array.isArray(msg.metadata.attachments)) ? msg.metadata.attachments : [];
        if (listed.length) {
          atts = listed.map((a) => ({ kind: /^image\//.test(a.mime_type || "") ? "image" : "file", name: a.name || null,
            platform_file_id: a.id || null }));
        } else {
          atts = parts.filter(isImagePart).map((x) => ({ kind: speaker === "author" ? "image" : "generated_image", name: null,
            platform_file_id: pointerId(x) }));
        }
        if (speaker === "assistant" && pendingGenerated.length) { atts = atts.concat(pendingGenerated); pendingGenerated = []; }
        if (!text && !atts.length && !(joins && reg.list.length)) return;
        // 同一輪回答被網站拆成好幾段時，合併成一則
        if (joins) {
          prev.text = (prev.text + "\n\n" + text).trim();
          prev.platform_message_id += " " + msg.id;
          prev.attachments = prev.attachments.concat(atts);
          return;
        }
        items.push({ speaker, text, platform_message_id: msg.id, timestamp: iso(msg.create_time), attachments: atts, __reg: reg,
          __turn: node.__turn,
          ...(speaker === "assistant" && typeof msg.metadata?.model_slug === "string" ? { model: msg.metadata.model_slug } : {}) });
      });
      if (pendingGenerated.length) {
        const last = items.filter((i) => i.speaker === "assistant").pop();
        if (last) last.attachments = last.attachments.concat(pendingGenerated);
      }
      let markupCleaned = 0, visualsConverted = 0, templatesKept = 0;
      // 只看畫面上這條路線（不含重新生成後沒選的分支），而且每輪各對各的：
      // 引用編號每輪重新數，全對話共用一張表會把後面的引用對到前面某輪的網址（issue #45）。
      // 這輪找不到就標「未取得網址」，不拿別輪同編號的網址來補：編號每輪重數，別輪的幾乎一定是錯的。
      // other_turn 只是診斷：這個編號在別輪有網址（如果常出現，代表 ChatGPT 其實會跨輪引用，再回來調整）。
      const refIndex = chatgptRefIndex(conv, path);
      const citeStats = { indexed: Object.keys(refIndex.map).length, cited: 0, unresolved: 0, other_turn: 0 };
      const turnIndex = {};
      items.forEach((i) => {
        if (i.speaker !== "assistant") return;
        const local = turnIndex[i.__turn] || (turnIndex[i.__turn] = chatgptRefIndex(conv, turns[i.__turn] || []));
        const cite = (ids) => {
          const ns = ids.map((id) => {
            citeStats.cited++;
            const hit = local.map[id];
            if (!hit) { citeStats.unresolved++; if (refIndex.map[id]) citeStats.other_turn++; return null; }
            return i.__reg.add(hit.url, hit.title, true);
          });
          return i.__reg.mark(ns);
        };
        const c = cleanChatgptMarkup(i.text, cite);
        if (c.changed) { i.text = c.text; markupCleaned++; }
        if (c.visuals) visualsConverted += c.visuals;
        if (c.unresolved) templatesKept += c.unresolved;
      });
      // 這輪搜尋過、但內文沒有引用的網址 → 「參考過」，另存 consulted-sources.jsonl（issue #47）。
      // 一輪有好幾則 AI 回覆時放在這輪最後一則；已被引用的網址 add 會自動略過。
      const lastOfTurn = {};
      items.forEach((i) => { if (i.speaker === "assistant") lastOfTurn[i.__turn] = i; });
      Object.keys(lastOfTurn).forEach((t) => {
        const i = lastOfTurn[t];
        const cited = new Set();
        items.forEach((x) => { if (x.__turn === i.__turn && x.__reg) x.__reg.list.forEach((s) => cited.add(s.url)); });
        (turnIndex[t] || chatgptRefIndex(conv, turns[t] || [])).urls.forEach((u) => {
          let href = u.url;
          try { href = new URL(u.url).href; } catch (e) {}
          if (!cited.has(href)) i.__reg.add(u.url, u.title, false);
        });
      });
      // 診斷用：只有數字和欄位路徑，沒有對話內容
      // 圖示、模板：只記數量；templates_kept 大於 0 代表有模板資料讀不懂、原樣留在文字裡
      if (visualsConverted || templatesKept) log.visuals = { svg: visualsConverted, templates_kept: templatesKept };
      log.source_refs = citeStats.unresolved ? { ...citeStats, paths: refIndex.paths, metadata_keys: refIndex.keys } : citeStats;
      items.forEach((i) => { i.content = withMarkers(i.text, i.attachments, i.speaker); });
      // __reg 帶著函式，不能傳回擴充功能；只留清單
      items.forEach((i) => {
        if (i.__reg && i.__reg.list.length) i.sources = i.__reg.list;
        if (i.__reg && i.__reg.extra.length) i.consulted = i.__reg.extra;
        delete i.__reg;
        delete i.__turn;
      });

      // 附件原檔：先向網站要下載網址（要帶登入的 token），真正下載在擷取後統一處理
      const auth = { Authorization: "Bearer " + session.accessToken };
      const resolved = {};
      for (const att of items.reduce((all, i) => all.concat(i.attachments), [])) {
        const id = att.platform_file_id;
        if (!id) { att.resolve_error = "no_file_id"; continue; }
        if (!(id in resolved)) {
          resolved[id] = null;
          for (const url of ["/backend-api/files/download/" + encodeURIComponent(id) + "?conversation_id=" + m[1] + "&inline=false",
                             "/backend-api/files/" + encodeURIComponent(id) + "/download"]) {
            const info = await getJson(url, auth).catch(() => null);
            if (info && info.download_url) { resolved[id] = { url: new URL(info.download_url, location.origin).href, name: info.file_name || null }; break; }
          }
        }
        const r = resolved[id];
        if (r) { att.srcs = [r.url]; if (!att.name && r.name && att.kind === "file") att.name = r.name; }
        else att.resolve_error = "no_download_url";
      }

      // 分支點：有兩個以上「看得見的」後續訊息的位置
      let branchPoints = 0;
      Object.values(conv.mapping).forEach((node) => {
        const kids = (node.children || []).filter((k) => conv.mapping[k] && conv.mapping[k].message &&
          ["user", "assistant"].includes(conv.mapping[k].message.author.role));
        if (kids.length > 1) branchPoints++;
      });
      return result(items, { strategy: "chatgpt:backend-api", branches: branchPoints, created: iso(conv.create_time),
        cleaning: [].concat(markupCleaned ? ["chatgpt_ui_markup"] : [], visualsConverted ? ["chatgpt_svg_visuals"] : []) });
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

      const textOf = (msg, reg) => {
        if (Array.isArray(msg.content) && msg.content.length) {
          return msg.content.filter((b) => b && b.type === "text" && typeof b.text === "string")
            .map((b) => claudeBlockText(b, reg)).join("\n\n").trim();
        }
        return (msg.text || "").trim();
      };
      const items = [];
      path.forEach((msg) => {
        if (msg.sender !== "human" && msg.sender !== "assistant") return;
        const reg = makeSources();
        const text = textOf(msg, reg);
        const speaker = msg.sender === "human" ? "author" : "assistant";
        // attachments：網站只留抽出來的文字（貼上的長文、文字檔），存成文字檔
        // files_v2：圖片和 PDF 等原檔，依序試預覽、文件、縮圖的網址
        const abs = (u) => (u ? new URL(u, location.origin).href : null);
        const atts = (msg.attachments || []).map((a) => ({ kind: "file", name: a.file_name || null,
            ...(typeof a.extracted_content === "string" && a.extracted_content ? { inline_text: a.extracted_content } : {}) }))
          .concat((msg.files_v2 || msg.files || []).map((f) => ({
            kind: f.file_kind === "image" ? "image" : "file", name: f.file_name || null, platform_file_id: f.file_uuid || null,
            srcs: [f.preview_asset && f.preview_asset.url, f.preview_url, f.document_asset && f.document_asset.url,
              f.thumbnail_asset && f.thumbnail_asset.url, f.thumbnail_url].map(abs).filter(Boolean)
              .filter((u, k, all) => all.indexOf(u) === k) })));
        if (!text && !atts.length) return;
        items.push({ speaker, text, content: withMarkers(text, atts, speaker),
          platform_message_id: msg.uuid, timestamp: iso(msg.created_at), attachments: atts,
          ...(speaker === "assistant" && reg.list.length ? { sources: reg.list } : {}) });
      });

      const childCount = {};
      conv.chat_messages.forEach((x) => { childCount[x.parent_message_uuid] = (childCount[x.parent_message_uuid] || 0) + 1; });
      const branchPoints = Object.values(childCount).filter((n) => n > 1).length;
      return result(items, { strategy: "claude:api", branches: branchPoints, created: iso(conv.created_at) });
    }

    if (platform === "grok") {
      const m = location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
      if (!m) { note("conversation_id", "not_found"); return { api: log }; }
      const base = "/rest/app-chat/conversations/" + m[1];
      const tree = await getJson(base + "/response-node?includeThreads=true");
      const nodes = tree && Array.isArray(tree.responseNodes) ? tree.responseNodes.filter((n) => n && n.responseId) : [];
      if (!nodes.length) { note("response_nodes", "missing"); return { api: log }; }

      // 一次最多要 50 則的內容
      const byId = {};
      const ids = nodes.map((n) => n.responseId);
      for (let k = 0; k < ids.length; k += 50) {
        const res = await fetch(base + "/load-responses", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseIds: ids.slice(k, k + 50) })
        });
        note("load-responses", res.status);
        if (!res.ok) return { api: log };
        const data = await res.json();
        (data && Array.isArray(data.responses) ? data.responses : []).forEach((r) => { if (r && r.responseId) byId[r.responseId] = r; });
      }
      // 樹狀結構：以 response-node 為準，缺的父節點用回應內容補
      const parentOf = {};
      nodes.forEach((n) => { parentOf[n.responseId] = n.parentResponseId || (byId[n.responseId] || {}).parentResponseId || null; });
      const children = {};
      ids.forEach((id) => { const p = parentOf[id]; if (p) (children[p] = children[p] || []).push(id); });
      const timeOf = (id) => {
        const t = (byId[id] || {}).createTime;
        if (typeof t === "number") return t > 1e12 ? t : t * 1000;
        const d = Date.parse(t);
        return isNaN(d) ? 0 : d;
      };
      const isoOf = (id) => { const t = timeOf(id); return t ? new Date(t).toISOString() : null; };
      // 往下走到底：有好幾個後續時取最新的那個
      const descend = (id) => {
        for (let guard = 0; children[id] && children[id].length && guard < 100000; guard++) {
          id = children[id].slice().sort((a, b) => timeOf(b) - timeOf(a))[0];
        }
        return id;
      };

      // 決定要抓哪一條路線：
      // 1. 畫面上正在顯示的那條（訊息元素的 id 是 response-<編號>）
      // 2. 網址上指定的回應（?rid=）
      // 3. 都沒有時，取最新的那條
      let leaf = null, branchCaptured = "latest_path";
      const onScreen = Array.from(document.querySelectorAll('[id^="response-"]'))
        .map((el) => el.id.slice("response-".length)).filter((id) => byId[id] || parentOf[id] !== undefined);
      if (onScreen.length) {
        leaf = descend(onScreen[onScreen.length - 1]);
        branchCaptured = children[onScreen[onScreen.length - 1]] ? "on_screen_path_then_latest" : "on_screen_path";
      } else {
        const rid = new URLSearchParams(location.search).get("rid");
        if (rid && parentOf[rid] !== undefined) { leaf = descend(rid); branchCaptured = "url_rid_path"; }
      }
      if (!leaf) {
        const roots = ids.filter((id) => !parentOf[id] || parentOf[id] === undefined || !ids.includes(parentOf[id]));
        const leaves = ids.filter((id) => !children[id]);
        leaf = leaves.sort((a, b) => timeOf(b) - timeOf(a))[0] || (roots.length ? descend(roots[0]) : ids[ids.length - 1]);
      }
      note("branch", branchCaptured);
      const path = [];
      for (let id = leaf, guard = 0; id && guard < 100000; guard++) {
        path.push(id);
        id = parentOf[id];
        if (id && !ids.includes(id)) break;
      }
      path.reverse();

      // 附件：使用者上傳的檔案和圖片、AI 生成的圖片。原檔放在 assets.grok.com。
      // 欄位名稱沒有公開，所以把所有回應掃一遍，收集「檔案編號 → 檔名、類型、路徑」，以及使用者編號。
      const ASSETS = "https://assets.grok.com/";
      const assetUrl = (p) => /^https?:/i.test(p) ? p : ASSETS + String(p).replace(/^\/+/, "");
      const meta = {};
      let userId = null;
      const scan = (v, depth) => {
        if (depth > 8 || !v) return;
        if (typeof v === "string") {
          const u = v.match(/(?:^|\/)users\/([0-9a-f-]{8,})\//i);
          if (u && !userId) userId = u[1];
          return;
        }
        if (Array.isArray(v)) { v.forEach((x) => scan(x, depth + 1)); return; }
        if (typeof v === "object") {
          const id = v.fileMetadataId || v.fileId || null;
          if (id) {
            const prev = meta[id] || {};
            meta[id] = { name: prev.name || v.fileName || v.name || null, mime: prev.mime || v.fileMimeType || v.mimeType || "",
              uri: prev.uri || v.fileUri || v.uri || null };
          }
          Object.values(v).forEach((x) => scan(x, depth + 1));
        }
      };
      scan(Object.values(byId), 0);
      if (!userId) {
        const img = document.querySelector('img[src*="assets.grok.com/users/"]');
        const u = img && img.src.match(/\/users\/([0-9a-f-]{8,})\//i);
        if (u) userId = u[1];
      }
      const fromRef = (ref, kindHint) => {
        const key = ref && typeof ref === "object" ? (ref.fileMetadataId || ref.fileId || null) : ref;
        const looksPath = typeof key === "string" && (/^https?:/i.test(key) || key.includes("/"));
        const md = (!looksPath && key && meta[key]) || {};
        const name = (ref && typeof ref === "object" && (ref.fileName || ref.name)) || md.name || null;
        const mime = (ref && typeof ref === "object" && (ref.fileMimeType || ref.mimeType)) || md.mime || "";
        const srcs = [];
        if (looksPath) srcs.push(assetUrl(key));
        if (md.uri) srcs.push(assetUrl(md.uri));
        if (!looksPath && key && userId) srcs.push(ASSETS + "users/" + userId + "/" + key + "/content");
        if (!looksPath && key) {
          const img = document.querySelector('img[src*="' + String(key).replace(/"/g, "") + '"]');
          if (img) srcs.push(img.src);
        }
        const kind = kindHint || (/^image\//.test(mime) ? "image" : "file");
        return { kind, name, platform_file_id: looksPath ? null : key,
          srcs: srcs.filter((u, k, all) => all.indexOf(u) === k) };
      };
      const fileAtts = (r) => {
        const list = Array.isArray(r.fileAttachmentsMetadata) && r.fileAttachmentsMetadata.length ? r.fileAttachmentsMetadata
          : (Array.isArray(r.fileAttachments) ? r.fileAttachments : []);
        const files = list.map((f) => fromRef(f, null));
        const images = (Array.isArray(r.imageAttachments) ? r.imageAttachments : []).map((f) => fromRef(f, "image"));
        return files.concat(images);
      };
      const items = [];
      let markupCleaned = 0;
      // 診斷用：只有數字和欄位名稱，沒有對話內容
      const grokStats = { answers: 0, cite_tags: 0, unresolved: 0, cards: 0, web_results: 0 };
      const grokKeys = new Set();
      path.forEach((id) => {
        const r = byId[id];
        if (!r) { note("response_" + id.slice(0, 8), "missing"); return; }
        const sender = String(r.sender || "").toLowerCase();
        if (sender !== "human" && sender !== "assistant") return;
        const speaker = sender === "human" ? "author" : "assistant";
        let text = typeof r.message === "string" ? r.message.trim() : "";
        const reg = makeSources();
        if (speaker === "assistant") {
          const cite = grokCiter(r, reg);
          const c = cleanGrokMarkup(text, cite);
          if (c.changed) { text = c.text; markupCleaned++; }
          // Grok 常常不在句子裡放引用，只在回答底下列「參考了哪些網頁」（一則可能幾十個）。
          // 這份清單一律留下，存到獨立檔案；句子裡有引用到的不重複列。
          cite.listAll();
          grokStats.answers++;
          grokStats.cite_tags += cite.tags; grokStats.unresolved += cite.unresolved;
          grokStats.web_results += cite.results; grokStats.cards += cite.cards;
          Object.keys(r).forEach((k) => { const v = r[k]; if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) grokKeys.add(k); });
        }
        let atts = fileAtts(r);
        if (speaker === "assistant") {
          const gen = Array.isArray(r.generatedImageUrls) ? r.generatedImageUrls : [];
          atts = atts.concat(gen.map((u) => ({ kind: "generated_image", name: null, srcs: [assetUrl(u)] })));
        }
        if (!text && !atts.length) return;
        items.push({ speaker, text, content: withMarkers(text, atts, speaker),
          platform_message_id: r.responseId, timestamp: isoOf(id), attachments: atts,
          ...(reg.list.length ? { sources: reg.list } : {}),
          ...(reg.extra.length ? { consulted: reg.extra } : {}) });
      });

      // 診斷用：只有數字和欄位名稱，沒有對話內容
      log.source_refs = { ...grokStats, saved: items.reduce((n, i) => n + (i.sources ? i.sources.length : 0), 0),
        consulted: items.reduce((n, i) => n + (i.consulted ? i.consulted.length : 0), 0),
        response_keys: Array.from(grokKeys).sort().slice(0, 80) };

      const branchPoints = Object.values(children).filter((k) => k.length > 1).length;
      const created = ids.map(timeOf).filter(Boolean).sort((a, b) => a - b)[0];
      return result(items, { strategy: "grok:rest-app-chat", branches: branchPoints,
        created: created ? new Date(created).toISOString() : null, branchCaptured,
        cleaning: markupCleaned ? ["grok_render_markup"] : [] });
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
  // 來源小卡：畫面上只是一顆按鈕，網址通常要點開才看得到。
  // 先試著從小卡的屬性找網址；找不到就在原位置寫「未取得網址」，不讓引用無聲消失。
  const GEMINI_CHIPS = "sources-carousel-inline, source-inline-chip, .source-inline-chip-container";
  function geminiChipMarker(chip, src) {
    const urls = [];
    [chip].concat(Array.from(chip.querySelectorAll("*"))).forEach((el) => {
      if (el.tagName === "IMG") return;   // 小圖示的網址不是來源
      Array.from(el.attributes || []).forEach((at) => {
        const v = String(at.value || "");
        if (/^https?:\/\//i.test(v) && !/favicon|gstatic\.com/i.test(v) && urls.indexOf(v) < 0) urls.push(v);
      });
    });
    if (!src || !urls.length) return "[來源：未取得網址]";
    const ns = urls.map((u) => {
      let s = src.find((x) => x.url === u);
      if (!s) { s = { n: src.length + 1, url: u, title: null, inline: true }; src.push(s); }
      s.inline = true;
      return s.n;
    });
    return "[來源 " + ns.join("、") + "]";
  }
  function geminiText(node, src) {
    if (!node.querySelector(GEMINI_NOISE)) return node.innerText;
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-100000px;top:0;width:" + Math.max(300, node.clientWidth) + "px;";
    const copy = node.cloneNode(true);
    outermost(Array.from(copy.querySelectorAll(GEMINI_CHIPS))).forEach((chip) => {
      chip.replaceWith(document.createTextNode(geminiChipMarker(chip, src)));
    });
    copy.querySelectorAll(GEMINI_NOISE).forEach((el) => el.remove());
    box.appendChild(copy);
    document.body.appendChild(box);
    const text = copy.innerText;
    box.remove();
    cleaning.add("strip_gemini_controls");
    return text;
  }

  // 此階段先保留附件線索；finalizeCapture 後續嘗試下載原檔，取不到會記錄失敗原因
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
  // Grok 訊息裡的按鈕、圖示、思考過程摺疊區
  const GROK_NOISE = "button, svg, [role='button'], .thinking-container, [class*='think']";
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

  // 捲動讀取時（ChatGPT、Claude、Grok）：訊息裡看得到的圖片，之後試著下載原檔
  function domImages(node, speaker) {
    const atts = [];
    if (!node || !node.querySelectorAll) return atts;
    node.querySelectorAll("img").forEach((img) => {
      if (img.closest("button, a[href*='favicon'], [class*='avatar']")) return;
      const rect = img.getBoundingClientRect();
      const w = rect.width || img.naturalWidth || Number(img.getAttribute("width")) || 0;
      if (w && w < 64) return;
      const alt = (img.getAttribute("alt") || "").trim();
      atts.push({ kind: "image", name: looksLikeFile(alt) ? alt : null, src: imgSrc(img) });
    });
    return atts;
  }

  // <dom-source-links>
  // 讀畫面時 innerText 只剩文字，連結的網址會不見；這裡把 AI 回答裡指向站外的連結收成 sources 清單。
  // 畫面上看不出哪個連結對哪一句，所以都是 inline: false，文字不加記號。
  function domLinks(node) {
    const list = [];
    if (!node || !node.querySelectorAll) return list;
    node.querySelectorAll("a[href]").forEach((a) => {
      try {
        if (a.closest("model-thoughts")) return;
        let u = new URL(a.getAttribute("href"), location.href);
        // Google 的轉址連結：取出真正的目的地
        if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") {
          const q = u.searchParams.get("q") || u.searchParams.get("url");
          if (q) u = new URL(q);
        }
        if (u.protocol !== "https:" && u.protocol !== "http:") return;
        if (u.hostname === location.hostname) return;
        const title = (a.innerText || a.getAttribute("aria-label") || a.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (!title && a.querySelector("img")) return;   // 純圖片連結多半是附件或縮圖
        const known = list.find((x) => x.url === u.href);
        if (known) { if (!known.title && title && title !== u.href) known.title = title; return; }
        list.push({ n: list.length + 1, url: u.href, title: title && title !== u.href ? title : null, inline: false });
      } catch (e) {}
    });
    return list;
  }
  // </dom-source-links>

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
          const src = domLinks(r);
          if (body) out.push({ node: body, speaker: "assistant", raw: geminiText(body, src), platform_message_id: null,
            attachments: geminiResponseImages(r), sources: src,
            key: turnKey ? "turn:" + turnKey + ":r" : null });
        }
      });
    }
    if (platform === "grok") {
      // 每則訊息外層的 id 是 response-<編號>；使用者的訊息靠右（items-end）
      strategy = "grok:response-id";
      outermost(Array.from(document.querySelectorAll('[id^="response-"]'))).forEach((node) => {
        const body = node.querySelector(".message-bubble") || node;
        const isUser = /(^|\s)items-end(\s|$)/.test(node.className || "") || !!node.querySelector(".items-end .message-bubble");
        let raw = body.innerText;
        if (body.querySelector(GROK_NOISE)) {
          const copy = body.cloneNode(true);
          copy.querySelectorAll(GROK_NOISE).forEach((el) => el.remove());
          raw = offscreenText(copy, body.clientWidth);
          cleaning.add("strip_grok_controls");
        }
        out.push({ node: body, speaker: isUser ? "author" : "assistant", raw,
          platform_message_id: node.id.slice("response-".length) });
      });
    }
    return out.map((m) => {
      const atts = m.attachments || (platform === "gemini" ? [] : domImages(m.node, m.speaker));
      const text = clean(stripButtons(m.raw));
      const content = withMarkers(text, atts, m.speaker);
      return { node: m.node, speaker: m.speaker, content, text, platform_message_id: m.platform_message_id, key: m.key || null,
        attachments: atts, truncated: TRUNCATED_TAIL.test(text),
        sources: m.sources || (m.speaker === "assistant" ? domLinks(m.node) : []) };
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
      attachments: m.attachments || [], truncated: m.truncated,
      ...(m.sources && m.sources.length ? { sources: m.sources } : {}) })),
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
    gemini: /\/(?:app|gem\/[^/]+)\/([0-9a-f]{10,})/i, grok: /\/c\/([0-9a-f-]{36})/i }[platform];
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
// 來源網址統計：total = 跟著訊息存的網址數；consulted = 另存在獨立檔案的參考網頁數；
// unresolved = 文字裡標了「未取得網址」的引用數
function countSources(items) {
  let total = 0, unresolved = 0, consulted = 0;
  (items || []).forEach((i) => {
    if (Array.isArray(i.sources)) total += i.sources.length;
    if (Array.isArray(i.consulted)) consulted += i.consulted.length;
    if (i.speaker === "assistant" && typeof i.content === "string") unresolved += i.content.split("[來源：未取得網址]").length - 1;
  });
  return { total, consulted, unresolved };
}

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
    sources: countSources(items).total,
    sources_consulted: countSources(items).consulted,
    sources_unresolved: countSources(items).unresolved,
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
    ...(item.model ? { model: item.model } : {}),
    ...(Array.isArray(item.attachments) && item.attachments.length ? { attachments: item.attachments } : {}),
    ...(Array.isArray(item.sources) && item.sources.length ? { sources: item.sources } : {}),
    // 「參考過但沒對到句子」的網頁另存在 consulted-sources.jsonl，這裡只留數量當指標
    ...(Array.isArray(item.consulted) && item.consulted.length ? { consulted_sources: item.consulted.length } : {})
  })).join("\n") + "\n";
}

// AI 回答時參考過、但沒對到特定句子的網頁清單：一行一則訊息，用 message_id 對回對話原文。
// 沒有任何這類清單時回傳 null（不建立檔案）。
const CONSULTED_FILE = "consulted-sources.jsonl";
function buildConsultedJsonl(items) {
  const lines = [];
  (items || []).forEach((item, i) => {
    if (!Array.isArray(item.consulted) || !item.consulted.length) return;
    lines.push(JSON.stringify({
      message_id: "msg-" + String(i + 1).padStart(6, "0"),
      platform_message_id: item.platform_message_id || null,
      sources: item.consulted.map((s) => ({ url: s.url, title: s.title || null }))
    }));
  });
  return lines.length ? lines.join("\n") + "\n" : null;
}
// 對話閱讀版.md 用：每則訊息後面附上它的來源清單，[來源 n] 才對得到網址（issue #46）。
// 「參考過」的網頁不列出來（常常幾十個），只說有幾個、放在哪個檔案。沒有來源就回傳空陣列。
function readableSourceLines(item) {
  const lines = [];
  const md = (s) => String(s).replace(/([\[\]])/g, "\\$1");
  const list = Array.isArray(item && item.sources) ? item.sources : [];
  if (list.length) {
    lines.push("來源：", "");
    list.forEach((s) => lines.push("- [來源 " + s.n + "] [" + md(s.title || s.url) + "](<" + s.url + ">)"));
    lines.push("");
  }
  const seen = Array.isArray(item && item.consulted) ? item.consulted.length : 0;
  if (seen) lines.push("另外參考過 " + seen + " 個網頁（沒有對到特定句子），清單在 source/" + CONSULTED_FILE + "。", "");
  return lines;
}
// 寫檔用：有清單就回傳一個檔案項目（key 是 "content" 或 ZIP 用的 "data"），沒有就是空陣列
function consultedFileEntries(prefix, items, key) {
  const text = buildConsultedJsonl(items);
  return text ? [{ path: prefix + "source/" + CONSULTED_FILE, [key || "content"]: text }] : [];
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
    ...(countSources(page.items).consulted ? ["  - path: source/" + CONSULTED_FILE, "    role: consulted_sources"] : []),
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
    "  branch_captured: " + (page.branch_captured || "current_path"),
    "  conversation_created_at: " + (page.conversation_created_at ? q(page.conversation_created_at) : "null"),
    "  conversation_updated_at: " + (page.conversation_updated_at ? q(page.conversation_updated_at) : "null"),
    "  time_source: " + (page.time_source ? q(page.time_source) : (page.api && page.api.ok ? q("site_api") : "null")),
    "  api_fallback_reason: " + (page.api && !page.api.ok ? q(page.api.steps.join(", ")) : "null"),
    "  auto_scroll: " + (page.scroll ? "{down_steps: " + page.scroll.down_steps + ", gaps: " + page.scroll.gaps + ", timed_out: " + page.scroll.timed_out + "}" : "null"),
    "  attachments: " + (page.attachment_report ? "{total: " + page.attachment_report.total + ", saved: " + page.attachment_report.saved +
      ", missing: " + Object.values(page.attachment_report.missing).reduce((a, b) => a + b, 0) + "}" : "null"),
    "  source_links: {total: " + countSources(page.items).total + ", consulted: " + countSources(page.items).consulted +
      ", unresolved: " + countSources(page.items).unresolved + "}",
    // 來源網址的診斷：只有數字和資料欄位名稱，沒有對話內容
    "  source_probe: " + (page.source_probe ? JSON.stringify(page.source_probe) : page.api && page.api.source_refs ? JSON.stringify(page.api.source_refs) : "null"),
    // ChatGPT 圖示：轉成文字的 <svg> 數量；templates_kept 是讀不懂、原樣留在文字裡的模板資料數量
    ...(page.api && page.api.visuals ? ["  visuals: {svg: " + page.api.visuals.svg + ", templates_kept: " + page.api.visuals.templates_kept + "}"] : []),
    "  items_still_truncated: " + page.items.filter((i) => i.truncated).length,
    "  items_detected: " + detected,
    "  items_excluded_by_user: " + (detected - kept),
    "  source_url: " + q(page.url),
    "  page_title: " + q(page.title),
    ...(page.project ? ["  project: {id: " + q(page.project.project_id) + ", name: " + q(page.project.name || "") + "}"] : []),
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

// ── Gemini 來源網址 ──
// 畫面上的來源小卡沒有網址，但 Gemini 載入對話時向 Google 要的資料（記錄器旁聽到的 batchexecute 回應）裡有。
// 做法：在那份資料裡找出每則回答（rc_ 開頭的回答編號），用回答文字對回畫面上抓到的訊息，
// 再把那則回答資料裡出現的網頁網址收下來。
// 目前還不知道網址和小卡怎麼一一對應，所以先存到「參考網頁」獨立檔案（不對到句子）；
// 小卡位置照舊寫「未取得網址」。另外記一份只有數字、欄位位置和型別的診斷（沒有內容），之後照它把對應做準。
function geminiPayloadsOf(raws) {
  const payloads = [];
  (raws || []).forEach((raw) => {
    String(raw || "").replace(/^\)\]\}'\s*/, "").split("\n").forEach((line) => {
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
  return payloads;
}

// 重新整理頁面時，Gemini 可能把對話直接放在網頁本身的 <script>（AF_initDataCallback）裡，
// 不經過 batchexecute，記錄器就聽不到。這裡也從那些 script 讀。
function geminiInitPayloadsOf(texts) {
  const out = [];
  (texts || []).forEach((t) => {
    const re = /AF_initDataCallback\(\{key:\s*'([^']+)'[\s\S]*?data:([\s\S]*?),\s*sideChannel:/g;
    let m;
    while ((m = re.exec(String(t || "")))) {
      try { out.push({ rpc: "init:" + m[1], data: JSON.parse(m[2]) }); } catch (e) {}
    }
  });
  return out;
}

// 注入到 Gemini 頁面：取出網頁本身帶的初始資料 script（只讀，不執行）
function readGeminiInitScripts() {
  const LIMIT = 40 * 1024 * 1024;
  let total = 0;
  return Array.from(document.querySelectorAll("script")).map((el) => el.textContent || "")
    .filter((t) => t.includes("AF_initDataCallback") && (total += t.length) <= LIMIT);
}

function applyGeminiSources(page, raws, initTexts) {
  const payloads = geminiPayloadsOf(raws).concat(geminiInitPayloadsOf(initTexts));
  const probe = { recorder: page.recorder || null, payloads: payloads.length,
    rpcs: {}, candidates: 0, answers: 0, matched: 0, urls: 0, kept: 0, url_paths: {}, url_parents: {},
    answer_lengths: [], best_scores: [], candidate_info: [], urls_by_rpc: {}, init_scripts: (initTexts || []).length,
    payload_scores: [], fallback: 0 };
  payloads.forEach((p) => { const k = String(p.rpc); if (Object.keys(probe.rpcs).length < 40 || probe.rpcs[k]) probe.rpcs[k] = (probe.rpcs[k] || 0) + 1; });
  // 只留字母和數字（含中文），用來比對畫面文字和原始 Markdown
  const squash = (s) => String(s || "").replace(/\[來源[^\]]*\]/g, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
  const isRc = (n) => Array.isArray(n) && typeof n[0] === "string" && /^rc_[0-9a-z]+$/i.test(n[0]);
  const textOf = (n) => {
    const out = [];
    const go = (x, d) => { if (d > 3) return; if (typeof x === "string") out.push(x); else if (Array.isArray(x)) x.forEach((y) => go(y, d + 1)); };
    go(n[1], 0);
    return out.join("\n");
  };
  // 一段資料裡所有文字接起來（不含網址），用來算相似度
  const allText = (n) => {
    const out = [];
    const go = (x, d) => { if (d > 60) return; if (typeof x === "string") { if (!/^https?:\/\//i.test(x)) out.push(x); } else if (Array.isArray(x)) x.forEach((y) => go(y, d + 1)); };
    go(n, 0);
    return out.join("\n");
  };
  const candidates = [];
  const seen = new Set();
  const walk = (n, depth) => {
    if (!Array.isArray(n) || depth > 40) return;
    if (isRc(n)) {
      const key = n[0] + ":" + textOf(n).length;
      if (!seen.has(key)) { seen.add(key); candidates.push({ node: n, flat: squash(textOf(n)), rpc: walk.rpc }); }
      return;
    }
    n.forEach((c) => walk(c, depth + 1));
  };
  payloads.forEach((p) => { walk.rpc = String(p.rpc); walk(p.data, 0); });
  // 每個 rpc 的資料裡總共有幾個網址（只算數量），用來判斷網址在不在記錄到的資料裡
  const countUrls = (n, d) => !Array.isArray(n) || d > 60 ? 0 : n.reduce((a, x) => a + (typeof x === "string" && /^https?:\/\//i.test(x) ? 1 : countUrls(x, d + 1)), 0);
  payloads.forEach((p) => { const c = countUrls(p.data, 0); if (c) probe.urls_by_rpc[p.rpc] = (probe.urls_by_rpc[p.rpc] || 0) + c; });
  probe.candidates = candidates.length;

  // 不是來源的網址：小圖示、圖片、Google 自己的資源
  const NOT_SOURCE = /(^https?:\/\/[^/]*(gstatic\.com|googleusercontent\.com|ggpht\.com|encrypted-tbn\d*\.)|\/s2\/favicons|faviconV2|\.(png|jpe?g|gif|webp|svg|ico)(\?|$))/i;
  const typeSig = (arr) => arr.slice(0, 12).map((x) => x === null ? "0" : Array.isArray(x) ? "a" : typeof x === "string" ? (/^https?:\/\//.test(x) ? "u" : "s") : typeof x === "number" ? "n" : typeof x === "boolean" ? "b" : "o").join("");
  const bump = (obj, k) => { if (Object.keys(obj).length < 30 || obj[k]) obj[k] = (obj[k] || 0) + 1; };
  const urlsIn = (root) => {
    const found = [];
    const go = (n, path, depth) => {
      if (!Array.isArray(n) || depth > 30) return;
      n.forEach((x, k) => {
        if (typeof x === "string" && /^https?:\/\//i.test(x)) {
          probe.urls++;
          bump(probe.url_paths, path.concat(k).join("."));
          bump(probe.url_parents, typeSig(n));
          if (NOT_SOURCE.test(x)) return;
          // 標題：同一層裡第一個不是網址、長度合理的文字
          const title = n.find((y) => typeof y === "string" && y !== x && !/^https?:\/\//i.test(y) && y.trim().length > 1 && y.length <= 300) || null;
          found.push({ url: x, title });
        } else if (Array.isArray(x)) go(x, path.concat(k), depth + 1);
      });
    };
    go(root, [], 0);
    return found;
  };

  page.items.forEach((item) => {
    if (item.speaker !== "assistant") return;
    probe.answers++;
    const flat = squash(item.text !== undefined ? item.text : item.content);
    if (flat.length < 8) return;
    probe.answer_lengths.push(flat.length);
    // 把回答切成每段 12 字，看每個候選含了幾成；取最高的，過半才算同一則
    const pieces = [];
    for (let k = 0; k + 12 <= flat.length; k += 12) pieces.push(flat.slice(k, k + 12));
    let hit = null, best = 0;
    candidates.forEach((c) => {
      const score = pieces.length ? pieces.filter((p) => c.flat.includes(p)).length / pieces.length : 0;
      c.best = Math.max(c.best || 0, score);
      if (score > best) { best = score; hit = c; }
    });
    probe.best_scores.push(Math.round(best * 100) / 100);
    if (!hit || best < 0.5) {
      // 回答不在 rc_ 那種結構裡：改找「含有這則回答過半內容的最小一段資料」，網址從那裡收
      const scoreOf = (flatText) => pieces.filter((p) => flatText.includes(p)).length / pieces.length;
      let top = [];
      payloads.forEach((p, k) => {
        if (p.flat === undefined) p.flat = squash(allText(p.data));   // 每份資料只算一次
        const sc = scoreOf(p.flat);
        if (sc > 0) top.push([String(p.rpc), Math.round(sc * 100) / 100, k]);
      });
      top.sort((a, b) => b[1] - a[1]);
      probe.payload_scores.push(top.slice(0, 3).map((t) => [t[0], t[1]]));
      if (!top.length || top[0][1] < 0.5) return;
      let node = payloads[top[0][2]].data;
      for (let guard = 0; guard < 60; guard++) {
        // 往下縮到最小、但還帶著網址的那一段（再往下就只剩文字，網址在旁邊那一層）
        const next = Array.isArray(node) ? node.find((c) => Array.isArray(c) && countUrls(c, 0) > 0 && scoreOf(squash(allText(c))) >= 0.5) : null;
        if (!next) break;
        node = next;
      }
      hit = { node, fallback: true };
      probe.fallback++;
    }
    probe.matched++;
    const already = new Set((item.sources || []).map((s) => s.url));
    const list = item.consulted || [];
    urlsIn(hit.node).forEach((f) => {
      let href;
      try { href = new URL(f.url).href; } catch (e) { return; }
      if (already.has(href)) return;
      const known = list.find((x) => x.url === href);
      if (known) { if (!known.title && f.title) known.title = f.title.replace(/\s+/g, " ").trim(); return; }
      list.push({ url: href, title: f.title ? f.title.replace(/\s+/g, " ").trim() : null });
    });
    if (list.length) { item.consulted = list; probe.kept += list.length; }
  });
  // 候選回答的概況（只有長度、分數、網址數，沒有內容），最多 40 個
  probe.candidate_info = candidates.slice(0, 40).map((c) => [c.rpc, c.flat.length, Math.round((c.best || 0) * 100) / 100, countUrls(c.node, 0)]);
  page.source_probe = probe;
  return probe;
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

function utf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// 下載附件原檔，回傳要寫進 source/ 的檔案；訊息裡的記號改成指向檔案。
// 每個附件可以有好幾個候選網址（srcs），照順序試，第一個拿到的就用。
// 只有文字內容的附件（例如 Claude 的貼上長文）直接存成文字檔。
async function downloadAttachments(tabId, items) {
  const all = [];
  items.forEach((item) => (item.attachments || []).forEach((att) => all.push(att)));
  const files = [];
  const report = { total: all.length, saved: 0, missing: {} };
  if (!all.length) return { files, report };
  const pathOf = {};
  let n = 0;
  const save = (att, key, b64, ext) => {
    if (!pathOf[key]) {
      n++;
      pathOf[key] = "attachments/" + String(n).padStart(2, "0") + "." + ext;
      files.push({ path: pathOf[key], base64: b64 });
    }
    att.file = pathOf[key];
  };

  const pending = [];
  all.forEach((att) => {
    const list = (att.srcs || []).concat(att.src ? [att.src] : []).filter(Boolean);
    att.__tries = list.filter((u, k) => list.indexOf(u) === k);
    if (att.__tries.length) pending.push(att);
  });
  const got = {};
  for (let round = 0; round < 5; round++) {
    const urls = Array.from(new Set(pending.filter((a) => !a.__done && a.__tries[round]).map((a) => a.__tries[round])))
      .filter((u) => !(u in got));
    if (!urls.length && !pending.some((a) => !a.__done && a.__tries[round])) break;
    if (urls.length) {
      try {
        const [inj] = await chrome.scripting.executeScript({ target: { tabId }, func: fetchAttachmentsInPage, args: [urls, MAX_ATTACHMENT_BYTES] });
        Object.assign(got, (inj && inj.result) || {});
      } catch (e) { /* 換擴充功能自己讀 */ }
      // 頁面裡讀不到的 https 網址（通常是跨網域限制），改由擴充功能自己讀
      for (const url of urls) {
        const r = got[url];
        if (/^https:/.test(url) && (!r || (r.error && r.error !== "too_large"))) got[url] = await fetchAttachmentHere(url, MAX_ATTACHMENT_BYTES);
      }
    }
    pending.forEach((att) => {
      const url = att.__tries[round];
      if (att.__done || !url) return;
      const r = got[url];
      const htmlPage = /^text\/html/i.test(r && r.type || "") && !/\.html?$/i.test(att.name || "");
      if (r && r.b64 && !htmlPage) { save(att, url, r.b64, attachmentExt(att, r.type, url)); att.__done = true; }
      else att.__last = (r && r.error) || (r && r.b64 ? "got_html_page" : "not_found");
    });
  }

  all.forEach((att) => {
    if (!att.file && att.inline_text) {
      const named = att.name && /\.(txt|md|csv|tsv|json|ya?ml|xml|html?|js|ts|py|rb|go|java|c|cpp|h|cs|sql|sh|log|tex|srt)$/i.test(att.name);
      save(att, "inline:" + n + ":" + att.name, utf8Base64(att.inline_text), named ? attachmentExt(att, "", "") : "txt");
      if (!named) att.content_note = "extracted_text";
    }
    if (att.file) report.saved++;
    else {
      att.missing = att.__last || att.resolve_error || "no_source";
      report.missing[att.missing] = (report.missing[att.missing] || 0) + 1;
    }
    ["src", "srcs", "inline_text", "resolve_error", "__tries", "__done", "__last"].forEach((k) => delete att[k]);
  });
  return { files, report };
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

// 擷取完成後一律呼叫：Gemini 補時間；四個平台都下載附件原檔，回傳要一起上傳的附件檔
async function finalizeCapture(tabId, platform, page) {
  let files = [];
  if (platform === "gemini") {
    const conversationId = conversationIdFromUrl(platform, page.url);
    try {
      const [inj] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: readGeminiRecorded });
      const raws = inj && inj.result;
      page.recorder = raws ? (raws.length ? "active" : "active_empty") : "not_loaded";
      if (raws && raws.length) applyGeminiTimes(page, conversationId, parseGeminiRecorded(raws));
      let initTexts = [];
      try {
        const [ini] = await chrome.scripting.executeScript({ target: { tabId }, func: readGeminiInitScripts });
        initTexts = (ini && ini.result) || [];
      } catch (e) {}
      try { applyGeminiSources(page, raws || [], initTexts); } catch (e) { page.source_probe = { recorder: page.recorder, error: String(e && e.message || e).slice(0, 120) }; }
    } catch (e) { page.recorder = "error"; page.source_probe = { recorder: "error" }; }
  }
  const dl = await downloadAttachments(tabId, page.items);
  files = dl.files;
  page.attachment_report = dl.report;
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
