/* 房屋资料的分区清单（地址、保险、HOA、应急、材料…）和每个分区的完成度、保险事实。 */
import { EMERGENCY_FIELDS, emergencyFilled } from "./house-draft.js";
import { activeProperties } from "../core/lifecycle.js";
import { assessmentStatus, curPid, hoaFact, hoaOf, hoaRegular, insurancePremium, ownershipOf } from "./house-fees.js";
import { currentProp } from "./deals.js";
import { daysUntil, esc, fmtDate, money } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { H } from "./asset-common.js";

/* ── 资料分区：列表页显示完成度，点进去只改一块 ── */
/** 房屋资料各块的「问咩咩」问题 */
export const PROFILE_ASK = { type: "我这种房型通常要自己负责哪些维护？", address: "建成年份从哪查？老房子要特别注意什么？", insurance: "我这种房子买哪种保险、保额怎么定？保单上这些项是什么意思？",
  hoa: "HOA 月费一般包含什么？特殊评估、出租限制、储备金这些怎么看？", emergency: "总水阀、燃气阀、配电箱一般在哪？怎么关？", features: "家里这些设施各自要做什么日常保养？", materials: "这几种外墙 / 屋面 / 地面材料各要注意什么？",
  ownership: "缴税号（PIN）在哪查？车位是否 deeded、税务减免怎么申请？" };
export const PROFILE_SECTIONS = [
  { id: "type", icon: "🏡", name: "地区、房型与用途" },
  { id: "address", icon: "📍", name: "地址与建成年份" },
  { id: "insurance", icon: "🛡️", name: "房屋保险" },
  { id: "hoa", icon: "🏘️", name: "HOA / 物业" },
  { id: "ownership", icon: "📜", name: "产权、税务与车位" },
  { id: "emergency", icon: "🚨", name: "应急信息与关键位置" },
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
      const n = filled([d.insurance_provider, d.insurance_policy, d.insurance_from, d.insurance_to, d.insurance_coverage, insurancePremium(curPid(), d).src === "bill", d.insurance_agent, d.insurance_phone, d.insurance_email]);
      return { text: `${n} / 9`, pct: Math.round((n / 9) * 100) };
    }
    case "hoa": {
      const h = hoaOf(d); if (!h.enabled) return { text: t("无 {label}", { label: t(Hh.assocOf(d.house_type).label) }), pct: null };
      const n = filled([h.name, h.mgmt, h.phone || h.email || h.url, hoaRegular(curPid(), h).src === "bill", h.rules, h.rent_policy && h.rent_policy !== "unknown"]);
      return { text: `${n} / 6${assessmentStatus(h, curPid()).kind === "due" ? ` · ${t("特别摊派待缴")}` : ""}${h.lawsuit ? ` · ${t("有诉讼")}` : ""}`, pct: Math.round(n / 6 * 100) };
    }
    case "ownership": {
      const o = ownershipOf(d), n = filled([o.pin, o.parking_type, o.parking_type && o.parking_type !== "none" && (o.parking_pin || o.parking_no || o.parking_deeded), o.storage_type, (o.tax_exemptions || []).length]);
      return { text: n ? `${n} / 5${o.parking_deeded ? ` · ${t("车位有独立产权")}` : ""}` : t("未填"), pct: n * 20 };
    }
    case "emergency": { const n = emergencyFilled(d); return { text: n ? t("{n} / {m}", { n, m: EMERGENCY_FIELDS.length }) : t("未填"), pct: Math.round((n / EMERGENCY_FIELDS.length) * 100) }; }
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
  const prem = insurancePremium(curPid(), p);   // 年保费：保险账单是唯一来源
  if (prem.amount != null) bits.push(`${t("年保费 {a}", { a: money(prem.amount) })}${prem.src === "profile" ? ` <small class="muted">${t("（资料里的旧值）")}</small>` : ""}`);
  return { k, v: bits.join(" · "), sub: agentValue(p) };
}
/** 保险分行显示（资料页卡片和概览用同一份）：[[标签, HTML]]；没有投保 / 没填的行不出现 */
export function insuranceRows(p) {
  const s = insuranceStatus(p), [cls, label] = INS_BADGE[s.kind];
  if (s.kind === "none") return [];
  const period = p.insurance_from || p.insurance_to ? `${p.insurance_from ? fmtDate(p.insurance_from) : "…"} – ${p.insurance_to ? fmtDate(p.insurance_to) : "…"}` : "";
  const prem = insurancePremium(curPid(), p);   // 年保费：保险账单是唯一来源
  const agent = agentValue(p).replace(/^[^：:]*[：:]/, "");
  return [
    [t("保险状态"), `<span class="badge ${cls}">${t(label)}${s.kind === "expiring" ? ` · ${t("{d} 天", { d: s.days })}` : ""}</span>${period ? ` ${esc(period)}` : ""}`],
    [t("保险公司"), p.insurance_provider ? `<b>${esc(p.insurance_provider)}</b>` : ""],
    [t("保单号"), p.insurance_policy ? esc(p.insurance_policy) : ""],
    [t("保障范围"), p.insurance_coverage ? `<span class="pre">${esc(p.insurance_coverage)}</span>` : ""],
    [t("年保费"), prem.amount != null ? `${money(prem.amount)}${prem.src === "profile" ? ` <small class="muted">${t("（资料里的旧值）")}</small>` : ""}` : ""],
    [t("理赔代理"), agent],
  ].filter(([, v]) => v);
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
  return activeProperties().flatMap((prop) => {
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
/** 房屋卡片的事实行：main = 地址 / 保险 / HOA（常要查的），more = 材料 / 设施（填过就不常看，折叠） */
export function houseFacts(p, { ext, roof, floors, featNames }) {
  const main = [], more = [];
  const addr = currentProp()?.address;
  main.push({ k: `📍 ${t("地址")}`, v: addr ? esc(addr) : `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充")}</a>`, wide: true });
  if (insuranceStatus(p).kind === "none") main.push({ ...insuranceFact(p), wide: true });
  else for (const [k, v] of insuranceRows(p)) main.push({ k, v, wide: true });
  const hoa = hoaFact(p); if (hoa) main.push({ ...hoa, wide: true });
  const mats = [...ext, ...roof, ...floors];
  more.push({ k: `🧱 ${t("材料")}`, v: mats.length ? `<span class="tagline">${mats.map((m) => `<span class="tag">${esc(t(m.name))}</span>`).join("")}</span>` : `<span class="muted">${t("未填")}</span> <a href="${href("house", "profile")}">${t("补充材料")}</a>`, wide: true });
  if (featNames.length) more.push({ k: `🔧 ${t("设施")}`, v: `<span class="tagline">${featNames.map((n) => `<span class="tag tag-soft">${esc(n)}</span>`).join("")}</span>`, wide: true });
  return { main, more, count: mats.length + featNames.length };
}
