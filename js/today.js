/* 首页 · 今日：把储藏和房屋两边需要处理的事放在一张清单里，家人每天只看这一页 */
import { alertsOf, openShopFor } from "./core/logic.js";
import { STATUS, state } from "./core/state.js";
import { href } from "./core/router.js";
import { esc, fmt, inSpace } from "./core/util.js";
import { joinList, locale, t } from "./core/i18n.js";
import { alertText, assetAlerts } from "./house/assets.js";
import { taskRow, undoneThisMonth } from "./house/tasks.js";

const SPACE_TAG = { pantry: { name: "储藏", icon: "🥫" }, house: { name: "房屋", icon: "🏠" } };

export function viewToday() {
  const houseOn = state.houseEnabled;
  // 第二期：到期保养 / 保修快到期的设备，本月还没做的季节任务
  const assets = houseOn ? assetAlerts(state.assetsEnriched) : [];
  const tasks = houseOn ? undoneThisMonth() : [];
  const now0 = new Date(), ty = now0.getFullYear(), tm = now0.getMonth() + 1;
  const pantry = alertsOf(state.enriched.filter(inSpace("pantry"))).map((x) => ({ ...x, space: "pantry" }));
  const house = houseOn ? alertsOf(state.enriched.filter(inSpace("house"))).map((x) => ({ ...x, space: "house" })) : [];
  const todo = [...pantry, ...house].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const expiring = state.enriched.filter((x) => x.exp && x.qty > 0 && inSpace("pantry")(x)).sort((a, b) => a.expDays - b.expDays);
  const open = state.shopping.filter((s) => s.status === "todo");
  const claimed = state.shopping.filter((s) => s.status === "claimed");
  const total = todo.length + expiring.length + assets.length + tasks.length;

  const now = new Date();
  const dateText = now.toLocaleDateString(locale(), { month: "long", day: "numeric", weekday: "long" });

  const rows = todo.slice(0, 12).map((it) => {
    const inList = openShopFor(it.id), tag = SPACE_TAG[it.space];
    return `<li>
      <span class="badge ${STATUS[it.status].cls}">${t(STATUS[it.status].label)}</span>
      <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        <small><span class="space-tag">${tag.icon} ${t(tag.name)}</span>${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}${it.daysLeft != null && it.qty > 0 ? t("，约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) }) : ""}</small></div>
      ${inList ? `<span class="badge b-ok">${t("已在清单")}</span>` : `<button type="button" class="btn btn-sm" data-action="shop-add-item" data-id="${it.id}">${t("加入采购")}</button>`}
    </li>`;
  }).join("");

  const more = (n, section, sub, label) => `<p class="muted" style="margin:8px 0 0">${t("还有 {n} 项，", { n })}<a href="${href(section, sub)}">${label}</a></p>`;

  return `
    <section class="section today-head">
      <p class="muted">${esc(dateText)}</p>
      <h2>${total ? t("今天有 {n} 件事要留意", { n: total }) : t("今天没有需要处理的事")}</h2>
    </section>

    ${todo.length ? `<section class="section">
      <div class="section-head"><h2>${t("该补货了")}</h2>
        <button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts" data-space="all">${t("全部加入采购清单")}</button></div>
      <div class="panel"><ul class="restock-list">${rows}</ul>
        ${todo.length > 12 ? more(todo.length - 12, "pantry", "inventory", t("去库存查看")) : ""}</div>
    </section>` : ""}

    ${assets.length ? `<section class="section">
      <div class="section-head"><h2>${t("设备该保养了")}</h2><a class="btn btn-sm btn-ghost" href="${href("house", "assets")}">${t("设备档案")}</a></div>
      <div class="panel"><ul class="restock-list">${assets.slice(0, 5).map((a) => `<li>
        <span class="badge ${a.service === "overdue" ? "b-out" : "b-soon"}">${a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修")}</span>
        <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${a.t?.icon || "⚙️"} ${esc(a.name)}</a><small>${esc(alertText(a))}</small></div>
        <a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a></li>`).join("")}</ul>
        ${assets.length > 5 ? more(assets.length - 5, "house", "assets", t("去设备档案查看")) : ""}</div>
    </section>` : ""}

    ${tasks.length ? `<section class="section">
      <div class="section-head"><h2>${t("本月季节任务")}</h2><a class="btn btn-sm btn-ghost" href="${href("house", "tasks")}">${t("全部任务")}</a></div>
      <div class="panel"><ul class="task-list">${tasks.slice(0, 6).map((x) => taskRow(x, ty, tm)).join("")}</ul>
        ${tasks.length > 6 ? more(tasks.length - 6, "house", "tasks", t("去季节任务查看")) : ""}</div>
    </section>` : ""}

    ${expiring.length ? `<section class="section">
      <div class="section-head"><h2>${t("先吃这些")}</h2><a class="btn btn-sm btn-ghost" href="${href("pantry", "meals")}">${t("看看能做什么菜")}</a></div>
      <div class="panel"><ul class="restock-list">${expiring.slice(0, 5).map((it) => `<li>
        <span class="badge b-exp">${it.exp === "expired" ? t("已过期") : it.expDays === 0 ? t("今天到期") : t("{d} 天后到期", { d: it.expDays })}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(t(it.location || ""))} ${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}</small></div></li>`).join("")}</ul></div>
    </section>` : ""}

    <section class="section">
      <div class="section-head"><h2>${t("采购清单")}</h2><a class="btn btn-sm btn-ghost" href="${href("shopping")}">${t("打开清单")}</a></div>
      <div class="panel kv">
        <div>${t("<b>{n}</b> 项待买", { n: open.length })}${claimed.length ? t("，<b>{n}</b> 项家人正在买（{who}）", { n: claimed.length, who: joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))].map(esc)) }) : ""}</div>
      </div>
    </section>

    ${houseOn && !state.houseProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>${t("还没填房屋资料")}</b><p class="muted">${t("填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的房屋耗材。")}</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></div></section>` : ""}

    <section class="section quick">
      <a class="quick-link" href="${href("item", "new")}?space=pantry"><span aria-hidden="true">🥫</span>${t("添加储藏物品")}</a>
      ${houseOn ? `<a class="quick-link" href="${href("item", "new")}?space=house"><span aria-hidden="true">🧰</span>${t("添加房屋耗材")}</a>` : ""}
      ${state.gearEnabled ? `<a class="quick-link" href="${href("item", "new")}?space=gear"><span aria-hidden="true">🧳</span>${t("添加装备")}</a>` : ""}
      <a class="quick-link" href="${href("me", "stats")}"><span aria-hidden="true">📊</span>${t("看花费统计")}</a>
    </section>`;
}
