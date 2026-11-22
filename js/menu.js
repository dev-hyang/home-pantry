/* 每个底部页签的“目录页”（参考家庭学堂“我的”页）：二级页不再用横向滑动的标签，而是一栏一栏的行，点进去；
 * 子页顶部一条面包屑「‹ 房屋」回目录。目录行带简短说明和当前要处理的数量。 */
import { state } from "./core/state.js";
import { liveNetWorth } from "./bills/nw-logic.js";
import { isClosedStatus } from "./core/debt-rules.js";
import { SECTIONS, href } from "./core/router.js";
import { esc, inSpace } from "./core/util.js";
import { lang, t } from "./core/i18n.js";
import { alertsOf } from "./core/logic.js";
import { assetName } from "./house/assets-logic.js";
import { undoneThisMonth } from "./house/tasks-logic.js";
import { houseHooks } from "./house/hooks.js";   // 房屋页面模块加载后挂进来的函数（assetsDueCount、openDeal、routeDeal…）
import { canManageHome } from "./settings/members.js";
import { familyHref, memberCrumbLabel } from "./settings/members.js";
import { aiIcon } from "./core/ai.js";
import { APP_VERSION } from "./core/version.js";
import { crumbNav } from "./core/hub.js";
import { billAlerts } from "./bills/logic.js";
import { activeProperties, endedProperties } from "./core/lifecycle.js";
import { activeTab, firstTab, tabLabel } from "./core/tabs.js";
import { collectAlerts } from "./core/alerts.js";
import { houseBar } from "./house/property-form.js";
import { FINANCE_HIDDEN_SUBS, financeOk } from "./core/finance-access.js";
import { debtsEnriched } from "./bills/debt-logic-common.js";
import { medBillLabel } from "./bills/medical-data.js";
import { personNameOf } from "./settings/family-lite.js";
import { SETTING_SECTIONS } from "./settings/settings-menu.js";
import { infoTip } from "./core/info-tip.js";
import { assetBillsHref } from "./bills/all-href.js";
import { viewFinanceMenu } from "./bills/fin-home.js";
import { groupHref, groupName } from "./bills/cards.js";
import { finBase, houseCars, houseProps } from "./core/crumb-base.js";   // 财务首页（四张卡片）和贯穿财务各页的嵌套目录

