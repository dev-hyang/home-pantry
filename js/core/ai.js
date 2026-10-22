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
  { id: "gemini", name: "Google Gemini", kind: "gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.5-flash-lite", cost: "free", signup: "https://aistudio.google.com/apikey", hint: "AI Studio 免费额度（每天有次数上限，太平洋时间 0 点重置）；国内需能访问 Google",
    keyHint: "打开 Google AI Studio → Get API key → Create API key，复制整串贴到这里（旧 key 以 AIza 开头，新 key 以 AQ. 开头，都行）。模型和地址不用填，会自动选可用的 Gemini Flash 模型。", keyPrefix: ["AIza", "AQ."] },
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
  gemini:     { rpm: 10, rpd: 500, reset: "pt", resetText: "太平洋时间 0 点重置" },   // 自动换模型时按最高的那档（Flash Lite 500 / 天）算；选了具体模型会按目录带入它自己的上限   // 按 AI Studio “Rate limits” 页里你这个模型的 RPD 填；RPM 留低一点就行，TPM 对我们这种一次一两千 token 的用法不会先到
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
  // 只认“整个项目”级别的封锁（blockedScope = project）。以前的版本把“某个模型的额度用完”也记成整个服务商用完，那种旧标记没有 scope：忽略并清掉，
  // 否则一个模型超限就把 key 锁到第二天，其他还有额度的模型也用不了
  if (u.blockedUntil && u.blockedUntil > now && u.blockedScope === "project") return { ...base, ok: false, reason: u.blockedDaily ? "daily" : "blocked", resumeAt: u.blockedUntil, fromGoogle: true };
  if (u.blockedUntil && u.blockedScope !== "project") { const all = usage(); delete all[p.id]?.blockedUntil; delete all[p.id]?.blockedDaily; saveUsage(all); }
  if (s.freeOnly === false) return { ...base, ok: true };
  if (cap.rpd && used >= cap.rpd) return { ...base, ok: false, reason: "daily", resumeAt: nextReset(tier?.reset) };
  const minute = Math.floor(now / 60000), mUsed = u.minute === minute ? u.mcount || 0 : 0;
  if (cap.rpm && mUsed >= cap.rpm) return { ...base, ok: false, reason: "minute", resumeAt: (minute + 1) * 60000 };
  return { ...base, ok: true };
}
export function quotaMessage(q) {
  const when = new Date(q.resumeAt), sameDay = when.toDateString() === new Date().toDateString();
  const time = when.toLocaleString(locale(), sameDay ? { hour: "2-digit", minute: "2-digit" } : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const retry = t("如果确定没超限，到 设置 → AI 助手 点“重置计数”可以立刻再试。");
  if (q.reason === "minute") return t("这一分钟的免费次数用完了，{s} 秒后再试", { s: Math.max(1, Math.ceil((q.resumeAt - Date.now()) / 1000)) });
  if (q.reason === "daily") return q.fromGoogle ? `${t("Google 说这个 key 整个项目今天的额度用完了，预计 {time} 恢复；现在可以用“复制提示词”。", { time })} ${retry}`
    : `${t("本机计数已到今天的上限（已用 {n} 次），预计 {time} 恢复；现在可以用“复制提示词”。", { n: q.used, time })} ${retry}`;
  return `${t("服务商限流了，{time} 后再试；现在可以用“复制提示词”。", { time })} ${retry}`;
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
  const u = usage(); u[p.id] = { ...(u[p.id] || {}), blockedUntil: until, blockedDaily: !!daily, blockedScope: "project" }; saveUsage(u);
  const q = { reason: daily ? "daily" : "blocked", resumeAt: until, used: u[p.id].count || 0, fromGoogle: true };
  return new QuotaError(quotaMessage(q), q);
}
/* ── Gemini 模型名自动选择：模型名经常换代（2.0 → 2.5 …），用户没填就从 /models 列表里挑一个可用的 Flash，记在本机 ── */
const AUTO_MODEL_KEY = "hmh-ai-auto-model";
export function autoModel(providerId) { try { return JSON.parse(localStorage.getItem(AUTO_MODEL_KEY) || "{}")[providerId] || ""; } catch { return ""; } }
function saveAutoModel(providerId, model) { try { const m = JSON.parse(localStorage.getItem(AUTO_MODEL_KEY) || "{}"); m[providerId] = model; localStorage.setItem(AUTO_MODEL_KEY, JSON.stringify(m)); } catch { /* 忽略 */ } }
/** Google 的 404 里常写着“请改用 models/xxx”：把它点名的模型取出来，第一个试（旧模型对新 key 下线时就是这样） */
export const suggestedModel = (msg) => { const m = /(?:use|try|switch to)[^.]*?models\/([\w.\-]+)/i.exec(String(msg || "")) || /models\/(gemini[\w.\-]*)/i.exec(String(msg || "")); return m ? m[1].replace(/[.,;:)]+$/, "") : ""; };
/** 这个 key 能用的 Gemini 模型：只要 Flash 系、能 generateContent、不是图像 / 语音 / 实时等专用模型；版本号从新到旧（旧模型会陆续对新 key 下线，
 * 它们常常还在列表里却调用 404，所以不能再按固定的旧名单排），同一版本里稳定版在前、flash 在 flash-lite 前 */
