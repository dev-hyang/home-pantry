/* 房产生命周期：状态、买入 / 卖出 / 退租交易、清单任务（模板在 data/deals.js）、退出向导、首页提醒 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, daysUntil, esc, fmtDate, money, num, todayISO, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { joinList, t } from "../core/i18n.js";
import { addDays } from "../bills/logic.js";
import { houseBar } from "./property-form.js";

const D = () => window.DEALS;
const B = () => window.BILLS;
const PRIO_CLS = { must: "b-out", should: "b-soon", optional: "" };
// 退出向导里各类账单默认延后多少天结束（水电气网会有最后一期账单）
const END_LAG = { electric: 30, gas: 30, water: 45, internet: 14, mobile: 0, hoa: 0, property_tax: 0, mortgage: 0, rent: 0, insurance_home: 0, insurance_auto: 0 };

export const currentProp = () => state.properties.find((p) => p.id === state.propertyId) || null;
export const openDeal = (pid = state.propertyId) => state.deals.find((d) => d.property_id === pid && !d.outcome) || null;
export const statusText = (p) => t(D().PROPERTY_STATUS[p?.status] || "持有");
/** 房产是否还在“使用中”（提醒只对这些房产生效） */
export const propertyLive = (p) => !!p && !p.archived && !["sold", "moved_out"].includes(p.status);

/** 条件：bill:<分类>（该房产有这类账单）、kind:condo（condo / townhome）、role:landlord、autopay（有自动扣款账单） */
function matches(cond, prop, bills) {
  if (cond === "autopay") return bills.some((b) => b.autopay);
  const [k, v] = cond.split(":");
  if (k === "bill") return bills.some((b) => b.category === v);
  if (k === "kind") return v === "condo" ? ["condo", "townhome"].includes(prop.kind) : prop.kind === v;
  if (k === "role") return prop.role === v;
  return false;
}

/** 交易的清单任务：到期日按合同日 / 交割日 + 偏移；没填基准日期的任务 due 为 null */
export function dealTasks(deal) {
  const prop = state.properties.find((p) => p.id === deal.property_id);
  if (!prop) return [];
  const bills = state.bills.filter((b) => b.property_id === deal.property_id && b.active);
  const done = state.dealDone.filter((x) => x.deal_id === deal.id);
  return (D().TASKS[deal.kind] || []).filter((x) => (x.when || []).every((c) => matches(c, prop, bills))).map((x) => {
    const base = x.base === "contract" ? deal.contract_on : deal.closing_on;
    const due = base ? addDays(base, x.offset) : null;
    const dn = done.find((d) => d.task_key === x.key) || null;
    const daysLeft = due ? daysUntil(due) : null;
    return { ...x, deal, due, daysLeft, done: dn, overdue: !dn && daysLeft != null && daysLeft < 0 };
  });
}

/** 首页：所有进行中交易里 7 天内到期或已逾期的未完成任务，必须项优先 */
export function dealAlerts() {
  const rank = { must: 0, should: 1, optional: 2 };
  return state.deals.filter((d) => !d.outcome).flatMap(dealTasks)
    .filter((x) => !x.done && x.daysLeft != null && x.daysLeft <= 7)
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.daysLeft - b.daysLeft);
}

export const dueText = (x) => (x.due == null ? t("填日期后计算") : x.daysLeft < 0 ? t("逾期 {d} 天", { d: -x.daysLeft }) : x.daysLeft === 0 ? t("今天") : t("{d} 天后", { d: x.daysLeft }));

/** 提醒总线：必须项逾期 = 紧急，其余逾期或今天 = 今天级，7 天内 = 尽快 */
export function dealAlertItems() {
  if (!state.houseEnabled) return [];
  return dealAlerts().map((x) => ({
    source: "deal", severity: x.daysLeft < 0 ? (x.priority === "must" ? 0 : 1) : x.daysLeft === 0 ? 1 : 2, must: x.priority === "must",
    due: x.due, daysLeft: x.daysLeft, property_id: x.deal.property_id, title: t(x.name), detail: `${x.due ? `${fmtDate(x.due)} · ` : ""}${dueText(x)}${x.note ? ` · ${t(x.note)}` : ""}`,
    href: href("house", "deal"), actions: [{ type: "check", attrs: { "data-deal-task": x.key, "data-deal": x.deal.id } }],
  }));
}

