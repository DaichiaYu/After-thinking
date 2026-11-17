// After-thinking Capture — 擷取過的對話清單（標記頁沒有指定資料夾時顯示）（v0.8.0）
// - 排序：對話時間、擷取時間、最後標記時間、標籤順序，並依日期（或標籤）分組
// - 預覽：每段對話列出你問過的問題（開頭幾個和最後幾個），可以展開看全部
// - 處理狀態（未處理／已整理／不用整理）、自訂標籤、備註：存在 inbox/labels.json
// - 打開原對話

const LIST_Q_SHOW = 50;   // 清單裡的問題超過這個字數先收起來
const SORTS = {
  conv: { label: T("list.conversation_time"), key: (r) => r.started_at || r.captured_at, group: "month" },
  capture: { label: T("list.capture_time"), key: (r) => r.captured_at, group: "day" },
  tagged: { label: T("list.last_tagged"), key: (r) => r.outline_updated_at, group: "day", none: T("list.not_tagged_yet") },
  labels: { label: T("list.label_order"), key: (r) => r.captured_at, group: "label" }
};
const STATUS_FILTERS = [["all", T("tag.all")], ["todo", T("list.to_do")], ["done", T("list.done")], ["skip", T("list.skip")], ["untagged", T("list.not_tagged_yet")]];

const L = {
  items: [],
  pref: { sort: "conv", status: "all", labels: [] },
  q: "",
  open: {},        // folder → 展開了狀態與標籤編輯
  allQs: {},       // folder → 讀原文得到的全部問題 [{ i, text }]，或 "loading" / Error
  showAll: {},     // folder → 顯示全部問題
  qExp: {}         // folder + ":" + i → 這個問題展開了
};

const PLATFORM_NAME = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", grok: "Grok" };
const padN = (i, total) => String(i + 1).padStart(Math.max(3, String(total || 0).length), "0");
const WEEK = T("list.weekdays").split("|");
const MONTH = T("list.months").split("|");

function dayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return T("list.no_time");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / 86400000);
  const base = T(d.getFullYear() !== today.getFullYear() ? "list.date_other_year" : "list.date_this_year", MONTH[d.getMonth()], d.getDate(), WEEK[d.getDay()], d.getFullYear());
  return diff === 0 ? T("list.today", base) : diff === 1 ? T("list.yesterday", base) : base;
}
function monthLabel(iso) {
  const d = new Date(iso);
  return isNaN(d) ? T("list.no_time") : T("list.date_year_month", d.getFullYear(), MONTH[d.getMonth()]);
}

function loadPref() {
  try { Object.assign(L.pref, JSON.parse(localStorage.getItem("listPref") || "{}")); } catch (e) { /* 用預設 */ }
  if (!SORTS[L.pref.sort]) L.pref.sort = "conv";
  if (!Array.isArray(L.pref.labels)) L.pref.labels = [];
}
function savePref() { try { localStorage.setItem("listPref", JSON.stringify(L.pref)); } catch (e) { /* 記不住也沒關係 */ } }

async function showPicker() {
  $("picker").hidden = false;
  $("crumb").textContent = T("list.library");
  $("title").textContent = T("list.library");
  $("meta").textContent = T("list.pick_a_conversation_to_preview_it");
  $("origin-line").hidden = true;
  $("top-actions").hidden = true;
  $("file").addEventListener("change", async (e) => {
    $("error").hidden = true;
    try { await loadFromFiles(e.target.files); } catch (err) { showError(err.message); }
  });
  if (typeof ATLocalFolder!=="undefined" && ATLocalFolder.supported()){
    $("local-folder-actions").hidden=false;
    const choose=async (restore)=>{
      try{
        const handle=restore?await ATLocalFolder.restore():await ATLocalFolder.pick();
        if(handle)await loadFromDirectory(handle);
        $("reopen-local-folder").hidden=false;
      }catch(e){if(e.name!=="AbortError")showError(e.message)}
    };
    $("choose-local-folder").addEventListener("click",()=>choose(false));
    $("reopen-local-folder").addEventListener("click",()=>choose(true));
    ATLocalFolder.getStored().then(handle=>{$("reopen-local-folder").hidden=!handle}).catch(()=>{});
  }
  if (!config || !config.repo || !config.token) {
    $("repo-line").textContent = T("list.github_is_not_set_up_yet");
    return;
  }
  $("repo-line").textContent = T("list.loading_capture_records_from", config.repo);
  try {
    const check = await checkRepo(config);
    if (!check.ok) throw new Error(check.message);
    branch = check.branch;
    const [rows, labels] = await Promise.all([readCaptureIndex(config, branch), readLabels(config, branch)]);
    labelStore = makeLabelsStore(config, branch, labels);
    labelStore.onState = (text, bad) => {
      const s = $("labels-state");
      s.textContent = text === T("list.saved") ? T("list.status_and_labels_saved") : text;
      s.classList.toggle("bad", !!bad);
    };
    const byFolder = new Map();
    rows.forEach((r) => { if (r && r.folder) byFolder.set(r.folder, Object.assign({}, byFolder.get(r.folder), r)); });
    L.items = Array.from(byFolder.values());
    loadPref();
    $("list-tools").hidden = false;
    $("label-manager").hidden = false;
    setupListTools();
    renderListPage();
  } catch (e) {
    $("repo-line").textContent = T("list.could_not_read_the_repository", e.message);
  }
}

