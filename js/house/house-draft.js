/* 房屋资料表单的草稿：读表单、应急联系人字段。 */
import { currentProp } from "./deals.js";
import { state } from "../core/state.js";
import { H } from "./asset-common.js";

/** 默认地区：设备时区在北美 → 北美模板，否则中国模板 */
export const defaultRegion = () => (Units.region.system === "us" ? "na" : "cn");
/** 编辑中的房屋资料草稿（切换地区、房型时重新渲染表单，草稿保证已填内容不丢）；地址来自房产，保险字段来自资料 */
export function houseDraft() {
  if (!state.houseDraft) {
    const newProp = state.route?.q?.get("newprop") === "1";
    const p = newProp ? null : state.houseProfile, prop = newProp ? null : currentProp();
    if (p) state.houseDraft = { ...p, features: [...(p.features || [])], exterior: [...(p.exterior || [])], flooring: [...(p.flooring || [])] };
    else {
      const region = defaultRegion(), ht = H().HOUSE_TYPES[region][0];
      state.houseDraft = { region, house_type: ht.id, year_built: null, features: [...ht.features], exterior: [], roof: null, flooring: [], insured: false };
    }
    state.houseDraft.address = prop?.address || "";
  }
  return state.houseDraft;
}
/** 把表单当前值读回草稿 */
/** 把表单当前值读回草稿；资料表单按分区分页，只读页面上存在的字段，其余保留草稿里的值 */
export function readHouseForm(form) {
  const d = houseDraft(), fe = form.elements;
  const has = (n) => !!fe[n];
  const str = (n) => (fe[n].value || "").trim() || null;
  const checked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
  const num = (v) => (v === "" ? null : Math.round(Math.max(0, Number(v) || 0) * 100) / 100);
  if (has("region")) d.region = fe.region.value;
  if (has("house_type")) d.house_type = fe.house_type.value;
  if (has("year_built")) { const y = parseInt(fe.year_built.value, 10); d.year_built = Number.isFinite(y) ? y : null; }
  if (form.querySelector('input[name="features"]')) d.features = checked("features");
  if (form.querySelector('input[name="exterior"]')) d.exterior = checked("exterior");
  if (form.querySelector('input[name="flooring"]')) d.flooring = checked("flooring");
  if (has("roof")) d.roof = fe.roof.value || null;
  if (has("address")) d.address = (fe.address.value || "").trim();
  if (has("insured")) {
    d.insured = fe.insured.checked;
    d.insurance_provider = str("insurance_provider"); d.insurance_policy = str("insurance_policy");
    d.insurance_from = fe.insurance_from.value || null; d.insurance_to = fe.insurance_to.value || null;
    d.insurance_coverage = str("insurance_coverage"); d.insurance_premium = num(fe.insurance_premium.value);
    d.insurance_agent = str("insurance_agent"); d.insurance_phone = str("insurance_phone"); d.insurance_email = str("insurance_email");
  }
  if (has("em_water_main")) {
    d.emergency = Object.fromEntries(EMERGENCY_FIELDS.map((f) => [f.id, str(`em_${f.id}`)]));
    if (!Object.values(d.emergency).some(Boolean)) d.emergency = null;
  }
  if (has("hoa_enabled")) {
    const unit = num(fe.hoa_dues_unit.value), parking = num(fe.hoa_dues_parking.value), other = num(fe.hoa_dues_other.value);
    const parts = (unit || 0) + (parking || 0) + (other || 0);   // 月费 = 单元 + 车位 + 其他；都没填就用原来的总额
    d.hoa = { enabled: fe.hoa_enabled.checked, name: str("hoa_name"), mgmt: str("hoa_mgmt"), phone: str("hoa_phone"), email: str("hoa_email"), url: str("hoa_url"),
      dues: parts > 0 ? Math.round(parts * 100) / 100 : num(fe.hoa_dues.value), dues_unit: unit, dues_parking: parking, dues_other: other, dues_other_label: str("hoa_dues_other_label"), dues_period: fe.hoa_dues_period.value || "monthly",
      rent_policy: fe.hoa_rent_policy.value || "unknown", rent_cap_pct: num(fe.hoa_rent_cap.value), rent_min_months: num(fe.hoa_rent_min.value), rent_notes: str("hoa_rent_notes"),
      lawsuit: fe.hoa_lawsuit.checked, lawsuit_note: str("hoa_lawsuit_note"),
      rules: str("hoa_rules"), notes: str("hoa_notes") };
  }
  if (has("own_pin")) {
    const o = { pin: str("own_pin"), parking_type: fe.own_parking_type.value || "", parking_deeded: fe.own_parking_deeded.checked, parking_pin: str("own_parking_pin"), parking_no: str("own_parking_no"),
      storage_type: fe.own_storage_type.value || "", storage_no: str("own_storage_no"), roof_access: fe.own_roof.checked, tax_exemptions: checked("own_tax"), tax_notes: str("own_tax_notes") };
    d.ownership = Object.values(o).some((v) => (Array.isArray(v) ? v.length : v)) ? o : null;
  }
  return d;
}
/** 应急信息字段：标签、占位例子、是否多行 */
export const EMERGENCY_FIELDS = [
  { id: "water_main", icon: "🚰", name: "总水阀位置", ph: "如：地下室前墙，水表旁的红色球阀；顺时针关", wide: true },
  { id: "gas_main",   icon: "🔥", name: "燃气总阀位置与工具", ph: "如：房子东侧气表上，需用活动扳手转 90°；闻到气味先开窗再出门打电话", wide: true },
  { id: "panel",      icon: "⚡", name: "配电箱位置", ph: "如：车库内墙 / 地下室楼梯下；总闸在最上面", wide: true },
  { id: "breakers",   icon: "🔢", name: "回路标签", ph: "一行一个：1 厨房插座、3 洗衣机、5 烘干机……", multi: true },
  { id: "meters",     icon: "📟", name: "水表 / 电表 / 气表位置与账户", ph: "位置、表号、账户号；账单页里有缴费入口", multi: true },
  { id: "sump",       icon: "⛽", name: "排水泵 / 污水泵位置", ph: "如：地下室西北角坑里，备用电池在旁边" },
  { id: "network",    icon: "📶", name: "路由器 / Mesh 节点位置与管理地址", ph: "如：书房主路由 192.168.1.1，二楼走廊、地下室各一个节点；后台密码在密码管理器", multi: true },
  { id: "security",   icon: "📷", name: "安防面板 / 密码存放处", ph: "如：面板在前门旁，主码在密码管理器“家”条目" },
  { id: "notes",      icon: "📝", name: "其他", ph: "如：外墙水龙头的防冻阀在哪、阁楼入口、备用钥匙", multi: true },
];
export const emergencyOf = (d) => d?.emergency || {};
export const emergencyFilled = (d) => EMERGENCY_FIELDS.filter((f) => emergencyOf(d)[f.id]).length;
