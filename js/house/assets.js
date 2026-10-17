/* 房屋维护 · 第二期：设备档案与保养记录
 * - 设备档案：按房屋资料一键生成，或手动添加；记录品牌型号、安装年份、保修、寿命、保养周期、负责方
 * - 保养记录：挂在设备下；记一次后自动算下次保养日期；有费用的同时写入 purchases（分类 house_maint，统计并入“房屋维护”）
 * - 页面：#/house/assets 列表、#/house/asset-template 生成、#/asset/new 与 #/asset/<id> 整页表单（编辑页下方带保养记录） */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, DAY, addMonths, daysUntil, esc, fmt, fmtDate, fmtShort, money, num, stampText, todayISO, toast } from "../core/util.js";
import { go, href } from "../core/router.js";
import { compare, joinList, t } from "../core/i18n.js";
import { propertyBar } from "../bills/views.js";

const H = () => window.HOUSE;
const OWNER_OPTS = ["self", "hoa", "landlord", "property", "varies"];
export const SERVICE_BADGE = {
  overdue: { cls: "b-out",  label: "保养逾期" },
  due:     { cls: "b-soon", label: "该保养了" },
  ok:      { cls: "b-ok",   label: "保养正常" },
  unknown: { cls: "b-low",  label: "未记录保养" },
  none:    { cls: "",       label: "" },
};
export const WARRANTY_BADGE = {
  expiring: { cls: "b-soon", label: "保修快到期" },
  expired:  { cls: "",       label: "已过保" },
  active:   { cls: "b-ok",   label: "保修中" },
  none:     { cls: "",       label: "" },
};

/* ── 计算：房龄、寿命占比、下次保养、保修 ── */
export function enrichAssets(assets, logs) {
  const today = new Date(`${todayISO()}T12:00:00`).getTime();
  return assets.map((a) => {
    const at = H().assetType(a.type);
    const mine = logs.filter((l) => l.asset_id === a.id).sort((x, y) => (y.done_on || "").localeCompare(x.done_on || ""));
    // 检查 / 保养 / 更换都算“做过保养”；维修不重置周期
    const lastService = mine.find((l) => l.kind !== "repair")?.done_on || null;
    const interval = num(a.service_interval_months);
    const base = lastService || a.installed_on || null;
    const next = interval > 0 && base ? addMonths(base, interval) : null;
    const dueDays = next ? daysUntil(next) : null;
    const service = !(interval > 0) ? "none" : !base ? "unknown" : dueDays < 0 ? "overdue" : dueDays <= 30 ? "due" : "ok";
    const start = a.installed_on || (a.manufacture_year ? `${a.manufacture_year}-07-01` : null);
    const ageYears = start ? Math.max(0, (today - new Date(`${start}T12:00:00`).getTime()) / (365.25 * DAY)) : null;
    const life = num(a.expected_life_years);
    const lifePct = ageYears != null && life > 0 ? ageYears / life : null;
    const wList = [a.warranty_until, a.labor_warranty_until].filter(Boolean).map(daysUntil);
    const wDays = wList.length ? Math.max(...wList) : null;   // 任一保修仍有效就算保修中
    const warranty = wDays == null ? "none" : wDays < 0 ? "expired" : wDays <= 30 ? "expiring" : "active";
    const totalCost = mine.reduce((s, l) => s + (l.currency && l.currency !== Units.region.currency ? 0 : num(l.cost)), 0);
    return { ...a, t: at, logs: mine, lastService, next, dueDays, service, ageYears, lifePct, wDays, warranty, totalCost };
  });
}

/** 当前房产的设备 */
export const myAssets = () => state.assetsEnriched.filter((a) => a.property_id === state.propertyId);
/** 概览用：逾期 > 该保养 > 保修快到期 */
export const assetAlerts = (list) => list
  .filter((a) => a.service === "overdue" || a.service === "due" || a.warranty === "expiring")
  .sort((x, y) => rank(x) - rank(y) || (x.dueDays ?? 999) - (y.dueDays ?? 999));
const rank = (a) => (a.service === "overdue" ? 0 : a.service === "due" ? 1 : 2);

