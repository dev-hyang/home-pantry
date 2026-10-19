/* AI 菜单助手 · 调用层（方案 A + D）
 * A：用户把自己的 API key 填在设置里，只存本机浏览器（localStorage），浏览器直连模型，不进仓库、不进数据库。
 * D：没填 key 时，把库存和需求拼成提示词，一键复制或打开豆包 / 千问 / ChatGPT 网页粘贴。
 * 所有 OpenAI 兼容接口共用一套代码；Gemini、Claude 各自一套。发送给模型的只有食材名、数量、单位、临期天数，不传备注。 */
import { state } from "./state.js";
import { inSpace, num } from "./util.js";
import { lang, locale, t } from "./i18n.js";

const KEY = "hmh-ai";
const USAGE_KEY = "hmh-ai-usage";   // 本机调用计数：{ provider: { day, count, minute, mcount, blockedUntil } }

/** AI 助手图标：圆角渐变底 + 白色 Y 字（两臂微弯）+ 右上角一颗芥末黄小星，内联 SVG，随文字大小缩放 */
export function aiIcon(size = 22, cls = "") {
  return `<svg class="ai-ico ${cls}" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <defs><linearGradient id="aiG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6d5a"/><stop offset="1" stop-color="#7cc4a8"/></linearGradient></defs>
    <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#aiG)"/>
    <path d="M9.5 9.5 C11.5 13 13.5 15 16 17.5 C18.5 15 20.5 13 22.5 9.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 17.5 V24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M24.5 4.5 L25.6 7.4 L28.5 8.5 L25.6 9.6 L24.5 12.5 L23.4 9.6 L20.5 8.5 L23.4 7.4 Z" fill="#e9b949"/>
  </svg>`;
}
// 默认 Gemini：美国可用的免费额度；其余按性价比排序。免费档的次数上限见 FREE_TIER，到上限就停
export const PROVIDERS = [
  // keyHint：怎么拿 key、长什么样；keyPrefix：key 开头（测试连接时先核对，贴错服务的 key 会直接提示）。模型名和地址都有默认值，只有“自定义”需要填
  { id: "gemini", name: "Google Gemini", kind: "gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", cost: "free", signup: "https://aistudio.google.com/apikey", hint: "AI Studio 免费额度（每天有次数上限，太平洋时间 0 点重置）；国内需能访问 Google",
    keyHint: "打开 Google AI Studio → Get API key → Create API key，复制以 AIza 开头的一整串贴到这里。模型和地址不用填，会自动选可用的 Gemini Flash 模型。", keyPrefix: "AIza" },
  { id: "groq", name: "Groq（Llama，免费档）", kind: "openai", base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant", cost: "free", signup: "https://console.groq.com/keys", hint: "免费档每天有次数上限，速度快；上限以控制台 Limits 页为准", keyHint: "console.groq.com → API Keys → Create API Key，key 以 gsk_ 开头。", keyPrefix: "gsk_" },
  { id: "openrouter", name: "OpenRouter（免费模型）", kind: "openai", base: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", cost: "free", signup: "https://openrouter.ai/keys", hint: "带 :free 的模型不收费，但每天次数很少；模型名以网站列表为准", keyHint: "openrouter.ai → Keys → Create key，key 以 sk-or- 开头。", keyPrefix: "sk-or-" },
  { id: "deepseek", name: "DeepSeek", kind: "openai", base: "https://api.deepseek.com", model: "deepseek-chat", cost: "cheapest", signup: "https://platform.deepseek.com/", hint: "注册送额度；之后每次菜单约几分钱", keyHint: "platform.deepseek.com → API keys → 创建，key 以 sk- 开头。", keyPrefix: "sk-" },
  { id: "qwen", name: "通义千问（阿里百炼）", kind: "openai", base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo", cost: "cheapest", signup: "https://bailian.console.aliyun.com/", hint: "新用户有免费额度；qwen-turbo 最便宜", keyHint: "阿里云百炼控制台 → API-KEY 管理 → 创建，key 以 sk- 开头。", keyPrefix: "sk-" },
  { id: "doubao", name: "豆包（火山方舟）", kind: "openai", base: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-lite-32k", cost: "cheapest", signup: "https://console.volcengine.com/ark", hint: "模型名填你在方舟开通的接入点或模型 ID；浏览器直连若被拒，用“复制提示词”" },
  { id: "kimi", name: "Kimi（月之暗面）", kind: "openai", base: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", cost: "cheap", signup: "https://platform.moonshot.cn/", hint: "" },
  { id: "openai", name: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", model: "gpt-4o-mini", cost: "cheap", signup: "https://platform.openai.com/api-keys", hint: "gpt-4o-mini 够用" },
  { id: "anthropic", name: "Claude（Anthropic）", kind: "anthropic", base: "https://api.anthropic.com/v1", model: "claude-haiku-4-5", cost: "mid", signup: "https://console.anthropic.com/", hint: "Haiku 档最便宜" },
  { id: "custom", name: "自定义（OpenAI 兼容接口）", kind: "openai", base: "", model: "", cost: "", signup: "", hint: "填接口地址（到 /v1 为止）、模型名和 key" },
];
export const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

// auth：自定义接口的鉴权头——bearer（Authorization: Bearer，OpenAI 兼容接口默认）/ x-api-key / api-key（Azure 风格）
export const AUTH_STYLES = { bearer: "Authorization: Bearer（默认）", "x-api-key": "x-api-key 头", "api-key": "api-key 头（Azure 风格）" };
export function aiSettings() {
  // freeOnly：只用免费额度，到上限就停；rpm / rpd：每分钟 / 每天上限，留空用 FREE_TIER 默认
  const def = { provider: "gemini", key: "", model: "", base: "", people: 4, auth: "bearer", freeOnly: true, rpm: "", rpd: "" };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; } catch { return def; }
}

/* ── 免费额度：按服务商的免费档计数，到上限就不发请求，并算出下次可用时间；429 也记下恢复时间 ──
 * 数字是各家公布的免费档常见值，会变，设置里可以改；日配额重置时区：Gemini 太平洋时间 0 点，其余按 UTC 估 */
export const FREE_TIER = {
  gemini:     { rpm: 10, rpd: 250, reset: "pt", resetText: "太平洋时间 0 点重置" },
  groq:       { rpm: 30, rpd: 1000, reset: "utc", resetText: "按 UTC 0 点估算重置" },
  openrouter: { rpm: 20, rpd: 50, reset: "utc", resetText: "按 UTC 0 点估算重置" },
};
export class QuotaError extends Error { constructor(msg, q) { super(msg); this.name = "QuotaError"; this.quota = q; } }
function usage() { try { return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}"); } catch { return {}; } }
function saveUsage(u) { try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch { /* 忽略 */ } }
const TZ = { pt: "America/Los_Angeles", utc: "UTC" };
/** 配额日的日期键（按重置时区） */
function dayKey(reset) {
  const d = new Date();
  if (TZ[reset]) return new Intl.DateTimeFormat("en-CA", { timeZone: TZ[reset], year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** 下次重置的时间戳：该时区的下一个 0 点 */
export function nextReset(reset) {
  const now = new Date();
  if (!TZ[reset]) { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ[reset], hour12: false, hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(now).map((x) => [x.type, +x.value]));
  const secs = ((parts.hour || 0) % 24) * 3600 + (parts.minute || 0) * 60 + (parts.second || 0);
  return now.getTime() + (86400 - secs) * 1000;
}
/** 当前能不能免费调用：{ ok, reason: daily|minute|blocked, resumeAt, used, cap, remaining } */
export function aiQuota(s = aiSettings()) {
  const p = providerOf(s.provider), tier = FREE_TIER[p.id] || null;
  const cap = { rpm: num(s.rpm) || tier?.rpm || 0, rpd: num(s.rpd) || tier?.rpd || 0 };
  const u = usage()[p.id] || {}, now = Date.now();
  const used = u.day === dayKey(tier?.reset) ? u.count || 0 : 0;
  const base = { used, cap: cap.rpd, tier, remaining: cap.rpd ? Math.max(0, cap.rpd - used) : null };
  if (u.blockedUntil && u.blockedUntil > now) return { ...base, ok: false, reason: u.blockedDaily ? "daily" : "blocked", resumeAt: u.blockedUntil };
  if (s.freeOnly === false) return { ...base, ok: true };
  if (cap.rpd && used >= cap.rpd) return { ...base, ok: false, reason: "daily", resumeAt: nextReset(tier?.reset) };
  const minute = Math.floor(now / 60000), mUsed = u.minute === minute ? u.mcount || 0 : 0;
  if (cap.rpm && mUsed >= cap.rpm) return { ...base, ok: false, reason: "minute", resumeAt: (minute + 1) * 60000 };
  return { ...base, ok: true };
}
export function quotaMessage(q) {
  const when = new Date(q.resumeAt), sameDay = when.toDateString() === new Date().toDateString();
  const time = when.toLocaleString(locale(), sameDay ? { hour: "2-digit", minute: "2-digit" } : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  if (q.reason === "minute") return t("这一分钟的免费次数用完了，{s} 秒后再试", { s: Math.max(1, Math.ceil((q.resumeAt - Date.now()) / 1000)) });
  if (q.reason === "daily") return t("今天的免费额度用完了（已用 {n} 次），预计 {time} 恢复；现在可以用“复制提示词”", { n: q.used, time });
  return t("服务商限流了，{time} 后再试；现在可以用“复制提示词”", { time });
}
/** 设置页状态行 */
export function quotaStatus(q) {
  if (!q.ok) return quotaMessage(q);
  if (q.cap) return t("今天已用 {n} / {cap} 次免费额度，还剩 {left} 次", { n: q.used, cap: q.cap, left: q.remaining });
  return q.used ? t("今天已调用 {n} 次（没设上限）", { n: q.used }) : t("今天还没调用过");
}
function countUse(p) {
  const tier = FREE_TIER[p.id], u = usage(), x = u[p.id] || {}, dk = dayKey(tier?.reset), minute = Math.floor(Date.now() / 60000);
  if (x.day === dk) x.count = (x.count || 0) + 1; else { x.day = dk; x.count = 1; }
  if (x.minute === minute) x.mcount = (x.mcount || 0) + 1; else { x.minute = minute; x.mcount = 1; }
  delete x.blockedUntil; delete x.blockedDaily;
  u[p.id] = x; saveUsage(u);
}
export function resetUsage(providerId) { const u = usage(); delete u[providerId]; saveUsage(u); }
/** 429：按 Retry-After / Gemini 的 retryDelay 记下恢复时间；提到日配额的，直接等到下次重置 */
function rateLimited(e, p) {
  const tier = FREE_TIER[p.id], body = e.body || "";
  const m = /retryDelay"?\s*:\s*"?(\d+)/i.exec(body);
  const secs = e.retryAfter ? parseInt(e.retryAfter, 10) || 0 : m ? +m[1] : 0;
  const daily = /per day|perday|per_day|daily|requests_per_day|RPD|quota exceeded for.*day/i.test(body);
  const until = daily && tier ? nextReset(tier.reset) : Date.now() + Math.max(secs || 60, 15) * 1000;
  const u = usage(); u[p.id] = { ...(u[p.id] || {}), blockedUntil: until, blockedDaily: !!daily }; saveUsage(u);
  const q = { reason: daily ? "daily" : "blocked", resumeAt: until, used: u[p.id].count || 0 };
  return new QuotaError(quotaMessage(q), q);
}
/* ── Gemini 模型名自动选择：模型名经常换代（2.0 → 2.5 …），用户没填就从 /models 列表里挑一个可用的 Flash，记在本机 ── */
const AUTO_MODEL_KEY = "hmh-ai-auto-model";
const GEMINI_PREF = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-flash-latest"];
export function autoModel(providerId) { try { return JSON.parse(localStorage.getItem(AUTO_MODEL_KEY) || "{}")[providerId] || ""; } catch { return ""; } }
function saveAutoModel(providerId, model) { try { const m = JSON.parse(localStorage.getItem(AUTO_MODEL_KEY) || "{}"); m[providerId] = model; localStorage.setItem(AUTO_MODEL_KEY, JSON.stringify(m)); } catch { /* 忽略 */ } }
async function resolveGeminiModel(base, key) {
  const j = await readJson(await fetch(`${base}/models?key=${encodeURIComponent(key)}&pageSize=200`));
  const names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name || "").replace(/^models\//, ""));
  const pick = GEMINI_PREF.find((n) => names.includes(n)) || names.find((n) => /flash/i.test(n) && !/image|tts|audio|live|embedding/i.test(n)) || names[0];
  if (!pick) throw new Error(t("这个 key 下没有可用的 Gemini 模型，去 AI Studio 确认 key 是否启用了 Generative Language API"));
  saveAutoModel("gemini", pick);
  return pick;
}
/** Gemini 一次调用；模型名 404 且用户没手填时，查一次列表换成可用的再试 */
async function geminiCall(s, base, key, body, signal) {
  const call = (model) => fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(readJson);
  const model = s.model || autoModel("gemini") || providerOf("gemini").model;
  try { return await call(model); }
  catch (e) { if (e.status !== 404 || s.model) throw e; return call(await resolveGeminiModel(base, key)); }
}
/** 发请求前的闸门：超了免费额度就不发，直接告诉用户什么时候能用 */
function gate(s, p) {
  const q = aiQuota(s);
  if (!q.ok) throw new QuotaError(quotaMessage(q), q);
}
/** OpenAI 兼容接口的请求头：按设置选鉴权方式（只对“自定义”生效，其余服务固定 Bearer） */
function openaiHeaders(s, p, key) {
  const h = { "Content-Type": "application/json" };
  const style = p.id === "custom" ? s.auth || "bearer" : "bearer";
  if (style === "x-api-key") h["x-api-key"] = key; else if (style === "api-key") h["api-key"] = key; else h.Authorization = `Bearer ${key}`;
  return h;
}
/** 把 HTTP 错误翻译成能动手排查的提示 */
function explainHttp(e, base) {
  const m = /^(\d{3}) /.exec(e.message || ""); if (!m) return e;
  const code = +m[1];
  const html = /<!doctype|<html/i.test(e.message);
  if (code === 401 || code === 403) return new Error(t("{code}：这个地址不接受这个 key。检查：key 是否就是这个服务发的、有没有过期或多了空格；地址是不是真正的 API 域名（有些服务的 API 在另一个域名，不是官网）；“自定义”里可换鉴权头试试（x-api-key / api-key）。", { code }));
  if (code === 404) return new Error(t("404：地址或模型名不对。接口地址填到 /v1 为止，模型名按服务商控制台里的写。"));
  if (html) return new Error(t("{code}：返回的是网页不是接口，说明这个地址不是 API 地址。", { code }));
  return e;
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
/** 通用一问一答：system + user → 文本；json=true 时要求模型只回 JSON（Gemini 用 responseMimeType） */
export async function askText(system, user, { json = false, maxTokens = 1500 } = {}) {
  const s = aiSettings(), p = providerOf(s.provider);
  const base = (s.base || p.base).replace(/\/+$/, ""), model = s.model || p.model, key = s.key.trim().replace(/^Bearer\s+/i, "");   // 有人把 “Bearer xxx” 整段贴进来
  if (!key) throw new Error(t("还没填 API key，去设置 → AI 助手"));
  gate(s, p);   // 免费额度用完 / 被限流：不发请求，直接提示下次可用时间
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    let text;
    if (p.kind === "gemini") {
      const j = await geminiCall(s, base, key, { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.7, ...(json ? { responseMimeType: "application/json" } : {}) } }, ctl.signal);
      text = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join("") || "";
    } else if (p.kind === "anthropic") {
      const r = await fetch(`${base}/messages`, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }) });
      const j = await readJson(r);
      text = (j.content || []).map((x) => x.text || "").join("");
    } else {
      const r = await fetch(`${base}/chat/completions`, { method: "POST", signal: ctl.signal, headers: openaiHeaders(s, p, key),
        body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
      const j = await readJson(r);
      text = j.choices?.[0]?.message?.content || "";
    }
    countUse(p);
    return text;
  } catch (e) {
    if (e.name === "AbortError") throw new Error(t("模型超时，稍后再试"));
    if (e instanceof TypeError) throw new Error(t("浏览器无法直连这个接口（跨域或网络被拒）。可以换 DeepSeek / Gemini，或用“复制提示词”。"));
    if (e.status === 429) throw rateLimited(e, p);
    throw explainHttp(e, base);
  } finally { clearTimeout(timer); }
}
export async function askModel(ask, opts = {}) {
  const { system, user } = menuPrompt(ask, opts);
  const text = await askText(system, user, { json: true });
  return { text, menu: parseMenu(text) };
}

/* ── 小Y问：家里任何事（房屋保养、账单、买卖房、清洁收纳…）的上下文 ── */
export function homeContext() {
  const L = [], en = lang === "en";
  const push = (label, body) => L.push(`${label}${en ? ": " : "："}${body}`);
  const sep = en ? ", " : "，", list = en ? ", " : "、";
  const props = state.properties.filter((p) => !p.archived);
  const K = window.BILLS?.PROPERTY_KINDS || {}, ST = window.DEALS?.PROPERTY_STATUS || {};
  for (const p of props) {
    const prof = state.houseProfiles?.[p.id], H = window.HOUSE;
    const ht = prof && H ? H.typeOf(prof.region, prof.house_type) : null;
    const feats = prof && H ? H.FEATURES.filter((f) => (prof.features || []).includes(f.id)).map((f) => t(f.name)) : [];
    const paren = (s) => (en ? ` (${s})` : `（${s}）`);
    push(t("房产"), `${p.name}${paren([t(ST[p.status] || "持有"), t(K[p.kind] || ""), ht ? t(ht.name) : null, prof?.year_built ? t("{y} 年建", { y: prof.year_built }) : null].filter(Boolean).join(sep))}${feats.length ? `${sep}${t("设施")}${en ? ": " : "："}${feats.join(list)}` : ""}${prof?.hoa?.enabled ? `${sep}${t("有 HOA / 物业")}` : ""}`);
  }
  const paren = (s) => (en ? ` (${s})` : `（${s}）`);
  const assets = (state.assetsEnriched || []).filter((a) => a.service === "overdue" || a.service === "due" || a.followUp);
  if (assets.length) push(t("设备待处理"), assets.slice(0, 8).map((a) => `${a.name}${paren(a.followUp ? t("检查发现需处理") : a.service === "overdue" ? t("保养逾期") : t("该保养了"))}`).join(list));
  const bills = (state.billsEnriched || []).filter((b) => ["overdue", "due", "soon", "verify"].includes(b.status));
  if (bills.length) push(t("近期账单"), bills.slice(0, 8).map((b) => `${b.name}${b.est != null ? ` ${Units.money(b.est, b.currency || Units.region.currency)}` : ""}${b.next_due_on ? paren(b.next_due_on) : ""}`).join(list));
  const pc = pantryContext();
  if (pc.count) push(t("储藏"), `${t("{n} 种食材", { n: pc.count })}${pc.expiring.length ? `${sep}${t("临期")}${en ? ": " : "："}${pc.expiring.slice(0, 8).join(list)}` : ""}`);
  const region = state.houseProfile?.region === "cn" ? t("中国") : t("美国");
  push(t("所在地区"), `${region}${state.members?.length ? `${en ? "; " : "；"}${t("家庭成员 {n} 人", { n: state.members.length })}` : ""}`);
  return L.join("\n");
}
export function generalPrompt(q, { withContext = true } = {}) {
  const sys = lang === "en"
    ? "You are a friendly household assistant for a family: home maintenance, bills and saving money, buying or selling a home, cleaning and organizing, meal planning, childcare logistics. Answer practically and concisely, in steps where useful; say when a professional (electrician, plumber, attorney, doctor) is needed."
    : "你是一个家庭生活助手，帮一家人处理房屋保养、账单与省钱、买房卖房流程、清洁收纳、饮食与育儿家务等问题。回答要实用、简洁，必要时分步骤；涉及燃气、电、结构、法律、医疗时提醒找专业人士。";
  const user = `${withContext ? `${lang === "en" ? "About this household:" : "家里的情况："}\n${homeContext()}\n\n` : ""}${lang === "en" ? "Question:" : "问题："}${q}`;
  return { system: sys, user };
}
export const generalPromptText = (q, opts) => { const p = generalPrompt(q, opts); return `${p.system}\n\n${p.user}`; };
async function readJson(r) {
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* 下面报错 */ }
  if (!r.ok) { const e = new Error(`${r.status} ${j?.error?.message || j?.message || txt.slice(0, 200)}`); e.status = r.status; e.retryAfter = r.headers.get("retry-after"); e.body = txt.slice(0, 3000); throw e; }
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
  if (p.id === "custom" && !/^https:\/\//i.test(base)) throw new Error(t("接口地址要以 https:// 开头，填到 /v1 为止"));
  if (p.keyPrefix && !key.startsWith(p.keyPrefix)) throw new Error(t("{p} 的 key 应该以 {prefix} 开头，这个看起来不是它发的 key；{hint}", { p: t(p.name), prefix: p.keyPrefix, hint: t(p.keyHint || "") }));
  gate(s, p);
  try {
    if (p.kind === "gemini") await geminiCall(s, base, key, { contents: [{ role: "user", parts: [{ text: "hi" }] }] });
    else if (p.kind === "anthropic") await readJson(await fetch(`${base}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "hi" }] }) }));
    else await readJson(await fetch(`${base}/chat/completions`, { method: "POST", headers: openaiHeaders(s, p, key), body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "hi" }] }) }));
    countUse(p);   // 测试也算一次
  } catch (e) {
    if (e instanceof TypeError) throw new Error(t("浏览器无法直连这个接口（跨域或网络被拒）。可以换 DeepSeek / Gemini，或用“复制提示词”。"));
    if (e.status === 429) throw rateLimited(e, p);
    throw explainHttp(e, base);
  }
}