export function rankGemini(gen) {
  const ver = (n) => { const m = /^gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? parseFloat(m[1]) : 0; };
  const info = (n) => (FREE_MODELS.gemini || []).find((m) => m.id === n);
  // 排序：免费档每天次数多的在前（目录里有的按目录；目录里没有的新模型按 100 估，排在 Lite 之后、20 次档之前），同档再按版本新到旧
  const rpd = (n) => (info(n) ? info(n).rpd : 100), pre = (n) => (/preview|exp|beta/i.test(n) ? 1 : 0);
  return gen.filter((n) => /^gemini/i.test(n) && /flash/i.test(n) && !/image|tts|audio|live|embedding|robotics|computer-use|thinking|learnlm|transcribe|omni/i.test(n) && info(n)?.free !== false)
    .sort((a, b) => rpd(b) - rpd(a) || pre(a) - pre(b) || ver(b) - ver(a) || a.localeCompare(b));
}
async function geminiCandidates(base, key) {
  const j = await readJson(await fetch(`${base}/models?key=${encodeURIComponent(key)}&pageSize=200`));
  const all = (j.models || []).map((m) => ({ name: String(m.name || "").replace(/^models\//, ""), methods: m.supportedGenerationMethods || m.supportedActions || [] }));
  const gen = all.filter((m) => !m.methods.length || m.methods.includes("generateContent")).map((m) => m.name);
  return { candidates: rankGemini(gen), all: gen };
}
/* ── 临时错误自动重试：503 / 502 / 500（“模型现在很忙”）等 1.5s、4s 再试两次；429 不在这里重试（按 Retry-After 记恢复时间） ── */
const sleep = (ms, signal) => new Promise((res, rej) => { const id = setTimeout(res, ms); signal?.addEventListener("abort", () => { clearTimeout(id); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); }, { once: true }); });
const transient = (e) => e.status === 503 || e.status === 502 || e.status === 500 || e.status === 504;
async function withRetry(fn, signal, delays = [1500, 4000]) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) { if (!transient(e) || i >= delays.length) throw e; await sleep(delays[i], signal); }
  }
}
/** Gemini 返回 200 但没有可用内容 / 被截断时，把真实原因说出来（之前只会显示“没能读出内容”，看不出是被安全策略拦了、回答被截断还是别的） */
function geminiCheck(j, text, json) {
  const block = j.promptFeedback?.blockReason, cand = j.candidates?.[0], fin = cand?.finishReason;
  const why = block ? `blockReason=${block}` : fin && fin !== "STOP" ? `finishReason=${fin}` : "";
  if (block || (!text && !cand?.content?.parts?.length)) {
    const hint = /SAFETY|PROHIBITED|BLOCK|IMAGE_SAFETY/i.test(`${block} ${fin}`) ? t("Google 的安全策略拦下了这次请求（图片或文字里可能有敏感内容）。换一张图、裁掉敏感部分，或改用别的服务商。")
      : fin === "MAX_TOKENS" ? t("回答太长被截断了：少放几张图，或选“每张是一张独立小票”分开识别。") : t("Google 没有返回内容，稍后再试，或换个模型。");
    const e = new Error(`${hint}${why ? `（${why}）` : ""}`); e.explained = true; throw e;
  }
  if (json && fin === "MAX_TOKENS") { const e = new Error(`${t("回答太长被截断了：少放几张图，或选“每张是一张独立小票”分开识别。")}（finishReason=MAX_TOKENS）`); e.explained = true; throw e; }
}
/* ── 模型黑名单：404（对这个 key 下线了）记 24 小时、429（这个模型的额度用完了）记到恢复时间；之后跳过它们，不再每次先撞一遍 ──
 * Gemini 的额度是“按模型”算的：一个模型的每分钟 / 每天额度用完，换一个模型照样能用，所以 429 不该把整个服务商都锁住 */
