/* 物品名称对照（2026-11-07）：手动添加物品、录入购物、记一笔花费 都可能新建 / 关联物品，
 * 同一样东西写法稍有不同（大小写、空格、全角半角、「鸡蛋」/「鸡蛋 」、eggs / egg）就会变成两件。这里统一：
 *   normName  —— 比较用的写法：NFKC（全角 → 半角）、去首尾空格、空白合一、小写、去掉英文复数 s
 *   findItem  —— 写法一样的那一件（视为同一件）
 *   similarItems —— 相近的几件（一个包含另一个，或只差一个字），给「是不是这件？」的提示
 * 只看内存里的物品（state.items），不查数据库。 */
import { state } from "./state.js";
import { spaceOf } from "./util.js";

export function normName(n) {
  let s = String(n ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  if (/^[a-z ]+$/.test(s) && s.length > 3) s = s.replace(/([^s])s$/, "$1");   // eggs → egg、apples → apple；glass 不动
  return s;
}
const pool = (spaces) => (state.items || []).filter((i) => !spaces || spaces.includes(spaceOf(i.category)));

/** 同一件：规范化后名字一样；exceptId = 正在编辑的那件自己 */
export function findItem(name, { spaces = null, exceptId = null } = {}) {
  const k = normName(name); if (!k) return null;
  return pool(spaces).find((i) => i.id !== exceptId && normName(i.name) === k) || null;
}

/** 一个字的差别（替换 / 多一个 / 少一个），只对短名字有意义 */
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}
/** 相近的物品（不含写法完全一样的那件）：一个名字包含另一个（至少 2 个字），或短名字只差一个字；最多 limit 件 */
export function similarItems(name, { spaces = null, exceptId = null, limit = 3 } = {}) {
  const k = normName(name); if (k.length < 2) return [];
  return pool(spaces).filter((i) => {
    if (i.id === exceptId) return false;
    const o = normName(i.name); if (!o || o === k) return false;
    return (o.length >= 2 && (o.includes(k) || k.includes(o))) || (k.length <= 8 && oneEdit(k, o));
  }).slice(0, limit);
}

/** 输入框联想：已有物品的名字（去重） */
export const itemNameOptions = (spaces = null) => [...new Set(pool(spaces).map((i) => i.name))].sort((a, b) => a.localeCompare(b));
