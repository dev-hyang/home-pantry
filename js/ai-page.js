/* 小Y问 · AI 助手整页：问家里任何事（房屋保养、账单、买卖房、清洁收纳、育儿家务…）。
 * 有 key（方案 A）直接出答案；没 key（方案 D）复制提示词并打开 ChatGPT / DeepSeek / Claude / 豆包 / 千问 / Kimi / Gemini，
 * 手机上这些 https 链接会直接拉起已安装的 App（通用链接）。菜单生成保留在 储藏 → 菜单。 */
import { state } from "./core/state.js";
import { esc, toast } from "./core/util.js";
import { href } from "./core/router.js";
import { lang, t } from "./core/i18n.js";
import { aiIcon, aiReady, aiSettings, askText, generalPrompt, generalPromptText, providerOf } from "./core/ai.js";

export const TOPICS = [
  { id: "menu", icon: "🍳", name: "今天吃什么", q: null, link: () => `${href("pantry", "meals")}?ai=` },
  { id: "house", icon: "🏠", name: "房屋保养", q: "家里的设备和房子，最近该做哪些保养和检查？按优先级列出来。" },
  { id: "bills", icon: "🧾", name: "账单与省钱", q: "看看我家近期的账单，哪些可以省钱或该核对？有什么建议？" },
  { id: "deal", icon: "📝", name: "买房卖房", q: "我在伊利诺伊州，买房 / 卖房流程里最容易漏掉的事有哪些？" },
  { id: "clean", icon: "🧹", name: "清洁收纳", q: "给我一份一周家务清洁计划，按天分配，适合有小孩的家庭。" },
  { id: "kids", icon: "🧸", name: "育儿家务", q: "有孩子的家庭怎么安排一周的采购和备餐最省时间？" },
];
// 可直接打开的 AI 网页（手机上是通用链接，装了 App 会拉起 App）
export const AI_SITES = [
  ["ChatGPT", "https://chatgpt.com/"], ["DeepSeek", "https://chat.deepseek.com/"], ["Claude", "https://claude.ai/new"],
  ["豆包", "https://www.doubao.com/chat/"], ["通义千问", "https://www.tongyi.com/"], ["Kimi", "https://www.kimi.com/"], ["Gemini", "https://gemini.google.com/app"],
];

const st = () => (state.aiPage ||= { q: "", busy: false, answer: null, error: null, withContext: true });

