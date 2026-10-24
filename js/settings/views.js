import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, catsOf, esc, fmtShort, syncState, toast } from "../core/util.js";
import { catFormHtml } from "../pantry/views.js";
import { LANGS, detectLang, glossaryOf, langOverride, t } from "../core/i18n.js";
import { propertyForm } from "../house/property-form.js";
import { href } from "../core/router.js";
import { AUTH_STYLES, FREE_TIER, PROVIDERS, aiIcon, aiQuota, aiReady, aiSettings, autoModel, effective, providerOf, quotaStatus, saveAiSettings, deadModels, blockedModels, FREE_MODELS, FREE_MODELS_AS_OF, aiChanges, catalogAgeDays, listModels, modelInfo } from "../core/ai.js";
import { modelsCachedAt } from "../core/ai.js";
import { CUSTOM_GROUP, customLocations, locationGroups, locationUsage } from "../core/locations.js";
import { viewPrintSettings } from "./print.js";
import { incomePanel } from "./income.js";
import { budgetPlan, isHouseholdOwner, myId } from "../bills/budget.js";

/** 当前用户是否家主（household_members.role = owner） */
export const isOwner = () => state.members.some((m) => m.user_id === state.user?.id && m.role === "owner");

/** 家庭成员列表：家主能设 / 取消家主、移出成员；不能对自己操作（退出走“退出登录”），最后一位家主不能被取消或移出（数据库同样校验） */
function membersList() {
  const me = state.user?.id, owner = isOwner();
  const owners = state.members.filter((m) => m.role === "owner").length;
  return `<ul class="member-list">${state.members.map((m) => {
    const self = m.user_id === me, isO = m.role === "owner";
    // 家主正在改某位家人的称呼：这一行换成内联表单
    if (owner && !self && state.editMember === m.user_id) {
      return `<li><form class="member-rename" data-id="${m.user_id}">
        <input name="display_name" required maxlength="20" value="${esc(m.display_name)}" aria-label="${t("家人的称呼")}">
        <button class="btn btn-sm btn-primary" type="submit">${t("保存")}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="member-rename" data-id="">${t("取消")}</button></form></li>`;
    }
    const acts = owner && !self ? `<span class="head-acts">
        <button type="button" class="btn btn-sm btn-ghost" data-action="member-rename" data-id="${m.user_id}">${t("改称呼")}</button>
        ${isO ? (owners > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="member-role" data-id="${m.user_id}" data-role="member">${t("取消家主")}</button>` : "")
              : `<button type="button" class="btn btn-sm btn-ghost" data-action="member-role" data-id="${m.user_id}" data-role="owner">${t("设为家主")}</button>`}
        ${!isO || owners > 1 ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-remove" data-id="${m.user_id}">${t("移出家庭")}</button>` : ""}
      </span>` : "";
    return `<li><div class="grow"><b>${esc(m.display_name)}</b>${isO ? ` <span class="badge b-ok">${t("家主")}</span>` : ""}${self ? ` <span class="muted">${t("（我）")}</span>` : ""}
      ${m.joined_at ? `<small class="muted">${t("{d} 加入", { d: fmtShort(m.joined_at) })}</small>` : ""}</div>${acts}</li>`;
  }).join("")}</ul>`;
}

/** 房产列表：改名、设默认、归档；编辑中的那行换成内联表单（表单与房屋页共用 property-form.js） */
function propertiesPanel() {
  const B = window.BILLS;
  const form = propertyForm;
  const del = (p) => `<form id="propertyDeleteForm" class="prop-form" style="width:100%">
      <input type="hidden" name="property_id" value="${esc(p.id)}">
      <p class="muted" style="font-size:13px;margin:0 0 6px">${t("彻底删除“{name}”会连同它的账单与缴费记录、设备与保养记录、季节任务、房屋资料、交易一起删除，不能恢复。花费统计里的记录会保留。输入房产名确认：", { name: esc(p.name) })}</p>
      <div class="member-rename"><input name="confirm_name" required maxlength="40" placeholder="${esc(p.name)}" aria-label="${t("输入房产名确认")}">
        <button class="btn btn-sm btn-danger-ghost" type="submit">${t("确认彻底删除")}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="property-delete-cancel">${t("取消")}</button></div></form>`;
  const rows = state.properties.map((p) => state.editProperty === p.id ? `<li>${form(p)}</li>` : state.deleteProperty === p.id ? `<li>${del(p)}</li>` : `<li class="${p.archived ? "inactive" : ""}">
      <div class="grow"><b>${esc(p.name)}</b>${p.is_default ? ` <span class="badge b-ok">${t("默认")}</span>` : ""} <span class="badge" style="background:var(--surface-2)">${t(window.DEALS.PROPERTY_STATUS[p.status] || "持有")}</span>${p.archived ? ` <span class="badge" style="background:var(--surface-2)">${t("已归档")}</span>` : ""}
        <small>${[t(B.PROPERTY_KINDS[p.kind] || ""), t(B.PROPERTY_ROLES[p.role] || ""), p.address].filter(Boolean).map(esc).join(" · ")}</small></div>
      <span class="head-acts">
        <button type="button" class="btn btn-sm btn-ghost" data-action="property-edit" data-id="${p.id}">${t("编辑")}</button>
        ${!p.is_default && !p.archived ? `<button type="button" class="btn btn-sm btn-ghost" data-action="property-default" data-id="${p.id}">${t("设为默认")}</button>` : ""}
        ${!p.is_default ? `<button type="button" class="btn btn-sm ${p.archived ? "" : "btn-danger-ghost"}" data-action="property-archive" data-id="${p.id}">${p.archived ? t("恢复") : t("归档")}</button>` : ""}
        ${p.archived ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="property-delete" data-id="${p.id}">${t("彻底删除")}</button>` : ""}
      </span></li>`).join("");
  return `<div class="panel">
    <div class="kv"><div><b>${t("房产")}</b><div class="muted">${t("房屋资料、设备、季节任务和账单都按房产区分；房东可以加出租房")}</div></div>
      ${state.editProperty === "new" ? "" : `<button type="button" class="btn btn-sm" data-action="property-edit" data-id="">${t("添加房产")}</button>`}</div>
    <ul class="property-list" style="margin-top:10px">${rows}${state.editProperty === "new" ? `<li>${form(null)}</li>` : ""}</ul>
  </div>`;
}

/** 姐妹站点：和顶栏切换器同一份数据（data.js 的 SISTER_APPS） */
function sisterAppsPanel() {
  const list = window.SISTER_APPS || []; if (list.length < 2) return "";
  return `<div class="panel">
    <div class="kv"><div><b>${t("姐妹站点")}</b><div class="muted">${t("同一作者的其他小工具；顶栏站名旁的「‹」「›」小胶囊也能切换")}</div></div></div>
    <ul class="app-list">${list.map((a) => `<li class="${a.id === "home-pantry" ? "current" : ""}">
      <span class="app-ico" aria-hidden="true">${a.icon}</span>
      <div class="grow"><b>${esc(t(a.name))}</b><small>${esc(t(a.sub))}</small></div>
      ${a.id === "home-pantry" ? `<span class="badge b-ok">${t("当前")}</span>` : `<a class="btn btn-sm" href="${esc(a.url)}">${t("打开")}</a>`}</li>`).join("")}</ul>
  </div>`;
}

/* ── 自定义名称的翻译：收集家庭自己起的名字（自定义位置、自建 / 改过的分类名、自加的小类），每条填简体 / English / 繁體 ── */
/** 被跳过的模型（对这个 key 已下线 / 这个模型的额度用完了）：列出来，免得以为是本地计数的问题；可一键清除重新试 */
function modelMarks() {
  const dead = Object.keys(deadModels()), blk = Object.entries(blockedModels());
  if (!dead.length && !blk.length) return "";
  const clock = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `<p class="muted" style="margin:0 0 8px;font-size:13px">${t("已自动跳过的模型：")}${[...dead.map((m) => `${esc(m)}（${t("已下线，24 小时内不再试")}）`), ...blk.map(([m, u]) => `${esc(m)}（${t("额度用完，{time} 恢复", { time: clock(u) })}）`)].join("；")}
    <button type="button" class="btn btn-sm btn-ghost" data-action="ai-marks-clear">${t("清除，重新试")}</button></p>`;
}
export function customTerms() {
  const out = new Map();   // term → 来源说明
  const add = (term, src) => { if (term && !out.has(term)) out.set(term, src); };
  for (const l of customLocations()) add(l.name, t("存放位置"));
  for (const c of CATEGORIES) {
    if (c.custom) { add(c.name, t("分类")); for (const s of c.subs || []) add(s, t("小类")); }
    else if (c.overridden) { if (c.name !== c.base.name) add(c.name, t("分类")); for (const s of c.subs || []) if (!(c.base.subs || []).includes(s)) add(s, t("小类")); }
  }
  return [...out.entries()];
}
function termsPanel() {
  const terms = customTerms();
  const cell = (term, k, ph) => { const g = glossaryOf(term) || {}; return `<td><input name="${k}" maxlength="60" value="${esc(g[k] || "")}" placeholder="${esc(ph)}"></td>`; };
  return `<form id="termsForm" class="panel">
    <div class="section-head" style="margin-bottom:6px"><h3 style="font-size:15px">${t("自定义名称的翻译")}</h3><p>${t("自己起的位置、分类、小类在其他语言下怎么叫；留空就按原文显示（繁體由简体自动转换）")}</p></div>
    ${terms.length ? `<div class="ch-scroll"><table class="owner-table terms-table"><thead><tr><th>${t("原名")}</th><th>简体</th><th>English</th><th>繁體</th></tr></thead><tbody>
      ${terms.map(([term, src]) => `<tr data-term="${esc(term)}"><th scope="row">${esc(term)}<small>${esc(src)}</small></th>${cell(term, "zh", term)}${cell(term, "en", "")}${cell(term, "hant", t("自动"))}</tr>`).join("")}
    </tbody></table></div>
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("保存翻译")}</button></div>`
    : `<p class="muted" style="margin:0;font-size:13px">${t("还没有自己起的名字。新建位置或分类后会出现在这里。")}</p>`}
  </form>`;
}

/* ── 分类与小类：按空间列出全部分类（含隐藏的）；点“编辑”用和库存页同一个表单改名、换图标颜色、增删小类；内置分类可恢复默认或隐藏 ── */
function categoriesPanel() {
  const cf = state.catForm;
  const spaces = [["pantry", "日常储备"], ["house", "房屋耗材"], ["gear", "装备"]].filter(([s]) => s !== "gear" || state.gearEnabled);
  const row = (c) => {
    const n = state.items.filter((i) => i.category === c.id).length;
    const tag = c.custom ? `<span class="badge b-ok">${t("自建")}</span>` : c.overridden ? `<span class="badge b-soon">${t("改过")}</span>` : "";
    return `<li class="${c.hidden ? "inactive" : ""}"><span class="mi" style="--cat:${c.color}" aria-hidden="true">${c.icon}</span>
      <span class="grow"><b>${esc(t(c.name))}</b> ${tag}${c.hidden ? ` <span class="badge" style="background:var(--surface-2)">${t("已隐藏")}</span>` : ""}
        <small>${(c.subs || []).length ? esc((c.subs || []).map((s) => t(s)).join(" · ")) : t("没有小类")}${n ? ` · ${t("{n} 件", { n })}` : ""}</small></span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${c.id}">${t("编辑")}</button></li>`;
  };
  return `${cf ? catFormHtml(cf) : ""}
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("大类决定方块、筛选和统计；小类是物品表单里的下拉。内置分类也能改名、增删小类或隐藏，自建的可删除，全家共用。")}</p>
    ${spaces.map(([s, name]) => `<div class="panel loc-group"><div class="section-head" style="margin-bottom:4px"><h3 style="font-size:15px">${t(name)}</h3>
        <button type="button" class="btn btn-sm btn-ghost" data-action="cat-new" data-space="${s}">＋ ${t("新分类")}</button></div>
      <ul class="member-list loc-list cat-list">${catsOf(s, { withHidden: true }).map(row).join("")}</ul></div>`).join("")}`;
}

