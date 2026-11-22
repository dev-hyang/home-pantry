/* 财务 → 税务（#/bills/tax?tab=year|household|docs|accounts|events|learn&y=税务年度）：参考用的税务工作台，不是报税软件，也不是税务建议。
 * 页面之间用页头的「目录」切换（不再放页内标签条）；税务年度放在页头右边的「筛选」里。设计见 docs/design-tax.md。
 * 设置 / 每年状态的读写在 tax-calendar.js（存预算表的 _tax_cfg）；点击 / 勾选的处理在 tax-actions.js；文字内容在 tax-content-*.js。
 * 永远不存 SSN / ITIN / PIN / 账号：单据只记「收到没有」和「放在哪」。 */
import { esc, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { pageHead } from "../core/page-head.js";
import { filterPop } from "../core/filter-pop.js";
import { infoTip } from "../core/info-tip.js";
import { TAX_TABS, activeTab } from "../core/tabs.js";
import { GIFT_KINDS, TAX_THRESHOLDS, acctOf, activeTaxYear, daysUntil, foreignGiftTotal, relevantDeadlines, setupFor, snapshotYear, yearState } from "./tax-calendar.js";
import { DOCS, TIPS } from "./tax-content-docs.js";
import { GUIDES } from "./tax-content-accounts.js";
import { FSA_TYPES, accountChecks } from "./tax-checks.js";
import { EVENTS } from "./tax-content-events.js";
import { TERMS } from "./tax-content-terms.js";
import "./tax-actions.js";

const tx = (o) => (o ? (lang === "en" ? o.en : o.zh) : "");
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");   // 内容里的 **粗体**
const tabHref = (id, y) => `${href("bills", "tax")}?${id === "year" ? "" : `tab=${id}&`}y=${y}`;
const on = (when, s) => !when || (when === "mortgage" ? s.flags.mortgage !== false : when === "kids" ? s.kids > 0 : when === "spouseItin" ? s.spouseItin : s.flags[when]);
const money = (n) => Units.money(n);
const list = (items) => `<ul>${items.map((x) => `<li>${rich(tx(x))}</li>`).join("")}</ul>`;

const FLAGS = [["stocks", "买卖股票 / 加密货币"], ["gifts", "收到境外亲友的赠与"], ["rental", "有出租房"], ["selfEmp", "自由职业 / 平台收入"], ["estimated", "需要预缴税（季度）"], ["generalFsa", "我或配偶单位有普通医疗 FSA / HRA"], ["foreign", "有境外账户 / 收入（可选，没有就关着）"]];

/* ── 家庭情况：首页只放一张摘要卡（点进去改），完整设置在「家庭情况」页 ── */
function householdSummary(s, y) {
  const on_ = FLAGS.filter(([k]) => s.flags[k]).map(([, n]) => `<span class="tag">${esc(t(n))}</span>`).join("");
  return `<a class="panel dt-block tax-sum" href="${tabHref("household", y)}"><div class="tax-sum-body"><h3>${t("家庭情况")}</h3>
    <p class="muted">${t("{y} 年", { y })} · ${t("合并报税")} · ${s.spouseItin ? t("配偶用 ITIN") : t("配偶用 SSN")} · ${t("{n} 个孩子", { n: s.kids })}</p><div class="tax-chips">${on_ || `<span class="muted">${t("还没打开任何提醒")}</span>`}</div></div><span class="mch" aria-hidden="true">›</span></a>`;
}
function householdTab(s, y) {
  const flags = FLAGS.map(([k, n]) => `<label class="check-inline"><input type="checkbox" data-tax-flag="${k}" data-y="${y}" ${s.flags[k] ? "checked" : ""}><span>${t(n)}</span></label>`).join("");
  const st = yearState(y);
  const own = snapshotYear(y), snap = own === String(y) ? t("{y} 年单独存的快照", { y }) : own ? t("{y} 年还没单独存，沿用 {o} 年的；改任何一项就会存成 {y} 年自己的", { y, o: own }) : t("{y} 年还没单独存，用默认；改任何一项就会存成 {y} 年自己的", { y });
  return `<p class="hint tax-wrap">${t("家庭情况每年不一样（比如孩子人数、配偶的证件），所以按税务年度分别存；在页头「筛选」里换年份看别的年。")} <b>${esc(snap)}</b></p><section class="panel dt-block"><div class="dt-head"><h3>${t("报税身份")}</h3></div>
    <p class="muted tax-wrap">${t("税务居民；合并报税（Married Filing Jointly）；联邦 1040 + 伊利诺伊 IL-1040；用 TurboTax。")}</p>
    <div class="form-grid"><label class="check-inline span-2"><input type="checkbox" data-tax-itin data-y="${y}" ${s.spouseItin ? "checked" : ""}><span>${t("配偶用 ITIN 报税")}</span></label>
      <label>${t("孩子人数")}<input type="number" min="0" max="12" inputmode="numeric" data-tax-kids data-y="${y}" value="${s.kids}"></label></div></section>
    <section class="panel dt-block"><div class="dt-head"><h3>${t("要打开哪些提醒")}</h3></div><p class="muted tax-wrap">${t("下面的开关决定「今年」页和提醒里显示哪些单据、截止日和提示；随时可以改。")}</p><div class="tax-flags">${flags}</div></section>
    <section class="panel dt-block"><div class="dt-head"><h3>${t("{y} 年的状态", { y })}</h3></div><div class="tax-flags">
      <label class="check-inline"><input type="checkbox" data-tax-year="extended" data-y="${y}" ${st.extended ? "checked" : ""}><span>${t("{y} 年已申请延期", { y })}</span></label>
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
/** 亲友赠与累计：国际电汇 / 个人赠与分开合计，每一项点进去看明细，右边的 ＋ 直接按这个类型添加；合计和 10 万美元申报线比 */
function giftCard(y) {
  const g = foreignGiftTotal(y), th = TAX_THRESHOLDS.foreignGift, pct = Math.min(100, Math.round((g.total / th.amount) * 100)), inc = href("bills", "income");
  const label = { wire: t("国际电汇"), gift: t("个人赠与（非美国人 / 未标）") };
  const detail = (k) => `${inc}?tab=records&inc=1&kind=${k}&from=${y}-01-01&to=${y}-12-31`;   // inc=1 才会套上类型和日期筛选（收入明细的钻取约定）
  const row = (k, n, total, name) => `<div class="tax-gift-row"><a class="tax-gift-main" href="${detail(k)}"><span>${esc(name)} <small class="muted">${t("{n} 笔", { n })}</small></span><b>${money(total)}</b><span class="mch" aria-hidden="true">›</span></a></div>`;
  const note = (txt) => `<p class="hint">${txt}</p>`;
  const body = !g.loaded ? `<p class="muted">${t("收入记录还没读到；打开一次 财务 → 收入 再回来。")}</p>`
    : `${row("wire", g.by.wire.n, g.by.wire.total, label.wire)}${row("gift", g.by.gift.n, g.by.gift.total, label.gift)}<div class="tax-gift-total"><span>${t("合计")}</span><b>${money(g.total)}</b></div><span class="mprog"><i style="width:${pct}%"></i></span>
       ${g.us.n ? note(t("另有「个人赠与」{n} 笔来自美国人，共 {a}，不算在上面（Form 3520 只管非美国人给的）。", { n: g.us.n, a: money(g.us.total) })) : ""}${g.unmarked ? note(t("有 {n} 笔「个人赠与」还没标赠与人，先按非美国人算；在那笔记录里标一下。", { n: g.unmarked })) : ""}${g.repay ? note(t("其中标了「需要还」的有 {a}：真是借款的话不算赠与。", { a: money(g.repay) })) : ""}
       ${note(t("统计口径：「国际电汇」全部算；「个人赠与」按赠与人的税务身份分（美国税务居民，包括绿卡 / 住满天数的非公民，算美国人；在境外或不是美国税务居民的算非美国人）。点一项看明细；有关联的赠与人（父母、兄弟姐妹）要合并看。"))}`;
  return `<section class="panel dt-block"><div class="dt-head"><h3>🎁 ${t("{y} 年亲友赠与累计", { y })}</h3></div>${body}
    <p class="hint">${esc(tx(th.label))} · <a href="${esc(th.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a> · ${t("核对：{d}", { d: th.verified })}</p></section>`;
}
const tipsCard = (s) => `<section class="panel dt-block"><div class="dt-head"><h3>${t("容易漏的")}</h3></div>${TIPS.filter((x) => on(x.when, s)).map((x) => `<div class="tax-tip"><b>${x.icon} ${esc(tx(x.title))}</b><p>${esc(tx(x.body))}</p></div>`).join("")}</section>`;

function yearTab(y, s) {
  const docsOn = DOCS.filter((d) => on(d.when, s)), got = docsOn.filter((d) => yearState(y).docs?.[d.id]?.got).length, pct = docsOn.length ? Math.round((got / docsOn.length) * 100) : 0;
  const prog = `<section class="panel dt-block"><div class="dt-head"><h3>📄 ${t("{y} 年单据", { y })}</h3><a class="btn btn-sm btn-ghost" href="${tabHref("docs", y)}">${t("去清单")}</a></div>
    <p style="margin:0 0 6px"><b>${got} / ${docsOn.length}</b> <span class="muted">${t("已收到")}</span></p><span class="mprog"><i style="width:${pct}%"></i></span></section>`;
  return `${householdSummary(s, y)}<div class="dt-grid dd-secs">${calendarCard(y)}${prog}${s.flags.gifts ? giftCard(y) : ""}</div>${tipsCard(s)}`;
}
function docsTab(y, s) {
  const st = yearState(y), docs = st.docs || {};
  const rows = DOCS.filter((d) => on(d.when, s)).map((d) => `<li class="tax-doc"><label class="check-inline"><input type="checkbox" data-tax-doc="${d.id}" data-y="${y}" ${docs[d.id]?.got ? "checked" : ""}><span><b>${esc(tx(d.name))}</b><small>${esc(tx(d.note))}</small></span></label>
      <input class="tax-where" data-tax-where="${d.id}" data-y="${y}" maxlength="60" value="${esc(docs[d.id]?.where || "")}" placeholder="${esc(t("放在哪（例如：Drive / Tax {y}）", { y }))}" aria-label="${esc(t("放在哪"))}"></li>`).join("");
  return `<section class="panel"><p class="muted" style="margin:0 0 8px;font-size:13px">${t("只记「收到没有」和「放在哪」；不要把 SSN、ITIN、PIN、银行账号写在这里，也不上传文件。")}</p><ul class="tax-docs">${rows}</ul>
    <label class="check-inline" style="margin-top:12px"><input type="checkbox" data-tax-year="docsDone" data-y="${y}" ${st.docsDone ? "checked" : ""}><span>${t("单据都收齐了（不再提醒）")}</span></label></section>`;
}
/** 账户与开户：冲突检查 + 每种账户开户前的税务提示 */
function accountsTab() {
  const cards = state.cards || [], have = (k) => cards.filter((c) => c.kind === k && c.active !== false).length, checks = accountChecks();
  const fsas = cards.filter((c) => c.kind === "fsa" && c.active !== false);
  const types = (v) => `<option value="">${t("还没标")}</option>${Object.entries(FSA_TYPES).map(([k, n]) => `<option value="${k}" ${v === k ? "selected" : ""}>${esc(tx(n))}</option>`).join("")}`;
  const fsaCard = fsas.length ? `<section class="panel dt-block"><div class="dt-head"><h3>${t("你的 FSA / 通勤福利账户")}</h3></div><div class="form-grid">${fsas.map((c) => `<label>${esc(c.name)}<select data-tax-fsa="${esc(c.id)}">${types(acctOf(c.id).fsaType || "")}</select></label>`).join("")}</div></section>` : "";
  const rows = checks.length ? checks.map((c) => `<div class="tax-tip"><b>${c.level === "warn" ? "⚠️" : "ℹ️"} ${esc(tx(c.title))}</b><p>${esc(tx(c.body))}</p></div>`).join("") : `<p class="muted">${t("目前没有需要你确认的冲突。加了 HSA / FSA / 529 / 孩子账户后，这里会自动检查。")}</p>`;
  const guides = [...GUIDES].sort((a, b) => have(b.kind) - have(a.kind)).map((g) => `<details class="panel tax-event" ${have(g.kind) ? "open" : ""}><summary><b>${g.icon} ${esc(tx(g.title))}</b>${have(g.kind) ? ` <span class="badge b-ok">${t("你已有 {n} 个", { n: have(g.kind) })}</span>` : ""}</summary>
    <h4>${t("开户前先决定")}</h4>${list(g.ask)}<h4>${t("税务上怎么算")}</h4>${list(g.effects)}<h4>${t("容易踩的坑")}</h4>${list(g.watch)}<p class="hint"><a href="${esc(g.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a></p></details>`).join("");
  return `<section class="panel dt-block"><div class="dt-head"><h3>${t("需要你确认的")}</h3></div>${rows}</section>${fsaCard}<h3 class="tax-sub">${t("开户前先看（按账户类型）")}</h3>${guides}`;
}
const LINKS = { "house-deal": () => href("house", "deal"), "house-assets": () => href("house", "cars"), income: () => `${href("bills", "income")}?tab=records`, settings: () => `${href("me", "settings")}?sec=family`, cards: () => href("bills", "accounts") };
function eventsTab(s) {
  return EVENTS.filter((e) => on(e.when, s)).map((e) => `<details class="panel tax-event"><summary><b>${e.icon} ${esc(tx(e.title))}</b></summary>
    <h4>${t("会碰到什么")}</h4>${list(e.meet)}<h4>${t("现在要做")}</h4>${list(e.todo)}<h4>${t("要存什么")}</h4>${list(e.keep)}
    ${LINKS[e.link] ? `<p><a class="btn btn-sm btn-ghost" href="${esc(LINKS[e.link]())}">${t("去小助手里相关的页面")}</a></p>` : ""}</details>`).join("");
}
const learnTab = () => TERMS.map((e) => `<details class="panel tax-event"><summary><b>${esc(tx(e.name))}</b></summary><p>${esc(tx(e.body))}</p><p class="hint"><a href="${esc(e.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a></p></details>`).join("");

const YEAR_TABS = ["year", "household", "docs"];   // 这几页和税务年度有关：筛选里才放年份
export function viewTax() {
  const q = state.route?.q, tab = activeTab(state.route) || "year", y = +q?.get("y") || activeTaxYear(), s = setupFor(y), now = new Date().getFullYear();   // 家庭情况按这一年的快照
  const years = [...new Set([...Array.from({ length: now - 2024 + 1 }, (_, i) => 2024 + i), y])].sort();
  const filter = YEAR_TABS.includes(tab) ? filterPop(`<div class="fpop-fields"><label class="tb-field"><span>${t("税务年度")}</span><select data-tax-ysel data-tab="${tab}" data-nosearch aria-label="${esc(t("税务年度"))}">${years.map((v) => `<option value="${v}" ${v === y ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>`, { id: "taxy", eye: true }) : false;
  const body = tab === "household" ? householdTab(s, y) : tab === "docs" ? docsTab(y, s) : tab === "accounts" ? accountsTab() : tab === "events" ? eventsTab(s) : tab === "learn" ? learnTab() : yearTab(y, s);
  return `<section class="section tax-page">${pageHead({ title: t("税务"), tabs: TAX_TABS, tab, hrefOf: (id) => tabHref(id, y), filter, note: infoTip(t("参考用，不是税务建议；以 IRS、伊利诺伊税务局官网和 TurboTax 为准。不存 SSN / ITIN / PIN。"), { align: "start" }) })}
    <p class="notice" role="note">${t("参考用，不是税务建议。数字和政策每年会变，标「待核对」的报税前对着官网再看一遍。")}</p>
    ${body}</section>`;
}
