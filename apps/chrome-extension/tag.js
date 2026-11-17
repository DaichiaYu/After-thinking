// After-thinking Capture — 標記對話（v0.8.0）
// 在交給 AI 整理之前，讓使用者自己看一遍對話、分主題或標出關鍵。
// 這一頁完全不呼叫 AI：編號、截短、轉向提示、時間間隔都是程式做的。
// 結果存成討論資料夾裡的 outline.json（不寫進 source/）。

const OUTLINE_FILE = "outline.json";
const OUTLINE_VERSION = 5;   // 4：每一項記來源、AI 建議的紀錄；5：主題的 also_messages（也跟這個主題有關）
const AI_PREVIEW = 200;       // AI 回覆先顯示的字數
const USER_PREVIEW = 1500;    // 使用者訊息超過這個長度才摺疊（通常是貼上的長文件）
const GAP_HOURS = 6;          // 兩則訊息相隔超過這麼久，畫一條分隔線
const QUESTION_PREVIEW = 50;  // 預覽頁：你的問題超過這個字數先收起來
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
let labelStore = null; // 這段對話的處理狀態、自訂標籤（inbox/labels.json），只有從倉庫開的才有

const S = {
  mode: null,          // "multi" | "flow" | null（還沒選）
  topics: [],          // [{ id, name, note }]
  tags: {},            // 錨點訊息 id → 主題 id；AI 回覆單獨分類時也記在這裡（"" 代表單獨設成還沒標）
  keys: {},            // 訊息 id → true
  turnsConfirmed: {},  // 使用者自己標、或確認過的轉向
  turnsDismissed: {},  // 程式提示、被使用者刪掉的轉向
  notes: {},           // 訊息 id → 備註
  keyRanges: [],       // 整段標成關鍵：[{ from, to }]（第一則、最後一則的 message_id）
  also: {},            // 主要主題之外「也跟這些主題有關」：key 同 tags（錨點或另外分類的 AI 回覆）→ [主題 id]
  single: { name: "", note: "" },
  // 每一項的來源。沒有記錄的是使用者自己標的；"ai" = AI 建議、使用者沒動；"ai_confirmed" = AI 建議、使用者確認或改過
  // tags 的 key 是錨點（或另外分類的 AI 回覆）的 message_id；names 的 key 是主題 id；ranges 的 key 是段落第一則的 message_id
  origin: { tags: {}, names: {}, keys: {}, ranges: {}, turns: {} },
  aiReasons: { keys: {}, ranges: {}, turns: {} },   // AI 給的理由
  aiRejected: [],      // 使用者改掉或刪掉的 AI 建議
  aiSeen: {},          // 出現在畫面上過的訊息 id（判斷「沒動」是不是根本沒看到）
  aiSuggestion: null   // 套用的是哪一版 AI 建議（outline.ai.json）
};
const UI = { view: "time", filter: "all", sel: new Set(), last: null, exp: {}, picker: null, noteOpen: {}, moved: new Set(),
  previewExp: {}, cursor: null, navKind: "pending", drawer: false, drawerKind: "all" };

// ── 小工具 ──

const width = () => Math.max(3, String(msgs.length).length);
const pad = (i) => String(i + 1).padStart(width(), "0");   // 顯示編號：第 i 則 → 001
const isAnchor = (i) => anchorOf[i] === i;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// AI 回覆預設跟著上一句使用者發言；使用者按「另外分類」後就用自己的
const ownTag = (i) => !isAnchor(i) && has(S.tags, msgs[i].id);
const tagOf = (i) => (ownTag(i) ? S.tags[msgs[i].id] : S.tags[msgs[anchorOf[i]].id]) || null;
const topicById = (id) => S.topics.find((t) => t.id === id) || null;
// 也相關的主題：跟主要主題一樣，AI 回覆預設跟著上一句；不含主要主題本身、已刪掉的主題
const alsoOf = (i) => (S.also[tagKey(i)] || []).filter((x) => x !== tagOf(i) && topicById(x));
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
const HINT_TEXT = { keyword: T("tag.your_wording"), ai_response: T("tag.the_ai_s_reply_reads_like") };

// ── AI 建議的來源紀錄 ──
const ORIGIN_OUT = { ai: "ai_unreviewed", ai_confirmed: "ai_confirmed" };
const originOf = (kind, key) => ORIGIN_OUT[S.origin[kind][key]] || "user";
const aiPending = (kind, key) => S.origin[kind][key] === "ai";
// 主題分配的來源記在錨點上；另外分類的 AI 回覆記在自己身上
const tagKey = (i) => (ownTag(i) ? msgs[i].id : msgs[anchorOf[i]].id);
// 使用者改掉或刪掉 AI 建議：記成否決，這一項變成使用者自己的
function touchAi(kind, key, action, aiValue, newValue) {
  if (!S.origin[kind][key]) return;
  S.aiRejected.push({ kind, ref: key, action, ai_value: aiValue === undefined ? null : aiValue,
    new_value: newValue === undefined ? null : newValue, at: new Date().toISOString() });
  delete S.origin[kind][key];
  if (S.aiReasons[kind]) delete S.aiReasons[kind][key];
}
function confirmAi(kind, key) {
  if (S.origin[kind][key] !== "ai") return;
  S.origin[kind][key] = "ai_confirmed";
  changed(true);
}
const seenAny = (ids) => ids.some((id) => S.aiSeen[id]);

// 內容指紋：說話者＋全文的雜湊。重新擷取後訊息編號可能換人，用它確認標記還指著同一段話
function fingerprint(m) {
  const s = m.speaker + "\n" + m.content;
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
  return s.length.toString(36) + "-" + (h >>> 0).toString(16).padStart(8, "0");
}
const sourceFingerprint = () => fingerprint({ speaker: "all", content: msgs.map(fingerprint).join("|") });
const anchors = () => msgs.map((_, i) => i).filter(isAnchor);
const who = (m) => (m.speaker === "author" ? T("tag.you") : m.speaker === "assistant" ? "AI" : T("tag.external"));

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
  return out.join(T("common.list_sep"));
}

