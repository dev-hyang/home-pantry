/* 房屋维护 · 第一期：房屋资料（房型、材料、设施）、责任归属、材料保养建议、按模板批量加入房屋耗材 */
import { alertsOf } from "../core/logic.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { daysUntil, esc, fmtDate, inSpace, money } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { restockPanel, shelfGrid } from "../pantry/views.js";
import { alertText, assetAlerts, myAssets } from "./assets.js";
import { monthName, monthTasks, taskRow } from "./tasks.js";
import { houseBar } from "./property-form.js";
import { currentProp, dealTasks, openDeal, propertyLive, statusText, taskRow as dealTaskRow } from "./deals.js";

const H = () => window.HOUSE;

/** 房屋概览顶部：房产状态、进行中的交易、编辑房产（同设置页的表单） */
function statusLine() {
  const p = currentProp(); if (!p) return "";
  const d = openDeal(p.id);
  const B = window.BILLS;
  // 名称 + 一组带标签名的芯片（状态 / 类型 / 用途），避免“值 · 值 · 值”分不清哪个是哪个
  const STATUS_CLS = { looking: "", buying: "b-soon", owned: "b-ok", renting: "b-ok", selling: "b-soon", sold: "", moved_out: "" };
  const tag = (label, value, cls = "") => (value ? `<span class="meta-tag ${cls}"><small>${label}</small>${esc(value)}</span>` : "");
  return `<div class="status-line">
    <b class="prop-name">${esc(p.name)}</b>
    ${tag(t("状态"), statusText(p), STATUS_CLS[p.status] || "")}
    ${tag(t("类型"), t(B.PROPERTY_KINDS[p.kind] || ""))}
    ${tag(t("用途"), t(B.PROPERTY_ROLES[p.role] || ""))}
    ${d ? `<a class="meta-tag b-soon" href="${href("house", "deal")}"><small>${t("交易")}</small>${t("进行中，查看清单")}</a>` : ""}
    ${state.editProperty === p.id ? "" : `<button type="button" class="link-name" data-action="property-edit" data-id="${p.id}">${t("编辑房产")}</button>`}
  </div>`;
}

/* ── HOA / 物业 ── */
/** 当前资料的 HOA 对象（没填过按房型默认） */
export function hoaOf(p) {
  if (!p) return null;
  const a = H().assocOf(p.house_type);
  return { enabled: a.on, dues_period: "monthly", ...(p.hoa || {}) };
}

/** 特殊评估 / 大额摊派的状态：none / due（days）/ paid */
export function assessmentStatus(hoa) {
  if (!hoa?.enabled || !(hoa.sa_amount > 0)) return { kind: "none" };
  if (hoa.sa_paid) return { kind: "paid" };
  return { kind: "due", days: hoa.sa_due ? daysUntil(hoa.sa_due) : null };
}

/** 房屋卡片里的 HOA 事实行：{ k: 标签, v: 值 }；没有 HOA 返回 null */
function hoaFact(p) {
  const hoa = hoaOf(p), a = H().assocOf(p.house_type);
  if (!hoa.enabled) return null;
  const bits = [];
  if (hoa.name) bits.push(`<b>${esc(hoa.name)}</b>`);
  if (hoa.mgmt) bits.push(esc(hoa.mgmt));
  if (hoa.dues > 0) bits.push(`${t(H().DUES_PERIODS[hoa.dues_period] || "每月")} ${money(hoa.dues)}`);
  const sa = assessmentStatus(hoa);
  if (sa.kind === "due") bits.push(`<span class="badge ${sa.days != null && sa.days <= 14 ? "b-out" : "b-soon"}">${t("特殊评估")} ${money(hoa.sa_amount)} ${t("待缴")}</span>`);
  return { k: `🏘️ ${esc(t(a.label))}`, v: bits.length ? bits.join(" · ") : `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充")}</a>` };
}

