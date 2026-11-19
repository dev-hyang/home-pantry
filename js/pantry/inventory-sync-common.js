/* 库存页的同步小件：分类表单、移动分类。 */
import { L1S, l2List } from "../core/taxonomy.js";
import { catsOf, esc } from "../core/util.js";
import { t } from "../core/i18n.js";

   // force-phone：桌面上预览手机布局
export const ORDER_KEY = (space) => `hmh-cat-order:${space}`;
function loadOrder(space) { try { return JSON.parse(localStorage.getItem(ORDER_KEY(space)) || "[]"); } catch { return []; } }
/** 该空间的分类，按用户自定义顺序（没调过的按默认顺序排在后面） */
export function orderedCats(space) {
  const order = loadOrder(space), cats = catsOf(space);
  const idx = (c) => { const i = order.indexOf(c.id); return i < 0 ? 1000 + cats.indexOf(c) : i; };
  return [...cats].sort((a, b) => idx(a) - idx(b));
}
/** 自建分类在花费统计里挂在哪个二级分类下（js/core/taxonomy.js）；空 = 按空间默认（储藏 → 食品杂货，家居耐用品 → 家居家电，汽车房屋消耗品 → 维护与服务） */
export function parentSelect(cf) {
  const def = { pantry: "食品杂货", gear: "家居家电", house: "维护与服务" }[cf.space] || "其他";
  const groups = L1S.filter((l1) => l1.id !== "transfer").map((l1) => `<optgroup label="${esc(t(l1.name))}">${l2List(l1.id).map((n) => `<option value="${n.id}" ${cf.parent === n.id ? "selected" : ""}>${n.icon} ${esc(t(n.name))}</option>`).join("")}</optgroup>`).join("");
  return `<label>${t("花费统计里算作")}<select name="parent" data-nosearch><option value="">${esc(t("按默认（{d}）", { d: t(def) }))}</option>${groups}</select><small>${t("记花费、看分类统计时，这个分类归到哪一组")}</small></label>`;
}