/* ── 存放位置：按房间分组列出内置 + 自定义；可新增、重命名（内置也能改名，如“客卧 1 衣柜”→“Emma 的房间”）、删除自定义 ── */
function locationsPanel() {
  const lf = state.locForm;
  const groups = locationGroups();
  const grpOpts = [...window.LOCATION_GROUPS, CUSTOM_GROUP].map((g) => `<option value="${g.id}" ${(lf?.grp || "custom") === g.id ? "selected" : ""}>${esc(t(g.name))}</option>`).join("");
  const form = lf ? `<form id="locForm" class="panel">
      <div class="section-head" style="margin-bottom:8px"><h3 style="font-size:16px">${lf.oldName ? t("重命名：{name}", { name: t(lf.oldName) }) : t("新位置")}</h3>
        <p>${lf.oldName ? t("用到这个位置的物品和设备会一起改名") : t("会出现在物品 / 设备的位置下拉里，全家共用")}</p></div>
      <div class="form-grid">
        <label>${t("位置名")}<input name="name" required maxlength="20" placeholder="${t("例如：Emma 的房间、车库架子")}" value="${esc(lf.name || "")}"></label>
        <label>${t("所在分组")}<select name="grp">${grpOpts}</select></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("保存")}</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="loc-cancel">${t("取消")}</button>
        ${lf.id ? `<span class="spacer"></span><button type="button" class="btn btn-sm btn-danger-ghost" data-action="loc-del" data-id="${lf.id}">${t("删除")}</button>` : ""}</div>
    </form>` : "";
  const row = (l) => { const n = locationUsage(state, l.name); return `<li><span class="grow"><b>${esc(t(l.name))}</b>${l.custom ? ` <span class="badge b-ok">${l.replaces ? t("已改名") : t("自定义")}</span>` : ""}<small>${n ? t("{n} 件物品 / 设备", { n }) : t("还没放东西")}${l.replaces ? ` · ${t("原为“{name}”", { name: t(l.replaces) })}` : ""}</small></span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="loc-edit" data-name="${esc(l.name)}">${t("重命名")}</button></li>`; };
  return `${form}
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("按房间分组，物品 / 设备的位置下拉也按这个分组显示；下拉末尾的“＋ 新位置…”可以边填边加。")}</p>
    ${groups.map((g) => `<div class="panel loc-group"><div class="section-head" style="margin-bottom:4px"><h3 style="font-size:15px">${esc(t(g.name))}</h3>
        <button type="button" class="btn btn-sm btn-ghost" data-action="loc-new" data-grp="${g.id}">＋ ${t("新位置")}</button></div>
      <ul class="member-list loc-list">${g.locs.map(row).join("")}</ul></div>`).join("")}
    ${groups.some((g) => g.id === "custom") ? "" : `<div class="form-actions"><button type="button" class="btn btn-sm" data-action="loc-new" data-grp="custom">＋ ${t("新位置")}</button></div>`}`;
}

