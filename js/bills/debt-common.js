/* 借贷各页面共用的小件。从 debts.js 抽出来，各页面依赖这里。 */
import { STATUSES, debtCat } from "../core/debt-rules.js";
import { assetName, isVehicle } from "../house/assets.js";
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

export const hooks = { render: () => {}, refresh: async () => {} };
export const ui = () => (state.debtUi ||= {});
export const cur = () => Units.region.currency;
export const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
export const pct = (v) => (v == null ? "—" : `${+Number(v).toFixed(3)}%`);
export const tabHref = (id) => `${href("bills", "debts")}${id === "all" ? "" : `?tab=${id}`}`;
export const fact = (label, value) => (value ? `<span class="fa-fact"><small>${esc(label)}</small>${value}</span>` : "");
export const statusBadge = (e) => `<span class="badge ${STATUSES[e.status]?.cls || ""}">${esc(t(STATUSES[e.status]?.name || e.status))}</span>`;
export const catBadge = (e) => `<span class="badge" style="background:var(--surface-2)">${debtCat(e.category).icon} ${esc(t(debtCat(e.category).name))}</span>`;
export const vehicles = () => state.assets.filter(isVehicle);
const assetLabel = (a) => (a ? (isVehicle(a) ? `🚗 ${assetName(a)}` : `⚙️ ${assetName(a)}`) : "");
const assetHref = (e) => (e.asset ? href("asset", e.asset.id) : e.property ? `${href("house", "overview")}?prop=${encodeURIComponent(e.property.id)}` : null);
export const linkedText = (e) => {
  const lbl = e.asset ? assetLabel(e.asset) : e.property ? `🏠 ${e.property.name}` : null; if (!lbl) return "";
  const h = assetHref(e);
  return `<a href="${esc(h)}">${esc(lbl)}</a>${e.link_confirmed === false ? ` <span class="badge b-soon">${t("待确认")}</span>` : ""}`;
};
export const periodPay = (e) => (e.pi != null ? e.pi + (e.escrow || 0) : e.scheduled_payment ?? e.bill?.est ?? null);
