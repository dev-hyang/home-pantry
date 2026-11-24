/* 账单表单（整页；编辑时下方带缴费记录）：类型、金额、周期、枢纽页。 */
import { numAttrs } from "../core/ui-num.js";
import { SECTIONS, go, href } from "../core/router.js";
import { Store } from "../core/store.js";
import { VEHICLE_CATS } from "./instances.js";
import { askInline } from "../core/ask.js";
import { assessFormPage, assessListPage } from "./assessments-views.js";
import { assessPaysPage } from "./assessments-pays.js";
import { assessmentParts, assessmentsOf } from "./assessments-lib.js";
import { assetSelectHtml } from "./asset-ui.js";
import { autofillBar } from "../core/autofill.js";
import { billAsk, billCat } from "./logic.js";
import { billDetailPage } from "./bill-detail.js";
import { billHeadCard, payFormPage, staleNotice } from "./bill-pay.js";
import { copyOf } from "../core/more-menu.js";
import { crumbNav } from "../core/hub.js";
import { esc, fmtDate, num, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { olderPayment, payHistoryPage, rowHtml as payRow } from "./pay-history.js";
import { payExpNote } from "./bill-save.js";
import { payTotal } from "./pay-total.js";
import { payDetailPage } from "./pay-detail-page.js";
import { propertyActive } from "../core/lifecycle.js";
import { state } from "../core/state.js";
import { viewBillWizard } from "./wizard-views.js";
import { B, billCrumb, billRoot, billTrail, billTypeChooser, mny } from "./bill-common.js";
import { PAY_EXTRA, accountOptions, acctById, payAcctValue, paymentPayLabel } from "./card-picker.js";
import { adultPeople } from "../settings/family-lite.js";

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
  if (b && sec === "detail") return billDetailPage(b, root, hubHref);   // 详情：各块只读 + 各自的「编辑」（?sec=basic|amount|autopay|other）
  if (b && sec === "assess") {   // 特别摊派：?sec=assess = 列表；?sec=assess&edit=id|new = 新增 / 编辑页
    const editId = r.q.get("edit"), listHref = `${hubHref}?sec=assess`;
    if (editId) { const a = editId === "new" ? null : state.assess.find((x) => x.id === editId && x.bill_id === b.id); const copyId = r.q.get("copy"), copyFrom = editId === "new" && copyId ? state.assess.find((x) => x.id === copyId && x.bill_id === b.id) || null : null; if (editId === "new" || a) return assessFormPage(b, a, crumbNav([...billTrail(b, root, hubHref), { href: listHref, label: t("特别摊派") }, { label: a ? t("编辑摊派") : t("新增摊派") }]), copyFrom, r.q.get("add")); }
    const paysOf = r.q.get("pays");   // 摊派的缴费记录页：?sec=assess&pays=摊派id（all = 全部摊派）
    if (paysOf) return assessPaysPage(b, crumbNav([...billTrail(b, root, hubHref), { href: listHref, label: t("特别摊派") }, { label: t("缴费记录") }]), paysOf);
    return assessListPage(b, billCrumb(b, root, hubHref, t("特别摊派")));
  }
  if (b && sec === "pay") {   // 缴费记录：?sec=pay = 全部记录（搜索 / 筛选）；?sec=pay&edit=id 或 ?pay=1 = 独立的编辑 / 新建页
    const editId = r.q.get("edit"), copyId = r.q.get("copy"), listHref = `${hubHref}?sec=pay`;
    if (r.q.get("view")) { const vid = r.q.get("view"); return payDetailPage(b, b.pays.find((x) => x.id === vid) || olderPayment(vid), billTrail(b, root, hubHref), listHref); }   // 缴费记录详情（只读，分块）
    if (editId || copyId || r.q.get("pay") === "1") {
      const src = editId || copyId ? b.pays.find((x) => x.id === (editId || copyId)) || olderPayment(editId || copyId) : null;
      const edit = editId ? src : null;
      // 复制：带入这笔的金额、方式、收款方等，缴费日期改成今天、对应到期日用账单当前的下次到期；不带花费关联和确认号
      const copy = copyId && src ? { ...copyOf(src, ["purchase_id", "confirmation_ref"]), paid_on: todayISO(), due_on: b.next_due_on || "" } : null;
      return `<section class="section form-page">${crumbNav([...billTrail(b, root, hubHref), { href: listHref, label: t("缴费记录") }, { label: edit ? t("编辑缴费记录") : r.q.get("settle") ? t("一次性结清") : b.autopay ? t("记核对") : t("记缴费") }])}${payFormPage(b, edit || copy, !!copy, r.q.get("settle") || null)}</section>`;
    }
    return payHistoryPage(b, billCrumb(b, root, hubHref, t("缴费记录")), staleNotice(b));
  }
  const full = !b || sec === "all";   // 旧地址 ?sec=all 仍能打开整张表单；账单菜单现在进详情页
  const hide = (k) => (b && sec && !full && sec !== k ? "hidden" : "");
  return `
    <section class="section form-page">
      ${b ? billCrumb(b, root, hubHref, full ? t("编辑账单") : t(BILL_SECTIONS.find((s) => s.id === sec)?.name || "")) : crumbNav([...billRoot(), { label: t("添加账单") }])}
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
            <label>${t("房产")}<select name="property_id"><option value="">${t("与房产无关")}</option>${state.properties.filter((p) => propertyActive(p) || p.id === v.property_id).map((p) => `<option value="${p.id}" ${p.id === v.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
            ${assetSelectHtml(v.asset_id, state.bills)}
            ${landlord || v.direction === "receivable" ? `<label>${t("方向")}<select name="direction"><option value="payable" ${v.direction !== "receivable" ? "selected" : ""}>${t("我付出去（应付）")}</option><option value="receivable" ${v.direction === "receivable" ? "selected" : ""}>${t("别人付给我（应收，如租金）")}</option></select></label>` : `<input type="hidden" name="direction" value="payable">`}
            <label>${t("付款方 / 收款方")}<input name="payee" maxlength="60" placeholder="${t("例如：ComEd")}" value="${d(v.payee)}"></label>
          </div>
        </fieldset>
        <fieldset data-sec="amount" ${hide("amount")}>
          <legend>${t("② 多少钱、多久一次")}</legend>
          <div class="form-grid">
            <label>${t("频率")}<select name="frequency">${opts(B().FREQUENCIES, v.frequency)}</select></label>
            <label>${t("每 N 个月（自定义时）")}<input name="interval_months" ${numAttrs("int", { max: 60, min: 1, step: null })} value="${d(v.interval_months)}"></label>
            <label>${t("每月几号到期")}<input name="due_day" ${numAttrs("int", { max: 31, min: 1, step: null })} placeholder="${t("月付类填")}" value="${d(v.due_day)}"></label>
            <label>${t("固定日期（半年 / 年付）")}<input name="due_dates" placeholder="${t("例如 03-01, 08-01")}" value="${d((v.due_dates || []).join(", "))}"><small>${t("填了固定日期就按它循环，忽略“每月几号”")}</small></label>
            <label>${t("下次到期日")}<input name="next_due_on" type="date" value="${d(v.next_due_on)}"><small>${t("留空会按规则自动算；每周 / 年付没填日期的请手动填")}</small></label>
            <label>${t("金额类型")}<select name="amount_type"><option value="fixed" ${v.amount_type === "fixed" ? "selected" : ""}>${t("固定")}</option><option value="variable" ${v.amount_type !== "fixed" ? "selected" : ""}>${t("每次不同")}</option></select></label>
            <label>${t("通常金额")}<input name="typical_amount" ${numAttrs("money")} placeholder="${t("每次不同的可留空，按记录平均")}" value="${d(v.typical_amount)}"><small>${t("固定金额填这里。水电燃气这类每次不同的：还没缴的那期先按最近 6 次的均值估（标“估”），记缴费时填实际金额，那一期就变成真实数字。")}</small></label>
            <label class="hoa-only">${t("单元费 Unit assessment")}<input name="unit_amount" ${numAttrs("money")} value="${d(v.unit_amount)}"><small>${t("HOA 月费分成单元费和车位费；填了，“通常金额”自动 = 两者之和。")}</small></label>
            <label class="hoa-only">${t("车位费 Parking assessment")}<input name="parking_amount" ${numAttrs("money")} value="${d(v.parking_amount)}"></label>
            <label>${t("通常手续费（估算）")}<input name="typical_fee" ${numAttrs("money")} value="${d(v.typical_fee)}"><small>${t("有服务费 / 刷卡费的填；没缴之前用它估“费用总额”，记缴费时当默认值，实际金额不同就改。")}</small></label>
            <label>${t("通常税（估算）")}<input name="typical_tax" ${numAttrs("money")} value="${d(v.typical_tax)}"><small>${t("税额每次可能不一样；这里填大概值，记缴费时填实际的。")}</small></label>
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
            <label>${t("账号尾号")}<input name="account_last4" maxlength="100" placeholder="${t("账号尾号（最多 100 位）")}" value="${d(v.account_last4)}"></label>
            <label>${t("登录提示")}<input name="login_hint" maxlength="80" placeholder="${t("例如：用 Gmail 登录，密码在密码管理器")}" value="${d(v.login_hint)}"></label>
            <label>${t("账单怎么来")}<select name="statement_channel">${opts(B().STATEMENTS, v.statement_channel)}</select></label>
          </div>
        </fieldset>
        <fieldset data-sec="other" ${hide("other")}>
          <legend>${t("④ 提醒与其他")}</legend>
          <div class="form-grid">
            <label>${t("提前提醒（天，逗号分隔）")}<input name="reminder_days" placeholder="7, 1" value="${d((v.reminder_days || [7, 1]).join(", "))}"></label>
            <label>${t("宽限天数")}<input name="grace_days" ${numAttrs("int", { max: 60, step: null })} value="${d(v.grace_days ?? 0)}"></label>
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
  const recent = b.pays.slice(0, 6).map((p) => payRow(b, p)).join("");   // 和「全部缴费记录」同一种行：点一下编辑，⋯ / 长按有 编辑、复制、删除
  const payCard = `<section class="panel prof-card" aria-labelledby="bc-pay">
      <header class="prof-head"><span class="mi" aria-hidden="true">✅</span><div class="prof-t"><h3 id="bc-pay">${t("缴费记录")}</h3><small>${b.pays.length ? t("{n} 条，最近 {d}", { n: b.pays.length, d: fmtDate(b.pays[0].paid_on) }) : t("还没有记录")}</small></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${b.pays.length ? `${base}?sec=pay` : `${base}?pay=1`}" aria-label="${esc(t("缴费记录"))}">${b.pays.length ? t("全部") : t("记一笔")}</a></header>
      ${recent ? `<ul class="restock-list pay-list">${recent}</ul>` : `<p class="muted prof-empty">${t("还没有记录")}</p>`}</section>`;
  const asList = assessmentsOf(b.id, state.assess, state.assessItems), cur = b.currency;
  const assessCard = asList.length || b.category === "hoa" ? `<section class="panel prof-card" aria-labelledby="bc-as">
      <header class="prof-head"><span class="mi" aria-hidden="true">📣</span><div class="prof-t"><h3 id="bc-as">${t("特别摊派")}</h3><small>${asList.length ? t("{n} 笔，剩余 {m}", { n: asList.length, m: mny(asList.reduce((s, x) => s + x.remaining, 0), cur) }) : t("没有")}</small></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${base}?sec=assess${asList.length ? "" : "&edit=new"}">${asList.length ? t("全部") : t("添加")}</a></header>
      ${asList.length ? `<ul class="restock-list">${asList.slice(0, 3).map((x) => `<li class="as-link"><a class="as-hit" href="${base}?sec=assess&focus=${x.id}" aria-label="${esc(t("打开摊派：{n}", { n: x.name }))}"><span class="badge ${x.done ? "b-ok" : ""}">${x.done ? t("已缴清") : x.status === "closed" ? t("已关闭") : `${x.paidN}/${x.rows.length}`}</span><div class="grow">${esc(x.name)}</div><b>${mny(x.remaining, cur)}</b><span class="mch" aria-hidden="true">›</span></a></li>`).join("")}</ul>` : `<p class="muted prof-empty">${t("HOA 临时收的大额费用记在这里。")}</p>`}</section>` : "";
  const q = state.route?.q, banner = billBanner(b, q, base);
  return `<section class="section">
    ${crumbNav([...billTrail(b, root, href("bill", b.id)).slice(0, -1), { label: b.name, icon: billCat(b.category).icon }])}
    ${billHeadCard(b, base)}
    ${banner}
    <div class="prof-grid bill-detail-grid one-col">${assessCard}${payCard}</div>
    ${askInline(billAsk(b))}
  </section>`;
}
export const L = (zh, en) => (lang === "en" ? en : zh);
   // 提示条里的字段标签：中英文直接写在这里
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
export const headSec = (title, rows) => { const r = rows.filter(([, v]) => v); return r.length ? `<section class="bh-sec" aria-label="${esc(title)}"><h3>${esc(title)}</h3><dl class="bh-table">${r.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl></section>` : ""; };
export const linkOf = (url) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(String(url).replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 42))}</a>` : "");
