/* 「⋯」更多操作菜单（2026-11-06：复制功能加进来以后，表单底部按钮太多，次要的收进这里）。
 * 用原生 <details class="act-more">：点别处 / Esc 自动收起（main.js 里统一处理）；菜单项是 .act-item（链接或按钮，按钮走各自的 data-action）。
 * up = 向上弹（放在页面底部的固定按钮条里时用，免得菜单出屏）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

/** items: [{ label, href } | { label, action, data: { id: "…" } }]，danger = 删除这类（红字），falsy 的项跳过 */
export function moreMenu(items, { up = false, label = "" } = {}) {
  const list = items.filter(Boolean);
  if (!list.length) return "";
  const item = (x) => {
    const cls = `act-item${x.danger ? " is-danger" : ""}`;
    if (x.href) return `<a class="${cls}" href="${esc(x.href)}">${esc(x.label)}</a>`;
    const data = Object.entries(x.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
    return `<button type="button" class="${cls}" data-action="${esc(x.action)}"${data}>${esc(x.label)}</button>`;
  };
  return `<details class="act-more${up ? " act-up" : ""}"><summary class="btn btn-ghost btn-sm" aria-label="${esc(label || t("更多操作"))}" title="${esc(t("更多操作"))}"><span class="dots3" aria-hidden="true"></span></summary><div class="act-menu">${list.map(item).join("")}</div></details>`;
}

/** 复制一条记录：去掉 id、时间戳、操作人这些不该带过去的字段（extra 里再列这类记录自己的） */
export function copyOf(src, extra = []) {
  if (!src) return null;
  const out = { ...src };
  for (const k of ["id", "household_id", "created_at", "updated_at", "created_by", "updated_by", "import_batch", ...extra]) delete out[k];
  return out;
}
