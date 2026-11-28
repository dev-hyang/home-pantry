/* 小票 ↔ 对账单整笔：小票录成一行一个物品（再加一行税费），银行流水是店里的一整笔，逐行比金额永远对不上，导入就会重复记。
 * 这里把已有花费按「同一张小票」分组（同一个人、录入时间相隔 10 分钟内），用整张小票的合计去和流水里的一笔比：
 *  · 合计：差不超过 max(0.5 美元, 1%) = 强；差不超过 max(1 美元, 5%)（小费、折扣、礼品卡抵扣）= 中，中必须商店也对上
 *  · 商店：流水描述（TARGET 00012345 MPLS）和小票上的商店名，去掉数字 / 符号后一个包含另一个（至少 3 个字符）
 *  · 卡：对账单选了某张卡，小票记录里也选了卡：同一张 = 加分；不同的卡 = 不是同一笔，直接排除
 *  · 日期：流水入账日通常比消费日晚 0–5 天（pending），极少更早：窗口 −2 … +7 天；超出 ±3.5 天的，必须合计强 + 商店对上才算
 * 一张小票只配一笔流水，一笔流水只配一张小票（按得分从高到低配）。
 * 强 = 默认不导入（可以改成仍然导入）；中 = 照常导入，只提醒「可能已按小票记录」。纯函数，不碰页面。 */
