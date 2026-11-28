/* 录入购物：提示词与结果整理（AI 读小票 / 文字 → 物品行）。 */
import { findItem, normName } from "../core/item-match.js";
import { fmt, num, spaceOf, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { sc } from "./scan-common.js";
import { redactOrderText } from "./scan-redact.js";

   // 只换页面本身，上面的面包屑和储藏页面卡片不动

/* ───────────── 提示词与结果整理 ───────────── */
export function buildPool() {
  sc.pool = state.items.filter((i) => spaceOf(i.category) !== "gear").slice(0, 200);   // 只传名称和单位，用来让模型把商品对应到已有库存
  return sc.pool.map((i, n) => `${n}|${i.name}|${i.unit || ""}`).join("\n");
}
export function scanPrompt(multi = "auto") {
  const cats = [...window.CATEGORIES.filter((c) => c.space === "pantry" || c.space === "house")].map((c) => `${c.id}=${c.name}`).join(", ");
  const names = lang === "en" ? "English" : "简体中文";
  const system = [
    "You read grocery / household shopping receipts and online order confirmations and return ONLY JSON.",
    // 一次可以放几张不同的小票（不同商店、不同日期）：每张单独一条，行不混在一起；同一张长小票分段拍的归同一条
    multi === "merge" ? "ALL attached photos and pasted text are parts of ONE single receipt or order: return exactly one entry in receipts."
      : multi === "one" ? "The attachment is ONE receipt or order: return exactly one entry in receipts."
      : "The photos / text may contain ONE OR SEVERAL separate receipts or orders (different stores, dates or times). Return one entry in receipts per separate receipt. Photos that are consecutive parts of one long receipt belong to the same entry. NEVER mix lines from different receipts, and never merge two stores into one entry.",
    `Write product names in short, generic ${names} (e.g. "Whole milk", not store abbreviations). Keep brand only when it matters.`,
    "Each purchased product is one line. Weight-priced items (produce, meat, bulk): qty = weight, unit = lb / kg / oz / g. Everything else: qty = how many packages, unit = the PACKAGE TYPE it is sold in — one of: bottle (milk, juice, oil, sauces, detergent, shampoo), bag (rice, flour, chips, frozen food, bread), box (eggs, cereal, cookies, berries, trash bags), can (soda, beer, canned food, jars), pack (noodles, tissues, wipes, diapers), roll (paper towels, toilet paper, foil), tube (toothpaste), cup (yogurt), pc (single loose items, or when you can't tell). Never put the package size (e.g. 64 fl oz) as qty.",
    "amount = the final price paid for that line (apply line discounts). Skip subtotal and payment lines (set skip=true or omit them).",
    "TAX / TIP / FEES ARE NOT PRODUCTS BUT MUST BE KEPT: output each one as its own line with fee = \"tax\" | \"tip\" | \"delivery\" | \"service\" | \"bag\" | \"other\" (sales tax, tip, delivery fee, service fee, bag fee, any other mandatory charge), name = a short label, amount = the positive amount charged (a waived or refunded fee is negative), match = null. If a fee is printed only as a combined line, output that one line, not its parts. If prices already include tax and no tax line is printed, output no tax line. Products have fee = null.",
    "DISCOUNT LINES ARE NOT PRODUCTS: a line with a negative amount (\"3.00-\", \"-3.00\") that is a coupon / instant savings / TPD / member discount belongs to the product it discounts — usually the line right above it or the product named after a slash. Costco example: \"1179 Pomegranates 11.99 E\" then \"000399701 /Pomegranate 3.00- E\" → ONE line: Pomegranates, amount 8.99. Subtract the discount from that product's amount and do NOT output the discount as its own line.",
    "WHOLE-RECEIPT DISCOUNTS are different: a discount for the whole order, not one product (Target Circle Card / RedCard 5% savings, employee or team-member discount, \"order discount\", a percentage off the subtotal) → output ONE line with that negative amount and order_discount=true. Never subtract it from a single product.",
    "RETURNS / REFUNDS: a returned product (a line marked RETURN / REFUND, or a product with a negative amount that is NOT a coupon or discount) is its own line: qty NEGATIVE (e.g. -1) and amount NEGATIVE. Never merge it into the purchase of the same product, and never output it as a positive qty.",
    "QUANTITY LINES:\"2 @ $1.99\" (or \"2 @ 1.99\") printed under a product means qty = 2 and that product's amount = the line total (3.98). It is not a separate line. Weight lines like \"1.32 lb @ $2.49/lb\" give qty and unit for the product above.",
    "NOT PURCHASES — never output these as lines: department / section headers (GROCERY, HOME, HEALTH AND BEAUTY, ELECTRONICS, BABY…), lines that are only an item code, tax letters (T, N, NF, F, E), \"You saved\", \"Total savings\", \"Target Circle earnings / rewards\", \"Circle 360\", gift-card or payment lines, change due.",
    "TARGET receipts: product lines look like \"071010236 GG 2% MILK $3.49 NF\" — the 9-digit number (DPCI) and the trailing tax letters are not part of the name (GG = Good & Gather, UP = up&up, MP = Market Pantry are store brands). \"Circle Offer\" / \"Target Circle\" / \"Circle Deal\" -$1.00 right below a product is that product's discount; \"Target Circle Card 5%\" / \"RedCard 5%\" near the total is a whole-receipt discount.",
    "match = the index of the best matching existing inventory item from the list I give you, or null if none is a clear match.",
    `category = one of: ${cats}; use "other" if unsure.`,
    `Today is ${todayISO()}.`,
    "date = the purchase / order date as YYYY-MM-DD. Look for it on the receipt (usually near the top or bottom, next to the time) or in the order details; for pasted text, also understand phrases like \"last Saturday\" or \"10/18\" relative to today (US order: month/day unless the year comes first). If the year is missing, use the most recent past date. Never a future date. null only if there is truly no date.",
    "total = grand total as a number if visible, else null.",
    "ORDER NUMBERS in the pasted text are replaced by tokens like [订单号#2]. For each receipt / order return ref = the integer of its token (2 for [订单号#2]), or null when it has none. Never invent a number.",
    "PRIVACY: ignore and NEVER output any person name, street address, phone number, email, card or account number, order number or tracking number, even if one is still visible in the text or image. Product names, quantities, prices, taxes, fees, dates and the store name are all that is needed.",
  ].join("\n");
  const user = [
    sc.kind === "order" ? "Source: an ONLINE ORDER (confirmation email, order page or app screenshot)." : "Source: an IN-STORE RECEIPT photo.",
    "Existing inventory (index|name|unit):", buildPool() || "(empty)",
    sc.date ? `The user says the purchase date is ${sc.date}; use it as date for every receipt.` : "",
    sc.text.trim() ? `Pasted text:\n${redactOrderText(sc.text).text.slice(0, 12000)}` : "",   // 发送前先在本机抹掉地址、姓名、电话、邮箱、卡号、订单号
    sc.images.length ? `${multi === "one" ? 1 : sc.images.length} image(s) attached.` : "",
    'Return exactly: {"receipts":[{"ref":null,"store":"","date":null,"currency":"","total":null,"lines":[{"raw":"original line","name":"","qty":1,"unit":"","amount":null,"match":null,"category":"other","skip":false,"order_discount":false,"fee":null}]}]}',
  ].filter(Boolean).join("\n");
  return { system, user };
}
export function parseJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(clean); } catch { /* 再试截取 */ }
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1));
  throw new Error(t("没能读出商品清单，换一张更清楚的图或补充文字再试。"));
}
/** 这一行用什么单位（库里统一存中文写法，显示再翻译）：
 *  对上了已有物品 → 能换算的（lb ↔ kg）保留小票上的，入库时换算；都是计数单位（个 ↔ 瓶）→ 直接用库存的单位；
 *  新物品 → AI 给的包装单位；AI 只给了「个」或没给 → 按名字猜（牛奶 → 瓶、大米 → 袋）；还猜不出来才是「个」 */
