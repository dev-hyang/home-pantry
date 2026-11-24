/* 交易清单的数据与计算：任务模板、进度、提醒（dealAlertItems）、标题与日期文字。 */
import { DAY, daysUntil, esc, fmtDate, todayISO } from "../core/util.js";
import { addDays } from "../bills/logic.js";
import { askButton, ctx as askCtx, askPanel } from "../core/ask.js";
import { assetName } from "./assets.js";
import { finMatches } from "./deal-fin.js";
import { href } from "../core/router.js";
import { propertyActive } from "../core/lifecycle.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

export const D = () => window.DEALS;
export const V = () => window.VEHICLES;
const B = () => window.BILLS;
export const PRIO_CLS = { must: "b-out", should: "b-soon", optional: "" };
// 退出向导里各类账单默认延后多少天结束（水电气网会有最后一期账单）
export const END_LAG = { electric: 30, gas: 30, water: 45, internet: 14, mobile: 0, hoa: 0, property_tax: 0, mortgage: 0, rent: 0, insurance_home: 0, insurance_auto: 0 };
export const currentProp = () => state.properties.find((p) => p.id === state.propertyId) || null;
/* 同一个主体可以同时有几笔进行中的交易，但同一类型只能一笔（迁移 108）：买入和卖出可以同时进行（卖出进行中补录买入）。
 * 只能显示「一笔」的地方（首页提醒角标、房屋概览、车辆页的小标签）用 openDeal / openVehicleDeal = 优先级最高的那一笔：卖出 / 退租 / 归还 在前，买入在后。 */
