// After-thinking Capture — 標記對話（v0.7.0）
// 在交給 AI 整理之前，讓使用者自己看一遍對話、分主題或標出關鍵。
// 這一頁完全不呼叫 AI：編號、截短、轉向提示、時間間隔都是程式做的。
// 結果存成討論資料夾裡的 outline.json（不寫進 source/）。

const OUTLINE_FILE = "outline.json";
const OUTLINE_VERSION = 3;   // 3：關鍵段落、轉向提示加上理由、指紋附平台訊息編號
const AI_PREVIEW = 200;       // AI 回覆先顯示的字數
const USER_PREVIEW = 1500;    // 使用者訊息超過這個長度才摺疊（通常是貼上的長文件）
const GAP_HOURS = 6;          // 兩則訊息相隔超過這麼久，畫一條分隔線
// 「可能轉向」的提示詞。只是提示，使用者按確認才算數，所以寧可多抓一點
const TURN_WORD_LIST = {
  "中文（繁體）": ["其實", "不對", "改成", "改為", "算了", "等等", "等一下", "回到剛剛", "回到前面", "重新想", "換個方向"],
  // 和繁體字形相同的（改成、算了、等等、等一下、回到前面、重新想）不重複列
  "中文（簡體）": ["其实", "不对", "改为", "回到刚刚", "换个方向"],
  "English": ["actually", "on second thought", "wait,", "no wait", "never mind", "nevermind", "scratch that",
    "I was wrong", "let me rethink", "instead", "change of plan", "change of plans"],
  // 「いや」單獨太常見，只算後面接逗號的
  "日本語": ["実は", "やっぱり", "やはり", "いや、", "いや,", "待って", "訂正", "考え直"]
};
// AI 的回覆開頭像在修正方向（「這樣差很多」「那我會大幅修改前面的…」）時，提示前一句使用者發言可能是轉向。
// 使用者轉向時常常不用固定的詞，AI 的回應反而比較明顯。只看回覆開頭 150 字
const AI_ACK_HEAD = 150;
const AI_ACK_LIST = {
  "中文（繁體）": ["這樣差很多", "我前面是", "我剛剛是", "修改前面", "大幅修改", "調整前面", "放到旁邊", "那我反而", "我誤會了", "誤解了", "原來是這樣"],
  "中文（簡體）": ["这样差很多", "我刚刚是", "调整前面", "放到旁边", "我误会了", "误解了", "原来是这样"],
  "English": ["I misunderstood", "my mistake", "that changes", "in that case", "let me revise", "I'll revise", "revise my", "set aside"],
  "日本語": ["誤解して", "失礼しました", "それなら", "それでしたら", "見直し", "修正します", "前の提案"]
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 英文詞前後要是單字邊界（避免 instead 抓到 insteadOf 之類），中日文不用
const wordsRe = (list) => new RegExp(Object.values(list).flat().map((w) =>
  /^[a-z]/i.test(w) ? "\\b" + escapeRe(w) + (/[a-z]$/i.test(w) ? "\\b" : "") : escapeRe(w)).join("|"), "i");
const TURN_WORDS = wordsRe(TURN_WORD_LIST);
const AI_ACK_WORDS = wordsRe(AI_ACK_LIST);
const TOPIC_IDS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PALETTE = [
  { stripe: "#3451C7", bg: "#E6EBFB", fg: "#1F3487" },
  { stripe: "#C9600F", bg: "#FCE9D8", fg: "#7E3A05" },
  { stripe: "#1F8A70", bg: "#DDF1EA", fg: "#145243" },
  { stripe: "#9B4DB0", bg: "#F2E4F6", fg: "#5F2470" },
  { stripe: "#B8336A", bg: "#FAE3EC", fg: "#7A1D44" },
  { stripe: "#5B6B12", bg: "#EEF2D9", fg: "#3C470A" },
  { stripe: "#1D6FA3", bg: "#DFEEF8", fg: "#11486B" },
  { stripe: "#8A5A00", bg: "#F6ECD6", fg: "#5A3B00" }
];
const NONE = { stripe: "#C9CED6", bg: "#EEF0F3", fg: "#4A515C" };

const $ = (id) => document.getElementById(id);

// ── 狀態 ──

let config = null;
let branch = null;
let ctx = null;        // { kind: "repo" | "file", folder, title, platform, revision, fileName }
let msgs = [];         // [{ id, speaker, content, ts }]，依 order 排好
let anchorOf = [];     // 每則訊息跟著哪一則（AI 回覆跟著前一句使用者發言）
let savedAt = null;    // 目前載入的 outline 的 updated_at
let dirty = false;
let editVersion = 0;   // 每改一次加一；儲存完成時比對，避免把儲存途中的修改誤報成已儲存

const S = {
  mode: null,          // "multi" | "flow" | null（還沒選）
  topics: [],          // [{ id, name, note }]
  tags: {},            // 錨點訊息 id → 主題 id；AI 回覆單獨分類時也記在這裡（"" 代表單獨設成還沒標）
  keys: {},            // 訊息 id → true
  turnsConfirmed: {},  // 使用者自己標、或確認過的轉向
  turnsDismissed: {},  // 程式提示、被使用者刪掉的轉向
  notes: {},           // 訊息 id → 備註
  keyRanges: [],       // 整段標成關鍵：[{ from, to }]（第一則、最後一則的 message_id）
  single: { name: "", note: "" }
};
const UI = { view: "time", filter: "all", range: false, sel: new Set(), last: null, exp: {}, picker: null, noteOpen: {}, moved: new Set() };

// ── 小工具 ──

const width = () => Math.max(3, String(msgs.length).length);
const pad = (i) => String(i + 1).padStart(width(), "0");   // 顯示編號：第 i 則 → 001
const isAnchor = (i) => anchorOf[i] === i;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// AI 回覆預設跟著上一句使用者發言；使用者按「另外分類」後就用自己的
const ownTag = (i) => !isAnchor(i) && has(S.tags, msgs[i].id);
const tagOf = (i) => (ownTag(i) ? S.tags[msgs[i].id] : S.tags[msgs[anchorOf[i]].id]) || null;
const topicById = (id) => S.topics.find((t) => t.id === id) || null;
// 關鍵段落：換成位置 [起, 迄]，照順序
const rangeIdx = () => {
  const pos = new Map(msgs.map((m, i) => [m.id, i]));
  return S.keyRanges.map((r) => [pos.get(r.from), pos.get(r.to)]).filter(([a, b]) => a !== undefined && b !== undefined && a <= b)
    .sort((x, y) => x[0] - y[0]);
};
const rangeOf = (i) => rangeIdx().find(([a, b]) => i >= a && i <= b) || null;
// 一則訊息算不算關鍵：自己被標、或在關鍵段落裡
const isKeyish = (i) => !!S.keys[msgs[i].id] || !!rangeOf(i);
const pal = (id) => { const k = S.topics.findIndex((t) => t.id === id); return k < 0 ? NONE : PALETTE[k % PALETTE.length]; };
const matchesTurnWords = (i) => msgs[i].speaker !== "assistant" && TURN_WORDS.test(msgs[i].content);
// 緊接在這句後面的 AI 回覆，開頭像在修正方向
const aiAckAfter = (i) => {
  const j = i + 1;
  if (msgs[i].speaker === "assistant" || !msgs[j] || msgs[j].speaker !== "assistant" || anchorOf[j] !== i) return false;
  return AI_ACK_WORDS.test(msgs[j].content.replace(/^\s*(\[[^\]\n]*\]\s*)*/, "").slice(0, AI_ACK_HEAD));
};
// 程式提示的理由："keyword"（你的用詞）、"ai_response"（AI 的回應）
const hintReasons = (i) => [matchesTurnWords(i) ? "keyword" : null, aiAckAfter(i) ? "ai_response" : null].filter(Boolean);
// 轉向分兩種：使用者確認過的（算使用者的判斷），和程式依關鍵字提示、還沒確認的
const turnConfirmed = (i) => !!S.turnsConfirmed[msgs[i].id];
const turnHint = (i) => hintReasons(i).length > 0 && !S.turnsDismissed[msgs[i].id] && !turnConfirmed(i);
const HINT_TEXT = { keyword: "你的用詞", ai_response: "AI 的回應像在修正方向" };

