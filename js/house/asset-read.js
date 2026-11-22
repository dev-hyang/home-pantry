/* 读设备 / 车辆表单 → 要保存的对象（不校验、不入库）：保存（asset-save.js）和添加车辆向导的确认页（veh-wizard.js）共用。 */
import { num } from "../core/util.js";
import { state } from "../core/state.js";

export function readUnits(f) {
  const rows = [...f.querySelectorAll(".unit-row")].map((r) => ({ loc: r.querySelector("[name=unit_loc]")?.value || "", qty: Math.max(0, Math.round(num(r.querySelector("[name=unit_qty]")?.value, 1))), note: (r.querySelector("[name=unit_note]")?.value || "").trim().slice(0, 60) }))
    .filter((u) => u.loc || u.note || u.qty > 1);
  return rows.length ? rows : null;
}

const numOrNull = (el, { int = false } = {}) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };

/** 位置：只读下拉当前值（选了「＋ 新位置…」要等保存时才建，resolveLocation） */
export function readAsset(f) {
  const fe = f.elements, name = fe.name.value.trim(), year = numOrNull(fe.manufacture_year, { int: true });
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
  a.location = fe.location?.value && fe.location.value !== "__new__" ? fe.location.value : (fe.new_location?.value || "").trim() || null;
  return a;
}
