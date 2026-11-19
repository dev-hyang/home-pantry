/* 购物车 / 库存数量的操作：加减、改单位、移出、买到了入库。 */
import { Store } from "../../core/store.js";
import { askConfirm, askShopItems } from "../lazy-modules.js";
import { du, fmt, money, num, showQty, toDisp, toast } from "../../core/util.js";
import { nameHas, openShopFor } from "../../core/logic.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";
import { shopUnit } from "../../pantry/shop-sync.js";
import { scoreRecipes } from "../../pantry/meals-sync.js";
import { purchasePayFields, rememberCard } from "../../bills/card-picker.js";
import { myName } from "../../settings/family-lite.js";
import { cleanStore, rememberStore } from "../../stats/store-lite.js";

/** 购物车改数量：按显示单位 ±一步（kg 0.5、lb 1、个 1…），最少一步；存回时换回原单位 */
export async function stepShopQty(id, dir) {
  const s = state.shopping.find((x) => x.id === id); if (!s) return;
  const unit = shopUnit(s), step = Units.step(du(unit)), f = Units.factor(unit);
  const disp = Math.max(step, Math.round((num(s.quantity, 1) * f + dir * step) * 100) / 100);
  await Store.saveShopping({ id, quantity: Math.round((disp / f) * 10000) / 10000 });
  refresh();
}
/** 购物车改单位：数量框里的数字不变，按新单位重新解释（和物品编辑页一样可以输入任何单位）；没改就什么也不做 */
export async function setShopUnit(id, value) {
  const s = state.shopping.find((x) => x.id === id); if (!s) return;
  const cur = shopUnit(s), typed = Units.normalize(value).slice(0, 10);   // 英文界面填 bottle / lbs 也存成统一写法
  if (!typed || typed === Units.normalize(du(cur))) return;
  const disp = toDisp(num(s.quantity, 1), cur);
  await Store.saveShopping({ id, unit: typed, quantity: Math.round((disp / Units.factor(typed)) * 10000) / 10000 });
  refresh();
}
/** 购物车直接输入数量（显示单位）；空或 ≤ 0 就回到原值 */
export async function setShopQty(id, value) {
  const s = state.shopping.find((x) => x.id === id); if (!s) return;
  const disp = num(value), f = Units.factor(shopUnit(s));
  if (!(disp > 0)) return render();
  await Store.saveShopping({ id, quantity: Math.round((disp / f) * 10000) / 10000 });
  refresh();
}
/** 库存物品行：直接改数量（按显示单位填，存回原单位；差额记一条调整记录） */
export async function setItemQty(id, v) {
  const it = state.items.find((x) => x.id === id), n = num(v, NaN); if (!it) return;
  if (!Number.isFinite(n) || n < 0) { toast(t("数量需要是 0 或正数。")); return render(); }
  const stored = Math.round((n / (Units.factor(it.unit) || 1)) * 100) / 100, d = Math.round((stored - num(it.quantity)) * 100) / 100;
  if (!d) return;
  try { await Store.adjust(id, d, "adjust"); toast(t("{name} 改成 {q}", { name: it.name, q: fmt(n) })); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); }
  refresh();
}
/** 库存物品行：改单位（只换单位名称，数量按现在显示的数字存，不做换算） */
export async function setItemUnit(id, v) {
  const it = state.items.find((x) => x.id === id), u = Units.normalize(v) || String(v || "").trim().slice(0, 10); if (!it || !u || u === "__other") return render();
  const row = document.querySelector(`.inv-row[data-id="${CSS.escape(id)}"] [data-inv-qty]`), q = row ? num(row.value, num(it.quantity)) : num(it.quantity);
  if (u === it.unit && q === num(it.quantity)) return;
  try { await Store.saveItem({ ...it, unit: u, quantity: Math.round(q * 100) / 100 }); toast(t("{name} 的单位改成 {u}", { name: it.name, u: t(u) })); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); }
  refresh();
}
/** 移出购物车：先确认（页面里的确认框），再删掉购物车里这些物品还没买到的那几条 */
export async function removeFromShopping(ids) {
  const items = ids.map((x) => state.items.find((i) => i.id === x)).filter(Boolean);
  const rows = state.shopping.filter((s) => s.status !== "bought" && ids.includes(s.item_id));
  if (!rows.length) { toast(t("已经不在购物车里了")); return refresh(); }
  const names = items.map((i) => i.name), shown = names.slice(0, 3).join("、") + (names.length > 3 ? t("等 {n} 件", { n: names.length }) : "");
  if (!(await askConfirm({ title: t("移出购物车"), body: t("{names} 将被移出购物车，请确认", { names: shown }), ok: t("移出"), danger: true }))) return refresh();
  for (const r of rows) await Store.deleteShopping(r.id);
  toast(t("已移出购物车：{names}", { names: shown })); refresh();
}
/** 所有「加入购物车」按钮（行上的、右滑、全部加入、多选）：已在清单里的跳过，其余先弹框确认每件的数量和单位（js/pantry/shop-ask.js） */
export async function addAlertsToShopping(list) {
  const fresh = list.filter((it) => it && !openShopFor(it.id));
  if (!fresh.length) { toast(list.length > 1 ? t("这些都已经在清单里了") : t("已经在购物车里了")); return refresh(); }
  const picked = await askShopItems(fresh);
  if (!picked) return refresh();
  for (const { it, quantity, unit } of picked) await Store.saveShopping({ item_id: it.id, name: it.name, quantity, unit, category: it.category });
  const one = picked.length === 1 ? picked[0] : null;
  toast(one ? t("已加入购物车：{name} {q} {u}", { name: one.it.name, q: fmt(one.quantity), u: t(one.unit) }) : t("已加入购物车 {n} 项", { n: picked.length }));
  refresh();
}
export async function addRecipeMissing(recipeName) {
  const r = scoreRecipes().find((x) => x.name === recipeName);
  if (!r) return;
  const openNames = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => s.name));
  let added = 0;
  for (const p of r.parts.filter((x) => !x.item)) {
    const existing = state.items.find((i) => nameHas(i.name, p.kw));
    const name = existing?.name || t(p.kw[0]);
    if (openNames.has(name) || (existing && openShopFor(existing.id))) continue;
    await Store.saveShopping({ name, quantity: 1, unit: existing?.unit || "", item_id: existing?.id || null, category: existing?.category || "fresh" });
    added++;
  }
  toast(added ? t("“{recipe}”缺的 {n} 样已加入清单", { recipe: t(recipeName), n: added }) : t("缺的食材已经在清单里了"));
  refresh();
}
export async function markBought(id) {
  const s = state.shopping.find((x) => x.id === id);
  if (!s) return;
  const priceEl = document.querySelector(`[data-price-for="${CSS.escape(id)}"]`);
  const amount = priceEl && priceEl.value !== "" ? Math.round(Math.max(0, num(priceEl.value)) * 100) / 100 : null;
  const store = cleanStore(document.querySelector(`[data-store-for="${CSS.escape(id)}"]`)?.value);
  if (store) rememberStore(store);
  const item = state.items.find((i) => i.id === s.item_id);
  const qty = num(s.quantity, 1), now = new Date().toISOString();
  await Store.saveShopping({ id, status: "bought", bought_at: now, amount, claimed_by_name: s.claimed_by_name || myName() });
  const paySel = document.querySelector(`[data-card-for="${CSS.escape(id)}"]`), payV = paySel?.value || ""; if (paySel) rememberCard(payV);
  await Store.addPurchase({
    item_id: item?.id || null, name: s.name, category: item?.category || s.category || "other",
    quantity: qty, unit: s.unit || item?.unit || null, amount, currency: Units.region.currency, purchased_at: now, store, ...purchasePayFields(payV),
  });
  const fit = item && s.unit ? Units.fit(s.unit, item.unit) : { kind: "same", factor: 1 };
  if (item) {
    if (fit.kind === "same") {
      await Store.adjust(item.id, Math.round(qty * 100) / 100, "restock");
      toast(t("{name} 已入库 +{q}，记得更新保质期", { name: s.name, q: showQty(qty, item.unit) }));
    } else if (fit.kind === "convert" || fit.kind === "count") {
      // 2026-11-12：能换算的（lb → kg）换成库存的单位再补；计数单位之间（个 → 瓶）按 1:1 补。库存单位不动，提示一下换算了什么
      const add = Math.round(qty * fit.factor * 100) / 100;
      await Store.adjust(item.id, add, "restock");
      toast(t("{name} 已入库 +{q}（{q1} {u1} 按库存单位记成 {q}），记得更新保质期", { name: s.name, q: showQty(add, item.unit), q1: fmt(toDisp(qty, s.unit)), u1: t(du(s.unit)) }));
    } else {
      // 采购时改了单位：库存的单位跟着改成新单位。能换算的（kg ↔ lb 等）把原有库存、最低库存、日均用量一起换成新单位；换算不了的（个 → 包）数字照旧，只换单位
      const r = Units.convert(1, item.unit, s.unit), k = r == null ? 1 : r, r2 = (v) => Math.round(v * 100) / 100;
      const scale = (v) => (v == null || v === "" ? v : r2(num(v) * k));
      await Store.saveItem({ ...item, unit: s.unit, quantity: scale(item.quantity), min_quantity: scale(item.min_quantity), avg_daily_use: scale(item.avg_daily_use) });
      await Store.adjust(item.id, r2(qty), "restock");
      toast(t("{name} 已入库 +{q}，库存单位由 {u1} 改为 {u2}{note}，记得更新保质期", { name: s.name, q: showQty(qty, s.unit), u1: t(item.unit), u2: t(s.unit), note: r == null ? t("（单位无法换算，原库存数字没变）") : "" }));
    }
  } else toast(t("{name} 已买到", { name: s.name }) + (amount != null ? t("，花费 {m}", { m: money(amount) }) : ""));
  refresh();
}
