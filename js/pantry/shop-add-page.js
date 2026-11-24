/* 加入购物车（#/shopping/add）：
 *   首页 = 标题 + ⋯（扫描 / 补货提醒 / 买好录入库存）、一个「加入购物车」块（已有物品 / 新物品，各点开选扫描或手动）、「最近加入」最多 8 条；
 *   ?form=existing|new = 单独的手动表单页（取消 / 保存）；?mode=photo[&kind=…] = 扫描页。
 * 已有物品：下拉（按分类分组、可输入搜索）选库存里的物品，单位和分类跟着库存走；新物品：写名字，保存时库存里有相同 / 相近的，会问是不是改成加已有物品。 */
import { numAttrs } from "../core/ui-num.js";
import { esc, fmtShort, num, showQty } from "../core/util.js";
import { crumbNav } from "../core/hub.js";
import { buyHead } from "../shops/buy-nav.js";
import { href } from "../core/router.js";
import { moreMenu } from "../core/more-menu.js";
import { shopAdviceHtml } from "../bills/budget.js";
import { shopScanHtml } from "./shop-scan.js";
import { state } from "../core/state.js";
import { shopUnit } from "./shop-sync.js";
import { t } from "../core/i18n.js";
import { categoryOptions } from "./meals-sync.js";
import { alertsOf, openShopFor } from "../core/logic.js";
import { fmt, inSpace } from "../core/util.js";
import { unitSelect } from "../core/unit-pick.js";

const addHref = (q = "") => `${href("shopping", "add")}${q}`;
const listHref = () => href("shopping", "list");
const crumb = (label) => crumbNav([{ href: href("shopping"), label: t("采购") }, ...(label ? [{ href: addHref(), label: t("加入购物车"), icon: "＋" }, { label }] : [{ label: t("加入购物车"), icon: "＋" }])]);

/** 库存物品下拉：按分类分组；value = 物品 id，data-unit / data-cat 给表单自动填 */
export function itemPickOptions() {
  const cats = window.CATEGORIES || [], by = new Map();
  for (const i of state.items) (by.get(i.category) || by.set(i.category, []).get(i.category)).push(i);
  const opt = (i) => `<option value="${esc(i.id)}" data-unit="${esc(i.unit || "")}" data-cat="${esc(i.category || "other")}">${esc(i.name)}</option>`;
  const known = cats.filter((c) => by.has(c.id)).map((c) => `<optgroup label="${esc(`${c.icon} ${t(c.name)}`)}">${by.get(c.id).sort((a, b) => a.name.localeCompare(b.name)).map(opt).join("")}</optgroup>`);
  const rest = state.items.filter((i) => !cats.some((c) => c.id === i.category));
  return `<option value="">${t("请选择库存里的物品…")}</option>${known.join("")}${rest.length ? `<optgroup label="${esc(t("其他"))}">${rest.map(opt).join("")}</optgroup>` : ""}`;
}


/** 一个选择块：点开弹出几个入口 */
const choice = (icon, title, desc, opts) => `<details class="act-more add-choice"><summary><span class="ac-ico" aria-hidden="true">${icon}</span><span class="ac-txt"><b>${title}</b><small>${desc}</small></span><span class="ui-chev" aria-hidden="true">›</span></summary>
  <div class="act-menu" role="menu">${opts.map(([label, h]) => `<a class="act-item" role="menuitem" href="${esc(h)}">${label}</a>`).join("")}</div></details>`;

function formPage(kind) {
  const ex = kind === "existing";
  return `<section class="section shop-add-page form-page">
    ${crumb(ex ? t("手动加入 · 已有物品") : t("手动加入 · 新物品"))}
    <form class="panel shop-add-form" id="shopForm" data-kind="${kind}" aria-label="${esc(t("手动添加采购项"))}">
      ${ex ? `<label class="full">${t("要买什么（库存里的物品）")}<select name="item_id" data-search required>${itemPickOptions()}</select></label>`
        : `<label class="full">${t("要买什么")}<input name="name" required maxlength="60" placeholder="${esc(t("例如：鸡蛋、牛奶、洗洁精"))}" autocomplete="off"></label>`}
      <label>${t("数量")}<input name="quantity" ${numAttrs("money", { min: 0.1, step: 0.1 })} value="1"></label>
      <label>${t("单位")}<input name="unit" list="unitList" placeholder="${esc(ex ? t("跟着库存") : t("不填自动选"))}" maxlength="10" ${ex ? "readonly" : ""}></label>
      <label>${t("分类")}<select name="category" ${ex ? "disabled" : ""}><option value="">${ex ? t("跟着库存") : t("自动分类")}</option>${categoryOptions()}</select></label>
      <label>${t("预估金额")}<input name="estimate" ${numAttrs("money")} placeholder="${esc(t("可不填，用来做预算提示"))}"></label>
      <div class="form-actions full"><a class="btn btn-ghost" href="${addHref()}">${t("取消")}</a><button class="btn btn-primary" type="submit">${t("保存")}</button></div>
      <p class="muted full shop-add-tip">${ex ? t("单位和分类按库存里的物品填好；买到后自动加回库存。") : t("保存时如果库存里已有相同或相近的物品，会问你要不要改成加已有物品。")}</p>
    </form></section>`;
}

