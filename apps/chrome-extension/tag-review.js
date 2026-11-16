// After-thinking Capture — 標記頁的檢查工具（v0.8.0）
// 1. 上方的「上一個／下一個」：在待確認的關鍵、轉向之間跳，畫面保留完整前後文，可以直接確認或否決。
// 2. 側邊目錄（收起來的，需要時打開）：一次看到所有關鍵和轉向，點了跳過去。
// 「待確認」只算關鍵、關鍵段落、轉向：AI 建議還沒動的，加上程式提示的可能轉向。
// 主題分配不算進來（AI 標過的話整篇都是，篩了等於沒篩），主題的確認在主題卡和每句的標籤上做。

const KIND_ORDER = { range: 0, key: 1, turn: 2, hint: 3 };
const NAV_KINDS = [["pending", T("review.to_review")], ["key", T("tag.key_3")], ["turn", T("tag.turn")], ["all", T("tag.all")]];

// 所有關鍵、關鍵段落、轉向、可能轉向，照位置排
function reviewItems() {
  const out = [];
  const ranges = rangeIdx();
  msgs.forEach((m, i) => {
    const r = ranges.find(([a]) => a === i);
    if (r) out.push({ i, kind: "range", end: r[1], pending: aiPending("ranges", m.id), origin: originOf("ranges", m.id) });
    if (S.keys[m.id]) out.push({ i, kind: "key", pending: aiPending("keys", m.id), origin: originOf("keys", m.id) });
    if (turnConfirmed(i)) out.push({ i, kind: "turn", pending: aiPending("turns", m.id), origin: originOf("turns", m.id) });
    else if (turnHint(i)) out.push({ i, kind: "hint", pending: true, origin: "hint" });
  });
  return out;
}

const posOf = (it) => it.i * 10 + KIND_ORDER[it.kind];
const sameItem = (a, b) => !!a && !!b && a.i === b.i && a.kind === b.kind;
function itemsOf(kind) {
  const all = reviewItems();
  if (kind === "pending") return all.filter((x) => x.pending);
  if (kind === "key") return all.filter((x) => x.kind === "key" || x.kind === "range");
  if (kind === "turn") return all.filter((x) => x.kind === "turn" || x.kind === "hint");
  return all;
}

function itemLabel(it) {
  if (it.kind === "range") return T("review.key_range", (it.i === it.end ? pad(it.i) : pad(it.i) + "–" + pad(it.end)));
  if (it.kind === "key") return msgs[it.i].speaker === "assistant" ? T("tag.ai_key") : T("tag.your_key");
  if (it.kind === "turn") return T("tag.turn");
  return T("review.possible_turn");
}
function sourceLabel(it) {
  if (it.kind === "hint") return T("review.program_hint", hintReasons(it.i).map((r) => HINT_TEXT[r]).join(T("common.list_sep")));
  if (it.pending) return T("ai.ai_suggestion");
  if (it.origin === "ai_confirmed") return T("tag.ai_suggestion_confirmed_by_you");
  return T("review.tagged_by_you");
}

// 確認／否決：跟每句旁邊的按鈕做的事一樣
function confirmItem(it) {
  const id = msgs[it.i].id;
  if (it.kind === "hint") { S.turnsConfirmed[id] = true; changed(true); return; }
  confirmAi({ range: "ranges", key: "keys", turn: "turns" }[it.kind], id);
}
function rejectItem(it) {
  const id = msgs[it.i].id;
  if (it.kind === "hint") S.turnsDismissed[id] = true;
  else if (it.kind === "key") { touchAi("keys", id, "removed", true); delete S.keys[id]; }
  else if (it.kind === "range") {
    touchAi("ranges", id, "removed", [id, msgs[it.end].id]);
    S.keyRanges = S.keyRanges.filter((r) => r.from !== id);
  } else if (it.kind === "turn") {
    touchAi("turns", id, "removed", true);
    delete S.turnsConfirmed[id];
    if (hintReasons(it.i).length) S.turnsDismissed[id] = true;
  }
  changed(true);
}

