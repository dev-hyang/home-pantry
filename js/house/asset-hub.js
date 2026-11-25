/* 设备详情的枢纽页和车辆概览：分区、统计、交易行、摘要。 */
import { ASSET_SECTIONS, supplyRows, vehBillsStat } from "./asset-supplies.js";
import { vehicleFacts } from "./asset-facts.js";
import { ageText, assetCrumb, assetTrail } from "./asset-list.js";
import { assetName, isVehicle, maintFilter } from "./assets-logic.js";
import { countBadge, crumbNav, filledCount, hubList, hubRow } from "../core/hub.js";
import { dealTasks, openVehicleDeal } from "./deals.js";
import { esc, fmt, fmtDate, inSpace, money, num, stampText } from "../core/util.js";
import { href } from "../core/router.js";
import { moreMenu } from "../core/more-menu.js";
import { normName } from "../core/item-match.js";
import { priceOrNull, pricesOk } from "../core/finance-access.js";
import { recallBanner, recallHubRow } from "./recall.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { assetBillsHref } from "../bills/all-href.js";
import { C, H, SERVICE_BADGE, V, WARRANTY_BADGE, distUnit, isFixture, unitsCount, unitsOf, unitsText, vehStatus, vehStatusBadge } from "./asset-common.js";

/** 设备 / 车辆枢纽页：摘要 + 各块完成度 + 保养记录 / 时间表 / 检查卡入口 + 删除 */
function assetStatMap(a) {
  const veh = isVehicle(a), v = a.vehicle || {}, ins = v.insurance || {};
  const pct = (n, m) => ({ pct: Math.round((n / m) * 100), badge: countBadge(n, m) });
  return {
    basic: () => { const n = 1 + filledCount([a.location, a.brand, a.model, a.serial]); return { text: [a.t ? t(a.t.name) : null, a.brand, a.model].filter(Boolean).join(" · "), ...pct(n, 5) }; },
    plate: () => { const n = filledCount([v.plate, v.odometer, v.annual_miles]); return { text: [v.plate, a.nowMiles != null ? t("约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, 3) }; },
    docs: () => { const n = filledCount([v.registration_due, v.emissions_due]); return { text: [t(V().STATUS[vehStatus(a)].name), v.registration_due ? t("牌照 {d}", { d: fmtDate(v.registration_due) }) : null, v.emissions_due ? t("排放 {d}", { d: fmtDate(v.emissions_due) }) : null, v.lease_end ? t("租赁 {d}", { d: fmtDate(v.lease_end) }) : null, v.disposed_on ? fmtDate(v.disposed_on) : null].filter(Boolean).join(" · "), ...pct(n, 2) }; },
    insurance: () => { const n = filledCount([ins.provider, ins.policy, ins.to, ins.coverage, ins.agent, ins.phone]); return { text: ins.provider ? [ins.provider, ins.to ? t("到期 {d}", { d: fmtDate(ins.to) }) : null].filter(Boolean).join(" · ") : t("未填"), ...pct(n, 6) }; },
    years: () => { const n = filledCount([a.installed_on, a.manufacture_year, a.warranty_until]); return { text: [a.installed_on ? fmtDate(a.installed_on) : null, a.warranty_until ? t("保修到 {d}", { d: fmtDate(a.warranty_until) }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, 3) }; },
    life: () => { const n = filledCount([a.expected_life_years, a.service_interval_months]); return { text: [a.expected_life_years ? t("约 {n} 年", { n: fmt(a.expected_life_years) }) : null, a.service_interval_months ? t("每 {n} 个月保养", { n: a.service_interval_months }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, 2) }; },
    cost: () => { const pp = priceOrNull(a.purchase_price), n = filledCount([pp, veh ? null : a.owner]); return { text: [pp != null ? money(num(pp)) : null, !veh && a.owner ? t("负责：{who}", { who: t(H().OWNERS[a.owner]?.name || "") }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, veh ? 1 : 2) }; },
    notes: () => ({ text: a.notes ? a.notes.slice(0, 60) : t("无"), pct: null, badge: "" }),
    units: () => { const u = unitsOf(a); return { text: u.length ? unitsText(a, 6) : t("还没写：有几处、各在哪"), pct: null, badge: u.length ? `<span class="badge mcount" style="background:var(--surface-2)">${unitsCount(a)}</span>` : "" }; },
  };
}
export function assetHub(a, root) {
  const veh = isVehicle(a), v = a.vehicle || {}, ins = v.insurance || {};
  const base = href("asset", a.id);
  const st = assetStatMap(a);
  // 车辆的「费用」块只有购车价：没财务权限整块不出现
  const rows = ASSET_SECTIONS.filter((s) => (veh ? !s.eq : !s.veh) && (!s.fx || isFixture(a)) && !(veh && s.id === "cost" && !pricesOk())).map((s) => { const x = st[s.id](); return hubRow({ href: `${base}?sec=${s.id}`, icon: s.icon, title: t(s.name), desc: esc(x.text), pct: x.pct, badge: x.badge }); });
  const more = [
    hubRow({ href: `${base}?sec=log`, icon: "🛠️", title: t("保养记录"), desc: a.logs.length ? t("{n} 条，最近 {d}", { n: a.logs.length, d: fmtDate(a.logs[0].done_on) }) : t("还没有记录"), badge: a.followUp ? `<span class="badge b-out mcount">${t(C().RESULTS[a.followUp.result])}</span>` : a.service === "overdue" || a.service === "due" ? `<span class="badge b-soon mcount">${t(SERVICE_BADGE[a.service].label)}</span>` : "" }),
    veh ? hubRow({ href: `${base}?sec=schedule`, icon: "📋", title: t("保养时间表"), desc: a.vSoonest ? t("下一项：{name} {d}", { name: t(a.vSoonest.name), d: fmtDate(a.vSoonest.next) }) : t("记一次保养后开始算") }) : "",
    veh ? vehDealRow(a) : "",
    veh ? (() => { const mine = state.enriched.filter(inSpace("house")).filter((x) => x.owner_asset_id === a.id), low = mine.filter((x) => x.status !== "ok").length;
      return hubRow({ href: `${href("house", "supplies")}?veh=${a.id}`, icon: "🧰", title: t("汽车房屋消耗品"), desc: mine.length ? t("{n} 种", { n: mine.length }) : t("还没有记录"), badge: low ? `<span class="badge b-soon mcount">${t("{n} 项要补", { n: low })}</span>` : "" }); })() : "",
    !veh && supplyRows(a).length ? (() => { const rs = supplyRows(a), have = rs.filter((r) => r.item), low = have.filter((r) => r.item.status !== "ok").length;
      return hubRow({ href: `${base}?sec=supplies`, icon: "🧰", title: t("相关耗材"), desc: t("{n} / {m} 项已在库存", { n: have.length, m: rs.length }), badge: low ? `<span class="badge b-soon mcount">${t("{n} 项要补", { n: low })}</span>` : "" }); })() : "",
    !veh && C().cardOf(a.type) ? hubRow({ href: `${base}?sec=care`, icon: "🔍", title: t("检查卡"), desc: t("怎么查、什么时候叫人") }) : "",
    // 出了问题：常见小毛病（离线）+ 咩咩诊断（可拍照）+ 配件加采购；车辆也能用（保养项以外的毛病）
    (() => { const n = C().fixesOf(a.type).length; return hubRow({ href: `${href("house", "fix")}?asset=${a.id}`, icon: "🩺", title: t("出了问题？"), desc: n ? t("{n} 个常见小毛病先看；描述毛病让咩咩分析原因、给方案，配件直接加采购", { n }) : t("描述毛病（可拍照），咩咩分析原因、给方案，配件直接加采购") }); })(),
    veh ? "" : hubRow(recallHubRow(a)),   // 产品召回：登记 → 修 / 换 / 退（车辆召回走保养项里的“召回查询”）
  ].filter(Boolean);
  return `<section class="section">
    ${crumbNav([...assetTrail(a, root, href("asset", a.id)).slice(0, -1), { label: assetName(a), icon: a.t?.icon || "⚙️" }])}
    ${veh ? "" : recallBanner(a)}
    ${assetSummary(a)}
    ${hubList(more)}
    <div class="section-head" style="margin-top:18px"><h3 style="font-size:15px">${t("档案")}</h3></div>
    ${hubList(rows)}
    <div class="form-actions" style="margin-top:14px"><a class="ui-btn" data-tone="primary" href="${base}?log=1">${t("记保养")}</a>
      <span class="spacer"></span><button type="button" class="ui-btn" data-tone="danger" data-action="asset-delete">${veh ? t("删除车辆") : t("删除设备")}</button></div>
  </section>`;
}
/** 车辆概览（参考房屋概览）：基本信息卡 → 导航豆腐块（各带小统计）→ 记保养。删除车辆放在名称旁 ⋮ 里 */
/** 添加车辆向导的步骤：车辆资料的各个分区（没有财务权限就没有「费用」那一步） */
export const vehSteps = () => ASSET_SECTIONS.filter((s) => !s.eq && !s.fx && !(s.id === "cost" && !pricesOk()));
const vehSections = () => ASSET_SECTIONS.filter((s) => !s.eq && !s.fx && !(s.id === "cost" && !pricesOk()));
export function vehicleOverview(a, root) {
  const v = a.vehicle || {}, ins = v.insurance || {}, base = href("asset", a.id), pt = V().POWERTRAINS[a.type], st = assetStatMap(a);
  const pcts = vehSections().map((s) => st[s.id]().pct).filter((x) => x != null), pct = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : 0;
  const tile = (url, icon, title, stat, desc, bar = null) => `<a class="hv-card hn-tile" href="${esc(url)}"><span class="hv-ico" aria-hidden="true">${icon}</span>
      <span class="hv-txt"><b>${esc(title)}</b>${stat ? `<small class="hn-stat">${esc(stat)}</small>` : ""}<small>${esc(desc)}</small>${bar != null ? `<span class="mprog"><i style="width:${bar}%"></i></span>` : ""}</span></a>`;
  const fact = (k, val) => (val ? `<div class="fact wide"><dt>${k}</dt><dd>${val}</dd></div>` : "");
  const facts = [fact(t("车牌"), v.plate ? esc(v.plate) : ""), fact(t("里程"), a.nowMiles != null ? t("约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }) : ""),
    fact(t("牌照到期"), v.registration_due ? fmtDate(v.registration_due) : ""), fact(t("车险"), ins.provider ? esc([ins.provider, ins.to ? t("到期 {d}", { d: fmtDate(ins.to) }) : ""].filter(Boolean).join(" · ")) : "")].join("");
  const mine = state.enriched.filter(inSpace("house")).filter((x) => x.owner_asset_id === a.id), low = mine.filter((x) => x.status !== "ok").length;
  const d = openVehicleDeal(a.id), dts = d ? dealTasks(d).filter((x) => !x.skipped) : [];
  const nFix = C().fixesOf(a.type).length;
  return `<section class="section">
    ${crumbNav([...assetTrail(a, root, base).slice(0, -1), { label: assetName(a), icon: pt?.icon || "🚗" }])}
    <div class="house-card">
      <div class="house-head"><span class="house-ico" aria-hidden="true">${pt?.icon || "🚗"}</span><div class="grow"><h2 class="house-name">${esc(assetName(a))}</h2></div>
        <span class="head-acts">${moreMenu([{ label: t("详情"), href: `${base}?sec=profile`, first: true }, { label: t("记保养"), href: `${base}?log=1` }, { label: t("问咩咩"), href: `${href("house", "fix")}?asset=${a.id}` }, { label: t("删除"), action: "asset-delete", danger: true }])}</span></div>
      ${assetSummary(a)}
      <p class="muted house-sub">${esc([a.manufacture_year, a.brand, a.model].filter(Boolean).join(" "))}</p>
      ${facts ? `<dl class="fact-grid one">${facts}</dl>` : ""}
    </div>
    <div class="hv-grid hn-grid" style="margin-top:14px">
      ${tile(`${base}?sec=profile`, "🚘", t("车辆资料"), t("完成度 {p}%", { p: pct }), t("基本信息、车牌与里程、证照、车险、年份、备注"), pct)}
      ${tile(assetBillsHref(`asset:${a.id}`), "🧾", t("账单"), vehBillsStat(a), t("这辆车的车险、车贷、牌照、维修等账单：本月概览，可切时间范围"))}
      ${tile(`${base}?sec=log`, "🛠️", t("保养记录"), a.logs.length ? t("{n} 条，最近 {d}", { n: a.logs.length, d: fmtDate(a.logs[0].done_on) }) : t("还没有记录"), t("检查、保养、维修、更换"))}
      ${tile(`${base}?sec=schedule`, "📋", t("保养时间表"), a.vSoonest ? t("下一项：{name} {d}", { name: t(a.vSoonest.name), d: fmtDate(a.vSoonest.next) }) : t("记一次保养后开始算"), t("按里程和时间提醒"))}
      ${tile(`${href("house", "deal")}?asset=${a.id}`, "🤝", t("买卖 / 归还"), d ? t("进行中 {a} / {b}", { a: dts.filter((x) => x.done).length, b: dts.length }) : t(V().STATUS[vehStatus(a)].name), t("买车、卖车、租赁归还的流程清单"))}
      ${tile(`${href("house", "supplies")}?veh=${a.id}`, "🧰", t("汽车房屋消耗品"), low ? t("{n} 项要补货", { n: low }) : mine.length ? t("{n} 种", { n: mine.length }) : t("还没有记录"), t("这辆车用的机油、雨刮、冰铲等"))}
      ${tile(`${href("house", "fix")}?asset=${a.id}`, "🩺", t("出了问题？"), nFix ? t("{n} 个常见小毛病", { n: nFix }) : "", t("先看常见小毛病，或让咩咩分析"))}
    </div>
    ${vehNotesHtml()}
  </section>`;
}
/** 本地须知（按地区）：原来在「房屋 / 车辆」列表页底部，现在放进每辆车概览页的最底部（折叠，不占版面） */
function vehNotesHtml() {
  const region = state.houseProfile?.region || (Units.region.system === "us" ? "na" : "cn"), notes = V().REGION_NOTES[region] || [];
  return notes.length ? `<section class="section"><details class="panel ref-panel veh-notes"><summary><b>${t("本地须知")}</b><small>${t("牌照、年检、保险等当地规定")}</small><span class="ui-chev" aria-hidden="true">›</span></summary>
    <ul class="tips ref-body">${notes.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details></section>` : "";
}
/** 车辆资料：每个分区一张卡（完成度 + 摘要 + 编辑），和房屋资料同一种样式 */
export function vehicleProfile(a, root) {
  const st = assetStatMap(a), base = href("asset", a.id);
  const cards = vehSections().map((s) => { const x = st[s.id]();
    return `<section class="panel prof-card" aria-labelledby="vp-${s.id}"><header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span>
      <div class="prof-t"><h3 id="vp-${s.id}">${t(s.name)}</h3></div>
      <a class="ui-btn prof-edit" data-size="sm" data-tone="ghost" href="${base}?sec=${s.id}" aria-label="${esc(t("编辑 {name}", { name: t(s.name) }))}">${t("编辑")}</a></header>
      ${x.pct != null ? `<span class="mprog"><i style="width:${x.pct}%"></i></span>` : ""}${vehicleFacts(a, s.id)}</section>`; }).join("");
  return `<section class="section menu-page">${assetCrumb(a, root, base, t("车辆资料"))}<p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("每一块各自编辑、各自保存")}</p><div class="prof-grid">${cards}</div></section>`;
}
/** 枢纽里的“交易”入口：进行中显示进度，否则按状态提示能走哪个流程 */
function vehDealRow(a) {
  const d = openVehicleDeal(a.id), K = window.DEALS.KINDS, st = vehStatus(a), v = a.vehicle || {};
  const hist = state.deals.filter((x) => x.asset_id === a.id && x.outcome).length;
  let desc, badge = "";
  if (d) { const tasks = dealTasks(d).filter((x) => !x.skipped), done = tasks.filter((x) => x.done).length, late = tasks.filter((x) => !x.done && x.overdue).length; desc = t("{kind}进行中 · 已完成 {a} / {b}", { kind: t(K[d.kind]), a: done, b: tasks.length }); badge = late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: late })}</span>` : `<span class="badge b-soon mcount">${done}/${tasks.length}</span>`; }
  else if (st === "looking") desc = t("选购中：开始买车流程，按步骤办产权、上牌、保险");
  else if (st === "leased") desc = t("租赁{d}：到期前走归还流程", { d: v.lease_end ? ` ${fmtDate(v.lease_end)} ${t("到期")}` : "" });
  else if (st === "sold" || st === "returned") desc = [t(V().STATUS[st].name), v.disposed_on ? fmtDate(v.disposed_on) : null, priceOrNull(v.sale_price) != null ? money(num(v.sale_price)) : null].filter(Boolean).join(" · ") + (hist ? ` · ${t("{n} 笔历史交易", { n: hist })}` : "");
  else desc = t("要卖车时从这里开始：估价、收款、拆车牌、已售通知") + (hist ? ` · ${t("{n} 笔历史交易", { n: hist })}` : "");
  return hubRow({ href: `${href("house", "deal")}?asset=${a.id}`, icon: "🤝", title: t("买卖 / 归还"), desc, badge });
}
function assetSummary(a) {
  const sb = SERVICE_BADGE[a.service], wb = WARRANTY_BADGE[a.warranty];
  const bits = [
    isVehicle(a) && vehStatusBadge(a),
    a.followUp && `<span class="badge b-out">${t("检查：{r}", { r: t(C().RESULTS[a.followUp.result]) })}</span>`,
    sb.label && (!isVehicle(a) || V().inService(a)) && `<span class="badge ${sb.cls}">${t(sb.label)}${a.next && a.service !== "unknown" ? t(" · 下次 {d}", { d: fmtDate(a.next) }) : ""}</span>`,
    wb.label && `<span class="badge ${wb.cls}">${t(wb.label)}${a.warranty_until ? ` · ${fmtDate(a.warranty_until)}` : ""}</span>`,
    a.ageYears != null && `<span class="badge" style="background:var(--surface-2)">${t("已用 {age}", { age: ageText(a) })}${num(a.expected_life_years) ? t(" / 约 {n} 年", { n: fmt(a.expected_life_years) }) : ""}</span>`,
    a.logs.length && `<span class="badge" style="background:var(--surface-2)">${t("{n} 条记录", { n: a.logs.length })}${a.totalCost ? t("，共花 {m}", { m: money(a.totalCost) }) : ""}</span>`,
  ].filter(Boolean).join("");
  return `<div class="asset-badges" style="margin-bottom:12px">${bits}</div>${stampText(a) ? `<p class="record-meta" style="margin:-6px 0 12px">${esc(stampText(a))}</p>` : ""}`;
}
export const maintFilterFor = (a) => { if (maintFilter.id !== a.id) Object.assign(maintFilter, { id: a.id, q: "", kind: "all", year: "all" }); return maintFilter; };
export const maintMatch = (l, f) => {
  if (f.kind !== "all" && l.kind !== f.kind) return false;
  if (f.year !== "all" && String(l.done_on || "").slice(0, 4) !== f.year) return false;
  const q = normName(f.q || ""); if (!q) return true;
  const item = l.service_item ? V().serviceItem(l.service_item)?.name || l.service_item : "";
  return normName([t(H().MAINT_KINDS[l.kind] || l.kind), item && t(item), l.vendor, l.notes, l.cost, l.done_on].filter((x) => x != null && x !== "").join(" ")).includes(q);
};
export const logsDesc = (a) => [...a.logs].sort((x, y) => String(y.done_on || "").localeCompare(String(x.done_on || "")) || String(y.created_at || "").localeCompare(String(x.created_at || "")));
