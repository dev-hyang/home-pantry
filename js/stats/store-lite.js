/* 店名和导出的同步小件：店名清洗 / 记住、下拉选项、CSV 与下载。 */
import { LOADING, winDrill } from "./spend-drill.js";
import { esc } from "../core/util.js";
import { rollup, spanOfMonths, statOpts } from "./spend-roll.js";
import { state } from "../core/state.js";
import { csvCell, knownStores } from "./store-lite-common.js";

export const STORE_REST = { name: "其他收款方", color: "#8a948f" }, STORE_NONE = { name: "未填写收款方", color: "#c3cbc6" };
export const cleanStore = (v) => (v || "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
export const lastStore = () => { try { return localStorage.getItem("hmh-last-store") || ""; } catch { return ""; } };
export const rememberStore = (v) => { try { localStorage.setItem("hmh-last-store", v); } catch { /* 忽略 */ } };
/** 商店名：按记下来的（账单缴费时就是当时的收款方，中途换了收款方，历史不改写）；没记的账单 / 订阅 / 保险用账单的收款方（没填就用账单名），统计里就不会都归到“未填写商店” */
export function storeOf(p) {
  const s = (p.store || "").trim(); if (s) return s;
  if (!String(p.category || "").startsWith("bill_")) return "";
  const b = state.bills.find((x) => x.name === p.name);
  return (b?.payee || "").trim() || String(p.name || "").trim();
}
export const storeDatalist = () => `<datalist id="storeList">${knownStores().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
/** payees.js 要用的统计小工具（运行时才取，循环引用无妨） */
export const statKit = { rollup: (from, to, store) => rollup(from, to, store), statOpts: () => statOpts(), spanOfMonths: (ms) => spanOfMonths(ms), winDrill: () => winDrill(), LOADING: () => LOADING() };
export const toCsv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
export function download(name, text, type = "text/csv;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
