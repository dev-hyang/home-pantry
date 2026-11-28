/* 线上订单 JSON 导入（/pantry-orders 生成的格式 v1）：校验 + 整理成「识别结果」的形状（和 AI 读小票的结果同一个形状，直接进确认页，不调 AI）。
 * 纯函数，不碰页面，方便测试。订单号只在本机，用来给每行写去重指纹。 */
export const MAX_ORDERS = 200, MAX_LINES = 200;
const FEES = new Set(["tax", "tip", "delivery", "service", "bag", "other"]);
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !Number.isNaN(Date.parse(v));
const money = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };

/** 文本 → 对象；容忍外面包了 ```json 代码块或前后有说明文字。出错抛 Error（message 给用户看，中文） */
export function parseOrdersText(text) {
  const c = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  if (!c) throw new Error("还没有内容：粘贴 /pantry-orders 生成的 JSON，或选 JSON 文件。");
  let o; try { o = JSON.parse(c); } catch { const a = c.indexOf("{"), b = c.lastIndexOf("}"); try { o = a >= 0 && b > a ? JSON.parse(c.slice(a, b + 1)) : null; } catch { o = null; } }
  if (!o || typeof o !== "object") throw new Error("读不出 JSON：内容可能被截断了，重新复制一次（或选文件）。");
  return o;
}

/** 校验并整理。返回 { receipts, meta, part, from, to, skipped }：
 *  receipts[i] = { store, date, currency, total, lines: [{ raw, name, qty, unit, amount, fee? }] }；meta[i] = { orderRef, cardLast4 }（和 receipts 同序） */
export function parseOrders(obj) {
  if (!obj || obj.v !== 1 || !Array.isArray(obj.orders)) throw new Error("格式不对：不是 /pantry-orders 生成的订单 JSON（缺少 v: 1 和 orders）。");
  if (obj.orders.length > MAX_ORDERS) throw new Error(`一次最多 ${MAX_ORDERS} 个订单，这份有 ${obj.orders.length} 个，请分成几份。`);
  const receipts = [], meta = []; let skipped = 0;
  for (const o of obj.orders) {
    const lines = (Array.isArray(o?.lines) ? o.lines : []).slice(0, MAX_LINES).map((l) => {
      const amount = money(l?.amount), fee = FEES.has(l?.fee) ? l.fee : null, name = String(l?.name ?? "").trim().slice(0, 60);
      if (!fee && !name) return null;
      const q = Number(l?.qty);
      return fee ? { raw: name, name, qty: 1, unit: "", amount, fee } : { raw: name, name, qty: Number.isFinite(q) && q > 0 ? q : 1, unit: "", amount };
    }).filter(Boolean);
    if (!lines.length) { skipped++; continue; }
    receipts.push({ store: String(o?.store || "Amazon").trim().slice(0, 40), date: isDay(o?.date) ? o.date : null, currency: String(o?.currency || "USD"), total: money(o?.total), lines });
    const ref = String(o?.order_ref || "").trim(), c4 = String(o?.card_last4 || "").replace(/\D/g, "").slice(-4);
    meta.push({ orderRef: /^[A-Za-z0-9-]{6,40}$/.test(ref) ? ref : null, cardLast4: c4.length === 4 ? c4 : null });
  }
  if (!receipts.length) throw new Error("没有读到任何订单商品。");
  return { receipts, meta, part: typeof obj.part === "string" ? obj.part : "", from: isDay(obj.from) ? obj.from : "", to: isDay(obj.to) ? obj.to : "", skipped };
}

/** "2/3" → { n: 2, m: 3 }；不是这种格式返回 null（给「还剩几份没导入」的提示用） */
export function partOf(part) { const m = /^(\d+)\/(\d+)$/.exec(String(part || "")); return m && +m[1] >= 1 && +m[2] >= +m[1] ? { n: +m[1], m: +m[2] } : null; }
