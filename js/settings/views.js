import { state } from "../core/state.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { propertyForm } from "../house/property-form.js";
export { isOwner } from "./settings-common.js";
export { customTerms } from "./settings-names.js";
export { SETTING_SECTIONS, saveAiForm } from "./settings-menu.js";
export { hydrateModelSelect, limitHint, modelNotices, modelOptionsHtml, onModelPick, viewSettings } from "./settings-models.js";

/** 房产列表：改名、设默认、归档；编辑中的那行换成内联表单（表单与房屋页共用 property-form.js） */
function propertiesPanel() {
  const B = window.BILLS;
  const form = propertyForm;
  const del = (p) => `<form id="propertyDeleteForm" class="prop-form" style="width:100%">
      <input type="hidden" name="property_id" value="${esc(p.id)}">
      <p class="muted" style="font-size:13px;margin:0 0 6px">${t("彻底删除“{name}”会连同它的账单与缴费记录、设备与保养记录、季节任务、房屋资料、交易一起删除，不能恢复。花费统计里的记录会保留。输入房产名确认：", { name: esc(p.name) })}</p>
      <div class="member-rename"><input name="confirm_name" required maxlength="40" placeholder="${esc(p.name)}" aria-label="${t("输入房产名确认")}">
        <button class="btn btn-sm btn-danger-ghost" type="submit">${t("确认彻底删除")}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="property-delete-cancel">${t("取消")}</button></div></form>`;
  const rows = state.properties.map((p) => state.editProperty === p.id ? `<li>${form(p)}</li>` : state.deleteProperty === p.id ? `<li>${del(p)}</li>` : `<li class="${p.archived ? "inactive" : ""}">
      <div class="grow"><b>${esc(p.name)}</b>${p.is_default ? ` <span class="badge b-ok">${t("默认")}</span>` : ""} <span class="badge" style="background:var(--surface-2)">${t(window.DEALS.PROPERTY_STATUS[p.status] || "持有")}</span>${p.archived ? ` <span class="badge" style="background:var(--surface-2)">${t("已归档")}</span>` : ""}
        <small>${[t(B.PROPERTY_KINDS[p.kind] || ""), t(B.PROPERTY_ROLES[p.role] || ""), p.address].filter(Boolean).map(esc).join(" · ")}</small></div>
      <span class="head-acts">
        <button type="button" class="btn btn-sm btn-ghost" data-action="property-edit" data-id="${p.id}">${t("编辑")}</button>
        ${!p.is_default && !p.archived ? `<button type="button" class="btn btn-sm btn-ghost" data-action="property-default" data-id="${p.id}">${t("设为默认")}</button>` : ""}
        ${!p.is_default ? `<button type="button" class="btn btn-sm ${p.archived ? "" : "btn-danger-ghost"}" data-action="property-archive" data-id="${p.id}">${p.archived ? t("恢复") : t("归档")}</button>` : ""}
      </span></li>`).join("");
  return `<div class="panel">
    <div class="kv"><div><b>${t("房产")}</b><div class="muted">${t("房屋资料、设备、季节任务和账单都按房产区分；房东可以加出租房")}</div></div>
      ${state.editProperty === "new" ? "" : `<button type="button" class="btn btn-sm" data-action="property-edit" data-id="">${t("添加房产")}</button>`}</div>
    <ul class="property-list" style="margin-top:10px">${rows}${state.editProperty === "new" ? `<li>${form(null)}</li>` : ""}</ul>
  </div>`;
}
