/* 交易首页 + 某一类交易的子页（2026-11-24 重构，原来全挤在 deal-page.js 一页里）：
 *  · 首页（#/house/deal，车辆再带 ?asset=）：状态卡 + 每类交易一张卡片——买入、卖出（车辆：买车、卖车、归还；租房：退租）
 *      没记过 → 空卡片 +「记录…交易」；进行中 → 总进度 / 已完成 / 下一项；只有历史 → 几笔、最近一笔。点进行中 / 历史的卡片进「这一类」的子页
 *  · 某一类的子页（?kind=buy）：进行中那笔的入口 + 这一类的历史交易（一行一笔）；点进行中 / 点一行 → 交易详情（?deal=<id>，在 deal-page.js）
 *  纯展示：开始交易、删历史交易的点击处理还是 app/events/click-house.js 里原来的 deal-start / deal-delete。 */
import { D, V, dealHref, dealTasks, isVehDeal, kindHref, propertyLive, subjectDeals } from "./deal-tasks.js";
import { bulkBar, bulkCheck, bulkMenuItem, bulkOn, bulkRegister } from "../core/bulk-select.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { lpAttr } from "../core/long-press.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { priceOrNull } from "../core/finance-access.js";
import { Store } from "../core/store.js";
import { t } from "../core/i18n.js";

const KIND_ICON = { buy: "📥", sell: "📤", move_out: "📦", veh_buy: "🔑", veh_sell: "🏷️", veh_return: "↩️" };

/** 一笔交易的进度：总进度、已完成 / 总数（不含跳过）、必须项还剩几项、逾期几项、下一项 */
export function dealProgress(deal) {
  const tasks = dealTasks(deal), skipped = tasks.filter((x) => x.skipped).length, undone = tasks.filter((x) => !x.done && !x.skipped);
  const total = tasks.length - skipped, doneN = total - undone.length;
  return { total, doneN, pct: total ? Math.round((doneN / total) * 100) : 0, must: undone.filter((x) => x.priority === "must").length, late: undone.filter((x) => x.overdue).length,
    next: undone.filter((x) => x.due).sort((a, b) => a.due.localeCompare(b.due))[0] || null };
}
/** 一笔交易的日期（历史列表 / 卡片上显示）：交割日，没有就用关闭时间 */
export const dealDate = (d) => (d.closing_on ? fmtDate(d.closing_on) : fmtDate((d.closed_at || d.updated_at || "").slice(0, 10)));
const outcomeText = (d) => (d.outcome === "cancelled" ? t("已取消") : isVehDeal(d) ? t("已完成") : t("已交割"));

/** 没有进行中交易时可以开始哪些流程（按房产 / 车辆现在的状态） */
export function propertyStarts(p) {
  return [
    !["sold", "moved_out", "selling"].includes(p.status) && p.role !== "tenant" && ["looking", "buying"].includes(p.status) ? ["buy", t("开始买入流程")] : null,
    ["owned", "selling"].includes(p.status) && p.role !== "tenant" ? ["sell", t("开始卖出流程")] : null,
    p.role === "tenant" && p.status === "renting" ? ["move_out", t("开始退租流程")] : null,
    ["owned", "selling"].includes(p.status) && p.role !== "tenant" ? ["buy", t("记录买入流程（刚签约）")] : null,   // 卖出进行中也可以补录买入
  ].filter(Boolean);
}
export function vehicleStarts(a) {
  const st = V().statusOf(a);
  return [
    st === "looking" ? ["veh_buy", t("开始买车流程")] : null,
    ["owned", "financed"].includes(st) ? ["veh_sell", t("开始卖车流程")] : null,
    ["owned", "financed"].includes(st) ? ["veh_buy", t("记录买车流程（刚下订）")] : null,
    st === "leased" ? ["veh_return", t("开始租赁归还流程")] : null,
    st === "leased" ? ["veh_sell", t("买断后卖车")] : null,
  ].filter(Boolean);
}
/** 这个主体能出现哪几类交易卡片（车辆：归还只有租赁车 / 以前有过归还记录才出现） */
function kindsOf(p, veh, deals) {
  if (veh) return ["veh_buy", "veh_sell", ...(V().statusOf(veh) === "leased" || deals.some((d) => d.kind === "veh_return") ? ["veh_return"] : [])];
  return p.role === "tenant" ? ["move_out"] : ["buy", "sell"];
}

