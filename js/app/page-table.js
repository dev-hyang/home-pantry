/* 页面表（路由 → 画页面的函数）、哪些页是表单页、手机上哪些页隐藏底部页签、用户自己的操作标记。 */
import { isFormSection } from "../core/router.js";
import { loadReleases, releasesReady } from "./releases.js";
import { releasePageHTML } from "../core/releases-ui.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { viewAbout, viewAi, viewAlerts, viewAssetTemplate, viewAssetBills, viewAssets, viewBillTemplate, viewDeal, viewDebts, viewFinAssets, viewFix, viewHouse, viewHouseProfile, viewHouseSupplies, viewHouseTemplate, viewPlan, viewScan, viewStatements, viewTasks } from "./lazy-modules.js";
import { viewAllBills } from "../bills/all-views.js";
import { viewBudget } from "../bills/budget.js";
import { viewMenu } from "../menu.js";
import { viewQuick, viewToday } from "../today.js";
import { viewIncome } from "./lazy-modules.js";
import { viewFinGroup } from "../bills/fin-home.js";
import { viewHouseAlerts, viewHouseCars, viewHouseProps } from "./lazy-modules.js";
import { viewShops } from "./lazy-modules.js";
import { viewBillsHome } from "./lazy-modules.js";
import { viewNetWorth } from "./lazy-modules.js";
import { viewDashboard, viewInventory, viewMeals, viewShopping } from "./lazy-modules.js";
import { viewAccountsHome, viewBanks, viewCards, viewInvest, viewWallets } from "./lazy-modules.js";
import { viewSettings } from "./lazy-modules.js";
import { viewSpend, viewStats } from "./lazy-modules.js";

/* ───────────── 页面与路由 ───────────── */
/** 库存页当前范围：?space=house 看汽车房屋消耗品（房屋模块关闭时只有厨房储藏） */
const invSpace = () => (state.houseEnabled && state.route.q.get("space") === "house" ? "house" : state.route.q.get("space") === "pantry" ? "pantry" : "all");   // 默认「全部组别」（物品视图）；?space=pantry / house 看某一个
export const VIEWS = {
  today:    () => viewToday(),
  alerts:   () => viewAlerts(),
  quick:    () => viewQuick(),   // #/quick：编辑今日页的快捷操作
  ai:       () => viewAi(),
  pantry:   { scan: () => viewScan(), overview: viewDashboard, shopping: () => viewShopping(), inventory: () => viewInventory(invSpace()), gear: () => viewInventory("gear"), meals: viewMeals },
  house:    { overview: viewHouse, supplies: viewHouseSupplies, assets: viewAssets, tasks: viewTasks, deal: viewDeal, profile: viewHouseProfile, pages: () => viewMenu("house"),
              template: viewHouseTemplate, "asset-template": viewAssetTemplate, fix: viewFix, plan: viewPlan, properties: viewHouseProps, cars: viewHouseCars, alerts: viewHouseAlerts },
  bills:    { group: viewFinGroup, overview: viewBillsHome, all: viewAllBills, assetbills: viewAssetBills, spend: viewSpend, income: viewIncome, statements: viewStatements, budget: viewBudget, cards: viewCards, accounts: viewAccountsHome, banks: viewBanks, invest: viewInvest, wallets: viewWallets, assets: viewFinAssets, debts: viewDebts, networth: viewNetWorth, template: viewBillTemplate },
  shopping: () => viewShopping(),
  scan:     () => viewScan(),
  shops:    () => viewShops(),
  me:       { stats: viewStats, settings: viewSettings, about: viewAbout, releases: () => releasesReady ? releasePageHTML() : (loadReleases(), `<div class="panel empty">${t("加载中…")}</div>`) },
};
// 手机上隐藏底部导航的页面（这里只是渲染前的预判，最终以页面里有没有底部保存栏为准：render.js 的 syncEditing）：只有「真正在编辑的表单」才隐藏（专注填写）；车辆 / 设备 / 账单的概览、详情、保养记录列表、时间表这类只读页保留导航。
// （FORM_PAGES 另管「后台同步不重画」，范围更宽，不动）
const EDIT_SECS = new Set(["basic", "units", "plate", "docs", "insurance", "years", "life", "cost", "notes", "recall"]);
   // 设备 / 车辆的编辑分区；profile、log（列表）、schedule、supplies、care 是只读页
export const TABS_HIDDEN = (r) => {
  if (!FORM_PAGES(r)) return false;
  const q = r.q;
  if (r.section === "house" && r.sub === "profile") return false;
  if (r.section === "item") return r.id === "new" || !!q.get("edit");   // 物品详情页保留底部导航；新建 / 某一块的编辑才隐藏（最终以有没有保存栏为准）   // 房屋资料：读的页面，分块编辑时才有保存栏（见 render.js 的 syncEditing）
  if (r.section === "asset") return r.id === "new" || EDIT_SECS.has(q.get("sec")) || q.get("log") === "1" || !!q.get("wiz");
  if (r.section === "bill") {
    const list = ["pay", "assess", "detail"].includes(q.get("sec")) && !q.get("edit") && !q.get("copy");   // 缴费记录 / 特别摊派的列表页（含摊派缴费记录）：保留导航
    return r.id === "new" ? [...q.keys()].length > 0 : (!!q.get("sec") && !list) || q.get("pay") === "1";
  }   // #/bill/new 不带参数 = 选类型页（保留导航）；向导 / 整页表单 / 分区编辑 / 记缴费 = 隐藏；账单详情页保留
  if (r.section === "otbill") return r.id === "new" || (!!q.get("sec") && q.get("sec") !== "detail") || !!q.get("pay");   // 一次性账单：详情页保留导航，新建 / 分区编辑隐藏
  return true;
};
// 正在填写的表单页：实时同步触发的刷新不重画，避免冲掉没保存的内容
/* 现在是不是正处在用户自己的操作里（点击、改下拉、输入、按键的处理过程中，含紧跟着的同一轮任务）：这时的 render(false) 是用户要的，不填回旧值 */
export let userActing = false;
for (const ev of ["click", "change", "input", "keydown", "submit", "pointerup"]) document.addEventListener(ev, () => { userActing = true; setTimeout(() => { userActing = false; }, 0); }, true);
export const FORM_PAGES = (r) => isFormSection(r) || (r.section === "house" && r.sub === "plan" && !!state.planEdit) || (r.section === "house" && r.sub === "profile") || (r.section === "bills" && r.sub === "cards" && (r.q.get("card") === "new" || (!!r.q.get("card") && !!r.q.get("edit")))) || (r.section === "bills" && r.sub === "income" && !!state.inc?.form) || (r.section === "me" && r.sub === "settings" && (!!r.q.get("member") || r.q.get("person") === "new")) || (r.section === "shops" && r.sub === "shop" && (r.id === "new" || r.q.get("edit") === "1")) || (r.section === "bills" && r.sub === "debts" && (r.q.get("new") === "1" || (!!r.q.get("id") && !!r.q.get("edit"))));   // 分步添加向导 / 编辑页：后台同步不重画，免得填到一半的内容被刷掉
   // 一次性账单的编辑页：后台同步（家人改动、花费刷新）不重画，免得填到一半的内容被刷掉
// 二级页顶部的面包屑和每个页签的目录页在 js/menu.js（参考家庭学堂“我的”页：一栏一行，点进去）
export const offPanel = (title, action, btn) => `<div class="panel empty"><strong>${title}</strong>${t("在“我的 → 设置”里可以重新打开。")}<p><button type="button" class="btn btn-primary" data-action="${action}">${btn}</button></p></div>`;
