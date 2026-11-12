// After-thinking Capture — 本機 ZIP 資料包（ZIP32, Store / 無壓縮）
// 不使用外部服務或第三方套件。Chrome 可直接產生、讀取 ZIP。
// 使用 Store 是為了保留圖片等二進位附件，並避免依賴瀏覽器不一致的壓縮 API。
const ATBundle = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const MAX_ENTRIES = 1000;
  const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let i = 0; i < 8; i++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const u16 = (v, at, x) => v.setUint16(at, x, true);
  const u32 = (v, at, x) => v.setUint32(at, x >>> 0, true);
  function validPath(name) {
    return typeof name === "string" && name && !name.startsWith("/") &&
      !name.includes("\\") && !name.split("/").includes("..") && !name.split("/").includes(".") &&
      !name.includes("\0") && !name.endsWith("/");
  }
  function bytesOf(data) {
    if (typeof data === "string") return encoder.encode(data);
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error("ZIP 項目不是文字或位元組資料");
  }
  function pack(entries) {
    if (!Array.isArray(entries) || !entries.length || entries.length > MAX_ENTRIES) throw new Error("資料包項目數不正確");
    const parts = [], directory = [], seen = new Set();
    let offset = 0, total = 0;
    for (const entry of entries) {
      const name = entry.path;
      if (!validPath(name) || seen.has(name)) throw new Error("資料包路徑重複或不安全：" + name);
      seen.add(name);
      const fname = encoder.encode(name), data = bytesOf(entry.data);
      total += data.length;
      if (total > MAX_TOTAL_BYTES || data.length > 0xffffffff) throw new Error("資料包過大，無法安全壓縮");
      const crc = crc32(data), local = new Uint8Array(30 + fname.length);
      const lv = new DataView(local.buffer);
      u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0x0800);
      u16(lv, 8, 0); u16(lv, 10, 0); u16(lv, 12, 0);
      u32(lv, 14, crc); u32(lv, 18, data.length); u32(lv, 22, data.length);
      u16(lv, 26, fname.length); u16(lv, 28, 0);
      local.set(fname, 30);
      parts.push(local, data);
      directory.push({ name: fname, size: data.length, crc, offset });
      offset += local.length + data.length;
    }
    const centralStart = offset;
    for (const item of directory) {
      const buf = new Uint8Array(46 + item.name.length), view = new DataView(buf.buffer);
      u32(view, 0, 0x02014b50); u16(view, 4, 20); u16(view, 6, 20);
      u16(view, 8, 0x0800); u16(view, 10, 0); u16(view, 12, 0); u16(view, 14, 0);
      u32(view, 16, item.crc); u32(view, 20, item.size); u32(view, 24, item.size);
      u16(view, 28, item.name.length); u16(view, 30, 0); u16(view, 32, 0);
      u16(view, 34, 0); u16(view, 36, 0); u32(view, 38, 0); u32(view, 42, item.offset);
      buf.set(item.name, 46);
      parts.push(buf);
      offset += buf.length;
    }
    if (offset > 0xffffffff || centralStart > 0xffffffff || directory.length > 65535) throw new Error("ZIP32 容量超過上限");
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0);
    u16(ev, 8, directory.length); u16(ev, 10, directory.length);
    u32(ev, 12, offset - centralStart); u32(ev, 16, centralStart); u16(ev, 20, 0);
    parts.push(end);
    return new Blob(parts, { type: "application/zip" });
  }
  // Chrome/其他下載管理器有時會把 ZIP 另存成 UUID、沒有 .zip 副檔名。
  // 只讀前 4 bytes 判斷 ZIP signature；不依賴檔名、MIME 或使用者重命名。
  async function looksLikeZip(file) {
    if (!file || typeof file.slice !== "function") return false;
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return head.length === 4 && head[0] === 0x50 && head[1] === 0x4b &&
      ((head[2] === 0x03 && head[3] === 0x04) ||
       (head[2] === 0x05 && head[3] === 0x06) ||
       (head[2] === 0x07 && head[3] === 0x08));
  }

  async function unpack(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
      if (view.getUint32(p, true) === 0x06054b50 && p + 22 + view.getUint16(p + 20, true) === bytes.length) {
        eocd = p; break;
      }
    }
    if (eocd < 0) throw new Error("無法辨識 ZIP 結構");
    const count = view.getUint16(eocd + 10, true);
    let at = view.getUint32(eocd + 16, true), total = 0;
    if (count > MAX_ENTRIES) throw new Error("ZIP 項目太多");
    const files = new Map();
    for (let i = 0; i < count; i++) {
      if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new Error("ZIP 目錄損壞");
      const method = view.getUint16(at + 10, true);
      const checksum = view.getUint32(at + 16, true);
      const compressed = view.getUint32(at + 20, true);
      const size = view.getUint32(at + 24, true);
      const nameLen = view.getUint16(at + 28, true);
      const extraLen = view.getUint16(at + 30, true);
      const commentLen = view.getUint16(at + 32, true);
      const localOffset = view.getUint32(at + 42, true);
      if (at + 46 + nameLen + extraLen + commentLen > bytes.length) throw new Error("ZIP 檔名長度不正確");
      const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
      at += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith("/")) continue;
      if (!validPath(name) || files.has(name)) throw new Error("ZIP 內含重複或不安全的路徑");
      total += size;
      if (total > MAX_TOTAL_BYTES) throw new Error("ZIP 解開後超過安全大小");
      if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("ZIP 項目損壞");
      const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      if (start + compressed > bytes.length) throw new Error("ZIP 資料不完整");
      let data;
      if (method === 0) {
        data = bytes.slice(start, start + compressed);
      } else if (method === 8 && typeof DecompressionStream !== "undefined") {
        const stream = new Blob([bytes.slice(start, start + compressed)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error("ZIP 使用未支援的壓縮格式。請改用 AT 下載的 ZIP，或解壓後選 conversation.jsonl。");
      }
      if (data.length !== size || crc32(data) !== checksum) throw new Error("ZIP 項目檢查失敗：" + name);
      files.set(name, data);
    }
    return files;
  }
  const decode = (bytes) => decoder.decode(bytes);
  return { pack, unpack, decode, looksLikeZip };
})();
