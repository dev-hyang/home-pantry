import { askDay, billFromDraft, defaultsFor, newDraft, WIZARD_FREQS } from "./wizard.js";

/* 扫描信件 / 账单（#/bill/new 的「选类型」页上）：AI 读完图片后，判断是周期性还是一次性、该进哪张表单、要不要先让用户确认（纯函数，Node 可测）。
 * 模型调用、识别提示词、「只填空着的字段」这些和表单上的「拍账单」共用 core/autofill.js 和 core/ai.js；这里只管路由和隐私规则。 */

export const ONETIME_KINDS = ["medical", "pet", "legal", "project", "travel"];
/** 默认私密的一次性账单种类：图片发给 AI 之前每次都要确认 */
export const PRIVATE_KINDS = ["medical", "legal"];

/** AI 返回的 JSON 是两张表单字段的并集 + bill_type / kind；缺的都是 null */
export const SCAN_SHAPE = {
  bill_type: null, kind: null,
  // 周期性账单（和「拍账单」同一组字段）
  name: null, category: null, payee: null, account_last4: null, amount: null, frequency: null, due_date: null, autopay: null, pay_url: null, currency: null,
  // 一次性账单（和「拍账单 / 保险说明」同一组字段）
  provider: null, patient: null, guarantor: null, subkind: null, bill_ref: null, claim_ref: null, insurer: null, service_date: null, bill_date: null, due_on: null,
  billed_amount: null, insurance_paid: null, adjustment: null, patient_amount: null,
  notes: null,
};

/** 判断去哪张表单：bill_type 不是 onetime 一律当周期性（拿不准时进周期性表单，它字段少、风险小）；一次性的种类不认识就当医疗（默认私密，更保守） */
export function routeScan(d) {
  const type = d?.bill_type === "onetime" ? "onetime" : "recurring";
  const kind = type === "onetime" ? (ONETIME_KINDS.includes(d?.kind) ? d.kind : "medical") : null;
  return { type, kind };
}

/** 发送图片前要不要确认：还不知道是什么账单（选类型页）→ 要；已知是医疗 / 法律 → 要；其余不要 */
export const needsConsent = (type, kind) => type === "unknown" || (type === "onetime" && PRIVATE_KINDS.includes(kind));

/* ── 把 AI 读到的内容变成账单：够了就直接建，不够就退回向导 / 表单（设计 §16.6） ── */
const clean = (v) => (v == null ? "" : String(v).trim());
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !Number.isNaN(Date.parse(v));
const numOr = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null; };
const last4 = (v) => clean(v).replace(/[^0-9A-Za-z]/g, "").slice(-4);

/** 周期性：返回 { bill, draft, missing }。bill 为 null = 缺必填（读不出到期日），draft 是已读到的内容（向导从缺的那一步开始问）。
 *  opts：{ catIds, catName(id), essential(id), currency, today }。必填 = 能算出下次到期日（letter 上的到期日）；名称缺就用付款方 / 分类名。 */
export function recurringFromScan(d, { catIds, catName, essential, currency, today }) {
  const category = catIds.includes(d?.category) ? d.category : "other", df = defaultsFor(category);
  const name = clean(d?.name).slice(0, 60) || clean(d?.payee).slice(0, 60) || catName(category);
  const frequency = WIZARD_FREQS.includes(d?.frequency) ? d.frequency : df.frequency;
  const due = isDate(d?.due_date) ? d.due_date : null, amt = numOr(d?.amount), autopay = d?.autopay === true;
  const url = /^https?:\/\//i.test(clean(d?.pay_url)) ? clean(d.pay_url) : "";
  const draft = newDraft({ category, name, payee: clean(d?.payee).slice(0, 60), frequency, amount_type: amt != null && amt >= 0 && df.amount_type === "fixed" ? "fixed" : df.amount_type, typical_amount: amt != null && amt >= 0 ? Math.round(amt * 100) / 100 : "" });
  draft.pay = autopay ? "autopay" : df.pay === "autopay" && !autopay ? "online" : df.pay; draft.pay_url = autopay ? "" : url;
  if (due) { draft.next_due_on = due; if (askDay(frequency)) draft.due_day = String(parseInt(due.slice(8, 10), 10)); }
  const missing = [];
  if (!due) missing.push("due_date");
  if (!due) return { bill: null, draft, missing };
  const bill = billFromDraft(draft, { today, currency: /^[A-Za-z]{3}$/.test(clean(d?.currency)) ? clean(d.currency).toUpperCase() : currency, essential: essential(category), payFields: {} });
  if (amt != null && amt >= 0) bill.typical_amount = Math.round(amt * 100) / 100;   // 变动金额的账单也留下信上的金额，当作未缴那期的估算
  if (last4(d?.account_last4)) bill.account_last4 = last4(d.account_last4);
  if (clean(d?.notes)) bill.notes = clean(d.notes).slice(0, 500);
  if (url && autopay) bill.pay_url = url;
  return { bill, draft, missing };
}

/** 一次性：返回账单行或 null（缺必填 = 没有机构名，或一个金额都没读到 → 退回一次性账单表单让用户补）。
 *  opts：{ kind, subIds, currency, visibility }；种类不认识的小类丢掉；日期不合格的丢掉。 */
export function onetimeFromScan(d, { kind, subIds = [], currency, visibility }) {
  const provider = clean(d?.provider).slice(0, 60); if (!provider) return null;
  const billed = numOr(d?.billed_amount), owed = numOr(d?.patient_amount);
  if ((billed == null || billed < 0) && (owed == null || owed < 0)) return null;
  const money = (v) => (v != null && v >= 0 ? Math.round(v * 100) / 100 : null), date = (v) => (isDate(v) ? v : null);
  return { property_id: null, asset_id: null, kind, subkind: subIds.includes(d?.subkind) ? d.subkind : null, provider, patient: clean(d?.patient).slice(0, 40) || null, patient_id: null,
    guarantor: clean(d?.guarantor).slice(0, 40) || null, guarantor_id: null, bill_ref: clean(d?.bill_ref).slice(0, 60) || null, claim_ref: clean(d?.claim_ref).slice(0, 60) || null, insurer: clean(d?.insurer).slice(0, 60) || null,
    service_date: date(d?.service_date), bill_date: date(d?.bill_date), due_on: date(d?.due_on), billed_amount: money(billed), insurance_paid: money(numOr(d?.insurance_paid)) ?? 0, adjustment: money(numOr(d?.adjustment)) ?? 0,
    patient_amount: money(owed), currency: /^[A-Za-z]{3}$/.test(clean(d?.currency)) ? clean(d.currency).toUpperCase() : currency, status: "open", hsa_eligible: false, visibility, notes: clean(d?.notes).slice(0, 500) || null };
}