// 處理完目前這項，跳到同一種的下一項（處理過的已經不在待確認裡了）
function actAndAdvance(it, fn) {
  const before = posOf(it);
  fn(it);
  const list = itemsOf(UI.navKind);
  const next = list.find((x) => posOf(x) > before) || list[0] || null;
  if (next) goTo(next); else { UI.cursor = null; renderNavbar(); renderDrawer(); showStatus(UI.navKind === "pending" ? T("review.everything_to_review_is_done") : T("review.none_left_in_this_category")); }
}

// 跳到某一項：被篩選藏起來的話先打開，畫面保留前後文
function goTo(it) {
  UI.cursor = { i: it.i, kind: it.kind };
  render();
  const find = () => {
    const nodes = Array.from(document.querySelectorAll('.msg[data-mid="' + CSS.escape(msgs[it.i].id) + '"]'));
    return nodes.find((x) => !x.classList.contains("also-row")) || nodes[0];
  };
  let n = find();
  if (!n && UI.filter !== "all") { UI.filter = "all"; render(); n = find(); }
  if (n) {
    n.scrollIntoView({ block: "center", behavior: "smooth" });
    n.classList.add("flash");
    setTimeout(() => n.classList.remove("flash"), 1400);
  }
}

function step(dir) {
  const list = itemsOf(UI.navKind);
  if (!list.length) return;
  let k;
  if (!UI.cursor) k = dir > 0 ? 0 : list.length - 1;
  else {
    const p = UI.cursor.i * 10 + KIND_ORDER[UI.cursor.kind];
    if (dir > 0) { k = list.findIndex((x) => posOf(x) > p); if (k < 0) k = 0; }
    else { k = -1; list.forEach((x, n) => { if (posOf(x) < p) k = n; }); if (k < 0) k = list.length - 1; }
  }
  goTo(list[k]);
}

function renderNavbar() {
  const bar = $("navbar");
  if (!bar) return;
  bar.textContent = "";
  const counts = {};
  NAV_KINDS.forEach(([k]) => { counts[k] = itemsOf(k).length; });
  const seg = el("div", { class: "seg small-seg", role: "group", "aria-label": T("review.what_to_jump_between") });
  NAV_KINDS.forEach(([k, label]) => {
    const b = el("button", { "aria-pressed": String(UI.navKind === k), text: label + " " + counts[k] });
    b.addEventListener("click", () => { UI.navKind = k; UI.cursor = null; renderNavbar(); renderDrawer(); });
    seg.append(b);
  });
  const up = el("button", { class: "secondary small", "aria-label": T("review.previous"), title: T("review.previous_k"), text: "↑" });
  const down = el("button", { class: "secondary small", "aria-label": T("review.next"), title: T("review.next_j"), text: "↓" });
  up.disabled = down.disabled = !counts[UI.navKind];
  up.addEventListener("click", () => step(-1));
  down.addEventListener("click", () => step(1));
  bar.append(seg, up, down);

  // 目前停在哪一項；待確認的可以直接確認或否決
  const cur = UI.cursor && reviewItems().find((x) => sameItem(x, UI.cursor));
  if (cur) {
    const box = el("span", { class: "nav-cur" },
      el("span", { class: "mono", text: pad(cur.i) }), " " + itemLabel(cur),
      el("span", { class: "nav-src", text: "（" + sourceLabel(cur) + "）" }));
    if (cur.pending) {
      const ok = el("button", { class: "small", text: T("tag.confirm") });
      ok.addEventListener("click", () => actAndAdvance(cur, confirmItem));
      const no = el("button", { class: "secondary small", text: cur.kind === "hint" || cur.kind === "turn" ? T("review.not_a_turn") : T("review.not_a_key") });
      no.addEventListener("click", () => actAndAdvance(cur, rejectItem));
      box.append(ok, no);
    }
    bar.append(box);
  } else {
    bar.append(el("span", { class: "hint nav-cur", text: counts[UI.navKind] ? T("review.press_to_start_from_the_first") :
      UI.navKind === "pending" ? T("review.no_keys_or_turns_to_review") : T("review.none_in_this_category_yet") }));
  }
  const tog = el("button", { class: "secondary small drawer-toggle", "aria-expanded": String(UI.drawer), text: UI.drawer ? T("review.hide_index") : T("review.index") });
  tog.addEventListener("click", () => setDrawer(!UI.drawer));
  bar.append(tog);
}

