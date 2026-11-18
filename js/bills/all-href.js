/* 「全部账单」页的网址生成：首页、财务概览、快捷操作都只需要拼一个链接，不必为它把整个页面模块加载进来。 */
import { href } from "../core/router.js";

/** 给卡片 / 链接用：生成「全部账单」的网址（只带不是默认值的条件） */
export function allBillsHref(params = {}) {
  const p = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v != null && v !== "" && v !== "all") p.set(k, v);
  const s = p.toString(); return `${href("bills", "all")}${s ? `?${s}` : ""}`;
}