// 內容指紋：說話者＋全文的雜湊。重新擷取後訊息編號可能換人，用它確認標記還指著同一段話
function fingerprint(m) {
  const s = m.speaker + "\n" + m.content;
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
  return s.length.toString(36) + "-" + (h >>> 0).toString(16).padStart(8, "0");
}
const sourceFingerprint = () => fingerprint({ speaker: "all", content: msgs.map(fingerprint).join("|") });
const anchors = () => msgs.map((_, i) => i).filter(isAnchor);
const who = (m) => (m.speaker === "author" ? "你" : m.speaker === "assistant" ? "AI" : "外部");

function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") Object.assign(node.style, v);
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("data-")) node.setAttribute(k, v);
    else if (k in node && typeof v !== "string") node[k] = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach((c) => { if (c !== null && c !== undefined && c !== false) node.append(c); });
  return node;
}

// 連續編號縮成範圍：[0,1,2,5] → 001–003、006
function ranges(idxs) {
  if (!idxs.length) return "";
  const out = [];
  let a = idxs[0], b = idxs[0];
  for (let k = 1; k <= idxs.length; k++) {
    const x = idxs[k];
    if (x === b + 1) { b = x; continue; }
    out.push(a === b ? pad(a) : pad(a) + "–" + pad(b));
    a = x; b = x;
  }
  return out.join("、");
}

function gapLabel(i) {
  if (i === 0) return null;
  const a = Date.parse(msgs[i - 1].ts), b = Date.parse(msgs[i].ts);
  if (isNaN(a) || isNaN(b)) return null;
  const h = (b - a) / 3600000;
  if (h < GAP_HOURS) return null;
  return h >= 24 ? "隔了 " + Math.round(h / 24) + " 天" : "隔了 " + Math.round(h) + " 小時";
}

function showError(text) { const e = $("error"); e.textContent = text; e.hidden = false; }
let statusTimer = null;
function showStatus(text, keep, warn) {
  const s = $("status");
  s.textContent = text;
  s.classList.toggle("warn", !!warn);
  s.hidden = false;
  clearTimeout(statusTimer);
  if (!keep) statusTimer = setTimeout(() => { s.hidden = true; }, 6000);
}

// ── 載入 ──

function parseJsonl(text) {
  const rows = text.split("\n").filter((l) => l.trim()).map((l, n) => {
    try { return JSON.parse(l); } catch (e) { throw new Error("conversation.jsonl 第 " + (n + 1) + " 行不是正確的 JSON"); }
  });
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return rows.map((r, n) => ({
    id: r.message_id || "line-" + (n + 1),
    speaker: r.speaker === "author" || r.speaker === "assistant" ? r.speaker : "external",
    content: typeof r.content === "string" ? r.content : "",
    ts: r.timestamp || null,
    pid: r.platform_message_id || null
  }));
}

function computeAnchors() {
  let lastAnchor = -1;
  anchorOf = msgs.map((m, i) => {
    if (m.speaker !== "assistant" || lastAnchor < 0) { lastAnchor = i; return i; }
    return lastAnchor;
  });
}

// 把舊標記裡的 message_id 換成現在這份對話的位置。
// 有內容指紋時：同編號、同內容才直接用；編號換人了就照內容找回新位置（找不到就略過），不會悄悄指錯。
function makeResolver(o) {
  const pos = new Map(msgs.map((m, i) => [m.id, i]));
  const fps = msgs.map(fingerprint);
  const old = o.source && Array.isArray(o.source.message_fingerprints) ? o.source.message_fingerprints : null;
  const stats = { checked: !!old, moved: new Set(), lost: new Set() };
  if (!old) {
    return { stats, resolve: (id) => { if (pos.has(id)) return pos.get(id); stats.lost.add(id); return -1; } };
  }
  const oldFp = new Map();
  old.forEach((pair, k) => { if (Array.isArray(pair)) oldFp.set(pair[0], { f: pair[1], k, pid: pair[2] || null }); });
  // 平台自己的訊息編號（ChatGPT、Claude 有）：內容被重新整理過（例如清掉版面語法）時，用它找回同一則
  const byPid = new Map();
  msgs.forEach((m, i) => { if (m.pid) byPid.set(m.pid, i); });
  const byFp = new Map();
  fps.forEach((f, i) => { if (!byFp.has(f)) byFp.set(f, []); byFp.get(f).push(i); });
  const cache = new Map();
  const resolve = (id) => {
    if (cache.has(id)) return cache.get(id);
    let r = -1;
    const was = oldFp.get(id);
    if (!was) r = pos.has(id) ? pos.get(id) : -1;
    else if (pos.has(id) && fps[pos.get(id)] === was.f) r = pos.get(id);
    else {
      const cands = byFp.get(was.f) || [];
      // 內容一樣的有好幾則時（例如都只說「好」），取離原本位置最近的
      if (cands.length) { r = cands.reduce((best, i) => (Math.abs(i - was.k) < Math.abs(best - was.k) ? i : best)); stats.moved.add(r); }
      else if (was.pid && byPid.has(was.pid)) { r = byPid.get(was.pid); stats.moved.add(r); }
    }
    if (r < 0) stats.lost.add(id);
    cache.set(id, r);
    return r;
  };
  return { stats, resolve };
}