/** 补货清单页：state.shopPick（别处点「全部加入购物车」带来的）或默认的补货提醒；已经在购物车里的不列 */
export function restockCandidates() {
  const ids = state.shopPick, pool = ids ? state.enriched.filter((x) => ids.includes(x.id)) : alertsOf(state.enriched.filter(inSpace("pantry")));
  return pool.filter((it) => it && !openShopFor(it.id));
}
function restockPage() {
  const list = restockCandidates();
  const row = (it) => `<li class="rs-pick-row" data-id="${esc(it.id)}"><label class="check-inline"><input type="checkbox" name="inc" checked aria-label="${esc(t("加入 {name}", { name: it.name }))}"><span class="rp-name">${esc(it.name)}</span></label>
      <input ${numAttrs("qty")} name="qty" value="${esc(fmt(Math.max(1, Math.round(Number(it.dsuggest) || 1))))}" aria-label="${esc(t("{name} 数量", { name: it.name }))}">
      ${unitSelect(`name="unit" aria-label="${esc(t("{name} 单位", { name: it.name }))}"`, it.du || it.unit || "个")}</li>`;
  return `<section class="section shop-add-page form-page">${crumb(t("从补货清单加入"))}
    <form class="panel restock-form" id="restockForm" aria-label="${esc(t("从补货清单加入"))}">
      <h3 style="margin:0 0 4px">${t("从补货清单加入购物车")}</h3>
      <p class="muted">${list.length ? t("确认每样要买多少、单位；不要的取消勾选。") : t("现在没有需要补货的东西，或都已经在购物车里了。")}</p>
      <ul class="rs-pick-list">${list.map(row).join("")}</ul>
      <div class="form-actions"><a class="btn btn-ghost" href="${addHref()}">${t("取消")}</a><button class="btn btn-primary" type="submit" ${list.length ? "" : "disabled"}>${t("加入购物车")}</button></div>
    </form></section>`;
}

function scanPage(kind) {
  const label = kind === "new" ? t("扫描 · 新物品") : kind === "existing" ? t("扫描 · 已有物品") : t("扫描");
  return `<section class="section shop-add-page">${crumb(label)}${shopScanHtml()}<datalist id="itemNames">${state.items.map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist></section>`;
}

export function viewShopAdd() {
  const q = state.route?.q, form = q?.get("form");
  if (form === "existing" || form === "new") return formPage(form);
  if (form === "restock") return restockPage();
  if (q?.get("mode") === "photo") return scanPage(q.get("kind"));
  const recent = state.shopping.filter((s) => s.status !== "bought").sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 8);
  return `<section class="section shop-add-page">
    ${buyHead("add")}
    <div class="panel add-choices">
      ${choice("📦", t("已有物品"), t("库存里有的，快用完了补一份"), [[`📷 ${t("扫描加入")}`, addHref("?mode=photo&kind=existing")], [`✍️ ${t("手动加入")}`, addHref("?form=existing")], [`🔔 ${t("从补货清单加入")}`, addHref("?form=restock")]])}
      ${choice("✨", t("新物品"), t("库存里还没有；买到后会新建物品"), [[`📷 ${t("扫描")}`, addHref("?mode=photo&kind=new")], [`✍️ ${t("手动")}`, addHref("?form=new")]])}
    </div>
    ${shopAdviceHtml()}
    ${recent.length ? `<div class="panel sd-preview"><div class="section-head"><h3>${t("最近加入购物车")}</h3><a class="btn btn-sm btn-ghost" href="${listHref()}">${t("购物车")} ›</a></div>
      <ul>${recent.map((s) => `<li class="sp-row"><span class="sp-txt"><b>${esc(s.name)}</b> <small class="muted">${showQty(num(s.quantity, 1), shopUnit(s))}${s.created_at ? ` · ${t("{d} 加入", { d: fmtShort(s.created_at) })}` : ""}</small></span></li>`).join("")}</ul></div>` : ""}
  </section>`;
}