export function taskRow(x, { showProp = false } = {}) {
  const id = `deal-${x.deal.id}-${x.key}`;
  const prop = showProp ? state.properties.find((p) => p.id === x.deal.property_id) : null;
  return `<li class="task-row ${x.done ? "done" : ""} ${x.overdue ? "overdue" : ""}">
    <input type="checkbox" id="${id}" data-deal-task="${esc(x.key)}" data-deal="${x.deal.id}" ${x.done ? "checked" : ""}>
    <label for="${id}"><b>${esc(t(x.name))}</b> <span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span>
      <small>${x.done ? t("{date} {who}已完成", { date: fmtDate(x.done.done_on), who: x.done.done_by_name ? `${esc(x.done.done_by_name)} ` : "" })
        : `${x.due ? `${fmtDate(x.due)} · ` : ""}${dueText(x)}${prop ? ` · ${esc(prop.name)}` : ""}`}${x.note ? `<br>${esc(t(x.note))}` : ""}</small></label>
  </li>`;
}

/* ── 交易页 ── */
export function viewDeal() {
  const p = currentProp();
  if (!p) return `<section class="section"><div class="panel empty"><strong>${t("还没有房产")}</strong></div></section>`;
  const deal = openDeal(p.id);
  const history = state.deals.filter((d) => d.property_id === p.id && d.outcome);
  const live = propertyLive(p);
  const statusCard = `<section class="section"><div class="house-card">
      <span class="house-ico" aria-hidden="true">🏠</span>
      <div class="grow"><h2>${esc(p.name)}<span class="badge ${live ? "b-ok" : ""}" style="${live ? "" : "background:var(--surface-2)"}">${statusText(p)}</span></h2>
        <p class="muted">${[t(B().PROPERTY_KINDS[p.kind] || ""), t(B().PROPERTY_ROLES[p.role] || ""), p.acquired_on ? t("{d} 买入", { d: fmtDate(p.acquired_on) }) : null, p.purchase_price ? money(num(p.purchase_price)) : null,
          p.sold_on ? t("{d} 卖出", { d: fmtDate(p.sold_on) }) : null, p.sale_price ? money(num(p.sale_price)) : null].filter(Boolean).map(esc).join(" · ")}</p></div>
    </div></section>`;
  if (!deal) {
    const starts = [
      !["sold", "moved_out", "selling"].includes(p.status) && p.role !== "tenant" && ["looking", "buying"].includes(p.status) ? ["buy", t("开始买入流程")] : null,
      ["owned", "selling"].includes(p.status) && p.role !== "tenant" ? ["sell", t("开始卖出流程")] : null,
      p.role === "tenant" && p.status === "renting" ? ["move_out", t("开始退租流程")] : null,
      p.status === "owned" && p.role !== "tenant" ? ["buy", t("记录买入流程（刚签约）")] : null,
    ].filter(Boolean);
    return `${houseBar()}${statusCard}
      <section class="section"><div class="panel empty"><strong>${t("这套房产没有进行中的交易")}</strong>
        ${t("买入或卖出时，按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、贷款承诺、停服务通知、交割后事项，逐项提醒。")}
        <p>${starts.map(([k, l]) => `<button type="button" class="btn btn-primary" data-action="deal-start" data-kind="${k}">${l}</button>`).join(" ")}
           ${!live ? `<span class="muted">${t("已卖出或退租的房产只保留历史。")}</span>` : ""}</p></div></section>
      ${dealHistory(history)}`;
  }
  const tasks = dealTasks(deal);
  const groups = Object.entries(D().STAGES).map(([k, n]) => ({ k, n, rows: tasks.filter((x) => x.stage === k) })).filter((g) => g.rows.length);
  const undone = tasks.filter((x) => !x.done), mustLeft = undone.filter((x) => x.priority === "must").length;
  const K = D().KINDS;
  return `${houseBar()}${statusCard}
    <section class="section">
      <div class="section-head"><h2>${t("{kind}进行中", { kind: t(K[deal.kind]) })}</h2><p>${t("还有 {n} 项未完成，其中 {m} 项必须", { n: undone.length, m: mustLeft })}</p></div>
      ${dealForm(deal)}
    </section>
    <section class="section">
      <div class="section-head"><h2>${t("清单")}</h2><p>${t("截止日按合同日和交割日推算；必须项逾期会在首页置顶")}</p></div>
      ${groups.map((g) => `<div class="cat-group" style="--cat:var(--pine)"><h3>${t(g.n)}<span class="muted">（${t("已完成 {a} / {b}", { a: g.rows.filter((x) => x.done).length, b: g.rows.length })}）</span></h3>
        <div class="panel"><ul class="task-list">${g.rows.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).map((x) => taskRow(x)).join("")}</ul></div></div>`).join("")}
      <p class="disclaimer">${t("清单按伊利诺伊州（芝加哥）常见流程整理，日期和税费以合同、律师和产权公司为准；其他州请按本地流程增删。")}</p>
    </section>
    <section class="section">
      <div class="section-head"><h2>${deal.kind === "buy" ? t("完成交割") : t("交割与退出")}</h2></div>
      ${state.closeout ? closeoutPanel(p, deal) : `<div class="panel"><div class="kv"><div class="muted">${deal.kind === "buy" ? t("交割完成后，把房产状态改为“持有”，记下买入日期和价格。") : t("交割完成后：账单设结束日期、生成取消自动扣款清单、房产归档保留历史。")}</div>
        <div class="head-acts"><button type="button" class="btn btn-primary btn-sm" data-action="deal-closeout">${deal.kind === "buy" ? t("已交割，标为持有") : t("开始退出向导")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="deal-cancel">${t("取消这笔交易")}</button></div></div></div>`}
    </section>
    ${dealHistory(history)}`;
}

