/* 账单日期推算（纯函数，不依赖界面 / 状态，Node 测试直接引用）。
 * logic.js 从这里引入并原样再导出，别处照旧 `import { advanceDue } from "./logic.js"`。 */
const DAY = 86400000;
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (iso) => new Date(`${iso}T12:00:00`);
export const addDays = (iso, n) => ymd(new Date(parse(iso).getTime() + n * DAY));
/** 加 n 个月，日期按 dueDay（没有则按原日）并在月末截断 */
export function monthAdd(iso, n, dueDay) {
  const d = parse(iso), day = dueDay || d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return ymd(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
}
export const MONTHS_OF = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

/** 固定日期列表（MM-DD）里严格晚于 from 的下一个日期 */
export function nextFixed(dates, from) {
  const y = parse(from).getFullYear();
  const all = [y, y + 1].flatMap((yy) => dates.map((md) => `${yy}-${md}`)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return all.find((d) => d > from) || null;
}

/** 下一次到期：严格晚于 from */
export function advanceDue(bill, from) {
  if (!from) return null;
  if (bill.frequency === "one_time") return null;
  if (bill.due_dates?.length) return nextFixed(bill.due_dates, from);
  if (bill.frequency === "weekly") return addDays(from, 7);
  if (bill.frequency === "biweekly") return addDays(from, 14);
  const months = bill.frequency === "custom" ? Math.max(1, num(bill.interval_months, 1)) : MONTHS_OF[bill.frequency] || 1;
  return monthAdd(from, months, bill.due_day || null);
}