function applyOutline(o) {
  if (!o || typeof o !== "object") return null;
  const { stats, resolve } = makeResolver(o);
  const idOf = (mid) => { const i = resolve(mid); return i < 0 ? null : msgs[i].id; };
  S.mode = o.mode === "multi_topic" ? "multi" : o.mode === "single_topic" ? "flow" : null;
  S.topics = (o.topics || []).filter((t) => t && TOPIC_IDS.includes(t.id))
    .map((t) => ({ id: t.id, name: String(t.name || ""), note: String(t.note || "") }));
  // 先算每一則在舊標記裡屬於哪個主題，再分成「錨點的標籤」和「AI 回覆另外分類」
  const topicAt = new Map();
  (o.topics || []).forEach((t) => (t.messages || []).forEach((mid) => { const i = resolve(mid); if (i >= 0) topicAt.set(i, t.id); }));
  (o.untagged || []).forEach((mid) => { const i = resolve(mid); if (i >= 0 && !topicAt.has(i)) topicAt.set(i, null); });
  S.tags = {};
  topicAt.forEach((tid, i) => { if (isAnchor(i) && tid) S.tags[msgs[i].id] = tid; });
  topicAt.forEach((tid, i) => {
    if (isAnchor(i)) return;
    const anchorTid = S.tags[msgs[anchorOf[i]].id] || null;
    if (tid !== anchorTid) S.tags[msgs[i].id] = tid || "";
  });
  S.keys = {};
  (o.key_points || []).forEach((k) => { const id = k && idOf(k.message_id); if (id) S.keys[id] = true; });
  S.turnsConfirmed = {};
  // v1 的 "manual" 和 v2 的 "user" 都是使用者自己的；v1 的 "auto" 只是程式提示，重新由程式判斷
  (o.turns || []).forEach((t) => { const id = t && (t.source === "manual" || t.source === "user") && idOf(t.message_id); if (id) S.turnsConfirmed[id] = true; });
  S.turnsDismissed = {};
  (o.dismissed_auto_turns || []).forEach((mid) => { const id = idOf(mid); if (id) S.turnsDismissed[id] = true; });
  S.notes = {};
  (o.notes || []).forEach((n) => { const id = n && n.text && idOf(n.message_id); if (id) S.notes[id] = String(n.text); });
  if (o.single_topic) S.single = { name: String(o.single_topic.name || ""), note: String(o.single_topic.note || "") };
  S.keyRanges = [];
  (o.key_ranges || []).forEach((r) => {
    const a = r ? resolve(r.from_message_id) : -1, b = r ? resolve(r.to_message_id) : -1;
    if (a >= 0 && b >= a) S.keyRanges.push({ from: msgs[a].id, to: msgs[b].id });
  });
  stats.sourceChanged = !!(o.source && o.source.fingerprint && o.source.fingerprint !== sourceFingerprint()) ||
    (!stats.checked && o.source && o.source.message_count !== undefined && o.source.message_count !== msgs.length);
  return stats;
}

function defaultState() {
  S.mode = null;
  S.topics = [{ id: "A", name: "主題 A", note: "" }];
  S.tags = {}; S.keys = {}; S.turnsConfirmed = {}; S.turnsDismissed = {}; S.notes = {}; S.keyRanges = [];
  S.single = { name: ctx.title || "", note: "" };
  UI.moved = new Set();
}

// 原文在標記之後變過時，說清楚哪些自動對上、哪些找不到，並在那幾則上標「原文變過」
function reportResolve(stats) {
  if (!stats) return;
  UI.moved = stats.moved;
  const lost = stats.lost.size, moved = stats.moved.size;
  if (!stats.sourceChanged && !lost && !moved) return;
  let text;
  if (!stats.checked) {
    text = "這份標記是舊格式，沒有內容指紋，而原文的訊息數已經不一樣了。標記可能指到錯的訊息，請逐一核對後再儲存。";
  } else {
    text = "原文在上次標記之後變過（例如重新擷取）。" +
      (moved ? moved + " 則依內容或平台的訊息編號對回來了（畫面上標「原文變過，請確認」）。" : "") +
      (lost ? lost + " 個標記在新的原文裡找不到同樣的內容，已略過。" : "") +
      (!moved && !lost ? "所有標記都還對得上。" : "請檢查後再儲存。");
  }
  showStatus(text, true, true);
  if (moved || lost || !stats.checked) { dirty = true; editVersion++; }
}

const draftKey = () => "outlineDraft:" + (ctx.kind === "repo" ? config.repo + ":" + ctx.folder : "file:" + ctx.fileName);

