/* 分类：内置分类（data.js）+ 家庭自定义。两种自定义都存 custom_categories 表（演示模式存本机）：
 *   · 自建分类：key = c_xxxxxxxx，和内置分类一样出现在方块、芯片、下拉和统计里；物品的 category 存这个 key
 *   · 覆盖内置：key = 内置分类 id（fresh、cleaning…），名称 / 图标 / 颜色 / 小类按这行来，hidden = true 则隐藏；删掉这行就恢复默认
 * 加载数据后 applyCustomCategories 合并进全局 CATEGORIES；内置分类的原始值记在 c.base 里，每次合并前先还原。 */
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
  // 内置分类：第一次记下原始值，之后每次先还原
  for (let i = C.length - 1; i >= 0; i--) {
    const c = C[i];
    if (c.custom) { C.splice(i, 1); continue; }
    if (!c.base) c.base = { name: c.name, icon: c.icon, color: c.color, subs: c.subs, loc: c.loc };
    Object.assign(c, c.base); delete c.dbId; delete c.hidden; delete c.overridden;
  }
  for (const r of rows || []) {
    const builtin = C.find((c) => c.id === r.key && !c.custom);
    if (builtin) {   // 覆盖内置：空字段沿用默认
      Object.assign(builtin, { name: r.name || builtin.base.name, icon: r.icon || builtin.base.icon, color: r.color || builtin.base.color, subs: Array.isArray(r.subs) && r.subs.length ? r.subs : builtin.base.subs, hidden: !!r.hidden, dbId: r.id, overridden: true });
      continue;
    }
    C.push({ id: r.key, name: r.name, icon: r.icon || "📦", color: r.color || "#8a948f", loc: r.loc || "储物间", subs: Array.isArray(r.subs) ? r.subs : [], space: r.space || "pantry", custom: true, hidden: !!r.hidden, dbId: r.id });
  }
}
export const isCustomCat = (id) => !!window.CATEGORIES.find((c) => c.id === id && c.custom);
/** 可编辑的分类表单初值：内置分类的名称和小类按当前语言显示（保存时 canonSubs 会把没改的还原成内置键，翻译照常） */
export function catFormOf(c, t) {
  const builtin = !c.custom;
  return { id: c.dbId, key: c.id, space: c.space, name: builtin ? t(c.name) : c.name, icon: c.icon, color: c.color, subs: (c.subs || []).map((s) => (builtin ? t(s) : s)), builtin, hidden: !!c.hidden };
}
/** 保存内置分类时：用户没改的名称 / 小类（和当前语言的翻译一致）还原成内置键，这样切换语言仍会翻译；改过的按原样存 */
export function canonName(c, name, t) { const b = c?.base; if (!b) return name; return name === t(b.name) || name === b.name ? b.name : name; }
export function canonSubs(c, subs, t) {
  const all = [...new Set([...(c?.base?.subs || []), ...(c?.subs || [])])];
  return subs.map((s) => all.find((k) => k === s || t(k) === s) || s);
}
