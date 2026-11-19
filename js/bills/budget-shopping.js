/* 预算：促销日与省钱渠道，和大额购物规划（一次付清 / 分期 / 预存）。 */
import { budgetPlan, monthProgress } from "./budget-income.js";
import { esc, money } from "../core/util.js";
import { financeOk } from "../core/finance-access.js";
import { groupOf, pct, restockForecast } from "./budget-groups.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";

/* ───────────── 促销日与省钱渠道（日期按规则推算；个别日期每年由商家公布，标“约”） ───────────── */
const nthWeekday = (y, m, wd, n) => { const d = new Date(y, m, 1); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + (n - 1) * 7); return d; };
const lastWeekday = (y, m, wd) => { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7)); return d; };
export function saleEvents(from = new Date(), n = 6) {
  const out = [];
  for (const y of [from.getFullYear(), from.getFullYear() + 1]) {
    const bf = new Date(nthWeekday(y, 10, 4, 4)); bf.setDate(bf.getDate() + 1);
    const cm = new Date(bf); cm.setDate(cm.getDate() + 3);
    out.push(
      { name: "总统日（Presidents' Day）", date: nthWeekday(y, 1, 1, 3) },
      { name: "618", date: new Date(y, 5, 18), note: "国内电商年中大促，海淘 / 代购常跟着促销" },
      { name: "阵亡将士纪念日（Memorial Day）", date: lastWeekday(y, 4, 1), note: "家具、床垫、家电、户外用品常有促销" },
      { name: "Prime Day", date: new Date(y, 6, 15), approx: true, note: "通常在 7 月，具体日期以亚马逊公告为准" },
      { name: "劳动节（Labor Day）", date: nthWeekday(y, 8, 1, 1), note: "家电、割草机、户外用品常有促销" },
      { name: "国庆（10/1）", date: new Date(y, 9, 1), note: "国内电商国庆促销" },
      { name: "Prime 秋季大促（Big Deal Days）", date: new Date(y, 9, 8), approx: true, note: "通常在 10 月上旬，以亚马逊公告为准" },
      { name: "双十一（11/11）", date: new Date(y, 10, 11) },
      { name: "黑五（Black Friday）", date: bf, note: "全年最集中的折扣：电子、家电、家居" },
      { name: "网络星期一（Cyber Monday）", date: cm },
      { name: "节后清仓（Boxing Day）", date: new Date(y, 11, 26), note: "圣诞后清仓，冬季衣物和装饰" },
    );
  }
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return out.filter((e) => e.date >= today).sort((a, b) => a.date - b.date).slice(0, n);
}
const DEAL_SITES = [
  { name: "北美省钱快报 Dealmoon", url: "https://www.dealmoon.com", note: "北美折扣汇总、返利和优惠码" },
  { name: "Slickdeals", url: "https://slickdeals.net", note: "美国最大的折扣社区，看帖里的热度和评论" },
  { name: "Rakuten 返利", url: "https://www.rakuten.com", note: "先从返利页进商家再下单，按比例返现" },
  { name: "RetailMeNot / 优惠码", url: "https://www.retailmenot.com", note: "结账前查有没有优惠码" },
  { name: "CamelCamelCamel", url: "https://camelcamelcamel.com", note: "查亚马逊商品的历史价格，判断是不是真折扣" },
  { name: "Ibotta", url: "https://ibotta.com", note: "超市日用品的购物返现" },
];
export const fmtDate = (d) => d.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "long", day: "numeric" });
/* ───────────── 大额购物规划：一次付清 / 分期 / 预存 ───────────── */
export function planPurchase({ price, group, event }) {
  const plan = budgetPlan(), mp = monthProgress(plan);
  const g = mp?.rows.find((r) => r.id === group) || null;
  const remaining = g ? g.budget - g.spent : null;
  const out = { price, group: g, remaining, now: null, installments: [], saving: null };
  if (g) out.now = remaining >= price ? { ok: true, left: remaining - price } : { ok: false, over: price - remaining, overPct: pct(price - remaining, g.budget) };
  out.installments = [3, 6, 12].map((n) => ({ n, each: price / n, ofBudget: g && g.budget > 0 ? pct(price / n, g.budget) : null }));
  if (event) {
    const days = Math.round((event.date - new Date()) / 86400000), months = Math.floor(days / 30);
    out.saving = months >= 1 ? { event, days, months, each: Math.ceil(price / months), ofBudget: g && g.budget > 0 ? pct(price / months, g.budget) : null } : { event, days, months: 0 };
  }
  return out;
}
const ofB = (p) => (p == null || p > 300 ? "" : t("（约占预算 {p}%）", { p }));
   // 比预算大几倍时不再写离谱的百分比
