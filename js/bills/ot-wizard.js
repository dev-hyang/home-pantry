/* 创建一次性账单的向导：步骤、草稿、校验、拼账单（纯函数，Node 可测；界面在 ot-wizard-views.js）。设计见 docs/design-bills-overview.md §16.5。
 * 种类信息（K：是否有保险、默认可见范围、小类）由界面层从 medical.js 的 KINDS 传进来，这里不依赖界面。 */

export const OT_STEPS = [
  { id: 1, name: "哪一类账单" },
  { id: 2, name: "谁收的、关于谁" },
  { id: 3, name: "多少钱、什么时候" },
  { id: 4, name: "挂在哪、谁能看" },
  { id: 5, name: "确认一下" },
];
export const OT_LAST = OT_STEPS.length;
export const OT_KINDS = ["medical", "pet", "legal", "project", "travel"];

export function newOtDraft(init = {}) {
  return { kind: OT_KINDS.includes(init.kind) ? init.kind : "medical", provider: init.provider || "", subkind: "", patient: init.patient || "", patient_id: "", bill_date: "", due_on: "", service_date: "",
    billed_amount: "", insurance_paid: "", patient_amount: "", property_id: init.property_id || "", asset_id: "", visibility: "", notes: "", ...init.extra };
}
const numOrNull = (v) => { if (v === "" || v == null) return null; const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const dateOrNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") && !Number.isNaN(Date.parse(v)) ? v : null);

/** 每步校验：第 2 步要机构名；第 3 步至少一个金额（总额或自付），填了的金额必须是数字 */
export function validateOtStep(step, d) {
  const errors = {};
  if (step === 2 && !String(d.provider || "").trim()) errors.provider = "请填写商家 / 机构名称。";
  if (step === 3) {
    for (const k of ["billed_amount", "insurance_paid", "patient_amount"]) if (d[k] !== "" && numOrNull(d[k]) == null) errors[k] = "金额要填不小于 0 的数字。";
    if (!Object.keys(errors).length && numOrNull(d.billed_amount) == null && numOrNull(d.patient_amount) == null) errors.billed_amount = "请至少填一个金额（总额，或你要付的金额）。";
  }
  return { ok: !Object.keys(errors).length, errors };
}

/** 拼出 Store.saveMedicalBill 要的行；字段缺省和一次性账单表单（saveMedBillForm）一致。
 *  ctx：{ currency, K（该种类的信息：insurance、visibility）, patientId（旧用法：按名字对上的家庭成员 id）, patientName（选了家庭成员时他 / 她 / 它的名字） }。
 *  选了家庭成员（d.patient_id）：存 id + 名字；没选：存文字（事项 / 项目名，或旧用法）。 */
export function otRowFromDraft(d, { currency, K, patientId = null, patientName = null, prior = null }) {   // prior：同一位患者最近一张账单（带入保险公司和计划类型）
  return {
    property_id: d.property_id || null, asset_id: d.asset_id || null, kind: d.kind, subkind: d.subkind || null, provider: d.provider.trim().slice(0, 60),
    patient: d.patient_id ? (patientName || d.patient.trim().slice(0, 40) || null) : (d.patient.trim().slice(0, 40) || null), patient_id: d.patient_id || patientId, guarantor: null, guarantor_id: null, bill_ref: null, claim_ref: null, insurer: K?.insurance && prior?.insurer ? prior.insurer : null, plan_type: K?.insurance && prior?.plan_type ? prior.plan_type : null,
    service_date: dateOrNull(d.service_date), bill_date: dateOrNull(d.bill_date), due_on: dateOrNull(d.due_on),
    billed_amount: numOrNull(d.billed_amount), insurance_paid: K?.insurance ? numOrNull(d.insurance_paid) ?? 0 : 0, adjustment: 0, patient_amount: numOrNull(d.patient_amount),
    currency, status: "open", hsa_eligible: false, visibility: d.visibility || K?.visibility || "family", notes: d.notes.trim().slice(0, 500) || null,
  };
}
