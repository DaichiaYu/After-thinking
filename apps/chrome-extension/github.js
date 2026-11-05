// After-thinking Capture — GitHub 上傳
// 只和使用者自己設定的那一個倉庫溝通，不經過任何第三方伺服器。

const STATE_TEMPLATE = `workflow_version: "0.1"
analysis_status: active

workspace:
  analysis_repository: {{repo}}
  analysis_root: {{root}}
  discussion_id: {{id}}
  discussion_path: {{path}}

source:
  revision: 1  # mirror of source/metadata.yaml.source_revision
  conversation_path: "source/conversation.jsonl"
  metadata_path: "source/metadata.yaml"

current_stage: 1
next_action:
  type: run_stage
  stage: 1
  reason: initialized

id_counters:
  topic: 0
  reasoning_turn: 0
  claim: 0
  cognitive_structure: 0
  gap: 0
  direction: 0
  correction: 0

identity_state:
  retired_objects: []

stages:
{{stages}}
correction_state:
  registry_path: "corrections.yaml"
  unresolved_conflicts: []
`;

const STAGES = [
  [1, "mandatory", "pending", "analysis/01-scope-origin.md"],
  [2, "mandatory", "pending", "analysis/02-topic-map.md"],
  [3, "risk_based", "pending", "analysis/03-claims.yaml"],
  [4, "risk_based", "pending", "analysis/04-cognitive-structure.md"],
  [5, "risk_based", "pending", "analysis/05-gaps.yaml"],
  [6, "none", "not_required", "analysis/06-next-directions.md"]
];