/** 概览里的“HOA / 物业”面板：联系方式、费用、特殊评估、规则、该房型须知 */
function hoaPanel(p) {
  const hoa = hoaOf(p), a = H().assocOf(p.house_type);
  const tips = a.tips.length ? `<details class="hoa-tips" ${hoa.enabled && (hoa.name || hoa.rules) ? "" : "open"}><summary>${t("{label}须知（{type}）", { label: t(a.label), type: t(H().typeOf(p.region, p.house_type)?.name || "") })}</summary><ul class="tips">${a.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details>` : "";
  if (!hoa.enabled) {
    if (!a.on && !a.tips.length) return "";
    return `<section class="section" id="house-hoa"><div class="section-head"><h2>${esc(t(a.label))}</h2><p>${t("没填 {label}，有的话去资料里补充", { label: t(a.label) })}</p></div>
      <div class="panel">${tips || `<div class="empty">${t("这种房型一般没有 {label}", { label: t(a.label) })}</div>`}</div></section>`;
  }
  // 多个邮箱用 ; 或 , 隔开，各自成一个链接；手机上允许在任意处换行，不再撑宽
  const emails = (hoa.email || "").split(/[;,，；]/).map((x) => x.trim()).filter(Boolean);
  const contact = [
    hoa.phone ? `<a href="tel:${esc(hoa.phone.replace(/[^\d+]/g, ""))}">📞 ${esc(hoa.phone)}</a>` : "",
    ...emails.map((e) => `<a href="mailto:${esc(e)}">✉️ ${esc(e)}</a>`),
    hoa.url ? `<a href="${esc(hoa.url)}" target="_blank" rel="noopener noreferrer">🔗 ${t("业主门户")}</a>` : "",
  ].filter(Boolean).join(" · ");
  const sa = assessmentStatus(hoa);
  const saText = sa.kind === "none" ? t("没有进行中的特殊评估")
    : sa.kind === "paid" ? `${money(hoa.sa_amount)}${hoa.sa_purpose ? ` · ${esc(hoa.sa_purpose)}` : ""} <span class="badge b-ok">${t("已缴")}</span>`
    : `<b>${money(hoa.sa_amount)}</b>${hoa.sa_purpose ? ` · ${esc(hoa.sa_purpose)}` : ""}${hoa.sa_due ? ` · ${t("截止 {d}", { d: fmtDate(hoa.sa_due) })}` : ""} <span class="badge ${sa.days != null && sa.days < 0 ? "b-out" : "b-soon"}">${sa.days == null ? t("待缴") : sa.days < 0 ? t("已逾期 {d} 天", { d: -sa.days }) : t("{d} 天后到期", { d: sa.days })}</span>`;
  const hoaBill = state.bills.find((b) => b.category === "hoa" && (!b.property_id || b.property_id === state.propertyId) && !b.archived);
  // 标签 / 值的事实行（与房屋卡片同款）：值可换行，手机上不会把内容挤到屏幕外；表格 + 横向滚动会让长邮箱、备注把值列推出视野
  const row = (k, v) => (v ? `<div class="fact wide"><dt>${k}</dt><dd>${v}</dd></div>` : "");
  return `<section class="section" id="house-hoa">
    <div class="section-head"><h2>${esc(t(a.label))}${hoa.name ? ` · ${esc(hoa.name)}` : ""}</h2><a class="btn btn-sm btn-ghost" href="${href("house", "profile")}">${t("修改")}</a></div>
    <div class="panel">
      <dl class="fact-grid one">
        ${row(t("管理公司 / 联系人"), hoa.mgmt ? esc(hoa.mgmt) : "")}
        ${row(t("联系方式"), contact)}
        ${row(t("费用"), hoa.dues > 0 ? `${t(H().DUES_PERIODS[hoa.dues_period] || "每月")} ${money(hoa.dues)}${hoaBill ? ` · <a href="${href("bill", hoaBill.id)}">${t("账单：{name}", { name: esc(hoaBill.name) })}</a>` : state.billsEnabled ? ` · <a href="${href("bills", "template")}">${t("建一条账单提醒缴费")}</a>` : ""}` : "")}
        ${row(t("特殊评估 / 摊派"), saText)}
        ${row(t("规则与限制"), hoa.rules ? `<span class="pre">${esc(hoa.rules)}</span>` : "")}
        ${row(t("备注"), hoa.notes ? `<span class="pre">${esc(hoa.notes)}</span>` : "")}
      </dl>
      ${tips}
    </div>
  </section>`;
}

/** 提醒总线：特殊评估未缴且 45 天内到期或已逾期（必须） */
export function hoaAlertItems() {
  if (!state.houseEnabled) return [];
  return state.properties.filter(propertyLive).flatMap((prop) => {
    const p = state.houseProfiles[prop.id]; const hoa = hoaOf(p); const sa = assessmentStatus(hoa);
    if (sa.kind !== "due" || sa.days == null || sa.days > 45) return [];
    const severity = sa.days < 0 ? 0 : sa.days <= 3 ? 1 : sa.days <= 14 ? 2 : 3;
    const a = H().assocOf(p.house_type);
    return [{ source: "house", severity, must: true, due: hoa.sa_due, daysLeft: sa.days, property_id: prop.id,
      title: `🏘️ ${t(a.label)} ${t("特殊评估")} ${money(hoa.sa_amount)}${hoa.sa_purpose ? ` · ${hoa.sa_purpose}` : ""}`,
      detail: sa.days < 0 ? t("已逾期 {d} 天，逾期有滞纳金并可能留置", { d: -sa.days }) : t("{d} 天后截止（{date}）", { d: sa.days, date: fmtDate(hoa.sa_due) }),
      href: `${href("house", "overview")}`, actions: [{ type: "link", href: `${href("house", "profile")}`, label: t("标为已缴") }] }];
  });
}

/** 默认地区：设备时区在北美 → 北美模板，否则中国模板 */
export const defaultRegion = () => (Units.region.system === "us" ? "na" : "cn");

/** 编辑中的房屋资料草稿（切换地区、房型时重新渲染表单，草稿保证已填内容不丢）；地址来自房产，保险字段来自资料 */
export function houseDraft() {
  if (!state.houseDraft) {
    const p = state.houseProfile, prop = currentProp();
    if (p) state.houseDraft = { ...p, features: [...(p.features || [])], exterior: [...(p.exterior || [])], flooring: [...(p.flooring || [])] };
    else {
      const region = defaultRegion(), ht = H().HOUSE_TYPES[region][0];
      state.houseDraft = { region, house_type: ht.id, year_built: null, features: [...ht.features], exterior: [], roof: null, flooring: [], insured: false };
    }
    state.houseDraft.address = prop?.address || "";
  }
  return state.houseDraft;
}