function dealForm(d) {
  const v = (k) => esc(d[k] ?? "");
  return `<form id="dealForm" class="panel" novalidate>
    <input type="hidden" name="deal_id" value="${esc(d.id)}">
    <div class="form-grid">
      <label>${t("合同日")}<input name="contract_on" type="date" value="${v("contract_on")}"><small>${t("签约日期；律师审查、定金等按它推算")}</small></label>
      <label>${t("交割日")}<input name="closing_on" type="date" value="${v("closing_on")}"><small>${t("停服务、保险、交割后事项按它推算")}</small></label>
      <label>${t("律师审查截止")}<input name="review_deadline" type="date" value="${v("review_deadline")}"></label>
      <label>${t("贷款条款截止")}<input name="financing_deadline" type="date" value="${v("financing_deadline")}"></label>
      <label>${t("成交价")}<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${v("price")}"></label>
      <label>${t("定金")}<input name="earnest_money" type="number" inputmode="decimal" min="0" step="0.01" value="${v("earnest_money")}"></label>
      <label>${t("律师")}<input name="attorney" maxlength="120" placeholder="${t("姓名 · 电话 / 邮箱")}" value="${v("attorney")}"></label>
      <label>${t("贷款行 / 贷款经纪")}<input name="lender" maxlength="120" value="${v("lender")}"></label>
      <label>${t("经纪人")}<input name="agent" maxlength="120" value="${v("agent")}"></label>
      <label>${t("产权公司")}<input name="title_company" maxlength="120" value="${v("title_company")}"></label>
      <label>${t("验房师")}<input name="inspector" maxlength="120" value="${v("inspector")}"></label>
      <label class="span-2">${t("备注")}<input name="notes" maxlength="1000" value="${v("notes")}"></label>
    </div>
    <div class="form-actions sticky-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${t("保存交易信息")}</button>
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span>
      <small class="muted">${t("切换标签页或家人改动时不会丢，但要点保存才写入")}</small></div>
  </form>`;
}

