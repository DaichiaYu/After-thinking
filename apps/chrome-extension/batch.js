// After-thinking Capture — 批量擷取 Gemini 對話
// 流程：讀側邊欄清單 → 跳過 inbox/index.jsonl 裡已經抓過的 → 一段段打開、擷取、上傳。
// 每抓完一段就提交一次（含更新後的 index），中途停止或失敗都不會丟掉已完成的部分。

const INBOX = "inbox/";
const INDEX_PATH = INBOX + "index.jsonl";
const GEMINI_HOME = "https://gemini.google.com/app";

const $ = (id) => document.getElementById(id);
let config = null;
let branch = null;
let index = [];            // inbox/index.jsonl 的每一行
let capturedIds = new Set();
let chats = [];            // 側邊欄讀到的對話
let selected = [];
let workerTabId = null;
let workerWindowId = null;
let stopRequested = false;
let lastFailures = [];
let listing = false;

// ── GitHub：讀 index ──

async function readRawFile(path) {
  const res = await fetch("https://api.github.com/repos/" + config.repo + "/contents/" +
    path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch), {
    headers: { Authorization: "Bearer " + config.token, Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store"
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("讀取 " + path + " 失敗（" + res.status + "）");
  return res.text();
}

// 重新擷取同一段對話時，用新的那筆取代舊的
const withoutChat = (rows, id) => rows.filter((r) => !(r.platform === "gemini" && r.conversation_id === id));
const serializeIndex = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

async function commitWithRetry(files, message) {
  const waits = [15000, 60000];
  for (let attempt = 0; ; attempt++) {
    try { return await commitFiles(config, branch, files, message); }
    catch (e) {
      if (attempt >= waits.length) throw e;
      $("current").textContent = "上傳失敗（" + e.message + "），" + waits[attempt] / 1000 + " 秒後重試…";
      await new Promise((r) => setTimeout(r, waits[attempt]));
    }
  }
}

// ── Gemini 工作視窗 ──

function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error("頁面載入逾時")); }, 60000);
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function openInWorker(url) {
  let alive = false;
  if (workerTabId !== null) {
    try { await chrome.tabs.get(workerTabId); alive = true; } catch (e) { alive = false; }
  }
  if (alive) {
    const loaded = waitForLoad(workerTabId);
    await chrome.tabs.update(workerTabId, { url });
    await loaded;
  } else {
    const win = await chrome.windows.create({ url, focused: true, width: 1100, height: 900 });
    workerWindowId = win.id;
    workerTabId = win.tabs[0].id;
    await chrome.tabs.update(workerTabId, { autoDiscardable: false }).catch(() => {});
    const tab = await chrome.tabs.get(workerTabId);
    if (tab.status !== "complete") await waitForLoad(workerTabId);
  }
}

async function inject(func, args) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId: workerTabId }, func, args: args || [] });
  return res ? res.result : null;
}

// ── 步驟 1：倉庫 ──

async function init() {
  // 讓 Chrome 不要為了省記憶體把這一頁收起來
  chrome.tabs.getCurrent((tab) => { if (tab) chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {}); });
  $("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

  config = await loadConfig();
  if (!config || !config.repo || !config.token) {
    $("repo-status").textContent = "還沒設定 GitHub。設定好之後重新整理這一頁。";
    $("repo-status").className = "error";
    $("open-options").hidden = false;
    return;
  }
  try {
    const check = await checkRepo(config);
    if (!check.ok) throw new Error(check.message);
    branch = check.branch;
    const raw = await readRawFile(INDEX_PATH);
    index = raw ? raw.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
    capturedIds = new Set(index.map((r) => r.platform + ":" + r.conversation_id));
    $("repo-status").textContent = config.repo + "（私人倉庫，分支 " + branch + "）｜inbox/ 裡已經有 " + index.length + " 段對話";
    $("list").disabled = false;
  } catch (e) {
    $("repo-status").textContent = "無法使用倉庫：" + e.message;
    $("repo-status").className = "error";
    $("open-options").hidden = false;
  }
}

// ── 步驟 2：清單 ──

function renderChats() {
  const list = $("chats");
  list.textContent = "";
  chats.forEach((chat, i) => {
    const done = capturedIds.has("gemini:" + chat.id);
    const li = document.createElement("li");
    if (done) li.className = "captured";
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selected[i];
    box.addEventListener("change", () => { selected[i] = box.checked; updateSummary(); });
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = chat.title || "（沒有標題）";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = done ? "已擷取" : "";
    label.append(box, title, tag);
    li.appendChild(label);
    list.appendChild(li);
  });
  updateSummary();
}

function updateSummary() {
  const done = chats.filter((c) => capturedIds.has("gemini:" + c.id)).length;
  const picked = selected.filter(Boolean).length;
  $("summary").textContent = "找到 " + chats.length + " 段對話：已擷取 " + done + " 段，這次要抓 " + picked + " 段";
  $("start").disabled = picked === 0;
  $("start").textContent = picked ? "開始擷取 " + picked + " 段" : "開始擷取";
}

function selectNew() {
  selected = chats.map((c) => !capturedIds.has("gemini:" + c.id));
  renderChats();
}

$("select-new").addEventListener("click", selectNew);
$("select-none").addEventListener("click", () => { selected = chats.map(() => false); renderChats(); });

chrome.runtime.onMessage.addListener((msg) => {
  if (listing && msg && msg.type === "list-progress") $("list-status").textContent = "讀取側邊欄中…目前找到 " + msg.count + " 段";
});

