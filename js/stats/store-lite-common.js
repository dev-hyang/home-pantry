/* 店名和导出的同步小件：店名清洗 / 记住、下拉选项、CSV 与下载。 */
import { compare } from "../core/i18n.js";
import { spendSuggestions } from "../core/spend-data.js";

// 商店名大小写、空格不同视为同一家（Costco 与 costco）
export const storeKey = (v) => (v || "").trim().toLowerCase();
/** 用过的商店（近 400 天，按次数取前 300 个，数据库 spend_suggest；规则同 storeOf），按名称排 */
export function knownStores() {
  const m = new Map();
  for (const n of spendSuggestions().stores) if (n && !m.has(storeKey(n))) m.set(storeKey(n), n);
  return [...m.values()].sort(compare);
}
// CSV：加 UTF-8 BOM（Excel 打开中文不乱码）；以 = + - @ 开头的文本加 ' 前缀，防止表格公式注入
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
