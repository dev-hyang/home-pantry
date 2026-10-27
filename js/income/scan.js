/* 收入 · 拍照 / 粘贴识别：支票、工资条、电汇确认单、Zelle / Venmo 截图、退税通知、存款回执 → AI 读成收入草稿 → 你逐条核对后才保存。
 * 和「拍小票识别花费」同一套做法（拍 / 选图 + 补充文字 → AI → 核对 → 入库），区别：收入是高度隐私的数据，
 * 所以发给 AI 之前要勾选同意（默认不勾），不保存原图，识别出来的先是草稿，和已有收入对得上的默认不勾（防重复）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, num, todayISO, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { aiReady, aiSettings, askText, providerOf, visionCapable } from "../core/ai.js";
import { compressImage } from "../core/autofill.js";
import { CHANNELS, adults, guessChannel, guessKind, inc, kindList, loadIncome, myPersonId, similarIncome } from "./logic.js";

const MAX_IMAGES = 4, CONSENT = "hmh-income-scan-ok";
const sc = { images: [], text: "", busy: false, error: "", items: null, who: null };
const consent = () => { try { return localStorage.getItem(CONSENT) === "1"; } catch { return false; } };
const cur = () => Units.region.currency;
let render = () => {}, askFn = askText;   // askFn：测试时可替换
export const _setScanAsk = (fn) => { askFn = fn || askText; };
export const resetIncomeScan = () => Object.assign(sc, { images: [], text: "", busy: false, error: "", items: null, who: null });

function parseJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(clean); } catch { /* 再试截取 */ }
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1));
  throw new Error(t("没能读出收入，换一张更清楚的图或补充文字再试。"));
}
const prompt = () => ({
  system: `You extract MONEY-IN records (income received) from photos or text of: bank deposit slips, checks, pay stubs (use NET pay actually deposited, never gross), wire transfer confirmations, Zelle / Venmo / PayPal screenshots, tax refund notices, bank statement lines that show credits. Ignore money going OUT. Never output account numbers, SSNs or addresses. Reply with ONLY JSON: {"items":[{"date":"YYYY-MM-DD or empty string","amount":number received (positive),"currency":"3-letter code of the amount shown","sender":"who paid: employer / person / institution","kind":one of [${kindList().map((k) => k.id).join(",")}],"channel":one of [ach,wire,zelle,check,cash,other],"orig_amount":number or null (original foreign amount for international wires),"orig_currency":"3-letter code or empty","fee":number or null,"notes":"very short, optional"}]}. Kinds: payroll = salary / pay stub, bonus, package = compensation or benefits package, wire = international wire, zelle = person-to-person payment, interest, rental, tax_refund, reimburse, insurance, gift, sale, cashback, other. If nothing is income, return {"items":[]}.`,
  user: `Today is ${todayISO()}. The household currency is ${cur()}.${sc.text.trim() ? `\nText provided by the user:\n${sc.text.trim()}` : ""}${sc.images.length ? `\n${sc.images.length} image(s) attached.` : ""}`,
});
/** AI 读出来的 → 草稿行：金额 / 日期 / 类型都校验一遍；币种不是家庭货币的，原币种记下来，金额留给你按实际到账改 */
function toDraft(x) {
  const amount = Math.abs(num(x.amount)), date = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || "")) ? x.date : todayISO(), sender = String(x.sender || "").trim().slice(0, 80);
  const ids = kindList().map((k) => k.id), kind = ids.includes(x.kind) ? x.kind : guessKind(`${sender} ${x.notes || ""}`);
  const fx = x.currency && String(x.currency).toUpperCase() !== cur();
  const d = { date, amount: amount || "", sender, kind, channel: CHANNELS.some((c) => c[0] === x.channel) ? x.channel : guessChannel(sender), fx: !!fx, noDate: !x.date,
    orig_amount: fx ? amount : num(x.orig_amount) > 0 ? num(x.orig_amount) : null, orig_currency: fx ? String(x.currency).toUpperCase() : x.orig_currency ? String(x.orig_currency).toUpperCase().slice(0, 3) : null, fee: x.fee == null ? null : num(x.fee), notes: String(x.notes || "").slice(0, 200) };
  if (fx) d.amount = "";   // 按实际到账的家庭货币金额填
  d.dup = amount && !fx ? similarIncome({ received_on: date, amount, source_name: sender }) : null; d.on = !d.dup && !!d.amount;
  return d;
}