$("list").addEventListener("click", async () => {
  $("list").disabled = true;
  $("list-status").className = "muted";
  $("list-status").textContent = "打開 Gemini 中…";
  try {
    await openInWorker(GEMINI_HOME);
    $("list-status").textContent = "讀取側邊欄中…";
    listing = true;
    const res = await inject(listGeminiChats).finally(() => { listing = false; });
    if (!res || !res.chats.length) {
      throw new Error("側邊欄裡找不到對話。請確認 Gemini 已登入、側邊欄有對話紀錄，再試一次。");
    }
    chats = res.chats;
    $("list-status").textContent = "讀完了，用了 " + res.seconds + " 秒。";
    $("list-result").hidden = false;
    selectNew();
  } catch (e) {
    $("list-status").className = "error";
    $("list-status").textContent = "讀取清單失敗：" + e.message;
  }
  $("list").disabled = false;
});

// ── 步驟 3：擷取 ──

async function captureOne(chat) {
  await openInWorker(chat.url);
  const ready = await inject(waitForGeminiConversation, [chat.id]);
  if (!ready || !ready.ok) {
    throw new Error(ready && ready.reason === "redirected" ? "打不開這段對話（可能已刪除）" : "對話內容沒有出現");
  }
  const page = await inject(captureConversation, ["gemini"]);
  if (!page || !page.items || !page.items.length) throw new Error("找不到訊息");
  page.title = chat.title || page.title;
  page.url = chat.url;
  page.api = { tried: false, ok: false, steps: ["api:not_supported"] };

  const folder = INBOX + "gemini-" + chat.id + "/";
  const items = page.items;
  const warnings = [];
  if (page.scroll && page.scroll.timed_out) warnings.push("timed_out");
  if (page.scroll && page.scroll.gaps) warnings.push("possible_gaps");
  if (items.some((i) => i.truncated)) warnings.push("truncated_messages");
  const entry = {
    platform: "gemini",
    conversation_id: chat.id,
    title: chat.title,
    url: chat.url,
    folder,
    messages: items.length,
    author_messages: items.filter((i) => i.speaker === "author").length,
    chars: items.reduce((n, i) => n + i.content.length, 0),
    warnings,
    captured_at: new Date().toISOString(),
    extension_version: VERSION
  };
  await commitWithRetry([
    { path: folder + "source/conversation.jsonl", content: buildJsonl(items) },
    { path: folder + "source/metadata.yaml", content: buildMetadata(items.length, items.length, "gemini", page, "batch") },
    { path: INDEX_PATH, content: serializeIndex(withoutChat(index, chat.id).concat([entry])) }
  ], "After-thinking inbox: gemini " + chat.id + " (" + items.length + " messages)");
  index = withoutChat(index, chat.id).concat([entry]);
  capturedIds.add("gemini:" + chat.id);
  return entry;
}

async function runBatch(queue) {
  stopRequested = false;
  $("start").disabled = true;
  $("list").disabled = true;
  $("stop").disabled = false;
  $("done").hidden = true;
  $("progress").hidden = false;

  const startedAt = Date.now();
  const failures = [];
  let ok = 0;
  const show = (i, current) => {
    const pct = Math.round((i / queue.length) * 100);
    $("bar-fill").style.width = pct + "%";
    const mins = Math.round((Date.now() - startedAt) / 60000);
    $("progress-text").textContent = "第 " + Math.min(i + 1, queue.length) + " / " + queue.length + " 段｜成功 " + ok +
      "｜失敗 " + failures.length + "｜已經過 " + mins + " 分鐘";
    $("current").textContent = current;
  };

  for (let i = 0; i < queue.length; i++) {
    if (stopRequested) break;
    const chat = queue[i];
    show(i, "正在擷取：" + (chat.title || chat.id) + "（長對話要往上載入，可能要一兩分鐘）");
    try {
      await captureOne(chat);
      ok++;
    } catch (e) {
      failures.push({ chat, reason: e.message });
    }
  }
  $("bar-fill").style.width = "100%";
  show(queue.length, "");

  if (workerWindowId !== null) {
    chrome.windows.remove(workerWindowId).catch(() => {});
    workerWindowId = null;
    workerTabId = null;
  }
  lastFailures = failures.map((f) => f.chat);
  const skipped = stopRequested ? queue.length - ok - failures.length : 0;
  $("done-text").textContent = "完成：成功 " + ok + " 段，失敗 " + failures.length + " 段" +
    (skipped ? "，因為按了停止而沒抓 " + skipped + " 段" : "") + "。inbox/ 現在共有 " + index.length + " 段。";
  const list = $("failures");
  list.textContent = "";
  failures.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = (f.chat.title || f.chat.id) + "：" + f.reason;
    list.appendChild(li);
  });
  $("retry").hidden = failures.length === 0;
  $("done").hidden = false;
  $("stop").disabled = true;
  $("list").disabled = false;
  if (chats.length) { selectNew(); }
}

$("start").addEventListener("click", () => runBatch(chats.filter((_, i) => selected[i])));
$("stop").addEventListener("click", () => {
  stopRequested = true;
  $("stop").disabled = true;
  $("current").textContent += "（這段做完就停止）";
});
$("retry").addEventListener("click", () => runBatch(lastFailures));
$("open-inbox").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/" + config.repo + "/tree/" + encodeURIComponent(branch) + "/inbox" });
});

init();
