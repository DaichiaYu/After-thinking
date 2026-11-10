// After-thinking Capture — 請 AI 先標一版（v0.7.0）
// 對話太長、懶得自己從頭看時：請使用者喜歡的 AI 先標一版，結果存成 outline.ai.json，
// 再到標記頁把 AI 的建議疊上去，使用者決定接受、修改或刪掉。
//   做法 B：能讀寫 GitHub 的 AI 直接把 outline.ai.json 寫進討論資料夾（插件每次打開都重新讀）
//   做法 A：下載一個檔案（說明＋編號好的對話）丟給任何 AI，再把 AI 回的 outline.ai.json 匯入
// AI 的建議永遠不直接寫進 outline.json；套用後每一項都記來源（見 tag.js 的 S.origin）。
// 這個檔案用到 tag.js 的全域變數（msgs、S、ctx…），要在 tag.js 後面載入。

const AI_FILE = "outline.ai.json";
const AI_FORMAT = "after-thinking/outline-suggestion";
const AI_FORMAT_VERSION = 1;

const AI = {
  raw: null,        // 目前讀到的 outline.ai.json 原文
  data: null,       // 解析後
  from: null,       // "repo" | "file" | "paste"
  report: null      // 檢查結果
};

// ── 給 AI 的說明 ──

// 給 AI 的完整規則和格式在 outline-ai-guide.md（倉庫裡的 guides/outline-ai.md 和下載檔共用同一份）

// 做法 B：給能讀寫 GitHub 的 AI。完整規則放在倉庫的 guides/outline-ai.md，這裡只寫這段對話的資料
function instructionsForRepo() {
  const nUser = msgs.filter((m) => m.speaker !== "assistant").length;
  return [
    "請幫我先標記一段 AI 對話，結果寫成一個 JSON 檔案放進 GitHub 倉庫。",
    "",
    "倉庫：" + config.repo + "（分支 " + branch + "）",
    "資料夾：" + ctx.folder,
    "原文：" + ctx.folder + "source/conversation.jsonl（一行一則訊息，照 order 排序）",
    "要做的事：照倉庫裡的 " + OUTLINE_AI_GUIDE_PATH + " 做。這段共 " + msgs.length + " 則（我的 " + nUser + " 則），source_fingerprint 照抄：" + sourceFingerprint()
  ].join("\n");
}

// 複製指令前，確認倉庫裡的指引是最新的；沒有或太舊就先寫進去（AI 要讀得到）
async function ensureOutlineAiGuide() {
  const files = await repoGuideFiles(config, branch);
  if (!files.some((f) => f.path === OUTLINE_AI_GUIDE_PATH)) return false;
  await commitFiles(config, branch, files, "After-thinking: add " + OUTLINE_AI_GUIDE_PATH);
  return true;
}

// 做法 A：下載給任何 AI 的檔案（說明＋編號好的完整對話）。說明和倉庫裡的指引是同一份，只拿掉跟倉庫有關的段落
async function requestFileContent() {
  const nUser = msgs.filter((m) => m.speaker !== "assistant").length;
  const lines = [
    "這個檔案前半是說明，後半是完整的對話原文。看完後請只輸出一個 outline.ai.json：",
    "放在一個 ```json 程式碼區塊裡，或直接給我一個名為 outline.ai.json 的檔案。",
    "",
    "這段對話共 " + msgs.length + " 則，其中我的訊息 " + nUser + " 則（speaker 是 author 的是我，assistant 是 AI）。",
    "source_fingerprint 照抄：" + sourceFingerprint() + "　message_count 照抄：" + msgs.length,
    "",
    await outlineAiGuideText(false),
    "",
    "## 對話原文",
    "",
    "標題：" + (ctx.title || ""),
    "每則開頭是 message_id、顯示編號和說話的人；回覆時一律用 message_id。",
    ""
  ];
  msgs.forEach((m, i) => {
    lines.push("### " + m.id + "｜" + pad(i) + "｜" + (m.speaker === "author" ? "我（author）" : m.speaker === "assistant" ? "AI（assistant）" : "外部（external）"));
    lines.push("");
    lines.push(m.content || "（只有附件）");
    lines.push("");
  });
  return lines.join("\n");
}

