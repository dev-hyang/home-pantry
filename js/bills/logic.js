/* 账单 B1 · 计算：到期日推算、状态、每月等值、提醒、日历导出 */
import { state } from "../core/state.js";
import { DAY, daysUntil, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";

const B = () => window.BILLS;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => new Date(`${iso}T12:00:00`);
export const addDays = (iso, n) => ymd(new Date(parse(iso).getTime() + n * DAY));
/** 加 n 个月，日期按 dueDay（没有则按原日）并在月末截断 */
export function monthAdd(iso, n, dueDay) {
  const d = parse(iso), day = dueDay || d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return ymd(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
}
const MONTHS_OF = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

/** 固定日期列表（MM-DD）里严格晚于 from 的下一个日期 */
function nextFixed(dates, from) {
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

/** 新建账单时的首个到期日（≥ 今天）：固定日期 / 每月几号能算出来；其余（每周、年付没填日期）返回 null 让用户填 */
export function initialDue(bill) {
  const today = todayISO();
  if (bill.due_dates?.length) return nextFixed(bill.due_dates, addDays(today, -1));
  if (bill.due_day && MONTHS_OF[bill.frequency] !== undefined || (bill.frequency === "custom" && bill.due_day)) {
    const d = parse(today), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const thisMonth = ymd(new Date(d.getFullYear(), d.getMonth(), Math.min(bill.due_day, last)));
    return thisMonth >= today ? thisMonth : monthAdd(thisMonth, 1, bill.due_day);
  }
  return null;
}

/** 折算到每月的金额（预算用） */
export function monthlyEquivalent(bill, amount) {
  const a = num(amount);
  if (!a) return 0;
  switch (bill.frequency) {
    case "weekly": return (a * 52) / 12;
    case "biweekly": return (a * 26) / 12;
    case "monthly": return a;
    case "quarterly": return a / 3;
    case "semiannual": return a / 6;
    case "annual": return a / 12;
    case "custom": return a / Math.max(1, num(bill.interval_months, 1));
    default: return 0;   // 一次性不计入每月
  }
}

export const STATUS_RANK = { overdue: 0, due: 1, verify: 2, soon: 3, ok: 4, none: 5, ended: 6, inactive: 7 };

/** 丰富账单：最近缴费、平均金额、状态、距到期天数、涨价、扣款卡到期 */
export function enrichBills(bills, payments) {
  return bills.map((b) => {
    const pays = payments.filter((p) => p.bill_id === b.id).sort((x, y) => (y.paid_on || "").localeCompare(x.paid_on || ""));
    const amounts = pays.filter((p) => p.amount != null && p.status !== "skipped").map((p) => num(p.amount));
    const recent = amounts.slice(0, 6);
    const avg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : null;
    const last = pays[0] || null;
    const est = b.amount_type === "fixed" && b.typical_amount != null ? num(b.typical_amount) : (avg ?? (b.typical_amount != null ? num(b.typical_amount) : null));
    const prevAvg = amounts.length > 1 ? amounts.slice(1, 6).reduce((s, v) => s + v, 0) / Math.min(5, amounts.length - 1) : null;
    const priceUp = last && last.amount != null && prevAvg ? num(last.amount) > prevAvg * 1.15 : false;
    const daysLeft = b.next_due_on ? daysUntil(b.next_due_on) : null;
    const maxRem = Math.max(0, ...(b.reminder_days || [7, 1]));
    // 已结束：填了结束日期就看日期（卖房后水电气还有最后一期要提醒）；没填的看房产是否已卖出 / 退租 / 归档
    const prop = b.property_id ? state.properties.find((p) => p.id === b.property_id) : null;
    const ended = b.ends_on ? !!(b.next_due_on && b.next_due_on > b.ends_on) : !!(prop && (prop.archived || ["sold", "moved_out"].includes(prop.status)));
    let status;
    if (!b.active) status = "inactive";
    else if (ended) status = "ended";
    else if (daysLeft == null) status = "none";
    else if (b.autopay) status = daysLeft <= 3 ? "verify" : "ok";
    else if (daysLeft < 0) status = "overdue";
    else if (daysLeft === 0) status = "due";
    else if (daysLeft <= maxRem) status = "soon";
    else status = "ok";
    let cardDays = null;
    if (b.autopay && b.autopay_card_expires) {
      const [y, m] = b.autopay_card_expires.split("-").map(Number);
      cardDays = daysUntil(ymd(new Date(y, m, 0)));
    }
    const cardExpiring = cardDays != null && cardDays <= 45;
    return { ...b, pays, last, avg, est, priceUp, daysLeft, status, cardDays, cardExpiring: cardExpiring && !ended, ended: !!ended, monthly: ended ? 0 : monthlyEquivalent(b, est) };
  });
}

/** 首页 / 概览要处理的：逾期 > 今天 > 待核对 > 即将；扣款卡快过期单独算 */
export const billAlerts = (list) => list
  .filter((b) => ["overdue", "due", "verify", "soon"].includes(b.status) || (b.active && b.cardExpiring))
  .sort((x, y) => STATUS_RANK[x.status] - STATUS_RANK[y.status] || (x.daysLeft ?? 999) - (y.daysLeft ?? 999));

export function alertText(b) {
  const d = b.daysLeft;
  if (b.status === "overdue") return t("逾期 {d} 天", { d: -d }) + (b.grace_days && -d <= b.grace_days ? t("（宽限 {g} 天内）", { g: b.grace_days }) : "");
  if (b.status === "due") return b.autopay ? t("今天扣款") : t("今天到期");
  if (b.status === "verify") return d < 0 ? t("{d} 天前已扣款，核对一下", { d: -d }) : d === 0 ? t("今天扣款，核对一下") : t("{d} 天后扣款", { d });
  if (b.status === "soon") return t("{d} 天后到期", { d });
  if (b.cardExpiring) return b.cardDays < 0 ? t("扣款卡已过期") : t("扣款卡 {d} 天后过期", { d: b.cardDays });
  return "";
}

/** 该账单的分类文案 */
export const billCat = (id) => B().catOf(id);
export const freqText = (b) => (b.frequency === "custom" ? t("每 {n} 个月", { n: num(b.interval_months, 1) }) : t(B().FREQUENCIES[b.frequency] || b.frequency));

/** 未来 N 天内的到期列表（概览日程用），同一账单可能出现多次 */
export function upcoming(list, days = 30) {
  const today = todayISO(), end = addDays(today, days), out = [];
  for (const b of list) {
    if (!b.active || b.ended || !b.next_due_on) continue;
    let d = b.next_due_on, guard = 0;
    while (d && d <= end && guard++ < 12) { if (d >= today && (!b.ends_on || d <= b.ends_on)) out.push({ bill: b, due: d }); d = advanceDue(b, d); }
  }
  return out.sort((x, y) => x.due.localeCompare(y.due));
}

/* ── 日历导出（.ics）：每条活跃账单未来 12 个月的到期日，带提前提醒 ── */
export function icsFor(list) {
  const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//home-pantry//bills//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(t("家庭账单"))}`];
  const today = todayISO(), end = addDays(today, 365);
  for (const b of list) {
    if (!b.active || b.ended || !b.next_due_on) continue;
    let d = b.next_due_on, n = 0;
    while (d && d <= end && n < 60 && (!b.ends_on || d <= b.ends_on)) {
      const title = `${b.autopay ? t("核对扣款：") : t("缴费：")}${b.name}`;
      const desc = [b.payee, b.est != null ? Units.money(b.est, b.currency || Units.region.currency) : null, b.pay_url, b.notes].filter(Boolean).join("\\n");
      lines.push("BEGIN:VEVENT", `UID:${b.id}-${d}@home-pantry`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d.replace(/-/g, "")}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`);
      if (b.pay_url) lines.push(`URL:${b.pay_url}`);
      for (const r of (b.reminder_days || [7, 1])) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, `TRIGGER:-P${r}D`, "END:VALARM");
      lines.push("END:VEVENT");
      d = advanceDue(b, d); n++;
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** 当前房产对象 */
export const currentProperty = () => state.properties.find((p) => p.id === state.propertyId) || null;
export const propertyName = (id) => state.properties.find((p) => p.id === id)?.name || "";
