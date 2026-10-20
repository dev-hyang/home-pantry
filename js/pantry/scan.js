/* 录入购物：实体店小票（拍照）和线上订单（截图 / 粘贴订单文字）→ AI 读成商品清单 → 逐行确认 → 入库 + 记花费。
 * 用设置里已有的 AI key（推荐 Gemini 免费档）；图片只在手机上压缩后发给所选服务商，不保存原图；一律人工确认后才写入。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, catOf, esc, fmt, num, spaceOf, toast, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { crumbNav } from "../core/hub.js";
import { aiReady, aiSettings, askText, providerOf, visionCapable } from "../core/ai.js";
import { cleanStore, rememberStore, storeDatalist } from "../stats/views.js";
import { categoryOptions } from "./views.js";

const MAX_IMAGES = 4;
const sc = { kind: "receipt", step: "input", images: [], text: "", busy: false, error: "", result: null, pool: [] };
export function resetScan() { Object.assign(sc, { kind: "receipt", step: "input", images: [], text: "", busy: false, error: "", result: null, pool: [] }); }
const repaint = () => { const m = $("#main"); if (m && state.route.section === "scan") m.innerHTML = viewScan(); };

/* ───────────── 图片：手机上先压缩（长边 1600px、JPEG），小票几百 KB 就够认 ───────────── */
async function compress(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const url = c.toDataURL("image/jpeg", 0.82);
  return { mime: "image/jpeg", b64: url.split(",")[1], url };
}