/** 把表单当前值读回草稿 */
/** 把表单当前值读回草稿；资料表单按分区分页，只读页面上存在的字段，其余保留草稿里的值 */
export function readHouseForm(form) {
  const d = houseDraft(), fe = form.elements;
  const has = (n) => !!fe[n];
  const str = (n) => (fe[n].value || "").trim() || null;
  const checked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
  const num = (v) => (v === "" ? null : Math.round(Math.max(0, Number(v) || 0) * 100) / 100);
  if (has("region")) d.region = fe.region.value;
  if (has("house_type")) d.house_type = fe.house_type.value;
  if (has("year_built")) { const y = parseInt(fe.year_built.value, 10); d.year_built = Number.isFinite(y) ? y : null; }
  if (form.querySelector('input[name="features"]')) d.features = checked("features");
  if (form.querySelector('input[name="exterior"]')) d.exterior = checked("exterior");
  if (form.querySelector('input[name="flooring"]')) d.flooring = checked("flooring");
  if (has("roof")) d.roof = fe.roof.value || null;
  if (has("address")) d.address = (fe.address.value || "").trim();
  if (has("insured")) {
    d.insured = fe.insured.checked;
    d.insurance_provider = str("insurance_provider"); d.insurance_policy = str("insurance_policy");
    d.insurance_from = fe.insurance_from.value || null; d.insurance_to = fe.insurance_to.value || null;
    d.insurance_coverage = str("insurance_coverage"); d.insurance_premium = num(fe.insurance_premium.value);
    d.insurance_agent = str("insurance_agent"); d.insurance_phone = str("insurance_phone"); d.insurance_email = str("insurance_email");
  }
  if (has("hoa_enabled")) {
    d.hoa = { enabled: fe.hoa_enabled.checked, name: str("hoa_name"), mgmt: str("hoa_mgmt"), phone: str("hoa_phone"), email: str("hoa_email"), url: str("hoa_url"),
      dues: num(fe.hoa_dues.value), dues_period: fe.hoa_dues_period.value || "monthly",
      sa_amount: num(fe.hoa_sa_amount.value), sa_purpose: str("hoa_sa_purpose"), sa_due: fe.hoa_sa_due.value || null, sa_paid: fe.hoa_sa_paid.checked,
      rules: str("hoa_rules"), notes: str("hoa_notes") };
  }
  return d;
}

/* ── 资料分区：列表页显示完成度，点进去只改一块 ── */
export const PROFILE_SECTIONS = [
  { id: "type", icon: "🏡", name: "地区与房型" },
  { id: "address", icon: "📍", name: "地址与建成年份" },
  { id: "insurance", icon: "🛡️", name: "房屋保险" },
  { id: "hoa", icon: "🏘️", name: "HOA / 物业" },
  { id: "features", icon: "🔧", name: "家里有这些设施" },
  { id: "materials", icon: "🧱", name: "外墙、屋面与地面材料" },
];
const filled = (vals) => vals.filter((v) => v != null && v !== "" && v !== false).length;
/** 每个分区的完成度：{ text, pct }（pct 为空表示不按比例显示） */
export function sectionStatus(d, id) {
  const Hh = H();
  switch (id) {
    case "type": { const ht = Hh.typeOf(d.region, d.house_type); return { text: `${t(Hh.REGIONS[d.region]?.name || "")} · ${ht ? t(ht.name) : ""}`, pct: state.houseProfile ? 100 : 0 }; }
    case "address": { const n = filled([d.address, d.year_built]); return { text: `${n} / 2`, pct: n * 50 }; }
    case "insurance": {
      if (!d.insured) return { text: t("未投保"), pct: null };
      const n = filled([d.insurance_provider, d.insurance_policy, d.insurance_from, d.insurance_to, d.insurance_coverage, d.insurance_premium, d.insurance_agent, d.insurance_phone, d.insurance_email]);
      return { text: `${n} / 9`, pct: Math.round((n / 9) * 100) };
    }
    case "hoa": {
      const h = hoaOf(d); if (!h.enabled) return { text: t("无 {label}", { label: t(Hh.assocOf(d.house_type).label) }), pct: null };
      const n = filled([h.name, h.mgmt, h.phone || h.email || h.url, h.dues, h.rules]);
      return { text: `${n} / 5${h.sa_amount > 0 && !h.sa_paid ? ` · ${t("特殊评估待缴")}` : ""}`, pct: n * 20 };
    }
    case "features": return { text: t("{n} 项", { n: (d.features || []).length }), pct: null };
    case "materials": {
      const e = (d.exterior || []).length, f = (d.flooring || []).length, r = d.roof ? 1 : 0;
      if (!e && !f && !r) return { text: t("未填"), pct: 0 };
      return { text: [e ? t("外墙 {n}", { n: e }) : null, r ? t("屋面 ✓") : null, f ? t("地面 {n}", { n: f }) : null].filter(Boolean).join(" · "), pct: Math.round(((e ? 1 : 0) + r + (f ? 1 : 0)) / 3 * 100) };
    }
    default: return { text: "", pct: null };
  }
}

/** 保险状态：none / active / expiring（30 天内）/ expired / unknown（有保险但没填到期日） */
export function insuranceStatus(p) {
  if (!p || !p.insured) return { kind: "none", days: null };
  if (!p.insurance_to) return { kind: "unknown", days: null };
  const days = daysUntil(p.insurance_to);
  return { kind: days < 0 ? "expired" : days <= 30 ? "expiring" : "active", days };
}
const INS_BADGE = { active: ["b-ok", "有效"], expiring: ["b-soon", "快到期"], expired: ["b-out", "已过期"], unknown: ["", "未填到期日"], none: ["", "未填保险"] };