const PRIORITY = ["sell", "move_out", "veh_sell", "veh_return", "buy", "veh_buy"];
const byPriority = (a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind);
export const openDeals = (pid = state.propertyId) => state.deals.filter((d) => d.property_id === pid && !d.outcome).sort(byPriority);
export const openVehicleDeals = (aid) => state.deals.filter((d) => d.asset_id === aid && !d.outcome).sort(byPriority);
export const openDeal = (pid = state.propertyId) => openDeals(pid)[0] || null;
export const openVehicleDeal = (aid) => openVehicleDeals(aid)[0] || null;
/** 某个主体（房产 id 或车辆 id）这一类型进行中的那笔 */
export const openDealOfKind = (kind, { pid = null, aid = null }) => state.deals.find((d) => d.kind === kind && !d.outcome && (aid ? d.asset_id === aid : d.property_id === pid)) || null;
export const isVehDeal = (d) => !!d?.asset_id;
/** 当前路由对应的交易（?deal= 指定的历史交易 / ?asset= 车辆的进行中交易 / 当前房产的进行中交易），面包屑和子页标题用 */
export function routeDeal() {
  const q = state.route?.q;
  const byId = q?.get("deal") ? state.deals.find((d) => d.id === q.get("deal")) : null;
  if (byId) return byId;
  const asset = q?.get("asset"), kind = q?.get("kind");
  if (kind) return state.deals.find((d) => d.kind === kind && !d.outcome && (asset ? d.asset_id === asset : d.property_id === state.propertyId)) || null;
  return asset ? openVehicleDeal(asset) : openDeal();
}
/** 这个主体（房产 p / 车辆 veh）的所有交易，新 → 旧 */
export const subjectDeals = (p, veh) => state.deals.filter((d) => (veh ? d.asset_id === veh.id : d.property_id === p?.id));
/** 某一类交易的子页地址（车辆带 ?asset=） */
export const kindHref = (kind, assetId = null) => `${href("house", "deal")}?${assetId ? `asset=${encodeURIComponent(assetId)}&` : ""}kind=${encodeURIComponent(kind)}`;
/** 面包屑里「交易」后面的几级：交易主页（卖出进行中）/ 清单、计划… / 交易信息、阶段、事项（再下一级是「编辑」）；某一类的历史列表页只有一级；首页返回空 */
export function dealTail(q) {
  const asset = q.get("asset"), deal = routeDeal(), kind = deal?.kind || q.get("kind"); if (!kind || !D().KINDS[kind]) return [];
  const K = t(D().KINDS[kind]);
  if (!q.get("deal") && !q.get("sec")) return [{ label: t("{kind}交易历史", { kind: K }) }];   // 这一类的历史列表页
  const date = deal ? fmtDate(deal.closing_on || (deal.closed_at || deal.updated_at || "").slice(0, 10)) : "";
  const hubLabel = !deal ? t("详情") : !deal.outcome ? t("{kind}进行中", { kind: K }) : `${t(deal.outcome === "cancelled" ? "{kind}已取消" : "{kind}已完成", { kind: K })} · ${date}`;
  const hub = { href: dealHref(deal), label: hubLabel }, sec = q.get("sec") || "", edit = !!q.get("edit");
  if (!sec) return [hub];
  const list = { href: dealHref(deal, "list"), label: t(VIEW_LABEL.list) }, ST = D().stagesOf(deal.kind) || {};
  const stageItem = (k) => ({ href: dealHref(deal, `stage:${k}`), label: t(ST[k] || "") });
  if (sec === "info") return edit ? [hub, list, { href: dealHref(deal, "info"), label: t("交易信息") }, { label: t("编辑") }] : [hub, list, { label: t("交易信息") }];
  if (sec.startsWith("stage:")) return [hub, list, { label: t(ST[sec.slice(6)] || "") }];
  if (sec === "task-new") return [hub, list, stageItem(q.get("stage") || "special"), { label: t("添加自定义事项") }];
  if (sec.startsWith("task:")) {
    const x = dealTasks(deal).find((k) => k.key === sec.slice(5)); if (!x) return [hub, list];
    return edit ? [hub, list, stageItem(x.stage), { href: dealHref(deal, sec), label: t(x.name) }, { label: t("编辑") }] : [hub, list, stageItem(x.stage), { label: t(x.name) }];
  }
  if (sec === "event-new" || sec.startsWith("event:")) {   // 实际 / 对比 … / 记一笔进展（或修改进展记录）
    const from = ["plan", "actual", "compare"].includes(q.get("from")) ? q.get("from") : "actual";
    return [hub, { href: dealHref(deal, from), label: t(VIEW_LABEL[from]) }, { label: sec === "event-new" ? t("记一笔进展") : t("修改进展记录") }];
  }
  const sub = dealSubLabel(sec, deal); return sub ? [hub, { label: sub }] : [hub];
}
/** 交易主页下的四个视图子页（?sec=list|plan|actual|compare） */
export const VIEW_LABEL = { list: "清单", plan: "计划", actual: "实际", compare: "对比" };
/** 交易子页在面包屑里的名字（?sec=info / stage:xxx / closeout） */
export function dealSubLabel(sec, deal = routeDeal()) {
  if (!sec) return null;
  if (sec === "info") return t("交易信息");
  if (VIEW_LABEL[sec]) return t(VIEW_LABEL[sec]);
  if (sec.startsWith("stage:")) return t(D().stagesOf(deal?.kind)[sec.slice(6)] || "");
  if (sec === "closeout") return deal?.kind === "buy" ? t("完成交割") : t("退出向导");
  if (sec === "cancel") return t("取消这笔交易");
  if (sec === "complete") return deal?.kind === "buy" ? t("完成交割") : deal?.kind === "veh_buy" ? t("已提车，标为持有") : deal?.kind === "veh_sell" ? t("已交车，标为已卖出") : t("已归还，标为已归还");
  return null;
}
/** 面包屑：看历史交易时中间多一级“历史 / 买入” */
export const historyLabel = (deal) => (deal?.outcome ? `${t("历史")} / ${t(D().KINDS[deal.kind] || "")}` : null);
/** 两个基准日期在这笔交易里的叫法：[合同 / 签约日, 交割 / 提车 / 归还日] */
export const dateLabels = (deal) => D().DATE_LABELS[deal?.kind] || D().DATE_LABELS.buy;
export const statusText = (p) => t(D().PROPERTY_STATUS[p?.status] || "持有");
/** 房产是否还在“使用中”（提醒只对这些房产生效） */
export const propertyLive = propertyActive;
/** 条件：bill:<分类>（该房产有这类账单）、kind:condo（condo / townhome）、role:landlord、autopay（有自动扣款账单） */
function matches(cond, prop, bills) {
  if (cond === "autopay") return bills.some((b) => b.autopay);
  const [k, v] = cond.split(":");
  if (k === "bill") return bills.some((b) => b.category === v);
  if (k === "kind") return v === "condo" ? ["condo", "townhome"].includes(prop.kind) : prop.kind === v;
  if (k === "role") return prop.role === v;
  return false;
}
/** 车辆交易的条件：region:na / cn、pt:ev / pt:ice（动力类型）、status:financed 等（拥有状态）、bill:<分类>、autopay（全家账单） */
function vehMatches(cond, asset, bills) {
  if (cond === "autopay") return bills.some((b) => b.autopay);
  const [k, v] = cond.split(":");
  if (k === "bill") return bills.some((b) => b.category === v);
  if (k === "region") return (state.houseProfile?.region || (Units.region.system === "us" ? "na" : "cn")) === v;
  if (k === "pt") { const pt = V().POWERTRAINS[asset.type]; return !!pt && (v === "ev" ? pt.ev : v === "ice" ? pt.ice : false); }
  if (k === "status") return V().statusOf(asset) === v;
  return false;
}
const dayDiff = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / DAY);
/** 补上到期天数、是否逾期、完成相对应完成日期的滞后天数（lag > 0 = 滞后，< 0 = 提前；只有已完成且有应完成日期时才有） */
function finishTask(x, dn, sk = null) {
  const daysLeft = x.due ? daysUntil(x.due) : null;
  return { ...x, daysLeft, done: dn, skipped: sk, overdue: !dn && !sk && daysLeft != null && daysLeft < 0, lag: dn && x.due ? dayDiff(dn.done_on, x.due) : null };
}
/** 交易的清单任务：
 *  模板任务的推荐日期（plan）按合同日 / 交割日 + 偏移，可被手动调整（due = 调整后的应完成日期，moved = 是否调过）；没填基准日期时 plan 为 null。
 *  自定义事项（key = "c:<id>"，custom = true）自带应完成 / 实际完成日期。 */