/** 提醒总线：所有活跃房产的设备（保养逾期 = 今天级，到期 / 保修 = 尽快级） */
export function assetAlertItems() {
  if (!state.houseEnabled) return [];
  const live = new Set(state.properties.filter((p) => !p.archived && !["sold", "moved_out"].includes(p.status)).map((p) => p.id));
  return assetAlerts(state.assetsEnriched.filter((a) => live.has(a.property_id))).map((a) => ({
    source: "asset", severity: a.service === "overdue" ? 1 : 2, must: false, due: a.next, daysLeft: a.service === "overdue" || a.service === "due" ? a.dueDays : a.wDays,
    property_id: a.property_id, title: `${a.t?.icon || "⚙️"} ${a.name}`, detail: alertText(a), href: href("asset", a.id),
    badge: { label: a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修"), cls: a.service === "overdue" ? "b-out" : "b-soon" },
    actions: [{ type: "link", href: `${href("asset", a.id)}?log=1`, label: t("记保养") }],
  }));
}

export function alertText(a) {
  if (a.service === "overdue") return t("保养逾期 {d} 天（上次 {last}）", { d: -a.dueDays, last: a.lastService ? fmtDate(a.lastService) : t("按安装日期算") });
  if (a.service === "due") return a.dueDays === 0 ? t("今天该保养了") : t("{d} 天后该保养", { d: a.dueDays });
  if (a.warranty === "expiring") return a.wDays === 0 ? t("保修今天到期") : t("保修 {d} 天后到期", { d: a.wDays });
  return "";
}

const ageText = (a) => (a.ageYears < 1 ? t("不到 1 年") : t("{n} 年", { n: Math.floor(a.ageYears) }));

/* ── 设备列表 ── */
export function viewAssets() {
  const list = myAssets();
  const p = state.houseProfile;
  const alerts = assetAlerts(list);
  const group = (kind) => list.filter((a) => a.kind === kind).sort((x, y) => rank(x) - rank(y) || compare(x.name, y.name));
  const section = (kind) => {
    const rows = group(kind);
    if (!rows.length) return "";
    const k = H().ASSET_KINDS[kind];
    return `<section class="section"><div class="section-head"><h2>${k.icon} ${t(k.name)}<span class="muted">（${rows.length}）</span></h2></div>
      <div class="asset-grid">${rows.map(assetCard).join("")}</div></section>`;
  };
  return `
    ${propertyBar()}
    <section class="section">
      <div class="section-head"><h2>${t("设备档案")}</h2>
        <div class="head-acts">${p ? `<a class="btn btn-sm btn-ghost" href="${href("house", "asset-template")}">${t("按房屋资料生成")}</a>` : ""}
          <a class="btn btn-primary" href="${href("asset", "new")}">${t("添加设备")}</a></div></div>
      ${alerts.length ? `<div class="panel"><ul class="restock-list">${alerts.slice(0, 6).map((a) => `<li>
          <span class="badge ${a.service === "overdue" ? "b-out" : "b-soon"}">${a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修")}</span>
          <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${esc(a.name)}</a><small>${esc(alertText(a))}</small></div>
          <a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a></li>`).join("")}</ul></div>`
        : list.length ? `<p class="muted" style="margin:0;font-size:13px">${t("保养都在周期内，保修也没有快到期的。")}</p>` : ""}
    </section>
    ${list.length ? section("equipment") + section("tool") : `<section class="section"><div class="panel empty"><strong>${t("还没有设备档案")}</strong>
      ${p ? t("按房屋资料一次生成炉子、热水器、排水泵、屋顶等设备，再补充品牌、型号和安装年份。") : t("先填写房屋资料，就能按设施一键生成设备清单。")}
      <p>${p ? `<a class="btn btn-primary" href="${href("house", "asset-template")}">${t("生成设备清单")}</a>` : `<a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a>`}
         <a class="btn btn-ghost" href="${href("asset", "new")}">${t("手动添加一台")}</a></p></div></section>`}`;
}

export function assetCard(a) {
  const sb = SERVICE_BADGE[a.service], wb = WARRANTY_BADGE[a.warranty];
  const o = a.owner ? H().OWNERS[a.owner] : null;
  const life = num(a.expected_life_years);
  const pct = a.lifePct != null ? Math.min(100, Math.round(a.lifePct * 100)) : null;
  const lifeCls = pct == null ? "" : pct >= 100 ? "over" : pct >= 75 ? "late" : "";
  const meta = [
    [a.brand, a.model].filter(Boolean).join(" "),
    a.location && `📍${t(a.location)}`,
    o && t("负责：{who}", { who: t(o.name) }),
  ].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")
    + ((a.updated_at || a.created_at) ? `<span title="${esc(stampText(a))}">${t("{d} 更新", { d: fmtShort(a.updated_at || a.created_at) })}</span>` : "");
  return `<article class="asset-card">
    <div class="asset-head"><span class="asset-ico" aria-hidden="true">${a.t?.icon || "⚙️"}</span>
      <div class="grow"><a class="asset-name" href="${href("asset", a.id)}">${esc(a.name)}</a>
        <div class="item-meta">${meta || `<span>${esc(a.t ? t(a.t.name) : "")}</span>`}</div></div></div>
    <div class="asset-badges">
      ${sb.label ? `<span class="badge ${sb.cls}">${t(sb.label)}${a.next && a.service !== "unknown" ? ` · ${fmtDate(a.next)}` : ""}</span>` : ""}
      ${wb.label ? `<span class="badge ${wb.cls}">${t(wb.label)}</span>` : ""}
    </div>
    ${a.ageYears != null || life ? `<div class="life"><div class="life-bar ${lifeCls}"><i style="width:${pct ?? 0}%"></i></div>
      <small>${a.ageYears != null ? t("已用 {age}", { age: ageText(a) }) : t("安装日期未填")}${life ? t(" · 常见寿命约 {n} 年", { n: fmt(life) }) : ""}${pct != null && pct >= 75 ? t("，已到 {p}%", { p: pct }) : ""}</small></div>` : ""}
    <div class="acts"><a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}">${t("详情")}</a></div>
  </article>`;
}

/* ── 按房屋资料生成设备 ── */
export function viewAssetTemplate() {
  const p = state.houseProfile;
  if (!p) return `<div class="panel empty"><strong>${t("先填写房屋资料")}</strong>${t("设备清单会根据房型和设施生成。")}<p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></p></div>`;
  const recs = H().recommendAssets(p);
  const haveTypes = new Set(state.assets.filter((a) => a.property_id === state.propertyId).map((a) => a.type));
  const groups = Object.entries(H().ASSET_KINDS).map(([kind, k]) => ({ kind, k, rows: recs.filter((r) => r.kind === kind) })).filter((g) => g.rows.length);
  const fresh = recs.filter((r) => !haveTypes.has(r.id)).length;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("按房屋资料生成设备")}</h2><p>${t("共 {n} 项", { n: recs.length })}${fresh < recs.length ? t("，其中 {n} 项已有档案", { n: recs.length - fresh }) : ""}</p></div>
      <form id="assetTemplateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${t("生成后再到每台设备里补品牌、型号、安装年份和保修；寿命和周期是常见经验值，可改。")}</span>
        </div>
        ${groups.map(({ k, rows }) => `<fieldset class="tpl-group" style="--cat:#5c6b63">
          <legend>${k.icon} ${t(k.name)}</legend>
          ${rows.map((r) => {
            const exists = haveTypes.has(r.id);
            const o = H().OWNERS[r.owner];
            return `<label class="tpl-row ${exists ? "is-have" : ""}">
              <input type="checkbox" name="tpl" value="${esc(r.id)}" ${exists ? "disabled" : r.optional ? "" : "checked"}>
              <span class="grow"><b>${r.icon} ${esc(t(r.name))}</b><small>${r.life ? t("常见寿命约 {n} 年", { n: r.life }) : t("寿命不固定")}${r.interval ? t("，建议每 {n} 个月保养", { n: r.interval }) : ""}${o ? t("，通常由{who}负责", { who: t(o.name) }) : ""}</small>
                ${r.tip ? `<small class="note">${esc(t(r.tip))}</small>` : ""}</span>
              ${exists ? `<span class="badge b-ok">${t("已有")}</span>` : ""}
            </label>`;
          }).join("")}
        </fieldset>`).join("")}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary" ${fresh ? "" : "disabled"}>${t("生成选中的设备")}</button>
          <a class="btn btn-ghost" href="${href("house", "assets")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}

/** 勾选的模板 → 设备行（名称和备注按当前语言写入） */
export function assetTemplateItems(ids) {
  return H().recommendAssets(state.houseProfile).filter((r) => ids.includes(r.id)).map((r) => ({
    kind: r.kind, type: r.id, name: t(r.name), location: null, brand: null, model: null, serial: null,
    installed_on: null, manufacture_year: null, warranty_until: null, labor_warranty_until: null,
    expected_life_years: r.life, service_interval_months: r.interval, purchase_price: null, replacement_cost_estimate: null,
    owner: r.kind === "equipment" ? r.owner : null, notes: r.tip ? t(r.tip) : null,
  }));
}

/* ── 设备表单（整页；编辑时下方带保养记录） ── */
export function openAsset(id, { type } = {}) {
  go(`${href("asset", id || "new")}${type ? `?type=${encodeURIComponent(type)}` : ""}`);
}

export function leaveAsset(changed) {
  if (changed) state.needsRefresh = true;
  if (state.prevRoute) history.back();
  else go(href("house", "assets"), { replace: true });
}

function typeOptions(selected, kind) {
  const p = state.houseProfile;
  const list = p ? H().forRegion(H().ASSET_TYPES, p.region) : H().ASSET_TYPES;
  const opt = (x) => `<option value="${x.id}" ${x.id === selected ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`;
  const mine = list.filter((x) => x.kind === kind), others = list.filter((x) => x.kind !== kind);
  return `${mine.map(opt).join("")}<optgroup label="${kind === "tool" ? t("设备") : t("工具")}">${others.map(opt).join("")}</optgroup>`;
}

export function viewAssetForm() {
  const r = state.route;
  const a = r.id && r.id !== "new" ? state.assetsEnriched.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !a) {
    return `<div class="panel empty"><strong>${t("找不到这台设备")}</strong>${t("可能已被家人删除。")}<p><a class="btn btn-primary" href="${href("house", "assets")}">${t("回到设备档案")}</a></p></div>`;
  }
  const qType = r.q.get("type"), tplType = qType ? H().assetType(qType) : null;
  const v = a || {
    kind: tplType?.kind || "equipment", type: tplType?.id || "water_heater", name: tplType ? t(tplType.name) : "", location: "",
    expected_life_years: tplType?.life ?? "", service_interval_months: tplType?.interval ?? "", owner: "self",
  };
  const tool = v.kind === "tool";
  const backLabel = state.prevRoute ? t({ today: "今日", house: "房屋", me: "我的" }[state.prevRoute.section] || "上一页") : t("设备档案");
  const d = (x) => esc(x ?? "");
  const thisYear = new Date().getFullYear();
  const cur = Units.region.currency;
  const kindPill = (k) => `<label class="radio-pill"><input type="radio" name="kind" value="${k}" ${v.kind === k ? "checked" : ""}><span>${H().ASSET_KINDS[k].icon} ${t(H().ASSET_KINDS[k].name)}</span></label>`;
  return `
    <section class="section form-page">
      <div class="section-head">
        <h2>${a ? `${a.t?.icon || "⚙️"} ${esc(a.name)}` : t("添加设备")}</h2>
        <button type="button" class="btn btn-sm btn-ghost" data-action="asset-cancel">${t("返回{page}", { page: backLabel })}</button>
      </div>
      ${a ? assetSummary(a) : ""}
      <form id="assetForm" class="panel ${tool ? "is-tool" : ""}" novalidate>
        <input type="hidden" name="asset_id" value="${d(a?.id)}">
        <fieldset>
          <legend>${t("基本信息")}</legend>
          <div class="seg-radio" style="margin-bottom:10px">${kindPill("equipment")}${kindPill("tool")}</div>
          <div class="form-grid">
            <label>${t("类型")}
              <select name="type" required>${typeOptions(v.type, v.kind)}</select>
            </label>
            <label>${t("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${t("例如：Carrier 暖风炉")}" value="${d(v.name)}">
            </label>
            <label>${t("位置")}
              <select name="location"><option value="">${t("未指定")}</option>${LOCATIONS.map((l) => `<option value="${esc(l)}" ${l === v.location ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select>
            </label>
            <label>${t("品牌")}
              <input name="brand" maxlength="40" value="${d(v.brand)}">
            </label>
            <label>${t("型号")}
              <input name="model" maxlength="60" value="${d(v.model)}">
            </label>
            <label>${t("序列号")}
              <input name="serial" maxlength="60" value="${d(v.serial)}">
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>${t("年份与保修")}</legend>
          <div class="form-grid">
            <label>${t("安装 / 购买日期")}
              <input name="installed_on" type="date" value="${d(v.installed_on)}">
              <small>${t("用来算房龄和首次保养日期")}</small>
            </label>
            <label>${t("出厂年份（可选）")}
              <input name="manufacture_year" type="number" inputmode="numeric" min="1950" max="${thisYear}" placeholder="${t("铭牌上通常有")}" value="${d(v.manufacture_year)}">
            </label>
            <label>${t("整机保修到")}
              <input name="warranty_until" type="date" value="${d(v.warranty_until)}">
            </label>
            <label class="eq-only">${t("人工保修到（可选）")}
              <input name="labor_warranty_until" type="date" value="${d(v.labor_warranty_until)}">
              <small>${t("安装商的人工保修通常比厂家短")}</small>
            </label>
          </div>
        </fieldset>
        <fieldset>
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
        <fieldset>
          <legend>${t("费用与负责方")}</legend>
          <div class="form-grid">
            <label>${t("购买价格（{cur}）", { cur })}
              <input name="purchase_price" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.purchase_price)}">
            </label>
            <label class="eq-only">${t("更换估价（{cur}）", { cur })}
              <input name="replacement_cost_estimate" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${t("第三期“修还是换”会用到")}" value="${d(v.replacement_cost_estimate)}">
            </label>
            <label class="eq-only">${t("谁负责维护")}
              <select name="owner">${OWNER_OPTS.map((k) => `<option value="${k}" ${v.owner === k ? "selected" : ""}>${t(H().OWNERS[k].name)}</option>`).join("")}</select>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>${t("备注")}</legend>
          <label class="sr-only" for="assetNotes">${t("备注")}</label>
          <textarea id="assetNotes" name="notes" rows="3" maxlength="500" placeholder="${t("滤网尺寸、维修商电话、借给了谁…")}">${d(v.notes)}</textarea>
        </fieldset>
        <p id="assetFormError" class="form-error" role="alert"></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${a ? t("保存修改") : t("添加设备")}</button>
          <button type="button" class="btn btn-ghost" data-action="asset-cancel">${t("取消")}</button>
          ${a ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="asset-delete">${t("删除设备")}</button>` : ""}
        </div>
      </form>
      ${a ? maintSection(a, r.q.get("log") === "1") : `<p class="muted" style="margin-top:12px;font-size:13px">${t("保存后可以在这台设备下记录每次检查、保养和维修。")}</p>`}
    </section>`;
}