/* ───────────── 提示词与结果整理 ───────────── */
function buildPool() {
  sc.pool = state.items.filter((i) => spaceOf(i.category) !== "gear").slice(0, 400);   // 只传名称和单位，用来让模型把商品对应到已有库存
  return sc.pool.map((i, n) => `${n}|${i.name}|${i.unit || ""}`).join("\n");
}
function scanPrompt() {
  const cats = [...window.CATEGORIES.filter((c) => c.space === "pantry" || c.space === "house")].map((c) => `${c.id}=${c.name}`).join(", ");
  const names = lang === "en" ? "English" : "简体中文";
  const system = [
    "You read grocery / household shopping receipts and online order confirmations and return ONLY JSON.",
    `Write product names in short, generic ${names} (e.g. "Whole milk", not store abbreviations). Keep brand only when it matters.`,
    "Each purchased product is one line. Put weight-priced items as qty = weight with unit lb/kg/oz/g; countable items as qty = count with unit pc/box/bag/bottle (or the local unit).",
    "amount = the final price paid for that line (apply line discounts). Skip tax, tip, bag fees, delivery/service fees, subtotal and payment lines (set skip=true or omit them).",
    "match = the index of the best matching existing inventory item from the list I give you, or null if none is a clear match.",
    `category = one of: ${cats}; use "other" if unsure.`,
    "date = purchase/order date as YYYY-MM-DD if visible, else null. total = grand total as a number if visible, else null.",
  ].join("\n");
  const user = [
    sc.kind === "order" ? "Source: an ONLINE ORDER (confirmation email, order page or app screenshot)." : "Source: an IN-STORE RECEIPT photo.",
    "Existing inventory (index|name|unit):", buildPool() || "(empty)",
    sc.text.trim() ? `Pasted text:\n${sc.text.trim().slice(0, 12000)}` : "",
    sc.images.length ? `${sc.images.length} image(s) attached.` : "",
    'Return exactly: {"store":"","date":null,"currency":"","total":null,"lines":[{"raw":"original line","name":"","qty":1,"unit":"","amount":null,"match":null,"category":"other","skip":false}]}',
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
function normalize(j) {
  const lines = Array.isArray(j.lines) ? j.lines : [];
  const rows = lines.filter((l) => l && !l.skip && String(l.name || "").trim()).map((l) => {
    const m = Number.isInteger(l.match) ? sc.pool[l.match] : null;
    const valid = window.CATEGORIES.some((c) => c.id === l.category && c.space !== "gear");
    const amount = l.amount == null || l.amount === "" ? null : num(l.amount, NaN);
    return { include: true, raw: String(l.raw || ""), name: String(l.name).trim().slice(0, 60), qty: num(l.qty, 1) > 0 ? num(l.qty, 1) : 1, unit: String(l.unit || m?.unit || t("个")).trim().slice(0, 10),
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null, match: m?.id || "", category: valid ? l.category : m?.category || "other" };
  });
  if (!rows.length) throw new Error(t("没有读到商品。小票拍清楚些（整张、不反光），或把订单文字粘贴进来。"));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(j.date || "") && j.date <= todayISO() ? j.date : todayISO();
  const total = j.total == null ? null : num(j.total, NaN);
  return { store: String(j.store || "").trim().slice(0, 40), date, total: Number.isFinite(total) ? total : null, rows };
}

/* ───────────── 页面 ───────────── */
export function viewScan() {
  const back = crumbNav([{ href: href("shopping"), label: t("采购清单") }, { label: t("录入购物"), icon: "🧾" }]);
  return `<section class="section scan-page">${back}${sc.step === "review" && sc.result ? reviewHtml() : inputHtml()}</section>`;
}

function inputHtml() {
  const s = aiSettings(), p = providerOf(s.provider), ready = aiReady();
  const order = sc.kind === "order";
  const canImg = visionCapable(p);
  const kindChip = (k, label) => `<button type="button" class="chip" data-action="scan-kind" data-kind="${k}" aria-pressed="${sc.kind === k}">${label}</button>`;
  return `
    <div class="section-head"><h2>${t("录入购物")}</h2><p>${t("拍小票或贴线上订单，AI 读成清单，确认后自动入库、记花费")}</p></div>
    ${ready ? "" : `<div class="panel cta-panel"><div><b>${t("先填一个 AI key")}</b><p class="muted">${t("推荐 Gemini（有免费额度）。key 只存在这台设备的浏览器里。")}</p></div>
      <a class="btn btn-primary" href="${href("me", "settings")}?sec=ai">${t("去设置")}</a></div>`}
    <div class="chips" role="group" aria-label="${t("来源")}">${kindChip("receipt", `🧾 ${t("实体店小票")}`)}${kindChip("order", `📦 ${t("线上订单")}`)}</div>
    <div class="panel scan-in">
      <span class="pick-lbl">${order ? t("订单截图（可选，可多张）") : t("小票照片（可多张，长小票分段拍）")}</span>
      <div class="scan-thumbs">
        ${sc.images.map((im, i) => `<span class="scan-thumb"><img src="${im.url}" alt="${t("第 {n} 张", { n: i + 1 })}"><button type="button" data-action="scan-img-del" data-i="${i}" aria-label="${t("删除这张")}">×</button></span>`).join("")}
        ${sc.images.length < MAX_IMAGES ? `<label class="scan-add ${canImg ? "" : "is-off"}"><input type="file" id="scanFile" accept="image/*" multiple ${canImg ? "" : "disabled"}><span>📷 ${t("拍照 / 选图")}</span></label>` : ""}
      </div>
      ${canImg ? "" : `<p class="form-error" style="margin:6px 0 0">${t("当前的 {p} 不能读图片：换成 Gemini（设置 → AI 助手），或只粘贴文字。", { p: t(p.name) })}</p>`}
      <label class="scan-text">${order ? t("订单文字（订单确认邮件、网页或 App 订单详情，整段粘贴）") : t("补充文字（可选，例如小票上识别不出的商品）")}
        <textarea id="scanText" rows="${order ? 8 : 3}" maxlength="12000" placeholder="${order ? t("例如：Instacart / Amazon / 京东 / 盒马 的订单确认内容") : ""}">${esc(sc.text)}</textarea></label>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("图片和文字会发给你在设置里选的 {p}，不会保存原图。小票上的卡号、姓名建议裁掉或遮住再拍。Gemini 免费档的内容可能被用于改进产品，介意的话用付费 key。", { p: t(p.name) })}</p>
      ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
      <div class="form-actions"><button type="button" class="btn btn-primary" data-action="scan-run" ${!ready || sc.busy || (!sc.images.length && !sc.text.trim()) ? "disabled" : ""}>${sc.busy ? t("正在识别…（几十秒）") : t("识别")}</button></div>
    </div>`;
}

function targetOptions(row) {
  const items = sc.pool, name = (i) => `${esc(i.name)}（${esc(t(i.unit || ""))}）`;
  const grp = (space, label) => { const l = items.filter((i) => spaceOf(i.category) === space); return l.length ? `<optgroup label="${t(label)}">${l.map((i) => `<option value="${i.id}" ${row.match === i.id ? "selected" : ""}>${name(i)}</option>`).join("")}</optgroup>` : ""; };
  return `<option value="__skip" ${row.match === "skip" ? "selected" : ""}>${t("只记花费，不入库")}</option>
    <option value="__new" ${!row.match ? "selected" : ""}>＋ ${t("新建物品")}</option>
    ${grp("pantry", "日常储备")}${grp("house", "房屋耗材")}`;
}
function reviewHtml() {
  const r = sc.result, cur = Units.region.currency;
  return `
    <div class="section-head"><h2>${t("确认录入")}</h2><p>${t("核对每一行：改名称 / 数量 / 金额，选放进哪个库存物品")}</p></div>
    <form id="scanForm" class="panel" novalidate>
      <div class="form-grid">
        <label>${t("商店")}<input name="store" maxlength="40" list="storeList" value="${esc(r.store)}"></label>
        <label>${t("购买日期")}<input name="date" type="date" value="${esc(r.date)}"></label>
      </div>
      ${storeDatalist()}
      <ul class="scan-rows">${r.rows.map((x, i) => `<li class="scan-row ${x.match ? "" : "is-new"}" data-i="${i}">
        <label class="check-inline scan-inc"><input type="checkbox" name="inc" ${x.include ? "checked" : ""}><span>${x.raw ? `<small class="muted">${esc(x.raw)}</small>` : t("包含这一行")}</span></label>
        <div class="form-grid">
          <label class="span-2">${t("名称")}<input name="name" maxlength="60" value="${esc(x.name)}"></label>
          <label>${t("数量")}<input name="qty" type="number" min="0" step="any" inputmode="decimal" value="${esc(fmt(x.qty))}"></label>
          <label>${t("单位")}<input name="unit" list="unitList" maxlength="10" value="${esc(x.unit)}"></label>
          <label>${t("金额")}（${esc(cur)}）<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${x.amount ?? ""}"></label>
          <label class="span-2">${t("放进库存")}<select name="target">${targetOptions(x)}</select></label>
          <label class="span-2 scan-cat">${t("新物品的分类")}<select name="cat">${categoryOptions(x.category)}</select></label>
        </div></li>`).join("")}</ul>
      <p class="muted" id="scanSum" style="margin:8px 0 0;font-size:13px"></p>
      ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
      <div class="form-actions sticky-actions">
        <button type="button" class="btn btn-primary" data-action="scan-confirm" ${sc.busy ? "disabled" : ""}>${sc.busy ? t("正在入库…") : t("确认入库")}</button>
        <button type="button" class="btn btn-ghost" data-action="scan-back">${t("返回重来")}</button></div>
    </form>`;
}
function updateSum() {
  const f = $("#scanForm"), el = $("#scanSum"); if (!f || !el) return;
  const rows = [...f.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked);
  const sum = rows.reduce((s, r) => s + num(r.querySelector('[name="amount"]').value), 0);
  const tot = sc.result?.total;
  el.textContent = t("选中 {n} 项，合计 {m}", { n: rows.length, m: Units.money(sum) })
    + (tot != null ? (Math.abs(tot - sum) > 0.05 ? t("；小票合计 {m}（含税费或有漏项，可对一下）", { m: Units.money(tot) }) : t("；与小票合计一致")) : "");
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
  if (row && e.target.name === "target") row.classList.toggle("is-new", e.target.value === "__new");
  if (e.target.closest?.("#scanForm")) updateSum();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "scanText") { sc.text = e.target.value; const b = document.querySelector('[data-action="scan-run"]'); if (b) b.disabled = !aiReady() || sc.busy || (!sc.images.length && !sc.text.trim()); }
  else if (e.target.closest?.("#scanForm")) updateSum();
});

