/* ============ AI 附件区 + 会自己长高的文字框（姊妹应用同一份：baby-log / homeschool / shepherd 的 js/attach.js，改一处同步另外两处） ============
   版式照爱家小助手的「录入购物」：一排缩略图（每张右上角 × 删除）+ 一个虚线的「📷 拍照 / 选图片或文件」格子；
   可以拍很多次、一次选很多张，最多 MAX 个附件；照片在浏览器里压缩成 JPEG，PDF 原样带上，.txt / .csv / .md 读成文字并进文字框后面一起发。
   下面一个文字框：粘贴多少字就长多高（到屏幕一半为止才出现滚动条）。
   optional 的用法：collapsible = true 时整块收在一个 <details> 里，默认收起，有内容时自动展开，标题上显示几项。
   用法：
     attachHTML(id, { t, esc, textLabel, ph, hint, collapsible, summary })   画出来（t / esc 由各应用传入，所以三个应用可以用同一个文件）
     attachPayload(id) → { images: [{ mime, b64 }], text }                 发给 AI 的内容（images 里也包括 PDF）
     attachReset(id)                                                         清空
     document 上的 "att-change" 事件（detail = id）：附件或文字变了，调用方可以更新按钮状态 */
const MAX = 8;
const ST = new Map();
function attachState(id){ if (!ST.has(id)) ST.set(id, { items: [], text: "", open: false, error: "", opts: null }); return ST.get(id); }
function attachReset(id){ ST.delete(id); }
const hasContent = id => { const s = attachState(id); return !!(s.items.length || s.text.trim()); };

function thumbsHTML(id){
  const s = attachState(id), { t, esc } = s.opts;
  const thumbs = s.items.map((it, i) => `<span class="att-thumb att-${it.kind}">${it.kind === "image" ? `<img src="${it.url}" alt="${esc(it.name || t("第 {n} 张", { n: i + 1 }))}">` : `<span class="att-doc"><span aria-hidden="true">${it.kind === "pdf" ? "📄" : "📝"}</span><small>${esc(it.name)}</small></span>`}<button type="button" class="att-del" data-att-del="${esc(id)}" data-i="${i}" aria-label="${esc(t("删除这个附件"))}">×</button></span>`).join("");
  const add = s.items.length < MAX ? `<label class="att-add"><input type="file" data-att="${esc(id)}" accept="image/*,application/pdf,text/plain,.txt,.csv,.md" multiple><span>📷 ${esc(t("拍照 / 选图片或文件"))}</span></label>` : "";
  return `<div class="att-thumbs">${thumbs}${add}</div>${s.error ? `<p class="att-err" role="alert">${esc(s.error)}</p>` : ""}`;
}
function attachHTML(id, opts){
  const s = attachState(id); s.opts = opts;
  const { t, esc, textLabel = "", ph = "", hint = "", collapsible = false, summary = "", rows = 2, after = "", noText = false } = opts;   // after：放在这一块最下面的 HTML（比如「让 AI 读出来」按钮）；noText：只要缩略图（问题框在外面，比如咩咩咩）
  const body = `${thumbsHTML(id)}${noText ? "" : `<label class="att-text">${textLabel ? `<span>${esc(textLabel)}</span>` : ""}<textarea data-att-text="${esc(id)}" data-autosize rows="${rows}" placeholder="${esc(ph)}">${esc(s.text)}</textarea></label>`}${hint ? `<p class="att-hint">${hint}</p>` : ""}${after}`;
  if (!collapsible) return `<div class="att" data-att-box="${esc(id)}">${body}</div>`;
  const n = s.items.length + (s.text.trim() ? 1 : 0), open = opts.forceOpen || (s.toggled ? s.open : n > 0);   // forceOpen：正在读取时别收起来
  return `<details class="att att-opt" data-att-box="${esc(id)}" ${open ? "open" : ""}><summary><span>${esc(summary)}</span>${n ? ` <span class="att-n">${n}</span>` : ""}</summary><div class="att-body">${body}</div></details>`;
}
/** 只换缩略图那一块（文字框不动，光标不跳） */
function repaint(id){
  const box = document.querySelector(`[data-att-box="${CSS.escape(id)}"]`); if (!box) return;
  const old = box.querySelector(".att-thumbs"); if (!old) return;
  const err = box.querySelector(".att-err"); if (err) err.remove();
  old.outerHTML = thumbsHTML(id);
  const n = box.querySelector(".att-n"), s = attachState(id), k = s.items.length + (s.text.trim() ? 1 : 0);
  if (n) { n.textContent = k; n.hidden = !k; } else if (k && box.tagName === "DETAILS") box.querySelector("summary").insertAdjacentHTML("beforeend", ` <span class="att-n">${k}</span>`);
  document.dispatchEvent(new CustomEvent("att-change", { detail: id }));
}

