/* 账单 B1 · 页面：概览、清单、记录、常用账单模板、账单整页表单（含缴费记录） */
import { changed } from "../core/clear-filters.js";
import { dupOnce, normName } from "../core/item-match.js";
import { copyOf, moreMenu } from "../core/more-menu.js";
import { state } from "../core/state.js";
import { fillFromPurchase, purchaseById } from "../core/spend-data.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, fmtShort, money, num, stampText, todayISO, toast } from "../core/util.js";
import { SECTIONS, go, href } from "../core/router.js";
import { joinList, lang, t } from "../core/i18n.js";
import { adultPeople } from "../settings/family-people.js";

import { acctText, advanceDue, billCat, currentProperty, initialDue } from "./logic.js";
import { withProperty } from "../core/alerts.js";
import { autofillBar, scanNewBillBar } from "../core/autofill.js";

import { assetSelectHtml } from "./asset-ui.js";

import { fullFormUrl, viewBillWizard } from "./wizard-views.js";
import { VEHICLE_CATS } from "./instances.js";
import { beforeDeletePayment, splitBillPayment } from "./debt-logic.js";   // 贷款账单的缴费按摊还表拆 本金 / 利息（迁移 058）
import { billInUse, endedSuffix, propertyActive, propertyById } from "../core/lifecycle.js";
import { NEW_RECURRING } from "./kinds.js";
import { billScopeParts } from "./trail.js";
import { detailHref } from "./medical.js";

import { crumbNav } from "../core/hub.js";
import { PAY_EXTRA, acctById, accountOptions, billPayLabel, isBankAcct, payAcctValue, paymentPayLabel, resolvePayAccount } from "./cards-views.js";
import { askInline } from "../core/ask.js";

import { billAsk } from "./logic.js";

import { assessFormPage, assessListPage } from "./assessments-views.js";
import { assessmentParts, assessmentsOf, monthEnd, unpaidItems } from "./assessments-lib.js";
import { olderPayment, payHistoryPage, resetPayHistory } from "./pay-history.js";

const B = () => window.BILLS;
const BADGE = { overdue: "b-out", due: "b-low", verify: "b-soon", soon: "b-soon", ok: "b-ok", escrow: "b-ok", none: "", ended: "", inactive: "" };
const STATUS_LABEL = { overdue: "逾期", due: "今天到期", verify: "待核对", soon: "即将到期", ok: "正常", escrow: "Escrow 代缴", none: "未填到期日", ended: "已结束", inactive: "已停用" };
const mny = (v, cur) => (v == null ? "—" : Units.money(num(v), cur || Units.region.currency));

/** 房产切换条（房屋、账单页共用）；只有一套房产时不显示 */
export function propertyBar({ all = false } = {}) {
  const list = state.properties.filter((p) => propertyActive(p) || p.id === state.propertyId);   // 在用的 + 当前正看的（已卖出的从这里退出，要看历史去房屋列表）
  if (list.length < 2) return "";
  const cur = all ? state.billsFilter.property : state.propertyId;
  const chip = (id, label) => `<button type="button" class="chip" data-action="${all ? "bills-prop" : "property"}" data-id="${id}" aria-pressed="${cur === id}">${label}</button>`;
  return `<div class="chips prop-bar" role="group" aria-label="${t("选择房产")}">${all ? chip("all", t("全部房产")) : ""}${list.map((p) => chip(p.id, `🏠 ${esc(p.name)}`)).join("")}</div>`;
}

/** 添加账单的第一步：选账单类型。周期性 → 现有的账单表单；一次性 → 一次性账单表单（医疗、装修工程、法律、旅行…） */
function billTypeChooser() {
  const card = (href_, icon, title, desc, eg) => `<div class="kind-card"><a class="kind-main" href="${href_}"><span class="kind-ico" aria-hidden="true">${icon}</span><span class="grow"><b>${title}</b><small>${desc}</small><small>${eg}</small></span><span class="mch" aria-hidden="true">›</span></a></div>`;
  return `<section class="section form-page">${crumbNav([billRoot(), { label: t("添加账单") }])}
    <div class="section-head"><h2>${t("添加账单")}</h2><p>${t("先选账单类型")}</p></div>
    <div class="panel kind-cards">
      ${card(NEW_RECURRING(), "🔁", t("周期性账单"), t("按周期反复出现：系统算下次到期、提前提醒，记缴费后自动推到下一期。"), t("水电气网、房贷房租、保险、订阅、信用卡"))}
      ${card(detailHref("new"), "🧾", t("一次性账单"), t("一次事件产生：有总额、可以分次付、有余额，付清就结束。"), t("医疗、宠物、法律税务、装修工程、旅行"))}
    </div>
    ${scanNewBillBar()}
    <p class="muted" style="font-size:13px;margin:0 0 6px"><a href="${fullFormUrl()}">${t("我想一次填完（整页表单）")} ›</a></p>
    <p class="muted"><a href="${href("bills", "template")}">${t("按常用账单模板一次建好水电气、房贷、保险等")} ›</a></p></section>`;
}

/** 账单页面包屑：账单 / 房产 / 账单名 / 当前块 —— 有房产的账单带上房产（点它回到这套房产的账单清单），免得多套房产时分不清是哪套的 */
const billRoot = () => ({ href: href("bills", "overview"), label: t("财务") });   // 添加账单页等「还没有具体账单」的面包屑第一级
/** 账单详情页路径：财务 / 账单概览 / 资产 / 账单名（后面接分区时再追加一级） */
const billTrail = (b, _root, hubHref) => [...billScopeParts(b, "recurring"), { href: hubHref, label: b.name, icon: billCat(b.category).icon }];
const billCrumb = (b, root, hubHref, cur) => crumbNav([...billTrail(b, root, hubHref), { label: cur }]);

