/* 银行对账单导入：CSV 解析、认列、商家合并和归类规则。 */
import { S } from "./bank-rows.js";
import { accounts } from "./bank-accounts-ai.js";
import { canonicalPayee } from "../core/payee-alias.js";

/* ───────────── CSV 解析 ───────────── */
export function decode(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { /* 不是 UTF-8 */ }
  try { return new TextDecoder("gb18030").decode(buf); } catch { return new TextDecoder().decode(buf); }   // 国内银行常见的 GBK 编码
}
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, "");
  const head = text.split(/\r?\n/, 6).join("\n");
  const count = (d) => head.split(d).length - 1;
  const delim = [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}
/** 数字：1,234.56 / 1.234,56 / (12.30) / -12.30 / ¥-1,234.50 / 12.30 CR */
export function parseAmount(s) {
  let v = String(s ?? "").trim(); if (!v) return null;
  let neg = /^\(.*\)$/.test(v) || /-/.test(v) || /\bDR\b/i.test(v);
  v = v.replace(/[^\d.,]/g, "");
  if (!/\d/.test(v)) return null;
  const lc = v.lastIndexOf(","), ld = v.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) v = lc > ld ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");   // 最后出现的那个是小数点
  else if (lc >= 0) v = /,\d{2}$/.test(v) && v.split(",").length === 2 ? v.replace(",", ".") : v.replace(/,/g, "");
  const n = parseFloat(v); if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
