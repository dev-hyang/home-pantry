/* 库存的分组与筛选匹配（同步小件，别处要立刻用到结果）。 */
import { l2Of } from "../core/taxonomy.js";
import { orderedCats } from "./inventory-sync-common.js";
import { ownerMatch } from "./owner.js";
import { t } from "../core/i18n.js";
import { addedActive, addedMatch } from "./stocked.js";

/** 按花费的二级分类分组显示（食品杂货 / 日用个护 / 家居家电…，js/core/taxonomy.js）：组的顺序 = 组里第一个分类在自定义顺序里的位置，组内保持自定义顺序 */
export function groupedCats(space, cats = orderedCats(space)) {
  const out = [], by = new Map();
  for (const c of cats) { const g = l2Of(c.id); let e = by.get(g.id); if (!e) { e = { g, cats: [] }; by.set(g.id, e); out.push(e); } e.cats.push(c); }
  return out;
}
/** 一件物品是否符合当前筛选（关键词、状态、位置；withCat=true 时也看分类） */
export function matchItem(it, f, { withCat = true } = {}) {
  const q = f.q.trim().toLowerCase();
  if (withCat && f.cat !== "all" && it.category !== f.cat) return false;
  if (withCat && f.cat !== "all" && f.sub && f.sub !== "all" && it.subcategory !== f.sub) return false;   // 打开某个分类后再按小类缩小（生鲜 → 水果）
  if (q && !(`${it.name}${it.subcategory || ""}${t(it.subcategory || "")}${it.notes || ""}${it.location || ""}${t(it.location || "")}`).toLowerCase().includes(q)) return false;
  if ((f.loc || "all") !== "all" && it.location !== f.loc) return false;
  if (!ownerMatch(it, f.owner, !!f.ownerScope)) return false;
  if (addedActive(f) && !addedMatch(it, f.added, f.addKind)) return false;   // 近 N 天入库（stocked.js）
  if (f.status === "alert") return it.status !== "ok";
  if (f.status === "exp") return !!it.exp;
  if (f.status !== "all") return it.status === f.status;
  return true;
}