const SECTION_ICON = { pantry: "🗄️", house: "🏠", bills: "💰", me: "👤" };
// 每个二级页：图标、一句说明、可选的“要处理的数量”
export const META = {
  pantry: {
    overview:  { icon: "📊", desc: "补货与临期一览、各分类库存", count: () => alertsOf(state.enriched.filter(inSpace("pantry"))).length },
    shopping:  { icon: "🛒", desc: "待买、家人正在买的清单；买到了一键入库、记花费", count: () => state.shopping.filter((s) => s.status !== "bought").length },
    inventory: { icon: "🥫", desc: "日常消耗品与汽车房屋消耗品，点 −/+ 记消耗" },
    gear:      { icon: "🧳", desc: "床品、电器、自行车、工具：只记数量和位置" },
    meals:     { icon: "🍳", desc: "按现有食材推荐三餐" },
  },
  house: {
    overview:  { icon: "🏠", desc: "房屋卡片、耗材提醒、谁负责维护、本月任务" },
    supplies:  { icon: "🧰", desc: "滤网、电池、融雪盐等汽车房屋消耗品", count: () => alertsOf(state.enriched.filter(inSpace("house"))).length },
    assets:    { icon: "⚙️", desc: "设备档案、保养记录、检查卡与相关耗材", count: () => houseHooks.assetsDueCount?.({ property: state.propertyId }) ?? 0 },   // 和首页、房屋首页同一个口径（assets.js 的 assetsDue）
    tasks:     { icon: "📅", desc: "按月的检修清单，勾了家人都看到", count: () => (state.houseProfile ? undoneThisMonth().length : 0) },
    deal:      { icon: "📝", desc: "买入 / 卖出 / 退租流程清单", count: () => (houseHooks.openDeal?.() ? 1 : 0), countLabel: "进行中" },
    profile:   { icon: "🏡", desc: "房型、设施、材料、地址、保险、HOA" },
    // 这套房产的账单：跳到账单清单并按房产筛选（账单页签保留全家视图、日历导出和与房产无关的账单）
    bills:     { icon: "🧾", desc: "这套房产的水电气网、HOA、房产税、房贷、保险，以及装修等一次性账单", href: () => assetBillsHref(`property:${state.propertyId}`), count: () => billAlerts(state.billsEnriched.filter((b) => b.property_id === state.propertyId)).length, when: () => state.billsEnabled },
  },
  bills: {
    overview:  { icon: "🧾", title: "账单概览", desc: "周期性 + 一次性账单一览：要处理的、未来 30 天要交、未结余额" },
    all:       { icon: "📋", desc: "所有账单（周期性 + 一次性）一行一期：搜索、按资产 / 状态 / 时间筛选，到期近的在前" },
    recurring: { icon: "🔁", title: "周期性账单", sub: "assetbills", href: () => assetBillsHref("recurring"), desc: "手机、房产税、房屋保险、车辆牌照、水电气网、房贷、订阅……每张账单一张卡，固定清单，不随时间范围变；不挂房产的账单也在这里", count: () => billAlerts(state.billsEnriched).length },
    onetime:   { icon: "🏥", desc: "一次事件产生的账单：医疗、宠物、法律税务、装修工程；有总额、可分次付、有余额", count: () => state.medEnriched.filter((b) => b.open).length },
    income:    { icon: "💵", href: () => href("bills", "income"), desc: "收入明细、类型、付款方：工作 / 投资 / 房产 / 其他；个人赠与 / 借款的还款" },
    // 分析组里的「收支总览」= 收入页的第一个标签（同一页，不另做一份）；sub 指向真正的二级页，权限按它判断
    cashflow:  { icon: "⚖️", title: "收支总览", sub: "income", href: () => href("bills", "income"), desc: "收支总览：收入（工作 / 投资 / 房产 / 其他）vs 消费、储蓄率、投资率；资本流入（卖房卖股、借款、转入）单列不算收入" },
    statements: { icon: "🏦", desc: "银行 / 信用卡对账单：花费和收入一次导入；导出花费、收入、收支差额报表" },
    accounts:  { icon: "🗂️", desc: "四类账户一眼看：信用卡、银行、投资、电子钱包与礼品卡；余额、要更新的、年费" },
    banks:     { icon: "🏦", desc: "支票、储蓄、现金、借记卡：余额、账单从哪扣、收入入到哪" },
    invest:    { icon: "📈", desc: "投资 / 退休（401K、IRA）/ 教育（529）/ 孩子账户 / HSA·FSA·通勤福利 / 加密：只记总值，每月自动存快照" },
    wallets:   { icon: "👛", desc: "电子钱包（PayPal、Venmo、Zelle）和礼品卡（Amazon、Target）：余额、有效期" },
    tax:       { icon: "🧾", desc: "税务提醒和报税参考：税务日历、单据清单、买卖房车股票的事件指南、境外赠与累计（不是报税软件，不存 SSN / ITIN / PIN）" },
    budget:    { icon: "💰", desc: "收入、固定账单、储蓄 → 月度 / 年度预算，对比实际花费，超预算提醒，大额购物规划" },
    spend:     { icon: "📊", desc: "所有花费：每月花了多少、分类占比、商店、年度报表，可搜索筛选排序" },
    cards:     { icon: "💳", desc: "信用卡：该刷哪张（按场景比返现）、到期 / 年费 / 轮换类别 / 开卡奖励提醒；银行、券商、退休、HSA、贷款账户也记在这里", count: () => state.cards.filter((c) => c.active !== false).length },
    assets:    { icon: "🏛️", desc: "资产概览和净资产：房产、车辆、账户的钱的一面（买入 / 卖出价、估值、余额、贷款），以及资产 − 负债、每月快照和走势" },
    debts:     { icon: "🏦", desc: "房贷、车贷、学生贷款、亲友借款：余额、还款计划、本金 / 利息拆分、Escrow", count: () => debtsEnriched().filter((e) => e.overdue || (e.asset_id && e.link_confirmed === false && !isClosedStatus(e.status))).length },
    networth:  { icon: "📈", desc: "资产 − 负债：账户余额、房产 / 车辆估值、贷款余额；每月快照看走势，财富增长 vs 消费，每处资产的净值", count: () => (state.nwOk ? liveNetWorth().stale.length : 0), countLabel: "需要更新" },
  },
  me: {
    stats:    { icon: "📊", desc: "年度回顾、最常用、补货节奏、谁在出力、保养与季节任务、一周节奏、浪费（钱的统计在 财务 → 花费）" },
    settings:  { icon: "⚙️", desc: "家庭成员、邀请码、房产、语言、模块、备份" },
    about:     { icon: "✎", desc: "这个网站是什么、怎么用、注意事项" },
    releases:  { icon: "📰", desc: "每次更新了什么" },
  },
};
const HIDDEN = (section, k) => (section === "pantry" && k === "gear" && !state.gearEnabled)
  || (section === "bills" && FINANCE_HIDDEN_SUBS.includes(META.bills[k]?.sub || k) && !financeOk());   // 没有财务权限：对账单 / 收入 / 预算不进目录