function gapLabel(i) {
  if (i === 0) return null;
  const a = Date.parse(msgs[i - 1].ts), b = Date.parse(msgs[i].ts);
  if (isNaN(a) || isNaN(b)) return null;
  const h = (b - a) / 3600000;
  if (h < GAP_HOURS) return null;
  return h >= 24 ? T("tag.later", Math.round(h / 24)) : T("tag.later_2", Math.round(h));
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
    try { return JSON.parse(l); } catch (e) { throw new Error(T("tag.line_of_conversation_jsonl_is_not", (n + 1))); }
  });
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return rows.map((r, n) => ({
    id: r.message_id || "line-" + (n + 1),
    speaker: r.speaker === "author" || r.speaker === "assistant" ? r.speaker : "external",
    content: typeof r.content === "string" ? r.content : "",
    ts: r.timestamp || null,
    pid: r.platform_message_id || null,
    attachments: Array.isArray(r.attachments) ? r.attachments.filter(a => a && typeof a === "object").map(a => ({
      kind: typeof a.kind === "string" ? a.kind : "file",
      name: typeof a.name === "string" ? a.name : null,
      file: typeof a.file === "string" ? a.file : null,
      missing: typeof a.missing === "string" ? a.missing : null,
      content_note: a.content_note === "extracted_text" ? "extracted_text" : null
    })) : []
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
  // 也跟這個主題有關（v5 起）：記在錨點（或另外分類的 AI 回覆）上
  S.also = {};
  (o.topics || []).forEach((t) => (t.also_messages || []).forEach((mid) => {
    const i = resolve(mid);
    if (i < 0 || !TOPIC_IDS.includes(t.id)) return;
    const k = tagKey(i);
    if (!S.also[k]) S.also[k] = [];
    if (!S.also[k].includes(t.id)) S.also[k].push(t.id);
  }));
  S.keys = {};
  (o.key_points || []).forEach((k) => { const id = k && idOf(k.message_id); if (id) S.keys[id] = true; });
  S.turnsConfirmed = {};
  // v1 的 "manual" 和 v2 的 "user" 都是使用者自己的；v1 的 "auto" 只是程式提示，重新由程式判斷
  // （轉向在下面跟來源一起讀；v1 的 "auto" 只是程式提示，重新由程式判斷）
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
  // 來源紀錄（v4 起）
  const ORIGIN_IN = { ai_unreviewed: "ai", ai_confirmed: "ai_confirmed" };
  (o.topics || []).forEach((t) => {
    if (ORIGIN_IN[t.name_origin]) S.origin.names[t.id] = ORIGIN_IN[t.name_origin];
    [["ai_unreviewed_messages", "ai"], ["ai_confirmed_messages", "ai_confirmed"]].forEach(([field, v]) =>
      (t[field] || []).forEach((mid) => { const i = resolve(mid); if (i >= 0) S.origin.tags[tagKey(i)] = v; }));
  });
  (o.key_points || []).forEach((k) => {
    const id = k && idOf(k.message_id);
    if (!id) return;
    if (ORIGIN_IN[k.origin]) S.origin.keys[id] = ORIGIN_IN[k.origin];
    if (k.ai_reason) S.aiReasons.keys[id] = String(k.ai_reason);
  });
  (o.key_ranges || []).forEach((r) => {
    const id = r && idOf(r.from_message_id);
    if (!id) return;
    if (ORIGIN_IN[r.origin]) S.origin.ranges[id] = ORIGIN_IN[r.origin];
    if (r.ai_reason) S.aiReasons.ranges[id] = String(r.ai_reason);
  });
  (o.turns || []).forEach((t) => {
    const id = t && ["user", "manual", "ai_confirmed", "ai_unreviewed"].includes(t.origin || t.source) && idOf(t.message_id);
    if (!id) return;
    S.turnsConfirmed[id] = true;
    if (ORIGIN_IN[t.origin]) S.origin.turns[id] = ORIGIN_IN[t.origin];
    if (t.ai_reason) S.aiReasons.turns[id] = String(t.ai_reason);
  });
  if (o.ai_suggestion && typeof o.ai_suggestion === "object") {
    const a = o.ai_suggestion;
    S.aiRejected = Array.isArray(a.rejected) ? a.rejected : [];
    (a.seen_messages || []).forEach((mid) => { const id = idOf(mid); if (id) S.aiSeen[id] = true; });
    if (a.content_fingerprint) {
      S.aiSuggestion = Object.assign({}, a);
      delete S.aiSuggestion.rejected; delete S.aiSuggestion.seen_messages;
    }
  }
  stats.sourceChanged = !!(o.source && o.source.fingerprint && o.source.fingerprint !== sourceFingerprint()) ||
    (!stats.checked && o.source && o.source.message_count !== undefined && o.source.message_count !== msgs.length);
  return stats;
}

function defaultState() {
  S.mode = null;
  S.topics = [{ id: "A", name: T("tag.topic_a"), note: "" }];
  S.tags = {}; S.keys = {}; S.turnsConfirmed = {}; S.turnsDismissed = {}; S.notes = {}; S.keyRanges = []; S.also = {};
  S.origin = { tags: {}, names: {}, keys: {}, ranges: {}, turns: {} };
  S.aiReasons = { keys: {}, ranges: {}, turns: {} };
  S.aiRejected = []; S.aiSeen = {}; S.aiSuggestion = null;
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
    text = T("tag.these_tags_are_in_an_old");
  } else {
    text = T("tag.the_source_changed_after_the_last", (moved ? T("tag.matched_back_by_content_or_by", moved) : ""), (lost ? T("tag.no_matching_content_in_the_new", lost) : ""), (!moved && !lost ? T("tag.all_tags_still_match") : T("tag.please_check_before_saving")));
  }
  showStatus(text, true, true);
  if (moved || lost || !stats.checked) { dirty = true; editVersion++; }
}

const draftKey = () => "outlineDraft:" + (ctx.kind === "repo" ? config.repo + ":" + ctx.folder : "file:" + (ctx.bundlePrefix || ctx.fileName));

async function startConversation(outline) {
  computeAnchors();
  defaultState();
  let resolved = null;
  if (outline) { resolved = applyOutline(outline); savedAt = outline.updated_at || null; }
  if (!S.single.name) S.single.name = ctx.title || "";
  if (!S.topics.length) S.topics = [{ id: "A", name: T("tag.topic_a"), note: "" }];

  document.title = (ctx.title || T("tag.tag_conversation")) + "｜After-thinking";
  $("title").textContent = ctx.title || T("tag.no_title");
  $("crumb").textContent = ctx.kind === "repo" ? ctx.folder : T("tag.opened_from_this_computer", ctx.fileName);
  const nUser = msgs.filter((m) => m.speaker === "author").length;
  const nGaps = msgs.filter((_, i) => gapLabel(i)).length;
  const nTurns = msgs.filter((_, i) => hintReasons(i).length).length;
  $("meta").textContent = [
    ({ chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", grok: "Grok" }[ctx.platform] || ctx.platform || ""),
    T("tag.messages_you_ai", msgs.length, nUser, (msgs.length - nUser)),
    nGaps ? T("tag.long", nGaps) : "",
    nTurns ? T("tag.possible_detected", nTurns) : "",
    savedAt ? T("tag.last_saved", new Date(savedAt).toLocaleString()) : ""
  ].filter(Boolean).join(" · ");
  $("mode-stats").textContent = $("meta").textContent;
  // 回到原本的對話
  const okUrl = ctx.url && /^https:\/\//.test(ctx.url);
  $("open-original").hidden = !okUrl;
  if (okUrl) $("open-original").href = ctx.url;
  $("back-list").hidden = ctx.kind !== "repo";
  renderLabelLine();
  reportResolve(resolved);

  // 有比較新的草稿就問要不要接著用
  try {
    const got = await chrome.storage.local.get(draftKey());
    const draft = got[draftKey()];
    if (draft && draft.outline && (!savedAt || draft.outline.updated_at > savedAt)) {
      $("draft-text").textContent = T("tag.there_is_an_unsaved_draft_from", new Date(draft.outline.updated_at).toLocaleString());
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
  $("copy-folder-path").hidden = ctx.kind !== "repo";
  $("copy-folder-link").hidden = ctx.kind !== "repo";
  $("save").textContent = ctx.kind === "repo" ? T("tag.save_to_github") : ctx.kind === "directory" ? T("page.save_to_folder") : ctx.kind === "zip" ? T("tag.download_tagged_zip") : T("tag.download_outline_json");
  showMain();
  // 請 AI 先標一版：長對話、還沒標過的，預設打開
  renderAiPanel();
  // Keep optional external-AI drafting collapsed by default, even for long chats.
  // Users who want an AI-first workflow can expand it explicitly.
  if (ctx.kind === "repo") loadAiFromRepo(true);
}

async function loadFromRepo(folder) {
  if (/^[/.]/.test(folder) || !folder.endsWith("/") || folder.includes("..") || folder.includes("\\")) throw new Error(T("tag.invalid_folder_path", folder));
  const check = await checkRepo(config);
  if (!check.ok) throw new Error(check.message);
  branch = check.branch;
  const [conv, meta, outlineRaw, index, labels] = await Promise.all([
    readRawFile(config, branch, folder + "source/conversation.jsonl"),
    readRawFile(config, branch, folder + "source/metadata.yaml"),
    readRawFile(config, branch, folder + OUTLINE_FILE),
    readCaptureIndex(config, branch).catch(() => []),
    readLabels(config, branch).catch(() => null)
  ]);
  if (labels) {
    labelStore = makeLabelsStore(config, branch, labels);
    labelStore.onState = (text, bad) => { if (bad) showStatus(T("tag.list_status", text), true, true); };
  }
  if (conv === null) throw new Error(T("tag.source_conversation_jsonl_not_found_in", folder));
  msgs = parseJsonl(conv);
  if (!msgs.length) throw new Error(T("tag.this_conversation_is_empty"));
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
    revision: Number(metaStr("source_revision")) || 1,
    url: (row && row.url) || metaStr("source_url") || null
  };
  let outline = null;
  if (outlineRaw) {
    try { outline = JSON.parse(outlineRaw); } catch (e) { showStatus(T("tag.outline_json_could_not_be_read"), true); }
  }
  await startConversation(outline);
}

async function loadFromDirectory(handle) {
  const source = await ATLocalFolder.read(handle,"source/conversation.jsonl");
  const outlineRaw = await ATLocalFolder.read(handle,"outline.json",true);
  let outline=null;
  if(outlineRaw!==null) {
    try { outline=JSON.parse(outlineRaw); }
    catch(e) { throw Error("本機 outline.json 無法解析；為避免覆寫，已停止載入。"); }
  }
  msgs=parseJsonl(source);
  if(!msgs.length)throw Error(T("tag.this_conversation_is_empty"));
  ctx={kind:"directory",folder:null,fileName:handle.name,title:handle.name,
    platform:null,revision:outline?.source?.source_revision||1,
    localHandle:handle,localSource:source,localOutline:outlineRaw};
  await startConversation(outline);
}
async function loadFromFiles(files) {
  const list = Array.from(files);
  // 檔名可能被瀏覽器改成 UUID 或失去副檔名；依檔案實際標頭辨認 ZIP。
  const zipCandidates = [];
  for (const f of list) {
    if (await ATBundle.looksLikeZip(f)) zipCandidates.push(f);
    else if (/\.zip$/i.test(f.name)) throw new Error(T("tag.has_a_zip_extension_but_its", f.name));
  }
  if (zipCandidates.length > 1) throw new Error(T("tag.only_one_zip_bundle_can_be"));
  const zip = zipCandidates[0];
  if (zip) {
    const entries = await ATBundle.unpack(zip);
    const candidates = [...entries.keys()].filter(p => /(^|\/)source\/conversation\.jsonl$/.test(p));
    if (candidates.length !== 1) throw new Error(T("tag.the_zip_must_contain_exactly_one"));
    const path = candidates[0], prefix = path.slice(0, - "source/conversation.jsonl".length);
    const text = ATBundle.decode(entries.get(path));
    msgs = parseJsonl(text);
    if (!msgs.length) throw new Error(T("tag.the_conversation_in_the_zip_is"));
    let outline = null, aiRaw = null;
    const outlinePath = prefix + "outline.json", aiPath = prefix + "outline.ai.json";
    if (entries.has(outlinePath)) { try { outline = JSON.parse(ATBundle.decode(entries.get(outlinePath))); } catch (e) { throw new Error(T("tag.outline_json_in_the_zip_is", e.message)); } }
    if (entries.has(aiPath)) aiRaw = ATBundle.decode(entries.get(aiPath));
    const meta = entries.has(prefix + "source/metadata.yaml") ? ATBundle.decode(entries.get(prefix + "source/metadata.yaml")) : "";
    const field = name => { const m = meta.match(new RegExp("^\\s*" + name + ":\\s*(.+)$", "m")); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return m[1].trim(); } };
    ctx = { kind: "zip", fileName: zip.name, title: field("page_title") || zip.name.replace(/\.zip$/i, ""),
      platform: field("platform"), url: field("source_url"), revision: Number(field("source_revision")) || 1,
      bundleEntries: entries, bundlePrefix: prefix };
    await startConversation(outline);
    if (aiRaw) takeAi(aiRaw, "file");
    return;
  }
  const conv = list.find(f => /\.jsonl$/i.test(f.name));
  if (!conv) throw new Error(T("tag.choose_an_at_zip_or_a"));
  msgs = parseJsonl(await conv.text());
  if (!msgs.length) throw new Error(T("tag.this_conversation_is_empty"));
  let outline = null, aiRaw = null;
  for (const f of list.filter(x => x !== conv && /\.json$/i.test(x.name))) {
    const text = await f.text(); let obj;
    try { obj = JSON.parse(text); } catch (e) { try { obj = parseAiText(text); } catch (e2) { obj = null; } }
    if (obj && obj.outline_version) outline = obj;
    else if (obj && (obj.format === "after-thinking/outline-suggestion" || obj.spans || obj.mode)) aiRaw = text;
  }
  ctx = { kind: "file", fileName: conv.name, folder: null, title: conv.name.replace(/\.jsonl$/i, ""), platform: null, revision: 1,
    looseAttachments: new Map(list.filter(f => f !== conv && !/\.json$/i.test(f.name)).map(f => [f.name, f])) };
  await startConversation(outline);
  if (aiRaw) takeAi(aiRaw, "file");
}
// 選對話清單（showPicker）在 list.js

// ── 變更、草稿 ──

let draftTimer = null;
function changed(full) {
  dirty = true;
  editVersion++;
  updateTop();
  if (full) render(); else { renderOutput(); renderSelbar(); }
  if (typeof renderAiPanel === "function") renderAiPanel();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { chrome.storage.local.set({ [draftKey()]: { outline: buildOutline() } }); } catch (e) { /* 存不了草稿不影響 */ }
  }, 800);
}

function updateTop() {
  $("mode-label").textContent = "";
  if (dirty) $("mode-label").append(el("span", { class: "dirty-dot", "aria-hidden": "true" }), T("tag.unsaved"));
  if (S.mode) $("mode-label").append(T("tag.mode"), el("strong", { text: S.mode === "multi" ? T("tag.several_topics") : T("tag.one_continuous_topic") }));
  $("change-mode").hidden = !S.mode;
}

window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ── 輸出 ──

// The summary is saved into outline.json, so it is always built in the stored language (ATI18n.STORED_LANG).
function outputText() { return outputTextBody(); }
function outputTextBody() {
  const lines = [];
  if (S.mode === "multi") {
    S.topics.forEach((t) => {
      const idx = msgs.map((_, i) => i).filter((i) => tagOf(i) === t.id);
      if (idx.length) lines.push(t.id + " " + t.name + (t.note ? "（" + t.note + "）" : "") + "：" + ranges(idx));
    });
    const un = msgs.map((_, i) => i).filter((i) => !tagOf(i));
    if (un.length) lines.push(T("tag.untagged", ranges(un)));
    S.topics.forEach((t) => {
      const idx = msgs.map((_, i) => i).filter((i) => alsoOf(i).includes(t.id));
      if (idx.length) lines.push(T("tag.also_related_to_mainly_in_another", t.id, t.name, ranges(idx)));
    });
    const own = msgs.map((_, i) => i).filter(ownTag);
    if (own.length) lines.push(T("tag.ai_replies_tagged_separately", own.map((i) => { const t = topicById(tagOf(i)); return pad(i) + "→" + (t ? t.id : T("tag.untagged_2")); }).join(T("common.list_sep"))));
  } else {
    lines.push(T("tag.topic", (S.single.name || T("tag.untitled")), (S.single.note ? "（" + S.single.note + "）" : ""), ranges(msgs.map((_, i) => i))));
  }
  // 關鍵兩種模式都可以標；多主題時沒標就不寫
  rangeIdx().forEach(([a, b]) => {
    const part = msgs.slice(a, b + 1);
    lines.push(T("tag.key_range_by_you_by_ai", (a === b ? pad(a) : pad(a) + "–" + pad(b)), part.filter((m) => m.speaker !== "assistant").length, part.filter((m) => m.speaker === "assistant").length));
  });
  const keyList = (ai) => msgs.map((_, i) => i).filter((i) => S.keys[msgs[i].id] && (msgs[i].speaker === "assistant") === ai).map(pad);
  const uk = keyList(false), ak = keyList(true);
  if (S.mode !== "multi" || uk.length) lines.push(T("tag.your_keys", (uk.length ? uk.join(T("common.list_sep")) : T("tag.none"))));
  if (S.mode !== "multi" || ak.length) lines.push(T("tag.ai_keys", (ak.length ? ak.join(T("common.list_sep")) : T("tag.none"))));
  const confirmed = msgs.map((_, i) => i).filter(turnConfirmed);
  const hints = msgs.map((_, i) => i).filter(turnHint);
  if (confirmed.length) lines.push(T("tag.turns_confirmed_by_you", confirmed.map(pad).join(T("common.list_sep"))));
  if (hints.length) lines.push(T("tag.possible_turns_program_hints_not_yet", hints.map(pad).join(T("common.list_sep"))));
  const notes = msgs.map((_, i) => i).filter((i) => S.notes[msgs[i].id]);
  if (notes.length) lines.push(T("tag.notes", notes.map((i) => "  " + pad(i) + " " + S.notes[msgs[i].id]).join("\n")));
  const p = aiPendingCounts();
  if (p.total) lines.push(T("tag.ai_suggestions_you_left_unchanged_treated", p.parts.join(T("common.list_sep"))));
  return lines.join("\n");
}

// AI 建議裡使用者還沒動的項目數
function aiPendingCounts() {
  const n = (kind) => Object.values(S.origin[kind]).filter((v) => v === "ai").length;
  const tagMsgs = msgs.filter((_, i) => tagOf(i) && aiPending("tags", tagKey(i))).length;
  const c = { tags: tagMsgs, names: n("names"), keys: n("keys"), ranges: n("ranges"), turns: n("turns") };
  const parts = [];
  if (c.names) parts.push(T("tag.n_topics", c.names));
  if (c.tags) parts.push(T("tag.topic_2", c.tags));
  if (c.keys) parts.push(T("tag.n_keys", c.keys));
  if (c.ranges) parts.push(T("tag.key", c.ranges));
  if (c.turns) parts.push(T("tag.n_turns", c.turns));
  return { c, parts, total: c.names + c.tags + c.keys + c.ranges + c.turns };
}

function buildOutline() {
  const all = msgs.map((_, i) => i);
  const rangeIds = (a, b) => msgs.slice(a, b + 1).map((m) => m.id);
  // 每一項的來源；AI 建議沒動的，另外記有沒有出現在畫面上過
  const withOrigin = (obj, kind, key, ids, reasonKind) => {
    const o = originOf(kind, key);
    obj.origin = o;
    if (o === "ai_unreviewed") obj.seen = seenAny(ids);
    if (reasonKind && S.aiReasons[reasonKind][key]) obj.ai_reason = S.aiReasons[reasonKind][key];
    return obj;
  };
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
    numbering: ATI18n.stored(() => T("tag.display_number_position_after_sorting_by")),
    // 主題分配的來源：沒列在 ai_*_messages 裡的，都是使用者自己標的
    topics: S.topics.map((t) => {
      const mine = all.filter((i) => tagOf(i) === t.id);
      const by = (o) => mine.filter((i) => originOf("tags", tagKey(i)) === o);
      return {
        id: t.id, name: t.name, note: t.note, name_origin: originOf("names", t.id),
        messages: mine.map((i) => msgs[i].id),
        // 主要放在別的主題、但也跟這個主題有關的訊息：整理這個主題時要一起參考，不搬過來
        also_messages: all.filter((i) => alsoOf(i).includes(t.id)).map((i) => msgs[i].id),
        ai_unreviewed_messages: by("ai_unreviewed").map((i) => msgs[i].id),
        ai_confirmed_messages: by("ai_confirmed").map((i) => msgs[i].id),
        unseen_ai_messages: by("ai_unreviewed").filter((i) => !S.aiSeen[tagKey(i)]).map((i) => msgs[i].id)
      };
    }),
    untagged: all.filter((i) => !tagOf(i)).map((i) => msgs[i].id),
    single_topic: { name: S.single.name, note: S.single.note },
    key_points: all.filter((i) => S.keys[msgs[i].id]).map((i) =>
      withOrigin({ message_id: msgs[i].id, speaker: msgs[i].speaker }, "keys", msgs[i].id, [msgs[i].id], "keys")),
    // 整段標成關鍵：使用者認為這一整段是核心（不是逐句判斷）
    key_ranges: rangeIdx().map(([a, b]) => withOrigin({ from_message_id: msgs[a].id, to_message_id: msgs[b].id, messages: rangeIds(a, b) },
      "ranges", msgs[a].id, rangeIds(a, b), "ranges")),
    // turns 只放使用者確認過的；程式提示另外放在 turn_hints，不算使用者的判斷
    // hinted_by：使用者確認前，程式是因為什麼提示的（空的代表使用者自己標的）
    // origin：user（使用者自己標）、ai_confirmed、ai_unreviewed（AI 建議、使用者沒動，預設當作同意）
    turns: all.filter(turnConfirmed).map((i) =>
      withOrigin({ message_id: msgs[i].id, hinted_by: hintReasons(i) }, "turns", msgs[i].id, [msgs[i].id], "turns")),
    turn_hints: all.filter(turnHint).map((i) => ({ message_id: msgs[i].id, reasons: hintReasons(i) })),
    dismissed_auto_turns: all.filter((i) => S.turnsDismissed[msgs[i].id]).map((i) => msgs[i].id),
    notes: all.filter((i) => S.notes[msgs[i].id]).map((i) => ({ message_id: msgs[i].id, text: S.notes[msgs[i].id] })),
    // 根據哪一版 AI 建議（outline.ai.json）整理的，以及使用者否決了哪些建議
    ai_suggestion: S.aiSuggestion || S.aiRejected.length
      ? Object.assign({}, S.aiSuggestion || {}, {
        rejected: S.aiRejected,
        seen_messages: all.filter((i) => S.aiSeen[msgs[i].id]).map((i) => msgs[i].id)
      })
      : null,
    // Canonical persisted summary is independent of the editor language.
    summary: ATI18n.stored(outputText)
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
      showStatus(T("tag.saving"), true);
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
      showStatus(T("tag.saved_to_in", config.repo, ctx.folder, OUTLINE_FILE));
    } else if (ctx.kind === "directory") {
      // Read the source and existing outline again immediately before writing.
      // Another editor must never be silently overwritten.
      ctx.localOutline = await ATLocalFolder.writeOutline(ctx.localHandle,content,ctx.localSource,ctx.localOutline);
      showStatus(T("tag.saved_to_local_folder"));
    } else if (ctx.kind === "zip") {
      const entries = [...ctx.bundleEntries].filter(([name]) => name !== ctx.bundlePrefix + "outline.json").map(([path, data]) => ({ path, data }));
      entries.push({ path: ctx.bundlePrefix + "outline.json", data: content });
      const blob = ATBundle.pack(entries);
      const name = T("tag.tagged_zip", ctx.fileName.replace(/\.zip$/i, "").replace(/-(已標記|tagged)$/i, ""));
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      ctx.bundleEntries = new Map(entries.map(item => [item.path, typeof item.data === "string" ? new TextEncoder().encode(item.data) : item.data]));
      ctx.fileName = name;
      showStatus(T("tag.downloaded_a_complete_zip_that_includes"));
    } else {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const a = el("a", { href: url, download: OUTLINE_FILE });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showStatus(T("tag.downloaded_outline_json_next_time_select"));
    }
    savedAt = outline.updated_at;
    if (editVersion === version) {
      dirty = false;
      UI.moved = new Set();
      try { await chrome.storage.local.remove(draftKey()); } catch (e) {}
      if (S.mode) renderList();
    } else {
      showStatus(T("tag.saved_the_version_from_when_you"), true, true);
    }
    updateTop();
  } catch (e) {
    showStatus(T("tag.save_failed_your_tags_are_still", e.message), true, true);
  }
  btn.disabled = false;
}

