/* 买卖计划（#/house/plan，设计见 docs/design-bills-overview.md §17）
 * 不带参数：四个入口（我想买房 / 买车 / 卖房 / 卖车）；?k=buy_home|buy_vehicle|sell_home|sell_vehicle：只读指南（内容在 data/guides.js）。
 * 指南不产生任何记录；看房 / 看车清单的勾选只存这台设备（localStorage）。卖房 / 卖车从你名下已有的房产 / 车辆开始。 */
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
const L = (zh, en) => (lang === "en" ? en : zh);
import { activeProperties } from "../core/lifecycle.js";
import { activeVehicles, assetName } from "./assets.js";
import { planFormHtml, planListHtml, planPageHtml } from "./plan-board.js";

const G = () => window.GUIDES || { KINDS: [], GUIDES: {}, REGION: { note: ["", ""] } };
const tx = (p) => (Array.isArray(p) ? L(p[0], p[1]) : String(p ?? ""));
const KEY = (kind, stage) => `hmh-plan-chk-${kind}-${stage}`;

const readChecks = (kind, stage) => { try { return new Set(JSON.parse(localStorage.getItem(KEY(kind, stage)) || "[]")); } catch { return new Set(); } };
/** 勾选 / 取消勾选一项（只存这台设备） */
export function togglePlanCheck(kind, stage, idx, on) {
  const s = readChecks(kind, stage);
  on ? s.add(idx) : s.delete(idx);
  try { localStorage.setItem(KEY(kind, stage), JSON.stringify([...s])); } catch { /* 无痕模式等：这次勾选不保存 */ }
}

export const planHubHref = () => href("house", "plan");
export const planHref = (kind) => `${href("house", "plan")}?k=${kind}`;

/** 房屋首页的四个入口卡片（menu.js 用） */
export function planEntryCards() {
  const gs = G();
  return gs.KINDS.map((k) => {
    const g = gs.GUIDES[k];
    return `<a class="hv-card hv-add" href="${esc(planHref(k))}"><span class="hv-ico" aria-hidden="true">${g.icon}</span><span class="hv-txt"><b>${esc(L("我想" + g.name[0], g.name[1]))}</b><small>${esc(tx(k.startsWith("buy") ? ["看指南、列清单、比一比", "Guide, checklists, compare"] : ["看指南，再从已有的开始卖出清单", "Guide, then start the sell checklist"]))}</small></span></a>`;
  }).join("");
}

export function viewPlan() {
  const gs = G(), kind = state.route?.q?.get("k");
  const pid = state.route?.q?.get("p");
  if (pid) return planPageHtml(pid);
  if (kind && gs.GUIDES[kind]) return guidePage(kind);
  return `<section class="section menu-page house-landing">
    <div class="section-head"><h2>🧭 ${t("买卖计划")}</h2></div>
    <p class="muted">${t("还在想、还没买 / 卖：先看指南。指南不会创建房产或车辆；买到手以后，再在房屋首页「添加」。")}</p>
    <div class="hv-grid">${planEntryCards()}</div>
    ${(state.plans || []).length ? `<div class="section-head"><h3>${t("我的计划")}</h3></div>${planListHtml()}` : ""}
    <p class="muted plan-note">${esc(tx(gs.REGION.note))}</p>
  </section>`;
}

function sellStart(kind) {
  if (kind === "sell_home") {
    const ps = activeProperties().filter((p) => (p.status || "owned") !== "renting");
    return `<section class="section"><div class="panel"><strong>${t("从哪套房产开始卖出清单？")}</strong>
      ${ps.length ? `<div class="hv-grid">${ps.map((p) => `<button type="button" class="hv-card" data-action="plan-open-property" data-id="${p.id}"><span class="hv-ico" aria-hidden="true">🏠</span><span class="hv-txt"><b>${esc(p.name)}</b>${p.address ? `<small>${esc(p.address)}</small>` : ""}</span></button>`).join("")}</div>
      <p class="muted">${t("进入房屋后打开「交易」页，点「开始卖出」。")}</p>` : `<p class="muted">${t("你名下还没有房产。先在房屋首页添加。")}</p>`}</div></section>`;
  }
  const vs = activeVehicles();
  return `<section class="section"><div class="panel"><strong>${t("从哪辆车开始卖车清单？")}</strong>
    ${vs.length ? `<div class="hv-grid">${vs.map((a) => `<a class="hv-card" href="${esc(href("house", "deal"))}?asset=${a.id}"><span class="hv-ico" aria-hidden="true">🚗</span><span class="hv-txt"><b>${esc(assetName(a))}</b><small>${t("打开它的交易页")}</small></span></a>`).join("")}</div>` : `<p class="muted">${t("你名下还没有车辆。先在房屋首页添加。")}</p>`}</div></section>`;
}

