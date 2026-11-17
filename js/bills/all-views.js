/* 财务 → 账单概览 → 全部账单（#/bills/all）：所有账单（周期性 + 一次性）的行记录页，一行 = 一期账单。
 * 概览上每张卡片都落到这里：卡片的口径 = 这里的筛选（js/bills/instances.js 同一份逻辑）。设计见 docs/design-bills-overview.md §3、§7.3。
 * 默认：本月 + 逾期（逾期不受范围限制）、全部资产、到期日近的在前；已缴的排在最后。 */
import { state } from "../core/state.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { esc, fmtDate, num, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { propertyTag, propertyName } from "../core/alerts.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { billCat } from "./logic.js";
import { KINDS, detailHref } from "./medical.js";
import { BILL_RANGES, VEHICLE_CATS, billInstances, filterRows, rangeBounds, rangeOk, sortRows, summarize } from "./instances.js";

const cur = () => Units.region.currency;
const mny = (v, c) => Units.money(num(v), c || cur());
const BADGE = { overdue: "b-out", due: "b-low", soon: "b-soon", pending: "", verify: "b-soon", partial: "b-soon", paid: "b-ok", skipped: "", escrow: "b-ok", awaiting_insurance: "b-soon", disputed: "b-out", collections: "b-out", written_off: "" };
const LABEL = { overdue: "逾期", due: "今天到期", soon: "即将到期", pending: "待缴", verify: "待核对", partial: "部分已付", paid: "已缴", skipped: "已跳过", escrow: "Escrow 代缴", awaiting_insurance: "等保险理赔", disputed: "争议中", collections: "催收中", written_off: "已冲销" };
const STATUS_OPTS = [["all", "全部状态"], ["unpaid", "未缴（含逾期）"], ["overdue", "逾期"], ["soon", "即将到期（7 天内）"], ["verify", "待核对（自动扣款）"], ["partial", "部分已付"], ["paid", "已缴"], ["other", "等保险理赔 / 争议 / 催收"]];
const PAY_OPTS = [["all", "全部付款方式"], ["auto", "自动扣款"], ["manual", "手动缴费"], ["escrow", "Escrow 代缴"]];
const SORT_OPTS = [["due", "到期日：近 → 远"], ["amount", "金额：高 → 低"], ["name", "名称 A → Z"]];
export const ALL_KEYS = ["q", "range", "asset", "type", "cat", "status", "pay", "sort"];

/** 网址参数 → 筛选（#/bills/all?asset=…&status=…&range=…；不认识的值忽略）。进入这一页时调用 */
export function applyAllQuery(q) {
  if (!q) return;
  const f = state.allFilter, get = (k) => q.get(k);
  if (get("range") && rangeOk(get("range"))) f.range = get("range");
  for (const k of ["q", "asset", "type", "cat", "status", "pay"]) if (get(k)) f[k] = get(k);
  if (get("sort") && SORT_OPTS.some(([k]) => k === get("sort"))) f.sort = get("sort");
}

/** 没带任何网址参数 = 从目录 / 底栏直接打开：默认只看「未缴」（带参数的链接，如概览卡片，照参数）；「清除筛选」回到全部状态 */
export function defaultAllEntry(q) { if (!q || ![...q.keys()].length) state.allFilter.status = "unpaid"; }

/** 直接打开 / 刷新时（没有经过路由切换）套用网址里的条件；不是这一页就不动 */
export const applyAllRoute = (r) => { if (r?.section === "bills" && r.sub === "all") { defaultAllEntry(r.q); applyAllQuery(r.q); } };

