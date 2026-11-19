/* AI：库存上下文（只传食材名、数量、单位、天数）、提示词、调用。 */
import { DAY, inSpace, num } from "./util.js";
import { lang, t } from "./i18n.js";
import { state } from "./state.js";
import { aiSettings } from "./ai-common.js";

/* ── 库存上下文：只传食材名、数量、单位、入库天数、临期天数 ──
 * 很多食材不知道保质期，只能按“先进先出”：入库越早的越先做掉。入库时间 = 最近一次补货（stock_logs restock）或录入时间，取晚者。 */
const FOOD_CATS = new Set(["fresh", "meat_dairy", "frozen", "dry", "snacks", "drink"]);
const OLDEST_N = 8;
export function pantryContext() {
  const now = Date.now();
  const restockAt = {};
  for (const l of state.logs || []) { if (l.reason !== "restock" || num(l.delta) <= 0) continue; const ts = new Date(l.created_at).getTime(); if (ts > (restockAt[l.item_id] || 0)) restockAt[l.item_id] = ts; }
  const stockedAt = (x) => Math.max(new Date(x.created_at || 0).getTime() || 0, restockAt[x.id] || 0) || null;
  const ageDays = (x) => { const ts = stockedAt(x); return ts ? Math.max(0, Math.floor((now - ts) / DAY)) : null; };
  const items = state.enriched.filter(inSpace("pantry")).filter((x) => FOOD_CATS.has(x.category) && num(x.qty) > 0)
    .map((x) => ({ ...x, age: ageDays(x) }))
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1));   // 放得最久的排最前
  const line = (x) => {
    const d = x.expDays ?? null;
    const tags = [x.age != null ? (x.age === 0 ? t("今天入库") : t("入库 {d} 天", { d: x.age })) : "", d != null && d <= 7 ? (d < 0 ? t("已过期") : t("{d} 天内到期", { d })) : ""].filter(Boolean);
    return `${x.name} ${num(x.qty)}${x.unit || ""}${tags.length ? `（${tags.join(lang === "en" ? ", " : "，")}）` : ""}`;
  };
  const byCat = {};
  for (const x of items) (byCat[x.category] ||= []).push(line(x));
  const names = { fresh: t("生鲜"), frozen: t("冷冻"), dry: t("干货粮油"), drink: t("饮品") };
  const expiring = items.filter((x) => x.exp).map((x) => x.name);
  // 入库最早的几样（临期的已单独列，这里跳过；至少放了 1 天才算“久”）
  const oldest = items.filter((x) => !x.exp && x.age >= 1).slice(0, OLDEST_N).map((x) => x.name);
  const diet = window.DIETS?.[state.diet];
  return { text: Object.entries(byCat).map(([c, l]) => `${names[c] || c}：${l.join("、")}`).join("\n"), expiring, oldest, diet: diet ? t(diet.name) : "", count: items.length };
}
/* ── 提示词 ── */
export function menuPrompt(ask, { people } = {}) {
  const ctx = pantryContext();
  const n = people || aiSettings().people || 4;
  const sys = lang === "en"
    ? "You are a family meal planner. Build dishes from the pantry stock below first: use expiring items first, then go first-in-first-out (the longer an item has been in stock, the sooner it should be cooked; many items have no known expiry date, so the stocked-in age is the only hint). Keep dishes simple and home-style, and reply ONLY with JSON."
    : "你是家庭菜单助手。优先用下面的库存食材配菜：先用临期的，其余按先进先出——入库越早的越先做掉（很多食材不知道保质期，入库天数是唯一线索）。菜要家常、步骤简单，只用 JSON 回答，不要别的文字。";
  const schema = `{"title":"${lang === "en" ? "one-line title" : "一句话标题"}","meals":[{"name":"${lang === "en" ? "Breakfast" : "早餐"}","dishes":[{"name":"${lang === "en" ? "dish" : "菜名"}","uses":["${lang === "en" ? "stock item used" : "用到的库存食材"}"],"missing":["${lang === "en" ? "item to buy" : "需要买的食材"}"],"note":"${lang === "en" ? "one-line how-to" : "一句做法要点"}"}]}],"tips":"${lang === "en" ? "one line" : "一句提示"}"}`;
  const user = [
    lang === "en" ? `Household size: ${n}.` : `家庭人数：${n} 人。`,
    ctx.diet ? (lang === "en" ? `Diet mode: ${ctx.diet}.` : `饮食模式：${ctx.diet}。`) : "",
    lang === "en" ? "Pantry stock:" : "现有库存：", ctx.text || (lang === "en" ? "(empty)" : "（空）"),
    ctx.expiring.length ? (lang === "en" ? `Use first (expiring): ${ctx.expiring.join(", ")}` : `优先用掉（临期）：${ctx.expiring.join("、")}`) : "",
    ctx.oldest.length ? (lang === "en" ? `Then use (in stock the longest, oldest first): ${ctx.oldest.join(", ")}` : `其次用掉（入库最早，按先后）：${ctx.oldest.join("、")}`) : "",
    lang === "en" ? `Request: ${ask || "a one-day menu (breakfast, lunch, dinner)"}` : `需求：${ask || "一天三餐（早、午、晚）的菜单"}`,
    lang === "en" ? `Return JSON in exactly this shape: ${schema}` : `严格按这个 JSON 结构返回：${schema}`,
  ].filter(Boolean).join("\n");
  return { system: sys, user, context: ctx };
}
/** 无 key 模式：整段可复制的提示词 */
export const promptText = (ask, opts) => { const p = menuPrompt(ask, opts); return `${p.system}\n\n${p.user}`; };
