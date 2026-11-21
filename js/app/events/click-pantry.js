/* 点击动作：储藏：库存、购物车、物品、分类、位置、耐用品。 */
import { $, MUTE_FOREVER, catOf, confirmDelete, inSpace, isGear, storedStep, toast } from "../../core/util.js";
import { PAGE_RENDER, refresh } from "../data.js";
import { Store } from "../../core/store.js";
import { addAlertsToShopping, addRecipeMissing, markBought, removeFromShopping, stepShopQty } from "../actions/shopping.js";
import { alertsOf, openShopFor } from "../../core/logic.js";
import { askConfirm, askRemind, leaveItem, openItem, pickSpace, pickSupplyAdd, supplyItem } from "../lazy-modules.js";
import { catFormOf } from "../../core/categories.js";
import { customLocations, deleteLocation, groupOf } from "../../core/locations.js";
import { findItem, normName } from "../../core/item-match.js";
import { go, href } from "../../core/router.js";
import { ownerMatch } from "../../pantry/owner.js";
import { pageMore } from "../../core/pager.js";
import { render } from "../render.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";
import { toList } from "../page-events.js";
import { catNeed, secNeed, setInvView, visibleItemIds } from "../../pantry/inv-sync.js";
import { shopVisibleIds } from "../../pantry/shop-sync.js";
import { moveCat } from "../../pantry/inventory-sync.js";
import { myName } from "../../settings/family-lite.js";
import { spendListNow } from "../lazy-modules.js";
import { renderSpendList } from "../lazy-modules.js";