/** 一行入口（和交易详情里的 .mrow 同一个样子） */
const row = (url, icon, title, desc, prog, badge = "") => `<a href="${url}" class="mrow"><span class="mi" aria-hidden="true">${icon}</span>
  <span class="mt"><b>${title}</b><small>${desc}</small>${prog != null ? `<span class="mprog"><i style="width:${prog}%"></i></span>` : ""}</span>${badge}<span class="ui-chev" aria-hidden="true">›</span></a>`;
/** 进行中那笔的入口行 */
function openRow(d, url) {
  const K = D().KINDS, g = dealProgress(d);
  const desc = [t("总进度 {p}%", { p: g.pct }), t("已完成 {a} / {b}", { a: g.doneN, b: g.total }), g.must ? t("必须项还剩 {n}", { n: g.must }) : null,
    g.next ? t("下一项 {date}：{name}", { date: fmtDate(g.next.due), name: t(g.next.name) }) : null].filter(Boolean).map(esc).join(" · ");
  return row(url, KIND_ICON[d.kind] || "📝", t("{kind}进行中", { kind: t(K[d.kind]) }), desc, g.pct, g.late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: g.late })}</span>` : "");
}
const startBtn = (kind, veh) => `<button type="button" class="btn btn-primary btn-sm" data-action="deal-start" data-kind="${kind}" ${veh ? `data-asset="${veh.id}"` : ""}>${t("记录{kind}交易", { kind: t(D().KINDS[kind]) })}</button>`;

/** 首页上的一张卡片：进行中 / 只有历史 / 空白 */
function kindCard(kind, deals, canStart, veh) {
  const K = D().KINDS, mine = deals.filter((d) => d.kind === kind), open = mine.find((d) => !d.outcome), closed = mine.filter((d) => d.outcome);
  const last = closed[0];
  let body;
  if (open) body = row(dealHref(open), KIND_ICON[kind] || "📝", t("{kind}进行中", { kind: t(K[kind]) }), openRowDesc(open), dealProgress(open).pct, dealProgress(open).late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: dealProgress(open).late })}</span>` : "");
  else if (closed.length) body = row(closed.length === 1 ? dealHref(closed[0]) : kindHref(kind, veh?.id), KIND_ICON[kind] || "📝", t("{kind}交易历史", { kind: t(K[kind]) }),
    esc([t("{n} 笔", { n: closed.length }), t("最近：{d} {o}", { d: dealDate(last), o: outcomeText(last) }), priceOrNull(last.price) ? money(num(last.price)) : null].filter(Boolean).join(" · ")), null);
  else body = `<div class="deal-empty"><span class="mi" aria-hidden="true">${KIND_ICON[kind] || "📝"}</span><div><b>${t(K[kind])}</b><p class="muted">${t("还没有记录{kind}交易", { kind: t(K[kind]) })}</p></div></div>`;
  const act = canStart && !open ? `<div class="deal-kind-act">${startBtn(kind, veh)}</div>` : "";
  return `<div class="panel mlist deal-kind ${open ? "is-open" : closed.length ? "" : "is-empty"}">${body}${act}</div>`;
}
const openRowDesc = (d) => { const g = dealProgress(d); return [t("总进度 {p}%", { p: g.pct }), t("已完成 {a} / {b}", { a: g.doneN, b: g.total }), g.must ? t("必须项还剩 {n}", { n: g.must }) : null].filter(Boolean).map(esc).join(" · "); };

/** 交易首页 */
export function dealLanding({ p, veh, bar, headCard }) {
  const deals = subjectDeals(p, veh), starts = veh ? vehicleStarts(veh) : propertyStarts(p), live = veh ? V().isActive(veh) : propertyLive(p);
  const intro = veh ? t("买车、卖车或租赁到期归还时，按常见流程生成带日期的清单：产权与上牌、保险、拆车牌、已售通知、删除个人数据，逐项提醒。")
    : t("买入或卖出时，按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、贷款承诺、停服务通知、交割后事项，逐项提醒。");
  return `${bar}${headCard}
    <section class="section"><div class="section-head"><h2>${t("交易")}</h2><p>${intro}</p></div>
      <div class="deal-kinds">${kindsOf(p, veh, deals).map((k) => kindCard(k, deals, starts.some(([x]) => x === k), veh)).join("")}</div>
      ${!live ? `<p class="muted">${veh ? t("已卖出或已归还的车只保留历史。") : t("已卖出或退租的房产只保留历史。")}</p>` : ""}
    </section>`;
}