function setupListTools() {
  const sort = $("sort");
  sort.textContent = "";
  Object.entries(SORTS).forEach(([k, s]) => sort.append(el("option", { value: k, text: s.label })));
  sort.value = L.pref.sort;
  sort.addEventListener("change", () => { L.pref.sort = sort.value; savePref(); renderListPage(); });
  let t = null;
  $("search").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { L.q = e.target.value.trim().toLowerCase(); renderListPage(); }, 150); });
}

function statusOf(r) { return labelStore.get(r.folder).status; }

function matches(r) {
  const st = labelStore.get(r.folder);
  const f = L.pref.status;
  if (f === "untagged" ? !!r.outline_updated_at : f !== "all" && st.status !== f) return false;
  if (L.pref.labels.length) {
    const mine = st.labels || [];
    const want = L.pref.labels;
    if (!want.some((id) => (id === "_none" ? !mine.length : mine.includes(id)))) return false;
  }
  if (L.q) {
    const hay = [r.title, r.folder, st.note, ...(r.preview_questions || []).map((x) => x.text),
      ...(Array.isArray(L.allQs[r.folder]) ? L.allQs[r.folder].map((x) => x.text) : [])].join("\n").toLowerCase();
    if (!hay.includes(L.q)) return false;
  }
  return true;
}

// 照排序方式分組
function groups(items) {
  const s = SORTS[L.pref.sort];
  const out = [];
  if (s.group === "label") {
    const order = labelStore.data.labels;
    const rank = (r) => { const mine = labelStore.get(r.folder).labels || []; const k = order.findIndex((l) => mine.includes(l.id)); return k < 0 ? order.length : k; };
    const byRank = new Map();
    items.forEach((r) => { const k = rank(r); if (!byRank.has(k)) byRank.set(k, []); byRank.get(k).push(r); });
    Array.from(byRank.keys()).sort((a, b) => a - b).forEach((k) => {
      const list = byRank.get(k).sort((a, b) => String(b.captured_at || "").localeCompare(String(a.captured_at || "")));
      const l = order[k];
      out.push({ label: l ? l.name : T("list.no_label"), color: l ? l.color : null, items: list });
    });
    return out;
  }
  const keyed = items.map((r) => ({ r, t: s.key(r) || null }));
  keyed.sort((a, b) => (!a.t && !b.t ? 0 : !a.t ? 1 : !b.t ? -1 : String(b.t).localeCompare(String(a.t))));
  keyed.forEach(({ r, t }) => {
    const label = !t ? (s.none || T("list.no_time")) : s.group === "month" ? monthLabel(t) : dayLabel(t);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(r); else out.push({ label, items: [r] });
  });
  return out;
}

function renderListPage() {
  const all = L.items;
  const tagged = all.filter((r) => r.outline_updated_at).length;
  const skip = all.filter((r) => statusOf(r) === "skip").length;
  const done = all.filter((r) => statusOf(r) === "done").length;
  $("repo-line").textContent = T("list.group_summary", config.repo, all.length, (tagged ? T("list.tagged", tagged) : ""), (done ? T("list.done_2", done) : ""), (skip ? T("list.skipped", skip) : ""));
  renderFilters();
  renderLabelManager();
  renderBackfill();
  const box = $("convos");
  box.textContent = "";
  const shown = all.filter(matches);
  if (!shown.length) {
    box.append(el("p", { class: "empty", text: all.length ? T("list.no_matching_conversations") : T("list.no_captured_conversations_yet") }));
    return;
  }
  groups(shown).forEach((g) => {
    const c = g.color !== null && g.color !== undefined ? LABEL_COLORS[g.color % LABEL_COLORS.length] : null;
    box.append(el("h3", { class: "c-group", style: c ? { borderLeftColor: c.line } : {} },
      g.label, el("span", { class: "hint", text: T("list.group_count", g.items.length) })));
    g.items.forEach((r) => box.append(convRow(r)));
  });
}