function assetSummary(a) {
  const sb = SERVICE_BADGE[a.service], wb = WARRANTY_BADGE[a.warranty];
  const bits = [
    sb.label && `<span class="badge ${sb.cls}">${t(sb.label)}${a.next && a.service !== "unknown" ? t(" · 下次 {d}", { d: fmtDate(a.next) }) : ""}</span>`,
    wb.label && `<span class="badge ${wb.cls}">${t(wb.label)}${a.warranty_until ? ` · ${fmtDate(a.warranty_until)}` : ""}</span>`,
    a.ageYears != null && `<span class="badge" style="background:var(--surface-2)">${t("已用 {age}", { age: ageText(a) })}${num(a.expected_life_years) ? t(" / 约 {n} 年", { n: fmt(a.expected_life_years) }) : ""}</span>`,
    a.logs.length && `<span class="badge" style="background:var(--surface-2)">${t("{n} 条记录", { n: a.logs.length })}${a.totalCost ? t("，共花 {m}", { m: money(a.totalCost) }) : ""}</span>`,
  ].filter(Boolean).join("");
  return `<div class="asset-badges" style="margin-bottom:12px">${bits}</div>${stampText(a) ? `<p class="record-meta" style="margin:-6px 0 12px">${esc(stampText(a))}</p>` : ""}`;
}

