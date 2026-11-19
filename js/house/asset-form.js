/* 设备表单（整页；编辑时下方带保养记录）：类型、车辆字段、位置与数量、保养计划。 */
import { ASSET_SECTIONS, suppliesSection } from "./asset-supplies.js";
import { SECTIONS, go, href } from "../core/router.js";
import { assetAsk, assetBase, assetCrumb, careCard } from "./asset-list.js";
import { assetHub, vehSteps, vehicleOverview, vehicleProfile } from "./asset-hub.js";
import { assetName, isVehicle } from "./assets-logic.js";
import { autofillBar } from "../core/autofill.js";
import { crumbNav } from "../core/hub.js";
import { esc, fmt, fmtDate, num, todayISO } from "../core/util.js";
import { locationField, locationOptions } from "../core/locations.js";
import { maintSection } from "./asset-maint.js";
import { priceInput, pricesOk } from "../core/finance-access.js";
import { recallSection, replaceDefaults } from "./recall.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { H, OWNER_OPTS, V, distUnit, unitsOf, vehicleLoanNote } from "./asset-common.js";

/* ── 设备表单（整页；编辑时下方带保养记录） ── */
export function openAsset(id, { type } = {}) {
  go(`${href("asset", id || "new")}${type ? `?type=${encodeURIComponent(type)}` : ""}`);
}
/** 分区页（?sec= / ?log=1）：后退一步回枢纽；枢纽页：直接跳回进来之前的页面（不能 history.back，会掉回刚看过的分区） */
export function leaveAsset(changed) {
  if (changed) state.needsRefresh = true;
  state.skipAutosave = true;
  const q = state.route?.q, inSection = !!(q && (q.get("sec") || q.get("log") === "1"));
  if (inSection && state.prevRoute) history.back();
  else if (state.prevHash && state.prevRoute) go(state.prevHash);
  else go(state.route?.id && isVehicle(state.assets.find((x) => x.id === state.route.id)) ? href("house") : href("house", "assets"), { replace: true });
}
export function typeOptions(selected, kind) {
  const p = state.houseProfile;
  const list = (p ? H().forRegion(H().ASSET_TYPES, p.region) : H().ASSET_TYPES).filter((x) => !x.legacy || x.id === selected);   // 梯子、电钻等无保养的工具归“家居耐用品”，旧记录仍能显示
  const opt = (x) => `<option value="${x.id}" ${x.id === selected ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`;
  if (kind === "vehicle") return list.filter((x) => x.kind === "vehicle").map(opt).join("");   // 车辆只在动力类型里选
  const mine = list.filter((x) => x.kind === kind), others = list.filter((x) => x.kind !== kind && x.kind !== "vehicle");
  if (kind === "equipment") {   // 设备再分：一台一条的 / 小家电与季节电器 / 固定装置，和列表分组一致
    const grp = (label, xs) => (xs.length ? `<optgroup label="${esc(t(label))}">${xs.map(opt).join("")}</optgroup>` : "");
    return `${mine.filter((x) => !x.fixture && !x.portable).map(opt).join("")}${grp(H().PORTABLE_GROUP.name, mine.filter((x) => x.portable))}${grp(H().FIXTURE_GROUP.name, mine.filter((x) => x.fixture))}${grp("工具", others)}`;
  }
  return `${mine.map(opt).join("")}<optgroup label="${kind === "tool" ? t("设备") : t("工具")}">${others.map(opt).join("")}</optgroup>`;
}
/** 固定装置的「位置与数量」：每处一行（位置、数量、备注）；只在类型是固定装置时显示（form.is-fixture） */
function unitsFieldset(v, hide = () => "") {
  const rows = unitsOf(v).length ? unitsOf(v) : [{ loc: "", qty: 1, note: "" }];
  return `<fieldset class="fx-only" data-sec="units" ${hide("units")}>
      <legend>${t("位置与数量")}</legend>
      <p class="hint" style="margin-top:0">${t("一类一条：每处位置一行，写数量和备注（如“进水阀 2024 换过”）。坏了在保养记录里记，备注里写是哪一处。")}</p>
      <div id="unitRows">${rows.map(unitRow).join("")}</div>
      <button type="button" class="btn btn-sm btn-ghost" data-action="unit-add">＋ ${t("再加一处")}</button>
    </fieldset>`;
}
export const unitRow = (u = {}) => `<div class="unit-row">
    <select name="unit_loc" aria-label="${t("位置")}">${locationOptions(u.loc || "", { addNew: false })}</select>
    <input name="unit_qty" type="number" inputmode="numeric" min="0" max="999" step="1" value="${esc(u.qty ?? 1)}" aria-label="${t("数量")}">
    <input name="unit_note" maxlength="60" placeholder="${t("备注，如：进水阀 2024 换过")}" value="${esc(u.note || "")}" aria-label="${t("备注")}">
    <button type="button" class="btn btn-sm btn-ghost" data-action="unit-del" aria-label="${t("删除这一处")}">×</button></div>`;