// ── 畫面 ──

function showMain() {
  updateTop();
  const choosing = !S.mode;
  // Only lock the viewport while the three-column tagging editor is visible.
  // The conversation picker and mode preview remain normal scrolling pages.
  document.body.classList.toggle("tagging-active", !choosing);
  $("mode-choice").hidden = !choosing;
  $("workspace").hidden = choosing;
  $("drawer").hidden = choosing || !UI.drawer;
  document.body.classList.toggle("drawer-open", !choosing && UI.drawer);
  if (choosing) renderPreview(); else render();
}

// ── 預覽：選整理方式之前，先看你問過的所有問題 ──

function renderPreview() {
  const list = $("preview");
  list.textContent = "";
  const qs = msgs.map((m, i) => i).filter((i) => msgs[i].speaker === "author");
  let longCount = 0;
  qs.forEach((i, k) => {
    // 和上一個問題之間隔很久，畫分隔線（看的是兩個問題之間有沒有一段很長的空白）
    const prevQ = k ? qs[k - 1] : -1;
    for (let j = prevQ + 1; j <= i; j++) { const g = j ? gapLabel(j) : null; if (g) { list.append(el("li", { class: "gap-line", text: g })); break; } }
    const text = (msgs[i].content || "").replace(/\s+/g, " ").trim() || T("tag.attachment_only");
    const long = text.length > QUESTION_PREVIEW;
    if (long) longCount++;
    const open = !!UI.previewExp[i];
    const replies = (k + 1 < qs.length ? qs[k + 1] : msgs.length) - i - 1;
    const li = el("li", { class: "pq" + (hintReasons(i).length ? " hinted" : ""), title: hintReasons(i).length ? T("tag.program_hint_possible_turn_here") : null },
      el("span", { class: "num", text: pad(i) }),
      el("span", { class: "pq-text", text: long && !open ? text.slice(0, QUESTION_PREVIEW) + "…" : text }),
      long ? el("button", { class: "pq-more", text: open ? T("tag.collapse") : T("tag.expand_characters", text.length) }) : null,
      replies > 1 ? el("span", { class: "pq-meta", text: T("tag.ai_replied", replies) }) : null);
    const more = li.querySelector(".pq-more");
    if (more) more.addEventListener("click", () => { UI.previewExp[i] = !open; renderPreview(); });
    list.append(li);
  });
  if (!qs.length) list.append(el("li", { class: "empty-note", text: T("tag.you_have_no_messages_in_this") }));
  $("preview-count").textContent = T("tag.you_asked", qs.length, (longCount ? T("tag.longer_collapsed", longCount) : ""));
  const longIdx = qs.filter((i) => (msgs[i].content || "").replace(/\s+/g, " ").trim().length > QUESTION_PREVIEW);
  const allOpen = longIdx.length > 0 && longIdx.every((i) => UI.previewExp[i]);
  $("preview-expand").hidden = !longCount;
  $("preview-expand").textContent = allOpen ? T("tag.collapse_all") : T("tag.expand_all");
  $("preview-expand").onclick = () => { longIdx.forEach((i) => { UI.previewExp[i] = !allOpen; }); renderPreview(); };
  // 這篇標成不用整理過
  const st = labelStore && ctx.kind === "repo" ? labelStore.get(ctx.folder) : null;
  const banner = $("skip-banner");
  banner.textContent = "";
  banner.hidden = !(st && st.status === "skip");
  if (st && st.status === "skip") {
    const back = el("button", { class: "secondary small", text: T("tag.set_back_to_to_do") });
    back.addEventListener("click", async () => { labelStore.set(ctx.folder, { status: "todo" }); await labelStore.save(); renderLabelLine(); renderPreview(); });
    banner.append(T("tag.this_conversation_is_marked_skip", (SKIP_REASONS[st.skip_reason] || T("tag.no_reason_given")), (st.skip_note ? "：" + st.skip_note : "")), back);
  }
  if (typeof previewAiLine === "function") previewAiLine();
}

