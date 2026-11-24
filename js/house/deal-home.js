/* 交易首页 + 某一类交易的子页：每类交易（买入 / 卖出；车辆：买车、卖车、归还；租房：退租）一个 Section
 *  · 标题「买入 · N 笔交易」；没有交易 → 只有「记录…交易」按钮；有 → 先显示进行中的一笔，没有进行中就显示最近一笔
 *  · 其余交易（已交割 / 已完成 / 已取消）折叠成「其他交易（n）」，展开后按日期从近到远一行一笔；只有已取消的能删除
 *  · 点一行 / 点进行中 → 交易详情（?deal=<id>，在 deal-page.js）；子页（?kind=buy）同样的 Section，「其他交易」默认展开
 *  纯展示：开始 / 取消 / 删除的点击处理在 app/events/click-house.js（deal-start / deal-cancel-closed / deal-delete）。 */
import { D, V, dealHref, dealTasks, isVehDeal, propertyLive, subjectDeals } from "./deal-tasks.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { lpAttr } from "../core/long-press.js";
import { priceOrNull } from "../core/finance-access.js";
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
const row = (url, icon, title, desc, prog, badge = "") => `<a href="${url}" class="ui-row mrow"><span class="mi" aria-hidden="true">${icon}</span>
  <span class="mt"><b>${title}</b><small>${desc}</small>${prog != null ? `<span class="mprog"><i style="width:${prog}%"></i></span>` : ""}</span>${badge}<span class="ui-chev" aria-hidden="true">›</span></a>`;
/** 进行中那笔的入口行 */
function openRow(d, url) {
  const K = D().KINDS, g = dealProgress(d);
  const desc = [t("总进度 {p}%", { p: g.pct }), t("已完成 {a} / {b}", { a: g.doneN, b: g.total }), g.must ? t("必须项还剩 {n}", { n: g.must }) : null,
    g.next ? t("下一项 {date}：{name}", { date: fmtDate(g.next.due), name: t(g.next.name) }) : null].filter(Boolean).map(esc).join(" · ");
  return row(url, KIND_ICON[d.kind] || "📝", t("{kind}进行中", { kind: t(K[d.kind]) }), desc, g.pct, g.late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: g.late })}</span>` : "");
}
const startBtn = (kind, veh) => `<button type="button" class="btn btn-primary btn-sm" data-action="deal-start" data-kind="${kind}" ${veh ? `data-asset="${veh.id}"` : ""}>${t("记录{kind}交易", { kind: t(D().KINDS[kind]) })}</button>`;

const dateKey = (d) => d.closing_on || (d.closed_at || d.updated_at || "").slice(0, 10);
/** 最近一笔历史交易的入口行（点进交易详情） */
function lastRow(d, kind) {
  const desc = [dealDate(d), outcomeText(d), priceOrNull(d.price) ? money(num(d.price)) : null].filter(Boolean).map(esc).join(" · ");
  return row(dealHref(d), KIND_ICON[kind] || "📝", t("最近一笔{kind}交易", { kind: t(D().KINDS[kind]) }), desc, null);
}
/** 一类交易的 Section：标题（几笔）→ 进行中 / 最近一笔 → 其余折叠成行（从近到远）。没有交易：只给「记录…交易」按钮 */
function kindSection(kind, deals, canStart, veh, expand = false) {
  const K = D().KINDS, mine = deals.filter((d) => d.kind === kind).sort((a, b) => dateKey(b).localeCompare(dateKey(a)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const open = mine.find((d) => !d.outcome), closed = mine.filter((d) => d.outcome);
  const head = mine.length ? t("{kind} · {n} 笔交易", { kind: t(K[kind]), n: mine.length }) : t("{kind} · 还没有交易", { kind: t(K[kind]) });
  const feat = open || closed[0], rest = open ? closed : closed.slice(1);
  const main = open ? `<div class="panel mlist deal-kind is-open">${openRow(open, dealHref(open))}</div>` : feat ? `<div class="panel mlist deal-kind">${lastRow(feat, kind)}</div>` : "";
  const act = canStart && !open ? `<div class="deal-kind-act">${startBtn(kind, veh)}</div>` : "";
  const note = !mine.length && !canStart ? `<p class="muted">${t("现在的状态下不能开始这类交易。")}</p>` : "";
  const more = rest.length ? `<details class="deal-more" ${expand ? "open" : ""}><summary>${t("其他交易（{n}）", { n: rest.length })}</summary>${dealRows(rest)}</details>` : "";
  return `<section class="section deal-sec"><div class="section-head"><h2>${KIND_ICON[kind] || "📝"} ${esc(head)}</h2></div>${main}${act}${note}${more}</section>`;
}

/** 交易首页 */
export function dealLanding({ p, veh, bar, headCard }) {
  const deals = subjectDeals(p, veh), starts = veh ? vehicleStarts(veh) : propertyStarts(p), live = veh ? V().isActive(veh) : propertyLive(p);
  const intro = veh ? t("买车、卖车或租赁到期归还时，按常见流程生成带日期的清单：产权与上牌、保险、拆车牌、已售通知、删除个人数据，逐项提醒。")
    : t("买入或卖出时，按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、贷款承诺、停服务通知、交割后事项，逐项提醒。");
  return `${bar}${headCard}
    <p class="muted deal-intro">${intro}</p>
    ${kindsOf(p, veh, deals).map((k) => kindSection(k, deals, starts.some(([x]) => x === k), veh)).join("")}
    ${!live ? `<p class="muted">${veh ? t("已卖出或已归还的车只保留历史。") : t("已卖出或退租的房产只保留历史。")}</p>` : ""}`;
}

/** 某一类交易的子页：和首页同一个 Section，只是「其他交易」默认展开 */
export function dealKindPage({ p, veh, kind, bar, headCard }) {
  const starts = veh ? vehicleStarts(veh) : propertyStarts(p);
  return `${bar}${headCard}${kindSection(kind, subjectDeals(p, veh), starts.some(([x]) => x === kind), veh, true)}`;
}

/** 其余交易：一行一笔（日期 / 结果 / 金额；点一行进详情）。只有「已取消」的能删除；已交割 / 已完成的先取消再删除（左滑 / 长按菜单 / 行内按钮） */
function dealRows(list) {
  const li = (d) => {
    const url = dealHref(d), cancelled = d.outcome === "cancelled";
    const items = [{ label: t("详情"), href: url, first: true }, cancelled ? { label: t("删除"), action: "deal-delete", data: { deal: d.id }, danger: true } : { label: t("取消这笔交易"), action: "deal-cancel-closed", data: { deal: d.id }, danger: true }];
    const acts = cancelled ? `<button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="deal-delete" data-deal="${esc(d.id)}">${t("删除")}</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="deal-cancel-closed" data-deal="${esc(d.id)}">${t("取消")}</button>`;
    return `<li ${cancelled ? 'data-swipe-del="deal"' : ""} data-row-open="${esc(url)}" ${lpAttr(items)}>
    <span class="ui-badge" data-tone="${cancelled ? "warn" : "ok"}" data-size="sm">${esc(outcomeText(d))}</span>
    <div class="grow"><a class="link-name" href="${esc(url)}">${esc(dealDate(d))}</a><small>${[priceOrNull(d.price) ? money(num(d.price)) : null, d.attorney, d.agent].filter(Boolean).map(esc).join(" · ")}</small></div>
    <span class="hist-act">${acts}</span></li>`;
  };
  return `<ul class="restock-list hist-list deal-rows">${list.map(li).join("")}</ul>`;
}
