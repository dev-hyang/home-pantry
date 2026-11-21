/* 首页 · 今日（2026-11 重排，配合 房屋 / 财务 的新信息架构；11-02 再调）：
 *   问候 + 一句话状态 → 咩咩咩 → 待办 · 按模块（顶上是轻重计数 + 「查看全部」）‖ 家里 · 一览 → 钱 · 本月（只给有财务权限的人）→ 快捷操作
 * 原来单独的「需要注意」块去掉了：它和「待办 · 按模块」是同一份提醒的两种排法，轻重计数并进待办的块头，完整清单仍在 #/alerts；
 * 每个模块自己的页面顶上（看板数字下面）列这个模块要处理的事（见 core/alerts.js 的 attentionPanel）。
 * 宽屏两栏（左：咩咩和要做的事；右：看一眼的数字和快捷操作），手机一栏；每块都能折叠，折叠状态记在这台设备上（hmh-today 的 fold）。
 * 角色：没有财务权限的家人看不到「钱 · 本月」整块（不是 CSS 隐藏，是根本不画），待办里没有预算 / 收入 / 借贷，快捷操作里没有财务专属的页面。
 * 数字：购物车、储藏补货、待缴账单来自内存里的小表；本月花费 / 收入只读最近 2 个月的聚合（core/home-money.js）。首页不读提醒总线、不放净资产，
 *   不依赖统计页 / 收入页 / 设备页（这些页面点进去才加载）；全部模块的提醒在「全部待办和提醒」（alerts-page.js，点开才加载）。
 * 「注意事项」点开是 #/alerts：从提醒总线取全部提醒，排序下拉（按轻重 / 按房产 / 按来源 / 按到期）。各模块只把自己的提醒注册进总线，首页不认识任何模块。
 * 设计说明见 docs/design-today.md。 */
import { state } from "./core/state.js";
import { moneyEye } from "./core/privacy.js";
import { carouselHtml } from "./core/carousel.js";
import { currentWeather, enableWeather, wxLoc } from "./core/weather.js";
import { aiIcon, aiQuota, aiReady } from "./core/ai.js";
import { Store } from "./core/store.js";
import { href } from "./core/router.js";
import { releaseBadgeHTML } from "./core/releases-ui.js";
import { esc, money, num, spaceOf } from "./core/util.js";
import { joinList, locale, t } from "./core/i18n.js";
import { propertyActive } from "./core/lifecycle.js";
import { financeOk, quickOk } from "./core/finance-access.js";
import { homeMoney, lastMonths, monthLabel } from "./core/home-money.js";
import { billInstances, rangeBounds, summarize } from "./bills/instances.js";
import { allBillsHref } from "./bills/all-href.js";
import { todayISO } from "./core/util.js";
import { deviceLinkPrompt, myPersonOf, personNameOf } from "./settings/family-lite.js";

const PREF_KEY = "hmh-today";
/** 今日页的「待缴账单」：未来 30 天范围内没缴清的账单期（含逾期、含一次性），数字和点进去的「全部账单」列表对得上 */
const UNPAID30_HREF = allBillsHref({ range: "30d", status: "unpaid" });
function unpaid30() {
  const today = todayISO(), { from, to } = rangeBounds("30d", today), cur = Units.region.currency;
  const { rows } = billInstances({ recurring: state.billsEnriched, onetime: state.medEnriched }, { from, to, today });
  const S = summarize(rows.filter((r) => !["paid", "skipped", "written_off"].includes(r.status) && !r.escrow), { cur, today });
  return { n: S.remaining.n, amount: S.remaining.amount };
}

export function setTodayPref(patch) {
  Object.assign(state.today, patch);
  try { localStorage.setItem(PREF_KEY, JSON.stringify(state.today)); } catch { /* 忽略 */ }
}

