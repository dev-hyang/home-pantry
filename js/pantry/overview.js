/* 储藏 · 概览（2026-11-22 重排）：
 *   ① 仪表卡片：日常消耗品 / 汽车房屋消耗品 / 家居耐用品（缺货、少货、临期的件数 + 共几件，点进库存下对应的二级页）+ 录入购物
 *   ② 该补货了   ③ 先吃这些（有临期的才有）   ④ 问咩咩：几个现成的问题，默认折叠，点开才看提问按钮和回答
 * 添加物品的「＋」只在库存页保留，概览不放。 */
import { state } from "../core/state.js";
import { alertsOf } from "../core/logic.js";
import { askInline } from "../core/ask.js";
import { esc, fmt, inSpace, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { INV_SUBS } from "./restock-sync.js";
import { recentCards } from "./overview-recent.js";
import { buysCards } from "./overview-buys.js";
import { catCheckSection, discardBtn, restockPanel, rsHint } from "./restock.js";

/* 问题的展开状态记在内存里：点「问咩咩」会重画页面，不能把刚展开的问题收回去 */
document.addEventListener("toggle", (e) => { const d = e.target; if (d?.matches?.("details[data-ask-q]")) (state.ovAskOpen ||= {})[d.dataset.askQ] = d.open; }, true);
const badge = (tone, text) => `<span class="ui-badge" data-tone="${tone}" data-size="sm">${esc(text)}</span>`;
/** 一张组别卡：标题、共几件、缺货 / 少货 / 临期标签；整张是链接，点进库存下的二级页 */
function groupCard(id, icon, title, url) {
  const list = state.enriched.filter(inSpace(id)), n = (s) => list.filter((x) => x.status === s).length;
  const out = n("out"), low = n("low") + n("soon"), exp = id === "pantry" ? list.filter((x) => x.exp).length : 0;
  const tags = id === "gear" ? (list.length ? "" : badge("neutral", t("空")))
    : !list.length ? badge("neutral", t("空"))
    : out || low || exp ? [out && badge("danger", t("缺货 {n}", { n: out })), low && badge("warn", t("少货 {n}", { n: low })), exp && badge("caution", t("临期 {n}", { n: exp }))].filter(Boolean).join("")
    : badge("ok", t("充足"));
  const total = id === "gear" ? list.reduce((a, x) => a + num(x.qty), 0) : list.length;
  return `<a class="ov-card ${out ? "has-out" : low || exp ? "has-low" : ""}" href="${esc(url)}" aria-label="${esc(`${title}，${t("共 {n} 件", { n: total })}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${icon}</span><span class="ov-total"><b>${total}</b><small>${t("件")}</small></span></span>
    <span class="ov-name">${esc(title)}</span><span class="ov-tags">${tags}</span></a>`;
}
function dashCards() {
  const cards = INV_SUBS.filter(([, , , , on]) => on()).map(([id, icon, name, h]) => groupCard(id, icon, t(name), h()));
  const scan = `<a class="ov-card ov-scan" href="${esc(href("pantry", "scan"))}"><span class="ov-top"><span class="ov-ico" aria-hidden="true">🧾</span></span>
    <span class="ov-name">${t("录入购物")}</span><span class="ov-tags"><small class="muted">${t("拍小票或粘贴订单，一次入库")}</small></span></a>`;
  return `<div class="ov-grid">${cards.join("")}${scan}</div>`;
}
/** 问咩咩的问题：id 固定（答案缓存 7 天）；问题里带上现在的缺货 / 临期名单 */
function askList(list, alerts, expiring) {
  const names = (arr, f = (x) => x.name) => arr.slice(0, 15).map(f).filter(Boolean).join("、");
  const base = [t("家庭人数 {n}", { n: state.members?.length || 1 })];
  const need = alerts.length ? [t("要补：{s}", { s: names(alerts, (a) => a.name || a.item?.name) })] : [];
  const Q = [
    ["restock", t("要补的东西怎么安排采购最省钱？"), t("该补货了"), t("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"), [...base, ...need], alerts.length],
    ["eat-first", t("快过期的怎么先吃完？"), t("先吃这些"), t("这些快到期的食材，怎么在过期前吃完或用掉？"), [...base, t("临期：{s}", { s: names(expiring) })], expiring.length],
    ["often-out", t("总缺货的东西怎么办？"), t("经常缺货"), t("哪些东西总是缺货？应该怎么调整少货线、一次买多少才不会反复断货？"), [...base, ...need, t("共 {n} 件物品", { n: list.length })], list.length],
    ["overstock", t("有没有囤太多的？"), t("囤货检查"), t("按家里人数，哪些东西可能囤得太多、可以先不买？"), [...base, t("共 {n} 件物品", { n: list.length })], list.length],
    ["home-supplies", t("滤网、电池这类多久换？"), t("汽车房屋消耗品"), t("滤网、电池、融雪盐这类汽车房屋消耗品，一般多久换一次，家里该备多少？"), [...base, t("共 {n} 件汽车房屋消耗品", { n: state.enriched.filter(inSpace("house")).length })], state.houseEnabled],
  ].filter((q) => q[5]);
  return `<div class="ov-asks">${Q.map(([id, label, title, question, context]) => `<details class="ov-ask" data-ask-q="${id}"${state.ovAskOpen?.[id] ? " open" : ""}><summary><span>${esc(label)}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${askInline({ id: `pantry-ov-${id}`, title, question, context })}</div></details>`).join("")}</div>`;
}
const cartBtn = () => {
  const n = state.shopping.filter((s) => s.status !== "bought").length;
  return `<a class="ui-btn cart-btn" data-size="sm" href="${href("shopping", "list")}" aria-label="${esc(t("购物车，{n} 项", { n }))}"><span aria-hidden="true">🛒</span> ${t("购物车")}${n ? ` <b class="num">${n}</b>` : ""}</a>`;
};
export function viewDashboard() {
  const withHouse = state.houseEnabled;   // 汽车房屋消耗品也算储藏：缺货、少货、补货提醒一起看
  const pantry = state.enriched.filter(inSpace("pantry")), house = withHouse ? state.enriched.filter(inSpace("house")) : [];
  const list = [...pantry, ...house], alerts = alertsOf(list);
  const expiring = pantry.filter((x) => x.exp).sort((a, b) => a.expDays - b.expDays);
  return `${catCheckSection()}
    <section class="section" aria-labelledby="h-ov"><h2 id="h-ov" class="sr-only">${t("储藏概览")}</h2>${dashCards()}</section>

    <section class="section" aria-labelledby="h-recent">
      <div class="section-head"><h2 id="h-recent">${t("最近动态")}</h2><p>${t("点进去看清单，数字和清单对得上")}</p></div>
      <div class="ov-grid">${recentCards()}</div>
    </section>

    <section class="section" aria-labelledby="h-buys">
      <div class="section-head"><h2 id="h-buys">${t("购买洞察")}</h2><p>${t("近 90 天，点进去看每一笔")}</p></div>
      <div class="ov-grid">${buysCards()}</div>
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        <div class="head-acts">${alerts.length ? `<button type="button" class="ui-btn" data-size="sm" data-tone="soft" data-action="shop-add-alerts" data-space="${withHouse ? "all" : "pantry"}">＋ ${t("全部加入购物车")}</button>` : ""}${cartBtn()}</div></div>
      ${alerts.length ? rsHint() : ""}
      <div class="panel">${alerts.length ? restockPanel(alerts) : `<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${expiring.length ? `<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${expiring.slice(0, 6).map((it) => `<li>
        <span class="badge b-exp">${it.exp === "expired" ? t("已过期") : it.expDays === 0 ? t("今天到期") : t("{d} 天后到期", { d: it.expDays })}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(t(it.location || ""))} ${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}</small></div>${it.exp === "expired" && it.qty > 0 ? discardBtn(it) : ""}</li>`).join("")}</ul></div>
    </section>` : ""}

    <section class="section" aria-labelledby="h-ovask">
      <div class="section-head"><h2 id="h-ovask">${t("问咩咩")}</h2><p>${t("点一个问题展开，再点「问咩咩」得到回答")}</p></div>
      ${askList(list, alerts, expiring)}
    </section>
`;
}