// 這篇不用整理：選理由，記在 inbox/labels.json，不產生 outline.json
function openSkipForm() {
  const form = $("skip-form");
  form.hidden = false;
  const canSave = !!labelStore && ctx.kind === "repo";
  $("skip-file-note").hidden = canSave;
  $("skip-go").disabled = !canSave;
  const box = $("skip-reasons");
  box.textContent = "";
  const cur = canSave ? labelStore.get(ctx.folder) : {};
  let chosen = cur.skip_reason || "chat";
  Object.entries(SKIP_REASONS).forEach(([k, label]) => {
    const b = el("button", { class: "secondary small", "aria-pressed": String(k === chosen), text: label });
    b.addEventListener("click", () => { chosen = k; box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
    box.append(b);
  });
  $("skip-note").value = cur.skip_note || "";
  $("skip-go").onclick = async () => {
    labelStore.set(ctx.folder, { status: "skip", skip_reason: chosen, skip_note: $("skip-note").value.trim() });
    $("skip-go").disabled = true;
    const ok = await labelStore.save();
    $("skip-go").disabled = false;
    if (!ok) return;
    form.hidden = true;
    renderLabelLine();
    renderPreview();
    showStatus(T("tag.marked_as_skip_the_list_will"));
  };
}

// 標題下方：處理狀態和自訂標籤（在清單頁改）
function renderLabelLine() {
  const line = $("label-line");
  line.textContent = "";
  const hasUrl = !$("open-original").hidden;
  if (labelStore && ctx.kind === "repo") {
    const st = labelStore.get(ctx.folder);
    if (st.status !== "todo") line.append(el("span", { class: "status-chip s-" + st.status, text: STATUS_TEXT[st.status] || st.status }));
    (st.labels || []).forEach((id) => {
      const l = labelStore.data.labels.find((x) => x.id === id);
      if (!l) return;
      const c = LABEL_COLORS[l.color % LABEL_COLORS.length];
      line.append(el("span", { class: "label-chip", style: { background: c.bg, color: c.fg, borderColor: c.line }, text: l.name }));
    });
    if (st.note) line.append(el("span", { class: "hint", text: T("tag.note", st.note) }));
  }
  $("origin-line").hidden = !hasUrl && !line.childNodes.length;
}

function render() {
  const multi = S.mode === "multi";
  $("multi-panel").hidden = !multi;
  $("flow-panel").hidden = multi;
  if (multi) renderTopics(); else renderFlowPanel();
  renderSelbar();
  renderList();
  renderOutput();
  if (typeof renderNavbar === "function") { renderNavbar(); renderDrawer(); }
}

function renderTopics() {
  const box = $("topics");
  box.textContent = "";
  S.topics.forEach((t) => {
    const p = pal(t.id);
    const count = msgs.filter((_, i) => tagOf(i) === t.id).length;
    const name = el("input", { type: "text", value: t.name, "aria-label": T("tag.name_of_topic", t.id), class: "strong", "data-topic-name": t.id });
    name.addEventListener("input", () => { t.name = name.value; topicEdited(t); });
    const note = el("input", { type: "text", value: t.note, "aria-label": T("tag.description_of_topic", t.id), placeholder: T("tag.description_e_g_mostly_about_habits"), "data-topic-note": t.id });
    note.addEventListener("input", () => { t.note = note.value; topicEdited(t); });
    const del = el("button", { class: "icon-btn", "aria-label": T("tag.delete_topic", t.id), title: T("tag.delete_topic_2"), text: "×" });
    del.addEventListener("click", () => {
      const n = Object.values(S.tags).filter((v) => v === t.id).length;
      S.topics = S.topics.filter((x) => x !== t);
      // 錨點變回還沒標；另外分類的 AI 回覆變回跟著上一句
      Object.keys(S.tags).forEach((k) => { if (S.tags[k] === t.id) { touchAi("tags", k, "removed", t.id); delete S.tags[k]; } });
      Object.keys(S.also).forEach((k) => { S.also[k] = S.also[k].filter((x) => x !== t.id); if (!S.also[k].length) delete S.also[k]; });
      touchAi("names", t.id, "removed", t.name);
      if (!S.topics.length) S.topics = [{ id: nextTopicId(), name: T("tag.new_topic"), note: "" }];
      showStatus(T("tag.deleted_topic", t.id, (n ? T("tag.its_now_untagged", n) : "")));
      changed(true);
    });
    const nameSugg = aiPending("names", t.id);
    box.append(el("div", { class: "topic" + (nameSugg ? " ai-sugg" : ""), style: { borderTopColor: p.stripe } },
      el("div", { class: "row" },
        el("span", { class: "topic-id", style: { background: p.bg, color: p.fg }, text: t.id }),
        name,
        el("span", { class: "topic-count", text: T("tag.n_messages", count) }),
        del),
      note,
      nameSugg ? el("div", { class: "ai-note" }, T("tag.topic_suggested_by_ai_editing_its"), okButton("names", t.id, T("tag.topic_3"))) : null));
  });
  const add = el("button", { class: "add-topic", text: T("tag.add_topic") });
  add.addEventListener("click", () => { addTopic(); changed(true); });
  box.append(add);
  const left = anchors().filter((i) => !tagOf(i)).length;
  const pill = $("left");
  pill.textContent = left ? T("tag.still_untagged", left) : T("tag.everything_is_tagged");
  pill.style.background = left ? "var(--warn-bg)" : "var(--ok-bg)";
  pill.style.color = left ? "var(--warn-fg)" : "var(--ok-fg)";
  $("view-time").setAttribute("aria-pressed", String(UI.view === "time"));
  $("view-topic").setAttribute("aria-pressed", String(UI.view === "topic"));
}

// 改主題名稱或說明時，就地更新畫面上其他地方，不重畫整個清單
// （重畫會讓離開輸入框後的第一下點擊落空）
function topicEdited(t) {
  if (S.origin.names[t.id] === "ai") S.origin.names[t.id] = "ai_confirmed";   // 改了 AI 取的名稱 = 確認這個主題
  const active = document.activeElement;
  document.querySelectorAll('[data-topic-name="' + t.id + '"]').forEach((n) => { if (n !== active) n.value = t.name; });
  document.querySelectorAll('[data-topic-note="' + t.id + '"]').forEach((n) => { if (n !== active) n.value = t.note; });
  document.querySelectorAll('[data-chip-topic="' + t.id + '"]').forEach((n) => { n.textContent = t.id + " " + t.name + " ▾"; });
  document.querySelectorAll('[data-option-topic="' + t.id + '"]').forEach((n) => { n.textContent = t.id + " " + t.name; });
  document.querySelectorAll('[data-chip-also="' + t.id + '"]').forEach((n) => { n.textContent = "＋" + t.id + " " + t.name; });
  changed(false);
}

function nextTopicId() { return TOPIC_IDS.find((x) => !S.topics.some((t) => t.id === x)); }
function addTopic() {
  const id = nextTopicId();
  if (!id) { showStatus(T("tag.you_can_have_at_most_26")); return null; }
  S.topics.push({ id, name: T("tag.new_topic"), note: "" });
  return id;
}

function renderFlowPanel() {
  $("flow-name").value = S.single.name;
  $("flow-note").value = S.single.note;
  const uk = msgs.filter((m) => S.keys[m.id] && m.speaker !== "assistant").length;
  const ak = msgs.filter((m) => S.keys[m.id] && m.speaker === "assistant").length;
  const nr = rangeIdx().length;
  $("key-count").textContent = T("tag.of_your_keys_ai_keys", (nr ? T("tag.key_2", nr) : ""), uk, ak);
  const box = $("filters");
  box.textContent = "";
  [["all", T("tag.all")], ["key", T("tag.keys_only")], ["user", T("tag.your_keys_2")], ["ai", T("tag.ai_keys_2")]].forEach(([k, label]) => {
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
  bar.append(el("span", { class: "count", text: T("tag.selected", UI.sel.size) }));
  const kr = el("button", { class: "key-range-btn", text: T("tag.mark_selection_as_a_key_range") });
  kr.addEventListener("click", addKeyRange);
  bar.append(kr);
  if (S.mode !== "multi") {
    const un0 = el("button", { class: "link", text: T("tag.clear_selection") });
    un0.addEventListener("click", () => { UI.sel.clear(); UI.last = null; render(); });
    bar.append(un0);
    return;
  }
  S.topics.forEach((t) => {
    const p = pal(t.id);
    const b = el("button", { style: { background: p.bg, color: p.fg }, text: T("tag.tag_as", t.id, t.name) });
    b.addEventListener("click", () => assign(Array.from(UI.sel), t.id));
    bar.append(b);
  });
  const nb = el("button", { class: "ghost", text: T("tag.new_topic_2") });
  nb.addEventListener("click", () => { const id = addTopic(); if (id) assign(Array.from(UI.sel), id); });
  const clear = el("button", { class: "ghost", text: T("tag.clear_tag") });
  clear.addEventListener("click", () => assign(Array.from(UI.sel), null));
  const un = el("button", { class: "link", text: T("tag.clear_selection") });
  un.addEventListener("click", () => { UI.sel.clear(); UI.last = null; render(); });
  bar.append(nb, clear, un);
}

// 從第一個選的句子，到最後一個選的句子和它後面的 AI 回覆，整段標成關鍵；和既有段落重疊或相連就合併
function addKeyRange() {
  const sel = Array.from(UI.sel).sort((a, b) => a - b);
  if (!sel.length) return;
  let lo = sel[0], hi = sel[sel.length - 1];
  while (hi + 1 < msgs.length && anchorOf[hi + 1] === sel[sel.length - 1]) hi++;
  // 和新段落重疊或相連的 AI 建議段落，被併進使用者的新段落：記成改過
  rangeIdx().forEach(([a, b]) => { if (a <= hi + 1 && b >= lo - 1) touchAi("ranges", msgs[a].id, "changed", [msgs[a].id, msgs[b].id]); });
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
    // AI 建議過這一則的主題：選同一個 = 確認；選別的或清掉 = 否決
    if (S.origin.tags[id]) {
      const was = has(S.tags, id) ? (S.tags[id] || null) : null;
      if (was === (topicId || null)) { if (S.origin.tags[id] === "ai") S.origin.tags[id] = "ai_confirmed"; }
      else touchAi("tags", id, topicId ? "changed" : "removed", was, topicId || null);
    }
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
      // 主要在別的主題、但也跟這個主題有關的，也排進來（標「也相關」）
      const also = new Set(key ? all.filter((i) => alsoOf(i).includes(key)) : []);
      out.push({ kind: "head", key, idx, also: also.size });
      if (!idx.length && !also.size) out.push({ kind: "empty" });
      let prev = null;
      all.filter((i) => tagOf(i) === key || also.has(i)).forEach((i) => {
        if (prev !== null && i !== prev + 1) {
          const between = all.slice(prev + 1, i);
          const names = Array.from(new Set(between.map((j) => { const t = topicById(tagOf(j)); return t ? t.id + " " + t.name : T("tag.untagged_2"); })));
          const label = between.length === 1 ? pad(prev + 1) : pad(prev + 1) + "–" + pad(i - 1);
          out.push({ kind: "skip", label: T("tag.skipped", label, names.join(T("common.list_sep"))) });
        }
        out.push({ kind: "msg", i, alsoIn: also.has(i) ? key : null });
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
      if (UI.filter !== "all" && i !== prev + 1) out.push({ kind: "skip", label: T("tag.in_between_not_shown", (i - prev - 1)) });
      const g = UI.filter === "all" ? gapLabel(i) : null;
      if (g) out.push({ kind: "gap", label: g });
      out.push({ kind: "msg", i });
      prev = i;
    });
    if (!out.length) out.push({ kind: "empty", text: T("tag.nothing_is_marked_as_key_yet") });
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
    else if (r.kind === "empty") frag.append(el("div", { class: "empty-note", text: r.text || T("tag.no_messages_are_tagged_with_this") }));
    else if (r.kind === "head") frag.append(groupHead(r));
    else frag.append(msgRow(r.i, r.alsoIn));
  });
  list.append(frag);
  window.scrollTo(0, scrollY);
  watchSeen(list);
}

// 記下哪些訊息出現在畫面上過：AI 建議沒動的項目，「看過沒改」和「根本沒看到」意思不同。只記錄，不算修改
let seenObserver = null;
function watchSeen(list) {
  if (!window.IntersectionObserver) return;
  if (seenObserver) seenObserver.disconnect();
  // 露出三成以上，或很長的訊息佔了畫面四成以上，就算看過
  seenObserver = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    if (e.intersectionRatio < 0.3 && e.intersectionRect.height < window.innerHeight * 0.4) return;
    S.aiSeen[e.target.dataset.mid] = true;
    seenObserver.unobserve(e.target);
  }), { threshold: [0, 0.05, 0.1, 0.2, 0.3] });
  list.querySelectorAll(".msg[data-mid]").forEach((n) => { if (!S.aiSeen[n.dataset.mid]) seenObserver.observe(n); });
}

