/* 随手问咩咩：房屋 / 账单等页面每一项旁边的小问号（设计见 docs/design-ask-y.md）。
 * 三层：① 静态说明（为什么 / 怎么做 / 什么时候叫人，写在数据表里，零成本、离线可用）→ ② 一键提问（问题替用户写好，带这一项的上下文）→ ③ 答案就地显示。
 * 默认都收着；同一时间只展开一项；答案存本机 7 天（同一项不重复花钱）；没填 key 或额度用完时按钮变成「复制提示词」。
 * ask = { id, title, question, context: string[] | () => string[], guide?: { why, how, pro, diy, mins, cost } }
 *   id 要稳定（同一项每次渲染相同），用来缓存答案和记住展开状态。 */
import { state } from "./state.js";
import { esc, toast } from "./util.js";
import { lang, t } from "./i18n.js";
import { aiIcon, aiQuota, aiReady, askText, generalPrompt } from "./ai.js";
import { href } from "./router.js";

const KEY = (id) => `hmh-ask.${id}`, TTL = 7 * 864e5;
export function cachedAnswer(id) { try { const v = JSON.parse(localStorage.getItem(KEY(id)) || "null"); return v && Date.now() - v.at < TTL ? v : null; } catch { return null; } }
const remember = (id, q, a) => { try { localStorage.setItem(KEY(id), JSON.stringify({ at: Date.now(), q, a })); } catch { /* 隐私模式 */ } };
const forget = (id) => { try { localStorage.removeItem(KEY(id)); } catch { /* 忽略 */ } };
const REG = new Map();   // 本次渲染登记过的 ask，点按钮时按 id 找回
const run = () => (state.askRun ||= {});
const ctxOf = (ask) => (typeof ask.context === "function" ? ask.context() : ask.context) || [];

