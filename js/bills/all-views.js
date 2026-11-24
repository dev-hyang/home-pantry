/* 财务 → 账单概览 → 全部账单（#/bills/all）：所有账单（周期性 + 一次性）的行记录页，一行 = 一期账单。
 * 概览上每张卡片都落到这里：卡片的口径 = 这里的筛选（js/bills/instances.js 同一份逻辑）。设计见 docs/design-bills-overview.md §3、§7.3。
 * 默认（不带参数）：时间「全部」、状态「全部」、全部资产、到期日近的在前；已缴的排在最后。从概览卡片点进来会带着那张卡的范围 / 资产 / 状态。 */
import { state } from "../core/state.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { esc, fmtDate, num, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { toolbarEye } from "../core/toolbar-eye.js";
import { finHead } from "./fin-head.js";
import { infoTip } from "../core/info-tip.js";
import { moreMenu } from "../core/more-menu.js";
import { lpAttr } from "../core/long-press.js";
import { fabHtml } from "./bill-fab.js";
import { estAmount, lockFlag, metaLine, nameLine } from "./row-fmt.js";
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

/** （已取消）以前这里给「不带参数」设默认「未缴」；现在不带参数 = 时间「全部」、状态「全部」，带参数（概览卡片带来的「本月」等）照参数。保留空函数，免得别处引用出错 */
export function defaultAllEntry() {}

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

const action = (r) => {
  if (r.status === "paid" || r.status === "skipped" || r.status === "written_off" || r.escrow) return "";
  if (r.kind === "onetime") return `<a class="btn btn-sm" href="${detailHref(r.billId)}">${t("记付款")}</a>`;
  if (r.autopay) return r.status === "verify" ? `<button type="button" class="btn btn-sm" data-action="bill-verify" data-id="${r.billId}">${t("已核对")}</button>` : "";
  return `<a class="btn btn-sm" href="${href("bill", r.billId)}?pay=1">${t("记缴费")}</a>`;
};
/** 长按这一行的菜单：周期性 = 详情 / 记缴费（自动扣款是记核对）/ 缴费记录 / 编辑账单；一次性 = 详情（付款在详情里记） */
function rowItems(r) {
  if (r.kind === "onetime") return [{ label: t("详情"), href: detailHref(r.billId), first: true }, ["paid", "skipped", "written_off"].includes(r.status) ? null : { label: t("缴费"), href: detailHref(r.billId) }];
  const base = href("bill", r.billId), open = !["paid", "skipped", "written_off"].includes(r.status) && !r.escrow;
  return [{ label: t("详情"), href: base, first: true }, open ? (r.autopay ? (r.status === "verify" ? { label: t("已核对"), action: "bill-verify", data: { id: r.billId } } : null) : { label: t("缴费"), href: `${base}?pay=1` }) : null,
    { label: t("缴费记录"), href: `${base}?sec=pay` }, { label: t("编辑"), href: `${base}?sec=detail` }];
}
const r2 = (n) => Math.round(n * 100) / 100;
/** 这一期已经付过的款：{ lines: [{ date, amount, balance }], split } ——一次付清 → split=false（只显示缴费日期）；分期（≥ 2 笔，或付了一部分还有余额）→ split=true，一笔一行：日期、金额、付完这笔后的余额。
 *  周期性账单一期一条缴费；一次性账单可以有多笔（退款是负数）。 */
