/* 购物车页底部的「最近加入购物车」：默认折叠，最多 8 条还没买的（新的在前）。 */
import { esc, fmtShort, num, showQty } from "../core/util.js";
import { state } from "../core/state.js";
import { shopUnit } from "./shop-sync.js";
import { t } from "../core/i18n.js";

export function recentCartHtml() {
  const recent = state.shopping.filter((s) => s.status !== "bought").sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 8);
  if (!recent.length) return "";
  return `<details class="panel sd-preview shop-recent"><summary><h3>${t("最近加入购物车")}</h3><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <ul>${recent.map((s) => `<li class="sp-row"><span class="sp-txt"><b>${esc(s.name)}</b> <small class="muted">${showQty(num(s.quantity, 1), shopUnit(s))}${s.created_at ? ` · ${t("{d} 加入", { d: fmtShort(s.created_at) })}` : ""}</small></span></li>`).join("")}</ul></details>`;
}
