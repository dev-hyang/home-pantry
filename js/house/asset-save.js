/* 设备表单的联动（改类型）和保存设备。 */
import { Store } from "../core/store.js";
import { dupOnce, normName } from "../core/item-match.js";
import { finishReplace, isRetired } from "./recall.js";
import { go, href } from "../core/router.js";
import { leaveAsset, typeOptions } from "./asset-form.js";
import { readAsset } from "./asset-read.js";
import { vwIntercept } from "./veh-wizard.js";
import { num, toast } from "../core/util.js";
import { resolveLocation } from "../core/locations.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { H, OWNER_OPTS } from "./asset-common.js";

/** 表单联动：切换类型时带入默认值（只对新设备）；切换种类时隐藏设备专用字段并换类型列表 */
export function onAssetFormChange(e) {
  const f = e.target.form, fe = f.elements, isNew = !fe.asset_id.value;
  if (e.target.name === "kind") {
    const toVeh = e.target.value === "vehicle", wasVeh = f.classList.contains("is-vehicle");
    if (isNew && toVeh !== wasVeh) {   // 车辆有自己的区块，整页按新种类重画
      const first = H().ASSET_TYPES.find((x) => x.kind === e.target.value);
      go(`${href("asset", "new")}?type=${first.id}`, { replace: true }); return;
    }
    f.classList.toggle("is-tool", e.target.value === "tool");
    const cur = fe.type.value;
    fe.type.innerHTML = typeOptions(cur, e.target.value);
    const first = H().ASSET_TYPES.find((x) => x.kind === e.target.value && (!state.houseProfile || x.region === "both" || x.region === state.houseProfile.region));
    if (H().assetType(cur)?.kind !== e.target.value && first) { fe.type.value = first.id; applyType(fe, first, isNew); }
    f.classList.toggle("is-fixture", !!H().assetType(fe.type.value)?.fixture);
  }
  if (e.target.name === "type") {
    const at = H().assetType(e.target.value);
    if (!at) return;
    if (at.kind !== fe.kind.value) { f.querySelector(`input[name="kind"][value="${at.kind}"]`).checked = true; f.classList.toggle("is-tool", at.kind === "tool"); }
    f.classList.toggle("is-fixture", !!at.fixture);
    applyType(fe, at, isNew);
  }
}
/** 保养记录表单：检查类型才显示“检查结论” */
export function onMaintFormChange(e) {
  const f = e.target.form; if (!f || e.target.name !== "kind") return;
  f.classList.toggle("is-inspect", e.target.value === "inspect");
}
function applyType(fe, at, isNew) {
  if (!isNew) return;
  const prev = fe.name.dataset.auto, name = t(at.name);
  if (!fe.name.value.trim() || fe.name.value === prev) { fe.name.value = name; fe.name.dataset.auto = name; }
  fe.expected_life_years.value = at.life ?? "";
  fe.service_interval_months.value = at.interval ?? "";
  const ht = state.houseProfile ? H().typeOf(state.houseProfile.region, state.houseProfile.house_type) : null;
  fe.owner.value = (at.system && ht?.owners?.[at.system] && OWNER_OPTS.includes(ht.owners[at.system])) ? ht.owners[at.system] : "self";
}
/** silent=true：离开页面时自动保存（不跳转；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveAssetForm(f, { silent = false } = {}) {
  if (!silent && vwIntercept(f)) return false;   // 添加车辆向导：回车 = 下一步；确认页先复查每一步
  const fe = f.elements, err = f.querySelector("#assetFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  if (!name) return fail(t("请填写设备名称。"), fe.name);
  if (!silent) {   // 疑似重复：同一套房产（或车辆）里有同名、没退役的设备——先提醒一次
    const prop = fe.property_id?.value || state.propertyId, hit = (state.assets || []).find((a) => a.id !== fe.asset_id.value && !isRetired(a) && (a.property_id || null) === (prop || null) && normName(a.name) === normName(name));
    if (dupOnce(f, hit?.id)) return fail(t("这套房产已经有「{name}」了。确认是另一台（比如楼上楼下各一台），再点一次保存；也可以在名字里写上位置。", { name: hit.name }), fe.name);
  }
  const thisYear = new Date().getFullYear();
  const a = readAsset(f), year = a.manufacture_year;
  if (year != null && (year < 1950 || year > thisYear)) return fail(t("出厂年份需要在 1950 到 {y} 之间。", { y: thisYear }), fe.manufacture_year);
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    a.location = await resolveLocation(fe);
    const savedId = await Store.saveAsset(a);
    if (fe.replaces?.value) await finishReplace(fe.replaces.value, a.id || savedId);   // 召回换新：旧机标成已更换、退役
    if (silent) return true;
    if (f.hasAttribute("data-vwz") && (a.id || savedId)) { state.skipAutosave = true; state.needsRefresh = true; toast(t("已添加 {name}", { name })); go(href("asset", a.id || savedId), { replace: true }); return true; }   // 添加车辆向导确认后：进新车的页面
    toast(a.id ? t("已保存修改") : t("已添加 {name}", { name }));
    if (fe.from_item?.value && fe.drop_item?.checked) { await Store.deleteItem(fe.from_item.value); state.prevRoute = null; }   // 升级后移除原家居耐用品：别再退回那条已删除的物品页
    leaveAsset(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}
