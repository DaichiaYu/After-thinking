const fields = ["repo", "branch", "root", "token"];
const result = document.getElementById("result");

async function init() {
  const config = await loadConfig();
  if (!config) return;
  fields.forEach((f) => { if (config[f] !== undefined) document.getElementById(f).value = config[f]; });
}

document.getElementById("save").addEventListener("click", async () => {
  const config = Object.fromEntries(fields.map((f) => [f, document.getElementById(f).value.trim()]));
  config.root = normalizeRoot(config.root);
  result.className = "";
  result.textContent = "測試連線中…";
  try {
    const check = await checkRepo(config);
    if (!check.ok) { result.className = "error"; result.textContent = "沒有儲存：" + check.message; return; }
    await chrome.storage.local.set({ githubConfig: config });
    result.className = "ok";
    result.textContent = "已儲存。連線成功：私人倉庫、可以寫入，上傳到分支「" + check.branch + "」的 " + config.root;
  } catch (e) {
    result.className = "error";
    result.textContent = "連線失敗：" + e.message;
  }
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.remove("githubConfig");
  fields.forEach((f) => { document.getElementById(f).value = f === "root" ? "discussions/" : ""; });
  result.className = "";
  result.textContent = "已清除設定，存取金鑰已從這台電腦刪除。";
});

init();