function maintSection(a, focusLog) {
  const K = H().MAINT_KINDS;
  const rows = a.logs.map((l) => `<li>
      <span class="badge ${l.kind === "repair" ? "b-low" : l.kind === "replace" ? "b-exp" : "b-ok"}">${t(K[l.kind] || l.kind)}</span>
      <div class="grow"><span class="name">${esc(fmtDate(l.done_on))}</span>
        <small>${joinList([l.diy ? t("自己做的") : l.vendor ? t("由 {who}", { who: l.vendor }) : null, l.cost != null ? t("花费 {m}", { m: Units.money(num(l.cost), l.currency || Units.region.currency) }) : null, l.notes,
          l.created_at && t("{d} 记录", { d: fmtShort(l.created_at) })].filter(Boolean).map(esc))}</small></div>
      <button type="button" class="btn btn-sm btn-ghost" data-action="maint-del" data-id="${l.id}" aria-label="${t("删除这条记录")}">${t("删除")}</button>
    </li>`).join("");
  return `
    <div class="section-head" style="margin-top:28px"><h2>${t("保养记录")}</h2><p>${t("检查、保养、更换会重算下次保养日期；维修不会")}</p></div>
    <form id="maintForm" class="panel" ${focusLog ? 'data-focus="1"' : ""}>
      <input type="hidden" name="asset_id" value="${esc(a.id)}">
      <div class="form-grid maint-grid">
        <label>${t("日期")}<input name="done_on" type="date" required value="${todayISO()}" max="${todayISO()}"></label>
        <label>${t("类型")}<select name="kind">${Object.entries(K).map(([k, n]) => `<option value="${k}" ${k === "service" ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
        <label>${t("花费（{cur}，可不填）", { cur: Units.region.currency })}<input name="cost" type="number" inputmode="decimal" min="0" step="0.01"></label>
        <label>${t("谁做的")}<input name="vendor" maxlength="40" placeholder="${t("维修商 / 师傅，自己做留空")}"></label>
        <label class="span-2 check-inline"><input type="checkbox" name="diy"><span>${t("自己动手")}</span></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" placeholder="${t("换了什么、师傅怎么说…")}"></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("记一笔")}</button>
        <small class="muted">${t("填了花费会同时记入“房屋维护”花费统计。")}</small></div>
    </form>
    <div class="panel" style="margin-top:10px">${rows ? `<ul class="restock-list">${rows}</ul>` : `<div class="empty"><strong>${t("还没有记录")}</strong>${t("上面记第一次检查或保养，之后会按周期提醒。")}</div>`}</div>`;
}

/** 表单联动：切换类型时带入默认值（只对新设备）；切换种类时隐藏设备专用字段并换类型列表 */
export function onAssetFormChange(e) {
  const f = e.target.form, fe = f.elements, isNew = !fe.asset_id.value;
  if (e.target.name === "kind") {
    f.classList.toggle("is-tool", e.target.value === "tool");
    const cur = fe.type.value;
    fe.type.innerHTML = typeOptions(cur, e.target.value);
    const first = H().ASSET_TYPES.find((x) => x.kind === e.target.value && (!state.houseProfile || x.region === "both" || x.region === state.houseProfile.region));
    if (H().assetType(cur)?.kind !== e.target.value && first) { fe.type.value = first.id; applyType(fe, first, isNew); }
  }
  if (e.target.name === "type") {
    const at = H().assetType(e.target.value);
    if (!at) return;
    if (at.kind !== fe.kind.value) { f.querySelector(`input[name="kind"][value="${at.kind}"]`).checked = true; f.classList.toggle("is-tool", at.kind === "tool"); }
    applyType(fe, at, isNew);
  }
}
function applyType(fe, at, isNew) {
  if (!isNew) return;
  const prev = fe.name.dataset.auto, name = t(at.name);
  if (!fe.name.value.trim() || fe.name.value === prev) { fe.name.value = name; fe.name.dataset.auto = name; }
  fe.expected_life_years.value = at.life ?? "";
  fe.service_interval_months.value = at.interval ?? "";
  const ht = state.houseProfile ? H().typeOf(state.houseProfile.region, state.houseProfile.house_type) : null;
  fe.owner.value = (at.system && ht?.owners?.[at.system] && OWNER_OPTS.includes(ht.owners[at.system])) ? ht.owners[at.system] : "self";
}

export async function saveAssetForm(f) {
  const fe = f.elements, err = $("#assetFormError");
  const name = fe.name.value.trim();
  if (!name) { err.textContent = t("请填写设备名称。"); return fe.name.focus(); }
  const numOrNull = (el, { int = false } = {}) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };
  const thisYear = new Date().getFullYear();
  const year = numOrNull(fe.manufacture_year, { int: true });
  if (year != null && (year < 1950 || year > thisYear)) { err.textContent = t("出厂年份需要在 1950 到 {y} 之间。", { y: thisYear }); return fe.manufacture_year.focus(); }
  const tool = fe.kind.value === "tool";
  const a = {
    id: fe.asset_id.value || undefined,
    kind: fe.kind.value, type: fe.type.value, name,
    location: fe.location.value || null, brand: fe.brand.value.trim() || null, model: fe.model.value.trim() || null, serial: fe.serial.value.trim() || null,
    installed_on: fe.installed_on.value || null, manufacture_year: year,
    warranty_until: fe.warranty_until.value || null, labor_warranty_until: tool ? null : fe.labor_warranty_until.value || null,
    expected_life_years: numOrNull(fe.expected_life_years), service_interval_months: numOrNull(fe.service_interval_months, { int: true }),
    purchase_price: numOrNull(fe.purchase_price), replacement_cost_estimate: tool ? null : numOrNull(fe.replacement_cost_estimate),
    owner: tool ? null : fe.owner.value || null, notes: fe.notes.value.trim() || null,
  };
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await Store.saveAsset(a);
    toast(a.id ? t("已保存修改") : t("已添加 {name}", { name }));
    leaveAsset(true);
  } catch (e) { err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; }
}

/** 记一次保养：有费用先写 purchases（house_maint），再写记录并关联，删除记录时一起删 */
export async function saveMaintForm(f) {
  const fe = f.elements;
  const asset = state.assets.find((x) => x.id === fe.asset_id.value);
  if (!asset) return toast(t("设备不存在"));
  const done_on = fe.done_on.value || todayISO();
  const kind = fe.kind.value, vendor = fe.vendor.value.trim() || null, diy = fe.diy.checked;
  const cost = fe.cost.value === "" ? null : Math.round(Math.max(0, num(fe.cost.value)) * 100) / 100;
  const currency = Units.region.currency;
  let purchase_id = null;
  if (cost != null && cost > 0) {
    purchase_id = await Store.addPurchase({ item_id: null, name: `${asset.name} · ${t(H().MAINT_KINDS[kind])}`, category: MAINT_CAT.id, quantity: null, unit: null,
      store: vendor, amount: cost, currency, purchased_at: new Date(`${done_on}T12:00:00`).toISOString() });
  }
  await Store.addMaintLog({ asset_id: asset.id, done_on, kind, cost, currency: cost != null ? currency : null, diy, vendor, notes: fe.notes.value.trim() || null, purchase_id });
  toast(kind === "replace" ? t("已记录更换，记得把安装日期改成新设备的日期") : t("已记录{kind}", { kind: t(H().MAINT_KINDS[kind]) }));
}
