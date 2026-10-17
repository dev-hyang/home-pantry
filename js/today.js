/* 首页 · 今日：从提醒总线取全部提醒，按严重度（或按房产）通用渲染。各模块只负责把自己的提醒注册进总线，首页不认识任何模块。 */
import { state } from "./core/state.js";
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

export function viewToday() {
  const pref = state.today;
  let all = collectAlerts();
  const counts = alertCounts(all);
  const me = state.user?.id;
  const canMine = Store.mode === "cloud" && all.some((x) => x.assigned_to);
  if (pref.mine && me) all = all.filter((x) => !x.assigned_to || x.assigned_to === me);
  const shown = pref.focus ? all.filter((x) => x.severity < 3) : all;
  const hidden = all.length - shown.length;
  const open = state.shopping.filter((s) => s.status === "todo");
  const claimed = state.shopping.filter((s) => s.status === "claimed");
  const dateText = new Date().toLocaleDateString(locale(), { month: "long", day: "numeric", weekday: "long" });
  const restockable = all.some((x) => (x.source === "pantry" || x.source === "house") && x.actions?.some((a) => a.action === "shop-add-item"));
  const noProfile = state.houseEnabled && state.propertyId && !state.houseProfiles[state.propertyId];

  const chips = Object.entries(counts.bySource).map(([s, n]) => `<span class="chip" aria-pressed="false" style="cursor:default">${SOURCE_ICON[s] || ""} ${t(SOURCE_LABEL[s] || s)} ${n}</span>`).join("");
  const toggle = (key, label, on) => `<button type="button" class="chip" data-action="today-pref" data-key="${key}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;

  return `
    <section class="section today-head">
      <p class="muted">${esc(dateText)}</p>
      <h2>${counts.important ? t("今天有 {n} 件事要留意", { n: counts.important }) : all.length ? t("没有急事，有 {n} 件可以留意", { n: all.length }) : t("今天没有需要处理的事")}</h2>
      ${all.length ? `<div class="chips today-chips">${chips}</div>` : ""}
      <div class="chips today-chips">
        ${toggle("mode", t("按轻重排"), pref.mode !== "property")}${multiProperty() ? toggle("mode-property", t("按房产分"), pref.mode === "property") : ""}
        ${toggle("focus", t("只看要紧的"), !!pref.focus)}${canMine ? toggle("mine", t("只看我负责的"), !!pref.mine) : ""}
        ${restockable ? `<button type="button" class="chip" data-action="shop-add-alerts" data-space="all">${t("补货全部加入采购清单")}</button>` : ""}
      </div>
    </section>

    ${pref.mode === "property" && multiProperty() ? byProperty(shown) : bySeverity(shown)}
    ${hidden ? `<p class="muted" style="margin:-12px 0 24px;font-size:13px">${t("还有 {n} 件留意级的事已折叠，", { n: hidden })}<button type="button" class="link-name" data-action="today-pref" data-key="focus">${t("展开")}</button></p>` : ""}

    <section class="section">
      <div class="section-head"><h2>${t("采购清单")}</h2><a class="btn btn-sm btn-ghost" href="${href("shopping")}">${t("打开清单")}</a></div>
      <div class="panel kv">
        <div>${t("<b>{n}</b> 项待买", { n: open.length })}${claimed.length ? t("，<b>{n}</b> 项家人正在买（{who}）", { n: claimed.length, who: joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))].map(esc)) }) : ""}</div>
      </div>
    </section>

    ${noProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>${t("还没填房屋资料")}</b><p class="muted">${t("填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的房屋耗材。")}</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></div></section>` : ""}

    <section class="section quick">
      <a class="quick-link" href="${href("item", "new")}?space=pantry"><span aria-hidden="true">🥫</span>${t("添加储藏物品")}</a>
      ${state.houseEnabled ? `<a class="quick-link" href="${href("item", "new")}?space=house"><span aria-hidden="true">🧰</span>${t("添加房屋耗材")}</a>` : ""}
      ${state.gearEnabled ? `<a class="quick-link" href="${href("item", "new")}?space=gear"><span aria-hidden="true">🧳</span>${t("添加装备")}</a>` : ""}
      ${state.billsEnabled ? `<a class="quick-link" href="${href("bill", "new")}"><span aria-hidden="true">🧾</span>${t("添加账单")}</a>` : ""}
      <a class="quick-link" href="${href("me", "stats")}"><span aria-hidden="true">📊</span>${t("看花费统计")}</a>
    </section>`;
}

const section = (title, sub, items) => (items.length ? `<section class="section">
    <div class="section-head"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
    <div class="panel"><ul class="restock-list alert-list">${items.map(alertRow).join("")}</ul></div>
  </section>` : "");

function bySeverity(list) {
  const SUB = [t("已经过期，先处理"), t("今天到期或今天要做"), t("一周内到期、待核对的自动扣款、缺货"), t("少货、临期、本月季节任务")];
  return [0, 1, 2, 3].map((s) => section(t(SEVERITY_LABEL[s]), SUB[s], list.filter((x) => x.severity === s))).join("");
}

function byProperty(list) {
  const groups = liveProperties().map((p) => ({ title: `🏠 ${esc(p.name)}`, sub: t(window.DEALS.PROPERTY_STATUS[p.status] || "持有"), items: list.filter((x) => x.property_id === p.id) }));
  groups.push({ title: t("与房产无关"), sub: t("手机、车险、订阅等"), items: list.filter((x) => !x.property_id && x.source !== "pantry" && x.source !== "house") });
  groups.push({ title: t("家里的储藏"), sub: t("补货与临期"), items: list.filter((x) => x.source === "pantry" || x.source === "house") });
  return groups.map((g) => section(g.title, g.sub, g.items)).join("") || `<section class="section"><div class="panel empty"><strong>${t("今天没有需要处理的事")}</strong></div></section>`;
}

export { propertyName };
