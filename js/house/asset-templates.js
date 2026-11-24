/* 按房屋资料一键生成设备。 */
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { H } from "./asset-common.js";

/* ── 按房屋资料生成设备 ── */
export function viewAssetTemplate() {
  const p = state.houseProfile;
  if (!p) return `<div class="panel empty"><strong>${t("先填写房屋资料")}</strong>${t("设备清单会根据房型和设施生成。")}<p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></p></div>`;
  const recs = H().recommendAssets(p);
  const haveTypes = new Set(state.assets.filter((a) => a.property_id === state.propertyId).map((a) => a.type));
  const groups = [
    { kind: "equipment", k: H().ASSET_KINDS.equipment, rows: recs.filter((r) => r.kind === "equipment" && !r.fixture && !r.portable) },
    { kind: "portable", k: H().PORTABLE_GROUP, rows: recs.filter((r) => r.kind === "equipment" && r.portable) },
    { kind: "fixture", k: H().FIXTURE_GROUP, rows: recs.filter((r) => r.kind === "equipment" && r.fixture) },
    { kind: "tool", k: H().ASSET_KINDS.tool, rows: recs.filter((r) => r.kind === "tool") },
  ].filter((g) => g.rows.length);
  const fresh = recs.filter((r) => !haveTypes.has(r.id)).length;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("按房屋资料生成设备")}</h2><p>${t("共 {n} 项", { n: recs.length })}${fresh < recs.length ? t("，其中 {n} 项已有档案", { n: recs.length - fresh }) : ""}</p></div>
      <form id="assetTemplateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${t("生成后再到每台设备里补品牌、型号、安装年份和保修；寿命和周期是常见经验值，可改。")}</span>
        </div>
        ${groups.map(({ k, rows }) => `<fieldset class="tpl-group" style="--cat:#5c6b63">
          <legend>${k.icon} ${t(k.name)}</legend>
          ${k.hint ? `<p class="hint" style="margin:0 0 6px">${esc(t(k.hint))} ${t("默认不勾：有需要（想记位置、常坏、要提醒检查）再勾。")}</p>` : ""}
          ${rows.map((r) => {
            const exists = haveTypes.has(r.id);
            const o = H().OWNERS[r.owner];
            return `<label class="ui-row tpl-row ${exists ? "is-have" : ""}">
              <input type="checkbox" name="tpl" value="${esc(r.id)}" ${exists ? "disabled" : r.optional ? "" : "checked"}>
              <span class="grow"><b>${r.icon} ${esc(t(r.name))}</b><small>${r.life ? t("常见寿命约 {n} 年", { n: r.life }) : t("寿命不固定")}${r.interval ? t("，建议每 {n} 个月保养", { n: r.interval }) : ""}${o ? t("，通常由{who}负责", { who: t(o.name) }) : ""}</small>
                ${r.tip ? `<small class="note">${esc(t(r.tip))}</small>` : ""}</span>
              ${exists ? `<span class="badge b-ok">${t("已有")}</span>` : ""}
            </label>`;
          }).join("")}
        </fieldset>`).join("")}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary" ${fresh ? "" : "disabled"}>${t("生成选中的设备")}</button>
          <a class="btn btn-ghost" href="${href("house", "assets")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}
/** 勾选的模板 → 设备行（名称和备注按当前语言写入） */
export function assetTemplateItems(ids) {
  return H().recommendAssets(state.houseProfile).filter((r) => ids.includes(r.id)).map((r) => ({
    kind: r.kind, type: r.id, name: t(r.name), location: null, brand: null, model: null, serial: null,
    installed_on: null, manufacture_year: null, warranty_until: null, labor_warranty_until: null,
    expected_life_years: r.life, service_interval_months: r.interval, purchase_price: null, replacement_cost_estimate: null,
    owner: r.kind === "equipment" ? r.owner : null, notes: r.tip ? t(r.tip) : null,
  }));
}