/* ── 卡片（2026-11-06 改回卡片：轻便、一眼看完；点卡片进对应页面）── */
/** 一张卡：链接卡（整张可点）或容器卡（里面各行自己可点）。head 是标题行，body 是内容 */
const card = ({ k, icon, title, count = "", href: h = "", headHref = "", headExtra = "", cls = "", body = "" }) => {
  const inner = `<span class="tcard-ico" aria-hidden="true">${icon}</span><h3 id="tc-${k}"><span class="tcard-t">${title}</span>${count}</h3>`;   // 计数紧跟标题（像通知）
  const head = headHref ? `<div class="tcard-head"><a class="tcard-hlink" href="${esc(headHref)}">${inner}<span class="tcard-ch" aria-hidden="true">›</span></a>${headExtra}</div>`
    : `<div class="tcard-head">${inner}${h ? `<span class="tcard-ch" aria-hidden="true">›</span>` : ""}${headExtra}</div>`;
  return h ? `<a class="tcard ${cls}" href="${esc(h)}" aria-labelledby="tc-${k}">${head}${body}</a>`
    : `<section class="tcard ${cls}" aria-labelledby="tc-${k}">${head}${body}</section>`;
};
/** 卡里一行一个链接（家里一览、快捷操作同一个样子） */
const rowLink = (h, icon, label, value = "", hot = false, attrs = "") => `<li><a href="${esc(h)}"${attrs}><span class="tr-ico" aria-hidden="true">${icon}</span><span class="grow">${value ? `<span class="tr-k">${label}</span><b class="tr-v${hot ? " down" : ""}">${value}</b>` : `<span class="tr-k1">${label}</span>`}</span><span class="tcard-ch" aria-hidden="true">›</span></a></li>`;   // 有值的两行（名称小字在上、数在下），窄卡片里不会挤出框

