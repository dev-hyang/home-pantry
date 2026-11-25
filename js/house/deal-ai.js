/* 交易信息页的「用文件自动填」：交易信息详情页上的按钮 → 选文件（购房合同 / Closing Disclosure / 结算单；车辆：购车协议）→ 发给 AI 服务商读（发之前先确认）
 * → 核对页（?sec=info-ai）：一项一项列「现有 → 读到的」，新的默认勾上、和现有不同的默认不勾 → 「写入所选」才保存。读取在 core/closing-ai.js。 */
import { aiStatus, lastRead, readDealDocs } from "../core/closing-ai.js";
import { buildPatch, fieldDiff } from "../core/closing-ai-lib.js";
import { applyDealAiPatch } from "./deal-actions.js";
import { dealHref, isVehDeal } from "./deal-tasks.js";
import { esc, fmtDate, money, num, toast } from "../core/util.js";
import { go } from "../core/router.js";
import { pricesOk } from "../core/finance-access.js";
import { refresh } from "../app/data.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

const DOC_NAME = { closing_disclosure: "Closing Disclosure", settlement_statement: "结算单", purchase_contract: "购房合同", bill_of_sale: "购车协议 / bill of sale", other: "文件" };
const show = (key, v) => (v == null || v === "" ? "—" : /_on$|_deadline$/.test(key) ? esc(fmtDate(v)) : ["price", "earnest_money"].includes(key) ? esc(money(num(v))) : key === "financing" ? esc(v === "cash" ? t("现金") : t("贷款")) : esc(String(v)));

/** 交易信息详情页上的按钮（没设 AI / 不能读图时灰掉并说明）；读过的话给个「看上次的结果」 */
export function dealAiBar(deal) {
  const s = aiStatus(), off = !s.ready ? t("先在 设置 → AI 助手 填一个 key（推荐 Gemini，有免费额度）") : !s.canImg ? t("当前的 {p} 不能读图片，换成 Gemini 才能用", { p: t(s.provider) }) : "";
  const veh = isVehDeal(deal), last = lastRead(deal.id);
  return `<div class="af-bar deal-ai" data-af="deal"><label class="ui-btn af-btn ${off ? "is-off" : ""}" data-size="sm"><input type="file" accept="image/*" multiple data-deal-doc="${esc(deal.id)}" ${off ? "disabled" : ""}><span>📷 ${t("用文件自动填（可选）")}</span></label>
    <span class="muted af-hint">${off ? `${esc(off)} · <a href="#/me/settings?sec=ai">${t("去设置")}</a>` : veh ? t("拍 / 截图 购车协议或 bill of sale。图片发给你选的 AI 服务商，不保存；识别结果先给你核对，再写入。") : t("拍 / 截图 购房合同、Closing Disclosure 或结算单（几页都行）。图片发给你选的 AI 服务商，不保存；识别结果先给你核对，再写入。")}</span>
    ${last ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${dealHref(deal, "info-ai")}">${t("看上次的识别结果")} ›</a>` : ""}
    <div class="af-status" role="status" aria-live="polite"></div></div>`;
}

/** 核对页 */
export function infoAiPage(deal) {
  const last = lastRead(deal.id), back = dealHref(deal, "info");
  if (!last) return `<section class="section"><div class="panel empty"><strong>${t("没有识别结果")}</strong><p><a class="ui-btn" data-tone="primary" href="${back}">${t("回到交易信息")}</a></p></div></section>`;
  const rows = fieldDiff(deal, last.data, { veh: isVehDeal(deal), prices: pricesOk() });
  const row = (r) => `<li class="ai-row ${r.state}"><label class="check-inline"><input type="checkbox" data-ai-key="${esc(r.key)}" ${r.state === "new" ? "checked" : ""} ${r.state === "same" ? "disabled" : ""}><span><b>${esc(t(r.label))}</b>
      <small>${r.state === "new" ? `${t("现在没填")} → ${show(r.key, r.read)}` : r.state === "same" ? `${show(r.key, r.read)} · ${t("和现有一致")}` : `${show(r.key, r.cur)} → <b>${show(r.key, r.read)}</b> · ${t("和现有不同，要改请勾上")}`}</small></span></label></li>`;
  const open = rows.filter((r) => r.state !== "same").length;
  return `<section class="section"><div class="panel"><h3 style="margin:0 0 4px">📋 ${t("AI 读到的（请核对）")}</h3>
    <p class="muted">${t("文件类型：{d}", { d: t(DOC_NAME[last.data.doc_type] || "文件") })}${open ? "" : ` · ${t("没有需要写入的新信息")}`}</p>
    ${rows.length ? `<ul class="ai-rows">${rows.map(row).join("")}</ul>` : `<p class="muted">${t("没有从这些图里读到可以填的信息。换更清楚的图再试，或者手填。")}</p>`}
    <div class="form-actions sticky-actions deal-confirm-actions"><a class="ui-btn" data-tone="ghost" href="${back}">${t("取消")}</a>${open ? `<button type="button" class="ui-btn" data-tone="primary" data-deal-ai-apply="${esc(deal.id)}">${t("写入所选")}</button>` : ""}</div>
    <p class="hint">${t("AI 只是建议：日期和金额请对着原文件确认。取消勾选的不会写入，已填的信息不会被悄悄改掉。")}</p></div></section>`;
}

if (typeof document !== "undefined") {
  document.addEventListener("change", async (e) => {   // 选了文件：确认 → 读 → 去核对页
    const input = e.target; if (!input.matches?.("input[data-deal-doc]") || !input.closest("#main")) return;
    const deal = state.deals.find((d) => d.id === input.dataset.dealDoc), files = [...input.files]; input.value = "";
    const bar = input.closest(".af-bar"), status = bar?.querySelector(".af-status"); if (!deal || !files.length || !bar) return;
    const say = (m, err = false) => { status.textContent = m; status.className = `af-status ${err ? "form-error" : ""}`; };
    if (!window.confirm(t("这些图片会发给你在设置里选的 AI 服务商来识别（可能含贷款和个人信息，不会保存）。要发送吗？"))) return;
    say(t("正在识别…（几十秒）")); bar.classList.add("is-busy");
    try { await readDealDocs(files, deal, isVehDeal(deal)); go(dealHref(deal, "info-ai")); }
    catch (err) { say(err.message || String(err), true); }
    finally { bar.classList.remove("is-busy"); }
  });
  document.addEventListener("click", async (e) => {   // 核对页「写入所选」
    const b = e.target.closest?.("[data-deal-ai-apply]"); if (!b || !b.closest("#main")) return;
    const deal = state.deals.find((d) => d.id === b.dataset.dealAiApply), last = deal && lastRead(deal.id); if (!last) return;
    const checked = new Set([...document.querySelectorAll("input[data-ai-key]:checked")].map((i) => i.dataset.aiKey));
    const patch = buildPatch(fieldDiff(deal, last.data, { veh: isVehDeal(deal), prices: pricesOk() }), checked);
    if (!Object.keys(patch).length) return toast(t("没有勾选任何项"));
    b.disabled = true;
    try { await applyDealAiPatch(deal, patch); toast(t("已写入 {n} 项", { n: Object.keys(patch).length })); await refresh(); go(dealHref(deal, "info"), { replace: true }); }
    catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); b.disabled = false; }
  });
}
