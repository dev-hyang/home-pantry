/* 常去的商店的操作：点击动作、导入特价、核对保存，以及页面加载后绑定表单提交 / 搜索 / 筛选。 */
import { $, confirmDelete, toast } from "../core/util.js";
import { MAX_MI, chainOf, claudePrompt, cleanDeals, dealPrompt, importGroups, linkItems, openShopping, parseLooseJson, rememberPoint, replaceable, weekWindow, zipToPoint } from "./logic.js";
import { Store } from "../core/store.js";
import { aiReady, askText } from "../core/ai.js";
import { attachPayload, attachReset } from "../core/attach.js";
import { dtSummary, pickDeal } from "./shop-detail.js";
import { dvUi } from "./shops-deals.js";
import { go, href } from "../core/router.js";
import { installAutoHook } from "./shops-runs.js";
import { lang, t } from "../core/i18n.js";
import { pickedDeal } from "./lite.js";
import { state } from "../core/state.js";
import { dealUi, home, ui } from "./shops-common.js";

/* ───────────── 操作 ───────────── */
export const shopById = (id) => (state.shops || []).find((s) => s.id === id);
function upsertLocal(row) { const i = state.shops.findIndex((x) => x.id === row.id); if (i >= 0) state.shops[i] = row; else state.shops.push(row); }
async function addShop(row) { const saved = await Store.saveShop(row); upsertLocal(saved); return saved; }
function formRow(f) {
  const g = (n) => f.elements[n]?.value.trim() || null;
  const name = g("name"), chain = chainOf(name);
  return { name, chain, category: g("category") || "groceries", zip: g("zip"), address: g("address"), ad_url: g("ad_url"), phone: g("phone"), refresh: g("refresh") || "weekly", refresh_dow: +(g("refresh_dow") ?? 3), notes: g("notes"),
    ...(state.runsMissing ? {} : { auto_update: !!f.elements.auto_update?.checked && (g("refresh") || "weekly") === "weekly" }) };   // 没执行 068 时不送这一列
}
export async function shopsAction(action, el, { render, go, refresh }) {
  const u = ui(), id = el.dataset.id;
  switch (action) {
    case "shops-new": {   // 再点一次收起来
      if (u.edit === "new") { u.edit = null; render(); return; }
      u.edit = "new"; render(); const f = $("#shopEditForm"); f?.scrollIntoView({ block: "nearest", behavior: "smooth" }); f?.elements.name.focus({ preventScroll: true }); return;
    }
    case "shops-edit": u.edit = id; render(); return;
    case "shops-edit-cancel": u.edit = null; render(); return;
    case "shops-status": u.status = el.dataset.v; render(); return;
    case "shops-cat": u.cat = el.dataset.v; render(); return;
    case "shops-reset": Object.assign(u, { q: "", cat: "", status: "active", sort: "name" }); render(); return;
    case "shops-radius": u.find.radius = +el.dataset.v; render(); return;
    case "shops-find-fresh": if (u.find.pt) { u.find.fresh = true; runFind(render); } return;
    case "shops-fcat": { const c = el.dataset.v, cs = u.find.cats; u.find.cats = cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]; render(); return; }
    case "shops-archive": { const s = shopById(id); if (!s) return; upsertLocal(await Store.saveShop({ ...s, archived: true })); u.edit = null; toast(t("{name} 已收进「不去了」，随时可以加回来", { name: s.name })); render(); return; }
    case "shops-unarchive": { const s = shopById(id); if (!s) return; upsertLocal(await Store.saveShop({ ...s, archived: false })); toast(t("{name} 已加回常去", { name: s.name })); render(); return; }
    case "shops-del": {
      const s = shopById(id); if (!s) return;
      if (!confirmDelete(t("删除「{name}」和它的 {n} 条特价？只是不想去了的话，用「不去了」就行，还能加回来。", { name: s.name, n: (state.shopDeals || []).filter((d) => d.shop_id === id).length }))) return;
      await Store.deleteShop(id); state.shops = state.shops.filter((x) => x.id !== id); state.shopDeals = state.shopDeals.filter((d) => d.shop_id !== id); u.edit = null;
      toast(t("已删除 {name}", { name: s.name })); if (state.route.sub === "shop") go(href("shops", "list"), { replace: true }); else render(); return;
    }
    case "shops-locate": {
      if (!navigator.geolocation) { u.find.error = t("这个浏览器拿不到位置，请填 ZIP。"); return render(); }
      u.find.busy = true; u.find.error = ""; render();
      navigator.geolocation.getCurrentPosition(async (p) => { u.find.pt = { zip: "", lat: p.coords.latitude, lon: p.coords.longitude, place: t("当前位置") }; u.find.busy = false; await runFind(render); },
        () => { u.find.busy = false; u.find.error = t("没拿到位置（可能没允许），请填 ZIP。"); render(); }, { timeout: 15000, maximumAge: 600000 });
      return;
    }
    case "shops-add-osm": {
      const x = (u.find.results || []).find((r) => r.osm_id === el.dataset.osm); if (!x) return;
      el.disabled = true;
      const { dist, ...row } = x; const saved = await addShop(row);
      toast(t("已加入 {name}", { name: saved.name })); render(); return;
    }
    case "shops-starter": return starter(render);
    case "shops-claude": u.claude = !u.claude; u.copyText = ""; render(); return;
    case "shops-claude-copy": {
      const one = id ? shopById(id) : null, shops = one ? [one] : (state.shops || []).filter((s) => !s.archived);
      const list = el.dataset.mode === "list" ? openShopping().map((s) => s.name) : [];
      if (el.dataset.mode === "list" && !list.length) { toast(t("购物车是空的。")); return; }
      const text = claudePrompt({ shops, zip: home()?.zip || "", list });
      try { await navigator.clipboard.writeText(text); u.copyText = ""; toast(t("已复制：在 Chrome 侧边栏里粘贴给 Claude")); }
      catch { u.copyText = text; }
      render(); return;
    }
    case "shops-import-parse": {
      u.impText = $("#shopsImportText")?.value || ""; u.impError = "";
      try { u.imp = importGroups(parseLooseJson(u.impText)); } catch { u.imp = null; u.impError = t("这段不是 JSON。把 Claude 最后 ```json 里的内容整段贴过来。"); }
      render(); return;
    }
    case "shops-import-cancel": u.imp = null; u.impText = ""; u.impError = ""; render(); return;
    case "shops-import-save": return importSave(render);
    case "shops-read": return readDeals(id, render);
    case "shops-manual": { const du = dealUi(id); du.rows = [{ include: true, name: "", size: null, price: null, price_text: null, unit_price: null, unit_label: null, valid_from: weekWindow(shopById(id)).valid_from || null, valid_to: weekWindow(shopById(id)).valid_to || null, aka: null, category: null }]; du.manual = true; du.replace = false; render(); return; }
    case "shops-addrow": { const du = dealUi(id); keepReview(du); du.rows.push({ include: true, name: "" }); render(); return; }
    case "shops-discard": { const du = dealUi(id); du.rows = null; du.error = ""; render(); return; }
    case "shops-dfilter": dealUi(id).filter = el.dataset.v; render(); return;
    case "shops-dreset": Object.assign(dealUi(id), { q: "", cat: "", type: "", filter: "all" }); render(); return;
    case "shops-deal-edit": dealUi(id).edit = el.dataset.deal; render(); return;
    case "shops-pick": { const s = (state.shopping || []).find((x) => x.id === el.dataset.item); if (!s) return; const cur = pickedDeal(s); await pickDeal(s.id, cur?.id === el.dataset.deal ? null : el.dataset.deal, { rerender: true }); return; }   // 再点一次「已选这家」= 取消，回到默认
    case "shops-dv-mode": { const v = dvUi(); v.mode = ["cards", "group"].includes(el.dataset.v) ? el.dataset.v : "list"; try { localStorage.setItem("hp-dv-mode", v.mode); } catch { /* 忽略 */ } render(); return; }
    case "shops-dv-reset": Object.assign(dvUi(), { q: "", shop: "", cat: "", type: "", f: "all" }); render(); return;
    case "shops-hist": { const d = (state.shopDeals || []).find((x) => x.id === el.dataset.deal); if (!d) return; const du = dealUi(d.shop_id); du.hist = du.hist === d.id ? null : d.id; render(); return; }
    case "shops-deal-cancel": dealUi(id).edit = null; render(); return;
    case "shops-deal-del": {
      const d = (state.shopDeals || []).find((x) => x.id === el.dataset.deal); if (!d) return;
      if (!confirmDelete(t("删除特价「{name}」？", { name: d.name }))) return;
      await Store.deleteShopDeals([d.id]); state.shopDeals = state.shopDeals.filter((x) => x.id !== d.id); render(); return;
    }
    case "shops-tolist": {
      const d = (state.shopDeals || []).find((x) => x.id === el.dataset.deal); if (!d) return;
      const name = (String(d.aka || "").split(/[,，]/).map((x) => x.trim()).find((x) => lang !== "en" ? /[一-鿿]/.test(x) : /^[\x20-\x7e]+$/.test(x)) || d.name).slice(0, 60);
      if (!window.confirm(t("把「{name}」加入购物车？", { name }))) return;   // 右滑加入清单也走这里：取消 = 不加
      await Store.saveShopping({ name, quantity: 1, unit: Units.guess(name) || Units.guess(d.name) || "", item_id: null, category: "other" });
      toast(t("已加入购物车：{name}", { name })); return refresh();
    }
  }
}
/** 把一家的特价存进去：replace = 先删掉这家现有的有效特价；记下更新时间。返回 { added, replaced } */
export async function applyDeals(shop, rows, { source, replace }) {
  rows = linkItems(rows);   // 对上家里的物品名（中文也行）：不同牌子的同一样东西合在一起比
  const old = replace ? replaceable(shop, rows).map((d) => d.id) : [];   // 到期比这一期晚、新广告里又没有的留着
  const saved = await Store.addShopDeals(rows.map(({ include, ...r }) => ({ ...r, ...(state.runsMissing ? { deal_type: undefined } : {}), shop_id: shop.id, source,
    price: r.price == null || Number.isNaN(+r.price) ? null : Math.round(+r.price * 100) / 100, unit_price: r.unit_price == null || Number.isNaN(+r.unit_price) ? null : +r.unit_price })));
  if (old.length) { await Store.deleteShopDeals(old); state.shopDeals = state.shopDeals.filter((d) => !old.includes(d.id)); }
  state.shopDeals.push(...saved);
  upsertLocal(await Store.saveShop({ ...shop, deals_at: new Date().toISOString() }));
  return { added: saved.length, replaced: old.length };
}
/** 更新记录（迁移 068）：每次录入一条；068 没执行时安静跳过，不影响录入 */
export async function logRun(source, stores, note = null) {
  if (state.runsMissing) return null;
  const status = stores.every((x) => x.error) ? "failed" : stores.some((x) => x.error) ? "partial" : "ok";
  try { const row = await Store.addDealRun({ source, status, stores, note }); (state.dealRuns ||= []).unshift(row); return row; }
  catch (e) { console.warn("[shops] run log", e.message); return null; }
}
async function importSave(render) {
  const u = ui(), groups = (u.imp || []).filter((g, i) => g.shop && (document.querySelector(`[data-imp="${i}"]`)?.checked ?? g.include));
  if (!groups.length) { u.impError = t("没有勾选任何一家。"); return render(); }
  const replace = document.getElementById("shopsImpReplace")?.checked !== false;
  let n = 0, m = 0; const log = [];
  for (const g of groups) {
    try { const r = await applyDeals(g.shop, g.rows, { source: "claude", replace }); n += r.added; m += r.replaced; log.push({ shop_id: g.shop.id, name: g.shop.name, ...r }); }
    catch (e) { log.push({ shop_id: g.shop.id, name: g.shop.name, added: 0, replaced: 0, error: String(e.message).slice(0, 200) }); }
  }
  await logRun("claude", log);
  u.imp = null; u.impText = ""; u.claude = false;
  toast(t("已导入 {s} 家共 {n} 条特价", { s: groups.length, n }) + (m ? t("，替换了旧的 {m} 条", { m }) : "")); render();
}
async function readDeals(id, render) {
  const s = shopById(id), du = dealUi(id), att = `shopdeal-${id}`; if (!s) return;
  const pay = attachPayload(att);
  if (!pay.images.length && !pay.text.trim()) { du.error = t("先拍几张广告、截图，或粘贴文字。"); return render(); }
  du.error = "";
  // Claude（或别的工具）已经整理好的 JSON：不用 AI，直接导入
  if (!pay.images.length) { try { const j = parseLooseJson(pay.text); const rows = cleanDeals(j?.stores ? j.stores.find((x) => chainOf(x.store || x.name) === s.chain) || j.stores[0] : j, weekWindow(s)); if (rows.length) { du.rows = rows; du.source = "claude"; du.manual = false; du.replace = true; return render(); } } catch { /* 不是 JSON，交给 AI 读 */ } }
  if (!aiReady()) { du.error = t("读图片和普通文字要先在设置里填 AI key；Claude 整理好的 JSON 可以直接导入。"); return render(); }
  du.busy = true; render();
  try {
    const { system, user } = dealPrompt(s, lang);
    const txt = await askText(system, `${user}${pay.text.trim() ? `\n\nPasted text:\n${pay.text.trim().slice(0, 15000)}` : ""}${pay.images.length ? `\n\n${pay.images.length} image(s)/file(s) attached.` : ""}`, { json: true, images: pay.images, temperature: 0.1, maxTokens: 6000 });
    const rows = cleanDeals(parseLooseJson(txt), weekWindow(s));
    if (!rows.length) du.error = t("没读出特价。换一张更清楚的截图，或先在页面上搜出具体商品再截。");
    else { du.rows = rows; du.source = pay.images.length ? "photo" : "paste"; du.manual = false; du.replace = true; }
  } catch (e) { du.error = t("读取失败：{msg}", { msg: e.message }); }
  du.busy = false; render();
}
async function saveReview(f, render) {
  const id = f.dataset.id, s = shopById(id), du = dealUi(id); if (!s) return;
  keepReview(du);
  const rows = du.rows.filter((r) => r.include && r.name);
  if (!rows.length) { du.error = t("没有勾选任何一条。"); return render(); }
  const src = du.manual ? "manual" : du.source || "photo";
  const r = await applyDeals(s, rows, { source: src, replace: !!du.replace });
  await logRun(src, [{ shop_id: s.id, name: s.name, ...r }]);
  du.rows = null; du.manual = false; attachReset(`shopdeal-${id}`);
  toast(t("已保存 {n} 条特价", { n: r.added }) + (r.replaced ? t("，替换了旧的 {m} 条", { m: r.replaced }) : "")); render();
}
async function saveDealEdit(f, render) {
  const d = (state.shopDeals || []).find((x) => x.id === f.dataset.id); if (!d) return;
  const g = (n) => f.elements[n]?.value.trim() ?? "";
  const row = { ...d, name: g("name").slice(0, 80) || d.name, size: g("size") || null, price: g("price") === "" ? null : Math.round(+g("price") * 100) / 100, price_text: g("price_text") || null,
    unit_price: g("unit_price") === "" ? null : +g("unit_price"), unit_label: g("unit_label") || null, valid_to: g("valid_to") || null, aka: g("aka") || null,
    deal_type: [...f.querySelectorAll('[name="deal_type"]:checked')].map((x) => x.value).slice(0, 4).join(",") || null };
  await Store.saveShopDeal(row); Object.assign(d, row); dealUi(d.shop_id).edit = null; toast(t("已保存")); render();
}
/* 表单提交、输入：在 document 上监听（和录入购物一样），render 由 main.js 注入 */
export let R = () => {};
export function bindShops(render) {
  R = render;
  installAutoHook();
  // 折扣类型下拉：勾选时更新显示的文字；点下拉外面就收起
  document.addEventListener("change", (e) => {
    const box = e.target.closest?.(".dt-drop"); if (!box || e.target.name !== "deal_type") return;
    const v = box.querySelector(".dt-val"); if (v) v.textContent = dtSummary([...box.querySelectorAll('[name="deal_type"]:checked')].map((x) => x.value));
  });
  document.addEventListener("click", (e) => { for (const dd of document.querySelectorAll(".dt-drop[open]")) if (!dd.contains(e.target)) dd.open = false; });
  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (!["shopEditForm", "shopsFindForm", "dealReviewForm", "dealEditForm"].includes(f.id)) return;
    e.preventDefault();
    try {
      if (f.id === "shopsFindForm") {
        const f2 = ui().find, zip = f.elements.zip.value.trim();
        if (zip) { try { f2.zip = zip; f2.pt = await zipToPoint(zip); } catch { f2.error = t("没认出这个 ZIP（5 位数字）。"); return R(); } }
        if (!f2.pt) { f2.error = t("先填 ZIP，或点「用当前位置」。"); return R(); }
        rememberPoint(f2.pt); return runFind(R);
      }
      if (f.id === "dealReviewForm") return saveReview(f, R);
      if (f.id === "dealEditForm") return saveDealEdit(f, R);
      const row = formRow(f); if (!row.name) return;
      const id = f.dataset.id, old = id ? shopById(id) : null;
      const saved = await Store.saveShop(old ? { ...old, ...row } : row); upsertLocal(saved); ui().edit = null;
      toast(old ? t("已保存") : t("已加入 {name}", { name: saved.name }));
      if (old && state.route?.q?.get("edit")) return go(`${href("shops", "shop")}/${encodeURIComponent(saved.id)}`, { replace: true });   // 编辑页保存后回到商店详情
      R();
    } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches?.("[data-shops-q]")) { ui().q = el.value; R(); restoreFocus("[data-shops-q]", el); }
    else if (el.matches?.("[data-dv-q]")) { dvUi().q = el.value; R(); restoreFocus("[data-dv-q]", el); }
    else if (el.matches?.("[data-deal-q]")) { dealUi(el.dataset.dealQ).q = el.value; R(); restoreFocus(`[data-deal-q="${el.dataset.dealQ}"]`, el); }
    else if (el.matches?.("[data-shops-zip]")) ui().find.zip = el.value.trim();
    else if (el.matches?.("[data-find-radius]")) { const v = Math.round(+el.value); if (v >= 1) { ui().find.radius = Math.min(MAX_MI, v); document.querySelectorAll('[data-action="shops-radius"]').forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === ui().find.radius))); } }
    else if (el.matches?.("[data-find-q]")) { ui().find.q = el.value; R(); restoreFocus("[data-find-q]", el); }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.matches?.("[data-shops-sort]")) { ui().sort = el.value; R(); }
    else if (el.matches?.("[data-shops-status]")) { ui().status = el.value; ui().cat = ""; R(); }
    else if (el.matches?.("[data-shops-cat]")) { ui().cat = el.value; R(); }
    else if (el.matches?.("[data-deal-cat]")) { dealUi(el.dataset.dealCat).cat = el.value; R(); }
    else if (el.matches?.("[data-run-src]")) { (ui().log ||= {}).src = el.value; R(); }
    else if (el.matches?.("[data-run-shop]")) { (ui().log ||= {}).shop = el.value; R(); }
    else if (el.matches?.("[data-deal-type]")) { dealUi(el.dataset.dealType).type = el.value; R(); }
    else if (el.matches?.("[data-deal-filter]")) { dealUi(el.dataset.dealFilter).filter = el.value; R(); }
    else if (el.matches?.("[data-deal-sort]")) { dealUi(el.dataset.dealSort).sort = el.value; R(); }
    else if (el.matches?.("[data-dv-f]")) { dvUi().f = el.value; R(); }
    else if (el.matches?.("[data-dv-shop]")) { dvUi().shop = el.value; R(); }
    else if (el.matches?.("[data-dv-cat]")) { dvUi().cat = el.value; R(); }
    else if (el.matches?.("[data-dv-type]")) { dvUi().type = el.value; R(); }
    else if (el.matches?.("[data-dv-sort]")) { dvUi().sort = el.value; R(); }
    else if (el.matches?.("[data-deal-pick]")) { pickDeal(el.dataset.dealPick, el.value); el.title = t("你选的这家"); }   // 不重画：同一行里还没保存的花费、商店照旧
    else if (el.matches?.('#dealReviewForm [name="inc"]')) { const f = el.form, n = f.querySelectorAll('[name="inc"]:checked').length, b = f.querySelector('button[type="submit"]'); if (b) b.textContent = t("保存 {n} 条", { n }); }
  });
}
function restoreFocus(sel, old) { const el = document.querySelector(sel); if (el && el !== old) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* 忽略 */ } } }
