// After-thinking Capture — Gemini 資料記錄器
// 在 Gemini 頁面開始載入時執行（MAIN world）。只「旁聽」頁面自己向 Google 要的對話資料（batchexecute 回應），
// 存在這個分頁的記憶體裡，擷取時用來找原始時間。不會送出任何請求，也不會把資料傳到別的地方。
(() => {
  if (window.__atRecorder) return;
  const store = { responses: [], bytes: 0 };
  Object.defineProperty(window, "__atRecorder", { value: store, enumerable: false });
  const LIMIT = 40 * 1024 * 1024;
  const keep = (url, text) => {
    try {
      if (!/batchexecute/.test(url) || typeof text !== "string" || !text) return;
      if (store.bytes + text.length > LIMIT) return;
      store.responses.push(text);
      store.bytes += text.length;
    } catch (e) { /* 記錄失敗不能影響 Gemini 本身 */ }
  };

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { this.__atUrl = String(url); } catch (e) {}
    return open.apply(this, arguments);
  };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    try {
      this.addEventListener("load", () => {
        try {
          if (this.responseType === "" || this.responseType === "text") keep(this.__atUrl || "", this.responseText);
        } catch (e) {}
      });
    } catch (e) {}
    return send.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function (input) {
    let url = "";
    try { url = typeof input === "string" ? input : (input && input.url) || String(input); } catch (e) {}
    const p = origFetch.apply(this, arguments);
    if (/batchexecute/.test(url)) {
      p.then((res) => res.clone().text().then((t) => keep(url, t))).catch(() => {});
    }
    return p;
  };
})();