export function dealTasks(deal) {
  let ok;
  if (deal.asset_id) {   // 车辆交易：条件看这辆车的动力类型、拥有状态和全家的账单
    const asset = state.assets.find((a) => a.id === deal.asset_id);
    if (!asset) return [];
    const bills = state.bills.filter((b) => b.active);
    ok = (c) => vehMatches(c, asset, bills);
  } else {
    const prop = state.properties.find((p) => p.id === deal.property_id);
    if (!prop) return [];
    const bills = state.bills.filter((b) => b.property_id === deal.property_id && b.active);
    ok = (c) => matches(c, prop, bills);
  }
  const done = state.dealDone.filter((x) => x.deal_id === deal.id);
  const over = state.dealOverrides.filter((o) => o.deal_id === deal.id);
  const isFin = (c) => String(c).startsWith("fin:");   // fin:loan / fin:cash 看这笔交易的付款方式（deal-fin.js）；已经勾过的事项付款方式切换后仍保留
  const tpl = (D().TASKS[deal.kind] || []).filter((x) => (x.when || []).filter((c) => !isFin(c)).every(ok) && ((x.when || []).filter(isFin).every((c) => finMatches(c, deal)) || done.some((d) => d.task_key === x.key))).map((x) => {
    const base = x.base === "contract" ? deal.contract_on : deal.closing_on;
    const plan = base ? addDays(base, x.offset) : null;
    const ov = over.find((o) => o.task_key === x.key) || null;
    const dn = done.find((d) => d.task_key === x.key && (d.status || "done") === "done") || null, sk = done.find((d) => d.task_key === x.key && d.status === "skipped") || null;   // 跳过：这笔交易用不上的步骤
    return finishTask({ ...x, deal, plan, baseline: deal.baseline?.[x.key] || plan, due: ov?.due_on || plan, moved: !!ov?.due_on && ov.due_on !== plan, userNote: ov?.note || null, custom: false }, dn, sk);
  });
  const custom = state.dealCustom.filter((c) => c.deal_id === deal.id).map((c) =>
    finishTask({ key: `c:${c.id}`, name: c.name, priority: c.priority, stage: c.stage, note: c.note, deal, plan: null, baseline: null, due: c.due_on, moved: false, custom: true, rec: c },
      c.done_on ? { done_on: c.done_on, done_by_name: c.done_by_name } : null, c.skipped && !c.done_on ? { by: c.done_by_name || null } : null));
  return [...tpl, ...custom];
}
/** 首页：所有进行中交易里 7 天内到期或已逾期的未完成任务，必须项优先 */
export function dealAlerts() {
  const rank = { must: 0, should: 1, optional: 2 };
  return state.deals.filter((d) => !d.outcome).flatMap(dealTasks)
    .filter((x) => !x.done && !x.skipped && x.daysLeft != null && x.daysLeft <= 7)
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.daysLeft - b.daysLeft);
}
export const dueText = (x) => (x.due == null ? t("填日期后计算") : x.daysLeft < 0 ? t("逾期 {d} 天", { d: -x.daysLeft }) : x.daysLeft === 0 ? t("今天") : t("{d} 天后", { d: x.daysLeft }));
/** 提醒总线：必须项逾期 = 紧急，其余逾期或今天 = 今天级，7 天内 = 尽快 */
export function dealAlertItems() {
  if (!state.houseEnabled) return [];
  return dealAlerts().map((x) => ({
    source: "deal", severity: x.daysLeft < 0 ? (x.priority === "must" ? 0 : 1) : x.daysLeft === 0 ? 1 : 2, must: x.priority === "must",
    due: x.due, daysLeft: x.daysLeft, property_id: x.deal.property_id, title: `${vehPrefix(x.deal)}${t(x.name)}`, detail: `${x.due ? `${fmtDate(x.due)} · ` : ""}${dueText(x)}${x.note ? ` · ${t(x.note)}` : ""}`,
    href: dealHref(x.deal), actions: [{ type: "check", attrs: { "data-deal-task": x.key, "data-deal": x.deal.id } }],
  }));
}
/** 这笔交易详情的页面地址（车辆交易带 ?asset=；一律带 deal=<id>，进行中的也是） */
export function dealHref(deal, sec = null) {
  const ps = new URLSearchParams();
  if (sec) ps.set("sec", sec);
  if (deal?.asset_id) ps.set("asset", deal.asset_id);
  if (deal) ps.set("deal", deal.id);
  const qs = ps.toString();
  return `${href("house", "deal")}${qs ? `?${qs}` : ""}`;
}
/** 首页提醒里车辆交易的事项前面带车名 */
const vehPrefix = (deal) => { if (!deal.asset_id) return ""; const a = state.assetsEnriched.find((x) => x.id === deal.asset_id); return a ? `🚗 ${assetName(a)} · ` : ""; };
/** 已完成事项相对应完成日期：滞后 / 提前 / 按时（没有应完成日期时为空） */
export function lagText(x) {
  if (!x.done || x.lag == null) return "";
  return x.lag > 0 ? t("滞后 {n} 天", { n: x.lag }) : x.lag < 0 ? t("提前 {n} 天", { n: -x.lag }) : t("按时完成");
}
/** 日期对比一行：应完成 / 实际完成 / 滞后；调整过的标出推荐日期。showDue=false 时不重复应完成日期（时间线上日期已在节点标题里） */
export function dateLine(x, { showDue = true } = {}) {
  if (x.skipped) return t("已跳过：这一步不适用于这笔交易");
  const bits = [];
  if (showDue && x.due) bits.push(t("应完成 {d}", { d: fmtDate(x.due) }));
  if (x.done) {
    bits.push(t("实际 {d}", { d: fmtDate(x.done.done_on) }) + (x.done.done_by_name ? ` · ${esc(x.done.done_by_name)}` : ""));
    if (x.lag != null) bits.push(`<b class="${x.lag > 0 ? "lag-late" : "lag-ok"}">${lagText(x)}</b>`);
  } else bits.push(x.due == null ? t(x.custom ? "没设日期" : "填日期后计算") : dueText(x));
  if (x.moved) bits.push(x.plan ? t("已调整，推荐 {d}", { d: fmtDate(x.plan) }) : t("手动设置的日期"));
  if (x.baseline && x.due && x.baseline !== x.due && !(x.moved && x.baseline === x.plan)) bits.push(t("原计划 {d}", { d: fmtDate(x.baseline) }));
  return bits.join(" · ");
}
export const isEditing = (x) => state.dealTaskEdit?.deal === x.deal.id && state.dealTaskEdit.key === x.key;
export const editBtn = (x) => `<button type="button" class="task-edit" data-action="deal-task-edit" data-deal="${x.deal.id}" data-key="${esc(x.key)}" aria-label="${esc(t("调整日期 / 备注：{name}", { name: t(x.name) }))}" title="${esc(t("调整日期 / 备注"))}">✎</button>`;
export const taskNotes = (x) => [x.note && esc(t(x.note)), x.userNote && `${t("备注")}：${esc(x.userNote)}`].filter(Boolean).map((n) => `<br>${n}`).join("");
/** 跳过 / 恢复（已完成的不能跳过）：⊘ 跳过这一步，↩ 恢复 */
export const skipBtn = (x) => (x.done ? "" : `<button type="button" class="task-skip" data-action="deal-task-skip" data-deal="${x.deal.id}" data-key="${esc(x.key)}" data-skip="${x.skipped ? "0" : "1"}" aria-label="${esc(x.skipped ? t("恢复：{name}", { name: t(x.name) }) : t("跳过：{name}", { name: t(x.name) }))}" title="${esc(x.skipped ? t("恢复这一步") : t("跳过这一步（不适用）"))}">${x.skipped ? "↩" : "⊘"}</button>`);
export const customBadge = (x) => (x.custom ? ` <span class="badge" style="background:var(--surface-2)">${t("自定义")}</span>` : "");
/** 交易事项的「问咩咩」：这一步现在该做什么、找谁、要注意什么（事项备注当「为什么」） */
export const dealAsk = (x) => ({ id: `deal-${x.deal.id}-${x.key}`, title: `${t(D().KINDS[x.deal.kind] || x.deal.kind)} · ${t(x.name)}`,
  question: t("「{name}」这一步现在该做什么、找谁、要注意什么？", { name: t(x.name) }), guide: x.note ? { why: x.note } : null,
  context: () => [...askCtx.property(x.deal.property_id), t(D().KINDS[x.deal.kind] || ""), x.deal.contract_on ? t("合同日 {d}", { d: x.deal.contract_on }) : "", x.deal.closing_on ? t("交割日 {d}", { d: x.deal.closing_on }) : ""].filter(Boolean) });
