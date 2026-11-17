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
