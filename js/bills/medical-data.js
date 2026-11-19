/* 医疗账单的数据读取与标签（启动时就要用，不放进按需加载的页面模块里）。 */
import { Store } from "../core/store.js";
import { enrichMedical, mergeMedical } from "./medical.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 重读医疗账单和付款（保存 / 删除后用，不用整个 refresh）；表还没建（没执行迁移 027）时当作空 */
export async function reloadMedical() {
  try {
    const [bills, pays] = await Promise.all([Store.listMedicalBills(), Store.listMedicalPayments()]);
    state.medBills = bills; state.medPayments = pays;
  } catch (e) { console.warn("[medical]", e.message); state.medBills = state.medBills || []; state.medPayments = state.medPayments || []; }
  state.medEnriched = enrichMedical(state.medBills, state.medPayments);
  mergeMedical();
}
export function applyMedical(bills, pays) {
  state.medBills = bills; state.medPayments = pays; state.medEnriched = enrichMedical(bills, pays); mergeMedical();
}
export const medBillLabel = (id) => { const b = state.medEnriched.find((x) => x.id === id); return b ? `${b.provider}${b.patient ? ` · ${b.patient}` : ""}` : t("新账单"); };