/** 日期 → YYYY-MM-DD；order = "mdy" | "dmy"（斜杠写法里不确定时用） */
export function parseDate(s, order = "mdy") {
  const v = String(s ?? "").trim(); let m;
  if ((m = v.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{4})(\d{2})(\d{2})$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return order === "dmy" ? iso(y, +m[2], +m[1]) : iso(y, +m[1], +m[2]); }
  return null;
}
const iso = (y, mo, d) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);
/* ───────────── 认列 ───────────── */
const HEAD = {
  date: [/^transaction date$/i, /^trans\.? date$/i, /^date$/i, /^posted? date$/i, /^posting date$/i, /^post date$/i, /交易日期|交易时间|记账日期|日期/],
  desc: [/^description$/i, /^merchant$/i, /^payee$/i, /^name$/i, /^memo$/i, /^details?$/i, /^narrative$/i, /交易摘要|摘要|商户|对方户名|交易说明|交易对方|备注|用途/],
  amount: [/^amount$/i, /^transaction amount$/i, /交易金额|金额|发生额/],
  debit: [/^debit$/i, /withdraw|money out|^paid out$/i, /支出|借方|付款金额/],
  credit: [/^credit$/i, /deposit|money in|^paid in$/i, /收入|贷方|存入/],
  category: [/^category$/i, /分类/],
  type: [/^type$/i, /^transaction type$/i, /交易类型/],
};
export function detect(headers) {
  const used = new Set(), pick = (key) => { for (const re of HEAD[key]) { const i = headers.findIndex((h, k) => !used.has(k) && re.test(h)); if (i >= 0) { used.add(i); return i; } } return -1; };
  const m = { date: pick("date"), desc: pick("desc"), amount: pick("amount"), debit: -1, credit: -1, category: pick("category"), type: pick("type") };
  if (m.amount < 0) { m.debit = pick("debit"); m.credit = pick("credit"); }
  return m;
}
/** 第一行像表头（含日期列和金额 / 说明列）的位置；前面的账户摘要行跳过 */
export function headerIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) { const m = detect(rows[i]); if (m.date >= 0 && (m.amount >= 0 || m.debit >= 0 || m.credit >= 0)) return i; }
  return -1;
}
/* ───────────── 商家合并、归类规则 ───────────── */
const NOISE = /\b(pos|debit card|purchase|authorized on|checkcard|recurring|payment to|sq \*|tst\*|sp \*|pp\*|paypal \*|ach|web id|ref|card ending|visa|mastercard|dda)\b/gi;
/** 说明 → 收款方显示名：先清理（cleanMerchant），再归一（Amazon 的各种写法 → Amazon、你改名 / 合并记下的别名，js/core/payee-alias.js） */
export const merchantName = (desc) => canonicalPayee(cleanMerchant(desc), String(desc || ""));
/** 说明 → 清理后的商家名（去掉卡号 / 流水号 / 日期等噪音，最多 3 个词） */
function cleanMerchant(desc) {
  let s = String(desc || "").replace(/^\s*(sq|tst|sp|pp|py|dd|ub|pos|dbt)\s*\*\s*/i, " ").replace(/amzn\.com\/bill|amzn\.com/gi, " ").replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " ").replace(/\b\d{5,}\b/g, " ").replace(/[xX*#]{2,}\s*\d+/g, " ").replace(NOISE, " ").replace(/[#*]+/g, " ").replace(/\s+/g, " ").trim();
  // 纯数字、字母数字混杂的流水码（AB12、2X4R5、XY99）、州名缩写（IL、CA）不要——否则 AMAZON MKTPL*AB12 和 AMAZON MKTPL*2X4R5 会被当成两家，记住的归类也对不上
  s = s.split(" ").filter((w) => !/^\d+$/.test(w) && !(/\d/.test(w) && /[a-z]/i.test(w) && !/^\d+-[a-z]+$/i.test(w)) && !/^[A-Z]{2}$/.test(w)).slice(0, 3).join(" ");
  return (s || String(desc || "").trim()).slice(0, 40);
}
export const keyOf = (desc) => merchantName(desc).toLowerCase();
export const SKIP = {
  card_payment: [/(payment|pmt).*(thank|received|autopay)|autopay|auto pay|automatic payment|online (payment|pmt)|e-?payment|credit card (pmt|payment)|crcardpmt|card payment|epay|还款|信用卡还款|自动还款/i, "信用卡还款"],
  transfer: [/transfer|xfer|zelle|venmo|cash ?app|apple cash|wire|ach (credit|debit)|转账|汇款|转入|转出|财付通|支付宝|微信|\batm\b|取款|存款|withdrawal|\bdeposit\b/i, "转账 / 取现"],
};
/** 转账分两种：自己账户之间倒腾（活期 ↔ 储蓄）钱还在家里，不算花费；其余支出方向的一律算花费——转给别人、取现、汇款、转到 Robinhood 等别的账户，钱都出了这个家的银行账户。
 *  internal = 自己的账户之间（写着自己账户尾号 / transfer to SAV·CHK / between accounts）；其余 external / unknown 在支出方向都按花费记。 */
export const XFER_WORDS = SKIP.transfer[0];
const XFER_INTERNAL = /(between|internal|own)\s+(my\s+|your\s+)?accounts?|(transfer|xfer)\s+(to|from)\s+(my\s+|your\s+)?(savings?|sav|checking|chk)\b|本人|本行|活期|定期|理财|自己|账户间|行内转/i;
   // Chase：只有「Online Transfer to SAV / CHK ...1234」这种是自己账户之间
const XFER_EXTERNAL = /zelle|venmo|cash ?app|apple cash|paypal|\bwire\b|western union|moneygram|remit|\batm\b|cash withdrawal|withdrawal|ach (debit|withdrawal)|external|汇款|取款|财付通|支付宝|微信/i;
function ownLast4s() { const set = new Set((accounts() || []).map((a) => a.last4).filter(Boolean)); if (S.account?.last4) set.add(S.account.last4); return set; }
export function transferKind(txt) {
  const tail = [...txt.matchAll(/(?:acct|account|ending|x{2,}|\*{2,}|[•…]{2,}|\.{2,}|#)\s*(\d{4})\b/gi)].map((m) => m[1]), own = ownLast4s();
  if (tail.some((x) => own.has(x))) return "internal";   // 写着自己某个账户的尾号
  if (XFER_EXTERNAL.test(txt)) return "external";
  if (XFER_INTERNAL.test(txt)) return "internal";
  return "unknown";
}
/** 对方是谁决定方向：「Zelle payment from X」是别人转给你（入账），「Zelle payment to X」是你转出去（支出）——AI 或表格的正负号常常反着读，以描述为准 */
export const P2P = /zelle|venmo|cash ?app|apple cash|paypal/i, P2P_IN = /\b(from|received)\b/i, P2P_OUT = /\b(to|sent)\b/i;
export function fixP2PSign(row) {
  if (!P2P.test(row.desc)) return row;
  const inn = P2P_IN.test(row.desc), out = P2P_OUT.test(row.desc); if (inn === out) return row;   // 两个都有 / 都没有：看不出来，保持原样
  return { ...row, out: inn ? -Math.abs(row.out) : Math.abs(row.out) };
}
export const REFUND = /refund|return|reversal|credit adjustment|退款|退货|冲正/i;
