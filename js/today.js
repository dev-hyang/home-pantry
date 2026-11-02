/* 首页 · 今日（2026-11 重排，配合 房屋 / 财务 的新信息架构；11-02 再调）：
 *   问候 + 一句话状态 → 咩咩咩 → 待办 · 按模块（顶上是轻重计数 + 「查看全部」）‖ 家里 · 一览 → 钱 · 本月（只给有财务权限的人）→ 快捷操作
 * 原来单独的「需要注意」块去掉了：它和「待办 · 按模块」是同一份提醒的两种排法，轻重计数并进待办的块头，完整清单仍在 #/alerts；
 * 每个模块自己的页面顶上（看板数字下面）列这个模块要处理的事（见 core/alerts.js 的 attentionPanel）。
 * 宽屏两栏（左：咩咩和要做的事；右：看一眼的数字和快捷操作），手机一栏；每块都能折叠，折叠状态记在这台设备上（hmh-today 的 fold）。
 * 角色：没有财务权限的家人看不到「钱 · 本月」整块（不是 CSS 隐藏，是根本不画），待办里没有预算 / 收入 / 借贷，快捷操作里没有财务专属的页面。
 * 数字全部来自内存里的小表和现有的聚合缓存（spend_rollup 经 stats/views.js、inc_rollup 经 income/views.js、净资产在内存里算），首页不新增逐条查询。
 * 「注意事项」点开是 #/alerts：从提醒总线取全部提醒，排序下拉（按轻重 / 按房产 / 按来源 / 按到期）。各模块只把自己的提醒注册进总线，首页不认识任何模块。
 * 设计说明见 docs/design-today.md。 */
import { state } from "./core/state.js";
import { aiIcon, aiQuota, aiReady } from "./core/ai.js";
import { Store } from "./core/store.js";
import { href } from "./core/router.js";
import { esc, money, num, spaceOf } from "./core/util.js";
import { joinList, locale, t } from "./core/i18n.js";
import { propertyActive } from "./core/lifecycle.js";
import { SEVERITY_CLS, SEVERITY_LABEL, SOURCE_ICON, SOURCE_LABEL, alertCounts, alertRow, collectAlerts, liveProperties, multiProperty, propertyName, propertyTag, withProperty } from "./core/alerts.js";
import { financeOk, quickOk } from "./core/finance-access.js";
import { lastMonths, monthLabel, spendAgg } from "./stats/views.js";
import { incAggregate, livingSeries, outflowSeries, withHousingSeries } from "./stats/report.js";
import { incRollupFor } from "./income/views.js";
import { liveNetWorth, thisMonth } from "./bills/nw-logic.js";
import { monthChange, trendPoints } from "./stats/net-worth.js";
import { upcoming } from "./bills/logic.js";
import { clearFiltersBtn } from "./core/clear-filters.js";
import { assetsDueCount } from "./house/assets.js";

const PREF_KEY = "hmh-today";
export function setTodayPref(patch) {
  Object.assign(state.today, patch);
  try { localStorage.setItem(PREF_KEY, JSON.stringify(state.today)); } catch { /* 忽略 */ }
}

/** 首页提醒按偏好过滤（只看我负责的） */
function myAlerts() {
  let all = collectAlerts();
  const me = state.user?.id;
  if (state.today.mine && me) all = all.filter((x) => !x.assigned_to || x.assigned_to === me);
  return all;
}

/* ── 折叠：每块一个 <details>，状态记在本机（state.today.fold = { 块: true 表示收起 }）；只记不重画 ── */
const folded = (k) => !!state.today.fold?.[k];
if (typeof document !== "undefined") document.addEventListener("toggle", (e) => {   // toggle 不冒泡，用捕获
  const d = e.target; if (!d?.matches?.("details[data-fold]")) return;
  const k = d.dataset.fold, shut = !d.open;
  if (folded(k) !== shut) setTodayPref({ fold: { ...(state.today.fold || {}), [k]: shut } });
}, true);
/** 一块：标题在 summary 里（h3，问候是 h2，读屏能按标题跳），右边一个小计数；body 是内容 */
const block = (k, { icon = "", title, count = "", cls = "", body }) => `<section class="section tsec-wrap ${cls}" aria-labelledby="th-${k}">
  <details class="tsec" data-fold="${k}" ${folded(k) ? "" : "open"}>
    <summary><h3 id="th-${k}"><span aria-hidden="true">${icon}</span> ${title}</h3>${count}<span class="tchev" aria-hidden="true">›</span></summary>
    <div class="tsec-body">${body}</div>
  </details></section>`;
