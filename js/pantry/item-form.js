import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, catOf, catsOf, du, esc, fmt, listRoute, num, spaceOf, stampText, toast } from "../core/util.js";
import { go, href } from "../core/router.js";
import { memberName } from "../core/logic.js";
import { categoryOptions } from "./views.js";

/* ───────────── 物品编辑：独立整页（路由 #/item/<id> 或 #/item/new） ─────────────
 * 用网址表示编辑页：手机返回手势、浏览器后退都能退出；返回时由 main.js 恢复来源页的滚动位置。 */
export function subOptions(catId, selected) {
  return catOf(catId).subs.map((s) => `<option ${s === selected ? "selected" : ""}>${esc(s)}</option>`).join("");
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
  if (state.prevRoute) history.back();
  else go(href(...listRoute(spaceOf(state.editingCat || "fresh"))), { replace: true });
}

const SECTION_LABEL = { today: "今日", pantry: "储藏", house: "房屋", gear: "装备", shopping: "采购清单", me: "我的" };
const NAME_HINT = { pantry: "例如：鸡蛋、抽纸、大米", house: "例如：炉子滤网、电池、融雪盐", gear: "例如：被罩、千斤顶、儿童自行车" };

export function viewItemForm() {
  const r = state.route;
  const it = r.id && r.id !== "new" ? state.items.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !it) {
    return `<div class="panel empty"><strong>找不到这件物品</strong>可能已被家人删除。<p><a class="btn btn-primary" href="${href("pantry", "inventory")}">回到库存</a></p></div>`;
  }
  const space = r.q.get("space") || (state.filter.space || "pantry");
  const qCat = r.q.get("cat");
  const defCat = qCat && CATEGORIES.some((c) => c.id === qCat) ? qCat
    : state.filter.space === space && state.filter.cat !== "all" ? state.filter.cat : catsOf(space)[0].id;
  const v = it || { category: defCat, unit: "个", quantity: 1, min_quantity: space === "gear" ? 0 : 1, lead_days: space === "house" ? 14 : space === "gear" ? 0 : 3, location: catOf(defCat).loc };
  state.editingCat = v.category;
  const gear = spaceOf(v.category) === "gear";
  const backLabel = state.prevRoute ? SECTION_LABEL[state.prevRoute.section] || "上一页" : "列表";
  const f = Units.factor(v.unit), dUnit = du(v.unit);
  const dv = (x) => (x == null || x === "" ? "" : fmt(num(x) * f));
  return `
    <section class="section form-page">
      <div class="section-head">
        <h2>${it ? `编辑：${esc(it.name)}` : "添加物品"}</h2>
        <button type="button" class="btn btn-sm btn-ghost" data-action="item-cancel">返回${backLabel}</button>
      </div>
      <form id="itemForm" class="panel ${gear ? "is-gear" : ""}" novalidate>
        <input type="hidden" name="item_id" value="${esc(it?.id || "")}">
        <input type="hidden" name="orig_unit" value="${esc(v.unit)}">
        <input type="hidden" name="disp_unit" value="${esc(dUnit)}">
        <fieldset>
          <legend>基本信息</legend>
          <div class="form-grid">
            <label class="span-2">名称
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${NAME_HINT[spaceOf(v.category)] || NAME_HINT.pantry}" value="${esc(v.name || "")}">
            </label>
            <label>大类
              <select name="category" required>${categoryOptions(v.category, { withOther: false })}</select>
            </label>
            <label>小类
              <select name="subcategory">${subOptions(v.category, v.subcategory)}</select>
            </label>
            <label>存放位置
              <select name="location"><option value="">未指定</option>${LOCATIONS.map((l) => `<option ${l === v.location ? "selected" : ""}>${l}</option>`).join("")}</select>
            </label>
            <label class="not-gear">保质期至
              <input name="expiry_date" type="date" value="${esc(v.expiry_date || "")}">
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend><span class="not-gear">数量与提醒</span><span class="only-gear">数量</span></legend>
          <p class="muted only-gear" style="margin:0 0 10px;font-size:13px">装备只记数量和位置，不算消耗，也不会提醒补货。</p>
          <div class="form-grid">
            <label>当前数量
              <input name="quantity" type="number" min="0" step="any" inputmode="decimal" required value="${dv(v.quantity ?? 0)}" data-orig="${dv(v.quantity ?? 0)}">
            </label>
            <label>单位
              <input name="unit" list="unitList" maxlength="10" required value="${esc(dUnit || "个")}">
              ${dUnit !== v.unit ? `<small>原单位 ${esc(v.unit)}，已按当前地区换算显示</small>` : ""}
            </label>
            <label class="not-gear">少货线
              <input name="min_quantity" type="number" min="0" step="any" inputmode="decimal" value="${dv(v.min_quantity ?? 0)}" data-orig="${dv(v.min_quantity ?? 0)}">
              <small>数量低于或等于它时提醒“少货”</small>
            </label>
            <label class="not-gear">提前几天提醒
              <input name="lead_days" type="number" min="0" max="60" step="1" inputmode="numeric" value="${esc(v.lead_days ?? 3)}">
              <small>预计剩余天数低于它时提醒“即将告罄”</small>
            </label>
            <label class="span-2 not-gear">每天大约用多少（可选）
              <input name="avg_daily_use" type="number" min="0" step="any" inputmode="decimal" placeholder="留空则根据家人的使用记录自动估算" value="${dv(v.avg_daily_use)}" data-orig="${dv(v.avg_daily_use)}">
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>备注</legend>
          <label class="sr-only" for="itemNotes">备注</label>
          <textarea id="itemNotes" name="notes" rows="3" maxlength="500" placeholder="${gear ? "品牌、型号、尺寸、购买时间、借给了谁…" : "品牌、规格、在哪买更便宜…"}">${esc(v.notes || "")}</textarea>
        </fieldset>
        <p id="itemFormError" class="form-error" role="alert"></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${it ? "保存修改" : "添加物品"}</button>
          <button type="button" class="btn btn-ghost" data-action="item-cancel">取消</button>
          ${it ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="item-delete">删除物品</button>` : ""}
        </div>
      </form>
      ${it && stampText(it) ? `<p class="record-meta">${esc(stampText(it))}${Store.mode === "cloud" && memberName(it.updated_by) ? `（${esc(memberName(it.updated_by))}）` : ""}</p>` : ""}
    </section>`;
}

export async function saveItemForm(f) {
  const fe = f.elements, err = $("#itemFormError");
  const name = fe.name.value.trim();
  const quantity = num(fe.quantity.value, NaN);
  if (!name) { err.textContent = "请填写物品名称。"; return fe.name.focus(); }
  if (!Number.isFinite(quantity) || quantity < 0) { err.textContent = "数量需要是 0 或正数。"; return fe.quantity.focus(); }
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
    location: fe.location.value || null, expiry_date: gear ? null : fe.expiry_date.value || null,
    avg_daily_use: gear ? null : val("avg_daily_use"),
    notes: fe.notes.value.trim() || null,
  };
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await Store.saveItem(it);
    toast(it.id ? "已保存修改" : `已添加 ${name}`);
    leaveItem(true);
  } catch (e) { err.textContent = `保存失败：${e.message}`; btn.disabled = false; }
}
