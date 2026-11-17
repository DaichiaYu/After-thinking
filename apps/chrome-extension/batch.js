// After-thinking Capture — 批量擷取對話（Gemini 側邊欄全部對話，或 ChatGPT 某個專案裡的對話）
// 流程：讀對話清單 → 跳過 inbox/index.jsonl 裡已經抓過的 → 一段段打開、擷取、上傳。
// 每抓完一段就提交一次（含更新後的 index），中途停止或失敗都不會丟掉已完成的部分。

const INBOX = "inbox/";
const GEMINI_HOME = "https://gemini.google.com/app";
const CHATGPT_HOME = "https://chatgpt.com/";
const CHATGPT_ORIGINS = ["https://chatgpt.com/*"];

const $ = (id) => document.getElementById(id);
let config = null;
let branch = null;
let index = [];            // inbox/index.jsonl 的每一行
let capturedIds = new Set();
let chats = [];            // 讀到的對話 { platform, id, title, url, ... }
let source = "gemini";     // 目前選的來源：gemini | chatgpt
let project = null;        // 選中的 ChatGPT 專案 { project_id, name, slug, project_url }
let projects = [];         // 讀到的 ChatGPT 專案清單
let selected = [];
let workerTabId = null;
let workerWindowId = null;
let stopRequested = false;
let lastFailures = [];
let listing = false;
let guideDone = false;     // 這次已經確認過根目錄的 AGENTS.md

// 讀寫 index 的函式在 github.js（readCaptureIndex、upsertCaptureRow）

async function commitWithRetry(files, message, updateIndex) {
  const waits = [15000, 60000];
  for (let attempt = 0; ; attempt++) {
    try { return await commitFiles(config, branch, files, message, updateIndex); }
    catch (e) {
      if (attempt >= waits.length) throw e;
      $("current").textContent = "上傳失敗（" + e.message + "），" + waits[attempt] / 1000 + " 秒後重試…";
      await new Promise((r) => setTimeout(r, waits[attempt]));
    }
  }
}

const chatKey = (chat) => chat.platform + ":" + chat.id;

// ── 工作視窗（Gemini 或 ChatGPT） ──

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

  await ensureGeminiRecorder();
  readStartParams();
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
    index = await readCaptureIndex(config, branch);
    capturedIds = new Set(index.map(captureKey));
    $("repo-status").textContent = config.repo + "（私人倉庫，分支 " + branch + "）｜已經擷取過 " + capturedIds.size + " 段對話";
    $("list").disabled = false;
    $("load-projects").disabled = false;
    $("list-project").disabled = !project;
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
    const done = capturedIds.has(chatKey(chat));
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
    tag.textContent = done ? capturedLabel(chatKey(chat)) : "";
    label.append(box, title, tag);
    li.appendChild(label);
    list.appendChild(li);
  });
  updateSummary();
}

// 例如「已擷取 10/25（批量）」；同一段抓過好幾次時顯示最近一次
function capturedLabel(key) {
  const rows = index.filter((r) => captureKey(r) === key);
  if (!rows.length) return "";
  const last = rows.reduce((a, b) => (a.captured_at > b.captured_at ? a : b));
  const d = new Date(last.captured_at);
  const date = isNaN(d) ? "" : " " + (d.getMonth() + 1) + "/" + d.getDate();
  return "已擷取" + date + "（" + (last.mode === "batch" ? "批量" : "單段") + "）";
}

function updateSummary() {
  const done = chats.filter((c) => capturedIds.has(chatKey(c))).length;
  const picked = selected.filter(Boolean).length;
  $("summary").textContent = "找到 " + chats.length + " 段對話：已擷取 " + done + " 段（灰色，預設不勾），這次要抓 " + picked + " 段";
  $("start").disabled = picked === 0;
  $("start").textContent = picked ? "開始擷取 " + picked + " 段" : "開始擷取";
}

function selectNew() {
  selected = chats.map((c) => !capturedIds.has(chatKey(c)));
  renderChats();
}

$("select-new").addEventListener("click", selectNew);
$("select-none").addEventListener("click", () => { selected = chats.map(() => false); renderChats(); });

chrome.runtime.onMessage.addListener((msg) => {
  if (listing && msg && msg.type === "list-progress") $("list-status").textContent = "讀取清單中…目前找到 " + msg.count + " 段";
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
    chats = res.chats.map((c) => ({ ...c, platform: "gemini" }));
    $("list-status").textContent = "讀完了，用了 " + res.seconds + " 秒。";
    $("list-result").hidden = false;
    selectNew();
  } catch (e) {
    $("list-status").className = "error";
    $("list-status").textContent = "讀取清單失敗：" + e.message;
  }
  $("list").disabled = false;
});

