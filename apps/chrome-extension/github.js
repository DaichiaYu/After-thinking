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

// 用一個 commit 一次寫入所有檔案，避免只上傳一半
async function commitFiles(config, branch, files, message) {
  const repo = "/repos/" + config.repo;
  const ref = await gh(config.token, "GET", repo + "/git/ref/heads/" + encodeURIComponent(branch));
  if (ref.status === 404 || ref.status === 409) throw new Error("倉庫是空的或找不到分支「" + branch + "」。請先在 GitHub 上為倉庫建立一個 README。");
  if (!ref.ok) throw new Error("讀取分支失敗（" + ref.status + "）");
  const parentSha = ref.json.object.sha;
  const parent = await gh(config.token, "GET", repo + "/git/commits/" + parentSha);
  if (!parent.ok) throw new Error("讀取最新提交失敗（" + parent.status + "）");
  const tree = await gh(config.token, "POST", repo + "/git/trees", {
    base_tree: parent.json.tree.sha,
    tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content }))
  });
  if (!tree.ok) throw new Error("建立檔案失敗（" + tree.status + "）");
  const commit = await gh(config.token, "POST", repo + "/git/commits", {
    message, tree: tree.json.sha, parents: [parentSha]
  });
  if (!commit.ok) throw new Error("建立提交失敗（" + commit.status + "）");
  const update = await gh(config.token, "PATCH", repo + "/git/refs/heads/" + encodeURIComponent(branch), { sha: commit.json.sha });
  if (update.status === 422) throw new Error("上傳時倉庫剛好有其他更新，請再試一次。");
  if (!update.ok) throw new Error("更新分支失敗（" + update.status + "）");
  return commit.json.sha;
}

async function loadConfig() {
  const { githubConfig } = await chrome.storage.local.get("githubConfig");
  return githubConfig || null;
}
