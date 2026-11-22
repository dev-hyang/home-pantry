/* 税务提醒（来源 tax，只给有财务权限的人）：报税 / 预缴 / FBAR 截止日临近、单据还没收齐、境外赠与接近申报线、年底税务检查。
 * 全是内存里的数据，不发请求；日期和阈值都来自 tax-calendar.js。参考用，不是税务建议。 */
import { state } from "../core/state.js";
import { todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { lang } from "../core/i18n.js";
import { href } from "../core/router.js";
import { registerAlerts } from "../core/alerts.js";
import { financeOk } from "../core/finance-access.js";
import { warnChecks } from "./tax-checks.js";
import { TAX_THRESHOLDS, activeTaxYear, daysUntil, foreignGiftTotal, relevantDeadlines, setupFor, yearState } from "./tax-calendar.js";

const pick = (o) => (lang === "en" ? o.en : o.zh);
const link = () => href("bills", "tax");
const item = (severity, title, detail, daysLeft, label, url = link()) => ({ source: "tax", severity, must: false, due: null, daysLeft, title, detail, href: url, badge: { label, cls: severity <= 2 ? "b-soon" : "b-ok" }, actions: [{ type: "link", href: url, label: t("去看税务"), cls: "btn-ghost" }] });

/** 提醒的几个触发条件（deadlines 的 id 对应 tax-calendar.js） */
export function taxAlertItems() {
  if (!state.billsEnabled || !financeOk() || !state.budget) return [];
  const out = [], today = todayISO(), y = activeTaxYear(today), st = yearState(y);
  if (st.filed) return out;
  const flags = setupFor(y).flags;
  for (const d of relevantDeadlines(y)) {
    const left = daysUntil(d.date, today), near = d.id === "file" || d.id === "fbar" ? 60 : d.id.startsWith("q") ? 30 : 0;
    if (!near || left < 0 || left > near) continue;
    out.push(item(left <= 14 ? 2 : 3, `🧾 ${pick(d.title)}`, t("截止日 {d}，还有 {n} 天", { d: d.date, n: left }), left, left <= 14 ? t("尽快") : t("留意")));
  }
  const docs = st.docs || {}, got = Object.values(docs).filter((x) => x?.got).length;   // 勾过至少一项才算开始用；点了「已全部收齐」就不再催
  if (!st.docsDone && today >= `${y + 1}-02-15` && got > 0) {
    const file = relevantDeadlines(y).find((d) => d.id === "file");
    out.push(item(3, `📄 ${t("{y} 年的税务单据收齐了吗？", { y })}`, t("去单据清单核对，还没到的在报税前催一下"), file ? daysUntil(file.date, today) : null, t("留意")));
  }
  if (flags.gifts) {
    const g = foreignGiftTotal(+today.slice(0, 4)), lim = TAX_THRESHOLDS.foreignGift.amount;
    if (g.loaded && g.total >= lim * 0.8) out.push(item(g.total >= lim ? 1 : 2, `🎁 ${t("今年境外亲友赠与已累计 {a}", { a: Units.money(g.total) })}`, t("接近 / 超过 {l} 申报线（Form 3520）：同一家庭的赠与人要合并算，现在就去看要保留什么", { l: Units.money(lim) }), null, g.total >= lim ? t("今天") : t("尽快")));
  }
  for (const c of warnChecks()) out.push(item(2, `⚠️ ${pick(c.title)}`, t("去「账户与开户」把每个 FSA 的类型标出来，确认有没有冲突"), null, t("尽快"), `${link()}?tab=accounts`));
  const md = today.slice(5);
  if (md >= "11-15" && md <= "12-31") out.push(item(3, `🗓️ ${t("年底前的税务检查")}`, t("12 月 31 日前能做的：退休 / HSA 供款、捐款、卖出亏损的股票、孩子的 SSN / ITIN 办好没有"), null, t("留意")));
  return out;
}
registerAlerts(taxAlertItems);
