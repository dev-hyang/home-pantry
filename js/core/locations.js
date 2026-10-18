/* 存放位置：内置按房间分组（data.js 的 LOCATION_GROUPS）+ 家庭自定义（custom_locations 表，演示模式存本机）。
 * 自定义行：{ id, name, grp, replaces, sort }；replaces = 被它重命名的内置位置名（内置项隐藏，删掉这行就恢复）。
 * 物品 / 设备的 location 字段存的是位置名字符串，重命名时把用到的物品、设备一起改名。 */
import { esc, toast } from "./util.js";
import { t } from "./i18n.js";
import { Store } from "./store.js";

export const CUSTOM_GROUP = { id: "custom", name: "自定义" };
let custom = [];
export const customLocations = () => custom;

/** 加载数据后调用：合并自定义位置，重算平铺列表 window.LOCATIONS */
export function applyCustomLocations(rows) {
  custom = (rows || []).map((r) => ({ ...r }));
  window.LOCATIONS = locationGroups().flatMap((g) => g.locs.map((l) => l.name));
}

/** 分组列表（内置被重命名的隐藏，自定义并入所选组，没选组的进“自定义”）；每项 { name, custom, id?, replaces? } */
export function locationGroups() {
  const replaced = new Set(custom.map((c) => c.replaces).filter(Boolean));
  const groups = window.LOCATION_GROUPS.map((g) => ({ id: g.id, name: g.name, locs: g.locs.filter((l) => !replaced.has(l)).map((name) => ({ name, custom: false })) }));
  for (const c of [...custom].sort((a, b) => (a.sort || 0) - (b.sort || 0))) {
    let g = groups.find((x) => x.id === c.grp);
    if (!g) { g = groups.find((x) => x.id === "custom"); if (!g) { g = { ...CUSTOM_GROUP, locs: [] }; groups.push(g); } }
    g.locs.push({ name: c.name, custom: true, id: c.id, replaces: c.replaces || null });
  }
  return groups.filter((g) => g.locs.length);
}
export const groupOf = (name) => locationGroups().find((g) => g.locs.some((l) => l.name === name)) || null;

/** 表单下拉：按组 optgroup；旧数据里已不存在的位置名照样显示；末尾“＋ 新位置…”（选中后旁边出现输入框） */
export function locationOptions(selected, { addNew = true } = {}) {
  let found = !selected;
  const opts = locationGroups().map((g) => `<optgroup label="${esc(t(g.name))}">${g.locs.map((l) => { if (l.name === selected) found = true; return `<option value="${esc(l.name)}" ${l.name === selected ? "selected" : ""}>${esc(t(l.name))}</option>`; }).join("")}</optgroup>`).join("");
  const legacy = found ? "" : `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
  return `<option value="">${t("未指定")}</option>${legacy}${opts}${addNew ? `<option value="__new__">${t("＋ 新位置…")}</option>` : ""}`;
}
/** 位置字段：下拉 + 新位置输入框（选“＋ 新位置…”时显示） */
export function locationField(selected, label = t("存放位置")) {
  return `<label>${label}
    <select name="location">${locationOptions(selected)}</select>
    <input name="new_location" maxlength="20" autocomplete="off" placeholder="${t("新位置名，例如：Emma 的房间")}" hidden style="margin-top:6px">
  </label>`;
}
/** 保存表单时取位置：选了“＋ 新位置…”就先建一个自定义位置再返回它的名字；没填名字返回 "" */
export async function resolveLocation(fe) {
  if (fe.location.value !== "__new__") return fe.location.value || null;
  const name = (fe.new_location?.value || "").trim();
  if (!name) return null;
  if (!window.LOCATIONS.includes(name)) { await Store.saveLocation({ name, grp: "custom", replaces: null, sort: custom.length }); applyCustomLocations(await Store.listLocations()); }
  return name;
}

/** 多少物品 / 设备放在这个位置 */
export const locationUsage = (state, name) => state.items.filter((x) => x.location === name).length + state.assets.filter((x) => x.location === name).length;

/** 新建 / 重命名：form = { id?, name, grp, replaces?, oldName? }。重命名内置项 = 建一条带 replaces 的自定义行；用到旧名字的物品、设备一起改 */
export async function saveLocationForm(state, form, name, grp) {
  if (!name) return toast(t("请填位置名"));
  if (name !== form.oldName && window.LOCATIONS.includes(name)) return toast(t("已有同名位置"));
  const old = form.oldName || null;
  if (form.id) await Store.saveLocation({ id: form.id, name, grp, replaces: form.replaces || null, sort: form.sort || 0 });
  else await Store.saveLocation({ name, grp, replaces: form.replaces || null, sort: custom.length });
  if (old && old !== name) await Store.renameLocation(old, name);
  toast(old && old !== name ? t("已改名：{a} → {b}", { a: t(old), b: name }) : t("已添加位置 {name}", { name }));
}
export async function deleteLocation(state, c) {
  if (locationUsage(state, c.name)) return toast(t("还有物品或设备放在这里，先把它们挪走"));
  await Store.deleteLocation(c.id);
  toast(c.replaces ? t("已删除，恢复为“{name}”", { name: t(c.replaces) }) : t("已删除位置"));
}