function setDrawer(open) {
  UI.drawer = open;
  try { localStorage.setItem("tagDrawer", open ? "1" : ""); } catch (e) { /* 記不住也沒關係 */ }
  $("drawer").hidden = !open || !S.mode;
  document.body.classList.toggle("drawer-open", open && !!S.mode);
  renderNavbar();
  renderDrawer();
}

function renderDrawer() {
  const list = $("drawer-list");
  if (!list || !UI.drawer || !S.mode) return;
  const segBox = $("drawer-filters");
  segBox.textContent = "";
  NAV_KINDS.forEach(([k, label]) => {
    const b = el("button", { "aria-pressed": String(UI.drawerKind === k), text: label + " " + itemsOf(k).length });
    b.addEventListener("click", () => { UI.drawerKind = k; renderDrawer(); });
    segBox.append(b);
  });
  list.textContent = "";
  const items = itemsOf(UI.drawerKind);
  if (!items.length) { list.append(el("li", { class: "empty-note", text: UI.drawerKind === "pending" ? T("review.nothing_to_review") : T("review.none_yet") })); return; }
  items.forEach((it) => {
    const m = msgs[it.i];
    const t = S.mode === "multi" ? topicById(tagOf(it.i)) : null;
    const p = pal(t ? t.id : null);
    const snippet = (m.content || "").replace(/\s+/g, " ").trim().slice(0, 34);
    const go = el("button", { class: "d-go" },
      el("span", { class: "d-top" },
        el("span", { class: "mono", text: pad(it.i) }),
        t ? el("span", { class: "d-topic", style: { background: p.bg, color: p.fg }, text: t.id }) : null,
        el("span", { class: "d-kind k-" + it.kind, text: itemLabel(it) }),
        el("span", { class: "d-src" + (it.pending ? " pending" : ""), text: sourceLabel(it) })),
      el("span", { class: "d-snip", text: who(m) + "：" + snippet + (m.content.length > 34 ? "…" : "") }));
    go.addEventListener("click", () => goTo(it));
    const li = el("li", { class: sameItem(it, UI.cursor) ? "current" : "" }, go);
    if (it.pending) {
      const ok = el("button", { class: "ok-btn", "aria-label": T("review.confirm", pad(it.i), itemLabel(it)), title: T("tag.confirm"), text: "✓" });
      ok.addEventListener("click", () => confirmItem(it));
      const no = el("button", { class: "icon-btn", "aria-label": T("review.reject", pad(it.i), itemLabel(it)), title: T("review.no"), text: "×" });
      no.addEventListener("click", () => rejectItem(it));
      li.append(el("span", { class: "d-acts" }, ok, no));
    }
    list.append(li);
  });
}

$("drawer-close").addEventListener("click", () => setDrawer(false));
try { UI.drawer = localStorage.getItem("tagDrawer") === "1"; } catch (e) { /* 預設收起 */ }
document.body.classList.toggle("drawer-open", false);

// J／K：下一個／上一個（在輸入框裡打字時不算）
document.addEventListener("keydown", (e) => {
  if (!S.mode || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  if (e.key === "j" || e.key === "J") { e.preventDefault(); step(1); }
  else if (e.key === "k" || e.key === "K") { e.preventDefault(); step(-1); }
});