async function startConversation(outline) {
  computeAnchors();
  defaultState();
  let resolved = null;
  if (outline) { resolved = applyOutline(outline); savedAt = outline.updated_at || null; }
  if (!S.single.name) S.single.name = ctx.title || "";
  if (!S.topics.length) S.topics = [{ id: "A", name: "主題 A", note: "" }];

  document.title = (ctx.title || "標記對話") + "｜After-thinking";
  $("title").textContent = ctx.title || "（沒有標題）";
  $("crumb").textContent = ctx.kind === "repo" ? ctx.folder : "從電腦開啟：" + ctx.fileName;
  const nUser = msgs.filter((m) => m.speaker === "author").length;
  const nGaps = msgs.filter((_, i) => gapLabel(i)).length;
  const nTurns = msgs.filter((_, i) => hintReasons(i).length).length;
  $("meta").textContent = [
    ({ chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" }[ctx.platform] || ctx.platform || ""),
    msgs.length + " 則（你 " + nUser + " 則、AI " + (msgs.length - nUser) + " 則）",
    nGaps ? "隔過 " + nGaps + " 次" : "",
    nTurns ? "程式找到 " + nTurns + " 處可能轉向" : "",
    savedAt ? "上次儲存 " + new Date(savedAt).toLocaleString() : ""
  ].filter(Boolean).join(" · ");
  $("mode-stats").textContent = $("meta").textContent;
  reportResolve(resolved);

  // 有比較新的草稿就問要不要接著用
  try {
    const got = await chrome.storage.local.get(draftKey());
    const draft = got[draftKey()];
    if (draft && draft.outline && (!savedAt || draft.outline.updated_at > savedAt)) {
      $("draft-text").textContent = "有一份 " + new Date(draft.outline.updated_at).toLocaleString() + " 還沒儲存的草稿。";
      $("draft-banner").hidden = false;
      $("use-draft").onclick = () => {
        defaultState();
        reportResolve(applyOutline(draft.outline));
        dirty = true;
        editVersion++;
        $("draft-banner").hidden = true;
        showMain();
      };
      $("drop-draft").onclick = async () => {
        await chrome.storage.local.remove(draftKey());
        $("draft-banner").hidden = true;
      };
    }
  } catch (e) { /* 讀不到草稿不影響 */ }

  $("picker").hidden = true;
  $("top-actions").hidden = false;
  $("save").textContent = ctx.kind === "repo" ? "儲存到 GitHub" : "下載 outline.json";
  showMain();
}

async function loadFromRepo(folder) {
  if (/^[/.]/.test(folder) || !folder.endsWith("/") || folder.includes("..") || folder.includes("\\")) throw new Error("資料夾路徑不正確：" + folder);
  const check = await checkRepo(config);
  if (!check.ok) throw new Error(check.message);
  branch = check.branch;
  const [conv, meta, outlineRaw, index] = await Promise.all([
    readRawFile(config, branch, folder + "source/conversation.jsonl"),
    readRawFile(config, branch, folder + "source/metadata.yaml"),
    readRawFile(config, branch, folder + OUTLINE_FILE),
    readCaptureIndex(config, branch).catch(() => [])
  ]);
  if (conv === null) throw new Error("在 " + folder + " 找不到 source/conversation.jsonl");
  msgs = parseJsonl(conv);
  if (!msgs.length) throw new Error("這份對話是空的");
  const row = index.filter((r) => r.folder === folder).pop();
  const metaStr = (key) => {
    const m = meta && meta.match(new RegExp("^\\s*" + key + ":\\s*(.+)$", "m"));
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return m[1].trim(); }
  };
  ctx = {
    kind: "repo", folder,
    title: (row && row.title) || metaStr("page_title") || folder,
    platform: (row && row.platform) || metaStr("platform"),
    revision: Number(metaStr("source_revision")) || 1
  };
  let outline = null;
  if (outlineRaw) {
    try { outline = JSON.parse(outlineRaw); } catch (e) { showStatus("outline.json 讀不懂，先當作沒有標記。儲存時會覆蓋它。", true); }
  }
  await startConversation(outline);
}

async function loadFromFiles(files) {
  const list = Array.from(files);
  // .jsonl 是對話；.json 當作標記檔（瀏覽器重複下載時會改名成 outline (1).json，所以不看檔名）
  const conv = list.find((f) => /\.jsonl$/i.test(f.name)) || list.find((f) => !/\.json$/i.test(f.name));
  const out = list.find((f) => f !== conv && /\.json$/i.test(f.name));
  if (!conv) throw new Error("請選 conversation.jsonl");
  msgs = parseJsonl(await conv.text());
  if (!msgs.length) throw new Error("這份對話是空的");
  let outline = null;
  if (out) {
    try { outline = JSON.parse(await out.text()); } catch (e) { outline = null; }
    if (!outline || !outline.outline_version) { outline = null; showStatus(out.name + " 不是標記檔，先當作沒有標記。", true); }
  }
  ctx = { kind: "file", fileName: conv.name, folder: null, title: conv.name.replace(/\.jsonl?$/i, ""), platform: null, revision: 1 };
  await startConversation(outline);
}

// ── 選對話清單 ──

async function showPicker() {
  $("picker").hidden = false;
  $("file").addEventListener("change", async (e) => {
    $("error").hidden = true;
    try { await loadFromFiles(e.target.files); } catch (err) { showError(err.message); }
  });
  if (!config || !config.repo || !config.token) {
    $("repo-line").textContent = "還沒設定 GitHub，所以列不出擷取過的對話。可以從電腦開啟下載的檔案。";
    return;
  }
  $("repo-line").textContent = "讀取 " + config.repo + " 的擷取紀錄中…";
  try {
    const check = await checkRepo(config);
    if (!check.ok) throw new Error(check.message);
    branch = check.branch;
    const rows = await readCaptureIndex(config, branch);
    const byFolder = new Map();
    rows.forEach((r) => { if (r && r.folder) byFolder.set(r.folder, Object.assign({}, byFolder.get(r.folder), r)); });
    const items = Array.from(byFolder.values()).sort((a, b) =>
      String(b.started_at || b.captured_at || "").localeCompare(String(a.started_at || a.captured_at || "")));
    $("repo-line").textContent = config.repo + "｜擷取過 " + items.length + " 段對話" +
      "｜已標記 " + items.filter((r) => r.outline_updated_at).length + " 段";
    const render = (q) => {
      const ol = $("convos");
      ol.textContent = "";
      const shown = items.filter((r) => !q || String(r.title || "").toLowerCase().includes(q.toLowerCase()) || r.folder.includes(q));
      if (!shown.length) { ol.append(el("li", { class: "empty", text: q ? "找不到符合的標題" : "還沒有擷取過的對話" })); return; }
      shown.forEach((r) => {
        const d = r.started_at || r.captured_at;
        ol.append(el("li", null, el("a", { href: "tag.html?folder=" + encodeURIComponent(r.folder) },
          el("span", { class: "c-title", text: r.title || r.folder }),
          r.outline_updated_at ? el("span", { class: "done", text: "已標記" }) : null,
          el("span", { class: "c-meta", text: [
            ({ chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" }[r.platform] || r.platform),
            d ? new Date(d).toLocaleDateString() : "",
            r.messages ? r.messages + " 則" : "",
            r.folder
          ].filter(Boolean).join(" · ") })
        )));
      });
    };
    $("search").hidden = false;
    $("search").addEventListener("input", (e) => render(e.target.value.trim()));
    render("");
  } catch (e) {
    $("repo-line").textContent = "讀不到倉庫：" + e.message;
  }
}

// ── 變更、草稿 ──

let draftTimer = null;
function changed(full) {
  dirty = true;
  editVersion++;
  updateTop();
  if (full) render(); else { renderOutput(); renderSelbar(); }
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { chrome.storage.local.set({ [draftKey()]: { outline: buildOutline() } }); } catch (e) { /* 存不了草稿不影響 */ }
  }, 800);
}

function updateTop() {
  $("mode-label").textContent = "";
  if (dirty) $("mode-label").append(el("span", { class: "dirty-dot", "aria-hidden": "true" }), "還沒儲存　");
  if (S.mode) $("mode-label").append("整理方式：", el("strong", { text: S.mode === "multi" ? "聊了好幾件事" : "一直在聊同一件事" }));
  $("change-mode").hidden = !S.mode;
}

window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ── 輸出 ──

function outputText() {
  const lines = [];
  if (S.mode === "multi") {
    S.topics.forEach((t) => {
      const idx = msgs.map((_, i) => i).filter((i) => tagOf(i) === t.id);
      if (idx.length) lines.push(t.id + " " + t.name + (t.note ? "（" + t.note + "）" : "") + "：" + ranges(idx));
    });
    const un = msgs.map((_, i) => i).filter((i) => !tagOf(i));
    if (un.length) lines.push("還沒標：" + ranges(un));
    const own = msgs.map((_, i) => i).filter(ownTag);
    if (own.length) lines.push("AI 回覆另外分類：" + own.map((i) => { const t = topicById(tagOf(i)); return pad(i) + "→" + (t ? t.id : "還沒標"); }).join("、"));
  } else {
    lines.push("主題：" + (S.single.name || "（未命名）") + (S.single.note ? "（" + S.single.note + "）" : "") + "：" + ranges(msgs.map((_, i) => i)));
  }
  // 關鍵兩種模式都可以標；多主題時沒標就不寫
  rangeIdx().forEach(([a, b]) => {
    const part = msgs.slice(a, b + 1);
    lines.push("關鍵段落：" + (a === b ? pad(a) : pad(a) + "–" + pad(b)) + "（你說的 " + part.filter((m) => m.speaker !== "assistant").length +
      " 則、AI 說的 " + part.filter((m) => m.speaker === "assistant").length + " 則）");
  });
  const keyList = (ai) => msgs.map((_, i) => i).filter((i) => S.keys[msgs[i].id] && (msgs[i].speaker === "assistant") === ai).map(pad);
  const uk = keyList(false), ak = keyList(true);
  if (S.mode !== "multi" || uk.length) lines.push("你說的關鍵：" + (uk.length ? uk.join("、") : "無"));
  if (S.mode !== "multi" || ak.length) lines.push("AI 說的關鍵：" + (ak.length ? ak.join("、") : "無"));
  const confirmed = msgs.map((_, i) => i).filter(turnConfirmed);
  const hints = msgs.map((_, i) => i).filter(turnHint);
  if (confirmed.length) lines.push("轉向（你確認的）：" + confirmed.map(pad).join("、"));
  if (hints.length) lines.push("可能轉向（程式提示，你還沒確認）：" + hints.map(pad).join("、"));
  const notes = msgs.map((_, i) => i).filter((i) => S.notes[msgs[i].id]);
  if (notes.length) lines.push("備註：\n" + notes.map((i) => "  " + pad(i) + " " + S.notes[msgs[i].id]).join("\n"));
  return lines.join("\n");
}

function buildOutline() {
  const all = msgs.map((_, i) => i);
  return {
    outline_version: OUTLINE_VERSION,
    created_with: "after-thinking-capture " + VERSION,
    updated_at: new Date().toISOString(),
    source: {
      folder: ctx.folder,
      conversation_path: "source/conversation.jsonl",
      source_revision: ctx.revision,
      message_count: msgs.length,
      first_message_id: msgs[0].id,
      last_message_id: msgs[msgs.length - 1].id,
      fingerprint: sourceFingerprint(),
      // [message_id, 內容指紋]，照順序。重新擷取後編號可能換人，載入時用它核對
      message_fingerprints: msgs.map((m) => (m.pid ? [m.id, fingerprint(m), m.pid] : [m.id, fingerprint(m)]))
    },
    mode: S.mode === "multi" ? "multi_topic" : S.mode === "flow" ? "single_topic" : null,
    numbering: "顯示編號 = 依 order 排序後的位置（001 是第一則）；這個檔案裡一律用 message_id",
    topics: S.topics.map((t) => ({
      id: t.id, name: t.name, note: t.note,
      messages: all.filter((i) => tagOf(i) === t.id).map((i) => msgs[i].id)
    })),
    untagged: all.filter((i) => !tagOf(i)).map((i) => msgs[i].id),
    single_topic: { name: S.single.name, note: S.single.note },
    key_points: all.filter((i) => S.keys[msgs[i].id]).map((i) => ({ message_id: msgs[i].id, speaker: msgs[i].speaker })),
    // 整段標成關鍵：使用者認為這一整段是核心（不是逐句判斷）
    key_ranges: rangeIdx().map(([a, b]) => ({ from_message_id: msgs[a].id, to_message_id: msgs[b].id, messages: msgs.slice(a, b + 1).map((m) => m.id) })),
    // turns 只放使用者確認過的；程式提示另外放在 turn_hints，不算使用者的判斷
    // hinted_by：使用者確認前，程式是因為什麼提示的（空的代表使用者自己標的）
    turns: all.filter(turnConfirmed).map((i) => ({ message_id: msgs[i].id, source: "user", hinted_by: hintReasons(i) })),
    turn_hints: all.filter(turnHint).map((i) => ({ message_id: msgs[i].id, reasons: hintReasons(i) })),
    dismissed_auto_turns: all.filter((i) => S.turnsDismissed[msgs[i].id]).map((i) => msgs[i].id),
    notes: all.filter((i) => S.notes[msgs[i].id]).map((i) => ({ message_id: msgs[i].id, text: S.notes[msgs[i].id] })),
    summary: outputText()
  };
}

function renderOutput() { $("output").textContent = outputText(); }

async function save() {
  const btn = $("save");
  btn.disabled = true;
  const outline = buildOutline();
  const version = editVersion;   // 這次存的是這個版本；儲存途中又改的，不能算已儲存
  const content = JSON.stringify(outline, null, 2) + "\n";
  try {
    if (ctx.kind === "repo") {
      showStatus("儲存中…", true);
      const files = [{ path: ctx.folder + OUTLINE_FILE, content }];
      // 根目錄指引檔說明了 outline.json，舊版的順便更新
      try { files.push(...await repoGuideFiles(config, branch)); } catch (e) { /* 指引檔失敗不影響儲存 */ }
      // 擷取紀錄在提交當下從最新版本讀，標上「已標記」；找不到這個資料夾就不動
      await commitFiles(config, branch, files, "After-thinking: outline " + ctx.folder + " (" + (outline.mode || "no mode") + ")",
        (rows) => {
          if (!rows.some((r) => r.folder === ctx.folder)) return null;
          return rows.map((r) => (r.folder === ctx.folder
            ? Object.assign({}, r, { outline_updated_at: outline.updated_at, outline_mode: outline.mode }) : r));
        });
      showStatus("已儲存到 " + config.repo + " 的 " + ctx.folder + OUTLINE_FILE);
    } else {
      const a = el("a", { href: URL.createObjectURL(new Blob([content], { type: "application/json" })), download: OUTLINE_FILE });
      document.body.append(a);
      a.click();
      a.remove();
      showStatus("已下載 outline.json。下次要接著標，選 conversation.jsonl 時一起選它。");
    }
    savedAt = outline.updated_at;
    if (editVersion === version) {
      dirty = false;
      UI.moved = new Set();
      try { await chrome.storage.local.remove(draftKey()); } catch (e) {}
      if (S.mode) renderList();
    } else {
      showStatus("已儲存按下儲存時的版本；儲存途中你又改了東西，那部分還沒存，請再按一次儲存。", true, true);
    }
    updateTop();
  } catch (e) {
    showStatus("儲存失敗：" + e.message + "（標記還在這一頁，也存成草稿了，可以再試一次）", true, true);
  }
  btn.disabled = false;
}

// ── 畫面 ──

function showMain() {
  updateTop();
  const choosing = !S.mode;
  $("mode-choice").hidden = !choosing;
  $("workspace").hidden = choosing;
  if (!choosing) render();
}

function render() {
  const multi = S.mode === "multi";
  $("multi-panel").hidden = !multi;
  $("flow-panel").hidden = multi;
  if (multi) renderTopics(); else renderFlowPanel();
  renderSelbar();
  renderList();
  renderOutput();
}

function renderTopics() {
  const box = $("topics");
  box.textContent = "";
  S.topics.forEach((t) => {
    const p = pal(t.id);
    const count = msgs.filter((_, i) => tagOf(i) === t.id).length;
    const name = el("input", { type: "text", value: t.name, "aria-label": "主題 " + t.id + " 名稱", class: "strong", "data-topic-name": t.id });
    name.addEventListener("input", () => { t.name = name.value; topicEdited(t); });
    const note = el("input", { type: "text", value: t.note, "aria-label": "主題 " + t.id + " 補充說明", placeholder: "補充說明，例如：主要在講習性", "data-topic-note": t.id });
    note.addEventListener("input", () => { t.note = note.value; topicEdited(t); });
    const del = el("button", { class: "icon-btn", "aria-label": "刪除主題 " + t.id, title: "刪除主題", text: "×" });
    del.addEventListener("click", () => {
      const n = Object.values(S.tags).filter((v) => v === t.id).length;
      S.topics = S.topics.filter((x) => x !== t);
      // 錨點變回還沒標；另外分類的 AI 回覆變回跟著上一句
      Object.keys(S.tags).forEach((k) => { if (S.tags[k] === t.id) delete S.tags[k]; });
      if (!S.topics.length) S.topics = [{ id: nextTopicId(), name: "新主題", note: "" }];
      showStatus("已刪除主題 " + t.id + (n ? "，原本的 " + n + " 句變成還沒標" : ""));
      changed(true);
    });
    box.append(el("div", { class: "topic", style: { borderTopColor: p.stripe } },
      el("div", { class: "row" },
        el("span", { class: "topic-id", style: { background: p.bg, color: p.fg }, text: t.id }),
        name,
        el("span", { class: "topic-count", text: count + " 則" }),
        del),
      note));
  });
  const add = el("button", { class: "add-topic", text: "＋ 新增主題" });
  add.addEventListener("click", () => { addTopic(); changed(true); });
  box.append(add);
  const left = anchors().filter((i) => !tagOf(i)).length;
  const pill = $("left");
  pill.textContent = left ? "還有 " + left + " 句沒標" : "全部標完了";
  pill.style.background = left ? "var(--warn-bg)" : "var(--ok-bg)";
  pill.style.color = left ? "var(--warn-fg)" : "var(--ok-fg)";
  $("view-time").setAttribute("aria-pressed", String(UI.view === "time"));
  $("view-topic").setAttribute("aria-pressed", String(UI.view === "topic"));
  syncRangeToggle();
}

// 改主題名稱或說明時，就地更新畫面上其他地方，不重畫整個清單
// （重畫會讓離開輸入框後的第一下點擊落空）
function topicEdited(t) {
  const active = document.activeElement;
  document.querySelectorAll('[data-topic-name="' + t.id + '"]').forEach((n) => { if (n !== active) n.value = t.name; });
  document.querySelectorAll('[data-topic-note="' + t.id + '"]').forEach((n) => { if (n !== active) n.value = t.note; });
  document.querySelectorAll('[data-chip-topic="' + t.id + '"]').forEach((n) => { n.textContent = t.id + " " + t.name + " ▾"; });
  document.querySelectorAll('[data-option-topic="' + t.id + '"]').forEach((n) => { n.textContent = t.id + " " + t.name; });
  changed(false);
}

function nextTopicId() { return TOPIC_IDS.find((x) => !S.topics.some((t) => t.id === x)); }
function addTopic() {
  const id = nextTopicId();
  if (!id) { showStatus("主題最多 26 個"); return null; }
  S.topics.push({ id, name: "新主題", note: "" });
  return id;
}

function syncRangeToggle() {
  ["range", "range-flow"].forEach((id) => {
    $(id).setAttribute("aria-pressed", String(UI.range));
    $(id).textContent = UI.range ? "連選：開" : "連選：關";
  });
}

function renderFlowPanel() {
  syncRangeToggle();
  $("flow-name").value = S.single.name;
  $("flow-note").value = S.single.note;
  const uk = msgs.filter((m) => S.keys[m.id] && m.speaker !== "assistant").length;
  const ak = msgs.filter((m) => S.keys[m.id] && m.speaker === "assistant").length;
  const nr = rangeIdx().length;
  $("key-count").textContent = (nr ? "關鍵段落 " + nr + " 段、" : "") + "你說的關鍵 " + uk + " 處、AI 說的關鍵 " + ak + " 處";
  const box = $("filters");
  box.textContent = "";
  [["all", "全部"], ["key", "只看關鍵"], ["user", "你說的關鍵"], ["ai", "AI 說的關鍵"]].forEach(([k, label]) => {
    const b = el("button", { text: label, "aria-pressed": String(UI.filter === k) });
    b.addEventListener("click", () => { UI.filter = k; render(); });
    box.append(b);
  });
}

function renderSelbar() {
  const bar = $("selbar");
  const show = !!S.mode && UI.sel.size > 0;
  bar.hidden = !show;
  if (!show) return;
  bar.textContent = "";
  bar.append(el("span", { class: "count", text: "已選 " + UI.sel.size + " 句" }));
  const kr = el("button", { class: "key-range-btn", text: "★ 整段標成關鍵" });
  kr.addEventListener("click", addKeyRange);
  bar.append(kr);
  if (S.mode !== "multi") {
    const un0 = el("button", { class: "link", text: "取消選取" });
    un0.addEventListener("click", () => { UI.sel.clear(); UI.last = null; render(); });
    bar.append(un0);
    return;
  }
  S.topics.forEach((t) => {
    const p = pal(t.id);
    const b = el("button", { style: { background: p.bg, color: p.fg }, text: "標成 " + t.id + " " + t.name });
    b.addEventListener("click", () => assign(Array.from(UI.sel), t.id));
    bar.append(b);
  });
  const nb = el("button", { class: "ghost", text: "＋ 新主題" });
  nb.addEventListener("click", () => { const id = addTopic(); if (id) assign(Array.from(UI.sel), id); });
  const clear = el("button", { class: "ghost", text: "清除標籤" });
  clear.addEventListener("click", () => assign(Array.from(UI.sel), null));
  const un = el("button", { class: "link", text: "取消選取" });
  un.addEventListener("click", () => { UI.sel.clear(); UI.last = null; render(); });
  bar.append(nb, clear, un);
}

// 從第一個選的句子，到最後一個選的句子和它後面的 AI 回覆，整段標成關鍵；和既有段落重疊或相連就合併
function addKeyRange() {
  const sel = Array.from(UI.sel).sort((a, b) => a - b);
  if (!sel.length) return;
  let lo = sel[0], hi = sel[sel.length - 1];
  while (hi + 1 < msgs.length && anchorOf[hi + 1] === sel[sel.length - 1]) hi++;
  const all = rangeIdx().concat([[lo, hi]]).sort((x, y) => x[0] - y[0]);
  const merged = [];
  all.forEach(([a, b]) => {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b); else merged.push([a, b]);
  });
  S.keyRanges = merged.map(([a, b]) => ({ from: msgs[a].id, to: msgs[b].id }));
  UI.sel.clear(); UI.last = null; UI.picker = null;
  changed(true);
}