export function viewAi() {
  const a = st(), ready = aiReady(), p = providerOf(aiSettings().provider);
  const qTopic = state.route?.q?.get("topic"); if (qTopic) { const tp = TOPICS.find((x) => x.id === qTopic); if (tp?.q && !a.q) a.q = t(tp.q); }
  const topics = TOPICS.map((x) => x.link ? `<a class="chip" href="${x.link()}">${x.icon} ${t(x.name)}</a>` : `<button type="button" class="chip" data-action="ai-topic" data-topic="${x.id}">${x.icon} ${t(x.name)}</button>`).join("");
  const sites = AI_SITES.map(([n, u]) => `<a class="btn btn-sm btn-ghost" href="${u}" target="_blank" rel="noopener noreferrer">${t("打开{n}", { n: t(n) })}</a>`).join("");
  return `<section class="section ai-page">
    <nav class="crumb" aria-label="${t("位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("小Y问")}</b></nav>
    <div class="ai-hero"><div class="ai-hero-ico">${aiIcon(44)}</div><div><p class="muted">${ready ? t("用 {p} 直接回答；也可以复制提示词去别的 AI 问", { p: t(p.name) }) : t("家里的事都可以问：保养、账单、买卖房、收纳、带娃。没填 key 时会把问题连同家里的情况拼成提示词，复制到任一 AI 即可。")}</p></div></div>
    <div class="chips" style="margin:12px 0 8px">${topics}</div>
    <form id="aiPageForm" class="panel">
      <textarea name="q" rows="3" maxlength="1000" placeholder="${t("例如：热水器 12 年了要不要换？卖房前哪些账单要提前通知停？")}">${esc(a.q)}</textarea>
      <label class="check" style="margin-top:8px"><input type="checkbox" name="ctx" ${a.withContext ? "checked" : ""}><span>${t("附带家里的情况（房产、设施、待处理设备、近期账单、库存概况；不含备注和个人信息）")}</span></label>
      <div class="form-actions" style="margin-top:10px">
        ${ready ? `<button type="submit" class="btn btn-primary" ${a.busy ? "disabled" : ""}>${a.busy ? t("思考中…") : t("发送")}</button>` : ""}
        <button type="button" class="btn ${ready ? "btn-ghost" : "btn-primary"}" data-action="ai-copy-general">${t("复制提示词")}</button>
        <a class="btn btn-sm btn-ghost" href="${href("me", "settings")}?sec=ai">${ready ? t("换模型") : t("填 API key 直接出结果")}</a>
      </div>
      ${a.error ? `<p class="form-error" role="alert">${esc(a.error)}</p>` : ""}
    </form>
    <div class="panel ai-sites"><p class="muted" style="margin:0 0 8px;font-size:13px">${t("复制后打开任一 AI 粘贴（手机上会直接打开已安装的 App）：")}</p><div class="form-actions">${sites}</div></div>
    ${a.answer ? `<div class="panel ai-answer"><div class="ai-answer-head">${aiIcon(20)} <b>${t("小Y的回答")}</b><button type="button" class="btn btn-sm btn-ghost" data-action="ai-copy-answer">${t("复制")}</button></div>${renderAnswer(a.answer)}
      <p class="disclaimer">${t("AI 回答仅供参考；涉及燃气、电、结构、法律、医疗请找专业人士。")}</p></div>` : ""}
  </section>`;
}

/** 回答做最简渲染：转义后按行分段，- / 1. 开头的行做成列表，**粗体** */
function renderAnswer(text) {
  const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split("\n");
  let out = "", list = null;
  const flush = () => { if (list) { out += `<${list.tag}>${list.items.map((x) => `<li>${x}</li>`).join("")}</${list.tag}>`; list = null; } };
  for (const ln of lines) {
    const m = ln.match(/^\s*(?:[-*•]|(\d+)[.、)])\s+(.*)$/);
    if (m) { const tag = m[1] ? "ol" : "ul"; if (!list || list.tag !== tag) { flush(); list = { tag, items: [] }; } list.items.push(m[2]); continue; }
    flush();
    if (ln.trim()) out += /^#+\s/.test(ln) ? `<h4>${ln.replace(/^#+\s/, "")}</h4>` : `<p>${ln}</p>`;
  }
  flush();
  return `<div class="ai-text">${out}</div>`;
}

export async function runAiPage(form) {
  const a = st(); a.q = form.elements.q.value.trim(); a.withContext = form.elements.ctx.checked;
  if (!a.q) { a.error = t("先写一句要问的"); return; }
  a.busy = true; a.error = null;
  try { const { system, user } = generalPrompt(a.q, { withContext: a.withContext }); a.answer = await askText(system, user, { maxTokens: 1800 }); }
  catch (e) { a.error = e.message; }
  finally { a.busy = false; }
}
export async function copyGeneralPrompt(form) {
  const a = st(); const q = form?.elements.q.value.trim() || a.q; const ctx = form ? form.elements.ctx.checked : a.withContext;
  if (!q) return toast(t("先写一句要问的"));
  const text = generalPromptText(q, { withContext: ctx });
  try { await navigator.clipboard.writeText(text); toast(t("提示词已复制，打开任一 AI 粘贴即可")); } catch { window.prompt(t("复制下面的提示词"), text); }
}
export async function copyAnswer() { const a = st(); if (!a.answer) return; try { await navigator.clipboard.writeText(a.answer); toast(t("已复制")); } catch { /* 忽略 */ } }
export function pickTopic(id) { const tp = TOPICS.find((x) => x.id === id); if (tp?.q) st().q = t(tp.q); }
