/* 重复记账提醒：记花费（手动 / 拍小票识别）时，和已有花费对一下——金额一样、日期差 ≤ 3 天，且名称相近或商店相同，
 * 多半是家人各记了一遍，或自己忘了已经记过。只提醒，不拦着（同一天买两份一样的东西也是有的）。
 * 已有花费不在浏览器里：要查的那几天（前后各多 4 天）一次读进内存（listPurchasesRange，分页读全），之后每一笔都在内存里比；
 * 记一笔 / 一张小票是一两天，对账单是一个月左右——范围小、数据少，不值得每行问一次数据库。读过的日期段记下来，花费变了清空。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { localDay } from "../core/spend-data.js";
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

/* ── 查重用的花费池：读过的日期段（本地日期，含头含尾）+ 这些天的花费，都在内存里 ── */
const PAD_DAYS = 4;   // 比 ±3.5 天多留半天，跨时区 / 中午时间点都盖得住
let POOL = [], SPANS = [];   // SPANS = [[from, to]]，YYYY-MM-DD
window.addEventListener("spend-rows-changed", () => { POOL = []; SPANS = []; });
const shiftDay = (d, n) => localDay(new Date(new Date(`${d}T12:00:00`).getTime() + n * DAY));
const covered = (from, to) => SPANS.some(([a, b]) => a <= from && to <= b);
/** 一组 { d: 本地日期, a: 金额 } 涉及的日期段（前后各多 4 天）还没读过就一次读进来；返回 true = 读了新的（调用方可以重画提示） */
export async function loadNear(cands) {
  const days = cands.filter((c) => c.d && Number.isFinite(+c.a) && +c.a !== 0).map((c) => c.d).sort();
  if (!days.length) return false;
  const from = shiftDay(days[0], -PAD_DAYS), to = shiftDay(days.at(-1), PAD_DAYS);
  if (covered(from, to)) return false;
  try {
    const rows = await Store.listPurchasesRange(new Date(`${from}T00:00:00`).toISOString(), new Date(`${shiftDay(to, 1)}T00:00:00`).toISOString());
    const seen = new Set(POOL.map((p) => p.id));
    POOL = [...POOL, ...rows.filter((p) => !seen.has(p.id))];
    SPANS.push([from, to]);
  } catch (e) { console.warn("[dup]", e.message); return false; }
  return true;
}
/** 已经读过的：这个日期 ±3.5 天内金额相同的已有花费，新 → 旧（这一段还没读过返回 null） */
export function nearRows(day, amount) {
  if (!covered(shiftDay(day, -PAD_DAYS), shiftDay(day, PAD_DAYS))) return null;
  const tm = new Date(`${day}T12:00:00`).getTime(), amt = cents(amount);
  return POOL.filter((p) => p.amount != null && cents(p.amount) === amt && Math.abs(new Date(p.purchased_at).getTime() - tm) <= WINDOW_DAYS * DAY)
    .sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)) || String(b.id).localeCompare(String(a.id)));
}
const candOf = (c) => ({ d: localDay(c.at), a: c.amount });

/* ── 整张小票查重（11-14）：逐行比要金额一模一样，但同一张小票两个人录、或识别规则改过（Target 整单折扣分摊），
 *   每行金额差几分就一行都对不上。整张比：同一天（±1 天）、同一家店，商品名对上一半以上，或合计差不到 1%。 ── */
const storeClose = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)))); };
/** 已有花费按「谁记的 + 录入时间（相隔 10 分钟内算同一次）」分成一批批 */
function batchesOf(rows) {
  const s = [...rows].sort((a, b) => String(a.created_by).localeCompare(String(b.created_by)) || String(a.created_at).localeCompare(String(b.created_at)));
  const out = [];
  for (const p of s) {
    const last = out.at(-1), prev = last?.at(-1);
    if (prev && prev.created_by === p.created_by && (!p.created_at || !prev.created_at || new Date(p.created_at) - new Date(prev.created_at) <= 10 * 60 * 1000)) last.push(p);
    else out.push([p]);
  }
  return out;
}
/** 新行 ↔ 旧行配对：先按名称相近，再按金额相同；返回 [新行下标, 旧行] 的列表 */
export function pairRows(mine, old) {
  const used = new Set(), pairs = [];
  for (const pass of ["name", "amount"]) mine.forEach((m, i) => {
    if (pairs.some(([j]) => j === i)) return;
    const hit = old.find((p) => !used.has(p.id) && (pass === "name" ? nameClose(p.name, m.name) : (m.amount != null && cents(p.amount) === cents(m.amount))));
    if (hit) { used.add(hit.id); pairs.push([i, hit]); }
  });
  return pairs;
}
/** 这张小票（store, day = YYYY-MM-DD, rows = [{ name, amount }]）是不是已经有人整张录过：返回最像的那一批 { rows, who, total, at, pairs } 或 null。
 *  同步：只看已经读进来的日期段（先 await loadNear） */
export function sameReceipt({ store, day, rows }) {
  const mine = rows.filter((r) => r.name || r.amount != null);
  if (mine.length < 2 || !day || !covered(shiftDay(day, -PAD_DAYS), shiftDay(day, PAD_DAYS))) return null;
  const tm = new Date(`${day}T12:00:00`).getTime(), myTotal = mine.reduce((s, r) => s + num(r.amount), 0);
  const near = POOL.filter((p) => Math.abs(new Date(p.purchased_at).getTime() - tm) <= 1.5 * DAY && (!store || !p.store || storeClose(p.store, store)));
  let best = null;
  for (const b of batchesOf(near)) {
    if (b.length < 2) continue;
    const pairs = pairRows(mine, b), named = pairs.filter(([i, p]) => nameClose(p.name, mine[i].name)).length;
    const total = b.reduce((s, p) => s + num(p.amount), 0), totalClose = Math.abs(total - myTotal) <= Math.max(0.5, Math.abs(myTotal) * 0.01);
    const sameStore = !!store && b.some((p) => storeClose(p.store, store));
    const ok = named >= Math.max(2, Math.ceil(Math.min(mine.length, b.length) / 2)) || (sameStore && totalClose);
    const score = named * 2 + (totalClose ? 3 : 0) + (sameStore ? 1 : 0);
    if (ok && (!best || score > best.score)) best = { rows: b, who: whoOf(b[0]), total: Math.round(total * 100) / 100, at: b[0].purchased_at, pairs, score };
  }
  return best;
}

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

/* 记花费 ↔ 购物车：买到了就该把清单里对应的那一项标成「已买到」。
 * 对上的条件：关联同一个库存物品，或名称相近；而且购买日期不早于它加进清单的前一天多（更早的是上一次买的）。 */
export function matchOpenShopping(c, taken = new Set()) {
  const tm = new Date(c.at).getTime();
  const open = state.shopping.filter((s) => s.status !== "bought" && !taken.has(s.id)
    && (!s.created_at || !Number.isFinite(tm) || tm >= new Date(s.created_at).getTime() - 1.5 * DAY));
  return (c.item_id && open.find((s) => s.item_id === c.item_id)) || open.find((s) => nameClose(s.name, c.name)) || null;
}
