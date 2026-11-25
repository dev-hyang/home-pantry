/* 税务 → 买卖与成本基础：用 Closing Disclosure（买房交割单）自动填（可选；不想用就在下面一项一项手填）。
 * 流程：拍 / 截图 Closing Disclosure → 发给你在设置里选的 AI 服务商（不保存）→ 读出买家付的每一项费用和各种 credit → 先给你核对（可取消勾选、改金额）→ 点「加进清单」才写进 ② 买入时付的费用 / ③ 退款 / credit。
 * AI 只做分类建议：能计入成本基础的（过户 / 律师 / 记录 / 转让税 / 产权保险…）勾上；房贷积分（可按利息扣除）、贷款相关费用、预付和 Escrow 不计入成本基础，只列出来给你看，不会加进去。
 * 不存任何证件号；图片不保存；只填你确认的，已有的清单不会被改。 */
import { numAttrs } from "../core/ui-num.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { aiReady, askText, visionCapable } from "../core/ai.js";
import { aiSettings, providerOf } from "../core/ai-common.js";
import { SYSTEM, compressImage, numOr, parseJson } from "../core/autofill-common.js";
import { render } from "../app/render.js";
import { propOf, saveProp } from "./tax-calendar.js";
import { ui } from "./tax-ui.js";
import { dupInfo, rowsOf } from "./tax-links-lib.js";

const money = (n) => Units.money(n);
const BUCKETS = ["basis", "points", "loan_cost", "prepaid_escrow", "other"];
const BUCKET_NAME = { points: "房贷积分（可按房贷利息扣除，逐项扣除才有用）", loan_cost: "贷款相关费用（不计入房子成本基础）", prepaid_escrow: "预付 / Escrow 存款（不计入成本基础）", other: "其他（需要你自己判断）" };
const SHAPE = { closing_date: "YYYY-MM-DD or null", sale_price: "number or null", lines: [{ desc: "short English or original label", amount: 0, bucket: "basis|points|loan_cost|prepaid_escrow|other" }], credits: [{ desc: "label", amount: 0, kind: "lender|seller|other" }] };

/** 房子卡片里的「自动填」条（有识别结果等核对时换成核对面板） */
export function closingBlock(p) {
  if (ui.cd?.id === p.id) return reviewPanel(p);
  const s = aiSettings(), pr = providerOf(s.provider), ready = aiReady(), canImg = visionCapable(pr);
  const off = !ready ? t("先在 设置 → AI 助手 填一个 key（推荐 Gemini，有免费额度）") : !canImg ? t("当前的 {p} 不能读图片，换成 Gemini 才能用", { p: t(pr.name) }) : "";
  return `<div class="af-bar tax-cd" data-af="closing"><label class="ui-btn af-btn ${off ? "is-off" : ""}" data-size="sm"><input type="file" accept="image/*" multiple data-tax-cd="${esc(p.id)}" ${off ? "disabled" : ""}><span>📷 ${t("用 Closing Disclosure 自动填（可选）")}</span></label>
    <span class="muted af-hint">${off ? `${esc(off)} · <a href="#/me/settings?sec=ai">${t("去设置")}</a>` : t("拍 / 截图 Closing Disclosure 的费用明细页（第 2、3 页）和第 1 页。不想用也行，下面可以一项一项手填。图片发给你选的 AI 服务商，不保存；识别结果先给你核对，再加进清单。")}</span>
    <div class="af-status" role="status" aria-live="polite"></div></div>`;
}

