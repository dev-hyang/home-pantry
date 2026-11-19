/* 咩咩咩：家里任何事（房屋保养、账单、买卖房、清洁收纳…）的上下文和提问。 */
import { countUse, rateLimited } from "./ai-limits.js";
import { effective, explainHttp, gate, geminiCall, openaiHeaders } from "./ai-request.js";
import { lang, t } from "./i18n.js";
import { pantryContext } from "./ai-prompts.js";
import { state } from "./state.js";
import { PROVIDERS, aiSettings, providerOf } from "./ai-common.js";

/* ── 咩咩咩：家里任何事（房屋保养、账单、买卖房、清洁收纳…）的上下文 ── */
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
  const assets = (state.assetsEnriched || []).filter((a) => !a.retired && (a.recallSt || a.service === "overdue" || a.service === "due" || a.followUp));   // 召回没处理完的排在里面（recallSt：js/house/recall.js）
  if (assets.length) push(t("设备待处理"), assets.slice(0, 8).map((a) => `${a.name}${paren(a.recallSt === "stop_use" ? t("产品召回，停止使用") : a.recallSt ? t("产品召回待处理") : a.followUp ? t("检查发现需处理") : a.service === "overdue" ? t("保养逾期") : t("该保养了"))}`).join(list));
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
export async function readJson(r) {
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
