import { viewSwitch } from "../core/view-switch.js";
/* 交易页：任务行、编辑表单、交易详情、新建 / 编辑交易的表单、交割面板。 */
import { D, END_LAG, V, addTaskRow, currentProp, dateLabels, dealHref, dealTasks, editBtn, isEditing, isVehDeal, newTaskPanel, openDeal, openVehicleDeal, propertyLive, skipBtn, statusText, taskEditForm, taskRow } from "./deal-tasks.js";
import { addDays } from "../bills/logic.js";
import { debtHref } from "../bills/debt-logic.js";
import { analyze, briefHtml, eventFormPanel, freezeBaseline, lanesHtml, needsFreeze } from "./deal-progress.js";
import { assetName, isVehicle } from "./assets.js";
import { clearFiltersBtn } from "../core/clear-filters.js";
import { esc, fmtDate, money, num, todayISO } from "../core/util.js";
import { houseBar } from "./property-form.js";
import { href } from "../core/router.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { priceInput, priceOrNull, pricesOk } from "../core/finance-access.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { debts as allDebts } from "../bills/debt-logic-common.js";
import { lpAttr } from "../core/long-press.js";
import { Store } from "../core/store.js";
import { bulkBar, bulkCheck, bulkMenuItem, bulkOn, bulkRegister } from "../core/bulk-select.js";

/* ── 交易页：主体是当前房产，或 ?asset=<id> 指定的车辆 ── */
const DEAL_VIEWS = [["list", "☰", "清单"], ["plan", "📋", "计划"], ["actual", "✅", "实际"], ["compare", "⚖️", "对比"]];
const DEAL_FILTERS = [["all", "全部"], ["undone", "未完成"], ["overdue", "逾期"], ["must", "必须项（未完成）"], ["done", "已完成"], ["skipped", "已跳过"]];
const DEAL_ACT_FILTERS = [["all", "全部"], ["events", "进展记录"], ["tasks", "勾选完成的事项"]];
const DEAL_SORTS = [["desc", "由近及远"], ["asc", "由远及近"]];
/** 完成情况筛选；stage = true 时再按阶段筛（时间线用；单个阶段页本来就只有一个阶段） */
const filterDealRows = (rows, { stage = false } = {}) => rows.filter((x) => ({ all: true, undone: !x.done && !x.skipped, overdue: !x.done && !x.skipped && x.overdue, must: !x.done && !x.skipped && x.priority === "must", done: !!x.done, skipped: !!x.skipped }[state.dealFilter] ?? true)
  && (!stage || (state.dealStage || "all") === "all" || x.stage === state.dealStage));
