/* 物品表单里的几个独立字段：关联设备、不再提醒、分类猜测。 */
import { numAttrs } from "../core/ui-num.js";
import { MUTE_FOREVER, daysFromTodayISO, esc, spaceOf, todayISO } from "../core/util.js";
import { guessNew } from "../core/sub-guess.js";
import { t } from "../core/i18n.js";
import { assetLabel, linkableAssets } from "./item-form-common.js";

/** 关联设备：多选下拉，只有汽车房屋消耗品显示；选项就是 房屋 → 设备保养 里的设备 */
export function assetField(v) {
  const all = linkableAssets(), picked = new Set(Array.isArray(v.asset_ids) ? v.asset_ids : []);
  return `<div class="span-2 only-house pick-field"><span class="pick-lbl" id="assetLinkLbl">${t("关联设备")}</span>
    ${all.length ? `<select multiple name="asset_ids" aria-label="${esc(t("关联设备"))}" data-empty="${esc(t("不关联设备"))}">
      ${all.map((a) => `<option value="${esc(a.id)}" data-label="${esc(assetLabel(a))}" ${picked.has(a.id) ? "selected" : ""}>${a.t?.icon || "⚙️"} ${esc(assetLabel(a))}</option>`).join("")}
      </select>
      <small class="muted">${t("可多选；设备页的“相关耗材”会列出它。")}</small>`
      : `<p class="muted" style="margin:4px 0 0;font-size:13px">${t("还没有设备。先在 房屋 → 设备保养 里添加，就能在这里关联。")}</p>`}</div>`;
}
/* ── 不再提醒 / 暂停提醒 ── 试过不好吃、暂时用完不想补：标记后不进注意事项和提醒数；下次补货入库自动恢复 */
const muteActive = (v) => !!v.alert_mute_until && String(v.alert_mute_until) > todayISO();
export function muteField(v) {
  const cur = muteActive(v) ? (v.alert_mute_until === MUTE_FOREVER ? "forever" : "keep") : "";
  const opt = (val, label) => `<option value="${val}" ${cur === val ? "selected" : ""}>${label}</option>`;
  return `<label class="span-2 not-gear remind-only">${t("补货提醒")}
    <select name="alert_mute">
      ${opt("", t("正常提醒"))}
      ${cur === "keep" ? opt("keep", t("暂停提醒，到 {d}", { d: esc(v.alert_mute_until) })) : ""}
      ${opt("30", t("暂停 30 天"))}${opt("90", t("暂停 90 天"))}${opt("forever", t("不再提醒"))}
    </select>
    <small>${t("试过不好吃、或暂时用完不想补：选一个，它就不会再出现在注意事项里。临期提醒不受影响。")}</small>
  </label>`;
}
export function muteChoice(val, cur) {
  if (val === "forever") return MUTE_FOREVER;
  if (val === "30" || val === "90") return daysFromTodayISO(+val);
  if (val === "keep") return cur || null;
  return null;
}
/** 新物品：边打名字边按名称猜大类和小类（js/core/sub-guess.js），只在选好的那一类里；自己选过分类就不动 */
export function guessCategory(f, name) {
  if (!f || f.elements.item_id.value || f.dataset.catTouched === "1") return;
  const space = f.elements.space?.value || "pantry", g = guessNew(name, space, spaceOf); if (!g) return;
  const [cat, sub] = g, cs = f.elements.category, ss = f.elements.subcategory;
  if (![...cs.options].some((o) => o.value === cat)) return;
  if (cs.value !== cat) { cs.value = cat; cs.dispatchEvent(new Event("change", { bubbles: true })); }
  if (sub && [...ss.options].some((o) => o.value === sub) && ss.value !== sub) { ss.value = sub; ss.dispatchEvent(new Event("change", { bubbles: true })); }
}

/* ── 采购方式 / 订阅周期 ── 购物车按「采购方式」分组；这里手动改过的物品以后每次都按它分组（留空 = 按分类自动推）。订阅周期：线上定期配送大约每几天一次 */
const BUY_OPTS = [["", "自动（按分类）"], ["online", "线上订阅 / 网购"], ["bulk", "批量采购"], ["fresh", "生鲜即买"], ["other", "其他"]];
export function buyField(v) {
  const cur = v.buy_mode || "", per = v.avg_daily_use > 0 && v.quantity > 0 ? Math.round(v.quantity / v.avg_daily_use) : 0;
  return `<label class="span-2 not-gear">${t("采购方式")}
    <select name="buy_mode">${BUY_OPTS.map(([k, l]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
    <small>${t("购物车按它分组；选了就一直按它，留空 = 按分类自动推。")}</small></label>
  <label class="not-gear">${t("订阅 / 定期配送周期（天，可不填）")}
    <input name="subscribe_every_days" ${numAttrs("int", { max: 365, min: 1 })} value="${v.subscribe_every_days || ""}" placeholder="${per ? esc(String(per)) : ""}">
    ${per ? `<small>${esc(t("按现在的日均用量，当前库存大约 {d} 天用完，可以参考这个设周期。", { d: per }))}</small>` : ""}</label>`;
}