function renderFilters() {
  const sb = $("status-filter");
  sb.textContent = "";
  const countFor = (k) => {
    if (k === "all") return L.items.length;
    if (k === "untagged") return L.items.filter((r) => !r.outline_updated_at).length;
    return L.items.filter((r) => statusOf(r) === k).length;
  };
  STATUS_FILTERS.forEach(([k, label]) => {
    const b = el("button", { "aria-pressed": String(L.pref.status === k) },
      el("span", { text: label }),
      el("span", { class: "filter-count", text: String(countFor(k)) }));
    b.addEventListener("click", () => {
      L.pref.status = k;
      savePref();
      renderListPage();
    });
    sb.append(b);
  });
  const lb = $("label-filter");
  lb.textContent = "";
  const labels = labelStore.data.labels;
  L.pref.labels = L.pref.labels.filter((id) => id === "_none" || labels.some((l) => l.id === id));
  if (!labels.length) return;
  lb.append(el("span", { class: "hint filter-label", text: T("list.labels") }));
  labels.concat([{ id: "_none", name: T("list.no_label"), color: null }]).forEach((l) => {
    const on = L.pref.labels.includes(l.id);
    const c = l.color === null ? { bg: "#EEF0F3", fg: "#4A515C", line: "#C9CED6" } : LABEL_COLORS[l.color % LABEL_COLORS.length];
    const b = el("button", { class: "label-chip btn", "aria-pressed": String(on),
      style: { background: on ? c.bg : "#fff", color: c.fg, borderColor: c.line, borderStyle: on ? "solid" : "dashed" },
      text: (on ? "✓ " : "") + l.name });
    b.addEventListener("click", () => {
      L.pref.labels = on ? L.pref.labels.filter((x) => x !== l.id) : L.pref.labels.concat([l.id]);
      savePref();
      renderListPage();
    });
    lb.append(b);
  });
}

// ── 一段對話 ──

function convRow(r) {
  const st = labelStore.get(r.folder);
  const total = r.messages || 0;
  const open = !!L.open[r.folder];
  const row = el("article", {
    class: "crow" + (open ? " is-open" : "") + (st.status === "skip" ? " is-skip" : ""),
    "data-folder": r.folder
  });
  const d = r.started_at || r.captured_at;
  const chips = el("span", { class: "c-chips" },
    r.outline_updated_at ? el("span", { class: "done", text: T("list.tagged_2") }) : null,
    st.status !== "todo" ? el("span", { class: "status-chip s-" + st.status,
      text: STATUS_TEXT[st.status] + (st.status === "skip" && st.skip_reason ? "：" + (SKIP_REASONS[st.skip_reason] || st.skip_reason) : "") }) : null,
    (st.labels || []).map((id) => {
      const l = labelStore.data.labels.find((x) => x.id === id);
      if (!l) return null;
      const c = LABEL_COLORS[l.color % LABEL_COLORS.length];
      return el("span", { class: "label-chip", style: { background: c.bg, color: c.fg, borderColor: c.line }, text: l.name });
    })
  );

  const toggle = () => {
    L.open[r.folder] = !open;
    row.replaceWith(convRow(r));
  };
  const chevron = el("button", {
    class: "c-toggle",
    "aria-label": (open ? T("list.collapse") : T("list.expand")) + (r.title || T("list.this_conversation")),
    "aria-expanded": String(open),
    text: open ? "⌄" : "›"
  });
  chevron.addEventListener("click", toggle);

  const title = el("button", {
    class: "c-title",
    "aria-expanded": String(open),
    text: r.title || r.folder
  });
  title.addEventListener("click", toggle);

  const meta = el("div", { class: "c-meta" },
    [PLATFORM_NAME[r.platform] || r.platform,
      d ? new Date(d).toLocaleDateString() : "",
      total ? T("list.n_messages", total) : "",
      r.author_messages ? T("list.n_questions", r.author_messages) : ""].filter(Boolean).join(" · "));

  const summary = el("div", { class: "c-summary" },
    chevron,
    el("div", { class: "c-main" }, el("div", { class: "c-head" }, title), meta),
    chips
  );
  row.append(summary);

  if (open) {
    const preview = el("section", { class: "c-preview-pane" },
      el("div", { class: "c-pane-head" },
        el("strong", { text: T("list.conversation_preview") }),
        el("span", { class: "hint", text: T("list.your_questions") })),
      questionsBlock(r)
    );

    const actions = el("div", { class: "c-card-actions" },
      el("a", {
        class: "c-start btn-link",
        href: "tag.html?folder=" + encodeURIComponent(r.folder),
        text: T("list.start_tagging")
      })
    );
    const okUrl = r.url && /^https:\/\//.test(r.url);
    if (okUrl) actions.append(el("a", {
      class: "secondary btn-link",
      href: r.url,
      target: "_blank",
      rel: "noopener",
      text: T("list.open_original_conversation")
    }));

    const side = el("aside", { class: "c-side-pane" }, actions, editorBlock(r));
    row.append(el("div", { class: "c-expanded" }, preview, side));
  }
  return row;
}