const SUGGESTED_PROMPT = "請照附檔開頭的說明，幫我標記附檔裡的對話，最後只輸出 outline.ai.json（放在一個 json 程式碼區塊裡）。";

// ── 讀進來、檢查 ──

// AI 回的文字可能夾在 ```json 裡，或前後有說明文字
function parseAiText(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fenced ? fenced[1] : text;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("找不到 JSON 內容");
  body = body.slice(a, b + 1);
  try { return JSON.parse(body); } catch (e) { throw new Error("JSON 格式不正確：" + e.message); }
}

// 訊息編號：接受 message_id，也接受顯示編號（"013" 或 13）
function aiRef(ref) {
  if (typeof ref === "number" && ref >= 1 && ref <= msgs.length) return ref - 1;
  if (typeof ref !== "string") return -1;
  const r = ref.trim();
  const k = msgs.findIndex((m) => m.id === r);
  if (k >= 0) return k;
  if (/^\d{1,6}$/.test(r)) { const n = Number(r); return n >= 1 && n <= msgs.length ? n - 1 : -1; }
  return -1;
}

// 檢查 AI 給的建議，整理成之後套用要用的樣子
function checkSuggestion(d) {
  const rep = { errors: [], warnings: [], unknown: [], missing: [], stale: false, noFingerprint: false, plan: null };
  if (!d || typeof d !== "object" || Array.isArray(d)) { rep.errors.push("內容不是一個 JSON 物件"); return rep; }
  if (d.format && d.format !== AI_FORMAT) rep.warnings.push("format 欄位不是 " + AI_FORMAT + "，照內容盡量讀");
  const mode = d.mode === "multi_topic" ? "multi" : d.mode === "single_topic" ? "flow" : null;
  if (!mode) { rep.errors.push("mode 要是 multi_topic 或 single_topic"); return rep; }
  if (!d.source_fingerprint) rep.noFingerprint = true;
  else if (d.source_fingerprint !== sourceFingerprint()) rep.stale = true;
  if (d.message_count !== undefined && Number(d.message_count) !== msgs.length) rep.stale = true;

  const ref = (x) => { const i = aiRef(x); if (i < 0 && x !== undefined && x !== null) rep.unknown.push(String(x)); return i; };
  // 主題：spans → 每一則屬於哪個主題（後面的蓋過前面的）
  const readTopics = (list, label) => {
    const out = [];
    const used = new Set();
    (Array.isArray(list) ? list : []).forEach((t, k) => {
      if (!t || typeof t !== "object") return;
      let id = typeof t.id === "string" && /^[A-Z]$/.test(t.id.trim()) && !used.has(t.id.trim()) ? t.id.trim() : null;
      if (!id) id = TOPIC_IDS.find((x) => !used.has(x));
      if (!id) return;
      used.add(id);
      const spans = [];
      const rawSpans = Array.isArray(t.spans) ? t.spans : (t.from !== undefined ? [{ from: t.from, to: t.to }] : []);
      rawSpans.forEach((sp) => {
        if (!sp) return;
        let a = ref(sp.from), b = ref(sp.to === undefined ? sp.from : sp.to);
        if (a < 0 || b < 0) return;
        if (a > b) [a, b] = [b, a];
        spans.push([a, b]);
      });
      // 也接受直接列 messages
      (Array.isArray(t.messages) ? t.messages : []).forEach((mid) => { const i = ref(mid); if (i >= 0) spans.push([i, i]); });
      if (!spans.length) rep.warnings.push((label || "") + "主題「" + (t.name || id) + "」沒有可以對上的 spans，略過");
      else out.push({ id, name: String(t.name || "主題 " + id).trim(), note: String(t.note || "").trim(), spans });
    });
    const at = new Array(msgs.length).fill(null);
    out.forEach((t) => t.spans.forEach(([a, b]) => { for (let i = a; i <= b; i++) at[i] = t.id; }));
    return { topics: out, at };
  };
  const main = readTopics(d.topics);
  if (mode === "multi") {
    if (!main.topics.length) rep.errors.push("multi_topic 但沒有任何可用的主題");
    else rep.missing = msgs.map((_, i) => i).filter((i) => isAnchor(i) && !main.at[i]);
  }
  const turns = [];
  (Array.isArray(d.turns) ? d.turns : []).forEach((t) => {
    let i = ref(t && t.message_id);
    if (i < 0) return;
    if (msgs[i].speaker === "assistant") i = anchorOf[i];   // 轉向標在使用者的那一則
    if (!turns.some((x) => x.i === i)) turns.push({ i, reason: String((t && t.reason) || "") });
  });
  const keys = [];
  (Array.isArray(d.key_points) ? d.key_points : []).forEach((k) => {
    const i = ref(k && k.message_id);
    if (i >= 0 && !keys.some((x) => x.i === i)) keys.push({ i, reason: String((k && k.reason) || "") });
  });
  const kranges = [];
  (Array.isArray(d.key_ranges) ? d.key_ranges : []).forEach((r) => {
    if (!r) return;
    let a = ref(r.from), b = ref(r.to === undefined ? r.from : r.to);
    if (a < 0 || b < 0) return;
    if (a > b) [a, b] = [b, a];
    kranges.push({ a, b, reason: String(r.reason || "") });
  });
  const uncertain = [];
  (Array.isArray(d.uncertain) ? d.uncertain : []).forEach((u) => {
    const i = ref(u && u.message_id);
    if (u && (u.question || u.reason)) uncertain.push({ i, question: String(u.question || u.reason) });
  });
  const alternatives = [];
  (Array.isArray(d.alternatives) ? d.alternatives : []).forEach((alt, k) => {
    if (!alt || !Array.isArray(alt.topics)) return;
    const r = readTopics(alt.topics, "另一種分法裡的");
    if (r.topics.length) alternatives.push({ label: String(alt.label || "另一種分法 " + (k + 1)), topics: r.topics, at: r.at });
  });
  const single = d.single_topic && typeof d.single_topic === "object"
    ? { name: String(d.single_topic.name || ""), note: String(d.single_topic.note || "") } : null;
  rep.unknown = Array.from(new Set(rep.unknown));
  rep.plan = { mode, topics: main.topics, at: main.at, turns, keys, ranges: kranges, uncertain, alternatives, single,
    generated_at: d.generated_at || null, generated_by: d.generated_by || null };
  return rep;
}

