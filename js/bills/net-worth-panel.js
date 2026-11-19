/* 卡的余额面板（卡表单里要同步用到，所以不放进按需加载的净资产页面模块）。 */
import { BALANCE_KINDS, isLiabilityKind } from "../stats/net-worth.js";
import { STALE_DAYS, balancesOf } from "./nw-logic.js";
import { esc, fmtDate, todayISO } from "../core/util.js";
import { financeOk } from "../core/finance-access.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { cur, detailsOpen, histList, mny, monthsAgoDay } from "./net-worth-common.js";

/** 账户的余额：最新余额 + 「更新余额」表单 + 历史（新 → 旧，5 条一页）。信用卡 / 贷款的余额 = 欠款 */
export function balancePanel(c, { open = false } = {}) {
  if (!state.nwOk || !financeOk() || !BALANCE_KINDS.includes(c.kind)) return "";
  const key = `b:${c.id}`, rows = balancesOf(c.id), last = rows[0], liab = isLiabilityKind(c.kind);
  const stale = last && last.as_of < monthsAgoDay(STALE_DAYS);
  const line = (b) => `<li><span>${esc(fmtDate(b.as_of))}</span><b>${mny(b.balance, b.currency)}</b>${b.notes ? `<small class="muted">${esc(b.notes)}</small>` : ""}
      <button type="button" class="btn btn-sm btn-ghost" data-nw="bal-del" data-id="${esc(b.id)}" aria-label="${esc(t("删除 {d} 的余额", { d: fmtDate(b.as_of) }))}">${t("删除")}</button></li>`;
  return `<details class="nw-hist panel" data-nw-key="${esc(key)}" ${detailsOpen(key, open)}>
    <summary><span>${liab ? t("欠款") : t("余额")}：<b>${last ? mny(last.balance, last.currency) : t("未记录")}</b>${last ? ` <small class="muted">${t("截至 {d}", { d: fmtDate(last.as_of) })}</small>` : ""}${stale ? ` <span class="badge b-soon">${t("需要更新")}</span>` : ""}</span><span class="nw-sum-act">${t("更新余额")}</span></summary>
    <form class="nw-form" data-nw-form="bal" data-id="${esc(c.id)}">
      <label>${t("日期")}<input type="date" name="as_of" required value="${todayISO()}" max="${todayISO()}"></label>
      <label>${liab ? t("欠款（{cur}）", { cur: cur() }) : t("余额（{cur}）", { cur: cur() })}<input type="number" name="balance" step="0.01" inputmode="decimal" required ${liab ? 'min="0"' : ""} value="${last ? esc(last.balance) : ""}"></label>
      <label class="nw-note">${t("备注（可选）")}<input name="notes" maxlength="300"></label>
      <button type="submit" class="btn btn-primary btn-sm">${t("保存余额")}</button>
    </form>
    <p class="hint">${liab ? t("信用卡 / 贷款记欠款（正数），算负债。同一天再记一次 = 改那一天。") : t("按对账单或网银填当天余额；同一天再记一次 = 改那一天。透支记负数。")}</p>
    ${histList(key, rows, line)}
  </details>`;
}
