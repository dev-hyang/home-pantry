/* 录入购物：交互（文件、文字、行内联动）。 */
import { $, catOf, fmt, num, spaceOf, toast, todayISO } from "../core/util.js";
import { FEES_CAT, normalize, parseJson, scanPrompt, unitNote } from "./scan-parse.js";
import { Store } from "../core/store.js";
import { aiReady, askText } from "../core/ai.js";
import { blankRow, dupCands, markDups, startManual, updateSum } from "./scan-page.js";
import { findItem, normName, similarItems } from "../core/item-match.js";
import { href } from "../core/router.js";
import { loadNear, matchOpenShopping, pairRows } from "../stats/dup-check.js";
import { spendChanged } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { MAX_IMAGES, repaint, resetScan, sc, subGuess } from "./scan-common.js";
import { revealInto } from "../core/reveal.js";
import { compressImage as compress } from "../core/autofill-common.js";
import { purchasePayFields } from "../bills/card-picker.js";
import { myName } from "../settings/family-lite.js";
import { cleanStore, rememberStore } from "../stats/store-lite.js";

/* ───────────── 交互：文件、文字、行内联动 ───────────── */
const RECORD_HINTS = { both: "识别出的东西加进库存，同时记花费（默认）", spend: "不入库，只把花费记下来", stock: "只加库存，不记花费" };
/** 手动添加：「记到哪里」和表单里每一行联动——只记花费：「放进库存」固定成「只记花费，不入库」并变灰；只入库：不能选「只记花费」，「金额」变灰（不记花费）；入库 + 花费：都能改。不重画，已填的内容不丢 */
function syncRecordLink() {
  const spend = sc.record === "spend", stock = sc.record === "stock";
  document.querySelectorAll("#scanForm .scan-row:not(.scan-fee-row)").forEach((row) => {
    const tg = row.querySelector('[name="target"]'), am = row.querySelector('[name="amount"]'); if (!tg) return;
    row.classList.toggle("link-spend", spend); row.classList.toggle("link-stock", stock);
    const skip = [...tg.options].find((o) => o.value === "__skip"); if (skip) skip.disabled = stock;
    if (spend) { tg.value = "__skip"; tg.disabled = true; }
    else { if (tg.disabled) tg.value = tg.dataset.def || "__new"; tg.disabled = false; if (stock && tg.value === "__skip") tg.value = "__new"; }
    if (am) am.disabled = stock;
    row.classList.toggle("is-new", tg.value === "__new");
    tg.dispatchEvent(new Event("change"));   // 触屏上的选择按钮跟着变（不冒泡，不触发页面的联动）
    const box = tg._ssel; if (box) { const inp = box.querySelector(".ssel-in"); inp.value = tg.selectedOptions[0]?.textContent.trim() || ""; inp.disabled = tg.disabled; }   // 电脑上的可搜索下拉：文字和灰掉状态跟着变
    if (tg._sheetBtn) tg._sheetBtn.disabled = tg.disabled;
  });
  updateSum?.();
}
/** 一步一步展开：点（聚焦）上一步的下拉就露出下一步；不重画页面，下拉不会被收起 */
function revealStep(n) {
  sc.stage = Math.max(sc.stage || 1, n);
  const fresh = [...document.querySelectorAll(".scan-page .scan-step[hidden]")].filter((el) => +el.dataset.step <= sc.stage);
  fresh.forEach((el) => { el.hidden = false; });
  if (fresh.length) revealInto(fresh.at(-1));   // 新露出来的那一块自动滚到屏幕中间
}
document.addEventListener("focusin", (e) => {
  if (e.target.id === "scanKindSel") revealStep(2);
  else if (e.target.id === "scanRecordSel") revealStep(3);
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "scanRecordSel") {   // 记到哪里：只改记录，不重画（输入框里的内容不丢）；顺带展开下一步
    sc.record = e.target.value; revealStep(3);
    const h = document.querySelector(".scan-record-hint"); if (h) h.textContent = t(RECORD_HINTS[sc.record] || "");
    if (sc.result?.manual) syncRecordLink();
    return;
  }
  if (e.target.id === "scanKindSel") {   // 录入方式下拉：手动添加直接进确认表；小票 / 订单留在这页，展开下一步
    const k = e.target.value; sc.error = ""; sc.stage = Math.max(sc.stage || 1, 2);
    if (k === "manual") { sc.record = "stock"; startManual(); return repaint(); }   // 手动添加：记到哪里默认「只入库」
    sc.kind = k; sc.record = "both"; if (sc.result?.manual) { sc.step = "input"; sc.result = null; }
    return repaint();
  }
  if (e.target.id === "scanFile") {
    const files = [...e.target.files].slice(0, MAX_IMAGES - sc.images.length); e.target.value = "";
    sc.error = "";
    for (const f of files) { try { sc.images.push(await compress(f)); } catch { sc.error = t("这张图读不了，换一张（JPG / PNG）。"); } }
    repaint(); return;
  }
  const row = e.target.closest?.(".scan-row");
  if (row && e.target.name === "target") { row.classList.toggle("is-new", e.target.value === "__new"); if (e.isTrusted) e.target.dataset.touched = "1"; }
  if (row && e.target.name === "target" && sc.result?.manual) {   // 手动添加：选了库存里的物品，名称、单位、分类跟着填；选「新建物品」不动，自己写
    const it = state.items.find((i) => i.id === e.target.value);
    if (it) { row.querySelector('[name="name"]').value = it.name; row.querySelector('[name="unit"]').value = t(it.unit || ""); const c = row.querySelector('[name="cat"]'); if (c && it.category) c.value = it.category; }
  }
  if (row && (e.target.name === "target" || e.target.name === "unit")) unitNote(row);
  if (e.target.name === "date" && e.target.closest?.("#scanForm")) {   // 改了某张小票的购买日期：它没手动选过的行，过去的日期 → 只记花费，今天 → 回到原来的默认
    const past = sc.record === "spend", box = e.target.closest(".scan-rcpt");
    box.querySelectorAll(".scan-row").forEach((r) => {
      const sel = r.querySelector('[name="target"]'); if (sel.dataset.touched === "1" || r.classList.contains("scan-fee-row")) return;
      sel.value = past ? "__skip" : (sel.dataset.def || "__new"); r.classList.toggle("is-new", sel.value === "__new");
    });
    const note = box.querySelector(".scan-past"); if (note) note.hidden = !(past && e.target.value < todayISO());
  }
  if (e.target.dataset?.dropId) {   // 那次多出来的行：勾上才删
    const rc = sc.result?.receipts[+e.target.closest(".scan-rcpt").dataset.r]; if (!rc) return;
    rc.dropSel ||= new Set(); if (e.target.checked) rc.dropSel.add(e.target.dataset.dropId); else rc.dropSel.delete(e.target.dataset.dropId);
    return updateSum();
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
/** 读表单里的每一行，写库存 + 采购花费；已有物品按单位换算，匹配到的购物车项顺手标成已买到 */
async function confirm(ctx) {
  const f = $("#scanForm"); if (!f) return;
  const cur = Units.region.currency, boxes = [...f.querySelectorAll(".scan-rcpt")].filter((b) => b.querySelector('[name="rinc"]')?.checked !== false);
  const rows = boxes.flatMap((box, bi) => {
    const store = cleanStore(box.querySelector('[name="store"]').value), date = box.querySelector('[name="date"]').value || todayISO(), now = new Date(`${date}T12:00:00`).toISOString();
    const pay = purchasePayFields(box.querySelector('[name="pay"]')?.value || "");   // 这张小票怎么付的：卡 → card_id，现金 / 支票 / 礼品卡 → method
    return [...box.querySelectorAll(".scan-row")].filter((r) => r.querySelector('[name="inc"]').checked).map((r) => {
      const g = (n) => r.querySelector(`[name="${n}"]`).value;
      const nm = g("name").trim(), same = g("target") === "__new" ? findItem(nm, { spaces: ["pantry", "house"] }) : null;   // 「新建」但库存里已有写法一样的：补到那件，不建第二件
      return { bi, store, now, pay, name: nm, qty: num(g("qty"), 0), unit: Units.normalize(g("unit")) || "个", amount: g("amount") === "" ? null : Math.round(num(g("amount")) * 100) / 100,   /* 负数 = 退货 / 整单优惠（11-14：以前被截成 0） */ target: same ? same.id : g("target"), cat: g("cat"), fee: r.classList.contains("scan-fee-row") };
    });
  });
  if (!rows.length) { sc.error = t("没有勾选任何一行。"); return repaint2(); }
  if (rows.some((x) => !x.name)) { sc.error = t("有一行没有名称。"); return repaint2(); }
  if (rows.some((x) => x.target !== "__skip" && !x.qty)) { sc.error = t("入库的行数量不能是 0。"); return repaint2(); }
  if (rows.some((x) => x.target !== "__skip" && x.qty < 0 && x.target === "__new")) { sc.error = t("退货（数量为负）要选一件已有的物品来扣库存；没有对应的物品就选「只记花费，不入库」。"); return repaint2(); }
  await loadNear(boxes.flatMap(dupCands)).catch(() => {});   // 先把这几张小票的日期 + 金额查完，提醒才是准的
  const stockOnly = sc.record === "stock";   // 只入库：不写花费，所以也不查「是不是已经记过」
  const dupRows = stockOnly ? 0 : boxes.reduce((s, b) => s + markDups(b), 0);   // 疑似重复的行：第一次点只提醒，确认无误再点一次才入库
  if (!stockOnly && boxes.some((b) => b._rcptDup && !sc.result.receipts[+b.dataset.r]?.dupMode)) { sc.error = t("有小票可能已经录过（见小票上方的提醒）：先选「以这次为准，更新那次」还是「不是同一张，两次都留」。"); return repaint2(); }
  if (!stockOnly && boxes.some((b) => b._lump && !sc.result.receipts[+b.dataset.r]?.lumpMode)) { sc.error = t("银行对账单里已经有对得上的一整笔（见小票上方的提醒）：先选「用这张小票替换它」还是「不是同一笔，都留」。"); return repaint2(); }
  const lumpIds = stockOnly ? [] : [...new Set(boxes.filter((b) => b._lump && sc.result.receipts[+b.dataset.r]?.lumpMode === "replace").map((b) => b._lump.id))];
  // 以这次为准：这张小票的行和那次的配对，配上的改那次的那一笔（不再记新花费、不再加库存），那次多出来的删掉
  const dropIds = [];
  if (!stockOnly) boxes.forEach((b, bi) => {
    const hit = b._rcptDup; if (!hit || sc.result.receipts[+b.dataset.r]?.dupMode !== "replace") return;
    const mine = rows.filter((x) => x.bi === bi), pairs = pairRows(mine, hit.rows), paired = new Set(pairs.map(([, p]) => p.id));
    for (const [i, p] of pairs) mine[i].replace = p;
    const sel = sc.result.receipts[+b.dataset.r]?.dropSel || new Set();   // 那次多出来的：只删勾上的
    dropIds.push(...hit.rows.filter((p) => !paired.has(p.id) && sel.has(p.id)).map((p) => p.id));
  });
  if (dupRows && !sc.dupAck) { sc.dupAck = true; sc.error = t("有 {n} 行疑似已经记过（见各行下面的提醒）。确认不是重复的，再点一次“确认入库”；是重复的就取消勾选那一行。", { n: dupRows }); return repaint2(); }
  sc.dupAck = false; sc.busy = true; sc.error = ""; repaint2();
  let stocked = 0, spendOnly = 0, created = 0, cartDone = 0, fixed = 0; const warns = [], convs = [], newItems = new Map(), doneShop = new Set();
  try {
    // 先建新物品（同名同分类合并成一条，几张小票的也合并）：这一步失败时还没写任何花费和库存，可以直接重试
    for (const x of rows.filter((r) => r.target === "__new" && !r.replace)) {
      const key = normName(x.name), ex = newItems.get(key);   // 几行同名（不管分类）合成一件
      if (ex) ex.quantity = Math.round((ex.quantity + x.qty) * 100) / 100;
      else newItems.set(key, { name: x.name.slice(0, 60), category: x.cat, subcategory: subGuess(x.name, x.cat), unit: x.unit, quantity: Math.round(x.qty * 100) / 100, min_quantity: 0,
        location: catOf(x.cat).loc || null, expiry_date: null, lead_days: spaceOf(x.cat) === "house" ? 14 : spaceOf(x.cat) === "gear" ? 0 : 3, avg_daily_use: null, notes: null });
    }
    if (newItems.size) { await Store.addItems([...newItems.values()]); created = newItems.size; }
    for (const x of rows) {
      if (x.replace) {   // 更正那次录的这一笔：库存那次已经加过，这里只改花费
        await Store.updatePurchase(x.replace.id, { name: x.name, quantity: x.qty || null, unit: x.unit || null, amount: x.amount, purchased_at: x.now, ...(x.store ? { store: x.store } : {}), ...x.pay });
        fixed++; continue;
      }
      if (stockOnly && x.target === "__skip") continue;   // 只入库：选了「只记花费」的行什么都不做
      const item = x.target.startsWith("__") ? null : state.items.find((i) => i.id === x.target);
      if (!stockOnly) await Store.addPurchase({ item_id: item?.id || null, name: x.name, category: x.fee ? FEES_CAT : item?.category || (x.target === "__new" ? x.cat : "other"), quantity: x.qty || null, unit: x.unit || null, amount: x.amount, currency: cur, purchased_at: x.now, store: x.store, ...x.pay });
      const cart = x.fee || x.qty < 0 ? null : matchOpenShopping({ name: x.name, item_id: item?.id, at: x.now }, doneShop);   // 购物车里对应的那一项：不管入不入库，买到了就标成已买到
      if (cart) { doneShop.add(cart.id); cartDone++; await Store.saveShopping({ id: cart.id, status: "bought", bought_at: x.now, amount: x.amount, claimed_by_name: cart.claimed_by_name || myName() }); }
      if (x.target === "__skip") { spendOnly++; continue; }
      if (item && normName(x.name) !== normName(item.name) && !findItem(x.name)) Store.addItemAlias(item.id, x.name.slice(0, 60)).catch(() => {});   // 学会这个叫法
      if (item) {
        const fit = Units.fit(x.unit, item.unit), add = fit.kind === "mismatch" ? x.qty : x.qty * fit.factor;   // 能换算的换成库存单位；计数单位之间 1:1
        if (fit.kind === "mismatch") warns.push(x.name);
        else if (fit.kind === "convert") convs.push(t("{name} {q1} {u1} → {q2} {u2}", { name: item.name, q1: fmt(x.qty), u1: t(x.unit), q2: fmt(Math.round(add * 100) / 100), u2: t(item.unit) }));
        await Store.adjust(item.id, Math.round(add * 100) / 100, add < 0 ? "adjust" : "restock");   // 退货扣库存（记成「调整」，不算补货）
        stocked++;
      }
    }
    if (dropIds.length) await Store.deletePurchases(dropIds);
    if (lumpIds.length) await Store.deletePurchases(lumpIds);   // 用小票替换了对账单里的整笔
    if (fixed || dropIds.length || lumpIds.length) spendChanged();
    for (const s of new Set(rows.map((x) => x.store).filter(Boolean))) rememberStore(s);
    toast((boxes.length > 1 ? t("已录入 {r} 张小票：", { r: boxes.length }) : t("已录入：")) + t("入库 {a} 项，新建 {b} 项，只记花费 {c} 项", { a: stocked, b: created, c: spendOnly }) + (fixed ? t("；更正了之前录的 {n} 项", { n: fixed }) : "") + (dropIds.length ? t("，删掉 {m} 项", { m: dropIds.length }) : "") + (cartDone ? t("；购物车 {n} 项已标成已买到", { n: cartDone }) : "") + (convs.length ? t("；已换算单位：{list}", { list: convs.join("、") }) : "") + (warns.length ? t("；{names} 的单位无法换算，按原数字记入了，请核对库存", { names: warns.join("、") }) : ""));
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
    case "scan-skip-photo": sc.stage = 4; sc.skipPhoto = true; repaint(); return revealInto(document.querySelector('.scan-page .scan-step[data-step="4"]'));   // 没有照片：直接到文字 + 识别
    case "scan-add-fee": {   // 加一行税费：金额先填成「小票合计 − 现在各行合计」（读到了合计才有），可以改
      repaint2(); const rc = sc.result?.receipts[+el.dataset.r]; if (!rc) return;
      const have = rc.rows.reduce((s, x) => s + (x.include ? num(x.amount, 0) : 0), 0), gap = rc.total == null ? null : Math.round((rc.total - have) * 100) / 100;
      rc.rows.push({ include: true, fee: "other", raw: "", name: t("税费"), qty: "", unit: "", amount: gap > 0 ? gap : null, def: "", match: "skip", category: FEES_CAT, order: false });
      repaint(); updateSum(); const last = [...document.querySelectorAll(`.scan-rcpt[data-r="${+el.dataset.r}"] .scan-fee-row [name="name"]`)].pop(); last?.focus(); return;
    }
    case "scan-img-del": sc.images.splice(+el.dataset.i, 1); return repaint();
    case "scan-run": return run();
    case "scan-back": if (sc.result?.manual) { startManual(); return repaint(); } sc.step = "input"; sc.result = null; sc.error = ""; return repaint();
    case "scan-confirm": return confirm(ctx);
    case "scan-lumpmode": { const box = el.closest(".scan-rcpt"), rc = box && sc.result?.receipts[+box.dataset.r]; if (!rc) return; rc.lumpMode = rc.lumpMode === el.dataset.mode ? "" : el.dataset.mode; sc.error = ""; document.querySelector('#scanForm > p.form-error[role="alert"]')?.remove(); updateSum(); return; }
    case "scan-dupmode": { const box = el.closest(".scan-rcpt"), rc = box && sc.result?.receipts[+box.dataset.r]; if (!rc) return; rc.dupMode = rc.dupMode === el.dataset.mode ? "" : el.dataset.mode; sc.error = ""; document.querySelector('#scanForm > p.form-error[role="alert"]')?.remove(); updateSum(); return; }
    default: return undefined;
  }
}