// 錨點：設定或清除標籤。AI 回覆：設定自己的分類（"" 代表單獨設成還沒標），followAgain 才回到跟著上一句
function assign(idxs, topicId) {
  idxs.forEach((i) => {
    const id = msgs[i].id;
    if (!isAnchor(i)) S.tags[id] = topicId || "";
    else if (topicId) S.tags[id] = topicId;
    else delete S.tags[id];
  });
  UI.sel.clear(); UI.last = null; UI.picker = null;
  changed(true);
}

// 照目前的模式和檢視，排出要顯示的列
function rowsToShow() {
  const out = [];
  const all = msgs.map((_, i) => i);
  if (S.mode === "multi" && UI.view === "time") {
    all.forEach((i) => { const g = gapLabel(i); if (g) out.push({ kind: "gap", label: g }); out.push({ kind: "msg", i }); });
  } else if (S.mode === "multi") {
    S.topics.map((t) => t.id).concat([null]).forEach((key) => {
      const idx = all.filter((i) => tagOf(i) === key);
      if (key === null && !idx.length) return;
      out.push({ kind: "head", key, idx });
      if (!idx.length) out.push({ kind: "empty" });
      let prev = null;
      idx.forEach((i) => {
        if (prev !== null && i !== prev + 1) {
          const between = all.slice(prev + 1, i);
          const names = Array.from(new Set(between.map((j) => { const t = topicById(tagOf(j)); return t ? t.id + " " + t.name : "還沒標"; })));
          const label = between.length === 1 ? pad(prev + 1) : pad(prev + 1) + "–" + pad(i - 1);
          out.push({ kind: "skip", label: "中間跳過 " + label + "（" + names.join("、") + "）" });
        }
        out.push({ kind: "msg", i });
        prev = i;
      });
    });
  } else {
    const pass = (i) => {
      if (UI.filter === "all") return true;
      if (!isKeyish(i)) return false;
      if (UI.filter === "user") return msgs[i].speaker !== "assistant";
      if (UI.filter === "ai") return msgs[i].speaker === "assistant";
      return true;
    };
    let prev = -1;
    all.forEach((i) => {
      if (!pass(i)) return;
      if (UI.filter !== "all" && i !== prev + 1) out.push({ kind: "skip", label: "中間 " + (i - prev - 1) + " 則沒顯示" });
      const g = UI.filter === "all" ? gapLabel(i) : null;
      if (g) out.push({ kind: "gap", label: g });
      out.push({ kind: "msg", i });
      prev = i;
    });
    if (!out.length) out.push({ kind: "empty", text: "還沒有標成關鍵的內容" });
  }
  return out;
}