function normalizeRoot(root) {
  const r = (root || "discussions/").trim().replace(/^\/+/, "");
  return r ? r.replace(/\/*$/, "/") : "";
}

function buildState(config, id) {
  const q = (s) => JSON.stringify(s);
  const root = normalizeRoot(config.root);
  const stages = STAGES.map(([n, policy, review, path]) => [
    "  stage_" + n + ":",
    "    execution_status: pending",
    "    review_policy: " + policy,
    "    review_status: " + review,
    "    confirmation: null",
    "    output_path: " + q(path),
    "    source_revision: null",
    "    applied_corrections: []",
    "    completion: {exit_criteria_met: false, blocking_items: [], nonblocking_uncertainties: [], stop_reason: null}"
  ].join("\n")).join("\n");
  return STATE_TEMPLATE
    .replace("{{repo}}", q(config.repo))
    .replace("{{root}}", q(root))
    .replace("{{id}}", q(id))
    .replace("{{path}}", q(root + id + "/"))
    .replace("{{stages}}", stages);
}

const CORRECTIONS_TEMPLATE = 'workflow_version: "0.1"\ncorrections: []\n';

async function gh(token, method, path, body) {
  const res = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, ok: res.ok, json };
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

// 檢查倉庫：存不存在、是不是私人、能不能寫入
async function checkRepo(config) {
  if (!config || !config.repo || !config.token) return { ok: false, message: "還沒設定 GitHub 倉庫或存取金鑰。" };
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo)) return { ok: false, message: "倉庫格式應該是「帳號/倉庫名稱」。" };
  const r = await gh(config.token, "GET", "/repos/" + config.repo);
  if (r.status === 401) return { ok: false, message: "存取金鑰無效或已過期。" };
  if (r.status === 404 || r.status === 403) return { ok: false, message: "找不到這個倉庫，或存取金鑰沒有它的權限。" };
  if (!r.ok) return { ok: false, message: "GitHub 回應錯誤（" + r.status + "）。" };
  const repo = r.json;
  if (!repo.private) return { ok: false, message: "這是公開（public）倉庫。為了保護對話內容，只允許上傳到私人（private）倉庫。" };
  if (repo.permissions && repo.permissions.push === false) return { ok: false, message: "存取金鑰沒有寫入權限。請把 Contents 權限設為 Read and write。" };
  return { ok: true, private: true, branch: config.branch || repo.default_branch, defaultBranch: repo.default_branch };
}

async function pathExists(config, branch, path) {
  const r = await gh(config.token, "GET",
    "/repos/" + config.repo + "/contents/" + encodePath(path.replace(/\/$/, "")) + "?ref=" + encodeURIComponent(branch));
  if (r.status === 404) return false;
  if (r.ok) return true;
  throw new Error("無法確認資料夾是否存在（" + r.status + "）");
}

// 用一個 commit 一次寫入所有檔案，避免只上傳一半。
// updateIndex（可省略）：(擷取紀錄的每一行) => 新的每一行，或 null 表示不改。
// 擷取紀錄一定要在提交當下、從最新的那個提交讀，不能用之前讀到的舊副本，
// 不然批量擷取、單段擷取、標記頁同時在寫時，會互相蓋掉對方的紀錄。
// 分支在這期間被別人更新（422）時，重新讀、重新算，最多試 4 次。
// updates（可省略）：[{ path, fn }]，其他也要「提交當下從最新版本讀、再改」的檔案（例如 inbox/labels.json）。
// fn(目前內容或 null) => 新內容，或 null 表示不改。
async function commitFiles(config, branch, files, message, updateIndex, updates) {
  for (let attempt = 0; ; attempt++) {
    try { return await commitOnce(config, branch, files, message, updateIndex, updates); }
    catch (e) {
      if (!e.conflict || attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 + attempt * 1500));
    }
  }
}

async function commitOnce(config, branch, files, message, updateIndex, updates) {
  const repo = "/repos/" + config.repo;
  const ref = await gh(config.token, "GET", repo + "/git/ref/heads/" + encodeURIComponent(branch));
  if (ref.status === 404 || ref.status === 409) throw new Error("倉庫是空的或找不到分支「" + branch + "」。請先在 GitHub 上為倉庫建立一個 README。");
  if (!ref.ok) throw new Error("讀取分支失敗（" + ref.status + "）");
  const parentSha = ref.json.object.sha;
  const parent = await gh(config.token, "GET", repo + "/git/commits/" + parentSha);
  if (!parent.ok) throw new Error("讀取最新提交失敗（" + parent.status + "）");
  files = files.slice();
  if (updateIndex) {
    const rows = updateIndex(parseCaptureIndex(await readRawFile(config, parentSha, CAPTURE_INDEX_PATH)));
    if (rows) files.push({ path: CAPTURE_INDEX_PATH, content: serializeCaptureIndex(rows) });
  }
  for (const u of updates || []) {
    const content = u.fn(await readRawFile(config, parentSha, u.path));
    if (content !== null && content !== undefined) files.push({ path: u.path, content });
  }
  if (!files.length) return parentSha;   // 沒有要改的
  // 圖片等二進位檔要先建立 blob，再放進樹裡
  const entries = [];
  for (const f of files) {
    if (f.base64 !== undefined) {
      const blob = await gh(config.token, "POST", repo + "/git/blobs", { content: f.base64, encoding: "base64" });
      if (!blob.ok) throw new Error("上傳附件失敗（" + blob.status + "）");
      entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.json.sha });
    } else {
      entries.push({ path: f.path, mode: "100644", type: "blob", content: f.content });
    }
  }
  const tree = await gh(config.token, "POST", repo + "/git/trees", { base_tree: parent.json.tree.sha, tree: entries });
  if (!tree.ok) throw new Error("建立檔案失敗（" + tree.status + "）");
  const commit = await gh(config.token, "POST", repo + "/git/commits", {
    message, tree: tree.json.sha, parents: [parentSha]
  });
  if (!commit.ok) throw new Error("建立提交失敗（" + commit.status + "）");
  const update = await gh(config.token, "PATCH", repo + "/git/refs/heads/" + encodeURIComponent(branch), { sha: commit.json.sha });
  if (update.status === 422) { const e = new Error("上傳時倉庫剛好有其他更新，請再試一次。"); e.conflict = true; throw e; }
  if (!update.ok) throw new Error("更新分支失敗（" + update.status + "）");
  return commit.json.sha;
}

async function loadConfig() {
  const { githubConfig } = await chrome.storage.local.get("githubConfig");
  return githubConfig || null;
}

// ── 擷取紀錄：inbox/index.jsonl ──
// 每擷取一次（批量或單段）就記一行，用來判斷「這段對話抓過了沒」。
// 同一段對話可以有多行（例如先批量進 inbox/，之後又單段擷取到 discussions/）。

const CAPTURE_INDEX_PATH = "inbox/index.jsonl";

async function readRawFile(config, branch, path) {
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

function parseCaptureIndex(raw) {
  if (!raw) return [];
  return raw.split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(Boolean);
}

// 只用來顯示（例如「抓過了沒」）；要寫回去時改用 commitFiles 的 updateIndex
async function readCaptureIndex(config, branch) {
  return parseCaptureIndex(await readRawFile(config, branch, CAPTURE_INDEX_PATH));
}

const captureKey = (row) => row.platform + ":" + row.conversation_id;

// 同一個資料夾重新擷取時取代舊的那行；不同資料夾就新增一行。
// 標記（outline.json）還在資料夾裡，所以舊那行的標記紀錄要留著
const KEEP_ON_RECAPTURE = ["outline_updated_at", "outline_mode"];
function upsertCaptureRow(rows, entry) {
  const same = (r) => captureKey(r) === captureKey(entry) && r.folder === entry.folder;
  const old = rows.find(same);
  const row = Object.assign({}, entry);
  if (old) KEEP_ON_RECAPTURE.forEach((k) => { if (old[k] !== undefined && row[k] === undefined) row[k] = old[k]; });
  return rows.filter((r) => !same(r)).concat([row]);
}

const serializeCaptureIndex = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
