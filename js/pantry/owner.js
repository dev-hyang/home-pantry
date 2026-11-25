/* 汽车房屋消耗品「属于」哪套房产 / 哪辆车（迁移 071：items.property_id / owner_asset_id）。
 * 值的写法："" = 全家共用，"p:<房产 id>"，"a:<车辆 id>"。只有汽车房屋消耗品用；日常消耗品和家居耐用品永远是空。 */
import { esc, spaceOf } from "../core/util.js";
import { t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { activeProperties } from "../core/lifecycle.js";
import { activeVehicles, assetName } from "../house/assets-logic.js";

export const ownerKey = (it) => (it?.property_id ? `p:${it.property_id}` : it?.owner_asset_id ? `a:${it.owner_asset_id}` : "");
/** 有多套房产、或有车，才需要区分；只有一套房产又没有车时，标签和筛选都不显示 */
export const showOwner = () => activeProperties().length > 1 || activeVehicles().length > 0;
export const ownerName = (key) => {
  if (key.startsWith("p:")) return state.properties.find((p) => p.id === key.slice(2))?.name || "";
  if (key.startsWith("a:")) { const a = (state.assets || []).find((x) => x.id === key.slice(2)); return a ? assetName(a) : ""; }
  return "";
};
export const ownerIcon = (key) => (key.startsWith("a:") ? "🚗" : "🏠");
/** 行上的小标签文字：属于谁（全家共用不显示） */
export const ownerTag = (it) => { if (!showOwner() || spaceOf(it.category) !== "house") return ""; const k = ownerKey(it), n = k && ownerName(k); return n ? `${ownerIcon(k)} ${n}` : ""; };
/** 筛选：all 全部；shared 全家共用；p: / a: 指定的房产 / 车辆。scope = true 时（某套房产自己的消耗品页）指定的 + 全家共用 */
export function ownerMatch(it, owner, scope = false) {
  if (!owner || owner === "all" || spaceOf(it.category) !== "house") return true;
  const k = ownerKey(it);
  if (owner === "shared") return !k;
  return k === owner || (scope && !k);
}
const options = () => [...activeProperties().map((p) => ["p:" + p.id, `🏠 ${p.name}`]), ...activeVehicles().map((a) => ["a:" + a.id, `🚗 ${assetName(a)}`])];
/** 物品表单里的「属于」下拉（只有汽车房屋消耗品显示，随分类显示 / 隐藏） */
export function ownerField(v, preset = "") {
  if (!showOwner()) return `<input type="hidden" name="owner" value="${esc(ownerKey(v) || preset)}">`;
  const cur = ownerKey(v) || preset;
  return `<label class="span-2 only-house">${t("属于")}<select name="owner" data-nosearch>
    <option value="">${t("全家共用")}</option>${options().map(([val, l]) => `<option value="${esc(val)}" ${cur === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
    <small class="muted">${t("多套房产或车辆时，用它区分这件消耗品是哪一处的。")}</small></label>`;
}
/** 库存筛选条里的「属于」下拉 */
export function ownerFilter(f) {
  if (!showOwner()) return "";
  const o = f.owner || "all";
  return `<select id="invOwner" data-nosearch aria-label="${esc(t("按属于筛选"))}"><option value="all">${t("全部归属")}</option><option value="shared" ${o === "shared" ? "selected" : ""}>${t("全家共用")}</option>
    ${options().map(([val, l]) => `<option value="${esc(val)}" ${o === val ? "selected" : ""}>${esc(l)}${o === val && f.ownerScope ? ` + ${esc(t("全家共用"))}` : ""}</option>`).join("")}</select>`;   // 从某套房产 / 车辆的消耗品页进来：它自己的 + 全家共用
}
