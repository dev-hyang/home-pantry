/* 买卖清单链接行的纯逻辑（不碰页面，方便测试）；说明见 tax-links.js */
import { ui } from "./tax-ui.js";
import { state } from "../core/state.js";

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const dayOf = (iso) => String(iso || "").slice(0, 10);

/** 一行链接解析成显示 / 计算用的行：missing = 记录读到了但找不到（已删除）→ 金额按 0 算 */
export function resolveLink(row, pid) {
  if (row.link === "income") {   // 收入记录全部在内存里（state.inc.rec），读到了就以记录为准
    const live = (state.inc?.rec || []).find((r) => r.id === row.ref);
    if (live) return { ...row, desc: live.source_name || row.desc, amount: r2(live.amount), on: dayOf(live.received_on) || row.on };
    return state.inc?.loaded ? { ...row, missing: true, amount: 0 } : row;
  }
  const got = ui.spend.get(pid), live = got && !got.err ? got.rows.find((r) => r.id === row.ref) : null;
  if (live) return { ...row, desc: live.name || row.desc, amount: r2(live.amount), on: dayOf(live.purchased_at) || row.on };
  if (got && !got.err && got.rows) return { ...row, missing: true, amount: 0 };
  return row;
}
/** 这套房所有清单里已经链接过的花费 id */
export function linkedRefs(x, keys, kind = "spend") {
  return new Set(keys.flatMap((k) => (x[k] || []).filter((r) => r.link === kind).map((r) => r.ref)));
}
/** 选择器里能选的收入：关联了这套房的、还没被链接 */
export function pickableIncome(pid, linked) {
  return (state.inc?.rec || []).filter((r) => r.property_id === pid && Number(r.amount) > 0 && !linked.has(r.id)).sort((a, b) => String(b.received_on).localeCompare(String(a.received_on)));
}
/** 勾选的记录 → 要存进清单的链接行（备份名称 / 金额 / 日期只在记录没读到时用） */
export function linkRows(kind, pid, ids) {
  if (kind === "income") return pickableIncome(pid, new Set()).filter((r) => ids.has(String(r.id))).map((r) => ({ link: "income", ref: r.id, desc: String(r.source_name || "").slice(0, 60), amount: r2(r.amount), on: dayOf(r.received_on) }));
  return (ui.spend.get(pid)?.rows || []).filter((r) => ids.has(String(r.id))).map((r) => ({ link: "spend", ref: r.id, desc: String(r.name || "").slice(0, 60), amount: r2(r.amount), on: dayOf(r.purchased_at) }));
}
/** 选择器里能选的花费：这套房的、不是转账、不是账单虚拟行、有金额、还没被链接 */
export function pickable(pid, linked, isTransfer) {
  const got = ui.spend.get(pid); if (!got || got.err) return [];
  return got.rows.filter((r) => !r.virtual && r.amount != null && Number(r.amount) !== 0 && !isTransfer(r.category, r.nature) && !linked.has(r.id))
    .sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)));
}

