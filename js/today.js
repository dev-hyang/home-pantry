/* 首页 · 今日：格子块（注意事项 / 小Y问 / 采购清单 / 今天吃什么 / 快捷操作）。
 * 「注意事项」点开是 #/alerts：从提醒总线取全部提醒，排序下拉（按轻重 / 按房产 / 按来源 / 按到期）。各模块只把自己的提醒注册进总线，首页不认识任何模块。 */
import { state } from "./core/state.js";
import { aiIcon, aiQuota, aiReady } from "./core/ai.js";
import { Store } from "./core/store.js";
import { href } from "./core/router.js";
import { esc } from "./core/util.js";
import { joinList, locale, t } from "./core/i18n.js";
import { SEVERITY_LABEL, SOURCE_ICON, SOURCE_LABEL, alertCounts, alertRow, collectAlerts, liveProperties, multiProperty, propertyName } from "./core/alerts.js";

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

/* ───────────── 今日：格子块 ───────────── */
export function viewToday() {
  const all = myAlerts(), counts = alertCounts(all);
  const open = state.shopping.filter((s) => s.status === "todo");
  const claimed = state.shopping.filter((s) => s.status === "claimed");
  const dateText = new Date().toLocaleDateString(locale(), { month: "long", day: "numeric", weekday: "long" });
  const noProfile = state.houseEnabled && state.propertyId && !state.houseProfiles[state.propertyId];
  const sevPills = [0, 1, 2, 3].filter((s) => counts.bySeverity[s]).map((s) => `<span class="pill sev-${s}"><i>${counts.bySeverity[s]}</i>${t(SEVERITY_LABEL[s])}</span>`).join("");

  // 大块：注意事项、小Y问、采购清单、今天吃什么
  const big = [
    tile({ href: href("alerts"), cls: `t-alerts ${counts.important ? "is-hot" : ""}`, icon: counts.important ? "🔔" : "✅", count: all.length,   // 数字 = 全部提醒（含“留意”级），不再要紧时是一个数、没有要紧的时候又换成另一个数
      name: t("注意事项"), sub: counts.important ? (counts.bySeverity[3] ? t("{n} 件要紧，{m} 件留意", { n: counts.important, m: counts.bySeverity[3] }) : t("{n} 件要紧", { n: counts.important })) : all.length ? t("没有急事，{n} 件可以留意", { n: all.length }) : t("今天没有需要处理的事"), foot: sevPills ? `<div class="pills">${sevPills}</div>` : "" }),
    tile({ href: href("ai"), cls: "t-ai", icon: aiIcon(40), name: t("小Y问"), sub: aiReady() ? (aiQuota().ok ? t("直接问：保养、账单、买卖房、收纳、带娃") : t("免费额度用完了，先用复制提示词")) : t("问家里任何事，复制提示词到任一 AI"), foot: `<span class="pill pill-none">${t("AI 助手")}</span>` }),
    tile({ href: href("shopping"), cls: "t-shop", icon: "🛒", count: open.length + claimed.length, name: t("采购清单"),   // 数字 = 待买 + 家人正在买（和底部导航角标一致）
      sub: open.length ? (claimed.length ? t("{n} 项待买，{m} 项家人正在买", { n: open.length, m: claimed.length }) : t("{n} 项待买", { n: open.length })) : claimed.length ? t("{m} 项家人正在买", { m: claimed.length }) : t("清单是空的"),
      foot: claimed.length ? `<span class="pill pill-ok"><i>✓</i>${esc(joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))]))}</span>` : "" }),
    tile({ href: `${href("pantry", "meals")}?ai=`, cls: "t-meals", icon: "🍳", name: t("今天吃什么"), sub: t("按库存和临期食材生成早午晚菜单"), foot: `<span class="pill pill-none">${aiIcon(14)} ${t("AI 菜单助手")}</span>` }),
  ].join("");

  // 快捷操作：每位用户自己的一份（云端存在账号上，换设备也在；演示模式存本机），默认 储藏概览 / 账单概览 / 看花费统计 / 打印
  const mine = quickList().map((id) => PRESETS().find((p) => p[0] === id)).filter(Boolean);
  const editing = !!state.quickEdit;
  const last = mine.length - 1;
  const tileBody = ([, ic, nm]) => `<span class="qtile-ico" aria-hidden="true">${ic}</span><span>${nm}</span>`;
  const tileHtml = ([id, ic, nm], i) => `<div class="qwrap">${id.startsWith("action:")
      ? `<button type="button" class="qtile" data-action="quick-run" data-id="${esc(id)}" ${editing ? 'tabindex="-1"' : ""}>${tileBody([id, ic, nm])}</button>`
      : `<a class="qtile" href="${esc(quickHref(id))}" ${editing ? 'tabindex="-1"' : ""}>${tileBody([id, ic, nm])}</a>`}
    ${editing ? `<button type="button" class="qdel" data-action="quick-del" data-id="${esc(id)}" aria-label="${esc(t("移除快捷操作：{name}", { name: nm }))}">×</button>
      <span class="qmove">${i > 0 ? `<button type="button" data-action="quick-move" data-id="${esc(id)}" data-dir="-1" aria-label="${esc(t("{name} 往前移", { name: nm }))}">‹</button>` : ""}${i < last ? `<button type="button" data-action="quick-move" data-id="${esc(id)}" data-dir="1" aria-label="${esc(t("{name} 往后移", { name: nm }))}">›</button>` : ""}</span>` : ""}</div>`;
  const taken = new Set(mine.map((x) => x[0]));
  const choices = PRESETS().filter(([id]) => !taken.has(id));
  const addPanel = editing && state.quickAdd ? `<div class="panel quick-add"><label>${t("添加到快捷操作")}<select id="quickSel">${choices.map(([id, ic, nm]) => `<option value="${esc(id)}">${ic} ${esc(nm)}</option>`).join("")}</select></label>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-action="quick-add" ${choices.length ? "" : "disabled"}>${t("添加")}</button><button type="button" class="btn btn-ghost btn-sm" data-action="quick-open">${t("取消")}</button></div></div>` : "";
  const quick = mine.map(tileHtml).join("")
    + (editing && choices.length ? `<div class="qwrap"><button type="button" class="qtile qtile-add" data-action="quick-open" aria-expanded="${state.quickAdd ? "true" : "false"}"><span class="qtile-ico" aria-hidden="true">＋</span><span>${t("添加")}</span></button></div>` : "");
  const quickHead = `<div class="section-head"><h3 class="today-sub" style="margin:0">${t("快捷操作")}</h3><div class="head-acts">
      ${editing ? `<button type="button" class="btn btn-sm btn-ghost" data-action="quick-reset">${t("恢复默认")}</button>` : ""}
      <button type="button" class="btn btn-sm ${editing ? "btn-primary" : "btn-ghost"}" data-action="quick-edit" aria-pressed="${editing ? "true" : "false"}">${editing ? t("完成") : t("编辑")}</button></div></div>`;

  return `
    <section class="section today-head"><p class="today-date">${esc(dateText)}</p></section>
    <section class="section"><div class="today-grid">${big}</div></section>
    ${noProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>${t("还没填房屋资料")}</b><p class="muted">${t("填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的房屋耗材。")}</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></div></section>` : ""}
    <section class="section">${quickHead}<div class="quick-grid ${editing ? "is-editing" : ""}">${quick || `<p class="muted">${t("还没有快捷操作，点“编辑”添加。")}</p>`}</div>${addPanel}</section>`;
}

/* ── 每位用户自己的快捷操作：地址（或 action:xxx）的有序列表 ──
 * 云端存在登录账号的 user_metadata.quick，换设备也在，家人之间互不影响；演示模式存本机 */
const QUICK_KEY = "hmh-quick";
export const DEFAULT_QUICK = () => [href("pantry", "overview"), href("bills", "overview"), href("me", "stats"), "action:print"];
export function quickList() {
  let list = null;
  if (Store.mode === "cloud") list = state.user?.user_metadata?.quick;
  else { try { list = JSON.parse(localStorage.getItem(QUICK_KEY) || "null"); } catch { list = null; } }
  return Array.isArray(list) ? list : DEFAULT_QUICK();
}
export async function saveQuick(list) {
  if (Store.mode === "cloud") {
    const { data, error } = await Store.sb.auth.updateUser({ data: { quick: list } });
    if (error) throw new Error(error.message);
    state.user = data.user;
  } else { try { localStorage.setItem(QUICK_KEY, JSON.stringify(list)); } catch { /* 忽略 */ } }
}
/** 快捷操作的实际地址：账单带 ?prop=all（每次回到全部房产）；“看花费统计”在账单模块开着时指向 账单 → 花费 */
const quickHref = (id) => (id === href("me", "stats") && state.billsEnabled ? href("bills", "spend") : id.startsWith("#/bills") ? `${id}?prop=all` : id);
/** 可放进快捷操作的页面与动作：[标识, 图标, 名称] */
const PRESETS = () => [
  [href("pantry", "overview"), "🥫", t("储藏概览")], [href("pantry", "inventory"), "📦", t("库存")], [href("pantry", "meals"), "🍳", t("今天吃什么")], [`${href("item", "new")}?space=pantry`, "➕", t("添加储藏物品")],
  state.gearEnabled ? [href("pantry", "gear"), "🧳", t("装备")] : null, state.gearEnabled ? [`${href("item", "new")}?space=gear`, "🧳", t("添加装备")] : null,
  state.billsEnabled ? [href("bills", "overview"), "🧾", t("账单概览")] : null, state.billsEnabled ? [href("bills", "list"), "📋", t("账单清单")] : null, state.billsEnabled ? [href("bills", "history"), "🕘", t("缴费记录")] : null, state.billsEnabled ? [href("bill", "new"), "➕", t("添加账单")] : null,
  state.houseEnabled ? [href("house"), "🏠", t("房屋")] : null, state.houseEnabled ? [`${href("pantry", "inventory")}?space=house`, "🧰", t("房屋耗材")] : null, state.houseEnabled ? [`${href("item", "new")}?space=house`, "➕", t("添加房屋耗材")] : null, state.houseEnabled ? [href("house", "assets"), "⚙️", t("设备保养")] : null,
  state.houseEnabled ? [href("house", "tasks"), "📅", t("季节任务")] : null, state.houseEnabled ? [href("house", "deal"), "📝", t("交易")] : null, state.houseEnabled ? [href("house", "vehicles"), "🚗", t("车辆")] : null, state.houseEnabled ? [href("asset", "new"), "🛠️", t("添加设备")] : null,
  [href("shopping"), "🛒", t("采购清单")], [href("scan"), "🧾", t("录入购物")], [href("alerts"), "🔔", t("注意事项")], [href("ai"), "🤖", t("小Y问")], [href("me", "stats"), "📊", t("看花费统计")], [href("me", "settings"), "⚙️", t("设置")],
  ["action:print", "🖨️", t("打印")],
].filter(Boolean);

function tile({ href: h, cls = "", icon, count, name, sub, foot = "" }) {
  return `<a class="ttile ${cls}" href="${h}">
    <div class="tile-top"><span class="ttile-ico" aria-hidden="true">${icon}</span>${count != null ? `<b class="tile-count">${count}</b>` : ""}</div>
    <div><div class="tile-name">${name}</div><div class="ttile-sub">${sub}</div></div>${foot}</a>`;
}

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
  const restockable = all.some((x) => (x.source === "pantry" || x.source === "house") && x.actions?.some((a) => a.action === "shop-add-item"));
  const mode = SORTS.some(([k]) => k === pref.mode) ? pref.mode : "severity";
  const sorts = SORTS.filter(([k]) => k !== "property" || multiProperty()).map(([k, n]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${t(n)}</option>`).join("");
  const toggle = (key, label, on) => `<button type="button" class="chip" data-action="today-pref" data-key="${key}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
  const body = mode === "property" && multiProperty() ? byProperty(shown) : mode === "source" && !src ? bySource(shown) : mode === "due" ? byDue(shown) : bySeverity(shown);
  const tabName = (k) => (k === "all" ? t("全部") : `${SOURCE_ICON[k] || ""} ${t(SOURCE_LABEL[k] || k)}`);
  const tabCount = (k) => (k === "all" ? all.length : counts.bySource[k] || 0);
  // 当前来源页：‹ 名称（数量）›，下面一行小圆点表示还有几页；整页列表区域可左右滑
  const pager = tabs.length > 1 ? `<div class="page-nav swipe-zone" data-swipe="alerts" role="group" aria-label="${t("提醒来源")}">
      <button type="button" class="month-btn" data-action="alerts-prev" ${idx <= 0 ? "disabled" : ""} aria-label="${t("上一个来源")}">‹</button>
      <div class="month-cur"><b>${tabName(tabs[idx])}<span class="muted"> ${tabCount(tabs[idx])}</span></b><small class="dots" aria-hidden="true">${tabs.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("")}</small></div>
      <button type="button" class="month-btn" data-action="alerts-next" ${idx >= tabs.length - 1 ? "disabled" : ""} aria-label="${t("下一个来源")}">›</button>
    </div>` : "";
  const tools = canMine || restockable ? `<div class="chips today-chips">
        ${canMine ? toggle("mine", t("只看我负责的"), !!pref.mine) : ""}
        ${restockable ? `<button type="button" class="chip" data-action="shop-add-alerts" data-space="all">${t("补货全部加入采购清单")}</button>` : ""}
      </div>` : "";

  return `
    <nav class="crumb crumb-tools" aria-label="${t("位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("注意事项")}</b>
      <label class="sort-dd"><span class="sr-only">${t("排序")}</span><select id="alertSort" aria-label="${t("排序")}">${sorts}</select></label></nav>
    <section class="section today-head">${pager}${tools}</section>
    <div class="swipe-zone" data-swipe="alerts">${body}</div>`;
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
  const groups = liveProperties().map((p) => ({ title: `🏠 ${esc(p.name)}`, sub: t(window.DEALS.PROPERTY_STATUS[p.status] || "持有"), items: list.filter((x) => x.property_id === p.id) }));
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