/** 事项行卡片（阶段页）：左边勾选框（点一下标完成），中间标题 + 日期 / 备注，点卡片进事项详情页 */
export function taskCard(x) {
  const id = `deal-${x.deal.id}-${x.key}`;
  return `<div class="task-card ${x.done ? "done" : ""} ${x.skipped ? "skipped" : ""} ${x.overdue ? "overdue" : ""}">
    <label class="tc-check" aria-label="${esc(t("标记完成：{name}", { name: t(x.name) }))}"><input type="checkbox" id="${id}" data-deal-task="${esc(x.key)}" data-deal="${x.deal.id}" ${x.done ? "checked" : ""}></label>
    <a class="tc-body" href="${dealHref(x.deal, `task:${x.key}`)}"><span class="tt"><b>${esc(t(x.name))}</b> <span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span>${customBadge(x)}</span><small>${dateLine(x)}${taskNotes(x)}</small></a>
    <span class="mch" aria-hidden="true">›</span></div>`;
}
/** 清单页 / 阶段页的最后一行卡片：添加自定义事项（进独立页面） */
export const addTaskCard = (deal, stage = "special") => `<a href="${dealHref(deal, "task-new")}${stage && stage !== "special" ? `&stage=${encodeURIComponent(stage)}` : ""}" class="mrow"><span class="mi" aria-hidden="true">➕</span>
  <span class="mt"><b>${t("添加自定义事项")}</b><small>${isVehDeal(deal) ? t("车行 / 租赁公司的特别要求，或自己想记的事；也留作记录") : t("某个 condo / village / HOA 的特别要求，如必须申报 intent to sell；也留作记录")}</small></span><span class="mch" aria-hidden="true">›</span></a>`;