// AI 建議沒動的項目旁邊的「✓」：按了就算確認
function okButton(kind, key, label) {
  const b = el("button", { class: "ok-btn", "aria-label": T("tag.confirm_the_ai_suggested", label), title: T("tag.confirm_this_ai_suggestion"), text: "✓" });
  b.addEventListener("click", (e) => { e.stopPropagation(); confirmAi(kind, key); });
  return b;
}

function groupHead(r) {
  const p = pal(r.key);
  const head = el("div", { class: "group-head", style: { borderBottomColor: p.stripe } });
  if (r.key) {
    const t = topicById(r.key);
    const name = el("input", { type: "text", class: "g-name", value: t.name, "aria-label": T("tag.name_of_topic", t.id), "data-topic-name": t.id });
    name.addEventListener("input", () => { t.name = name.value; topicEdited(t); });
    const note = el("input", { type: "text", class: "g-note", value: t.note, placeholder: T("tag.description"), "aria-label": T("tag.description_of_topic", t.id), "data-topic-note": t.id });
    note.addEventListener("input", () => { t.note = note.value; topicEdited(t); });
    head.append(el("span", { class: "topic-id", style: { background: p.bg, color: p.fg }, text: t.id }), name, note);
  } else {
    head.append(el("h3", { text: T("tag.untagged_2") }));
  }
  head.append(el("span", { class: "ranges", text: ranges(r.idx) + (r.also ? T("tag.also_related", r.also) : "") }));
  return head;
}

