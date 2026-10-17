// 房产表单：设置页和房屋页共用同一个表单（id = propertyForm）、同一个保存逻辑（main.js），两边数据一致
import { state } from "../core/state.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";

/** 房产新建 / 编辑表单；p 为 null 表示新建 */
export function propertyForm(p) {
  const B = window.BILLS;
  return `<form id="propertyForm" class="prop-form">
      <input type="hidden" name="property_id" value="${esc(p?.id || "")}">
      <div class="form-grid">
        <label>${t("名称")}<input name="name" required maxlength="40" placeholder="${t("例如：芝加哥的家 / 出租房 1")}" value="${esc(p?.name || "")}"></label>
        <label>${t("类型")}<select name="kind">${Object.entries(B.PROPERTY_KINDS).map(([k, n]) => `<option value="${k}" ${k === (p?.kind || "other") ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
        <label>${t("用途")}<select name="role">${Object.entries(B.PROPERTY_ROLES).map(([k, n]) => `<option value="${k}" ${k === (p?.role || "owner_occupied") ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
        <label>${t("状态")}<select name="status">${Object.entries(window.DEALS.PROPERTY_STATUS).map(([k, n]) => `<option value="${k}" ${k === (p?.status || "owned") ? "selected" : ""}>${t(n)}</option>`).join("")}</select><small>${t("看房或签约阶段可先建房产；买卖和退租在“房屋 → 交易”里走流程")}</small></label>
        <label>${t("地址（可选）")}<input name="address" maxlength="120" value="${esc(p?.address || "")}"></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${esc(p?.notes || "")}"></label>
      </div>
      <div class="form-actions" style="margin-top:8px"><button class="btn btn-sm btn-primary" type="submit">${t("保存")}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="property-cancel">${t("取消")}</button></div></form>`;
}

/**
 * 房屋页顶部：房产切换条 + “添加房产”；正在新建 / 编辑时在下面内联同一个表单。
 * 设置页的房产列表用的是同一个 state.editProperty，两边打开的是同一个表单。
 */
export function houseBar() {
  const list = state.properties.filter((p) => !p.archived || p.id === state.propertyId);
  const chip = (p) => `<button type="button" class="chip" data-action="property" data-id="${p.id}" aria-pressed="${state.propertyId === p.id}">🏠 ${esc(p.name)}</button>`;
  const adding = state.editProperty === "new";
  const editing = state.editProperty && state.editProperty !== "new" ? state.properties.find((p) => p.id === state.editProperty) : null;
  const bar = `<div class="chips prop-bar" role="group" aria-label="${t("选择房产")}">${list.map(chip).join("")}
    ${adding ? "" : `<button type="button" class="chip chip-add" data-action="property-edit" data-id="">＋ ${t("添加房产")}</button>`}</div>`;
  const form = adding || editing ? `<section class="section"><div class="panel prop-inline">
      <div class="section-head" style="margin-bottom:8px"><h3 style="font-size:16px">${adding ? t("添加房产") : t("编辑房产：{name}", { name: esc(editing.name) })}</h3>
        <p>${t("和设置页里的房产是同一份；归档、设默认、彻底删除在设置页")}</p></div>
      ${propertyForm(editing)}</div></section>` : "";
  return bar + form;
}