function pickUnit(raw, name, m) {
  const ai = Units.normalize(raw);
  if (m) { const k = Units.fit(ai || m.unit, m.unit).kind; return (k === "count" || !ai ? Units.normalize(m.unit) || m.unit : ai).slice(0, 10); }
  return (ai && ai !== "个" ? ai : Units.guess(name) || ai || "个").slice(0, 10);
}
/** 行的单位和要补进去的那件物品对不上时说一声：会换算成多少 / 按 1:1 记 / 换算不了请改 */
const unitNoteText = (row) => noteFor(row.querySelector('[name="unit"]').value, num(row.querySelector('[name="qty"]').value, 0), row.querySelector('[name="target"]')?.value || "");
export function noteFor(rawUnit, qty, id) {
  const item = id && !String(id).startsWith("__") && id !== "skip" ? sc.pool.find((i) => i.id === id) || state.items.find((i) => i.id === id) : null;
  if (!item) return { text: "", warn: false };
  const unit = Units.normalize(rawUnit), f = Units.fit(unit, item.unit);
  if (qty < 0 && f.kind !== "mismatch") return { text: t("退货：库存会减掉 {q} {u}。只想记花费、不动库存，就把「放进库存」改成「只记花费，不入库」", { q: fmt(Math.round(-qty * (f.factor || 1) * 100) / 100), u: t(Units.normalize(item.unit) || item.unit) }), warn: false };
  if (f.kind === "same") return { text: "", warn: false };
  const iu = t(Units.normalize(item.unit) || item.unit);
  if (f.kind === "convert") return { text: t("库存按 {u} 记，入库时换算成 {q} {u}", { u: iu, q: fmt(Math.round(qty * f.factor * 100) / 100) }), warn: false };
  if (f.kind === "count") return { text: t("库存按 {u} 记，这一行按 {q} {u} 补进去", { u: iu, q: fmt(qty) }), warn: false };
  return { text: t("单位对不上：库存按 {u} 记，{u2} 换算不过去。请把这一行改成几 {u}", { u: iu, u2: t(unit) }), warn: true };
}
export function unitNote(row) {
  const el = row?.querySelector(".unit-hint"); if (!el) return;
  const n = unitNoteText(row); el.hidden = !n.text; el.textContent = n.text; el.classList.toggle("warn", n.warn);
}
function buildReceipt(j) {
  const lines = Array.isArray(j?.lines) ? j.lines : [];
  const rows = lines.filter((l) => l && !l.skip && (FEE_KINDS[l.fee] || String(l.name || "").trim())).map((l) => {
    if (FEE_KINDS[l.fee]) {   // 税 / 小费 / 配送费 / 服务费：单独一行，只记花费，不入库
      const a = l.amount == null || l.amount === "" ? null : num(l.amount, NaN);
      return { include: true, fee: l.fee, raw: String(l.raw || ""), name: String(l.name || "").trim().slice(0, 60) || t(FEE_KINDS[l.fee]), qty: "", unit: "", amount: Number.isFinite(a) ? Math.round(a * 100) / 100 : null, def: "", match: "skip", category: FEES_CAT, order: false };
    }
    const m = (Number.isInteger(l.match) ? sc.pool[l.match] : null) || findItem(l.name, { spaces: ["pantry", "house"] });   // AI 没对上：写法一样的已有物品
    const valid = window.CATEGORIES.some((c) => c.id === l.category && c.space !== "gear");
    const amount = l.amount == null || l.amount === "" ? null : num(l.amount, NaN);
    const q0 = num(l.qty, 1), refund = q0 < 0 || REFUND.test(`${l.raw || ""} ${l.name || ""}`);   // 退货：数量为负（见 finishRefunds）
    return { include: true, raw: String(l.raw || ""), name: String(l.name).trim().slice(0, 60), qty: Math.abs(q0) > 0 ? Math.abs(q0) : 1, refund, unit: pickUnit(l.unit, l.name, m),
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null, def: m?.id || "", match: m?.id || "", category: valid ? l.category : m?.category || "other", order: !!l.order_discount };
  }).filter((r) => !INFO_LINE.test(r.raw) && !INFO_LINE.test(r.name));
  mergeDiscounts(rows); spreadOrderDiscounts(rows); finishRefunds(rows);
  const found = /^\d{4}-\d{2}-\d{2}$/.test(j?.date || "") && j.date <= todayISO();
  const date = sc.date || (found ? j.date : todayISO()), dateSrc = sc.date ? "user" : found ? "receipt" : "today";   // 你填的 > 小票 / 文字里读到的 > 今天
  if (sc.record === "spend") for (const r of rows) r.match = "skip";   // 补记以前的购物：东西多半已经用掉，默认只记花费、不加库存（要入库的行再改）
  const total = j?.total == null ? null : num(j.total, NaN);
  addGapRow(rows, Number.isFinite(total) ? total : null);
  return { include: true, refNo: Number.isInteger(j?.ref) ? j.ref : null, store: String(j?.store || "").trim().slice(0, 40), date, dateSrc, total: Number.isFinite(total) ? total : null, rows };
}
/** 万一模型还是把折扣单独列成一行（负数金额，Costco「000399701 /Pomegranate 3.00-」这种）：并进它折扣的那件商品——
 *  往上找同名（或名字互相包含）的正价行；找不到、而原文是「/商品名」或 TPD / 优惠券写法的，并进紧挨着的上一行正价商品。
 *  例：石榴 11.99 + 石榴 −3.00 → 石榴 8.99（一行）。实在找不到对应商品的负数行留着（多半是退货 / 整单优惠），由用户自己看。 */