function payInfo(r) {
  if (r.kind === "recurring") return r.status === "paid" && (r.paidOn || r.payment?.paid_on) ? { lines: [{ date: r.paidOn || r.payment.paid_on, amount: r.paid, balance: 0 }], split: false } : { lines: [], split: false };
  const pays = [...(r.bill?.pays || [])].sort((x, y) => String(x.paid_on || "").localeCompare(String(y.paid_on || "")) || String(x.id).localeCompare(String(y.id)));
  if (!pays.length) return { lines: [], split: false };
  const owed = r.bill?.owed == null ? null : num(r.bill.owed); let cum = 0;
  const lines = pays.map((p) => { cum += num(p.amount); return { date: p.paid_on, amount: num(p.amount), balance: owed == null ? null : Math.max(0, r2(owed - cum)) }; });
  const last = lines.at(-1);
  return { lines, split: lines.length > 1 || (last.balance != null && last.balance > 0) };
}
const L = (zh, en) => (lang === "en" ? en : zh);
export function rowHtml(r) {
  const c = r.currency || cur(), done = ["paid", "skipped", "written_off"].includes(r.status), info = payInfo(r);
  const single = !info.split && info.lines.length ? info.lines.at(-1) : null, isOne = r.kind === "onetime";
  // 名称行：类别图标 + 名称 + 名称后面的标志（🔒…）+ 状态徽章
  const name = nameLine({ ico: isOne ? (KINDS[r.category]?.icon || "🧾") : billCat(r.category).icon, name: r.name, href: isOne ? detailHref(r.billId) : href("bill", r.billId), flags: [r.isPrivate && lockFlag()],
    badge: `<span class="badge ${BADGE[r.status] || ""}">${r.status === "paid" ? "✓ " : ""}${t(LABEL[r.status] || r.status)}</span>` });
  // 信息行：所属资产 / 患者 直接接到期日（已缴一次付清的写缴费日期）· 周期性 / 一次性 · 收款方 · 自动扣款
  const chip = assetChip(r);
  const meta = metaLine([chip && { html: chip, chip: true }, single ? t("缴费日期 {d}", { d: fmtDate(single.date) }) : r.dueOn ? t("到期 {d}", { d: fmtDate(r.dueOn) }) : t("没填到期日"), isOne ? t("一次性") : t("周期性"), r.kind === "recurring" ? r.payee : "", r.autopay ? t("自动扣款") : ""]);
  const amt = estAmount(r.amountUnknown && !done ? "—" : `<b>${mny(r.amount, c)}</b>`, r.amountIsEst && !done);
  const pays = info.split ? `<ul class="all-pays" aria-label="${esc(t("分期付款"))}">${info.lines.map((p, k) => `<li><span class="ap-no">${esc(L(`分期 #${k + 1}`, `Split #${k + 1}`))}</span><span class="ap-date">${esc(fmtDate(p.date))}</span><b class="ap-amt">${mny(p.amount, c)}</b>${p.balance != null ? `<small class="ap-bal">${esc(t("余额 {a}", { a: mny(p.balance, c) }))}</small>` : ""}</li>`).join("")}</ul>` : "";
  const act = action(r);
  return `<li class="ui-row bill-row all-row ${done ? "is-paid" : ""}" data-variant="record" ${lpAttr(rowItems(r), r.name)}>
    <div class="all-l1">${name}</div>
    <div class="all-amt">${amt}</div>
    <div class="all-l2">${meta}</div>
    ${pays}
    ${act ? `<div class="all-act">${act}</div>` : ""}
  </li>`;
}

function compute(f = state.allFilter) {
  const today = todayISO(), { from, to } = rangeBounds(f.range, today);
  const base = billInstances({ recurring: state.billsEnriched, onetime: state.medEnriched }, { from, to, today });
  const rows = sortRows(filterRows(base.rows, f), f.sort);
  // 合计卡（应付 / 已付 / 余额）只跟「时间范围」走，不随搜索 / 资产 / 类型 / 状态…这些筛选变；筛选出来的小计单独放在列表上方一行（S）
  return { rows, base: base.rows, truncated: base.truncated, from, to, today, S: summarize(rows, { cur: cur(), today }), SK: summarize(base.rows, { cur: cur(), today }) };
}


