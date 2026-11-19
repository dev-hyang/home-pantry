/* 物品表单的保存：校验、写入、新建后跳转。 */
import { MUTE_FOREVER, catOf, num, spaceOf, toast, todayISO } from "../core/util.js";
import { Store } from "../core/store.js";
import { aliasesOf, findItem, normName } from "../core/item-match.js";
import { cleanStore, rememberStore } from "../stats/views.js";
import { muteChoice } from "./item-form-fields.js";
import { resolveLocation } from "../core/locations.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { leaveItem } from "./item-form-common.js";
import { purchasePayFields } from "../bills/card-picker.js";

/** silent=true：离开页面时自动保存（不跳转、不聚焦；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveItemForm(f, { silent = false } = {}) {
  const fe = f.elements, err = f.querySelector("#itemFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; const d = el.closest?.("details"); if (d) d.open = true; el.focus(); } return false; };
  const name = fe.name.value.trim();
  const quantity = num(fe.quantity.value, NaN);
  if (!name) return fail(t("请填写物品名称。"), fe.name);
  // 已有写法一样的物品（忽略大小写、空格、全角半角、英文复数）：不能再建一件同名的（迁移 066 的唯一索引），改名区分或去那件补库存
  const same = findItem(name, { exceptId: fe.item_id.value || null });
  if (same) return fail(t("已经有「{name}」（{cat}）。是同一样东西就去那件补库存；是另一件就在名字里加上品牌、规格区分。", { name: same.name, cat: t(catOf(same.category).name) }), fe.name);
  if (!Number.isFinite(quantity) || quantity < 0) return fail(t("数量需要是 0 或正数。"), fe.quantity);
  // 单位没改且属于换算显示：换算回存储单位；数值没动过则保留原始值，避免来回换算产生误差
  const typedUnit = Units.normalize(fe.unit.value) || "个";   // 英文界面填的 bottle、lbs 等也存成统一写法
  const origUnit = fe.orig_unit.value, back = typedUnit === fe.disp_unit.value && typedUnit !== origUnit;
  const raw = state.items.find((x) => x.id === fe.item_id.value) || {};
  const val = (name) => {
    const el = fe[name];
    if (el.value === "") return null;
    if (!back) return Math.max(0, num(el.value));
    if (el.value === el.dataset.orig && raw[name] != null) return num(raw[name]);
    return Math.round((Math.max(0, num(el.value)) / Units.factor(origUnit)) * 1000) / 1000;
  };
  // 家居耐用品没有补货概念：清掉少货线、提醒天数、用量和保质期，保证它永远不进提醒
  const gear = spaceOf(fe.category.value) === "gear", remind = !gear && !!fe.remind?.checked;   // 不提醒：少货线、提前天数都存 0
  const it = {
    id: fe.item_id.value || undefined, name,
    category: fe.category.value, subcategory: fe.subcategory.value || null,
    unit: back ? origUnit : typedUnit, quantity: Math.round(val("quantity") * 100) / 100,
    min_quantity: remind ? Math.round((val("min_quantity") || 0) * 100) / 100 : 0,
    lead_days: remind ? Math.min(60, Math.max(0, Math.round(num(fe.lead_days.value, 3)))) : 0,
    location: null, expiry_date: gear ? null : fe.expiry_date.value || null,
    avg_daily_use: gear ? null : val("avg_daily_use"),
    notes: fe.notes.value.trim() || null,
  };
  // 关联设备：只有汽车房屋消耗品存；没选过也没存过就不写这一列（还没执行迁移 021 的库也能照常保存）
  if (spaceOf(it.category) === "house") {
    const ids = [...f.querySelectorAll('input[name="asset_ids"]:checked')].map((x) => x.value);
    if (ids.length || raw.asset_ids?.length) it.asset_ids = ids;
  } else if (raw.asset_ids?.length) it.asset_ids = [];
  // 属于：只有汽车房屋消耗品存；其余永远为空
  const ow = spaceOf(it.category) === "house" ? (fe.owner?.value || "") : "";
  it.property_id = ow.startsWith("p:") ? ow.slice(2) : null; it.owner_asset_id = ow.startsWith("a:") ? ow.slice(2) : null;
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    it.location = await resolveLocation(fe);   // 选了“＋ 新位置…”会先建位置
    const savedId = await Store.saveItem(it);
    if (fe.aliases && (savedId || it.id)) {   // 别名：整组替换（和名字本身一样的、空的去掉）
      const id = savedId || it.id, list = [...new Set(fe.aliases.value.split(/[,，、;；]/).map((x) => x.trim().slice(0, 60)).filter((x) => x && normName(x) !== normName(it.name)))];
      if (list.join("|") !== aliasesOf(id).join("|")) await Store.setItemAliases(id, list).then(() => Store.listItemAliases()).then((r) => { state.itemAliases = r || []; }).catch(() => {});
    }
    if (!it.id && fe.sp_amount && fe.sp_amount.value !== "" && num(fe.sp_amount.value) > 0) {   // 添加物品时填了金额：记一笔花费，关联到新物品
      const store = cleanStore(fe.sp_store?.value || ""), date = fe.sp_date?.value || todayISO();
      await Store.addPurchase({ item_id: savedId || null, name: it.name, category: it.category, quantity: it.quantity || null, unit: it.unit || null, amount: Math.round(num(fe.sp_amount.value) * 100) / 100,
        currency: Units.region.currency, purchased_at: new Date(`${date}T12:00:00`).toISOString(), store, ...purchasePayFields(fe.sp_card?.value || "") });
      if (store) rememberStore(store);
    }
    if (it.id && raw.cat_check) await Store.clearCatCheck([it.id]).catch(() => {});   // 编辑页保存过 = 分类看过了，不再列在「请确认分类」里
    const sid = it.id || savedId;
    if (sid && !remind && !gear) {   // 不提醒：同一个开关（和库存行上的 🔔 一样），补货也不改
      if ((raw.alert_mute_until || null) !== MUTE_FOREVER) await Store.setItemMute(sid, MUTE_FOREVER).catch(() => {});
    } else if (it.id && fe.alert_mute && remind) {   // 不再提醒 / 暂停提醒：单独存（不放进通用字段，没执行迁移 030 的库其余保存照常）
      const until = muteChoice(fe.alert_mute.value, raw.alert_mute_until);
      if ((until || null) !== (raw.alert_mute_until || null)) { await Store.setItemMute(it.id, until); raw.alert_mute_until = until; }
    }
    if (silent) return true;
    toast(it.id ? t("已保存修改") : t("已添加 {name}", { name }));
    leaveItem(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = /items_household_name_key_uniq/.test(e.message) ? t("已经有同名的物品了：换个名字区分（品牌、规格），或去那件补库存。") : t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}
