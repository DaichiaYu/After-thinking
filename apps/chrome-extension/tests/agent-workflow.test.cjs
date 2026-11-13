// Run with: node apps/chrome-extension/tests/agent-workflow.test.cjs
// Lightweight behavior test: fake Chrome APIs, no network or real browser.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const agentCode = fs.readFileSync(path.join(root, "agent.js"), "utf8");
const ATTarget = require("../agent-url.js");
const url = "https://claude.ai/chat/422a07fa-4a45-42f4-b249-4cf7945df762";

async function simulate({ warning = false, auto = true, existing = false, repoOk = true } = {}) {
  const elements = new Map();
  const handlers = {};
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      id, hidden: false, disabled: false, checked: false, value: "", textContent: "",
      addEventListener(event, callback) { (handlers[id] ||= {})[event] = callback; },
      append() {}
    });
    return elements.get(id);
  };
  const document = {
    getElementById: element,
    createElement() { return { textContent: "" }; }
  };
  element("target-url").value = url;
  element("auto-upload").checked = auto;
  let commits = 0;
  let refocuses = 0;
  const page = {
    url, title: "Test conversation", strategy: "claude:api",
    items: [{ speaker: "author", content: "hi" }, { speaker: "assistant", content: "hello" }],
    api: { ok: true }, scroll: warning ? { gaps: 1 } : null,
    attachment_report: { total: 0, saved: 0 }
  };
  const chrome = {
    tabs: {
      onUpdated: { addListener() {}, removeListener() {} },
      async create() { return { id: 4 }; },
      async get() { return { id: 4, status: "complete", url }; },
      async getCurrent() { return { id: 3 }; },
      async update(id, options) { if (id === 3 && options.active) refocuses++; }
    },
    permissions: { async request() { return true; } },
    scripting: { async executeScript() { return [{ result: page }]; } },
    runtime: { getURL(p) { return "chrome-extension://at/" + p; } }
  };
  const context = {
    document, chrome, URL, location: { href: "chrome-extension://at/agent.html" },
    ATTarget, setTimeout, clearTimeout,
    captureViaApi() {}, captureConversation() {}, ensureGeminiRecorder() {},
    async finalizeCapture() { return []; },
    defaultDiscussionId() { return "2026-11-13-claude-422a07fa"; },
    sanitizeId(s) { return s.trim(); },
    async loadConfig() { return { repo: "test/private", root: "discussions/", token: "fake" }; },
    async checkRepo() { return repoOk ? { ok: true, branch: "main" } : { ok: false, message: "not configured" }; },
    normalizeRoot(s) { return s; },
    async pathExists() { return existing; },
    buildJsonl() { return "jsonl"; }, buildMetadata() { return "metadata"; },
    buildState() { return "state"; }, CORRECTIONS_TEMPLATE: "corrections",
    async repoGuideFiles() { return []; }, buildCaptureEntry() { return {}; },
    async commitFiles() { commits++; }, upsertCaptureRow(rows, entry) { return [...rows, entry]; },
    navigator: { clipboard: { async writeText() {} } }
  };
  vm.runInNewContext(agentCode, context, { filename: "agent.js" });
  await handlers.capture.click();
  const status = () => JSON.parse(element("agent-status-json").textContent);
  return { commits: () => commits, refocuses: () => refocuses, status, element, handlers };
}

(async () => {
  const clean = await simulate();
  assert.equal(clean.commits(), 1, "No-warning auto-upload should commit once");
  assert.equal(clean.refocuses(), 1, "Should return to agent status tab after capture");
  assert.equal(clean.status().phase, "success");
  assert.equal(clean.status().result.repo, "test/private");
  assert.ok(clean.status().result.github_url.includes("github.com/test/private"));

  const warned = await simulate({ warning: true });
  assert.equal(warned.commits(), 0, "Warnings must pause auto-upload");
  assert.equal(warned.status().phase, "review_required");
  warned.element("accept-incomplete").checked = true;
  await warned.handlers.upload.click();
  assert.equal(warned.commits(), 1, "Acknowledged warning can be manually committed");
  assert.equal(warned.status().phase, "success");

  const manual = await simulate({ auto: false });
  assert.equal(manual.commits(), 0, "Disabling auto-upload must not commit");
  assert.equal(manual.status().phase, "review_required");

  const existing = await simulate({ existing: true });
  assert.equal(existing.commits(), 0, "Existing folder must not be overwritten");
  assert.equal(existing.status().phase, "upload_failed");

  const noRepo = await simulate({ repoOk: false });
  assert.equal(noRepo.commits(), 0, "Missing private repo must not trigger offline fallback");
  assert.equal(noRepo.status().phase, "upload_failed");

  console.log("AT agent workflow: clean, warning, manual, duplicate, missing-repo tests passed.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