export function scanHtml() {
  const ready = aiReady(), p = providerOf(aiSettings().provider), canImg = visionCapable(), ok = consent();
  if (sc.items) return resultHtml();
  return `<div class="panel scan-in" id="incScan"><h3 style="margin:0 0 6px">📷 ${t("拍照识别收入")}</h3>
    <p class="muted small" style="margin:0 0 8px">${t("支票、工资条、电汇确认单、Zelle / Venmo 截图、退税通知、存款回执都行。识别出来先是草稿，你核对后才保存。")}</p>
    ${ready ? "" : `<div class="notice" role="status">${t("需要先在 设置 → AI 助手 填 key（Gemini 有免费额度）。")}</div>`}
    <div class="scan-thumbs">
      ${sc.images.map((im, i) => `<span class="scan-thumb"><img src="${im.url}" alt="${t("第 {n} 张", { n: i + 1 })}"><button type="button" data-sc="img-del" data-i="${i}" aria-label="${t("删除这张")}">×</button></span>`).join("")}
      ${sc.images.length < MAX_IMAGES ? `<label class="scan-add ${canImg ? "" : "is-off"}"><input type="file" id="incScanFile" accept="image/*" multiple ${canImg ? "" : "disabled"}><span>📷 ${t("拍照 / 选图")}</span></label>` : ""}</div>
    ${canImg ? "" : `<p class="form-error" style="margin:6px 0 0">${t("当前的 {p} 不能读图片：换成 Gemini（设置 → AI 助手），或只粘贴文字。", { p: t(p.name) })}</p>`}
    <label class="scan-text">${t("或粘贴文字（电汇确认邮件、银行入账通知、Zelle 邮件）")}<textarea id="incScanText" rows="4" maxlength="8000">${esc(sc.text)}</textarea></label>
    <p class="muted small" style="margin:8px 0 0">${t("图片和文字会发给你在设置里选的 {p}，不会保存原图。拍之前请遮住账号、社保号、地址。", { p: t(p.name) })}</p>
    <label class="check-inline" style="margin-top:6px"><input type="checkbox" data-sc="consent" ${ok ? "checked" : ""}><span>${t("我同意把这些图片 / 文字发给 AI 服务商（收入是隐私数据）")}</span></label>
    ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
    <div class="form-actions"><button type="button" class="btn btn-primary" data-sc="run" ${!ready || !ok || sc.busy || (!sc.images.length && !sc.text.trim()) ? "disabled" : ""}>${sc.busy ? t("正在识别…（几十秒）") : t("识别")}</button><button type="button" class="btn btn-ghost" data-sc="close">${t("取消")}</button></div></div>`;
}
function resultHtml() {
  const who = sc.who ?? (myPersonId() || "none"), n = sc.items.filter((x) => x.on).length;
  const row = (x, i) => `<li class="ix-draft" data-i="${i}"><label class="check-inline"><input type="checkbox" data-sc-f="on" ${x.on ? "checked" : ""} aria-label="${esc(t("保存这条"))}"><span><b>${esc(x.sender || t("（没读出付款方）"))}</b></span></label>
    <div class="form-grid"><label>${t("到账日期")}<input type="date" data-sc-f="date" value="${esc(x.date)}"></label>
      <label>${t("到账金额")}（${esc(cur())}）<input type="number" data-sc-f="amount" step="0.01" min="0" inputmode="decimal" value="${esc(x.amount)}"></label>
      <label>${t("谁给的")}<input data-sc-f="sender" maxlength="80" value="${esc(x.sender)}"></label>
      <label>${t("类型")}<select data-sc-f="kind">${kindList().map((k) => `<option value="${k.id}" ${x.kind === k.id ? "selected" : ""}>${k.icon} ${esc(t(k.name))}</option>`).join("")}</select></label></div>
    ${x.fx ? `<small class="bank-dup">${t("原金额 {a} {c}：请把到账金额改成实际收到的 {cur} 金额", { a: x.orig_amount, c: x.orig_currency, cur: cur() })}</small>` : ""}
    ${x.dup ? `<small class="bank-dup">${t("看起来已经记过：{d} · {n}，默认没勾", { d: x.dup.received_on, n: x.dup.source_name })}</small>` : ""}
    ${x.noDate ? `<small class="muted">${t("没读出日期，先填了今天，请核对")}</small>` : ""}</li>`;
  return `<div class="panel" id="incScan"><h3 style="margin:0 0 6px">📷 ${t("核对识别结果")}</h3>
    ${sc.items.length ? `<ul class="ix-drafts">${sc.items.map(row).join("")}</ul>
      <label class="tb-field" style="margin:8px 0"><span>${t("这些收入记给谁")}</span><select data-sc="who" data-nosearch><option value="none" ${who === "none" ? "selected" : ""}>${t("未指定 / 全家")}</option>${adults().map((p) => `<option value="${p.id}" ${who === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`
      : `<p class="muted">${t("没有读出收入。换一张更清楚的图，或补充文字再试。")}</p>`}
    ${sc.error ? `<p class="form-error" role="alert">${esc(sc.error)}</p>` : ""}
    <div class="form-actions">${sc.items.length ? `<button type="button" class="btn btn-primary" data-sc="save" ${n && !sc.busy ? "" : "disabled"}>${sc.busy ? t("保存中…") : t("保存 {n} 条", { n })}</button>` : ""}<button type="button" class="btn btn-ghost" data-sc="back">${t("重新识别")}</button><button type="button" class="btn btn-ghost" data-sc="close">${t("取消")}</button></div></div>`;
}

async function run() {
  if (sc.busy || !consent()) return;
  sc.busy = true; sc.error = ""; render();
  try {
    const { system, user } = prompt(), res = parseJson(await askFn(system, user, { json: true, maxTokens: 1500, temperature: 0.1, images: sc.images }));
    const items = (Array.isArray(res) ? res : res.items || []).map(toDraft).filter((x) => x.amount || x.fx || x.sender);
    sc.items = items;
  } catch (e) { sc.error = e.message || String(e); }
  sc.busy = false; render();
}
async function save() {
  const picked = sc.items.filter((x) => x.on && num(x.amount) > 0 && x.sender.trim());
  if (!picked.length || sc.busy) return;
  sc.busy = true; render();
  try {
    const who = sc.who ?? (myPersonId() || "none");
    await Store.addIncomeRecords(picked.map((x) => ({ received_on: x.date, amount: Math.round(num(x.amount) * 100) / 100, currency: cur(), orig_amount: x.orig_amount, orig_currency: x.orig_currency, fee: x.fee,
      source_name: x.sender.trim(), kind: x.kind, channel: x.channel, person_id: who === "none" ? null : who, account: null, import_batch: null, repay_required: false, repay_due_on: null, repay_amount: null, notes: x.notes || null })));
    await loadIncome(); inc().scanOpen = false; resetIncomeScan(); toast(t("已记了 {n} 笔收入", { n: picked.length }));
  } catch (e) { sc.error = t("保存失败：{msg}", { msg: e.message }); sc.busy = false; }
  sc.busy = false; render();
}

export function initIncomeScan({ render: r }) {
  render = () => r(false);
  const main = document.getElementById("main");
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-sc]"); if (!b || b.tagName === "SELECT" || b.type === "checkbox") return;
    const act = b.dataset.sc;
    if (act === "img-del") { sc.images.splice(+b.dataset.i, 1); return render(); }
    if (act === "run") return run();
    if (act === "save") return save();
    if (act === "back") { sc.items = null; return render(); }
    if (act === "close") { inc().scanOpen = false; resetIncomeScan(); return render(); }
  });
  main.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.id === "incScanFile") {
      const files = [...el.files].slice(0, MAX_IMAGES - sc.images.length); el.value = ""; sc.error = "";
      for (const f of files) { try { sc.images.push(await compressImage(f)); } catch { sc.error = t("这张图读不了，换一张（JPG / PNG）。"); } }
      return render();
    }
    if (el.dataset?.sc === "consent") { try { localStorage.setItem(CONSENT, el.checked ? "1" : "0"); } catch { /* 忽略 */ } return render(); }
    if (el.dataset?.sc === "who") { sc.who = el.value; return; }
    const li = el.closest?.(".ix-draft"), f = el.dataset?.scF;
    if (li && f) {
      const x = sc.items[+li.dataset.i]; if (!x) return;
      x[f] = el.type === "checkbox" ? el.checked : el.value;
      if (f === "amount" || f === "date" || f === "sender") { x.fx = x.fx && !num(x.amount); const a = num(x.amount); x.dup = a > 0 ? similarIncome({ received_on: x.date, amount: a, source_name: x.sender }) : null; }
      render();
    }
  });
  main.addEventListener("input", (e) => { if (e.target.id === "incScanText") { sc.text = e.target.value; const b = main.querySelector('[data-sc="run"]'); if (b) b.disabled = !aiReady() || !consent() || sc.busy || (!sc.images.length && !sc.text.trim()); } });
}
