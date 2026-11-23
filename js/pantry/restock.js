import { STATUS, state } from "../core/state.js";
import { alertsOf, openShopFor } from "../core/logic.js";
import { catCheckAlt } from "../core/category-moves.js";
import { catOf, catsOf, esc, fmt, inSpace } from "../core/util.js";
import { compare, joinList, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { ownerMatch } from "./owner.js";
import { lpAttr } from "../core/long-press.js";

/* ── 该补货了（储藏概览 / 房屋页共用）──
 * 2026-11-15：名字旁边一个小标签——「已加入」（在购物车里）/「未加入」；点标签或滑动来加入 / 移出：
 *   手机上 左滑 = 加入购物车（先确认数量），右滑 = 移出购物车（先确认）；电脑上点标签。滑动借用 js/swipe-rows.js（不改这份共用文件）：
 *   左滑区的文字和颜色由行上的 data-swipe-left-* 和样式表覆盖；已加入的行只能右滑（左边区域隐藏，左滑弹回）。 */
const rsTag = (it, inList) => inList
  ? `<button type="button" class="rs-tag is-in" data-action="shop-remove-item" data-id="${it.id}" title="${esc(t("点一下移出购物车"))}" aria-label="${esc(t("{name}：已加入购物车，点一下移出", { name: it.name }))}">✓ ${t("已加入")}</button>`
  : `<button type="button" class="rs-tag" data-action="shop-add-item" data-id="${it.id}" title="${esc(t("点一下加入购物车"))}" aria-label="${esc(t("{name}：未加入购物车，点一下加入", { name: it.name }))}">${t("未加入")}</button>`;
export function restockPanel(alerts, limit = 8) {
  if (!alerts.length) return "";
  return `<ul class="restock-list rs-list">${alerts.slice(0, limit).map((it) => {
    const inList = !!openShopFor(it.id);
    const swipe = inList
      ? `data-swipe-del="rs" data-swipe-alt="rs" data-swipe-alt-label="${esc(t("移出购物车"))}" data-swipe-alt-go="${esc(t("松手移出"))}"`
      : `data-swipe-del="rs" data-swipe-left-label="${esc(t("加入购物车"))}" data-swipe-left-go="${esc(t("松手加入"))}"`;
    return `<li class="rs-row ${inList ? "rs-in" : ""}" ${swipe} ${lpAttr([{ label: t("编辑"), action: "edit", data: { id: it.id }, first: true }, inList ? { label: t("移出购物车"), action: "shop-remove-item", data: { id: it.id } } : { label: t("加入购物车"), action: "shop-add-item", data: { id: it.id } }], it.name)}>
      <span class="badge ${STATUS[it.status].cls}">${t(STATUS[it.status].label)}</span>
      <div class="grow"><span class="rs-name"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>${rsTag(it, inList)}</span>
        <small>${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}${it.daysLeft != null && it.qty > 0 ? t("，约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) }) : ""}${inList ? "" : t("，建议买 {q} {u}", { q: fmt(it.dsuggest), u: esc(t(it.du)) })}</small></div>
      ${inList ? `<button type="button" class="swipe-alt-src" data-action="shop-remove-item" data-id="${it.id}">${t("移出购物车")}</button>`
        : `<button type="button" class="swipe-src" data-action="shop-add-item" data-id="${it.id}">${t("加入购物车")}</button>`}
    </li>`;
  }).join("")}</ul>`;
}
/** 该补货了下面的一行操作说明：手机说滑动，电脑说点标签 */
export const rsHint = () => `<p class="muted rs-hint"><span class="rs-hint-touch">${t("点「未加入」加入购物车，点「已加入」移出；也可 ← 左滑加入 · 右滑移出 →")}</span><span class="rs-hint-mouse">${t("点「未加入」加入购物车，点「已加入」移出")}</span></p>`;
export function shelfGrid(space, owner = "") {
  const list = state.enriched.filter(inSpace(space)).filter((x) => !owner || ownerMatch(x, owner, true));   // owner：某套房产 / 某辆车自己的消耗品页只数它的（含全家共用）
  return catsOf(space).map((c) => {
    const inCat = list.filter((x) => x.category === c.id);
    if (!inCat.length) return "";
    // 家居耐用品没有库存状态：只显示件数和位置
    if (space === "gear") {
      const locs = [...new Set(inCat.map((x) => x.location).filter(Boolean))];
      return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-space="${space}" data-cat="${c.id}">
        <span class="ico" aria-hidden="true">${c.icon}</span><h3>${t(c.name)}</h3>
        <p>${t("{n} 种", { n: inCat.length })}${locs.length ? t("，在{locs}{etc}", { locs: esc(joinList(locs.slice(0, 2).map((l) => t(l)))), etc: locs.length > 2 ? t("等") : "" }) : ""}</p>
      </button>`;
    }
    const cnt = (s) => inCat.filter((x) => x.status === s).length;
    const seg = (s, color) => cnt(s) ? `<i style="width:${(cnt(s) / inCat.length) * 100}%;background:${color}"></i>` : "";
    const bad = inCat.length - cnt("ok");
    return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-space="${space}" data-cat="${c.id}"${owner ? ` data-owner="${esc(owner)}"` : ""}>
      <span class="ico" aria-hidden="true">${c.icon}</span><h3>${t(c.name)}</h3>
      <p>${t("{n} 种", { n: inCat.length })}${bad ? t("，{n} 种需补", { n: bad }) : t("，都充足")}</p>
      <div class="mix" aria-hidden="true">${seg("out", "var(--out)")}${seg("low", "var(--low)")}${seg("soon", "var(--mustard)")}${seg("ok", "var(--pine)")}</div>
    </button>`;
  }).join("");
}
/** 「请确认分类」（迁移 064）：063 分类重整时按小类 + 名称猜着搬的物品，一件件确认。没有就不显示 */
const SPACE_NAME = { pantry: "日常消耗品", house: "汽车房屋消耗品", gear: "家居耐用品" };
export function catCheckSection() {
  const list = state.items.filter((it) => it.cat_check).sort((a, b) => compare(a.name, b.name));
  if (!list.length) return "";
  const where = (cat, sub) => { const c = catOf(cat); return `${c.icon} ${esc(t(c.name))}${sub ? ` · ${esc(t(sub))}` : ""}`; };
  return `<section class="section" aria-labelledby="h-catcheck">
      <div class="section-head"><h2 id="h-catcheck">${t("请确认分类")} <span class="muted">${list.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cat-check-all">${t("全部没错")}</button></div>
      <p class="muted cat-check-tip">${t("分类细化时，这些物品是按名称猜着搬的。放对了点「没错」；放错了点「改回…」或「改成…」，连着的花费也跟着换。")}</p>
      <div class="panel"><ul class="restock-list cat-check">${list.slice(0, 30).map((it) => {
        const alt = catCheckAlt(it), sp = (c) => t(SPACE_NAME[catOf(c).space] || "");
        return `<li>
        <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
          <small>${t("现在：")}${where(it.category, it.subcategory)}<span class="muted">（${sp(it.category)}）</span></small></div>
        <div class="cat-check-acts">
          <button type="button" class="btn btn-sm" data-action="cat-check-ok" data-id="${it.id}">${t("没错")}</button>
          ${alt ? `<button type="button" class="btn btn-sm btn-ghost" data-action="cat-check-alt" data-id="${it.id}" data-cat="${alt[0]}" data-sub="${esc(alt[1])}" title="${esc(t(SPACE_NAME[catOf(alt[0]).space] || ""))}">${it.cat_prev ? t("改回") : t("改成")} ${where(alt[0], alt[1])}</button>` : ""}
        </div></li>`;
      }).join("")}</ul>${list.length > 30 ? `<p class="muted cat-check-more">${t("还有 {n} 件，确认完这些再显示", { n: list.length - 30 })}</p>` : ""}</div>
    </section>`;
}
/** 库存页两个大容器的折叠状态（记在本机） */
const FOLD_KEY = "hmh-pv-fold";
const foldGet = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}"); } catch { return {}; } };
export function setFold(id, open) { const m = foldGet(); m[id] = open ? 1 : 0; try { localStorage.setItem(FOLD_KEY, JSON.stringify(m)); } catch { /* 忽略 */ } }
/** 过期扔掉：把剩下的都记成 discard（迁移 065），「家里的数字 → 浪费」统计它；不算进日均用量 */
export const discardBtn = (it) => `<button type="button" class="btn btn-sm btn-ghost discard-btn" data-action="discard" data-id="${it.id}" aria-label="${esc(t("{name} 过期了，扔掉剩下的", { name: it.name }))}">🗑 ${t("扔掉")}</button>`;
export { pantryNav } from "./restock-sync.js";
