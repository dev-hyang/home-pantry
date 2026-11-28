/* 截图遮盖：弹出一个全屏层，在图上拖框涂黑（手指 / 鼠标都行），点「完成」才生成新图；原图不改。
 * 图片在浏览器里处理，涂黑的区域是真的把像素画成黑色再重新编码，不是盖一层。 */
import { normRect, toImagePoint } from "./scan-mask-lib.js";
import { t } from "../core/i18n.js";

const loadImg = (url) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });

/** 打开遮盖层。返回 Promise：完成 → 新图 {mime, b64, url, masked: true}；取消 → null */
export async function openMask(img) {
  const src = await loadImg(img.url);
  const W = src.naturalWidth, H = src.naturalHeight, rects = [];
  const root = document.createElement("div");
  root.className = "scan-mask";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", t("遮盖截图里的个人信息"));
  root.innerHTML = `<div class="scan-mask-head"><b>${t("遮盖截图里的个人信息")}</b><p class="muted">${t("用手指或鼠标在图上拖框，盖住收货地址、姓名、电话、卡号等。点「完成」后，涂黑的地方才会发送。")}</p></div>
    <div class="scan-mask-stage"><canvas></canvas></div>
    <div class="ui-acts scan-mask-acts">
      <button type="button" class="ui-btn" data-tone="ghost" data-m="cancel">${t("取消")}</button>
      <button type="button" class="ui-btn" data-m="undo">${t("撤销上一个框")}</button>
      <button type="button" class="ui-btn" data-tone="primary" data-m="done">${t("完成")}</button>
    </div>`;
  const cv = root.querySelector("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  let drag = null;
  const paint = (c) => {
    c.drawImage(src, 0, 0, W, H);
    c.fillStyle = "#000"; for (const r of rects) c.fillRect(r.x, r.y, r.w, r.h);
  };
  const redraw = () => {
    paint(ctx);
    if (drag) { const r = normRect(drag.x0, drag.y0, drag.x1, drag.y1, W, H); if (r) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = "#e5484d"; ctx.lineWidth = Math.max(2, W / 300); ctx.strokeRect(r.x, r.y, r.w, r.h); } }
    root.querySelector('[data-m="undo"]').disabled = !rects.length;
  };
  const pt = (e) => toImagePoint(e.clientX, e.clientY, cv.getBoundingClientRect(), W, H);
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); const p = pt(e); drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; redraw(); });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; const p = pt(e); drag.x1 = p.x; drag.y1 = p.y; redraw(); });
  const end = (e) => { if (!drag) return; const p = pt(e), r = normRect(drag.x0, drag.y0, p.x, p.y, W, H); drag = null; if (r) rects.push(r); redraw(); };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", () => { drag = null; redraw(); });
  document.body.appendChild(root); document.body.classList.add("scan-mask-open"); redraw();
  root.querySelector('[data-m="done"]').focus();

  return new Promise((resolve) => {
    const close = (v) => { document.removeEventListener("keydown", onKey, true); root.remove(); document.body.classList.remove("scan-mask-open"); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", (e) => {
      const m = e.target.closest("[data-m]")?.dataset.m;
      if (m === "cancel") close(null);
      else if (m === "undo") { rects.pop(); redraw(); }
      else if (m === "done") {
        const out = document.createElement("canvas"); out.width = W; out.height = H; paint(out.getContext("2d"));
        const url = out.toDataURL("image/jpeg", 0.82);
        close({ mime: "image/jpeg", b64: url.split(",")[1], url, masked: rects.length > 0 });
      }
    });
  });
}
