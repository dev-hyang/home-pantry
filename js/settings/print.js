/* 设置 → 打印：采购清单、账单概览。点“打印”时把要印的内容生成到 #printSheet，只在打印时显示（见 styles.css），然后调出浏览器打印。 */
import { state } from "../core/state.js";
import { $, esc, fmtDate, fmtShort, money, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { alertText, billAlerts, billCat, propertyName, subscriptionSummary, upcoming } from "../bills/logic.js";

const mny = (v, cur) => (v == null ? "—" : Units.money(num(v), cur || Units.region.currency));
const stamp = () => t("打印于 {d}", { d: fmtDate(todayISO()) });

/** 设置里的“打印”页：每种可打印的内容一行，账单概览可选房产（默认全部房产） */
export function viewPrintSettings() {
  const props = state.properties.filter((p) => !p.archived);
  const propPick = props.length > 1
    ? `<select id="printProp" aria-label="${t("选择房产")}"><option value="all">${t("全部房产")}</option>${props.map((p) => `<option value="${esc(p.id)}">🏠 ${esc(p.name)}</option>`).join("")}</select>` : "";
  const row = (kind, title, desc, extra = "") => `<div class="panel"><div class="kv"><div><b>${title}</b><div class="muted">${desc}</div></div>
      <div class="head-acts">${extra}<button type="button" class="btn btn-sm btn-primary" data-action="print-run" data-kind="${kind}">${t("打印")}</button></div></div></div>`;
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("选一项打印；浏览器的打印窗口里也可以另存为 PDF。")}</p>
    ${row("shopping", t("采购清单"), t("待购买和家人认领中的项目，带勾选框，逛店时可以直接划"))}
    ${state.billsEnabled ? row("bills", t("账单概览"), t("未来 30 天要交的账单、要处理的账单和每月固定支出"), propPick) : ""}`;
}

function shoppingSheet() {
  const open = state.shopping.filter((s) => s.status !== "bought");
  const rows = open.map((s) => `<tr><td class="box">☐</td><td>${esc(s.name)}</td><td>${esc(`${num(s.quantity, 1)} ${s.unit || ""}`.trim())}</td>
      <td>${s.status === "claimed" ? esc(t("{who} 正在买", { who: s.claimed_by_name || t("家人") })) : ""}</td></tr>`).join("");
  return `<h1>${t("采购清单")}</h1><p class="ps-meta">${esc(stamp())} · ${t("{n} 项待买", { n: open.length })}</p>
    ${open.length ? `<table><thead><tr><th></th><th>${t("名称")}</th><th>${t("数量")}</th><th>${t("备注")}</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>${t("清单是空的")}</p>`}`;
}

function billsSheet(prop) {
  const scoped = prop !== "all" && state.properties.some((p) => p.id === prop);
  const list = state.billsEnriched.filter((b) => b.active && (!scoped || b.property_id === prop));
  const cur = Units.region.currency;
  const inCur = list.filter((b) => (b.currency || cur) === cur);
  const monthly = inCur.reduce((s, b) => s + b.monthly, 0);
  const next30 = upcoming(list, 30);
  const due30 = next30.filter((x) => (x.bill.currency || cur) === cur).reduce((s, x) => s + num(x.bill.est), 0);
  const subs = subscriptionSummary(list);
  const alerts = billAlerts(list);
  const where = (b) => (state.properties.length > 1 && b.property_id ? `${esc(propertyName(b.property_id))} · ` : "");
  const kpi = (label, val) => `<div><span>${label}</span><b>${val}</b></div>`;
  return `<h1>${t("账单概览")}${scoped ? ` · ${esc(propertyName(prop))}` : ` · ${t("全部房产")}`}</h1><p class="ps-meta">${esc(stamp())}</p>
    <div class="ps-kpis">${kpi(t("未来 30 天要交"), `${money(due30)} · ${t("{n} 笔", { n: next30.length })}`)}${kpi(t("每月固定支出"), money(monthly))}${subs.count ? kpi(t("订阅与会员"), `${money(subs.monthly)}/${t("月")}`) : ""}</div>
    <h2>${t("要处理的账单")}</h2>
    ${alerts.length ? `<table><thead><tr><th>${t("账单")}</th><th>${t("状态")}</th><th>${t("金额")}</th></tr></thead><tbody>${alerts.map((b) => `<tr><td>${where(b)}${billCat(b.category).icon} ${esc(b.name)}</td><td>${esc(alertText(b))}</td><td>${mny(b.est, b.currency)}</td></tr>`).join("")}</tbody></table>` : `<p>${t("最近没有要处理的账单")}</p>`}
    <h2>${t("未来 30 天")}</h2>
    ${next30.length ? `<table><thead><tr><th>${t("到期日")}</th><th>${t("账单")}</th><th>${t("缴费方式")}</th><th>${t("金额")}</th></tr></thead><tbody>${next30.map(({ bill: b, due }) => `<tr><td>${esc(fmtShort(`${due}T12:00:00`))}</td><td>${where(b)}${billCat(b.category).icon} ${esc(b.name)}${b.assigned_to ? ` · ${esc(memberName(b.assigned_to) || "")}` : ""}</td><td>${b.autopay ? t("自动扣款") : esc(t(window.BILLS.CHANNELS[b.pay_channel] || ""))}</td><td>${mny(b.est, b.currency)}</td></tr>`).join("")}</tbody></table>` : `<p>${t("30 天内没有到期的账单")}</p>`}`;
}

/** 生成打印内容并调出浏览器打印；打印结束后清掉 */
export function printSheet(kind, prop = "all") {
  const html = kind === "shopping" ? shoppingSheet() : billsSheet(prop);
  let host = $("#printSheet");
  if (!host) { host = document.createElement("div"); host.id = "printSheet"; document.body.appendChild(host); }
  host.innerHTML = html;
  document.body.classList.add("print-sheet");
  const done = () => { document.body.classList.remove("print-sheet"); host.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}