/** 「资产」下拉：全部资产 / 房产 / 车辆 / 设备 / 家人 / 项目 / 家庭通用（分组）；当前选的即使没有账单也保留 */
export function assetOptions(rows, sel) {
  const opt = (v, label) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(label)}</option>`;
  const grp = (label, items) => (items.length ? `<optgroup label="${esc(label)}">${items.join("")}</optgroup>` : "");
  const props = state.properties.filter((p) => !p.archived || `property:${p.id}` === sel).map((p) => opt(`property:${p.id}`, `🏠 ${p.name}`));
  const linked = new Set(rows.flatMap((r) => r.assets).filter((k) => k.startsWith("asset:")).map((k) => k.slice(6)));
  const mine = (kind) => state.assets.filter((a) => a.kind === kind && (linked.has(a.id) || `asset:${a.id}` === sel));
  const vehicles = [opt("vehicle", `🚗 ${t("全部车辆")}`), ...mine("vehicle").map((a) => opt(`asset:${a.id}`, `🚗 ${a.name}`))];
  const gear = mine("equipment").map((a) => opt(`asset:${a.id}`, `🔧 ${a.name}`));
  const people = [...new Map(state.medEnriched.filter((b) => b.kind === "medical" && b.patient_id).map((b) => [b.patient_id, b.patient])).entries()].map(([id, name]) => opt(`person:${id}`, `🏥 ${name}`));
  const kinds = ["medical", "pet", "project", "legal", "travel"].map((k) => opt(k, `${KINDS[k].icon} ${t(KINDS[k].name)}`));
  return `<option value="all">${t("全部资产")}</option>${grp(t("房产"), props)}${grp(t("车辆"), vehicles)}${grp(t("设备"), gear)}${grp(t("家人 / 项目"), [...people, ...kinds])}${opt("general", `🧾 ${t("家庭通用（不挂资产）")}`)}`;
}
const catOptions = (sel) => {
  const used = new Set(state.billsEnriched.map((b) => b.category));
  const rec = window.BILLS.CATEGORIES.filter((c) => used.has(c.id) || `r:${c.id}` === sel).map((c) => `<option value="r:${c.id}" ${`r:${c.id}` === sel ? "selected" : ""}>${c.icon} ${esc(t(c.name))}</option>`);
  const one = Object.entries(KINDS).map(([k, v]) => `<option value="o:${k}" ${`o:${k}` === sel ? "selected" : ""}>${v.icon} ${esc(t(v.name))}（${t("一次性")}）</option>`);
  return `<option value="all">${t("全部分类")}</option><optgroup label="${t("周期性账单")}">${rec.join("")}</optgroup><optgroup label="${t("一次性账单")}">${one.join("")}</optgroup>`;
};

/** 这一行的资产标签：具体资产 > 房产 > 患者 / 种类 > 车辆（笼统）> 不显示 */
function assetChip(r) {
  const a = r.asset_id && state.assets.find((x) => x.id === r.asset_id);
  if (a) return `<span class="space-tag">${a.kind === "vehicle" ? "🚗" : "🔧"} ${esc(a.name)}</span>`;
  if (r.property_id && propertyName(r.property_id)) return propertyTag(r.property_id, { always: true });
  if (r.kind === "onetime") { const k = KINDS[r.category]; return k ? `<span class="space-tag">${k.icon} ${esc(t(r.who || k.name))}</span>` : ""; }
  return VEHICLE_CATS.includes(r.category) ? `<span class="space-tag">🚗 ${t("车辆")}</span>` : "";
}

/** 资产键 → 显示名（概览「按资产」用）：property:ID / asset:ID / vehicle / person:ID / medical / pet / project / legal / travel / general */
export function assetKeyLabel(key) {
  const [type, id] = key.split(":");
  if (type === "property") return `🏠 ${propertyName(id) || t("房产")}`;
  if (type === "asset") { const a = state.assets.find((x) => x.id === id); return a ? `${a.kind === "vehicle" ? "🚗" : "🔧"} ${a.name}` : t("资产"); }
  if (type === "vehicle") return `🚗 ${t("车辆")}`;
  if (type === "person") return `🏥 ${state.medEnriched.find((b) => b.patient_id === id)?.patient || t("家人")}`;
  if (KINDS[type]) return `${KINDS[type].icon} ${t(KINDS[type].name)}`;
  return `🧾 ${t("家庭通用")}`;
}

const nameLink = (r) => {
  if (r.kind === "onetime") { const k = KINDS[r.category]; return `${r.isPrivate ? "🔒 " : ""}<a class="link-name" href="${detailHref(r.billId)}">${k?.icon || "🧾"} ${esc(r.name)}</a>`; }
  return `<a class="link-name" href="${href("bill", r.billId)}">${billCat(r.category).icon} ${esc(r.name)}</a>`;
};
const action = (r) => {
  if (r.status === "paid" || r.status === "skipped" || r.status === "written_off" || r.escrow) return "";
  if (r.kind === "onetime") return `<a class="btn btn-sm" href="${detailHref(r.billId)}">${t("记付款")}</a>`;
  if (r.autopay) return r.status === "verify" ? `<button type="button" class="btn btn-sm" data-action="bill-verify" data-id="${r.billId}">${t("已核对")}</button>` : "";
  return `<a class="btn btn-sm" href="${href("bill", r.billId)}?pay=1">${t("记缴费")}</a>`;
};
export function rowHtml(r) {
  const c = r.currency || cur(), done = ["paid", "skipped", "written_off"].includes(r.status);
  const due = r.dueOn ? t("到期 {d}", { d: fmtDate(r.dueOn) }) : t("没填到期日");
  const meta = [due, r.kind === "onetime" ? t("一次性") : t("周期性"), r.payee, r.autopay ? t("自动扣款") : "", r.amountIsEst && !done ? t("金额为估算") : ""].filter(Boolean).join(" · ");
  const amt = r.amountUnknown && !done ? "—" : mny(r.amount, c);
  const sub = r.status === "partial" || (r.paid > 0 && r.balance > 0) ? t("已付 {a} · 余 {b}", { a: mny(r.paid, c), b: mny(r.balance, c) }) : r.status === "paid" && r.paidOn ? t("{d} 缴", { d: fmtDate(r.paidOn) }) : "";
  return `<li class="bill-row all-row ${done ? "is-paid" : ""}">
    <span class="badge ${BADGE[r.status] || ""}">${r.status === "paid" ? "✓ " : ""}${t(LABEL[r.status] || r.status)}</span>
    <div class="grow">${assetChip(r)} ${nameLink(r)}<small>${esc(meta)}</small></div>
    <div class="all-amt"><b>${amt}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>
    <div class="all-act">${action(r)}</div>
  </li>`;
}

function compute() {
  const f = state.allFilter, today = todayISO(), { from, to } = rangeBounds(f.range, today);
  const base = billInstances({ recurring: state.billsEnriched, onetime: state.medEnriched }, { from, to, today });
  const rows = sortRows(filterRows(base.rows, f), f.sort);
  return { rows, base: base.rows, truncated: base.truncated, from, to, today, S: summarize(rows, { cur: cur(), today }) };
}

function summaryHtml({ S, truncated }) {
  const bits = [t("共 {n} 笔账单", { n: S.total.n }), `${t("应付")} ${mny(S.total.amount)}`, `${t("已付")} ${mny(S.paid.amount)}`, `${t("余额")} ${mny(S.remaining.amount)}`];
  const notes = [S.estimatedN ? t("含估算 {n} 笔", { n: S.estimatedN }) : "", S.unknownN ? t("{n} 笔金额未知按 0 算", { n: S.unknownN }) : "", S.escrow.n ? t("Escrow 代缴 {n} 笔 {a} 不计入", { n: S.escrow.n, a: mny(S.escrow.amount) }) : "",
    S.otherCurrency ? t("另有 {n} 笔非 {c} 账单未计入", { n: S.otherCurrency, c: cur() }) : "", truncated ? t("另有 {n} 期太久远或太远没有展开", { n: truncated }) : ""].filter(Boolean);
  return `<p class="all-sum" role="status"><b>${bits.join(" · ")}</b>${notes.length ? `<small class="muted">${esc(notes.join(" · "))}</small>` : ""}</p>`;
}

function listHtml(C) {
  const f = state.allFilter, lim = pageLimit("allbills", JSON.stringify(f));
  if (!C.rows.length) return `<div class="panel empty"><strong>${t("没有符合条件的账单")}</strong>${changed(f, FD.all) ? t("试试清除筛选，或换一个时间范围。") : t("这个时间范围里没有到期的账单；逾期的会一直显示。")}</div>`;
  return `<div class="panel"><ul class="bill-list">${C.rows.slice(0, lim).map(rowHtml).join("")}</ul></div>${pageMoreBtn("allbills", C.rows.length, lim)}`;
}

/** 搜索 / 筛选只重画列表和合计，不重画工具条（输入框焦点、已输入的字不丢） */
export function renderAllList() {
  const h = document.getElementById("allList"); if (!h) return;
  const C = compute(); h.innerHTML = listHtml(C);
  const s = document.getElementById("allSum"); if (s) s.innerHTML = summaryHtml(C);
}

export function viewAllBills() {
  const f = state.allFilter, C = compute(), sel = (id, opts, v) => `<select id="${id}" aria-label="${esc(t(opts.label))}">${opts.list.map(([k, l]) => `<option value="${k}" ${v === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>`;
  const range = (BILL_RANGES.some(([k]) => k === f.range) ? "" : `<option value="${esc(f.range)}" selected>${esc(f.range)}</option>`) + BILL_RANGES.map(([k, l]) => `<option value="${k}" ${f.range === k ? "selected" : ""}>${t(l)}</option>`).join("");
  const scope = `${fmtDate(C.from)} – ${fmtDate(C.to)}`;
  return `<section class="section">
    <div class="section-head"><h2>🧾 ${t("全部账单")}</h2><div class="head-acts"><a class="btn btn-primary btn-sm" href="${href("bill", "new")}">${t("添加账单")}</a></div></div>
    <p class="muted kinds-note">${t("周期性 + 一次性账单，一行 = 一期账单。时间范围：{r}（{s}）；逾期没缴的不受范围限制，一直显示。", { r: t(BILL_RANGES.find(([k]) => k === f.range)?.[1] || f.range), s: scope })}</p>
    <div class="toolbar">
      <input type="search" id="allSearch" placeholder="${t("搜索名称、付款方、患者")}" value="${esc(f.q || "")}" aria-label="${t("搜索账单")}">
      <select id="allRange" aria-label="${t("时间范围")}">${range}</select>
      <select id="allAsset" aria-label="${t("按资产筛选")}">${assetOptions(C.base, f.asset)}</select>
      <select id="allType" aria-label="${t("按类型筛选")}"><option value="all">${t("周期性 + 一次性")}</option><option value="recurring" ${f.type === "recurring" ? "selected" : ""}>${t("只看周期性")}</option><option value="onetime" ${f.type === "onetime" ? "selected" : ""}>${t("只看一次性")}</option></select>
      <select id="allCat" aria-label="${t("按分类筛选")}">${catOptions(f.cat)}</select>
      ${sel("allStatus", { label: "按状态筛选", list: STATUS_OPTS }, f.status)}
      ${sel("allPay", { label: "按付款方式筛选", list: PAY_OPTS }, f.pay)}
      ${sel("allSort", { label: "排序", list: SORT_OPTS }, f.sort)}
      ${clearFiltersBtn("all", changed(f, FD.all))}
    </div>
    <div id="allSum">${summaryHtml(C)}</div>
    <div id="allList">${listHtml(C)}</div>
  </section>`;
}

/** 给卡片 / 链接用：生成「全部账单」的网址（只带不是默认值的条件） */
export function allBillsHref(params = {}) {
  const p = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v != null && v !== "" && v !== "all") p.set(k, v);
  const s = p.toString(); return `${href("bills", "all")}${s ? `?${s}` : ""}`;
}
