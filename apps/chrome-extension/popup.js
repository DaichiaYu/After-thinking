// After-thinking Capture — 按圖示模式（manual_click）
// 只在使用者按下擴充功能圖示時讀取目前這個分頁，不會背景監聽。
// 擷取程式在 capture.js。

function diagnosePage() {
  const count = (sel) => { try { return document.querySelectorAll(sel).length; } catch (e) { return "error"; } };
  const selectors = [
    "[data-message-author-role]", '[data-message-author-role="user"]', '[data-message-author-role="assistant"]',
    "article", 'article[data-testid^="conversation-turn"]', "article[data-turn]",
    '[data-testid="user-message"]', ".font-claude-response", ".font-claude-message",
    "[data-is-streaming]", "[data-test-render-count]", "main", "[role=main]",
    "#chat-history", "infinite-scroller", ".conversation-container", "user-query", "user-query .query-text",
    "model-response", "model-response .markdown", "model-thoughts", "message-content",
    '[id^="response-"]', ".message-bubble", '[id^="response-"].items-end'
  ];
  const testids = {};
  document.querySelectorAll("[data-testid]").forEach((el) => {
    const v = el.getAttribute("data-testid").replace(/\d+/g, "#");
    testids[v] = (testids[v] || 0) + 1;
  });
  const dataAttrs = {};
  document.querySelectorAll("*").forEach((el) => {
    for (const a of el.attributes) {
      if (a.name.startsWith("data-") && /message|turn|role|author|chat|convers/i.test(a.name)) {
        dataAttrs[a.name] = (dataAttrs[a.name] || 0) + 1;
      }
    }
  });
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    testid: el.getAttribute("data-testid"),
    classes: (el.getAttribute("class") || "").slice(0, 120),
    text_length: (el.innerText || "").length,
    in_main: !!el.closest("main, [role=main]")
  });
  // 相關屬性的「值」範例（例如 user／assistant），只取前 40 個字元，不含對話文字。
  const attrValues = {};
  Object.keys(dataAttrs).forEach((name) => {
    const values = new Set();
    document.querySelectorAll("[" + name + "]").forEach((el) => {
      if (values.size < 6) values.add((el.getAttribute(name) || "").slice(0, 40));
    });
    attrValues[name] = Array.from(values);
  });
  const probe = (sel) => Array.from(document.querySelectorAll(sel)).slice(0, 3).map((el) => ({
    tag: el.tagName.toLowerCase(),
    text_length: (el.innerText || "").length,
    data_attributes: Array.from(el.attributes).filter((a) => a.name.startsWith("data-")).map((a) => a.name),
    contains_user_bubble: !!el.querySelector("[data-user-message-bubble]"),
    inside_user_bubble: !!el.closest("[data-user-message-bubble]"),
    inside_turn_key: !!(el.parentElement && el.parentElement.closest("[data-turn-key]")),
    children_with_unit_key: el.querySelectorAll("[data-chatgpt-search-unit-key]").length
  }));
  const probes = Object.fromEntries([
    "[data-chatgpt-search-unit-key]", "[data-user-message-bubble]", "[data-conversation-role]",
    "[data-turn-key]", "[data-chatgpt-agent-turn-start]"
  ].map((sel) => [sel, probe(sel)]));
  const samples = Array.from(document.querySelectorAll(
    '[data-testid="user-message"], .font-claude-response, .font-claude-message, article, [data-message-author-role], user-query, model-response, [id^="response-"]'
  ));
  return {
    host: location.hostname,
    path_shape: location.pathname.replace(/[0-9a-f-]{8,}/gi, "<id>"),
    ready_state: document.readyState,
    user_agent: navigator.userAgent,
    selector_counts: Object.fromEntries(selectors.map((s) => [s, count(s)])),
    data_testids: Object.fromEntries(Object.entries(testids).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    related_data_attributes: dataAttrs,
    attribute_value_samples: attrValues,
    probes,
    first_candidates: samples.slice(0, 4).map(describe),
    last_candidates: samples.slice(-4).map(describe)
  };
}

function download(path, text) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
    chrome.downloads.download({ url, filename: path, conflictAction: "uniquify", saveAs: false }, (id) => {
      if (chrome.runtime.lastError || id === undefined) {
        URL.revokeObjectURL(url);
        reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : "unknown"));
        return;
      }
      const listener = (delta) => {
        if (delta.id !== id || !delta.state) return;
        if (delta.state.current === "complete" || delta.state.current === "interrupted") {
          chrome.downloads.onChanged.removeListener(listener);
          URL.revokeObjectURL(url);
          if (delta.state.current !== "complete") { reject(new Error("下載被中斷")); return; }
          chrome.downloads.search({ id }, (found) => resolve(found && found[0] ? found[0].filename : ""));
        }
      };
      chrome.downloads.onChanged.addListener(listener);
    });
  });
}

