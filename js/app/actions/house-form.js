/* 房屋资料分区表单的保存。 */
import { Store } from "../../core/store.js";
import { go, href } from "../../core/router.js";
import { inSpace, toast } from "../../core/util.js";
import { newStepSubmit, readHouseForm } from "../lazy-modules.js";
import { refresh } from "../data.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

/** 房屋资料分区表单：保存后第一次填房型去推荐耗材，其余回分区列表；silent=true 为离开页面时自动保存（不跳转） */
export async function saveHouseForm(f, { silent = false } = {}) {
  if (f.dataset.newwiz === "1") return newStepSubmit(f);   // 添加房产向导：每步只读进草稿，最后「确认并创建」才入库（house/house-new.js）
  const d = await readHouseForm(f), y = d.year_built, thisYear = new Date().getFullYear();
  if (y != null && (y < 1850 || y > thisYear)) {
    const msg = t("建成年份需要在 1850 到 {y} 之间。", { y: thisYear });
    if (silent) toast(t("没有自动保存：{msg}", { msg })); else f.querySelector("#houseFormError").textContent = msg;
    return false;
  }
  const first = !state.houseProfile;
  await Store.saveHouseProfile(d, state.propertyId);
  const prop = state.properties.find((p) => p.id === state.propertyId);   // 地址存在房产上
  if (prop && (prop.address || "") !== (d.address || "")) await Store.saveProperty({ ...prop, address: d.address || null });
  if (f.elements.prop_kind && prop) await Store.saveProperty({ ...prop, name: f.elements.prop_name.value.trim() || prop.name, address: d.address || null, kind: f.elements.prop_kind.value, role: f.elements.prop_role.value, status: f.elements.prop_status.value || prop.status || "owned" });   // 「地区、房型与用途」里的类型 / 用途 / 状态
  state.houseProfile = { ...d }; state.houseDraft = null;
  if (silent) return true;
  state.skipAutosave = true;
  toast(t("房屋资料已保存"));
  const hasHouseItems = state.items.some(inSpace("house"));
  go(first && f.dataset.sec === "type" && !hasHouseItems ? href("house", "template") : href("house", "profile"));
  refresh();
  return true;
}
