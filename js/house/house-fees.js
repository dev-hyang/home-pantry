/* 房屋资料里的保险年保费、HOA / 物业费用（账单是唯一来源）、产权与税务的只读展示，以及它们的提醒。 */
import { assessmentParts, assessmentsOf, unpaidItems } from "../bills/assessments-lib.js";
import { currentProp, dealHref, openDeal, propertyLive, statusText } from "./deals.js";
import { daysUntil, esc, fmtDate, money, num } from "../core/util.js";
import { freqText, monthlyEquivalent } from "../bills/logic.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { H } from "./asset-common.js";

/* ── 保险年保费、HOA 常规费用：账单是唯一来源（2026-11，财务 P1）──
 * 资料里不再能改金额，只读显示这套房产「房屋保险」/「HOA / 物业费」类账单的金额，点过去改账单。
 * 旧数据：资料里填过金额、还没有对应账单 → 照样显示（标「资料里的旧值」）并给一个预填好的「创建账单」；旧值原样留在资料里，不悄悄丢。 */
/** 这套房产某类在用的账单：先找挂在这套房产上的，再找没挂房产的（和以前 HOA 链接的规则一致） */
/** 现在看的是哪套房产：添加房产向导里还没建房产，用占位 id，别拿别的房产的账单当它的 */
export const curPid = () => (state.route?.q?.get("newprop") === "1" ? "__new__" : state.propertyId);
export function linkedBill(pid, cat) {
  const list = (state.billsEnriched || []).filter((b) => b.category === cat && b.active !== false && !b.ended);
  return list.find((b) => b.property_id === pid) || list.find((b) => !b.property_id) || null;
}
/** 预填好的新建账单地址（带房产、金额、频率、名称） */
export const newBillHref = (cat, pid, { amount, freq, name, payee } = {}) => `${href("bill", "new")}?${new URLSearchParams(Object.entries({ category: cat, prop: pid || "", amount: amount ?? "", freq: freq || "", name: name || "", payee: payee || "" }).filter(([, v]) => v !== "")).toString()}`;
/** 房屋保险年保费：{ amount（每年，没有为 null）, src: "bill" | "profile" | null, bill } */
export function insurancePremium(pid, p) {
  const b = linkedBill(pid, "insurance_home");
  if (b) return { amount: b.est == null ? null : Math.round((monthlyEquivalent(b, b.est) * 12 || num(b.est)) * 100) / 100, src: "bill", bill: b };
  return num(p?.insurance_premium) > 0 ? { amount: num(p.insurance_premium), src: "profile", bill: null } : { amount: null, src: null, bill: null };
}
const HOA_FREQ = { monthly: "monthly", quarterly: "quarterly", yearly: "annual" };
   // 资料里的缴费周期 → 账单频率