/** 不是花钱的行（11-14 Target）：「You saved」「Total savings」「Circle earnings」这类说明，模型偶尔当成商品——直接丢掉 */
/** 小票合计 比 各行加起来多出来的部分：多半是没读到的税费。多出 0.05 以上、又不超过合计的 40% 时，补一行「差额（税费等）」（算好的数，可以改、可以取消勾选）；
 *  差得太多多半是漏了商品，不自动补，只在确认页提醒 */
const GAP_MAX = 0.4;
function addGapRow(rows, total) {
  if (total == null || !(total > 0)) return;
  const gap = Math.round((total - rows.reduce((s, r) => s + num(r.amount, 0), 0)) * 100) / 100;
  if (gap > 0.05 && gap <= total * GAP_MAX) rows.push({ include: true, fee: "other", gap: true, raw: "", name: t("差额（税费等）"), qty: "", unit: "", amount: gap, def: "", match: "skip", category: FEES_CAT, order: false });
}
/** 税费类的行：fee 取值 → 默认名称（AI 没给名字时用） */
const FEE_KINDS = { tax: "税", tip: "小费", delivery: "配送费", service: "服务费", bag: "袋子费", other: "其他费用" };
export const FEES_CAT = "shop_fees";
const INFO_LINE = /\byou saved\b|\btotal savings\b|\bsavings total\b|circle (?:earnings|rewards)|rewards earned|\bcircle 360\b|change due|您节省|共节省/i;
/** 整单折扣（Target Circle Card / RedCard 5%、员工折扣、整单百分比优惠）：模型标了 order_discount，或者原文看得出来 */
const ORDER_DISC = /red\s*card|circle\s*card|employee|team\s*member|order\s*discount|whole\s*order|整单/i;
   // 只有「20% off」不算：Target Circle 单件优惠也这样写，交给模型的 order_discount 判断
