/* 房屋 / 车辆 → 账单页的卡片清单：这个资产上设置的全部账单（周期性 + 一次性），一张账单一张卡，固定清单、不随时间范围变。
 * 纯函数、不依赖界面（Node 测试直接引用）。 */

/** 账单是不是属于这个资产键（property:ID / asset:ID / person:ID）；周期性账单没有患者，person 只匹配一次性 */
export function belongsTo(key, b, kind) {
  const [type, id] = String(key).split(":");
  if (!id) return false;
  if (type === "property") return b.property_id === id;
  if (type === "asset") return b.asset_id === id;
  if (type === "person") return kind === "onetime" && b.patient_id === id;
  return false;
}

/** 这张账单是不是「已经没事了」：一次性已付清 / 已冲销；周期性已停用 / 已结束。排在最后 */
export function isSettled(b, kind) {
  if (kind === "onetime") return ["paid", "written_off"].includes(b.status);
  return b.active === false || !!b.ended;
}

const dateOf = (b, kind) => (kind === "onetime" ? b.due_on || b.bill_date || b.service_date : b.next_due_on) || "";

/** 取出这个资产的全部账单卡：[{ kind: "recurring" | "onetime", b }]。需要处理的在前（到期日早的在前，没日期的最后），已结清 / 停用的在后 */
export function assetBillCards(key, recurring = [], onetime = []) {
  const all = [...recurring.filter((b) => belongsTo(key, b, "recurring")).map((b) => ({ kind: "recurring", b })), ...onetime.filter((b) => belongsTo(key, b, "onetime")).map((b) => ({ kind: "onetime", b }))];
  const rank = (x) => (isSettled(x.b, x.kind) ? 1 : 0);
  return all.sort((x, y) => rank(x) - rank(y) || (dateOf(x.b, x.kind) || "9999").localeCompare(dateOf(y.b, y.kind) || "9999") || String(x.b.name || x.b.provider || "").localeCompare(String(y.b.name || y.b.provider || "")));
}