// 有問題時，給 AI 的補正指令
function fixInstructions(rep) {
  const items = [];
  if (rep.missing.length) items.push("這些我的訊息沒有被任何主題的 spans 涵蓋，請放進適合的主題：" + rep.missing.map((i) => msgs[i].id).join("、"));
  if (rep.unknown.length) items.push("這些編號在原文裡找不到，請改成正確的 message_id：" + rep.unknown.join("、"));
  if (rep.noFingerprint) items.push("缺少 source_fingerprint，請照抄：" + sourceFingerprint());
  if (rep.errors.length) items.push("格式問題：" + rep.errors.join("；"));
  if (!items.length) return "";
  return ["你給的 outline.ai.json 有幾個地方要修正。請只改這些，其他保持原樣，" +
    (AI.from === "repo" ? "然後覆寫同一個檔案（" + ctx.folder + AI_FILE + "）。" : "然後重新給我完整的 outline.ai.json。"), ""]
    .concat(items.map((x) => "- " + x)).join("\n");
}

// ── 套用 ──

// 使用者目前有沒有自己的標記
function hasUserMarks() {
  return Object.keys(S.tags).length || Object.keys(S.keys).length || S.keyRanges.length || Object.keys(S.turnsConfirmed).length;
}

// 這一版 AI 建議的精簡紀錄：之後 AI 重標時，用來標出跟這版哪裡不同
function snapshotOf(plan) {
  const name = (id) => { const t = plan.topics.find((x) => x.id === id); return t ? t.name : null; };
  const topicOf = {};
  msgs.forEach((m, i) => { if (isAnchor(i) && plan.at[i]) topicOf[m.id] = name(plan.at[i]); });
  return {
    mode: plan.mode === "multi" ? "multi_topic" : "single_topic",
    topic_of: topicOf,
    key_points: plan.keys.map((k) => msgs[k.i].id),
    key_ranges: plan.ranges.map((r) => [msgs[r.a].id, msgs[r.b].id]),
    turns: plan.turns.map((t) => msgs[t.i].id)
  };
}

