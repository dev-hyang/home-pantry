/* AI：免费额度计数、Gemini 模型名自动选择、临时错误自动重试。 */
import { FREE_MODELS } from "./ai-models.js";
import { locale, t } from "./i18n.js";
import { num } from "./util.js";
import { readJson } from "./ai-ask.js";
import { USAGE_KEY, aiSettings, providerOf } from "./ai-common.js";

/* ── 免费额度：按服务商的免费档计数，到上限就不发请求，并算出下次可用时间；429 也记下恢复时间 ──
 * 数字是各家公布的免费档常见值，会变，设置里可以改；日配额重置时区：Gemini 太平洋时间 0 点，其余按 UTC 估 */
export const FREE_TIER = {
  gemini:     { rpm: 10, rpd: 500, reset: "pt", resetText: "太平洋时间 0 点重置" },   // 自动换模型时按最高的那档（Flash Lite 500 / 天）算；选了具体模型会按目录带入它自己的上限   // 按 AI Studio “Rate limits” 页里你这个模型的 RPD 填；RPM 留低一点就行，TPM 对我们这种一次一两千 token 的用法不会先到
  groq:       { rpm: 30, rpd: 1000, reset: "utc", resetText: "按 UTC 0 点估算重置" },
  openrouter: { rpm: 20, rpd: 50, reset: "utc", resetText: "按 UTC 0 点估算重置" },
};
export class QuotaError extends Error { constructor(msg, q) { super(msg); this.name = "QuotaError"; this.quota = q; } }
export function usage() { try { return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}"); } catch { return {}; } }
export function saveUsage(u) { try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch { /* 忽略 */ } }
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
export function countUse(p) {
  const tier = FREE_TIER[p.id], u = usage(), x = u[p.id] || {}, dk = dayKey(tier?.reset), minute = Math.floor(Date.now() / 60000);
  if (x.day === dk) x.count = (x.count || 0) + 1; else { x.day = dk; x.count = 1; }
  if (x.minute === minute) x.mcount = (x.mcount || 0) + 1; else { x.minute = minute; x.mcount = 1; }
  delete x.blockedUntil; delete x.blockedDaily;
  u[p.id] = x; saveUsage(u);
}
export function resetUsage(providerId) { const u = usage(); delete u[providerId]; saveUsage(u); }
/** 429：按 Retry-After / Gemini 的 retryDelay 记下恢复时间；提到日配额的，直接等到下次重置 */
export function rateLimited(e, p) {
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
export function saveAutoModel(providerId, model) { try { const m = JSON.parse(localStorage.getItem(AUTO_MODEL_KEY) || "{}"); m[providerId] = model; localStorage.setItem(AUTO_MODEL_KEY, JSON.stringify(m)); } catch { /* 忽略 */ } }
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
export async function geminiCandidates(base, key) {
  const j = await readJson(await fetch(`${base}/models?key=${encodeURIComponent(key)}&pageSize=200`));
  const all = (j.models || []).map((m) => ({ name: String(m.name || "").replace(/^models\//, ""), methods: m.supportedGenerationMethods || m.supportedActions || [] }));
  const gen = all.filter((m) => !m.methods.length || m.methods.includes("generateContent")).map((m) => m.name);
  return { candidates: rankGemini(gen), all: gen };
}
/* ── 临时错误自动重试：503 / 502 / 500（“模型现在很忙”）等 1.5s、4s 再试两次；429 不在这里重试（按 Retry-After 记恢复时间） ── */
export const sleep = (ms, signal) => new Promise((res, rej) => { const id = setTimeout(res, ms); signal?.addEventListener("abort", () => { clearTimeout(id); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); }, { once: true }); });
const transient = (e) => e.status === 503 || e.status === 502 || e.status === 500 || e.status === 504;
export async function withRetry(fn, signal, delays = [1500, 4000]) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) { if (!transient(e) || i >= delays.length) throw e; await sleep(delays[i], signal); }
  }
}
/** Gemini 返回 200 但没有可用内容 / 被截断时，把真实原因说出来（之前只会显示“没能读出内容”，看不出是被安全策略拦了、回答被截断还是别的） */
export function geminiCheck(j, text, json) {
  const block = j.promptFeedback?.blockReason, cand = j.candidates?.[0], fin = cand?.finishReason;
  const why = block ? `blockReason=${block}` : fin && fin !== "STOP" ? `finishReason=${fin}` : "";
  if (block || (!text && !cand?.content?.parts?.length)) {
    const hint = /SAFETY|PROHIBITED|BLOCK|IMAGE_SAFETY/i.test(`${block} ${fin}`) ? t("Google 的安全策略拦下了这次请求（图片或文字里可能有敏感内容）。换一张图、裁掉敏感部分，或改用别的服务商。")
      : fin === "MAX_TOKENS" ? t("回答太长被截断了：少放几张图，或选“每张是一张独立小票”分开识别。") : t("Google 没有返回内容，稍后再试，或换个模型。");
    const e = new Error(`${hint}${why ? `（${why}）` : ""}`); e.explained = true; throw e;
  }
  if (json && fin === "MAX_TOKENS") { const e = new Error(`${t("回答太长被截断了：少放几张图，或选“每张是一张独立小票”分开识别。")}（finishReason=MAX_TOKENS）`); e.explained = true; throw e; }
}