/* ───────────── 今日 ───────────── */
export function viewToday() {
  state.quickEdit = false; state.quickAdd = false; state.quickSwap = null;   // 编辑快捷操作在自己的页面（#/quick）
  const fin = financeOk();
  const noProfile = state.houseEnabled && state.propertyId && !state.houseProfiles[state.propertyId];
  const cards = [todoCard(), homeCard(), fin && state.billsEnabled ? moneyCard() : "", quickCard()].filter(Boolean);
  return `
    ${headHtml()}
    ${Store.mode === "cloud" ? deviceLinkPrompt() : ""}
    ${releaseBadgeHTML() ? `<section class="section today-rl">${releaseBadgeHTML()}</section>` : ""}
    ${aiBlock()}
    ${noProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>${t("还没填房屋资料")}</b><p class="muted">${t("填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的汽车房屋消耗品。")}</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></div></section>` : ""}
    <section class="section" aria-label="${esc(t("今日卡片"))}">${carouselHtml("today", cards, { label: t("今日卡片：左右滑动，或点上面的短划线"), top: true })}</section>`;   // 一屏一张，左右滑、循环、每 30 秒自动换（js/core/carousel.js）
}

/** 日期 · 星期 · 天气 一行小字在上，问候在下；「今天有几件事」不再单独一行（看待办卡标题旁的数字） */
function headHtml() {
  const h = new Date().getHours(), hi = h < 5 ? t("夜深了") : h < 11 ? t("早上好") : h < 13 ? t("中午好") : h < 18 ? t("下午好") : t("晚上好");
  const dateText = new Date().toLocaleDateString(locale(), { month: "long", day: "numeric", weekday: "long" });
  const who = personNameOf(myPersonOf()) || state.displayName;   // 问候用家庭成员的名字；这台设备还没链接家庭成员时才用设备的称呼
  const name = who && who !== "我" && who !== t("我") ? who : "";
  const wx = currentWeather(() => { if (state.route?.section === "today") rerenderToday(); });
  const wxHtml = wx ? `<span class="today-wx" title="${esc(wx.label)}"><span aria-hidden="true">${wx.icon}</span><span class="sr-only">${esc(wx.label)}</span> ${wx.temp}${esc(wx.unit)}</span>`
    : wxLoc() ? "" : `<button type="button" class="today-wx-on" data-action="wx-enable" title="${esc(t("允许定位后显示当地天气（位置只存在这台设备上）"))}">🌤️ ${t("显示天气")}</button>`;
  return `<section class="section today-head">
    <p class="today-date">${esc(dateText)}${wxHtml}</p>
    <h2 class="today-hi">${esc(name ? t("{hi}，{name}", { hi, name }) : hi)}</h2></section>`;
}
let rerenderToday = () => {};
export const initTodayRender = (fn) => { rerenderToday = fn; };

/** 储藏里缺货 / 快用完的件数（只看储藏空间；耐用品、暂停提醒的 enrich 已经排除） */
const restockCount = () => (state.enriched || []).filter((x) => spaceOf(x.category) === "pantry" && (x.status === "out" || x.status === "low")).length;
/** 待办：首页只放能立刻数出来的几件事（购物车、储藏补货、待缴账单）；设备保养、季节任务、预算等各模块的提醒进「全部待办和提醒」（#/alerts，点开才加载） */
function todoCard() {
  const open = state.shopping.filter((s) => s.status === "todo"), claimed = state.shopping.filter((s) => s.status === "claimed");
  const short = restockCount(), rows = [];
  if (open.length + claimed.length) rows.push({ icon: "🛒", name: t("购物车"), href: href("shopping"), n: open.length + claimed.length,
    first: open.length ? (claimed.length ? t("{n} 项待买，{m} 项家人正在买", { n: open.length, m: claimed.length }) : t("{n} 项待买", { n: open.length })) : t("{who} 正在买", { who: joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))]) }) });
  if (short) rows.push({ icon: "🥫", name: t("储藏补货"), href: href("pantry", "overview"), n: short, first: t("{n} 件缺货或快用完", { n: short }) });
  if (state.billsEnabled) { const b = unpaid30(); if (b.n) rows.push({ icon: "🧾", name: t("待缴账单（含逾期）"), href: UNPAID30_HREF, n: b.n, first: t("{n} 笔账单", { n: b.n }) }); }
  const n = rows.reduce((sum, r) => sum + r.n, 0);
  const badge = n ? `<span class="tbadge" aria-label="${esc(t("{n} 件可以留意", { n }))}">${n > 99 ? "99+" : n}</span>` : "";
  const foot = `<p class="tcard-foot"><span></span><a class="tcard-more" href="${href("alerts")}">${t("全部待办和提醒")} ›</a></p>`;
  if (!rows.length) return card({ k: "todo", icon: "🗂️", title: t("待办"), headHref: href("alerts"),
    body: `<div class="tcard-ok"><span class="tok-ico" aria-hidden="true">✓</span><div><b>${t("各处都没有待办")}</b><small>${t("购物车、储藏和账单都没有要处理的。")}</small></div></div>${foot}` });
  const list = rows.map((r) => `<li><a href="${esc(r.href)}"><span class="tr-ico" aria-hidden="true">${r.icon}</span><span class="grow"><span class="tr-k1">${esc(r.name)}</span><small class="tr-sub">${esc(r.first || "")}</small></span><span class="badge mcount attn-count">${r.n}</span><span class="tcard-ch" aria-hidden="true">›</span></a></li>`).join("");
  return card({ k: "todo", icon: "🗂️", title: t("待办"), count: badge, headHref: href("alerts"), body: `<ul class="tcard-list ttodo-list">${list}</ul>${foot}` });
}

/* ── 钱 · 本月（只给家主和有财务权限的人；调用前已判断）：数字来自 spend_rollup / inc_rollup 的缓存和内存里的账单、净资产 ── */
const LOADING = () => `<span class="muted" aria-label="${esc(t("加载中…"))}">…</span>`;
/* 金额遮挡：全局一套（js/core/privacy.js）。钱卡的金额带 data-money，遮挡模式下模糊、点一个露 10 秒；标题旁是同一只眼睛 */
const mask = (html) => `<span data-money>${html}</span>`;
function moneyCard() {
  const M = homeMoney(() => rerenderToday()), A = !!M, [pm, cm] = M?.months || lastMonths(2);   // 只读最近 2 个月的聚合（core/home-money.js），不再借用统计页的缓存
  const L = M?.living, H = M?.housing, O = M?.outflow, I = M?.income ? { income: M.income } : null;
  const next30 = unpaid30(), due30 = next30.amount;   // 和「全部账单」同一口径（未来 30 天范围内没缴清的，含逾期、含一次性）
  const inc = I ? num(I.income[cm]) : null, out = A ? num(O.at(-1)) : null, bal = inc != null && out != null ? inc - out : null;
  const amt = (v, cls = "") => `<b class="num ${cls}">${String(v).includes("…") ? v : mask(v)}</b>`, small = (x) => `<small>${x}</small>`;
  // 2026-11-14：每一行进对应的明细页（遮挡时点金额只露 10 秒、不跳转；点名称才跳转——js/core/privacy.js）
  const OV = `${href("bills", "income")}?tab=overview&range=m`;
  const rowsKv = [
    [t("含住房"), A ? amt(money(H.at(-1))) : amt(LOADING()), href("bills", "spend")],
    [t("现金流出"), A ? amt(money(out)) : amt(LOADING()), OV],
    [t("收入"), I ? amt(money(inc)) : amt(LOADING()), `${href("bills", "income")}?tab=records`],
    [t("结余"), bal != null ? amt(`${bal < 0 ? "−" : ""}${money(Math.abs(bal))}`, bal < 0 ? "down" : "up") : amt(LOADING()), OV],
    [t("待缴账单（含逾期）"), `${small(t("共 {n} 笔账单", { n: next30.n }))}${amt(money(due30))}`, UNPAID30_HREF],
  ];
  // 卡片：本月日常消费大字，后面跟着「日常消费 · 上个月 $…」一行；下面明细两列（宽屏）；整张点进 财务 → 收支总览（本月）
  // 第一行：「$本月 日常消费 · 上月 $上月 ▲ 10%」——本月金额和下面各行一样大；上月小一号；花得比上月多是红 ▲、少是绿 ▼
  const curL = A ? num(L.at(-1)) : null, prevL = A ? num(L.at(-2)) : null, pct = prevL > 0 ? Math.round(((curL - prevL) / prevL) * 100) : null;
  const trend = pct == null || pct === 0 ? "" : `<span class="tm-trend ${pct > 0 ? "up" : "down"}" title="${esc(pct > 0 ? t("比上月多 {p}%", { p: pct }) : t("比上月少 {p}%", { p: -pct }))}"><span aria-hidden="true">${pct > 0 ? "▲" : "▼"}</span> ${Math.abs(pct)}%<span class="sr-only">${esc(pct > 0 ? t("比上月多 {p}%", { p: pct }) : t("比上月少 {p}%", { p: -pct }))}</span></span>`;
  const head = `<p class="tm-main"><b class="tm-amt num">${A ? mask(money(curL)) : LOADING()}</b><span class="tm-lbl">${t("日常消费")}</span>${A ? `<span class="tm-prev">· ${esc(monthLabel(pm))} <span class="num">${mask(money(prevL))}</span></span>${trend}` : ""}</p>`;
  const eye = moneyEye("tm-eye");
  // 标题行点进 财务 → 收支总览（本月）；卡片本身不再是整张链接，金额才能单独点开
  return card({ k: "money", icon: "💰", title: t("钱 · 本月"), headHref: `${href("bills", "income")}?tab=overview&range=m`, headExtra: eye,
    body: `<div class="tcard-money">${head}</div><ul class="tcard-kv tm-kv">${rowsKv.map(([k, v, h]) => `<li><a href="${esc(h)}"><span>${k}</span><span class="tm-v">${v}</span><span class="tcard-ch" aria-hidden="true">›</span></a></li>`).join("")}</ul>` });
}
/* ── 家里 · 一览：库存、采购、设备；没有财务权限的家人还看到本月账单的笔数（不显示金额） ── */
function homeCard() {
  const items = state.enriched || [], pantry = items.filter((x) => spaceOf(x.category) === "pantry"), short = restockCount();
  const rows = [rowLink(href("pantry", "overview"), "🗄️", t("储藏"), short ? t("{n} 件要补货", { n: short }) : pantry.length ? t("都够用") : t("还没记东西"), short)];
  if (state.houseEnabled) {
    // 2026-11-20：只留 储藏 / 房子 / 车子。每套房产一行进那套的概览（?prop= 先切到那一套）；每辆车一行进这辆车自己的首页
    for (const pr of state.properties.filter((p) => !p.archived).filter(propertyActive)) rows.push(rowLink(`${href("house", "overview")}?prop=${encodeURIComponent(pr.id)}`, "🏠", esc(pr.name || t("房产")), t("概览"), false));
    const V = window.VEHICLES;
    for (const a of (state.assetsEnriched || []).filter((x) => x.kind === "vehicle" && !x.retired && (V?.isActive ? V.isActive(x) : true)))
      rows.push(rowLink(href("asset", a.id), V?.POWERTRAINS?.[a.type]?.icon || "🚗", esc(a.name || t("车辆")), [a.manufacture_year, a.brand, a.model].filter(Boolean).map(esc).join(" "), false));
  }
  return card({ k: "home", icon: "🏡", title: t("家里 · 一览"), headHref: state.houseEnabled ? href("house") : "", body: `<ul class="tcard-rows">${rows.join("")}</ul>` });   // 标题 → 房屋首页（房产 + 汽车）
}

/* ── 咩咩咩（AI）：和以前的格子同样的说明，外加「今天吃什么」 ── */
function aiBlock() {
  const sub = aiReady() ? (aiQuota().ok ? t("直接问：保养、账单、买卖房、收纳、带娃") : t("免费额度用完了，先用复制提示词")) : t("问家里任何事，复制提示词到任一 AI");
  return `<section class="section"><div class="panel tai"><div class="tai-head"><h3>${aiIcon(20)} ${t("咩咩咩")}</h3><p class="muted">${sub}</p></div>
      <div class="form-actions tai-acts"><a class="btn btn-primary btn-sm" href="${href("ai")}">${t("问咩咩")}</a></div>
      <div class="tai-cards">${[[href("pantry", "meals") + "?ai=", "🍳", t("今天吃什么")], [href("shopping", "add"), "📝", t("加入购物车")], [href("pantry", "scan"), "🧾", t("录入购物")]].map(([h, ic, nm]) => `<a class="tai-card" href="${h}"><span aria-hidden="true">${ic}</span><b>${nm}</b></a>`).join("")}</div></div></div></section>`;
}

/* ── 快捷操作：每位用户自己的一份（云端存在账号上，换设备也在；演示模式存本机）；编辑模式点格子改成别的、长按拖动排序 ── */
/** 快捷操作卡：你的快捷操作一排小图标（点了直接去）；「编辑」进 #/quick 增删、换、拖动排序 */
function quickCard() {
  const mine = quickList().map((id) => PRESETS().find((p) => p[0] === id)).filter(Boolean);
  const one = ([id, icon, nm]) => id.startsWith("action:")
    ? `<li><button type="button" data-action="quick-run" data-id="${esc(id)}"><span class="tr-ico" aria-hidden="true">${icon}</span><span class="grow"><span class="tr-k1">${esc(nm)}</span></span><span class="tcard-ch" aria-hidden="true">›</span></button></li>`
    : rowLink(quickHref(id), icon, esc(nm));
  return card({ k: "quick", icon: "⚡", title: t("快捷操作"), cls: "tcard-quick", headHref: href("quick"),   // 标题行点进「编辑快捷操作」
    body: mine.length ? `<div class="tcard-scroll" tabindex="0" aria-label="${esc(t("快捷操作"))}"><ul class="tcard-rows">${mine.map(one).join("")}</ul></div>` : `<p class="muted" style="margin:0">${t("还没有快捷操作，点“编辑”添加。")}</p>` });
}
/** #/quick：编辑快捷操作（加、删、点格子换成别的、长按拖动排序；改完立刻保存） */
export function viewQuick() {
  state.quickEdit = true;
  return `<nav class="crumb" aria-label="${t("当前位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("快捷操作")}</b></nav>
    <section class="section"><div class="section-head"><h2>${t("编辑快捷操作")}</h2><p>${t("今日页的快捷操作卡里显示这些；点格子换成别的，长按拖动排序，× 移除")}</p></div>${quickEditor()}</section>`;
}
function quickEditor() {
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
  const bar = `<div class="tquick-bar"><span></span><div class="head-acts">
      <button type="button" class="btn btn-sm btn-ghost" data-action="quick-reset">${t("恢复默认")}</button>
      <a class="btn btn-sm btn-primary" href="${href("today")}">${t("完成")}</a></div></div>`;
  return `${bar}<div class="quick-grid ${editing ? "is-editing" : ""}">${quick || `<p class="muted">${t("还没有快捷操作，点“添加”。")}</p>`}</div>${addPanel}`;
}

/* ── 每位用户自己的快捷操作：地址（或 action:xxx）的有序列表 ──
 * 云端存在登录账号的 user_metadata.quick，换设备也在，家人之间互不影响；演示模式存本机 */
const QUICK_KEY = "hmh-quick";
/** 默认的一份（按角色）：有财务权限 = 录入购物、记花费、采购、添加账单、记收入、财务概览；没有 = 录入购物、记花费、采购、储藏、设备保养、季节任务。
 *  模块关掉的、没权限的自动跳过，用后面的补足 6 个 */
export const DEFAULT_QUICK = () => {
  const want = financeOk()
    ? [href("pantry", "scan"), href("shopping", "add"), SPEND_ADD(), href("shopping"), href("shops", "list"), href("bill", "new"), INCOME_ADD(), href("bills", "overview"), href("pantry", "overview"), href("house", "assets")]
    : [href("pantry", "scan"), href("shopping", "add"), SPEND_ADD(), href("shopping"), href("shops", "list"), href("pantry", "overview"), href("house", "assets"), href("house", "tasks"), href("pantry", "inventory"), href("pantry", "meals")];
  const ok = new Set(PRESETS().map((p) => p[0]));
  return want.filter((id) => ok.has(id)).slice(0, 8);
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
  let out = [...new Set(list.map((id) => map[id] || id))];
  // 2026-11-14 新加的入口（加入购物车、常去的商店）：已经自己排过快捷操作的人，也各补一次（排在最前面）；编辑保存后记下版本，删掉的不会再补回来
  if (quickVer() < QUICK_VER) { const add = [href("shopping", "add"), href("shops", "list")].filter((id) => !out.includes(id) && quickOk(id)); out = [...add, ...out]; }
  return out;   // 旧的“看花费统计”（我的 → 统计）在财务开着时改指向 财务 → 花费，旧的「补记一笔花费」改成直接打开表单；并去掉重复
}
export async function saveQuick(list) {
  if (Store.mode === "cloud") {
    const { data, error } = await Store.sb.auth.updateUser({ data: { quick: list, quick_v: QUICK_VER } });
    if (error) throw new Error(error.message);
    state.user = data.user;
  } else { try { localStorage.setItem(QUICK_KEY, JSON.stringify(list)); localStorage.setItem(`${QUICK_KEY}-v`, String(QUICK_VER)); } catch { /* 忽略 */ } }
}
/** 快捷操作存的是第几版的入口清单（新加入口时 +1，让大家各补一次） */
const QUICK_VER = 2;
function quickVer() {
  if (Store.mode === "cloud") return +(state.user?.user_metadata?.quick_v || 1);
  try { return +(localStorage.getItem(`${QUICK_KEY}-v`) || 1); } catch { return 1; }
}
/** 快捷操作的实际地址：财务的页面带 ?prop=all（每次回到全部房产；已经带参数的用 & 接） */
export const quickHref = (id) => (id.startsWith("#/bills") ? `${id}${id.includes("?") ? "&" : "?"}prop=all` : id);
/** 可放进快捷操作的页面与动作：[标识, 图标, 名称]。名称跟着新的信息架构：「账单」那一栏现在叫「财务」 */
export const PRESETS = () => {
  const B = state.billsEnabled, H = state.houseEnabled, G = state.gearEnabled;
  return [
    // 常用动作
    [href("pantry", "scan"), "🧾", t("录入购物")], B ? [SPEND_ADD(), "✍️", t("记一笔花费")] : null, [href("shopping"), "🛒", t("购物车")],
    [href("shopping", "add"), "📝", t("加入购物车")], [`${href("shopping", "add")}?mode=photo`, "📷", t("拍照加入购物车")], [href("shops", "list"), "🏪", t("常去的商店")],
    B ? [href("bill", "new"), "➕", t("添加账单")] : null, B ? [INCOME_ADD(), "💵", t("记一笔收入")] : null, B ? [href("otbill", "new"), "🏥", t("记一张一次性账单")] : null,
    // 储藏
    [href("pantry", "overview"), "🗄️", t("储藏概览")], [href("pantry", "inventory"), "📦", t("库存")], [href("pantry", "meals"), "🍳", t("今天吃什么")], [`${href("item", "new")}?space=pantry`, "➕", t("添加储藏物品")],
    G ? [href("pantry", "gear"), "🧳", t("家居耐用品")] : null, G ? [`${href("item", "new")}?space=gear`, "🧳", t("添加家居耐用品")] : null,
    // 房屋（日常运营）
    H ? [href("house"), "🏠", t("房屋")] : null, H ? [href("house", "assets"), "⚙️", t("设备保养")] : null, H ? [href("asset", "new"), "🛠️", t("添加设备")] : null, H ? [href("house", "tasks"), "📅", t("季节任务")] : null,
    H ? [href("house", "deal"), "📝", t("交易")] : null, H ? [href("house"), "🚗", t("车辆")] : null, H ? [href("house", "profile"), "📋", t("房屋资料")] : null,
    H ? [`${href("pantry", "inventory")}?space=house`, "🧰", t("汽车房屋消耗品")] : null, H ? [`${href("item", "new")}?space=house`, "➕", t("添加汽车房屋消耗品")] : null,
    // 财务（收支 · 账户与资产 · 借贷 · 预算与计划 · 分析）；没有财务权限的那几页由 quickOk 去掉
    B ? [href("bills"), "💰", t("财务")] : null, B ? [href("bills", "overview"), "📊", t("财务概览")] : null,
    B ? [href("bills", "spend"), "📊", t("花费")] : null, B ? [href("bills", "income"), "💵", t("收入")] : null, B ? [allBillsHref({ type: "recurring" }), "🔁", t("周期性账单")] : null, B ? [allBillsHref({ type: "onetime" }), "🏥", t("一次性账单")] : null,
    B ? [href("bills", "all"), "📋", t("全部账单")] : null, B ? [href("bills", "template"), "🧾", t("按模板建账单")] : null, B ? [href("bills", "statements"), "🏦", t("对账单")] : null,
    B ? [href("bills", "cards"), "💳", t("用卡：该刷哪张")] : null, B ? [`${href("bills", "cards")}?card=new`, "💳", t("添加信用卡")] : null, B ? [href("bills", "assets"), "🏛️", t("资产")] : null,
    B ? [href("bills", "debts"), "🏦", t("借贷")] : null, B ? [href("bills", "budget"), "💰", t("预算")] : null, B ? [href("bills", "networth"), "📈", t("净资产")] : null,
    // 其他
    [href("alerts"), "🔔", t("注意事项")], [href("ai"), "🤖", t("咩咩咩")], !B ? [href("me", "stats"), "📊", t("花费统计")] : null, [href("me", "settings"), "⚙️", t("设置")],
    ["action:print", "🖨️", t("打印")],
  ].filter(Boolean).filter(([id]) => quickOk(id));   // 没有财务权限：对账单 / 收入 / 预算 / 资产 / 借贷 / 净资产 / 添加信用卡不出现，也加不进来（已存的照样不显示）
};