/** 某一类交易的子页：进行中那笔 + 这一类的历史 */
export function dealKindPage({ p, veh, kind, bar, headCard }) {
  const K = D().KINDS, deals = subjectDeals(p, veh).filter((d) => d.kind === kind), open = deals.find((d) => !d.outcome), closed = deals.filter((d) => d.outcome);
  const starts = veh ? vehicleStarts(veh) : propertyStarts(p), canStart = starts.some(([x]) => x === kind);
  const current = open
    ? `<div class="panel mlist deal-kind is-open">${openRow(open, dealHref(open))}</div>`
    : `<div class="panel mlist deal-kind is-empty"><div class="deal-empty"><span class="mi" aria-hidden="true">${KIND_ICON[kind] || "📝"}</span><div><b>${t("没有进行中的{kind}交易", { kind: t(K[kind]) })}</b>${canStart ? "" : `<p class="muted">${t("现在的状态下不能开始这类交易。")}</p>`}</div></div>${canStart ? `<div class="deal-kind-act">${startBtn(kind, veh)}</div>` : ""}</div>`;
  return `${bar}${headCard}
    <section class="section"><div class="section-head"><h2>${t("{kind}交易", { kind: t(K[kind]) })}</h2></div>${current}</section>
    ${dealHistory(closed, null, (d) => dealHref(d), t("{kind}交易历史", { kind: t(K[kind]) }))}`;
}

/** 历史交易：一行一笔（种类徽章 + 日期 / 摘要；点一行进交易详情）；支持多选 / 左滑 / 长按菜单删除（原来在 deal-page.js，原样搬过来，只多了标题参数） */
export function dealHistory(list, current, linkOf, title = null) {
  if (!list.length) return "";
  const K = D().KINDS, lim = pageLimit("deals");
  bulkRegister("deals", { ids: () => list.filter((d) => d.id !== current).map((d) => d.id), del: (id) => Store.deleteDeal(id) });
  const pick = !!bulkOn("deals");   // 分批显示；换页面回到一页
  // 一行：种类徽章 + 日期 / 摘要；“查看清单”固定在右上角（手机上摘要换行也不会和按钮叠在一起）
  return `<section class="section"><div class="section-head"><h2>${esc(title || t("历史交易"))}</h2></div><div class="panel">${bulkBar("deals")}<ul class="restock-list hist-list">${list.slice(0, lim).map((d) => `<li ${pick ? (d.id === current ? "" : "data-row-chk") : `data-swipe-del="deal" ${d.id === current ? "" : `data-row-open="${esc(linkOf(d))}"`} ${lpAttr([d.id === current ? null : { label: t("详情"), href: linkOf(d), first: true }, { label: t("删除"), action: "deal-delete", data: { deal: d.id }, danger: true }, d.id === current ? null : bulkMenuItem("deals", d.id)])}`} ${d.id === current ? 'aria-current="true"' : ""}>${pick && d.id !== current ? bulkCheck("deals", d.id) : ""}
    <span class="badge" style="background:var(--surface-2)">${t(K[d.kind])}</span>
    <div class="grow"><a class="link-name" href="${linkOf(d)}">${d.closing_on ? fmtDate(d.closing_on) : fmtDate((d.closed_at || d.updated_at || "").slice(0, 10))}</a>
      <small>${[d.outcome === "cancelled" ? t("已取消") : isVehDeal(d) ? t("已完成") : t("已交割"), priceOrNull(d.price) ? money(num(d.price)) : null, d.attorney, d.agent].filter(Boolean).map(esc).join(" · ")}</small></div>
    <span class="hist-act">${pick ? "" : d.id === current ? `<span class="badge b-ok">${t("正在查看")}</span>` : `<a class="btn btn-sm btn-ghost" href="${linkOf(d)}">${t("详情")} ›</a>`}<button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="deal-delete" data-deal="${esc(d.id)}">${t("删除")}</button></span></li>`).join("")}</ul>${pageMoreBtn("deals", list.length, lim)}</div></section>`;
}