/** 点击动作（储藏：库存、购物车、物品、分类、位置、耐用品）：这一组处理的 data-action */
export const PANTRY_ACTIONS = new Set(["inv-sel-start","shop-sel-start","add-item","edit","item-cancel","item-delete","inv-space","supply-add","gear-enable","gear-broke","inv-view","supply-add-pick","add-item-pick","inv-cat-shop","inv-sec-shop","inv-select","inv-sel-all","inv-sel-shop","inv-sel-mute","inv-sel-del","item-remind","inv-del","inv-shop","consume","restock","inv-sub","cat","cat-new","cat-edit","cat-cancel","cat-restore","cat-hide","inv-clear","loc-new","loc-edit","loc-cancel","loc-del","cat-delete","cat-sort","cat-move","goto-cat","goto-status","shop-add-item","shop-remove-item","shop-select","shop-sel-all","shop-sel-remove","cat-check-ok","cat-check-all","cat-check-alt","mute-item","shop-add-alerts","shop-import","shop-import-cancel","shop-claim","shop-unclaim","shop-bought","shop-qty","shop-del","shop-clear","diet","shuffle","slot-swap","page-more","purchase-del","recipe-missing"]);
/** 点击动作（储藏：库存、购物车、物品、分类、位置、耐用品）：按 data-action 分支；el 是被点的元素，id 是它的 data-id，e 是点击事件 */
export async function clickPantry(action, el, id, e) {
  switch (action) {
      case "add-item": return openItem(null, { space: el.dataset.space });
      case "edit": return openItem(id);
      case "item-cancel": return leaveItem(false);
      case "item-delete":
        if (!confirmDelete(t("删除这个物品？"))) return;
        await Store.deleteItem(state.route.id); toast(t("已删除")); return leaveItem(true);
      case "inv-space": return go(el.dataset.space === "house" ? `${href("pantry", "inventory")}?space=house` : el.dataset.space === "gear" ? href("pantry", "gear") : href("pantry", "inventory"));
      case "supply-add": {   // 设备页“相关耗材”：一键把推荐耗材加进库存
        const it = await supplyItem(el.dataset.name); if (!it) return;
        const have = findItem(it.name); if (have) { toast(t("库存里已有「{name}」", { name: have.name })); return go(href("item", have.id)); }
        await Store.addItems([it]); toast(t("已添加到库存：{name}", { name: it.name })); return refresh();
      }
      case "gear-enable":
        state.gearEnabled = true; try { localStorage.setItem("hmh-gear-off", "0"); } catch { /* 忽略 */ }
        return render();
      // 耐用品（家居耐用品，如厨房用品）坏了一件：数量减 1，并把换新的一件加进购物车（买到后自动加回库存）
      case "gear-broke": {
        const it = state.enriched.find((x) => x.id === id); if (!it || !isGear(it) || it.qty <= 0) return;
        if (!confirm(t("“{name}”坏了一件？数量会减 1，并加入购物车换新（买到后自动加回库存）。", { name: it.name }))) return;
        el.disabled = true;
        await Store.adjust(id, -1, "adjust");
        if (!openShopFor(id)) await Store.saveShopping({ item_id: id, name: it.name, quantity: 1, unit: it.unit, category: it.category });
        toast(t("{name} 少了一件，已加入购物车换新", { name: it.name }));
        return refresh();
      }
      case "inv-view": setInvView(el.dataset.view); state.invSel = null; return render();
      case "supply-add-pick": { const c = await pickSupplyAdd(); if (c) go(c === "manual" ? `${href("item", "new")}?space=house${el.dataset.scope || ""}` : href("house", "template")); return; }   // 消耗品空白页的 ＋：手动添加 / 按房屋设备资料推荐
      case "add-item-pick": { const sp = await pickSpace(); if (sp) go(`${href("item", "new")}?space=${sp}`); return; }   // ＋ 添加物品：先选放在哪一类
      case "inv-cat-shop": return addAlertsToShopping(catNeed(el.dataset.cat));   // 分类视图每个大类的「全部加入购物车」
      case "inv-sec-shop": return addAlertsToShopping(secNeed(el.dataset.space));   // 物品视图每个容器的「全部加入购物车」
      case "inv-select": state.invSel = state.invSel ? null : new Set(); return render();   // 「完成」：退出多选
      case "inv-sel-start": state.invSel = new Set([id]); return render();   // 长按菜单「多选」：进入多选，这一行先勾上
      case "inv-sel-all": { const ids = visibleItemIds(), all = ids.every((x) => state.invSel?.has(x)); state.invSel = new Set(all ? [] : ids); return render(); }
      case "inv-sel-shop": { const list = [...(state.invSel || [])].map((x) => state.enriched.find((i) => i.id === x)).filter(Boolean); state.invSel = null; return addAlertsToShopping(list); }
      case "inv-sel-mute": {
        const ids = [...(state.invSel || [])]; if (!ids.length) return;
        el.disabled = true; for (const x of ids) await Store.setItemMute(x, MUTE_FOREVER);
        toast(t("{n} 件设为不提醒", { n: ids.length })); state.invSel = null; return refresh();
      }
      case "inv-sel-del": {
        const ids = [...(state.invSel || [])]; if (!ids.length) return;
        const names = ids.map((x) => state.items.find((i) => i.id === x)?.name).filter(Boolean);
        if (!confirmDelete(t("删除这 {n} 件物品？\n{names}", { n: ids.length, names: names.slice(0, 8).join("、") + (names.length > 8 ? " …" : "") }))) return;
        el.disabled = true; for (const x of ids) await Store.deleteItem(x);
        toast(t("已删除 {n} 件物品", { n: ids.length })); state.invSel = null; return refresh();
      }
      case "item-remind": {   // 库存行上的「不提醒 / 🔔 …」标签：弹小框只改少货线和提前几天
        const it = state.enriched.find((x) => x.id === id); if (!it) return;
        const on = (Number(it.min_quantity) > 0 || Number(it.lead_days) > 0) && !(it.alert_mute_until && String(it.alert_mute_until) > new Date().toISOString().slice(0, 10));
        const r = await askRemind({ ...it, noRemind: !on }); if (!r) return;
        try {
          if (r.off) { await Store.setItemRemind(id, 0, 0, MUTE_FOREVER); toast(t("{name} 不再提醒", { name: it.name })); }
          else { await Store.setItemRemind(id, r.min, r.lead, null); toast(t("{name} 已设置提醒", { name: it.name })); }
        } catch (e) { return toast(e.message); }
        return refresh();
      }
      case "inv-del": { const it = state.items.find((x) => x.id === id); if (!it || !confirmDelete(t("删除「{name}」？", { name: it.name }))) return; await Store.deleteItem(id); toast(t("已删除 {name}", { name: it.name })); return refresh(); }
      case "inv-shop": {   // 右滑加入购物车（先确认数量和单位，见 addAlertsToShopping）
        const it = state.enriched.find((x) => x.id === id); if (!it) return;
        if (openShopFor(id)) { toast(t("{name} 已经在购物车里", { name: it.name })); return; }
        return addAlertsToShopping([it]);
      }
      case "consume": el.disabled = true; await Store.adjust(id, -storedStep(state.items.find((x) => x.id === id)?.unit), "consume"); return refresh();
      case "restock": el.disabled = true; await Store.adjust(id, storedStep(state.items.find((x) => x.id === id)?.unit), "restock"); return refresh();
      case "inv-sub": state.filter.sub = el.dataset.sub; return render();
      case "cat": state.filter.cat = el.dataset.cat; state.filter.sub = "all"; state.catSort = false; state.catForm = null; return render();
      case "cat-new": state.catForm = { space: el.dataset.space || state.filter.space }; render(); $("#catForm input[name=name]")?.focus(); return;
      case "cat-edit": { const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (c) state.catForm = catFormOf(c, t); render(); $("#catForm")?.scrollIntoView({ block: "start" }); return; }
      case "cat-cancel": state.catForm = null; return render();
      case "cat-restore": {   // 内置分类：删掉覆盖行，恢复默认名称 / 图标 / 小类
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c?.overridden) return;
        await Store.deleteCategory(c.dbId); state.catForm = null; toast(t("已恢复默认")); return refresh();
      }
      case "cat-hide": {   // 内置分类：隐藏（下面没有物品才行）/ 重新显示
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c || c.custom) return;
        const on = el.dataset.on === "1";
        if (on && state.items.some((i) => i.category === c.id)) return toast(t("这个分类下还有物品，先把它们改到别的分类"));
        const b = c.base || {}, changed = c.overridden && (c.name !== b.name || c.icon !== b.icon || c.color !== b.color || JSON.stringify(c.subs) !== JSON.stringify(b.subs));
        if (!on && c.dbId && !changed) await Store.deleteCategory(c.dbId);   // 只是隐藏过、没改别的：重新显示就把覆盖行删掉，不留“改过”标记
        else await Store.saveCategory({ id: c.dbId, key: c.id, space: c.space, name: changed ? c.name : null, icon: changed ? c.icon : null, color: changed ? c.color : null, loc: null, subs: changed ? c.subs : [], hidden: on, sort: 0 });
        state.catForm = null; if (on && state.filter.cat === c.id) state.filter.cat = "all"; toast(on ? t("已隐藏分类") : t("已重新显示")); return refresh();
      }
      case "inv-clear": Object.assign(state.filter, { q: "", status: "all", loc: "all", owner: "all" }); return render();
      // 设置 → 存放位置：新建 / 重命名 / 删除
      case "loc-new": state.locForm = { name: "", grp: el.dataset.grp || "custom" }; render(); $("#locForm input[name=name]")?.focus(); return;
      case "loc-edit": {
        const name = el.dataset.name, c = customLocations().find((x) => x.name === name);
        state.locForm = c ? { id: c.id, name: c.name, grp: c.grp, replaces: c.replaces, sort: c.sort, oldName: c.name } : { name, grp: groupOf(name)?.id || "custom", replaces: name, oldName: name };
        render(); $("#locForm input[name=name]")?.focus(); return;
      }
      case "loc-cancel": state.locForm = null; return render();
      case "loc-del": { const c = customLocations().find((x) => x.id === id); if (!c || !confirmDelete(t("删除这个位置？"))) return; await deleteLocation(state, c); state.locForm = null; return refresh(); }
      case "cat-delete": {
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c?.custom) return;
        if (state.items.some((i) => i.category === c.id)) return toast(t("这个分类下还有物品，先把它们改到别的分类"));
        if (!confirmDelete(t("删除这个分类？"))) return;
        await Store.deleteCategory(c.dbId); state.catForm = null; if (state.filter.cat === c.id) state.filter.cat = "all"; toast(t("已删除分类")); return refresh();
      }
      case "cat-sort": state.catSort = !state.catSort; return render();   // 手机仪表盘：调整方块顺序
      case "cat-move": moveCat(state.filter.space, el.dataset.cat, +el.dataset.dir); return render();
      case "goto-cat": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: el.dataset.cat, status: "all", q: "", owner: el.dataset.owner || "all" }); state.keepFilter = true; return go(toList(el.dataset.space));
      case "goto-status": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: "all", status: el.dataset.status, q: "" }); state.keepFilter = true; return go(toList(el.dataset.space));
      case "shop-add-item": return addAlertsToShopping([state.enriched.find((x) => x.id === id)]);
      case "shop-remove-item": return removeFromShopping([id]);
      case "shop-select": state.shopSel = state.shopSel ? null : new Set(); return render();   // 购物车「完成」：退出多选
      case "shop-sel-start": state.shopSel = new Set([id]); return render();   // 长按菜单「多选」：进入多选，这一行先勾上
      case "shop-sel-all": { const ids = shopVisibleIds(), all = ids.length && ids.every((x) => state.shopSel?.has(x)); state.shopSel = new Set(all ? [] : ids); return render(); }
      case "shop-sel-remove": {
        const rows = state.shopping.filter((s) => state.shopSel?.has(s.id)); if (!rows.length) return;
        const names = rows.map((s) => s.name), shown = names.slice(0, 3).join("、") + (names.length > 3 ? t("等 {n} 件", { n: names.length }) : "");
        if (!(await askConfirm({ title: t("移出购物车"), body: t("{names} 将被移出购物车，请确认", { names: shown }), ok: t("移出"), danger: true }))) return;
        for (const s of rows) await Store.deleteShopping(s.id);
        state.shopSel = null; toast(t("已移出购物车：{names}", { names: shown })); return refresh();
      }   // 该补货了：移出购物车（先确认）
      case "cat-check-ok": case "cat-check-all": {   // 「请确认分类」：没错 → 清标记（迁移 064）
        const ids = action === "cat-check-all" ? state.items.filter((x) => x.cat_check).map((x) => x.id) : [id];
        el.disabled = true;
        try { await Store.clearCatCheck(ids); } catch (e) { el.disabled = false; return toast(e.message); }
        if (ids.length > 1) toast(t("已确认 {n} 件", { n: ids.length }));
        return refresh();
      }
      case "cat-check-alt": {   // 「请确认分类」：改成候选分类，连着的花费、购物车跟着换
        const it = state.items.find((x) => x.id === id); if (!it) return;
        el.disabled = true;
        try { await Store.recatItem(id, el.dataset.cat, el.dataset.sub); } catch (e) { el.disabled = false; return toast(e.message); }
        toast(t("{name} 已改到 {cat}", { name: it.name, cat: t(catOf(el.dataset.cat).name) }));
        return refresh();
      }
      case "mute-item": {   // 注意事项里的“不再提醒”：一直不提醒，直到下次补货入库或在编辑页恢复
        const it = state.items.find((x) => x.id === id); if (!it) return;
        el.disabled = true;
        try { await Store.setItemMute(id, MUTE_FOREVER); toast(t("{name} 不再提醒了；下次补货入库，或在编辑页里可以恢复", { name: it.name })); } catch (e) { el.disabled = false; return toast(e.message); }
        return refresh();
      }
      case "shop-add-alerts": {
        const sp = el.dataset.space || "pantry";
        const pool = sp === "all" ? state.enriched.filter((x) => state.houseEnabled || inSpace("pantry")(x)) : state.enriched.filter(inSpace(sp));
        return addAlertsToShopping(alertsOf(el.dataset.owner ? pool.filter((x) => ownerMatch(x, el.dataset.owner, true)) : pool));
      }
      case "shop-import": {   // 牧羊人带来的采购项（#/shopping?add=…）：勾了的逐个加，按名字对上库存物品就关联
        const names = [...document.querySelectorAll("#shopImport input[type=checkbox]:checked")].map((x) => x.value);
        for (const name of names) { const it = findItem(name); if (state.shopping.some((s) => s.status !== "bought" && (it ? s.item_id === it.id : normName(s.name) === normName(name)))) continue; await Store.saveShopping({ name, quantity: 1, unit: it?.unit || "", item_id: it?.id || null, category: it?.category || "other" }); }
        toast(names.length ? t("已加进购物车：{n} 项", { n: names.length }) : t("没有勾选"));
        go(href("shopping"), { replace: true }); return refresh();
      }
      case "shop-import-cancel": go(href("shopping"), { replace: true }); return render(true);
      case "shop-claim": await Store.saveShopping({ id, status: "claimed", claimed_by: state.user?.id || null, claimed_by_name: myName() }); toast(t("已认领，家人会看到你在买")); return refresh();
      case "shop-unclaim": await Store.saveShopping({ id, status: "todo", claimed_by: null, claimed_by_name: null }); return refresh();
      case "shop-bought": {   // 右滑「已买到」先确认（替身按钮带 data-confirm）；直接点「已买到」按钮不弹框
        if (el.dataset.confirm) { const s = state.shopping.find((x) => x.id === id); if (!window.confirm(t("「{name}」已经买到了？", { name: s?.name || "" }))) return; }
        return markBought(id);
      }
      case "shop-qty": return stepShopQty(id, +el.dataset.dir);
      case "shop-del": if (!confirmDelete(t("从购物车删除这一项？"))) return; await Store.deleteShopping(id); return refresh();
      case "shop-clear": await Store.clearBought(); return refresh();
      case "diet": state.diet = el.dataset.diet; state.mealShift = 0; localStorage.setItem("hmh-diet", state.diet); return render();
      case "shuffle": state.mealShift++; state.slotShift = {}; return render();
      case "slot-swap": { const sl = state.slotShift || (state.slotShift = {}); sl[el.dataset.slot] = (sl[el.dataset.slot] || 0) + 1; return render(); }
      case "page-more": { const k = el.dataset.page; pageMore(k); const fn = PAGE_RENDER[k.split(":")[0]]; return fn ? fn() : render(false); }   // 「继续加载」：能只重画列表的就只重画列表
      case "purchase-del":   // 以前是「点两次」：左滑只替它点一次，所以滑了删不掉；现在用确认框
        if (!confirmDelete(t("删除这笔花费？"))) return;
        await Store.deletePurchase(id);
        const sl = spendListNow(); if (sl) sl.rows = sl.rows.filter((p) => p.id !== id); renderSpendList();   // 先从已读到的列表里拿掉（和多选删除一样），随后的重读再对一遍
        toast(t("已删除这笔记录")); if (state.route?.q?.get("view")) go(`${href("bills", "spend")}?tab=records`, { replace: true }); return refresh();
      case "recipe-missing": return addRecipeMissing(el.dataset.name);
  }
}
