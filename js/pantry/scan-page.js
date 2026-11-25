/* 录入购物：手动添加（和拍照识别同一张确认表）和页面。 */
import { numAttrs } from "../core/ui-num.js";
import { $, esc, fmt, fmtShort, num, spaceOf, todayISO } from "../core/util.js";
import { FEES_CAT, buildPool, noteFor } from "./scan-parse.js";
import { aiReady, visionCapable } from "../core/ai.js";
import { aiSettings, providerOf } from "../core/ai-common.js";
import { dupNote, loadNear, matchOpenShopping, sameLump, sameReceipt, similarPurchases } from "../stats/dup-check.js";
import { purchasePayFields } from "../bills/card-picker.js";
import { href } from "../core/router.js";
import { itemNameOptions } from "../core/item-match.js";
import { t } from "../core/i18n.js";
import { MAX_IMAGES, sc } from "./scan-common.js";
import { categoryOptions } from "./meals-sync.js";
import { cardSelectHtml } from "../bills/card-picker.js";
import { storeDatalist } from "../stats/store-lite.js";

/* ───────────── 手动添加（11-07：和拍照识别同一张确认表，不再跳到单件物品表单）───────────── */
export const blankRow = () => ({ include: true, raw: "", name: "", qty: 1, unit: t("个"), amount: null, def: "", match: "", category: "fresh" });
export function startManual() {
  buildPool();
  sc.kind = "manual"; sc.error = ""; sc.dupAck = false;
  sc.result = { manual: true, dropped: 0, receipts: [{ include: true, store: "", date: sc.date || todayISO(), dateSrc: "user", total: null, rows: [blankRow()] }] };
  sc.step = "review";
}
/** 录入方式：默认入库 + 记花费；也可以只记花费、不动库存，或只入库、不记花费 */
const RECORD_OPTS = [["both", "入库 + 花费", "识别出的东西加进库存，同时记花费（默认）"], ["spend", "只记花费", "不入库，只把花费记下来"], ["stock", "只入库", "只加库存，不记花费"]];
const recordPick = () => `<label class="scan-kind scan-record"><span class="pick-lbl">${t("记到哪里")}</span><select id="scanRecordSel" aria-label="${t("记到哪里")}">${RECORD_OPTS.map(([k, l]) => `<option value="${k}" ${sc.record === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select></label>
  <p class="muted scan-record-hint" style="margin:6px 0 0;font-size:12.5px">${t(RECORD_OPTS.find((o) => o[0] === sc.record)[2])}</p>`;
/** 第 1 步：录入方式（默认实体店小票 / 线上订单 / 手动添加）；点它就展开第 2 步（记到哪里） */
const KINDS = [["receipt", "实体店小票"], ["order", "线上订单"], ["manual", "手动添加"]];
const kindSelect = () => `<label class="scan-kind"><span class="pick-lbl">${t("录入方式")}</span><select id="scanKindSel" aria-label="${t("录入方式")}">${KINDS.map(([k, l]) => `<option value="${k}" ${sc.kind === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select></label>`;
/** 页面上方的「录入方式」表单块：录入方式 + 记到哪里（手动添加时一直显示；拍照 / 订单是点了第 1 项才露出第 2 项） */
const modePanel = (st, manual = false) => `<div class="panel scan-modes">
    <div class="scan-step" data-step="1">${kindSelect()}</div>
    <div class="scan-step" data-step="2" ${manual || st >= 2 ? "" : "hidden"}>${recordPick()}</div></div>`;
/* ───────────── 页面 ───────────── */
export function viewScan() {
  return `<section class="section scan-page">${sc.step === "review" && sc.result ? reviewHtml() : inputHtml()}</section>`;
}
function inputHtml() {
  const s = aiSettings(), p = providerOf(s.provider), ready = aiReady();
  const order = sc.kind === "order";
  const canImg = visionCapable(p);
  const st = Math.max(sc.stage || 1, sc.images.length || sc.text.trim() || sc.busy || sc.error ? 4 : 0);   // 已经展开到第几步（有照片 / 文字 / 在识别 / 有错误时直接到最后一步）
  const runOff = !ready || !sc.kind || sc.busy || (!sc.images.length && !sc.text.trim());
  const runBtn = (cls) => `<button type="button" class="ui-btn ${cls}" data-tone="primary" data-action="scan-run" ${runOff ? "disabled" : ""}>${sc.busy ? (sc.progress || t("正在识别…（几十秒）")) : t("识别")}</button>`;
  return `
    <div class="section-head"><h2>${t("录入购物")}</h2><p>${t("拍小票或贴线上订单，AI 读成清单；或手动添加。确认后入库、记花费")}</p></div>
    ${ready ? "" : `<div class="panel cta-panel"><div><b>${t("先填一个 AI key")}</b><p class="muted">${t("推荐 Gemini（有免费额度）。key 只存在这台设备的浏览器里。")}</p></div>
      <a class="ui-btn" data-tone="primary" href="${href("me", "settings")}?sec=ai">${t("去设置")}</a></div>`}
    ${modePanel(st)}
    <div class="panel scan-in scan-step" data-step="3" ${st >= 3 ? "" : "hidden"}>
      <div>
        <div class="scan-in-head"><span class="pick-lbl">${order ? t("订单截图（可选，可多张）") : t("小票照片（可多张：几张不同的小票，或一张长小票分段拍）")}</span></div>
        <div class="scan-thumbs">
          ${sc.images.map((im, i) => `<span class="scan-thumb"><img src="${im.url}" alt="${t("第 {n} 张", { n: i + 1 })}"><button type="button" data-action="scan-img-del" data-i="${i}" aria-label="${t("删除这张")}">×</button></span>`).join("")}
          ${sc.images.length < MAX_IMAGES ? `<label class="scan-add ${canImg ? "" : "is-off"}"><input type="file" id="scanFile" accept="image/*" multiple ${canImg ? "" : "disabled"}><span>📷 ${t("拍照 / 选图")}</span></label>` : ""}
        </div>
        ${canImg ? "" : `<p class="form-error" style="margin:6px 0 0">${t("当前的 {p} 不能读图片：换成 Gemini（设置 → AI 助手），或只粘贴文字。", { p: t(p.name) })}</p>`}
        ${sc.images.length > 1 ? `<div class="scan-mode"><span class="pick-lbl">${t("这几张照片是")}</span><div class="chips" role="group" aria-label="${t("几张照片的关系")}">${[["auto", "自动判断"], ["separate", "每张是一张独立小票"], ["merge", "合起来是同一张小票"]].map(([k, l]) => `<button type="button" class="chip" data-action="scan-mode" data-mode="${k}" aria-pressed="${sc.mode === k}">${t(l)}</button>`).join("")}</div>
          <p class="muted" style="margin:0;font-size:12.5px">${t("补录几张不同商店、不同日期的小票：选“每张是一张独立小票”最稳，每张单独识别，不会混在一起；长小票分段拍选“合起来是同一张”。")}</p></div>` : ""}
        ${st < 4 ? `<p style="margin:10px 0 0"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="scan-skip-photo">${t("没有照片？只用文字 ›")}</button></p>` : ""}
      </div>
      <div class="scan-step" data-step="4" ${st >= 4 ? "" : "hidden"}>
        ${order ? `<details class="scan-more" ${sc.text.trim() || sc.skipPhoto ? "open" : ""}><summary>${t("订单文字描述（可选，可跳过：订单确认邮件、网页或 App 订单详情，整段粘贴）")}</summary>
          <textarea id="scanText" data-autosize rows="8" maxlength="12000" placeholder="${t("例如：Instacart / Amazon / 京东 / 盒马 的订单确认内容")}">${esc(sc.text)}</textarea></details>`
          : `<details class="scan-more" ${sc.text.trim() || sc.skipPhoto ? "open" : ""}><summary>${t("补充文字描述（可选，可跳过，例如小票上识别不出的商品）")}</summary>
          <textarea id="scanText" data-autosize rows="3" maxlength="12000" placeholder="">${esc(sc.text)}</textarea></details>`}
        <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("图片和文字会发给你在设置里选的 {p}，不会保存原图。小票上的卡号、姓名建议裁掉或遮住再拍。Gemini 免费档的内容可能被用于改进产品，介意的话用付费 key。", { p: t(p.name) })}</p>
        ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
        <div class="form-actions">${runBtn("")}</div>
      </div>
    </div>`;
}
function targetOptions(row) {
  const man = !!sc.result?.manual, lockSpend = man && sc.record === "spend", lockStock = man && sc.record === "stock", skipSel = row.match === "skip" || lockSpend;   // 手动添加：只记花费 → 一律「只记花费，不入库」；只入库 → 不能选「只记花费」
  const items = sc.pool, name = (i) => `${esc(i.name)}（${esc(t(i.unit || ""))}）`;
  const grp = (space, label) => { const l = items.filter((i) => spaceOf(i.category) === space); return l.length ? `<optgroup label="${t(label)}">${l.map((i) => `<option value="${i.id}" ${row.match === i.id ? "selected" : ""}>${name(i)}</option>`).join("")}</optgroup>` : ""; };
  return `<option value="__skip" ${skipSel ? "selected" : ""} ${lockStock ? "disabled" : ""}>${t("只记花费，不入库")}</option>
    <option value="__new" ${!row.match && !skipSel ? "selected" : ""}>＋ ${t("新建物品")}</option>
    ${grp("pantry", "日常消耗品")}${grp("house", "汽车房屋消耗品")}`;
}
function feeRowHtml(x, ri, i, cur) {
  return `<li data-variant="card" class="ui-row scan-row scan-fee-row" data-r="${ri}" data-i="${i}">
    <label class="check-inline scan-inc"><input type="checkbox" name="inc" ${x.include ? "checked" : ""} aria-label="${esc(t("包含这一行"))}"></label>
    <input name="name" maxlength="60" autocomplete="off" aria-label="${esc(t("名称"))}" value="${esc(x.name)}">
    <input name="amount" ${numAttrs("money", { min: null })} aria-label="${esc(t("金额"))}（${esc(cur)}）" value="${x.amount ?? ""}">
    <input type="hidden" name="qty" value=""><input type="hidden" name="unit" value=""><input type="hidden" name="target" value="__skip"><input type="hidden" name="cat" value="${FEES_CAT}">
    <p class="dup-hint" hidden></p><p class="cart-hint" hidden></p><p class="name-hint" hidden></p><p class="unit-hint" hidden></p>${x.gap ? `<p class="muted scan-gap-note">${t("按小票合计算出的差额，多半是税费；对不上就改金额或取消勾选")}</p>` : ""}</li>`;
}
function rowHtml(x, ri, i, cur) {
  const man = !!sc.result?.manual, lockSpend = man && sc.record === "spend", lockStock = man && sc.record === "stock";
  return `<li data-variant="card" class="ui-row scan-row ${x.match || lockSpend ? "" : "is-new"}${lockSpend ? " link-spend" : ""}${lockStock ? " link-stock" : ""}" data-r="${ri}" data-i="${i}">
        <label class="check-inline scan-inc"><input type="checkbox" name="inc" ${x.include ? "checked" : ""}><span>${x.raw ? `<small class="muted">${esc(x.raw)}</small>` : t("包含这一行")}</span></label>
        <div class="form-grid">
          <label class="span-2">${t("放进库存")}<select name="target" data-search data-def="${esc(x.def || "")}" ${lockSpend ? "disabled" : ""}>${targetOptions(x)}</select></label>
          <label class="span-2">${t("名称")}<input name="name" maxlength="60" list="scanItemNames" autocomplete="off" value="${esc(x.name)}"></label>
          <label class="span-2 scan-cat">${t("新物品的分类")}<select name="cat">${categoryOptions(x.category)}</select></label>
          <label>${t("数量")}<input name="qty" ${numAttrs("qty", { min: null })} value="${esc(fmt(x.qty))}"></label>
          <label>${t("单位")}<input name="unit" list="unitList" maxlength="10" value="${esc(t(x.unit))}"></label>
          <label>${t("金额")}（${esc(cur)}）<input name="amount" ${numAttrs("money", { min: null })} value="${x.amount ?? ""}" ${lockStock ? "disabled" : ""}></label>
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
      <div class="rcpt-dup" role="status" hidden></div>
      <div class="rcpt-lump" role="status" hidden></div>
      <p class="muted scan-past" ${r.date < todayISO() ? "" : "hidden"} style="margin:8px 0 0;font-size:13px">📌 ${t("补记以前的购物：默认只记花费，不入库（东西多半已经用掉）。要加库存的行，把“放进库存”改成对应物品。")}</p>
      <ul class="scan-rows">${r.rows.map((x, i) => (x.fee ? "" : rowHtml(x, ri, i, cur))).join("")}</ul>
      ${sc.result?.manual ? "" : `<div class="scan-fees"><h4>🧾 ${t("税费及其他")}</h4><p class="muted">${t("税、小费、配送费、服务费：记成单独的花费，商品价格不受影响；不要的取消勾选")}</p><ul class="scan-rows">${r.rows.map((x, i) => (x.fee ? feeRowHtml(x, ri, i, cur) : "")).join("")}</ul><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="scan-add-fee" data-r="${ri}">＋ ${t("加一行税费")}</button></div>`}
      ${sc.result?.manual ? `<div class="scan-addrow"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="scan-add-row" data-r="${ri}">＋ ${t("加一条")}</button><small class="muted">${t("要手动录入多样东西，就再加一条")}</small></div>` : ""}
      <p class="muted scan-rsum" style="margin:8px 0 0;font-size:13px"></p></fieldset>`;
}
function reviewHtml() {
  const R = sc.result, cur = Units.region.currency, many = R.receipts.length > 1;
  return `
    ${R.manual ? `<div class="section-head"><h2>${t("录入购物")}</h2><p>${t("手动添加：和拍照识别同一张表。先选放进库存的物品（或新建），名称、单位、分类会跟着填")}</p></div>` : ""}
    ${R.manual ? modePanel(4, true) : ""}
    <div class="section-head" ${R.manual ? "hidden" : ""}><h2>${t("确认录入")}</h2><p>${many ? t("读到 {n} 张小票：每张的商店、日期和商品分开核对", { n: R.receipts.length }) : t("核对每一行：改名称 / 数量 / 金额，选放进哪个库存物品")}</p></div>
    ${R.dropped ? `<p class="muted" style="font-size:13px">${t("另有 {n} 张没有读到商品，已忽略；可以返回重来，单独再识别一次。", { n: R.dropped })}</p>` : ""}
    <form id="scanForm" novalidate>
      ${storeDatalist()}
      ${R.receipts.map((r, ri) => receiptHtml(r, ri, many, cur)).join("")}
      <p class="muted" id="scanSum" style="margin:8px 0 0;font-size:13px"></p>
      ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
      <div class="form-actions sticky-actions">
        ${R.manual ? `<a class="ui-btn" data-tone="ghost" href="${href("pantry", "inventory")}">${t("取消")}</a>` : `<button type="button" class="ui-btn" data-tone="ghost" data-action="scan-back">${t("返回重来")}</button>`}
        <button type="button" class="ui-btn" data-tone="primary" data-action="scan-confirm" ${sc.busy ? "disabled" : ""}>${sc.busy ? t("正在入库…") : many ? t("确认入库（{n} 张小票）", { n: R.receipts.filter((x) => x.include).length }) : t("确认入库")}</button>
        </div>
      <datalist id="scanItemNames">${itemNameOptions(["pantry", "house"]).map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    </form>`;
}
/** 这张小票每一行的 日期 + 金额（向数据库查重用） */
export const dupCands = (box) => { const date = box.querySelector('[name="date"]').value || todayISO(); return [...box.querySelectorAll(".scan-row")].map((r) => ({ d: date, a: r.querySelector('[name="amount"]').value })).filter((c) => c.a !== ""); };
/** 勾选了的行（名称 + 金额），整张小票查重用 */
const boxRows = (box) => [...box.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked)
  .map((r) => { const a = r.querySelector('[name="amount"]').value; return { name: r.querySelector('[name="name"]').value.trim(), amount: a === "" ? null : num(a) }; });
/** 整张小票可能已经录过（家人先录了、或者自己以前录过）：小票上方提醒，选「以这次为准」或「两次都留」 */
function rcptDupHtml(hit, mode, mine, drop = new Set()) {
  const myTotal = mine.reduce((s, r) => s + num(r.amount), 0);
  const head = t("这张小票可能已经录过：{who}{d} 记了 {n} 项，合计 {m}（这次 {m2}）", { who: hit.who ? t("{w}在 ", { w: hit.who }) : "", d: fmtShort(hit.at), n: hit.rows.length, m: Units.money(hit.total), m2: Units.money(myTotal) });
  const chip = (k, l) => `<button type="button" class="chip" data-action="scan-dupmode" data-mode="${k}" aria-pressed="${mode === k}">${esc(t(l))}</button>`;
  const paired = new Set(hit.pairs.map(([, p]) => p.id)), extra = hit.rows.filter((p) => !paired.has(p.id));
  const how = mode === "replace" ? t("那次对上的 {a} 项改成这次的名称和金额（库存不再重复加）；这次多出的 {b} 项照常记", { a: hit.pairs.length, b: mine.length - hit.pairs.length })
      + (extra.length ? t("；那次还有 {c} 项这次没有，默认保留，要删的勾上：", { c: extra.length }) : "")
    : mode === "keep" ? t("两次都留：这张照常全部记一遍。")
    : t("是同一张小票就选「以这次为准」，会更正那次的金额，不会记两遍。");
  return `<p class="dup-hint">⚠ ${esc(head)}</p><div class="chips" role="group" aria-label="${esc(t("这张小票怎么处理"))}">${chip("replace", "以这次为准，更新那次")}${chip("keep", "不是同一张，两次都留")}</div><p class="muted rcpt-dup-how">${esc(how)}</p>${mode === "replace" && extra.length ? `<ul class="rcpt-dup-extra">${extra.map((p) => `<li><label class="check-inline"><input type="checkbox" data-drop-id="${esc(p.id)}" ${drop.has(p.id) ? "checked" : ""}><span>${t("删掉")}「${esc(p.name)}」<span class="muted">${esc(Units.money(num(p.amount)))}</span></span></label></li>`).join("")}</ul>` : ""}`;
}
/** 这张小票以前从银行对账单导成了一整笔：提醒，选「用这张小票替换它」（确认入库后删掉那一整笔）或「不是同一笔，都留」 */
function lumpHtml(lump, mode, total) {
  const chip = (k, l) => `<button type="button" class="chip" data-action="scan-lumpmode" data-mode="${k}" aria-pressed="${mode === k}">${esc(t(l))}</button>`;
  const head = t("银行对账单里已经有一笔：{s} {d}，{a}（这张小票合计 {b}）", { s: lump.store || lump.name, d: fmtShort(lump.purchased_at), a: Units.money(num(lump.amount)), b: Units.money(total) });
  const how = mode === "replace" ? t("确认入库后，对账单里那一整笔会删掉，换成这张小票的明细，不会记两遍。") : mode === "keep" ? t("两边都留：整笔和明细都会算进花费（会重复）。") : t("是同一次消费就选「用这张小票替换它」。");
  return `<p class="dup-hint">⚠ ${esc(head)}</p><div class="chips" role="group" aria-label="${esc(t("对账单里的整笔怎么处理"))}">${chip("replace", "用这张小票替换它")}${chip("keep", "不是同一笔，都留")}</div><p class="muted rcpt-dup-how">${esc(how)}</p>`;
}
/** 每一行和已有花费对一下：疑似别人（或自己）已经记过的，在行下面提醒；返回「勾选了的小票里被提醒的行数」。
 *  已有花费按 日期 + 金额 向数据库查（dup-check.js 的缓存）；还没查过的先按没有算，查回来再标一遍。
 *  整张小票像是录过的（box._rcptDup，11-14：逐行金额差几分也能认出来）在小票上方提醒；选过怎么处理之后，逐行提醒就不再出 */
export function markDups(box) {
  loadNear(dupCands(box)).then((fresh) => { if (fresh && box.isConnected) markDups(box); }).catch(() => {});
  const store = box.querySelector('[name="store"]').value, date = box.querySelector('[name="date"]').value || todayISO();
  const rc = sc.result?.receipts[+box.dataset.r], mine = boxRows(box), hit = sameReceipt({ store, day: date, rows: mine });
  if (rc && !hit) rc.dupMode = "";
  const mode = hit ? rc?.dupMode || "" : "", banner = box.querySelector(".rcpt-dup");
  box._rcptDup = hit;
  {   // 对账单里的整笔
    const total = mine.reduce((s, r) => s + num(r.amount), 0), lump = sameLump({ store, day: date, total, card: purchasePayFields(box.querySelector('[name="pay"]')?.value || "").card_id || "" });
    if (rc && !lump) rc.lumpMode = "";
    box._lump = lump; const lb = box.querySelector(".rcpt-lump");
    if (lb) { const html = lump ? lumpHtml(lump, rc?.lumpMode || "", total) : ""; if (lb.dataset.html !== html) { lb.innerHTML = html; lb.dataset.html = html; } lb.hidden = !lump; }
  }
  if (banner) { const html = hit ? rcptDupHtml(hit, mode, mine, rc?.dropSel) : ""; if (banner.dataset.html !== html) { banner.innerHTML = html; banner.dataset.html = html; } banner.hidden = !hit; }
  let n = 0; const taken = new Set();
  box.querySelectorAll(".scan-row").forEach((r) => {
    const g = (k) => r.querySelector(`[name="${k}"]`).value, hint = r.querySelector(".dup-hint");
    const list = g("amount") === "" || mode || r.classList.contains("scan-fee-row") ? [] : similarPurchases({ name: g("name"), amount: num(g("amount")), store, at: new Date(`${date}T12:00:00`) }, box._lump ? new Set([box._lump.id]) : new Set());   // 对账单里的整笔已经在小票上方单独提醒过，行级不再重复提醒
    hint.innerHTML = dupNote(list); hint.hidden = !list.length;
    const cart = r.querySelector(".cart-hint"), tg = g("target"), sh = mode === "replace" ? null : matchOpenShopping({ name: g("name"), item_id: tg.startsWith("__") ? null : tg, at: new Date(`${date}T12:00:00`) }, taken);
    if (sh && r.querySelector('[name="inc"]').checked) taken.add(sh.id);
    cart.textContent = sh ? "🛒 " + t("购物车里的「{n}」会标成已买到", { n: sh.name }) : ""; cart.hidden = !sh;
    if (list.length && r.querySelector('[name="inc"]').checked) n++;
  });
  return n;
}
export function updateSum() {
  const f = $("#scanForm"), el = $("#scanSum"); if (!f || !el || !sc.result) return;
  let all = 0, rn = 0, rows = 0;
  f.querySelectorAll(".scan-rcpt").forEach((box) => {
    const ri = +box.dataset.r, on = box.querySelector('[name="rinc"]')?.checked !== false;
    markDups(box);
    const sel = [...box.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked);
    const sum = sel.reduce((s, r) => s + num(r.querySelector('[name="amount"]').value), 0), tot = sc.result.receipts[ri]?.total;
    box.querySelector(".scan-rsum").textContent = t("选中 {n} 项，合计 {m}", { n: sel.length, m: Units.money(sum) })
      + (tot != null ? (Math.abs(tot - sum) > 0.05 ? t("；小票合计 {m}，和选中的合计相差 {d}（可能漏了商品，或还要加一行税费）", { m: Units.money(tot), d: Units.money(Math.abs(Math.round((tot - sum) * 100) / 100)) }) : t("；与小票合计一致")) : "");
    if (on) { all += sum; rn++; rows += sel.length; }
  });
  el.textContent = sc.result.receipts.length > 1 ? t("共 {r} 张小票、{n} 项，合计 {m}", { r: rn, n: rows, m: Units.money(all) }) : "";
}
