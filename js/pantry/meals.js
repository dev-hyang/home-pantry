/* 菜单推荐：按现有食材推荐三餐（含孕期、妊娠糖尿病、产后、哺乳模式）。 */
import { aiPanel } from "./ai.js";
import { compare, joinList, lang, t } from "../core/i18n.js";
import { esc } from "../core/util.js";
import { groupedCats } from "./inventory.js";
import { hasStock } from "../core/logic.js";
import { spendOptions } from "../core/taxonomy.js";
import { state } from "../core/state.js";

/* ── 菜单推荐 ── */
export function scoreRecipes() {
  const expiringNames = state.enriched.filter((x) => x.exp === "expiring" && x.qty > 0);
  return RECIPES.filter((r) => r.diets.includes(state.diet)).map((r) => {
    const parts = r.ings.map((kw) => ({ kw, item: hasStock(kw) }));
    const have = parts.filter((p) => p.item).length;
    const usesExpiring = parts.some((p) => p.item && expiringNames.some((e) => e.id === p.item.id));
    return { ...r, parts, have, score: have / r.ings.length + (usesExpiring ? 0.3 : 0), usesExpiring, full: have === r.ings.length };
  }).sort((a, b) => b.score - a.score || compare(t(a.name), t(b.name)));
}
/** 菜谱外链：中文去下厨房，英文用搜索 */
const recipeLink = (name) => (lang === "en"
  ? `https://www.google.com/search?q=${encodeURIComponent(`${t(name)} recipe`)}`
  : `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(name)}`);
export function viewMeals() {
  const d = DIETS[state.diet];
  const scored = scoreRecipes();
  const used = new Set();
  const pick = (meal, count) => {
    const pool = scored.filter((r) => r.meal === meal && r.have > 0 && !used.has(r.name));
    if (!pool.length) return [];
    const out = [];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const r = pool[(state.mealShift + i) % pool.length];
      if (!out.includes(r)) { out.push(r); used.add(r.name); }
    }
    return out;
  };
  // 每餐可以单独“换一道”：state.slotShift[meal] 让那一餐从菜谱池里往后取
  const shifts = state.slotShift || (state.slotShift = {});
  const plan = MEAL_SLOTS.map((s) => {
    const base = state.mealShift + (shifts[s.id] || 0);
    const pool = scored.filter((r) => r.meal === s.meal && r.have > 0 && !used.has(r.name));
    const dishes = []; for (let i = 0; i < Math.min(s.count, pool.length); i++) { const r = pool[(base + i) % pool.length]; if (!dishes.includes(r)) { dishes.push(r); used.add(r.name); } }
    return `<div class="slot"><h3>${t(s.name)}${dishes.length ? `<button type="button" class="link-name slot-swap" data-action="slot-swap" data-slot="${s.id}">${t("换一道")}</button>` : ""}</h3>${dishes.length ? dishes.map((r) => `<div class="dish">${esc(t(r.name))}${r.usesExpiring ? ` <span class="badge b-exp">${t("用临期")}</span>` : ""}
      <small>${r.full ? t("食材齐全") : t("还缺：{list}", { list: joinList(r.parts.filter((p) => !p.item).map((p) => esc(t(p.kw[0])))) })}</small></div>`).join("")
      : `<p class="muted">${t("库存里暂时凑不出，看看下面的菜谱缺什么。")}</p>`}</div>`;
  }).join("");

  const cards = scored.map((r) => {
    const missing = r.parts.filter((p) => !p.item);
    return `<article class="recipe">
      <h3><span>${esc(t(r.name))}</span><span class="badge ${r.full ? "b-ok" : "b-soon"}">${r.have}/${r.ings.length}</span></h3>
      <div class="ing">${r.parts.map((p) => `<span class="${p.item ? "have" : "miss"}">${esc(p.item ? p.item.name : t(p.kw[0]))}</span>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:13px">${esc(t(r.note))}</p>
      <div class="acts">
        ${missing.length ? `<button type="button" class="btn btn-sm" data-action="recipe-missing" data-name="${esc(r.name)}">${t("缺的加入采购")}</button>` : ""}
        <a class="btn btn-sm btn-ghost" href="${recipeLink(r.name)}" target="_blank" rel="noopener noreferrer">${t("在下厨房看做法")}</a>
      </div>
    </article>`;
  }).join("");

  // 顶部 AI 对话框；从首页带 ?ai=需求 进来时预填
  const qAsk = state.route?.q?.get("ai"); if (qAsk != null) { state.ai = state.ai || { ask: "", busy: false, result: null, error: null, raw: null }; if (qAsk) state.ai.ask = qAsk; }
  return `
    ${aiPanel()}
    <section class="section">
      <div class="section-head"><h2>${t("按库存推荐菜单")}</h2>
        <button type="button" class="btn btn-sm" data-action="shuffle">${t("换一组")}</button></div>
      <div class="seg" role="group" aria-label="${t("饮食模式")}">
        ${Object.entries(DIETS).map(([k, v]) => `<button type="button" class="chip" data-action="diet" data-diet="${k}" aria-pressed="${state.diet === k}">${v.icon} ${t(v.name)}</button>`).join("")}
      </div>
      <div class="panel"><ul class="tips">${d.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul>
        <p class="disclaimer">${t("以上为一般性膳食建议，不能代替医生或注册营养师的个体化方案；孕期、妊娠糖尿病和产后请以医嘱为准。")}</p></div>
    </section>
    <section class="section"><div class="section-head"><h2>${t("今天吃什么")}</h2><p>${t("优先用掉快到期的食材")}</p></div><div class="plan">${plan}</div></section>
    <section class="section"><div class="section-head"><h2>${t("可选菜谱")}</h2><p>${t("绿色是家里有的")}</p></div><div class="recipes">${cards}</div></section>`;
}
/** 分类下拉选项：储藏、房屋、家居耐用品分组显示。
 *  记花费（spend）的下拉按 一级 · 二级 分类分组，叶子在组里（js/core/taxonomy.js 的 spendOptions；手动记一笔、就地编辑、导入对账单、召回退款共用，不要在别处另列一份） */
export function categoryOptions(selected, { withOther = true, spend = false, only = null } = {}) {
  if (spend) return spendOptions(selected, { withOther });
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`;
  // 空间 · 花费二级（日常消耗品 · 食品杂货）一组；下拉里 optgroup 不能嵌套，所以两级拼在组名里
  const sp = (space, label, extra = "") => groupedCats(space).map((e, i, a) => `<optgroup label="${esc(`${label} · ${t(e.g.name)}`)}">${e.cats.map(opt).join("")}${i === a.length - 1 ? extra : ""}</optgroup>`).join("");
  if (only) return groupedCats(only).map((e) => `<optgroup label="${esc(t(e.g.name))}">${e.cats.map(opt).join("")}</optgroup>`).join("");   // 只列一个空间（物品表单先选了放在哪一类）
  return `${sp("pantry", t("日常消耗品"))}${sp("house", t("汽车房屋消耗品"), withOther ? opt(MAINT_CAT) : "")}${sp("gear", t("家居耐用品"))}
    ${withOther ? opt(OTHER_CAT) : ""}`;
}