// ── 步驟 2（ChatGPT 專案）：選專案 → 讀專案裡的對話 ──

function setSource(value) {
  source = value === "chatgpt" ? "chatgpt" : "gemini";
  document.querySelectorAll('input[name="source"]').forEach((r) => { r.checked = r.value === source; });
  $("gemini-panel").hidden = source !== "gemini";
  $("chatgpt-panel").hidden = source !== "chatgpt";
}
document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener("change", () => setSource(r.value)));

function projectLabel(p) {
  return p ? (p.name || "（沒有名稱的專案）") + "（" + p.project_id + "）" : "";
}
function showProject() {
  $("project-current").textContent = project ? "專案：" + projectLabel(project) : "還沒選專案。先按「讀取我的 ChatGPT 專案」。";
  $("list-project").disabled = !project || !branch;
}

// 從擴充圖示點「批量擷取這個專案」進來時，網址帶著專案（A）
function readStartParams() {
  const params = new URLSearchParams(location.search);
  if (params.get("source") === "chatgpt") setSource("chatgpt");
  const parsed = params.get("project") ? ATProject.parse(params.get("project")) : null;
  if (parsed) {
    project = { project_id: parsed.project_id, slug: parsed.slug, project_url: parsed.project_url, name: params.get("name") || "" };
    setSource("chatgpt");
  }
  showProject();
}

// chatgpt.com 不在預設權限裡，第一次用時請使用者允許（必須在按鈕點擊裡呼叫）
async function ensureChatgptAccess() {
  let granted = false;
  try { granted = await chrome.permissions.request({ origins: CHATGPT_ORIGINS }); } catch (e) { granted = false; }
  if (!granted) throw new Error("沒有取得讀取 chatgpt.com 的權限。請再按一次，在 Chrome 的詢問視窗按「允許」。");
}

function renderProjects() {
  const sel = $("project-select");
  sel.textContent = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "選一個專案（共 " + projects.length + " 個）";
  sel.appendChild(blank);
  projects.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.project_id;
    opt.textContent = projectLabel(p);
    if (project && project.project_id === p.project_id) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.hidden = false;
}

$("project-select").addEventListener("change", () => {
  project = projects.find((p) => p.project_id === $("project-select").value) || null;
  showProject();
});

$("load-projects").addEventListener("click", async () => {
  $("load-projects").disabled = true;
  $("list-status").className = "muted";
  $("list-status").textContent = "打開 ChatGPT 中…";
  try {
    await ensureChatgptAccess();
    await openInWorker(CHATGPT_HOME);
    $("list-status").textContent = "讀取專案清單中…";
    const res = await inject(listChatgptProjects);
    if (!res || !res.projects.length) {
      throw new Error("找不到專案。請確認 ChatGPT 已登入、側邊欄看得到專案，再試一次。" + (res ? "（" + res.log.join(", ") + "）" : ""));
    }
    projects = res.projects.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh-Hant"));
    // 從專案頁進來的：補上名稱
    if (project) {
      const same = projects.find((p) => p.project_id === project.project_id);
      if (same) project = { ...same, name: same.name || project.name };
    }
    renderProjects();
    showProject();
    $("list-status").textContent = "找到 " + projects.length + " 個專案。";
  } catch (e) {
    $("list-status").className = "error";
    $("list-status").textContent = "讀取專案失敗：" + e.message;
  }
  $("load-projects").disabled = false;
});

$("list-project").addEventListener("click", async () => {
  if (!project) return;
  $("list-project").disabled = true;
  $("list-status").className = "muted";
  $("list-status").textContent = "打開專案中…";
  try {
    await ensureChatgptAccess();
    await openInWorker(project.project_url);
    $("list-status").textContent = "讀取專案裡的對話中…";
    listing = true;
    const res = await inject(listChatgptProjectChats, [project.project_id]).finally(() => { listing = false; });
    if (!res || !res.chats.length) {
      throw new Error("這個專案裡找不到對話。請確認專案網址正確、ChatGPT 已登入。" + (res ? "（" + res.log.join(", ") + "）" : ""));
    }
    const proj = { project_id: project.project_id, name: project.name || "" };
    chats = res.chats.map((c) => ({
      ...c, platform: "chatgpt", url: ATProject.conversationUrl(project, c.id), project: proj
    }));
    $("list-status").textContent = "讀完了：「" + projectLabel(project) + "」有 " + chats.length + " 段對話，用了 " + res.seconds + " 秒" +
      (res.via === "page" ? "（內部介面讀不到，改讀頁面連結；數量請自己核對一下）" : "") + "。";
    $("list-result").hidden = false;
    selectNew();
  } catch (e) {
    $("list-status").className = "error";
    $("list-status").textContent = "讀取對話清單失敗：" + e.message;
  }
  $("list-project").disabled = !project;
});

