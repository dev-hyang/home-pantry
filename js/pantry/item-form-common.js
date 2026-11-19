/* 物品表单各部分共用的小件。 */
import { assetName } from "../house/assets.js";
import { go, href } from "../core/router.js";
import { listRoute, spaceOf } from "../core/util.js";
import { propertyName } from "../bills/logic.js";
import { state } from "../core/state.js";

// 保存、取消、删除后：从应用内进入的就后退一步（恢复来源页），否则回到对应空间的列表
export function leaveItem(changed) {
  if (changed) state.needsRefresh = true;
  state.skipAutosave = true;   // 已保存 / 取消 / 删除：离开时不再自动保存
  if (state.prevRoute) history.back();
  else go(href(...listRoute(spaceOf(state.editingCat || "fresh"))), { replace: true });
}
/** 汽车房屋消耗品可关联的设备：房屋 → 设备保养里的设备（不含车辆）；多套房产时名字后带房产名 */
export const linkableAssets = () => state.assetsEnriched.filter((a) => a.kind !== "vehicle");
export const assetLabel = (a) => `${assetName(a)}${state.properties.length > 1 && a.property_id ? ` · ${propertyName(a.property_id)}` : ""}`;
