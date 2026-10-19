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
    tile({ href: href("alerts"), cls: `t-alerts ${counts.important ? "is-hot" : ""}`, icon: counts.important ? "🔔" : "✅", count: counts.important || all.length,
      name: t("注意事项"), sub: counts.important ? t("{n} 件要紧，共 {m} 件", { n: counts.important, m: all.length }) : all.length ? t("没有急事，{n} 件可以留意", { n: all.length }) : t("今天没有需要处理的事"), foot: sevPills ? `<div class="pills">${sevPills}</div>` : "" }),
    tile({ href: href("ai"), cls: "t-ai", icon: aiIcon(40), name: t("小Y问"), sub: aiReady() ? (aiQuota().ok ? t("直接问：保养、账单、买卖房、收纳、带娃") : t("免费额度用完了，先用复制提示词")) : t("问家里任何事，复制提示词到任一 AI"), foot: `<span class="pill pill-none">${t("AI 助手")}</span>` }),
    tile({ href: href("shopping"), cls: "t-shop", icon: "🛒", count: open.length, name: t("采购清单"),
      sub: open.length ? (claimed.length ? t("{n} 项待买，{m} 项家人正在买", { n: open.length, m: claimed.length }) : t("{n} 项待买", { n: open.length })) : t("清单是空的"),
      foot: claimed.length ? `<span class="pill pill-ok"><i>✓</i>${esc(joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))]))}</span>` : "" }),
    tile({ href: `${href("pantry", "meals")}?ai=`, cls: "t-meals", icon: "🍳", name: t("今天吃什么"), sub: t("按库存和临期食材生成早午晚菜单"), foot: `<span class="pill pill-none">${aiIcon(14)} ${t("AI 菜单助手")}</span>` }),
  ].join("");

  // 快捷操作：小块
  const quick = [
    [`${href("item", "new")}?space=pantry`, "🥫", t("添加储藏物品")],
    state.houseEnabled ? [`${href("item", "new")}?space=house`, "🧰", t("添加房屋耗材")] : null,
    state.gearEnabled ? [`${href("item", "new")}?space=gear`, "🧳", t("添加装备")] : null,
    state.billsEnabled ? [href("bill", "new"), "🧾", t("添加账单")] : null,
    state.houseEnabled ? [href("house"), "🏠", t("房屋")] : null,
    [href("me", "stats"), "📊", t("看花费统计")],
  ].filter(Boolean).map(([h, ic, nm]) => `<a class="qtile" href="${h}"><span class="qtile-ico" aria-hidden="true">${ic}</span><span>${nm}</span></a>`).join("");

  return `
    <section class="section today-head">
      <p class="muted">${esc(dateText)}</p>
      <h2>${counts.important ? t("今天有 {n} 件事要留意", { n: counts.important }) : all.length ? t("没有急事，有 {n} 件可以留意", { n: all.length }) : t("今天没有需要处理的事")}</h2>
    </section>
    <section class="section"><div class="today-grid">${big}</div></section>
    ${noProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>${t("还没填房屋资料")}</b><p class="muted">${t("填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的房屋耗材。")}</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></div></section>` : ""}
    <section class="section"><h3 class="today-sub">${t("快捷操作")}</h3><div class="quick-grid">${quick}</div></section>`;
}

function tile({ href: h, cls = "", icon, count, name, sub, foot = "" }) {
  return `<a class="ttile ${cls}" href="${h}">
    <div class="tile-top"><span class="ttile-ico" aria-hidden="true">${icon}</span>${count != null ? `<b class="tile-count">${count}</b>` : ""}</div>
    <div><div class="tile-name">${name}</div><div class="ttile-sub">${sub}</div></div>${foot}</a>`;
}

/* ───────────── 今日 / 注意事项：清单 + 排序下拉 ───────────── */
const SORTS = [["severity", "按轻重"], ["due", "按到期"], ["source", "按来源"], ["property", "按房产"]];
export function viewAlerts() {
  const pref = state.today;
  const all = myAlerts(), counts = alertCounts(all);
  const canMine = Store.mode === "cloud" && collectAlerts().some((x) => x.assigned_to);
  // 来源芯片可点：只看某一来源（再点一次取消）
  const src = pref.source && counts.bySource[pref.source] ? pref.source : null;
  const picked = src ? all.filter((x) => x.source === src) : all;
  const shown = pref.focus ? picked.filter((x) => x.severity < 3) : picked;
  const hidden = picked.length - shown.length;
  const restockable = all.some((x) => (x.source === "pantry" || x.source === "house") && x.actions?.some((a) => a.action === "shop-add-item"));
  const mode = SORTS.some(([k]) => k === pref.mode) ? pref.mode : "severity";
  const sorts = SORTS.filter(([k]) => k !== "property" || multiProperty()).map(([k, n]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${t(n)}</option>`).join("");
  const chips = Object.entries(counts.bySource).map(([s, n]) => `<button type="button" class="chip" data-action="today-source" data-source="${s}" aria-pressed="${s === src ? "true" : "false"}">${SOURCE_ICON[s] || ""} ${t(SOURCE_LABEL[s] || s)} ${n}</button>`).join("");
  const toggle = (key, label, on) => `<button type="button" class="chip" data-action="today-pref" data-key="${key}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
  const body = mode === "property" && multiProperty() ? byProperty(shown) : mode === "source" ? bySource(shown) : mode === "due" ? byDue(shown) : bySeverity(shown);

  return `
    <nav class="crumb crumb-tools" aria-label="${t("位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("注意事项")}</b>
      <label class="sort-dd"><span class="sr-only">${t("排序")}</span><select id="alertSort" aria-label="${t("排序")}">${sorts}</select></label></nav>
    <section class="section today-head">
      <h2>${counts.important ? t("今天有 {n} 件事要留意", { n: counts.important }) : all.length ? t("没有急事，有 {n} 件可以留意", { n: all.length }) : t("今天没有需要处理的事")}</h2>
      ${all.length ? `<div class="chips today-chips">${chips}${src ? `<button type="button" class="chip" data-action="today-source" data-source="${src}">${t("显示全部")}</button>` : ""}</div>` : ""}
      <div class="chips today-chips">
        ${toggle("focus", t("只看要紧的"), !!pref.focus)}${canMine ? toggle("mine", t("只看我负责的"), !!pref.mine) : ""}
        ${restockable ? `<button type="button" class="chip" data-action="shop-add-alerts" data-space="all">${t("补货全部加入采购清单")}</button>` : ""}
      </div>
    </section>
    ${body}
    ${hidden ? `<p class="muted" style="margin:-12px 0 24px;font-size:13px">${t("还有 {n} 件留意级的事已折叠，", { n: hidden })}<button type="button" class="link-name" data-action="today-pref" data-key="focus">${t("展开")}</button></p>` : ""}`;
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