// 主要主題旁邊的「＋B」：也跟 B 有關
function alsoChips(i, line) {
  alsoOf(i).forEach((x) => {
    const xp = pal(x);
    const t = topicById(x);
    line.append(el("span", { class: "also-chip", style: { color: xp.fg, borderColor: xp.stripe }, title: T("tag.also_related_to", x, t.name),
      "data-chip-also": x, text: "＋" + x + " " + t.name }));
  });
}

function msgRow(i, alsoIn) {
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

  const row = el("div", { class: "msg" + (ai ? " ai" : "") + (selected ? " selected" : "") + (range ? " in-range" : "") + (alsoIn ? " also-row" : "") + (UI.cursor && UI.cursor.i === i ? " cursor" : ""),
    style: { borderLeftColor: stripe }, "data-mid": m.id });

  // 編號：你的發言都可以點來選取（分主題、整段標成關鍵用）
  if (anchor) {
    const b = el("button", { class: "num", text: pad(i), "aria-pressed": String(selected), "aria-label": T("tag.select", pad(i)) });
    b.addEventListener("click", (e) => pick(i, e));
    row.append(b);
  } else {
    row.append(el("span", { class: "num", text: pad(i) }));
  }

  const body = el("div", { class: "body" });
  const line1 = el("div", { class: "line1" }, el("span", { class: "who", text: who(m) }));
  const own = ownTag(i);
  if (multi && (anchor || own)) {
    const sugg = aiPending("tags", m.id);
    const chip = el("button", { class: "chip" + (sugg ? " ai-sugg" : ""), "aria-expanded": String(UI.picker === i),
      style: { background: p.bg, color: p.fg, borderColor: t ? p.stripe : "#C9CED6" },
      title: originOf("tags", m.id) === "ai_confirmed" ? T("tag.ai_suggestion_confirmed_by_you") : "",
      "data-chip-topic": tid || "", text: (sugg ? T("tag.suggested") : "") + (t ? t.id + " " + t.name : T("tag.untagged_2")) + " ▾" });
    chip.addEventListener("click", () => { UI.picker = UI.picker === i ? null : i; renderList(); });
    line1.append(chip);
    if (sugg) line1.append(okButton("tags", m.id, T("tag.topic_3")));
    alsoChips(i, line1);
    if (own) line1.append(el("span", { class: "follow", text: T("tag.separate_topic") }));
  } else if (multi) {
    line1.append(el("span", { class: "follow", text: T("tag.follows", pad(anchorOf[i])) }));
    alsoChips(i, line1);
    const split = el("button", { class: "chip quiet", "aria-expanded": String(UI.picker === i), text: T("tag.separate_topic_2") });
    split.addEventListener("click", () => { UI.picker = UI.picker === i ? null : i; renderList(); });
    line1.append(split);
  }
  // 關鍵：兩種模式都可以標
  const on = ai ? { bg: "var(--ai-key)", fg: "#fff" } : { bg: "var(--user-key)", fg: "#fff" };
  const keySugg = key && aiPending("keys", m.id);
  const kb = el("button", { class: "chip" + (multi && !key ? " quiet" : "") + (keySugg ? " ai-sugg" : ""), "aria-pressed": String(key),
    style: key ? { background: on.bg, color: on.fg, borderColor: on.bg } : {},
    text: key ? (keySugg ? T("tag.suggested") : "") + (ai ? T("tag.ai_key") : T("tag.your_key")) : T("tag.mark_as_key"),
    title: T("tag.key_this_message_matters_and_will") });
  kb.addEventListener("click", () => {
    if (key) { touchAi("keys", m.id, "removed", true); delete S.keys[m.id]; } else S.keys[m.id] = true;
    if (!multi) renderFlowPanel();
    changed(true);
  });
  line1.append(kb);
  if (keySugg) line1.append(okButton("keys", m.id, T("tag.key_3")));
  // 轉向：程式提示要使用者確認才算數
  if (turnConfirmed(i)) {
    const x = el("button", { "aria-label": T("tag.remove_the_turn_at", pad(i)), text: "×" });
    x.addEventListener("click", () => {
      touchAi("turns", m.id, "removed", true);
      delete S.turnsConfirmed[m.id];
      if (hintReasons(i).length) S.turnsDismissed[m.id] = true;
      changed(true);
    });
    if (aiPending("turns", m.id)) {
      const ok = el("button", { class: "confirm", text: T("tag.confirm") });
      ok.addEventListener("click", () => confirmAi("turns", m.id));
      line1.append(el("span", { class: "turn ai-sugg" }, T("tag.turn_ai_suggestion"), ok, x));
    } else {
      line1.append(el("span", { class: "turn", title: originOf("turns", m.id) === "ai_confirmed" ? T("tag.ai_suggestion_confirmed_by_you") : "" }, T("tag.turn"), x));
    }
  } else if (turnHint(i)) {
    const ok = el("button", { class: "confirm", text: T("tag.confirm") });
    ok.addEventListener("click", () => { S.turnsConfirmed[m.id] = true; changed(true); });
    const x = el("button", { "aria-label": T("tag.not_a_turn_remove_the_hint", pad(i)), text: "×" });
    x.addEventListener("click", () => { S.turnsDismissed[m.id] = true; changed(true); });
    line1.append(el("span", { class: "turn hint" }, T("tag.possible_turn_program_hint", hintReasons(i).map((r) => HINT_TEXT[r]).join(T("common.list_sep"))), ok, x));
  }
  if (UI.moved.has(i)) line1.append(el("span", { class: "moved", text: T("tag.source_changed_please_confirm") }));
  // 關鍵段落：在段落的第一則標出範圍，可以整段移除
  if (range && range[0] === i) {
    const x = el("button", { "aria-label": T("tag.remove_key_range", pad(range[0]), pad(range[1])), text: "×" });
    x.addEventListener("click", () => {
      touchAi("ranges", msgs[range[0]].id, "removed", [msgs[range[0]].id, msgs[range[1]].id]);
      S.keyRanges = S.keyRanges.filter((r) => r.from !== msgs[range[0]].id);
      changed(true);
    });
    const rid = msgs[range[0]].id;
    const rs = aiPending("ranges", rid);
    line1.append(el("span", { class: "range-chip" + (rs ? " ai-sugg" : "") },
      T("tag.key_range", (rs ? T("tag.suggested") : ""), (range[0] === range[1] ? pad(range[0]) : pad(range[0]) + "–" + pad(range[1]))),
      rs ? okButton("ranges", rid, T("tag.key_range_2")) : null, x));
  }
  body.append(line1);
  // AI 給的理由（還在、而且是這一則的）
  const why = [];
  if (turnConfirmed(i) && S.origin.turns[m.id] && S.aiReasons.turns[m.id]) why.push(T("tag.turn_2", S.aiReasons.turns[m.id]));
  if (key && S.origin.keys[m.id] && S.aiReasons.keys[m.id]) why.push(T("tag.key_4", S.aiReasons.keys[m.id]));
  if (range && range[0] === i && S.origin.ranges[m.id] && S.aiReasons.ranges[m.id]) why.push(T("tag.key_range_3", S.aiReasons.ranges[m.id]));
  if (why.length) body.append(el("div", { class: "ai-reason", text: T("tag.ai_s_reason", why.join("　")) }));

  // 主題選單
  if (multi && UI.picker === i) {
    const targets = anchor && selected && UI.sel.size > 1 ? Array.from(UI.sel) : [i];
    const box = el("div", { class: "picker" }, el("span", { class: "hint", text: targets.length > 1 ? T("tag.apply_to_the_selected", targets.length) : T("tag.change_to") }));
    S.topics.forEach((x) => {
      const xp = pal(x.id);
      const cur = x.id === tid;
      const b = el("button", { "data-option-topic": x.id, style: { background: cur ? xp.stripe : xp.bg, color: cur ? "#fff" : xp.fg, borderColor: xp.stripe }, text: x.id + " " + x.name });
      b.addEventListener("click", () => assign(targets, x.id));
      box.append(b);
    });
    const none = el("button", { style: { background: "#fff", color: "#4A515C", borderColor: "#C9CED6" }, text: T("tag.untagged_2") });
    none.addEventListener("click", () => assign(targets, null));
    const nb = el("button", { style: { background: "#fff", color: "#1B1F24", borderColor: "#1B1F24" }, text: T("tag.new_topic_2") });
    nb.addEventListener("click", () => { const id = addTopic(); if (id) assign(targets, id); });
    box.append(none, nb);
    // 也跟別的主題有關（主要主題不變）：AI 整理時照主要主題分組，讀到這些主題時也會參考這一則
    const others = S.topics.filter((x) => x.id !== tid);
    if (tid && others.length && (anchor || own)) {
      const k = tagKey(i);
      const alsoBox = el("div", { class: "also-pick" }, el("span", { class: "hint", text: T("tag.also_related_to_these_topics", (targets.length > 1 ? T("tag.this_message_only") : "")) }));
      others.forEach((x) => {
        const xp = pal(x.id);
        const on = alsoOf(i).includes(x.id);
        const b = el("button", { "aria-pressed": String(on), style: { background: on ? xp.bg : "#fff", color: xp.fg, borderColor: xp.stripe, borderStyle: on ? "solid" : "dashed" },
          text: (on ? "✓ " : "＋") + x.id + " " + x.name });
        b.addEventListener("click", () => {
          const list = (S.also[k] || []).filter((y) => y !== x.id);
          if (!on) list.push(x.id);
          if (list.length) S.also[k] = list; else delete S.also[k];
          changed(true);
        });
        alsoBox.append(b);
      });
      box.append(alsoBox);
    }
    if (own) {
      const back = el("button", { style: { background: "#fff", color: "#3D4450", borderColor: "#C9CED6" }, text: T("tag.follow_again", pad(anchorOf[i])) });
      back.addEventListener("click", () => { touchAi("tags", m.id, "removed", S.tags[m.id] || null); delete S.tags[m.id]; UI.picker = null; changed(true); });
      box.append(back);
    }
    body.append(box);
  }

  // 內容：AI 回覆先顯示 200 字，使用者的長文件也摺疊
  const limit = ai ? AI_PREVIEW : USER_PREVIEW;
  const text = m.content || T("tag.attachment_only");
  const long = text.length > limit;
  const open = !!UI.exp[i];
  body.append(el("div", { class: "text", text: long && !open ? text.slice(0, limit) + "…" : text }));

  // 備註
  const note = S.notes[m.id] || "";
  const noteBox = UI.noteOpen[i] || note !== "";
  if (noteBox) {
    const input = el("input", { type: "text", id: "note-" + i, value: note, placeholder: T("tag.why_this_message_matters_or_some") });
    input.addEventListener("input", () => {
      if (input.value) S.notes[m.id] = input.value; else delete S.notes[m.id];
      changed(false);
    });
    const x = el("button", { class: "icon-btn", "aria-label": T("tag.delete_the_note_on", pad(i)), text: "×" });
    x.addEventListener("click", () => { delete S.notes[m.id]; delete UI.noteOpen[i]; changed(true); });
    body.append(el("div", { class: "note" }, el("label", { for: "note-" + i, text: T("tag.note_2") }), input, x));
    if (UI.noteOpen[i] === "focus") { UI.noteOpen[i] = true; setTimeout(() => input.focus(), 0); }
  }

  const actions = el("div", { class: "actions" });
  if (long) {
    const b = el("button", { class: "expand", text: open ? T("tag.collapse") : T("tag.show_full_text_characters", text.length) });
    b.addEventListener("click", () => { UI.exp[i] = !open; renderList(); });
    actions.append(b);
  }
  if (!noteBox) {
    const b = el("button", { text: T("tag.note_3") });
    b.addEventListener("click", () => { UI.noteOpen[i] = "focus"; renderList(); });
    actions.append(b);
  }
  // 已經選了一些句子時，其他句子可以「選到這裡」（不用記 Shift）
  if (anchor && !selected && UI.sel.size && UI.last !== null && UI.last !== i) {
    const b = el("button", { class: "select-to", text: T("tag.select_up_to_here_from", pad(UI.last)) });
    b.addEventListener("click", () => pick(i, null, true));
    actions.append(b);
  }
  if (!ai && !turnConfirmed(i) && !turnHint(i)) {
    const b = el("button", { text: T("tag.mark_turn"), title: T("tag.the_direction_changed_here_this_message") });
    b.addEventListener("click", () => { S.turnsConfirmed[m.id] = true; delete S.turnsDismissed[m.id]; changed(true); });
    actions.append(b);
  }
  body.append(actions);
  row.append(body);
  return row;
}