/* ── 设置：目录页（每块一行，带当前状态）→ 点进去只看那一块 ── */
export const SETTING_SECTIONS = [
  { id: "family", icon: "👨‍👩‍👧", name: "家庭与成员" },
  { id: "properties", icon: "🏠", name: "房产" },
  { id: "income", icon: "💰", name: "收入与预算" },
  { id: "prefs", icon: "🌐", name: "语言、地区与单位" },
  { id: "categories", icon: "🗂️", name: "分类与小类" },
  { id: "locations", icon: "📍", name: "存放位置" },
  { id: "modules", icon: "🧩", name: "模块开关" },
  { id: "print", icon: "🖨️", name: "打印" },
  { id: "data", icon: "💾", name: "通知与备份" },
  { id: "ai", icon: "__AI__", name: "AI 助手" },
  { id: "apps", icon: "🔗", name: "姐妹站点与介绍" },
];
/** AI 设置：模型、key（只存本机）、人数；提交与“测试连接”共用 */
export async function saveAiForm(f) {
  const fe = f.elements, s = aiSettings();
  Object.assign(s, { provider: fe.provider.value, key: fe.key.value.trim(), model: fe.model.value.trim(), base: fe.base.value.trim(), people: +fe.people.value || 4, auth: fe.auth?.value || "bearer",
    freeOnly: !!fe.freeOnly?.checked, rpm: fe.rpm?.value === "" ? "" : Math.max(0, +fe.rpm.value || 0), rpd: fe.rpd?.value === "" ? "" : Math.max(0, +fe.rpd.value || 0) });
  saveAiSettings(s);
}
/** 免费额度：只用免费额度开关、每分钟 / 每天上限、今天用了多少、下次可用时间 */
function quotaBlock(s, p) {
  const tier = FREE_TIER[p.id], q = aiQuota(s);
  return `<fieldset class="quota-box">
    <legend>${t("免费额度")}</legend>
    <p class="${q.ok ? "muted" : "form-error"}" style="margin:0 0 8px;font-size:13px">${esc(quotaStatus(q))}${tier ? ` · ${t(tier.resetText)}` : ""}</p>
    ${modelMarks()}
    <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="freeOnly" ${s.freeOnly !== false ? "checked" : ""}><span>${t("只用免费额度：到上限就不再发请求，并提示下次可用时间")}</span></label>
    <div class="form-grid">
      <label>${t("每分钟上限（次）")}<input name="rpm" type="number" inputmode="numeric" min="0" max="1000" placeholder="${tier?.rpm ?? t("不限")}" value="${esc(s.rpm ?? "")}"></label>
      <label>${t("每天上限（次）")}<input name="rpd" type="number" inputmode="numeric" min="0" max="100000" placeholder="${tier?.rpd ?? t("不限")}" value="${esc(s.rpd ?? "")}"><small>${tier ? t("留空用默认值（各家公布的免费档，会变，以控制台为准）") : t("这个服务没有免费档；留空不限制，或按你买的额度填")}</small></label>
    </div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-action="ai-usage-reset" data-provider="${p.id}">${t("重置计数")}</button>
      <small class="muted">${t("计数只在本机浏览器里，换设备或家人各自计")}</small></div>
  </fieldset>`;
}
/* ── 模型下拉：常用免费模型目录（带上限）+ 这个 key 实际能用的列表（画出来后后台查，缓存一天）；没有目录的服务商仍是手填 ── */
const modelOption = (pid, m, cur) => {
  const lim = m.rpm ? ` · ${t("{a}/分 · {b}/天", { a: m.rpm, b: m.rpd })}` : m.live ? ` · ${t("上限以控制台为准")}` : "";
  return `<option value="${esc(m.id)}" ${m.id === cur ? "selected" : ""} ${m.dead ? "disabled" : ""}>${esc(m.name)}${m.name !== m.id ? ` (${esc(m.id)})` : ""}${lim}${m.dead ? `（${t("这个 key 已不可用")}）` : ""}</option>`;
};
export const modelOptionsHtml = (pid, list, cur, custom) => `<option value="">${t("自动：按这个 key 能用的模型自动选（推荐）")}</option>${list.map((m) => modelOption(pid, m, custom ? "" : cur)).join("")}${cur && !custom && !list.some((m) => m.id === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ""}<option value="__custom" ${custom ? "selected" : ""}>${t("其他（手填模型名）…")}</option>`;
export function limitHint(pid, id) {
  if (!id) return t("自动：按可用列表从新到旧试，某个模型超限或下线会自动换下一个。上限用下面的默认值。");
  const m = modelInfo(pid, id);
  if (m?.rpm) return t("免费档公布值：每分钟 {a} 次、每天 {b} 次，已带入下面的上限（会变，以控制台为准）。它超限或下线时仍会自动换别的模型。", { a: m.rpm, b: m.rpd });
  return t("这个模型的免费上限目录里没有：下面的上限留空用默认值，或按控制台 Rate limits 页手填。");
}
function modelField(s, p) {
  if (!FREE_MODELS[p.id]) return `<label>${t("模型名（留空用默认）")}<input name="model" maxlength="80" placeholder="${esc(autoModel(p.id) || p.model)}" value="${esc(s.model)}"></label>`;
  const cur = s.model || "", list = FREE_MODELS[p.id].filter((m) => m.free !== false).map((m) => ({ ...m, live: false })), custom = !!cur && !list.some((m) => m.id === cur) && !(autoModel(p.id) === cur);
  return `<label class="span-2">${t("模型")}<select name="modelSel" data-provider="${p.id}">${modelOptionsHtml(p.id, list, cur, custom)}</select>
      <small id="modelLimitHint">${limitHint(p.id, custom ? "" : cur)}</small></label>
    <div class="span-2 model-refresh"><button type="button" class="btn btn-sm btn-ghost" id="modelRefreshBtn" data-action="ai-models-refresh">↻ ${t("刷新模型列表")}</button><small id="modelListNote" class="muted">${t("正在查这个 key 实际能用的模型…")}</small></div>
    <div class="span-2" id="modelNotices">${modelNotices(p.id, cur, null)}</div>
    <label class="span-2" id="modelCustomWrap" ${custom ? "" : "hidden"}>${t("模型名（照服务商控制台里的写）")}<input name="model" maxlength="80" placeholder="${esc(p.model)}" value="${esc(cur)}"></label>`;
}
/** 目录 / 模型列表 / 额度和现实对不上时的提醒；live = 刚查到的实际列表（没查到是 null） */
export function modelNotices(pid, cur, live) {
  const age = catalogAgeDays(), rows = [];
  const fld = { rpd: t("每天"), rpm: t("每分钟") };
  for (const c of aiChanges(pid)) {
    if (c.type === "limit") rows.push(`⚠️ ${t("Google 返回的 {m} {f}上限是 {n} 次，目录里是 {w}，已按实际的更新。", { m: esc(c.model), f: fld[c.field], n: c.now, w: c.was ?? t("没有") })}`);
    else rows.push(`🔔 ${t("这个 key 的模型列表有变化：")}${c.added?.length ? ` ${t("新增")} ${c.added.map(esc).join("、")}` : ""}${c.removed?.length ? ` ${t("下线")} ${c.removed.map(esc).join("、")}` : ""}`);
  }
  if (cur && live && !live.some((m) => m.id === cur && m.live)) rows.push(`⚠️ ${t("你选的 {m} 已不在这个 key 的可用列表里，会自动换别的模型；建议改选“自动”或另一个。", { m: esc(cur) })}`);
  const ageTxt = FREE_MODELS[pid] ? t("免费上限目录更新于 {d}（{n} 天前）", { d: FREE_MODELS_AS_OF, n: age }) + (age > 45 ? `，${t("可能已过期，上限以控制台为准")}` : "") : "";
  return `${rows.length ? `<div class="notice-box" role="status">${rows.map((r) => `<p>${r}</p>`).join("")}<button type="button" class="btn btn-sm btn-ghost" data-action="ai-notice-dismiss" data-provider="${pid}">${t("知道了")}</button></div>` : ""}
    ${ageTxt ? `<p class="muted" style="margin:6px 0 0;font-size:12.5px">${ageTxt}</p>` : ""}`;
}
/** 画出设置页后：后台查实际可用的模型，把下拉换成真实列表（选中项不变） */
export async function hydrateModelSelect({ refresh = false } = {}) {
  const sel = document.querySelector("#aiSettingsForm [name=modelSel]"); if (!sel) return false;
  const pid = sel.dataset.provider, btn = document.getElementById("modelRefreshBtn"), before = modelsCachedAt(pid);
  if (btn) btn.disabled = true;
  let list; try { list = await listModels(pid, { refresh }); } finally { if (btn) btn.disabled = false; }
  const sel2 = document.querySelector("#aiSettingsForm [name=modelSel]"); if (!sel2 || sel2.dataset.provider !== pid) return false;
  const shown = list.filter((m) => m.free !== false);   // 免费档额度为 0 的不列（Pro、2 Flash 等）
  const custom = sel2.value === "__custom", cur = sel2.form.elements.model.value.trim();
  sel2.innerHTML = modelOptionsHtml(pid, shown, cur, custom);
  const nb = document.getElementById("modelNotices"); if (nb) nb.innerHTML = modelNotices(pid, cur, list);   // 刚查到的列表可能带来新的“下线 / 新增”提醒
  const note = document.getElementById("modelListNote");
  const at = modelsCachedAt(pid), when = at ? new Date(at).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  if (note) note.textContent = list.some((m) => m.live) ? t("列表是这个 key 实际能用的模型（每天自动查一次，也可手动刷新；上次 {when}）；灰色的是已对这个 key 下线的。", { when }) : t("还没查到实际列表（填好 key 并保存后会查），先列常用的。");
  return at > before;   // 这次真的查到了新列表
}
/** 下拉选了模型：同步到隐藏的模型名输入框，带入上限，自动保存 */
export async function onModelPick(sel) {
  const f = sel.form, wrap = document.getElementById("modelCustomWrap"), custom = sel.value === "__custom", pid = sel.dataset.provider;
  wrap.hidden = !custom;
  if (custom) { f.elements.model.value = ""; f.elements.model.focus(); return; }
  f.elements.model.value = sel.value;
  const m = modelInfo(pid, sel.value);
  f.elements.rpm.value = m?.rpm ? m.rpm : ""; f.elements.rpd.value = m?.rpd ? m.rpd : "";
  const h = document.getElementById("modelLimitHint"); if (h) h.textContent = limitHint(pid, sel.value);
  await saveAiForm(f); toast(sel.value ? t("已选 {m}，上限已带入并保存", { m: sel.value }) : t("已改回自动选模型"));
}
function aiBlock() {
  const s = aiSettings(), p = providerOf(s.provider), custom = p.id === "custom";
  const COST = { free: t("免费额度"), cheapest: t("最便宜"), cheap: t("便宜"), mid: t("中等") };
  return `<form id="aiSettingsForm" class="panel">
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("key 只保存在这台设备的浏览器里，不进仓库也不进数据库；浏览器直连模型，家人各自填自己的。没填 key 时菜单助手会改成“复制提示词”模式，照样能用。")}</p>
    <div class="form-grid">
      <label>${t("模型服务")}<select name="provider">${PROVIDERS.map((x) => `<option value="${x.id}" ${x.id === s.provider ? "selected" : ""}>${esc(t(x.name))}${COST[x.cost] ? ` · ${COST[x.cost]}` : ""}</option>`).join("")}</select>
        <small>${esc(t(p.hint || ""))}${p.signup ? ` <a href="${p.signup}" target="_blank" rel="noopener noreferrer">${t("去申请 key")}</a>` : ""}</small></label>
      <label>${t("API key")}<input name="key" type="password" autocomplete="off" maxlength="300" value="${esc(s.key)}" placeholder="${esc(p.keyPrefix ? `${[].concat(p.keyPrefix)[0]}…` : "sk-…")}">
        <small>${esc(t(p.keyHint || "在服务商控制台创建 API key，整段粘贴到这里"))}</small></label>
      <label>${t("家庭人数（菜单份量）")}<input name="people" type="number" inputmode="numeric" min="1" max="20" value="${s.people || 4}"></label>
    </div>
    ${custom ? "" : `<p class="hint">${t("模型名和接口地址已内置（{model}），一般不用改；要换模型再展开下面的“高级”。", { model: effective(s, p).model })}${s.model || s.base ? ` <button type="button" class="btn btn-sm btn-ghost" data-action="ai-clear-adv">${t("清掉手填的模型名 / 地址")}</button>` : ""}</p>`}
    <details class="adv" ${custom ? "open" : ""}><summary>${custom ? t("接口地址、模型与鉴权（自定义必填）") : t("高级：换模型 / 自定义接口地址")}</summary>
      <div class="form-grid" style="margin-top:8px">
        ${modelField(s, p)}
        <label>${t("接口地址（自定义时填）")}<input name="base" maxlength="200" placeholder="${esc(p.base || "https://…/v1")}" value="${esc(s.base)}"><small>${t("要填真正的 API 域名（到 /v1 为止），不是官网；401 多半是 key 和地址不配")}</small></label>
        <label>${t("鉴权头（自定义时）")}<select name="auth">${Object.entries(AUTH_STYLES).map(([k, n]) => `<option value="${k}" ${(s.auth || "bearer") === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
      </div>
    </details>
    ${quotaBlock(s, p)}
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("保存")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="ai-test">${t("测试连接")}</button><span id="aiTestOut" class="muted"></span></div>
    <p class="hint">${t("性价比：DeepSeek、通义千问 qwen-turbo、豆包 lite 一次菜单约几分钱；Gemini Flash 有免费额度。只用于生成菜单，不会上传备注等个人信息。")}</p>
  </form>`;
}
export function viewSettings() {
  const cloud = Store.mode === "cloud";
  const notif = "Notification" in window ? Notification.permission : "unsupported";
  const sec = state.route?.q?.get("sec");
  const meta = SETTING_SECTIONS.find((s) => s.id === sec);
  if (!meta) {
    const status = {
      family: cloud ? t("{name} · {n} 位成员", { name: state.household?.name || "", n: state.members.length }) : t("本地演示：数据只保存在这个浏览器里"),
      properties: t("{n} 套", { n: state.properties.filter((p) => !p.archived).length }),
      income: state.incomes.some((i) => i.user_id === myId()) ? (isHouseholdOwner() ? (budgetPlan() ? t("已设置收入 · 预算已生成") : t("已设置收入")) : t("已设置我的收入")) : t("还没设置我的收入"),
      prefs: `${LANGS[langOverride() || detectLang()]} · ${t(Units.region.name)} · ${Units.region.currency}`,
      categories: t("{n} 个分类 · 自建 {m} · 改过 {k}", { n: CATEGORIES.filter((c) => !c.hidden).length, m: CATEGORIES.filter((c) => c.custom).length, k: CATEGORIES.filter((c) => c.overridden).length }),
      locations: t("{n} 个位置 · 自定义 {m}", { n: window.LOCATIONS.length, m: customLocations().length }),
      modules: [state.houseEnabled ? t("房屋 ✓") : t("房屋 ✗"), state.billsEnabled ? t("账单 ✓") : t("账单 ✗"), state.gearEnabled ? t("装备 ✓") : t("装备 ✗")].join(" · "),
      print: state.billsEnabled ? t("采购清单、账单概览") : t("采购清单"),
      data: `${notif === "granted" ? t("通知已开启") : t("通知未开启")} · ${t("导出 JSON")}`,
      ai: aiReady() ? `${t("{p} · 已填 key", { p: t(providerOf(aiSettings().provider).name) })}${(() => { const q = aiQuota(); return q.cap ? ` · ${t("今天 {n}/{cap}", { n: q.used, cap: q.cap })}` : ""; })()}` : t("未填 key，用“复制提示词”模式"),
      apps: t("小月亮、家庭学堂；介绍与注意事项"),
    };
    return `<section class="section menu-page"><div class="section-head"><p>${t("家庭、房产、语言、存放位置、模块、备份、AI、姐妹站点")}</p>
        <div class="head-acts"><span id="syncBadge" class="sync ${syncState.err ? "err" : ""}" role="status">${esc(syncState.text)}</span>${cloud ? `<button type="button" class="btn btn-sm" data-action="reload">${t("立即同步")}</button>` : ""}</div></div>
      <div class="panel mlist">${SETTING_SECTIONS.map((s) => `<a class="mrow" href="${href("me", "settings")}?sec=${s.id}"><span class="mi" aria-hidden="true">${s.icon === "__AI__" ? aiIcon(24) : s.icon}</span><span class="mt"><b>${t(s.name)}</b><small>${esc(status[s.id])}</small></span><span class="mch" aria-hidden="true">›</span></a>`).join("")}</div>
      <div class="form-actions" style="margin-top:14px">${cloud ? `<button type="button" class="btn btn-danger-ghost" data-action="logout">${t("退出登录")}</button>` : `<button type="button" class="btn btn-danger-ghost" data-action="reset-demo">${t("恢复演示数据")}</button>`}</div>
    </section>`;
  }
  const sw = (id, on, title, desc) => `<div class="panel"><div class="kv"><div><b>${title}</b><div class="muted">${desc}</div></div>
      <label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span>${on ? t("已打开") : t("已关闭")}</span></label></div></div>`;
  const blocks = {
    family: () => `
    <div class="panel">
      <div class="kv"><div><b>${esc(state.household?.name || "")}</b><div class="muted">${cloud ? t("云端协同：家人修改会实时同步") : t("本地演示：数据只保存在这个浏览器里")}</div></div>
        <div class="head-acts"><span id="syncBadge" class="sync ${syncState.err ? "err" : ""}" role="status">${esc(syncState.text)}</span>
          ${cloud ? `<button type="button" class="btn btn-sm" data-action="reload">${t("立即同步")}</button>` : ""}</div></div>
    </div>
    ${cloud ? `
    <div class="panel">
      <div class="kv"><div><div class="muted">${t("邀请家人：把这个邀请码发给他们")}</div><div class="code">${esc(state.household.invite_code)}</div></div>
        <div class="head-acts"><button type="button" class="btn btn-sm" data-action="copy-invite">${t("复制邀请码")}</button>
          ${isOwner() ? `<button type="button" class="btn btn-sm btn-ghost" data-action="rotate-invite">${t("重置邀请码")}</button>` : ""}</div></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${t("家人可以用邀请码直接进入（不用收邮件）。邀请码就是这个家的钥匙，泄露了请家主点“重置邀请码”，旧码立即失效，已加入的家人不受影响。")}</p>
      ${state.user?.is_anonymous ? `<p class="muted" style="font-size:12px;margin:6px 0 0">${t("你是通过邀请码直接进入的，身份保存在本设备浏览器里；清除浏览器数据或换手机后需要重新用邀请码进入。")}</p>` : ""}
      <h3 style="font-size:15px;margin:16px 0 6px">${t("家庭成员")}</h3>
      ${membersList()}
      ${isOwner() ? `<p class="muted" style="font-size:12px;margin:6px 0 0">${t("家主可以改家人的称呼、把家人设为家主（可以有多位）、取消家主，或把误加入的人移出家庭。最后一位家主不能被取消或移出。")}</p>` : ""}
      <form id="nameForm" class="add-row" style="grid-template-columns:1fr auto;margin-top:12px">
        <input name="display_name" maxlength="20" value="${esc(state.displayName)}" aria-label="${t("我在家里的称呼")}">
        <button class="btn btn-sm" type="submit">${t("保存称呼")}</button></form>
      ${state.households.length > 1 ? `<label style="display:grid;gap:4px;margin-top:12px">${t("切换家庭")}<select id="hhSwitch">${state.households.map((h) => `<option value="${h.id}" ${h.id === state.household.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></label>` : ""}
    </div>` : `
    <div class="panel config-diag">
      <b>${t("为什么还是本地演示模式")}</b>
      <p>${esc(t(state.configIssue || "没有检测到 Supabase 配置。"))}</p>
      <p class="muted" style="margin:0">${t("自查：在浏览器打开 {link}，确认看到的是你填好的地址和 key；改完后等 1–2 分钟，再按 Ctrl+F5（Mac：Cmd+Shift+R）强制刷新。", { link: `<a href="config.js" target="_blank" rel="noopener">${t("本站的 config.js")}</a>` })}</p>
    </div>`}`,
    prefs: () => `
    <div class="panel">
      <label class="field-label" for="langSel">${t("语言")}</label>
      <select id="langSel">
        <option value="" ${!langOverride() ? "selected" : ""}>${t("自动（检测为{lang}）", { lang: LANGS[detectLang()] })}</option>
        ${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${langOverride() === k ? "selected" : ""}>${v}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("繁體中文由简体自动转换；English 没有翻译到的文案会显示中文。自己起的位置 / 分类 / 小类名字可以在下面填各语言叫法；物品名称不翻译。")}</p>
    </div>
    ${termsPanel()}
    <div class="panel">
      <label class="field-label" for="regionSel">${t("地区与单位")}</label>
      <select id="regionSel">
        <option value="" ${!Units.override ? "selected" : ""}>${t("自动（检测为{region}{tz}）", { region: esc(t(Units.detected().name)), tz: Units.timeZone() ? t("，时区 {tz}", { tz: esc(Units.timeZone()) }) : "" })}</option>
        ${Object.values(Units.REGIONS).map((r) => `<option value="${r.id}" ${Units.override === r.id ? "selected" : ""}>${t(r.name)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("当前：{units}，货币 {cur}。", { units: Units.region.system === "us" ? t("美制单位 lb、oz、fl oz、qt、gal") : t("公制单位 kg、g、斤、L、mL"), cur: Units.region.currency })}
        ${t("已有物品按原单位保存，显示时自动换算；按“个、盒、袋”计数的物品不换算。")}</p>
    </div>`,
    properties: () => propertiesPanel(),
    income: () => incomePanel(),
    modules: () => `
    ${sw("houseToggle", state.houseEnabled, t("房屋维护模块"), t("关闭后导航和首页只显示日常储备，适合租房或不需要的家庭；数据不会删除"))}
    ${sw("billsToggle", state.billsEnabled, t("账单模块"), t("水电气、网络、HOA、房产税、房贷、保险等周期账单的提醒与记录；关闭后导航里不再显示，数据不会删除"))}
    ${sw("gearToggle", state.gearEnabled, t("装备模块"), t("床品、电器、自行车、工具等耐用品，只记数量和位置；关闭后储藏里不再显示“装备”，数据不会删除"))}`,
    data: () => `
    <div class="panel"><div class="kv"><div><b>${t("浏览器通知")}</b><div class="muted">${t("打开网页时，若有新的缺货或少货会弹出提醒")}</div></div>
      ${notif === "granted" ? `<span class="badge b-ok">${t("已开启")}</span>` : notif === "unsupported" ? `<span class="muted">${t("此浏览器不支持")}</span>` : `<button type="button" class="btn btn-sm" data-action="notif">${t("开启通知")}</button>`}</div></div>
    <div class="panel"><div class="kv"><div><b>${t("导出数据")}</b><div class="muted">${t("下载库存和采购清单的 JSON 备份")}</div></div>
      <button type="button" class="btn btn-sm" data-action="export">${t("导出 JSON")}</button></div></div>`,
    ai: () => aiBlock(),
    print: () => viewPrintSettings(),
    locations: () => locationsPanel(),
    categories: () => categoriesPanel(),
    apps: () => `
    ${sisterAppsPanel()}
    <div class="panel"><div class="kv"><div><b>${t("介绍与注意事项")}</b><div class="muted">${t("这个网站是什么、第一次怎么用、提醒怎么分级、哪些事要注意")}</div></div>
      <a class="btn btn-sm" href="${href("me", "about")}">${t("查看介绍")}</a></div></div>`,
  };
  // 面包屑“‹ 我的 / 设置 / 家庭与成员”由 menu.js 统一画，这里不再另起标题行
  return `<section class="section"><div class="settings">${blocks[meta.id]()}</div></section>`;
}