/** 行末的小问号：点开 / 收起这一项的面板 */
export function askButton(ask) {
  REG.set(ask.id, ask);
  const on = state.askOpen === ask.id;
  return `<button type="button" class="ask-btn ${on ? "on" : ""}" data-action="ask-toggle" data-ask="${esc(ask.id)}" aria-expanded="${on}" aria-label="${esc(t("怎么做 · 问咩咩"))}" title="${esc(t("怎么做 · 问咩咩"))}">?</button>`;
}
/** 面板：静态说明 + 提问按钮 + 答案。只有这一项展开时才输出 HTML（列表页不预渲染） */
export function askPanel(ask) {
  REG.set(ask.id, ask);
  if (state.askOpen !== ask.id) return "";
  return `<div class="ask-panel" data-ask-panel="${esc(ask.id)}">${guideHtml(ask.guide)}${askInline(ask, { inPanel: true })}</div>`;
}
/** 静态说明块（为什么 / 怎么做 / 什么时候叫人 + 时间费用），没内容就不画 */
export function guideHtml(g) {
  if (!g || !(g.why || g.how || g.pro)) return "";
  const meta = [g.mins ? `⏱ ${t("约 {n} 分钟", { n: g.mins })}` : "", g.cost ? `💲 ${esc(t(g.cost))}` : "", g.diy === true ? `🔧 ${t("自己能做")}` : g.diy === false ? `☎ ${t("一般要叫人")}` : ""].filter(Boolean).join(" · ");
  return `<div class="ask-guide">
    ${g.why ? `<p><b>❓ ${t("为什么")}</b>${esc(t(g.why))}</p>` : ""}
    ${g.how ? `<p><b>🔧 ${t("怎么做")}</b>${esc(t(g.how))}</p>` : ""}
    ${g.pro ? `<p><b>☎ ${t("什么时候叫人")}</b>${esc(t(g.pro))}</p>` : ""}
    ${meta ? `<p class="ask-meta">${meta}</p>` : ""}</div>`;
}
/** 提问按钮 + 答案（可以单独用在已经展开的地方，比如检查卡里面、账单枢纽页顶部） */
export function askInline(ask, { inPanel = false } = {}) {
  REG.set(ask.id, ask);
  const r = run()[ask.id] || {}, c = cachedAnswer(ask.id), ready = aiReady(), q = ready ? aiQuota() : null, can = ready && (!q || q.ok);
  const btn = r.busy ? `<button type="button" class="btn btn-sm" disabled>${aiIcon(16)} ${t("咩咩思考中…")}</button>`
    : can ? `<button type="button" class="btn btn-sm ${c ? "btn-ghost" : ""}" data-action="ask-run" data-ask="${esc(ask.id)}">${aiIcon(16)} ${c ? t("重新问") : t("问咩咩")}</button>`
    : `<button type="button" class="btn btn-sm" data-action="ask-copy" data-ask="${esc(ask.id)}">${aiIcon(16)} ${t("复制提示词")}</button>`;
  const answer = c ? `<div class="ask-answer"><div class="ask-answer-head">${aiIcon(18)} <b>${t("咩咩")}</b><small class="muted">${new Date(c.at).toLocaleDateString()}</small><span class="spacer"></span><button type="button" class="btn btn-sm btn-ghost" data-action="ask-copy-answer" data-ask="${esc(ask.id)}">${t("复制")}</button><a class="btn btn-sm btn-ghost" href="${href("ai")}?from=${encodeURIComponent(ask.id)}">${t("追问")}</a></div>${renderAnswer(c.a)}<p class="disclaimer">${t("AI 回答仅供参考；涉及燃气、电、结构、法律、医疗请找专业人士。")}</p></div>` : "";
  const err = r.error ? `<p class="form-error" role="alert">${esc(r.error)}</p>` : "";
  return `<div class="ask-inline ${inPanel ? "" : "standalone"}">${c ? "" : `<small class="muted ask-q">${esc(ask.question)}</small>`}<div class="ask-acts">${btn}${!can && !ready ? `<a class="ask-keylink" href="${href("me", "settings")}?sec=ai">${t("填 key 直接出答案")}</a>` : ""}</div>${err}${answer}</div>`;
}
/** 回答做最简渲染：转义后按行分段，- / 1. 开头的行做成列表，**粗体** */
function renderAnswer(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean), out = []; let list = null;
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  for (const l of lines) {
    const m = l.match(/^(?:[-*•]|\d+[.、)])\s*(.*)$/);
    if (m) { if (!list) { list = []; out.push(list); } list.push(inline(m[1])); }
    else { list = null; out.push(`<p>${inline(l.replace(/^#+\s*/, ""))}</p>`); }
  }
  return out.map((x) => (Array.isArray(x) ? `<ul>${x.map((i) => `<li>${i}</li>`).join("")}</ul>` : x)).join("");
}
/** 拼这次提问的提示词：沿用整页咩咩咩的 system，再加「只回答这一项、200 字内」 */
export function askPrompt(ask) {
  const base = generalPrompt("", { withContext: false }), ctx = ctxOf(ask);
  const en = lang === "en";
  const system = `${base.system}\n${en ? "Answer only this one item. Format: one-sentence conclusion, then “How” in 3–6 short steps, then “When to call a pro / risks”. Be concrete, under 200 words." : "这次只回答一个具体事项。格式：先一句结论，再「怎么做」3–6 步，最后「什么时候叫人 / 风险」。要具体，不要泛泛而谈，控制在 200 字内。"}`;
  const user = `${en ? "Item" : "事项"}：${ask.title}\n${en ? "Our situation" : "我家的情况"}：${ctx.length ? ctx.join(en ? "; " : "；") : (en ? "not filled in" : "未填")}\n${en ? "Question" : "问题"}：${ask.question}`;
  return { system, user, text: `${system}\n\n${user}` };
}
export function toggleAsk(id) { state.askOpen = state.askOpen === id ? null : id; }
export async function runAsk(id) {
  const ask = REG.get(id); if (!ask) return;
  const r = run(); r[id] = { busy: true, error: null };
  rerender();
  try {
    const p = askPrompt(ask);
    const a = await askText(p.system, p.user, { maxTokens: 700, temperature: 0.4 });
    remember(id, ask.question, String(a || "").trim()); r[id] = { busy: false, error: null };
  } catch (e) { r[id] = { busy: false, error: e.message }; }
  rerender();
}
export async function copyAskPrompt(id) { const ask = REG.get(id); if (!ask) return; try { await navigator.clipboard.writeText(askPrompt(ask).text); toast(t("已复制，打开任一 AI 粘贴即可")); } catch { toast(t("复制失败，请手动选择")); } }
export async function copyAskAnswer(id) { const c = cachedAnswer(id); if (!c) return; try { await navigator.clipboard.writeText(c.a); toast(t("已复制")); } catch { toast(t("复制失败")); } }
export const reask = (id) => { forget(id); return runAsk(id); };
/** 整页咩咩咩「追问」：把这一项的问题和答案带过去 */
export function askHandoff(id) { const c = cachedAnswer(id); const ask = REG.get(id); return c ? `${t("接着上面这个问题：")}${c.q}\n${t("你之前的回答：")}${c.a.slice(0, 600)}\n\n${t("我想再问：")}` : ask ? ask.question : ""; }
const rerender = () => window.dispatchEvent(new Event("hmh-rerender"));