function diffSnapshots(prev, next) {
  const out = [];
  const num = (id) => { const i = msgs.findIndex((m) => m.id === id); return i < 0 ? id : pad(i); };
  const ids = new Set(Object.keys(prev.topic_of || {}).concat(Object.keys(next.topic_of || {})));
  const changedTopics = [];
  ids.forEach((id) => { if ((prev.topic_of || {})[id] !== (next.topic_of || {})[id]) changedTopics.push(id); });
  if (changedTopics.length) {
    out.push("主題不同：" + changedTopics.slice(0, 12).map((id) => num(id) + "（" + ((prev.topic_of || {})[id] || "沒標") + " → " +
      ((next.topic_of || {})[id] || "沒標") + "）").join("、") + (changedTopics.length > 12 ? " 等 " + changedTopics.length + " 則" : ""));
  }
  const setDiff = (a, b) => ({ add: b.filter((x) => !a.includes(x)), del: a.filter((x) => !b.includes(x)) });
  [["key_points", "關鍵"], ["turns", "轉向"]].forEach(([k, label]) => {
    const d = setDiff(prev[k] || [], next[k] || []);
    if (d.add.length) out.push("新增" + label + "：" + d.add.map(num).join("、"));
    if (d.del.length) out.push("拿掉" + label + "：" + d.del.map(num).join("、"));
  });
  const rs = (x) => (x || []).map((r) => r.join("~"));
  const d = setDiff(rs(prev.key_ranges), rs(next.key_ranges));
  if (d.add.length || d.del.length) out.push("關鍵段落有變：" + d.add.concat(d.del).length + " 處");
  if (prev.mode !== next.mode) out.push("整理方式從 " + prev.mode + " 變成 " + next.mode);
  return out;
}

