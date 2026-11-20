/* 车辆页：家庭的所有车（不分房产），每辆的保养到期、证照与保险。 */
import { ageText, assetAsk } from "./asset-list.js";
import { askButton, askPanel } from "../core/ask.js";
import { assetName } from "./assets-logic.js";
import { dealHref, dealTasks, openVehicleDeal } from "./deals.js";
import { esc, fmt, fmtDate, fmtShort, money, num, stampText } from "../core/util.js";
import { href } from "../core/router.js";
import { moreMenu } from "../core/more-menu.js";
import { priceOrNull } from "../core/finance-access.js";
import { recallBadge } from "./recall.js";
import { t } from "../core/i18n.js";
import { C, H, SERVICE_BADGE, V, WARRANTY_BADGE, distUnit, isFixture, unitsText, vehStatus, vehStatusBadge } from "./asset-common.js";
import { lpAttr } from "../core/long-press.js";

/* ── 车辆页：家庭的所有车（不分房产），每辆的保养到期、证照与保险 ── */
/** 已卖出 / 已归还的车：一行一辆，点开还能看档案、保养记录和当时的交易清单 */
export function pastVehiclesSection(past) {
  if (!past.length) return "";
  return `<section class="section"><details class="panel ref-panel"><summary><b>${t("历史车辆")}</b><small>${t("{n} 辆，已卖出或已归还；档案和保养记录保留", { n: past.length })}</small><span class="mch" aria-hidden="true">›</span></summary>
    <ul class="restock-list hist-list ref-body">${past.map((a) => { const v = a.vehicle || {}; return `<li>
      <span class="asset-ico" aria-hidden="true">${V().POWERTRAINS[a.type]?.icon || "🚗"}</span>
      <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a>
        <small>${[t(V().STATUS[vehStatus(a)].name), v.disposed_on ? fmtDate(v.disposed_on) : null, priceOrNull(v.sale_price) != null ? money(num(v.sale_price)) : null,
          a.installed_on ? t("{d} 购入", { d: fmtDate(a.installed_on) }) : null, a.logs.length ? t("{n} 条保养记录", { n: a.logs.length }) : null, a.totalCost ? t("共花 {m}", { m: money(a.totalCost) }) : null].filter(Boolean).map(esc).join(" · ")}</small></div>
      <span class="hist-act"><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}">${t("详情")}</a></span></li>`; }).join("")}</ul></details></section>`;
}
function vehicleCard(a) {
  const v = a.vehicle || {}, pt = V().POWERTRAINS[a.type];
  const sb = SERVICE_BADGE[a.service];
  const D = a.vDocs || {};
  const docBadge = (label, d) => (!d ? "" : `<span class="badge ${d.days < 0 ? "b-out" : d.days <= 30 ? "b-soon" : "b-ok"}">${label} ${d.days < 0 ? t("已过期") : fmtDate(d.date)}</span>`);
  const upcoming = (a.vItems || []).filter((s) => s.days != null).slice(0, 3);
  const meta = [
    [a.manufacture_year, a.brand, a.model].filter(Boolean).join(" "),
    v.plate && `🪪 ${v.plate}${v.plate_state ? ` (${v.plate_state})` : ""}`,
    a.nowMiles != null && t("约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }),
  ].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");
  return `<article class="asset-card">
    <div class="asset-head"><span class="asset-ico" aria-hidden="true">${pt?.icon || "🚗"}</span>
      <div class="grow"><a class="asset-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a><div class="item-meta">${meta}<span class="badge" style="background:var(--surface-2)">${t(pt?.name || "")}</span></div></div>
      ${moreMenu([{ label: t("记保养"), href: `${href("asset", a.id)}?log=1`, first: true }, { label: t("详情"), href: href("asset", a.id) }])}</div>
    <div class="asset-badges">
      ${vehStatus(a) === "owned" ? "" : vehStatusBadge(a)}
      ${a.followUp ? `<span class="badge b-out">${t(C().RESULTS[a.followUp.result])}</span>` : ""}
      ${sb.label && V().inService(a) ? `<span class="badge ${sb.cls}">${t(sb.label)}</span>` : ""}
      ${docBadge(t("牌照"), D.registration)}${docBadge(t("排放"), D.emissions)}${docBadge(t("保险"), D.insurance)}${docBadge(t("租赁"), D.lease)}
    </div>
    ${vehDealLine(a)}
    ${vehStatus(a) === "looking" ? `<small class="muted">${t("选购中：提车后把名称、车牌、里程补上。")}</small>`
      : upcoming.length ? `<ul class="veh-due">${upcoming.map((s) => `<li class="${s.days < 0 ? "late" : s.days <= 30 ? "soon" : ""}"><span class="vd-name">${esc(t(s.name))}</span><small>${fmtDate(s.next)}${s.nextMiles != null ? ` · ${fmt(s.nextMiles)} ${distUnit()}` : ""}</small>${askButton(assetAsk(a, t(s.name)))}${askPanel(assetAsk(a, t(s.name)))}</li>`).join("")}</ul>`
      : `<small class="muted">${t("填购车日期或记第一次保养后，这里会列出下一步该做的保养。")}</small>`}
  </article>`;
}
/** 卡片 / 枢纽里的一行：进行中的交易进度 */
function vehDealLine(a) {
  const d = openVehicleDeal(a.id); if (!d) return "";
  const tasks = dealTasks(d).filter((x) => !x.skipped), done = tasks.filter((x) => x.done).length, late = tasks.filter((x) => !x.done && x.overdue).length;
  return `<a class="meta-tag b-soon" href="${dealHref(d)}"><small>${t(window.DEALS.KINDS[d.kind])}</small>${t("进行中 {a} / {b}", { a: done, b: tasks.length })}${late ? ` · <b class="lag-late">${t("逾期 {n}", { n: late })}</b>` : ""}</a>`;
}
export function assetCard(a) {
  const sb = SERVICE_BADGE[a.service], wb = WARRANTY_BADGE[a.warranty];
  const o = a.owner ? H().OWNERS[a.owner] : null;
  const life = num(a.expected_life_years);
  const pct = a.lifePct != null ? Math.min(100, Math.round(a.lifePct * 100)) : null;
  const lifeCls = pct == null ? "" : pct >= 100 ? "over" : pct >= 75 ? "late" : "";
  const fx = isFixture(a), ut = fx ? unitsText(a) : "";
  const meta = [
    [a.brand, a.model].filter(Boolean).join(" "),
    ut ? `📍${ut}` : a.location && `📍${t(a.location)}`,
    o && t("负责：{who}", { who: t(o.name) }),
  ].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")
    + ((a.updated_at || a.created_at) ? `<span title="${esc(stampText(a))}">${t("{d} 更新", { d: fmtShort(a.updated_at || a.created_at) })}</span>` : "");
  const act = a.recallSt ? { href: `${href("asset", a.id)}?sec=recall`, label: t("处理召回") } : { href: `${href("asset", a.id)}?log=1`, label: t("记保养") };
  // 整张卡都能点（进编辑 / 详情）；右边居中是「记保养」；手机上 ← 左滑记保养 · 右滑删除设备 →
  return `<article class="asset-card asset-row-card ${a.recallSt === "stop_use" ? "is-recall-stop" : a.recallSt ? "is-recall" : ""}" data-swipe-del="asset" ${lpAttr([{ label: act.label, href: act.href, first: true }, { label: t("详情 / 编辑"), href: href("asset", a.id) }, { label: t("删除"), action: "asset-row-del", data: { id: a.id }, danger: true }], assetName(a))} data-swipe-left-label="${esc(act.label)}" data-swipe-left-go="${esc(a.recallSt ? t("松手处理召回") : t("松手记保养"))}" data-swipe-alt="asset" data-swipe-alt-label="${esc(t("删除设备"))}" data-swipe-alt-go="${esc(t("松手删除"))}">
    <a class="asset-hit" href="${href("asset", a.id)}" aria-label="${esc(t("编辑 {name}", { name: assetName(a) }))}"></a>
    <div class="asset-main">
      <div class="asset-head"><span class="asset-ico" aria-hidden="true">${a.t?.icon || "⚙️"}</span>
        <div class="grow"><span class="asset-name">${esc(assetName(a))}</span>
          <div class="item-meta">${meta || `<span>${esc(a.t ? t(a.t.name) : "")}</span>`}</div></div></div>
      <div class="asset-badges">
        ${recallBadge(a)}
        ${a.followUp ? `<span class="badge b-out">${t("检查：{r}", { r: t(C().RESULTS[a.followUp.result]) })}</span>` : ""}
        ${sb.label ? `<span class="badge ${sb.cls}">${t(sb.label)}${a.next && a.service !== "unknown" ? ` · ${fmtDate(a.next)}` : ""}</span>` : ""}
        ${wb.label ? `<span class="badge ${wb.cls}">${t(wb.label)}</span>` : ""}
      </div>
      ${a.ageYears != null || life ? `<div class="life"><div class="life-bar ${lifeCls}"><i style="width:${pct ?? 0}%"></i></div>
        <small>${a.ageYears != null ? t("已用 {age}", { age: ageText(a) }) : t("安装日期未填")}${life ? t(" · 常见寿命约 {n} 年", { n: fmt(life) }) : ""}${pct != null && pct >= 75 ? t("，已到 {p}%", { p: pct }) : ""}</small></div>` : ""}
    </div>
    <div class="asset-side"><a class="btn btn-sm${a.recallSt ? " btn-primary" : ""}" href="${act.href}">${act.label}</a></div>
    <a class="swipe-src" href="${act.href}" tabindex="-1" aria-hidden="true">${act.label}</a>
    <button type="button" class="swipe-alt-src" data-action="asset-row-del" data-id="${a.id}" tabindex="-1" aria-hidden="true">${t("删除设备")}</button>
  </article>`;
}