const isOrderDisc = (r) => r.amount < 0 && (r.order || ORDER_DISC.test(r.raw || ""));
/** 整单折扣按金额比例分到这张小票的每件商品上（每件记的是实际付的钱，合计和小票对得上），最后一件补零头；分完删掉折扣那一行 */
function spreadOrderDiscounts(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const d = rows[i]; if (!isOrderDisc(d)) continue;
    const items = rows.filter((r) => r !== d && !r.fee && r.amount > 0 && !isOrderDisc(r)), sum = items.reduce((a, r) => a + r.amount, 0);
    if (!items.length || sum <= 0) continue;
    let left = Math.round(d.amount * 100);   // 负数，按分算
    items.forEach((r, k) => {
      const cut = k === items.length - 1 ? left : Math.round((d.amount * 100 * r.amount) / sum);
      left -= cut; r.amount = Math.round(r.amount * 100 + cut) / 100;
    });
    rows.splice(rows.indexOf(d), 1);
  }
  return rows;
}
/** 退货 / 退款的行（数量记负数）：库存要减掉、花费记负数，所以不能当折扣并进买入那一行。
 *  AI 标了负数量，或原文有 RETURN / REFUND / 退款 / 退货，或是金额负数又对不上任何商品的行，都算；找得到库存里的物品就默认扣库存，找不到的只记花费 */
