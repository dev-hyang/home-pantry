/* 设置 → 家庭：财务权限的申请与批准（迁移 105）。
 *  · 成员：看自己有没有财务权限；没有就可以写一句理由「申请」，已经申请了可以「撤回」，有了也可以自己「关掉」（打开只能家主批准）。
 *  · 家主：「财务权限申请」列表，同意 = 开 can_finance，拒绝 = 清掉申请（对方可以再申请，同一时间只留一条）。
 *  申请记在 household_members 的 finance_requested_at / finance_request_note；权限本身仍然只看 can_finance。 */
import { esc, fmtShort, toast } from "../core/util.js";
import { CloudStore } from "../core/store.js";
import { t } from "../core/i18n.js";
import { amOwner, famMembers, meId, reloadMembers } from "./members.js";
import { render } from "../app/render.js";

/** 家主：有未处理财务权限申请的正式成员 */
export const financeRequests = () => famMembers().filter((m) => m.finance_requested_at && m.role !== "owner" && m.can_finance !== true);

/** 成员自己的那一块（家主不显示） */
export function financeRequestCard() {
  const me = famMembers().find((m) => m.user_id === meId()); if (!me || amOwner()) return "";
  const body = me.can_finance === true
    ? `<p class="muted">${t("你有财务权限：能看、能改对账单、收入、预算和用卡。")}</p><div class="ui-acts"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="fin-off">${t("关掉我的财务权限")}</button></div>`
    : me.finance_requested_at
      ? `<p class="muted">${t("申请已发给家主（{d}）{note}，等家主同意。", { d: fmtShort(me.finance_requested_at), note: me.finance_request_note ? `：${esc(me.finance_request_note)}` : "" })}</p><div class="ui-acts"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="fin-cancel">${t("撤回申请")}</button></div>`
      : `<p class="muted">${t("没有财务权限时，对账单、收入、预算看不到，用卡只读。需要的话写一句理由，家主同意后就能用。")}</p>
        <div class="dl-row"><input id="finReqNote" maxlength="60" placeholder="${esc(t("理由（可不填），例如：我来管水电账单"))}" aria-label="${esc(t("申请理由"))}"><button type="button" class="ui-btn" data-tone="primary" data-action="fin-request">${t("申请财务权限")}</button></div>`;
  return `<div class="panel fin-req"><h3 style="font-size:15px;margin:0 0 6px">💰 ${t("财务权限")}</h3>${body}</div>`;
}

/** 家主：待处理的财务权限申请 */
export function financeRequestsPanel() {
  const list = amOwner() ? financeRequests() : []; if (!list.length) return "";
  const row = (m) => `<li><div class="grow"><b>${esc(m.display_name)}</b><small class="muted">${t("{d} 申请", { d: fmtShort(m.finance_requested_at) })}${m.finance_request_note ? ` · ${esc(m.finance_request_note)}` : ""}</small></div>
    <span class="head-acts"><button type="button" class="ui-btn" data-size="sm" data-tone="primary" data-action="fin-yes" data-id="${esc(m.user_id)}">${t("同意")}</button><button type="button" class="ui-btn" data-size="sm" data-tone="danger" data-action="fin-no" data-id="${esc(m.user_id)}">${t("拒绝")}</button></span></li>`;
  return `<div class="panel pend-panel"><h3 style="font-size:15px;margin:0 0 6px">${t("财务权限申请（{n}）", { n: list.length })}</h3>
    <p class="muted small" style="margin:0 0 8px">${t("同意后对方能看、能改对账单、收入、预算和用卡。随时可以在成员详情里关掉。")}</p><ul class="member-list">${list.map(row).join("")}</ul></div>`;
}

/** 点击：申请 / 撤回 / 关掉自己的 / 家主同意 / 拒绝。每次做完重读成员表再画 */
export async function financeAction(action, id) {
  const note = document.getElementById("finReqNote")?.value.trim() || "";
  try {
    if (action === "fin-request") { await CloudStore.requestFinance(note); toast(t("申请已发给家主")); }
    else if (action === "fin-cancel") { await CloudStore.cancelFinanceRequest(); toast(t("已撤回申请")); }
    else if (action === "fin-off") { await CloudStore.disableMyFinance(); toast(t("已关掉你的财务权限")); }
    else if (action === "fin-yes") { await CloudStore.decideFinanceRequest(id, true); toast(t("已同意，对方现在有财务权限")); }
    else if (action === "fin-no") { await CloudStore.decideFinanceRequest(id, false); toast(t("已拒绝这个申请")); }
  } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); }
  await reloadMembers(); render(true);
}
