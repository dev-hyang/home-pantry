/* 事件型账单（医疗账单；kind 预留宠物 / 法律税务 / 项目）：数据、算账、提醒、并入花费统计。界面在 medical-views.js。
 *
 * 一张账单 = 一次就诊 / 一次事件：总额 − 保险已付 − 冲减 = 自付金额（也可以直接填自付金额），分多次付款，余额和状态在这里算。
 * 付款（medical_payments）是花费的唯一来源：不另写 purchases——那会让私密账单的金额、医院在全家的花费明细里露出来；
 * 而是把“当前这个人有权限看到的付款”变成虚拟的花费记录并进 state.purchases，统计、预算、钻取、导出都照常。 */
import { state } from "../core/state.js";
import { daysUntil, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { registerAlerts } from "../core/alerts.js";

/* 事件型账单的种类：同一套数据（账单 + 分次付款 + 余额），换标签和小类。
 * insurance = 有没有“保险已付 / 保险公司 / 理赔号”这几项；visibility = 新建时默认谁能看（医疗、法律默认私密）；
 * 统计归类见 stats/views.js 的 statCat：medical → 医疗，pet（category = pet_care）→ 宠物，legal → 其他，project → 房屋维护 */
export const KINDS = {
  medical: { name: "医疗", icon: "🏥", provider: "医院 / 化验所", who: "患者 Patient", guarantor: true, insurance: true, visibility: "private", billed: "账单总额", owed: "自付金额 Patient responsibility", subs: [["hospital", "医院", "🏥"], ["clinic", "门诊 / 诊所", "🩺"], ["lab", "化验", "🧪"], ["imaging", "影像", "🩻"], ["pharmacy", "药房", "💊"], ["dental", "牙科", "🦷"], ["vision", "视力", "👓"], ["therapy", "治疗 / 康复", "🧠"], ["ambulance", "救护车", "🚑"], ["other", "其他", "📄"]] },
  pet: { name: "宠物", icon: "🐾", provider: "兽医院 / 宠物店", who: "宠物", guarantor: false, insurance: true, visibility: "family", billed: "账单总额", owed: "自付金额", subs: [["vet", "兽医", "🩺"], ["emergency", "急诊", "🚨"], ["grooming", "美容", "✂️"], ["boarding", "寄养", "🏠"], ["training", "训练", "🎓"], ["supplies", "用品 / 药品", "🛒"], ["other", "其他", "📄"]] },
  legal: { name: "法律 / 税务", icon: "⚖️", provider: "律所 / 会计师事务所", who: "事项 / 当事人", guarantor: false, insurance: false, visibility: "private", billed: "账单总额", owed: "本次应付", subs: [["attorney", "律师", "⚖️"], ["cpa", "会计 / 报税", "🧮"], ["notary", "公证 / 认证", "🖋️"], ["filing", "申请 / 备案费", "📑"], ["other", "其他", "📄"]] },
  project: { name: "装修 / 项目", icon: "🔨", provider: "承包商 / 供应商", who: "项目名称", guarantor: false, insurance: false, visibility: "family", billed: "合同 / 报价总额", owed: "应付金额（本期或总计）", subs: [["contractor", "承包商", "👷"], ["materials", "材料", "🧱"], ["permit", "许可 / 检验", "📋"], ["design", "设计", "📐"], ["other", "其他", "📄"]] },
};
export const kindOf = (b) => KINDS[b?.kind] || KINDS.medical;
export const subName = (b) => (kindOf(b).subs.find(([k]) => k === b?.subkind) || [])[1] || "";
export const subIcon = (b) => (kindOf(b).subs.find(([k]) => k === b?.subkind) || [])[2] || kindOf(b).icon;
export const STATUS = { awaiting_insurance: "等保险理赔", open: "待付", disputed: "争议中", collections: "催收中", written_off: "已冲销", partial: "部分已付", paid: "已结清" };
export const STATUS_CLS = { awaiting_insurance: "b-soon", open: "b-low", disputed: "b-out", collections: "b-out", written_off: "", partial: "b-soon", paid: "b-ok" };
export const detailHref = (id) => `${href("bills", "medical")}?bill=${id || "new"}`;

const r2 = (v) => Math.round(v * 100) / 100;
/** 应付（自付金额）：填了就用；没填 = 总额 − 保险已付 − 冲减；两个都没有 = 还不知道（null） */
export function owedOf(b) {
  if (b.patient_amount != null && b.patient_amount !== "") return num(b.patient_amount);
  if (b.billed_amount != null && b.billed_amount !== "") return Math.max(0, r2(num(b.billed_amount) - num(b.insurance_paid) - num(b.adjustment)));
  return null;
}

/** 丰富账单：已付、应付、余额、状态（已结清 / 部分已付由付款算出，其余是手动状态）、距到期天数、等保险天数 */
export function enrichMedical(bills, payments) {
  const today = todayISO();
  return bills.map((b) => {
    const pays = payments.filter((p) => p.bill_id === b.id).sort((x, y) => String(y.paid_on).localeCompare(String(x.paid_on)));
    const paid = r2(pays.reduce((s, p) => s + num(p.amount), 0)), owed = owedOf(b);
    const balance = owed == null ? null : Math.max(0, r2(owed - paid));
    const manual = ["disputed", "collections", "written_off"].includes(b.status);
    let status = b.status;
    if (!manual && owed != null && owed > 0 && balance <= 0.005) status = "paid";
    else if (!manual && paid > 0 && balance > 0.005) status = "partial";
    else if (!manual && owed === 0 && b.status !== "awaiting_insurance") status = "paid";
    const open = status !== "paid" && status !== "written_off" && (balance == null || balance > 0.005);
    const daysLeft = b.due_on && open ? daysUntil(b.due_on) : null;
    const refDate = b.bill_date || b.service_date;
    const waitDays = b.status === "awaiting_insurance" && refDate ? -daysUntil(refDate) : null;
    return { ...b, pays, paid, owed, balance, status, open, daysLeft, waitDays, overdue: daysLeft != null && daysLeft < 0 && today > b.due_on };
  });
}

/** 有权限看到的付款 → 虚拟花费记录（category = medical，商店 = 医院 / 化验所）。id 带前缀，不会和真实花费冲突；明细里点它跳到账单页 */
export function medicalVirtuals() {
  const bills = new Map(state.medBills.map((b) => [b.id, b]));
  return state.medPayments.filter((p) => bills.has(p.bill_id)).map((p) => {
    const b = bills.get(p.bill_id);
    return { id: `med:${p.id}`, virtual: "medical", bill_id: b.id, name: `${t(kindOf(b).name)} · ${b.provider}`, category: b.kind === "pet" ? "pet_care" : b.kind || "medical", quantity: null, unit: null,
      store: b.provider, amount: num(p.amount), currency: p.currency || b.currency, purchased_at: new Date(`${p.paid_on}T12:00:00`).toISOString(), created_by: p.paid_by };
  });
}
/** 真实花费 + 虚拟的医疗付款：每次花费或医疗数据更新后调用 */
export function mergeMedical() { state.purchases = [...state.purchases.filter((p) => !p.virtual), ...medicalVirtuals()]; }

/** 提醒：逾期 / 一周内到期 / 一个月内到期；等保险理赔超过 45 天（该问问了） */
export function medicalAlertItems() {
  if (!state.billsEnabled) return [];
  const out = [];
  for (const b of state.medEnriched) {
    if (!b.open) continue;
    const link = detailHref(b.id), who = [b.patient, b.provider].filter(Boolean).join(" · ");
    const mk = (severity, title, detail, label, cls) => out.push({ source: "medical", severity, must: severity <= 1, due: b.due_on, daysLeft: b.daysLeft, title: `${kindOf(b).icon} ${title}`, detail, href: link,
      badge: { label, cls }, actions: [{ type: "link", href: link, label: t("看账单"), cls: "btn-ghost" }] });
    if (b.balance != null && b.balance > 0 && b.daysLeft != null) {
      if (b.daysLeft < 0) mk(0, t("{k}账单已逾期：{who}", { k: t(kindOf(b).name), who }), t("逾期 {d} 天，余额 {a}", { d: -b.daysLeft, a: Units.money(b.balance, b.currency) }), t("逾期"), "b-out");
      else if (b.daysLeft <= 7) mk(2, t("{k}账单快到期：{who}", { k: t(kindOf(b).name), who }), t("{d} 天后到期，余额 {a}", { d: b.daysLeft, a: Units.money(b.balance, b.currency) }), t("{d} 天", { d: b.daysLeft }), "b-soon");
      else if (b.daysLeft <= 30) mk(3, t("{k}账单一个月内到期：{who}", { k: t(kindOf(b).name), who }), t("{d} 天后到期，余额 {a}", { d: b.daysLeft, a: Units.money(b.balance, b.currency) }), t("{d} 天", { d: b.daysLeft }), "b-ok");
    }
    if (b.waitDays != null && b.waitDays > 45) mk(3, t("{k}账单等保险理赔 {d} 天了：{who}", { k: t(kindOf(b).name), d: b.waitDays, who }), t("问一下保险公司理赔进度，再核对自付金额"), t("等理赔"), "b-soon");
  }
  return out;
}
registerAlerts(medicalAlertItems);