function qItem(r, q, total) {
  const k = r.folder + ":" + q.i;
  const long = q.text.length > LIST_Q_SHOW;
  const open = !!L.qExp[k];
  const li = el("li", null, el("span", { class: "mono q-num", text: padN(q.i, total) }),
    el("span", { class: "q-text", text: long && !open ? q.text.slice(0, LIST_Q_SHOW) + "…" : q.text }));
  if (long) {
    const b = el("button", { class: "q-more", text: open ? T("tag.collapse") : T("list.expand_2") });
    b.addEventListener("click", () => { L.qExp[k] = !open; rerender(r); });
    li.append(b);
  }
  return li;
}

function rerender(r) {
  const n = document.querySelector('.crow[data-folder="' + CSS.escape(r.folder) + '"]');
  if (n) n.replaceWith(convRow(r));
}

// 你問過的問題：預設開頭幾個和最後兩個；「看全部」時讀原文
function questionsBlock(r) {
  const total = r.messages || 0;
  const nQ = r.author_messages || (r.preview_questions || []).length;
  const box = el("div", { class: "c-qs" });
  const full = L.allQs[r.folder];
  const ol = el("ol");
  if (L.showAll[r.folder] && Array.isArray(full)) {
    full.forEach((q) => ol.append(qItem(r, q, total)));
    ol.classList.add("all");
  } else if (r.preview_questions && r.preview_questions.length) {
    const pq = r.preview_questions;
    const headN = Math.min(PREVIEW_HEAD, pq.length);
    pq.forEach((q, k) => {
      if (k === headN && nQ > pq.length) ol.append(el("li", { class: "q-gap", text: T("list.more_in_between", (nQ - pq.length)) }));
      ol.append(qItem(r, q, total));
    });
  } else {
    box.append(el("span", { class: "hint", text: T("list.this_was_captured_earlier_and_has") }));
  }
  if (ol.childNodes.length) box.append(ol);
  const shownAll = L.showAll[r.folder] && Array.isArray(full);
  const needAll = !r.preview_questions || nQ > (r.preview_questions || []).length;
  if (shownAll || needAll) {
    const label = full === "loading" ? T("att.loading") : full instanceof Error ? T("list.could_not_read_the_source_try", full.message) :
      shownAll ? T("list.show_only_the_beginning_and_end") : T("list.show_all_questions", (nQ || ""));
    const b = el("button", { class: "link-btn q-all", text: label });
    b.disabled = full === "loading";
    b.addEventListener("click", async () => {
      if (shownAll) { L.showAll[r.folder] = false; rerender(r); return; }
      L.showAll[r.folder] = true;
      if (!Array.isArray(L.allQs[r.folder])) await loadAllQuestions(r);
      rerender(r);
    });
    box.append(b);
  }
  return box;
}

async function loadAllQuestions(r) {
  L.allQs[r.folder] = "loading";
  rerender(r);
  try {
    const raw = await readRawFile(config, branch, r.folder + "source/conversation.jsonl");
    if (raw === null) throw new Error(T("list.conversation_jsonl_not_found"));
    const ms = parseJsonl(raw);
    L.allQs[r.folder] = ms.map((m, i) => ({ m, i })).filter((x) => x.m.speaker === "author")
      .map((x) => ({ i: x.i, text: (x.m.content || "").replace(/\s+/g, " ").trim() || T("tag.attachment_only") }));
    if (!r.messages) r.messages = ms.length;
  } catch (e) {
    L.allQs[r.folder] = e;
  }
}