export function taskRow(x, { showProp = false } = {}) {
  const id = `deal-${x.deal.id}-${x.key}`, dAsk = dealAsk(x);
  const prop = showProp ? state.properties.find((p) => p.id === x.deal.property_id) : null;
  const editing = isEditing(x);
  return `<li class="task-row ${x.done ? "done" : ""} ${x.skipped ? "skipped" : ""} ${x.overdue ? "overdue" : ""} ${editing ? "editing" : ""}">
    <input type="checkbox" id="${id}" data-deal-task="${esc(x.key)}" data-deal="${x.deal.id}" ${x.done ? "checked" : ""}>
    <label for="${id}"><span class="tt"><b>${esc(t(x.name))}</b> <span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span>${customBadge(x)}</span>
      <small>${dateLine(x)}${prop ? ` · ${esc(prop.name)}` : ""}${taskNotes(x)}</small></label>
    ${editBtn(x)}${skipBtn(x)}${askButton(dAsk)}
    ${editing ? taskEditForm(x.deal, x) : ""}
    ${askPanel(dAsk)}
  </li>`;
}
/** 调整一条事项：应完成日期、实际完成日期（填了 = 已完成，清空 = 未完成）、备注；自定义事项还能改名称 / 阶段 / 重要程度。x 为 null = 新建自定义事项 */
export function taskEditForm(deal, x, stage = "special", page = null) {   // page = { cancelHref, returnTo }：独立页面里的表单，底部只有「取消 / 保存」
  const custom = !x || x.custom, rec = x?.custom ? x.rec : null;
  const opts = (map, cur) => Object.entries(map).map(([k, n]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(t(n))}</option>`).join("");
  return `<form id="dealTaskForm" class="task-edit-form" novalidate>
    <input type="hidden" name="deal_id" value="${esc(deal.id)}"><input type="hidden" name="key" value="${esc(x?.key || "")}">${page ? `<input type="hidden" name="return_to" value="${esc(page.returnTo)}">` : ""}
    <div class="form-grid">
      ${custom ? `<label class="span-2">${t("事项名称")}<input name="name" required maxlength="120" value="${esc(rec?.name || "")}" placeholder="${esc(t("如：向 HOA 提交 intent to sell 通知"))}"></label>
        <label>${t("所属阶段")}<select name="stage">${opts(D().stagesOf(deal.kind), rec?.stage || stage)}</select></label>
        <label>${t("重要程度")}<select name="priority">${opts(D().PRIORITY, rec?.priority || "should")}</select></label>` : ""}
      <label>${t("应完成日期")}<input name="due_on" type="date" value="${esc(x?.due || "")}">
        ${x && !x.custom ? `<small>${x.plan ? `${t("推荐日期 {d}", { d: fmtDate(x.plan) })} <button type="button" class="link-btn" data-action="deal-due-reset" data-plan="${esc(x.plan)}">${t("恢复推荐")}</button>` : t("填了合同日 / 交割日才有推荐日期")}</small>` : ""}</label>
      <label>${t("实际完成日期")}<input name="done_on" type="date" max="${todayISO()}" value="${esc(x?.done?.done_on || "")}"><small>${t("填了就算已完成，清空 = 未完成")}</small></label>
      <label class="span-2">${t("备注")}<input name="note" maxlength="1000" value="${esc((rec ? rec.note : x?.userNote) ?? "")}" placeholder="${esc(t("延迟原因、对方要求、联系人…"))}"></label>
    </div>
    ${page ? `<div class="form-actions sticky-actions" style="margin-top:10px"><a class="btn btn-ghost" href="${esc(page.cancelHref)}">${t("取消")}</a><button class="btn btn-primary" type="submit">${t("保存")}</button><span class="dirty-note" hidden>● ${t("有未保存的修改")}</span></div>` : ""}
    <div class="form-actions" ${page ? "hidden" : ""} style="margin-top:10px"><button class="btn btn-primary btn-sm" type="submit">${t("保存")}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="deal-task-cancel">${t("取消")}</button>
      ${x && !x.done ? `<button class="btn btn-ghost btn-sm" type="button" data-action="deal-task-skip" data-deal="${esc(deal.id)}" data-key="${esc(x.key)}" data-skip="${x.skipped ? "0" : "1"}">${x.skipped ? t("恢复这一步") : t("跳过这一步（不适用）")}</button>` : ""}
      ${rec ? `<button class="btn btn-ghost btn-sm" type="button" data-action="deal-task-delete" data-id="${esc(rec.id)}">${t("删除这条事项")}</button>` : ""}
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span></div>
  </form>`;
}
/** 新建自定义事项的表单面板（交易枢纽页 / 阶段页顶部） */
export function newTaskPanel(deal) {
  const e = state.dealTaskEdit;
  return e && e.deal === deal.id && e.key === "" ? `<section class="section"><div class="panel">${taskEditForm(deal, null, e.stage)}</div></section>` : "";
}
export const addTaskRow = (deal, stage, row) => row(null, "➕", t("添加自定义事项"), isVehDeal(deal) ? t("车行 / 租赁公司的特别要求，或自己想记的事；也留作记录") : t("某个 condo / village / HOA 的特别要求，如必须申报 intent to sell；也留作记录"), null, "", `data-action="deal-task-new" data-deal="${deal.id}" data-stage="${stage}"`);
