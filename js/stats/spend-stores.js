/* 商店统计与年度报表。 */
import { $, esc, num, toast } from "../core/util.js";
import { BUCKETS, bucketOf, effNature, l1Of, l2List, l2Of, leafInfo, natureName, nodeOf } from "../core/taxonomy.js";
import { LOADING, winDrill } from "./spend-drill.js";
import { STAT_CATS, rollup, spanOfMonths, statCat, statOpts } from "./spend-roll.js";
import { compare, locale, t } from "../core/i18n.js";
import { fetchSpendPages } from "./spend-trips.js";
import { spendBase } from "./spend-records.js";
import { spendSuggestions } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { viewPayees } from "./payees.js";
import { paymentPayLabel } from "../bills/card-picker.js";

/* ── 商店统计与年度报表 ── */
export const STORE_COLORS = ["#2c6a57", "#d4694c", "#3b7fc4", "#b07a1a", "#7563c0", "#c75a85"];
export const STORE_REST = { name: "其他收款方", color: "#8a948f" }, STORE_NONE = { name: "未填写收款方", color: "#c3cbc6" };
export const cleanStore = (v) => (v || "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
export const lastStore = () => { try { return localStorage.getItem("hmh-last-store") || ""; } catch { return ""; } };
export const rememberStore = (v) => { try { localStorage.setItem("hmh-last-store", v); } catch { /* 忽略 */ } };
// 商店名大小写、空格不同视为同一家（Costco 与 costco）
export const storeKey = (v) => (v || "").trim().toLowerCase();
/** 商店名：按记下来的（账单缴费时就是当时的收款方，中途换了收款方，历史不改写）；没记的账单 / 订阅 / 保险用账单的收款方（没填就用账单名），统计里就不会都归到“未填写商店” */
export function storeOf(p) {
  const s = (p.store || "").trim(); if (s) return s;
  if (!String(p.category || "").startsWith("bill_")) return "";
  const b = state.bills.find((x) => x.name === p.name);
  return (b?.payee || "").trim() || String(p.name || "").trim();
}
/** 用过的商店（近 400 天，按次数取前 300 个，数据库 spend_suggest；规则同 storeOf），按名称排 */
export function knownStores() {
  const m = new Map();
  for (const n of spendSuggestions().stores) if (n && !m.has(storeKey(n))) m.set(storeKey(n), n);
  return [...m.values()].sort(compare);
}
export const storeDatalist = () => `<datalist id="storeList">${knownStores().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
/** 收款方页：实现在 js/stats/payees.js（指标卡、图表、表格、改名 / 合并、整理收款方） */
export const viewStoreStats = (months, month = state.stats.month) => viewPayees(months, month);
/** payees.js 要用的统计小工具（运行时才取，循环引用无妨） */
export const statKit = { rollup: (from, to, store) => rollup(from, to, store), statOpts: () => statOpts(), spanOfMonths: (ms) => spanOfMonths(ms), winDrill: () => winDrill(), LOADING: () => LOADING() };
export function viewAnnualExport() {
  const y = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y - i);
  return `<section class="section">
    <div class="section-head"><h2>${t("年度花费报表")}</h2><p>${t("导出 CSV，可用 Excel、Numbers 或 Google 表格打开")}</p></div>
    <div class="panel export-grid">
      <label class="export-pick"><span>${t("年份")}</span><select id="csvYear" data-nosearch>${years.map((v) => `<option value="${v}">${t("{y} 年", { y: v })}</option>`).join("")}</select></label>
      <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-action="csv-summary">${t("导出汇总（月份 × 分类、收款方）")}</button>
      <button type="button" class="btn btn-sm" data-action="csv-detail">${t("导出明细（每一笔）")}</button></div>
    </div>
  </section>`;
}
// CSV：加 UTF-8 BOM（Excel 打开中文不乱码）；以 = + - @ 开头的文本加 ' 前缀，防止表格公式注入
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
export function download(name, text, type = "text/csv;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** 花费明细 CSV 的表头 + 每一笔（年度报表的明细、明细页「导出当前列表」共用） */
/** 一级 / 二级 / 叶子分类、经济性质（空 = 按分类默认，写出实际用的）、关联房产 都写成列，方便在表格里透视 */
export function spendDetailRows(list) {
  const propName = (id) => (id ? state.properties.find((x) => x.id === id)?.name || "" : "");
  return [[t("日期"), t("物品"), t("一级分类"), t("二级分类"), t("分类"), t("经济性质"), t("商店 / 收款方"), t("数量"), t("单位"), t("金额"), t("货币"), t("付款方式"), t("关联房产"), t("关联库存")],
    ...list.map((p) => { const [a, b, c] = [l1Of(p.category), l2Of(p.category), leafInfo(p.category)];
      return [ymd(p.purchased_at), p.name, t(a.name), t(b.name), t(c.name), t(natureName(effNature(p.category, p.nature))), storeOf(p), p.quantity == null ? "" : num(p.quantity), p.unit ? t(p.unit) : "",
        p.amount == null ? "" : num(p.amount), p.currency || "", paymentPayLabel(p), propName(p.property_id), p.item_id ? t("是") : t("否")]; })];
}
export async function exportAnnual(kind) {
  const year = +($("#csvYear")?.value || new Date().getFullYear());
  // 按本地时间：当年 1 月 1 日 0 点到次年 1 月 1 日 0 点
  const from = new Date(year, 0, 1).toISOString(), to = new Date(year + 1, 0, 1).toISOString();
  let list;   // 按年份筛选的花费流水（含医疗等事件型账单的付款），旧 → 新；数据库分页读，不读整表
  try { list = (await fetchSpendPages({ ...spendBase("old"), year: String(year), from, to }, 50000)).map((r) => ({ ...r, category: canonCat(r.category) })); }
  catch (e) { return toast(t("读取列表失败：{msg}", { msg: e.message })); }
  if (!list.length) return toast(t("{y} 年没有采购记录", { y: year }));
  const r2 = (v) => Math.round(v * 100) / 100;
  const hh = state.household?.name || t("家庭");
  const fileBase = `${hh.replace(/[\\/:*?"<>|（）()\s]/g, "")}-${year}`;

  if (kind === "detail") {
    download(`${fileBase}-${t("采购明细")}.csv`, toCsv(spendDetailRows(list)));
    return toast(t("已导出 {n} 笔明细", { n: list.length }));
  }

  // 汇总：只统计当前地区货币，其他币种和未填金额的笔数在文末说明
  const cur = Units.region.currency;
  const valid = list.filter((p) => p.amount != null && (!p.currency || p.currency === cur));
  const skipped = list.filter((p) => p.amount != null && p.currency && p.currency !== cur).length;
  const noAmount = list.filter((p) => p.amount == null).length;
  // 月份 × 统计口径（日常 / 住房 / 财务 / 资本性 / 投资，合起来 = 现金流出），再月份 × 二级分类；转账不算，文末写笔数
  const cats = STAT_CATS(), bk = BUCKETS;
  const grid = Array.from({ length: 12 }, () => Object.fromEntries(cats.map((c) => [c.id, 0])));
  const bgrid = Array.from({ length: 12 }, () => Object.fromEntries(bk.map((b) => [b.id, 0])));
  const stores = new Map(); let xferN = 0;
  for (const p of valid) {
    const m = new Date(p.purchased_at).getMonth(), b = bucketOf(p.category, p.nature);
    if (!b) { xferN++; continue; }
    bgrid[m][b] += num(p.amount);
    const c = statCat(p.category);
    grid[m][c] += num(p.amount);
    const k = storeKey(storeOf(p)) || "__none__";
    const st = stores.get(k) || { name: storeOf(p) || t(STORE_NONE.name), count: 0, total: 0 };
    st.count++; st.total += num(p.amount); stores.set(k, st);
  }
  const used = cats.filter((c) => grid.some((g) => g[c.id] > 0));
  const catYear = (id) => grid.reduce((a, g) => a + g[id], 0);
  const yearTotal = bgrid.reduce((a, g) => a + Object.values(g).reduce((x, y) => x + y, 0), 0);
  const rows = [
    [t("{hh} {y} 年采购花费汇总", { hh, y: year })],
    [t("货币：{cur}", { cur }), t("导出时间：{d}", { d: new Date().toLocaleString(locale()) })],
    [],
    [t("月份"), ...bk.map((b) => t(b.name)), t("现金流出合计"), t("日常 + 住房")],
  ];
  bgrid.forEach((g, i) => rows.push([t("{m}月", { m: i + 1 }), ...bk.map((b) => r2(g[b.id])), r2(Object.values(g).reduce((x, y) => x + y, 0)), r2(g.living + g.housing)]));
  rows.push([t("全年"), ...bk.map((b) => r2(bgrid.reduce((a, g) => a + g[b.id], 0))), r2(yearTotal), r2(bgrid.reduce((a, g) => a + g.living + g.housing, 0))], []);
  rows.push([t("月份"), ...used.map((c) => `${t(nodeOf(l2List().find((x) => x.id === c.id)?.p)?.name || "")} · ${t(c.name)}`), t("合计")]);
  grid.forEach((g, i) => rows.push([t("{m}月", { m: i + 1 }), ...used.map((c) => r2(g[c.id])), r2(used.reduce((a, c) => a + g[c.id], 0))]));
  rows.push([t("全年"), ...used.map((c) => r2(catYear(c.id))), r2(yearTotal)]);
  rows.push([t("占比"), ...used.map((c) => (yearTotal ? `${r2((catYear(c.id) / yearTotal) * 100)}%` : "")), "100%"]);
  rows.push([], [t("收款方"), t("次数"), t("合计"), t("平均每次"), t("占比")]);
  [...stores.values()].sort((a, b) => b.total - a.total).forEach((st) =>
    rows.push([st.name, st.count, r2(st.total), r2(st.total / st.count), yearTotal ? `${r2((st.total / yearTotal) * 100)}%` : ""]));
  if (skipped || noAmount || xferN) rows.push([], [t("说明：{a}{b}明细表中仍可查看。", { a: (skipped ? t("{n} 笔非 {cur} 记录未计入；", { n: skipped, cur }) : "") + (xferN ? t("{n} 笔转账不算花费；", { n: xferN }) : ""), b: noAmount ? t("{n} 笔未填金额；", { n: noAmount }) : "" })]);
  download(`${fileBase}-${t("花费汇总")}.csv`, toCsv(rows));
  toast(t("已导出 {y} 年汇总，共 {n} 笔", { y: year, n: valid.length }));
}
