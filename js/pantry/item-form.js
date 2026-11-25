import { numAttrs } from "../core/ui-num.js";
import { state } from "../core/state.js";
import { ownerField } from "./owner.js";
import { aliasesOf, findItem, similarItems } from "../core/item-match.js";
import { copyOf } from "../core/more-menu.js";
import { viewItemDetail } from "./item-detail.js";
import { Store } from "../core/store.js";
import { MUTE_FOREVER, catOf, catsOf, du, esc, fmt, listRoute, num, spaceOf, stampText, todayISO } from "../core/util.js";
import { SECTIONS, go, href } from "../core/router.js";
import { crumbNav } from "../core/hub.js";
import { memberName, openShopFor } from "../core/logic.js";
import { t } from "../core/i18n.js";
import { locationField } from "../core/locations.js";
import { autofillBar } from "../core/autofill.js";
import { unitSelect } from "../core/unit-pick.js";
import { assetField, buyField, guessCategory, muteField, pickText } from "./item-form-fields.js";
import { cartTag, statusTag } from "./inventory-items.js";
import { categoryOptions } from "./meals-sync.js";
import { cardSelectHtml } from "../bills/card-picker.js";
import { lastStore, storeDatalist } from "../stats/store-lite.js";
export { leaveItem } from "./item-form-common.js";
export { saveItemForm } from "./item-form-save.js";

/* ───────────── 物品编辑：独立整页（路由 #/item/<id> 或 #/item/new） ─────────────
 * 用网址表示编辑页：手机返回手势、浏览器后退都能退出；返回时由 main.js 恢复来源页的滚动位置。 */
/** 新物品选了大类时默认的小类（没有的大类按第一个） */
const DEFAULT_SUB = { frozen: "冷冻肉禽" };
export function subOptions(catId, selected) {
  if (selected === undefined) selected = DEFAULT_SUB[catId];   // 只给新物品 / 换大类时用；已有物品小类为空就保持空
  const subs = catOf(catId).subs || [];
  if (selected && !subs.includes(selected)) return `<option value="${esc(selected)}" selected>${esc(t(selected))}</option>` + subs.map((s) => `<option value="${esc(s)}">${esc(t(s))}</option>`).join("");   // 旧小类：保留，不在保存时被换掉
  return subs.map((s) => `<option value="${esc(s)}" ${s === selected ? "selected" : ""}>${esc(t(s))}</option>`).join("");
}
export function openItem(id, { space, cat } = {}) {
  const qs = new URLSearchParams();
  if (space) qs.set("space", space);
  if (cat) qs.set("cat", cat);
  go(`${href("item", id || "new")}${qs.toString() ? `?${qs}` : ""}`);
}
/** 物品页面包屑：储藏 / 库存（汽车房屋消耗品）或 储藏 / 家居耐用品 */
const itemBase = (space) => [{ href: href("pantry"), label: t("储藏") },
  space === "gear" ? { href: href("pantry", "gear"), label: t("家居耐用品") } : { href: space === "house" ? `${href("pantry", "inventory")}?space=house` : href("pantry", "inventory"), label: space === "house" ? `${t("库存")} · ${t("汽车房屋消耗品")}` : t("库存") }];