/** 识别出的一项和清单里已有的行比：金额相同才算对上（名字也像 = 很可能重复）。对上的默认不勾，勾上才加；标出对上的是哪一项 */
function dupMark(r, existing) {
  const d = dupInfo(r, existing); if (!d) return { on: true, note: "" };
  const who = `${esc(d.row.desc || "")} ${money(d.row.amount)}`;
  return { on: false, note: `<small class="tax-dup ${d.strong ? "is-strong" : ""}">${t(d.strong ? "很可能重复：清单里已有「{x}」；默认不添加，不是同一笔就勾上" : "金额相同：清单里已有「{x}」；默认不添加，不是同一笔就勾上", { x: who })}</small>` };
}
function reviewPanel(p) {
  const x0 = propOf(p.id), exBuy = rowsOf(x0, "buyItems", p.id), exCred = rowsOf(x0, "creditItems", p.id);
  const d = ui.cd.data, rows = (arr, kind) => arr.map((r, i) => { const m = dupMark(r, exCred); return `<li class="tax-cd-row"><label class="check-inline"><input type="checkbox" data-cd="${kind}" data-i="${i}" ${m.on ? "checked" : ""}><span>${esc(r.desc)}${m.note}</span></label><input ${numAttrs("money")} value="${r.amount}" data-cd-amt="${kind}:${i}" aria-label="${esc(t("金额"))}"></li>`; }).join("");
  const other = d.lines.filter((r) => r.bucket !== "basis");
  const basisRows = d.lines.map((r, i) => { if (r.bucket !== "basis") return ""; const m = dupMark(r, exBuy); return `<li class="tax-cd-row"><label class="check-inline"><input type="checkbox" data-cd="basis" data-i="${i}" ${m.on ? "checked" : ""}><span>${esc(r.desc)}${m.note}</span></label><input ${numAttrs("money")} value="${r.amount}" data-cd-amt="basis:${i}" aria-label="${esc(t("金额"))}"></li>`; }).join("");
  const dupN = [...d.lines.filter((r) => r.bucket === "basis").map((r) => dupInfo(r, exBuy)), ...d.credits.map((r) => dupInfo(r, exCred))].filter(Boolean).length;
  const groups = Object.entries(BUCKET_NAME).map(([b, name]) => { const ls = other.filter((r) => r.bucket === b); return ls.length ? `<p class="muted tax-wrap"><b>${esc(t(name))}</b><br>${ls.map((r) => `${esc(r.desc)} ${money(r.amount)}`).join(" · ")}</p>` : ""; }).join("");
  return `<section class="tax-step tax-cd-review"><h4>📋 ${t("AI 读到的（请核对）")}</h4>${dupN ? `<p class="hint">${t("有 {n} 项和清单里已有的金额对上了，默认没勾（不添加）。确实不是同一笔，再勾上。", { n: dupN })}</p>` : ""}
    <p class="muted tax-wrap">${d.closing_date ? t("成交日 {d}", { d: d.closing_date }) : t("没读到成交日")}${d.sale_price != null ? ` · ${t("成交价 {a}", { a: money(d.sale_price) })}${p.purchase_price == null ? ` · ${t("房屋记录里还没有买入价，去 房屋 → 交易 记上")}` : p.purchase_price !== d.sale_price ? ` · ${t("和房屋记录里的买入价 {a} 不一样，请核对", { a: money(p.purchase_price) })}` : ""}` : ""}</p>
    <h5>${t("加进 ② 买入时付的费用")}</h5>${basisRows ? `<ul class="tax-cd-list">${basisRows}</ul>` : `<p class="muted">${t("没有识别出可以计入成本基础的费用。")}</p>`}
    <h5>${t("加进 ③ 退款 / credit")}</h5>${d.credits.length ? `<ul class="tax-cd-list">${rows(d.credits, "credit")}</ul>` : `<p class="muted">${t("没有识别出 credit。")}</p>`}
    ${groups ? `<h5>${t("不会加进去的（只作参考）")}</h5>${groups}` : ""}
    <div class="tax-item-actions"><button type="button" class="ui-btn" data-size="sm" data-tone="primary" data-tax-cd-apply="${esc(p.id)}">${t("加进清单")}</button><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-tax-cd-discard>${t("放弃")}</button></div>
    <p class="hint">${t("AI 只是建议：哪些费用能计入成本基础请对着 Closing Disclosure 和 CPA 的意见确认。取消勾选的不会加。")}</p></section>`;
}

