/* AI 菜单助手 · 调用层（方案 A + D）
 * A：用户把自己的 API key 填在设置里，只存本机浏览器（localStorage），浏览器直连模型，不进仓库、不进数据库。
 * D：没填 key 时，把库存和需求拼成提示词，一键复制或打开豆包 / 千问 / ChatGPT 网页粘贴。
 * 所有 OpenAI 兼容接口共用一套代码；Gemini、Claude 各自一套。发送给模型的只有食材名、数量、单位、临期天数，不传备注。 */
import { state } from "./state.js";
import { inSpace, num } from "./util.js";
import { lang, t } from "./i18n.js";

const KEY = "hmh-ai";
// 按性价比排序：前三个一次菜单约几分钱或免费
export const PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", kind: "openai", base: "https://api.deepseek.com", model: "deepseek-chat", cost: "cheapest", signup: "https://platform.deepseek.com/", hint: "注册送额度；之后每次菜单约几分钱" },
  { id: "qwen", name: "通义千问（阿里百炼）", kind: "openai", base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo", cost: "cheapest", signup: "https://bailian.console.aliyun.com/", hint: "新用户有免费额度；qwen-turbo 最便宜" },
  { id: "gemini", name: "Google Gemini", kind: "gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.0-flash", cost: "free", signup: "https://aistudio.google.com/apikey", hint: "AI Studio 免费额度，国内需能访问 Google" },
  { id: "doubao", name: "豆包（火山方舟）", kind: "openai", base: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-lite-32k", cost: "cheapest", signup: "https://console.volcengine.com/ark", hint: "模型名填你在方舟开通的接入点或模型 ID；浏览器直连若被拒，用“复制提示词”" },
  { id: "kimi", name: "Kimi（月之暗面）", kind: "openai", base: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", cost: "cheap", signup: "https://platform.moonshot.cn/", hint: "" },
  { id: "openai", name: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", model: "gpt-4o-mini", cost: "cheap", signup: "https://platform.openai.com/api-keys", hint: "gpt-4o-mini 够用" },
  { id: "anthropic", name: "Claude（Anthropic）", kind: "anthropic", base: "https://api.anthropic.com/v1", model: "claude-haiku-4-5", cost: "mid", signup: "https://console.anthropic.com/", hint: "Haiku 档最便宜" },
  { id: "custom", name: "自定义（OpenAI 兼容接口）", kind: "openai", base: "", model: "", cost: "", signup: "", hint: "填接口地址（到 /v1 为止）、模型名和 key" },
];
export const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

export function aiSettings() {
  try { return { provider: "deepseek", key: "", model: "", base: "", people: 4, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; } catch { return { provider: "deepseek", key: "", model: "", base: "", people: 4 }; }
}
export function saveAiSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 忽略 */ } }
export const aiReady = () => !!aiSettings().key.trim();

/* ── 库存上下文：只传食材名、数量、单位、临期天数 ── */
const FOOD_CATS = new Set(["fresh", "frozen", "dry", "drink"]);
export function pantryContext() {
  const items = state.enriched.filter(inSpace("pantry")).filter((x) => FOOD_CATS.has(x.category) && num(x.qty) > 0);
  const line = (x) => { const d = x.expDays ?? null; return `${x.name} ${num(x.qty)}${x.unit || ""}${d != null && d <= 7 ? `（${d < 0 ? t("已过期") : t("{d} 天内到期", { d })}）` : ""}`; };
  const byCat = {};
  for (const x of items) (byCat[x.category] ||= []).push(line(x));
  const names = { fresh: t("生鲜"), frozen: t("冷冻"), dry: t("干货粮油"), drink: t("饮品") };
  const expiring = items.filter((x) => x.exp).map((x) => x.name);
  const diet = window.DIETS?.[state.diet];
  return { text: Object.entries(byCat).map(([c, l]) => `${names[c] || c}：${l.join("、")}`).join("\n"), expiring, diet: diet ? t(diet.name) : "", count: items.length };
}

/* ── 提示词 ── */
export function menuPrompt(ask, { people } = {}) {
  const ctx = pantryContext();
  const n = people || aiSettings().people || 4;
  const sys = lang === "en"
    ? "You are a family meal planner. Use the pantry stock below first (especially items about to expire), keep dishes simple and home-style, and reply ONLY with JSON."
    : "你是家庭菜单助手。优先使用下面的库存食材（尤其是快到期的），菜要家常、步骤简单，只用 JSON 回答，不要别的文字。";
  const schema = `{"title":"${lang === "en" ? "one-line title" : "一句话标题"}","meals":[{"name":"${lang === "en" ? "Breakfast" : "早餐"}","dishes":[{"name":"${lang === "en" ? "dish" : "菜名"}","uses":["${lang === "en" ? "stock item used" : "用到的库存食材"}"],"missing":["${lang === "en" ? "item to buy" : "需要买的食材"}"],"note":"${lang === "en" ? "one-line how-to" : "一句做法要点"}"}]}],"tips":"${lang === "en" ? "one line" : "一句提示"}"}`;
  const user = [
    lang === "en" ? `Household size: ${n}.` : `家庭人数：${n} 人。`,
    ctx.diet ? (lang === "en" ? `Diet mode: ${ctx.diet}.` : `饮食模式：${ctx.diet}。`) : "",
    lang === "en" ? "Pantry stock:" : "现有库存：", ctx.text || (lang === "en" ? "(empty)" : "（空）"),
    ctx.expiring.length ? (lang === "en" ? `Use first (expiring): ${ctx.expiring.join(", ")}` : `优先用掉（临期）：${ctx.expiring.join("、")}`) : "",
    lang === "en" ? `Request: ${ask || "a one-day menu (breakfast, lunch, dinner)"}` : `需求：${ask || "一天三餐（早、午、晚）的菜单"}`,
    lang === "en" ? `Return JSON in exactly this shape: ${schema}` : `严格按这个 JSON 结构返回：${schema}`,
  ].filter(Boolean).join("\n");
  return { system: sys, user, context: ctx };
}
/** 无 key 模式：整段可复制的提示词 */
export const promptText = (ask, opts) => { const p = menuPrompt(ask, opts); return `${p.system}\n\n${p.user}`; };

/* ── 调用 ── */
export async function askModel(ask, opts = {}) {
  const s = aiSettings(), p = providerOf(s.provider);
  const base = (s.base || p.base).replace(/\/+$/, ""), model = s.model || p.model, key = s.key.trim();
  if (!key) throw new Error(t("还没填 API key，去设置 → AI 助手"));
  const { system, user } = menuPrompt(ask, opts);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    let text;
    if (p.kind === "gemini") {
      const r = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.7, responseMimeType: "application/json" } }) });
      const j = await readJson(r);
      text = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join("") || "";
    } else if (p.kind === "anthropic") {
      const r = await fetch(`${base}/messages`, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: "user", content: user }] }) });
      const j = await readJson(r);
      text = (j.content || []).map((x) => x.text || "").join("");
    } else {
      const r = await fetch(`${base}/chat/completions`, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
      const j = await readJson(r);
      text = j.choices?.[0]?.message?.content || "";
    }
    return { text, menu: parseMenu(text) };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(t("模型超时，稍后再试"));
    if (e instanceof TypeError) throw new Error(t("浏览器无法直连这个接口（跨域或网络被拒）。可以换 DeepSeek / Gemini，或用“复制提示词”。"));
    throw e;
  } finally { clearTimeout(timer); }
}
async function readJson(r) {
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* 下面报错 */ }
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || j?.message || txt.slice(0, 200)}`);
  if (!j) throw new Error(t("模型返回的不是 JSON"));
  return j;
}
/** 从回复里抠出 JSON；只接受合法 JSON，不执行任何内容 */
export function parseMenu(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/); if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.meals)) return null;
    const str = (v) => (typeof v === "string" ? v.slice(0, 200) : "");
    const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, 12) : []);
    return { title: str(j.title), tips: str(j.tips), meals: j.meals.slice(0, 6).map((mm) => ({ name: str(mm?.name), dishes: (Array.isArray(mm?.dishes) ? mm.dishes : []).slice(0, 8).map((d) => ({ name: str(d?.name), uses: arr(d?.uses), missing: arr(d?.missing), note: str(d?.note) })) })) };
  } catch { return null; }
}

/** 测试连接：问一句最短的 */
export async function testModel() {
  const s = aiSettings(), p = providerOf(s.provider), key = s.key.trim();
  const base = (s.base || p.base).replace(/\/+$/, ""), model = s.model || p.model;
  if (!key) throw new Error(t("先填 API key"));
  if (p.kind === "gemini") { await readJson(await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] }) })); return; }
  if (p.kind === "anthropic") { await readJson(await fetch(`${base}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "hi" }] }) })); return; }
  await readJson(await fetch(`${base}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "hi" }] }) }));
}
