/* 点击动作：房屋：设备、保养、季节任务、交易、房产、买卖计划。 */
import { $, armed, confirmDelete, toast } from "../../core/util.js";
import { Store } from "../../core/store.js";
import { analyze, cancelDeal, completeBuy, completeVehicleDeal, dealTasks, deleteCustomTask, deleteDealEvent, deleteSeasonTask, leaveAsset, newCreate, newGo, openDeal, planAction, runDealAi, shiftTasksMonth, startDeal, toggleDealSkip, togglePlanCheck, unitRow } from "../lazy-modules.js";
import { canManageHome } from "../../settings/members.js";
import { freeDefault } from "../route.js";
import { friendlyErr } from "../errors.js";
import { go, href } from "../../core/router.js";
import { markDirty } from "../unsaved.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

/** 点击动作（房屋：设备、保养、季节任务、交易、房产、买卖计划）：这一组处理的 data-action */
export const HOUSE_ACTIONS = new Set(["deal-financing","house-new-go","house-new-create","asset-cancel","asset-delete","asset-row-del","maint-del","tasks-prev","tasks-next","tasks-today","season-new","season-edit","season-cancel","season-delete","unit-add","unit-del","property","house-open","property-edit","property-cancel","property-delete","deal-start","deal-delete","deal-cancel","deal-closeout","plan-new","plan-edit","plan-cancel","plan-status","plan-delete","cand-new","cand-edit","cand-delete","cand-win","offer-new","offer-edit","offer-delete","plan-check","plan-open-property","deal-task-skip","deal-task-edit","deal-task-new","deal-task-cancel","deal-due-reset","deal-task-delete","deal-event-new","deal-event-edit","deal-event-cancel","deal-event-delete","deal-ai-run","deal-view","deal-closeout-cancel","property-default","property-archive","house-enable","house-cancel","property-of-bill","deal-filter","tasks-undone"]);
/** 点击动作（房屋：设备、保养、季节任务、交易、房产、买卖计划）：按 data-action 分支；el 是被点的元素，id 是它的 data-id，e 是点击事件 */
export async function clickHouse(action, el, id, e) {
  switch (action) {
      case "house-new-go": return newGo(el);   // 添加房产向导：上一步（先把这一步读进草稿）
      case "house-new-create": return newCreate(el);   // 添加房产向导：确认后才建房产
      case "asset-cancel": return leaveAsset(false);
      case "asset-delete":
        if (!confirmDelete(t("删除这台设备和它的保养记录？"))) return;
        await Store.deleteAsset(state.route.id); toast(t("已删除设备及其保养记录")); return leaveAsset(true);
      case "asset-row-del": {   // 设备列表里右滑删除（先确认；在这里问，取消时手势会把行弹回去）
        const ar = state.assets.find((x) => x.id === id);
        if (!window.confirm(t("删除设备「{name}」和它的保养记录？", { name: ar?.name || "" }))) return;
        await Store.deleteAsset(id); toast(t("已删除设备及其保养记录")); await refresh(); return render(true);
      }
      case "maint-del":
        if (!confirmDelete(t("删除这条保养记录？"))) return;
        await Store.deleteMaintLog(id); toast(t("已删除这条记录")); if (state.route?.q?.get("view")) go(`${href("asset", state.route.id)}?sec=log`, { replace: true }); await refresh(); return render(true);
      case "tasks-prev": shiftTasksMonth(-1); return render();
      case "tasks-next": shiftTasksMonth(1); return render();
      case "tasks-today": state.tasksYM = null; state.seasonForm = null; return render();
      case "season-new": state.seasonForm = { id: null }; render(); $("#seasonForm input[name=name]")?.focus(); return;
      case "season-edit": state.seasonForm = { id: el.dataset.id }; render(); $("#seasonForm input[name=name]")?.focus(); return;
      case "season-cancel": state.seasonForm = null; return render();
      case "season-delete":
        if (!confirmDelete(t("删除这条任务？"))) return;
        await deleteSeasonTask(el.dataset.id); state.seasonForm = null; toast(t("已删除这条任务")); return refresh();
      case "unit-add": { const host = $("#unitRows"); if (host) { host.insertAdjacentHTML("beforeend", unitRow()); host.lastElementChild.querySelector("select")?.focus(); } return; }   // 固定装置：再加一处位置
      case "unit-del": { const row = el.closest(".unit-row"), host = row?.parentElement; if (row && host) { row.remove(); if (!host.children.length) host.insertAdjacentHTML("beforeend", unitRow()); } return; }
      case "property": {   // 切换当前房产：房屋资料、设备、季节任务随之切换
        if (id === state.propertyId) return;
        state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ }
        state.houseDraft = null; return refresh();
      }
      case "house-open": {   // 房产列表 → 这套房产的概览
        if (id !== state.propertyId) { state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ } state.houseDraft = null; }
        go(href("house", "overview")); return refresh();
      }
      case "property-edit": if (!id && !canManageHome()) return toast(t("只有家主可以新增房产")); state.editProperty = id || "new"; return render();
      case "property-cancel": state.editProperty = null; return render();
      case "property-delete": {   // 删除房产（家主）：先弹确认，说清楚哪些记录保留（只是不再关联房产）、哪些随房产一起删
        if (!canManageHome()) return toast(t("只有家主可以删除房产"));
        const p = state.properties.find((x) => x.id === id); if (!p) return;
        if (!(await freeDefault(p))) return;
        if (!window.confirm(t("删除“{name}”？\n\n账单、花费记录和借贷会保留，只是不再关联这套房产（房产 ID 变成空）。\n房屋资料、设备与保养记录、季节任务、交易、估值会跟着房产一起删除，不能恢复。\n\n只是不再持有或租住的话，建议用“归档”：所有数据都保留，可随时恢复。", { name: p.name }))) return;
        await Store.deleteProperty(p.id); toast(t("已删除“{name}”", { name: p.name }));
        await refresh(); if (state.route?.section === "house") go(href("house")); return;
      }
      case "deal-financing": {   // 付款方式（贷款 / 现金）：点一下就存，清单按它重算
        const d = state.deals.find((x) => x.id === el.dataset.deal); if (!d) return;
        await Store.saveDeal({ ...d, financing: el.dataset.val || null }); toast(t("已改付款方式")); return refresh();
      }
      case "deal-start": await startDeal(el.dataset.kind, el.dataset.asset || null); return refresh();
      case "deal-delete": {   // 历史交易行：删除这条交易记录（左滑 / 行内按钮）
        if (!confirmDelete(t("删除这条历史交易？只删除这条交易记录和它的清单、时间线；不会改动房产 / 车辆现在的状态，也不会删除已记入花费的款项。"))) return;
        const id = el.dataset.deal; try { await Store.deleteDeal(id); } catch (err) { return toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
        toast(t("已删除这条历史交易"));
        if (state.route?.q?.get("deal") === id) { const q = new URLSearchParams(state.route.q); q.delete("deal"); q.delete("sec"); go(`${href("house", "deal")}${q.toString() ? `?${q}` : ""}`, { replace: true }); }
        return refresh();
      }
      case "deal-cancel": {   // 取消页上的按钮（data-confirm）一步确认；别处的按钮还是点两次
        if (!el.dataset.confirm && !armed(el, t("再点一次确认取消"))) return;
        const dd = el.dataset.deal ? state.deals.find((x) => x.id === el.dataset.deal) : null;
        await cancelDeal(el.dataset.deal || null);
        if (dd) go(`${href("house", "deal")}?${dd.asset_id ? `asset=${encodeURIComponent(dd.asset_id)}&` : ""}deal=${encodeURIComponent(dd.id)}`, { replace: true });   // 回这笔交易的主页（已取消）
        return refresh();
      }
      case "deal-closeout": {
        const d = el.dataset.deal ? state.deals.find((x) => x.id === el.dataset.deal) : await openDeal();
        if (!d) return;
        const toDeal = () => go(`${href("house", "deal")}?${d.asset_id ? `asset=${encodeURIComponent(d.asset_id)}&` : ""}deal=${encodeURIComponent(d.id)}`, { replace: true });   // 完成后回这笔交易的主页
        if (d.asset_id) { if (!el.dataset.confirm && !armed(el, t("再点一次确认完成"))) return; await completeVehicleDeal(d); toDeal(); return refresh(); }
        if (d.kind === "buy") { if (!el.dataset.confirm && !armed(el, t("再点一次确认已交割"))) return; await completeBuy(d.id); toDeal(); return refresh(); }
        state.closeout = true; state.closeoutDeal = d.id; return go(`${href("house", "deal")}?deal=${encodeURIComponent(d.id)}&sec=closeout`);
      }
      case "plan-new": case "plan-edit": case "plan-cancel": case "plan-status": case "plan-delete": case "cand-new": case "cand-edit": case "cand-delete": case "cand-win": case "offer-new": case "offer-edit": case "offer-delete":
        return planAction(action, el, { render, refresh, go });   // 买卖计划（迁移 078）
      case "plan-check": return togglePlanCheck(el.dataset.kind, el.dataset.stage, Number(el.dataset.idx), el.checked);   // 看房 / 看车清单：只存这台设备
      case "plan-open-property": {   // 买卖计划 → 卖房：先切到这套房产，再进它的交易页
        if (id !== state.propertyId) { state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ } state.houseDraft = null; }
        go(href("house", "deal")); return refresh();
      }
      case "deal-task-skip": await toggleDealSkip(el.dataset.deal, el.dataset.key, el.dataset.skip === "1"); state.dealTaskEdit = null; return refresh();
      case "deal-task-edit": state.dealTaskEdit = { deal: el.dataset.deal, key: el.dataset.key }; render(); $("#dealTaskForm input[name=due_on]")?.focus(); return;
      case "deal-task-new": state.dealTaskEdit = { deal: el.dataset.deal, key: "", stage: el.dataset.stage || "special" }; render(); $("#dealTaskForm input[name=name]")?.focus(); return;
      case "deal-task-cancel": state.dealTaskEdit = null; return render();
      case "deal-due-reset": el.form.elements.due_on.value = el.dataset.plan || ""; return markDirty(el.form, true);   // 只回填输入框，点保存才生效
      case "deal-task-delete":
        if (!confirmDelete(t("删除这条自定义事项？"))) return;
        await deleteCustomTask(el.dataset.id); state.dealTaskEdit = null; toast(t("已删除这条事项")); if (el.dataset.back) go(el.dataset.back, { replace: true }); return refresh();
      case "deal-event-new": state.dealEventEdit = { deal: el.dataset.deal, id: "", key: el.dataset.key || "" }; render(); { const f = $("#dealEventForm"); f?.scrollIntoView({ block: "center" }); f?.elements.title?.focus(); } return;
      case "deal-event-edit": { const ev = state.dealEvents.find((x) => x.id === el.dataset.id); if (!ev) return; state.dealEventEdit = { deal: ev.deal_id, id: ev.id, key: "" }; render(); { const f = $("#dealEventForm"); f?.scrollIntoView({ block: "center" }); f?.elements.title?.focus(); } return; }
      case "deal-event-cancel": state.dealEventEdit = null; return render();
      case "deal-event-delete": if (!confirmDelete(t("删除这条进展记录？"))) return; await deleteDealEvent(el.dataset.id); state.dealEventEdit = null; if (el.dataset.back) go(el.dataset.back, { replace: true }); toast(t("已删除")); return refresh();
      case "deal-ai-run": { const d = state.deals.find((x) => x.id === el.dataset.deal); if (!d) return; const p = runDealAi(d, await analyze(d, await dealTasks(d))); render(); await p; return render(); }
      case "deal-view":
        state.dealView = ["plan", "actual", "compare"].includes(el.dataset.view) ? el.dataset.view : "list";
        try { localStorage.setItem("hmh-deal-view", state.dealView); } catch { /* 忽略 */ }
        return render();
      case "deal-closeout-cancel": state.closeout = null; state.closeoutDeal = null; return go(href("house", "deal"));
      case "property-default": await Store.setDefaultProperty(id); toast(t("已设为默认房产")); return refresh();
      case "property-archive": {
        const p = state.properties.find((x) => x.id === id);
        if (!p) return;
        if (!canManageHome()) return toast(t("只有家主可以归档或恢复房产"));
        if (!p.archived && !el.closest(".act-menu") && !armed(el, t("再点一次确认归档"))) return;
        if (!p.archived && !(await freeDefault(p))) return;
        await Store.saveProperty({ ...p, archived: !p.archived }); toast(p.archived ? t("已恢复房产") : t("已归档，账单和房屋资料都保留；可在房屋首页「已归档的房产」恢复")); await refresh(); if (!p.archived && state.route?.section === "house") go(href("house")); return;
      }
      case "house-enable":
        state.houseEnabled = true; try { localStorage.setItem("hmh-house-off", "0"); } catch { /* 忽略 */ }
        return render();
      case "house-cancel": state.skipAutosave = true; state.houseDraft = null; return;   // 链接本身会跳回分区列表；明确取消就不自动保存
      case "property-of-bill": return;
      case "deal-filter": state.dealFilter = el.dataset.val; return render();
      case "tasks-undone": state.tasksOnlyUndone = !state.tasksOnlyUndone; return render();
  }
}