/** HOA 常规费用：{ monthly（折合每月，没有为 null）, text, src, bill, legacy }；账单优先，其次资料里的旧值 */
export function hoaRegular(pid, h) {
  const b = linkedBill(pid, "hoa");
  if (b) return { monthly: b.est == null ? null : monthlyEquivalent(b, b.est) || num(b.est), text: b.est == null ? t("金额未填") : `${money(b.est)} · ${freqText(b)}`, src: "bill", bill: b };
  const parts = num(h?.dues_unit) + num(h?.dues_parking) + num(h?.dues_other), legacy = parts > 0 ? parts : num(h?.dues);
  if (!(legacy > 0)) return { monthly: null, text: "", src: null, bill: null };
  const per = h.dues_period || "monthly";
  return { monthly: per === "quarterly" ? legacy / 3 : per === "yearly" ? legacy / 12 : legacy, text: `${t(H().DUES_PERIODS[per] || "每月")} ${money(legacy)}`, src: "profile", bill: null, legacy, freq: HOA_FREQ[per] || "monthly" };
}
/** 金额旁边的来源说明 + 链接：账单 → 「账单：名称」可点去改；旧值 → 「资料里的旧值 · 创建账单」；都没有 → 「建一条账单」 */
export function amountSource(src, bill, cat, pid, pre) {
  if (src === "bill") return `<a href="${href("bill", bill.id)}">${t("账单：{name}", { name: esc(bill.name) })}</a>`;
  const create = `<a href="${esc(newBillHref(cat, pid, pre))}">${t("创建账单")}</a>`;
  return src === "profile" ? `<span class="badge b-soon">${t("资料里的旧值")}</span> ${create}` : create;
}
/** 房屋概览顶部：房产状态、进行中的交易、编辑房产（同设置页的表单） */
export function statusLine(inCard = false) {
  const p = currentProp(); if (!p) return "";
  const d = openDeal(p.id);
  const B = window.BILLS;
  // 名称 + 一组带标签名的芯片（状态 / 类型 / 用途），避免“值 · 值 · 值”分不清哪个是哪个
  const STATUS_CLS = { looking: "", buying: "b-soon", owned: "b-ok", renting: "b-ok", selling: "b-soon", sold: "", moved_out: "" };
  const tag = (label, value, cls = "") => (value ? `<span class="meta-tag ${cls}"><small>${label}</small>${esc(value)}</span>` : "");
  return `<div class="status-line${inCard ? " in-card" : ""}">
    ${inCard ? "" : `<b class="prop-name">${esc(p.name)}</b>`}
    ${tag(t("状态"), statusText(p), STATUS_CLS[p.status] || "")}
    ${tag(t("类型"), t(B.PROPERTY_KINDS[p.kind] || ""))}
    ${tag(t("用途"), t(B.PROPERTY_ROLES[p.role] || ""))}
    ${d ? `<a class="meta-tag b-soon" href="${dealHref(d)}"><small>${t("交易")}</small>${t("进行中，查看清单")}</a>` : ""}
  </div>`;
}
/* ── HOA / 物业 ── */
/* ── 产权、税务与车位（house_profiles.ownership jsonb，迁移 038）：公寓常见但独栋也用得上 ── */
export const PARKING_TYPES = [["none", "没有车位"], ["street", "路边 / 街道停车许可"], ["lot_assigned", "露天指定车位"], ["lot_open", "露天先到先得"], ["garage_attached", "连通的车库（室内直达）"], ["garage_detached", "独立车库 / 车库楼"]];
export const STORAGE_TYPES = [["none", "没有"], ["assigned", "指定储物间 / 储物柜"], ["fcfs", "公用，先到先得"]];
export const RENT_POLICIES = [["unknown", "不清楚"], ["allowed", "可以出租"], ["approval", "可以出租，需 HOA 审批 / 登记"], ["cap", "有出租比例上限（可能要轮候）"], ["no", "不允许出租"]];
export const TAX_EXEMPTIONS = [["homeowner", "自住减免（Homeowner）"], ["senior", "老年人减免（Senior）"], ["senior_freeze", "老年人评估冻结（Senior Freeze）"], ["veteran", "退伍军人"], ["disabled", "残障人士"], ["longtime", "长期居住（Longtime Occupant）"], ["home_improvement", "房屋改造（Home Improvement）"], ["other", "其他"]];
export const ownershipOf = (p) => ({ pin: "", parking_type: "", parking_deeded: false, parking_pin: "", parking_no: "", storage_type: "", storage_no: "", roof_access: false, tax_exemptions: [], tax_notes: "", ...((p && p.ownership) || {}) });
export const labelOf = (list, k) => t((list.find(([id]) => id === k) || [])[1] || "");
/** 当前资料的 HOA 对象（没填过按房型默认） */
export function hoaOf(p) {
  if (!p) return null;
  const a = H().assocOf(p.house_type);
  return { enabled: a.on, dues_period: "monthly", ...(p.hoa || {}) };
}
/** 每月要交多少：常规月费（账单）+ 本期要交的特别摊派（HOA 账单里没缴的分期 / 一次性结清，到期日在本期月底之前） */
export function hoaMonthly(h, pid = curPid()) {
  const unit = num(h.dues_unit) || 0, parking = num(h.dues_parking) || 0, other = num(h.dues_other) || 0;
  const reg = hoaRegular(pid, h), regular = reg.monthly || 0;   // 常规月费：账单优先（单元 / 车位 / 其他只是资料里的旧拆分，留作参考）
  const ap = reg.bill ? assessmentParts(reg.bill.id, state.assess, state.assessItems, reg.bill.next_due_on) : { installment: 0, payoff: 0 };
  const sa = Math.round((ap.installment + ap.payoff) * 100) / 100;
  return { unit, parking, other, regular, sa, saActive: sa > 0, total: Math.round((regular + sa) * 100) / 100 };
}
/** 资料表单里的「每月总计」卡：只在打开页面时算（特别摊派在 HOA 账单里管理，这里只读） */
export function hoaTotalHtml(h) {
  const m = hoaMonthly(h);
  const parts = [m.regular ? t("月费 {a}", { a: money(m.regular) }) : "", m.sa ? t("特别摊派 {a}", { a: money(m.sa) }) : ""].filter(Boolean);
  return `<span class="ht-label">${t("每月总计")}</span><b>${money(m.total)}</b><small>${parts.length ? "= " + parts.join(" + ") : t("月费和特别摊派都来自 HOA 账单")}</small>`;
}
/** 表单里改了任一金额 → 重算总计卡（金额本身已是只读，只剩旧值拆分会触发） */
export function updateHoaTotal(form) {
  const box = form.querySelector("[data-hoa-total]"); if (!box) return;
  const fe = form.elements, v = (n) => fe[n]?.value ?? "";
  const h = { dues: v("hoa_dues"), dues_unit: v("hoa_dues_unit"), dues_parking: v("hoa_dues_parking"), dues_other: v("hoa_dues_other"), dues_other_label: v("hoa_dues_other_label") };
  box.innerHTML = hoaTotalHtml(h);
  const mini = form.querySelector("[data-hoa-total-mini]"); if (mini) mini.textContent = money(hoaMonthly(h).total);
}
/** 说明 / 备注：空着只占一行，打字时自动长高（main.js autoGrow），上限默认 1000 字，接近上限才显示计数 */
export function noteArea(name, value, placeholder, max = 1000) {
  const v = value || "", rows = Math.min(8, Math.max(1, v.split("\n").reduce((n, l) => n + 1 + Math.floor(l.length / 48), 0)));
  return `<textarea class="grow" name="${name}" rows="${rows}" maxlength="${max}" data-grow placeholder="${esc(placeholder || "")}">${esc(v)}</textarea><small class="grow-count" ${v.length >= max * 0.8 ? "" : "hidden"}>${v.length}/${max}</small>`;
}
/** 特别摊派的状态（数据在 HOA 账单的「特别摊派」里）：none / due（days = 下一期没缴的离今天几天）/ paid；还带 bill、list（各笔摊派）、remaining、next */
export function assessmentStatus(hoa, pid = curPid()) {
  const b = hoa?.enabled ? linkedBill(pid, "hoa") : null;
  if (!b) return { kind: "none" };
  const list = assessmentsOf(b.id, state.assess, state.assessItems).filter((a) => a.status !== "closed");
  if (!list.length) return { kind: "none", bill: b };
  const open = unpaidItems(b.id, state.assess, state.assessItems);
  if (!open.length) return { kind: "paid", bill: b, list };
  return { kind: "due", bill: b, list, next: open[0], days: open[0].due_on ? daysUntil(open[0].due_on) : null, remaining: Math.round(list.reduce((s, a) => s + a.remaining, 0) * 100) / 100,
    names: list.filter((a) => !a.done).map((a) => a.name).join(" · ") };
}
/** 房屋卡片里的 HOA 事实行：{ k: 标签, v: 值 }；没有 HOA 返回 null */
export function hoaFact(p) {
  const hoa = hoaOf(p), a = H().assocOf(p.house_type);
  if (!hoa.enabled) return null;
  const bits = [];
  if (hoa.name) bits.push(`<b>${esc(hoa.name)}</b>`);
  if (hoa.mgmt) bits.push(esc(hoa.mgmt));
  const reg = hoaRegular(p.property_id || curPid(), hoa);
  if (reg.src) bits.push(`${reg.text}${reg.src === "profile" ? ` <small class="muted">${t("（资料里的旧值）")}</small>` : ""}`);
  const sa = assessmentStatus(hoa, p.property_id || curPid());
  if (sa.kind === "due") bits.push(`<span class="badge ${sa.days != null && sa.days <= 14 ? "b-out" : "b-soon"}">${t("特别摊派")} ${money(sa.remaining)} ${t("待缴")}</span>`);
  return { k: `🏘️ ${esc(t(a.label))}`, v: bits.length ? bits.join(" · ") : `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充")}</a>` };
}
/** 概览里的“HOA / 物业”面板：联系方式、费用、特殊评估、规则、该房型须知 */
/** HOA / 物业参考块：{ title, hint, body }；没填且房型一般没有的返回 null */
function hoaBlock(p) {
  const hoa = hoaOf(p), a = H().assocOf(p.house_type);
  const tips = a.tips.length ? `<details class="hoa-tips" ${hoa.enabled && (hoa.name || hoa.rules) ? "" : "open"}><summary>${t("{label}须知（{type}）", { label: t(a.label), type: t(H().typeOf(p.region, p.house_type)?.name || "") })}</summary><ul class="tips">${a.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details>` : "";
  if (!hoa.enabled) {
    if (!a.on && !a.tips.length) return null;
    return { title: esc(t(a.label)), hint: t("没填 {label}，有的话去资料里补充", { label: t(a.label) }),
      body: `${tips || `<div class="empty">${t("这种房型一般没有 {label}", { label: t(a.label) })}</div>`}<p style="margin:10px 0 0"><a class="btn btn-sm btn-ghost" href="${href("house", "profile")}">${t("修改")}</a></p>` };
  }
  // 多个邮箱用 ; 或 , 隔开，各自成一个链接；手机上允许在任意处换行，不再撑宽
  const emails = (hoa.email || "").split(/[;,，；]/).map((x) => x.trim()).filter(Boolean);
  const contact = [
    hoa.phone ? `<a href="tel:${esc(hoa.phone.replace(/[^\d+]/g, ""))}">📞 ${esc(hoa.phone)}</a>` : "",
    ...emails.map((e) => `<a href="mailto:${esc(e)}">✉️ ${esc(e)}</a>`),
    hoa.url ? `<a href="${esc(hoa.url)}" target="_blank" rel="noopener noreferrer">🔗 ${t("业主门户")}</a>` : "",
  ].filter(Boolean).join(" · ");
  const sa = assessmentStatus(hoa, curPid());
  const breakdown = hoa.dues_unit || hoa.dues_parking || hoa.dues_other ? ` <small class="muted">(${[hoa.dues_unit ? t("单元 {a}", { a: money(hoa.dues_unit) }) : "", hoa.dues_parking ? t("车位 {a}", { a: money(hoa.dues_parking) }) : "", hoa.dues_other ? `${esc(hoa.dues_other_label || t("其他"))} ${money(hoa.dues_other)}` : ""].filter(Boolean).join(" + ")})</small>` : "";
  const asLink = sa.bill ? `${href("bill", sa.bill.id)}?sec=assess` : null;
  const saText = sa.kind === "none" ? `${t("没有进行中的特别摊派")}${sa.bill ? ` <a href="${asLink}&edit=new">${t("添加")}</a>` : ""}`
    : `${sa.list.map((a) => `<div><b>${esc(a.name)}</b> · ${t("剩余 {m}", { m: money(a.remaining) })} · ${a.paidN}/${a.rows.length}${a.done ? ` <span class="badge b-ok">${t("已缴清")}</span>` : ""}</div>`).join("")}${sa.kind === "due" ? `<span class="badge ${sa.days != null && sa.days < 0 ? "b-out" : "b-soon"}">${sa.days == null ? t("待缴") : sa.days < 0 ? t("已逾期 {d} 天", { d: -sa.days }) : t("下一期 {d} 天后", { d: sa.days })}</span> ` : ""}<a href="${asLink}">${t("在账单里查看 / 管理")}</a>`;
  const reg = hoaRegular(curPid(), hoa);   // 常规费用：HOA 账单（唯一来源）；以前的 bills.archived 判断是个不存在的字段，现在按 active / 已结束挑
  // 标签 / 值的事实行（与房屋卡片同款）：值可换行，手机上不会把内容挤到屏幕外；表格 + 横向滚动会让长邮箱、备注把值列推出视野
  const row = (k, v) => (v ? `<div class="fact wide"><dt>${k}</dt><dd>${v}</dd></div>` : "");
  const hint = [reg.src ? reg.text : null, sa.kind === "due" ? t("特别摊派待缴") : null, hoa.mgmt].filter(Boolean).join(" · ");
  return { title: `${esc(t(a.label))}${hoa.name ? ` · ${esc(hoa.name)}` : ""}`, hint, open: sa.kind !== "none" && sa.kind !== "paid",
    body: `<p style="margin:0 0 6px;text-align:right"><a class="btn btn-sm btn-ghost" href="${href("house", "profile")}">${t("修改")}</a></p>
      <dl class="fact-grid one">
        ${row(t("管理公司 / 联系人"), hoa.mgmt ? esc(hoa.mgmt) : "")}
        ${row(t("联系方式"), contact)}
        ${row(t("费用"), `${reg.src ? `${reg.text}${reg.src === "profile" ? breakdown : ""} · ` : ""}${amountSource(reg.src, reg.bill, "hoa", curPid(), { amount: reg.legacy, freq: reg.freq, name: hoa.name ? `HOA · ${hoa.name}`.slice(0, 60) : t("HOA 月费"), payee: hoa.name || hoa.mgmt || "" })}`)}
        ${row(t("特别摊派"), saText)}
        ${(() => { const m = hoaMonthly(hoa); return m.sa ? row(t("每月总计"), `<b>${money(m.total)}</b> <small class="muted">= ${t("月费 {a}", { a: money(m.regular) })} + ${t("评估分期 {a}", { a: money(m.sa) })}</small>`) : ""; })()}
        ${row(t("出租规则"), hoa.rent_policy && hoa.rent_policy !== "unknown" ? [labelOf(RENT_POLICIES, hoa.rent_policy), hoa.rent_cap_pct ? t("上限 {p}%", { p: hoa.rent_cap_pct }) : "", hoa.rent_min_months ? t("最短 {n} 个月", { n: hoa.rent_min_months }) : "", hoa.rent_notes ? esc(hoa.rent_notes) : ""].filter(Boolean).join(" · ") : "")}
        ${row(t("诉讼与纠纷"), hoa.lawsuit ? `<span class="badge b-low">${t("有")}</span> ${esc(hoa.lawsuit_note || "")}` : "")}
        ${row(t("规则与限制"), hoa.rules ? `<span class="pre">${esc(hoa.rules)}</span>` : "")}
        ${row(t("备注"), hoa.notes ? `<span class="pre">${esc(hoa.notes)}</span>` : "")}
      </dl>
      ${tips}` };
}
/** 概览里的参考块：标题 + 一句摘要，默认折叠；手机上一屏就能看完“要做的事”，参考资料点开再看 */
export function refSection(id, { title, hint, body, open = false }) {
  return `<section class="section ref" ${id ? `id="${id}"` : ""}><details class="panel ref-panel" ${open ? "open" : ""}>
    <summary><b>${title}</b>${hint ? `<small>${hint}</small>` : ""}<span class="mch" aria-hidden="true">›</span></summary>
    <div class="ref-body">${body}</div></details></section>`;
}
/** 提醒总线：特别摊派里「一次性结清」45 天内到期，或任何一期已逾期（必须）。每月的分期跟着 HOA 账单自己的提醒走，这里不重复提醒 */
export function hoaAlertItems() {
  if (!state.houseEnabled) return [];
  return state.properties.filter(propertyLive).flatMap((prop) => {
    const p = state.houseProfiles[prop.id]; const hoa = hoaOf(p), sa = assessmentStatus(hoa, prop.id);
    if (sa.kind !== "due") return [];
    const urgent = unpaidItems(sa.bill.id, state.assess, state.assessItems).filter((x) => x.due_on && (daysUntil(x.due_on) < 0 || (x.kind === "payoff" && daysUntil(x.due_on) <= 45))).sort((x, y) => x.due_on.localeCompare(y.due_on))[0];
    if (!urgent) return [];
    const days = daysUntil(urgent.due_on), severity = days < 0 ? 0 : days <= 3 ? 1 : days <= 14 ? 2 : 3;
    const a = H().assocOf(p.house_type), name = state.assess.find((x) => x.id === urgent.assessment_id)?.name || "";
    return [{ source: "house", severity, must: true, due: urgent.due_on, daysLeft: days, property_id: prop.id,
      title: `🏘️ ${t(a.label)} ${t("特别摊派")} ${money(urgent.amount)}${name ? ` · ${name}` : ""}`,
      detail: days < 0 ? t("已逾期 {d} 天，逾期有滞纳金并可能留置", { d: -days }) : t("{d} 天后截止（{date}）", { d: days, date: fmtDate(urgent.due_on) }),
      href: `${href("bill", sa.bill.id)}?sec=assess`, actions: [{ type: "link", href: `${href("bill", sa.bill.id)}?pay=1`, label: t("记缴费") }] }];
  });
}
