/* 设置：自定义名称的翻译、分类与小类、存放位置。 */
import { CUSTOM_GROUP, customLocations, locationGroups, locationUsage } from "../core/locations.js";
import { blockedModels, deadModels } from "../core/ai.js";
import { catsOf, esc } from "../core/util.js";
import { glossaryOf, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { catFormHtml } from "../pantry/inventory-sync.js";

/* ── 自定义名称的翻译：收集家庭自己起的名字（自定义位置、自建 / 改过的分类名、自加的小类），每条填简体 / English / 繁體 ── */
/** 被跳过的模型（对这个 key 已下线 / 这个模型的额度用完了）：列出来，免得以为是本地计数的问题；可一键清除重新试 */
export function modelMarks() {
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
export function termsPanel() {
  const terms = customTerms();
  const cell = (term, k, label, ph) => { const g = glossaryOf(term) || {}; return `<label>${label}<input name="${k}" maxlength="60" value="${esc(g[k] || "")}" placeholder="${esc(ph)}"></label>`; };
  return `<form id="termsForm" class="panel">
    <div class="section-head" style="margin-bottom:6px"><h3 style="font-size:15px">${t("自定义名称的翻译")}</h3><p>${t("自己起的位置、分类、小类在其他语言下怎么叫；留空就按原文显示（繁體由简体自动转换）")}</p></div>
    ${terms.length ? `<div class="terms-list">
      ${terms.map(([term, src]) => `<div class="term-card" data-term="${esc(term)}"><div class="term-name"><b>${esc(term)}</b><small>${esc(src)}</small></div>
        <div class="term-fields">${cell(term, "zh", "简体", term)}${cell(term, "en", "English", "")}${cell(term, "hant", "繁體", t("自动"))}</div></div>`).join("")}
    </div>
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("保存翻译")}</button></div>`
    : `<p class="muted" style="margin:0;font-size:13px">${t("还没有自己起的名字。新建位置或分类后会出现在这里。")}</p>`}
  </form>`;
}
/* ── 分类与小类：按空间列出全部分类（含隐藏的）；点“编辑”用和库存页同一个表单改名、换图标颜色、增删小类；内置分类可恢复默认或隐藏 ── */
export function categoriesPanel() {
  const cf = state.catForm;
  const spaces = [["pantry", "日常消耗品"], ["house", "汽车房屋消耗品"], ["gear", "家居耐用品"]].filter(([s]) => s !== "gear" || state.gearEnabled);
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
export function locationsPanel() {
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
