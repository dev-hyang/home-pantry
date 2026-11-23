/* 税务 → 今年：「{y} 年收入报税累计」卡片。把这一年所有可能涉及报税的收入记录列出来，按「报税一级 → 收入类型（二级）→ 每一笔」分组，
 * 每组有小计，每笔有一个小 i 图标说明：为什么要报 / TurboTax 在哪填 / 汇总页有没有这一项。规则在 tax-income-rules.js；亲友赠与只是其中一个一级。
 * 点一笔 = 去收入记录里按「类型 + 当天」筛出来；点「看这一类」= 按类型 + 全年筛。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { infoTip } from "../core/info-tip.js";
import { incLeaf } from "../core/income-taxonomy.js";
import { TAX_THRESHOLDS, foreignGiftTotal, yearState } from "./tax-calendar.js";
import { TAX_GROUPS, assessRecord } from "./tax-income-rules.js";
import { taxRows } from "./tax-numbers.js";

const tx = (o) => (o ? (lang === "en" ? o.en : o.zh) : "");
const money = (n) => Units.money(n);
const r2 = (n) => Math.round(n * 100) / 100;
const incUrl = (kind, from, to) => `${href("bills", "income")}?tab=records&inc=1&kind=${encodeURIComponent(kind)}&from=${from}&to=${to}`;   // inc=1 才会套上类型和日期筛选
const BADGE = { tax: ["accent", "要报"], maybe: ["caution", "看情况"], no: ["neutral", "一般不用报"], info: ["neutral", "不是收入"] };
const GROUP_N = { work: "tax", invest: "tax", rent: "tax", side: "tax", maybe: "maybe", no: "no", gift: "info" };

/** 这一年所有有规则的收入记录 → [{ r, a }]（a = assessRecord 的结果），按日期从早到晚 */
function yearItems(y) {
  return (state.inc?.rec || []).filter((r) => String(r.received_on || "").startsWith(String(y))).map((r) => ({ r, a: assessRecord(r, { repayAsGift: yearState(y).repayAsGift !== false }) })).filter((x) => x.a)
    .sort((p, q) => String(p.r.received_on).localeCompare(String(q.r.received_on)));
}
const sumOf = (items) => r2(items.reduce((s, x) => s + x.a.amount, 0));

