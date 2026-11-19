/* 房屋资料分区表单的保存。 */
import { Store } from "../../core/store.js";
import { canManageHome } from "../../settings/members.js";
import { go, href } from "../../core/router.js";
import { inSpace, toast } from "../../core/util.js";
import { readHouseForm } from "../lazy-modules.js";
import { refresh } from "../data.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

/** 房屋资料分区表单：保存后第一次填房型去推荐耗材，其余回分区列表；silent=true 为离开页面时自动保存（不跳转） */
export async function saveHouseForm(f, { silent = false } = {}) {
  const d = await readHouseForm(f), y = d.year_built, thisYear = new Date().getFullYear();
  if (f.dataset.new === "1") {   // 添加房产向导第 1 步：建房产 + 存地区 / 房型，再进第 2 步（地址与建成年份）
    if (!canManageHome()) return toast(t("只有家主可以新增房产"));
    const name = f.elements.prop_name.value.trim();
    if (!name) { f.querySelector("#houseFormError").textContent = t("请填写房产名称。"); f.elements.prop_name.focus(); return false; }
    const saved = await Store.saveProperty({ name, kind: f.elements.prop_kind.value, role: f.elements.prop_role.value, status: f.elements.prop_status.value || "owned", address: null });
    state.propertyId = saved.id; try { localStorage.setItem("hmh-property", saved.id); } catch { /* 忽略 */ }
    await Store.saveHouseProfile(d, saved.id);
    state.houseDraft = null; state.skipAutosave = true;
    toast(t("房产已添加，接着填地址与建成年份"));
    go(`${href("house", "profile")}?sec=address&wiz=1`, { replace: true }); await refresh(); return true;
  }
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
  if (f.dataset.wiz === "1") { toast(t("已保存")); go(f.dataset.next || href("house", "overview")); refresh(); return true; }   // 添加房产向导：存完进下一步
  toast(t("房屋资料已保存"));
  const hasHouseItems = state.items.some(inSpace("house"));
  go(first && f.dataset.sec === "type" && !hasHouseItems ? href("house", "template") : href("house", "profile"));
  refresh();
  return true;
}
