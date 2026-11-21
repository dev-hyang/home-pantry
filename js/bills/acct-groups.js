/* 「账户」分组（财务 → 账户）：信用卡 / 银行账户 / 投资账户 / 电子钱包与礼品卡 各一页，账户概览把它们合在一起看。
 * 投资账户只记「总值」（余额快照，在账户页「更新余额」；每月自动存快照），不记持仓和交易。
 * 纯函数、不依赖界面（Node 测试直接引用）。 */
export const GROUPS = {
  credit: { name: "信用卡", icon: "💳", kinds: ["credit"] },
  bank: { name: "银行账户", icon: "🏦", kinds: ["checking", "savings", "cash", "debit"] },
  invest: { name: "投资账户", icon: "📈", kinds: ["brokerage", "retirement", "education", "kid", "hsa", "fsa", "crypto"] },
  wallet: { name: "电子钱包与礼品卡", icon: "👛", kinds: ["wallet", "gift"] },
};
/** 账户种类 → 属于哪个分组（贷款不在这里：在 借贷；没见过的种类按信用卡处理，和以前「卡」的默认一致） */
export function groupOfKind(kind) {
  if (kind === "loan") return null;
  for (const [id, g] of Object.entries(GROUPS)) if (g.kinds.includes(kind)) return id;
  return "credit";
}
/** 投资账户页按「税务 / 用途」分的几块：退休 / 教育 / 孩子 / 医疗 / 券商 / 加密 */
export const INVEST_SECTIONS = [
  { id: "retirement", icon: "🧓", name: "退休账户（401K / IRA）", kinds: ["retirement"] },
  { id: "education", icon: "🎓", name: "教育账户（529）", kinds: ["education"] },
  { id: "kid", icon: "🧒", name: "孩子的投资账户（Trump account / UTMA）", kinds: ["kid"] },
  { id: "health", icon: "🩺", name: "医疗账户（HSA / FSA）", kinds: ["hsa", "fsa"] },
  { id: "brokerage", icon: "📈", name: "券商 / 投资账户", kinds: ["brokerage"] },
  { id: "crypto", icon: "🪙", name: "加密货币账户", kinds: ["crypto"] },
];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** 一组账户余额行（computeNetWorth 的 accounts）的小结：合计（只算记了余额的）、几个账户、几个该更新（没记余额 / 超过 60 天没更新） */
export function summarizeRows(rows) {
  const counted = rows.filter((r) => r.balance != null && !r.viaDebt);
  return { total: r2(counted.reduce((s, r) => s + (r.side === "l" ? -r.balance : r.balance), 0)), n: rows.length, needUpdate: rows.filter((r) => (r.missing || r.stale) && !r.viaDebt).length };
}
