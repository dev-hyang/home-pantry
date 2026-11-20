/* 房屋 / 车辆 → 账单（#/bills/assetbills/<资产键>）：这个资产关联的全部账单（周期性 + 一次性），一行 = 一期账单。
 * 和「财务 → 全部账单」同一份口径（bills/instances.js）、同一种行（all-views.js 的 rowHtml）、同样的合计小卡片（应付 / 已付 / 余额）；
 * 区别：资产固定为这一个（不用再选），默认只看本月，筛选只有 搜索 / 时间范围 / 类型 / 状态 / 排序，右下角圆形 ＋ 添加账单。
 * 筛选状态记在 state.assetBills（换了资产就重置回本月）。 */
import { state } from "../core/state.js";
import { esc, fmtDate } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { moneyEye } from "../core/privacy.js";
import { crumbNav } from "../core/hub.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { fabHtml } from "./bill-fab.js";
import { BILL_RANGES } from "./instances.js";
import { allCompute, assetKeyLabel, rowHtml, summaryHtml } from "./all-views.js";

const F0 = () => ({ key: "", q: "", range: "m", type: "all", status: "all", sort: "due" });
const STATUS = [["all", "全部状态"], ["unpaid", "未缴（含逾期）"], ["overdue", "逾期"], ["soon", "即将到期（7 天内）"], ["verify", "待核对（自动扣款）"], ["partial", "部分已付"], ["paid", "已缴"]];
const SORT = [["due", "到期日：近 → 远"], ["amount", "金额：高 → 低"], ["name", "名称 A → Z"]];
const TYPES = [["all", "周期性 + 一次性"], ["recurring", "只看周期性"], ["onetime", "只看一次性"]];

/** 网址里的资产键（property:ID / asset:ID / person:ID…）；不合法就当没有 */
const routeKey = () => { try { const k = decodeURIComponent(state.route?.id || ""); return /^(property:|asset:|person:)[\w-]+$/.test(k) ? k : ""; } catch { return ""; } };
export { assetBillsHref } from "./all-href.js";   // 网址生成在 all-href.js（房屋 / 车辆页拼链接不必加载整个页面）

function filter() {
  const key = routeKey(), S = state.assetBills;
  if (!S || S.key !== key) {   // 换了资产（或第一次进来）：回到本月；链接带 ?range= 的照链接
    const r = state.route?.q?.get("range");
    state.assetBills = { ...F0(), key, range: r && BILL_RANGES.some(([k]) => k === r) ? r : "m" };
  }
  return { ...state.assetBills, asset: key, cat: "all", pay: "all" };
}
/** 返回的上一层：房产 = 这套房产的概览；车辆 / 设备 = 它自己的页面 */
function backParts(key) {
  const [type, id] = key.split(":");
  if (type === "property") return [{ href: href("house", "overview"), label: t("房屋") }];
  if (type === "asset") return [{ href: href("house", "menu"), label: t("房屋") }, { href: href("asset", id), label: assetKeyLabel(key).replace(/^\S+\s/, "") }];
  return [{ href: href("bills", "overview"), label: t("财务") }];
}

const opts = (list, cur) => list.map(([k, l]) => `<option value="${esc(k)}" ${k === cur ? "selected" : ""}>${esc(t(l))}</option>`).join("");
function listHtml(C, f) {
  const lim = pageLimit("assetbills", JSON.stringify(f));
  if (!C.rows.length) return `<div class="panel empty"><strong>${t("没有符合条件的账单")}</strong>${f.range === "all" && !f.q && f.type === "all" && f.status === "all" ? t("这个资产还没有关联的账单。") : t("换一个时间范围，或清除筛选。逾期没缴的会一直显示。")}</div>`;
  return `<div class="panel"><ul class="bill-list">${C.rows.slice(0, lim).map(rowHtml).join("")}</ul></div>${pageMoreBtn("assetbills", C.rows.length, lim)}`;
}

/** 搜索 / 筛选只重画合计和列表（工具条里的输入框不丢焦点） */
function redraw() {
  const f = filter(), C = allCompute(f), l = document.getElementById("abList"), s = document.getElementById("abSum");
  if (l) l.innerHTML = listHtml(C, f);
  if (s) s.innerHTML = summaryHtml(C);
  const n = document.getElementById("abNote"); if (n) n.textContent = noteText(f, C);
}
const noteText = (f, C) => t("时间范围：{r}（{s}）。逾期没缴的一直显示，不受范围限制。", { r: t(BILL_RANGES.find(([k]) => k === f.range)?.[1] || f.range), s: f.range === "all" ? t("不限时间") : `${fmtDate(C.from)} – ${fmtDate(C.to)}` });

export function viewAssetBills() {
  const f = filter();
  if (!f.asset) return `<section class="section"><div class="panel empty"><strong>${t("找不到这个资产")}</strong><p><a class="btn btn-sm" href="${href("bills", "all")}">${t("全部账单")}</a></p></div></section>`;
  const C = allCompute(f), label = assetKeyLabel(f.asset), name = label.replace(/^\S+\s/, ""), ico = label.split(" ")[0];
  const rangeHtml = (BILL_RANGES.some(([k]) => k === f.range) ? "" : `<option value="${esc(f.range)}" selected>${esc(f.range)}</option>`) + opts(BILL_RANGES, f.range);
  return `<section class="section" id="assetBillsPage">
    ${crumbNav([...backParts(f.asset), { label: t("账单"), icon: "🧾" }])}
    <div class="section-head"><h2>${ico} ${esc(name)} · ${t("账单")}</h2><div class="head-acts">${moneyEye()}</div></div>
    <p class="muted kinds-note" id="abNote" role="status">${esc(noteText(f, C))}</p>
    <div id="abSum">${summaryHtml(C)}</div>
    <div class="toolbar">
      <input type="search" id="abQ" placeholder="${esc(t("搜索名称、付款方"))}" value="${esc(f.q)}" aria-label="${esc(t("搜索账单"))}">
      <select id="abRange" aria-label="${esc(t("时间范围"))}">${rangeHtml}</select>
      <select id="abType" aria-label="${esc(t("按类型筛选"))}">${opts(TYPES, f.type)}</select>
      <select id="abStatus" aria-label="${esc(t("按状态筛选"))}">${opts(STATUS, f.status)}</select>
      <select id="abSort" aria-label="${esc(t("排序"))}">${opts(SORT, f.sort)}</select>
    </div>
    <div id="abList">${listHtml(C, f)}</div>
  </section>${fabHtml()}`;
}

const KEYS = { abQ: "q", abRange: "range", abType: "type", abStatus: "status", abSort: "sort" };
const apply = (e) => { const k = KEYS[e.target.id]; if (!k || !state.assetBills) return; state.assetBills[k] = e.target.value; redraw(); };
document.addEventListener("input", (e) => { if (e.target.id === "abQ") apply(e); });
document.addEventListener("change", (e) => { if (e.target.id !== "abQ") apply(e); });