/** 小 i 里的三行：为什么 / TurboTax / 汇总页 */
function tipLines(y, a) {
  const row = a.sum ? taxRows(y).find((x) => x.id === a.sum) : null;
  const inSum = row && !row.manual ? t("汇总页：已自动列入「{n}」", { n: tx(row.name) }) : t("汇总页：{s}", { s: tx(a.sumNote) || t("没有这一行") });
  return [`${t("为什么")}：${tx(a.why)}`, `TurboTax：${tx(a.tt)}`, inSum, a.tag ? `⚠ ${tx(a.tag)}` : ""];
}
function recordRow(y, { r, a }) {
  const d = String(r.received_on || "");
  return `<li class="tax-inc-rec"><span class="tax-inc-d">${esc(d.slice(5))}</span><span class="tax-inc-pw"><a class="tax-inc-link" href="${incUrl(r.kind, d, d)}">${esc(r.source_name || "—")}</a>${infoTip(tipLines(y, a), { size: "sm", align: "end" })}</span><b class="tax-inc-a">${money(a.amount)}</b>
    ${a.tag ? `<small class="tax-inc-tag">${esc(tx(a.tag))}</small>` : ""}</li>`;   // 整行可点（链接的 ::after 铺满整行），i 角标在付款方文字的右上角
}
/** 一个二级（收入类型）：可折叠，标题上有类型名、笔数、小计；超过 3 笔默认收起 */
function leafBlock(y, kind, items) {
  const lf = incLeaf(kind);
  return `<details class="tax-inc-leaf" ${items.length <= 3 ? "open" : ""}><summary><span class="tax-inc-ln">${lf.icon} ${esc(t(lf.name))} <small class="muted">${t("{n} 笔", { n: items.length })}</small></span><b>${money(sumOf(items))}</b></summary>
    <ul class="tax-inc-recs">${items.map((x) => recordRow(y, x)).join("")}</ul><p class="tax-inc-more"><a href="${incUrl(kind, `${y}-01-01`, `${y}-12-31`)}">${t("在收入记录里看这一类")} ›</a></p></details>`;
}
/** 亲友赠与这一组底部：合计 + 和 10 万美元申报线的进度条 + 一个 i（口径、美国人 / 需要还的说明）+ 官方链接 */
function giftFoot(y) {
  const g = foreignGiftTotal(y), th = TAX_THRESHOLDS.foreignGift, pct = Math.min(100, Math.round((g.total / th.amount) * 100));
  const tip = [tx(th.label), g.us.n ? t("另有 {n} 笔来自美国人，共 {a}，不算在合计里。", { n: g.us.n, a: money(g.us.total) }) : "", g.repay ? t("标了「需要还」的 {a}：真是借款的话不算赠与。", { a: money(g.repay) }) : "", t("核对：{d}", { d: th.verified })];
  return `<div class="tax-inc-gift"><div class="tax-inc-sumrow"><span>${t("计入 Form 3520 的合计")}${infoTip(tip, { size: "sm", align: "end" })}</span><b>${money(g.total)}</b></div><span class="mprog"><i style="width:${pct}%"></i></span>
    <label class="check-inline tax-inc-opt"><input type="checkbox" data-tax-year="repayAsGift" data-y="${y}" ${yearState(y).repayAsGift !== false ? "checked" : ""}><span>${t("标了「需要还」的也按赠与算")}${infoTip(t("税务看实质，不看你家里的账：没有正式借据 / 利息 / 还款安排的借款，IRS 可能当赠与。真借款并在还的，取消勾选。借贷里的还款记录不受影响。"), { size: "sm", align: "end", pos: "bottom" })}</span></label>
    <p class="tax-inc-more"><a href="${esc(th.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a></p></div>`;
}
function groupBlock(y, g, items) {
  const [tone, label] = BADGE[GROUP_N[g.id]], kinds = [...new Set(items.map((x) => x.r.kind))], counted = GROUP_N[g.id] === "tax" ? items.filter((x) => x.a.n === "tax") : items;
  return `<details class="tax-inc-group" open><summary><span class="tax-inc-gn"><span class="tax-inc-gt">${g.icon} ${esc(tx(g.name))}${infoTip(tx(g.desc), { align: "start", pos: "bottom" })}</span><span class="ui-badge" data-tone="${tone}" data-size="sm">${t(label)}</span></span><b>${money(sumOf(counted))}</b></summary>
    ${kinds.map((k) => leafBlock(y, k, items.filter((x) => x.r.kind === k))).join("")}${g.id === "gift" ? giftFoot(y) : ""}</details>`;
}

export function incomeTaxCard(y) {
  const head = `<div class="dt-head"><h3>💰 ${t("{y} 年收入报税累计", { y })}${infoTip([t("这一年所有可能涉及报税的收入，按大类和收入类型分组。"), t("每笔的小 i：为什么要报、TurboTax 在哪填、汇总页有没有。"), t("借款、转账、卖房 / 卖股票的本金不列在这里。"), t("参考用，以 W-2 / 1099 和 IRS 官网为准。")], { size: "lg", align: "start" })}</h3></div>`;
  if (!state.inc?.loaded) return `<section class="panel dt-block tax-inc">${head}<p class="muted">${t("收入记录还没读到；打开一次 财务 → 收入 再回来。")}</p></section>`;
  const items = yearItems(y), by = (g) => items.filter((x) => x.a.group === g), nOf = (n) => items.filter((x) => x.a.n === n && x.a.group !== "gift");
  const line = (name, v, cls = "") => `<div class="tax-inc-sumrow ${cls}"><span>${name}</span><b>${money(v)}</b></div>`;
  const totals = `${line(t("要报的收入合计"), sumOf(nOf("tax")), "is-main")}${line(t("看情况（不计入）"), sumOf(nOf("maybe")))}${line(t("一般不用报"), sumOf(nOf("no")))}${line(t("亲友赠与"), sumOf(by("gift")))}`;
  const groups = TAX_GROUPS.map((g) => ({ g, rows: by(g.id) })).filter((x) => x.rows.length).map((x) => groupBlock(y, x.g, x.rows)).join("");
  return `<section class="panel dt-block tax-inc">${head}<div class="tax-inc-sum">${totals}</div>
    ${groups || `<p class="muted">${t("{y} 年还没有收入记录。", { y })}</p>`}
    <p class="tax-inc-more"><a href="${href("bills", "tax")}?tab=summary&y=${y}">${t("去汇总页核对数字")} ›</a></p></section>`;
}