function renderList() {
  const list = $("list");
  const scrollY = window.scrollY;
  list.textContent = "";
  const frag = document.createDocumentFragment();
  rowsToShow().forEach((r) => {
    if (r.kind === "gap") frag.append(el("div", { class: "gap-line", text: r.label }));
    else if (r.kind === "skip") frag.append(el("div", { class: "skip", text: r.label }));
    else if (r.kind === "empty") frag.append(el("div", { class: "empty-note", text: r.text || "還沒有對話標成這個主題" }));
    else if (r.kind === "head") frag.append(groupHead(r));
    else frag.append(msgRow(r.i));
  });
  list.append(frag);
  window.scrollTo(0, scrollY);
}

function groupHead(r) {
  const p = pal(r.key);
  const head = el("div", { class: "group-head", style: { borderBottomColor: p.stripe } });
  if (r.key) {
    const t = topicById(r.key);
    const name = el("input", { type: "text", class: "g-name", value: t.name, "aria-label": "主題 " + t.id + " 名稱", "data-topic-name": t.id });
    name.addEventListener("input", () => { t.name = name.value; topicEdited(t); });
    const note = el("input", { type: "text", class: "g-note", value: t.note, placeholder: "＋補充說明", "aria-label": "主題 " + t.id + " 補充說明", "data-topic-note": t.id });
    note.addEventListener("input", () => { t.note = note.value; topicEdited(t); });
    head.append(el("span", { class: "topic-id", style: { background: p.bg, color: p.fg }, text: t.id }), name, note);
  } else {
    head.append(el("h3", { text: "還沒標" }));
  }
  head.append(el("span", { class: "ranges", text: ranges(r.idx) }));
  return head;
}