const REFUND = /\b(?:refund(?:ed)?|return(?:ed)?)\b|退款|退货/i;
function finishRefunds(rows) {
  for (const r of rows) {
    if (r.fee || isOrderDisc(r) || !(r.amount < 0 || r.refund)) continue;
    r.refund = true; r.qty = -Math.abs(r.qty || 1);
    if (r.amount > 0) r.amount = -r.amount;   // 标了退货但金额写成正数：退的钱记成负数
    if (!r.match) r.match = "skip";   // 库存里没有这件：没法扣，只记花费
  }
  return rows;
}
function mergeDiscounts(rows) {
  const DISC = /^\s*[\d\s]*\/|\b(?:tpd|inst(?:ant)?\s*sav|savings?|coupon|disc(?:ount)?|mfr|off)\b|circle\s*(?:offer|deal)|target\s*circle(?!\s*card)|优惠|折扣|折|减/i;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]; if (r.fee || !(r.amount < 0) || r.refund || isOrderDisc(r)) continue;   // 整单折扣另外按比例分（spreadOrderDiscounts）；退货不并
    const k = normName(r.name), disc = DISC.test(r.raw || "");
    let j = -1;
    // 同名的负数行：原文像折扣、或金额比正价行小（只减掉一部分）才并进去；金额 ≥ 正价行又不像折扣 = 整件退掉，是退货
    for (let x = i - 1; x >= 0; x--) { const p = rows[x], pk = normName(p.name); if (!p.fee && p.amount > 0 && pk && k && (pk === k || pk.includes(k) || k.includes(pk)) && (disc || -r.amount < p.amount)) { j = x; break; } }
    if (j < 0 && DISC.test(r.raw || ""))for (let x = i - 1; x >= 0; x--) if (rows[x].amount > 0 && !rows[x].fee) { j = x; break; }
    if (j < 0) continue;
    const p = rows[j];
    p.amount = Math.round((p.amount + r.amount) * 100) / 100;
    p.raw = [p.raw, r.raw].filter(Boolean).join(" · ");
    rows.splice(i, 1);
  }
  return rows;
}
/** 模型返回的 receipts（兼容旧的单张格式）→ 每张小票一条；没读到商品的小票丢掉但提醒 */
export function normalize(js) {
  const raw = (Array.isArray(js) ? js : [js]).flatMap((j) => (Array.isArray(j?.receipts) ? j.receipts : j ? [j] : []));
  const all = raw.map(buildReceipt), receipts = all.filter((r) => r.rows.length);
  if (!receipts.length) throw new Error(t("没有读到商品。小票拍清楚些（整张、不反光），或把订单文字粘贴进来。"));
  return { receipts, dropped: all.length - receipts.length };
}
