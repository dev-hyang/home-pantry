/* 账单：缴费记录、常用账单模板。 */
import { billCat, currentProperty, initialDue } from "./logic.js";
import { esc, fmtShort, money, num } from "../core/util.js";
import { href } from "../core/router.js";
import { joinList, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { B, billLabel, billOption, byInUse, propertyBar } from "./bill-common.js";

/* ── 记录 ── */
/** 缴费趋势（并进账单概览）：选一条有 ≥ 2 笔缴费的周期性账单，看每次缴费金额的走势（近 400 天内存里的缴费） */
export function billTrendSection() {
  const candidates = state.billsEnriched.filter((b) => b.pays.filter((p) => p.amount != null).length >= 2).sort(byInUse);   // 在用的排前面，已卖出房产的账单在后面但仍能选
  if (!candidates.length) return "";
  const sel = candidates.find((b) => b.id === state.billsFilter.trend) || candidates[0];
  const series = [...sel.pays].filter((p) => p.amount != null).reverse().slice(-12);
  const chart = Charts.line({ title: t("{name}缴费金额", { name: billLabel(sel) }), labels: series.map((p) => fmtShort(`${p.paid_on}T12:00:00`)), fmt: (v) => money(v),
    series: [{ name: billLabel(sel), color: "var(--pine)", values: series.map((p) => num(p.amount)) }] });
  return `<section class="section"><div class="section-head"><h2>${t("缴费趋势")}</h2><p>${t("每次缴费金额的走势，选一条账单看")}</p></div>
    <div class="panel chart-panel"><div class="chart-head"><h3>${t("单账单金额趋势")}</h3>
    <select id="billTrend" aria-label="${t("选择账单")}">${candidates.map((b) => `<option value="${b.id}" ${b.id === sel.id ? "selected" : ""}>${esc(billOption(b))}</option>`).join("")}</select></div>${chart}</div></section>`;
}
/* ── 常用账单模板 ── */
function templateRegion() {
  return state.houseProfile?.region || (Units.region.system === "us" ? "na" : "cn");
}
export function viewBillTemplate() {
  const region = templateRegion();
  const tpl = B().TEMPLATES[region] || [];
  const prop = currentProperty();
  // “已有”按房产判断：挂房产的模板只看当前房产下有没有同类同名账单（各房产的电费到期日可能不同，要能各建一条）；
  // 与房产无关的模板（手机、车险等）才看整个家庭
  const have = new Set(state.bills.filter((b) => !b.ended).map((b) => `${b.property_id || ""}|${b.category}|${b.name}`));
  const hasBill = (r) => { const pid = r.property === false ? "" : (prop?.id || ""); return have.has(`${pid}|${r.category}|${r.name}`) || have.has(`${pid}|${r.category}|${t(r.name)}`); };
  return `
    <section class="section">
      <div class="section-head"><p>${t("{region}模板，共 {n} 条；金额和到期日建好后再补", { region: t(region === "na" ? "北美" : "中国"), n: tpl.length })}</p></div>
      ${propertyBar()}
      <form id="billTemplateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${prop ? t("与房产相关的账单会挂在“{p}”下；每套房产可以各建一条（到期日可能不同），切换上面的房产再建", { p: esc(prop.name) }) : ""}</span>
        </div>
        ${(() => {
          // 按 group 分组显示（默认“常用账单”）；订阅与会员一组，带种类小标签
          const groupNames = [...new Set(tpl.map((r) => r.group || "常用账单"))];
          const rowHtml = (r, i) => {
            const exists = hasBill(r), c = billCat(r.category);
            const when = r.due_dates ? joinList(r.due_dates.map((d) => d.replace("-", "/"))) : r.due_day ? t("每月 {d} 号", { d: r.due_day }) : t("到期日建后补填");
            return `<label class="ui-row tpl-row ${exists ? "is-have" : ""}" style="--cat:var(--pine)">
            <input type="checkbox" name="tpl" value="${i}" ${exists ? "disabled" : r.optional ? "" : "checked"}>
            <span class="grow"><b>${c.icon} ${esc(t(r.name))}</b>${r.sub_kind ? ` <span class="badge sub-kind">${t(B().SUB_KINDS[r.sub_kind] || r.sub_kind)}</span>` : ""}<small>${[r.payee ? esc(r.payee) : null, t(B().FREQUENCIES[r.frequency]) + (r.frequency === "custom" ? ` (${r.interval_months})` : ""), when, r.autopay ? t("通常自动扣款") : t("手动缴费"), r.property === false ? t("与房产无关") : null].filter(Boolean).join(" · ")}</small>
              ${r.note ? `<small class="note">${esc(t(r.note))}</small>` : ""}</span>
            ${exists ? `<span class="badge b-ok">${r.property === false ? t("已有") : t("此房产已有")}</span>` : ""}
          </label>`;
          };
          return groupNames.map((g) => `<fieldset class="tpl-group"><legend>${t(g)}${g === "订阅与会员" ? `<span class="muted" style="font-weight:400;font-size:13px"> · ${t("默认不勾，勾了再补金额和到期日；年付到期前 30 天提醒")}</span>` : ""}</legend>
            ${tpl.map((r, i) => ((r.group || "常用账单") === g ? rowHtml(r, i) : "")).join("")}</fieldset>`).join("");
        })()}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="ui-btn" data-tone="primary">${t("建立选中的账单")}</button>
          <a class="ui-btn" data-tone="ghost" href="${href("bills", "all")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}
/** 勾选的模板 → 账单行（名称、备注按当前语言写入） */
export function billTemplateItems(indexes) {
  const region = templateRegion(), tpl = B().TEMPLATES[region] || [];
  const cur = Units.region.currency, pid = state.propertyId;
  return indexes.map((i) => tpl[i]).filter(Boolean).map((r) => {
    const b = {
      property_id: r.property === false ? null : pid, name: t(r.name), category: r.category, direction: "payable", sub_kind: r.sub_kind || null, trial_ends_on: null,
      payee: r.payee || null, account_last4: null, login_hint: null, pay_url: null,
      pay_channel: r.autopay ? "autopay" : (r.channel || "online"), amount_type: r.amount_type || "variable", typical_amount: null, currency: cur,
      frequency: r.frequency, interval_months: r.interval_months || null, due_day: r.due_day || null, due_dates: r.due_dates || [],
      next_due_on: null, grace_days: r.grace_days || 0, late_fee_note: null,
      autopay: !!r.autopay, autopay_method: null, autopay_card_expires: null, statement_channel: r.statement || "email",
      reminder_days: r.reminder_days || [7, 1], assigned_person_id: null, essential: r.essential !== false && billCat(r.category).essential, active: true,
      notes: r.note ? t(r.note) : null,
    };
    b.next_due_on = initialDue(b);
    return b;
  });
}
