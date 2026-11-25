/* 交易的几张独立页面（2026-11-24，原来是主页里就地展开的面板 / 表单）：
 *  · 交易信息详情页（?sec=info）：一张只读的信息卡 +「编辑」按钮；点编辑进表单页（?sec=info&edit=1，在 deal-page.js 的 dealForm，底部「取消 / 保存」）
 *  · 事项详情页（?sec=task:<key>）：名称、阶段、重要程度、日期、备注、状态 + 勾选完成 / 编辑 / 跳过 / 删除（自定义事项）；编辑进表单页（&edit=1）
 *  · 添加自定义事项页（?sec=task-new&stage=<阶段>）：就是那张表单，底部「取消 / 保存」
 * 保存后回到哪里：表单里的 return_to（app/events/submit.js 读它）。 */
import { isCash, hasFinancing } from "./deal-fin.js";
import { dealAiBar, infoAiPage } from "./deal-ai.js";
export { infoAiPage };
import { D, PRIO_CLS, customBadge, dateLine, dealAsk, dealHref, dealTasks, dateLabels, isVehDeal, skipBtn, taskEditForm } from "./deal-tasks.js";
import { askButton, askPanel } from "../core/ask.js";
import { eventFormPage } from "./deal-progress.js";
import { fabMenu } from "../core/fab-menu.js";
import { state } from "../core/state.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { priceOrNull, pricesOk } from "../core/finance-access.js";
import { t } from "../core/i18n.js";

const fact = (k, v, wide = false) => `<div class="fact ${wide ? "wide" : ""}"><dt>${esc(k)}</dt><dd>${v || `<span class="muted">${t("没填")}</span>`}</dd></div>`;
const NOT_FOUND = `<section class="section"><div class="panel empty"><strong>${t("找不到这条事项")}</strong></div></section>`;

/** 付款方式：买入 / 买车 = 我的；卖出 / 卖车 = 买家的（可以不选，按贷款算） */
const finLabel = (d) => (["sell", "veh_sell"].includes(d.kind) ? t("买家的付款方式") : t("付款方式"));
const finText = (d) => (d.financing === "cash" ? t("现金") : d.financing === "loan" ? t("贷款") : ["sell", "veh_sell"].includes(d.kind) ? t("没选（按贷款算）") : t("贷款"));
/** 交易信息表单里的付款方式下拉（买入 / 买车只有贷款 / 现金；卖出 / 卖车多一个「没选」） */
export function financingField(d) {
  if (!hasFinancing(d)) return "";
  const sell = ["sell", "veh_sell"].includes(d.kind), cur = d.financing || (sell ? "" : "loan");
  return `<label>${finLabel(d)}<select name="financing" data-nosearch>${sell ? `<option value="" ${cur === "" ? "selected" : ""}>${t("没选（按贷款算）")}</option>` : ""}<option value="loan" ${cur === "loan" ? "selected" : ""}>${t("贷款")}</option><option value="cash" ${cur === "cash" ? "selected" : ""}>${t("现金")}</option></select><small>${t("现金交易没有贷款预批、评估、贷款承诺这些步骤；改了清单马上跟着变，勾过的事项会保留")}</small></label>`;
}
/** 交易主页总结卡片里的切换（贷款 / 现金）：点一下就存，清单马上重算 */
export function financingSwitch(d) {
  if (!hasFinancing(d)) return "";
  const sell = ["sell", "veh_sell"].includes(d.kind), cur = d.financing || (sell ? "" : "loan");
  const chip = (v, l) => `<button type="button" class="chip" data-action="deal-financing" data-deal="${esc(d.id)}" data-val="${v}" aria-pressed="${cur === v}">${l}</button>`;
  return `<div class="deal-fin" role="group" aria-label="${esc(finLabel(d))}"><span class="muted">${finLabel(d)}</span>${sell ? chip("", t("没选")) : ""}${chip("loan", t("贷款"))}${chip("cash", t("现金"))}</div>`;
}