/* ---- 读文件：照片压缩成 JPEG；PDF 原样；文字文件读成字 ---- */
async function shrink(file, max = 1800){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("img")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", 0.85);
    return { kind: "image", name: file.name || "", mime: "image/jpeg", b64: data.split(",")[1], url: data };
  } finally { URL.revokeObjectURL(url); }
}
const readAs = (file, how) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r[how](file); });
async function readFile(file){
  const name = file.name || "", type = file.type || "";
  if (type.startsWith("image/")) return shrink(file);
  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    if (file.size > 10 * 1024 * 1024) throw new Error("big");
    return { kind: "pdf", name, mime: "application/pdf", b64: String(await readAs(file, "readAsDataURL")).split(",")[1] };
  }
  if (type.startsWith("text/") || /\.(txt|csv|md)$/i.test(name)) return { kind: "text", name, text: String(await readAs(file, "readAsText")).slice(0, 20000) };
  throw new Error("type");
}
/** 发给 AI 的：图片和 PDF 作为附件，文字框 + 文字文件拼成一段 */
function attachPayload(id){
  const s = attachState(id);
  const images = s.items.filter(x => x.kind === "image" || x.kind === "pdf").map(x => ({ mime: x.mime, b64: x.b64 }));
  const text = [s.text.trim(), ...s.items.filter(x => x.kind === "text").map(x => `[${x.name}]\n${x.text}`)].filter(Boolean).join("\n\n");
  return { images, text };
}

/* ---- 事件 ---- */
document.addEventListener("change", async ev => {
  const inp = ev.target; if (!inp || !inp.matches || !inp.matches("input[data-att]")) return;
  const id = inp.dataset.att, s = attachState(id), files = [...inp.files].slice(0, MAX - s.items.length); inp.value = "";
  s.error = "";
  for (const f of files) {
    try { s.items.push(await readFile(f)); }
    catch (e) { const tt = (s.opts && s.opts.t) || (x => x); s.error = e.message === "big" ? tt("PDF 太大了（最多 10 MB）") : e.message === "type" ? tt("只支持照片、PDF 和文字文件") : tt("这张图片打不开"); }
  }
  repaint(id);
});
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-att-del]"); if (!b) return;
  ev.preventDefault(); const s = attachState(b.dataset.attDel); s.items.splice(+b.dataset.i, 1); s.error = ""; repaint(b.dataset.attDel);
});
document.addEventListener("input", ev => {
  const el = ev.target; if (!el || !el.matches) return;
  if (el.matches("textarea[data-att-text]")) { attachState(el.dataset.attText).text = el.value; document.dispatchEvent(new CustomEvent("att-change", { detail: el.dataset.attText })); }
  if (el.matches("textarea[data-autosize]")) fit(el);
});
document.addEventListener("toggle", ev => { const d = ev.target; if (d && d.matches && d.matches("details[data-att-box]")) { const s = attachState(d.dataset.attBox); s.open = d.open; s.toggled = true; } }, true);

/* ---- 文字框自己长高：粘贴长文字时先长高，到屏幕一半才出现滚动条 ---- */
function fit(el){
  const max = Math.max(180, Math.round(window.innerHeight * 0.5));
  el.style.height = "auto";
  const h = el.scrollHeight + 2;
  el.style.height = Math.min(h, max) + "px";
  el.style.overflowY = h > max ? "auto" : "hidden";
}
const fitAll = root => (root || document).querySelectorAll("textarea[data-autosize]").forEach(fit);
// 页面重画、表单打开时新出现的文字框也按内容定高
new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches("textarea[data-autosize]")) fit(n); else if (n.querySelectorAll) fitAll(n); } })
  .observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("resize", () => fitAll());

export { MAX as ATTACH_MAX, attachHTML, attachPayload, attachReset, attachState, hasContent as attachHas, fitAll };
