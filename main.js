import { alertsOf, enrich, openShopFor } from "./core/logic.js";
import { state } from "./core/state.js";
import { CloudStore, DemoStore, Store, setStore } from "./core/store.js";
import { $, armed, catOf, du, esc, fillUnitList, inSpace, money, num, setSync, showQty, spaceOf, storedStep, toast } from "./core/util.js";
import { SECTIONS, go, href, parseRoute, routeKey } from "./core/router.js";
import { viewToday } from "./today.js";
import { applyTypeDefaults, houseDraft, readHouseForm, templateItems, viewHouse, viewHouseProfile, viewHouseTemplate } from "./house/views.js";
import { leaveItem, openItem, saveItemForm, subOptions, viewItemForm } from "./pantry/item-form.js";
import { renderInvList, scoreRecipes, viewDashboard, viewInventory, viewMeals, viewShopping } from "./pantry/views.js";
import { viewSettings } from "./settings/views.js";
import { cleanStore, download, exportAnnual, rememberStore, viewStats } from "./stats/views.js";

/* ───────────── 刷新与渲染 ───────────── */
export let refreshing = null;
export async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const [items, logs, shopping, purchases, houseProfile] = await Promise.all([
        Store.listItems(), Store.listLogs(), Store.listShopping(), Store.listPurchases(), Store.getHouseProfile()]);
      Object.assign(state, { items, logs, shopping, purchases, houseProfile });
      state.enriched = enrich(items, logs);
      setSync(Store.mode === "demo" ? "本地演示数据" : `已同步 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
      notifyIfNeeded();
      render(false);
    } catch (e) {
      setSync("同步失败，点设置页重试", true);
      toast(`读取数据失败：${e.message}`);
    } finally { refreshing = null; }
  })();
  return refreshing;
}

export let debounceT;
export const refreshSoon = () => { clearTimeout(debounceT); debounceT = setTimeout(refresh, 400); };


/* ───────────── 页面与路由 ───────────── */
const VIEWS = {
  today:    () => viewToday(),
  pantry:   { overview: viewDashboard, inventory: () => viewInventory("pantry"), meals: viewMeals },
  house:    { overview: viewHouse, supplies: () => viewInventory("house"), profile: viewHouseProfile, template: viewHouseTemplate },
  shopping: () => viewShopping(),
  me:       { stats: viewStats, settings: viewSettings },
};
// 正在填写的表单页：实时同步触发的刷新不重画，避免冲掉没保存的内容
const FORM_PAGES = (r) => r.section === "item" || (r.section === "house" && r.sub === "profile");

function subnav(r) {
  const subs = SECTIONS[r.section]?.subs;
  if (!subs) return "";
  return `<nav class="subtabs" aria-label="${SECTIONS[r.section].name}">${subs.filter(([, , hidden]) => !hidden).map(([k, label]) =>
    `<a href="${href(r.section, k)}" ${r.sub === k || (r.sub === "template" && k === "supplies") ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
}

/** force=true：路由变化，整页重画；false：数据刷新，表单页保持不动 */
export function render(force = true) {
  if (!state.enriched) return;
  document.body.classList.remove("gate");
  $("#hhName").textContent = state.household?.name || "";
  const r = state.route;
  const navSection = r.section === "item" ? (state.prevRoute?.section || (spaceOf(state.editingCat) === "house" ? "house" : "pantry")) : r.section;
  document.querySelectorAll("#tabs a[data-section]").forEach((a) => {
    a.hidden = a.dataset.section === "house" && !state.houseEnabled;
    if (a.dataset.section === navSection) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const openShop = state.shopping.filter((s) => s.status !== "bought").length;
  const sc = $("#shopCount"); sc.hidden = !openShop; sc.textContent = openShop;
  const relevant = state.enriched.filter((x) => state.houseEnabled || inSpace("pantry")(x));
  const alertN = alertsOf(relevant).length;
  document.title = alertN ? `(${alertN}) 家庭妈妈小助手` : "家庭妈妈小助手";
  document.body.classList.toggle("editing", FORM_PAGES(r));

  if (!force && FORM_PAGES(r) && $("#main form")) return;
  if (r.section === "item") { $("#main").innerHTML = viewItemForm(); return; }
  if (r.section === "house" && !state.houseEnabled) {
    $("#main").innerHTML = `<div class="panel empty"><strong>房屋维护模块已关闭</strong>在“我的 → 设置”里可以重新打开。<p><button type="button" class="btn btn-primary" data-action="house-enable">打开房屋维护</button></p></div>`;
    return;
  }
  const v = VIEWS[r.section];
  const view = typeof v === "function" ? v : v[r.sub];
  $("#main").innerHTML = subnav(r) + view();
  if ((r.section === "pantry" && r.sub === "inventory") || (r.section === "house" && r.sub === "supplies")) renderInvList();
}

const scrollMem = {};
function onRoute() {
  const prev = state.route, next = parseRoute();
  scrollMem[routeKey(prev)] = window.scrollY;
  const enteringItem = next.section === "item" && prev.section !== "item";
  const leavingItem = prev.section === "item" && next.section !== "item";
  if (enteringItem) state.prevRoute = prev;
  if (next.section === "house" && next.sub === "profile" && !(prev.section === "house" && prev.sub === "profile")) state.houseDraft = null;
  state.route = next;
  render(true);
  const back = leavingItem && state.prevRoute && routeKey(state.prevRoute) === routeKey(next);
  if (leavingItem) state.prevRoute = null;
  if (back) requestAnimationFrame(() => window.scrollTo(0, scrollMem[routeKey(next)] || 0));
  else { window.scrollTo(0, 0); if (!enteringItem) $("#main").focus({ preventScroll: true }); }
  if (next.section === "item") $("#itemForm")?.elements.name.focus({ preventScroll: true });
  if (leavingItem && state.needsRefresh) { state.needsRefresh = false; refresh(); }
}
// 滚动位置由我们自己记忆和恢复，关闭浏览器的自动恢复以免互相干扰
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("hashchange", onRoute);

const toList = (space) => (space === "house" ? href("house", "supplies") : href("pantry", "inventory"));

/* ───────────── 交互（事件委托） ───────────── */
export const main = $("#main");
main.addEventListener("input", (e) => {
  if (e.target.id === "invSearch") { state.filter.q = e.target.value; renderInvList(); }
});
main.addEventListener("change", async (e) => {
  if (e.target.id === "invStatus") { state.filter.status = e.target.value; renderInvList(); }
  if (e.target.closest("#itemForm") && e.target.name === "category") {
    const fe = e.target.form.elements;
    fe.subcategory.innerHTML = subOptions(e.target.value);
    if (!fe.item_id.value) fe.location.value = catOf(e.target.value).loc;
  }
  if (e.target.id === "regionSel") {
    Units.setRegion(e.target.value || null); fillUnitList();
    state.enriched = enrich(state.items, state.logs); toast(`已切换为${Units.region.name}单位`); render();
  }
  if (e.target.closest("#houseForm")) {
    const d = readHouseForm(e.target.form);
    if (e.target.name === "region") { d.house_type = HOUSE.HOUSE_TYPES[d.region][0].id; applyTypeDefaults(d); d.exterior = []; d.flooring = []; d.roof = null; render(); }
    else if (e.target.name === "house_type") { applyTypeDefaults(d); toast("已按房型预选设施，可以再调整"); render(); }
    return;
  }
  if (e.target.id === "houseToggle") {
    state.houseEnabled = e.target.checked;
    try { localStorage.setItem("hmh-house-off", e.target.checked ? "0" : "1"); } catch { /* 忽略 */ }
    toast(e.target.checked ? "已打开房屋维护" : "已关闭房屋维护，导航里不再显示"); render();
  }
  if (e.target.id === "statsMonth") { state.stats.month = e.target.value; render(); }
  if (e.target.id === "statsItem") { state.stats.itemId = e.target.value; render(); }
  if (e.target.id === "hhSwitch") { localStorage.setItem("hmh-hid", e.target.value); location.reload(); }
});

main.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.id === "itemForm") return saveItemForm(f);
    if (f.id === "houseForm") {
      const d = readHouseForm(f), y = d.year_built, thisYear = new Date().getFullYear();
      if (y != null && (y < 1850 || y > thisYear)) { $("#houseFormError").textContent = `建成年份需要在 1850 到 ${thisYear} 之间。`; return; }
      const first = !state.houseProfile;
      await Store.saveHouseProfile(d);
      state.houseProfile = { ...d }; state.houseDraft = null;
      toast("房屋资料已保存");
      const hasHouseItems = state.items.some(inSpace("house"));
      go(first && !hasHouseItems ? href("house", "template") : href("house", "overview"));
      return refresh();
    }
    if (f.id === "templateForm") {
      const keys = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!keys.length) return toast("还没有勾选耗材");
      const list = templateItems(keys);
      await Store.addItems(list);
      toast(`已添加 ${list.length} 项房屋耗材`);
      Object.assign(state.filter, { space: "house", cat: "all", q: "", status: "all" });
      go(href("house", "supplies"));
      return refresh();
    }
    if (f.getAttribute("id") === "purchaseForm") {
      const e2 = f.elements, name = e2.name.value.trim(), amount = num(e2.amount.value, NaN);
      if (!name || !Number.isFinite(amount) || amount < 0) return toast("请填写名称和金额");
      const day = e2.date.value || new Date().toISOString().slice(0, 10);
      const store = cleanStore(e2.store.value);
      if (store) rememberStore(store);
      await Store.addPurchase({ item_id: null, name, category: e2.category.value, quantity: null, unit: null, store,
        amount: Math.round(amount * 100) / 100, currency: Units.region.currency, purchased_at: new Date(`${day}T12:00:00`).toISOString() });
      toast(`已记录 ${name} ${money(amount)}`); return refresh();
    }
    if (f.id === "shopForm") {
      const name = f.elements.name.value.trim();
      if (!name) return;
      const linked = state.items.find((i) => i.name === name);
      if (linked && openShopFor(linked.id)) return toast(`${name} 已经在清单里了`);
      await Store.saveShopping({ name, quantity: Math.max(0.1, num(f.elements.quantity.value, 1)), unit: f.elements.unit.value.trim() || (linked ? du(linked.unit) : ""), item_id: linked?.id || null, category: f.elements.category.value || linked?.category || "other" });
      toast(`已加入：${name}`); refresh();
    }
    if (f.id === "nameForm") {
      const v = f.elements.display_name.value.trim();
      if (!v) return;
      const { error } = await CloudStore.sb.from("household_members").update({ display_name: v }).eq("household_id", CloudStore.hid).eq("user_id", state.user.id);
      if (error) throw new Error(error.message);
      state.displayName = v; state.members = await CloudStore.listMembers(); toast("称呼已保存"); render();
    }
    if (f.id === "loginForm") return doLogin(f);
    if (f.id === "createHhForm") return doCreateHousehold(f);
    if (f.id === "joinHhForm") return doJoinHousehold(f);
  } catch (err) { toast(`操作失败：${err.message}`); }
});

main.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    switch (action) {
      case "add-item": return openItem(null, { space: el.dataset.space });
      case "edit": return openItem(id);
      case "item-cancel": return leaveItem(false);
      case "item-delete":
        if (!armed(el, "再点一次确认删除")) return;
        await Store.deleteItem(state.route.id); toast("已删除"); return leaveItem(true);
      case "house-enable":
        state.houseEnabled = true; try { localStorage.setItem("hmh-house-off", "0"); } catch { /* 忽略 */ }
        return render();
      case "tpl-all": e.preventDefault(); el.form.querySelectorAll('input[name="tpl"]:not(:disabled)').forEach((x) => { x.checked = el.dataset.on === "1"; }); return;
      case "consume": el.disabled = true; await Store.adjust(id, -storedStep(state.items.find((x) => x.id === id)?.unit), "consume"); return refresh();
      case "restock": el.disabled = true; await Store.adjust(id, storedStep(state.items.find((x) => x.id === id)?.unit), "restock"); return refresh();
      case "cat": state.filter.cat = el.dataset.cat; return render();
      case "goto-cat": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: el.dataset.cat, status: "all", q: "" }); return go(toList(el.dataset.space));
      case "goto-status": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: "all", status: el.dataset.status, q: "" }); return go(toList(el.dataset.space));
      case "shop-add-item": return addAlertsToShopping([state.enriched.find((x) => x.id === id)]);
      case "shop-add-alerts": {
        const sp = el.dataset.space || "pantry";
        const pool = sp === "all" ? state.enriched.filter((x) => state.houseEnabled || inSpace("pantry")(x)) : state.enriched.filter(inSpace(sp));
        return addAlertsToShopping(alertsOf(pool));
      }
      case "shop-claim": await Store.saveShopping({ id, status: "claimed", claimed_by: state.user?.id || null, claimed_by_name: state.displayName }); toast("已认领，家人会看到你在买"); return refresh();
      case "shop-unclaim": await Store.saveShopping({ id, status: "todo", claimed_by: null, claimed_by_name: null }); return refresh();
      case "shop-bought": return markBought(id);
      case "shop-del": await Store.deleteShopping(id); return refresh();
      case "shop-clear": await Store.clearBought(); return refresh();
      case "diet": state.diet = el.dataset.diet; state.mealShift = 0; localStorage.setItem("hmh-diet", state.diet); return render();
      case "shuffle": state.mealShift++; return render();
      case "stats-months": state.stats.months = +el.dataset.months; return render();
      case "stats-cat": state.stats.cat = el.dataset.cat; return render();
      case "purchase-del": if (!armed(el, "确认删除")) return; await Store.deletePurchase(id); toast("已删除这笔记录"); return refresh();
      case "recipe-missing": return addRecipeMissing(el.dataset.name);
      case "copy-invite": await navigator.clipboard.writeText(state.household.invite_code); return toast("邀请码已复制");
      case "notif": await Notification.requestPermission(); return render();
      case "export": return exportJson();
      case "csv-summary": return exportAnnual("summary");
      case "csv-detail": return exportAnnual("detail");
      case "reload": return refresh();
      case "reset-demo": if (armed(el, "再点一次确认恢复")) { DemoStore.reset(); toast("已恢复演示数据"); refresh(); } return;
      case "logout": await CloudStore.sb.auth.signOut(); localStorage.removeItem("hmh-hid"); return location.reload();
    }
  } catch (err) { toast(`操作失败：${err.message}`); refresh(); }
});

export async function addAlertsToShopping(list) {
  let added = 0;
  for (const it of list) {
    if (!it || openShopFor(it.id)) continue;
    await Store.saveShopping({ item_id: it.id, name: it.name, quantity: it.suggest, unit: it.unit, category: it.category });
    added++;
  }
  toast(added ? `已加入采购清单 ${added} 项` : "这些都已经在清单里了");
  refresh();
}

export async function addRecipeMissing(recipeName) {
  const r = scoreRecipes().find((x) => x.name === recipeName);
  if (!r) return;
  const openNames = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => s.name));
  let added = 0;
  for (const p of r.parts.filter((x) => !x.item)) {
    const existing = state.items.find((i) => p.kw.some((k) => i.name.includes(k)));
    const name = existing?.name || p.kw[0];
    if (openNames.has(name) || (existing && openShopFor(existing.id))) continue;
    await Store.saveShopping({ name, quantity: 1, unit: existing?.unit || "", item_id: existing?.id || null, category: existing?.category || "fresh" });
    added++;
  }
  toast(added ? `“${recipeName}”缺的 ${added} 样已加入清单` : "缺的食材已经在清单里了");
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
  await Store.saveShopping({ id, status: "bought", bought_at: now, amount, claimed_by_name: s.claimed_by_name || state.displayName });
  await Store.addPurchase({
    item_id: item?.id || null, name: s.name, category: item?.category || s.category || "other",
    quantity: qty, unit: s.unit || item?.unit || null, amount, currency: Units.region.currency, purchased_at: now, store,
  });
  if (item) {
    // 采购单位与库存单位不同（例如库存按 kg，买的时候填 lb）时自动换算
    const add = !s.unit || s.unit === item.unit ? qty : Units.convert(qty, s.unit, item.unit);
    if (add == null) toast(`${s.name} 已买到；单位 ${s.unit} 与库存单位 ${item.unit} 无法换算，请手动更新库存`);
    else { await Store.adjust(item.id, Math.round(add * 100) / 100, "restock"); toast(`${s.name} 已入库 +${showQty(add, item.unit)}，记得更新保质期`); }
  } else toast(`${s.name} 已买到${amount != null ? `，花费 ${money(amount)}` : ""}`);
  refresh();
}

export function exportJson() {
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), household: state.household?.name, items: state.items, shopping: state.shopping, purchases: state.purchases }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `pantry-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function notifyIfNeeded() {
  const urgent = state.enriched.filter((x) => x.status === "out" || x.status === "low");
  const prev = state.lastAlertCount;
  state.lastAlertCount = urgent.length;
  if (prev === null ? urgent.length === 0 : urgent.length <= prev) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification("家庭妈妈小助手", { body: `${urgent.length} 样东西缺货或少货：${urgent.slice(0, 4).map((x) => x.name).join("、")}` }); } catch { /* 部分移动浏览器只允许 Service Worker 通知 */ }
}

/* ───────────── 云端：登录与家庭 ───────────── */
export function gate(html) { document.body.classList.add("gate"); $("#hhName").textContent = ""; $("#main").innerHTML = html; }

export function renderLogin(msg = "") {
  gate(`<div class="panel gate-card"><h2>登录</h2>
    <p class="muted">输入邮箱，我们会发一封登录链接，点开即可登录，无需密码。</p>
    <form id="loginForm"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com" aria-label="邮箱">
      <button class="btn btn-primary" type="submit">发送登录链接</button></form>
    <p class="muted" role="status">${esc(msg)}</p></div>`);
  setSync("未登录");
}

export async function doLogin(f) {
  const email = f.elements.email.value.trim();
  if (!email) return;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
  if (error) { f.querySelector("button").disabled = false; return toast(`发送失败：${error.message}`); }
  renderLogin(`登录链接已发送到 ${email}，请在本设备打开邮件。`);
}

export function renderOnboarding() {
  gate(`<div class="panel gate-card"><h2>加入你的家庭</h2>
    <p class="muted">第一次使用请创建家庭；家人已经创建过的话，用邀请码加入。</p>
    <form id="joinHhForm"><input name="code" required maxlength="12" placeholder="邀请码" autocapitalize="characters" aria-label="邀请码">
      <input name="display_name" required maxlength="20" placeholder="我的称呼，例如：爸爸" aria-label="我的称呼">
      <button class="btn btn-dark" type="submit">用邀请码加入</button></form>
    <hr>
    <form id="createHhForm"><input name="name" required maxlength="50" placeholder="家庭名称，例如：小月亮的家" aria-label="家庭名称">
      <input name="display_name" required maxlength="20" placeholder="我的称呼，例如：妈妈" aria-label="我的称呼">
      <button class="btn btn-primary" type="submit">创建家庭</button></form></div>`);
  setSync("已登录");
}

export async function doCreateHousehold(f) {
  const { data, error } = await CloudStore.sb.rpc("create_household", { p_name: f.elements.name.value.trim(), p_display_name: f.elements.display_name.value.trim() });
  if (error) return toast(`创建失败：${error.message}`);
  localStorage.setItem("hmh-hid", data); afterLogin();
}

export async function doJoinHousehold(f) {
  const { data, error } = await CloudStore.sb.rpc("join_household", { p_code: f.elements.code.value.trim(), p_display_name: f.elements.display_name.value.trim() });
  if (error) return toast(error.message.includes("invalid") ? "邀请码不正确，请向家人确认" : `加入失败：${error.message}`);
  localStorage.setItem("hmh-hid", data); afterLogin();
}

export async function afterLogin() {
  const sb = CloudStore.sb;
  const { data, error } = await sb.from("household_members")
    .select("household_id, display_name, households(id, name, invite_code, created_by)").eq("user_id", state.user.id);
  if (error) return toast(`读取家庭失败：${error.message}`);
  if (!data.length) return renderOnboarding();
  state.households = data.map((d) => d.households).filter(Boolean);
  const saved = localStorage.getItem("hmh-hid");
  const mine = data.find((d) => d.household_id === saved) || data[0];
  state.household = mine.households;
  state.displayName = mine.display_name;
  CloudStore.hid = mine.household_id;
  localStorage.setItem("hmh-hid", CloudStore.hid);
  state.members = await CloudStore.listMembers();
  CloudStore.subscribe(refreshSoon);
  await refresh();
}



/* ───────────── 启动 ───────────── */
export async function boot() {
  fillUnitList();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.enriched) refreshSoon(); });

  const cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    if (!window.supabase) { setSync("云端库加载失败", true); return toast("无法加载 Supabase SDK，请检查网络后刷新"); }
    setStore(CloudStore);
    CloudStore.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    let started = false;
    const start = (session) => {
      if (started || !session) return;
      started = true; state.user = session.user; afterLogin();
    };
    CloudStore.sb.auth.onAuthStateChange((evt, session) => {
      if (evt === "SIGNED_IN") start(session);
      if (evt === "SIGNED_OUT") { started = false; renderLogin(); }
    });
    const { data: { session } } = await CloudStore.sb.auth.getSession();
    state.route = parseRoute();
    if (session) start(session); else renderLogin();
  } else {
    setStore(DemoStore);
    DemoStore.load();
    state.household = { name: "演示家庭（数据仅存于本浏览器）" };
    state.route = parseRoute();
    await refresh();
  }
}
boot();
