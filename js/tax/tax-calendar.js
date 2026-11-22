/* 税务（财务 → 税务）的轻量部分：设置 / 每年状态的读写、税务日历（截止日）、境外赠与累计。税务页（tax-page.js）和提醒（tax-alerts.js）共用；
 * 这个文件会随首页一起加载，所以只放小而稳的东西，大段文字内容在 tax-content.js（进税务页才下载）。
 * 参考用，不是税务建议：截止日顺延只处理周末，法定假日以 IRS / 伊利诺伊税务局公告为准；阈值每年核对（见 TAX_THRESHOLDS 的 verified）。
 * 存放：预算表 cat_budgets 里的 _tax_cfg（和收入设置同一处，已在备份里）；不存任何证件号 / PIN。 */
import { state } from "../core/state.js";
import { todayISO } from "../core/util.js";

/** 阈值（每项带出处和核对日期；要改只改这里，页面和提醒都读它） */
export const TAX_THRESHOLDS = {
  foreignGift: { amount: 100000, label: { zh: "收到非美国人的赠与（合计）超过这个数要申报 Form 3520（同一家庭 / 有关联的赠与人要合并算）", en: "Gifts received from non-US persons (aggregated) above this must be reported on Form 3520 (related donors are added together)" }, source: "https://www.irs.gov/businesses/small-businesses-self-employed/gifts-from-foreign-person", verified: "2026-11-22（待核对）" },
  fbar: { amount: 10000, label: { zh: "境外金融账户在一年中任何时点合计超过这个数要申报 FBAR（FinCEN 114）", en: "Foreign financial accounts totalling more than this at any time in the year require an FBAR (FinCEN 114)" }, source: "https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar", verified: "2026-11-22（待核对）" },
};

/** 默认设置：按这个家庭的情况（2026-11-22 你给的回答）；全部可在页面上改。境外账户 / 收入是可选项，默认关 */
export const DEFAULT_SETUP = { filing: "mfj", spouseItin: true, kids: 3, flags: { stocks: true, gifts: true, foreign: false, rental: false, selfEmp: false, estimated: false, generalFsa: false } };
export const cfg = () => state.budget?.cat_budgets?._tax_cfg || {};
const saveMeta = async (patch) => (await import("../bills/budget-groups.js")).saveMeta(patch);   // 只在保存时才加载预算模块，提醒（随首页加载）不依赖它
export const setupOf = () => { const c = cfg().setup || {}; return { ...DEFAULT_SETUP, ...c, flags: { ...DEFAULT_SETUP.flags, ...(c.flags || {}) } }; };
export const acctOf = (id) => (cfg().accts || {})[id] || {};
export async function saveAcct(id, patch) { const c = cfg(); await saveMeta({ _tax_cfg: { ...c, accts: { ...(c.accts || {}), [id]: { ...acctOf(id), ...patch } } } }); }
export const yearState = (y) => (cfg().years || {})[y] || {};
export async function saveSetup(patch) { const c = cfg(); await saveMeta({ _tax_cfg: { ...c, setup: { ...setupOf(), ...patch, flags: { ...setupOf().flags, ...(patch.flags || {}) } } } }); }
export async function saveYear(y, patch) { const c = cfg(); await saveMeta({ _tax_cfg: { ...c, years: { ...(c.years || {}), [y]: { ...yearState(y), ...patch } } } }); }

/** 默认看哪一个税务年度：1–10 月是在办上一年的税（除非已标记报完）；11–12 月起开始看今年 */
export function activeTaxYear(today = todayISO()) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  return m <= 10 && !yearState(y - 1).filed ? y - 1 : y;
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** 周末顺延到下周一（法定假日以官方公告为准） */
function bump(s) { const d = new Date(`${s}T12:00:00Z`); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
export const daysUntil = (s, today = todayISO()) => Math.round((new Date(`${s}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000);

/** 税务年度 y 的日历：{ id, date, title{zh,en}, when?: 要打开哪个标记才相关 } 按日期排好 */
export function deadlinesFor(y) {
  const n = y + 1, list = [
    { id: "q1", date: bump(iso(y, 4, 15)), title: { zh: `${y} 年第 1 期预缴税（联邦 + IL）`, en: `${y} estimated tax, payment 1 (federal + IL)` }, when: "estimated" },
    { id: "q2", date: bump(iso(y, 6, 15)), title: { zh: `${y} 年第 2 期预缴税`, en: `${y} estimated tax, payment 2` }, when: "estimated" },
    { id: "q3", date: bump(iso(y, 9, 15)), title: { zh: `${y} 年第 3 期预缴税`, en: `${y} estimated tax, payment 3` }, when: "estimated" },
    { id: "q4", date: bump(iso(n, 1, 15)), title: { zh: `${y} 年第 4 期预缴税`, en: `${y} estimated tax, payment 4` }, when: "estimated" },
    { id: "forms", date: bump(iso(n, 1, 31)), title: { zh: "W-2、1099-NEC / MISC 等单据应该寄到了", en: "W-2 and 1099-NEC / MISC forms should have arrived" } },
    { id: "brokers", date: bump(iso(n, 2, 15)), title: { zh: "券商 / 交易所的 1099-B / DIV 通常这前后到齐（可能晚到 3 月）", en: "Broker / exchange 1099-B / DIV usually arrive around now (can be as late as March)" }, when: "stocks" },
    { id: "file", date: bump(iso(n, 4, 15)), title: { zh: `${y} 年联邦 1040 + 伊利诺伊 IL-1040 报税截止（可申请延期）`, en: `${y} federal 1040 + Illinois IL-1040 due (extension available)` } },
    { id: "fbar", date: bump(iso(n, 4, 15)), title: { zh: `${y} 年 FBAR（境外账户）截止，会自动延期到 10 月中旬`, en: `${y} FBAR (foreign accounts) due; automatically extended to mid-October` }, when: "foreign" },
    { id: "ext", date: bump(iso(n, 10, 15)), title: { zh: "延期后的报税截止日（只在延期时相关）", en: "Extended filing deadline (only if you extended)" }, ext: true },
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
/** 这个家庭用得上的日历项（按设置里的标记过滤；延期项只在标记了延期时算） */
export function relevantDeadlines(y) {
  const flags = setupOf().flags, st = yearState(y);
  return deadlinesFor(y).filter((d) => (!d.when || flags[d.when]) && (!d.ext || st.extended));
}

/** 公历年 y 收到的赠与累计（参考）：收入类型是「国际电汇」或「个人赠与」的全部记录（不再排除「需要还」，也不看原币种——家里记这两类时都是境外亲友的钱）；按类型分开合计 */
export const GIFT_KINDS = ["wire", "gift"];
export function foreignGiftTotal(y) {
  const recs = (state.inc?.rec || []).filter((r) => String(r.received_on || "").startsWith(String(y)) && GIFT_KINDS.includes(r.kind));
  const by = Object.fromEntries(GIFT_KINDS.map((k) => { const rows = recs.filter((r) => r.kind === k); return [k, { n: rows.length, total: Math.round(rows.reduce((s2, r) => s2 + (+r.amount || 0), 0) * 100) / 100 }]; }));
  return { by, total: Math.round(recs.reduce((s2, r) => s2 + (+r.amount || 0), 0) * 100) / 100, n: recs.length, loaded: !!state.inc?.loaded };
}