export function adviceHtml(r) {
  const g = r.group;
  const now = r.now ? (r.now.ok ? `<li>✅ ${t("一次付清：{g}本月预算还剩 {a}，买完剩 {b}。", { g: esc(t(g.name)), a: money(r.remaining), b: money(r.now.left) })}</li>`
    : `<li>⚠️ ${t("一次付清：会让{g}本月超出 {a}{p}。", { g: esc(t(g.name)), a: money(r.now.over), p: r.now.overPct > 300 ? "" : t("（预算的 {p}%）", { p: r.now.overPct }) })}</li>`) : `<li>${t("一次付清：{a}（先在上面填收入，才能对比预算）。", { a: money(r.price) })}</li>`;
  const inst = `<li>🧾 ${t("分期：")}${r.installments.map((x) => t("{n} 期每月 {a}{p}", { n: x.n, a: money(x.each), p: ofB(x.ofBudget) })).join("；")}。<small class="muted">${t("只有商家真正 0% 的分期才按这个算；有利息或手续费要加进去，信用卡分期尤其要看清。")}</small></li>`;
  const sv = r.saving ? (r.saving.months >= 1
    ? `<li>🐖 ${t("预存：距 {e}（{d}）还有约 {m} 个月，每月预存 {a}{p}就够了。", { e: esc(t(r.saving.event.name)), d: fmtDate(r.saving.event.date), m: r.saving.months, a: money(r.saving.each), p: ofB(r.saving.ofBudget) })}${r.saving.event.note ? ` <small class="muted">${esc(t(r.saving.event.note))}</small>` : ""}</li>`
    : `<li>${t("预存：距 {e} 不到一个月，来不及预存，建议一次付清或分期。", { e: esc(t(r.saving.event.name)) })}</li>`) : "";
  return `<ul class="tips bud-advice">${now}${inst}${sv}</ul>`;
}
export const sitesHtml = () => `<ul class="bud-sites">${DEAL_SITES.map((s) => `<li><a class="link-name" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(t(s.name))}</a><small class="muted">${esc(t(s.note))}</small></li>`).join("")}</ul>
  <p class="muted" style="font-size:12.5px;margin:6px 0 0">${t("名称和网址可能变化，以官网为准；返利和优惠码的规则、有效期各家不同。")}</p>`;
/** 购物清单里填了预估金额时的提示（点“加入清单”后显示在清单上方） */
export function shopAdviceHtml() {
  const a = state.shopAdvice; if (!a || !financeOk()) return "";
  const plan = budgetPlan();
  if (!plan) return `<div class="panel bud-tip"><b>💰 ${esc(a.name)} · ${money(a.estimate)}</b><p class="muted" style="margin:4px 0 0">${t("填上月收入就能看预算提示：")} <a href="${href("bills", "budget")}">${t("去设置预算")}</a></p></div>`;
  const ev = saleEvents(new Date(), 1)[0];
  const r = planPurchase({ price: a.estimate, group: a.group, event: ev });
  return `<div class="panel bud-tip"><div class="section-head" style="margin-bottom:4px"><h3 style="font-size:15px">💰 ${esc(a.name)} · ${money(a.estimate)}</h3><button type="button" class="btn btn-sm btn-ghost" data-action="shop-advice-close">${t("知道了")}</button></div>
    ${adviceHtml(r)}<a class="btn btn-sm btn-ghost" href="${href("bills", "budget")}">${t("打开预算规划")}</a></div>`;
}
export const groupForCategory = (category) => (category ? groupOf(category) : "grocery");
   // 没选分类的购物项，多半是吃的
/** 购物车 / 告急库存主要落在这两组（买菜 + 日用个护）：预算提示按两组合计 */
export const STOCK_GROUPS = ["grocery", "essentials"];
/** 购物车页顶部：清单 + 告急库存预估要花多少，对比本月预算 */
export function shopForecastHtml() {
  const plan = budgetPlan(); if (!plan) return "";
  const fc = restockForecast(), mp = monthProgress(plan), gs = mp.rows.filter((r) => STOCK_GROUPS.includes(r.id));
  if (!fc.rows.length || !(fc.total > 0)) return "";
  const left = gs.reduce((s, g) => s + g.budget - g.spent, 0);
  return `<p class="muted bud-line">💰 ${t("清单和告急库存预计 {a}；食品杂货和日用个护本月还剩 {b}。", { a: money(fc.total), b: money(Math.max(0, left)) })} <a href="${href("bills", "budget")}">${t("看预算")}</a></p>`;
}
