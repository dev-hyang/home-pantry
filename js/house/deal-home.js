/* 交易首页 + 某一类交易的子页：每类交易（买入 / 卖出；车辆：买车、卖车、归还；租房：退租）一个 Section
 *  · 标题「买入 · N 笔交易」；没有交易 → 只有「记录…交易」按钮；有 → 先显示进行中的一笔，没有进行中就显示最近一笔
 *  · 「查看历史（n）」展开全部已结束的交易，按日期从近到远一行一笔；已取消的可恢复 / 删除，已交割的先取消再删除
 *  · 点一行 / 点进行中 → 交易详情（?deal=<id>，在 deal-page.js）；没有单独的「买入 / 卖出」子页，一律回到这里
 *  纯展示：点击处理在 app/events/click-house.js（deal-start / deal-history / deal-restore / deal-cancel-closed / deal-delete）。 */
import { D, V, dealHref, dealTasks, isVehDeal, propertyLive, subjectDeals } from "./deal-tasks.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { state } from "../core/state.js";
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
/** 每类交易一句话说明（Section 标题下面） */
const KIND_DESC = {
  buy: "按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、贷款承诺、交割后事项，逐项提醒。",
  sell: "按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、停服务通知、交割后事项，逐项提醒。",
  move_out: "退租时的清单：通知房东、验房、押金、停服务、转寄邮件，逐项提醒。",
  veh_buy: "买车的清单：产权与上牌、保险、首次保养，逐项提醒。",
  veh_sell: "卖车的清单：过户、拆车牌、已售通知、删除个人数据，逐项提醒。",
  veh_return: "租赁到期归还的清单：里程与车况检查、归还手续、保险与车牌，逐项提醒。",
};
/** 一类交易的容器：标题（几笔）+ 说明 → 进行中 / 最近一笔 → 按钮行（查看历史靠左，记录…交易靠右）→ 展开后的全部历史（都在这个容器里） */
function kindSection(kind, deals, canStart, veh) {
  const K = D().KINDS, mine = deals.filter((d) => d.kind === kind).sort((a, b) => dateKey(b).localeCompare(dateKey(a)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const open = mine.find((d) => !d.outcome), closed = mine.filter((d) => d.outcome);
  const head = mine.length ? t("{kind} · {n} 笔交易", { kind: t(K[kind]), n: mine.length }) : t("{kind} · 还没有交易", { kind: t(K[kind]) });
  const feat = open || closed[0], hkey = `${veh?.id || "p"}:${kind}`, histOpen = !!state.dealHistOpen?.[hkey];
  const main = open ? `<div class="mlist deal-kind is-open">${openRow(open, dealHref(open))}</div>` : feat ? `<div class="mlist deal-kind">${lastRow(feat, kind)}</div>` : "";
  const histBtn = closed.length ? `<button type="button" class="btn btn-sm deal-hist-btn" data-action="deal-history" data-key="${esc(hkey)}" aria-expanded="${histOpen}">${histOpen ? t("收起历史") : t("查看历史（{n}）", { n: closed.length })}</button>` : "";
  const start = canStart && !open ? startBtn(kind, veh) : "";
  const acts = histBtn || start ? `<div class="deal-kind-act">${histBtn}${start}</div>` : "";
  const note = !mine.length && !canStart ? `<p class="muted">${t("现在的状态下不能开始这类交易。")}</p>` : "";
  return `<section class="panel deal-sec"><div class="section-head"><h2>${KIND_ICON[kind] || "📝"} ${esc(head)}</h2></div>${KIND_DESC[kind] ? `<p class="muted deal-desc">${esc(t(KIND_DESC[kind]))}</p>` : ""}${main}${note}${acts}${histOpen ? dealRows(closed, !!open) : ""}</section>`;
}

/** 交易首页 */
export function dealLanding({ p, veh, bar, headCard }) {
  const deals = subjectDeals(p, veh), starts = veh ? vehicleStarts(veh) : propertyStarts(p), live = veh ? V().isActive(veh) : propertyLive(p);
  return `${bar}${headCard}
    ${kindsOf(p, veh, deals).map((k) => kindSection(k, deals, starts.some(([x]) => x === k), veh)).join("")}
    ${!live ? `<p class="muted">${veh ? t("已卖出或已归还的车只保留历史。") : t("已卖出或退租的房产只保留历史。")}</p>` : ""}`;
}

/** 历史交易：一行一笔（结果徽章 / 日期 / 金额；点一行进详情）。已取消的行上只有「恢复」（删除在详情页右上角 ⋯ 菜单、或长按）；已交割 / 已完成的先在详情页「取消」再删除 */
function dealRows(list, hasOpen) {
  const li = (d) => {
    const url = dealHref(d), cancelled = d.outcome === "cancelled";
    const restore = cancelled && !hasOpen ? { label: t("恢复"), action: "deal-restore", data: { deal: d.id } } : null;
    const items = [{ label: t("详情"), href: url, first: true }, restore, cancelled ? { label: t("删除"), action: "deal-delete", data: { deal: d.id }, danger: true } : { label: t("取消这笔交易"), action: "deal-cancel-closed", data: { deal: d.id }, danger: true }];
    const act = restore ? `<button type="button" class="btn btn-sm btn-ghost" data-action="deal-restore" data-deal="${esc(d.id)}">${t("恢复")}</button>` : "";
    return `<li data-row-open="${esc(url)}" ${lpAttr(items)}>
    <span class="ui-badge" data-tone="${cancelled ? "warn" : "ok"}" data-size="sm">${esc(outcomeText(d))}</span>
    <div class="grow"><a class="link-name" href="${esc(url)}">${esc(dealDate(d))}</a><small>${priceOrNull(d.price) ? esc(money(num(d.price))) : ""}</small></div>
    <span class="deal-row-acts">${act}<span class="ui-chev" aria-hidden="true">›</span></span></li>`;
  };
  return `<ul class="deal-rows">${list.map(li).join("")}</ul>`;
}