export function readUnits(f) {
  const rows = [...f.querySelectorAll(".unit-row")].map((r) => ({ loc: r.querySelector("[name=unit_loc]")?.value || "", qty: Math.max(0, Math.round(num(r.querySelector("[name=unit_qty]")?.value, 1))), note: (r.querySelector("[name=unit_note]")?.value || "").trim().slice(0, 60) }))
    .filter((u) => u.loc || u.note || u.qty > 1);
  return rows.length ? rows : null;
}
/** 车辆专有区块：车牌、里程、证照到期、保险（与房屋保险同构） */
function vehicleFieldset(a, hide = () => "") {
  const v = a?.vehicle || {}, ins = v.insurance || {};
  const d = (x) => esc(x ?? "");
  return `<fieldset class="veh-only" data-sec="plate" ${hide("plate")}>
      <legend>${t("车牌与里程")}</legend>
      <div class="form-grid">
        <label>${t("车牌")}<input name="veh_plate" maxlength="12" value="${d(v.plate)}"></label>
        <label>${t("上牌州 / 省")}<input name="veh_plate_state" maxlength="12" placeholder="IL" value="${d(v.plate_state)}"></label>
        <label>${t("当前里程（{u}）", { u: distUnit() })}<input name="veh_odometer" type="number" inputmode="numeric" min="0" step="1" value="${d(v.odometer)}"></label>
        <label>${t("里程记录日期")}<input name="veh_odometer_on" type="date" max="${todayISO()}" value="${d(v.odometer_on || todayISO())}"></label>
        <label>${t("年均里程（{u}）", { u: distUnit() })}<input name="veh_annual_miles" type="number" inputmode="numeric" min="0" step="100" placeholder="12000" value="${d(v.annual_miles)}"><small>${t("用来把“按里程”的保养换算成日期")}</small></label>
      </div>
    </fieldset>
    <fieldset class="veh-only" data-sec="docs" ${hide("docs")}>
      <legend>${t("拥有状态与证照")}</legend>
      <div class="form-grid">
        <label>${t("拥有状态")}<select name="veh_status">${Object.entries(V().STATUS).map(([k, x]) => `<option value="${k}" ${k === V().statusOf(a) ? "selected" : ""}>${t(x.name)}</option>`).join("")}</select>
          <small>${t("已卖出 / 已归还的车从列表和提醒里退出，档案和保养记录保留在“历史车辆”")}</small></label>
        <label>${t("租赁到期（租车才填）")}<input name="veh_lease_end" type="date" value="${d(v.lease_end)}"><small>${t("到期前 90 天提醒，可从车辆交易里走归还流程")}</small></label>
        <label>${t("贷款结清日期（贷款中才填）")}<input name="veh_loan_end" type="date" value="${d(v.loan_end)}">${vehicleLoanNote(a)}</label>
        <label>${t("卖出 / 归还日期")}<input name="veh_disposed_on" type="date" value="${d(v.disposed_on)}"></label>
        ${priceInput(`<label>${t("卖出价（{cur}）", { cur: Units.region.currency })}<input name="veh_sale_price" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.sale_price)}"></label>`, "veh_sale_price", v.sale_price)}
        <label>${t("牌照年贴到期")}<input name="veh_registration_due" type="date" value="${d(v.registration_due)}"><small>${t("到期前 30 天提醒")}</small></label>
        <label>${t("排放检测到期")}<input name="veh_emissions_due" type="date" value="${d(v.emissions_due)}"><small>${t("纯电免检可留空")}</small></label>
      </div>
    </fieldset>
    <fieldset class="veh-only" data-sec="insurance" ${hide("insurance")}>
      <legend>${t("车险")}</legend>
      <div class="form-grid">
        <label>${t("保险公司")}<input name="veh_ins_provider" maxlength="60" value="${d(ins.provider)}"></label>
        <label>${t("保单号")}<input name="veh_ins_policy" maxlength="60" value="${d(ins.policy)}"><small>${t("几辆车同一张保单就填同一个号，提醒会合并")}</small></label>
        <label>${t("生效日")}<input name="veh_ins_from" type="date" value="${d(ins.from)}"></label>
        <label>${t("到期日")}<input name="veh_ins_to" type="date" value="${d(ins.to)}"><small>${t("到期前 30 天提醒续保")}</small></label>
        <label class="span-2">${t("保障范围")}<input name="veh_ins_coverage" maxlength="200" placeholder="${t("例如：责任 100/300/50、碰撞自付 $500、综合自付 $250")}" value="${d(ins.coverage)}"></label>
        <label>${t("代理 / 经纪人")}<input name="veh_ins_agent" maxlength="60" value="${d(ins.agent)}"></label>
        <label>${t("理赔电话")}<input name="veh_ins_phone" type="tel" maxlength="40" value="${d(ins.phone)}"></label>
        <label class="span-2">${t("理赔邮箱")}<input name="veh_ins_email" type="email" maxlength="120" value="${d(ins.email)}"></label>
      </div>
      <p class="hint">${t("账单里的“车险”负责缴费提醒，这里负责续保和保障范围。")}</p>
    </fieldset>`;
}
/** 车辆详情页顶部：保养项时间表 */
function vehicleSchedule(a) {
  const items = a.vItems || [];
  if (!items.length) return "";
  const base = href("asset", a.id);
  // “下次”的依据写清楚：没记过的按购车日期起算；按里程推算的注明现在约多少里程，免得误以为没更新
  const why = (s) => (s.fromPurchase ? t("还没记过这项，按购车 / 安装日期起算") : s.basis === "miles" ? t("按里程推算，现在约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }) : "");
  const cycle = (s) => [s.months ? t("{n} 个月", { n: s.months }) : "", s.miles ? `${fmt(s.miles)} ${distUnit()}` : ""].filter(Boolean).join(" / ") || "—";
  const row = (s) => {
    const cls = s.days == null ? "" : s.days < 0 ? "late" : s.days <= 30 ? "soon" : "";
    const badge = s.days == null ? "" : `<span class="badge ${cls === "late" ? "b-out" : cls === "soon" ? "b-soon" : "b-ok"}">${s.days < 0 ? t("逾期 {d} 天", { d: -s.days }) : t("{d} 天后", { d: s.days })}</span>`;
    const last = s.last ? `${fmtDate(s.last.done_on)}${s.last.odometer != null ? ` · ${fmt(s.last.odometer)} ${distUnit()}` : ""}` : "—";
    const next = s.next ? `<b>${fmtDate(s.next)}</b>${s.nextMiles != null ? ` · ${fmt(s.nextMiles)} ${distUnit()}` : ""}` : `<span class="muted">${t("记一次后开始算")}</span>`;
    return `<li class="sched-row ${cls}">
      <div class="sched-top"><div class="sched-name"><b>${esc(t(s.name))}</b>${s.note ? `<small>${esc(t(s.note))}</small>` : ""}</div>${badge}</div>
      <dl class="sched-meta"><div><dt>${t("周期")}</dt><dd>${cycle(s)}</dd></div><div><dt>${t("上次")}</dt><dd>${last}</dd></div><div><dt>${t("下次")}</dt><dd>${next}</dd></div></dl>
      ${why(s) ? `<small class="muted sched-why">${why(s)}</small>` : ""}
      <a class="btn btn-sm btn-ghost sched-log" href="${base}?log=1&item=${s.key}">${t("记一次")}</a>
    </li>`;
  };
  return `<div class="section-head"><p>${t("按月和按里程取先到的；里程按年均里程推算。记保养时要选对“保养项目”，那一项的下次日期才会更新")}</p></div>
    <div class="panel"><ul class="sched-list">${items.map(row).join("")}</ul></div>`;
}
/** 从家居耐用品升级时按名称猜类型（季节电器 / 小家电最常见）；猜不到用“其他设备” */
const PORTABLE_GUESS = [[/风扇|电扇|塔扇|\bfan\b/i, "portable_fan"], [/取暖|暖风|热风|电暖器|油汀|heater/i, "space_heater"], [/净化器|purifier/i, "air_purifier"], [/除湿|dehumid/i, "dehumidifier"], [/加湿|humidif/i, "room_humidifier"], [/空调|窗机|air condition|\bac\b/i, "portable_ac"]];
export const guessAssetType = (name) => PORTABLE_GUESS.find(([re]) => re.test(name || ""))?.[1] || null;
export function viewAssetForm() {
  const r = state.route;
  const a = r.id && r.id !== "new" ? state.assetsEnriched.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !a) {
    return `<div class="panel empty"><strong>${t("找不到这台设备")}</strong>${t("可能已被家人删除。")}<p><a class="btn btn-primary" href="${href("house", "assets")}">${t("回到设备档案")}</a></p></div>`;
  }
  const qType = r.q.get("type"), tplType = qType ? H().assetType(qType) : null;
  // 从家居耐用品物品升级：?from_item=<id> 带入名称、位置、备注
  const fromItem = !a && r.q.get("from_item") ? state.items.find((i) => i.id === r.q.get("from_item")) : null;
  const baseT = tplType || (fromItem ? H().assetType(guessAssetType(fromItem.name)) : null);
  // 召回换新：?replaces=<旧id> 带入名称、类型、位置、品牌；保存后旧机标成已更换
  const rep = !a && r.q.get("replaces") ? replaceDefaults(r.q.get("replaces")) : null;
  const v = a || rep?.v || {
    kind: baseT?.kind || "equipment", type: baseT?.id || (fromItem ? "other_equipment" : "water_heater"), name: fromItem ? fromItem.name : tplType ? t(tplType.name) : "", location: fromItem?.location || "",
    expected_life_years: baseT?.life ?? "", service_interval_months: baseT?.interval ?? "", owner: "self", notes: fromItem?.notes || "",
  };
  const tool = v.kind === "tool", veh = v.kind === "vehicle";
  // 面包屑根：进来之前的页面（注意事项 / 房屋…），没有就回设备档案或车辆列表
  const root = { href: state.prevRoute && state.prevHash ? state.prevHash : veh ? href("house") : href("house", "assets"), label: state.prevRoute ? t(SECTIONS[state.prevRoute.section]?.name || "上一页") : veh ? t("房屋") : t("设备档案") };
  const d = (x) => esc(x ?? "");
  const thisYear = new Date().getFullYear();
  const cur = Units.region.currency;
  const kindPill = (k) => `<label class="radio-pill"><input type="radio" name="kind" value="${k}" ${v.kind === k ? "checked" : ""}><span>${H().ASSET_KINDS[k].icon} ${t(H().ASSET_KINDS[k].name)}</span></label>`;
  // 已有记录：先看枢纽（各块完成度、保养记录、时间表、检查卡），点进去只改一块；新建仍是整页
  const sec = r.q.get("log") === "1" ? "log" : r.q.get("sec") || "";
  const hubHref = href("asset", a?.id || "new");
  if (a && !sec) return isVehicle(a) ? vehicleOverview(a, root) : assetHub(a, root);
  if (a && sec === "profile" && isVehicle(a)) return vehicleProfile(a, root);
  if (a && sec === "log") return `<section class="section${r.q.get("log") === "1" ? " form-page" : ""}">${assetCrumb(a, root, hubHref, t("保养记录"))}${maintSection(a, r.q.get("log") === "1")}</section>`;
  if (a && sec === "schedule") return `<section class="section">${assetCrumb(a, root, hubHref, t("保养时间表"))}${vehicleSchedule(a)}</section>`;
  if (a && sec === "supplies") return `<section class="section">${assetCrumb(a, root, hubHref, t("相关耗材"))}${suppliesSection(a)}</section>`;
  if (a && sec === "recall") return `<section class="section form-page">${assetCrumb(a, root, hubHref, t("产品召回"))}${recallSection(a)}</section>`;
  if (a && sec === "care") return `<section class="section">${assetCrumb(a, root, hubHref, t("检查卡"))}${careCard(a.type, { open: true, ask: assetAsk(a) })}</section>`;
  // 添加车辆向导：新建的第 1 步只显示「基本信息」（wiz=1，还没有这辆车）；建好后各步是 asset/<id>?sec=…&wiz=1
  const wizNew = !a && veh && r.q.get("wiz") === "1", wiz = wizNew || (!!a && veh && r.q.get("wiz") === "1" && !!sec);
  const steps = vehSteps(), curSec = wizNew ? "basic" : sec, stepIdx = steps.findIndex((s) => s.id === curSec);
  const prevSec = stepIdx > 0 ? steps[stepIdx - 1] : null, nextSec = steps[stepIdx + 1] || null;
  const stepHref = (s) => `${href("asset", a?.id || "new")}?sec=${s.id}&wiz=1`;
  const hide = (k) => (wizNew ? (k === "basic" ? "" : "hidden") : a && sec && sec !== k ? "hidden" : "");
  const wizBar = wiz ? `<div class="wiz-steps"><p class="wiz-now"><b>${t("第 {n} 步，共 {m} 步", { n: stepIdx + 1, m: steps.length })}</b> · ${esc(t(steps[stepIdx]?.name || ""))}</p>
    <ol class="wiz-dots" aria-hidden="true">${steps.map((s, i) => `<li class="${i < stepIdx ? "is-done" : i === stepIdx ? "is-now" : ""}"></li>`).join("")}</ol></div>` : "";
  return `
    <section class="section form-page">
      ${a ? assetCrumb(a, root, hubHref, t(ASSET_SECTIONS.find((s) => s.id === sec)?.name || "")) : crumbNav([...assetBase(null, veh), { label: veh ? t("添加车辆") : t("添加设备") }])}
      ${wizBar}
      ${a && sec === "notes" ? "" : autofillBar(veh ? "vehicle" : "asset", "#assetForm")}
      <form id="assetForm" ${wizNew ? `data-wiz-new="1"` : wiz ? `data-wiz="1" data-next="${esc(nextSec ? stepHref(nextSec) : hubHref)}"` : ""} class="panel ${tool ? "is-tool" : ""} ${veh ? "is-vehicle" : ""} ${H().isFixtureType(v.type) ? "is-fixture" : ""} ${(a && sec) || wizNew ? "one-sec" : ""}" novalidate ${wizNew ? "" : "data-autosave"}>
        <input type="hidden" name="asset_id" value="${d(a?.id)}">
        ${fromItem ? `<input type="hidden" name="from_item" value="${esc(fromItem.id)}"><p class="hint" style="margin-top:0">${t("由家居耐用品“{name}”升级：补上品牌、安装日期、保修和保养周期后保存。", { name: esc(fromItem.name) })}</p>
          <label class="check-inline" style="margin-bottom:10px"><input type="checkbox" name="drop_item"><span>${t("建好后从家居耐用品里移除这件物品")}</span></label>` : ""}
        ${rep ? `<input type="hidden" name="replaces" value="${esc(rep.from.id)}"><p class="hint" style="margin-top:0">🔁 ${t("替换被召回的“{name}”：填上新机的型号、序列号、购买日期和保修；保存后旧机标成“已更换”，不再提醒。", { name: esc(assetName(rep.from)) })}</p>` : ""}
        <fieldset data-sec="basic" ${hide("basic")}>
          <legend>${t("基本信息")}</legend>
          <div class="seg-radio" style="margin-bottom:10px" ${wizNew ? "hidden" : ""}>${kindPill("equipment")}${kindPill("tool")}${kindPill("vehicle")}</div>
          <div class="form-grid">
            <label><span class="veh-hide">${t("类型")}</span><span class="veh-show">${t("动力类型")}</span>
              <select name="type" required>${typeOptions(v.type, v.kind)}</select>
            </label>
            <label>${t("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${veh ? t("例如：白色 RAV4") : t("例如：Carrier 暖风炉")}" value="${d(v.name)}">
            </label>
            ${locationField(v.location, t("位置"))}
            <label>${t("品牌")}
              <input name="brand" maxlength="40" value="${d(v.brand)}">
            </label>
            <label>${t("型号")}
              <input name="model" maxlength="60" value="${d(v.model)}">
            </label>
            <label><span class="veh-hide">${t("序列号")}</span><span class="veh-show">VIN</span>
              <input name="serial" maxlength="60" value="${d(v.serial)}">
            </label>
          </div>
        </fieldset>
        ${veh ? vehicleFieldset(a, hide) : ""}
        ${veh ? "" : unitsFieldset(v, hide)}
        <fieldset data-sec="years" ${hide("years")}>
          <legend><span class="veh-hide">${t("年份与保修")}</span><span class="veh-show">${t("年款与保修")}</span></legend>
          <div class="form-grid">
            <label><span class="veh-hide">${t("安装 / 购买日期")}</span><span class="veh-show">${t("购车日期")}</span>
              <input name="installed_on" type="date" value="${d(v.installed_on)}">
              <small class="veh-hide">${t("用来算房龄和首次保养日期")}</small><small class="veh-show">${t("没有保养记录时，按它算第一次保养")}</small>
            </label>
            <label><span class="veh-hide">${t("出厂年份（可选）")}</span><span class="veh-show">${t("年款")}</span>
              <input name="manufacture_year" type="number" inputmode="numeric" min="1950" max="${thisYear + 1}" placeholder="${veh ? "2022" : t("铭牌上通常有")}" value="${d(v.manufacture_year)}">
            </label>
            <label><span class="veh-hide">${t("整机保修到")}</span><span class="veh-show">${t("整车保修到")}</span>
              <input name="warranty_until" type="date" value="${d(v.warranty_until)}">
            </label>
            <label class="eq-only"><span class="veh-hide">${t("人工保修到（可选）")}</span><span class="veh-show">${t("动力总成 / 高压电池保修到")}</span>
              <input name="labor_warranty_until" type="date" value="${d(v.labor_warranty_until)}">
              <small class="veh-hide">${t("安装商的人工保修通常比厂家短")}</small><small class="veh-show">${t("电车高压电池通常 8 年 / 10 万英里")}</small>
            </label>
          </div>
        </fieldset>
        <fieldset class="veh-hide" data-sec="life" ${hide("life")}>
          <legend>${t("寿命与保养周期")}</legend>
          <div class="form-grid">
            <label>${t("预期寿命（年）")}
              <input name="expected_life_years" type="number" inputmode="decimal" min="0" max="100" step="0.5" placeholder="${t("常见经验值")}" value="${d(v.expected_life_years)}">
            </label>
            <label>${t("保养间隔（月）")}
              <input name="service_interval_months" type="number" inputmode="numeric" min="1" max="120" step="1" placeholder="${t("留空则不提醒")}" value="${d(v.service_interval_months)}">
              <small>${t("记一次检查或保养后，按这个间隔算下次")}</small>
            </label>
          </div>
        </fieldset>
        <fieldset data-sec="cost" ${hide("cost")}>
          <legend><span class="veh-hide">${t("费用与负责方")}</span><span class="veh-show">${t("购车价格")}</span></legend>
          <div class="form-grid">
            ${priceInput(`<label>${t("购买价格（{cur}）", { cur })}
              <input name="purchase_price" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.purchase_price)}">
            </label>`, "purchase_price", v.purchase_price)}
            <label class="eq-only" ${pricesOk() ? "" : 'style="display:none" aria-hidden="true"'}><!-- 没财务权限：更换估价藏起来，值仍随表单原样保存 -->${t("更换估价（{cur}）", { cur })}
              <input name="replacement_cost_estimate" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${t("第三期“修还是换”会用到")}" value="${d(v.replacement_cost_estimate)}">
            </label>
            <label class="eq-only">${t("谁负责维护")}
              <select name="owner">${OWNER_OPTS.map((k) => `<option value="${k}" ${v.owner === k ? "selected" : ""}>${t(H().OWNERS[k].name)}</option>`).join("")}</select>
            </label>
          </div>
        </fieldset>
        <fieldset data-sec="notes" ${hide("notes")}>
          <legend>${t("备注")}</legend>
          <label class="sr-only" for="assetNotes">${t("备注")}</label>
          <textarea id="assetNotes" name="notes" rows="3" maxlength="500" placeholder="${t("滤网尺寸、维修商电话、借给了谁…")}">${d(v.notes)}</textarea>
        </fieldset>
        <p id="assetFormError" class="form-error" role="alert"></p>
        ${wiz ? `<div class="sticky-actions wiz-bar">
          <div class="form-actions wiz-row">
            ${prevSec && !wizNew ? `<a class="btn btn-ghost" href="${stepHref(prevSec)}">‹ ${t("上一步")}</a>` : ""}
            ${nextSec && !wizNew ? `<a class="btn btn-ghost" href="${stepHref(nextSec)}">${t("跳过")}</a>` : ""}
            ${wizNew ? `<button type="button" class="btn btn-ghost" data-action="asset-cancel">${t("取消")}</button>` : ""}
            <button type="submit" class="btn btn-primary">${wizNew ? t("下一步") : nextSec ? t("保存并下一步") : t("完成")}</button>
          </div>
          ${wizNew ? "" : `<div class="form-actions wiz-exit"><a class="btn btn-ghost" href="${hubHref}" title="${esc(t("保存这一步填的内容，其余各步以后再补，回概览"))}">${t("全部跳过，稍后再填")}</a></div>`}
        </div>` : `<div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${a ? t("保存修改") : veh ? t("添加车辆") : t("添加设备")}</button>
          <button type="button" class="btn btn-ghost" data-action="asset-cancel">${t("取消")}</button>
        </div>`}
      </form>
      ${a ? "" : `<p class="muted" style="margin-top:12px;font-size:13px">${veh ? t("保存后可以在这辆车下记录每次保养、维修，按项目算下次到期。") : t("保存后可以在这台设备下记录每次检查、保养和维修。")}</p>`}
    </section>`;
}
