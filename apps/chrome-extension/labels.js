// After-thinking Capture — 對話的處理狀態、自訂標籤和備註（inbox/labels.json）
// 跟擷取紀錄（index.jsonl）分開存：擷取紀錄是程式寫的，這個檔案是使用者自己的整理狀態，
// 兩邊各寫各的，不會互相蓋掉。
// 存檔時用 commitFiles 的 updates：提交當下讀倉庫裡最新的版本，只套上這次改過的部分。

const LABELS_PATH = "inbox/labels.json";
const LABELS_FORMAT = "after-thinking/conversation-labels";
const STATUS_TEXT = { todo: "未處理", done: "已整理", skip: "不用整理" };
const SKIP_REASONS = { chat: "閒聊", duplicate: "重複了", no_info: "沒什麼資訊", other: "其他" };
const LABEL_COLORS = [
  { bg: "#E6EBFB", fg: "#1F3487", line: "#3451C7" },
  { bg: "#FCE9D8", fg: "#7E3A05", line: "#C9600F" },
  { bg: "#DDF1EA", fg: "#145243", line: "#1F8A70" },
  { bg: "#F2E4F6", fg: "#5F2470", line: "#9B4DB0" },
  { bg: "#FAE3EC", fg: "#7A1D44", line: "#B8336A" },
  { bg: "#EEF2D9", fg: "#3C470A", line: "#5B6B12" },
  { bg: "#DFEEF8", fg: "#11486B", line: "#1D6FA3" },
  { bg: "#F6ECD6", fg: "#5A3B00", line: "#8A5A00" }
];

function emptyLabels() {
  return { format: LABELS_FORMAT, format_version: 1, labels: [], conversations: {} };
}

function parseLabels(raw) {
  if (!raw) return emptyLabels();
  let o;
  try { o = JSON.parse(raw); } catch (e) { throw new Error(LABELS_PATH + " 不是正確的 JSON，請先修好或刪掉它"); }
  const d = emptyLabels();
  if (Array.isArray(o.labels)) d.labels = o.labels.filter((l) => l && l.id).map((l) => ({ id: String(l.id), name: String(l.name || ""), color: Number(l.color) || 0 }));
  if (o.conversations && typeof o.conversations === "object") d.conversations = o.conversations;
  return d;
}

async function readLabels(config, branch) {
  return parseLabels(await readRawFile(config, branch, LABELS_PATH));
}

const convState = (data, folder) => Object.assign({ status: "todo", labels: [], note: "" }, data.conversations[folder] || {});

// 本機改了、還沒存進倉庫的部分。存的時候套在最新版本上，所以別的視窗同時改別段對話也不會被蓋掉
function makeLabelsStore(config, branch, data) {
  const store = {
    data,
    pending: {},          // folder → 這次改過的欄位
    labelsChanged: false, // 標籤清單（名稱、顏色、順序）改過
    saving: false,
    timer: null,
    onState: () => {},    // (狀態文字, 是不是錯誤)
    get(folder) { return convState(store.data, folder); },
    set(folder, patch) {
      const cur = store.data.conversations[folder] || {};
      const next = Object.assign({}, cur, patch, { updated_at: new Date().toISOString() });
      if (next.status === "todo") delete next.status;
      if (next.status !== "skip") { delete next.skip_reason; delete next.skip_note; }
      if (Array.isArray(next.labels) && !next.labels.length) delete next.labels;
      if (next.note === "") delete next.note;
      store.data.conversations[folder] = next;
      store.pending[folder] = Object.assign({}, store.pending[folder], patch, { updated_at: next.updated_at });
      store.later();
    },
    setLabels(labels) {
      store.data.labels = labels;
      store.labelsChanged = true;
      store.later();
    },
    later(ms) {
      clearTimeout(store.timer);
      store.onState("還沒存", false);
      store.timer = setTimeout(store.save, ms === undefined ? 1500 : ms);
    },
    dirty() { return store.labelsChanged || Object.keys(store.pending).length > 0; },
    async save() {
      clearTimeout(store.timer);
      if (!store.dirty()) return true;
      if (store.saving) { store.later(800); return false; }
      store.saving = true;
      const pending = store.pending, labelsChanged = store.labelsChanged, labels = store.data.labels;
      store.pending = {}; store.labelsChanged = false;
      store.onState("儲存中…", false);
      let committed = null;
      try {
        await commitFiles(config, branch, [], "After-thinking: update conversation labels", null, [{
          path: LABELS_PATH,
          fn: (raw) => {
            const latest = parseLabels(raw);
            if (labelsChanged) latest.labels = labels;
            const known = new Set(latest.labels.map((l) => l.id));
            Object.entries(pending).forEach(([folder, patch]) => {
              const next = Object.assign({}, latest.conversations[folder] || {}, patch);
              if (next.status === "todo") delete next.status;
              if (next.status !== "skip") { delete next.skip_reason; delete next.skip_note; }
              if (Array.isArray(next.labels)) next.labels = next.labels.filter((id) => known.has(id));
              if (Array.isArray(next.labels) && !next.labels.length) delete next.labels;
              if (next.note === "") delete next.note;
              const keys = Object.keys(next).filter((k) => k !== "updated_at");
              if (keys.length) latest.conversations[folder] = next; else delete latest.conversations[folder];
            });
            committed = latest;
            return JSON.stringify(latest, null, 2) + "\n";
          }
        }]);
        // 畫面改用倉庫裡最新的版本（含別的視窗存的），再疊上儲存途中又改的部分
        if (committed) {
          if (store.labelsChanged) committed.labels = store.data.labels;
          Object.keys(store.pending).forEach((f) => {
            if (store.data.conversations[f]) committed.conversations[f] = store.data.conversations[f];
            else delete committed.conversations[f];
          });
          store.data = committed;
        }
        store.onState(store.dirty() ? "還沒存" : "已儲存", false);
        if (store.dirty()) store.later();
        return true;
      } catch (e) {
        // 沒存成的部分放回去，下次一起存
        Object.entries(pending).forEach(([f, p]) => { store.pending[f] = Object.assign({}, p, store.pending[f]); });
        if (labelsChanged) store.labelsChanged = true;
        store.onState("儲存失敗：" + e.message, true);
        return false;
      } finally {
        store.saving = false;
      }
    }
  };
  window.addEventListener("beforeunload", (e) => { if (store.dirty()) { store.save(); e.preventDefault(); e.returnValue = ""; } });
  return store;
}