// how："replace"（整份換成 AI 建議）、"fill"（只補我還沒標的地方）、
//      "replace-topics"（改用 AI 另外提的分法 useAlt：只換主題，關鍵、轉向保持）
function applySuggestion(how, useAlt) {
  const rep = AI.report;
  const plan = rep.plan;
  const topicsSrc = useAlt ? useAlt.topics : plan.topics;
  const atSrc = useAlt ? useAlt.at : plan.at;
  const replace = how === "replace";
  const replaceTopics = replace || how === "replace-topics";
  if (how === "replace-topics") {
    Object.keys(S.tags).forEach((k) => touchAi("tags", k, "changed", S.tags[k] || null));
    S.tags = {}; S.origin.tags = {}; S.origin.names = {}; S.also = {};
  }
  if (replace) {
    S.tags = {}; S.keys = {}; S.keyRanges = []; S.turnsConfirmed = {}; S.also = {};
    S.origin = { tags: {}, names: {}, keys: {}, ranges: {}, turns: {} };
    S.aiReasons = { keys: {}, ranges: {}, turns: {} };
  }
  if (!S.mode || replace) S.mode = plan.mode;

  // 主題：取代時直接用 AI 的；補空白時同名的併到既有主題，其他另開新主題
  const map = {};
  if (S.mode === "multi") {
    if (replaceTopics || !Object.keys(S.tags).length) {
      S.topics = topicsSrc.map((t) => ({ id: t.id, name: t.name, note: t.note }));
      S.origin.names = {};
      topicsSrc.forEach((t) => { map[t.id] = t.id; S.origin.names[t.id] = "ai"; });
    } else {
      topicsSrc.forEach((t) => {
        const same = S.topics.find((x) => x.name.trim().toLowerCase() === t.name.toLowerCase());
        if (same) { map[t.id] = same.id; return; }
        const id = nextTopicId();
        if (!id) return;
        S.topics.push({ id, name: t.name, note: t.note });
        S.origin.names[id] = "ai";
        map[t.id] = id;
      });
    }
    // 錨點照 AI 的主題；AI 回覆和它的錨點不同主題時，另外分類
    msgs.forEach((m, i) => {
      if (!isAnchor(i) || !atSrc[i] || !map[atSrc[i]]) return;
      if (!replaceTopics && has(S.tags, m.id)) return;
      S.tags[m.id] = map[atSrc[i]];
      S.origin.tags[m.id] = "ai";
    });
    msgs.forEach((m, i) => {
      if (isAnchor(i)) return;
      const mine = atSrc[i] ? map[atSrc[i]] : null;
      const anchorTopic = atSrc[anchorOf[i]] ? map[atSrc[anchorOf[i]]] : null;
      if (mine === anchorTopic || (!replaceTopics && has(S.tags, m.id))) return;
      S.tags[m.id] = mine || "";
      S.origin.tags[m.id] = "ai";
    });
    // 補空白時為了 AI 主題新開的，如果最後沒有任何一則分到，就不要留著
    if (!replaceTopics) {
      const created = Object.keys(S.origin.names).filter((id) => S.origin.names[id] === "ai" && Object.values(map).includes(id));
      created.forEach((id) => {
        if (msgs.some((_, i) => tagOf(i) === id)) return;
        S.topics = S.topics.filter((t) => t.id !== id);
        delete S.origin.names[id];
      });
    }
  }
  if (plan.mode === "flow" && plan.single && (replace || !S.single.name || S.single.name === ctx.title)) {
    S.single = { name: plan.single.name || S.single.name, note: plan.single.note || S.single.note };
  }
  if (!useAlt) {
    plan.keys.forEach((k) => {
      const id = msgs[k.i].id;
      if (S.keys[id]) return;
      S.keys[id] = true; S.origin.keys[id] = "ai";
      if (k.reason) S.aiReasons.keys[id] = k.reason;
    });
    const existing = rangeIdx();
    plan.ranges.forEach((r) => {
      if (existing.some(([a, b]) => r.a <= b && r.b >= a)) return;   // 和既有段落重疊就不加
      const id = msgs[r.a].id;
      S.keyRanges.push({ from: id, to: msgs[r.b].id }); S.origin.ranges[id] = "ai";
      if (r.reason) S.aiReasons.ranges[id] = r.reason;
      existing.push([r.a, r.b]);
    });
    plan.turns.forEach((t) => {
      const id = msgs[t.i].id;
      if (S.turnsConfirmed[id] || (!replace && S.turnsDismissed[id])) return;   // 使用者說過「不是轉向」的不加
      S.turnsConfirmed[id] = true; S.origin.turns[id] = "ai";
      if (t.reason) S.aiReasons.turns[id] = t.reason;
    });
  }
  S.aiSuggestion = {
    file: AI_FILE,
    content_fingerprint: fingerprint({ speaker: "ai-file", content: AI.raw }),
    generated_at: plan.generated_at,
    generated_by: plan.generated_by,
    source_matched: !rep.stale && !rep.noFingerprint,
    applied_at: new Date().toISOString(),
    applied_how: how,
    alternative: useAlt ? useAlt.label : null,
    snapshot: snapshotOf(plan)
  };
  UI.sel.clear(); UI.picker = null;
  changed(true);
  showMain();
  renderAiPanel();
  showStatus("已套用 AI 建議。沒動的會當作你同意；改掉或刪掉的會記成你否決了這個建議。");
}

