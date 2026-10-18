/* 自定义分类：家庭自己加的分类（如“露营食品”“手工材料”），和内置分类一样出现在方块、芯片、下拉和统计里。
 * 存在 custom_categories 表（演示模式存本机），加载数据后合并进全局 CATEGORIES；物品的 category 存分类 key（c_xxx）。 */
export const ICONS = ["📦", "🧺", "🥗", "🍱", "🍪", "🍶", "🧂", "🫙", "🧴", "🧼", "🧷", "🧸", "🎨", "📚", "✏️", "🎒", "🐾", "🌿", "🎄", "🎁", "💄", "🩺", "🧪", "🔋", "💡", "🧵", "🪴", "⛺", "🎣", "🏀"];
export const COLORS = ["#3f8f5a", "#3b7fc4", "#b07a1a", "#c75a85", "#7563c0", "#d4694c", "#24897d", "#2f6fb0", "#9a6b3c", "#4a5fb0", "#8a6d3b", "#5a8f3f", "#a0522d", "#6b8e7a", "#c0392b"];

/** 生成分类 key：只能小写字母和下划线（数据库约束） */
export function newCatKey() {
  const abc = "abcdefghijklmnopqrstuvwxyz"; let s = "c_";
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * 26)];
  return s;
}

/** 把数据库里的自定义分类合并进 window.CATEGORIES（替换上一次合并的，保持内置顺序在前） */
export function applyCustomCategories(rows) {
  const C = window.CATEGORIES;
  for (let i = C.length - 1; i >= 0; i--) if (C[i].custom) C.splice(i, 1);
  for (const r of rows || []) {
    C.push({ id: r.key, name: r.name, icon: r.icon || "📦", color: r.color || "#8a948f", loc: r.loc || "储物间", subs: Array.isArray(r.subs) ? r.subs : [], space: r.space || "pantry", custom: true, dbId: r.id });
  }
}
export const isCustomCat = (id) => !!window.CATEGORIES.find((c) => c.id === id && c.custom);
