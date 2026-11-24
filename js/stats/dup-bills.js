/* 账单缴费 ↔ 对账单：记缴费时会写一条花费，逐行查重（dup-check.js）只在「金额一模一样、日期 ±3.5 天」时对得上。会漏的：
 *  · 自动扣款 / 邮寄支票，银行入账比你记的缴费日晚好几天；
 *  · 银行实扣的比记的差一点（手续费、四舍五入）；
 *  · 一次性账单（医疗等）的缴费不写花费表，查重池里根本没有；
 *  · 房贷 / 车贷的缴费被拆成「本金」和「利息」几行花费，流水是一整笔（合计才相等）。
 * 这里直接拿「缴费记录」当查重对象（不管它有没有写花费），用缴费的合计金额去比：
 *  · 强：金额一样（差 ≤ 1 分），收款方对上或日期在 3.5 天内；
 *  · 中：金额差一点（≤ max(1 美元, 2%)）且收款方对上；
 *  · 日期：流水晚于缴费日最多 10 天，早最多 3 天；卡：对账单选了卡而缴费记录用的是另一张卡 = 排除。
 * 一笔缴费只配一笔流水，一笔流水只配一笔缴费（按得分配）。纯函数，不碰页面。 */
import { storeClose } from "./dup-trips.js";

/** 收款方对不对：整串互相包含，或共有一个像样的词（≥ 4 个字母，泛词除外）：COMCAST CABLE COMM ↔ Comcast Xfinity */
const STOP = new Set(["home", "mortgage", "services", "service", "company", "corp", "inc", "llc", "payment", "payments", "online", "bill", "utility", "utilities", "insurance", "bank", "card", "auto", "autopay", "pay", "the", "and"]);
const wordsOf = (s) => String(s ?? "").toLowerCase().split(/[^a-z一-鿿]+/).filter((w) => (/[一-鿿]/.test(w) ? w.length >= 2 : w.length >= 4) && !STOP.has(w));
export const payeeClose = (desc, payee) => storeClose(desc, payee) || (() => { const b = new Set(wordsOf(payee)); return wordsOf(desc).some((w) => b.has(w)); })();
const cents = (v) => Math.round((Number(v) || 0) * 100);
const dayNum = (d) => Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`) / 864e5;
const total = (p) => (Number(p.amount) || 0) + (Number(p.late_fee) || 0) + (Number(p.fee_amount) || 0) + (Number(p.tax_amount) || 0) + (Number(p.assessment_amount) || 0);

/** 所有缴费记录 → 统一的查重条目 { id, kind, label, payee, date, cents, card, purchaseId }；跳过的、收款类的、金额为 0 的不要 */
export function paymentPool({ bills = [], payments = [], medBills = [], medPayments = [] }) {
  const byBill = new Map(bills.map((b) => [b.id, b])), byMed = new Map(medBills.map((b) => [b.id, b]));
  const out = [];
  for (const p of payments) {
    const b = byBill.get(p.bill_id); if (!b || b.direction === "receivable" || p.status === "skipped" || !p.paid_on) continue;
    const c = cents(total(p)); if (c > 0) out.push({ id: `bp:${p.id}`, kind: "bill", label: b.name, payee: [b.payee, b.name].filter(Boolean), date: p.paid_on, cents: c, card: p.card_id || b.pay_card_id || "", purchaseId: p.purchase_id || null });
  }
  for (const p of medPayments) {
    const b = byMed.get(p.bill_id); if (!b || !p.paid_on) continue;
    const c = cents(p.amount); if (c > 0) out.push({ id: `mp:${p.id}`, kind: "med", label: b.provider || b.kind || "", payee: [b.provider].filter(Boolean), date: p.paid_on, cents: c, card: p.card_id || "", purchaseId: null });
  }
  return out;
}

/** rows = [{ fk, date, out, texts }]；pool = paymentPool(...)；usedPurchases = 逐行对上的花费 id（对应的缴费已经被认领，不再配）。
 *  返回 Map(fk → { tier: "strong" | "weak", label, date, amount, kind, id, score }) */
export function matchPayments(rows, pool, { card = "", usedPurchases = new Set() } = {}) {
  const items = pool.filter((p) => !p.purchaseId || !usedPurchases.has(p.purchaseId)), pairs = [];
  rows.forEach((r, ri) => {
    const out = cents(r.out); if (out <= 0) return;
    items.forEach((p, pi) => {
      const gap = dayNum(r.date) - dayNum(p.date); if (gap < -3 || gap > 10) return;
      if (card && p.card && p.card !== card) return;
      const diff = Math.abs(p.cents - out), exact = diff <= 1, near = diff <= Math.max(100, Math.round(out * 0.02));
      if (!exact && !near) return;
      const payee = p.payee.some((x) => (r.texts || []).some((tx) => payeeClose(tx, x))), close = Math.abs(gap) <= 3.5;
      const tier = exact && (payee || close) ? "strong" : near && payee ? "weak" : null; if (!tier) return;
      pairs.push({ ri, pi, tier, diff, score: (exact ? 4 : 2) + (payee ? 3 : 0) + (card && p.card === card ? 2 : 0) + (Math.abs(gap) <= 1 ? 2 : close ? 1 : 0) });
    });
  });
  pairs.sort((x, y) => y.score - x.score || x.diff - y.diff);
  const ru = new Set(), pu = new Set(), out = new Map();
  for (const m of pairs) {
    if (ru.has(m.ri) || pu.has(m.pi)) continue; ru.add(m.ri); pu.add(m.pi);
    const p = items[m.pi]; out.set(rows[m.ri].fk, { tier: m.tier, label: p.label, date: p.date, amount: p.cents / 100, kind: p.kind, id: p.id, score: m.score });
  }
  return out;
}