const countPill = (n, cls = "") => (n ? `<span class="badge mcount ${cls}">${n}</span>` : "");

/* ───────────── 今日 ───────────── */
export function viewToday() {
  const all = myAlerts(), counts = alertCounts(all), fin = financeOk();
  const noProfile = state.houseEnabled && state.propertyId && !state.houseProfiles[state.propertyId];
  const left = [aiBlock(), todoBlock(all, counts)].join("");
  const right = [homeBlock(fin), fin && state.billsEnabled ? moneyBlock() : "", quickBlock()].join("");
  return `
    ${headHtml(all, counts)}
    ${noProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>${t("还没填房屋资料")}</b><p class="muted">${t("填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的房屋耗材。")}</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></div></section>` : ""}
    <div class="today-layout"><div class="today-col">${left}</div><div class="today-col">${right}</div></div>`;
}

/** 问候 + 日期 + 一句话状态 */
function headHtml(all, counts) {
  const h = new Date().getHours(), hi = h < 5 ? t("夜深了") : h < 11 ? t("早上好") : h < 13 ? t("中午好") : h < 18 ? t("下午好") : t("晚上好");
  const dateText = new Date().toLocaleDateString(locale(), { month: "long", day: "numeric", weekday: "long" });
  const name = state.displayName && state.displayName !== "我" && state.displayName !== t("我") ? state.displayName : "";
  const status = counts.important ? t("今天有 {n} 件事要处理", { n: counts.important })
    : all.length ? t("没有急事，{n} 件可以留意", { n: all.length }) : t("没有要处理的事 ✓");
  return `<section class="section today-head">
    <p class="today-date">${esc(dateText)}</p>
    <h2 class="today-hi">${esc(name ? t("{hi}，{name}", { hi, name }) : hi)}</h2>
    <p class="today-status ${counts.important ? "is-hot" : "is-calm"}" role="status">${esc(status)}</p></section>`;
}

/* ── 待办 · 按模块：每个模块一行（数量 + 最近的一件），点进模块自己的页面 ──
 * 来源全是提醒总线（已经按财务权限去掉了预算 / 收入 / 借贷）+ 内存里的采购清单；链接再过一遍 quickOk，没权限的页面不会出现 */
const AREAS = () => [
  { src: ["bill"], icon: "🧾", name: "周期性账单", href: href("bills", "recurring"), on: state.billsEnabled },
  { src: ["medical"], icon: "🏥", name: "一次性账单", href: href("bills", "onetime"), on: state.billsEnabled },
  { src: ["debt"], icon: "🏦", name: "借贷还款", href: href("bills", "debts"), on: state.billsEnabled },
  { src: ["card"], icon: "💳", name: "卡与账户", href: href("bills", "cards"), on: state.billsEnabled },
  { src: ["budget"], icon: "💰", name: "预算", href: href("bills", "budget"), on: state.billsEnabled },
  { src: ["income"], icon: "🤝", name: "收入还款", href: `${href("bills", "income")}?tab=records`, on: state.billsEnabled },
  { src: ["asset"], icon: "⚙️", name: "设备保养", href: href("house", "assets"), on: state.houseEnabled },
  { src: ["season"], icon: "📅", name: "季节任务", href: `${href("house")}?todo=season`, on: state.houseEnabled },   // 季节任务、交易可能分属几套房产：先到房屋首页的「各房产要处理的事」看全部
  { src: ["deal"], icon: "📝", name: "交易", href: `${href("house")}?todo=deal`, on: state.houseEnabled },
  { src: ["pantry"], icon: "🥫", name: "储藏补货", href: href("pantry", "overview"), on: true },
  { src: ["house"], icon: "🧰", name: "房屋耗材 · HOA · 保险", href: `${href("house")}?todo=house`, on: state.houseEnabled },
  { src: ["finance"], icon: "📈", name: "财务", href: href("bills", "overview"), on: state.billsEnabled },
  { src: ["join"], icon: "👥", name: "加入申请", href: `${href("me", "settings")}?sec=family`, on: true },
];
/** 待办的行（导出给测试用）：[{ name, icon, href, n, worst, first }] */
export function todoRows(all = myAlerts()) {
  const rows = [];
  const open = state.shopping.filter((s) => s.status === "todo"), claimed = state.shopping.filter((s) => s.status === "claimed");
  if (open.length + claimed.length) {
    const who = joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))]);
    rows.push({ name: t("采购清单"), icon: "🛒", href: href("shopping"), n: open.length + claimed.length, worst: 3,
      first: open.length ? (claimed.length ? t("{n} 项待买，{m} 项家人正在买", { n: open.length, m: claimed.length }) : t("{n} 项待买", { n: open.length })) : t("{who} 正在买", { who }) });
  }
  for (const a of AREAS()) {
    if (!a.on || !quickOk(a.href)) continue;
    const items = all.filter((x) => a.src.includes(x.source));
    if (!items.length) continue;
    const top = items[0];   // 总线已经按轻重 → 必须 → 到期排好
    const spread = multiBucket(items);   // 分属几套房产 / 车辆：首行写分布（例如「自住 2 台 · 车辆 1 台」），免得和某一套房产页上的数字对不上
    rows.push({ name: t(a.name), icon: a.icon, href: spread && a.src[0] === "asset" ? `${href("house")}?todo=asset` : a.href, src: a.src,   // 设备分属几处：去房屋页签的「各房产要处理的事」，不进某一套房产的设备页
      n: a.src[0] === "asset" ? assetsDueCount() || items.length : items.length,   // 设备按台数（一辆车两条提醒算 1 台），和房屋首页、设备页同一个口径
      worst: Math.min(...items.map((x) => x.severity)),
      first: spread || `${withProperty(top.property_id, top.title)}${top.detail ? ` · ${top.detail}` : ""}` });
  }
  return rows.sort((x, y) => x.worst - y.worst);
}
/** 一组提醒分属不止一处（几套房产、车辆、与房产无关）时的分布文字；只有一处返回 ""。设备按台数去重 */
function multiBucket(items) {
  const isAsset = items[0]?.source === "asset", m = new Map();
  for (const x of items) {
    const veh = isAsset && !x.property_id, k = veh ? "veh" : x.property_id || "none";
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(isAsset ? x.asset_id || x.title : `${x.title}|${x.due || ""}|${m.get(k).size}`);
  }
  if (m.size < 2) return "";
  const name = (k) => (k === "veh" ? t("车辆") : k === "none" ? t("其他") : propertyName(k) || t("其他"));
  return [...m].map(([k, set]) => `${name(k)} ${isAsset ? t("{n} 台", { n: set.size }) : t("{n} 件", { n: set.size })}`).join(" · ");
}
function todoBlock(all, counts) {
  const rows = todoRows(all);
  const pills = [0, 1, 2, 3].filter((s) => counts.bySeverity[s]).map((s) => `<span class="pill sev-${s}"><i>${counts.bySeverity[s]}</i>${t(SEVERITY_LABEL[s])}</span>`).join("");
  const top = all.length ? `<div class="ttodo-top">${pills ? `<div class="pills tatt-pills" aria-label="${esc(t("按轻重"))}">${pills}</div>` : ""}<a class="tmore" href="${href("alerts")}">${t("全部 {n} 件，按轻重 / 到期排", { n: all.length })} ›</a></div>` : "";
  const row = (r) => `<a class="mrow" href="${esc(r.href)}"><span class="mi" aria-hidden="true">${r.icon}</span>
      <span class="mt"><b>${esc(r.name)}</b><small>${esc(r.first)}</small></span>
      <span class="badge mcount ${r.worst <= 2 ? SEVERITY_CLS[r.worst] : ""}">${r.n}</span><span class="mch" aria-hidden="true">›</span></a>`;
  const body = rows.length ? `${top}<div class="panel mlist">${rows.map(row).join("")}</div>`
    : `<div class="panel empty tempty"><strong>${t("各处都没有待办 ✓")}</strong>${t("采购清单是空的，账单、保养和季节任务都不急。")}</div>`;
  return block("todo", { icon: counts.important ? "🔔" : "🗂️", title: t("待办 · 按模块"), count: countPill(counts.important || rows.length, counts.important ? "b-out" : ""), cls: counts.important ? "is-hot" : "", body });
}

/* ── 钱 · 本月（只给家主和有财务权限的人；调用前已判断）：数字来自 spend_rollup / inc_rollup 的缓存和内存里的账单、净资产 ── */
const kpiLink = (h, label, value, small = "", cls = "") => `<a class="kpi tkpi" href="${esc(h)}"><span>${label}</span><b class="${cls}">${value}</b>${small ? `<small>${small}</small>` : ""}</a>`;
const LOADING = () => `<span class="muted" aria-label="${esc(t("加载中…"))}">…</span>`;
function moneyBlock() {
  const ms = lastMonths(6), A = spendAgg(ms, 6), cm = ms.at(-1), pm = ms.at(-2), cur = Units.region.currency;   // 和 财务 → 概览 的「花费速览」同一份缓存（6 个月 → 读近 12 个月的聚合）
  const L = A ? livingSeries(A) : null, H = A ? withHousingSeries(A) : null, O = A ? outflowSeries(A) : null;
  const incRows = incRollupFor([pm, cm]), I = incRows ? incAggregate(incRows, [pm, cm], { cur }) : null;   // 两个月的收入聚合，读一次缓存
  const bills = state.billsEnriched.filter((b) => b.active && !b.ended && b.direction !== "receivable");
  const next30 = upcoming(bills, 30), due30 = next30.filter((x) => (x.bill.currency || cur) === cur).reduce((s, x) => s + num(x.bill.est), 0);
  const cards = [
    kpiLink(href("bills", "spend"), t("本月日常"), A ? `${money(L.at(-1))} <span class="kpi-sub">/ ${t("含住房")} ${money(H.at(-1))}</span>` : LOADING(),
      A ? t("{m}：{a} / {b}", { m: monthLabel(pm), a: money(L.at(-2)), b: money(H.at(-2)) }) : ""),
    kpiLink(href("bills", "spend"), t("本月现金流出"), A ? money(O.at(-1)) : LOADING(), A ? t("{m}：{a}", { m: monthLabel(pm), a: money(O.at(-2)) }) : ""),
    kpiLink(href("bills", "recurring"), t("未来 30 天账单"), money(due30), t("{n} 笔账单", { n: next30.length })),
    kpiLink(href("bills", "income"), t("本月收入"), I ? money(I.income[cm]) : LOADING(), I ? t("{m}：{a}", { m: monthLabel(pm), a: money(I.income[pm]) }) : ""),
  ];
  if (state.nwOk) {
    const r = liveNetWorth(), m = thisMonth(), mom = monthChange(trendPoints(state.nwSnapshots, cur, { live: r, month: m }), m);
    cards.push(kpiLink(href("bills", "networth"), t("净资产"), money(r.netWorth), mom == null ? t("上个月没有快照") : t("比上月 {d}", { d: `${mom > 0 ? "+" : mom < 0 ? "−" : ""}${money(Math.abs(mom))}` }), r.netWorth < 0 ? "down" : ""));
  }
  return block("money", { icon: "💰", title: t("钱 · 本月"), body: `<div class="kpis tkpis">${cards.join("")}</div><a class="tmore" href="${href("bills")}">${t("去财务")} ›</a>` });
}

/* ── 家里 · 一览：库存、采购、设备；没有财务权限的家人还看到本月账单的笔数（不显示金额） ── */
function homeBlock(fin) {
  const items = state.enriched || [], inSpace = (sp) => items.filter((x) => spaceOf(x.category) === sp);
  const pantry = inSpace("pantry"), short = pantry.filter((x) => x.status === "out" || x.status === "low").length;
  const shop = state.shopping.filter((s) => s.status === "todo" || s.status === "claimed").length;
  const cards = [kpiLink(href("pantry", "overview"), t("储藏"), short ? t("{n} 件要补货", { n: short }) : t("都够用"), t("共 {n} 件", { n: pantry.length }), short ? "down" : ""),
    kpiLink(href("shopping"), t("采购清单"), shop ? t("{n} 项", { n: shop }) : t("空的"), shop ? t("去看看谁在买") : t("想到要买的随手加"))];
  if (state.houseEnabled) {
    const live = new Set(liveProperties().filter(propertyActive).map((p) => p.id));
    const eq = (state.assetsEnriched || []).filter((a) => !a.retired && live.has(a.property_id));
    const due = assetsDueCount();   // 和待办「设备保养」、房屋首页同一个口径
    cards.push(kpiLink(href("house", "assets"), t("设备"), due ? t("{n} 台该保养", { n: due }) : t("都正常"), t("共 {n} 台", { n: eq.length }), due ? "down" : ""));
  }
  if (!fin && state.billsEnabled) {   // 账单全家可见：这里只给笔数，不给金额
    const n = upcoming(state.billsEnriched.filter((b) => b.active && !b.ended && b.direction !== "receivable"), 30).length;
    cards.push(kpiLink(href("bills", "recurring"), t("未来 30 天账单"), t("{n} 笔账单", { n }), t("到期前会出现在需要注意里")));
  }
  return block("home", { icon: "🏡", title: t("家里 · 一览"), body: `<div class="kpis tkpis">${cards.join("")}</div>` });
}

/* ── 咩咩咩（AI）：和以前的格子同样的说明，外加「今天吃什么」 ── */
function aiBlock() {
  const sub = aiReady() ? (aiQuota().ok ? t("直接问：保养、账单、买卖房、收纳、带娃") : t("免费额度用完了，先用复制提示词")) : t("问家里任何事，复制提示词到任一 AI");
  return block("ai", { icon: "", title: `${aiIcon(20)} ${t("咩咩咩")}`, body: `<div class="panel tai">
      <p class="muted" style="margin:0">${sub}</p>
      <div class="form-actions tai-acts"><a class="btn btn-primary btn-sm" href="${href("ai")}">${t("问咩咩")}</a>
        <a class="btn btn-ghost btn-sm" href="${href("pantry", "meals")}?ai=">🍳 ${t("今天吃什么")}</a></div></div>` });
}

/* ── 快捷操作：每位用户自己的一份（云端存在账号上，换设备也在；演示模式存本机）；编辑模式点格子改成别的、长按拖动排序 ── */
function quickBlock() {
  const mine = quickList().map((id) => PRESETS().find((p) => p[0] === id)).filter(Boolean);   // 没权限的（已存的也一样）在这里就掉了：不画
  const editing = !!state.quickEdit;
  const tileBody = ([, ic, nm]) => `<span class="qtile-ico" aria-hidden="true">${ic}</span><span>${nm}</span>`;
  const tileHtml = ([id, ic, nm]) => `<div class="qwrap" data-qid="${esc(id)}">${editing
      ? `<button type="button" class="qtile" data-action="quick-swap" data-id="${esc(id)}" aria-label="${esc(t("把「{name}」改成别的快捷操作", { name: nm }))}">${tileBody([id, ic, nm])}</button>`
      : id.startsWith("action:")
        ? `<button type="button" class="qtile" data-action="quick-run" data-id="${esc(id)}">${tileBody([id, ic, nm])}</button>`
        : `<a class="qtile" href="${esc(quickHref(id))}">${tileBody([id, ic, nm])}</a>`}
    ${editing ? `<button type="button" class="qdel" data-action="quick-del" data-id="${esc(id)}" aria-label="${esc(t("移除快捷操作：{name}", { name: nm }))}">×</button>` : ""}</div>`;
  const taken = new Set(mine.map((x) => x[0]));
  const choices = PRESETS().filter(([id]) => !taken.has(id));
  const swapId = editing ? state.quickSwap : null, swapping = swapId && mine.find((x) => x[0] === swapId);
  const pickChoices = swapping ? [swapping, ...choices] : choices;   // 改成别的：当前这个也在选项里（选回它 = 不变）
  const addPanel = editing && (state.quickAdd || swapping) ? `<div class="panel quick-add"><label>${swapping ? t("把「{name}」改成", { name: swapping[2] }) : t("添加到快捷操作")}<select id="quickSel">${pickChoices.map(([id, ic, nm]) => `<option value="${esc(id)}" ${swapping && id === swapId ? "selected" : ""}>${ic} ${esc(nm)}</option>`).join("")}</select></label>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-action="${swapping ? "quick-swap-do" : "quick-add"}" ${pickChoices.length ? "" : "disabled"} ${swapping ? `data-id="${esc(swapId)}"` : ""}>${swapping ? t("改成这个") : t("添加")}</button><button type="button" class="btn btn-ghost btn-sm" data-action="quick-open">${t("取消")}</button></div></div>` : "";
  const quick = mine.map(tileHtml).join("")
    + (editing && choices.length ? `<div class="qwrap"><button type="button" class="qtile qtile-add" data-action="quick-open" aria-expanded="${state.quickAdd ? "true" : "false"}"><span class="qtile-ico" aria-hidden="true">＋</span><span>${t("添加")}</span></button></div>` : "");
  // 编辑按钮放在内容里（summary 里不能放按钮）
  const bar = `<div class="tquick-bar"><span class="muted">${editing ? t("点格子换成别的，长按拖动排序") : ""}</span><div class="head-acts">
      ${editing ? `<button type="button" class="btn btn-sm btn-ghost" data-action="quick-reset">${t("恢复默认")}</button>` : ""}
      <button type="button" class="btn btn-sm ${editing ? "btn-primary" : "btn-ghost"}" data-action="quick-edit" aria-pressed="${editing ? "true" : "false"}">${editing ? t("完成") : t("编辑")}</button></div></div>`;
  return block("quick", { icon: "⚡", title: t("快捷操作"), body: `${bar}<div class="quick-grid ${editing ? "is-editing" : ""}">${quick || `<p class="muted">${t("还没有快捷操作，点“编辑”添加。")}</p>`}</div>${addPanel}` });
}

/* ── 每位用户自己的快捷操作：地址（或 action:xxx）的有序列表 ──
 * 云端存在登录账号的 user_metadata.quick，换设备也在，家人之间互不影响；演示模式存本机 */
const QUICK_KEY = "hmh-quick";
/** 默认的一份（按角色）：有财务权限 = 录入购物、记花费、采购、添加账单、记收入、财务概览；没有 = 录入购物、记花费、采购、储藏、设备保养、季节任务。
 *  模块关掉的、没权限的自动跳过，用后面的补足 6 个 */
export const DEFAULT_QUICK = () => {
  const want = financeOk()
    ? [href("scan"), SPEND_ADD(), href("shopping"), href("bill", "new"), INCOME_ADD(), href("bills", "overview"), href("pantry", "overview"), href("house", "assets")]
    : [href("scan"), SPEND_ADD(), href("shopping"), href("pantry", "overview"), href("house", "assets"), href("house", "tasks"), href("pantry", "inventory"), href("pantry", "meals")];
  const ok = new Set(PRESETS().map((p) => p[0]));
  return want.filter((id) => ok.has(id)).slice(0, 6);
};
const SPEND_ADD = () => `${href("bills", "spend")}?tab=records&add=1`;                // 花费页直接展开「记一笔」表单（main.js 的 onRoute）
const INCOME_ADD = () => `${href("bills", "income")}?tab=records&add=1`;   // 收入明细直接展开「记一笔收入」（main.js 的 onRoute）
/** 改过地址的旧快捷操作：读出来时换成新的，已存的列表不会掉格子 */
const LEGACY = () => ({ [`${href("bills", "spend")}?tab=records`]: SPEND_ADD(), ...(state.billsEnabled ? { [href("me", "stats")]: href("bills", "spend") } : {}) });
export function quickList() {
  let list = null;
  if (Store.mode === "cloud") list = state.user?.user_metadata?.quick;
  else { try { list = JSON.parse(localStorage.getItem(QUICK_KEY) || "null"); } catch { list = null; } }
  if (!Array.isArray(list)) return DEFAULT_QUICK();
  const map = LEGACY();
  return [...new Set(list.map((id) => map[id] || id))];   // 旧的“看花费统计”（我的 → 统计）在财务开着时改指向 财务 → 花费，旧的「补记一笔花费」改成直接打开表单；并去掉重复
}
export async function saveQuick(list) {
  if (Store.mode === "cloud") {
    const { data, error } = await Store.sb.auth.updateUser({ data: { quick: list } });
    if (error) throw new Error(error.message);
    state.user = data.user;
  } else { try { localStorage.setItem(QUICK_KEY, JSON.stringify(list)); } catch { /* 忽略 */ } }
}
/** 快捷操作的实际地址：财务的页面带 ?prop=all（每次回到全部房产；已经带参数的用 & 接） */
export const quickHref = (id) => (id.startsWith("#/bills") ? `${id}${id.includes("?") ? "&" : "?"}prop=all` : id);
/** 可放进快捷操作的页面与动作：[标识, 图标, 名称]。名称跟着新的信息架构：「账单」那一栏现在叫「财务」 */
export const PRESETS = () => {
  const B = state.billsEnabled, H = state.houseEnabled, G = state.gearEnabled;
  return [
    // 常用动作
    [href("scan"), "🧾", t("录入购物")], B ? [SPEND_ADD(), "✍️", t("记一笔花费")] : null, [href("shopping"), "🛒", t("采购清单")],
    B ? [href("bill", "new"), "➕", t("添加账单")] : null, B ? [INCOME_ADD(), "💵", t("记一笔收入")] : null, B ? [`${href("bills", "onetime")}?bill=new`, "🏥", t("记一张一次性账单")] : null,
    // 储藏
    [href("pantry", "overview"), "🥫", t("储藏概览")], [href("pantry", "inventory"), "📦", t("库存")], [href("pantry", "meals"), "🍳", t("今天吃什么")], [`${href("item", "new")}?space=pantry`, "➕", t("添加储藏物品")],
    G ? [href("pantry", "gear"), "🧳", t("装备")] : null, G ? [`${href("item", "new")}?space=gear`, "🧳", t("添加装备")] : null,
    // 房屋（日常运营）
    H ? [href("house"), "🏠", t("房屋")] : null, H ? [href("house", "assets"), "⚙️", t("设备保养")] : null, H ? [href("asset", "new"), "🛠️", t("添加设备")] : null, H ? [href("house", "tasks"), "📅", t("季节任务")] : null,
    H ? [href("house", "deal"), "📝", t("交易")] : null, H ? [href("house", "vehicles"), "🚗", t("车辆")] : null, H ? [href("house", "profile"), "📋", t("房屋资料")] : null,
    H ? [`${href("pantry", "inventory")}?space=house`, "🧰", t("房屋耗材")] : null, H ? [`${href("item", "new")}?space=house`, "➕", t("添加房屋耗材")] : null,
    // 财务（收支 · 账户与资产 · 借贷 · 预算与计划 · 分析）；没有财务权限的那几页由 quickOk 去掉
    B ? [href("bills"), "💰", t("财务")] : null, B ? [href("bills", "overview"), "📊", t("财务概览")] : null,
    B ? [href("bills", "spend"), "📊", t("花费")] : null, B ? [href("bills", "income"), "💵", t("收入")] : null, B ? [href("bills", "recurring"), "🔁", t("周期性账单")] : null, B ? [href("bills", "onetime"), "🏥", t("一次性账单")] : null,
    B ? [href("bills", "list"), "📋", t("账单清单")] : null, B ? [href("bills", "history"), "🕘", t("缴费记录")] : null, B ? [href("bills", "template"), "🧾", t("按模板建账单")] : null, B ? [href("bills", "statements"), "🏦", t("对账单")] : null,
    B ? [href("bills", "cards"), "💳", t("用卡：该刷哪张")] : null, B ? [`${href("bills", "cards")}?card=new`, "💳", t("添加信用卡")] : null, B ? [href("bills", "assets"), "🏛️", t("资产")] : null,
    B ? [href("bills", "debts"), "🏦", t("借贷")] : null, B ? [href("bills", "budget"), "💰", t("预算")] : null, B ? [href("bills", "networth"), "📈", t("净资产")] : null,
    // 其他
    [href("alerts"), "🔔", t("注意事项")], [href("ai"), "🤖", t("咩咩咩")], !B ? [href("me", "stats"), "📊", t("花费统计")] : null, [href("me", "settings"), "⚙️", t("设置")],
    ["action:print", "🖨️", t("打印")],
  ].filter(Boolean).filter(([id]) => quickOk(id));   // 没有财务权限：对账单 / 收入 / 预算 / 资产 / 借贷 / 净资产 / 添加信用卡不出现，也加不进来（已存的照样不显示）
};


/* ───────────── 注意事项：清单 + 排序下拉；“全部 / 某来源”一页一页左右滑（桌面点 ‹ ›），每次进来都回到“全部” ───────────── */
const SORTS = [["severity", "按轻重"], ["due", "按到期"], ["source", "按来源"], ["property", "按房产"]];
/** 来源页的顺序：全部，然后按提醒总线的来源顺序只列有提醒的 */
export function alertSourceTabs(counts = alertCounts(myAlerts())) {
  return ["all", ...Object.keys(SOURCE_LABEL).filter((k) => counts.bySource[k])];
}
/** 左右滑动 / ‹ ›：换到上一个或下一个来源页（到头不循环） */
export function shiftAlertSource(delta) {
  const tabs = alertSourceTabs();
  const cur = state.today.source && tabs.includes(state.today.source) ? state.today.source : "all";
  const i = Math.min(tabs.length - 1, Math.max(0, tabs.indexOf(cur) + delta));
  setTodayPref({ source: tabs[i] === "all" ? null : tabs[i] });
}
export function viewAlerts() {
  const pref = state.today;
  const all = myAlerts(), counts = alertCounts(all);
  const canMine = Store.mode === "cloud" && collectAlerts().some((x) => x.assigned_to);
  const tabs = alertSourceTabs(counts);
  const src = pref.source && counts.bySource[pref.source] ? pref.source : null;
  const idx = tabs.indexOf(src || "all");
  const shown = src ? all.filter((x) => x.source === src) : all;
  const mode = SORTS.some(([k]) => k === pref.mode) ? pref.mode : "severity";
  const sorts = SORTS.filter(([k]) => k !== "property" || multiProperty()).map(([k, n]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${t(n)}</option>`).join("");
  const toggle = (key, label, on) => `<button type="button" class="chip" data-action="today-pref" data-key="${key}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
  const body = mode === "property" && multiProperty() ? byProperty(shown) : mode === "source" && !src ? bySource(shown) : mode === "due" ? byDue(shown) : bySeverity(shown);
  const tabName = (k) => (k === "all" ? t("全部") : `${SOURCE_ICON[k] || ""} ${t(SOURCE_LABEL[k] || k)}`);
  const tabCount = (k) => (k === "all" ? all.length : counts.bySource[k] || 0);
  // 来源筛选：下拉列表（全部 / 各来源 + 数量），换来源不用左右翻页
  const pager = tabs.length > 1 ? `<label class="src-dd"><span class="sr-only">${t("提醒来源")}</span><select id="alertSource" aria-label="${t("提醒来源")}">${tabs.map((k) => `<option value="${k}" ${k === tabs[idx] ? "selected" : ""}>${tabName(k)} (${tabCount(k)})</option>`).join("")}</select></label>` : "";
  const restockHere = src === "pantry" && all.some((x) => x.source === "pantry" && x.actions?.some((a) => a.action === "shop-add-item"));   // 只有选了「储藏」才显示；其他来源（账单、房屋…）和「全部」都不显示
  const tools = canMine || restockHere ? `<div class="chips today-chips">
        ${canMine ? toggle("mine", t("只看我负责的"), !!pref.mine) : ""}
        ${restockHere ? `<button type="button" class="chip" data-action="shop-add-alerts" data-space="pantry">${t("补货全部加入采购清单")}</button>` : ""}
      </div>` : "";

  return `
    <nav class="crumb crumb-tools" aria-label="${t("当前位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("注意事项")}</b>
      <label class="sort-dd"><span class="sr-only">${t("排序")}</span><select id="alertSort" aria-label="${t("排序")}">${sorts}</select></label></nav>
    <section class="section today-head">${pager}${tools}${clearFiltersBtn("alerts", !!src || !!pref.mine)}</section>
    <div>${body}</div>`;
}

const section = (title, sub, items) => (items.length ? `<section class="section">
    <div class="section-head"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
    <div class="panel"><ul class="restock-list alert-list">${items.map(alertRow).join("")}</ul></div>
  </section>` : "");
const EMPTY = () => `<section class="section"><div class="panel empty"><strong>${t("今天没有需要处理的事")}</strong></div></section>`;

function bySeverity(list) {
  const SUB = [t("已经过期，先处理"), t("今天到期或今天要做"), t("一周内到期、待核对的自动扣款、缺货"), t("少货、临期、本月季节任务")];
  return [0, 1, 2, 3].map((s) => section(t(SEVERITY_LABEL[s]), SUB[s], list.filter((x) => x.severity === s))).join("") || EMPTY();
}

function byProperty(list) {
  const groups = liveProperties().filter((p) => propertyActive(p) || list.some((x) => x.property_id === p.id)).map((p) => ({ title: `🏠 ${esc(p.name)}`, sub: t(window.DEALS.PROPERTY_STATUS[p.status] || "持有"), items: list.filter((x) => x.property_id === p.id) }));
  groups.push({ title: t("与房产无关"), sub: t("手机、车险、订阅等"), items: list.filter((x) => !x.property_id && x.source !== "pantry" && x.source !== "house") });
  groups.push({ title: t("家里的储藏"), sub: t("补货与临期"), items: list.filter((x) => !x.property_id && (x.source === "pantry" || x.source === "house")) });
  return groups.map((g) => section(g.title, g.sub, g.items)).join("") || EMPTY();
}

function bySource(list) {
  const order = Object.keys(SOURCE_LABEL);
  const srcs = [...new Set(list.map((x) => x.source))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return srcs.map((s) => { const items = list.filter((x) => x.source === s); return section(`${SOURCE_ICON[s] || ""} ${t(SOURCE_LABEL[s] || s)}`, t("{n} 件", { n: items.length }), items); }).join("") || EMPTY();
}

/** 按到期：有日期的先到先列，没日期的（缺货、少货等）排最后 */
function byDue(list) {
  const dated = list.filter((x) => x.daysLeft != null).sort((a, b) => a.daysLeft - b.daysLeft || a.severity - b.severity);
  const undated = list.filter((x) => x.daysLeft == null);
  return (section(t("按到期先后"), t("逾期的在最前"), dated) + section(t("没有日期"), t("缺货、少货等"), undated)) || EMPTY();
}

export { propertyName };
