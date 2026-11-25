/* 卡与账户详情页（#/bills/cards?card=<id>）：点一张卡先进这里，不再直接进整张编辑表单。
 * 顶部：名称（靠左）+ 在用 / 停用标志 + 右上角 ⋯（停用 / 启用、复制为新卡、删除）；下面按分区各一块（这张卡 / 还款 / 返现规则 / 开卡奖励 / 报销额度 / 备注），
 * 每块带自己的「编辑」，点进去只改这一块（?card=<id>&edit=<分区>，表单在 card-form.js）。只读（没有财务权限）：没有 ⋯ 和「编辑」。 */
import { esc, fmtDate, money, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { ACCT_KINDS, cardHref, holderName, noRewards, quarterOf } from "./cards.js";
import { acctLabel } from "./card-picker.js";
import { moreMenu } from "../core/more-menu.js";
import { state } from "../core/state.js";
import { balancePanel } from "./net-worth-panel.js";
import { D } from "./card-common.js";

export const CARD_SECS = [
  { id: "basic", icon: "💳", name: (bank) => (bank ? "这个账户" : "这张卡"), kinds: null },
  { id: "repay", icon: "📅", name: () => "还款", kinds: ["credit"] },
  { id: "rewards", icon: "🎯", name: () => "返现规则", kinds: ["credit", "debit"] },
  { id: "bonus", icon: "🎁", name: () => "开卡奖励", kinds: ["credit"] },
  { id: "credits", icon: "🧾", name: () => "报销额度", kinds: ["credit"] },
  { id: "notes", icon: "📝", name: () => "备注", kinds: null },
];
const fact = (k, v) => (v ? `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>` : "");
const dl = (rows) => { const r = rows.filter(Boolean); return r.length ? `<dl class="fact-grid one">${r.join("")}</dl>` : `<p class="muted prof-empty">${t("未填")}</p>`; };
const day = (n) => (n ? esc(t("每月 {n} 号", { n })) : "");

function body(c, id) {
  const bank = noRewards(c), rw = c.rewards || {}, b = c.bonus || {}, K = ACCT_KINDS[c.kind] || ACCT_KINDS.credit;
  switch (id) {
    case "basic": return dl([fact(t("类型"), `${K[1]} ${esc(t(K[0]))}`), fact(t("名称"), esc(c.name)), fact(c.kind === "gift" ? t("商家 / 品牌（在哪用）") : t("发卡行 / 银行"), esc(c.issuer || "")),
      c.kind === "credit" || c.kind === "debit" ? fact(t("网络"), esc(t(D().NETWORKS[c.network] || c.network || ""))) : "", fact(t("末四位"), esc(c.last4 || "")),
      c.kind === "gift" && c.balance != null ? fact(t("面值 / 充值总额"), esc(money(num(c.balance)))) : "", fact(t("持卡人 / 户主"), esc(holderName(c))),
      c.expires_on ? fact(c.kind === "gift" ? t("有效期至（可选）") : t("到期年月"), esc((c.expires_on || "").slice(0, 7))) : "", fact(t("开卡 / 开户日期"), c.opened_on ? esc(fmtDate(c.opened_on)) : ""),
      c.kind === "credit" ? fact(t("年费"), num(c.annual_fee) ? esc(money(num(c.annual_fee))) : "") : "", c.kind === "credit" && c.fee_month ? fact(t("年费哪个月收"), esc(t("{m} 月", { m: c.fee_month }))) : "",
      c.kind === "credit" && c.credit_limit ? fact(t("额度（可空）"), esc(money(num(c.credit_limit)))) : "", fact(t("状态"), c.active === false ? esc(t("已停用")) : esc(bank ? t("在用") : t("在用"))) ]);
    case "repay": { const bill = c.bill_id ? state.bills.find((x) => x.id === c.bill_id) : null, from = bill?.pay_card_id ? state.cards.find((x) => x.id === bill.pay_card_id) : null;
      return dl([fact(t("账单日（每月几号）"), day(c.statement_day)), fact(t("还款日（每月几号）"), day(c.due_day)), fact(t("自动还款"), c.autopay ? esc(t("是")) : esc(t("否"))), fact(t("从哪个账户还款"), from ? esc(acctLabel(from)) : ""),
        fact(t("还款提醒走哪条账单"), bill ? `<a href="#/bill/${esc(bill.id)}">${esc(bill.name)}</a>` : "")]); }
    case "rewards": {
      const cats = D().REWARD_CATS.filter(([k]) => rw.cats?.[k] != null && rw.cats[k] !== "").map(([k, name, ic]) => `${ic} ${esc(t(name))} ${num(rw.cats[k])}%`), q = quarterOf(), rot = (rw.rotating || []).find((x) => x.from === q.from);
      const merchants = Object.entries(rw.merchants || {}).map(([k, v]) => `${esc(k)} ${num(v)}%`);
      return dl([fact(t("其他消费 %"), rw.base != null ? `${num(rw.base)}%` : ""), fact(t("每点值多少美分（现金卡 = 1）"), rw.point_value && num(rw.point_value) !== 1 ? esc(String(num(rw.point_value))) : ""), fact(t("境外手续费 %"), num(rw.foreign_fee) ? `${num(rw.foreign_fee)}%` : ""),
        fact(t("各类别返现"), cats.join(" · ")), fact(t("特定商家"), merchants.join(" · ")),
        rw.has_rotating ? fact(t("季度轮换 5% 类别（Chase Freedom、Discover it 这类）"), rot ? `${rot.cats.map((k) => { const x = D().REWARD_CATS.find((r) => r[0] === k); return x ? `${x[2]} ${esc(t(x[1]))}` : esc(k); }).join(" · ")} · ${num(rot.rate)}%${rot.activated ? ` · ${esc(t("本季已激活"))}` : ""}` : esc(t("这张卡有季度轮换类别"))) : ""]); }
    case "bonus": return b.spend ? dl([fact(t("要刷满（{cur}）", { cur: Units.region.currency }), esc(money(num(b.spend)))), fact(t("截止日期"), b.by ? esc(fmtDate(b.by)) : ""), fact(t("奖励值多少（{cur}）", { cur: Units.region.currency }), b.reward_value ? esc(money(num(b.reward_value))) : ""), fact(t("奖励说明"), esc(b.label || "")),
      fact(t("已刷了多少（不填 = 按记到这张卡的花费自动累计）"), b.spent_manual != null ? esc(money(num(b.spent_manual))) : ""), b.done ? fact(t("已拿到奖励"), esc(t("是"))) : ""]) : `<p class="muted prof-empty">${t("未填")}</p>`;
    case "credits": return (c.credits || []).length ? `<ul class="restock-list">${c.credits.map((x) => `<li><div class="grow">${esc(x.name)}<small>${esc([t(x.period === "quarter" ? "每季" : x.period === "month" ? "每月" : "每年"), x.resets_on ? t("{d} 清零", { d: fmtDate(x.resets_on) }) : "", t("已用 {u}", { u: money(num(x.used, 0)) })].filter(Boolean).join(" · "))}</small></div><b>${esc(money(num(x.amount)))}</b></li>`).join("")}</ul>` : `<p class="muted prof-empty">${t("未填")}</p>`;
    case "notes": return c.notes ? `<p class="pre" style="margin:0">${esc(c.notes)}</p>` : `<p class="muted prof-empty">${t("未填")}</p>`;
    default: return "";
  }
}

/** c：这张卡；ro：只读；deleteHtml：删除前的确认面板（card-del 点了之后出现，由卡片列表页的函数生成） */
/** 某一块的内容（详情页和添加向导的确认页共用） */
export const cardSectionBody = (c, id) => body(c, id);

export function cardDetailPage(c, ro, deleteHtml = "") {
  const bank = noRewards(c), base = cardHref(c.id), K = ACCT_KINDS[c.kind] || ACCT_KINDS.credit;
  const active = c.active !== false;
  const menu = ro ? "" : moreMenu([
    { label: active ? t("停用") : t("启用"), action: active ? "card-deact" : "card-react", data: { id: c.id }, first: true },
    { label: t("复制"), href: `${cardHref("new")}&copy=${encodeURIComponent(c.id)}` },
    { label: t("删除"), action: "card-del", data: { id: c.id }, danger: true }], { label: `${c.name} · ${t("更多操作")}` });
  const cards = CARD_SECS.filter((s) => !s.kinds || s.kinds.includes(c.kind)).map((s) => `<section class="panel prof-card" aria-labelledby="cdc-${s.id}"><header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="cdc-${s.id}">${t(s.name(bank))}</h3></div>
      ${ro ? "" : `<a class="ui-btn prof-edit" data-size="sm" data-tone="ghost" href="${base}&edit=${s.id}" aria-label="${esc(t("编辑 {name}", { name: t(s.name(bank)) }))}">${t("编辑")}</a>`}</header>${body(c, s.id)}</section>`).join("");
  return `<section class="section">
    ${ro ? `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("只读：家主开放财务权限后才能修改")}</p>` : ""}
    ${deleteHtml}
    <div class="panel item-head"><div class="ih-top"><div class="ih-main"><div class="ih-id"><span class="mi" aria-hidden="true">${K[1]}</span><h2 class="ih-name">${esc(c.name)}</h2></div>${active ? "" : `<span class="ih-flags"><span class="ui-badge" data-size="sm">${t("已停用")}</span></span>`}</div>${menu}</div></div>
    <div class="prof-grid bill-detail-grid">${cards}</div>
    ${c && !ro ? `<div class="nw-card-bal">${balancePanel(c, { open: true })}</div>` : ""}
  </section>`;
}