/** 三张合计卡：口径说明收进各卡标题旁的 ⓘ（估算 / 未知金额 / Escrow / 其他币种 / 没展开的期都影响「应付」，估算也影响「余额」） */
export function summaryHtml({ SK: S, truncated }) {
  const card = (label, amount, sub, tip = "") => `<div class="kpi"><span>${label}${tip ? ` ${tip}` : ""}</span><b>${mny(amount)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  const est = S.estimatedN ? t("含估算 {n} 笔（水电燃气按最近均值估，记缴费时填实际金额就会更新）", { n: S.estimatedN }) : "";
  const totalTip = infoTip.classic([est, S.unknownN ? t("{n} 笔金额未知按 0 算", { n: S.unknownN }) : "", S.escrow.n ? t("Escrow 代缴 {n} 笔 {a} 不计入", { n: S.escrow.n, a: mny(S.escrow.amount) }) : "",
    S.otherCurrency ? t("另有 {n} 笔非 {c} 账单未计入", { n: S.otherCurrency, c: cur() }) : "", truncated ? t("另有 {n} 期太久远或太远没有展开", { n: truncated }) : ""], { align: "start" });
  const mark = S.estimatedN ? t("含预估") : "";   // 有按均值估的金额：应付 / 余额小字标「含预估」
  const cards = card(t("应付"), S.total.amount, [t("共 {n} 笔账单", { n: S.total.n }), mark].filter(Boolean).join(" · "), totalTip) + card(t("已付"), S.paid.amount, "") + card(t("余额"), S.remaining.amount, mark, infoTip.classic(est, { align: "end" }));
  return `<div class="kpis all-kpis" role="status">${cards}</div>`;
}

/** 标题旁 ⓘ 的说明：一行 = 一期账单 + 当前时间范围（筛选一变就要重画，所以单独成块） */
function titleTip(f, C) {
  const scope = f.range === "all" ? t("不限时间") : `${fmtDate(C.from)} – ${fmtDate(C.to)}`;
  return infoTip.classic(t("周期性 + 一次性账单，一行 = 一期账单。时间范围：{r}（{s}）；逾期没缴的不受范围限制，一直显示。", { r: t(BILL_RANGES.find(([k]) => k === f.range)?.[1] || f.range), s: scope }), { align: "start" });
}

function listHtml(C) {
  const f = state.allFilter, lim = pageLimit("allbills", JSON.stringify(f));
  if (!C.rows.length) return `<div class="panel empty"><strong>${t("没有符合条件的账单")}</strong>${changed(f, FD.all) ? t("试试清除筛选，或换一个时间范围。") : t("这个时间范围里没有到期的账单；逾期的会一直显示。")}</div>`;
  const sub = changed(f, FD.all, ["q", "asset", "type", "cat", "status", "pay"]) ? `<p class="muted pay-sum" role="status">${t("筛选结果：{n} 笔 · 应付 {a} · 余额 {b}", { n: C.rows.length, a: mny(C.S.total.amount), b: mny(C.S.remaining.amount) })}</p>` : "";   // 合计卡不随筛选变，筛选出的小计在这里
  return `${sub}<div class="panel"><ul class="bill-list">${C.rows.slice(0, lim).map(rowHtml).join("")}</ul></div>${pageMoreBtn("allbills", C.rows.length, lim)}`;
}

/** 搜索 / 筛选只重画列表和合计，不重画工具条（输入框焦点、已输入的字不丢） */
export function renderAllList() {
  const h = document.getElementById("allList"); if (!h) return;
  const C = compute(); h.innerHTML = listHtml(C);
  const s = document.getElementById("allSum"); if (s) s.innerHTML = summaryHtml(C);
  const tt = document.getElementById("allTitleTip"); if (tt) tt.innerHTML = titleTip(state.allFilter, C);
}

export function viewAllBills() {
  const f = state.allFilter, C = compute(), sel = (id, opts, v) => `<select id="${id}" aria-label="${esc(t(opts.label))}">${opts.list.map(([k, l]) => `<option value="${k}" ${v === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>`;
  // 「全部」放第一项 = 默认值：手机上「筛选 (n)」只数「选了第一项以外的下拉」，所以默认的「全部」不算筛选，选了本月 / 下月… 才算；从概览链接带来的某个月（YYYY-MM）排在「全部」后面
  const rangeOpts = [BILL_RANGES.find(([k]) => k === "all"), ...BILL_RANGES.filter(([k]) => k !== "all")];
  const range = rangeOpts.slice(0, 1).map(([k, l]) => `<option value="${k}" ${f.range === k ? "selected" : ""}>${t(l)}</option>`).join("") + (BILL_RANGES.some(([k]) => k === f.range) ? "" : `<option value="${esc(f.range)}" selected>${esc(f.range)}</option>`)
    + rangeOpts.slice(1).map(([k, l]) => `<option value="${k}" ${f.range === k ? "selected" : ""}>${t(l)}</option>`).join("");
  return `<section class="section">
    ${finHead({ label: t("账单明细"), note: `<span id="allTitleTip" class="title-tip">${titleTip(f, C)}</span>` })}
    <div id="allSum">${summaryHtml(C)}</div>
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
      ${toolbarEye()}
    </div>
    <div id="allList">${listHtml(C)}</div>
  </section>${fabHtml()}`;
}

export { compute as allCompute };   // 资产账单页（asset-bills.js）用同一份口径
export { allBillsHref } from "./all-href.js";   // 网址生成在 all-href.js（首页等只要拼链接的地方不必加载整个页面）