const dealFiltered = (view) => (view === "actual" ? (state.dealActFilter || "all") !== "all" : (state.dealFilter || "all") !== "all" || (state.dealStage || "all") !== "all");
/** 筛选 / 阶段 / 排序：下拉框（和收入、花费页的时间条同一个样子）。view = list（单个阶段页，只有完成情况）/ plan / actual / compare */
function dealToolbar(view, deal = null) {
  const sel = (key, label, list, v) => `<label class="tb-field"><span>${t(label)}</span><select data-deal-sel="${key}" data-nosearch aria-label="${esc(t(label))}">${list.map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>`;
  const stages = deal ? Object.entries(D().stagesOf(deal.kind)).map(([k, n]) => [k, n]) : [];
  const parts = view === "actual" ? [sel("act", "显示", DEAL_ACT_FILTERS, state.dealActFilter || "all")]
    : [sel("filter", "完成情况", DEAL_FILTERS, state.dealFilter || "all"), ...(view !== "list" && stages.length ? [sel("stage", "阶段", [["all", "全部阶段"], ...stages], state.dealStage || "all")] : [])];
  if (view !== "list") parts.push(sel("sort", "排序", DEAL_SORTS, state.dealSort === "asc" ? "asc" : "desc"));
  return `<div class="time-bar deal-tools" role="group" aria-label="${esc(t("筛选和排序"))}">${parts.join("")}${clearFiltersBtn("deal", dealFiltered(view))}</div>`;
}
const dealFilterBar = () => dealToolbar("list");
export function viewDeal() {
  const q = state.route?.q;
  const assetId = q?.get("asset") || null;
  const veh = assetId ? state.assetsEnriched.find((a) => a.id === assetId && isVehicle(a)) || null : null;
  if (assetId && !veh) return `<section class="section"><div class="panel empty"><strong>${t("找不到这辆车")}</strong><p><a class="btn btn-primary" href="${href("house")}">${t("回到房屋")}</a></p></div></section>`;
  const p = veh ? null : currentProp();
  if (!veh && !p) return `<section class="section"><div class="panel empty"><strong>${t("还没有房产")}</strong></div></section>`;
  const mine = (d) => (veh ? d.asset_id === veh.id : d.property_id === p.id);
  // ?deal=<id>：查看历史交易（已交割 / 已取消）—— 清单、时间线、交易信息都还能看、能改，只是没有“完成交割”入口
  const viewed = q?.get("deal") ? state.deals.find((d) => d.id === q.get("deal") && mine(d)) || null : null;
  const deal = viewed || (veh ? openVehicleDeal(veh.id) : openDeal(p.id));
  const closed = !!deal?.outcome;
  const history = state.deals.filter((d) => mine(d) && d.outcome);
  // 子页链接：车辆交易带 asset=；查看历史交易时把 deal= 一路带着，否则回到进行中的交易
  const link = (sec) => { const ps = new URLSearchParams(); if (sec) ps.set("sec", sec); if (veh) ps.set("asset", veh.id); if (viewed) ps.set("deal", deal.id); const qs = ps.toString(); return `${href("house", "deal")}${qs ? `?${qs}` : ""}`; };
  const histLink = (d) => dealHref({ ...d, outcome: d.outcome || "closed" });
  const bar = veh ? "" : houseBar();
  const headCard = veh ? vehicleCard(veh) : propertyCard(p);
  if (!deal) {
    const starts = veh ? vehicleStarts(veh) : propertyStarts(p);
    const live = veh ? V().isActive(veh) : propertyLive(p);
    const intro = veh ? t("买车、卖车或租赁到期归还时，按常见流程生成带日期的清单：产权与上牌、保险、拆车牌、已售通知、删除个人数据，逐项提醒。")
      : t("买入或卖出时，按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、贷款承诺、停服务通知、交割后事项，逐项提醒。");
    return `${bar}${headCard}
      <section class="section"><div class="panel empty"><strong>${veh ? t("这辆车没有进行中的交易") : t("这套房产没有进行中的交易")}</strong>
        ${intro}
        <p>${starts.map(([k, l]) => `<button type="button" class="btn btn-primary" data-action="deal-start" data-kind="${k}" ${veh ? `data-asset="${veh.id}"` : ""}>${l}</button>`).join(" ")}
           ${!live ? `<span class="muted">${veh ? t("已卖出或已归还的车只保留历史。") : t("已卖出或退租的房产只保留历史。")}</span>` : ""}</p></div></section>
      ${dealHistory(history, null, histLink)}`;
  }
  const tasks = dealTasks(deal), an = analyze(deal, tasks);
  if (needsFreeze(deal, tasks)) freezeBaseline(deal, tasks);   // 填了合同日：把模板日期冻结成「计划」基线（只补没有的，后台写，不挡渲染）
  const groups = Object.entries(D().stagesOf(deal.kind)).map(([k, n]) => ({ k, n, rows: tasks.filter((x) => x.stage === k) })).filter((g) => g.rows.length);
  const skippedAll = tasks.filter((x) => x.skipped).length, undone = tasks.filter((x) => !x.done && !x.skipped), mustLeft = undone.filter((x) => x.priority === "must").length;
  const K = D().KINDS;
  const sec = ((closed || veh) && q?.get("sec") === "closeout" ? "" : q?.get("sec")) || "";   // 历史交易、车辆交易没有交割页（车辆直接一键完成）
  // ── 子页：交易信息 / 某个阶段的清单 / 交割（面包屑由 menu.js 统一画：‹ 房产 / 交易 / 子页名）──
  if (sec === "info") return `<section class="section">${dealForm(deal)}</section>`;
  if (sec.startsWith("stage:")) {
    const sk = sec.slice(6), ST = D().stagesOf(deal.kind), g = groups.find((x) => x.k === sk) || (ST[sk] ? { k: sk, n: ST[sk], rows: [] } : null);   // 空阶段（如删光自定义事项后）也画出来，方便再添加
    if (!g) return `<section class="section"><div class="panel empty"><strong>${t("没有这个阶段")}</strong></div></section>`;
    const done = g.rows.filter((x) => x.done).length, skippedN = g.rows.filter((x) => x.skipped).length;
    return `${newTaskPanel(deal)}<section class="section">
      <p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("{kind}流程", { kind: t(K[deal.kind]) })} · ${t("已完成 {a} / {b}", { a: done, b: g.rows.length - skippedN })}${skippedN ? ` · ⊘ ${t("跳过 {n}", { n: skippedN })}` : ""}</p>
      ${g.rows.length ? dealFilterBar() : ""}
      <div class="panel">${filterDealRows(g.rows).length ? `<ul class="task-list">${filterDealRows(g.rows).sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).map((x) => taskRow(x)).join("")}</ul>` : `<div class="empty"><strong>${t("没有符合条件的事项")}</strong></div>`}</div>
      <p><button type="button" class="btn btn-sm btn-ghost" data-action="deal-task-new" data-deal="${deal.id}" data-stage="${g.k}">＋ ${t("添加自定义事项")}</button></p>
      <p class="disclaimer">${veh ? t("清单按伊利诺伊州常见流程整理，产权、税费和期限以车管所（SOS）和车行 / 租赁公司为准；其他州请按本地流程增删。点事项右侧的 ✎ 可以调整应完成日期、记录实际完成日期。") : t("清单按伊利诺伊州（芝加哥）常见流程整理，日期和税费以合同、律师和产权公司为准；其他州请按本地流程增删。点事项右侧的 ✎ 可以调整应完成日期、记录实际完成日期。")}</p>
    </section>`;
  }
  if (sec === "closeout") return `<section class="section">
      ${state.closeout ? closeoutPanel(p, deal) : `<div class="panel"><div class="kv"><div class="muted">${deal.kind === "buy" ? t("交割完成后，把房产状态改为“持有”，记下买入日期和价格。") : t("交割完成后：账单设结束日期、生成取消自动扣款清单、房产归档保留历史。")}</div>
        <div class="head-acts"><button type="button" class="btn btn-primary btn-sm" data-action="deal-closeout">${deal.kind === "buy" ? t("已交割，标为持有") : t("开始退出向导")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="deal-cancel">${t("取消这笔交易")}</button></div></div></div>`}
    </section>`;
  // ── 枢纽页：总进度 + 一行一个入口，各带完成度 ──
  const total = tasks.length - skippedAll, doneN = total - undone.length, pct = total ? Math.round((doneN / total) * 100) : 0;
  const INFO_FIELDS = (veh ? ["contract_on", "closing_on", "price", "earnest_money", "lender", "agent"] : ["contract_on", "closing_on", "review_deadline", "financing_deadline", "price", "earnest_money", "attorney", "lender", "agent", "title_company", "inspector"])
    .filter((k) => pricesOk() || !["price", "earnest_money"].includes(k));   // 没财务权限：完成度不数看不到的价格
  const infoN = INFO_FIELDS.filter((k) => deal[k] != null && deal[k] !== "").length;
  const nextDue = undone.filter((x) => x.due).sort((a, b) => a.due.localeCompare(b.due))[0];
  // url 为 null 时画成按钮（attrs 里带 data-action）
  const row = (url, icon, title, desc, prog, badge = "", attrs = "") => `<${url ? `a href="${url}"` : `button type="button" ${attrs}`} class="mrow">
      <span class="mi" aria-hidden="true">${icon}</span>
      <span class="mt"><b>${title}</b><small>${desc}</small>${prog != null ? `<span class="mprog"><i style="width:${prog}%"></i></span>` : ""}</span>
      ${badge}<span class="mch" aria-hidden="true">›</span></${url ? "a" : "button"}>`;
  const stageRows = groups.map((g) => {
    const live = g.rows.filter((x) => !x.skipped), s = g.rows.length - live.length, n = live.length, d = live.filter((x) => x.done).length;
    const late = live.filter((x) => !x.done && x.overdue).length, must = live.filter((x) => !x.done && x.priority === "must").length, allDone = n > 0 && d === n;
    const next = live.filter((x) => !x.done && x.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    const desc = n === 0 ? t("这一阶段的事项都已跳过") : allDone ? t("全部完成") : [next ? t("下一项 {date}：{name}", { date: fmtDate(next.due), name: t(next.name) }) : null, must ? t("{n} 项必须", { n: must }) : null].filter(Boolean).join(" · ") || t("还有 {n} 项", { n: n - d });
    // 科目后面的统计：2/2 ✔ 表示做完，⊘ 1 表示跳过了 1 项；逾期另有红色徽章
    const badge = `<span class="mbadges">` + (late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: late })}</span>` : "")
      + (n ? `<span class="badge mcount ${allDone ? "b-ok" : ""}" ${allDone ? "" : 'style="background:var(--surface-2)"'}>${d}/${n}${allDone ? " ✔" : ""}</span>` : "")
      + (s ? `<span class="badge mcount skipb" title="${esc(t("已跳过 {n} 项（不适用）", { n: s }))}">⊘ ${s}</span>` : "") + `</span>`;
    return row(link(`stage:${g.k}`), allDone ? "✅" : n === 0 ? "⊘" : "☐", t(g.n), esc(desc), n ? Math.round((d / n) * 100) : 100, badge);
  }).join("");
  const infoRow = row(link("info"), "📝", t("交易信息"), veh ? (infoN ? t("日期、价格、贷款行 / 租赁公司、对方联系方式") : t("先填{a}和{b}，清单日期按它们推算", { a: t(dateLabels(deal)[0]), b: t(dateLabels(deal)[1]) })) : infoN ? t("合同日、交割日、价格、律师、贷款行、经纪人等") : t("先填合同日和交割日，清单截止日按它们推算"), Math.round((infoN / INFO_FIELDS.length) * 100), `<span class="badge mcount" style="background:var(--surface-2)">${infoN}/${INFO_FIELDS.length}</span>`);
  const addRow = addTaskRow(deal, "special", row);
  // 完成：房产买入 / 车辆都是一键确认（按钮，点两次），卖房 / 退租走向导页
  const closeRow = closed ? "" : veh
    ? row(null, deal.kind === "veh_buy" ? "🔑" : "📦", deal.kind === "veh_buy" ? t("已提车，标为持有") : deal.kind === "veh_sell" ? t("已交车，标为已卖出") : t("已归还，标为已归还"),
        deal.kind === "veh_buy" ? t("把购车日期、价格写进车辆档案；填了贷款行就标为贷款中") : t("记下日期和成交价，车从列表和提醒里退出，档案与保养记录保留"), null, "", `data-action="deal-closeout" data-deal="${deal.id}"`)
    : row(link("closeout"), deal.kind === "buy" ? "🔑" : "📦", deal.kind === "buy" ? t("完成交割") : t("交割与退出"), deal.kind === "buy" ? t("交割后标为持有，记买入日期和价格") : t("账单结束日期、取消自动扣款、归档房产"), null);
  // 买入 / 买车填了贷款行：交割那一步提供「创建贷款」（预填贷款方、成交价 − 定金、房产 / 车辆 id）；已经有挂在这处资产上的贷款就不再提示
  const subjectId = veh ? veh.id : p?.id, hasLoan = state.debtsOk && allDebts().some((x) => (veh ? x.asset_id === subjectId : x.property_id === subjectId) && x.direction === "payable");
  const loanRow = ["buy", "veh_buy"].includes(deal.kind) && deal.outcome !== "cancelled" && deal.lender && pricesOk() && state.debtsOk && !hasLoan
    ? row(debtHref(null, `new=1&cat=${veh ? "auto_loan" : "mortgage"}&lender=${encodeURIComponent(deal.lender)}${deal.price != null ? `&principal=${Math.max(0, num(deal.price) - num(deal.earnest_money))}` : ""}&${veh ? "asset" : "prop"}=${encodeURIComponent(subjectId)}${deal.closing_on ? `&start=${deal.closing_on}` : ""}&name=${encodeURIComponent(`${veh ? t("车贷") : t("房贷")} · ${deal.lender}`.slice(0, 60))}`),
        "🏦", t("创建贷款"), t("贷款方 {l}；本金先按成交价 − 定金估，按贷款文件改", { l: deal.lender }), null) : "";
  const cancelRow = closed ? "" : `<p style="margin:8px 0 0;text-align:right"><button type="button" class="btn btn-sm btn-ghost" data-action="deal-cancel" data-deal="${deal.id}">${t("取消这笔交易")}</button></p>`;
  const openNow = veh ? openVehicleDeal(veh.id) : openDeal(p.id);
  const view = DEAL_VIEWS.some((v) => v[0] === state.dealView) ? state.dealView : "list";
  const laneH = { isEditing, editBtn, skipBtn, editForm: (x) => taskEditForm(x.deal, x), sort: state.dealSort === "asc" ? "asc" : "desc", filter: state.dealFilter || "all", stage: state.dealStage || "all", act: state.dealActFilter || "all" };
  return `${bar}${headCard}
    <section class="section">
      <div class="section-head"><h2>${closed ? (deal.outcome === "cancelled" ? t("{kind}已取消", { kind: t(K[deal.kind]) }) : t("{kind}已完成", { kind: t(K[deal.kind]) })) : t("{kind}进行中", { kind: t(K[deal.kind]) })}</h2><p>${deal.closing_on ? `${t(dateLabels(deal)[1])} ${fmtDate(deal.closing_on)}` : t("还没填{d}", { d: t(dateLabels(deal)[1]) })}</p></div>
      ${closed ? `<p class="muted" style="margin:-6px 0 10px;font-size:13px">${t("这是历史交易。清单、时间线和交易信息仍可查看和修改，供日后参考。")}${openNow ? ` <a href="${dealHref(openNow)}">${t("回到进行中的交易")}</a>` : ""}</p>` : ""}
      <div class="panel deal-progress">
        <div class="kv"><div><b>${t("总进度 {p}%", { p: pct })}</b><div class="muted">${t("已完成 {a} / {b}", { a: doneN, b: total })}${skippedAll ? ` · ⊘ ${t("跳过 {n}", { n: skippedAll })}` : ""}${mustLeft ? ` · ${t("必须项还剩 {n}", { n: mustLeft })}` : ""}${nextDue ? ` · ${t("最近截止 {date}", { date: fmtDate(nextDue.due) })}` : ""}</div></div></div>
        <div class="life-bar big"><i style="width:${pct}%"></i></div>
      </div>
    </section>
    ${newTaskPanel(deal)}
    <section class="section">
      <div class="view-bar">${viewSwitch(DEAL_VIEWS.map(([v, ico, name]) => [v, name, ico]), view, { action: "deal-view", attr: "view" })}</div>
      ${view === "list" ? `<div class="panel mlist">${infoRow}${stageRows}${addRow}${closeRow}${loanRow}</div>` : `<div class="panel mlist">${infoRow}</div>
        ${view !== "plan" ? briefHtml(deal, an, laneH) : ""}
        <div class="dl-bar">${view !== "plan" ? `<button type="button" class="btn btn-primary btn-sm" data-action="deal-event-new" data-deal="${deal.id}">＋ ${t("记一笔进展")}</button>` : ""}</div>
        ${dealToolbar(view, deal)}${eventFormPanel(deal, an)}${lanesHtml(deal, an, filterDealRows(an.rows, { stage: true }), view, laneH)}
        <div class="panel mlist" style="margin-top:12px">${addRow}${closeRow}${loanRow}</div>`}${cancelRow}
      <p class="disclaimer">${t("截止日按{a}和{b}推算，可点 ✎ 调整；必须项逾期会在首页置顶", { a: t(dateLabels(deal)[0]), b: t(dateLabels(deal)[1]) })}${deal.baseline?._at ? ` ${t("「计划」是填了合同日后冻结的模板日期，改期只影响「预计」，不会改掉原计划。")}` : ""}</p>
    </section>
    ${dealHistory(history, viewed?.id || null, histLink)}`;
}
/** 交易页顶部：房产状态卡 */
function propertyCard(p) {
  const B = window.BILLS;
  const live = propertyLive(p);
  return `<section class="section"><div class="house-card">
      <span class="house-ico" aria-hidden="true">🏠</span>
      <div class="grow"><h2>${esc(p.name)}<span class="badge ${live ? "b-ok" : ""}" style="${live ? "" : "background:var(--surface-2)"}">${statusText(p)}</span></h2>
        <p class="muted">${[t(B.PROPERTY_KINDS[p.kind] || ""), t(B.PROPERTY_ROLES[p.role] || ""), p.acquired_on ? t("{d} 买入", { d: fmtDate(p.acquired_on) }) : null, priceOrNull(p.purchase_price) ? money(num(p.purchase_price)) : null,
          p.sold_on ? t("{d} 卖出", { d: fmtDate(p.sold_on) }) : null, priceOrNull(p.sale_price) ? money(num(p.sale_price)) : null].filter(Boolean).map(esc).join(" · ")}</p></div>
    </div></section>`;
}
/** 交易页顶部：车辆状态卡（面包屑由 menu.js 画：车辆 / 车名 / 交易） */
function vehicleCard(a) {
  const v = a.vehicle || {}, st = V().STATUS[V().statusOf(a)], pt = V().POWERTRAINS[a.type];
  const meta = [[a.manufacture_year, a.brand, a.model].filter(Boolean).join(" "), t(pt?.name || ""), v.plate ? `🪪 ${v.plate}` : null,
    a.installed_on ? t("{d} 购入", { d: fmtDate(a.installed_on) }) : null, priceOrNull(a.purchase_price) ? money(num(a.purchase_price)) : null,
    v.disposed_on ? `${V().statusOf(a) === "returned" ? t("{d} 归还", { d: fmtDate(v.disposed_on) }) : t("{d} 卖出", { d: fmtDate(v.disposed_on) })}` : null, priceOrNull(v.sale_price) ? money(num(v.sale_price)) : null].filter(Boolean);
  return `<section class="section"><div class="house-card">
      <span class="house-ico" aria-hidden="true">${pt?.icon || "🚗"}</span>
      <div class="grow"><h2><a class="asset-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a><span class="badge ${st.cls}" style="${st.cls ? "" : "background:var(--surface-2)"}">${t(st.name)}</span></h2>
        <p class="muted">${meta.map(esc).join(" · ")}</p></div>
    </div></section>`;
}
/** 没有进行中交易时可以开始哪些流程 */
function propertyStarts(p) {
  return [
    !["sold", "moved_out", "selling"].includes(p.status) && p.role !== "tenant" && ["looking", "buying"].includes(p.status) ? ["buy", t("开始买入流程")] : null,
    ["owned", "selling"].includes(p.status) && p.role !== "tenant" ? ["sell", t("开始卖出流程")] : null,
    p.role === "tenant" && p.status === "renting" ? ["move_out", t("开始退租流程")] : null,
    p.status === "owned" && p.role !== "tenant" ? ["buy", t("记录买入流程（刚签约）")] : null,
  ].filter(Boolean);
}
function vehicleStarts(a) {
  const st = V().statusOf(a);
  return [
    st === "looking" ? ["veh_buy", t("开始买车流程")] : null,
    ["owned", "financed"].includes(st) ? ["veh_sell", t("开始卖车流程")] : null,
    ["owned", "financed"].includes(st) ? ["veh_buy", t("记录买车流程（刚下订）")] : null,
    st === "leased" ? ["veh_return", t("开始租赁归还流程")] : null,
    st === "leased" ? ["veh_sell", t("买断后卖车")] : null,
  ].filter(Boolean);
}
function dealForm(d) {
  const v = (k) => esc(d[k] ?? "");
  if (isVehDeal(d)) {   // 车辆：日期两个、价格、定金、贷款行 / 租赁公司、对方联系方式、备注
    const [c, z] = dateLabels(d);
    return `<form id="dealForm" class="panel" novalidate>
    <input type="hidden" name="deal_id" value="${esc(d.id)}">
    <div class="form-grid">
      ${d.kind === "veh_return" ? "" : `<label>${t(c)}<input name="contract_on" type="date" value="${v("contract_on")}"><small>${t("准备阶段的事项按它推算")}</small></label>`}
      <label>${t(z)}<input name="closing_on" type="date" value="${v("closing_on")}"><small>${d.kind === "veh_return" ? t("预检、归还、最终账单都按它推算") : t("保险、上牌、拆车牌、已售通知按它推算")}</small></label>
      ${priceInput(`<label>${d.kind === "veh_return" ? t("买断价（可选）") : t("成交价")}<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${v("price")}"></label>`, "price", d.price)}
      ${priceInput(`<label>${d.kind === "veh_return" ? t("处置费 / 预估超里程费") : t("定金")}<input name="earnest_money" type="number" inputmode="decimal" min="0" step="0.01" value="${v("earnest_money")}"></label>`, "earnest_money", d.earnest_money)}
      <label>${d.kind === "veh_return" ? t("租赁公司") : t("贷款行 / 租赁公司")}<input name="lender" maxlength="120" value="${v("lender")}"><small>${d.kind === "veh_buy" ? t("填了，完成时车会标为“贷款中”") : ""}</small></label>
      <label>${d.kind === "veh_buy" ? t("车行 / 卖家") : d.kind === "veh_sell" ? t("买家 / 车行") : t("经销商 / 归还地点")}<input name="agent" maxlength="120" placeholder="${t("姓名 · 电话 / 邮箱")}" value="${v("agent")}"></label>
      <label class="span-2">${t("备注")}<input name="notes" maxlength="1000" value="${v("notes")}"></label>
    </div>
    <div class="form-actions sticky-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${t("保存交易信息")}</button>
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span></div>
  </form>`;
  }
  return `<form id="dealForm" class="panel" novalidate>
    <input type="hidden" name="deal_id" value="${esc(d.id)}">
    <div class="form-grid">
      <label>${t("合同日")}<input name="contract_on" type="date" value="${v("contract_on")}"><small>${t("签约日期；律师审查、定金等按它推算")}</small></label>
      <label>${t("交割日")}<input name="closing_on" type="date" value="${v("closing_on")}"><small>${t("停服务、保险、交割后事项按它推算")}</small></label>
      <label>${t("律师审查截止")}<input name="review_deadline" type="date" value="${v("review_deadline")}"></label>
      <label>${t("贷款条款截止")}<input name="financing_deadline" type="date" value="${v("financing_deadline")}"></label>
      ${priceInput(`<label>${t("成交价")}<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${v("price")}"></label>`, "price", d.price)}
      ${priceInput(`<label>${t("定金")}<input name="earnest_money" type="number" inputmode="decimal" min="0" step="0.01" value="${v("earnest_money")}"></label>`, "earnest_money", d.earnest_money)}
      <label>${t("律师")}<input name="attorney" maxlength="120" placeholder="${t("姓名 · 电话 / 邮箱")}" value="${v("attorney")}"></label>
      <label>${t("贷款行 / 贷款经纪")}<input name="lender" maxlength="120" value="${v("lender")}"></label>
      <label>${t("经纪人")}<input name="agent" maxlength="120" value="${v("agent")}"></label>
      <label>${t("产权公司")}<input name="title_company" maxlength="120" value="${v("title_company")}"></label>
      <label>${t("验房师")}<input name="inspector" maxlength="120" value="${v("inspector")}"></label>
      <label class="span-2">${t("备注")}<input name="notes" maxlength="1000" value="${v("notes")}"></label>
    </div>
    <div class="form-actions sticky-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${t("保存交易信息")}</button>
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span>
      <small class="muted">${t("切换标签页或家人改动时不会丢，但要点保存才写入")}</small></div>
  </form>`;
}
/** 历史交易：每条可点开（?deal=<id>）查看、修改当时的清单、时间线和交易信息；current = 正在看的那条 */
function dealHistory(list, current, linkOf) {
  if (!list.length) return "";
  const K = D().KINDS, lim = pageLimit("deals");
  bulkRegister("deals", { ids: () => list.filter((d) => d.id !== current).map((d) => d.id), del: (id) => Store.deleteDeal(id) });
  const pick = !!bulkOn("deals");   // 分批显示；换页面回到一页
  // 一行：种类徽章 + 日期 / 摘要；“查看清单”固定在右上角（手机上摘要换行也不会和按钮叠在一起）
  return `<section class="section"><div class="section-head"><h2>${t("历史交易")}</h2></div><div class="panel">${bulkBar("deals")}<ul class="restock-list hist-list">${list.slice(0, lim).map((d) => `<li ${pick ? (d.id === current ? "" : "data-row-chk") : `data-swipe-del="deal" ${lpAttr([d.id === current ? null : { label: t("查看清单"), href: linkOf(d), first: true }, { label: t("删除"), action: "deal-delete", data: { deal: d.id }, danger: true }, d.id === current ? null : bulkMenuItem("deals", d.id)])}`} ${d.id === current ? 'aria-current="true"' : ""}>${pick && d.id !== current ? bulkCheck("deals", d.id) : ""}
    <span class="badge" style="background:var(--surface-2)">${t(K[d.kind])}</span>
    <div class="grow"><a class="link-name" href="${linkOf(d)}">${d.closing_on ? fmtDate(d.closing_on) : fmtDate((d.closed_at || d.updated_at || "").slice(0, 10))}</a>
      <small>${[d.outcome === "cancelled" ? t("已取消") : isVehDeal(d) ? t("已完成") : t("已交割"), priceOrNull(d.price) ? money(num(d.price)) : null, d.attorney, d.agent].filter(Boolean).map(esc).join(" · ")}</small></div>
    <span class="hist-act">${pick ? "" : d.id === current ? `<span class="badge b-ok">${t("正在查看")}</span>` : `<a class="btn btn-sm btn-ghost" href="${linkOf(d)}">${t("查看清单")}</a>`}<button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="deal-delete" data-deal="${esc(d.id)}">${t("删除")}</button></span></li>`).join("")}</ul>${pageMoreBtn("deals", list.length, lim)}</div></section>`;
}
/** 退出向导（卖出 / 退租）：交割日、成交价、每条账单的结束日期 */
function closeoutPanel(p, deal) {
  const closing = deal.closing_on || todayISO();
  const bills = state.bills.filter((b) => b.property_id === p.id && b.active);
  return `<form id="closeoutForm" class="panel" novalidate>
    <div class="form-grid">
      <label>${deal.kind === "move_out" ? t("退租日") : t("交割日")}<input name="closing_on" type="date" required value="${esc(closing)}"></label>
      ${deal.kind === "sell" ? priceInput(`<label>${t("成交价")}<input name="sale_price" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(deal.price ?? "")}"></label>`, "sale_price", deal.price) : ""}
    </div>
    <h3 style="font-size:15px;margin:14px 0 6px">${t("这套房产的账单（{n} 条）", { n: bills.length })}</h3>
    <p class="muted" style="font-size:13px;margin:0 0 8px">${t("结束日期之后不再提醒；水电气网默认多留 2–6 周等最后一期账单。自动扣款的请在清单里按“取消自动扣款”任务逐条去取消。")}</p>
    ${bills.length ? `<ul class="bill-list">${bills.map((b) => `<li class="bill-row">
        <div class="grow"><b>${esc(b.name)}</b>${b.autopay ? ` <span class="badge b-soon">${t("自动扣款")}</span>` : ""}<small>${esc(b.payee || "")}</small></div>
        <label>${t("结束于")}<input name="end_${b.id}" type="date" value="${esc(addDays(closing, END_LAG[b.category] ?? 0))}"></label></li>`).join("")}</ul>` : `<p class="muted">${t("没有挂在这套房产的账单。")}</p>`}
    <label class="check-inline" style="margin-top:10px"><input type="checkbox" name="archive" checked><span>${t("归档房产（从切换条隐藏，资料和记录保留只读）")}</span></label>
    <p class="muted" style="font-size:12px">${t("不会删除任何数据。以后在设置里可以恢复，或在归档后彻底删除。")}</p>
    <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${deal.kind === "move_out" ? t("确认退租") : t("确认已卖出")}</button>
      <button class="btn btn-ghost" type="button" data-action="deal-closeout-cancel">${t("取消")}</button></div>
  </form>`;
}
