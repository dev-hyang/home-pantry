/* Escrow 年度核对：有房贷、且房产税 / 保险走 Escrow 代缴的房产，每年在选定的月份提醒“核对 escrow 分析、更新房贷月供”，直到你点“已更新”。
 * 提醒月份和“哪一年已核对”存在预算设置里（household_budgets.cat_budgets._escrow），不需要新迁移。 */
import { state } from "../core/state.js";
import { esc, money, num, toast } from "../core/util.js";
import { locale, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { meta, saveMeta } from "./budget.js";
import { escrowMonthlyFor, propertyName } from "./logic.js";
import { financeOk } from "../core/finance-access.js";

const monthName = (m) => new Date(2000, m - 1, 1).toLocaleDateString(locale(), { month: "long" });
const cfgOf = (pid) => (meta("_escrow", {}) || {})[pid || "_"] || {};

/** 有房贷、且同一房产上有 Escrow 代缴的账单：每套房产一个 */
export function escrowSetups() {
  if (!state.billsEnabled || !financeOk()) return [];   // 核对状态存在预算设置里（household_budgets，迁移 050 起只有有财务权限的人读写得到）
  const out = [];
  for (const m of state.billsEnriched.filter((b) => b.active && !b.ended && b.category === "mortgage")) {
    const escrow = escrowMonthlyFor(m.property_id);
    if (escrow > 0) out.push({ pid: m.property_id || "_", mortgage: m, escrow });
  }
  return out;
}

/** 这一年里提醒月份是哪一年（12 月提醒的，到 1 月还要算上一年） */
const reminderYear = (month, now = new Date()) => (month === 12 && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

/** 提醒：提醒月份（留意）和下一个月（尽快）里，没点“已更新”就一直在注意事项里 */
export function escrowAlertItems() {
  const now = new Date(), m = now.getMonth() + 1, items = [];
  for (const s of escrowSetups()) {
    const cfg = cfgOf(s.pid), month = cfg.month || 1, next = (month % 12) + 1;
    if (m !== month && m !== next) continue;
    if (num(cfg.done) >= reminderYear(month, now)) continue;
    const link = href("bill", s.mortgage.id);
    items.push({ source: "bill", severity: m === month ? 3 : 2, must: false, due: null, daysLeft: null, property_id: s.mortgage.property_id || null,
      title: `🏦 ${t("核对 Escrow 年度分析，更新房贷月供")}`,
      detail: t("贷款方每年会寄 escrow 分析，房产税 / 保险涨了月供就会变；现在房贷月供 {a}，其中 Escrow 约 {b}/月。", { a: money(num(s.mortgage.est)), b: money(s.escrow) }),
      href: link, badge: { label: t("年度核对"), cls: "b-soon" },
      actions: [{ type: "link", href: `${link}?sec=amount`, label: t("改月供") }, { type: "button", action: "escrow-done", id: s.pid, label: t("已更新"), cls: "btn-ghost" }] });
  }
  return items;
}

/** 账单概览里的小卡片：选每年哪个月提醒、标记今年已核对 */
export function escrowPanelHtml() {
  const setups = escrowSetups(); if (!setups.length) return "";
  const now = new Date();
  return `<section class="section"><div class="panel">${setups.map((s) => {
    const cfg = cfgOf(s.pid), month = cfg.month || 1, ry = reminderYear(month, now), done = num(cfg.done) >= ry;
    return `<div class="esc-row"><div class="grow"><b>🏦 ${esc(propertyName(s.mortgage.property_id) || t("房贷"))} · ${t("Escrow 年度核对")}</b>
      <div class="muted" style="font-size:13px">${t("房贷月供 {a}，其中 Escrow 约 {b}/月。每年收到 escrow 分析后，把月供改成新的数。", { a: money(num(s.mortgage.est)), b: money(s.escrow) })}</div></div>
      <label class="inc-field">${t("每年提醒")}<select data-escrow-month="${esc(s.pid)}" aria-label="${t("提醒月份")}">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${month === i + 1 ? "selected" : ""}>${esc(monthName(i + 1))}</option>`).join("")}</select></label>
      ${done ? `<span class="badge b-ok">✓ ${t("{y} 年已更新", { y: ry })}</span>` : `<button type="button" class="btn btn-sm" data-action="escrow-done" data-id="${esc(s.pid)}">${t("已更新")}</button>`}</div>`;
  }).join("")}</div></section>`;
}

async function setCfg(pid, patch) {
  const all = { ...(meta("_escrow", {}) || {}) };
  all[pid] = { ...(all[pid] || {}), ...patch };
  await saveMeta({ _escrow: all });
}
document.addEventListener("change", async (e) => {
  const sel = e.target.closest?.("[data-escrow-month]"); if (!sel) return;
  try { await setCfg(sel.dataset.escrowMonth, { month: +sel.value }); toast(t("已保存")); } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest?.('[data-action="escrow-done"]'); if (!b) return;
  const pid = b.dataset.id, month = cfgOf(pid).month || 1;
  try { await setCfg(pid, { done: reminderYear(month) }); toast(t("已记下：今年的 Escrow 核对完成")); } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
});
