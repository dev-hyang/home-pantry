import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { houseHooks } from "./hooks.js";
import { registerAlerts } from "../core/alerts.js";
import { PROFILE_SECTIONS, insuranceAlertItems } from "./house-sections.js";
import { hoaAlertItems } from "./house-fees.js";

export const H = () => window.HOUSE;
export { PARKING_TYPES, RENT_POLICIES, STORAGE_TYPES, TAX_EXEMPTIONS, assessmentStatus, hoaAlertItems, hoaMonthly, hoaOf, hoaRegular, hoaTotalHtml, insurancePremium, linkedBill, newBillHref, noteArea, ownershipOf, updateHoaTotal } from "./house-fees.js";
export { EMERGENCY_FIELDS, defaultRegion, houseDraft, readHouseForm } from "./house-draft.js";
export { PROFILE_SECTIONS, applyTypeDefaults, insuranceAlertItems, insuranceFact, insuranceRows, insuranceStatus, sectionStatus } from "./house-sections.js";
export { viewHouse, viewHouseSupplies } from "./house-overview.js";
export { viewHouseProfile } from "./house-profile.js";
export { newCreate, newGo, newStepSubmit } from "./house-new.js";
/* ── 推荐耗材（按模板批量添加） ── */
export function viewHouseTemplate() {
  const p = state.houseProfile;
  if (!p) return `<div class="panel empty"><strong>${t("先填写房屋资料")}</strong>${t("推荐清单会根据房型、设施和材料生成。")}<p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></p></div>`;
  const recs = H().recommendSupplies(p);
  const have = new Set(state.items.map((i) => i.name.trim()));
  const exists = (r) => have.has(r.name) || have.has(t(r.name));
  const groups = H().HOUSE_CATEGORIES.map((c) => ({ c, rows: recs.filter((r) => r.category === c.id) })).filter((g) => g.rows.length);
  const fresh = recs.filter((r) => !exists(r)).length;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("推荐的汽车房屋消耗品")}</h2><p>${t("根据你的房屋资料，共 {n} 项", { n: recs.length })}${fresh < recs.length ? t("，其中 {n} 项已经有了", { n: recs.length - fresh }) : ""}</p></div>
      <form id="templateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${t("加入后可以随时修改数量、少货线，或删除。")}</span>
        </div>
        ${groups.map(({ c, rows }) => `<fieldset class="tpl-group" style="--cat:${c.color}">
          <legend>${c.icon} ${t(c.name)}</legend>
          ${rows.map((r) => {
            const has = exists(r);
            const key = `${r.category}|${r.name}`;
            return `<label class="ui-row tpl-row ${has ? "is-have" : ""}">
              <input type="checkbox" name="tpl" value="${esc(key)}" ${has ? "disabled" : "checked"}>
              <span class="grow"><b>${esc(t(r.name))}</b>
                <small>${t("先备 {q} {u}", { q: r.qty, u: esc(t(r.unit)) })}${r.min ? t("，少于 {q} {u} 提醒", { q: r.min, u: esc(t(r.unit)) }) : ""}${r.every ? t("，约每 {d} 天用 1 {u}", { d: r.every, u: esc(t(r.unit)) }) : ""}</small>
                ${r.note ? `<small class="note">${esc(t(r.note))}</small>` : ""}</span>
              ${has ? `<span class="badge b-ok">${t("已有")}</span>` : ""}
            </label>`;
          }).join("")}
        </fieldset>`).join("")}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary" ${fresh ? "" : "disabled"}>${t("添加选中的耗材")}</button>
          <a class="btn btn-ghost" href="${href("house", "overview")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}
/** 把勾选的模板项转换成库存物品（名称、小类、单位、备注按当前语言写入，之后作为用户数据不再翻译） */
export function templateItems(keys) {
  const p = state.houseProfile, recs = H().recommendSupplies(p);
  return recs.filter((r) => keys.includes(`${r.category}|${r.name}`)).map((r) => ({
    name: t(r.name), category: r.category, subcategory: r.sub || null, unit: t(r.unit), quantity: r.qty, min_quantity: r.min || 0,
    location: r.loc || null, expiry_date: null, lead_days: 14, avg_daily_use: r.avg_daily_use, notes: r.note ? t(r.note) : null,
  }));
}
houseHooks.PROFILE_SECTIONS = PROFILE_SECTIONS;
   // 给 menu.js 的面包屑用

registerAlerts(hoaAlertItems);
 registerAlerts(insuranceAlertItems);
