/* 物品详情页的「库存记录」：这件物品最近 90 天的库存变动（入库 / 用掉 / 手动调整 / 扔掉），新的在前；
 * 入库那几行有「撤销入库」（弹框在 undo-restock.js，数量规则在 undo-calc.js）。数据是 state.logs（和库存提醒同一份，90 天）。
 * 数据库还没执行迁移 111 时（Store.undoReady() 为假）不显示撤销按钮，只列记录。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmt, fmtDateTime, num } from "../core/util.js";
import { t } from "../core/i18n.js";

const MAX = 12;
const LABEL = { restock: "补货入库", consume: "用掉", adjust: "手动调整", discard: "扔掉" };
export function stockLogPanel(it) {
  const logs = (state.logs || []).filter((l) => l.item_id === it.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)));
  const f = Units.factor(it.unit), unit = esc(t(it.du || it.unit || "")), can = !!Store.undoReady?.();
  const rows = logs.slice(0, MAX).map((l) => {
    const d = num(l.delta) * f, undo = can && l.reason === "restock" && d > 0 && !l.voided_at;
    return `<li class="sl-row${l.voided_at ? " is-void" : ""}"><span class="sl-when">${esc(fmtDateTime(l.created_at))}</span><span class="sl-what">${esc(t(LABEL[l.reason] || l.reason))}${l.voided_at ? ` <span class="ui-badge" data-tone="neutral" data-size="sm">${esc(t("已撤销"))}</span>` : ""}</span>
      <b class="sl-qty num ${d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${fmt(d)} ${unit}</b>${undo ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="undo-restock" data-log="${esc(l.id)}">${esc(t("撤销入库"))}</button>` : "<span></span>"}</li>`;
  }).join("");
  return `<section class="panel prof-card stock-log" aria-labelledby="idc-log"><header class="prof-head"><span class="mi" aria-hidden="true">🧾</span><div class="prof-t"><h3 id="idc-log">${esc(t("库存记录"))}</h3><small class="muted">${esc(t("最近 90 天；录错了的入库可以撤销"))}</small></div></header>
    ${rows ? `<ul class="sl-list">${rows}</ul>${logs.length > MAX ? `<p class="muted" style="margin:6px 0 0;font-size:13px">${esc(t("只列最近 {n} 条", { n: MAX }))}</p>` : ""}` : `<p class="muted prof-empty">${esc(t("最近 90 天没有库存变动"))}</p>`}</section>`;
}