const DEAD_KEY = "hmh-ai-dead", BLOCK_KEY = "hmh-ai-blocked";
const readMap = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const liveMap = (k) => { const now = Date.now(), o = {}; for (const [n, u] of Object.entries(readMap(k))) if (u > now) o[n] = u; return o; };
const markModel = (k, model, until) => { const m = liveMap(k); m[model] = until; try { localStorage.setItem(k, JSON.stringify(m)); } catch { /* 忽略 */ } };
export const deadModels = () => liveMap(DEAD_KEY), blockedModels = () => liveMap(BLOCK_KEY);
export function clearModelMarks() { try { localStorage.removeItem(DEAD_KEY); localStorage.removeItem(BLOCK_KEY); } catch { /* 忽略 */ } }
/** Google 的 429：是哪个额度（每分钟 / 每天 / 输入 token）、是不是按模型、多久后恢复 */
export function parse429(e) {
  const body = String(e.body || e.message || ""), m = /retryDelay"?\s*:\s*"?(\d+)/i.exec(body);
  const secs = e.retryAfter ? parseInt(e.retryAfter, 10) || 0 : m ? +m[1] : 0;
  const daily = /PerDay|per day|requests_per_day/i.test(body);
  // Gemini 免费档的额度几乎都是按模型算的（quotaId 带 PerModel，或 quotaDimensions 里有 model）；只有明确写着 PerProject 而没有 model 维度的才当成整个项目用完。
  // 看不出来的（没有 details 的裸 429）也按“按模型”处理：换一个模型试，最多多花几次请求，总好过把 key 锁到第二天
  const projectWide = /PerProject(?!PerModel)/i.test(body) && !/PerModel|"model"\s*:/i.test(body);
  const perModel = !projectWide;
  const msg = (() => { try { return JSON.parse(body)?.error?.message || ""; } catch { return ""; } })() || body.slice(0, 200);
  // 真实上限：violations[].quotaId 里 PerDay / PerMinute（只认“请求数”，token 额度不算），quotaValue 就是次数
  let limit = null;
  try {
    for (const d of JSON.parse(body)?.error?.details || []) for (const v of d.violations || []) {
      const id = String(v.quotaId || ""), val = parseInt(v.quotaValue, 10);
      if (!Number.isFinite(val) || /Token/i.test(id)) continue;
      if (/PerDay/i.test(id)) limit = { field: "rpd", value: val }; else if (/PerMinute/i.test(id) && !limit) limit = { field: "rpm", value: val };
    }
  } catch { /* 不是 JSON */ }
  return { limit, daily, perModel, until: daily ? nextReset("pt") : Date.now() + Math.max(secs || 60, 15) * 1000, msg: String(msg).replace(/\s+/g, " ").slice(0, 220) };
}
const clock = (ms) => { const w = new Date(ms), same = w.toDateString() === new Date().toDateString(); return w.toLocaleString(locale(), same ? { hour: "2-digit", minute: "2-digit" } : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); };

