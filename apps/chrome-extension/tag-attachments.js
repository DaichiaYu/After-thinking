// Attachment viewer for the After-thinking tagging workspace.
// Displays attachments in their original messages. No third-party server.
const ATAttachments = (() => {
  const MAX_BYTES = 25 * 1024 * 1024;
  const MAX_TEXT_PREVIEW = 2 * 1024 * 1024;
  const promises = new Map();
  const urls = new Map();
  let activeContext = null;
  const $dialog = () => document.getElementById("attachment-preview");
  const dom = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function pathFor(att) {
    const path = String(att.file || "");
    if (!/^attachments\/[A-Za-z0-9._-]+$/.test(path) || path.includes("..")) return null;
    return path;
  }
  function kindOf(att) {
    if (att.kind === "image" || att.kind === "generated_image") return T("att.image");
    return T("att.file");
  }
  function labelOf(att, index) {
    return att.name || (pathFor(att) ? pathFor(att).split("/").pop() : kindOf(att) + " " + (index + 1));
  }
  function extension(att) {
    const name = (att.content_note === "extracted_text" ? att.file : (att.name || att.file || "")).split("/").pop();
    return (name.match(/\.([a-z0-9]{1,10})$/i) || [,""])[1].toLowerCase();
  }
  function typeOf(att, bytes) {
    if (bytes.length > 7 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png";
    if (bytes.length > 2 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
    if (bytes.length > 5 && String.fromCharCode(...bytes.subarray(0,6)).match(/^GIF8[79]a$/)) return "image/gif";
    if (bytes.length > 11 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF" &&
        String.fromCharCode(...bytes.subarray(8,12)) === "WEBP") return "image/webp";
    if (bytes.length > 4 && String.fromCharCode(...bytes.subarray(0,5)) === "%PDF-") return "application/pdf";
    if (/^(txt|md|markdown|json|jsonl|ya?ml|csv|tsv|xml|html?|css|js|ts|py|rb|go|java|c|cpp|h|cs|sql|sh|log|tex|srt|svg)$/.test(extension(att))) return "text/plain";
    return "application/octet-stream";
  }
  function reset() {
    promises.clear();
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
    activeContext = null;
    const dialog = $dialog();
    if (dialog?.open) dialog.close();
  }
  function ensureContext() {
    // Compare the actual loaded discussion, not its folder name:
    // reimporting a revised ZIP into the same folder must invalidate cached bytes and blob URLs.
    if (ctx !== activeContext) { reset(); activeContext = ctx; }
  }
  function decodeBase64(base64, maxBytes) {
    const clean = String(base64 || "").replace(/\s+/g, "");
    if (clean.length > Math.ceil(maxBytes / 3) * 4 + 16) throw new Error(T("att.attachment_exceeds_the_preview_size_limit"));
    const output = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let at = 0;
    // atob() on multi-megabyte files can stall the UI; decode in bounded chunks.
    for (let k = 0; k < clean.length; k += 65536) {
      const part = atob(clean.slice(k, k + 65536));
      for (let n = 0; n < part.length; n++) output[at++] = part.charCodeAt(n);
      if (at > maxBytes) throw new Error(T("att.attachment_exceeds_the_preview_size_limit"));
    }
    return output.slice(0, at);
  }
  async function fromGithub(path) {
    const url = "https://api.github.com/repos/" + config.repo + "/contents/" +
      (ctx.folder + "source/" + path).split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch);
    const headers = { Authorization: "Bearer " + config.token, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28" };
    const response = await fetch(url, { headers, cache: "no-store" });
    if (response.status === 404) throw new Error(T("att.original_attachment_file_not_found_on"));
    if (!response.ok) throw new Error(T("att.could_not_read_attachment_from_github", response.status));
    const entry = await response.json();
    if (entry.type !== "file") throw new Error(T("att.attachment_path_is_not_a_file"));
    if (entry.size > MAX_BYTES) throw new Error(T("att.attachment_exceeds_the_25_mb_viewing"));
    if (entry.encoding === "base64" && entry.content) return decodeBase64(entry.content, MAX_BYTES);
    if (!/^[0-9a-f]{40}$/.test(entry.sha || "")) throw new Error(T("att.github_did_not_return_readable_attachment"));
    // Contents API does not inline base64 for larger objects; request blob by SHA.
    const blob = await fetch("https://api.github.com/repos/" + config.repo + "/git/blobs/" + entry.sha,
      { headers, cache: "no-store" });
    if (!blob.ok) throw new Error(T("att.could_not_read_attachment_content_from", blob.status));
    const data = await blob.json();
    if (data.encoding !== "base64") throw new Error(T("att.attachment_encoding_returned_by_github_is"));
    return decodeBase64(data.content, MAX_BYTES);
  }
  async function getBytes(att) {
    ensureContext();
    const path = pathFor(att);
    if (!path) throw new Error(T("att.this_record_has_no_original_attachment"));
    if (!promises.has(path)) {
      const promise = (async () => {
        let bytes;
        if (ctx.kind === "zip") {
          bytes = ctx.bundleEntries.get(ctx.bundlePrefix + "source/" + path);
          if (!bytes) throw new Error(T("att.attachment_not_found_in_the_zip"));
        } else if (ctx.kind === "repo") {
          bytes = await fromGithub(path);
        } else {
          const file = ctx.looseAttachments?.get(path.split("/").pop());
          if (!file) throw new Error(T("att.original_attachment_file_not_provided_use"));
          if (file.size > MAX_BYTES) throw new Error(T("att.attachment_exceeds_the_25_mb_viewing"));
          bytes = new Uint8Array(await file.arrayBuffer());
        }
        if (bytes.length > MAX_BYTES) throw new Error(T("att.attachment_exceeds_the_25_mb_viewing"));
        return bytes;
      })().catch(err => { promises.delete(path); throw err; });
      promises.set(path, promise);
    }
    return promises.get(path);
  }
  async function openResource(att) {
    const current = ctx;
    const path = pathFor(att);
    const bytes = await getBytes(att);
    if (ctx !== current) throw new Error(T("att.the_conversation_was_switched_open_the"));
    if (!urls.has(path)) urls.set(path, URL.createObjectURL(new Blob([bytes], { type: typeOf(att, bytes) })));
    return { url: urls.get(path), bytes, type: typeOf(att, bytes) };
  }
  function download(att, url) {
    const a = document.createElement("a");
    a.href = url;
    const sourceName = labelOf(att, 0);
    const actualName = att.content_note === "extracted_text"
      ? T("att.extracted_text_txt", sourceName.replace(/\.[^.]+$/, ""))
      : sourceName;
    a.download = actualName.replace(/[\\/]/g, "_").replace(/[^\w.\- \u4e00-\u9fff\u3040-\u30ff]/g, "_");
    document.body.append(a); a.click(); a.remove();
  }
  function showModal(att, resource) {
    const dialog = $dialog();
    if (!dialog) return;
    const title = dialog.querySelector("#attachment-preview-title");
    const content = dialog.querySelector("#attachment-preview-body");
    const save = dialog.querySelector("#attachment-preview-download");
    title.textContent = labelOf(att, 0);
    content.replaceChildren();
    if (resource.type.startsWith("image/")) {
      const img = dom("img","attachment-large");
      img.alt = labelOf(att, 0); img.src = resource.url;
      content.append(img);
    } else if (resource.type === "application/pdf") {
      const iframe = dom("iframe","attachment-pdf");
      iframe.title = T("att.pdf_preview"); iframe.src = resource.url;
      content.append(iframe,dom("p","attachment-hint",T("att.if_the_pdf_does_not_display")));
    } else if (resource.type === "text/plain" && resource.bytes.length <= MAX_TEXT_PREVIEW) {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(resource.bytes);
        content.append(dom("pre","attachment-text-preview",text));
      } catch (e) {
        content.append(dom("p","attachment-hint",T("att.the_original_file_is_not_valid")));
      }
    } else {
      content.append(dom("p","attachment-hint",T("att.no_built_in_preview_for_this")));
    }
    save.onclick = () => download(att, resource.url);
    if (!dialog.open) dialog.showModal();
  }
  function button(label, run) {
    const b = dom("button","attachment-action",label);
    b.type = "button";
    b.addEventListener("click",event=>{event.stopPropagation();run();});
    return b;
  }
  function renderCard(att, index) {
    const card = dom("div","attachment-card");
    const heading = dom("div","attachment-card-info");
    const label = labelOf(att,index),path = pathFor(att);
    heading.append(dom("span","attachment-file-name",label));
    heading.append(dom("span","attachment-file-kind",kindOf(att) + (att.content_note === "extracted_text" ? T("att.only_the_extracted_text_provided_by") : "")));
    card.append(heading);
    const actions = dom("div","attachment-card-actions");
    const status = dom("span","attachment-card-status");
    const knownMissing = !path || (ctx.kind === "zip" && !ctx.bundleEntries.has(ctx.bundlePrefix + "source/" + path));
    if (knownMissing) {
      status.textContent = T("att.original_file_not_available_cannot_preview", (att.missing ? "（" + att.missing + "）" : ""));
      card.classList.add("attachment-missing");
      actions.append(status);
    } else {
      const preview = button(T("att.preview"),async()=>{
        preview.disabled = true; status.textContent = T("att.loading");
        try { showModal(att,await openResource(att)); status.textContent = ""; }
        catch(e) { status.textContent = e.message; }
        preview.disabled = false;
      });
      const save = button(T("att.download"),async()=>{
        save.disabled = true; status.textContent = T("att.preparing");
        try { const r = await openResource(att); download(att,r.url); status.textContent = ""; }
        catch(e) { status.textContent = e.message; }
        save.disabled = false;
      });
      actions.append(preview,save,status);
      const media = dom("div","attachment-image-wrap");
      const image = dom("img","attachment-thumbnail");
      image.alt = T("att.attached_image", label); image.loading = "lazy";
      media.append(image);
      let loaded = false;
      const loadThumbnail = async()=>{
        if (loaded) return;
        loaded = true;
        try {
          const r = await openResource(att);
          if (!r.type.startsWith("image/")) return;
          image.src = r.url; media.hidden = false;
          image.onclick = event=>{event.stopPropagation();showModal(att,r);};
        } catch(e) { status.textContent = e.message; }
      };
      media.hidden = true; card.append(media);
      if (att.kind === "image" || att.kind === "generated_image" || /^(png|jpe?g|webp|gif)$/.test(extension(att))) {
        if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver(entries=>{
            if (entries.some(entry=>entry.isIntersecting)) {observer.disconnect();loadThumbnail();}
          },{rootMargin:"220px"});
          observer.observe(card);
        } else loadThumbnail();
      }
    }
    card.append(actions);
    return card;
  }
  function renderRows() {
    if (!ctx || !msgs?.length) return;
    ensureContext();
    document.querySelectorAll("#list .msg[data-mid]").forEach(row=>{
      const i = msgs.findIndex(m=>m.id===row.dataset.mid);
      if (i < 0 || !msgs[i].attachments?.length) return;
      const body = row.querySelector(".body"), actions = body?.querySelector(".actions");
      if (!body || !actions) return;
      const group = dom("section","message-attachments");
      group.setAttribute("aria-label",T("att.message_attachments"));
      group.append(dom("div","attachment-section-title",T("att.attachment", msgs[i].attachments.length)));
      msgs[i].attachments.forEach((a,n)=>group.append(renderCard(a,n)));
      actions.before(group);
    });
  }
  const prevRenderList = renderList;
  renderList = function() {
    prevRenderList();
    renderRows();
  };
  const closeButton = document.getElementById("attachment-preview-close");
  if (closeButton) closeButton.addEventListener("click",() => $dialog()?.close());
  window.addEventListener("beforeunload",reset);
  return { reset, getBytes, typeOf, pathFor };
})();
