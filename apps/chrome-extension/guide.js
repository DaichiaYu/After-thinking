// After-thinking Capture — 倉庫根目錄的指引檔（AGENTS.md）
// 給之後來查資料的 AI（或人）看的地圖：資料夾怎麼排、每個檔案是什麼、怎麼找東西。
// 只有在檔案不存在、或是由本擴充功能產生且版本較舊時才會寫入；使用者自己寫的 AGENTS.md 不會被覆蓋。

const GUIDE_VERSION = 8;
const GUIDE_MARK = "<!-- managed-by: after-thinking-capture guide_version=";

// 指引內容在 repo-guide.md，{{ROOT}} 換成討論資料夾的位置
async function buildRepoGuide(config) {
  const res = await fetch(chrome.runtime.getURL("repo-guide.md"));
  const text = await res.text();
  return GUIDE_MARK + GUIDE_VERSION + " -->\n" + text.split("{{ROOT}}").join(normalizeRoot(config.root));
}

// 「請 AI 先標一版」的完整說明：放在倉庫裡，給 AI 的提示詞就只要寫倉庫、資料夾、原文和「照這份做」
const OUTLINE_AI_GUIDE_PATH = "guides/outline-ai.md";
const OUTLINE_AI_GUIDE_VERSION = 1;
const OUTLINE_AI_GUIDE_MARK = "<!-- managed-by: after-thinking-capture outline_ai_guide_version=";

// 指引內容在 outline-ai-guide.md。repoOnly=false 時拿掉只跟倉庫有關的段落（給下載檔用）
async function outlineAiGuideText(repoOnly) {
  const res = await fetch(chrome.runtime.getURL("outline-ai-guide.md"));
  let text = await res.text();
  if (repoOnly) text = text.replace(/<!-- \/?repo-only -->\n/g, "");
  else text = text.replace(/<!-- repo-only -->[\s\S]*?<!-- \/repo-only -->\n*/g, "");
  return text;
}

async function outlineAiGuideFile(config, branch) {
  const cur = await readRawFile(config, branch, OUTLINE_AI_GUIDE_PATH);
  if (cur !== null) {
    if (!cur.startsWith(OUTLINE_AI_GUIDE_MARK)) return null;   // 使用者自己改過、拿掉標記的，不覆蓋
    const m = cur.match(/outline_ai_guide_version=(\d+)/);
    if (m && Number(m[1]) >= OUTLINE_AI_GUIDE_VERSION) return null;
  }
  return { path: OUTLINE_AI_GUIDE_PATH, content: OUTLINE_AI_GUIDE_MARK + OUTLINE_AI_GUIDE_VERSION + " -->\n" + await outlineAiGuideText(true) };
}

const CLAUDE_POINTER = "請先讀同一層的 AGENTS.md：它說明這個倉庫的資料夾、檔案格式和找資料的方法。\n\n@AGENTS.md\n";

// 需要寫入或更新指引檔時，回傳要加進下一個提交的檔案；不需要時回傳空陣列
async function repoGuideFiles(config, branch) {
  const files = [];
  const agents = await readRawFile(config, branch, "AGENTS.md");
  if (agents === null) {
    files.push({ path: "AGENTS.md", content: await buildRepoGuide(config) });
  } else if (agents.startsWith(GUIDE_MARK)) {
    const m = agents.match(/guide_version=(\d+)/);
    if (!m || Number(m[1]) < GUIDE_VERSION) files.push({ path: "AGENTS.md", content: await buildRepoGuide(config) });
  }
  const claude = await readRawFile(config, branch, "CLAUDE.md");
  if (claude === null) files.push({ path: "CLAUDE.md", content: CLAUDE_POINTER });
  const outlineGuide = await outlineAiGuideFile(config, branch);
  if (outlineGuide) files.push(outlineGuide);
  return files;
}