export const menuRow = ({ href: url, icon, title, desc, count, countLabel, external }) => `<a class="mrow" href="${esc(url)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>
    <span class="mi" aria-hidden="true">${icon}</span>
    <span class="mt"><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</span>
    ${count ? `<span class="badge b-soon mcount">${count}${countLabel ? ` ${esc(countLabel)}` : ""}</span>` : ""}
    <span class="mch" aria-hidden="true">›</span></a>`;

export const KIND_ICON = { sfh: "🏡", townhome: "🏘️", condo: "🏢", apartment: "🔑", other: "🏠" };   // 房产类型图标：列表行和面包屑共用
/** 某个页签的目录页（房屋：当前房产的页面目录） */
export function viewMenu(section) {
  if (section === "bills") return viewFinanceMenu();
  const sec = SECTIONS[section]; if (!sec?.subs) return "";
  const extra = Object.entries(META[section] || {}).filter(([k, m]) => m.href && !sec.subs.some(([s]) => s === k) && (!m.when || m.when())).map(([k, m]) => [k, { bills: "账单" }[k] || k]);
  const ORDER = { house: ["overview", "profile", "bills", "tasks", "assets", "deal"] };   // 房产目录：概览 → 房屋资料 → 账单 → 季节任务 → 设备保养 → 交易
  const idx = (k) => { const i = (ORDER[section] || []).indexOf(k); return i < 0 ? 99 : i; };
  const rows = [...sec.subs.filter(([k, , hidden]) => !hidden && !HIDDEN(section, k)), ...extra].sort((a, b) => idx(a[0]) - idx(b[0])).map(([k, label]) => {
    const m = META[section]?.[k] || {};
    let count = 0; try { count = m.count ? m.count() : 0; } catch { count = 0; }
    return menuRow({ href: m.href ? m.href() : href(section, k), icon: m.icon || "•", title: t(label), desc: m.desc ? t(m.desc) : "", count, countLabel: m.countLabel ? t(m.countLabel) : "" });
  }).join("");
  // 我的首页（section === "me"）的页头由 render.js 的 meHead 画（目录 + 路径），这里不重复画
  const apps = section === "me" ? (window.SISTER_APPS || []).filter((a) => a.id !== "home-pantry") : [];
  const prop = section === "house" ? state.properties.find((p) => p.id === state.propertyId) : null;
  return `<section class="section menu-page">
    ${prop ? `${crumbNav([...houseProps(), { label: prop.name, icon: KIND_ICON[prop.kind] || "🏠" }])}<p class="muted" style="margin:-6px 0 12px;font-size:13px">${esc([t(window.DEALS.PROPERTY_STATUS[prop.status] || "持有"), prop.address].filter(Boolean).join(" · "))}</p>`
      : section === "me" ? "" : `<div class="section-head"><h2>${SECTION_ICON[section] || ""} ${t(sec.name)}</h2></div>`}
    ${section === "house" ? houseBar() : ""}
    <div class="panel mlist">${rows}</div>
    ${apps.length ? `<div class="section-head" style="margin-top:22px"><h2>${t("姐妹站点")}</h2></div>
      <div class="panel mlist">${apps.map((a) => menuRow({ href: a.url, icon: a.icon, title: t(a.name), desc: t(a.sub) })).join("")}</div>
      <p class="muted" style="font-size:13px;margin:8px 0 0">${t("同一作者的其他小工具，顶栏站名旁的小胶囊也能切换。")}</p>` : ""}
    ${section === "me" ? `<p class="muted" style="margin-top:24px;font-size:13px">${t("爱家小助手")} · <a class="ver-link" href="${href("me", "releases")}" aria-label="${esc(t("发布日志"))}">${t("版本 {v}", { v: APP_VERSION })}</a></p>` : ""}
  </section>`;
}

