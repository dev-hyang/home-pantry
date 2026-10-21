/* 提醒总线：各模块把自己的提醒翻译成统一形状并注册，首页、网页标题、浏览器通知（以后还有邮件摘要）都从这里取同一份数据。
 * 提醒项：{ source, severity, must, due, daysLeft, title, detail, property_id, assigned_to, href, badge?, actions }
 *   severity：0 紧急（逾期）/ 1 今天 / 2 尽快（一周内、待核对、缺货）/ 3 留意（少货、临期、季节任务）
 *   actions：{ type: "link", href, label, cls?, external? } | { type: "button", action, id, label, cls? } | { type: "check", attrs } | { type: "tag", label, cls?, href? }（状态标签，如“已加入采购”）
 * 房产归属：多于一套活跃房产时统一加房产芯片（propertyTag），单套不显示。 */
import { state } from "./state.js";
import { esc } from "./util.js";
import { t } from "./i18n.js";

export const SEVERITY_LABEL = ["紧急", "今天", "尽快", "留意"];
export const SEVERITY_CLS = ["b-out", "b-low", "b-soon", "b-ok"];
export const SOURCE_LABEL = { bill: "账单", deal: "交易", asset: "设备", season: "季节任务", pantry: "储藏", house: "房屋耗材", budget: "预算" };
export const SOURCE_ICON = { bill: "🧾", deal: "📝", asset: "⚙️", season: "📅", pantry: "🥫", house: "🧰", budget: "💰" };

const providers = [];
export const registerAlerts = (fn) => { providers.push(fn); };

/** 汇总全部提醒：严重度 → 必须项 → 到期早的在前 */
export function collectAlerts() {
  const out = [];
  for (const p of providers) {
    try { out.push(...(p() || [])); } catch (e) { console.error("[alerts]", e); }
  }
  // 带房产的房屋类提醒：链接加上 ?prop=，点进去先切到那套房产
  const withProp = (h, pid) => (h && pid && h.startsWith("#/house") && !h.includes("?") ? `${h}?prop=${pid}` : h);
  for (const it of out) if (it.property_id) { it.href = withProp(it.href, it.property_id); for (const a of it.actions || []) if (a.type === "link") a.href = withProp(a.href, it.property_id); }
  return out.sort((a, b) => a.severity - b.severity || (b.must ? 1 : 0) - (a.must ? 1 : 0) || (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}

export const liveProperties = () => state.properties.filter((p) => !p.archived);
export const multiProperty = () => liveProperties().length > 1;
export const propertyName = (id) => state.properties.find((p) => p.id === id)?.name || "";
/** 房产芯片：多套房产时才显示 */
export function propertyTag(id, { always = false } = {}) {
  if (!id || (!always && !multiProperty())) return "";
  const n = propertyName(id);
  return n ? `<span class="space-tag">🏠 ${esc(n)}</span>` : "";
}
/** 文案里的房产前缀，例如 toast：“出租房 1 · 电费” */
export const withProperty = (id, text) => (multiProperty() && propertyName(id) ? `${propertyName(id)} · ${text}` : text);

/** 按来源、严重度计数 */
export function alertCounts(list) {
  const bySeverity = [0, 0, 0, 0], bySource = {};
  for (const it of list) { bySeverity[it.severity]++; bySource[it.source] = (bySource[it.source] || 0) + 1; }
  return { bySeverity, bySource, total: list.length, important: bySeverity[0] + bySeverity[1] + bySeverity[2] };
}

/** 通用一行：复选框类提醒用勾选框代替徽章 */
export function alertRow(it) {
  const check = (it.actions || []).find((a) => a.type === "check");
  const lead = check
    ? `<input type="checkbox" ${Object.entries(check.attrs || {}).map(([k, v]) => `${k}="${esc(v)}"`).join(" ")}>`
    : `<span class="badge ${it.badge?.cls || SEVERITY_CLS[it.severity]}">${esc(it.badge?.label || t(SEVERITY_LABEL[it.severity]))}</span>`;
  const title = it.href ? `<a class="link-name" href="${esc(it.href)}">${esc(it.title)}</a>` : `<span class="name">${esc(it.title)}</span>`;
  const acts = (it.actions || []).filter((a) => a.type !== "check").map((a) => a.type === "link"
    ? `<a class="btn btn-sm ${a.cls || ""}" href="${esc(a.href)}" ${a.external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(a.label)}</a>`
    : a.type === "tag" ? (a.href ? `<a class="badge ${a.cls || "b-ok"} act-tag" href="${esc(a.href)}">✓ ${esc(a.label)}</a>` : `<span class="badge ${a.cls || "b-ok"} act-tag">✓ ${esc(a.label)}</span>`)
    : `<button type="button" class="btn btn-sm ${a.cls || ""}" data-action="${esc(a.action)}" data-id="${esc(a.id || "")}">${esc(a.label)}</button>`).join("");
  return `<li class="alert-row sev-${it.severity}">${lead}<div class="grow">${propertyTag(it.property_id)}${it.must ? `<span class="badge b-out" style="margin-right:4px">${t("必须")}</span>` : ""}${title}<small>${esc(it.detail || "")}</small></div>${acts}</li>`;
}
