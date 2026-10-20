import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, catOf, catsOf, du, esc, fmt, listRoute, num, spaceOf, stampText, toast } from "../core/util.js";
import { SECTIONS, go, href } from "../core/router.js";
import { crumbNav } from "../core/hub.js";
import { memberName } from "../core/logic.js";
import { t } from "../core/i18n.js";
import { categoryOptions } from "./views.js";
import { locationField, resolveLocation } from "../core/locations.js";
import { assetName } from "../house/assets.js";
import { propertyName } from "../bills/logic.js";

/* ───────────── 物品编辑：独立整页（路由 #/item/<id> 或 #/item/new） ─────────────
 * 用网址表示编辑页：手机返回手势、浏览器后退都能退出；返回时由 main.js 恢复来源页的滚动位置。 */
export function subOptions(catId, selected) {
  return catOf(catId).subs.map((s) => `<option value="${esc(s)}" ${s === selected ? "selected" : ""}>${esc(t(s))}</option>`).join("");
}

export function openItem(id, { space, cat } = {}) {
  const qs = new URLSearchParams();
  if (space) qs.set("space", space);
  if (cat) qs.set("cat", cat);
  go(`${href("item", id || "new")}${qs.toString() ? `?${qs}` : ""}`);
}

// 保存、取消、删除后：从应用内进入的就后退一步（恢复来源页），否则回到对应空间的列表
export function leaveItem(changed) {
  if (changed) state.needsRefresh = true;
  state.skipAutosave = true;   // 已保存 / 取消 / 删除：离开时不再自动保存
  if (state.prevRoute) history.back();
  else go(href(...listRoute(spaceOf(state.editingCat || "fresh"))), { replace: true });
}

const SECTION_LABEL = { today: "今日", pantry: "储藏", house: "房屋", gear: "装备", shopping: "采购清单", me: "我的" };
const NAME_HINT = { pantry: "例如：鸡蛋、抽纸、大米", house: "例如：炉子滤网、电池、融雪盐", gear: "例如：被罩、千斤顶、儿童自行车" };

/** 房屋耗材可关联的设备：房屋 → 设备保养里的设备（不含车辆）；多套房产时名字后带房产名 */
const linkableAssets = () => state.assetsEnriched.filter((a) => a.kind !== "vehicle");
const assetLabel = (a) => `${assetName(a)}${state.properties.length > 1 && a.property_id ? ` · ${propertyName(a.property_id)}` : ""}`;

