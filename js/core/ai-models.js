/* AI：免费档常用模型目录（设置里下拉选）和目录与现实对不上时的提醒。 */
import { countUse, geminiCandidates, geminiCheck, rankGemini, rateLimited, withRetry } from "./ai-limits.js";
import { deadModels, effective, explainHttp, gate, geminiCall, openaiHeaders } from "./ai-request.js";
import { menuPrompt } from "./ai-prompts.js";
import { parseMenu, readJson } from "./ai-ask.js";
import { t } from "./i18n.js";
import { aiSettings, providerOf } from "./ai-common.js";

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
export const FREE_MODELS_AS_OF = "2026-10-21";
   // 目录按这一天 AI Studio 的 Rate limits 页填的
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
const MODELS_CACHE = "hmh-ai-models";
   // { provider: { ts, ids } }：这个 key 实际能用的模型，缓存一天
/** 下拉框用的模型列表：有实际列表就以它为准（目录里有的带上限、没有的上限留空、已对这个 key 下线的标出来），查不到就只给目录 */
/** 这个服务商的模型列表上次成功查到的时间（毫秒），没查过是 0 */
export function modelsCachedAt(pid) { try { return JSON.parse(localStorage.getItem(MODELS_CACHE) || "{}")[pid]?.ts || 0; } catch { return 0; } }
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
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: images.length ? [...images.map((i) => (i.mime === "application/pdf" ? { type: "document", source: { type: "base64", media_type: i.mime, data: i.b64 } } : { type: "image", source: { type: "base64", media_type: i.mime, data: i.b64 } })), { type: "text", text: user }] : user }] }) }).then(readJson), ctl.signal);
      text = (j.content || []).map((x) => x.text || "").join("");
    } else {
      const j = await withRetry(() => fetch(`${base}/chat/completions`, { method: "POST", signal: ctl.signal, headers: openaiHeaders(s, p, key),
        body: JSON.stringify({ model, temperature, messages: [{ role: "system", content: system }, { role: "user", content: images.length ? [{ type: "text", text: user }, ...images.map((i) => (i.mime === "application/pdf" ? { type: "file", file: { filename: "document.pdf", file_data: `data:${i.mime};base64,${i.b64}` } } : { type: "image_url", image_url: { url: `data:${i.mime};base64,${i.b64}` } }))] : user }] }) }).then(readJson), ctl.signal);
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
