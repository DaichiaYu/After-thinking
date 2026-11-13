// Run with: node apps/chrome-extension/tests/chatgpt-project.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../chatgpt-project.js");

const pid = "g-p-0123456789abcdef0123456789abcdef";
const uuid = "12345678-abcd-1234-abcd-123456789abc";

// ── 網址解析 ──
{
  const page = P.parse("https://chatgpt.com/g/" + pid + "-my-thesis/project");
  assert.equal(page.project_id, pid);
  assert.equal(page.slug, pid + "-my-thesis");
  assert.equal(page.on_project_page, true);
  assert.equal(page.conversation_id, null);
  assert.equal(page.project_url, "https://chatgpt.com/g/" + pid + "-my-thesis/project");

  const conv = P.parse("https://chatgpt.com/g/" + pid + "-x/c/" + uuid.toUpperCase() + "?model=gpt");
  assert.equal(conv.project_id, pid);
  assert.equal(conv.conversation_id, uuid);
  assert.equal(conv.on_project_page, false);

  assert.equal(P.parse("https://chat.openai.com/g/" + pid + "/project").slug, pid);
  // 不是專案：一般對話、GPTs、其他網站、http
  for (const bad of [
    "https://chatgpt.com/c/" + uuid,
    "https://chatgpt.com/g/g-abc123-some-gpt/c/" + uuid,
    "https://evil.example/g/" + pid + "/project",
    "http://chatgpt.com/g/" + pid + "/project",
    "not a url", ""
  ]) assert.equal(P.parse(bad), null, bad);

  assert.equal(P.conversationUrl({ slug: pid + "-x" }, uuid), "https://chatgpt.com/g/" + pid + "-x/c/" + uuid);
  assert.equal(P.conversationUrl(null, uuid), "https://chatgpt.com/c/" + uuid);
}

// ── 注入函式：用假的 fetch / document 跑內部介面那條路 ──
function fakeEnv(routes) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => (typeof hit[1] === "function" ? hit[1](url) : hit[1]) };
  };
  global.document = { querySelectorAll: () => [], querySelector: () => null, body: null };
  global.location = { pathname: "/" };
  global.chrome = { runtime: { sendMessage: () => {} } };
  return calls;
}

(async () => {
  // 專案對話清單：分頁到 cursor 為 null
  const pages = {
    "0": { items: [{ id: uuid, title: "第一段", create_time: 1700000000, update_time: 1700000100 },
                   { id: "not-a-uuid", title: "x" }], cursor: "abc" },
    "abc": { items: [{ id: "22222222-abcd-1234-abcd-123456789abc", title: "第二段", create_time: "2024-01-02T00:00:00Z" }], cursor: null }
  };
  let calls = fakeEnv([
    [/\/api\/auth\/session/, { accessToken: "t" }],
    [/\/backend-api\/gizmos\/g-p-[^/]+\/conversations/, (url) => pages[new URL(url, "https://x").searchParams.get("cursor")]]
  ]);
  const res = await P.listChatgptProjectChats(pid);
  assert.equal(res.via, "api");
  assert.equal(res.chats.length, 2);
  assert.equal(res.chats[0].id, uuid);
  assert.equal(res.chats[0].started_at, new Date(1700000000 * 1000).toISOString());
  assert.equal(res.chats[1].title, "第二段");
  assert.ok(calls.some((u) => u.includes("/backend-api/gizmos/" + pid + "/conversations?cursor=abc")));

  // 專案清單：從巢狀回應裡找出 g-p- 專案
  calls = fakeEnv([
    [/\/api\/auth\/session/, { accessToken: "t" }],
    [/\/backend-api\/gizmos\/snorlax\/sidebar/, {
      items: [
        { gizmo: { gizmo: { id: pid, short_url: pid + "-my-thesis", display: { name: "論文" } } },
          conversations: { items: [{ id: uuid, gizmo_id: pid }] } },
        { gizmo: { gizmo: { id: "g-p-fedcba9876543210fedcba9876543210", display: { name: "AT" } } } }
      ],
      cursor: null
    }]
  ]);
  const pr = await P.listChatgptProjects();
  assert.equal(pr.projects.length, 2);
  const thesis = pr.projects.find((p) => p.project_id === pid);
  assert.equal(thesis.name, "論文");
  assert.equal(thesis.project_url, "https://chatgpt.com/g/" + pid + "-my-thesis/project");
  assert.equal(pr.projects.find((p) => p.name === "AT").project_url,
    "https://chatgpt.com/g/g-p-fedcba9876543210fedcba9876543210/project");

  // 擴充接線：批量頁和 popup 都載入了這個檔案
  const dir = path.join(__dirname, "..");
  for (const html of ["batch.html", "popup.html"]) {
    assert.ok(fs.readFileSync(path.join(dir, html), "utf8").includes('src="chatgpt-project.js"'), html);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  assert.ok((manifest.optional_host_permissions || []).includes("https://chatgpt.com/*"));

  console.log("chatgpt-project tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