// ── 步驟 3：擷取 ──

async function captureOne(chat) {
  return chat.platform === "chatgpt" ? captureChatgpt(chat) : captureGemini(chat);
}

// 共用：上傳一段擷取結果到 inbox/<月份>/<平台>-<編號>/
async function uploadCapture(chat, page, attachmentFiles) {
  const platform = chat.platform;
  const folder = INBOX + (folderMonth(page.conversation_created_at) || "undated") + "/" + platform + "-" + chat.id + "/";
  const items = page.items;
  const entry = buildCaptureEntry(platform, chat.id, chat.title, chat.url, folder, items, page, "batch");
  if (chat.project) entry.project = chat.project;
  const files = [
    { path: folder + "source/conversation.jsonl", content: buildJsonl(items) },
    { path: folder + "source/metadata.yaml", content: buildMetadata(items.length, items.length, platform, page, "batch") },
    ...attachmentFiles.map((f) => ({ path: folder + "source/" + f.path, base64: f.base64 }))
  ];
  if (!guideDone) files.push(...await repoGuideFiles(config, branch));
  // 擷取紀錄在提交當下從最新版本讀（別的頁面可能剛寫過，例如標記頁）
  let latest = null;
  await commitWithRetry(files, "After-thinking inbox: " + platform + " " + chat.id + " (" + items.length + " messages)",
    (rows) => (latest = upsertCaptureRow(rows, entry)));
  guideDone = true;
  index = latest || upsertCaptureRow(index, entry);
  capturedIds.add(chatKey(chat));
  return entry;
}

// ChatGPT：打開對話後直接向網站讀完整資料（不用捲動）；讀不到才改用捲動讀取
async function captureChatgpt(chat) {
  await openInWorker(chat.url);
  let page = await inject(captureViaApi, ["chatgpt"]);
  if (!page || !page.items || !page.items.length) {
    const api = page && page.api;
    const ready = await inject(waitForChatgptConversation, [chat.id]);
    if (!ready || !ready.ok) {
      throw new Error(ready && ready.reason === "redirected" ? "打不開這段對話（可能已刪除）" : "對話內容沒有出現");
    }
    page = await inject(captureConversation, ["chatgpt"]);
    if (page) page.api = api;
  }
  if (!page || !page.items || !page.items.length) throw new Error("找不到訊息");
  page.title = chat.title || page.title;
  if (!page.conversation_created_at && chat.started_at) page.conversation_created_at = chat.started_at;
  if (!page.conversation_updated_at && chat.updated_at) page.conversation_updated_at = chat.updated_at;
  if (chat.project) page.project = chat.project;
  const attachmentFiles = await finalizeCapture(workerTabId, "chatgpt", page);
  return uploadCapture(chat, page, attachmentFiles);
}

async function captureGemini(chat) {
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
  const attachmentFiles = await finalizeCapture(workerTabId, "gemini", page);
  return uploadCapture(chat, page, attachmentFiles);
}

async function runBatch(queue) {
  stopRequested = false;
  $("start").disabled = true;
  $("list").disabled = true;
  $("load-projects").disabled = true;
  $("list-project").disabled = true;
  $("stop").disabled = false;
  $("done").hidden = true;
  $("progress").hidden = false;

  const startedAt = Date.now();
  const failures = [];
  let ok = 0;
  let dated = 0;
  let missingAtts = 0;
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
    show(i, "正在擷取：" + (chat.title || chat.id) +
      (chat.platform === "gemini" ? "（長對話要往上載入，可能要一兩分鐘）" : ""));
    try {
      const entry = await captureOne(chat);
      ok++;
      if (entry.started_at) dated++;
      missingAtts += entry.attachments_missing || 0;
    } catch (e) {
      failures.push({ chat, reason: e.message });
    }
    // ChatGPT 讀得很快，每段之間稍微停一下，不要連續猛打網站
    if (chat.platform === "chatgpt" && i < queue.length - 1 && !stopRequested) await new Promise((r) => setTimeout(r, 1500));
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
    (skipped ? "，因為按了停止而沒抓 " + skipped + " 段" : "") + "。目前總共擷取過 " + capturedIds.size + " 段對話。" +
    (ok ? "找到原始時間的有 " + dated + " 段" + (dated < ok ? "（其他放在 inbox/undated/）" : "") + "。" : "") +
    (missingAtts ? "有 " + missingAtts + " 個附件沒拿到原檔，訊息裡標成「未取得原檔」。" : "");
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
  $("load-projects").disabled = false;
  $("list-project").disabled = !project;
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

$("open-tags").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tag.html") });
});

init();
