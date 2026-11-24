/* 交易的几张独立页面（2026-11-24，原来是主页里就地展开的面板 / 表单）：
 *  · 交易信息详情页（?sec=info）：一张只读的信息卡 +「编辑」按钮；点编辑进表单页（?sec=info&edit=1，在 deal-page.js 的 dealForm，底部「取消 / 保存」）
 *  · 事项详情页（?sec=task:<key>）：名称、阶段、重要程度、日期、备注、状态 + 勾选完成 / 编辑 / 跳过 / 删除（自定义事项）；编辑进表单页（&edit=1）
 *  · 添加自定义事项页（?sec=task-new&stage=<阶段>）：就是那张表单，底部「取消 / 保存」
 * 保存后回到哪里：表单里的 return_to（app/events/submit.js 读它）。 */
import { D, PRIO_CLS, customBadge, dateLine, dealAsk, dealHref, dealTasks, dateLabels, isVehDeal, skipBtn, taskEditForm } from "./deal-tasks.js";
import { askButton, askPanel } from "../core/ask.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { priceOrNull, pricesOk } from "../core/finance-access.js";
import { t } from "../core/i18n.js";

const fact = (k, v, wide = false) => `<div class="fact ${wide ? "wide" : ""}"><dt>${esc(k)}</dt><dd>${v || `<span class="muted">${t("没填")}</span>`}</dd></div>`;
const NOT_FOUND = `<section class="section"><div class="panel empty"><strong>${t("找不到这条事项")}</strong></div></section>`;

/** 交易信息详情页：该填的字段一行一项，只读；「编辑」进表单 */
export function infoPage(d) {
  const veh = isVehDeal(d), [c, z] = dateLabels(d), date = (k) => (d[k] ? esc(fmtDate(d[k])) : ""), txt = (k) => esc(d[k] || "");
  const price = (k) => (pricesOk() && priceOrNull(d[k]) != null ? esc(money(num(d[k]))) : "");
  const rows = veh
    ? [d.kind === "veh_return" ? null : fact(t(c), date("contract_on")), fact(t(z), date("closing_on")),
      pricesOk() ? fact(d.kind === "veh_return" ? t("买断价（可选）") : t("成交价"), price("price")) : "", pricesOk() ? fact(d.kind === "veh_return" ? t("处置费 / 预估超里程费") : t("定金"), price("earnest_money")) : "",
      fact(d.kind === "veh_return" ? t("租赁公司") : t("贷款行 / 租赁公司"), txt("lender")), fact(d.kind === "veh_buy" ? t("车行 / 卖家") : d.kind === "veh_sell" ? t("买家 / 车行") : t("经销商 / 归还地点"), txt("agent")), fact(t("备注"), txt("notes"), true)]
    : [fact(t("合同日"), date("contract_on")), fact(t("交割日"), date("closing_on")), fact(t("律师审查截止"), date("review_deadline")), fact(t("贷款条款截止"), date("financing_deadline")),
      pricesOk() ? fact(t("成交价"), price("price")) : "", pricesOk() ? fact(t("定金"), price("earnest_money")) : "",
      fact(t("律师"), txt("attorney")), fact(t("贷款行 / 贷款经纪"), txt("lender")), fact(t("经纪人"), txt("agent")), fact(t("产权公司"), txt("title_company")), fact(t("验房师"), txt("inspector")), fact(t("备注"), txt("notes"), true)];
  return `<section class="section"><div class="panel"><div class="kv"><h3 style="margin:0">${t("交易信息")}</h3><a class="btn btn-primary btn-sm" href="${dealHref(d, "info")}&edit=1">${t("编辑")}</a></div>
    <dl class="fact-grid">${rows.filter(Boolean).join("")}</dl></div></section>`;
}

/** 事项详情页 / 编辑页 / 添加自定义事项页；sec = "task:<key>" 或 "task-new" */
export function taskPage(deal, sec, q) {
  const stageHref = (k) => `${dealHref(deal, `stage:${k}`)}`;
  if (sec === "task-new") {
    const st = q.get("stage") || "special";
    return `<section class="section"><div class="panel"><h3 style="margin:0 0 8px">${t("添加自定义事项")}</h3>${taskEditForm(deal, null, st, { cancelHref: stageHref(st), returnTo: stageHref(st) })}</div></section>`;
  }
  const x = dealTasks(deal).find((k) => k.key === sec.slice(5)); if (!x) return NOT_FOUND;
  const here = dealHref(deal, sec), ST = D().stagesOf(deal.kind) || {};
  if (q.get("edit")) return `<section class="section"><div class="panel"><h3 style="margin:0 0 8px">${esc(t(x.name))}</h3>${taskEditForm(deal, x, x.stage, { cancelHref: here, returnTo: here })}</div></section>`;
  const dAsk = dealAsk(x), rec = x.custom ? x.rec : null, status = x.skipped ? t("已跳过（不适用）") : x.done ? t("已完成") : x.overdue ? t("已逾期") : t("未完成");
  return `<section class="section"><div class="panel">
    <div class="kv"><div><h3 style="margin:0">${esc(t(x.name))}</h3><span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span>${customBadge(x)}</div>
      <div class="head-acts"><a class="btn btn-primary btn-sm" href="${here}&edit=1">${t("编辑")}</a></div></div>
    <p style="margin:10px 0 0"><label class="check-inline"><input type="checkbox" id="deal-${esc(deal.id)}-${esc(x.key)}" data-deal-task="${esc(x.key)}" data-deal="${esc(deal.id)}" ${x.done ? "checked" : ""}><span>${t("已完成")}</span></label></p>
    <dl class="fact-grid one">
      ${fact(t("状态"), esc(status))}
      ${fact(t("所属阶段"), esc(t(ST[x.stage] || "")))}
      ${fact(t("日期"), dateLine(x))}
      ${x.note ? fact(t("说明"), esc(t(x.note)), true) : ""}
      ${fact(t("备注"), esc((rec ? rec.note : x.userNote) || ""), true)}
    </dl>
    <div class="form-actions" style="margin-top:10px">${askButton(dAsk)}${skipBtn(x) ? `<button type="button" class="btn btn-ghost btn-sm" data-action="deal-task-skip" data-deal="${esc(deal.id)}" data-key="${esc(x.key)}" data-skip="${x.skipped ? "0" : "1"}">${x.skipped ? t("恢复这一步") : t("跳过这一步（不适用）")}</button>` : ""}
      ${rec ? `<button type="button" class="btn btn-ghost btn-sm" data-action="deal-task-delete" data-id="${esc(rec.id)}" data-back="${esc(stageHref(x.stage))}">${t("删除这条事项")}</button>` : ""}</div>
    ${askPanel(dAsk)}</div></section>`;
}