/** 交易信息详情页：该填的字段一行一项，只读；「编辑」进表单 */
export function infoPage(d) {
  const veh = isVehDeal(d), [c, z] = dateLabels(d), date = (k) => (d[k] ? esc(fmtDate(d[k])) : ""), txt = (k) => esc(d[k] || "");
  const price = (k) => (pricesOk() && priceOrNull(d[k]) != null ? esc(money(num(d[k]))) : "");
  const rows = veh
    ? [d.kind === "veh_return" ? null : fact(t(c), date("contract_on")), fact(t(z), date("closing_on")), hasFinancing(d) ? fact(finLabel(d), esc(finText(d))) : null,
      pricesOk() ? fact(d.kind === "veh_return" ? t("买断价（可选）") : t("成交价"), price("price")) : "", pricesOk() ? fact(d.kind === "veh_return" ? t("处置费 / 预估超里程费") : t("定金"), price("earnest_money")) : "",
      isCash(d) ? null : fact(d.kind === "veh_return" ? t("租赁公司") : t("贷款行 / 租赁公司"), txt("lender")), fact(d.kind === "veh_buy" ? t("车行 / 卖家") : d.kind === "veh_sell" ? t("买家 / 车行") : t("经销商 / 归还地点"), txt("agent")), fact(t("备注"), txt("notes"), true)]
    : [fact(t("合同日"), date("contract_on")), fact(t("交割日"), date("closing_on")), fact(t("律师审查截止"), date("review_deadline")), isCash(d) ? null : fact(t("贷款条款截止"), date("financing_deadline")), hasFinancing(d) ? fact(finLabel(d), esc(finText(d))) : null,
      pricesOk() ? fact(t("成交价"), price("price")) : "", pricesOk() ? fact(t("定金"), price("earnest_money")) : "",
      fact(t("律师"), txt("attorney")), isCash(d) ? null : fact(t("贷款行 / 贷款经纪"), txt("lender")), fact(t("经纪人"), txt("agent")), fact(t("产权公司"), txt("title_company")), fact(t("验房师"), txt("inspector")), fact(t("备注"), txt("notes"), true)];
  return `<section class="section"><div class="panel"><div class="kv kv-head"><h3 style="margin:0">${t("交易信息")}</h3><a class="ui-btn" data-size="sm" data-tone="primary" href="${dealHref(d, "info")}&edit=1">${t("编辑")}</a></div>
    ${dealAiBar(d)}<dl class="fact-grid">${rows.filter(Boolean).join("")}</dl></div></section>`;
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
    <div class="kv kv-head"><div><h3 style="margin:0">${esc(t(x.name))}</h3><span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span>${customBadge(x)}</div>
      <div class="head-acts"><a class="ui-btn" data-size="sm" data-tone="primary" href="${here}&edit=1">${t("编辑")}</a></div></div>
    <p style="margin:10px 0 0"><label class="check-inline"><input type="checkbox" id="deal-${esc(deal.id)}-${esc(x.key)}" data-deal-task="${esc(x.key)}" data-deal="${esc(deal.id)}" ${x.done ? "checked" : ""}><span>${t("已完成")}</span></label></p>
    <dl class="fact-grid one">
      ${fact(t("状态"), esc(status))}
      ${fact(t("所属阶段"), esc(t(ST[x.stage] || "")))}
      ${fact(t("日期"), dateLine(x))}
      ${x.note ? fact(t("说明"), esc(t(x.note)), true) : ""}
      ${fact(t("备注"), esc((rec ? rec.note : x.userNote) || ""), true)}
    </dl>
    <div class="ui-acts" style="margin-top:10px">${askButton(dAsk)}${skipBtn(x) ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="deal-task-skip" data-deal="${esc(deal.id)}" data-key="${esc(x.key)}" data-skip="${x.skipped ? "0" : "1"}">${x.skipped ? t("恢复这一步") : t("跳过这一步（不适用）")}</button>` : ""}
      ${rec ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="deal-task-delete" data-id="${esc(rec.id)}" data-back="${esc(stageHref(x.stage))}">${t("删除这条事项")}</button>` : ""}</div>
    ${askPanel(dAsk)}</div></section>`;
}

/** 进展记录：记一笔（?sec=event-new&key=事项&from=视图）/ 修改（?sec=event:<id>）；from = 从哪个视图来的（保存 / 取消后回那里，默认「实际」） */
export function eventPage(deal, sec, q, an) {
  const from = ["plan", "actual", "compare"].includes(q.get("from")) ? q.get("from") : "actual", back = dealHref(deal, from);
  const ev = sec.startsWith("event:") ? (state.dealEvents || []).find((x) => x.id === sec.slice(6)) : null;
  if (sec.startsWith("event:") && !ev) return `<section class="section"><div class="panel empty"><strong>${t("找不到这条记录")}</strong></div></section>`;
  return eventFormPage(deal, an, { ev, key: ev ? (ev.task_keys || [])[0] || "" : q.get("key") || "", cancelHref: back, returnTo: back });
}

/** 「完成」这一步叫什么 / 说明什么：房产买入 = 完成交割；车辆各一种；卖房 / 退租走退出向导页（?sec=closeout，不在这里） */
export function completeInfo(deal) {
  const k = deal.kind;
  if (k === "buy") return { label: t("完成交割"), btn: t("已交割，标为持有"), desc: t("交割后标为持有，记买入日期和价格") };
  if (k === "veh_buy") return { label: t("已提车，标为持有"), btn: t("已提车，标为持有"), desc: t("把购车日期、价格写进车辆档案；填了贷款行就标为贷款中") };
  if (k === "veh_sell") return { label: t("已交车，标为已卖出"), btn: t("已交车，标为已卖出"), desc: t("记下日期和成交价，车从列表和提醒里退出，档案与保养记录保留") };
  return { label: t("已归还，标为已归还"), btn: t("已归还，标为已归还"), desc: t("记下日期，车从列表和提醒里退出，档案与保养记录保留。") };
}
/** 完成页：一段说明 + 「取消 / 确认」（买入 / 车辆：一步确认；卖房 / 退租是退出向导页） */
export function completePage(deal) {
  const c = completeInfo(deal);
  return `<section class="section"><div class="panel"><h3 style="margin:0 0 6px">${esc(c.label)}</h3><p class="muted">${esc(c.desc)}</p>
    <div class="ui-acts sticky-actions deal-confirm-actions"><a class="ui-btn" data-tone="ghost" href="${dealHref(deal)}">${t("取消")}</a><button type="button" class="ui-btn" data-tone="primary" data-action="deal-closeout" data-deal="${esc(deal.id)}" data-confirm="1">${esc(c.btn)}</button></div></div></section>`;
}
/** 取消交易页：说明会发生什么 + 「返回 / 取消这笔交易」 */
export function cancelPage(deal) {
  return `<section class="section"><div class="panel"><h3 style="margin:0 0 6px">${t("取消这笔交易")}</h3>
    <p class="muted">${t("这笔交易会标为已取消，放进历史；清单、时间线和交易信息都保留，仍可查看。房产状态按剩下还在进行的交易恢复，没有别的交易就退回开始之前的状态。")}</p>
    <div class="ui-acts sticky-actions deal-confirm-actions"><a class="ui-btn" data-tone="ghost" href="${dealHref(deal)}">${t("返回")}</a><button type="button" class="ui-btn" data-tone="danger-solid" data-action="deal-cancel" data-deal="${esc(deal.id)}" data-confirm="1">${t("取消这笔交易")}</button></div></div></section>`;
}

/** 右下角圆形 ＋（只有一项时直接是一个圆形 ＋ 链接）：主页 = 添加自定义事项 / 记一笔进展 /（进行中）完成或退出 /（进行中）取消交易；
 *  清单 / 阶段页 = 添加自定义事项；计划 / 实际 / 对比页 = 记一笔进展。位置 = "hub" | "list" | "stage" | "view"（view 时 from = 当前视图） */
export function dealFab(deal, where, opts = {}) {
  return `<div class="fab-space" aria-hidden="true"></div>${dealFabMenu(deal, where, opts)}`;   // 空白：页面拉到底时右下角 ＋ 不盖住最后一行字
}
function dealFabMenu(deal, where, { stage = "special", from = "actual" } = {}) {
  const closed = !!deal.outcome, addTask = { icon: "➕", label: t("添加自定义事项"), href: `${dealHref(deal, "task-new")}${stage && stage !== "special" ? `&stage=${encodeURIComponent(stage)}` : ""}` };
  const addEvent = { icon: "📝", label: t("记一笔进展"), href: `${dealHref(deal, "event-new")}&from=${from}` };
  if (where === "list" || where === "stage") return fabMenu([addTask], { label: t("添加自定义事项") });
  if (where === "view") return fabMenu([addEvent], { label: t("记一笔进展") });
  const wizard = !deal.asset_id && ["sell", "move_out"].includes(deal.kind);   // 卖房 / 退租：退出向导页；其余：完成页
  return fabMenu([addTask, addEvent,
    closed ? null : { icon: "🔑", label: wizard ? t("退出向导") : completeInfo(deal).label, href: dealHref(deal, wizard ? "closeout" : "complete") },
    closed ? null : { icon: "⛔", label: t("取消这笔交易"), href: dealHref(deal, "cancel") }], { label: t("添加") });
}