// 狀態、標籤、備註
function editorBlock(r) {
  const st = labelStore.get(r.folder);
  const box = el("div", { class: "c-editor" });
  const seg = el("div", { class: "seg small-seg", role: "group", "aria-label": T("list.status") });
  Object.entries(STATUS_TEXT).forEach(([k, label]) => {
    const b = el("button", { "aria-pressed": String(st.status === k), text: label });
    b.addEventListener("click", () => {
      labelStore.set(r.folder, k === "skip" ? { status: k, skip_reason: st.skip_reason || "chat" } : { status: k });
      rerender(r); renderCounts();
    });
    seg.append(b);
  });
  box.append(el("div", { class: "ed-row" }, el("span", { class: "ed-label", text: T("list.status_2") }), seg));
  if (st.status === "skip") {
    const reasons = el("div", { class: "row wrap-row" });
    Object.entries(SKIP_REASONS).forEach(([k, label]) => {
      const b = el("button", { class: "secondary small", "aria-pressed": String(st.skip_reason === k), text: label });
      b.addEventListener("click", () => { labelStore.set(r.folder, { skip_reason: k }); rerender(r); });
      reasons.append(b);
    });
    const why = el("input", { type: "text", value: st.skip_note || "", placeholder: T("list.details_optional"), "aria-label": T("list.details_for_skip") });
    why.addEventListener("input", () => labelStore.set(r.folder, { skip_note: why.value }));
    reasons.append(why);
    box.append(el("div", { class: "ed-row" }, el("span", { class: "ed-label", text: T("list.reason") }), reasons));
  }
  const labels = labelStore.data.labels;
  const lrow = el("div", { class: "row wrap-row" });
  if (!labels.length) lrow.append(el("span", { class: "hint", text: T("list.no_labels_yet_add_one_under") }));
  labels.forEach((l) => {
    const on = (st.labels || []).includes(l.id);
    const c = LABEL_COLORS[l.color % LABEL_COLORS.length];
    const b = el("button", { class: "label-chip btn", "aria-pressed": String(on),
      style: { background: on ? c.bg : "#fff", color: c.fg, borderColor: c.line, borderStyle: on ? "solid" : "dashed" }, text: (on ? "✓ " : "＋") + l.name });
    b.addEventListener("click", () => {
      const cur = labelStore.get(r.folder).labels || [];
      labelStore.set(r.folder, { labels: on ? cur.filter((x) => x !== l.id) : cur.concat([l.id]) });
      rerender(r); renderLabelManager();
    });
    lrow.append(b);
  });
  box.append(el("div", { class: "ed-row" }, el("span", { class: "ed-label", text: T("list.labels") }), lrow));
  const note = el("input", { type: "text", value: st.note || "", placeholder: T("list.e_g_organized_up_to_stage"), "aria-label": T("list.note_on_this_conversation") });
  note.addEventListener("input", () => labelStore.set(r.folder, { note: note.value }));
  box.append(el("div", { class: "ed-row" }, el("span", { class: "ed-label", text: T("tag.note_2") }), note));
  return box;
}

function renderCounts() {
  const all = L.items;
  const skip = all.filter((r) => statusOf(r) === "skip").length;
  const done = all.filter((r) => statusOf(r) === "done").length;
  const tagged = all.filter((r) => r.outline_updated_at).length;
  $("repo-line").textContent = T("list.group_summary", config.repo, all.length, (tagged ? T("list.tagged", tagged) : ""), (done ? T("list.done_2", done) : ""), (skip ? T("list.skipped", skip) : ""));
  renderFilters();
}

// ── 管理標籤：名稱、顏色、順序（順序就是優先順序） ──

