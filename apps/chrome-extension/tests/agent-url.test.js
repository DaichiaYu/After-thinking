// Run with: node apps/chrome-extension/tests/agent-url.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { inspect } = require("../agent-url.js");

const uuid = "12345678-abcd-1234-abcd-123456789abc";
const cases = [
  ["https://chatgpt.com/c/" + uuid, "chatgpt", uuid],
  ["https://chat.openai.com/c/" + uuid + "?utm_source=test#reply", "chatgpt", uuid],
  ["https://chatgpt.com/g/g-p-abcdef0123456789-example-project/c/" + uuid, "chatgpt", uuid],
  ["https://claude.ai/chat/" + uuid, "claude", uuid],
  ["https://gemini.google.com/app/abc123def4567890", "gemini", "abc123def4567890"],
  ["https://gemini.google.com/gem/some-gem/abc123def4567890", "gemini", "abc123def4567890"],
  ["https://grok.com/c/" + uuid, "grok", uuid]
];
for (const [url, platform, id] of cases) {
  const result = inspect(url);
  assert.equal(result.ok, true, url + ": " + result.reason);
  assert.equal(result.platform, platform);
  assert.equal(result.conversation_id, id);
  assert.equal(new URL(result.url).search, "");
  assert.equal(new URL(result.url).hash, "");
}

const rejected = [
  "https://chatgpt.com/share/" + uuid,
  "https://claude.ai/share/" + uuid,
  "https://gemini.google.com/share/abc123def4567890",
  "https://g.co/gemini/share/abc123def4567890",
  "http://chatgpt.com/c/" + uuid,
  "javascript:alert(1)",
  "https://chatgpt.com.evil.test/c/" + uuid,
  "https://chatgpt.com@evil.test/c/" + uuid,
  "https://other@chatgpt.com/c/" + uuid,
  "https://chatgpt.com:4433/c/" + uuid,
  "https://chatgpt.com/c/",
  "https://chatgpt.com/",
  "https://chatgpt.com/c/" + uuid + "/extra",
  "https://claude.ai/chat/not-a-uuid",
  "https://gemini.google.com/app/",
  "https://grok.com/c/nope",
  "",
  "random text"
];
for (const url of rejected) {
  assert.equal(inspect(url).ok, false, "Expected rejection: " + url);
}

// Verify that the new entrypoint is actually wired into the packaged extension.
const dir = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const html = fs.readFileSync(path.join(dir, "agent.html"), "utf8");
const popupHtml = fs.readFileSync(path.join(dir, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(dir, "popup.js"), "utf8");
const agentJs = fs.readFileSync(path.join(dir, "agent.js"), "utf8");
for (const filename of ["github.js", "capture.js", "guide.js", "agent-url.js", "agent.js"]) {
  assert.ok(html.includes('src="' + filename + '"'), "Missing agent script " + filename);
}
assert.ok(manifest.optional_host_permissions.includes("https://chatgpt.com/*"));
assert.ok(manifest.optional_host_permissions.includes("https://claude.ai/*"));
assert.ok(popupHtml.includes('id="open-agent"'));
assert.ok(popupJs.includes('getURL("agent.html")'));
assert.ok(agentJs.includes("chrome.permissions.request"));
assert.ok(agentJs.includes("chrome.scripting.executeScript"));
assert.ok(agentJs.includes("commitFiles("));
assert.ok(html.includes('id="auto-upload"'), "Agent auto-upload toggle missing");
assert.ok(html.includes('data-at-action="capture-to-github"'), "Agent primary action marker missing");
assert.ok(html.includes('id="result-json"'), "Agent machine result output missing");
assert.ok(agentJs.includes("if (shouldAutoUpload) await uploadCaptured()"), "One-click auto-upload flow missing");
assert.ok(agentJs.includes("warnings.length === 0"), "Auto-upload safety gate missing");
assert.ok(agentJs.includes("machine.result = outcome"), "Machine status missing success result");
assert.ok(popupHtml.includes('data-at-role="agent-primary-route"'), "Agent guidance not visible in popup");
assert.ok(popupHtml.includes('僅離線備份：下載 ZIP（不上傳 GitHub）'), "Offline ZIP ambiguity not resolved");
console.log("AT agent URL PoC: " + cases.length + " valid URLs, " + rejected.length + " rejected URLs, wiring checks OK.");
