/* 设备表单的联动（改类型）和保存设备。 */
import { Store } from "../core/store.js";
import { dupOnce, normName } from "../core/item-match.js";
import { finishReplace, isRetired } from "./recall.js";
import { go, href } from "../core/router.js";
import { leaveAsset, readUnits, typeOptions } from "./asset-form.js";
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
  const fe = f.elements, err = f.querySelector("#assetFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  if (!name) return fail(t("请填写设备名称。"), fe.name);
  if (!silent) {   // 疑似重复：同一套房产（或车辆）里有同名、没退役的设备——先提醒一次
    const prop = fe.property_id?.value || state.propertyId, hit = (state.assets || []).find((a) => a.id !== fe.asset_id.value && !isRetired(a) && (a.property_id || null) === (prop || null) && normName(a.name) === normName(name));
    if (dupOnce(f, hit?.id)) return fail(t("这套房产已经有「{name}」了。确认是另一台（比如楼上楼下各一台），再点一次保存；也可以在名字里写上位置。", { name: hit.name }), fe.name);
  }
  const numOrNull = (el, { int = false } = {}) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };
  const thisYear = new Date().getFullYear();
  const year = numOrNull(fe.manufacture_year, { int: true });
  if (year != null && (year < 1950 || year > thisYear)) return fail(t("出厂年份需要在 1950 到 {y} 之间。", { y: thisYear }), fe.manufacture_year);
  const tool = fe.kind.value === "tool", veh = fe.kind.value === "vehicle";
  const a = {
    id: fe.asset_id.value || undefined,
    kind: fe.kind.value, type: fe.type.value, name,
    location: null, brand: fe.brand.value.trim() || null, model: fe.model.value.trim() || null, serial: fe.serial.value.trim() || null,
    installed_on: fe.installed_on.value || null, manufacture_year: year,
    warranty_until: fe.warranty_until.value || null, labor_warranty_until: tool ? null : fe.labor_warranty_until.value || null,
    expected_life_years: veh ? 15 : numOrNull(fe.expected_life_years), service_interval_months: veh ? null : numOrNull(fe.service_interval_months, { int: true }),
    purchase_price: numOrNull(fe.purchase_price), replacement_cost_estimate: tool || veh ? null : numOrNull(fe.replacement_cost_estimate),
    owner: tool || veh ? null : fe.owner.value || null, notes: fe.notes.value.trim() || null,
    property_id: veh ? null : (state.assets.find((x) => x.id === fe.asset_id.value)?.property_id || state.propertyId),
    vehicle: null,
    units: veh ? null : readUnits(f),   // 固定装置的位置与数量；设备类型也允许填（比如两台一样的窗机）
  };
  if (veh) {
    const s = (el) => (el.value || "").trim() || null;
    a.vehicle = {
      plate: s(fe.veh_plate), plate_state: s(fe.veh_plate_state), odometer: numOrNull(fe.veh_odometer, { int: true }), odometer_on: fe.veh_odometer_on.value || null,
      annual_miles: numOrNull(fe.veh_annual_miles, { int: true }), registration_due: fe.veh_registration_due.value || null, emissions_due: fe.veh_emissions_due.value || null, lease_end: fe.veh_lease_end.value || null,
      status: fe.veh_status?.value || "owned", loan_end: fe.veh_loan_end?.value || null, disposed_on: fe.veh_disposed_on?.value || null, sale_price: fe.veh_sale_price ? numOrNull(fe.veh_sale_price) : null,
      insurance: { provider: s(fe.veh_ins_provider), policy: s(fe.veh_ins_policy), from: fe.veh_ins_from.value || null, to: fe.veh_ins_to.value || null, coverage: s(fe.veh_ins_coverage), agent: s(fe.veh_ins_agent), phone: s(fe.veh_ins_phone), email: s(fe.veh_ins_email) },
    };
  }
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    a.location = await resolveLocation(fe);
    const savedId = await Store.saveAsset(a);
    if (fe.replaces?.value) await finishReplace(fe.replaces.value, a.id || savedId);   // 召回换新：旧机标成已更换、退役
    if (silent) return true;
    if (f.dataset.wizNew === "1" && (a.id || savedId)) {   // 添加车辆向导第 1 步：车建好了，进第 2 步
      state.skipAutosave = true; state.needsRefresh = true;
      toast(t("已添加 {name}，接着填车牌与里程", { name }));
      go(`${href("asset", a.id || savedId)}?sec=plate&wiz=1`, { replace: true }); return true;
    }
    if (f.dataset.wiz === "1") { state.skipAutosave = true; state.needsRefresh = true; toast(t("已保存")); go(f.dataset.next, { replace: true }); return true; }   // 向导中间步：存完进下一步（最后一步回概览）
    toast(a.id ? t("已保存修改") : t("已添加 {name}", { name }));
    if (fe.from_item?.value && fe.drop_item?.checked) { await Store.deleteItem(fe.from_item.value); state.prevRoute = null; }   // 升级后移除原家居耐用品：别再退回那条已删除的物品页
    leaveAsset(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}
