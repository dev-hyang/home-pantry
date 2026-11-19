/* 菜单页的同步小件：分类下拉选项、菜谱打分。 */
import { compare, t } from "../core/i18n.js";
import { esc } from "../core/util.js";
import { hasStock } from "../core/logic.js";
import { spendOptions } from "../core/taxonomy.js";
import { state } from "../core/state.js";
import { groupedCats } from "./inventory-match.js";

/* ── 菜单推荐 ── */
export function scoreRecipes() {
  const expiringNames = state.enriched.filter((x) => x.exp === "expiring" && x.qty > 0);
  return RECIPES.filter((r) => r.diets.includes(state.diet)).map((r) => {
    const parts = r.ings.map((kw) => ({ kw, item: hasStock(kw) }));
    const have = parts.filter((p) => p.item).length;
    const usesExpiring = parts.some((p) => p.item && expiringNames.some((e) => e.id === p.item.id));
    return { ...r, parts, have, score: have / r.ings.length + (usesExpiring ? 0.3 : 0), usesExpiring, full: have === r.ings.length };
  }).sort((a, b) => b.score - a.score || compare(t(a.name), t(b.name)));
}
/** 分类下拉选项：储藏、房屋、家居耐用品分组显示。
 *  记花费（spend）的下拉按 一级 · 二级 分类分组，叶子在组里（js/core/taxonomy.js 的 spendOptions；手动记一笔、就地编辑、导入对账单、召回退款共用，不要在别处另列一份） */
export function categoryOptions(selected, { withOther = true, spend = false, only = null } = {}) {
  if (spend) return spendOptions(selected, { withOther });
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`;
  // 空间 · 花费二级（日常消耗品 · 食品杂货）一组；下拉里 optgroup 不能嵌套，所以两级拼在组名里
  const sp = (space, label, extra = "") => groupedCats(space).map((e, i, a) => `<optgroup label="${esc(`${label} · ${t(e.g.name)}`)}">${e.cats.map(opt).join("")}${i === a.length - 1 ? extra : ""}</optgroup>`).join("");
  if (only) return groupedCats(only).map((e) => `<optgroup label="${esc(t(e.g.name))}">${e.cats.map(opt).join("")}</optgroup>`).join("");   // 只列一个空间（物品表单先选了放在哪一类）
  return `${sp("pantry", t("日常消耗品"))}${sp("house", t("汽车房屋消耗品"), withOther ? opt(MAINT_CAT) : "")}${sp("gear", t("家居耐用品"))}
    ${withOther ? opt(OTHER_CAT) : ""}`;
}