/** 子页顶部的面包屑：‹ 回目录 · 当前页名（房屋子页回到该房产的目录，车辆回到房产列表） */
const SPLIT_FIRST = (r) => firstTab(r);   // 第一个标签就是页面本身，面包屑不再多一层
export function crumb(r) {
  const sec = SECTIONS[r.section]; if (!sec?.subs || r.section === "shops" || r.section === "shopping" || r.sub === "menu" || r.sub === "pages" || (r.section === "house" && r.sub === "fix") || (r.section === "bills" && r.sub === "assetbills") || (r.section === "bills" && r.sub === "spend" && (r.q?.get("form") || r.q?.get("copy") || r.q?.get("add") || r.q?.get("view"))) || (r.section === "bills" && r.sub === "income" && (r.q?.get("form") || r.q?.get("view")))) return "";   // 这几页自己画带名字的面包屑（资产账单、花费表单页）   // 出了问题？页自己画带设备名的面包屑
  if (r.section === "bills" && r.sub === "cards" && r.q?.get("card")) {   // 卡 / 账户详情：财务 / 所在的那一页（信用卡、银行、投资…） / 名字；添加 / 编辑页自己画
    const id = r.q.get("card"); if (id === "new" || r.q.get("edit")) return "";
    const c = state.cards.find((x) => x.id === id), kind = c?.kind || "credit";
    return crumbNav([...finBase("cards"), { href: groupHref(kind), label: t(groupName(kind)) }, { label: c ? c.name : t("找不到这张卡") }]);
  }
  if (r.section === "house" && r.sub === "plan" && (r.q?.get("k") || r.q?.get("p"))) {   // 买卖计划的指南 / 某个计划：房屋 / 买卖计划 / 指南名（买卖计划不属于某套房产，路径里不放房产名）
    const k = r.q.get("k"), g = k && window.GUIDES?.GUIDES?.[k], plan = r.q.get("p") && (state.plans || []).find((x) => x.id === r.q.get("p"));
    const label = g && Array.isArray(g.name) ? (lang === "en" ? g.name[1] : `我想${g.name[0]}`) : plan ? plan.title : t("买卖计划");
    return crumbNav([{ href: href("house"), label: t(sec.name) }, { href: href("house", "plan"), label: t("买卖计划") }, { label, icon: g?.icon }]);
  }
  const parent = r.section === "bills" ? { template: "recurring" } : { template: "supplies", "asset-template": "assets" };
  const cur = sec.subs.find(([k]) => k === r.sub) || sec.subs.find(([k]) => k === parent[r.sub]);
  const prop = r.section === "house" && r.sub !== "vehicles" ? state.properties.find((p) => p.id === state.propertyId) : null;
  // 房屋下的子页：房屋 / 房产 / 页面（之前只剩房产名，“房屋”这一级消失了）
  const parts = prop ? [...houseProps(), { href: `${href("house", "overview")}?prop=${encodeURIComponent(prop.id)}`, label: prop.name, icon: KIND_ICON[prop.kind] || "🏠" }] : r.section === "bills" ? finBase(r.sub) : [{ href: href(r.section), label: t(sec.name) }];
  if (prop && r.sub === "overview") return crumbNav([...houseProps(), { label: prop.name, icon: KIND_ICON[prop.kind] || "🏠" }]);   // 房屋 / 房产名（概览就是房产本身，不再多一级「概览」）
  const curLabel = cur ? t(cur[1]) : "", subHref = href(r.section, cur?.[0] || r.sub);
  // 二级页（常用账单 / 推荐耗材 / 生成设备）：要显示 上级 / 当前页 两层，之前只显示当前页，看起来像少了一层
  const par = parent[r.sub] ? sec.subs.find(([k]) => k === parent[r.sub]) : null;
  // 三级：房屋资料分区 / 交易子页 / 设置分区 / 库存分类 —— 中间项可点回上一级，页面不再另起标题行
  const q = r.q;
  const psec = r.section === "house" && r.sub === "profile" ? houseHooks.PROFILE_SECTIONS?.find((s) => s.id === q.get("sec")) : null;
  const rdeal = r.section === "house" && r.sub === "deal" ? (houseHooks.routeDeal?.() ?? null) : null;
  const dsec = rdeal !== null || (r.section === "house" && r.sub === "deal") ? (houseHooks.dealSubLabel?.(q.get("sec"), rdeal) ?? null) : null;
  const hist = q.get("deal") ? (houseHooks.historyLabel?.(rdeal) ?? null) : null;   // 看历史交易：交易 / 历史 · 买入 / 子页
  // 车辆交易页：‹ 车辆 / 车名 / 交易 / 子页
  const vehDeal = r.section === "house" && r.sub === "deal" && q.get("asset") ? state.assetsEnriched.find((a) => a.id === q.get("asset")) : null;
  if (vehDeal) {
    const dealHref_ = `${subHref}?asset=${encodeURIComponent(vehDeal.id)}${q.get("deal") ? `&deal=${encodeURIComponent(q.get("deal"))}` : ""}`;
    const vparts = [...houseCars(), { href: href("asset", vehDeal.id), label: assetName(vehDeal) }];
    const dealRoot = `${subHref}?asset=${encodeURIComponent(vehDeal.id)}`;
    if (hist) { vparts.push({ href: dealRoot, label: curLabel }); if (dsec) vparts.push({ href: dealHref_, label: hist }, { label: dsec }); else vparts.push({ label: hist }); }
    else if (dsec) vparts.push({ href: dealHref_, label: curLabel }, { label: dsec }); else vparts.push({ label: curLabel });
    return crumbNav(vparts);
  }
  const ssec = r.section === "me" && r.sub === "settings" ? SETTING_SECTIONS.find((s) => s.id === q.get("sec")) : null;
  const invPage = (r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear"));
  const cat = invPage && state.filter.cat !== "all" ? window.CATEGORIES.find((c) => c.id === state.filter.cat) : null;
  if (psec) parts.push({ href: subHref, label: curLabel }, { label: t(psec.name), icon: psec.icon });
  else if (hist) { parts.push({ href: subHref, label: curLabel }); if (dsec) parts.push({ href: `${subHref}?deal=${encodeURIComponent(q.get("deal"))}`, label: hist }, { label: dsec }); else parts.push({ label: hist }); }   // 房产 / 交易 / 历史 · 买入 / 子页
  else if (dsec) parts.push({ href: subHref, label: curLabel }, { label: dsec });
  else if (ssec && ssec.id === "family" && q.get("person")) parts.push({ href: subHref, label: curLabel }, { href: familyHref(), label: t(ssec.name), icon: ssec.icon }, { label: personNameOf(q.get("person")) || t("家庭成员") });
  else if (ssec && ssec.id === "family" && q.get("member")) parts.push({ href: subHref, label: curLabel }, { href: familyHref(), label: t(ssec.name), icon: ssec.icon }, { label: memberCrumbLabel(q.get("member")) });   // 设置 / 家庭与成员 / 某位成员
  else if (ssec) parts.push({ href: subHref, label: curLabel }, { label: t(ssec.name), icon: ssec.icon === "__AI__" ? aiIcon(18) : ssec.icon });
  else if (cat) parts.push({ action: "cat", attrs: 'data-cat="all"', label: curLabel }, { label: t(cat.name), icon: cat.icon });   // “库存”可点回全部分类
  else if (r.section === "house" && r.sub === "template") return crumbNav([{ href: href("pantry"), label: t("储藏") }, { href: `${href("pantry", "inventory")}?space=house`, label: `${t("库存")} · ${t("汽车房屋消耗品")}` }, { label: curLabel }]);   // 推荐耗材是从 库存 · 汽车房屋消耗品 进来的
  else if (r.section === "bills" && r.sub === "debts" && (q.get("id") || q.get("new"))) {   // 借贷 / 某笔贷款（/ 编辑）；借贷 / 添加
    const d = q.get("id") ? debtsEnriched().find((x) => x.id === q.get("id")) : null;
    if (d && q.get("edit")) parts.push({ href: subHref, label: curLabel }, { href: `${subHref}?id=${encodeURIComponent(d.id)}`, label: d.name }, { label: t("编辑") });
    else parts.push({ href: subHref, label: curLabel }, { label: d ? d.name : q.get("new") ? t("添加") : t("找不到") });
  }
  else if (r.section === "bills" && activeTab(r) && activeTab(r) !== SPLIT_FIRST(r)) parts.push({ href: subHref, label: curLabel }, { label: t(tabLabel(r)) });   // 花费 / 预算的页内标签：账单 / 花费 / 明细
  else if (r.section === "bills" && r.sub === "template") parts.push({ href: assetBillsHref("recurring"), label: t("周期性账单") }, { label: curLabel });   // 财务 / 账单 / 周期性账单 / 常用账单
  else if (par) parts.push({ href: href(r.section, par[0]), label: t(par[1]) }, { label: curLabel });   // 常用账单 → 账单 / 清单 / 常用账单；生成设备 → 房屋 / 房产 / 设备保养 / 生成设备
  else parts.push({ label: curLabel });
  return crumbNav(parts);
}
