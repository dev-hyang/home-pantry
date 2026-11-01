/* 重复记账提醒：记花费（手动 / 拍小票识别）时，和已有花费对一下——金额一样、日期差 ≤ 3 天，且名称相近或商店相同，
 * 多半是家人各记了一遍，或自己忘了已经记过。只提醒，不拦着（同一天买两份一样的东西也是有的）。
 * 已有花费不在浏览器里：按 日期 + 金额 向数据库要 ±3.5 天内金额相同的那几笔（spend_dup_match，迁移 057），按 日期|分 缓存；
 * 名称 / 商店是否相近仍在这里判断。花费变了缓存清空。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { TZ, localDay } from "../core/spend-data.js";
import { $, DAY, esc, fmtShort, money, num } from "../core/util.js";
import { t } from "../core/i18n.js";

const WINDOW_DAYS = 3.5;
const norm = (s) => String(s ?? "").replace(/【[^】]*】/g, "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const cents = (v) => Math.round(num(v) * 100);

function nameClose(a, b) {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x))));
}

/** 谁记的：自己 → 「你」，其他人 → 家庭里的称呼，查不到 → 空 */
function whoOf(p) {
  if (!p.created_by) return "";
  if (p.created_by === state.user?.id) return t("你");
  return state.members?.find((m) => m.user_id === p.created_by)?.display_name || t("家里别人");
}

/* ── 数据库查重的缓存：key = 本地日期|金额（分），值 = 那天 ±3.5 天内金额相同的已有花费（null = 还在读）── */
const NEAR = new Map();
window.addEventListener("spend-rows-changed", () => NEAR.clear());
const candKey = (day, amt) => `${day}|${amt}`;
/** 一组 { d: 本地日期, a: 金额 } 里还没查过的，一次查完；返回 true = 查到了新的（调用方可以重画提示） */
export async function loadNear(cands) {
  const miss = [...new Map(cands.filter((c) => c.d && Number.isFinite(+c.a) && +c.a !== 0).map((c) => [candKey(c.d, cents(c.a)), c])).entries()].filter(([k]) => !NEAR.has(k));
  if (!miss.length) return false;
  const p = Store.spendDupMatch(miss.map(([k, c]) => ({ k, d: c.d, a: Math.round(+c.a * 100) / 100 })), TZ());
  for (const [k] of miss) NEAR.set(k, { rows: null, p });
  try {
    const rows = await p, by = new Map(miss.map(([k]) => [k, []]));
    for (const r of rows || []) by.get(r.k)?.push(r);
    for (const [k, l] of by) NEAR.set(k, { rows: l });
  } catch (e) { for (const [k] of miss) NEAR.delete(k); console.warn("[dup]", e.message); return false; }
  return true;
}
/** 已经查过的：这个日期 + 金额的已有花费（还没查过返回 null） */
export const nearRows = (day, amount) => NEAR.get(candKey(day, cents(amount)))?.rows ?? null;
const candOf = (c) => ({ d: localDay(c.at), a: c.amount });

/** 找出疑似重复的已有花费。c = { name, amount, store, at(ISO 或 Date) }；exclude：同一批里已经配过的花费 id，别重复配。
 *  同步：只看已经查过的（没查过返回 []，先 await loadNear([...]) 或用 similarPurchasesAsync） */
export function similarPurchases(c, exclude = new Set()) {
  if (c.amount == null || c.amount === "" || !Number.isFinite(+c.amount) || +c.amount === 0) return [];
  const tm = new Date(c.at).getTime(), store = norm(c.store);
  if (!Number.isFinite(tm)) return [];
  return (nearRows(localDay(c.at), c.amount) || []).filter((p) => !exclude.has(p.id) && Math.abs(new Date(p.purchased_at).getTime() - tm) <= WINDOW_DAYS * DAY
    && (nameClose(p.name, c.name) || (!!store && norm(p.store) === store)))
    .sort((a, b) => Math.abs(new Date(a.purchased_at) - tm) - Math.abs(new Date(b.purchased_at) - tm));
}
export async function similarPurchasesAsync(c, exclude = new Set()) {
  if (Number.isFinite(new Date(c.at).getTime())) await loadNear([candOf(c)]);
  return similarPurchases(c, exclude);
}
/** 有没有已有花费金额一样、日期差 ≤ 3.5 天（不看名称；收入还款记成花费前用）：返回最近的那一笔或 null */
export async function sameAmountNear(day, amount) {
  await loadNear([{ d: day, a: amount }]);
  const tm = new Date(`${day}T12:00:00`).getTime();
  return (nearRows(day, amount) || []).sort((a, b) => Math.abs(new Date(a.purchased_at) - tm) - Math.abs(new Date(b.purchased_at) - tm))[0] || null;
}

/** 提示文字（已转义，可直接放进 HTML）；没有疑似重复返回空字符串 */
export function dupNote(list) {
  if (!list.length) return "";
  const p = list[0], who = whoOf(p), more = list.length > 1 ? t("（另有 {n} 笔类似的）", { n: list.length - 1 }) : "";
  return `⚠ ${esc(t("可能重复：{who}{d} 已记过「{name}」{m}", { who: who ? t("{w}在 ", { w: who }) : "", d: fmtShort(p.purchased_at), name: p.name, m: money(num(p.amount)) }))}${esc(more)}`;
}

/* 手动记一笔：填写时实时提示 */
export function purchaseFormCandidate(f) {
  const e = f.elements, amt = num(e.amount.value, NaN);
  return { name: e.name.value, amount: Number.isFinite(amt) ? (e.refund?.checked ? -amt : amt) : null, store: e.store.value, at: new Date(`${e.date.value || new Date().toISOString().slice(0, 10)}T12:00:00`) };
}
/** 填写时实时提示（异步：没查过的日期 + 金额先问数据库）；返回疑似重复的列表 */
export async function showPurchaseDup(f) {
  const box = $("#purchaseDupHint"); if (!box) return [];
  const list = await similarPurchasesAsync(purchaseFormCandidate(f)).catch(() => []);
  box.innerHTML = dupNote(list); box.hidden = !list.length;
  return list;
}
document.addEventListener("input", (e) => { if (e.target.closest?.("#purchaseForm")) { e.target.closest("form").dataset.dupAck = ""; showPurchaseDup(e.target.closest("form")); } });
document.addEventListener("change", (e) => { if (e.target.closest?.("#purchaseForm")) showPurchaseDup(e.target.closest("form")); });

/* 记花费 ↔ 采购清单：买到了就该把清单里对应的那一项标成「已买到」。
 * 对上的条件：关联同一个库存物品，或名称相近；而且购买日期不早于它加进清单的前一天多（更早的是上一次买的）。 */
export function matchOpenShopping(c, taken = new Set()) {
  const tm = new Date(c.at).getTime();
  const open = state.shopping.filter((s) => s.status !== "bought" && !taken.has(s.id)
    && (!s.created_at || !Number.isFinite(tm) || tm >= new Date(s.created_at).getTime() - 1.5 * DAY));
  return (c.item_id && open.find((s) => s.item_id === c.item_id)) || open.find((s) => nameClose(s.name, c.name)) || null;
}