function dealHistory(list) {
  if (!list.length) return "";
  const K = D().KINDS;
  return `<section class="section"><div class="section-head"><h2>${t("历史交易")}</h2></div><div class="panel"><ul class="restock-list">${list.map((d) => `<li>
    <span class="badge" style="background:var(--surface-2)">${t(K[d.kind])}</span>
    <div class="grow"><span class="name">${d.closing_on ? fmtDate(d.closing_on) : fmtDate((d.closed_at || d.updated_at || "").slice(0, 10))}</span>
      <small>${[d.outcome === "cancelled" ? t("已取消") : t("已交割"), d.price ? money(num(d.price)) : null, d.attorney, d.agent].filter(Boolean).map(esc).join(" · ")}</small></div></li>`).join("")}</ul></div></section>`;
}

/** 退出向导（卖出 / 退租）：交割日、成交价、每条账单的结束日期 */
function closeoutPanel(p, deal) {
  const closing = deal.closing_on || todayISO();
  const bills = state.bills.filter((b) => b.property_id === p.id && b.active);
  return `<form id="closeoutForm" class="panel" novalidate>
    <div class="form-grid">
      <label>${deal.kind === "move_out" ? t("退租日") : t("交割日")}<input name="closing_on" type="date" required value="${esc(closing)}"></label>
      ${deal.kind === "sell" ? `<label>${t("成交价")}<input name="sale_price" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(deal.price ?? "")}"></label>` : ""}
    </div>
    <h3 style="font-size:15px;margin:14px 0 6px">${t("这套房产的账单（{n} 条）", { n: bills.length })}</h3>
    <p class="muted" style="font-size:13px;margin:0 0 8px">${t("结束日期之后不再提醒；水电气网默认多留 2–6 周等最后一期账单。自动扣款的请在清单里按“取消自动扣款”任务逐条去取消。")}</p>
    ${bills.length ? `<ul class="bill-list">${bills.map((b) => `<li class="bill-row">
        <div class="grow"><b>${esc(b.name)}</b>${b.autopay ? ` <span class="badge b-soon">${t("自动扣款")}</span>` : ""}<small>${esc(b.payee || "")}</small></div>
        <label>${t("结束于")}<input name="end_${b.id}" type="date" value="${esc(addDays(closing, END_LAG[b.category] ?? 0))}"></label></li>`).join("")}</ul>` : `<p class="muted">${t("没有挂在这套房产的账单。")}</p>`}
    <label class="check-inline" style="margin-top:10px"><input type="checkbox" name="archive" checked><span>${t("归档房产（从切换条隐藏，资料和记录保留只读）")}</span></label>
    <p class="muted" style="font-size:12px">${t("不会删除任何数据。以后在设置里可以恢复，或在归档后彻底删除。")}</p>
    <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${deal.kind === "move_out" ? t("确认退租") : t("确认已卖出")}</button>
      <button class="btn btn-ghost" type="button" data-action="deal-closeout-cancel">${t("取消")}</button></div>
  </form>`;
}

/* ── 动作 ── */
export async function startDeal(kind) {
  const p = currentProp();
  if (!p || openDeal(p.id)) return;
  await Store.saveDeal({ property_id: p.id, kind, contract_on: null, review_deadline: null, financing_deadline: null, closing_on: null, price: null, earnest_money: null,
    attorney: null, lender: null, agent: null, title_company: null, inspector: null, notes: null, outcome: null, closed_at: null });
  const status = kind === "buy" ? "buying" : kind === "sell" ? "selling" : p.status;
  if (status !== p.status) await Store.saveProperty({ ...p, status });
  toast(t("已开始{kind}流程，先填合同日和交割日", { kind: t(D().KINDS[kind]) }));
}

export async function saveDealForm(f) {
  const fe = f.elements, d = state.deals.find((x) => x.id === fe.deal_id.value);
  if (!d) return;
  const v = (k) => fe[k].value || null, n = (k) => (fe[k].value === "" ? null : Math.round(num(fe[k].value) * 100) / 100);
  const patch = { ...d, contract_on: v("contract_on"), closing_on: v("closing_on"), review_deadline: v("review_deadline"), financing_deadline: v("financing_deadline"),
    price: n("price"), earnest_money: n("earnest_money"), attorney: fe.attorney.value.trim() || null, lender: fe.lender.value.trim() || null, agent: fe.agent.value.trim() || null,
    title_company: fe.title_company.value.trim() || null, inspector: fe.inspector.value.trim() || null, notes: fe.notes.value.trim() || null };
  // 合同日填了、审查截止没填：按 5 个工作日估一个
  if (patch.contract_on && !patch.review_deadline) patch.review_deadline = addBusinessDays(patch.contract_on, 5);
  await Store.saveDeal(patch);
  toast(t("交易信息已保存"));
}
function addBusinessDays(iso, n) {
  let d = iso, left = n;
  while (left > 0) { d = addDays(d, 1); const wd = new Date(`${d}T12:00:00`).getDay(); if (wd !== 0 && wd !== 6) left--; }
  return d;
}

export async function toggleDealTask(input) {
  input.disabled = true;
  await Store.setDealDone(input.dataset.deal, input.dataset.dealTask, input.checked, state.displayName);
}

export async function cancelDeal() {
  const p = currentProp(), d = openDeal(p?.id);
  if (!d) return;
  await Store.saveDeal({ ...d, outcome: "cancelled", closed_at: new Date().toISOString() });
  const back = d.kind === "buy" ? (p.acquired_on ? "owned" : "looking") : d.kind === "sell" ? "owned" : "renting";
  await Store.saveProperty({ ...p, status: back });
  toast(t("交易已取消"));
}

/** 买入交割：状态改持有，记买入日期和价格 */
export async function completeBuy() {
  const p = currentProp(), d = openDeal(p?.id);
  if (!d) return;
  await Store.saveDeal({ ...d, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveProperty({ ...p, status: "owned", acquired_on: d.closing_on || todayISO(), purchase_price: d.price ?? p.purchase_price ?? null });
  toast(t("已标为持有，可以建房屋资料、设备和账单了"));
}

/** 卖出 / 退租交割：账单写结束日期、房产状态与归档、交易关闭 */
export async function applyCloseout(f) {
  const p = currentProp(), d = openDeal(p?.id);
  if (!d) return;
  const fe = f.elements, closing = fe.closing_on.value || todayISO();
  const entries = state.bills.filter((b) => b.property_id === p.id && b.active).map((b) => ({ id: b.id, ends_on: fe[`end_${b.id}`]?.value || closing }));
  await Store.endBills(entries);
  await Store.saveDeal({ ...d, closing_on: closing, price: d.kind === "sell" ? (fe.sale_price?.value === "" ? d.price : Math.round(num(fe.sale_price.value) * 100) / 100) : d.price, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveProperty({ ...p, status: d.kind === "sell" ? "sold" : "moved_out", sold_on: closing, sale_price: d.kind === "sell" && fe.sale_price?.value !== "" ? Math.round(num(fe.sale_price.value) * 100) / 100 : p.sale_price ?? null,
    archived: fe.archive.checked, is_default: fe.archive.checked ? false : p.is_default });
  state.closeout = null;
  const autopays = state.bills.filter((b) => b.property_id === p.id && b.active && b.autopay).map((b) => b.name);
  toast(autopays.length ? t("已记录。记得去取消自动扣款：{list}", { list: joinList(autopays) }) : t("已记录，相关账单到结束日期后不再提醒"));
}