/** 多套房产时账单名带房产前缀（“房 1 · 电费”），单套房产不变 */
const billLabel = (b) => (b ? withProperty(b.property_id, b.name) : "");
/** 下拉里用：已卖出 / 已退租房产的账单带上状态，在用的排前面 */
const billOption = (b) => `${billLabel(b)}${endedSuffix(propertyById(b.property_id))}`;
const byInUse = (x, y) => (billInUse(y) ? 1 : 0) - (billInUse(x) ? 1 : 0);

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
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${prop ? t("与房产相关的账单会挂在“{p}”下；每套房产可以各建一条（到期日可能不同），切换上面的房产再建", { p: esc(prop.name) }) : ""}</span>
        </div>
        ${(() => {
          // 按 group 分组显示（默认“常用账单”）；订阅与会员一组，带种类小标签
          const groupNames = [...new Set(tpl.map((r) => r.group || "常用账单"))];
          const rowHtml = (r, i) => {
            const exists = hasBill(r), c = billCat(r.category);
            const when = r.due_dates ? joinList(r.due_dates.map((d) => d.replace("-", "/"))) : r.due_day ? t("每月 {d} 号", { d: r.due_day }) : t("到期日建后补填");
            return `<label class="tpl-row ${exists ? "is-have" : ""}" style="--cat:var(--pine)">
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
          <button type="submit" class="btn btn-primary">${t("建立选中的账单")}</button>
          <a class="btn btn-ghost" href="${href("bills", "all")}">${t("稍后再说")}</a>
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

/* ── 账单表单（整页；编辑时下方带缴费记录） ── */
/** 分区页（?sec= / ?pay=1）：后退一步回枢纽；枢纽页：直接跳回进来之前的页面（不能 history.back，会掉回刚看过的分区） */
export function leaveBill(changed) {
  if (changed) state.needsRefresh = true;
  state.skipAutosave = true;
  const q = state.route?.q, inSection = !!(q && (q.get("sec") || q.get("pay") === "1"));
  if (inSection && state.prevRoute) history.back();
  else if (state.prevHash && state.prevRoute) go(state.prevHash);
  else go(href("bills", "all"), { replace: true });
}

export function viewBillForm() {
  const r = state.route;
  const b = r.id && r.id !== "new" ? state.billsEnriched.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !b) return `<div class="panel empty"><strong>${t("找不到这条账单")}</strong>${t("可能已被家人删除。")}<p><a class="btn btn-primary" href="${href("bills", "all")}">${t("回到账单")}</a></p></div>`;
  if (!b && r.id === "new" && ![...r.q.keys()].length) return billTypeChooser();   // 没带任何参数：先选周期性还是一次性
  if (!b && r.id === "new" && r.q.get("mode") !== "full" && !r.q.get("copy")) return viewBillWizard();   // 新建周期性账单：5 步向导；mode=full = 整页表单（老手入口），copy = 复制已有账单
  const qCat = r.q.get("category");
  // 从房屋资料「创建账单」进来（保险年保费、HOA 月费以前记在资料里，2026-11 起账单是唯一来源）：把旧值带过来，不让数据丢
  const qAmt = num(r.q.get("amount"), NaN), qFreq = r.q.get("freq"), qProp = r.q.get("prop");
  const pre = b ? {} : {
    ...(r.q.get("name") ? { name: r.q.get("name").slice(0, 60) } : {}), ...(r.q.get("payee") ? { payee: r.q.get("payee").slice(0, 60) } : {}),
    ...(qFreq && B().FREQUENCIES[qFreq] ? { frequency: qFreq } : {}), ...(Number.isFinite(qAmt) && qAmt >= 0 ? { typical_amount: Math.round(qAmt * 100) / 100, amount_type: "fixed" } : {}),
    ...(qProp && state.properties.some((p) => p.id === qProp) ? { property_id: qProp } : {}) };
  // 复制：原账单的分类、收款方、金额、周期、扣款方式等都带上，名字也照旧（自己改），状态回到在用
  const csrc = !b && r.q.get("copy") ? copyOf((state.bills || []).find((x) => x.id === r.q.get("copy")), ["ended_on", "end_reason"]) : null;
  if (csrc) Object.assign(csrc, { active: true });
  const v = b || csrc || { category: qCat && B().CATEGORIES.some((c) => c.id === qCat) ? qCat : "electric", direction: "payable", pay_channel: "online", amount_type: "variable",
    currency: Units.region.currency, frequency: "monthly", due_day: null, due_dates: [], grace_days: 0, autopay: false, statement_channel: "email", reminder_days: [7, 1],
    essential: true, active: true, property_id: state.propertyId, ...pre };
  const d = (x) => esc(x ?? "");
  const payAcct = acctById(v.pay_card_id);   // 选了卡：到期年月直接看卡的，不再抄一份（抄过去的会过期不同步）
  const cloud = Store.mode === "cloud";
  const opts = (map, sel) => Object.entries(map).map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${t(n)}</option>`).join("");
  // 面包屑根：进来之前的页面（注意事项 / 账单 / 房屋…），没有就回账单清单
  const root = { href: state.prevRoute && state.prevHash ? state.prevHash : href("bills", "all"), label: state.prevRoute ? t(SECTIONS[state.prevRoute.section]?.name || "上一页") : t("账单") };
  const landlord = state.properties.some((p) => p.role === "landlord");
  // 已有账单：先看枢纽（各块完成度），点进去只改一块；新建仍是整页
  const sec = r.q.get("pay") === "1" ? "pay" : r.q.get("sec") || "";
  const hubHref = href("bill", b?.id || "new");
  if (b && !sec) return billHub(b, root);
  if (b && sec === "assess") {   // 特别摊派：?sec=assess = 列表；?sec=assess&edit=id|new = 新增 / 编辑页
    const editId = r.q.get("edit"), listHref = `${hubHref}?sec=assess`;
    if (editId) { const a = editId === "new" ? null : state.assess.find((x) => x.id === editId && x.bill_id === b.id); if (editId === "new" || a) return assessFormPage(b, a, crumbNav([...billTrail(b, root, hubHref), { href: listHref, label: t("特别摊派") }, { label: a ? t("编辑摊派") : t("新增摊派") }])); }
    return assessListPage(b, billCrumb(b, root, hubHref, t("特别摊派")));
  }
  if (b && sec === "pay") {   // 缴费记录：?sec=pay = 全部记录（搜索 / 筛选）；?sec=pay&edit=id 或 ?pay=1 = 独立的编辑 / 新建页
    const editId = r.q.get("edit"), listHref = `${hubHref}?sec=pay`;
    if (editId || r.q.get("pay") === "1") {
      const edit = editId ? b.pays.find((x) => x.id === editId) || olderPayment(editId) : null;
      return `<section class="section form-page">${crumbNav([...billTrail(b, root, hubHref), { href: listHref, label: t("缴费记录") }, { label: edit ? t("编辑缴费记录") : b.autopay ? t("记核对") : t("记缴费") }])}${payFormPage(b, edit)}</section>`;
    }
    return payHistoryPage(b, billCrumb(b, root, hubHref, t("缴费记录")), staleNotice(b));
  }
  const full = sec === "all";   // 整张表单（编辑菜单进来）：四块都显示
  const hide = (k) => (b && sec && !full && sec !== k ? "hidden" : "");
  return `
    <section class="section form-page">
      ${b ? billCrumb(b, root, hubHref, full ? t("编辑账单") : t(BILL_SECTIONS.find((s) => s.id === sec)?.name || "")) : crumbNav([billRoot(), { label: t("添加账单") }])}
      ${autofillBar("bill", "#billForm")}
      <form id="billForm" class="panel ${B().isSubCat(v.category) ? "is-sub" : ""} ${v.category === "hoa" ? "is-hoa" : ""} ${b && sec && !full ? "one-sec" : ""}" novalidate data-autosave>
        <input type="hidden" name="bill_id" value="${d(b?.id)}">
        <fieldset data-sec="basic" ${hide("basic")}>
          <legend>${t("① 这是什么账单")}</legend>
          <div class="form-grid">
            <label>${t("名称")}<input name="name" required maxlength="60" placeholder="${t("例如：ComEd 电费")}" value="${d(v.name)}"></label>
            <label>${t("分类")}<select name="category">${B().CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === v.category ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`).join("")}</select></label>
            <label class="sub-only">${t("订阅种类")}<select name="sub_kind"><option value="">${t("未指定")}</option>${opts(B().SUB_KINDS, v.sub_kind)}</select><small>${t("只用于分组和汇总；流媒体、云存储、AI 工具、软件等")}</small></label>
            <label class="sub-only">${t("免费试用到期日")}<input name="trial_ends_on" type="date" value="${d(v.trial_ends_on)}"><small>${t("到期前 3 天提醒“不续就取消”")}</small></label>
            <label>${t("房产")}<select name="property_id" data-ss="1"><option value="">${t("与房产无关")}</option>${state.properties.filter((p) => propertyActive(p) || p.id === v.property_id).map((p) => `<option value="${p.id}" ${p.id === v.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
            ${assetSelectHtml(v.asset_id, state.bills)}
            ${landlord || v.direction === "receivable" ? `<label>${t("方向")}<select name="direction"><option value="payable" ${v.direction !== "receivable" ? "selected" : ""}>${t("我付出去（应付）")}</option><option value="receivable" ${v.direction === "receivable" ? "selected" : ""}>${t("别人付给我（应收，如租金）")}</option></select></label>` : `<input type="hidden" name="direction" value="payable">`}
            <label>${t("付款方 / 收款方")}<input name="payee" maxlength="60" placeholder="${t("例如：ComEd")}" value="${d(v.payee)}"></label>
          </div>
        </fieldset>
        <fieldset data-sec="amount" ${hide("amount")}>
          <legend>${t("② 多少钱、多久一次")}</legend>
          <div class="form-grid">
            <label>${t("频率")}<select name="frequency">${opts(B().FREQUENCIES, v.frequency)}</select></label>
            <label>${t("每 N 个月（自定义时）")}<input name="interval_months" type="number" inputmode="numeric" min="1" max="60" value="${d(v.interval_months)}"></label>
            <label>${t("每月几号到期")}<input name="due_day" type="number" inputmode="numeric" min="1" max="31" placeholder="${t("月付类填")}" value="${d(v.due_day)}"></label>
            <label>${t("固定日期（半年 / 年付）")}<input name="due_dates" placeholder="${t("例如 03-01, 08-01")}" value="${d((v.due_dates || []).join(", "))}"><small>${t("填了固定日期就按它循环，忽略“每月几号”")}</small></label>
            <label>${t("下次到期日")}<input name="next_due_on" type="date" value="${d(v.next_due_on)}"><small>${t("留空会按规则自动算；每周 / 年付没填日期的请手动填")}</small></label>
            <label>${t("金额类型")}<select name="amount_type"><option value="fixed" ${v.amount_type === "fixed" ? "selected" : ""}>${t("固定")}</option><option value="variable" ${v.amount_type !== "fixed" ? "selected" : ""}>${t("每次不同")}</option></select></label>
            <label>${t("通常金额")}<input name="typical_amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${t("每次不同的可留空，按记录平均")}" value="${d(v.typical_amount)}"><small>${t("固定金额填这里。水电燃气这类每次不同的：还没缴的那期先按最近 6 次的均值估（标“估”），记缴费时填实际金额，那一期就变成真实数字。")}</small></label>
            <label class="hoa-only">${t("单元费 Unit assessment")}<input name="unit_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.unit_amount)}"><small>${t("HOA 月费分成单元费和车位费；填了，“通常金额”自动 = 两者之和。")}</small></label>
            <label class="hoa-only">${t("车位费 Parking assessment")}<input name="parking_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.parking_amount)}"></label>
            <label>${t("通常手续费（估算）")}<input name="typical_fee" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.typical_fee)}"><small>${t("有服务费 / 刷卡费的填；没缴之前用它估“费用总额”，记缴费时当默认值，实际金额不同就改。")}</small></label>
            <label>${t("通常税（估算）")}<input name="typical_tax" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.typical_tax)}"><small>${t("税额每次可能不一样；这里填大概值，记缴费时填实际的。")}</small></label>
            <label>${t("货币")}<input name="currency" maxlength="3" pattern="[A-Z]{3}" value="${d(v.currency || Units.region.currency)}"></label>
          </div>
        </fieldset>
        <fieldset data-sec="autopay" ${hide("autopay")}>
          <legend>${t("③ 怎么付")}</legend>
          <div class="form-grid">
            <label>${t("缴费方式")}<select name="pay_channel">${opts(B().CHANNELS, v.pay_channel)}</select><small>${t("房产税 / 保险由贷款方从月供里代缴时选“Escrow 代缴”：不提醒到期、不重复算进每月预算；金额填税单或保单上的年额，房贷填含 Escrow 的总月供。")}</small></label>
            <label>${t("付款账户 / 卡")}<select name="pay_account" data-pay-acct>${accountOptions(payAcctValue(v.pay_card_id, v.autopay_method), { none: "（未指定）", extra: PAY_EXTRA })}</select><small>${t("自动扣款从它扣；手动缴费时记缴费也默认用它。卡和银行账户在 财务 → 用卡 里添加。")}</small></label>
            <label data-pay-other ${payAcctValue(v.pay_card_id, v.autopay_method) === "other" ? "" : "hidden"}>${t("账户说明")}<input name="autopay_method" maxlength="40" placeholder="${t("例如：公司代扣 / 支票")}" value="${d(v.autopay_method)}"></label>
            <label class="check-inline span-2"><input type="checkbox" name="autopay" ${v.autopay ? "checked" : ""}><span>${t("已设置自动扣款（到期前后提醒核对，而不是提醒缴费）")}</span></label>
            <label data-pay-exp ${payAcct ? "hidden" : ""}>${t("扣款卡有效期")}<input name="autopay_card_expires" type="month" value="${d(v.autopay_card_expires)}"><small>${t("到期前 45 天提醒换卡（选了卡就按卡的到期年月，不用填）")}</small></label>
            <p class="muted" data-pay-exp-note style="margin:0;font-size:12.5px" ${payAcct ? "" : "hidden"}>${esc(payExpNote(payAcct))}</p>
            <label>${t("缴费链接")}<input name="pay_url" type="url" maxlength="300" placeholder="https://" value="${d(v.pay_url)}"></label>
            <label>${t("账号尾号")}<input name="account_last4" maxlength="8" placeholder="${t("只记后 4 位")}" value="${d(v.account_last4)}"></label>
            <label>${t("登录提示")}<input name="login_hint" maxlength="80" placeholder="${t("例如：用 Gmail 登录，密码在密码管理器")}" value="${d(v.login_hint)}"></label>
            <label>${t("账单怎么来")}<select name="statement_channel">${opts(B().STATEMENTS, v.statement_channel)}</select></label>
          </div>
        </fieldset>
        <fieldset data-sec="other" ${hide("other")}>
          <legend>${t("④ 提醒与其他")}</legend>
          <div class="form-grid">
            <label>${t("提前提醒（天，逗号分隔）")}<input name="reminder_days" placeholder="7, 1" value="${d((v.reminder_days || [7, 1]).join(", "))}"></label>
            <label>${t("宽限天数")}<input name="grace_days" type="number" inputmode="numeric" min="0" max="60" value="${d(v.grace_days ?? 0)}"></label>
            <label>${t("结束日期（可选）")}<input name="ends_on" type="date" value="${d(v.ends_on)}"><small>${t("晚于它的到期不再提醒，例如卖房后的最后一期")}</small></label>
            <label class="span-2">${t("滞纳金说明")}<input name="late_fee_note" maxlength="120" placeholder="${t("例如：逾期 1.5% 或 $25")}" value="${d(v.late_fee_note)}"></label>
            ${adultPeople().length ? `<label>${t("谁负责")}<select name="assigned_person_id"><option value="">${t("不指定")}</option>${adultPeople().map((p) => `<option value="${p.id}" ${p.id === v.assigned_person_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select><small>${t("关联家庭成员（不是登录设备），在 设置 → 家庭与成员 里管理。")}</small></label>` : `<input type="hidden" name="assigned_person_id" value="">`}
            <label class="check-inline"><input type="checkbox" name="essential" ${v.essential !== false ? "checked" : ""}><span>${t("必要支出（预算里单独统计）")}</span></label>
            <label class="check-inline"><input type="checkbox" name="active" ${v.active !== false ? "checked" : ""}><span>${t("启用（停用后不再提醒，记录保留）")}</span></label>
            <label class="span-2">${t("备注")}<textarea name="notes" rows="2" maxlength="500" placeholder="${t("合同到期、促销价截止、客服电话…")}">${d(v.notes)}</textarea></label>
          </div>
        </fieldset>
        <p id="billFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${b ? t("保存修改") : t("添加账单")}</button>
          <button type="button" class="btn btn-ghost" data-action="bill-cancel">${t("取消")}</button>
        </div>
      </form>
      ${b ? "" : `<p class="muted" style="margin-top:12px;font-size:13px">${t("保存后可以在这条账单下记每次缴费或核对。")}</p>`}
    </section>`;
}

const BILL_SECTIONS = [
  { id: "basic", icon: "🧾", name: "① 这是什么账单" },
  { id: "amount", icon: "📅", name: "② 多少钱、多久一次" },
  { id: "autopay", icon: "🔁", name: "③ 怎么付" },
  { id: "other", icon: "⋯", name: "④ 提醒与其他" },
  { id: "pay", icon: "✅", name: "缴费记录" },
];
/** 账单枢纽页：摘要 + 各块完成度 + 缴费记录入口 + 删除 */
function billHub(b, root) {
  const base = href("bill", b.id);
  const recent = b.pays.slice(0, 6).map((p) => `<li><span class="badge ${p.status === "skipped" ? "" : "b-ok"}" ${p.status === "skipped" ? 'style="background:var(--surface-2)"' : ""}>${t(B().PAYMENT_STATUS[p.status] || p.status)}</span>
      <div class="grow">${esc(fmtDate(p.paid_on))}<small>${[p.due_on && p.due_on !== p.paid_on ? t("到期 {d}", { d: fmtDate(p.due_on) }) : null, paymentPayLabel(p)].filter(Boolean).map(esc).join(" · ")}</small></div><b>${p.amount != null && p.status !== "skipped" ? mny(payTotal(p), p.currency) : ""}</b></li>`).join("");
  const payCard = `<section class="panel prof-card" aria-labelledby="bc-pay">
      <header class="prof-head"><span class="mi" aria-hidden="true">✅</span><div class="prof-t"><h3 id="bc-pay">${t("缴费记录")}</h3><small>${b.pays.length ? t("{n} 条，最近 {d}", { n: b.pays.length, d: fmtDate(b.pays[0].paid_on) }) : t("还没有记录")}</small></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${b.pays.length ? `${base}?sec=pay` : `${base}?pay=1`}" aria-label="${esc(t("缴费记录"))}">${b.pays.length ? t("全部") : t("记一笔")}</a></header>
      ${recent ? `<ul class="restock-list">${recent}</ul>` : `<p class="muted prof-empty">${t("还没有记录")}</p>`}</section>`;
  const asList = assessmentsOf(b.id, state.assess, state.assessItems), cur = b.currency;
  const assessCard = asList.length || b.category === "hoa" ? `<section class="panel prof-card" aria-labelledby="bc-as">
      <header class="prof-head"><span class="mi" aria-hidden="true">📣</span><div class="prof-t"><h3 id="bc-as">${t("特别摊派")}</h3><small>${asList.length ? t("{n} 笔，剩余 {m}", { n: asList.length, m: mny(asList.reduce((s, x) => s + x.remaining, 0), cur) }) : t("没有")}</small></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${base}?sec=assess${asList.length ? "" : "&edit=new"}">${asList.length ? t("全部") : t("添加")}</a></header>
      ${asList.length ? `<ul class="restock-list">${asList.slice(0, 3).map((x) => `<li><span class="badge ${x.done ? "b-ok" : ""}">${x.done ? t("已缴清") : x.status === "closed" ? t("已关闭") : `${x.paidN}/${x.rows.length}`}</span><div class="grow">${esc(x.name)}</div><b>${mny(x.remaining, cur)}</b></li>`).join("")}</ul>` : `<p class="muted prof-empty">${t("HOA 临时收的大额费用记在这里。")}</p>`}</section>` : "";
  const q = state.route?.q, banner = billBanner(b, q, base);
  return `<section class="section">
    ${crumbNav([...billTrail(b, root, href("bill", b.id)).slice(0, -1), { label: b.name, icon: billCat(b.category).icon }])}
    ${billHeadCard(b, base)}
    ${banner}
    <div class="prof-grid bill-detail-grid one-col">${assessCard}${payCard}</div>
    ${askInline(billAsk(b))}
  </section>`;
}

const L = (zh, en) => (lang === "en" ? en : zh);   // 提示条里的字段标签：中英文直接写在这里
const assetColumnVisible = () => (state.assets || []).some((a) => a.kind === "vehicle" || a.kind === "equipment");

/** 刚新建完（?new=1）或 AI 扫描创建（?ai=1）进来：详情页顶上的一次性提示条，列出还没填的项；关闭 = 去掉网址参数 */
function billBanner(b, q, base) {
  const isAi = q?.get("ai") === "1", isNew = q?.get("new") === "1";
  if (!isAi && !isNew) return "";
  const missing = [!b.payee && L("付款方", "Payee"), b.amount_type === "fixed" && b.typical_amount == null && L("金额", "Amount"), !b.account_last4 && L("账号尾号", "Account digits"), !b.autopay && !b.pay_url && L("缴费链接", "Payment link"),
    VEHICLE_CATS.includes(b.category) && !b.asset_id && assetColumnVisible() && L("关联资产", "Linked asset")].filter(Boolean).slice(0, 4);
  const close = `<a class="btn btn-sm btn-ghost" href="${base}" aria-label="${esc(t("关闭提示"))}">${t("知道了")}</a>`;
  if (isAi) return `<div class="notice" role="status" style="margin-bottom:12px"><b>✨ ${t("AI 识别创建")}</b> ${t("看一眼就行：不对的地方点右上角“⋯”→“编辑”改；整张读错了就撤销创建。")}${missing.length ? ` ${t("还没读到：{list}。", { list: missing.join("、") })}` : ""}
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-action="bill-delete">${t("撤销创建")}</button>${close}</div></div>`;
  return `<div class="notice" role="status" style="margin-bottom:12px"><b>✅ ${t("已创建")}</b>${missing.length ? ` ${t("这几项还没填：{list}，随时在下面补。", { list: missing.join("、") })}` : ` ${t("信息都齐了。")}`}
    <div class="form-actions" style="margin-top:8px">${close}</div></div>`;
}

/** 费用拆解（头部卡「费用」一行）：固定金额（没有就用估算）+ 以后接入的 特别摊派 / 手续费 / 税；返回 { total, parts:[{ k, amount }], per } */
export function billCostParts(b) {
  const base = b.amount_type === "fixed" && b.typical_amount != null ? { k: t("固定"), amount: num(b.typical_amount) } : b.est != null ? { k: t("估算"), amount: num(b.est) } : null;
  const parts = base ? (b.amount_type === "fixed" && b.unit_amount != null ? [{ k: `HOA：${t("单元费")} ${mny(b.unit_amount, b.currency)} + ${t("车位费")} ${mny(b.parking_amount, b.currency)}`, amount: num(b.unit_amount) + num(b.parking_amount) }] : [base]) : [];
  const as = assessmentParts(b.id, state.assess, state.assessItems, b.next_due_on);   // 本期要交的特别摊派（到期日所在月底之前、还没缴的）
  if (as.installment > 0) parts.push({ k: t("分期摊派"), amount: as.installment });
  if (as.payoff > 0) parts.push({ k: t("一次性摊派"), amount: as.payoff });
  if (num(b.typical_fee) > 0) parts.push({ k: t("手续费"), amount: num(b.typical_fee) });
  if (num(b.typical_tax) > 0) parts.push({ k: t("税"), amount: num(b.typical_tax) });
  const total = Math.round(parts.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  return { total, parts, per: lang === "en" ? (b.frequency === "monthly" ? "month" : "payment") : (b.frequency === "monthly" ? "月" : "次") };
}
/** 头部卡里的一块：标题 + 左右两列的小表（左标签、右内容）；没有行就不画 */
const headSec = (title, rows) => { const r = rows.filter(([, v]) => v); return r.length ? `<section class="bh-sec" aria-label="${esc(title)}"><h3>${esc(title)}</h3><dl class="bh-table">${r.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl></section>` : ""; };
const linkOf = (url) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(String(url).replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 42))}</a>` : "");

/** 详情页顶上的汇总卡：名称（账号尾号）+ 下次到期 + 竖三点菜单；HOA / 服务商小表；付费小表（付费方式、费用总额）；添加 / 更新时间；记缴费大按钮。
 *  底色比下面的分区卡深一点（和 .prof-card 同一套圆角和内边距） */
function billHeadCard(b, base) {
  const cat = billCat(b.category), isHoa = b.category === "hoa", prop = b.property_id ? state.properties.find((p) => p.id === b.property_id) : null, hoa = isHoa && prop?.hoa ? prop.hoa : null;
  const due = b.status !== "ok" && b.status !== "none" ? `<span class="badge ${BADGE[b.status]}">${t(STATUS_LABEL[b.status])}${b.next_due_on ? ` · ${fmtDate(b.next_due_on)}` : ""}</span>`
    : b.next_due_on ? `<span class="badge b-ok">${t("下次到期 {d}", { d: fmtDate(b.next_due_on) })}</span>` : "";
  const menu = moreMenu([
    { label: t("编辑"), href: `${base}?sec=all`, first: true },
    { label: b.autopay ? t("记核对") : t("记缴费"), href: `${base}?pay=1` },
    { label: t("查看缴费记录"), href: `${base}?sec=pay` },
    { label: t("特别摊派"), href: `${base}?sec=assess` },
    b.pay_url ? { label: t("去服务商缴费"), href: b.pay_url, external: true } : null,
    { label: t("复制为新账单"), href: `${href("bill", "new")}?copy=${encodeURIComponent(b.id)}` },
    { label: t("删除账单"), action: "bill-delete", danger: true },
  ]);
  // HOA 账单：公司 / 联系方式 / 网站读房屋资料里的 HOA（只存一份）；其他账单：收款方 + 缴费网站 + 登录提示
  const emails = (hoa?.email || "").split(/[;,，；]/).map((x) => x.trim()).filter(Boolean);
  const contact = hoa ? [hoa.phone ? `<a href="tel:${esc(hoa.phone.replace(/[^\d+]/g, ""))}">${esc(hoa.phone)}</a>` : "", ...emails.map((e) => `<a href="mailto:${esc(e)}">${esc(e)}</a>`)].filter(Boolean).join("<br>") : "";
  const provider = isHoa && hoa
    ? headSec("HOA", [[L("HOA 公司", "HOA"), esc([hoa.name, hoa.mgmt].filter(Boolean).join(" · "))], [L("联系方式", "Contact"), contact], [L("官网 / 缴费网站", "Website"), linkOf(b.pay_url || hoa.url)]])
    : headSec(isHoa ? "HOA" : t("服务商"), [[L("收款方", "Payee"), esc(b.payee || "")], [L("官网 / 缴费网站", "Website"), linkOf(b.pay_url)], [L("登录提示", "Login hint"), esc(b.login_hint || "")]]);
  const method = b.autopay ? `${t("自动扣款")}${billPayLabel(b) ? ` · ${esc(billPayLabel(b))}` : ""}` : `${t("手动缴费")}${billPayLabel(b) ? ` · ${esc(billPayLabel(b))}` : ""}`;
  const cost = billCostParts(b);
  const formula = cost.parts.length > 1 ? `<small class="bh-formula">= ${cost.parts.map((x) => `${mny(x.amount, b.currency)} (${esc(x.k)})`).join(" + ")}</small>` : cost.parts.length ? `<small class="bh-formula">${esc(cost.parts[0].k)}${b.est != null && cost.parts[0].k === t("估算") ? ` · ${t("按最近均值")}` : ""}</small>` : "";
  const total = cost.parts.length ? `<b class="bh-total">${mny(cost.total, b.currency)}<span> / ${cost.per}</span></b>${formula}` : "";
  const monthly = b.monthly && b.frequency !== "monthly" ? t("折合每月 {m}", { m: money(b.monthly) }) : "";
  const pay = headSec(t("付费"), [[L("付费方式", "Method"), method], [L("费用总额", "Total"), total], [L("折合每月", "Per month"), esc(monthly)]]);
  return `<section class="panel bill-head" aria-label="${esc(t("账单概要"))}">
    <div class="bh-top"><span class="mi" aria-hidden="true">${cat.icon}</span>
      <div class="bh-t"><h2>${esc(b.name)}${b.account_last4 ? `<span class="bh-acct">（**${esc(b.account_last4)}）</span>` : ""}</h2>${due}${b.priceUp ? `<span class="badge b-low">${t("涨价了")}</span>` : ""}</div>${menu}</div>
    ${provider}${pay}
    ${stampText(b) ? `<p class="record-meta bh-stamp">${esc(stampText(b))}</p>` : ""}
    <a class="btn btn-primary bh-pay" href="${base}?pay=1">${b.autopay ? t("记核对") : t("记缴费")}</a>
  </section>`;
}

function payFormPage(b, edit = null) {
  const v = edit || {};   // 编辑某条记录时表单带入它的值
  // 账户下拉的当前值：编辑时按这条记录（卡 / 现金 / 支票 / 手填）；新记一笔按账单的付款账户
  const payVal = edit ? (edit.card_id ? edit.card_id : edit.method === "支票" ? "check" : payAcctValue(null, edit.method)) : (b.pay_card_id ? b.pay_card_id : payAcctValue(null, b.autopay_method));
  const linked = edit?.purchase_id ? purchaseById(edit.purchase_id) : null;   // 这条缴费记的花费：收款方存在它上面（按 id 读这一笔）
  if (edit?.purchase_id && !linked) fillFromPurchase(edit.purchase_id, '#billPayForm [name="store"]', (p) => p.store);   // 还没读回来：读到后填进收款方（没改过的话）
  return `
    <div class="section-head"><h2>${edit ? t("编辑缴费记录") : b.autopay ? t("记核对") : t("记缴费")}</h2><p>${acctText(b) ? `${esc(acctText(b))} · ` : ""}${edit ? t("改这条记录；不会动下次到期日") : t("记一笔后下次到期日自动推到下一期")}</p></div>
    <form id="billPayForm" class="panel" data-focus="1" data-cur="${esc(b.currency || "")}">
      <input type="hidden" name="bill_id" value="${esc(b.id)}"><input type="hidden" name="pay_id" value="${esc(edit?.id || "")}">
      <div class="form-grid maint-grid">
        <label>${t("缴费日期")}<input name="paid_on" type="date" required value="${esc(edit ? edit.paid_on || "" : todayISO())}" max="${todayISO()}"></label>
        <label>${t("对应到期日")}<input name="due_on" type="date" value="${esc(edit ? edit.due_on || "" : b.next_due_on || "")}"></label>
        ${amountGroup(b, edit)}
        <label>${t("状态")}<select name="status"><option value="paid" ${edit?.status === "paid" ? "selected" : ""}>${t("已缴费")}</option><option value="verified" ${edit ? (edit.status === "verified" ? "selected" : "") : b.autopay ? "selected" : ""}>${t("已核对（自动扣款）")}</option><option value="skipped" ${edit?.status === "skipped" ? "selected" : ""}>${t("跳过这期")}</option></select></label>
        <label>${t("用哪张卡 / 账户")}<select name="pay_account" data-pay-acct>${accountOptions(payVal, { none: "（未指定）", extra: PAY_EXTRA })}</select></label>
        <label data-pay-other ${payVal === "other" ? "" : "hidden"}>${t("方式说明")}<input name="method" maxlength="40" placeholder="${t("例如：网银 / 支票 #1023 / 自动扣款")}" value="${esc(edit ? edit.method || "" : b.autopay_method || "")}"></label>
        <label>${t("收款方")}<input name="store" maxlength="40" value="${esc(edit ? (linked?.store || b.payee || b.name || "") : b.payee || b.name || "")}" placeholder="${esc(b.payee || b.name)}"><small>${edit ? t("只改这一条；中途换了收款方，旧记录保留当时的名字。") : t("没填就用账单的收款方。")}</small></label>
        <label>${t("确认号")}<input name="confirmation_ref" maxlength="60" value="${esc(edit?.confirmation_ref || "")}"></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${esc(edit?.notes || "")}"></label>
      </div>
      <p class="muted" style="margin:10px 0 0;font-size:13px">${edit ? t("金额改了，花费统计里对应的那笔也会跟着改。") : t("有金额的记录会同时记入花费统计的“账单”组。")}</p>
      <div class="form-actions form-actions-split sticky-actions">
        <button type="button" class="btn btn-ghost" data-action="billpay-cancel">${t("取消")}</button>
        <button type="submit" class="btn btn-primary">${edit ? t("保存修改") : t("记一笔")}</button></div>
    </form>`;
}
/** 缴费表单里勾选的摊派期：{ ids, sum } */
const checkedItems = (fe) => { const all = fe.as_item ? (fe.as_item.length === undefined ? [fe.as_item] : [...fe.as_item]) : []; const on = all.filter((x) => x.checked); return { ids: on.map((x) => x.value), sum: Math.round(on.reduce((s, x) => s + num(x.dataset.amt), 0) * 100) / 100 }; };
/** 摊派下拉（多选）：本期之前到期的没缴期默认勾上，其余不勾；编辑时本笔已交的勾着。没有可选的期就不出现 */
function assessDropdown(b, edit) {
  const upto = monthEnd(edit?.due_on || b.next_due_on || todayISO()), own = edit ? state.assessItems.filter((x) => x.payment_id === edit.id) : [];
  const open = unpaidItems(b.id, state.assess, state.assessItems), name = (x) => state.assess.find((a) => a.id === x.assessment_id)?.name || "";
  const rows = [...own.map((x) => [x, true]), ...open.map((x) => [x, !edit && (x.due_on || "") <= upto])].sort((p, q) => (p[0].due_on || "").localeCompare(q[0].due_on || ""));
  if (!rows.length) return "";
  const on = rows.filter(([, c]) => c), sum = Math.round(on.reduce((s, [x]) => s + num(x.amount), 0) * 100) / 100;
  return `<div class="amt-row amt-as"><span class="amt-l">${t("特别摊派")}</span>
    <details class="pick amt-pick"><summary><span class="pick-val ${on.length ? "" : "is-empty"}" id="asSummary">${asSummaryText(on.length, sum, b.currency)}</span></summary>
      <div class="pick-panel" role="group" aria-label="${esc(t("这次交的特别摊派"))}">${rows.map(([x, c]) => `<label class="pick-row check-inline"><input type="checkbox" name="as_item" value="${esc(x.id)}" data-amt="${num(x.amount)}" ${c ? "checked" : ""}><span>${esc(fmtDate(x.due_on))} · ${esc(name(x))} · ${esc(t(x.kind === "payoff" ? "一次性结清" : "分期"))} · <b>${mny(x.amount, b.currency)}</b></span></label>`).join("")}</div></details></div>`;
}
const asSummaryText = (n, sum, cur) => (n ? t("{n} 期 · {m}", { n, m: mny(sum, cur) }) : t("这次不交摊派"));
/** 缴费表单的「金额」一组：本期金额（HOA 拆成单元费 + 车位费）+ 滞纳金 + 手续费 + 税 + 特别摊派 = 总金额（实时加好） */
function amountGroup(b, edit) {
  const cur = b.currency || Units.region.currency, n2 = (x) => num(x).toFixed(2);
  const split = edit ? edit.unit_amount != null || edit.parking_amount != null : b.unit_amount != null || b.parking_amount != null;   // 老记录没拆过就保持一个金额
  const base = edit ? (edit.amount != null ? n2(edit.amount) : "") : b.est != null ? n2(b.est) : "";
  const inp = (name, val, hint = "") => `<input name="${name}" type="number" inputmode="decimal" min="0" step="0.01" value="${val}" data-amt-in aria-label="${esc(hint)}">`;
  const row = (label, input) => `<label class="amt-row"><span class="amt-l">${label}</span>${input}</label>`;
  const baseRows = split
    ? row(`${t("单元费")}${lang === "en" ? "" : " <small>Unit</small>"}`, inp("unit_amount", edit ? n2(edit.unit_amount) : n2(b.unit_amount), t("单元费"))) + row(`${t("车位费")}${lang === "en" ? "" : " <small>Parking</small>"}`, inp("parking_amount", edit ? n2(edit.parking_amount) : n2(b.parking_amount), t("车位费"))) + `<div class="amt-row amt-sub"><span class="amt-l">${t("HOA 小计")} <small>${t("单元费 + 车位费")}</small></span><b id="paySub">${mny(edit ? num(edit.unit_amount) + num(edit.parking_amount) : num(b.unit_amount) + num(b.parking_amount), cur)}</b></div><input type="hidden" name="amount" value="${edit ? n2(edit.amount) : n2(num(b.unit_amount) + num(b.parking_amount))}">`
    : row(b.amount_type === "fixed" ? t("固定金额") : t("本期金额"), inp("amount", base, t("本期金额")));
  const hint = edit ? "" : `<p class="muted amt-hint">${b.amount_type === "fixed" && b.typical_amount != null ? t("本期按固定金额 {a}；实际不一样就改上面的金额。", { a: mny(b.typical_amount, b.currency) }) : b.est != null ? t("本期预估 {a}（最近几次的均值）；填实际金额，这一期就变成真实数字。", { a: mny(b.est, b.currency) }) : t("还没有历史金额可估：填这次的实际金额。")}</p>
      ${b.amount_type === "fixed" ? `<label class="check-inline amt-upd"><input type="checkbox" name="update_typical" checked><span>${t("实际金额和通常金额不同时，用这次的金额更新通常金额")}</span></label>` : ""}`;
  return `<fieldset class="span-2 amt-group" data-split="${split ? 1 : 0}"><legend>${t("金额（{cur}）", { cur })}</legend>
    ${baseRows}
    ${row(t("滞纳金"), inp("late_fee", edit ? n2(edit.late_fee) : "0", t("滞纳金")))}
    ${row(t("手续费"), inp("fee_amount", edit ? n2(edit.fee_amount) : b.typical_fee != null ? n2(b.typical_fee) : "0", t("手续费")))}
    ${row(t("税"), inp("tax_amount", edit ? n2(edit.tax_amount) : b.typical_tax != null ? n2(b.typical_tax) : "0", t("税")))}
    ${assessDropdown(b, edit)}
    <div class="amt-total" role="status"><span>${t("总金额")}</span><b id="payTotal">${mny(0, cur)}</b></div>
    ${hint}</fieldset>`;
}
/** 表单里改了任何一项：重算总金额（HOA 拆分时本期金额 = 单元费 + 车位费），并更新摊派下拉上的摘要 */
export function recalcPayTotal(form) {   // 第一次由 main.js 在页面画好后调用一次
  const el = (n) => form.elements[n], v = (n) => (el(n) && el(n).type !== "checkbox" ? num(el(n).value) : 0), split = form.querySelector(".amt-group")?.dataset.split === "1";
  const base = split ? Math.round((v("unit_amount") + v("parking_amount")) * 100) / 100 : v("amount");
  if (split && el("amount")) el("amount").value = base.toFixed(2);
  const sub = form.querySelector("#paySub"); if (sub) sub.textContent = Units.money(base, form.dataset.cur || undefined);   // HOA 小计 = 单元费 + 车位费
  const as = checkedItems(form.elements), status = el("status")?.value, total = status === "skipped" ? 0 : Math.round((base + v("late_fee") + v("fee_amount") + v("tax_amount") + as.sum) * 100) / 100;
  const out = form.querySelector("#payTotal"); if (out) out.textContent = Units.money(total, form.dataset.cur || undefined);
  const sm = form.querySelector("#asSummary"); if (sm) { sm.textContent = asSummaryText(as.ids.length, as.sum, form.dataset.cur || undefined); sm.classList.toggle("is-empty", !as.ids.length); }
}
document.addEventListener("input", (e) => { const f = e.target.closest?.("#billPayForm"); if (f) recalcPayTotal(f); });
document.addEventListener("change", (e) => { const f = e.target.closest?.("#billPayForm"); if (f) recalcPayTotal(f); });

/** 旧缴费记录没记账户时，列表页顶上的「一次性补上」提示 */
const staleNotice = (b) => { const stale = backfillable(b); return stale.length ? `<div class="notice" role="status" style="margin-top:10px"><b>${t("有 {n} 条旧缴费记录没记账户。", { n: stale.length })}</b> ${t("按现在的付款账户 {a} 一次性补上？花费统计里对应的那几笔也会记到这张卡。现金 / 支票的不动。", { a: billPayLabel(b) })} <button type="button" class="btn btn-sm" data-action="billpay-backfill" data-id="${b.id}">${t("补上")}</button></div>` : ""; };
/** 没记账户、也不是现金 / 支票的旧缴费记录（账单选了付款账户后可以一次性补上） */
const backfillable = (b) => (b.pay_card_id && acctById(b.pay_card_id) ? b.pays.filter((p) => !p.card_id && p.status !== "skipped" && !/^(现金|支票|cash|check)/i.test(p.method || "")) : []);
export async function backfillPayments(id) {
  const b = state.billsEnriched.find((x) => x.id === id); if (!b) return;
  const list = backfillable(b); if (!list.length) return toast(t("没有要补的记录"));
  if (!confirm(t("把这 {n} 条缴费记录都记成 {a}？", { n: list.length, a: billPayLabel(b) }))) return;
  let n = 0;
  for (const p of list) {
    await Store.updateBillPayment(p.id, { card_id: b.pay_card_id, method: resolvePayAccount(b.pay_card_id).method });
    if (p.purchase_id) await Store.updatePurchase(p.purchase_id, { card_id: b.pay_card_id }).catch(() => {});
    n++;
  }
  toast(t("已补上 {n} 条", { n }));
}

/* ── 保存 ── */
const parseList = (s, { int = true } = {}) => String(s || "").split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => (int ? parseInt(x, 10) : x)).filter((x) => (int ? Number.isFinite(x) : true));

/** silent=true：离开页面时自动保存（不跳转；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveBillForm(f, { silent = false } = {}) {
  const fe = f.elements, err = f.querySelector("#billFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  if (!name) return fail(t("请填写账单名称。"), fe.name);
  const numOrNull = (el, int) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };
  const dueDates = parseList(fe.due_dates.value, { int: false }).map((x) => x.replace("/", "-")).filter((x) => /^\d{2}-\d{2}$/.test(x));
  const reminders = [...new Set(parseList(fe.reminder_days.value).filter((n) => n >= 0 && n <= 90))].sort((a, b) => b - a).slice(0, 5);
  const payUrl = fe.pay_url.value.trim();
  if (payUrl && !/^https?:\/\//i.test(payUrl)) return fail(t("缴费链接需要以 http:// 或 https:// 开头。"), fe.pay_url);
  if (!silent) {   // 疑似重复（「电费」和「Electric」各建一条）：在用的账单里同名，或同一收款方 + 同一分类——先提醒一次
    const payee = fe.payee.value.trim(), hit = (state.bills || []).find((x) => x.id !== fe.bill_id.value && x.active !== false && !x.ended_on
      && (normName(x.name) === normName(name) || (payee && normName(x.payee) === normName(payee) && x.category === fe.category.value)));
    if (dupOnce(f, hit?.id)) return fail(t("已经有在用的账单「{name}」（同名或同一收款方、同一分类）。确认是另一条，再点一次保存。", { name: hit.name }), fe.name);
  }
  const b = {
    id: fe.bill_id.value || undefined, name, category: fe.category.value, property_id: fe.property_id.value || null, asset_id: fe.asset_id?.value || null, direction: fe.direction.value || "payable",
    payee: fe.payee.value.trim() || null, account_last4: fe.account_last4.value.trim() || null, login_hint: fe.login_hint.value.trim() || null, pay_url: payUrl || null,
    pay_channel: fe.pay_channel.value, statement_channel: fe.statement_channel.value, amount_type: fe.amount_type.value, typical_amount: numOrNull(fe.typical_amount), unit_amount: fe.category.value === "hoa" ? numOrNull(fe.unit_amount) : null, parking_amount: fe.category.value === "hoa" ? numOrNull(fe.parking_amount) : null, typical_fee: numOrNull(fe.typical_fee), typical_tax: numOrNull(fe.typical_tax),
    currency: (fe.currency.value.trim().toUpperCase() || Units.region.currency).slice(0, 3), frequency: fe.frequency.value, interval_months: numOrNull(fe.interval_months, true),
    due_day: numOrNull(fe.due_day, true), due_dates: dueDates, next_due_on: fe.next_due_on.value || null, grace_days: numOrNull(fe.grace_days, true) || 0, ends_on: fe.ends_on.value || null,
    sub_kind: B().isSubCat(fe.category.value) ? fe.sub_kind.value || null : null, trial_ends_on: B().isSubCat(fe.category.value) ? fe.trial_ends_on.value || null : null,
    reminder_days: reminders.length ? reminders : [7, 1], late_fee_note: fe.late_fee_note.value.trim() || null,
    autopay: fe.autopay.checked, ...payFields(fe.pay_account?.value, fe.autopay_method.value), autopay_card_expires: fe.autopay_card_expires.value || null,
    assigned_person_id: fe.assigned_person_id.value || null, essential: fe.essential.checked, active: fe.active.checked, notes: fe.notes.value.trim() || null,
  };
  if (b.category === "hoa" && (b.unit_amount != null || b.parking_amount != null)) { b.typical_amount = Math.round((num(b.unit_amount) + num(b.parking_amount)) * 100) / 100; b.amount_type = "fixed"; }   // HOA 拆分：标准金额 = 单元费 + 车位费
  if (b.pay_channel === "escrow") b.autopay = false;   // 代缴就不是自动扣款
  if (b.autopay && b.pay_channel !== "autopay") b.pay_channel = "autopay";
  if (!b.autopay && b.pay_channel === "autopay") b.pay_channel = "online";
  if (!b.next_due_on) b.next_due_on = initialDue(b);
  // 只改别的分区（如基本信息）时，到期日那块是隐藏的：不拦，照常保存，到期日留到“金额与周期”再补
  const amountVisible = !fe.next_due_on.closest("fieldset")?.hidden;
  if (!b.next_due_on && b.frequency !== "one_time" && amountVisible) return fail(t("这种频率算不出到期日，请填“下次到期日”。"), fe.next_due_on);
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await Store.saveBill(b);
    if (silent) return true;
    toast(b.id ? t("已保存修改") : t("已添加 {name}", { name }));
    leaveBill(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}

/** 选了卡 / 账户时「扣款卡有效期」那行的说明 */
export const payExpNote = (c) => (!c ? "" : isBankAcct(c) ? t("银行账户没有到期日") : c.expires_on ? t("按 {name} 的到期年月 {d} 提醒换卡；要改去 用卡 里改", { name: c.name, d: c.expires_on.slice(0, 7) }) : t("{name} 还没填到期年月，去 用卡 里填上才会提醒换卡", { name: c.name }));
/** 账单的付款账户字段：下拉选卡 → pay_card_id；现金 / 其他 → autopay_method 文字 */
const payFields = (value, text) => { const r = resolvePayAccount(value, text); return { pay_card_id: r.card_id, autopay_method: r.method }; };
/** 记一笔缴费 / 核对 / 跳过：写 purchases（有金额且为应付，带上用的卡）、写记录、把账单推到下一期 */
export async function recordPayment(bill, { paid_on, due_on, amount, status, method, card_id, confirmation_ref, late_fee, fee_amount, tax_amount, assessment_amount, assessment_ids, unit_amount, parking_amount, notes, store }) {
  const currency = bill.currency || Units.region.currency;
  let purchase_id = null;
  const total = status === "skipped" ? 0 : num(amount) + num(late_fee) + num(fee_amount) + num(tax_amount) + num(assessment_amount);
  if (total > 0 && bill.direction !== "receivable") {
    purchase_id = await Store.addPurchase({ item_id: null, name: bill.name, category: `bill_${bill.category}`, quantity: null, unit: null, store: (store || "").trim().slice(0, 40) || bill.payee || bill.name || null,
      amount: Math.round(total * 100) / 100, currency, purchased_at: new Date(`${paid_on}T12:00:00`).toISOString(), ...(card_id ? { card_id } : {}), ...(bill.property_id ? { property_id: bill.property_id } : {}) });   // 关联账单的房产（迁移 055）
  }
  const payRow = { bill_id: bill.id, due_on: due_on || bill.next_due_on || null, paid_on, amount: status === "skipped" ? null : (amount == null ? null : Math.round(num(amount) * 100) / 100),
    currency, method: method || null, confirmation_ref: confirmation_ref || null, late_fee: Math.round(num(late_fee) * 100) / 100, fee_amount: Math.round(num(fee_amount) * 100) / 100, tax_amount: Math.round(num(tax_amount) * 100) / 100, assessment_amount: Math.round(num(assessment_amount) * 100) / 100, unit_amount: unit_amount == null ? null : Math.round(num(unit_amount) * 100) / 100, parking_amount: parking_amount == null ? null : Math.round(num(parking_amount) * 100) / 100, status, notes: notes || null, purchase_id, ...(card_id ? { card_id } : {}) };
  const payId = await Store.addBillPayment(payRow);
  if (assessment_ids?.length) await Store.setItemsPayment(assessment_ids, payId);   // 这次交的摊派期：记上是哪次缴费交的
  resetPayHistory();
  if (bill.debt_id && purchase_id) await splitBillPayment(bill, { ...payRow, id: payId }).catch((e) => console.warn("[debt split]", e.message));   // 贷款：本金单独一行（性质 = 融资），主行只剩利息 + Escrow
  // 推到下一期：以这次对应的到期日为基准，保证不会漏期。补记更早一期（到期日早于当前下次到期）不往回推，下次到期不动
  const base = due_on || bill.next_due_on || paid_on;
  const catchUp = !!(bill.next_due_on && base < bill.next_due_on && bill.frequency !== "one_time");
  const next = catchUp ? bill.next_due_on : advanceDue(bill, base);
  const patch = { ...bill, next_due_on: next };
  if (!next && bill.frequency === "one_time") patch.active = false;
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return { next, catchUp };
}
/** 改了记录的到期日后，账单的下次到期跟着对：这条正是把账单推到当前这期的那条，或改后的到期日已经不早于当前下次到期，就按新到期日重推；否则不动 */
async function resyncDue(bill, old, newDue) {
  if (!newDue || bill.frequency === "one_time") return null;
  const pushedIt = old.due_on && bill.next_due_on === advanceDue(bill, old.due_on);
  if (!pushedIt && bill.next_due_on && newDue < bill.next_due_on) return null;
  const next = advanceDue(bill, newDue); if (!next || next === bill.next_due_on) return null;
  const patch = { ...bill, next_due_on: next };
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return next;
}

/** 删一条缴费记录：同时退回它推进过的到期日（只在它正是把账单推到当前这一期的那条时才退；之后又记了别的期，或同一期还有别的记录，就不动）。返回退回后的到期日，没退回返回 null */
export async function deleteBillPay(id) {
  const p = state.billPayments.find((x) => x.id === id);
  const bill = p && state.billsEnriched.find((b) => b.id === p.bill_id);
  await beforeDeletePayment(id).catch(() => {});   // 贷款拆分的本金行（流水随缴费记录级联删除）
  await Store.deleteBillPayment(id);
  resetPayHistory();
  if (!bill || !p.due_on) return null;
  const sameDue = state.billPayments.some((x) => x.id !== id && x.bill_id === bill.id && x.due_on === p.due_on);
  const pushedIt = bill.next_due_on === advanceDue(bill, p.due_on) || (bill.frequency === "one_time" && !bill.next_due_on);
  if (sameDue || !pushedIt || bill.next_due_on === p.due_on) return null;
  const patch = { ...bill, next_due_on: p.due_on };
  if (bill.frequency === "one_time") patch.active = true;   // 一次性账单记过缴费会被停用，删了记录要恢复
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return p.due_on;
}

/** 改一条已有的缴费记录：不动账单的下次到期日；记过花费的，花费也跟着改（金额变 0 / 跳过就删掉那笔花费，之前没记的有金额就补一笔） */
async function updatePayment(bill, fe) {
  const old = state.billPayments.find((x) => x.id === fe.pay_id.value) || olderPayment(fe.pay_id.value);
  if (!old) return toast(t("找不到这条记录"));
  const r2 = (v) => Math.round(num(v) * 100) / 100, status = fe.status.value, paid_on = fe.paid_on.value || old.paid_on || todayISO();
  const amount = status === "skipped" || fe.amount.value === "" ? null : r2(fe.amount.value), late = r2(fe.late_fee.value), fee = r2(fe.fee_amount?.value), tax = r2(fe.tax_amount?.value), picked = checkedItems(fe), asum = status === "skipped" ? 0 : picked.sum, total = status === "skipped" ? 0 : r2((amount || 0) + late + fee + tax + asum);
  const currency = old.currency || bill.currency || Units.region.currency, at = new Date(`${paid_on}T12:00:00`).toISOString();
  const payee = (fe.store?.value || "").trim().slice(0, 40) || bill.payee || bill.name || null;
  const pay = resolvePayAccount(fe.pay_account?.value, fe.method.value), cardPatch = pay.card_id || old.card_id ? { card_id: pay.card_id } : {};   // 没选过卡就不带这个字段（没执行迁移 036 也能存）
  let purchase_id = old.purchase_id || null;
  if (purchase_id && total > 0) await Store.updatePurchase(purchase_id, { amount: total, purchased_at: at, store: payee, ...cardPatch });
  else if (purchase_id) { await Store.deletePurchase(purchase_id); purchase_id = null; }
  else if (total > 0 && bill.direction !== "receivable") purchase_id = await Store.addPurchase({ item_id: null, name: bill.name, category: `bill_${bill.category}`, quantity: null, unit: null, store: payee, amount: total, currency, purchased_at: at, ...cardPatch, ...(bill.property_id ? { property_id: bill.property_id } : {}) });
  if (!purchase_id) await beforeDeletePayment(old.id).catch(() => {});   // 不再记花费了：贷款拆分的本金行和流水也去掉
  const patch = { paid_on, due_on: fe.due_on.value || null, amount, currency, method: pay.method, confirmation_ref: fe.confirmation_ref.value.trim() || null, late_fee: late, fee_amount: fee, tax_amount: tax, assessment_amount: asum, ...(fe.unit_amount ? { unit_amount: r2(fe.unit_amount.value), parking_amount: r2(fe.parking_amount?.value) } : {}), status, notes: fe.notes.value.trim() || null, purchase_id, ...cardPatch };
  await Store.updateBillPayment(old.id, patch);
  const had = state.assessItems.filter((x) => x.payment_id === old.id).map((x) => x.id);
  const keepIds = status === "skipped" ? [] : picked.ids;
  const toFree = had.filter((x) => !keepIds.includes(x)), toTake = keepIds.filter((x) => !had.includes(x));
  if (toFree.length) await Store.setItemsPayment(toFree, null);
  if (toTake.length) await Store.setItemsPayment(toTake, old.id);
  resetPayHistory();
  if (bill.debt_id && purchase_id) await splitBillPayment(bill, { ...old, ...patch, id: old.id }).catch((e) => console.warn("[debt split]", e.message));
  const moved = fe.due_on.value !== (old.due_on || "") ? await resyncDue(bill, old, fe.due_on.value || null) : null;   // 到期日改了：账单的下次到期跟着对
  toast(moved ? t("已保存修改，下次到期 {d}", { d: fmtDate(moved) }) : t("已保存修改"));
}
export async function saveBillPayForm(f) {
  const fe = f.elements;
  const bill = state.billsEnriched.find((x) => x.id === fe.bill_id.value);
  if (!bill) return toast(t("账单不存在"));
  if (fe.pay_id?.value) return updatePayment(bill, fe);
  const pay = resolvePayAccount(fe.pay_account?.value, fe.method.value);
  // 固定金额的账单涨价了：勾着「更新通常金额」就把这次的金额带进账单（recordPayment 存账单时一起存，不会被旧值盖回去）
  const paidAmt = fe.amount.value === "" ? null : Math.round(num(fe.amount.value) * 100) / 100;
  const unit = fe.unit_amount ? Math.round(num(fe.unit_amount.value) * 100) / 100 : null, parking = fe.parking_amount ? Math.round(num(fe.parking_amount.value) * 100) / 100 : null;   // HOA：单元费 + 车位费
  if (fe.update_typical?.checked && fe.status.value !== "skipped" && paidAmt != null && paidAmt > 0 && paidAmt !== num(bill.typical_amount, NaN)) { bill.typical_amount = paidAmt; if (unit != null) { bill.unit_amount = unit; bill.parking_amount = parking; } }
  const r = await recordPayment(bill, { paid_on: fe.paid_on.value || todayISO(), due_on: fe.due_on.value || null, amount: fe.amount.value === "" ? null : fe.amount.value, status: fe.status.value,
    method: pay.method, card_id: pay.card_id, confirmation_ref: fe.confirmation_ref.value.trim(), late_fee: fe.late_fee.value, unit_amount: unit, parking_amount: parking, fee_amount: fe.fee_amount?.value, tax_amount: fe.tax_amount?.value, ...(fe.status.value === "skipped" ? {} : { assessment_amount: checkedItems(fe).sum, assessment_ids: checkedItems(fe).ids }), notes: fe.notes.value.trim(), store: fe.store?.value });
  const nextTxt = fmtDate(r.next || "") || t("无");
  toast(fe.status.value === "skipped" ? t("已跳过这期，下次到期 {d}", { d: nextTxt }) : r.catchUp ? t("已补记 {due} 那期；下次到期仍是 {d}", { due: fmtDate(fe.due_on.value), d: nextTxt }) : t("已记录，下次到期 {d}", { d: nextTxt }));
}

/** 概览里的“已核对”：自动扣款账单一键记录（金额取通常金额或平均） */
export async function quickVerify(id) {
  const bill = state.billsEnriched.find((x) => x.id === id);
  if (!bill) return;
  const pay = bill.pay_card_id ? resolvePayAccount(bill.pay_card_id) : { card_id: null, method: bill.autopay_method || t("自动扣款") };
  const r = await recordPayment(bill, { paid_on: todayISO(), due_on: bill.next_due_on, amount: bill.est, status: "verified", method: pay.method, card_id: pay.card_id, late_fee: 0, fee_amount: bill.typical_fee, tax_amount: bill.typical_tax });
  toast(t("已核对 {name}，下次 {d}", { name: withProperty(bill.property_id, bill.name), d: fmtDate(r.next || "") || t("无") }));
}
