/* 录入购物：实体店小票（拍照）和线上订单（截图 / 粘贴订单文字）→ AI 读成商品清单 → 逐行确认 → 入库 + 记花费。
 * 用设置里已有的 AI key（推荐 Gemini 免费档）；图片只在手机上压缩后发给所选服务商，不保存原图；一律人工确认后才写入。 */
import { state } from "../core/state.js";
import { findItem, itemNameOptions, normName, similarItems } from "../core/item-match.js";
import { Store } from "../core/store.js";
import { $, catOf, esc, fmt, num, spaceOf, toast, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { crumbNav } from "../core/hub.js";
import { aiReady, aiSettings, askText, providerOf, visionCapable } from "../core/ai.js";
import { cleanStore, rememberStore, storeDatalist } from "../stats/views.js";
import { categoryOptions } from "./views.js";
import { compressImage as compress } from "../core/autofill.js";
import { cardSelectHtml, purchasePayFields } from "../bills/cards-views.js";
import { dupNote, loadNear, matchOpenShopping, similarPurchases } from "../stats/dup-check.js";

const MAX_IMAGES = 8;   // 一次最多 8 张：可以是几张不同的小票，也可以是一张长小票的几段
const sc = { kind: "receipt", mode: "auto", step: "input", images: [], text: "", date: "", busy: false, progress: "", error: "", result: null, pool: [] };
export function resetScan() { Object.assign(sc, { kind: "receipt", mode: "auto", step: "input", images: [], text: "", date: "", busy: false, progress: "", error: "", result: null, pool: [] }); }
const repaint = () => { const m = $("#main"); if (m && state.route.section === "scan") m.innerHTML = viewScan(); };

/* ───────────── 提示词与结果整理 ───────────── */
function buildPool() {
  sc.pool = state.items.filter((i) => spaceOf(i.category) !== "gear").slice(0, 200);   // 只传名称和单位，用来让模型把商品对应到已有库存
  return sc.pool.map((i, n) => `${n}|${i.name}|${i.unit || ""}`).join("\n");
}
function scanPrompt(multi = "auto") {
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
    "amount = the final price paid for that line (apply line discounts). Skip tax, tip, bag fees, delivery/service fees, subtotal and payment lines (set skip=true or omit them).",
    "match = the index of the best matching existing inventory item from the list I give you, or null if none is a clear match.",
    `category = one of: ${cats}; use "other" if unsure.`,
    `Today is ${todayISO()}.`,
    "date = the purchase / order date as YYYY-MM-DD. Look for it on the receipt (usually near the top or bottom, next to the time) or in the order details; for pasted text, also understand phrases like \"last Saturday\" or \"10/18\" relative to today (US order: month/day unless the year comes first). If the year is missing, use the most recent past date. Never a future date. null only if there is truly no date.",
    "total = grand total as a number if visible, else null.",
  ].join("\n");
  const user = [
    sc.kind === "order" ? "Source: an ONLINE ORDER (confirmation email, order page or app screenshot)." : "Source: an IN-STORE RECEIPT photo.",
    "Existing inventory (index|name|unit):", buildPool() || "(empty)",
    sc.date ? `The user says the purchase date is ${sc.date}; use it as date for every receipt.` : "",
    sc.text.trim() ? `Pasted text:\n${sc.text.trim().slice(0, 12000)}` : "",
    sc.images.length ? `${multi === "one" ? 1 : sc.images.length} image(s) attached.` : "",
    'Return exactly: {"receipts":[{"store":"","date":null,"currency":"","total":null,"lines":[{"raw":"original line","name":"","qty":1,"unit":"","amount":null,"match":null,"category":"other","skip":false}]}]}',
  ].filter(Boolean).join("\n");
  return { system, user };
}
function parseJson(text) {
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
function noteFor(rawUnit, qty, id) {
  const item = id && !String(id).startsWith("__") && id !== "skip" ? sc.pool.find((i) => i.id === id) || state.items.find((i) => i.id === id) : null;
  if (!item) return { text: "", warn: false };
  const unit = Units.normalize(rawUnit), f = Units.fit(unit, item.unit);
  if (f.kind === "same") return { text: "", warn: false };
  const iu = t(Units.normalize(item.unit) || item.unit);
  if (f.kind === "convert") return { text: t("库存按 {u} 记，入库时换算成 {q} {u}", { u: iu, q: fmt(Math.round(qty * f.factor * 100) / 100) }), warn: false };
  if (f.kind === "count") return { text: t("库存按 {u} 记，这一行按 {q} {u} 补进去", { u: iu, q: fmt(qty) }), warn: false };
  return { text: t("单位对不上：库存按 {u} 记，{u2} 换算不过去。请把这一行改成几 {u}", { u: iu, u2: t(unit) }), warn: true };
}
function unitNote(row) {
  const el = row?.querySelector(".unit-hint"); if (!el) return;
  const n = unitNoteText(row); el.hidden = !n.text; el.textContent = n.text; el.classList.toggle("warn", n.warn);
}

function buildReceipt(j) {
  const lines = Array.isArray(j?.lines) ? j.lines : [];
  const rows = lines.filter((l) => l && !l.skip && String(l.name || "").trim()).map((l) => {
    const m = (Number.isInteger(l.match) ? sc.pool[l.match] : null) || findItem(l.name, { spaces: ["pantry", "house"] });   // AI 没对上：写法一样的已有物品
    const valid = window.CATEGORIES.some((c) => c.id === l.category && c.space !== "gear");
    const amount = l.amount == null || l.amount === "" ? null : num(l.amount, NaN);
    return { include: true, raw: String(l.raw || ""), name: String(l.name).trim().slice(0, 60), qty: num(l.qty, 1) > 0 ? num(l.qty, 1) : 1, unit: pickUnit(l.unit, l.name, m),
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null, def: m?.id || "", match: m?.id || "", category: valid ? l.category : m?.category || "other" };
  });
  const found = /^\d{4}-\d{2}-\d{2}$/.test(j?.date || "") && j.date <= todayISO();
  const date = sc.date || (found ? j.date : todayISO()), dateSrc = sc.date ? "user" : found ? "receipt" : "today";   // 你填的 > 小票 / 文字里读到的 > 今天
  if (date < todayISO()) for (const r of rows) r.match = "skip";   // 补记以前的购物：东西多半已经用掉，默认只记花费、不加库存（要入库的行再改）
  const total = j?.total == null ? null : num(j.total, NaN);
  return { include: true, store: String(j?.store || "").trim().slice(0, 40), date, dateSrc, total: Number.isFinite(total) ? total : null, rows };
}
/** 模型返回的 receipts（兼容旧的单张格式）→ 每张小票一条；没读到商品的小票丢掉但提醒 */
function normalize(js) {
  const raw = (Array.isArray(js) ? js : [js]).flatMap((j) => (Array.isArray(j?.receipts) ? j.receipts : j ? [j] : []));
  const all = raw.map(buildReceipt), receipts = all.filter((r) => r.rows.length);
  if (!receipts.length) throw new Error(t("没有读到商品。小票拍清楚些（整张、不反光），或把订单文字粘贴进来。"));
  return { receipts, dropped: all.length - receipts.length };
}

/* ───────────── 手动添加（11-07：和拍照识别同一张确认表，不再跳到单件物品表单）───────────── */
const blankRow = () => ({ include: true, raw: "", name: "", qty: 1, unit: t("个"), amount: null, def: "", match: "", category: "fresh" });
function startManual() {
  buildPool();
  sc.kind = "manual"; sc.error = ""; sc.dupAck = false;
  sc.result = { manual: true, dropped: 0, receipts: [{ include: true, store: "", date: sc.date || todayISO(), dateSrc: "user", total: null, rows: [blankRow()] }] };
  sc.step = "review";
}
const kindChips = () => {
  const kindChip = (k, label) => `<button type="button" class="chip" data-action="scan-kind" data-kind="${k}" aria-pressed="${sc.kind === k}">${label}</button>`;
  return `<div class="chips" role="group" aria-label="${t("来源")}">${kindChip("receipt", `🧾 ${t("实体店小票")}`)}${kindChip("order", `📦 ${t("线上订单")}`)}${kindChip("manual", `✍️ ${t("手动添加")}`)}</div>`;
};

/* ───────────── 页面 ───────────── */
export function viewScan() {
  const back = crumbNav([{ href: href("shopping"), label: t("采购清单") }, { label: t("录入购物"), icon: "🧾" }]);
  return `<section class="section scan-page">${back}${sc.step === "review" && sc.result ? reviewHtml() : inputHtml()}</section>`;
}

function inputHtml() {
  const s = aiSettings(), p = providerOf(s.provider), ready = aiReady();
  const order = sc.kind === "order";
  const canImg = visionCapable(p);
  const runOff = !ready || sc.busy || (!sc.images.length && !sc.text.trim());
  const runBtn = (cls) => `<button type="button" class="btn btn-primary ${cls}" data-action="scan-run" ${runOff ? "disabled" : ""}>${sc.busy ? (sc.progress || t("正在识别…（几十秒）")) : t("识别")}</button>`;
  return `
    <div class="section-head"><h2>${t("录入购物")}</h2><p>${t("拍小票或贴线上订单，AI 读成清单；或手动添加。确认后入库、记花费")}</p></div>
    ${ready ? "" : `<div class="panel cta-panel"><div><b>${t("先填一个 AI key")}</b><p class="muted">${t("推荐 Gemini（有免费额度）。key 只存在这台设备的浏览器里。")}</p></div>
      <a class="btn btn-primary" href="${href("me", "settings")}?sec=ai">${t("去设置")}</a></div>`}
    ${kindChips()}
    <div class="panel scan-in">
      <div class="scan-in-head"><span class="pick-lbl">${order ? t("订单截图（可选，可多张）") : t("小票照片（可多张：几张不同的小票，或一张长小票分段拍）")}</span>${runBtn("btn-sm")}</div>
      <div class="scan-thumbs">
        ${sc.images.map((im, i) => `<span class="scan-thumb"><img src="${im.url}" alt="${t("第 {n} 张", { n: i + 1 })}"><button type="button" data-action="scan-img-del" data-i="${i}" aria-label="${t("删除这张")}">×</button></span>`).join("")}
        ${sc.images.length < MAX_IMAGES ? `<label class="scan-add ${canImg ? "" : "is-off"}"><input type="file" id="scanFile" accept="image/*" multiple ${canImg ? "" : "disabled"}><span>📷 ${t("拍照 / 选图")}</span></label>` : ""}
      </div>
      ${canImg ? "" : `<p class="form-error" style="margin:6px 0 0">${t("当前的 {p} 不能读图片：换成 Gemini（设置 → AI 助手），或只粘贴文字。", { p: t(p.name) })}</p>`}
      ${sc.images.length > 1 ? `<div class="scan-mode"><span class="pick-lbl">${t("这几张照片是")}</span><div class="chips" role="group" aria-label="${t("几张照片的关系")}">${[["auto", "自动判断"], ["separate", "每张是一张独立小票"], ["merge", "合起来是同一张小票"]].map(([k, l]) => `<button type="button" class="chip" data-action="scan-mode" data-mode="${k}" aria-pressed="${sc.mode === k}">${t(l)}</button>`).join("")}</div>
        <p class="muted" style="margin:0;font-size:12.5px">${t("补录几张不同商店、不同日期的小票：选“每张是一张独立小票”最稳，每张单独识别，不会混在一起；长小票分段拍选“合起来是同一张”。")}</p></div>` : ""}
      <label class="scan-text">${order ? t("订单文字（订单确认邮件、网页或 App 订单详情，整段粘贴）") : t("补充文字（可选，例如小票上识别不出的商品）")}
        <textarea id="scanText" data-autosize rows="${order ? 8 : 3}" maxlength="12000" placeholder="${order ? t("例如：Instacart / Amazon / 京东 / 盒马 的订单确认内容") : ""}">${esc(sc.text)}</textarea></label>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("图片和文字会发给你在设置里选的 {p}，不会保存原图。小票上的卡号、姓名建议裁掉或遮住再拍。Gemini 免费档的内容可能被用于改进产品，介意的话用付费 key。", { p: t(p.name) })}</p>
      <label class="scan-text">${t("购买日期（选填，不填就按小票上的日期，没有就是今天）")}<input type="date" id="scanDate" max="${todayISO()}" value="${esc(sc.date)}"></label>
      <p class="muted" style="margin:0;font-size:12.5px">${t("默认按小票上的日期记：拍照时把日期也拍进去，或在上面的文字里写上日期（例如 2026-10-18、上周六）。都没有就用今天。补记以前的购物，在这里选那天就行。")}</p>
      ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
      <div class="form-actions">${runBtn("")}</div>
    </div>`;
}

function targetOptions(row) {
  const items = sc.pool, name = (i) => `${esc(i.name)}（${esc(t(i.unit || ""))}）`;
  const grp = (space, label) => { const l = items.filter((i) => spaceOf(i.category) === space); return l.length ? `<optgroup label="${t(label)}">${l.map((i) => `<option value="${i.id}" ${row.match === i.id ? "selected" : ""}>${name(i)}</option>`).join("")}</optgroup>` : ""; };
  return `<option value="__skip" ${row.match === "skip" ? "selected" : ""}>${t("只记花费，不入库")}</option>
    <option value="__new" ${!row.match ? "selected" : ""}>＋ ${t("新建物品")}</option>
    ${grp("pantry", "日常储备")}${grp("house", "房屋耗材")}`;
}
function rowHtml(x, ri, i, cur) {
  return `<li class="scan-row ${x.match ? "" : "is-new"}" data-r="${ri}" data-i="${i}">
        <label class="check-inline scan-inc"><input type="checkbox" name="inc" ${x.include ? "checked" : ""}><span>${x.raw ? `<small class="muted">${esc(x.raw)}</small>` : t("包含这一行")}</span></label>
        <div class="form-grid">
          <label class="span-2">${t("名称")}<input name="name" maxlength="60" list="scanItemNames" autocomplete="off" value="${esc(x.name)}"></label>
          <label>${t("数量")}<input name="qty" type="number" min="0" step="any" inputmode="decimal" value="${esc(fmt(x.qty))}"></label>
          <label>${t("单位")}<input name="unit" list="unitList" maxlength="10" value="${esc(t(x.unit))}"></label>
          <label>${t("金额")}（${esc(cur)}）<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${x.amount ?? ""}"></label>
          <label class="span-2">${t("放进库存")}<select name="target" data-def="${esc(x.def || "")}">${targetOptions(x)}</select></label>
          <label class="span-2 scan-cat">${t("新物品的分类")}<select name="cat">${categoryOptions(x.category)}</select></label>
        </div>
        <p class="dup-hint" role="status" hidden></p><p class="cart-hint" role="status" hidden></p><p class="name-hint" role="status" hidden></p>${(() => { const n = noteFor(x.unit, x.qty, x.match); return `<p class="unit-hint${n.warn ? " warn" : ""}" role="status" ${n.text ? "" : "hidden"}>${esc(n.text)}</p>`; })()}</li>`;
}
function receiptHtml(r, ri, many, cur) {
  return `<fieldset class="scan-rcpt panel" data-r="${ri}" style="margin:0 0 12px">
      ${many ? `<legend><label class="check-inline"><input type="checkbox" name="rinc" ${r.include ? "checked" : ""}><span><b>🧾 ${t("第 {n} 张小票", { n: ri + 1 })}</b>${r.store ? ` · ${esc(r.store)}` : ""} · ${esc(r.date)}</span></label></legend>` : ""}
      <div class="form-grid">
        <label>${t("商店")}<input name="store" maxlength="40" list="storeList" value="${esc(r.store)}"></label>
        ${cardSelectHtml("pay", r.pay) ? `<label>${t("怎么付的")}${cardSelectHtml("pay", r.pay)}</label>` : ""}
        <label>${t("购买日期")}<input name="date" type="date" max="${todayISO()}" value="${esc(r.date)}"><small class="${r.dateSrc === "today" ? "form-error" : "muted"}">${r.dateSrc === "user" ? t("你填的日期") : r.dateSrc === "receipt" ? t("取自小票 / 文字，不对可以改") : t("没有读到日期，先用今天；补记的话请改成实际购买日")}</small></label>
      </div>
      <p class="muted scan-past" ${r.date < todayISO() ? "" : "hidden"} style="margin:8px 0 0;font-size:13px">📌 ${t("补记以前的购物：默认只记花费，不入库（东西多半已经用掉）。要加库存的行，把“放进库存”改成对应物品。")}</p>
      <ul class="scan-rows">${r.rows.map((x, i) => rowHtml(x, ri, i, cur)).join("")}</ul>
      ${sc.result?.manual ? `<div class="scan-addrow"><button type="button" class="btn btn-ghost btn-sm" data-action="scan-add-row" data-r="${ri}">＋ ${t("加一条")}</button><small class="muted">${t("要手动录入多样东西，就再加一条")}</small></div>` : ""}
      <p class="muted scan-rsum" style="margin:8px 0 0;font-size:13px"></p></fieldset>`;
}
function reviewHtml() {
  const R = sc.result, cur = Units.region.currency, many = R.receipts.length > 1;
  return `
    ${R.manual ? `<div class="section-head"><h2>${t("录入购物")}</h2><p>${t("手动添加：和拍照识别同一张表。名称会联想已有物品，选上就补到那件的库存")}</p></div>${kindChips()}` : ""}
    <div class="section-head" ${R.manual ? "hidden" : ""}><h2>${t("确认录入")}</h2><p>${many ? t("读到 {n} 张小票：每张的商店、日期和商品分开核对", { n: R.receipts.length }) : t("核对每一行：改名称 / 数量 / 金额，选放进哪个库存物品")}</p></div>
    ${R.dropped ? `<p class="muted" style="font-size:13px">${t("另有 {n} 张没有读到商品，已忽略；可以返回重来，单独再识别一次。", { n: R.dropped })}</p>` : ""}
    <form id="scanForm" novalidate>
      ${storeDatalist()}
      ${R.receipts.map((r, ri) => receiptHtml(r, ri, many, cur)).join("")}
      <p class="muted" id="scanSum" style="margin:8px 0 0;font-size:13px"></p>
      ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
      <div class="form-actions sticky-actions">
        <button type="button" class="btn btn-primary" data-action="scan-confirm" ${sc.busy ? "disabled" : ""}>${sc.busy ? t("正在入库…") : many ? t("确认入库（{n} 张小票）", { n: R.receipts.filter((x) => x.include).length }) : t("确认入库")}</button>
        <button type="button" class="btn btn-ghost" data-action="scan-back">${R.manual ? t("清空") : t("返回重来")}</button></div>
      <datalist id="scanItemNames">${itemNameOptions(["pantry", "house"]).map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    </form>`;
}
/** 这张小票每一行的 日期 + 金额（向数据库查重用） */
const dupCands = (box) => { const date = box.querySelector('[name="date"]').value || todayISO(); return [...box.querySelectorAll(".scan-row")].map((r) => ({ d: date, a: r.querySelector('[name="amount"]').value })).filter((c) => c.a !== ""); };
/** 每一行和已有花费对一下：疑似别人（或自己）已经记过的，在行下面提醒；返回「勾选了的小票里被提醒的行数」。
 *  已有花费按 日期 + 金额 向数据库查（dup-check.js 的缓存）；还没查过的先按没有算，查回来再标一遍 */
function markDups(box) {
  loadNear(dupCands(box)).then((fresh) => { if (fresh && box.isConnected) markDups(box); }).catch(() => {});
  const store = box.querySelector('[name="store"]').value, date = box.querySelector('[name="date"]').value || todayISO();
  let n = 0; const taken = new Set();
  box.querySelectorAll(".scan-row").forEach((r) => {
    const g = (k) => r.querySelector(`[name="${k}"]`).value, hint = r.querySelector(".dup-hint");
    const list = g("amount") === "" ? [] : similarPurchases({ name: g("name"), amount: num(g("amount")), store, at: new Date(`${date}T12:00:00`) });
    hint.innerHTML = dupNote(list); hint.hidden = !list.length;
    const cart = r.querySelector(".cart-hint"), tg = g("target"), sh = matchOpenShopping({ name: g("name"), item_id: tg.startsWith("__") ? null : tg, at: new Date(`${date}T12:00:00`) }, taken);
    if (sh && r.querySelector('[name="inc"]').checked) taken.add(sh.id);
    cart.textContent = sh ? "🛒 " + t("采购清单里的「{n}」会标成已买到", { n: sh.name }) : ""; cart.hidden = !sh;
    if (list.length && r.querySelector('[name="inc"]').checked) n++;
  });
  return n;
}
function updateSum() {
  const f = $("#scanForm"), el = $("#scanSum"); if (!f || !el || !sc.result) return;
  let all = 0, rn = 0, rows = 0;
  f.querySelectorAll(".scan-rcpt").forEach((box) => {
    const ri = +box.dataset.r, on = box.querySelector('[name="rinc"]')?.checked !== false;
    markDups(box);
    const sel = [...box.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked);
    const sum = sel.reduce((s, r) => s + num(r.querySelector('[name="amount"]').value), 0), tot = sc.result.receipts[ri]?.total;
    box.querySelector(".scan-rsum").textContent = t("选中 {n} 项，合计 {m}", { n: sel.length, m: Units.money(sum) })
      + (tot != null ? (Math.abs(tot - sum) > 0.05 ? t("；小票合计 {m}（含税费或有漏项，可对一下）", { m: Units.money(tot) }) : t("；与小票合计一致")) : "");
    if (on) { all += sum; rn++; rows += sel.length; }
  });
  el.textContent = sc.result.receipts.length > 1 ? t("共 {r} 张小票、{n} 项，合计 {m}", { r: rn, n: rows, m: Units.money(all) }) : "";
}

/* ───────────── 交互：文件、文字、行内联动 ───────────── */
document.addEventListener("change", async (e) => {
  if (e.target.id === "scanFile") {
    const files = [...e.target.files].slice(0, MAX_IMAGES - sc.images.length); e.target.value = "";
    sc.error = "";
    for (const f of files) { try { sc.images.push(await compress(f)); } catch { sc.error = t("这张图读不了，换一张（JPG / PNG）。"); } }
    repaint(); return;
  }
  const row = e.target.closest?.(".scan-row");
  if (row && e.target.name === "target") { row.classList.toggle("is-new", e.target.value === "__new"); if (e.isTrusted) e.target.dataset.touched = "1"; }
  if (row && (e.target.name === "target" || e.target.name === "unit")) unitNote(row);
  if (e.target.name === "date" && e.target.closest?.("#scanForm")) {   // 改了某张小票的购买日期：它没手动选过的行，过去的日期 → 只记花费，今天 → 回到原来的默认
    const past = !!e.target.value && e.target.value < todayISO(), box = e.target.closest(".scan-rcpt");
    box.querySelectorAll(".scan-row").forEach((r) => {
      const sel = r.querySelector('[name="target"]'); if (sel.dataset.touched === "1") return;
      sel.value = past ? "__skip" : (sel.dataset.def || "__new"); r.classList.toggle("is-new", sel.value === "__new");
    });
    const note = box.querySelector(".scan-past"); if (note) note.hidden = !past;
  }
  if (e.target.closest?.("#scanForm")) { sc.dupAck = false; updateSum(); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "scanDate") { sc.date = e.target.value; return; }
  if (e.target.id === "scanText") { sc.text = e.target.value; document.querySelectorAll('[data-action="scan-run"]').forEach((b) => { b.disabled = !aiReady() || sc.busy || (!sc.images.length && !sc.text.trim()); }); }
  else if (e.target.closest?.("#scanForm")) {
    if (e.target.name === "name") nameMatch(e.target.closest(".scan-row"), e.target.value);
    if (e.target.name === "qty" || e.target.name === "unit") unitNote(e.target.closest(".scan-row"));
    sc.dupAck = false; updateSum();
  }
});
/** 行名称和已有物品对一下：写法一样（忽略大小写、空格、全角半角、英文复数）→ 「放进库存」自动选那件（用户手动选过的不动）；相近的 → 提示一下 */
function nameMatch(row, name) {
  if (!row) return;
  const sel = row.querySelector('[name="target"]'), hint = row.querySelector(".name-hint"), same = findItem(name, { spaces: ["pantry", "house"] });
  if (same && sel && sel.dataset.touched !== "1" && sel.value !== "__skip" && [...sel.options].some((o) => o.value === same.id)) { sel.value = same.id; row.classList.remove("is-new"); }
  else if (!same && sel && sel.dataset.touched !== "1" && sel.value !== "__skip" && !sel.value.startsWith("__")) { sel.value = "__new"; row.classList.add("is-new"); }
  unitNote(row);
  if (!hint) return;
  const near = same ? [] : similarItems(name, { spaces: ["pantry", "house"] });
  hint.hidden = !same && !near.length;
  hint.textContent = same ? t("已有「{name}」，会补到它的库存", { name: same.name }) : near.length ? t("相近的已有物品：{list}。是同一样东西就在「放进库存」里选它", { list: near.map((i) => i.name).join("、") }) : "";
}

async function run() {
  sc.busy = true; sc.error = ""; sc.progress = ""; repaint();
  try {
    const opts = { json: true, temperature: 0.1, maxTokens: 8000 };
    let parts = [];
    if (sc.mode === "separate" && sc.images.length > 1) {   // 每张照片单独识别：不会把不同的小票混在一起；文字（如果有）再单独识别一次
      const jobs = [...sc.images.map((im) => ({ images: [im], text: "" })), ...(sc.text.trim() ? [{ images: [], text: sc.text }] : [])];
      for (const [n, job] of jobs.entries()) {
        sc.progress = t("正在识别第 {n} / {m} 张…", { n: n + 1, m: jobs.length }); repaint();
        const keep = [sc.images, sc.text]; sc.images = job.images; sc.text = job.text;
        let prompt; try { prompt = scanPrompt("one"); } finally { [sc.images, sc.text] = keep; }
        try { parts.push(parseJson(await askText(prompt.system, prompt.user, { ...opts, images: job.images }))); }
        catch (e) { if (jobs.length === 1) throw e; parts.push({ receipts: [] }); sc.error = t("有 {n} 张没读出来，可以返回重来单独再识别。", { n: 1 }) + ""; }
      }
    } else {
      const { system, user } = scanPrompt(sc.mode === "merge" ? "merge" : "auto");
      parts = [parseJson(await askText(system, user, { ...opts, images: sc.images }))];
    }
    sc.result = normalize(parts); sc.step = "review"; if (sc.result.receipts.length) sc.error = "";
  } catch (e) { sc.error = e.message || String(e); }
  finally { sc.busy = false; sc.progress = ""; repaint(); updateSum(); }
}

/** 读表单里的每一行，写库存 + 采购花费；已有物品按单位换算，匹配到的采购清单项顺手标成已买到 */
async function confirm(ctx) {
  const f = $("#scanForm"); if (!f) return;
  const cur = Units.region.currency, boxes = [...f.querySelectorAll(".scan-rcpt")].filter((b) => b.querySelector('[name="rinc"]')?.checked !== false);
  const rows = boxes.flatMap((box) => {
    const store = cleanStore(box.querySelector('[name="store"]').value), date = box.querySelector('[name="date"]').value || todayISO(), now = new Date(`${date}T12:00:00`).toISOString();
    const pay = purchasePayFields(box.querySelector('[name="pay"]')?.value || "");   // 这张小票怎么付的：卡 → card_id，现金 / 支票 / 礼品卡 → method
    return [...box.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked).map((r) => {
      const g = (n) => r.querySelector(`[name="${n}"]`).value;
      const nm = g("name").trim(), same = g("target") === "__new" ? findItem(nm, { spaces: ["pantry", "house"] }) : null;   // 「新建」但库存里已有写法一样的：补到那件，不建第二件
      return { store, now, pay, name: nm, qty: num(g("qty"), 0), unit: Units.normalize(g("unit")) || "个", amount: g("amount") === "" ? null : Math.round(Math.max(0, num(g("amount"))) * 100) / 100, target: same ? same.id : g("target"), cat: g("cat") };
    });
  });
  if (!rows.length) { sc.error = t("没有勾选任何一行。"); return repaint2(); }
  if (rows.some((x) => !x.name)) { sc.error = t("有一行没有名称。"); return repaint2(); }
  if (rows.some((x) => x.target !== "__skip" && !(x.qty > 0))) { sc.error = t("入库的行数量要大于 0。"); return repaint2(); }
  await loadNear(boxes.flatMap(dupCands)).catch(() => {});   // 先把这几张小票的日期 + 金额查完，提醒才是准的
  const dupRows = boxes.reduce((s, b) => s + markDups(b), 0);   // 疑似重复的行：第一次点只提醒，确认无误再点一次才入库
  if (dupRows && !sc.dupAck) { sc.dupAck = true; sc.error = t("有 {n} 行疑似已经记过（见各行下面的提醒）。确认不是重复的，再点一次“确认入库”；是重复的就取消勾选那一行。", { n: dupRows }); return repaint2(); }
  sc.dupAck = false; sc.busy = true; sc.error = ""; repaint2();
  let stocked = 0, spendOnly = 0, created = 0, cartDone = 0; const warns = [], convs = [], newItems = new Map(), doneShop = new Set();
  try {
    // 先建新物品（同名同分类合并成一条，几张小票的也合并）：这一步失败时还没写任何花费和库存，可以直接重试
    for (const x of rows.filter((r) => r.target === "__new")) {
      const key = normName(x.name), ex = newItems.get(key);   // 几行同名（不管分类）合成一件
      if (ex) ex.quantity = Math.round((ex.quantity + x.qty) * 100) / 100;
      else newItems.set(key, { name: x.name.slice(0, 60), category: x.cat, subcategory: null, unit: x.unit, quantity: Math.round(x.qty * 100) / 100, min_quantity: 0,
        location: catOf(x.cat).loc || null, expiry_date: null, lead_days: spaceOf(x.cat) === "house" ? 14 : spaceOf(x.cat) === "gear" ? 0 : 3, avg_daily_use: null, notes: null });
    }
    if (newItems.size) { await Store.addItems([...newItems.values()]); created = newItems.size; }
    for (const x of rows) {
      const item = x.target.startsWith("__") ? null : state.items.find((i) => i.id === x.target);
      await Store.addPurchase({ item_id: item?.id || null, name: x.name, category: item?.category || (x.target === "__new" ? x.cat : "other"), quantity: x.qty || null, unit: x.unit || null, amount: x.amount, currency: cur, purchased_at: x.now, store: x.store, ...x.pay });
      const cart = matchOpenShopping({ name: x.name, item_id: item?.id, at: x.now }, doneShop);   // 采购清单里对应的那一项：不管入不入库，买到了就标成已买到
      if (cart) { doneShop.add(cart.id); cartDone++; await Store.saveShopping({ id: cart.id, status: "bought", bought_at: x.now, amount: x.amount, claimed_by_name: cart.claimed_by_name || state.displayName }); }
      if (x.target === "__skip") { spendOnly++; continue; }
      if (item && normName(x.name) !== normName(item.name) && !findItem(x.name)) Store.addItemAlias(item.id, x.name.slice(0, 60)).catch(() => {});   // 学会这个叫法
      if (item) {
        const fit = Units.fit(x.unit, item.unit), add = fit.kind === "mismatch" ? x.qty : x.qty * fit.factor;   // 能换算的换成库存单位；计数单位之间 1:1
        if (fit.kind === "mismatch") warns.push(x.name);
        else if (fit.kind === "convert") convs.push(t("{name} {q1} {u1} → {q2} {u2}", { name: item.name, q1: fmt(x.qty), u1: t(x.unit), q2: fmt(Math.round(add * 100) / 100), u2: t(item.unit) }));
        await Store.adjust(item.id, Math.round(add * 100) / 100, "restock");
        stocked++;
      }
    }
    for (const s of new Set(rows.map((x) => x.store).filter(Boolean))) rememberStore(s);
    toast((boxes.length > 1 ? t("已录入 {r} 张小票：", { r: boxes.length }) : t("已录入：")) + t("入库 {a} 项，新建 {b} 项，只记花费 {c} 项", { a: stocked, b: created, c: spendOnly }) + (cartDone ? t("；采购清单 {n} 项已标成已买到", { n: cartDone }) : "") + (convs.length ? t("；已换算单位：{list}", { list: convs.join("、") }) : "") + (warns.length ? t("；{names} 的单位无法换算，按原数字记入了，请核对库存", { names: warns.join("、") }) : ""));
    resetScan(); ctx.go(href("shopping")); ctx.refresh();
  } catch (e) { sc.busy = false; sc.error = t("入库中途失败：{msg}。已写入的部分请回到库存和统计核对，不要直接重复提交。", { msg: e.message }); repaint2(); }
}
/** 确认页重画：先把用户改过的行存回 sc.result，避免出错提示一出现就丢掉改动 */
function repaint2() {
  const f = $("#scanForm");
  if (f && sc.result) {
    f.querySelectorAll(".scan-rcpt").forEach((box) => {
      const rc = sc.result.receipts[+box.dataset.r]; if (!rc) return;
      rc.include = box.querySelector('[name="rinc"]')?.checked !== false; rc.store = box.querySelector('[name="store"]').value; rc.date = box.querySelector('[name="date"]').value; rc.pay = box.querySelector('[name="pay"]')?.value ?? rc.pay;
      box.querySelectorAll(".scan-row").forEach((r) => {
        const x = rc.rows[+r.dataset.i], g = (n) => r.querySelector(`[name="${n}"]`).value;
        Object.assign(x, { include: r.querySelector('[name="inc"]').checked, name: g("name"), qty: num(g("qty"), 0), unit: g("unit"), amount: g("amount") === "" ? null : num(g("amount")), category: g("cat"), match: g("target") === "__new" ? "" : g("target") === "__skip" ? "skip" : g("target") });
      });
    });
  }
  repaint(); updateSum();
}

/** main.js 把 data-action="scan-*" 都交给这里 */
export function scanAction(action, el, ctx) {
  switch (action) {
    case "scan-kind": if (el.dataset.kind === "manual") { startManual(); return repaint(); } sc.kind = el.dataset.kind; sc.error = ""; if (sc.result?.manual) { sc.step = "input"; sc.result = null; } return repaint();
    case "scan-add-row": { if (!sc.result) return; repaint2(); const rc = sc.result.receipts[+el.dataset.r]; if (rc) rc.rows.push(blankRow()); repaint(); updateSum(); const rows = document.querySelectorAll(`.scan-rcpt[data-r="${el.dataset.r}"] .scan-row`); rows[rows.length - 1]?.querySelector('[name="name"]')?.focus(); return; }
    case "scan-mode": sc.mode = el.dataset.mode; return repaint();
    case "scan-img-del": sc.images.splice(+el.dataset.i, 1); return repaint();
    case "scan-run": return run();
    case "scan-back": if (sc.result?.manual) { startManual(); return repaint(); } sc.step = "input"; sc.result = null; sc.error = ""; return repaint();
    case "scan-confirm": return confirm(ctx);
    default: return undefined;
  }
}