// ── 畫面 ──

function showError(message) {
  document.getElementById("platform").hidden = true;
  const el = document.getElementById("error");
  el.textContent = message;
  el.hidden = false;
}

function renderMessages(items, selected) {
  const list = document.getElementById("messages");
  const shape = document.getElementById("shape");
  list.textContent = "";
  shape.textContent = "";

  const refresh = () => {
    const kept = items.filter((_, i) => selected[i]);
    document.getElementById("count-author").textContent = kept.filter((i) => i.speaker === "author").length;
    document.getElementById("count-assistant").textContent = kept.filter((i) => i.speaker === "assistant").length;
    const excluded = items.length - kept.length;
    document.getElementById("count-excluded").textContent = excluded ? "（已排除 " + excluded + " 則）" : "";
    items.forEach((_, i) => {
      list.children[i].classList.toggle("off", !selected[i]);
      shape.children[i].classList.toggle("off", !selected[i]);
    });
  };

  items.forEach((item, i) => {
    const bar = document.createElement("span");
    if (item.speaker === "author") bar.className = "author";
    shape.appendChild(bar);

    const li = document.createElement("li");
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selected[i];
    box.addEventListener("change", () => { selected[i] = box.checked; refresh(); });

    const body = document.createElement("span");
    const who = document.createElement("span");
    who.className = "who " + item.speaker;
    who.textContent = (item.speaker === "author" ? "你" : "AI") + "　";
    const text = document.createElement("span");
    text.className = "text";
    const flat = item.content.replace(/\s+/g, " ") || "（只有附件）";
    text.textContent = flat.length > 60 ? flat.slice(0, 60) + "…" : flat;
    body.append(who, text);

    const len = document.createElement("span");
    len.className = "len";
    len.textContent = item.content.length + " 字";

    label.append(box, body, len);
    li.appendChild(label);
    list.appendChild(li);
  });
  refresh();
}

// 這段對話之前抓過的話，在最上面提示：什麼時候、抓了幾則、存在哪裡，現在又多了幾則
async function showPreviousCaptures(config, platform, conversationId, nowCount) {
  const box = document.getElementById("seen");
  try {
    const check = await checkRepo(config);
    if (!check.ok) return;
    const rows = (await readCaptureIndex(config, check.branch))
      .filter((r) => r.platform === platform && r.conversation_id === conversationId);
    if (!rows.length) return;
    box.textContent = "";
    const head = document.createElement("b");
    head.textContent = "這段對話已經擷取過";
    box.appendChild(head);
    rows.forEach((r) => {
      const d = new Date(r.captured_at);
      const date = isNaN(d) ? "" : (d.getMonth() + 1) + "/" + d.getDate() + " ";
      const diff = nowCount - r.messages;
      const line = document.createElement("div");
      line.textContent = date + (r.mode === "batch" ? "批量" : "單段") + "擷取 " + r.messages + " 則，存在 " + r.folder +
        (diff > 0 ? "。之後多了 " + diff + " 則" : diff === 0 ? "。目前沒有新訊息" : "") +
        (r.outline_updated_at ? "。已標記" : "") + " ";
      // 從原對話回到標記頁
      const go = document.createElement("button");
      go.className = "link";
      go.textContent = r.outline_updated_at ? "打開標記頁" : "去標記";
      go.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("tag.html?folder=" + encodeURIComponent(r.folder)) }));
      line.appendChild(go);
      box.appendChild(line);
    });
    box.hidden = false;
  } catch (e) { /* 讀不到紀錄時不提示，不影響擷取 */ }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

let lastScrollLog = null;
let lastApiLog = null;
let lastAttachmentReport = null;

document.getElementById("open-agent").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("agent.html") });
});

document.getElementById("open-tags").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tag.html") });
});

document.getElementById("open-batch").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("batch.html") });
});

document.getElementById("diagnose").addEventListener("click", async () => {
  const status = document.getElementById("diagnose-status");
  try {
    const tab = await getActiveTab();
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: diagnosePage });
    const report = { extension_version: VERSION, last_capture_api: lastApiLog, last_capture_scroll: lastScrollLog, last_attachments: lastAttachmentReport, ...injection.result };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    status.textContent = "已複製診斷報告，可以直接貼上。";
  } catch (e) {
    status.textContent = "無法產生診斷報告：" + e.message;
  }
});