function confirmAllAi() {
  Object.keys(S.origin).forEach((kind) => Object.keys(S.origin[kind]).forEach((k) => {
    if (S.origin[kind][k] === "ai") S.origin[kind][k] = "ai_confirmed";
  }));
  changed(true);
  renderAiPanel();
}

// ── 讀取 ──

async function loadAiFromRepo(quiet) {
  if (!ctx || ctx.kind !== "repo") return;
  try {
    const raw = await readRawFile(config, branch, ctx.folder + AI_FILE);
    if (raw === null) { if (!quiet) showStatus("倉庫裡還沒有 " + AI_FILE + "。AI 寫好之後再按一次。", false, true); takeAi(null); return; }
    takeAi(raw, "repo");
    if (!quiet) showStatus("已讀取最新的 AI 建議");
  } catch (e) {
    if (!quiet) showStatus("讀不到 AI 建議：" + e.message, true, true);
  }
}

function takeAi(raw, from) {
  if (raw === null) { AI.raw = null; AI.data = null; AI.report = null; renderAiPanel(); return; }
  AI.raw = raw; AI.from = from;
  try { AI.data = parseAiText(raw); AI.report = checkSuggestion(AI.data); }
  catch (e) { AI.data = null; AI.report = { errors: [e.message], warnings: [], unknown: [], missing: [], plan: null }; }
  renderAiPanel(AI.report && AI.report.plan ? !S.aiSuggestion || S.aiSuggestion.content_fingerprint !== fingerprint({ speaker: "ai-file", content: raw }) : true);
}

// ── 畫面 ──

