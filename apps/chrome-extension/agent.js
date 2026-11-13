// Agent-directed AT Capture proof of concept.
// A user/authorized computer-use agent supplies one original conversation URL.
// This page requests only that website's host permission, reads that conversation
// using existing capture logic, previews results, and only then writes to GitHub.
(() => {
  "use strict";

  const el = (id) => document.getElementById(id);
  const setStatus = (message) => { el("status").textContent = message; };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const displayName = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", grok: "Grok" };
  let captured = null;
  let outcome = null;
  let running = false;

  const queryUrl = new URL(location.href).searchParams.get("url");
  if (queryUrl) el("target-url").value = queryUrl;

  function showUrlHint() {
    const info = ATTarget.inspect(el("target-url").value);
    el("url-hint").textContent = info.ok
      ? "已辨識 " + displayName[info.platform] + " 原始對話（ID：" + info.conversation_id + "），會自動移除追蹤參數。"
      : info.reason;
    return info;
  }
  el("target-url").addEventListener("input", showUrlHint);
  if (queryUrl) showUrlHint();

  function setReviewSummary(rows) {
    const dl = el("summary");
    dl.textContent = "";
    for (const [title, value] of rows) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = title;
      dd.textContent = String(value);
      dl.append(dt, dd);
    }
  }

  function updateUploadEnabled() {
    el("upload").disabled = running ||
      !captured || (captured.warnings.length > 0 && !el("accept-incomplete").checked);
  }

  function waitForTab(tabId, ms = 45000) {
    return new Promise((resolve, reject) => {
      let timer = null;
      function cleanup() {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        if (timer) clearTimeout(timer);
      }
      async function check() {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === "complete") { cleanup(); resolve(tab); }
        } catch (e) { cleanup(); reject(e); }
      }
      function onUpdated(id, change) {
        if (id === tabId && change.status === "complete") void check();
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
      timer = setTimeout(() => {
        cleanup();
        reject(new Error("頁面載入逾時，請確認已在電腦登入該 AI 網站。"));
      }, ms);
      void check();
    });
  }

  async function readConversation(tabId, platform) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        setStatus("已開啟指定對話。讀取 " + displayName[platform] + " 資料中…（第 " + (attempt + 1) + " 次）");
        const [api] = await chrome.scripting.executeScript({
          target: { tabId }, func: captureViaApi, args: [platform]
        });
        const direct = (api && api.result) || {};
        if (Array.isArray(direct.items) && direct.items.length) return direct;
        setStatus("直接讀取未成功，改用原本的 AT 捲動擷取方式…");
        const [scroll] = await chrome.scripting.executeScript({
          target: { tabId }, func: captureConversation, args: [platform]
        });
        const page = (scroll && scroll.result) || {};
        page.api = direct.api || { tried: true, ok: false };
        if (Array.isArray(page.items) && page.items.length) return page;
        lastError = new Error("頁面沒有可讀取的訊息。");
      } catch (e) { lastError = e; }
      if (attempt < 3) await wait(1200);
    }
    throw lastError || new Error("找不到對話訊息。");
  }

  // Chrome extensions require a user gesture to request optional host access.
  // The Agent may press this button as the user's explicit action.
  el("capture").addEventListener("click", async () => {
    if (running) return;
    const target = showUrlHint();
    if (!target.ok) { setStatus(target.reason); return; }

    running = true;
    captured = null;
    outcome = null;
    el("capture").disabled = true;
    el("review").hidden = true;
    el("done").hidden = true;

    try {
      setStatus("正在要求這個 AI 網站的瀏覽器存取權限…");
      const granted = await chrome.permissions.request({ origins: [target.origin_pattern] });
      if (!granted) throw new Error("未授權讀取此網站，因此取消擷取。");
      if (target.platform === "gemini") {
        try { await ensureGeminiRecorder(); } catch (_) { /* timestamps optional */ }
      }

      setStatus("正在電腦 Chrome 開啟指定的私人對話…");
      const tab = await chrome.tabs.create({ url: target.url, active: true });
      await waitForTab(tab.id);
      // Check the actual opened URL: redirects to login/home must not result
      // in capturing the wrong conversation.
      const opened = await chrome.tabs.get(tab.id);
      const actual = ATTarget.inspect(opened.url || "");
      if (!actual.ok || actual.platform !== target.platform || actual.conversation_id !== target.conversation_id)
        throw new Error("電腦未停留在指定對話。可能需要登入，或對話無權限。請先在電腦完成登入，再重試。");

      const page = await readConversation(tab.id, target.platform);
      const seen = ATTarget.inspect(page.url || "");
      if (!seen.ok || seen.platform !== target.platform || seen.conversation_id !== target.conversation_id)
        throw new Error("擷取結果的原始對話 ID 與指定網址不一致，已停止。");

      setStatus("正在恢復訊息附件（若可取得）…");
      let attachmentFiles = [];
      try {
        attachmentFiles = await finalizeCapture(tab.id, target.platform, page);
      } catch (e) {
        page.attachment_report = page.attachment_report || { total: 0, saved: 0 };
        page.capture_attachment_error = String(e.message || e);
      }
      const warnings = [];
      if (page.scroll && page.scroll.gaps) warnings.push("捲動可能跳過部分訊息");
      if (page.scroll && page.scroll.timed_out) warnings.push("捲動逾時，對話可能不完整");
      const truncated = page.items.filter((x) => x.truncated).length;
      if (truncated) warnings.push(truncated + " 則長訊息可能被截斷");
      if (page.capture_attachment_error) warnings.push("附件還原發生錯誤：" + page.capture_attachment_error);
      const report = page.attachment_report || {};
      if ((report.total || 0) > (report.saved || 0))
        warnings.push("有 " + ((report.total || 0) - (report.saved || 0)) + " 個附件未能取得原檔");
      if (!page.api || !page.api.ok) warnings.push("採用捲動擷取，建議核對訊息完整性");

      captured = { target, tabId: tab.id, page, attachmentFiles, warnings };
      const items = page.items;
      setReviewSummary([
        ["平台", displayName[target.platform]],
        ["來源", target.url],
        ["標題", page.title || "（未知）"],
        ["訊息", items.length + " 則（你：" + items.filter((x) => x.speaker === "author").length +
          "、AI：" + items.filter((x) => x.speaker === "assistant").length + "）"],
        ["附件", (report.saved || 0) + "/" + (report.total || 0) + " 已取得"],
        ["擷取方式", page.api && page.api.ok ? "直接讀取頁面資料" : "捲動擷取"],
        ["上傳", "尚未執行；必須先確認"]
      ]);
      el("discussion-id").value = defaultDiscussionId(target.platform, target.url, page.conversation_created_at);
      el("accept-incomplete").checked = false;
      el("capture-warnings").hidden = warnings.length === 0;
      el("capture-warnings").textContent = warnings.join("\n");
      el("incomplete-wrap").hidden = warnings.length === 0;
      el("review").hidden = false;
      setStatus("對話已擷取至插件記憶體，尚未上傳。請先核對摘要，然後確認上傳。");
    } catch (e) {
      setStatus("擷取失敗：" + (e.message || String(e)) + "\n不會上傳任何對話。");
    } finally {
      running = false;
      el("capture").disabled = false;
      updateUploadEnabled();
    }
  });

  el("accept-incomplete").addEventListener("change", updateUploadEnabled);
  el("back").addEventListener("click", () => {
    captured = null;
    el("review").hidden = true;
    setStatus("已取消本次擷取預覽，尚未上傳。");
  });

  el("upload").addEventListener("click", async () => {
    if (running || !captured) return;
    if (captured.warnings.length && !el("accept-incomplete").checked) return;
    const { target, page, attachmentFiles, warnings } = captured;
    const id = sanitizeId(el("discussion-id").value);
    if (!id) { setStatus("討論編號不能為空。"); return; }

    running = true;
    updateUploadEnabled();
    try {
      const config = await loadConfig();
      setStatus("檢查 GitHub 私人倉庫與權限…");
      const repoStatus = await checkRepo(config);
      if (!repoStatus.ok) throw new Error(repoStatus.message);
      const root = normalizeRoot(config.root);
      const folder = root + id + "/";
      if (await pathExists(config, repoStatus.branch, folder))
        throw new Error("目標資料夾已存在。PoC 暫不覆蓋舊版對話和標記，請先用另一個 ID。");
      const validAttachments = attachmentFiles.filter((f) => /^attachments\/[^/]+$/.test(f.path));
      const files = [
        ...validAttachments.map((f) => ({ path: folder + "source/" + f.path, base64: f.base64 })),
        { path: folder + "source/conversation.jsonl", content: buildJsonl(page.items) },
        { path: folder + "source/metadata.yaml", content: buildMetadata(page.items.length, page.items.length, target.platform, page, "agent_url") },
        { path: folder + "state.yaml", content: buildState(config, id) },
        { path: folder + "corrections.yaml", content: CORRECTIONS_TEMPLATE },
        ...await repoGuideFiles(config, repoStatus.branch)
      ];
      const entry = buildCaptureEntry(target.platform, target.conversation_id, page.title,
        target.url, folder, page.items, page, "agent_url");
      setStatus("正在將已確認的對話與附件上傳 GitHub…");
      await commitFiles(config, repoStatus.branch, files,
        "After-thinking: agent capture " + id + " (" + target.platform + ", " + page.items.length + " messages)",
        (rows) => upsertCaptureRow(rows, entry));

      const url = "https://github.com/" + config.repo + "/tree/" +
        encodeURIComponent(repoStatus.branch) + "/" +
        folder.split("/").filter(Boolean).map(encodeURIComponent).join("/");
      outcome = {
        ok: true, platform: target.platform, conversation_id: target.conversation_id,
        source_url: target.url, messages: page.items.length,
        attachments_saved: (page.attachment_report || {}).saved || 0,
        attachments_total: (page.attachment_report || {}).total || 0,
        warnings, repo: config.repo, folder, github_url: url,
        desktop_tag_url: chrome.runtime.getURL("tag.html?folder=" + encodeURIComponent(folder))
      };
      el("result-text").textContent = "成功上傳 " + page.items.length + " 則訊息至 " + config.repo + " / " + folder;
      el("done").hidden = false;
      el("review").hidden = true;
      setStatus("擷取及上傳成功。可複製結果 JSON 給 Agent 回報。");
    } catch (e) {
      setStatus("上傳未完成：" + (e.message || String(e)) + "\n不會主動覆蓋既有資料。");
    } finally {
      running = false;
      updateUploadEnabled();
    }
  });

  el("copy-result").addEventListener("click", async () => {
    if (!outcome) return;
    try { await navigator.clipboard.writeText(JSON.stringify(outcome, null, 2)); setStatus("已複製 JSON 結果。"); }
    catch (e) { setStatus("無法複製 JSON：" + (e.message || e)); }
  });
  el("open-folder").addEventListener("click", () => {
    if (outcome) chrome.tabs.create({ url: outcome.github_url });
  });
  el("open-tag").addEventListener("click", () => {
    if (outcome) chrome.tabs.create({ url: outcome.desktop_tag_url });
  });
})();