function msgRow(i) {
  const m = msgs[i];
  const multi = S.mode === "multi";
  const ai = m.speaker === "assistant";
  const anchor = isAnchor(i);
  const tid = tagOf(i);
  const t = topicById(tid);
  const p = pal(tid);
  const selected = anchor && UI.sel.has(i);
  const range = rangeOf(i);
  const key = !!S.keys[m.id];
  let stripe = "#E1E4E8";
  if (multi) stripe = p.stripe;
  else if (key) stripe = ai ? "var(--ai-key)" : "var(--user-key)";

  const row = el("div", { class: "msg" + (ai ? " ai" : "") + (selected ? " selected" : "") + (range ? " in-range" : ""), style: { borderLeftColor: stripe } });

  // 編號：多主題模式下，錨點可以點來選取
  // 編號：你的發言都可以點來選取（分主題、整段標成關鍵用）
  if (anchor) {
    const b = el("button", { class: "num", text: pad(i), "aria-pressed": String(selected), "aria-label": "選取 " + pad(i) });
    b.addEventListener("click", (e) => pick(i, e));
    row.append(b);
  } else {
    row.append(el("span", { class: "num", text: pad(i) }));
  }

  const body = el("div", { class: "body" });
  const line1 = el("div", { class: "line1" }, el("span", { class: "who", text: who(m) }));
  const own = ownTag(i);
  if (multi && (anchor || own)) {
    const chip = el("button", { class: "chip", "aria-expanded": String(UI.picker === i),
      style: { background: p.bg, color: p.fg, borderColor: t ? p.stripe : "#C9CED6" },
      "data-chip-topic": tid || "", text: (t ? t.id + " " + t.name : "還沒標") + " ▾" });
    chip.addEventListener("click", () => { UI.picker = UI.picker === i ? null : i; renderList(); });
    line1.append(chip);
    if (own) line1.append(el("span", { class: "follow", text: "另外分類" }));
  } else if (multi) {
    line1.append(el("span", { class: "follow", text: "跟著 " + pad(anchorOf[i]) }));
    const split = el("button", { class: "chip quiet", "aria-expanded": String(UI.picker === i), text: "另外分類 ▾" });
    split.addEventListener("click", () => { UI.picker = UI.picker === i ? null : i; renderList(); });
    line1.append(split);
  }
  // 關鍵：兩種模式都可以標
  const on = ai ? { bg: "var(--ai-key)", fg: "#fff" } : { bg: "var(--user-key)", fg: "#fff" };
  const kb = el("button", { class: "chip" + (multi && !key ? " quiet" : ""), "aria-pressed": String(key),
    style: key ? { background: on.bg, color: on.fg, borderColor: on.bg } : {},
    text: key ? (ai ? "★ AI 說的關鍵" : "★ 你說的關鍵") : "☆ 標為關鍵" });
  kb.addEventListener("click", () => { if (key) delete S.keys[m.id]; else S.keys[m.id] = true; if (!multi) renderFlowPanel(); changed(true); });
  line1.append(kb);
  // 轉向：程式提示要使用者確認才算數
  if (turnConfirmed(i)) {
    const x = el("button", { "aria-label": "移除 " + pad(i) + " 的轉向", text: "×" });
    x.addEventListener("click", () => {
      delete S.turnsConfirmed[m.id];
      if (hintReasons(i).length) S.turnsDismissed[m.id] = true;
      changed(true);
    });
    line1.append(el("span", { class: "turn" }, "轉向", x));
  } else if (turnHint(i)) {
    const ok = el("button", { class: "confirm", text: "確認" });
    ok.addEventListener("click", () => { S.turnsConfirmed[m.id] = true; changed(true); });
    const x = el("button", { "aria-label": "這不是轉向，移除 " + pad(i) + " 的提示", text: "×" });
    x.addEventListener("click", () => { S.turnsDismissed[m.id] = true; changed(true); });
    line1.append(el("span", { class: "turn hint" }, "可能轉向？（程式提示：" + hintReasons(i).map((r) => HINT_TEXT[r]).join("、") + "）", ok, x));
  }
  if (UI.moved.has(i)) line1.append(el("span", { class: "moved", text: "原文變過，請確認" }));
  // 關鍵段落：在段落的第一則標出範圍，可以整段移除
  if (range && range[0] === i) {
    const x = el("button", { "aria-label": "移除關鍵段落 " + pad(range[0]) + "–" + pad(range[1]), text: "×" });
    x.addEventListener("click", () => {
      S.keyRanges = S.keyRanges.filter((r) => r.from !== msgs[range[0]].id);
      changed(true);
    });
    line1.append(el("span", { class: "range-chip" }, "★ 關鍵段落 " + (range[0] === range[1] ? pad(range[0]) : pad(range[0]) + "–" + pad(range[1])), x));
  }
  body.append(line1);

  // 主題選單
  if (multi && UI.picker === i) {
    const targets = anchor && selected && UI.sel.size > 1 ? Array.from(UI.sel) : [i];
    const box = el("div", { class: "picker" }, el("span", { class: "hint", text: targets.length > 1 ? "套用到已選的 " + targets.length + " 句" : "改成" }));
    S.topics.forEach((x) => {
      const xp = pal(x.id);
      const cur = x.id === tid;
      const b = el("button", { "data-option-topic": x.id, style: { background: cur ? xp.stripe : xp.bg, color: cur ? "#fff" : xp.fg, borderColor: xp.stripe }, text: x.id + " " + x.name });
      b.addEventListener("click", () => assign(targets, x.id));
      box.append(b);
    });
    const none = el("button", { style: { background: "#fff", color: "#4A515C", borderColor: "#C9CED6" }, text: "還沒標" });
    none.addEventListener("click", () => assign(targets, null));
    const nb = el("button", { style: { background: "#fff", color: "#1B1F24", borderColor: "#1B1F24" }, text: "＋ 新主題" });
    nb.addEventListener("click", () => { const id = addTopic(); if (id) assign(targets, id); });
    box.append(none, nb);
    if (own) {
      const back = el("button", { style: { background: "#fff", color: "#3D4450", borderColor: "#C9CED6" }, text: "改回跟著 " + pad(anchorOf[i]) });
      back.addEventListener("click", () => { delete S.tags[m.id]; UI.picker = null; changed(true); });
      box.append(back);
    }
    body.append(box);
  }

  // 內容：AI 回覆先顯示 200 字，使用者的長文件也摺疊
  const limit = ai ? AI_PREVIEW : USER_PREVIEW;
  const text = m.content || "（只有附件）";
  const long = text.length > limit;
  const open = !!UI.exp[i];
  body.append(el("div", { class: "text", text: long && !open ? text.slice(0, limit) + "…" : text }));

  // 備註
  const note = S.notes[m.id] || "";
  const noteBox = UI.noteOpen[i] || note !== "";
  if (noteBox) {
    const input = el("input", { type: "text", id: "note-" + i, value: note, placeholder: "寫下這句為什麼重要，或補充背景" });
    input.addEventListener("input", () => {
      if (input.value) S.notes[m.id] = input.value; else delete S.notes[m.id];
      changed(false);
    });
    const x = el("button", { class: "icon-btn", "aria-label": "刪除 " + pad(i) + " 的備註", text: "×" });
    x.addEventListener("click", () => { delete S.notes[m.id]; delete UI.noteOpen[i]; changed(true); });
    body.append(el("div", { class: "note" }, el("label", { for: "note-" + i, text: "備註" }), input, x));
    if (UI.noteOpen[i] === "focus") { UI.noteOpen[i] = true; setTimeout(() => input.focus(), 0); }
  }

  const actions = el("div", { class: "actions" });
  if (long) {
    const b = el("button", { class: "expand", text: open ? "收起" : "展開全文（共 " + text.length + " 字）" });
    b.addEventListener("click", () => { UI.exp[i] = !open; renderList(); });
    actions.append(b);
  }
  if (!noteBox) {
    const b = el("button", { text: "＋備註" });
    b.addEventListener("click", () => { UI.noteOpen[i] = "focus"; renderList(); });
    actions.append(b);
  }
  if (!ai && !turnConfirmed(i) && !turnHint(i)) {
    const b = el("button", { text: "＋標轉向" });
    b.addEventListener("click", () => { S.turnsConfirmed[m.id] = true; delete S.turnsDismissed[m.id]; changed(true); });
    actions.append(b);
  }
  body.append(actions);
  row.append(body);
  return row;
}