function renderAiPanel(open) {
  const panel = $("ai-panel");
  if (!ctx) return;
  panel.hidden = false;
  $("ai-way-b").hidden = ctx.kind !== "repo";
  $("ai-prompt-a").textContent = SUGGESTED_PROMPT;
  const box = $("ai-current");
  box.textContent = "";
  const status = $("ai-status");
  const applied = S.aiSuggestion;
  const curFp = AI.raw ? fingerprint({ speaker: "ai-file", content: AI.raw }) : null;
  const isNew = AI.raw && (!applied || applied.content_fingerprint !== curFp);

  // 已經套用過的 AI 建議：還沒動的有多少
  if (applied) {
    const p = aiPendingCounts();
    const rejected = S.aiRejected.length;
    const line = el("div", { class: "ai-line" },
      el("strong", { text: "已套用的 AI 建議" }),
      " " + [applied.generated_by, applied.generated_at ? new Date(applied.generated_at).toLocaleString() : ""].filter(Boolean).join(" · "),
      el("br"),
      p.total ? "你還沒動的：" + p.parts.join("、") + "（儲存時當作你同意）" : "AI 建議都處理過了",
      rejected ? "；你否決了 " + rejected + " 項" : "");
    box.append(line);
    if (p.total) {
      const all = el("button", { class: "secondary small", text: "全部確認" });
      all.addEventListener("click", confirmAllAi);
      box.append(el("div", { class: "row" }, all, el("span", { class: "hint", text: "按了等於逐項按「✓」：記成你確認過，不只是沒反駁。" })));
    }
  }

  if (!AI.raw) {
    status.textContent = applied ? "已套用" : "還沒有 AI 建議";
  } else {
    const rep = AI.report;
    const plan = rep && rep.plan;
    status.textContent = isNew ? (applied ? "有新的 AI 建議" : "有 AI 建議，還沒套用") : "已套用最新的 AI 建議";
    if (isNew) {
      box.append(el("div", { class: "ai-line" }, el("strong", { text: applied ? "有新的 AI 建議" : "AI 建議" }),
        " " + [plan && plan.generated_by, plan && plan.generated_at ? new Date(plan.generated_at).toLocaleString() : "",
          AI.from === "repo" ? "來自倉庫的 " + AI_FILE : "匯入的檔案"].filter(Boolean).join(" · ")));
      if (plan) {
        const c = plan;
        box.append(el("p", { class: "hint", text: (c.mode === "multi" ? "聊了好幾件事，" + c.topics.length + " 個主題（" + c.topics.map((t) => t.id + " " + t.name).join("、") + "）" : "一直在聊同一件事") +
          "；轉向 " + c.turns.length + " 處、關鍵 " + c.keys.length + " 則、關鍵段落 " + c.ranges.length + " 段" +
          (c.uncertain.length ? "、不確定 " + c.uncertain.length + " 處" : "") + (c.alternatives.length ? "、另外 " + c.alternatives.length + " 種分法" : "") }));
      }
      // 和上次套用的那版差在哪
      if (applied && applied.snapshot && plan) {
        const d = diffSnapshots(applied.snapshot, snapshotOf(plan));
        box.append(el("div", { class: "ai-diff" }, el("strong", { text: "和你之前處理的那版 AI 建議比：" }),
          d.length ? el("ul", null, d.map((x) => el("li", { text: x }))) : " 沒有差別"));
      }
      // 檢查結果
      const probs = [];
      (rep.errors || []).forEach((x) => probs.push(["error", x]));
      if (rep.stale) probs.push(["error", "AI 看的原文和現在的不一樣（原文指紋或訊息數對不上）。可能是對話之後重新擷取過，編號可能對不上。"]);
      if (rep.noFingerprint) probs.push(["warn", "AI 沒有附上原文指紋，無法確認它看的是不是同一版。"]);
      if (rep.missing && rep.missing.length) probs.push(["warn", "你有 " + rep.missing.length + " 則訊息 AI 沒分到主題：" + rep.missing.map(pad).join("、") + "（套用後會是「還沒標」）"]);
      if (rep.unknown && rep.unknown.length) probs.push(["warn", "AI 用了原文裡沒有的編號，已略過：" + rep.unknown.slice(0, 10).join("、") + (rep.unknown.length > 10 ? "…" : "")]);
      (rep.warnings || []).forEach((x) => probs.push(["warn", x]));
      if (probs.length) box.append(el("ul", { class: "ai-probs" }, probs.map(([k, x]) => el("li", { class: k, text: x }))));
      const fix = fixInstructions(rep);
      if (fix) {
        const b = el("button", { class: "secondary small", text: "複製給 AI 的修正指令" });
        b.addEventListener("click", () => copyText(fix, "已複製修正指令，貼給同一個 AI。"));
        box.append(el("div", { class: "row" }, b));
      }
      // 套用
      if (plan && !(rep.errors || []).length) {
        const row = el("div", { class: "row wrap-row" });
        const go = (how, label, cls) => {
          const b = el("button", { class: cls || "", text: label });
          b.addEventListener("click", () => applySuggestion(how));
          row.append(b);
        };
        if (rep.stale) {
          go(hasUserMarks() ? "fill" : "replace", "仍然套用（原文可能不同，請仔細檢查）", "secondary");
        } else if (hasUserMarks()) {
          go("fill", "只補我還沒標的地方");
          go("replace", "整份換成 AI 建議", "secondary");
        } else {
          go("replace", "套用 AI 建議");
        }
        box.append(row);
      }
    }
    // 另一種分法、不確定的地方（套用後也看得到）
    const plan2 = AI.report && AI.report.plan;
    if (plan2 && plan2.alternatives.length && S.mode === "multi") {
      const row = el("div", { class: "row wrap-row" }, el("span", { class: "hint", text: "AI 另外提的分法：" }));
      plan2.alternatives.forEach((alt) => {
        const b = el("button", { class: "secondary small", text: alt.label + "（" + alt.topics.map((t) => t.name).join("／") + "）" });
        b.addEventListener("click", () => applySuggestion("replace-topics", alt));
        row.append(b);
      });
      box.append(row);
    }
    if (plan2 && plan2.uncertain.length) {
      box.append(el("div", { class: "ai-line" }, el("strong", { text: "AI 拿不定主意的地方" })));
      const ul = el("ul", { class: "ai-uncertain" });
      plan2.uncertain.forEach((u) => {
        const li = el("li");
        if (u.i >= 0) {
          const b = el("button", { class: "link-btn", text: pad(u.i) });
          b.addEventListener("click", () => jumpTo(u.i));
          li.append(b, " ");
        }
        li.append(u.question);
        ul.append(li);
      });
      box.append(ul);
    }
  }
  // 還在預覽、還沒選整理方式時不自動打開：預覽頁上方已經有一行說 AI 怎麼看
  if (open && S.mode) panel.open = true;
  previewAiLine();
}

