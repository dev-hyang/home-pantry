/* 首页 · 今日：把储藏和房屋两边需要处理的事放在一张清单里，家人每天只看这一页 */
import { alertsOf, openShopFor } from "./core/logic.js";
import { STATUS, state } from "./core/state.js";
import { href } from "./core/router.js";
import { esc, fmt, inSpace } from "./core/util.js";

const SPACE_TAG = { pantry: { name: "储藏", icon: "🫙" }, house: { name: "房屋", icon: "🏠" } };

export function viewToday() {
  const houseOn = state.houseEnabled;
  const pantry = alertsOf(state.enriched.filter(inSpace("pantry"))).map((x) => ({ ...x, space: "pantry" }));
  const house = houseOn ? alertsOf(state.enriched.filter(inSpace("house"))).map((x) => ({ ...x, space: "house" })) : [];
  const todo = [...pantry, ...house].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const expiring = state.enriched.filter((x) => x.exp && x.qty > 0 && inSpace("pantry")(x)).sort((a, b) => a.expDays - b.expDays);
  const open = state.shopping.filter((s) => s.status === "todo");
  const claimed = state.shopping.filter((s) => s.status === "claimed");
  const total = todo.length + expiring.length;

  const now = new Date();
  const dateText = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  const rows = todo.slice(0, 12).map((it) => {
    const inList = openShopFor(it.id), tag = SPACE_TAG[it.space];
    return `<li>
      <span class="badge ${STATUS[it.status].cls}">${STATUS[it.status].label}</span>
      <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        <small><span class="space-tag">${tag.icon} ${tag.name}</span>剩 ${fmt(it.dqty)} ${esc(it.du)}${it.daysLeft != null && it.qty > 0 ? `，约够 ${Math.max(0, Math.floor(it.daysLeft))} 天` : ""}</small></div>
      ${inList ? `<span class="badge b-ok">已在清单</span>` : `<button type="button" class="btn btn-sm" data-action="shop-add-item" data-id="${it.id}">加入采购</button>`}
    </li>`;
  }).join("");

  return `
    <section class="section today-head">
      <p class="muted">${esc(dateText)}</p>
      <h2>${total ? `今天有 ${total} 件事要留意` : "今天没有需要处理的事"}</h2>
    </section>

    ${todo.length ? `<section class="section">
      <div class="section-head"><h2>该补货了</h2>
        <button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts" data-space="all">全部加入采购清单</button></div>
      <div class="panel"><ul class="restock-list">${rows}</ul>
        ${todo.length > 12 ? `<p class="muted" style="margin:8px 0 0">还有 ${todo.length - 12} 项，<a href="${href("pantry", "inventory")}">去库存查看</a></p>` : ""}</div>
    </section>` : ""}

    ${expiring.length ? `<section class="section">
      <div class="section-head"><h2>先吃这些</h2><a class="btn btn-sm btn-ghost" href="${href("pantry", "meals")}">看看能做什么菜</a></div>
      <div class="panel"><ul class="restock-list">${expiring.slice(0, 5).map((it) => `<li>
        <span class="badge b-exp">${it.exp === "expired" ? "已过期" : it.expDays === 0 ? "今天到期" : `${it.expDays} 天后到期`}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(it.location || "")} 剩 ${fmt(it.dqty)} ${esc(it.du)}</small></div></li>`).join("")}</ul></div>
    </section>` : ""}

    <section class="section">
      <div class="section-head"><h2>采购清单</h2><a class="btn btn-sm btn-ghost" href="${href("shopping")}">打开清单</a></div>
      <div class="panel kv">
        <div><b>${open.length}</b> 项待买${claimed.length ? `，<b>${claimed.length}</b> 项家人正在买（${[...new Set(claimed.map((c) => c.claimed_by_name || "家人"))].map(esc).join("、")}）` : ""}</div>
      </div>
    </section>

    ${houseOn && !state.houseProfile ? `<section class="section"><div class="panel cta-panel">
      <div><b>还没填房屋资料</b><p class="muted">填好后会提示哪些部位归自己维护、材料怎么保养，并一次加好常用的房屋耗材。</p></div>
      <a class="btn btn-primary" href="${href("house", "profile")}">填写房屋资料</a></div></section>` : ""}

    <section class="section quick">
      <a class="quick-link" href="${href("item", "new")}?space=pantry"><span aria-hidden="true">🫙</span>添加储藏物品</a>
      ${houseOn ? `<a class="quick-link" href="${href("item", "new")}?space=house"><span aria-hidden="true">🧰</span>添加房屋耗材</a>` : ""}
      <a class="quick-link" href="${href("me", "stats")}"><span aria-hidden="true">📊</span>看花费统计</a>
    </section>`;
}