function pick(i, e) {
  const shift = (e && e.shiftKey) || UI.range;
  if (shift && UI.last !== null) {
    const lo = Math.min(UI.last, i), hi = Math.max(UI.last, i);
    anchors().filter((x) => x >= lo && x <= hi).forEach((x) => UI.sel.add(x));
  } else if (UI.sel.has(i)) {
    UI.sel.delete(i);
  } else {
    UI.sel.add(i);
  }
  UI.last = i;
  if (e && e.shiftKey) { const s = window.getSelection(); if (s) s.removeAllRanges(); }
  renderSelbar();
  renderList();
}

// ── 事件 ──

$("choose-multi").addEventListener("click", () => { S.mode = "multi"; changed(false); showMain(); });
$("choose-flow").addEventListener("click", () => { S.mode = "flow"; changed(false); showMain(); });
$("change-mode").addEventListener("click", () => {
  UI.sel.clear(); UI.picker = null;
  $("mode-choice").hidden = false;
  $("workspace").hidden = true;
});
$("view-time").addEventListener("click", () => { UI.view = "time"; render(); });
$("view-topic").addEventListener("click", () => { UI.view = "topic"; render(); });
$("range").addEventListener("click", () => { UI.range = !UI.range; syncRangeToggle(); });
$("range-flow").addEventListener("click", () => { UI.range = !UI.range; syncRangeToggle(); });
$("flow-name").addEventListener("input", (e) => { S.single.name = e.target.value; changed(false); });
$("flow-note").addEventListener("input", (e) => { S.single.note = e.target.value; changed(false); });
$("save").addEventListener("click", save);
$("copy-output").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(outputText()); showStatus("已複製"); }
  catch (e) { showStatus("無法複製：" + e.message); }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s" && ctx) { e.preventDefault(); save(); }
});

async function init() {
  config = await loadConfig();
  const folder = new URLSearchParams(location.search).get("folder");
  if (!folder) { await showPicker(); return; }
  if (!config || !config.repo || !config.token) { showError("還沒設定 GitHub，無法讀取倉庫裡的對話。"); await showPicker(); return; }
  try { await loadFromRepo(folder); }
  catch (e) { showError(e.message); }
}

init();