const SECTION_LABEL = { today: "今日", pantry: "储藏", house: "房屋", gear: "家居耐用品", shopping: "购物车", me: "我的" };
const NAME_HINT = { pantry: "例如：鸡蛋、抽纸、大米", house: "例如：炉子滤网、电池、融雪盐", gear: "例如：被罩、千斤顶、儿童自行车" };
/* 放在哪一类（2026-11-14）：大类前面先选空间——会用完的日常消耗品 / 汽车房屋消耗品 / 长期用的家居耐用品，大类下拉只列这一类的 */
export const SPACE_INFO = [
  ["pantry", "🥫", "日常消耗品", "吃的喝的、纸巾洗护、药品、宠物粮：用了会少，要补货"],
  ["house", "🧰", "汽车房屋消耗品", "滤网、电池、灯泡、融雪盐、机油：房子、院子、车定期要换的"],
  ["gear", "🛋️", "家居耐用品", "家具、电器、厨具、衣物、玩具、工具：长期用，只记几件、放在哪"],
];
/** 基本信息标题右边：库存状态 + 「已加入购物车」小标签（只有已存在的物品才有） */
function basicsAside(it) {
  const e = state.enriched.find((x) => x.id === it.id);
  return `${e && !isGearItem(it) ? statusTag(e) : ""}${openShopFor(it.id) ? cartTag() : ""}`;
}
const isGearItem = (it) => spaceOf(it.category) === "gear";
function spacePick(cur, open) {
  const list = SPACE_INFO.filter(([s]) => s === cur || (s === "house" ? state.houseEnabled : s === "gear" ? state.gearEnabled : true));
  const card = ([, ic, name, desc]) => `<b>${ic} ${t(name)}</b><small>${t(desc)}</small>`;
  const now = list.find(([s]) => s === cur) || list[0];
  /* 卡片式下拉（2026-11-16）：收起时只显示选中的那一类（名称 + 一行说明）；展开是几张带说明的大卡片，选中后自动收起。新物品默认展开，编辑已有物品默认收起 */
  return `<fieldset class="span-2 space-pick"><legend>${t("组别")}</legend>
    <details class="space-dd" ${open ? "open" : ""}><summary class="space-card space-sum" aria-label="${esc(t("组别"))}"><span class="space-sum-txt">${card(now)}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="space-opts">${list.map((x) => `<label class="space-opt">
    <input type="radio" name="space" value="${x[0]}" ${x[0] === cur ? "checked" : ""}><span class="space-card">${card(x)}</span></label>`).join("")}</div></details>
    <p class="muted space-rel">${t("组别 › 大类 › 小类：组别决定东西的性质（日常消耗品、汽车房屋消耗品、家居耐用品）；大类是组别下的分类，例如蔬果、清洁；小类是大类下的细分，例如叶菜。")}</p></fieldset>`;
}
/* 表单分块（2026-11-14）：每块可以点标题折叠 / 展开；展开状态记在内存里，后台重画时不变 */
const FOLD = new Map();
let ACTIVE_SEC = null;   // 从详情页点某一块的「编辑」进来（?edit=basic|qty|notes）：只显示这一块，其余块藏起来（字段还在表单里，一起保存）
const secKey = (id, k) => `${id || "new"}:${k}`;
function fsec(id, k, title, body, openDefault, cls = "", aside = "") {
  const key = secKey(id, k);
  if (ACTIVE_SEC) {   // 只改某一块（从详情页点这一块的「编辑」进来）：这一块平铺显示，不折叠、不带状态标志；其余块藏起来（字段还在表单里，一起保存）
    return `<div class="fsec fsec-flat ${cls}" data-fsec="${esc(key)}"${k === ACTIVE_SEC ? "" : " hidden"}><div class="fsec-flat-h">${title}</div><fieldset><legend class="sr-only">${title}</legend>${body}</fieldset></div>`;
  }
  const open = FOLD.has(key) ? FOLD.get(key) : openDefault, hid = "";
  return `<details class="fsec ${cls}" data-fsec="${esc(key)}" ${open ? "open" : ""}${hid}><summary><span class="fsec-ttl">${title}</span>${aside ? `<span class="fsec-aside">${aside}</span>` : ""}<span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <fieldset><legend class="sr-only">${title}</legend>${body}</fieldset></details>`;
}
if (typeof document !== "undefined") document.addEventListener("toggle", (e) => { const d = e.target; if (d?.matches?.("details.fsec[data-fsec]")) FOLD.set(d.dataset.fsec, d.open); }, true);
/** 添加物品时顺手记一笔花费（选填）：填了金额才记；商店、付款方式默认是最近一次用的（和「记一笔花费」一样） */
function spendFieldset() {
  return fsec("", "spend", t("花费（选填）"), `
          <p class="muted" style="margin:-6px 0 10px;font-size:13px">${t("填了金额就同时记一笔花费，关联到这件物品；不填就只入库。")}</p>
          <div class="form-grid">
            <label>${t("金额（{cur}）", { cur: Units.region.currency })}<input name="sp_amount" ${numAttrs("money")} placeholder="0.00"></label>
            <label>${t("商店 / 收款方")}<input name="sp_store" maxlength="40" list="storeList" value="${esc(lastStore())}"></label>
            <label>${t("日期")}<input name="sp_date" type="date" max="${todayISO()}" value="${todayISO()}"></label>
            ${cardSelectHtml("sp_card") ? `<label>${t("怎么付的")}${cardSelectHtml("sp_card")}</label>` : ""}
          </div>
          ${storeDatalist()}`, false, "item-spend");
}
export function viewItemForm() {
  const r = state.route;
  const it = r.id && r.id !== "new" ? state.items.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !it) {
    return `<div class="panel empty"><strong>${t("找不到这件物品")}</strong>${t("可能已被家人删除。")}<p><a class="ui-btn" data-tone="primary" href="${href("pantry", "inventory")}">${t("回到库存")}</a></p></div>`;
  }
  const space = r.q.get("space") || (state.filter.space && state.filter.space !== "all" ? state.filter.space : "pantry");
  // 已有的物品：先看详情页；点某一块的「编辑」（?edit=basic|qty|notes）才进表单（只显示那一块）
  ACTIVE_SEC = null;
  if (it && !r.q.get("edit")) return viewItemDetail(it, { crumbBase: itemBase(spaceOf(it.category)), spaceInfo: SPACE_INFO });
  if (it) ACTIVE_SEC = ["basic", "qty", "notes"].includes(r.q.get("edit")) ? r.q.get("edit") : null;
  const qCat = r.q.get("cat");
  const defCat = qCat && CATEGORIES.some((c) => c.id === qCat) ? qCat
    : state.filter.space === space && state.filter.cat !== "all" ? state.filter.cat : catsOf(space)[0].id;
  // 复制：带上原物品的分类、小类、单位、位置、少货线、备注；保质期、关联设备、提醒设置不带
  const src = !it && r.q.get("copy") ? copyOf(state.items.find((x) => x.id === r.q.get("copy")), ["expiry_date", "asset_ids", "alert_mute_until", "cat_check", "avg_daily_use", "name_key"]) : null;
  if (src) src.name = `${src.name}（2）`.slice(0, 60);   // 同一家不能有同名的两件：先加（2），自己改成品牌 / 规格
  const v = it || src || { category: defCat, unit: "个", quantity: 1, min_quantity: space === "gear" ? 0 : 1, lead_days: space === "house" ? 14 : space === "gear" ? 0 : 3, location: catOf(defCat).loc };
  state.editingCat = v.category;
  const gear = spaceOf(v.category) === "gear";
  // 面包屑根：进来之前的页面；没有就回对应空间的清单
  const root = { href: state.prevRoute && state.prevHash ? state.prevHash : href(...listRoute(space)), label: state.prevRoute ? t(SECTIONS[state.prevRoute.section]?.name || "上一页") : t(SECTION_LABEL[space] || "列表") };
  const f = Units.factor(v.unit), dUnit = du(v.unit);
  // 新物品默认不提醒（2026-11-14）；已有物品：设了少货线 / 提前天数、又没设成「不再提醒」才算提醒
  const remind = (it || src) ? (num(v.min_quantity) > 0 || num(v.lead_days) > 0) && !(it && it.alert_mute_until === MUTE_FOREVER) : false;
  const dv = (x) => (x == null || x === "" ? "" : fmt(num(x) * f));
  return `
    <section class="section form-page">
      ${it ? crumbNav([...itemBase(spaceOf(it.category)), { href: href("item", it.id), label: it.name, icon: catOf(v.category).icon }, { label: t("编辑") }]) : crumbNav([...itemBase(space), { label: src ? t("复制：{name}", { name: src.name }) : t("添加物品"), icon: catOf(v.category).icon }])}
      ${!it || ACTIVE_SEC === "basic" ? autofillBar("item", "#itemForm") : ""}
      <form id="itemForm" class="panel ${gear ? "is-gear" : ""} ${spaceOf(v.category) === "house" ? "is-house" : ""} ${remind ? "is-remind" : ""}" novalidate data-autosave>
        <input type="hidden" name="item_id" value="${esc(it?.id || "")}">
        <input type="hidden" name="orig_unit" value="${esc(v.unit)}">
        <input type="hidden" name="disp_unit" value="${esc(Units.normalize(dUnit))}">
        ${fsec(it?.id, "basic", t("基本信息"), `
          <div class="form-grid">
            <label class="span-2">${t("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${t(NAME_HINT[spaceOf(v.category)] || NAME_HINT.pantry)}" value="${esc(v.name || "")}">
              <small class="name-hint" id="itemNameHint" role="status" ${it ? "" : "data-new"} hidden></small>
            </label>
            <label class="span-2">${t("别名（选填）")}
              <input name="aliases" maxlength="200" autocomplete="off" placeholder="${esc(t("同一样东西的其他叫法，用逗号隔开，例如：milk, 牛乳"))}" value="${esc(it ? aliasesOf(it.id).join(", ") : "")}">
              <small class="muted">${t("录入购物、购物车、记花费写成这些叫法，也会对上这件")}</small>
            </label>
            ${spacePick(spaceOf(v.category), !it)}
            <label>${t("大类")}
              <select name="category" required data-search>${categoryOptions(v.category, { withOther: false, only: spaceOf(v.category) })}</select>
            </label>
            <label>${t("小类")}
              <select name="subcategory" data-search>${subOptions(v.category, v.subcategory)}</select>
            </label>
            ${locationField(v.location)}
            <label class="not-gear">${t("保质期至")}
              <input name="expiry_date" type="date" value="${esc(v.expiry_date || "")}">
            </label>
            ${ownerField(v, r.q.get("prop") ? `p:${r.q.get("prop")}` : r.q.get("veh") ? `a:${r.q.get("veh")}` : "")}
            ${assetField(v)}
          </div>`, true, "", it ? basicsAside(it) : "")}
        ${fsec(it?.id, "qty", `<span class="not-gear">${t("数量与提醒")}</span><span class="only-gear">${t("数量")}</span>`, `
          <p class="muted only-gear" style="margin:0 0 10px;font-size:13px">${t("家居耐用品只记数量和位置，不算消耗，也不会提醒补货。需要保养周期或保修的，用下方“升级为设备档案”。")}</p>
          <div class="form-grid">
            <label>${t("当前数量")}
              <input name="quantity" ${numAttrs("qty")} required value="${dv(v.quantity ?? 0)}" data-orig="${dv(v.quantity ?? 0)}">
            </label>
            <label>${t("单位")}
              ${unitSelect(`name="unit" required ${it || src ? "" : 'data-auto="1"'}`, dUnit || "个")}
              ${dUnit !== v.unit ? `<small>${t("原单位 {u}，已按当前地区换算显示", { u: esc(v.unit) })}</small>` : ""}
            </label>
            <label class="span-2 not-gear remind-toggle check-inline"><input type="checkbox" name="remind" ${remind ? "checked" : ""}>
              <span><b>${t("提醒补货")}</b><small class="muted">${t("打开后，少于少货线或快用完时提醒；不打开就不提醒")}</small></span></label>
            <label class="not-gear remind-only">${t("少货线")}
              <input name="min_quantity" ${numAttrs("qty")} value="${dv(v.min_quantity ?? 0)}" data-orig="${dv(v.min_quantity ?? 0)}">
              <small>${t("数量低于或等于它时提醒“少货”")}</small>
            </label>
            <label class="not-gear remind-only">${t("提前几天提醒")}
              <input name="lead_days" ${numAttrs("int", { max: 60 })} value="${esc(v.lead_days ?? 3)}">
              <small>${t("预计剩余天数低于它时提醒“即将告罄”")}</small>
            </label>
            <label class="span-2 not-gear">${t("每天大约用多少（可选）")}
              <input name="avg_daily_use" ${numAttrs("qty")} placeholder="${t("留空则根据家人的使用记录自动估算")}" value="${dv(v.avg_daily_use)}" data-orig="${dv(v.avg_daily_use)}">
            </label>
            ${it ? muteField(v) : ""}${buyField(v)}
          </div>`, true)}
        ${fsec(it?.id, "notes", t("备注"), `
          <label class="sr-only" for="itemNotes">${t("备注")}</label>
          <textarea id="itemNotes" name="notes" rows="3" maxlength="500" placeholder="${gear ? t("品牌、型号、尺寸、购买时间、借给了谁…") : t("品牌、规格、在哪买更便宜…")}">${esc(v.notes || "")}</textarea>`, !!v.notes)}
        ${it ? "" : spendFieldset()}
        <p id="itemFormError" class="form-error" role="alert"></p>
        <div class="ui-acts sticky-actions">
          <button type="submit" class="ui-btn" data-tone="primary">${it ? t("保存修改") : t("添加物品")}</button>
          <button type="button" class="ui-btn" data-tone="ghost" data-action="item-cancel">${t("取消")}</button>
        </div>
      </form>
    </section>`;
}
// 关联设备下拉：勾选后更新标题；点外面或按 Esc 收起；设备多时可搜索
document.addEventListener("change", (e) => {
  const dd = e.target.closest?.("details.pick"); if (!dd || !dd.querySelector("input[name=asset_ids]")) return;   // 只管「关联设备」这个下拉；别的下拉（账单摊派等）自己更新标题
  const labels = [...dd.querySelectorAll("input[name=asset_ids]:checked")].map((x) => x.dataset.label);
  const val = dd.querySelector(".pick-val"), n = dd.querySelector(".pick-n");
  val.textContent = labels.length ? pickText(labels) : t("不关联设备"); val.classList.toggle("is-empty", !labels.length);
  n.textContent = labels.length; n.hidden = !labels.length;
});
document.addEventListener("input", (e) => {
  if (!e.target.classList?.contains("pick-q")) return;
  const q = e.target.value.trim().toLowerCase();
  e.target.closest(".pick-panel").querySelectorAll(".pick-row").forEach((r) => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
});
document.addEventListener("click", (e) => document.querySelectorAll("details.pick[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll("details.pick[open]").forEach((d) => { d.open = false; d.querySelector("summary")?.focus(); }); });
/* 添加物品：名称和已有物品对一下（js/core/item-match.js）——写法一样的给链接去那件，相近的列出来 */
document.addEventListener("input", (e) => {
  if (e.target.name === "unit" && e.target.closest?.("#itemForm")) { delete e.target.dataset.auto; return; }
  if (e.target.name === "space" && e.target.closest?.("#itemForm")) {
    const sel = e.target.form.elements.category;
    sel.innerHTML = categoryOptions(null, { withOther: false, only: e.target.value });
    sel.selectedIndex = 0; sel.dispatchEvent(new Event("change", { bubbles: true }));
    const dd = e.target.closest(".space-dd"), pick = e.target.nextElementSibling;   // 选中后：标题行换成这一类，再收起
    if (dd && pick) { dd.querySelector(".space-sum-txt").innerHTML = pick.innerHTML; dd.open = false; }
    return;
  }
  if (e.target.name === "remind" && e.target.closest?.("#itemForm")) {   // 打开提醒：原来是「不再提醒」的，暂停选项回到「正常提醒」
    const f = e.target.form; f.classList.toggle("is-remind", e.target.checked);
    if (e.target.checked && f.elements.alert_mute?.value === "forever") f.elements.alert_mute.value = "";
    return;
  }   // 手动改过单位就不再按名字猜
  if ((e.target.name === "category" || e.target.name === "subcategory") && e.target.closest?.("#itemForm") && e.isTrusted) { e.target.form.dataset.catTouched = "1"; return; }   // 自己选过分类：不再按名字改
  if (e.target.name !== "name" || !e.target.closest?.("#itemForm")) return;
  guessCategory(e.target.form, e.target.value);
  const hint = document.getElementById("itemNameHint"), f = e.target.form; if (!hint || !f) return;
  const u = f.elements.unit;   // 新物品、单位还没手动改过：按名字猜包装单位（牛奶 → 瓶、大米 → 袋），猜不出就是「个」
  if (u?.dataset.auto === "1") {   // 单位下拉：值是统一写法；猜出来的不在选项里就补一个
    const g = Units.guess(e.target.value) || "个";
    if (u.tagName === "SELECT" && ![...u.options].some((o) => o.value === g)) u.insertAdjacentHTML("afterbegin", `<option value="${esc(g)}">${esc(t(g))}</option>`);
    u.value = u.tagName === "SELECT" ? g : t(g);
  }
  const id = f.elements.item_id.value || null, same = findItem(e.target.value, { exceptId: id }), near = same ? [] : similarItems(e.target.value, { exceptId: id });
  hint.hidden = !same && !near.length;
  const link = (i) => `<a href="${href("item", i.id)}">${esc(i.name)}</a>`;
  hint.innerHTML = same ? t("已有同名物品：{link}", { link: link(same) }) : near.length ? t("相近的已有物品：{list}", { list: near.map(link).join("、") }) : "";
});
