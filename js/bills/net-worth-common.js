/* 净资产页面和余额面板共用的小件。 */
import { esc, todayISO } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

export const cur = () => Units.region.currency;
export const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
export const ui = () => { const u = (state.nwUi ||= {}); u.open ||= {}; u.more ||= {}; return u; };
/* ───────────── 余额 / 估值：内联表单 + 历史（资产页、卡与账户共用） ───────────── */
export const SHOW = 5;
export function histList(key, rows, line) {
  const more = ui().more[key] || SHOW, shown = rows.slice(0, more);
  if (!rows.length) return `<p class="muted nw-none">${t("还没有记录")}</p>`;
  return `<ul class="nw-hist-list">${shown.map(line).join("")}</ul>
    ${rows.length > shown.length ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-nw="more" data-key="${esc(key)}">${t("再显示 {n} 条（共 {total} 条）", { n: Math.min(SHOW * 4, rows.length - shown.length), total: rows.length })}</button>` : ""}`;
}
export const detailsOpen = (key, dft = false) => (ui().open[key] ?? dft ? "open" : "");
export const monthsAgoDay = (days) => { const d = new Date(`${todayISO()}T12:00:00`); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
