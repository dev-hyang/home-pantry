/* AI：模型黑名单（404 / 429 的记一段时间）和实际发请求。 */
import { QuotaError, aiQuota, autoModel, geminiCandidates, nextReset, quotaMessage, saveAutoModel, saveUsage, sleep, suggestedModel, usage } from "./ai-limits.js";
import { learnLimit } from "./ai-models.js";
import { locale, t } from "./i18n.js";
import { readJson } from "./ai-ask.js";
import { KEY, aiSettings, providerOf } from "./ai-common.js";

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
export async function geminiCall(s, base, key, body, signal) {
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
export function gate(s, p) {
  const q = aiQuota(s);
  if (!q.ok) throw new QuotaError(quotaMessage(q), q);
}
/** OpenAI 兼容接口的请求头：按设置选鉴权方式（只对“自定义”生效，其余服务固定 Bearer） */
export function openaiHeaders(s, p, key) {
  const h = { "Content-Type": "application/json" };
  const style = p.id === "custom" ? s.auth || "bearer" : "bearer";
  if (style === "x-api-key") h["x-api-key"] = key; else if (style === "api-key") h["api-key"] = key; else h.Authorization = `Bearer ${key}`;
  return h;
}
/** 把 HTTP 错误翻译成能动手排查的提示 */
export function explainHttp(e, base) {
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
