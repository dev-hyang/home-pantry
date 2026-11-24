/* 交易的操作：开始 / 取消 / 完成交易、勾选任务、自定义任务、交割后的处理。 */
import { statusAfterBuyClosed, statusAfterCancel, statusAfterStart } from "./deal-status.js";
import { D, V, currentProp, dealTasks, isVehDeal, openDeal, openDealOfKind, openDeals } from "./deal-tasks.js";
import { Store } from "../core/store.js";
import { addDays } from "../bills/logic.js";
import { freezeBaseline } from "./deal-progress.js";
import { joinList, t } from "../core/i18n.js";
import { num, toast, todayISO } from "../core/util.js";
import { payOffForAsset } from "../bills/debt-logic.js";
import { state } from "../core/state.js";
import { myName } from "../settings/family-lite.js";

/* ── 动作 ── */
const EMPTY_DEAL = { contract_on: null, review_deadline: null, financing_deadline: null, closing_on: null, price: null, earnest_money: null,
  attorney: null, lender: null, agent: null, title_company: null, inspector: null, notes: null, outcome: null, closed_at: null };
/** 开始一笔交易：房产（当前房产）或车辆（assetId） */
export async function startDeal(kind, assetId = null) {
  if (D().isVehicleKind(kind) && !assetId) return;   // 车辆流程必须挂在一辆车上
  if (assetId) {   // 刚建的占位车可能还没进 state，只看有没有进行中的交易
    if (openDealOfKind(kind, { aid: assetId })) return;   // 同一类型只能一笔（买车 / 卖车 / 归还各一笔可以同时有）
    await Store.saveDeal({ ...EMPTY_DEAL, property_id: null, asset_id: assetId, kind });
    const [c, z] = D().DATE_LABELS[kind];
    toast(t("已开始{kind}流程，先填{a}和{b}", { kind: t(D().KINDS[kind]), a: t(c), b: t(z) }));
    return;
  }
  const p = currentProp();
  if (!p || openDealOfKind(kind, { pid: p.id })) return;   // 同一类型只能一笔；买入和卖出可以同时进行（卖出进行中补录买入）
  await Store.saveDeal({ ...EMPTY_DEAL, property_id: p.id, asset_id: null, kind });
  const status = statusAfterStart(p, kind);   // 卖出优先：有卖出在进行，状态就是「卖出中」（deal-status.js）
  if (status !== p.status) await Store.saveProperty({ ...p, status });
  toast(t("已开始{kind}流程，先填合同日和交割日", { kind: t(D().KINDS[kind]) }));
}
/** 车辆交易一键完成：买车 → 持有 / 贷款中并写入购车日期、价格；卖车 → 已卖出；归还 → 已归还（车从列表和提醒退出，档案保留） */
export async function completeVehicleDeal(deal) {
  const a = state.assets.find((x) => x.id === deal.asset_id);
  if (!a || deal.outcome) return;
  const day = deal.closing_on || todayISO();
  const v = { ...(a.vehicle || {}) };
  const patch = { ...a };
  if (deal.kind === "veh_buy") {
    v.status = deal.lender ? "financed" : "owned";
    patch.installed_on = a.installed_on || day;
    if (deal.price != null && a.purchase_price == null) patch.purchase_price = deal.price;
  } else {
    v.status = deal.kind === "veh_sell" ? "sold" : "returned";
    v.disposed_on = day;
    if (deal.price != null) v.sale_price = deal.price;
  }
  await Store.saveDeal({ ...deal, closing_on: day, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveAsset({ ...patch, vehicle: v });
  if (deal.kind === "veh_sell") await payOffForAsset({ asset_id: a.id, on: day }).catch(() => 0);   // 卖车款还清车贷
  toast(deal.kind === "veh_buy" ? t("已标为{st}，去车辆档案补车牌、里程和保险", { st: t(V().STATUS[v.status].name) }) : t("已标为{st}，档案和保养记录保留在“历史车辆”里", { st: t(V().STATUS[v.status].name) }));
}
export async function saveDealForm(f) {
  const fe = f.elements, d = state.deals.find((x) => x.id === fe.deal_id.value);
  if (!d) return;
  // 车辆表单只有一部分字段：没出现的保持原值
  const v = (k) => (fe[k] ? fe[k].value || null : d[k] ?? null), n = (k) => (!fe[k] ? d[k] ?? null : fe[k].value === "" ? null : Math.round(num(fe[k].value) * 100) / 100);
  const s_ = (k) => (fe[k] ? fe[k].value.trim() || null : d[k] ?? null);
  const patch = { ...d, contract_on: v("contract_on"), closing_on: v("closing_on"), review_deadline: v("review_deadline"), financing_deadline: v("financing_deadline"),
    price: n("price"), earnest_money: n("earnest_money"), attorney: s_("attorney"), lender: s_("lender"), agent: s_("agent"),
    title_company: s_("title_company"), inspector: s_("inspector"), notes: s_("notes") };
  // 房产：合同日填了、审查截止没填，按 5 个工作日估一个
  if (!isVehDeal(d) && patch.contract_on && !patch.review_deadline) patch.review_deadline = addBusinessDays(patch.contract_on, 5);
  await Store.saveDeal(patch);
  try { await freezeBaseline(patch, dealTasks(patch)); } catch { /* 基线补不上不影响保存 */ }   // 填了合同日：冻结模板日期当作计划
  toast(t("交易信息已保存"));
}
function addBusinessDays(iso, n) {
  let d = iso, left = n;
  while (left > 0) { d = addDays(d, 1); const wd = new Date(`${d}T12:00:00`).getDay(); if (wd !== 0 && wd !== 6) left--; }
  return d;
}
export async function toggleDealTask(input) {
  input.disabled = true;
  const key = input.dataset.dealTask;
  if (key.startsWith("c:")) {   // 自定义事项：完成状态存在它自己那一行
    const c = state.dealCustom.find((x) => x.id === key.slice(2));
    if (c) await Store.saveDealCustom({ ...c, done_on: input.checked ? todayISO() : null, done_by_name: input.checked ? myName() : null, skipped: false });
    return;
  }
  await Store.setDealDone(input.dataset.deal, key, input.checked, myName());
}
/** 跳过 / 恢复一个事项：这笔交易用不上的步骤（不算完成，也不算延误，不再提醒） */
export async function toggleDealSkip(dealId, key, skip) {
  if (key.startsWith("c:")) {
    const c = state.dealCustom.find((x) => x.id === key.slice(2));
    if (c) await Store.saveDealCustom({ ...c, skipped: !!skip, done_on: null, done_by_name: skip ? myName() : null });
  } else await Store.setDealSkip(dealId, key, !!skip, myName());
  toast(skip ? t("已跳过这一步") : t("已恢复这一步"));
}
/** 保存“调整事项”表单：模板任务存应完成日期调整 + 备注 + 实际完成日期；自定义事项（新建 / 修改）整行保存 */
export async function saveDealTaskForm(f) {
  const fe = f.elements, deal = state.deals.find((d) => d.id === fe.deal_id.value);
  if (!deal) return;
  const key = fe.key.value, due = fe.due_on.value || null, doneOn = fe.done_on.value || null, note = fe.note.value.trim() || null;
  if (!key || key.startsWith("c:")) {
    const name = fe.name.value.trim();
    if (!name) throw new Error(t("请填事项名称"));
    const cur = key ? state.dealCustom.find((c) => c.id === key.slice(2)) : null;
    await Store.saveDealCustom({ id: cur?.id, deal_id: deal.id, name, stage: fe.stage.value, priority: fe.priority.value, due_on: due, note, done_on: doneOn,
      done_by_name: doneOn ? (cur?.done_on ? cur.done_by_name : myName()) : null });
    toast(cur ? t("已保存") : t("已添加自定义事项"));
    return;
  }
  const task = dealTasks(deal).find((x) => x.key === key);
  if (!task) return;
  await Store.saveDealOverride(deal.id, key, due && due !== task.plan ? due : null, note);   // 和推荐日期一样 = 不留调整
  if (doneOn) await Store.setDealDone(deal.id, key, true, myName(), doneOn);
  else if (task.done) await Store.setDealDone(deal.id, key, false, myName());
  toast(t("已保存"));
}
export const deleteCustomTask = (id) => Store.deleteDealCustom(id);
export async function cancelDeal(dealId) {
  const d = dealId ? state.deals.find((x) => x.id === dealId) : openDeal(currentProp()?.id);
  if (!d || d.outcome) return;
  await Store.saveDeal({ ...d, outcome: "cancelled", closed_at: new Date().toISOString() });
  if (!d.asset_id) {
    const p = state.properties.find((x) => x.id === d.property_id);
    if (p) await Store.saveProperty({ ...p, status: statusAfterCancel(p, d.kind, openDeals(p.id).filter((x) => x.id !== d.id).map((x) => x.kind)) });
  }
  toast(t("交易已取消"));
}
/** 买入交割：状态改持有（卖出还在进行就仍是「卖出中」），记买入日期和价格；dealId = 哪一笔买入（没给就取进行中的买入） */
export async function completeBuy(dealId = null) {
  const p = currentProp(), d = dealId ? state.deals.find((x) => x.id === dealId) : openDealOfKind("buy", { pid: p?.id });
  if (!d || d.outcome) return;
  const sellOpen = !!openDealOfKind("sell", { pid: p.id });
  await Store.saveDeal({ ...d, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveProperty({ ...p, status: statusAfterBuyClosed(sellOpen), acquired_on: d.closing_on || todayISO(), purchase_price: d.price ?? p.purchase_price ?? null });
  toast(t("已标为持有，可以建房屋资料、设备和账单了"));
}
/** 卖出 / 退租交割：账单写结束日期、房产状态与归档、交易关闭 */
export async function applyCloseout(f) {
  const p = currentProp(), fid = f.elements.deal_id?.value || state.closeoutDeal, d = (fid && state.deals.find((x) => x.id === fid && !x.outcome)) || openDeal(p?.id);   // 交割向导对应哪一笔：点进来时记下的那笔（同时有买入和卖出时不会弄混）
  if (!d) return;
  const fe = f.elements, closing = fe.closing_on.value || todayISO();
  const entries = state.bills.filter((b) => b.property_id === p.id && b.active).map((b) => ({ id: b.id, ends_on: fe[`end_${b.id}`]?.value || closing }));
  await Store.endBills(entries);
  await Store.saveDeal({ ...d, closing_on: closing, price: d.kind === "sell" ? (fe.sale_price?.value === "" ? d.price : Math.round(num(fe.sale_price.value) * 100) / 100) : d.price, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveProperty({ ...p, status: d.kind === "sell" ? "sold" : "moved_out", sold_on: closing, sale_price: d.kind === "sell" && fe.sale_price?.value !== "" ? Math.round(num(fe.sale_price.value) * 100) / 100 : p.sale_price ?? null,
    archived: fe.archive.checked, is_default: fe.archive.checked ? false : p.is_default });
  state.closeout = null; state.closeoutDeal = null;
  const paidOff = d.kind === "sell" ? await payOffForAsset({ property_id: p.id, on: closing }).catch(() => 0) : 0;   // 卖房：房贷 / HELOC 标为已还清
  if (paidOff) toast(t("{n} 笔房贷已标为还清", { n: paidOff }));
  const autopays = state.bills.filter((b) => b.property_id === p.id && b.active && b.autopay).map((b) => b.name);
  toast(autopays.length ? t("已记录。记得去取消自动扣款：{list}", { list: joinList(autopays) }) : t("已记录，相关账单到结束日期后不再提醒"));
}