export function viewItemForm() {
  const r = state.route;
  const it = r.id && r.id !== "new" ? state.items.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !it) {
    return `<div class="panel empty"><strong>${t("找不到这件物品")}</strong>${t("可能已被家人删除。")}<p><a class="btn btn-primary" href="${href("pantry", "inventory")}">${t("回到库存")}</a></p></div>`;
  }
  const space = r.q.get("space") || (state.filter.space || "pantry");
  const qCat = r.q.get("cat");
  const defCat = qCat && CATEGORIES.some((c) => c.id === qCat) ? qCat
    : state.filter.space === space && state.filter.cat !== "all" ? state.filter.cat : catsOf(space)[0].id;
  const v = it || { category: defCat, unit: "个", quantity: 1, min_quantity: space === "gear" ? 0 : 1, lead_days: space === "house" ? 14 : space === "gear" ? 0 : 3, location: catOf(defCat).loc };
  state.editingCat = v.category;
  const gear = spaceOf(v.category) === "gear";
  // 面包屑根：进来之前的页面；没有就回对应空间的清单
  const root = { href: state.prevRoute && state.prevHash ? state.prevHash : href(...listRoute(space)), label: state.prevRoute ? t(SECTIONS[state.prevRoute.section]?.name || "上一页") : t(SECTION_LABEL[space] || "列表") };
  const f = Units.factor(v.unit), dUnit = du(v.unit);
  const dv = (x) => (x == null || x === "" ? "" : fmt(num(x) * f));
  return `
    <section class="section form-page">
      ${crumbNav([root, { label: it ? t("编辑：{name}", { name: it.name }) : t("添加物品"), icon: catOf(v.category).icon }])}
      <form id="itemForm" class="panel ${gear ? "is-gear" : ""} ${spaceOf(v.category) === "house" ? "is-house" : ""}" novalidate data-autosave>
        <input type="hidden" name="item_id" value="${esc(it?.id || "")}">
        <input type="hidden" name="orig_unit" value="${esc(v.unit)}">
        <input type="hidden" name="disp_unit" value="${esc(dUnit)}">
        <fieldset>
          <legend>${t("基本信息")}</legend>
          <div class="form-grid">
            <label class="span-2">${t("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${t(NAME_HINT[spaceOf(v.category)] || NAME_HINT.pantry)}" value="${esc(v.name || "")}">
            </label>
            <label>${t("大类")}
              <select name="category" required>${categoryOptions(v.category, { withOther: false })}</select>
            </label>
            <label>${t("小类")}
              <select name="subcategory">${subOptions(v.category, v.subcategory)}</select>
            </label>
            ${locationField(v.location)}
            <label class="not-gear">${t("保质期至")}
              <input name="expiry_date" type="date" value="${esc(v.expiry_date || "")}">
            </label>
            ${assetField(v)}
          </div>
        </fieldset>
        <fieldset>
          <legend><span class="not-gear">${t("数量与提醒")}</span><span class="only-gear">${t("数量")}</span></legend>
          <p class="muted only-gear" style="margin:0 0 10px;font-size:13px">${t("装备只记数量和位置，不算消耗，也不会提醒补货。需要保养周期或保修的，用下方“升级为设备档案”。")}</p>
          <div class="form-grid">
            <label>${t("当前数量")}
              <input name="quantity" type="number" min="0" step="any" inputmode="decimal" required value="${dv(v.quantity ?? 0)}" data-orig="${dv(v.quantity ?? 0)}">
            </label>
            <label>${t("单位")}
              <input name="unit" list="unitList" maxlength="10" required value="${esc(dUnit || "个")}">
              ${dUnit !== v.unit ? `<small>${t("原单位 {u}，已按当前地区换算显示", { u: esc(v.unit) })}</small>` : ""}
            </label>
            <label class="not-gear">${t("少货线")}
              <input name="min_quantity" type="number" min="0" step="any" inputmode="decimal" value="${dv(v.min_quantity ?? 0)}" data-orig="${dv(v.min_quantity ?? 0)}">
              <small>${t("数量低于或等于它时提醒“少货”")}</small>
            </label>
            <label class="not-gear">${t("提前几天提醒")}
              <input name="lead_days" type="number" min="0" max="60" step="1" inputmode="numeric" value="${esc(v.lead_days ?? 3)}">
              <small>${t("预计剩余天数低于它时提醒“即将告罄”")}</small>
            </label>
            <label class="span-2 not-gear">${t("每天大约用多少（可选）")}
              <input name="avg_daily_use" type="number" min="0" step="any" inputmode="decimal" placeholder="${t("留空则根据家人的使用记录自动估算")}" value="${dv(v.avg_daily_use)}" data-orig="${dv(v.avg_daily_use)}">
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>${t("备注")}</legend>
          <label class="sr-only" for="itemNotes">${t("备注")}</label>
          <textarea id="itemNotes" name="notes" rows="3" maxlength="500" placeholder="${gear ? t("品牌、型号、尺寸、购买时间、借给了谁…") : t("品牌、规格、在哪买更便宜…")}">${esc(v.notes || "")}</textarea>
        </fieldset>
        <p id="itemFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${it ? t("保存修改") : t("添加物品")}</button>
          <button type="button" class="btn btn-ghost" data-action="item-cancel">${t("取消")}</button>
          ${it && gear ? `<a class="btn btn-ghost" href="#/asset/new?from_item=${esc(it.id)}">${t("升级为设备档案")}</a>` : ""}
          ${it ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="item-delete">${t("删除物品")}</button>` : ""}
        </div>
      </form>
      ${it && stampText(it) ? `<p class="record-meta">${esc(stampText(it))}${Store.mode === "cloud" && memberName(it.updated_by) ? `（${esc(memberName(it.updated_by))}）` : ""}</p>` : ""}
    </section>`;
}

/** 关联设备：多选下拉，只有房屋耗材显示；选项就是 房屋 → 设备保养 里的设备 */
const pickText = (labels) => labels.join("、");
function assetField(v) {
  const all = linkableAssets(), picked = new Set(Array.isArray(v.asset_ids) ? v.asset_ids : []);
  const labels = all.filter((a) => picked.has(a.id)).map(assetLabel);
  return `<div class="span-2 only-house pick-field"><span class="pick-lbl" id="assetLinkLbl">${t("关联设备")}</span>
    ${all.length ? `<details class="pick">
      <summary aria-labelledby="assetLinkLbl"><span class="pick-val ${labels.length ? "" : "is-empty"}">${esc(labels.length ? pickText(labels) : t("不关联设备"))}</span><b class="pick-n" ${labels.length ? "" : "hidden"}>${labels.length}</b></summary>
      <div class="pick-panel" role="group" aria-labelledby="assetLinkLbl">
        ${all.length > 8 ? `<input type="search" class="pick-q" placeholder="${t("搜索设备")}" aria-label="${t("搜索设备")}">` : ""}
        ${all.map((a) => `<label class="pick-row check-inline"><input type="checkbox" name="asset_ids" value="${esc(a.id)}" data-label="${esc(assetLabel(a))}" ${picked.has(a.id) ? "checked" : ""}><span>${a.t?.icon || "⚙️"} ${esc(assetLabel(a))}</span></label>`).join("")}
      </div></details>
      <small class="muted">${t("可多选；设备页的“相关耗材”会列出它。")}</small>`
      : `<p class="muted" style="margin:4px 0 0;font-size:13px">${t("还没有设备。先在 房屋 → 设备保养 里添加，就能在这里关联。")}</p>`}</div>`;
}
// 关联设备下拉：勾选后更新标题；点外面或按 Esc 收起；设备多时可搜索
document.addEventListener("change", (e) => {
  const dd = e.target.closest?.("details.pick"); if (!dd) return;
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

/** silent=true：离开页面时自动保存（不跳转、不聚焦；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveItemForm(f, { silent = false } = {}) {
  const fe = f.elements, err = f.querySelector("#itemFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  const quantity = num(fe.quantity.value, NaN);
  if (!name) return fail(t("请填写物品名称。"), fe.name);
  if (!Number.isFinite(quantity) || quantity < 0) return fail(t("数量需要是 0 或正数。"), fe.quantity);
  // 单位没改且属于换算显示：换算回存储单位；数值没动过则保留原始值，避免来回换算产生误差
  const typedUnit = fe.unit.value.trim() || "个";
  const origUnit = fe.orig_unit.value, back = typedUnit === fe.disp_unit.value && typedUnit !== origUnit;
  const raw = state.items.find((x) => x.id === fe.item_id.value) || {};
  const val = (name) => {
    const el = fe[name];
    if (el.value === "") return null;
    if (!back) return Math.max(0, num(el.value));
    if (el.value === el.dataset.orig && raw[name] != null) return num(raw[name]);
    return Math.round((Math.max(0, num(el.value)) / Units.factor(origUnit)) * 1000) / 1000;
  };
  // 装备没有补货概念：清掉少货线、提醒天数、用量和保质期，保证它永远不进提醒
  const gear = spaceOf(fe.category.value) === "gear";
  const it = {
    id: fe.item_id.value || undefined, name,
    category: fe.category.value, subcategory: fe.subcategory.value || null,
    unit: back ? origUnit : typedUnit, quantity: Math.round(val("quantity") * 100) / 100,
    min_quantity: gear ? 0 : Math.round((val("min_quantity") || 0) * 100) / 100,
    lead_days: gear ? 0 : Math.min(60, Math.max(0, Math.round(num(fe.lead_days.value, 3)))),
    location: null, expiry_date: gear ? null : fe.expiry_date.value || null,
    avg_daily_use: gear ? null : val("avg_daily_use"),
    notes: fe.notes.value.trim() || null,
  };
  // 关联设备：只有房屋耗材存；没选过也没存过就不写这一列（还没执行迁移 021 的库也能照常保存）
  if (spaceOf(it.category) === "house") {
    const ids = [...f.querySelectorAll('input[name="asset_ids"]:checked')].map((x) => x.value);
    if (ids.length || raw.asset_ids?.length) it.asset_ids = ids;
  } else if (raw.asset_ids?.length) it.asset_ids = [];
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    it.location = await resolveLocation(fe);   // 选了“＋ 新位置…”会先建位置
    await Store.saveItem(it);
    if (silent) return true;
    toast(it.id ? t("已保存修改") : t("已添加 {name}", { name }));
    leaveItem(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}