/** 概览状态栏里的保险摘要：🛡️ 房屋保险 <StateFarm> 有效（2026/1/1 – 2026/12/31）保单号 … */
/** 房屋卡片里的保险事实行：{ k, v, sub }；sub 为理赔代理（可拨打 / 发邮件） */
export function insuranceFact(p) {
  const s = insuranceStatus(p), [cls, label] = INS_BADGE[s.kind];
  const k = `🛡️ ${t("房屋保险")}`;
  if (s.kind === "none") return { k, v: `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充")}</a>` };
  const period = p.insurance_from || p.insurance_to ? `${p.insurance_from ? fmtDate(p.insurance_from) : "…"} – ${p.insurance_to ? fmtDate(p.insurance_to) : "…"}` : "";
  const bits = [];
  if (p.insurance_provider) bits.push(`<b>${esc(p.insurance_provider)}</b>`);
  bits.push(`<span class="badge ${cls}">${t(label)}${s.kind === "expiring" ? ` · ${t("{d} 天", { d: s.days })}` : ""}</span>`);
  if (period) bits.push(esc(period));
  if (p.insurance_policy) bits.push(`${t("保单号")} ${esc(p.insurance_policy)}`);
  if (p.insurance_coverage) bits.push(esc(p.insurance_coverage));
  return { k, v: bits.join(" · "), sub: agentValue(p) };
}

/** 理赔代理：姓名 · 电话（可拨）· 邮箱（可发），都没填返回空串 */
function agentValue(p) {
  const parts = [];
  if (p.insurance_agent) parts.push(`<b>${esc(p.insurance_agent)}</b>`);
  if (p.insurance_phone) parts.push(`<a href="tel:${esc(p.insurance_phone.replace(/[^\d+]/g, ""))}">📞 ${esc(p.insurance_phone)}</a>`);
  if (p.insurance_email) parts.push(`<a href="mailto:${esc(p.insurance_email)}">✉️ ${esc(p.insurance_email)}</a>`);
  return parts.length ? `${t("理赔代理")}${lang === "en" ? ": " : "："}${parts.join(" · ")}` : "";
}

/** 提醒总线：各活跃房产的房屋保险 30 天内到期（尽快）或已过期（今天级） */
export function insuranceAlertItems() {
  if (!state.houseEnabled) return [];
  return state.properties.filter((p) => !p.archived && !["sold", "moved_out"].includes(p.status)).flatMap((prop) => {
    const p = state.houseProfiles[prop.id]; const s = insuranceStatus(p);
    if (s.kind !== "expiring" && s.kind !== "expired") return [];
    return [{ source: "house", severity: s.kind === "expired" ? 1 : 2, must: true, due: p.insurance_to, daysLeft: s.days, property_id: prop.id,
      title: `🛡️ ${t("房屋保险")}${p.insurance_provider ? ` · ${p.insurance_provider}` : ""}`,
      detail: s.kind === "expired" ? t("已过期 {d} 天，尽快续保", { d: -s.days }) : t("{d} 天后到期，续保前比价", { d: s.days }),
      href: href("house", "profile"), badge: { label: s.kind === "expired" ? t("已过期") : t("快到期"), cls: s.kind === "expired" ? "b-out" : "b-soon" },
      actions: [{ type: "link", href: href("house", "profile"), label: t("更新保单") }] }];
  });
}

/** 切换房型：按新房型预选设施（之前的勾选会被替换） */
export function applyTypeDefaults(d) {
  const ht = H().typeOf(d.region, d.house_type) || H().HOUSE_TYPES[d.region][0];
  d.house_type = ht.id;
  d.features = [...ht.features];
  d.hoa = { ...(d.hoa || {}), enabled: H().assocOf(ht.id).on };   // 有没有 HOA / 物业也按房型重设默认
}

/** 房屋卡片的事实列表：地址、材料、设施各占半行，保险和 HOA 各占整行 */
function houseFacts(p, { ext, roof, floors, featNames }) {
  const facts = [];
  const addr = currentProp()?.address;
  facts.push({ k: `📍 ${t("地址")}`, v: addr ? esc(addr) : `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充")}</a>` });
  const mats = [...ext, ...roof, ...floors];
  facts.push({ k: `🧱 ${t("材料")}`, v: mats.length ? `<span class="tagline">${mats.map((m) => `<span class="tag">${esc(t(m.name))}</span>`).join("")}</span>` : `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充材料")}</a>` });
  if (featNames.length) facts.push({ k: `🔧 ${t("设施")}`, v: `<span class="tagline">${featNames.map((n) => `<span class="tag tag-soft">${esc(n)}</span>`).join("")}</span>`, wide: true });
  facts.push({ ...insuranceFact(p), wide: true });
  const hoa = hoaFact(p); if (hoa) facts.push({ ...hoa, wide: true });
  return facts;
}

