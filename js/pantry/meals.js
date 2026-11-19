import { aiPanel } from "./ai.js";
import { joinList, lang, t } from "../core/i18n.js";
import { esc } from "../core/util.js";
import { state } from "../core/state.js";
import { scoreRecipes } from "./meals-sync.js";
export { categoryOptions, scoreRecipes } from "./meals-sync.js";

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