async function run() {
  sc.busy = true; sc.error = ""; repaint();
  try {
    const { system, user } = scanPrompt();
    const text = await askText(system, user, { json: true, images: sc.images, temperature: 0.1, maxTokens: 4000 });
    sc.result = normalize(parseJson(text)); sc.step = "review";
  } catch (e) { sc.error = e.message || String(e); }
  finally { sc.busy = false; repaint(); updateSum(); }
}

/** 读表单里的每一行，写库存 + 采购花费；已有物品按单位换算，匹配到的采购清单项顺手标成已买到 */
async function confirm(ctx) {
  const f = $("#scanForm"); if (!f) return;
  const store = cleanStore(f.elements.store.value), date = f.elements.date.value || todayISO(), at = `${date}T12:00:00`;
  const now = new Date(at).toISOString(), cur = Units.region.currency;
  const rows = [...f.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked).map((r) => {
    const g = (n) => r.querySelector(`[name="${n}"]`).value;
    return { name: g("name").trim(), qty: num(g("qty"), 0), unit: g("unit").trim() || t("个"), amount: g("amount") === "" ? null : Math.round(Math.max(0, num(g("amount"))) * 100) / 100, target: g("target"), cat: g("cat") };
  });
  if (!rows.length) { sc.error = t("没有勾选任何一行。"); return repaint2(); }
  if (rows.some((x) => !x.name)) { sc.error = t("有一行没有名称。"); return repaint2(); }
  if (rows.some((x) => x.target !== "__skip" && !(x.qty > 0))) { sc.error = t("入库的行数量要大于 0。"); return repaint2(); }
  sc.busy = true; sc.error = ""; repaint2();
  let stocked = 0, spendOnly = 0, created = 0; const warns = [], newItems = new Map(), doneShop = new Set();
  try {
    for (const x of rows) {
      const item = x.target.startsWith("__") ? null : state.items.find((i) => i.id === x.target);
      await Store.addPurchase({ item_id: item?.id || null, name: x.name, category: item?.category || (x.target === "__new" ? x.cat : "other"), quantity: x.qty || null, unit: x.unit || null, amount: x.amount, currency: cur, purchased_at: now, store });
      if (x.target === "__skip") { spendOnly++; continue; }
      if (item) {
        const add = !x.unit || x.unit === item.unit ? x.qty : Units.convert(x.qty, x.unit, item.unit);
        if (add == null) { warns.push(x.name); await Store.adjust(item.id, Math.round(x.qty * 100) / 100, "restock"); } else await Store.adjust(item.id, Math.round(add * 100) / 100, "restock");
        const s = state.shopping.find((q) => q.item_id === item.id && q.status !== "bought");
        if (s && !doneShop.has(s.id)) { doneShop.add(s.id); await Store.saveShopping({ id: s.id, status: "bought", bought_at: now, amount: x.amount, claimed_by_name: s.claimed_by_name || state.displayName }); }
        stocked++;
      } else {   // 新物品：同名同分类合并成一条
        const key = `${x.cat}|${x.name.toLowerCase()}`, ex = newItems.get(key);
        if (ex) ex.quantity = Math.round((ex.quantity + x.qty) * 100) / 100;
        else newItems.set(key, { name: x.name.slice(0, 60), category: x.cat, subcategory: null, unit: x.unit, quantity: Math.round(x.qty * 100) / 100, min_quantity: 0,
          location: catOf(x.cat).loc || null, expiry_date: null, lead_days: spaceOf(x.cat) === "house" ? 14 : spaceOf(x.cat) === "gear" ? 0 : 3, avg_daily_use: null, notes: null });
      }
    }
    if (newItems.size) { await Store.addItems([...newItems.values()]); created = newItems.size; }
    if (store) rememberStore(store);
    toast(t("已录入：入库 {a} 项，新建 {b} 项，只记花费 {c} 项", { a: stocked, b: created, c: spendOnly }) + (warns.length ? t("；{names} 的单位无法换算，请核对库存", { names: warns.join("、") }) : ""));
    resetScan(); ctx.go(href("shopping")); ctx.refresh();
  } catch (e) { sc.busy = false; sc.error = t("入库中途失败：{msg}。已写入的部分不会重复，请回到库存核对后再试。", { msg: e.message }); repaint2(); }
}
/** 确认页重画：先把用户改过的行存回 sc.result，避免出错提示一出现就丢掉改动 */
function repaint2() {
  const f = $("#scanForm");
  if (f && sc.result) {
    sc.result.store = f.elements.store.value; sc.result.date = f.elements.date.value;
    f.querySelectorAll(".scan-row").forEach((r) => {
      const x = sc.result.rows[+r.dataset.i], g = (n) => r.querySelector(`[name="${n}"]`).value;
      Object.assign(x, { include: r.querySelector('[name="inc"]').checked, name: g("name"), qty: num(g("qty"), 0), unit: g("unit"), amount: g("amount") === "" ? null : num(g("amount")), category: g("cat"), match: g("target") === "__new" ? "" : g("target") === "__skip" ? "skip" : g("target") });
    });
  }
  repaint(); updateSum();
}

/** main.js 把 data-action="scan-*" 都交给这里 */
export function scanAction(action, el, ctx) {
  switch (action) {
    case "scan-kind": sc.kind = el.dataset.kind; sc.error = ""; return repaint();
    case "scan-img-del": sc.images.splice(+el.dataset.i, 1); return repaint();
    case "scan-run": return run();
    case "scan-back": sc.step = "input"; sc.result = null; sc.error = ""; return repaint();
    case "scan-confirm": return confirm(ctx);
    default: return undefined;
  }
}