/* ── 「我家的情况」：只带这一项相关的字段，不带备注、人名、账号、门牌 ── */
const H = () => window.HOUSE, regionName = () => (window.Units?.region?.name ? t(window.Units.region.name) : "");
export const ctx = {
  property(pid) {
    const p = state.properties?.find((x) => x.id === pid) || null, d = pid ? state.houseProfiles?.[pid] : null;
    const ht = d && H() ? H().typeOf(d.region, d.house_type) : null, hoa = d?.hoa;
    return [p?.kind ? t(window.DEALS?.PROPERTY_STATUS?.[p.status] || "") : "", ht ? t(ht.name) : "", p?.role ? t({ owner_occupied: "自住", landlord: "出租给别人", tenant: "租住" }[p.role] || p.role) : "",
      regionName(), d?.year_built ? t("{y} 年建", { y: d.year_built }) : "", hoa?.enabled ? t("有 {label}", { label: t(H().assocOf(d.house_type).label) }) : ""].filter(Boolean);
  },
  asset(a) {
    const base = ctx.property(a.property_id);
    return [...base, a.t ? t(a.t.name) : a.name, a.ageYears != null ? t("{n} 年", { n: Math.floor(a.ageYears) }) : t("安装年份未填"), a.lastService ? t("上次保养 {d}", { d: String(a.lastService).slice(0, 10) }) : t("没记过保养"), a.expected_life_years ? t("预期寿命 {n} 年", { n: a.expected_life_years }) : ""].filter(Boolean);
  },
  vehicle(a) {
    const V = window.VEHICLES;
    return [a.name, a.t ? t(a.t.name) : "", a.manufacture_year ? String(a.manufacture_year) : "", a.vMileage != null ? `${a.vMileage} ${V?.distUnit ? V.distUnit() : ""}` : t("里程未填"), regionName()].filter(Boolean);
  },
  bill(b) {
    const B = window.BILLS, cat = B?.catOf?.(b.category);
    return [...ctx.property(b.property_id), cat ? t(cat.name) : b.category, b.est != null ? `${window.Units?.money ? window.Units.money(b.est, b.currency) : b.est}` : t("金额未填"), t(B?.FREQUENCIES?.[b.frequency] || b.frequency || ""), b.autopay ? t("自动扣款") : t("手动缴费")].filter(Boolean);
  },
};
window.__askCtx = ctx;