// 點編號：加選或取消；按住 Shift（或按「選到這裡」）：從上一次點的那句選到這句
function pick(i, e, toHere) {
  const shift = (e && e.shiftKey) || toHere;
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

$("choose-multi").addEventListener("click", () => { S.mode = "multi"; $("skip-form").hidden = true; changed(false); showMain(); });
$("choose-flow").addEventListener("click", () => { S.mode = "flow"; $("skip-form").hidden = true; changed(false); showMain(); });
$("choose-skip").addEventListener("click", openSkipForm);
$("skip-cancel").addEventListener("click", () => { $("skip-form").hidden = true; });
$("change-mode").addEventListener("click", () => {
  UI.sel.clear(); UI.picker = null;
  $("mode-choice").hidden = false;
  $("workspace").hidden = true;
  $("drawer").hidden = true;
  document.body.classList.remove("drawer-open", "tagging-active");
  renderPreview();
});
$("view-time").addEventListener("click", () => { UI.view = "time"; render(); });
$("view-topic").addEventListener("click", () => { UI.view = "topic"; render(); });
$("flow-name").addEventListener("input", (e) => { S.single.name = e.target.value; changed(false); });
$("flow-note").addEventListener("input", (e) => { S.single.note = e.target.value; changed(false); });
function currentGitHubFolderLink(){
  if(!ctx||ctx.kind!=="repo"||!config?.repo)return null;
  return "https://github.com/"+config.repo+"/tree/"+encodeURIComponent(branch)+"/"+ctx.folder.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}
async function copyCurrentLocation(link){
  if(!ctx||ctx.kind!=="repo")return;
  const value=link?currentGitHubFolderLink():config.repo+" (branch: "+branch+")\n"+ctx.folder;
  try{await navigator.clipboard.writeText(value);showStatus(T("tag.copied"))}
  catch(e){showStatus(T("tag.could_not_copy",e.message),true)}
}
$("copy-folder-path").addEventListener("click",()=>copyCurrentLocation(false));
$("copy-folder-link").addEventListener("click",()=>copyCurrentLocation(true));
$("save").addEventListener("click", save);
$("copy-output").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(outputText()); showStatus(T("tag.copied")); }
  catch (e) { showStatus(T("tag.could_not_copy", e.message)); }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s" && ctx) { e.preventDefault(); save(); }
});

async function init() {
  config = await loadConfig();
  const folder = new URLSearchParams(location.search).get("folder");
  if (!folder) { await showPicker(); return; }
  if (!config || !config.repo || !config.token) { showError(T("tag.github_is_not_set_up_yet")); await showPicker(); return; }
  try { await loadFromRepo(folder); }
  catch (e) { showError(e.message); }
}

// 等 tag-ai.js、tag-review.js、list.js 都載入後才開始
document.addEventListener("DOMContentLoaded", init);