/** 识别结果整理：金额取数字、说明截短、分类只认认识的 */
function tidy(d) {
  const line = (r, bucket) => ({ desc: String(r?.desc || "").trim().slice(0, 60), amount: Math.abs(numOr(r?.amount) ?? 0), bucket });
  return { closing_date: /^\d{4}-\d{2}-\d{2}$/.test(d?.closing_date || "") ? d.closing_date : null, sale_price: numOr(d?.sale_price),
    lines: (d?.lines || []).map((r) => line(r, BUCKETS.includes(r?.bucket) ? r.bucket : "other")).filter((r) => r.desc && r.amount > 0),
    credits: (d?.credits || []).map((r) => line(r, "credit")).filter((r) => r.desc && r.amount > 0) };
}
async function run(input) {
  const id = input.dataset.taxCd, bar = input.closest(".af-bar"), files = [...input.files].slice(0, 6); input.value = "";
  if (!bar || !files.length) return;
  if (!window.confirm(t("Closing Disclosure 会发给你在设置里选的 AI 服务商来识别（含贷款和个人信息，不会保存）。要发送吗？"))) return;
  const status = bar.querySelector(".af-status"), say = (m, err = false) => { status.textContent = m; status.className = `af-status ${err ? "form-error" : ""}`; };
  say(t("正在识别…（几十秒）")); bar.classList.add("is-busy");
  try {
    const images = []; for (const f of files) images.push(await compressImage(f));
    const user = [
      "Photos / screenshots of a US mortgage CLOSING DISCLOSURE (CFPB TRID form) for a home PURCHASE. Extract what the BORROWER / BUYER paid.",
      "closing_date = closing date (page 1). sale_price = the Sale Price of Property / purchase price (page 1 or page 3 summaries), a number.",
      "lines = every itemised charge in Closing Cost Details (sections A-H) that the Borrower paid (column Borrower-Paid At Closing plus Before Closing). Skip seller-paid amounts, totals, the loan amount, the deposit / earnest money and cash-to-close figures.",
      "bucket for each line: basis = fees that are part of the cost of acquiring the property (title / settlement / closing / escrow-agent fees, attorney fees, survey, recording fees, transfer / stamp taxes, owner's title insurance); points = discount points and origination points; loan_cost = other loan-related fees (appraisal, credit report, underwriting, flood certification, lender's title insurance, upfront mortgage insurance); prepaid_escrow = prepaid interest, prepaid insurance, prepaid property tax, initial escrow deposits, HOA or tax prorations; other = anything else.",
      "credits = credits that REDUCE what the buyer pays: lender credits (section J), seller credits, other credits or adjustments paid to the buyer. Positive numbers. Do not include the earnest money deposit.",
      "Fill only what is clearly visible. Never return names, addresses, SSNs or account numbers. Return exactly: " + JSON.stringify(SHAPE),
    ].join("\n");
    const d = tidy(parseJson(await askText(SYSTEM, user, { json: true, images, temperature: 0.1, maxTokens: 2500 })));
    if (!d.lines.length && !d.credits.length) { say(t("没有识别到费用或 credit。换更清楚的图（费用明细页）再试，或者手填。"), true); return; }
    ui.cd = { id, data: d }; render(false);
  } catch (e) { say(e.message || String(e), true); }
  finally { bar.classList.remove("is-busy"); }
}
async function apply(btn) {
  const id = btn.dataset.taxCdApply, d = ui.cd?.data, panel = btn.closest(".tax-cd-review"); if (!d || !panel) return;
  const picked = (kind, src) => [...panel.querySelectorAll(`input[data-cd="${kind}"]:checked`)].map((c) => { const amt = Math.round((Number(panel.querySelector(`[data-cd-amt="${kind}:${c.dataset.i}"]`)?.value) || 0) * 100) / 100, r = src[+c.dataset.i]; return amt > 0 ? { desc: r.desc, amount: amt, ...(d.closing_date ? { on: d.closing_date } : {}) } : null; }).filter(Boolean);
  const buy = picked("basis", d.lines), cred = picked("credit", d.credits), x = propOf(id);
  ui.cd = null;
  await saveProp(id, { buyItems: [...(x.buyItems || []), ...buy], creditItems: [...(x.creditItems || []), ...cred] });
  render(false);
}
if (typeof document !== "undefined") {
  document.addEventListener("change", (e) => { if (e.target.matches?.("input[data-tax-cd]") && e.target.closest(".tax-page")) run(e.target); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("[data-tax-cd-apply]"), x = e.target.closest?.("[data-tax-cd-discard]");
    if (a && a.closest(".tax-page")) apply(a); else if (x && x.closest(".tax-page")) { ui.cd = null; render(false); }
  });
}