function renderLabelManager() {
  const box = $("label-edit");
  box.textContent = "";
  const labels = labelStore.data.labels.map((l) => Object.assign({}, l));
  const used = (id) => Object.values(labelStore.data.conversations).filter((c) => (c.labels || []).includes(id)).length;
  const commit = () => { labelStore.setLabels(labels); renderListPage(); };
  labels.forEach((l, k) => {
    const c = LABEL_COLORS[l.color % LABEL_COLORS.length];
    const sw = el("button", { class: "swatch", style: { background: c.bg, borderColor: c.line }, title: T("list.change_color"), "aria-label": T("list.change_the_color_of", l.name) });
    sw.addEventListener("click", () => { l.color = (l.color + 1) % LABEL_COLORS.length; commit(); });
    const name = el("input", { type: "text", value: l.name, "aria-label": T("list.label_name") });
    name.addEventListener("change", () => { l.name = name.value.trim() || l.name; commit(); });
    const up = el("button", { class: "icon-btn", "aria-label": T("list.move_up"), text: "↑" });
    up.disabled = k === 0;
    up.addEventListener("click", () => { labels.splice(k - 1, 0, labels.splice(k, 1)[0]); commit(); });
    const down = el("button", { class: "icon-btn", "aria-label": T("list.move_down"), text: "↓" });
    down.disabled = k === labels.length - 1;
    down.addEventListener("click", () => { labels.splice(k + 1, 0, labels.splice(k, 1)[0]); commit(); });
    const del = el("button", { class: "icon-btn", "aria-label": T("list.delete_label", l.name), text: "×" });
    del.addEventListener("click", () => {
      const n = used(l.id);
      if (n && !confirm(T("list.deleting_it_removes_this_label_from", n, l.name))) return;
      labels.splice(k, 1);
      Object.keys(labelStore.data.conversations).forEach((f) => {
        const cur = labelStore.data.conversations[f].labels || [];
        if (cur.includes(l.id)) labelStore.set(f, { labels: cur.filter((x) => x !== l.id) });
      });
      commit();
    });
    box.append(el("div", { class: "lm-row" }, sw, name, el("span", { class: "hint", text: T("list.label_use_count", used(l.id)) }), up, down, del));
  });
  const input = el("input", { type: "text", class: "lm-new", placeholder: T("list.new_label_e_g_do_first"), "aria-label": T("list.new_label_name") });
  const add = el("button", { class: "secondary small", text: T("list.add") });
  const doAdd = () => {
    const nm = input.value.trim();
    if (!nm) return;
    let id;
    do { id = "l" + Math.random().toString(36).slice(2, 7); } while (labels.some((x) => x.id === id));
    labels.push({ id, name: nm, color: labels.length % LABEL_COLORS.length });
    commit();
    setTimeout(() => { const n = document.querySelector("#label-edit input.lm-new"); if (n) n.focus(); }, 0);
  };
  add.addEventListener("click", doAdd);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });
  box.append(el("div", { class: "lm-row" }, input, add));
}

// ── 舊的擷取紀錄沒有問題預覽：讀原文補上，寫回擷取紀錄 ──

function renderBackfill() {
  const box = $("backfill");
  const missing = L.items.filter((r) => !r.preview_questions);
  box.hidden = !missing.length;
  if (!missing.length) return;
  box.textContent = "";
  const b = el("button", { class: "small", text: T("list.add_previews") });
  b.addEventListener("click", () => backfill(missing, b));
  box.append(el("span", { text: T("list.earlier_no_question_preview_yet_adding", missing.length) }), b);
}

async function backfill(missing, btn) {
  btn.disabled = true;
  const got = {};
  let done = 0, failed = 0;
  const queue = missing.slice();
  const work = async () => {
    while (queue.length) {
      const r = queue.shift();
      try {
        const raw = await readRawFile(config, branch, r.folder + "source/conversation.jsonl");
        if (raw === null) throw new Error("missing");
        const items = parseJsonl(raw).map((m) => ({ speaker: m.speaker, content: m.content }));
        got[r.folder] = Object.assign(previewQuestions(items), { author_messages: items.filter((m) => m.speaker === "author").length });
      } catch (e) { failed++; }
      done++;
      btn.textContent = T("list.loading", done, missing.length);
    }
  };
  await Promise.all([work(), work(), work(), work()]);
  btn.textContent = T("list.writing_back_to_capture_records");
  try {
    await commitFiles(config, branch, [], "After-thinking: add question previews to capture log", (rows) =>
      rows.map((r) => (got[r.folder] && !r.preview_questions ? Object.assign({}, r, got[r.folder]) : r)));
    L.items.forEach((r) => { if (got[r.folder]) Object.assign(r, got[r.folder]); });
    showStatus(T("list.added_previews_for", Object.keys(got).length, (failed ? T("list.could_not_be_read", failed) : "")), true, !!failed);
  } catch (e) {
    showStatus(T("list.failed_to_write_back_to_capture", e.message), true, true);
  }
  renderListPage();
}