// 預覽頁：倉庫裡已經有 AI 建議的話，先告訴使用者 AI 怎麼看這段對話，選整理方式時可以參考
function previewAiLine() {
  const p = $("preview-ai");
  if (!p) return;
  const plan = AI.report && AI.report.plan;
  p.textContent = "";
  p.hidden = !plan || !!S.mode;
  if (p.hidden) return;
  const view = el("button", { class: "secondary small", text: "看 AI 建議" });
  view.addEventListener("click", () => { $("ai-panel").open = true; $("ai-panel").scrollIntoView({ block: "start", behavior: "smooth" }); });
  p.append("AI 先看過了，它認為" + (plan.mode === "multi"
    ? "聊了好幾件事，分成 " + plan.topics.length + " 個主題（" + plan.topics.map((t) => t.id + " " + t.name).join("、") + "）"
    : "一直在聊同一件事") + "。可以參考，不一定要照它選。 ", view);
}

function jumpTo(i) {
  const go = () => {
    const n = document.querySelector('.msg[data-mid="' + CSS.escape(msgs[i].id) + '"]');
    if (n) { n.scrollIntoView({ block: "center", behavior: "smooth" }); n.classList.add("flash"); setTimeout(() => n.classList.remove("flash"), 1600); }
  };
  if (UI.filter !== "all") { UI.filter = "all"; render(); }
  go();
}

async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); showStatus(done); }
  catch (e) { showStatus("無法複製：" + e.message, true, true); }
}

function downloadText(name, text, type) {
  const a = el("a", { href: URL.createObjectURL(new Blob([text], { type: type || "text/markdown" })), download: name });
  document.body.append(a); a.click(); a.remove();
}

function slug() {
  return String(ctx.folder || ctx.title || "conversation").replace(/\/$/, "").split("/").pop().replace(/[^\w.-]+/g, "-").slice(0, 60) || "conversation";
}

// ── 事件 ──

$("ai-copy-b").addEventListener("click", async () => {
  // 先複製（剪貼簿要在按下的當下寫），再確認倉庫裡有完整指引
  await copyText(instructionsForRepo(), "已複製。貼給能讀寫 GitHub 的 AI，它寫好後按「AI 寫好了，重新讀取」。");
  try {
    if (await ensureOutlineAiGuide()) showStatus("已複製指令，並把完整說明寫進倉庫的 " + OUTLINE_AI_GUIDE_PATH + "。貼給 AI 就可以了。");
  } catch (e) {
    showStatus("已複製指令，但倉庫裡的 " + OUTLINE_AI_GUIDE_PATH + " 寫不進去：" + e.message + "。AI 可能讀不到完整說明，可以改用下載檔案的做法。", true, true);
  }
});
$("ai-reload").addEventListener("click", () => loadAiFromRepo(false));
$("ai-download").addEventListener("click", async () => {
  downloadText("at-outline-request-" + slug() + ".md", await requestFileContent());
  showStatus("已下載。把檔案和下面那句話一起丟給 AI，再把它給的 outline.ai.json 匯入。");
});
$("ai-copy-a").addEventListener("click", () => copyText(SUGGESTED_PROMPT, "已複製建議的提示詞"));
$("ai-file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) takeAi(await f.text(), "file");
  e.target.value = "";
});
$("ai-paste-go").addEventListener("click", () => {
  const t = $("ai-paste").value.trim();
  if (t) takeAi(t, "paste");
});
