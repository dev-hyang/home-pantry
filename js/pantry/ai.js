/* AI 菜单助手 · 界面：菜单页顶部的对话框 + 结果渲染；没 key 时变成“复制提示词 / 打开豆包”模式 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { aiIcon, aiQuota, aiReady, aiSettings, askModel, promptText, providerOf, quotaMessage } from "../core/ai.js";

export const QUICK_ASKS = ["低糖高蛋白，六人份", "用掉快过期的食材", "先做掉放得最久的食材", "哺乳期追奶：多汤水、高蛋白", "产后恢复：温补、补铁、易消化", "孩子爱吃、少油少盐", "30 分钟能做完的晚餐", "一周三餐的采购清单"];
// 无 key 模式可直接打开的网页（粘贴提示词）
const WEB_LLMS = [["豆包", "https://www.doubao.com/"], ["通义千问", "https://www.tongyi.com/"], ["Kimi", "https://www.kimi.com/"], ["ChatGPT", "https://chatgpt.com/"], ["Gemini", "https://gemini.google.com/"]];

export function aiPanel() {
  const a = state.ai || (state.ai = { ask: "", busy: false, result: null, error: null, raw: null });
  const ready = aiReady(), s = aiSettings(), p = providerOf(s.provider);
  const q = ready ? aiQuota(s) : null, blocked = !!q && !q.ok;   // 免费额度用完：不发请求，改用复制提示词
  const chips = QUICK_ASKS.map((x) => `<button type="button" class="chip" data-action="ai-ask" data-ask="${esc(t(x))}">${esc(t(x))}</button>`).join("");
  const sub = !ready ? t("没填 key 也能用：生成提示词，复制到豆包 / 千问 / ChatGPT") : blocked ? quotaMessage(q) : `${t("{p} · 会把库存食材、临期和饮食模式一起发给模型", { p: t(p.name) })}${q.cap ? ` · ${t("今天还剩 {n} 次免费", { n: q.remaining })}` : ""}`;
  return `<section class="section ai-panel">
    <div class="section-head"><h2>${aiIcon(26)} ${t("AI 菜单助手")}</h2><p class="${blocked ? "form-error" : ""}">${esc(sub)}</p></div>
    <form id="aiForm" class="panel">
      <div class="chips" style="margin-bottom:8px">${chips}</div>
      <div class="ai-row">
        <input name="ask" maxlength="300" placeholder="${t("想吃什么、几个人、有什么要求…")}" value="${esc(a.ask)}" aria-label="${t("菜单需求")}">
        <label class="ai-people">${t("人数")}<input name="people" type="number" inputmode="numeric" min="1" max="20" value="${s.people || 4}"></label>
      </div>
      <div class="form-actions" style="margin-top:8px">
        ${ready && !blocked ? `<button type="submit" class="btn btn-primary" ${a.busy ? "disabled" : ""}>${a.busy ? t("生成中…") : t("生成今日菜单")}</button>` : ""}
        <button type="button" class="btn ${ready && !blocked ? "btn-ghost" : "btn-primary"}" data-action="ai-copy">${t("复制提示词")}</button>
        ${WEB_LLMS.slice(0, lang === "en" ? 5 : 3).map(([n, u]) => `<a class="btn btn-sm btn-ghost" href="${u}" target="_blank" rel="noopener noreferrer">${t("打开{n}", { n: t(n) })}</a>`).join("")}
        <a class="btn btn-sm btn-ghost" href="${href("me", "settings")}?sec=ai">${ready ? t("换模型") : t("填 API key 直接出结果")}</a>
      </div>
      ${a.error ? `<p class="form-error" role="alert">${esc(a.error)}</p>` : ""}
    </form>
    ${a.result ? menuResult(a.result) : a.raw ? `<div class="panel"><p class="muted" style="margin:0 0 6px">${t("模型没有按格式返回，原文如下：")}</p><pre class="ai-raw">${esc(a.raw)}</pre></div>` : ""}
  </section>`;
}

function menuResult(m) {
  const missingAll = [...new Set(m.meals.flatMap((x) => x.dishes.flatMap((d) => d.missing)))];
  return `<div class="panel ai-result">
    ${m.title ? `<h3>${esc(m.title)}</h3>` : ""}
    <div class="plan">${m.meals.map((meal) => `<div class="slot"><h3>${esc(meal.name)}</h3>${meal.dishes.map((d) => `<div class="dish">${esc(d.name)}
      <small>${d.uses.length ? `<span class="have">${t("用库存：{list}", { list: esc(d.uses.join("、")) })}</span>` : ""}${d.missing.length ? ` <span class="miss">${t("缺：{list}", { list: esc(d.missing.join("、")) })}</span>` : ""}${d.note ? `<br>${esc(d.note)}` : ""}</small></div>`).join("")}</div>`).join("")}</div>
    ${m.tips ? `<p class="muted" style="margin:10px 0 0;font-size:13px">💡 ${esc(m.tips)}</p>` : ""}
    <div class="form-actions" style="margin-top:10px">
      ${missingAll.length ? `<button type="button" class="btn btn-sm" data-action="ai-add-missing">${t("缺的 {n} 样加入采购清单", { n: missingAll.length })}</button>` : ""}
      <button type="button" class="btn btn-sm btn-ghost" data-action="ai-again">${t("换一版")}</button>
    </div>
    <p class="disclaimer">${t("由 AI 生成，分量和做法请自行把握；过敏、慢病饮食以医生建议为准。")}</p>
  </div>`;
}

export async function runAi(form) {
  const a = state.ai; const ask = form.elements.ask.value.trim(); const people = +form.elements.people.value || 4;
  const s = aiSettings(); if (s.people !== people) { s.people = people; try { localStorage.setItem("hmh-ai", JSON.stringify(s)); } catch { /* 忽略 */ } }
  Object.assign(a, { ask, busy: true, error: null });
  try {
    const { text, menu } = await askModel(ask, { people });
    Object.assign(a, { result: menu, raw: menu ? null : text, busy: false });
    if (menu) toast(t("菜单已生成"));
  } catch (e) { Object.assign(a, { busy: false, error: e.message }); }
}

export async function copyPrompt(form) {
  const ask = form?.elements.ask.value.trim() || state.ai?.ask || "", people = +(form?.elements.people.value) || aiSettings().people || 4;
  const text = promptText(ask, { people });
  try { await navigator.clipboard.writeText(text); toast(t("提示词已复制，去豆包 / 千问 / ChatGPT 粘贴即可")); }
  catch { window.prompt(t("复制下面的提示词"), text); }
}

/** 把 AI 菜单里缺的食材加入采购清单（去重，跳过清单里已有的） */
export async function addAiMissing() {
  const m = state.ai?.result; if (!m) return;
  const names = [...new Set(m.meals.flatMap((x) => x.dishes.flatMap((d) => d.missing)))];
  const have = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => s.name.trim().toLowerCase()));
  let n = 0;
  for (const name of names) { if (have.has(name.toLowerCase())) continue; await Store.saveShopping({ name, quantity: 1, unit: "", item_id: null, category: "fresh" }); n++; }
  toast(n ? t("已加入 {n} 样到采购清单", { n }) : t("都已经在采购清单里了"));
}
