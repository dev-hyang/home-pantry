/* 花费明细的「日期」筛选（和上面按月的「时间范围」叠加，取交集）：不限 / 近 7 天 / 近 30 天 / 自选起止日期。
 * 状态记在 spendFilter 的三个字段：dpre = all | 7 | 30 | c，dfrom / dto = 自选的起止日（YYYY-MM-DD，含两端，只填一个也行）。
 * 概览卡片带 ?dfrom=&dto= 进来（「最高的一天」「最近 7 天」）就是 dpre = c。数据库的 from / to 是真筛选（spend_page / spend_stats），按本地日期的 0 点换算。 */
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";

const pad = (n) => String(n).padStart(2, "0");
export const dayISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const OK = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const DAYS_DEFAULT = { dpre: "all", dfrom: "", dto: "" };
/** 当前日期筛选 → { from: Date（含）, to: Date（不含） }；没有筛选返回 null */
export function dayWindow(f, now = new Date()) {
  const pre = f.dpre || "all", today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (pre === "7" || pre === "30") return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - (+pre - 1)), to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) };
  if (pre !== "c") return null;
  let a = OK(f.dfrom) ? f.dfrom : "", b = OK(f.dto) ? f.dto : "";
  if (!a && !b) return null;
  if (a && b && a > b) [a, b] = [b, a];
  const next = (iso) => { const d = startOf(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); };
  return { from: a ? startOf(a) : null, to: b ? next(b) : null };
}
/** 数据库的 from / to（ISO 时间）合并进已有的范围（月份 / 年份带来的），取交集 */
export function mergeSpan(span, win) {
  if (!win) return span;
  const out = { ...span }, f = win.from?.toISOString(), e = win.to?.toISOString();
  if (f && (!out.from || f > out.from)) out.from = f;
  if (e && (!out.to || e < out.to)) out.to = e;
  return out;
}
/** 标签文字：「11-23」「11-21 → 11-27」「近 7 天」 */
export function dayLabel(f, now = new Date()) {
  const w = dayWindow(f, now); if (!w) return "";
  if (f.dpre === "7" || f.dpre === "30") return t("近 {d} 天", { d: f.dpre });
  const a = w.from ? dayISO(w.from) : "", b = w.to ? dayISO(new Date(w.to.getFullYear(), w.to.getMonth(), w.to.getDate() - 1)) : "";
  return a && b ? (a === b ? a : `${a} → ${b}`) : a ? t("{d} 起", { d: a }) : t("到 {d}", { d: b });
}
/** 筛选条里的控件：下拉 + 自选时的两个日期框（标签样式同「自定义」起止月） */
export function daysControlsHtml(f) {
  const pre = f.dpre || "all", opt = (v, l) => `<option value="${v}" ${pre === v ? "selected" : ""}>${esc(l)}</option>`;
  const sel = `<select id="spendDays" data-default="all" data-nosearch aria-label="${esc(t("日期"))}">${opt("all", t("日期：不限"))}${opt("7", t("近 7 天"))}${opt("30", t("近 30 天"))}${opt("c", t("自选日期…"))}</select>`;
  if (pre !== "c") return sel;
  const inp = (which, v) => `<label class="tb-field"><span>${esc(which === "from" ? t("从") : t("到"))}</span><input type="date" data-spend-d="${which}" value="${esc(v || "")}" aria-label="${esc(which === "from" ? t("从哪天") : t("到哪天"))}"></label>`;
  return `${sel}<div class="tb-dates">${inp("from", f.dfrom)}${inp("to", f.dto)}</div>`;   // 两个日期框并成一块：手机上 shared/compact-filters 只收下拉，toolbar-eye.js 的 merge 把这一块也挪进筛选面板
}
