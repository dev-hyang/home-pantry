/* 财务 → 税务（#/bills/tax?tab=year|docs|events|learn）：参考用的税务工作台，不是报税软件，也不是税务建议。
 * 一期：今年（家庭情况、截止日、境外赠与累计、容易漏的）· 单据清单 · 事件指南 · 知识库。设计见 docs/design-tax.md。
 * 设置 / 每年状态的读写在 tax-calendar.js（存预算表的 _tax_cfg）；点击 / 勾选的处理在 tax-actions.js；文字内容在 tax-content-*.js。
 * 永远不存 SSN / ITIN / PIN / 账号：单据只记「收到没有」和「放在哪」。 */
import { esc, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { pageHead } from "../core/page-head.js";
import { infoTip } from "../core/info-tip.js";
import { TAX_TABS, activeTab } from "../core/tabs.js";
import { TAX_THRESHOLDS, activeTaxYear, daysUntil, foreignGiftTotal, relevantDeadlines, setupOf, yearState } from "./tax-calendar.js";
import { DOCS, TIPS } from "./tax-content-docs.js";
import { EVENTS } from "./tax-content-events.js";
import { TERMS } from "./tax-content-terms.js";
import "./tax-actions.js";

const tx = (o) => (o ? (lang === "en" ? o.en : o.zh) : "");
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");   // 内容里的 **粗体**
const tabHref = (id, y) => `${href("bills", "tax")}?${id === "year" ? "" : `tab=${id}&`}y=${y}`;
const on = (when, s) => !when || (when === "mortgage" ? s.flags.mortgage !== false : when === "kids" ? s.kids > 0 : when === "spouseItin" ? s.spouseItin : s.flags[when]);
const money = (n) => Units.money(n);

const FLAGS = [["stocks", "买卖股票 / 加密货币"], ["gifts", "收到境外亲友的赠与"], ["rental", "有出租房"], ["selfEmp", "自由职业 / 平台收入"], ["estimated", "需要预缴税（季度）"], ["foreign", "有境外账户 / 收入（可选，没有就关着）"]];

function profileCard(s, y) {
  const flags = FLAGS.map(([k, n]) => `<label class="check-inline"><input type="checkbox" data-tax-flag="${k}" ${s.flags[k] ? "checked" : ""}><span>${t(n)}</span></label>`).join("");
  const st = yearState(y);
  return `<section class="panel dt-block"><div class="dt-head"><h3>${t("家庭情况")}</h3></div>
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("税务居民 · 合并报税（Married Filing Jointly）· 联邦 1040 + 伊利诺伊 IL-1040 · TurboTax。下面的开关决定显示哪些提醒和单据，随时可以改。")}</p>
    <div class="form-grid"><label class="check-inline span-2"><input type="checkbox" data-tax-itin ${s.spouseItin ? "checked" : ""}><span>${t("配偶用 ITIN 报税")}</span></label>
      <label>${t("孩子人数")}<input type="number" min="0" max="12" inputmode="numeric" data-tax-kids value="${s.kids}"></label></div>
    <div class="tax-flags">${flags}</div>
    <div class="tax-year-flags"><label class="check-inline"><input type="checkbox" data-tax-year="extended" data-y="${y}" ${st.extended ? "checked" : ""}><span>${t("{y} 年已申请延期", { y })}</span></label>
      <label class="check-inline"><input type="checkbox" data-tax-year="filed" data-y="${y}" ${st.filed ? "checked" : ""}><span>${t("{y} 年已报完税", { y })}</span></label></div></section>`;
}
function calendarCard(y) {
  const today = todayISO(), rows = relevantDeadlines(y).map((d) => {
    const left = daysUntil(d.date, today), cls = left < 0 ? "" : left <= 14 ? "b-out" : left <= 45 ? "b-soon" : "b-ok";
    return `<div class="dt-row"><dt>${esc(d.date)}</dt><dd>${esc(tx(d.title))} ${left >= 0 ? `<span class="badge ${cls}">${t("还有 {n} 天", { n: left })}</span>` : `<span class="muted">${t("已过")}</span>`}</dd></div>`;
  }).join("");
  return `<section class="panel dt-block"><div class="dt-head"><h3>${t("{y} 年的税务日历", { y })}</h3></div><dl class="dt-list">${rows}</dl>
    <p class="hint">${t("周末顺延；法定假日以 IRS / 伊利诺伊税务局公告为准。")}</p></section>`;
}
function giftCard() {
  const yr = new Date().getFullYear(), g = foreignGiftTotal(yr), th = TAX_THRESHOLDS.foreignGift, pct = Math.min(100, Math.round((g.total / th.amount) * 100));
  const body = !g.loaded ? `<p class="muted">${t("收入记录还没读到；打开一次 财务 → 收入 再回来。")}</p>`
    : `<p style="margin:0 0 6px"><b>${money(g.total)}</b> <span class="muted">/ ${money(th.amount)} · ${t("{n} 笔", { n: g.n })}</span></p><span class="mprog"><i style="width:${pct}%"></i></span>
       <p class="hint">${t("统计口径：收入里类型是「个人赠与」（带原币种）或「国际电汇」、没勾「需要还」的，到账金额合计。有关联的赠与人（比如父母、兄弟姐妹）要合并看。")}</p>`;
  return `<section class="panel dt-block"><div class="dt-head"><h3>🎁 ${t("{y} 年境外亲友赠与累计（参考）", { y: yr })}</h3><a class="btn btn-sm btn-ghost" href="${href("bills", "income")}?tab=records">${t("看收入")}</a></div>${body}
    <p class="hint">${esc(tx(th.label))} · <a href="${esc(th.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a> · ${t("核对：{d}", { d: th.verified })}</p></section>`;
}
const tipsCard = (s) => `<section class="panel dt-block"><div class="dt-head"><h3>${t("容易漏的")}</h3></div>${TIPS.filter((x) => on(x.when, s)).map((x) => `<div class="tax-tip"><b>${x.icon} ${esc(tx(x.title))}</b><p>${esc(tx(x.body))}</p></div>`).join("")}</section>`;

function yearTab(y, s) {
  const docsOn = DOCS.filter((d) => on(d.when, s)), got = docsOn.filter((d) => yearState(y).docs?.[d.id]?.got).length, pct = docsOn.length ? Math.round((got / docsOn.length) * 100) : 0;
  const prog = `<section class="panel dt-block"><div class="dt-head"><h3>📄 ${t("{y} 年单据", { y })}</h3><a class="btn btn-sm btn-ghost" href="${tabHref("docs", y)}">${t("去清单")}</a></div>
    <p style="margin:0 0 6px"><b>${got} / ${docsOn.length}</b> <span class="muted">${t("已收到")}</span></p><span class="mprog"><i style="width:${pct}%"></i></span></section>`;
  return `<div class="dt-grid dd-secs">${calendarCard(y)}${prog}${profileCard(s, y)}${s.flags.gifts ? giftCard() : ""}</div>${tipsCard(s)}`;
}
function docsTab(y, s) {
  const st = yearState(y), docs = st.docs || {};
  const rows = DOCS.filter((d) => on(d.when, s)).map((d) => `<li class="tax-doc"><label class="check-inline"><input type="checkbox" data-tax-doc="${d.id}" data-y="${y}" ${docs[d.id]?.got ? "checked" : ""}><span><b>${esc(tx(d.name))}</b><small>${esc(tx(d.note))}</small></span></label>
      <input class="tax-where" data-tax-where="${d.id}" data-y="${y}" maxlength="60" value="${esc(docs[d.id]?.where || "")}" placeholder="${esc(t("放在哪（例如：Drive / Tax {y}）", { y }))}" aria-label="${esc(t("放在哪"))}"></li>`).join("");
  return `<section class="panel"><p class="muted" style="margin:0 0 8px;font-size:13px">${t("只记「收到没有」和「放在哪」；不要把 SSN、ITIN、PIN、银行账号写在这里，也不上传文件。")}</p><ul class="tax-docs">${rows}</ul>
    <label class="check-inline" style="margin-top:12px"><input type="checkbox" data-tax-year="docsDone" data-y="${y}" ${st.docsDone ? "checked" : ""}><span>${t("单据都收齐了（不再提醒）")}</span></label></section>`;
}
const LINKS = { "house-deal": () => href("house", "deal"), "house-assets": () => href("house", "cars"), income: () => `${href("bills", "income")}?tab=records`, settings: () => `${href("me", "settings")}?sec=family`, cards: () => href("bills", "accounts") };
function eventsTab(s) {
  const list = (items) => `<ul>${items.map((x) => `<li>${rich(tx(x))}</li>`).join("")}</ul>`;
  return EVENTS.filter((e) => on(e.when, s)).map((e) => `<details class="panel tax-event"><summary><b>${e.icon} ${esc(tx(e.title))}</b></summary>
    <h4>${t("会碰到什么")}</h4>${list(e.meet)}<h4>${t("现在要做")}</h4>${list(e.todo)}<h4>${t("要存什么")}</h4>${list(e.keep)}
    ${LINKS[e.link] ? `<p><a class="btn btn-sm btn-ghost" href="${esc(LINKS[e.link]())}">${t("去小助手里相关的页面")}</a></p>` : ""}</details>`).join("");
}
const learnTab = () => TERMS.map((e) => `<details class="panel tax-event"><summary><b>${esc(tx(e.name))}</b></summary><p>${esc(tx(e.body))}</p><p class="hint"><a href="${esc(e.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a></p></details>`).join("");

export function viewTax() {
  const q = state.route?.q, tab = activeTab(state.route) || "year", s = setupOf(), y = +q?.get("y") || activeTaxYear(), now = new Date().getFullYear();
  const yr = [y - 1, y, y + 1].filter((v) => v === y || (v <= now && v >= 2024));
  const nav = TAX_TABS.map(([id, name, icon]) => `<a class="btn btn-sm ${id === tab ? "btn-primary" : "btn-ghost"}" href="${tabHref(id, y)}" ${id === tab ? 'aria-current="page"' : ""}>${icon} ${t(name)}</a>`).join("");
  const years = yr.map((v) => `<a class="btn btn-sm ${v === y ? "btn-primary" : "btn-ghost"}" href="${tabHref(tab, v)}">${v}</a>`).join("");
  const body = tab === "docs" ? docsTab(y, s) : tab === "events" ? eventsTab(s) : tab === "learn" ? learnTab() : yearTab(y, s);
  return `<section class="section tax-page">${pageHead({ title: t("税务"), tabs: TAX_TABS, tab, hrefOf: (id) => tabHref(id, y), filter: false, plain: true, note: infoTip(t("参考用，不是税务建议；以 IRS、伊利诺伊税务局官网和 TurboTax 为准。不存 SSN / ITIN / PIN。"), { align: "start" }) })}
    <div class="tax-nav" role="navigation">${nav}</div>
    ${tab === "learn" || tab === "events" ? "" : `<div class="tax-years" aria-label="${esc(t("税务年度"))}"><span class="muted">${t("税务年度")}</span> ${years}</div>`}
    <p class="notice" role="note">${t("参考用，不是税务建议。数字和政策每年会变，标「待核对」的报税前对着官网再看一遍。")}</p>
    ${body}</section>`;
}