import { orderGroup } from "../pantry/scan-order-key.js";
const DAY = 864e5;
const cents = (v) => Math.round((Number(v) || 0) * 100);
const norm = (s) => String(s ?? "").replace(/【[^】]*】/g, "").toLowerCase().replace(/[\s\p{P}\p{S}\d]+/gu, "");
/** 流水描述和商店名像不像（一个包含另一个，至少 3 个字符） */
export const storeClose = (desc, store) => { const x = norm(desc), y = norm(store); return !!x && !!y && Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)); };
const localDay = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayNum = (d) => Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`) / DAY;

/** 已有花费按「谁记的 + 商店 + 消费日 + 录入时间（相隔 10 分钟内算同一次）」分成一批批：
 *  一次拍几张小票会在几分钟内一起录入，所以不同商店 / 不同日期的要先分开，不然几张小票会并成一批，合计就对不上了 */
export function receiptBatches(rows) {
  const key = (p) => { const g = orderGroup(p.import_key); return g ? `order|${g}` : `${p.created_by}|${norm(p.store)}|${localDay(p.purchased_at)}`; };   // 线上订单导入的行（指纹里带订单组）：同一个订单一批，不管几点录的，也不和同一天的别的订单混
  const s = [...rows].sort((a, b) => key(a).localeCompare(key(b)) || String(a.created_at).localeCompare(String(b.created_at)));
  const out = [];
  for (const p of s) {
    const last = out.at(-1), prev = last?.at(-1);
    if (prev && key(prev) === key(p) && (key(p).startsWith("order|") || !p.created_at || !prev.created_at || new Date(p.created_at) - new Date(prev.created_at) <= 10 * 60 * 1000)) last.push(p);
    else out.push([p]);
  }
  return out;
}
function describe(b) {
  const stores = {}; for (const p of b) { const s = String(p.store || "").trim(); if (s) stores[s] = (stores[s] || 0) + 1; }
  const store = Object.entries(stores).sort((x, y) => y[1] - x[1])[0]?.[0] || "";
  const day = b.map((p) => localDay(p.purchased_at)).sort()[0];
  return { order: !!orderGroup(b[0]?.import_key), ids: b.map((p) => p.id), n: b.length, total: b.reduce((s, p) => s + cents(p.amount), 0), store, day, cards: new Set(b.map((p) => p.card_id).filter(Boolean)), cash: b.every((p) => !p.card_id && p.method) };
}

/** 反方向：这张小票（或这次账单缴费）以前是不是已经从对账单导入成了一整笔？
 *  只看银行导入的行（import_batch 不空）：合计差不超过 max(0.5 美元, 1%)，流水入账日比小票晚 0–7 天（早不超过 2 天），
 *  商店对上；或者金额一模一样且日期在 3.5 天内。对账单选了卡而那笔记在另一张卡上 = 不是。返回最像的一笔或 null。 */
export function findLump(pool, { store = "", day, total, card = "" }) {
  const tot = cents(total); if (tot <= 0 || !day) return null;
  const tol = Math.max(50, Math.round(tot * 0.01)); let best = null;
  for (const p of pool) {
    if (!p.import_batch || p.virtual || p.amount == null) continue;
    const diff = Math.abs(cents(p.amount) - tot); if (diff > tol) continue;
    const gap = dayNum(localDay(p.purchased_at)) - dayNum(day); if (gap < -2 || gap > 7) continue;
    if (card && p.card_id && p.card_id !== card) continue;
    const st = !!store && (storeClose(p.store, store) || storeClose(p.name, store)), near = Math.abs(gap) <= 3.5;
    if (!(st || (diff <= 1 && near))) continue;
    const score = (diff <= 1 ? 4 : 2) + (st ? 3 : 0) + (card && p.card_id === card ? 2 : 0) + (Math.abs(gap) <= 1 ? 2 : near ? 1 : 0);
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p || null;
}

/** rows = [{ fk, date, out, texts: [流水描述, 整理后的商家名] }]；pool = 已有花费；card = 对账单选的卡 id（可空）；used = 已经被逐行对上的花费 id。
 *  返回 Map(fk → { tier: "strong" | "weak", n, total, store, day, ids, diff, score }) */
export function matchTrips(rows, pool, { card = "", used = new Set() } = {}) {
  const items = pool.filter((p) => p.amount != null && Number(p.amount) > 0 && !p.import_batch && !p.virtual && !used.has(p.id));
  const batches = receiptBatches(items).filter((b) => b.length >= 2).map(describe);
  const pairs = [];
  rows.forEach((r, ri) => {
    const out = cents(r.out); if (out <= 0) return;
    batches.forEach((b, bi) => {
      const gap = dayNum(r.date) - dayNum(b.day); if (gap < -2 || gap > 7) return;
      if (card && b.cards.size && !b.cards.has(card)) return;   // 小票记在别的卡上：不是这一笔
      const diff = Math.abs(b.total - out), strongTotal = diff <= Math.max(50, Math.round(out * 0.01)), midTotal = diff <= Math.max(100, Math.round(out * 0.05));
      if (!strongTotal && !midTotal) return;
      const store = (r.texts || []).some((x) => storeClose(x, b.store)), cardOk = !!card && b.cards.has(card), near = Math.abs(gap) <= 3.5;
      let tier = null;
      if (strongTotal && (near || store)) tier = "strong";
      else if (store && (strongTotal || midTotal) && near) tier = "weak";
      if (!tier) return;
      pairs.push({ ri, bi, tier, score: (strongTotal ? 4 : 2) + (store ? 3 : 0) + (cardOk ? 2 : 0) + (Math.abs(gap) <= 1 ? 2 : Math.abs(gap) <= 4 ? 1 : 0) - (card && b.cash ? 1 : 0), diff });
    });
  });
  pairs.sort((x, y) => y.score - x.score || x.diff - y.diff);
  const rowUsed = new Set(), batchUsed = new Set(), out = new Map();
  for (const p of pairs) {
    if (rowUsed.has(p.ri) || batchUsed.has(p.bi)) continue;
    rowUsed.add(p.ri); batchUsed.add(p.bi);
    const b = batches[p.bi];
    out.set(rows[p.ri].fk, { tier: p.tier, n: b.n, total: b.total / 100, store: b.store, day: b.day, ids: b.ids, diff: p.diff / 100, score: p.score });
  }
  matchSplits(rows, batches, { card, rowUsed, batchUsed, out });
  return out;
}

/** 分批发货：一个线上订单在流水里是 2–3 笔（每次发货扣一次），合计 = 订单合计。只对「线上订单导入」的订单、且商店对上、且这几笔都还没配上别的小票时才配；
 *  配上的每一笔都标成强（默认不导入），并带上 split = 这个订单在流水里共几笔。候选最多取 12 笔，防止组合太多。 */
function matchSplits(rows, batches, { card, rowUsed, batchUsed, out }) {
  batches.forEach((b, bi) => {
    if (!b.order || batchUsed.has(bi) || (card && b.cards.size && !b.cards.has(card))) return;
    const tol = Math.max(50, Math.round(b.total * 0.01));
    const cand = rows.map((r, ri) => ({ r, ri, c: cents(r.out), gap: dayNum(r.date) - dayNum(b.day) }))
      .filter((x) => !rowUsed.has(x.ri) && x.c > 0 && x.c < b.total && x.gap >= -2 && x.gap <= 14 && (x.r.texts || []).some((tx) => storeClose(tx, b.store))).slice(0, 12);
    let hit = null;
    for (let i = 0; i < cand.length && !hit; i++) for (let j = i + 1; j < cand.length && !hit; j++) {
      if (Math.abs(cand[i].c + cand[j].c - b.total) <= tol) hit = [cand[i], cand[j]];
      else for (let k = j + 1; k < cand.length && !hit; k++) if (Math.abs(cand[i].c + cand[j].c + cand[k].c - b.total) <= tol) hit = [cand[i], cand[j], cand[k]];
    }
    if (!hit) return;
    batchUsed.add(bi);
    for (const x of hit) { rowUsed.add(x.ri); out.set(rows[x.ri].fk, { tier: "strong", split: hit.length, n: b.n, total: b.total / 100, store: b.store, day: b.day, ids: b.ids, diff: Math.abs(hit.reduce((s, y) => s + y.c, 0) - b.total) / 100, score: 8 }); }
  });
}
