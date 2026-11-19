/* 保养记录：列表、筛选、分区，和保存一条保养记录。 */
import { $, esc, fmt, fmtDate, fmtShort, num, toast, todayISO } from "../core/util.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { Store } from "../core/store.js";
import { autofillBar } from "../core/autofill.js";
import { fetchPurchase, fillFromPurchase, purchaseById } from "../core/spend-data.js";
import { href } from "../core/router.js";
import { isVehicle } from "./assets-logic.js";
import { joinList, t } from "../core/i18n.js";
import { logsDesc, maintFilterFor, maintMatch } from "./asset-hub.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { state } from "../core/state.js";
import { C, H, V, distUnit } from "./asset-common.js";
import { cardSelectHtml, payAcctValue, purchasePayFields } from "../bills/card-picker.js";
import { storeDatalist } from "../stats/store-lite.js";

   // 由近及远
function maintToolbar(a) {
  const f = maintFilterFor(a), K = H().MAINT_KINDS;
  const years = [...new Set(a.logs.map((l) => String(l.done_on || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  return `<div class="toolbar">
    <input type="search" id="maintSearch" placeholder="${t("搜索记录：项目、收款方、备注")}" value="${esc(f.q)}" aria-label="${t("搜索保养记录")}">
    <select id="maintKind" aria-label="${t("按类型筛选")}">${opt("all", t("全部类型"), f.kind)}${Object.entries(K).map(([k, n]) => opt(k, t(n), f.kind)).join("")}</select>
    ${years.length > 1 ? `<select id="maintYear" aria-label="${t("按年份筛选")}">${opt("all", t("全部年份"), f.year)}${years.map((y) => opt(y, y, f.year)).join("")}</select>` : ""}
    ${clearFiltersBtn("maint", changed(f, FD.maint))}</div>`;
}
/** 记录为主的页面：搜索 + 筛选 + 记录列表（最近的在前，继续加载），右下角 ＋ 进记保养表单 */
function maintListPage(a) {
  const R = C().RESULTS;
  const followUp = a.followUp ? `<div class="panel cta-panel" style="margin-bottom:10px"><div><b>${t("{date} 检查结论：{r}", { date: fmtDate(a.followUp.done_on), r: t(R[a.followUp.result]) })}</b>
      <p class="muted">${t("记一条保养、维修或更换后，这条提醒会消失。")}</p></div></div>` : "";
  const label = t("记保养");
  return `<div class="section-head"><p id="maintCount">${maintCountText(a)}</p></div>
    ${followUp}
    ${a.logs.length ? maintToolbar(a) : ""}
    <div class="panel" id="maintLogs" data-asset="${esc(a.id)}">${maintLogsHtml(a) || maintEmpty(a)}</div>
    <a class="fab" href="${href("asset", a.id)}?log=1" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">＋</span></a>`;
}
const maintEmpty = (a) => (a.logs.length ? `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词或筛选试试。")}</div>`
  : `<div class="empty"><strong>${t("还没有记录")}</strong>${t("点右下角 ＋ 记第一次检查或保养，之后会按周期提醒。")}</div>`);
const maintCountText = (a) => { const n = a.logs.filter((l) => maintMatch(l, maintFilterFor(a))).length; return n === a.logs.length ? t("{n} 条记录", { n }) : t("{m} / {n} 条记录", { m: n, n: a.logs.length }); };
export function maintSection(a, focusLog) {
  if (!focusLog && !state.route?.q?.get("edit") && !state.route?.q?.get("copy")) return maintListPage(a);
  const K = H().MAINT_KINDS, R = C().RESULTS, veh = isVehicle(a);
  const editLog = a.logs.find((l) => l.id === state.route?.q?.get("edit")) || null;   // 编辑某条记录：表单带入原值
  // 复制一条记录：同样的类型、项目、收款方、花费、备注带上；日期回到今天、不连已记的花费
  const copyLog = !editLog && a.logs.find((l) => l.id === state.route?.q?.get("copy"));
  const e = editLog || (copyLog ? { ...copyLog, id: undefined, done_on: undefined, created_at: undefined, purchase_id: null, odometer: null } : {}), isInspect = !veh && e.kind === "inspect";
  const preItem = editLog ? e.service_item || "" : state.route?.q?.get("item") || "";   // 时间表里“记一次”带过来的保养项目
  const rows = maintLogsHtml(a);
  const followUp = a.followUp ? `<div class="panel cta-panel" style="margin-bottom:10px"><div><b>${t("{date} 检查结论：{r}", { date: fmtDate(a.followUp.done_on), r: t(R[a.followUp.result]) })}</b>
      <p class="muted">${t("记一条保养、维修或更换后，这条提醒会消失。")}</p></div></div>` : "";
  return maintSectionHtml(a, focusLog, { K, R, veh, editLog, e, isInspect, preItem, rows, followUp });
}
/** 保养记录列表（分批显示）：「继续加载」只重画这一块，上面没保存的保养表单不会被冲掉 */
function maintLogsHtml(a) {
  const K = H().MAINT_KINDS, R = C().RESULTS, f = maintFilterFor(a), all = logsDesc(a).filter((l) => maintMatch(l, f)), lim = pageLimit(`maint:${a.id}`, JSON.stringify(f));
  return all.length ? `<ul class="restock-list maint-list">${all.slice(0, lim).map((l) => `<li class="maint-row" data-swipe-del="maint">
      <a class="log-hit" href="${href("asset", a.id)}?log=1&edit=${l.id}" aria-label="${t("编辑这条记录")}"></a>
      <span class="badge ${l.kind === "repair" ? "b-low" : l.kind === "replace" ? "b-exp" : l.result && l.result !== "ok" ? "b-out" : "b-ok"}">${t(K[l.kind] || l.kind)}${l.result ? ` · ${t(R[l.result] || l.result)}` : ""}</span>
      <div class="grow"><span class="name">${esc(fmtDate(l.done_on))}${l.service_item ? ` · ${esc(t(V().serviceItem(l.service_item)?.name || l.service_item))}` : ""}</span>
        <small>${joinList([l.odometer != null ? `${fmt(l.odometer)} ${distUnit()}` : null, l.vendor ? t("收款方：{who}", { who: l.vendor }) : null, l.diy ? t("自己做的") : null, l.cost != null ? t("花费 {m}", { m: Units.money(num(l.cost), l.currency || Units.region.currency) }) : null, l.notes,
          l.created_at && t("{d} 记录", { d: fmtShort(l.created_at) })].filter(Boolean).map(esc))}</small></div>
      <a class="btn btn-sm btn-ghost log-copy" href="${href("asset", a.id)}?log=1&copy=${l.id}" aria-label="${t("复制这条记录")}" title="${t("复制这条记录")}">${t("复制")}</a>
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="maint-del" data-id="${l.id}" aria-label="${t("删除这条记录")}">${t("删除")}</button>
    </li>`).join("")}</ul>${pageMoreBtn(`maint:${a.id}`, all.length, lim)}` : "";
}
export function renderMaintLogs() {
  const host = $("#maintLogs"), a = host && state.assetsEnriched.find((x) => x.id === host.dataset.asset); if (!a) return;
  host.innerHTML = maintLogsHtml(a) || maintEmpty(a);
  const n = $("#maintCount"); if (n) n.textContent = maintCountText(a);
}
function maintSectionHtml(a, focusLog, { K, R, veh, editLog, e, isInspect, preItem, rows, followUp }) {
  return `
    <div class="section-head"><p>${veh ? t("按保养项目算下次到期；维修不重置") : t("检查、保养、更换会重算下次保养日期；维修不会")}</p></div>
    ${followUp}
    ${autofillBar("maint", "#maintForm")}
    <form id="maintForm" class="panel ${isInspect ? "is-inspect" : ""}" ${focusLog ? 'data-focus="1"' : ""}>
      ${storeDatalist()}
      <input type="hidden" name="asset_id" value="${esc(a.id)}"><input type="hidden" name="log_id" value="${esc(e.id || "")}">
      ${editLog ? `<p class="hint" style="margin-top:0">${t("正在编辑 {d} 的这条记录", { d: fmtDate(e.done_on) })}</p>` : ""}
      <div class="form-grid maint-grid">
        <label>${t("日期")}<input name="done_on" type="date" required value="${esc(e.done_on || todayISO())}" max="${todayISO()}"></label>
        <label>${t("类型")}<select name="kind">${Object.entries(K).map(([k, n]) => `<option value="${k}" ${k === (e.kind || "service") ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
        ${veh ? `<label>${t("保养项目")}<select name="service_item"><option value="">${t("请选择")}</option>${V().itemsFor(a.type).map((s) => `<option value="${s.key}" ${s.key === preItem ? "selected" : ""}>${esc(t(s.name))}</option>`).join("")}</select><small>${t("保养 / 检查 / 更换必选，这一项的下次日期才会更新；维修可不选")}</small></label>
                <label>${t("里程（{u}）", { u: distUnit() })}<input name="odometer" type="number" inputmode="numeric" min="0" step="1" value="${e.odometer ?? ""}" placeholder="${a.nowMiles != null ? fmt(a.nowMiles) : ""}"><small>${t("填了会同时更新车辆当前里程")}</small></label>`
              : `<label class="inspect-only">${t("检查结论")}<select name="result">${Object.entries(R).map(([k, n]) => `<option value="${k}" ${k === e.result ? "selected" : ""}>${t(n)}</option>`).join("")}</select><small>${t("“需保养 / 维修 / 更换”会提醒到记下一条为止")}</small></label>`}
        <label>${t("花费（{cur}，可不填）", { cur: Units.region.currency })}<input name="cost" type="number" inputmode="decimal" min="0" step="0.01" value="${e.cost ?? ""}"></label>
        <label>${t("收款方")}<input name="vendor" maxlength="40" list="storeList" value="${esc(e.vendor || "")}" placeholder="${t("维修商 / 师傅 / 商店，自己做可不填")}"></label>
        ${(() => { const pur = e.purchase_id ? purchaseById(e.purchase_id) : null; if (e.purchase_id && !pur) fillFromPurchase(e.purchase_id, '#maintForm [name="pay"]', (p) => payAcctValue(p.card_id, p.method)); const sel = cardSelectHtml("pay", pur ? payAcctValue(pur.card_id, pur.method) : undefined); return sel ? `<label>${t("怎么付的")}${sel}</label>` : ""; })()}
        <label class="span-2 check-inline"><input type="checkbox" name="diy" ${e.diy ? "checked" : ""}><span>${t("自己动手")}</span></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${esc(e.notes || "")}" placeholder="${t("换了什么、师傅怎么说…")}"></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${editLog ? t("保存修改") : t("记一笔")}</button>${editLog ? `<a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}?log=1">${t("取消")}</a>` : ""}
        <small class="muted">${veh ? t("填了花费会同时记入“车辆”花费统计。") : t("填了花费会同时记入“房屋维护”花费统计。")}</small></div>
    </form>
    <p style="margin-top:10px"><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}?sec=log">${t("查看全部记录")} ›</a></p>`;
}
/** 记一次保养：有费用先写 purchases（house_maint），再写记录并关联，删除记录时一起删 */
export async function saveMaintForm(f) {
  const fe = f.elements;
  const asset = state.assets.find((x) => x.id === fe.asset_id.value);
  if (!asset) return toast(t("设备不存在"));
  const done_on = fe.done_on.value || todayISO();
  const kind = fe.kind.value, vendor = fe.vendor.value.trim() || null, diy = fe.diy.checked, veh = isVehicle(asset);
  const cost = fe.cost.value === "" ? null : Math.round(Math.max(0, num(fe.cost.value)) * 100) / 100;
  const currency = Units.region.currency;
  const result = !veh && kind === "inspect" && fe.result ? fe.result.value || null : null;
  const service_item = veh && fe.service_item ? fe.service_item.value || null : null;
  // 车辆的保养 / 检查 / 更换必须选项目，否则时间表里那一项永远不会更新（之前的坑：下次日期一直停在购车日期 + 周期）
  if (veh && kind !== "repair" && !service_item) { toast(t("请选保养项目（维修可不选）")); fe.service_item.focus(); return false; }
  const odometer = veh && fe.odometer && fe.odometer.value !== "" ? Math.max(0, Math.round(num(fe.odometer.value))) : null;
  const itemName = service_item ? t(V().serviceItem(service_item)?.name || service_item) : t(H().MAINT_KINDS[kind]);
  const editing = fe.log_id.value ? state.maintLogs.find((x) => x.id === fe.log_id.value) : null;
  let purchase_id = editing?.purchase_id || null;
  const oldPur = purchase_id ? await fetchPurchase(purchase_id).catch(() => null) : null;   // 关联的那笔花费（按 id 读；以前只在近 400 天的内存里找，老记录会被当成没有而另记一笔）
  const spend = { name: `${asset.name} · ${itemName}`, amount: cost, store: vendor, purchased_at: new Date(`${done_on}T12:00:00`).toISOString(), ...(fe.pay ? purchasePayFields(fe.pay.value, oldPur) : {}) };
  if (cost != null && cost > 0) {
    if (oldPur) await Store.updatePurchase(purchase_id, spend);   // 编辑：同步改关联的花费（含怎么付的）
    else purchase_id = await Store.addPurchase({ item_id: null, category: veh ? VEHICLE_CAT.id : MAINT_CAT.id, quantity: null, unit: null, currency, ...spend, ...(!veh && asset.property_id ? { property_id: asset.property_id } : {}) });   // 房屋设备的保养花费关联它所在的房产（迁移 055）
  } else if (purchase_id) { await Store.deletePurchase(purchase_id); purchase_id = null; }   // 编辑时把花费清空：关联的花费一起删
  const fields = { done_on, kind, cost, currency: cost != null ? currency : null, diy, vendor, notes: fe.notes.value.trim() || null, purchase_id, result, service_item, odometer };
  if (editing) await Store.updateMaintLog(editing.id, fields);
  else await Store.addMaintLog({ asset_id: asset.id, ...fields });
  // 车辆：记录里的里程比档案新就更新档案里程
  if (veh && odometer != null && (num(asset.vehicle?.odometer) || 0) <= odometer) {
    await Store.saveAsset({ ...asset, vehicle: { ...(asset.vehicle || {}), odometer, odometer_on: done_on } });
  }
  if (editing) toast(t("已保存修改"));
  else if (result && result !== "ok") toast(t("已记录检查，结论“{r}”，会提醒到记下一条处理为止", { r: t(C().RESULTS[result]) }));
  else toast(kind === "replace" ? t("已记录更换，记得把安装日期改成新设备的日期") : t("已记录{kind}", { kind: itemName }));
  return true;
}
