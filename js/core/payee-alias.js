import { meta } from "../bills/budget.js";

/* ── 收款方归一（设计见 docs/design-payees-time-range.md §3）──
 * 同一家商户在对账单上有很多写法（AMAZON MKTPL*AB12、Amazon.com*2X4R5、AMZN Mktp US*…），按原始描述归成一个名字，
 * 收款方排行不再拆散。顺序：你改名 / 合并时记下的别名（meta._payee_alias：原名小写 → 新名）> 内置规则 > 清理后的原名。
 * Prime 会员 / Prime Video 单独一个「Amazon Prime」（订阅），必须排在 Amazon 前面；Costco Gas、Uber Eats 同理。 */
export const BUILTIN_PAYEES = [
  [/amazon\s*prime|amzn\s*prime|prime\s*video|primevideo/i, "Amazon Prime"],
  [/\bamazon|\bamzn/i, "Amazon"],
  [/wal-?mart|\bwm\s+supercenter|\bwalmart/i, "Walmart"],
  [/costco\s*gas/i, "Costco Gas"],
  [/costco/i, "Costco"],
  [/\btarget\b/i, "Target"],
  [/uber\s*\*?\s*eats|ubereats/i, "Uber Eats"],
  [/\buber\b/i, "Uber"],
  [/apple\.com|\bapple\s+(store|services|music|tv|one|icloud)\b|^\s*apple\b(?!\s*cash)/i, "Apple"],
];
/** 内置规则给这段文字（原始描述，或已存的收款方名）的标准名；没命中返回 "" */
export const builtinPayee = (text) => (BUILTIN_PAYEES.find(([re]) => re.test(String(text || ""))) || [])[1] || "";
/** 你记下的别名：原名（小写、去首尾空格）→ 新名 */
export const userPayeeAliases = () => meta("_payee_alias", {}) || {};
const k = (s) => String(s || "").trim().toLowerCase();
/** 最终收款方：别名 > 内置 > 原名。raw = 清理后的名字，desc = 原始描述（内置规则看原始描述，信息更全） */
export function canonicalPayee(raw, desc = raw) {
  const ua = userPayeeAliases(), hit = ua[k(raw)] || ua[k(desc)];
  return (hit || builtinPayee(desc) || builtinPayee(raw) || raw || "").slice(0, 40);
}