/* ── 房屋概览 ── */
export function viewHouse() {
  const p = state.houseProfile;
  const alerts = alertsOf(state.enriched.filter(inSpace("house")));
  const shelf = shelfGrid("house");
  if (!p) {
    return `${houseBar()}${statusLine()}<section class="section house-intro">
      <h2>${t("先说说你家的房子")}</h2>
      <p class="muted">${t("选一下房型、外墙和地面材料、家里有哪些设施，大约 1 分钟。之后会告诉你哪些部位归自己维护、各种材料怎么保养，并一次加好常用的房屋耗材。")}</p>
      <p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a>
         <a class="btn btn-ghost" href="${href("house", "supplies")}">${t("先直接记录耗材")}</a></p>
    </section>
    ${shelf ? `<section class="section"><div class="section-head"><h2>${t("房屋耗材")}</h2></div><div class="shelf">${shelf}</div></section>` : ""}`;
  }
  const ht = H().typeOf(p.region, p.house_type);
  const names = (group, ids) => ids.map((id) => H().MATERIALS[group].find((m) => m.id === id)).filter(Boolean);
  const ext = names("exterior", p.exterior || []), floors = names("flooring", p.flooring || []);
  const roof = p.roof ? names("roof", [p.roof]) : [];
  const featNames = H().FEATURES.filter((f) => (p.features || []).includes(f.id)).map((f) => t(f.name));
  const age = p.year_built ? new Date().getFullYear() - p.year_built : null;

  const ownerRows = H().SYSTEMS.map((s) => {
    const o = H().OWNERS[ht?.owners?.[s.id] || "varies"];
    return `<tr><th scope="row">${esc(t(s.name))}</th><td><span class="owner ${o.cls}">${esc(t(o.name))}</span></td></tr>`;
  }).join("");

  const careBlock = (title, mats) => mats.length ? `<div class="care">
      <h3>${title}</h3>
      ${mats.map((m) => `<details ${mats.length === 1 ? "open" : ""}><summary>${esc(t(m.name))}</summary><ul>${m.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details>`).join("")}
    </div>` : "";

  return `
    ${houseBar()}${statusLine()}
    <section class="section">
      <div class="house-card">
        <div class="house-head">
          <span class="house-ico" aria-hidden="true">${ht?.icon || "🏠"}</span>
          <div class="grow">
            <h2>${esc(ht ? t(ht.name) : t("我的房子"))}${lang === "en" ? "" : `<span class="muted">${esc(ht?.en || "")}</span>`}</h2>
            <p class="muted">${esc(t(H().REGIONS[p.region]?.name || ""))}${p.year_built ? t("，{y} 年建成（约 {age} 年房龄）", { y: p.year_built, age }) : ""}</p>
          </div>
          <a class="btn btn-sm btn-ghost" href="${href("house", "profile")}">${t("修改资料")}</a>
        </div>
        <dl class="fact-grid">${houseFacts(p, { ext, roof, floors, featNames }).map((f) => `<div class="fact ${f.wide ? "wide" : ""}"><dt>${f.k}</dt><dd>${f.v}${f.sub ? `<small>${f.sub}</small>` : ""}</dd></div>`).join("")}</dl>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>${t("房屋耗材提醒")}</h2>
        <div class="head-acts">${alerts.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts" data-space="house">${t("全部加入采购清单")}</button>` : ""}
          <a class="btn btn-sm btn-ghost" href="${href("house", "template")}">${t("按房屋资料推荐")}</a></div></div>
      <div class="panel">${alerts.length ? restockPanel(alerts) : shelf ? `<div class="empty"><strong>${t("房屋耗材都充足")}</strong></div>`
        : `<div class="empty"><strong>${t("还没有房屋耗材")}</strong>${t("按你家的设施一次加好滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${href("house", "template")}">${t("查看推荐清单")}</a></p></div>`}</div>
      ${shelf ? `<div class="shelf" style="margin-top:10px">${shelf}</div>` : ""}
    </section>

    <section class="section">
      <div class="section-head"><h2>${t("哪些部位归谁维护")}</h2><p>${esc(t(ht?.desc || ""))}</p></div>
      <div class="panel"><div class="ch-scroll"><table class="owner-table"><tbody>${ownerRows}</tbody></table></div>
        <p class="disclaimer">${t("这是该房型的常见情况，具体以 HOA 章程、物业服务合同或租约为准。")}</p></div>
    </section>

    ${hoaPanel(p)}

    ${ext.length || roof.length || floors.length ? `<section class="section">
      <div class="section-head"><h2>${t("材料保养建议")}</h2><p>${t("根据你填写的外墙、屋面和地面材料")}</p></div>
      <div class="panel care-grid">${careBlock(t("外墙"), ext)}${careBlock(t("屋面"), roof)}${careBlock(t("地面"), floors)}</div>
      <p class="disclaimer">${t("周期与寿命为常见经验值，实际以产品说明书和专业人士检查为准。")}</p>
    </section>` : `<section class="section"><div class="panel empty"><strong>${t("还没填材料")}</strong>${t("补充外墙、屋面和地面材料后，这里会给出对应的保养建议。")}<p><a class="btn btn-ghost" href="${href("house", "profile")}">${t("补充材料")}</a></p></div></section>`}

    ${dealPanel()}
    ${tasksPanel()}
    ${assetsPanel()}

    <section class="section"><div class="panel next-phase">
      <h3>${t("第三期")}</h3>
      <p class="muted">${t("修还是换的建议、照片与收据、维修费用报表。")}</p>
    </div></section>`;
}

/* ── 概览里的设备与季节任务摘要（第二期） ── */
function assetsPanel() {
  const list = myAssets(), alerts = assetAlerts(list);
  const body = !list.length
    ? `<div class="empty"><strong>${t("还没有设备档案")}</strong>${t("按房屋资料一次生成炉子、热水器、排水泵等设备，记录保修和保养周期。")}<p><a class="btn btn-primary" href="${href("house", "asset-template")}">${t("生成设备清单")}</a></p></div>`
    : alerts.length
      ? `<ul class="restock-list">${alerts.slice(0, 4).map((a) => `<li>
          <span class="badge ${a.service === "overdue" ? "b-out" : "b-soon"}">${a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修")}</span>
          <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${a.t?.icon || "⚙️"} ${esc(a.name)}</a><small>${esc(alertText(a))}</small></div>
          <a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a></li>`).join("")}</ul>`
      : `<div class="empty"><strong>${t("{n} 台设备，保养都在周期内", { n: list.length })}</strong></div>`;
  return `<section class="section">
    <div class="section-head"><h2>${t("设备档案")}</h2><div class="head-acts">
      ${list.length ? `<a class="btn btn-sm btn-ghost" href="${href("house", "asset-template")}">${t("生成更多")}</a>` : ""}
      <a class="btn btn-sm btn-ghost" href="${href("house", "assets")}">${t("全部设备")}${list.length ? `（${list.length}）` : ""}</a></div></div>
    <div class="panel">${body}</div>
  </section>`;
}

/** 本月季节任务：全部列出，做完的保留并打勾（不隐藏），未做的在前 */
function tasksPanel() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
  const list = monthTasks(y, m);
  if (!list.length) return "";
  const undone = list.filter((x) => !x.done), done = list.filter((x) => x.done);
  return `<section class="section">
    <div class="section-head"><h2>${t("{month}季节任务", { month: monthName(m) })}</h2><div class="head-acts"><p>${t("已完成 {a} / {b}", { a: done.length, b: list.length })}${undone.length ? "" : ` · ${t("本月都做完了")}`}</p>
      <a class="btn btn-sm btn-ghost" href="${href("house", "tasks")}">${t("全年任务")}</a></div></div>
    <div class="panel"><ul class="task-list">${[...undone, ...done].map((x) => taskRow(x, y, m)).join("")}</ul></div>
  </section>`;
}

/** 进行中交易的清单：未做的按到期排在前，做完的保留在后打勾 */
function dealPanel() {
  const d = openDeal(currentProp()?.id); if (!d) return "";
  const tasks = dealTasks(d);
  if (!tasks.length) return "";
  const undone = tasks.filter((x) => !x.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9")), done = tasks.filter((x) => x.done);
  return `<section class="section">
    <div class="section-head"><h2>${t("{kind}清单", { kind: t(window.DEALS.KINDS[d.kind]) })}</h2><div class="head-acts"><p>${t("已完成 {a} / {b}", { a: done.length, b: tasks.length })}</p>
      <a class="btn btn-sm btn-ghost" href="${href("house", "deal")}">${t("交易页")}</a></div></div>
    <div class="panel"><ul class="task-list">${[...undone.slice(0, 8), ...done.slice(-4)].map((x) => dealTaskRow(x)).join("")}</ul>
      ${undone.length > 8 ? `<p class="muted" style="margin:8px 0 0">${t("还有 {n} 项，", { n: undone.length - 8 })}<a href="${href("house", "deal")}">${t("去交易页查看")}</a></p>` : ""}</div>
  </section>`;
}

/** 资料表单里的 HOA / 物业区块：叫法和默认值按当前房型 */
function hoaFieldset(d) {
  const a = H().assocOf(d.house_type), hoa = hoaOf(d), label = t(a.label);
  const P = H().DUES_PERIODS;
  return `<fieldset id="hoa">
    <legend>${esc(label)}</legend>
    <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="hoa_enabled" ${hoa.enabled ? "checked" : ""}><span>${t("有 {label}（按房型默认，可改）", { label })}</span></label>
    <div class="form-grid">
      <label>${t("名称")}<input name="hoa_name" maxlength="80" placeholder="${t("例如：Lakeview Condominium Association")}" value="${esc(hoa.name || "")}"></label>
      <label>${t("管理公司 / 联系人")}<input name="hoa_mgmt" maxlength="80" value="${esc(hoa.mgmt || "")}"></label>
      <label>${t("电话")}<input name="hoa_phone" type="tel" maxlength="40" value="${esc(hoa.phone || "")}"></label>
      <label>${t("邮箱")}<input name="hoa_email" type="email" maxlength="120" value="${esc(hoa.email || "")}"></label>
      <label class="span-2">${t("业主门户 / 缴费网址")}<input name="hoa_url" type="url" maxlength="200" placeholder="https://" value="${esc(hoa.url || "")}"></label>
      <label>${t("费用")}<input name="hoa_dues" type="number" inputmode="decimal" min="0" step="0.01" value="${hoa.dues ?? ""}"></label>
      <label>${t("频率")}<select name="hoa_dues_period">${Object.entries(P).map(([k, n]) => `<option value="${k}" ${hoa.dues_period === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select><small>${t("按期缴费提醒请在账单里建“HOA / 物业费”")}</small></label>
    </div>
    <h4 class="sub-legend">${t("特殊评估 / 大额摊派")}<small>${t("储备金不够大修时按份额摊的款项；截止前 45 天开始提醒，逾期置顶")}</small></h4>
    <div class="form-grid">
      <label>${t("金额")}<input name="hoa_sa_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${hoa.sa_amount ?? ""}"></label>
      <label>${t("截止日")}<input name="hoa_sa_due" type="date" value="${esc(hoa.sa_due || "")}"></label>
      <label class="span-2">${t("用途")}<input name="hoa_sa_purpose" maxlength="120" placeholder="${t("例如：屋顶更换、电梯大修、外墙维修")}" value="${esc(hoa.sa_purpose || "")}"></label>
      <label class="check-inline span-2"><input type="checkbox" name="hoa_sa_paid" ${hoa.sa_paid ? "checked" : ""}><span>${t("已缴清")}</span></label>
    </div>
    <h4 class="sub-legend">${t("规则与限制")}<small>${t("宠物、出租限制、装修审批、停车、安静时段、搬家预约等")}</small></h4>
    <textarea name="hoa_rules" rows="3" maxlength="1000" placeholder="${t("例如：最多 2 只宠物、出租需满 1 年自住、装修 9–17 点、访客停车 48 小时")}">${esc(hoa.rules || "")}</textarea>
    <label style="display:block;margin-top:8px">${t("备注")}<input name="hoa_notes" maxlength="500" placeholder="${t("例如：年会 3 月、储备金研究 2025、门禁码在钥匙盒")}" value="${esc(hoa.notes || "")}"></label>
    ${a.tips.length ? `<details class="hoa-tips" style="margin-top:10px"><summary>${t("{label}须知（{type}）", { label, type: t(H().typeOf(d.region, d.house_type)?.name || "") })}</summary><ul class="tips">${a.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details>` : ""}
  </fieldset>`;
}

/* ── 房屋资料：分区列表（带完成度）→ 点进去只改一块 ── */
export function viewHouseProfile() {
  const sec = state.route?.q?.get("sec");
  if (sec && PROFILE_SECTIONS.some((s) => s.id === sec)) return viewProfileSection(sec);
  const d = houseDraft(), first = !state.houseProfile;
  const rows = PROFILE_SECTIONS.map((s) => {
    const st = sectionStatus(d, s.id);
    return `<a class="mrow" href="${href("house", "profile")}?sec=${s.id}">
      <span class="mi" aria-hidden="true">${s.icon}</span>
      <span class="mt"><b>${t(s.name)}</b><small>${esc(st.text)}</small>${st.pct != null ? `<span class="mprog"><i style="width:${st.pct}%"></i></span>` : ""}</span>
      <span class="mch" aria-hidden="true">›</span></a>`;
  }).join("");
  return `<section class="section menu-page">
    <div class="section-head"><h2>${t("房屋资料")}</h2><p>${first ? t("先选地区和房型，保存后其余分区随时补") : t("点一项进去改，各自保存")}</p></div>
    <div class="panel mlist">${rows}</div>
    ${first ? `<p class="hint">${t("房型决定推荐什么耗材、生成哪些设备、每月有什么季节任务；其余分区（地址、保险、HOA、材料）可以之后再补。")}</p>` : ""}
    <div class="form-actions" style="margin-top:14px">${state.houseProfile ? `<a class="btn btn-ghost" href="${href("house", "overview")}">${t("返回房屋概览")}</a>` : `<a class="btn btn-primary" href="${href("house", "profile")}?sec=type">${t("开始：选地区和房型")}</a>`}</div>
  </section>`;
}

/** 单个分区的表单页：只渲染这一块的字段，保存后回到分区列表 */
function viewProfileSection(sec) {
  const d = houseDraft(), Hh = H();
  const types = Hh.HOUSE_TYPES[d.region] || [];
  const check = (name, list, sel) => list.map((x) => `<label class="check"><input type="checkbox" name="${name}" value="${x.id}" ${sel.includes(x.id) ? "checked" : ""}><span>${esc(t(x.name))}</span></label>`).join("");
  const thisYear = new Date().getFullYear();
  const meta = PROFILE_SECTIONS.find((s) => s.id === sec);
  const body = {
    type: () => `
        <fieldset>
          <legend>${t("地区")}</legend>
          <div class="seg-radio">${Object.values(Hh.REGIONS).map((r) => `<label class="radio-pill"><input type="radio" name="region" value="${r.id}" ${d.region === r.id ? "checked" : ""}><span>${t(r.name)}<small>${t(r.hint)}</small></span></label>`).join("")}</div>
          <p class="hint">${t("决定房型、材料和耗材推荐用哪一套；和显示单位的地区设置相互独立。")}</p>
        </fieldset>
        <fieldset>
          <legend>${t("房型")}</legend>
          <div class="type-grid">${types.map((x) => `<label class="type-card"><input type="radio" name="house_type" value="${x.id}" ${d.house_type === x.id ? "checked" : ""}>
            <span class="type-body"><span class="type-ico" aria-hidden="true">${x.icon}</span><b>${esc(t(x.name))}</b>${lang === "en" ? "" : `<small>${esc(x.en)}</small>`}<em>${esc(t(x.desc))}</em></span></label>`).join("")}</div>
          <p class="hint">${t("切换房型会按该房型重新预选设施，可以再调整。")}</p>
        </fieldset>`,
    address: () => `
        <fieldset>
          <legend>${t("地址与建成年份")}</legend>
          <div class="form-grid">
            <label class="span-2">${t("地址")}<input name="address" maxlength="120" placeholder="${t("街道、城市、州 / 省")}" value="${esc(d.address || "")}"></label>
            <label>${t("建成年份（可选）")}<input name="year_built" type="number" inputmode="numeric" min="1850" max="${thisYear}" placeholder="${t("例如 1998")}" value="${d.year_built ?? ""}"></label>
          </div>
        </fieldset>`,
    insurance: () => insuranceFieldset(d),
    hoa: () => hoaFieldset(d),
    features: () => `
        <fieldset>
          <legend>${t("家里有这些设施")}</legend>
          <div class="check-grid">${check("features", Hh.forRegion(Hh.FEATURES, d.region), d.features || [])}</div>
        </fieldset>`,
    materials: () => `
        <fieldset>
          <legend>${t("外墙材料（可多选）")}</legend>
          <div class="check-grid">${check("exterior", Hh.forRegion(Hh.MATERIALS.exterior, d.region), d.exterior || [])}</div>
        </fieldset>
        <fieldset>
          <legend>${t("屋面")}</legend>
          <div class="check-grid">
            <label class="check"><input type="radio" name="roof" value="" ${!d.roof ? "checked" : ""}><span>${t("不清楚 / 不用管")}</span></label>
            ${Hh.forRegion(Hh.MATERIALS.roof, d.region).map((m) => `<label class="check"><input type="radio" name="roof" value="${m.id}" ${d.roof === m.id ? "checked" : ""}><span>${esc(t(m.name))}</span></label>`).join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>${t("地面材料（可多选）")}</legend>
          <div class="check-grid">${check("flooring", Hh.forRegion(Hh.MATERIALS.flooring, d.region), d.flooring || [])}</div>
        </fieldset>`,
  }[sec]();
  return `
    <section class="section form-page house-form">
      <form id="houseForm" class="panel" data-sec="${sec}" novalidate data-autosave>
        ${body}
        <p id="houseFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${t("保存")}</button>
          <a class="btn btn-ghost" href="${href("house", "profile")}" data-action="house-cancel">${t("取消")}</a>
        </div>
      </form>
    </section>`;
}

function insuranceFieldset(d) {
  return `
        <fieldset>
          <legend>${t("房屋保险")}</legend>
          <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="insured" ${d.insured ? "checked" : ""}><span>${t("有房屋保险（租住填租客保险）")}</span></label>
          <div class="form-grid">
            <label>${t("保险公司")}<input name="insurance_provider" maxlength="60" placeholder="${t("例如：State Farm")}" value="${esc(d.insurance_provider || "")}"></label>
            <label>${t("保单号")}<input name="insurance_policy" maxlength="60" value="${esc(d.insurance_policy || "")}"></label>
            <label>${t("生效日")}<input name="insurance_from" type="date" value="${esc(d.insurance_from || "")}"></label>
            <label>${t("到期日")}<input name="insurance_to" type="date" value="${esc(d.insurance_to || "")}"><small>${t("到期前 30 天提醒续保")}</small></label>
            <label class="span-2">${t("保障范围")}<input name="insurance_coverage" maxlength="200" placeholder="${t("例如：房屋 $400k、责任 $300k、自付额 $1,000")}" value="${esc(d.insurance_coverage || "")}"></label>
            <label>${t("年保费")}<input name="insurance_premium" type="number" inputmode="decimal" min="0" step="0.01" value="${d.insurance_premium ?? ""}"></label>
          </div>
          <h4 class="sub-legend">${t("理赔代理")}<small>${t("出险时直接联系的人，概览里可一键拨打 / 发邮件")}</small></h4>
          <div class="form-grid">
            <label>${t("代理 / 经纪人")}<input name="insurance_agent" maxlength="60" placeholder="${t("姓名或办公室")}" value="${esc(d.insurance_agent || "")}"></label>
            <label>${t("理赔电话")}<input name="insurance_phone" type="tel" maxlength="40" value="${esc(d.insurance_phone || "")}"></label>
            <label class="span-2">${t("理赔邮箱")}<input name="insurance_email" type="email" maxlength="120" value="${esc(d.insurance_email || "")}"></label>
          </div>
          <p class="hint">${t("只记摘要，不存保单文件；账单里的“房屋保险”负责缴费提醒，这里负责到期续保提醒。")}</p>
        </fieldset>`;
}

/* ── 推荐耗材（按模板批量添加） ── */
export function viewHouseTemplate() {
  const p = state.houseProfile;
  if (!p) return `<div class="panel empty"><strong>${t("先填写房屋资料")}</strong>${t("推荐清单会根据房型、设施和材料生成。")}<p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></p></div>`;
  const recs = H().recommendSupplies(p);
  const have = new Set(state.items.map((i) => i.name.trim()));
  const exists = (r) => have.has(r.name) || have.has(t(r.name));
  const groups = H().HOUSE_CATEGORIES.map((c) => ({ c, rows: recs.filter((r) => r.category === c.id) })).filter((g) => g.rows.length);
  const fresh = recs.filter((r) => !exists(r)).length;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("推荐的房屋耗材")}</h2><p>${t("根据你的房屋资料，共 {n} 项", { n: recs.length })}${fresh < recs.length ? t("，其中 {n} 项已经有了", { n: recs.length - fresh }) : ""}</p></div>
      <form id="templateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${t("加入后可以随时修改数量、少货线，或删除。")}</span>
        </div>
        ${groups.map(({ c, rows }) => `<fieldset class="tpl-group" style="--cat:${c.color}">
          <legend>${c.icon} ${t(c.name)}</legend>
          ${rows.map((r) => {
            const has = exists(r);
            const key = `${r.category}|${r.name}`;
            return `<label class="tpl-row ${has ? "is-have" : ""}">
              <input type="checkbox" name="tpl" value="${esc(key)}" ${has ? "disabled" : "checked"}>
              <span class="grow"><b>${esc(t(r.name))}</b>
                <small>${t("先备 {q} {u}", { q: r.qty, u: esc(t(r.unit)) })}${r.min ? t("，少于 {q} {u} 提醒", { q: r.min, u: esc(t(r.unit)) }) : ""}${r.every ? t("，约每 {d} 天用 1 {u}", { d: r.every, u: esc(t(r.unit)) }) : ""}</small>
                ${r.note ? `<small class="note">${esc(t(r.note))}</small>` : ""}</span>
              ${has ? `<span class="badge b-ok">${t("已有")}</span>` : ""}
            </label>`;
          }).join("")}
        </fieldset>`).join("")}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary" ${fresh ? "" : "disabled"}>${t("添加选中的耗材")}</button>
          <a class="btn btn-ghost" href="${href("house", "overview")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}

/** 把勾选的模板项转换成库存物品（名称、小类、单位、备注按当前语言写入，之后作为用户数据不再翻译） */
export function templateItems(keys) {
  const p = state.houseProfile, recs = H().recommendSupplies(p);
  return recs.filter((r) => keys.includes(`${r.category}|${r.name}`)).map((r) => ({
    name: t(r.name), category: r.category, subcategory: r.sub || null, unit: t(r.unit), quantity: r.qty, min_quantity: r.min || 0,
    location: r.loc || null, expiry_date: null, lead_days: 14, avg_daily_use: r.avg_daily_use, notes: r.note ? t(r.note) : null,
  }));
}