async function main() {
  ensureGeminiRecorder();
  const tab = await getActiveTab();
  const platform = tab && tab.url ? detectPlatform(tab.url) : null;
  if (!platform) {
    showError("這個頁面不是 ChatGPT、Claude、Gemini 或 Grok 的對話。請先打開要整理的對話，再按一次圖示。");
    return;
  }

  // ChatGPT 專案：在專案頁或專案裡的對話時，提供「批量擷取這個專案」
  const proj = platform === "chatgpt" ? ATProject.parse(tab.url) : null;
  if (proj) {
    // 在專案頁時，分頁標題通常就是專案名稱
    const name = proj.on_project_page ? String(tab.title || "").replace(/^ChatGPT\s*[-–|]\s*|\s*[-–|]\s*ChatGPT$/g, "").trim() : "";
    const box = document.getElementById("project-batch");
    document.getElementById("project-batch-text").textContent = proj.on_project_page
      ? "這是 ChatGPT 專案頁" + (name && name !== "ChatGPT" ? "「" + name + "」" : "") + "。要擷取單一段對話，請先打開那段對話。"
      : "這段對話在 ChatGPT 專案裡。也可以一次擷取整個專案。";
    box.hidden = false;
    document.getElementById("open-project-batch").addEventListener("click", () => {
      const q = new URLSearchParams({ source: "chatgpt", project: proj.project_url });
      if (name && name !== "ChatGPT") q.set("name", name);
      chrome.tabs.create({ url: chrome.runtime.getURL("batch.html?" + q.toString()) });
    });
    if (proj.on_project_page) {
      document.getElementById("platform").textContent = "ChatGPT｜專案頁";
      return;
    }
  }

  // 讀取中持續顯示經過秒數，讓使用者知道程式還在跑
  const statusLine = document.getElementById("platform");
  const startedAt = Date.now();
  const elapsed = () => Math.round((Date.now() - startedAt) / 1000);
  let phase = "正在讀取…";
  const renderPhase = () => {
    statusLine.textContent = "";
    const spin = document.createElement("span");
    spin.className = "spinner";
    spin.setAttribute("aria-hidden", "true");
    statusLine.append(spin, phase + "　已經過 " + elapsed() + " 秒");
  };
  const setPhase = (text) => { phase = text; renderPhase(); };
  const ticker = setInterval(renderPhase, 1000);
  const stopTicker = () => clearInterval(ticker);
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "capture-progress") setPhase(msg.text + "（請不要點擊其他地方）");
  });

  let page;
  try {
    setPhase("正在向網站讀取完整對話資料，請不要點擊其他地方…");
    const [apiInjection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: captureViaApi, args: [platform]
    });
    const viaApi = apiInjection.result || { api: { tried: true, ok: false, steps: ["no_result"] } };
    lastApiLog = viaApi.api;
    if (viaApi.items && viaApi.items.length) {
      page = viaApi;
    } else {
      setPhase("改用捲動讀取，請不要點擊其他地方…");
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: captureConversation, args: [platform]
      });
      page = injection.result;
      page.api = viaApi.api;
    }
    lastScrollLog = page.scroll;
  } catch (e) {
    stopTicker();
    showError("無法讀取這個頁面：" + e.message);
    return;
  }

  if (!page.items.length) {
    stopTicker();
    showError("在這個頁面找不到對話訊息。請按下方「複製診斷報告」，把報告貼給開發者。");
    return;
  }

  // Gemini：補原始時間、下載圖片和檔案
  let attachmentFiles = [];
  try {
    setPhase(platform === "gemini" ? "正在讀取原始時間和附件…" : "正在下載附件原檔…");
    attachmentFiles = await finalizeCapture(tab.id, platform, page);
    lastAttachmentReport = page.attachment_report || null;
  } catch (e) { /* 附件或時間失敗不影響擷取 */ }
  stopTicker();
  // 只保留勾選訊息用到的附件
  const filesFor = (kept) => {
    const used = new Set();
    kept.forEach((i) => (i.attachments || []).forEach((a) => { if (a.file) used.add(a.file); }));
    return attachmentFiles.filter((f) => used.has(f.path));
  };

  const items = page.items;
  // 很短的 AI 訊息很可能是誤抓的頁面文字（例如專案名稱），預設不勾選，讓使用者決定。
  // 直接讀取資料時不會混入頁面文字，全部預設勾選
  const viaApi = !!(page.api && page.api.ok);
  const selected = items.map((item) => viaApi || !(item.speaker === "assistant" && item.content.length <= 10));

  const truncated = items.filter((i) => i.truncated).length;
  document.getElementById("platform").textContent =
    ({ chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", grok: "Grok" }[platform]) + "｜" + page.title +
    (page.api && page.api.ok ? "｜已直接讀取完整資料" : "｜使用捲動讀取") +
    "｜用時 " + elapsed() + " 秒" +
    (page.branches ? "｜這段對話有 " + page.branches + " 個分支點，" +
      (page.branch_captured === "latest_path" ? "畫面上看不出目前路線，擷取最新的那條" : "只擷取目前這條路線") : "") +
    (page.scroll && page.scroll.gaps ? "｜注意：捲動時可能跳過部分訊息，請檢查清單" : "") +
    (page.scroll && page.scroll.timed_out ? "｜注意：讀取超過 5 分鐘，已提前停止" : "") +
    (truncated ? "｜注意：有 " + truncated + " 則長訊息沒能完整展開" : "") +
    (page.attachment_report && page.attachment_report.total
      ? "｜附件 " + page.attachment_report.total + " 個，存到原檔 " + page.attachment_report.saved + " 個" +
        (page.attachment_report.saved < page.attachment_report.total ? "（沒拿到的會標成「未取得原檔」）" : "")
      : "") +
    (platform === "gemini" && page.recorder === "not_loaded" ? "｜沒有抓到原始時間：重新整理這個 Gemini 頁面後再按一次圖示就會有" : "");
  renderMessages(items, selected);

  const idInput = document.getElementById("discussion-id");
  idInput.value = defaultDiscussionId(platform, page.url, page.conversation_created_at);
  document.getElementById("result").hidden = false;

  const status = document.getElementById("status");
  const uploadBtn = document.getElementById("upload");
  const target = document.getElementById("upload-target");
  const confirmBox = document.getElementById("confirm");
  const openResult = document.getElementById("open-result");

  document.getElementById("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

  // 讀取勾選結果，並檢查討論編號
  const prepare = () => {
    const id = sanitizeId(idInput.value);
    const kept = items.filter((_, i) => selected[i]);
    if (!id) { status.textContent = "請輸入 Discussion ID，只能用英文小寫、數字和連字號。"; return null; }
    if (!kept.length) { status.textContent = "至少要勾選一則訊息。"; return null; }
    idInput.value = id;
    return { id, kept };
  };

  const config = await loadConfig();
  const conversationId = conversationIdFromUrl(platform, page.url);
  if (config && config.repo && config.token) {
    target.textContent = "上傳到 " + config.repo + " 的 " + normalizeRoot(config.root) + "<討論編號>/";
    if (conversationId) showPreviousCaptures(config, platform, conversationId, items.length);
  } else {
    uploadBtn.disabled = true;
    target.textContent = "還沒設定 GitHub。請按下方「GitHub 設定」。";
  }

  let pending = null;
  uploadBtn.addEventListener("click", async () => {
    const prepared = prepare();
    if (!prepared) return;
    uploadBtn.disabled = true;
    openResult.hidden = true;
    document.getElementById("open-tag").hidden = true;
    status.textContent = "檢查倉庫中…";
    try {
      const check = await checkRepo(config);
      if (!check.ok) throw new Error(check.message);
      const root = normalizeRoot(config.root);
      const folder = root + prepared.id + "/";
      if (await pathExists(config, check.branch, folder)) {
        throw new Error("倉庫裡已經有「" + folder + "」。為了不覆蓋既有的分析，請換一個討論編號。（接續更新同一段對話會在之後的版本支援）");
      }
      pending = { ...prepared, branch: check.branch, folder };
      document.getElementById("confirm-text").textContent =
        "即將上傳 " + prepared.kept.length + " 則訊息到 " + config.repo + "（私人倉庫）的 " + folder +
        "，會建立 4 個檔案：conversation.jsonl、metadata.yaml、state.yaml、corrections.yaml。確定嗎？";
      confirmBox.hidden = false;
      status.textContent = "";
    } catch (e) {
      status.textContent = "無法上傳：" + e.message;
      uploadBtn.disabled = false;
    }
  });

  document.getElementById("confirm-no").addEventListener("click", () => {
    pending = null;
    confirmBox.hidden = true;
    uploadBtn.disabled = false;
    status.textContent = "已取消，沒有上傳任何東西。";
  });

  document.getElementById("confirm-yes").addEventListener("click", async (event) => {
    if (!pending) return;
    event.target.disabled = true;
    status.textContent = "上傳中…";
    const { id, kept, branch, folder } = pending;
    try {
      const files = [
        ...filesFor(kept).map((f) => ({ path: folder + "source/" + f.path, base64: f.base64 })),
        { path: folder + "source/conversation.jsonl", content: buildJsonl(kept) },
        { path: folder + "source/metadata.yaml", content: buildMetadata(kept.length, items.length, platform, page) },
        { path: folder + "state.yaml", content: buildState(config, id) },
        { path: folder + "corrections.yaml", content: CORRECTIONS_TEMPLATE }
      ];
      // 記到擷取紀錄，之後批量擷取和這個視窗都會知道這段抓過了（提交當下從最新版本讀）
      const entry = conversationId
        ? buildCaptureEntry(platform, conversationId, page.title, page.url, folder, kept, page, "manual_click") : null;
      files.push(...await repoGuideFiles(config, branch));
      await commitFiles(config, branch, files,
        "After-thinking: capture " + id + " (" + platform + ", " + kept.length + " messages)",
        entry ? (rows) => upsertCaptureRow(rows, entry) : null);
      confirmBox.hidden = true;
      status.textContent = "已上傳 " + kept.length + " 則訊息到 " + config.repo + " 的 " + folder;
      const url = "https://github.com/" + config.repo + "/tree/" + encodeURIComponent(branch) + "/" +
        folder.split("/").filter(Boolean).map(encodeURIComponent).join("/");
      openResult.hidden = false;
      openResult.onclick = () => chrome.tabs.create({ url });
      const openTag = document.getElementById("open-tag");
      openTag.hidden = false;
      openTag.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("tag.html?folder=" + encodeURIComponent(folder)) });
      pending = null;
    } catch (e) {
      status.textContent = "上傳失敗：" + e.message + "（倉庫沒有被修改）";
      event.target.disabled = false;
    }
  });

  document.getElementById("download").addEventListener("click", async (event) => {
    const prepared = prepare(); if (!prepared) return;
    const { id, kept } = prepared;
    event.target.disabled = true;
    status.textContent = "正在建立單一 ZIP 資料包…";
    try {
      const root = id + "/";
      const guide = ["# After-thinking 離線資料包", "",
        "可直接在 AT「標記對話」頁選這個 ZIP，不需要 GitHub 或解壓。", "",
        "- source/conversation.jsonl：完整原始對話（給程式使用，不是亂碼）",
        "- source/metadata.yaml：來源、日期和擷取資訊",
        "- source/attachments/：下載成功的圖片與附件",
        "- 對話閱讀版.md：給人閱讀的 Markdown 對話",
        "- 對話快速導覽.md：完整提問與 AI 回覆的原生標題",
        "- outline.json：完成標記後重新下載 ZIP 才會出現", "",
        "操作：在標記頁選 ZIP → 標記 → 下載已標記 ZIP → 下次選新 ZIP 接續。",
        "原始資料與正式標記分離，閱讀版只供快速瀏覽。", ""].join("\n");
      const readable = ["# " + (page.title || "AI 對話"), "", "來源：" + page.url, ""];
      const quick = ["# 對話快速導覽", "", "程式產生，不是 AI 摘要。", ""];
      kept.forEach((m, i) => {
        const no = String(i+1).padStart(3, "0");
        readable.push("## " + no + " · " + (m.speaker === "author" ? "你" : "AI"), "", m.content || "", "");
        quick.push("## " + no + " · " + (m.speaker === "author" ? "你" : "AI"), "");
        if (m.speaker === "author") quick.push(m.content || "", "");
        else { const hs = String(m.content || "").split("\n").filter(line => /^#{1,6}\s+\S/.test(line));
          quick.push(hs.length ? hs.map(h => "- " + h.replace(/^#{1,6}\s+/, "")).join("\n") : "（沒有 Markdown 小標題）", ""); }
      });
      const entries = [
        { path: root + "README-請先看.md", data: guide },
        { path: root + "source/conversation.jsonl", data: buildJsonl(kept) },
        { path: root + "source/metadata.yaml", data: buildMetadata(kept.length, items.length, platform, page) },
        { path: root + "對話閱讀版.md", data: readable.join("\n") },
        { path: root + "對話快速導覽.md", data: quick.join("\n") }
      ];
      for (const f of filesFor(kept)) {
        if (!/^attachments\/[^/]+$/.test(f.path)) continue;
        entries.push({ path: root + "source/" + f.path, data: Uint8Array.from(atob(f.base64), c => c.charCodeAt(0)) });
      }
      const blob = ATBundle.pack(entries);
      const saved = await download("after-thinking-" + id + ".zip", blob);
      status.textContent = "已下載一份 ZIP（" + kept.length + " 則），可直接在標記頁開啟，無需 GitHub。" + (saved ? " 路徑：" + saved : "");
    } catch (e) { status.textContent = "下載失敗：" + e.message; }
    event.target.disabled = false;
  });
}

main();