/** Gemini 一次调用。一次操作最多发 MAX_CALLS 个生成请求（含重试和换模型），不再“每个模型重试三次 × 换八个模型”把 RPM 和额度打穿：
 *  - 404：这个模型对 key 下线了，记黑名单，换下一个（Google 在 404 里点名的新模型第一个试；其余按版本从新到旧）
 *  - 503：只在同一个模型上重试一次，还不行就换模型（换到不同档位的更容易成功）
 *  - 429：按模型记到恢复时间，换没用完的模型；如果不是按模型的（整个项目的额度）就停，告诉你 Google 的原话和恢复时间
 *  - 其余（400 / 401 / 403…）：直接报，换模型没用 */
const MAX_CALLS = 6;
async function geminiCall(s, base, key, body, signal) {
  const url = (model) => `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const post = (model) => fetch(url(model), { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(readJson);
  const typed = /^gemini/i.test(s.model || "") ? s.model : "";   // 别家残留的模型名忽略
  const first = typed || autoModel("gemini") || providerOf("gemini").model;
  const dead = deadModels(), blocked = blockedModels(), fails = [], tried = new Set();
  let calls = 0, hinted = "", candidates = null, all = [];
  const usable = (m) => !tried.has(m) && !dead[m] && !blocked[m];
  const attempt = async (model) => {
    tried.add(model);
    for (let n = 0; ; n++) {
      if (calls >= MAX_CALLS) throw Object.assign(new Error("budget"), { budget: true });
      calls++;
      try { return await post(model); }
      catch (e) { if (e.status === 503 && n === 0) { await sleep(2000, signal); continue; } throw e; }
    }
  };
  const queue = [first];
  const auto = autoModel("gemini"); if (auto && auto !== first) queue.push(auto);   // 手填的模型已下线时，直接用上次换成功的，不用每次都重新查列表
  let didList = false;
  for (let qi = 0; qi < queue.length; qi++) {
    const model = queue[qi]; if (tried.has(model)) continue;
    if (dead[model] || blocked[model]) { tried.add(model); fails.push({ model, status: dead[model] ? 404 : 429, skipped: true }); }
    else {
      try {
        const r = await attempt(model);
        if (model !== first && fails.some((f) => f.status === 404)) saveAutoModel("gemini", model);   // 因为 404 换成功的才记住；503 / 429 换的只是临时顶一下
        return r;
      } catch (e) {
        if (e.budget) break;
        if (e.name === "AbortError") throw e;
        if (e.status === 404) { markModel(DEAD_KEY, model, Date.now() + 24 * 3600e3); fails.push({ model, status: 404 }); hinted = hinted || suggestedModel(e.message); if (hinted && !queue.includes(hinted)) queue.splice(qi + 1, 0, hinted); }
        else if (e.status === 503 || e.status === 502 || e.status === 500 || e.status === 504) fails.push({ model, status: e.status });
        else if (e.status === 429) {
          const q = parse429(e);
          if (q.limit) learnLimit("gemini", model, q.limit.field, q.limit.value);   // Google 报文里的真实上限：和目录不同就以它为准并提醒
          if (!q.perModel) {   // 整个项目的额度：换模型没用，直接停
            const u = usage(); u.gemini = { ...(u.gemini || {}), blockedUntil: q.until, blockedDaily: q.daily, blockedScope: "project" }; saveUsage(u);
            throw Object.assign(new QuotaError(t("Google 返回 429（整个项目的额度）：{msg}。预计 {time} 恢复。", { msg: q.msg, time: clock(q.until) }), { reason: q.daily ? "daily" : "blocked", resumeAt: q.until, used: u.gemini.count || 0 }), { explained: true });
          }
          markModel(BLOCK_KEY, model, q.until); fails.push({ model, status: 429, q });
        } else throw e;
      }
    }
    if (!didList && qi === queue.length - 1) {   // 目前排的都不行：这时才去查这个 key 能用的模型（不算生成请求），只加没被拉黑的
      didList = true;
      try { ({ candidates, all } = await geminiCandidates(base, key)); } catch { candidates = []; }
      for (const m of candidates) if (!queue.includes(m) && !dead[m] && !blocked[m]) queue.push(m);
    }
  }
  // 都没成功：把每个模型试出来的结果列清楚；全是 429 就按“额度”报，给出最早恢复时间
  const list = fails.map((f) => `${f.model}${f.skipped ? t("（已知不可用，跳过）") : ""} → ${f.status}${f.status === 429 && f.q ? `（${f.q.daily ? t("每日额度") : t("每分钟额度")}）` : ""}`).join("；");
  const allBlocked = fails.length && fails.every((f) => f.status === 429);
  if (allBlocked) {
    const until = Math.min(...Object.values(blockedModels()), Date.now() + 3600e3), last = fails.at(-1)?.q;
    throw Object.assign(new QuotaError(`${t("试过的模型额度都用完了：{list}。最早 {time} 恢复。Google 的原话：{msg}", { list, time: clock(until), msg: last?.msg || "" })}`, { reason: "blocked", resumeAt: until, used: usage().gemini?.count || 0 }), { explained: true });
  }
  const only503 = fails.length && fails.every((f) => f.status >= 500);
  const msg = only503 ? t("Google 那边现在很忙：{list}。等一两分钟再试。", { list })
    : fails.some((f) => f.status === 404) ? t("这个 key 能用的 Gemini 模型试过了：{list}。能用的模型：{all}。可在“高级”里手填一个。", { list, all: all.slice(0, 12).join(", ") })
    : t("Gemini 这次没成功：{list}", { list });
  const err = new Error(msg); err.explained = true; throw err;   // 不带 status：外层看到 429 会把整个服务商锁住
}
/** 实际用的接口地址和模型：地址只有“自定义”才用手填的（换服务商后残留的地址会把 Gemini 发到别家 → 404）；模型名留空用默认 */
export function effective(s, p) {
  const base = (p.id === "custom" ? s.base : p.base).replace(/\/+$/, "");
  const typed = p.kind === "gemini" && !/^gemini/i.test(s.model || "") ? "" : s.model;   // Gemini 只认 gemini-… 的模型名，别家残留的忽略
  const model = typed || (p.kind === "gemini" ? autoModel("gemini") : "") || p.model;
  return { base, model };
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
  if (e.explained) return e;   // 已经写清楚原因的（如 Gemini 换了几个模型都 404）
  const m = /^(\d{3}) /.exec(e.message || ""); if (!m) return e;
  const code = +m[1];
  const html = /<!doctype|<html/i.test(e.message);
  if (code === 401 || code === 403) return new Error(t("{code}：这个地址不接受这个 key。检查：key 是否就是这个服务发的、有没有过期或多了空格；地址是不是真正的 API 域名（有些服务的 API 在另一个域名，不是官网）；“自定义”里可换鉴权头试试（x-api-key / api-key）。", { code }));
  if (code === 404) return new Error(`${t("404：地址或模型名不对。接口地址填到 /v1 为止，模型名按服务商控制台里的写。")} ${String(e.message).replace(/^404\s*/, "").slice(0, 200)}`);
  if (code >= 500) return new Error(t("服务商那边现在很忙或出错（{code}），已自动重试过。等一两分钟再试，或换个模型。", { code }));
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
/** 能读图片的服务商：Gemini（有免费档）、OpenAI、Claude；“自定义”不确定，放行让接口自己报错 */
/* ── 免费档常用模型目录：设置里下拉选，选中就带入每分钟 / 每天上限（各家公布的免费档值，会变，以控制台为准）。
 * Gemini / Groq 还会用你的 key 去查实际能用的模型（缓存一天）；OpenRouter 的免费模型列表是公开的。目录里没有的模型上限留空，用服务商默认 */
export const FREE_MODELS = {
  // Gemini：AI Studio “Rate limits” 页 2026-10 的免费档值。Flash Lite 每天 500 次，其余 Flash 每天只有 20 次，所以“自动”优先用 Lite；
  // free: false = 免费档额度为 0（2.x Pro / 3.1 Pro / 4 Argon 这类），自动选和下拉里都不碰。模型 ID 按 Google 命名规律写，实际以 /models 列表为准（对不上的会按列表显示）
  gemini: [
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", rpm: 15, rpd: 500, vision: true },
    { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", rpm: 15, rpd: 500, vision: true },
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", rpm: 5, rpd: 20, vision: true },
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", rpm: 5, rpd: 20, vision: true },
    { id: "gemini-3-flash", name: "Gemini 3 Flash", rpm: 5, rpd: 20, vision: true },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (preview)", rpm: 5, rpd: 20, vision: true },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", rpm: 5, rpd: 20, vision: true },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpm: 10, rpd: 20, vision: true },
    { id: "gemma-4-26b-it", name: "Gemma 4 26B（每天 14400 次，是否能读图未确认）", rpm: 30, rpd: 14400 },
    { id: "gemma-4-31b-it", name: "Gemma 4 31B（每天 14400 次，是否能读图未确认）", rpm: 30, rpd: 14400 },
    { id: "gemini-2.0-flash", name: "Gemini 2 Flash", rpm: 0, rpd: 0, free: false },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2 Flash Lite", rpm: 0, rpd: 0, free: false },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", rpm: 0, rpd: 0, free: false },
    { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", rpm: 0, rpd: 0, free: false },
  ],
  groq: [
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B（最快）", rpm: 30, rpd: 14400 },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", rpm: 30, rpd: 1000 },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout（能读图）", rpm: 30, rpd: 1000, vision: true },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", rpm: 30, rpd: 1000 },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", rpm: 30, rpd: 1000 },
    { id: "qwen/qwen3-32b", name: "Qwen3 32B", rpm: 60, rpd: 1000 },
  ],
  openrouter: [   // 免费模型统一每分钟 20 次、每天 50 次（充过 $10 的账号每天 1000 次）
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", rpm: 20, rpd: 50 },
    { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B（能读图）", rpm: 20, rpd: 50, vision: true },
    { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3", rpm: 20, rpd: 50 },
    { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B", rpm: 20, rpd: 50 },
    { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2（能读图）", rpm: 20, rpd: 50, vision: true },
  ],
};
/* ── 目录和现实对不上时的提醒（静态站没有服务器能盯着各家的公告，所以用三种“现场信号”）：
 *  1) 模型列表：每天用你的 key 查一次实际可用的模型，和上次比，新增 / 下线的记下来（listModels）
 *  2) 额度：Google 的 429 报文里写着真实上限（quotaValue），和目录不同就以报文为准，并记一条变化
 *  3) 目录自己的“更新日期”：太久没更新就提示，上限只能当参考
 * 变化记在本机，设置 → AI 助手里显示，点“知道了”才清掉 */
export const FREE_MODELS_AS_OF = "2026-10-21";   // 目录按这一天 AI Studio 的 Rate limits 页填的
export const catalogAgeDays = () => Math.max(0, Math.floor((Date.now() - Date.parse(FREE_MODELS_AS_OF)) / 864e5));
const LEARNED_KEY = "hmh-ai-learned", CHANGES_KEY = "hmh-ai-changes";
const readJ = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const writeJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 忽略 */ } };
export const aiChanges = (pid) => readJ(CHANGES_KEY)[pid] || [];
export function dismissAiChanges(pid) { const c = readJ(CHANGES_KEY); delete c[pid]; writeJ(CHANGES_KEY, c); }
function noteChange(pid, entry) {
  const c = readJ(CHANGES_KEY), list = (c[pid] || []).filter((x) => !(x.type === entry.type && x.model === entry.model && x.field === entry.field));
  c[pid] = [...list, { ...entry, ts: Date.now() }].slice(-12); writeJ(CHANGES_KEY, c);
}
/** 目录里的条目 + Google 报文里学到的真实上限（学到的优先） */
export function modelInfo(pid, id) {
  const base = (FREE_MODELS[pid] || []).find((m) => m.id === id) || null, l = readJ(LEARNED_KEY)[`${pid}/${id}`];
  if (!l) return base;
  return { ...(base || { id, name: id }), ...(l.rpm != null ? { rpm: l.rpm } : {}), ...(l.rpd != null ? { rpd: l.rpd } : {}), learned: true, free: l.rpd === 0 ? false : l.rpd > 0 ? true : base?.free };
}
/** 429 里读到的真实上限（field = rpm | rpd，value = 次数）：和目录 / 上次不同就记下并提醒 */
export function learnLimit(pid, id, field, value) {
  if (!id || !Number.isFinite(value) || value < 0) return;
  const all = readJ(LEARNED_KEY), key = `${pid}/${id}`, was = modelInfo(pid, id)?.[field];
  if (was === value) return;
  all[key] = { ...(all[key] || {}), [field]: value, ts: Date.now() }; writeJ(LEARNED_KEY, all);
  noteChange(pid, { type: "limit", model: id, field, was: was ?? null, now: value });
}
const MODELS_CACHE = "hmh-ai-models";   // { provider: { ts, ids } }：这个 key 实际能用的模型，缓存一天
/** 下拉框用的模型列表：有实际列表就以它为准（目录里有的带上限、没有的上限留空、已对这个 key 下线的标出来），查不到就只给目录 */
export async function listModels(pid, { refresh = false } = {}) {
  const cat = FREE_MODELS[pid] || [], s = aiSettings(), p = providerOf(pid), key = s.key.trim().replace(/^Bearer\s+/i, "");
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(MODELS_CACHE) || "{}"); } catch { /* 忽略 */ }
  let ids = cache[pid]?.ids; const fresh = cache[pid] && Date.now() - cache[pid].ts < 24 * 3600e3;
  if ((!fresh || refresh) && (key || pid === "openrouter")) {
    try {
      const base = effective(s, p).base;
      if (pid === "gemini") { const all = (await geminiCandidates(base, key)).all; ids = [...rankGemini(all), ...all.filter((n) => /^gemma-/i.test(n) && !/image|tts|audio|embedding/i.test(n)).sort()]; }   // 下拉里 Gemma 也列出来（每天次数多，但自动模式不用它：能不能读图没确认）
      else if (pid === "groq") { const j = await readJson(await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })); ids = (j.data || []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed|safeguard/i.test(id)); }
      else if (pid === "openrouter") { const j = await readJson(await fetch(`${base}/models`)); ids = (j.data || []).map((m) => m.id).filter((id) => /:free$/.test(id)); }
      if (ids) {
        const prev = cache[pid]?.ids;
        if (prev) {   // 和上次比：下线 / 新增的记下来（只记文字模型相关的，避免 TTS、图像模型刷屏）
          const relevant = (id) => pid !== "gemini" || /^(gemini|gemma)-[\d.]+-?[a-z-]*$/i.test(id) && !/tts|image|audio|live|embedding|transcribe|omni|robotics/i.test(id);
          const removed = prev.filter((x) => !ids.includes(x) && relevant(x)), added = ids.filter((x) => !prev.includes(x) && relevant(x));
          if (removed.length || added.length) noteChange(pid, { type: "models", removed: removed.slice(0, 8), added: added.slice(0, 8) });
        }
        cache[pid] = { ts: Date.now(), ids }; try { localStorage.setItem(MODELS_CACHE, JSON.stringify(cache)); } catch { /* 忽略 */ }
      }
    } catch (e) { console.warn("[ai models]", e.message); }
  }
  const dead = deadModels();
  if (!ids) return cat.map((m) => ({ ...m, live: false, dead: !!dead[m.id] }));
  const known = (id) => modelInfo(pid, id);
  // Gemini 按实际列表的顺序（新到旧）；其他家目录里的在前、其余按字母
  const order = pid === "gemini" ? ids : [...cat.map((m) => m.id).filter((id) => ids.includes(id)), ...ids.filter((id) => !known(id)).sort()];
  return order.map((id) => ({ ...(known(id) || { id, name: id, rpm: null, rpd: null }), live: true, dead: !!dead[id] }));
}
/** 能不能读图：按服务商，或目录里标了能读图的模型（Groq 的 Llama 4、OpenRouter 的 Gemma 3 等） */
export const visionCapable = (p = providerOf(aiSettings().provider), model = effective(aiSettings(), p).model) => ["gemini", "openai", "anthropic", "custom"].includes(p.id) || !!modelInfo(p.id, model)?.vision;
export async function askText(system, user, { json = false, maxTokens = 1500, images = [], temperature = 0.7 } = {}) {
  const s = aiSettings(), p = providerOf(s.provider);
  const { base, model } = effective(s, p), key = s.key.trim().replace(/^Bearer\s+/i, "");   // 有人把 “Bearer xxx” 整段贴进来
  if (!key) throw new Error(t("还没填 API key，去设置 → AI 助手"));
  gate(s, p);   // 免费额度用完 / 被限流：不发请求，直接提示下次可用时间
  if (images.length && !visionCapable(p)) throw new Error(t("{p} 不能读图片。请在 设置 → AI 助手 里换成 Gemini（有免费额度），或者只粘贴文字。", { p: t(p.name) }));
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), images.length ? 120000 : 60000);
  try {
    let text;
    if (p.kind === "gemini") {
      const parts = [{ text: user }, ...images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.b64 } }))];
      const j = await geminiCall(s, base, key, { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts }], generationConfig: { temperature, ...(json ? { responseMimeType: "application/json" } : {}) } }, ctl.signal);
      text = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join("") || "";
      geminiCheck(j, text, json);
    } else if (p.kind === "anthropic") {
      const j = await withRetry(() => fetch(`${base}/messages`, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: images.length ? [...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.b64 } })), { type: "text", text: user }] : user }] }) }).then(readJson), ctl.signal);
      text = (j.content || []).map((x) => x.text || "").join("");
    } else {
      const j = await withRetry(() => fetch(`${base}/chat/completions`, { method: "POST", signal: ctl.signal, headers: openaiHeaders(s, p, key),
        body: JSON.stringify({ model, temperature, messages: [{ role: "system", content: system }, { role: "user", content: images.length ? [{ type: "text", text: user }, ...images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.b64}` } }))] : user }] }) }).then(readJson), ctl.signal);
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
  const { base, model } = effective(s, p);
  if (!key) throw new Error(t("先填 API key"));
  if (p.id === "custom" && !/^https:\/\//i.test(base)) throw new Error(t("接口地址要以 https:// 开头，填到 /v1 为止"));
  // key 开头核对只拦“明显贴错家”的情况（如给 Gemini 贴了 sk- 开头的 key）；各家格式会变，不认识的开头照样放行，让接口自己判断
  const prefixes = (q) => (Array.isArray(q.keyPrefix) ? q.keyPrefix : q.keyPrefix ? [q.keyPrefix] : []);
  const mine = prefixes(p).some((x) => key.startsWith(x));
  const other = !mine && PROVIDERS.find((q) => q.id !== p.id && prefixes(q).some((x) => key.startsWith(x) && !prefixes(p).some((y) => y.startsWith(x))));
  if (other) throw new Error(t("这个 key 的开头像是 {other} 的，不是 {p} 的；{hint}", { other: t(other.name), p: t(p.name), hint: t(p.keyHint || "") }));
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