function stageHtml(kind, s, open) {
  const list = (items, cls = "tips") => `<ul class="${cls}">${items.map((x) => `<li>${esc(tx(x))}</li>`).join("")}</ul>`;
  const dec = (s.decisions || []).map((d) => `<div class="plan-dec"><b>${esc(tx(d.q))}</b>
      <div class="plan-opts">${d.options.map((o) => `<div class="plan-opt"><b>${esc(tx(o.name))}</b><small>👍 ${esc(tx(o.pros))}</small><small>⚠️ ${esc(tx(o.cons))}</small></div>`).join("")}</div>
      ${d.ask?.length ? `<p class="muted"><b>${t("可以这样问")}</b></p>${list(d.ask)}` : ""}</div>`).join("");
  let chk = "";
  if (s.checklist) {
    const done = readChecks(kind, s.id);
    chk = `<fieldset class="plan-chk"><legend><b>${esc(tx(s.checklist.title))}</b> <small class="muted">${t("勾选只保存在这台设备上")}</small></legend>
      ${s.checklist.items.map((x, i) => `<label class="plan-chk-row"><input type="checkbox" data-action="plan-check" data-kind="${kind}" data-stage="${s.id}" data-idx="${i}" ${done.has(i) ? "checked" : ""}><span>${esc(tx(x))}</span></label>`).join("")}</fieldset>`;
  }
  return `<details class="panel plan-stage" ${open ? "open" : ""}><summary><b>${esc(tx(s.title))}</b><span class="ui-chev" aria-hidden="true">›</span></summary>
    <div class="plan-body"><p class="muted">${esc(tx(s.why))}</p>
    <p><b>${t("怎么做")}</b></p>${list(s.steps)}
    ${dec}
    ${s.pitfalls?.length ? `<p><b>${t("常见的坑")}</b></p>${list(s.pitfalls)}` : ""}
    ${chk}
    ${s.tip ? `<p class="plan-tip">💡 ${esc(tx(s.tip))}</p>` : ""}</div></details>`;
}

/** 买房 / 买车指南页顶部：我的计划（全家共享）+ 新建入口 */
function myPlans(kind) {
  const editing = state.planEdit?.type === "plan" && !state.planEdit.id;
  return `<section class="section"><div class="section-head"><h3>${t("我的计划")}</h3><p>${t("把候选、对比和出价记在这里，全家一起看")}</p></div>
    ${planListHtml(kind)}
    ${editing ? planFormHtml(kind) : `<p><button type="button" class="ui-btn" data-tone="primary" data-action="plan-new" data-kind="${kind}">＋ ${t("新建计划")}</button></p>`}</section>`;
}

function guidePage(kind) {
  const g = G().GUIDES[kind];
  return `<section class="section menu-page plan-page">
    <p class="plan-back"><a class="link-name" href="${esc(planHubHref())}">‹ ${t("买卖计划")}</a></p>
    <div class="section-head"><h2>${g.icon} ${esc(tx(g.name))}</h2></div>
    <p class="muted">${esc(tx(g.intro))}</p>
    <p class="muted plan-note">${esc(tx(G().REGION.note))} ${t("仅供参考，不是法律或财务建议。")}</p>
    ${kind.startsWith("sell") ? sellStart(kind) : myPlans(kind)}
    ${g.stages.map((s, i) => stageHtml(kind, s, i === 0)).join("")}
  </section>`;
}
