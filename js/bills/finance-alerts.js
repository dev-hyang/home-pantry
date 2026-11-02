/* 财务 · 自己的提醒（来源 finance，2026-11）：账单、预算、借贷、收入各有各的提醒，这里只放「整个财务」层面、不归任何一个模块的事：
 *   1. 账户余额太久没更新（超过 STALE_DAYS 天）：净资产按旧余额算，会不准；
 *   2. 本月的净资产自动快照这次没存上（写失败，比如权限刚被收回），本月又还没有快照；
 *   3. 近 90 天的借贷流水里，动了钱却没关联花费 / 收入的（只记了借贷那一面：多半是对账单导入的那笔还没对上）。
 * 只给有财务权限的人（来源 finance 在 FINANCE_ALERT_SOURCES 里，总线统一去掉）；全是内存里的数据，不发请求。 */
import { state } from "../core/state.js";
import { todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { registerAlerts } from "../core/alerts.js";
import { financeOk } from "../core/finance-access.js";
import { STALE_DAYS, autoSnapshotFailed, liveNetWorth, snapshotOf, thisMonth } from "./nw-logic.js";
import { debtTxns } from "./debt-logic.js";
import { flowOf } from "./debt-records.js";

const daysAgo = (n) => { const d = new Date(`${todayISO()}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export function financeAlertItems() {
  if (!state.billsEnabled || !financeOk()) return [];
  const out = [];
  if (state.nwOk) {
    const stale = liveNetWorth().stale || [];
    if (stale.length) {
      const link = href("bills", "networth");
      out.push({ source: "finance", severity: 3, must: false, due: null, daysLeft: null, title: `🏦 ${t("{n} 个账户的余额该更新了", { n: stale.length })}`,
        detail: t("超过 {d} 天没更新：{names}", { d: STALE_DAYS, names: stale.slice(0, 3).map((a) => a.card?.name).filter(Boolean).join("、") }) + (stale.length > 3 ? "…" : ""),
        href: link, badge: { label: t("需要更新"), cls: "b-soon" }, actions: [{ type: "link", href: link, label: t("去更新"), cls: "btn-ghost" }] });
    }
    if (autoSnapshotFailed() && !snapshotOf(thisMonth())) {
      const link = href("bills", "networth");
      out.push({ source: "finance", severity: 3, must: false, due: null, daysLeft: null, title: `📈 ${t("本月的净资产快照没存上")}`, detail: t("自动保存失败了，去净资产页手动存一次"),
        href: link, badge: { label: t("留意"), cls: "b-ok" }, actions: [{ type: "link", href: link, label: t("去净资产"), cls: "btn-ghost" }] });
    }
  }
  if (state.debtsOk) {
    const from = daysAgo(90);
    const loose = debtTxns().filter((x) => x.txn_date >= from && !x.bill_payment_id && !x.purchase_id && !x.income_record_id && flowOf(x));
    if (loose.length) {
      const link = `${href("bills", "debts")}?tab=txns&link=no`;
      out.push({ source: "finance", severity: 3, must: false, due: null, daysLeft: null, title: `🔗 ${t("{n} 笔借贷流水没关联花费 / 收入", { n: loose.length })}`,
        detail: t("近 90 天动了钱的借贷流水：点「编辑」关联对账单导入的那一笔，免得漏记或重复"),
        href: link, badge: { label: t("待关联"), cls: "b-soon" }, actions: [{ type: "link", href: link, label: t("去关联"), cls: "btn-ghost" }] });
    }
  }
  return out;
}
registerAlerts(financeAlertItems);
