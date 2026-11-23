/* 财务 → 账户：账户概览、银行账户、投资账户、电子钱包与礼品卡（信用卡页是 cards-page.js）。
 * 余额来自净资产那套（余额快照 state.balances → computeNetWorth 的 accounts）：账户页「更新余额」记一笔，每月自动存快照；投资账户只记总值，不记持仓和交易。
 * 每页：顶上几个小指标 → 账户清单（一行一个，长按有菜单）→ 停用的（默认折叠）；添加账户 = 右下角圆形 ＋。 */
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { esc, fmtDate, money } from "../core/util.js";
import { href } from "../core/router.js";
import { eyeFilter } from "../core/filter-pop.js";
import { fabMenu } from "../core/fab-menu.js";
import { finHead } from "./fin-head.js";
import { cardsRO } from "../core/finance-access.js";
import { lpAttr } from "../core/long-press.js";
import { infoTip } from "../core/info-tip.js";
import { ACCT_KINDS, cardHref, giftBalance, holderName, kindIcon, kindName } from "./cards.js";
import { liveNetWorth } from "./nw-logic.js";
import { GROUPS, INVEST_SECTIONS, groupOfKind, summarizeRows } from "./acct-groups.js";
import { giftSection, offSection } from "./cards-page.js";

const live = (group) => (state.cards || []).filter((c) => c.active !== false && groupOfKind(c.kind) === group);
const offOf = (group) => (state.cards || []).filter((c) => c.active === false && groupOfKind(c.kind) === group).sort((a, b) => String(b.inactive_since || "").localeCompare(String(a.inactive_since || "")));
const kpi = (label, value, small = "") => `<div class="kpi"><span>${esc(label)}</span><b>${value}</b>${small ? `<small>${small}</small>` : ""}</div>`;
const mny = (v) => `<span data-money>${money(v)}</span>`;
const nwRows = () => { try { return liveNetWorth().accounts; } catch { return []; } };
const rowOf = (rows, c) => rows.find((r) => r.card?.id === c.id);

/** 一行账户：图标 + 名称 + 种类 / 机构 / 持有人，右边是最新余额；没记余额或太久没更新有小提示。长按（电脑右键）→ 详情 / 更新余额 */
function acctRow(c, rows) {
  const r = rowOf(rows, c), bal = r?.balance;
  const tag = r?.missing ? `<span class="badge b-soon">${t("还没记余额")}</span>` : r?.stale ? `<span class="badge b-soon">${t("余额是 {d} 的，该更新了", { d: fmtDate(r.as_of) })}</span>` : "";
  const sub = [kindName(c.kind), c.issuer, holderName(c)].filter(Boolean).map(esc).join(" · ") + (r?.as_of && !r.stale ? ` · ${esc(t("{d} 更新", { d: fmtDate(r.as_of) }))}` : "");
  return `<li class="card-row ${c.active === false ? "inactive" : ""}" ${lpAttr([{ label: t("详情 / 更新余额"), href: cardHref(c.id), first: true }], c.name)}><div class="grow"><span class="card-ico" aria-hidden="true">${kindIcon(c.kind)}</span><a class="link-name" href="${cardHref(c.id)}">${esc(c.name)}</a>${c.last4 ? ` <span class="muted">**${esc(c.last4)}</span>` : ""}<small>${sub}</small>${tag ? `<div class="card-tags">${tag}</div>` : ""}</div>
    ${bal != null ? `<b class="gift-bal">${mny(r.side === "l" ? -bal : bal)}</b>` : ""}</li>`;
}
const list = (cards, rows) => (cards.length ? `<div class="panel"><ul class="restock-list card-list">${cards.map((c) => acctRow(c, rows)).join("")}</ul></div>` : "");
/** 添加账户：右下角圆形 ＋（只有一种就直接是链接，多种弹菜单）；只读时没有 */
const addFab = (kinds) => (cardsRO() ? "" : fabMenu(kinds.map((k) => ({ label: t(ACCT_KINDS[k][0]), icon: ACCT_KINDS[k][1], href: `${cardHref("new")}&kind=${k}` })), { label: t("添加账户") }));
const head = (title, tip) => finHead({ label: title, note: tip ? infoTip.classic(tip, { align: "start" }) : "", right: eyeFilter() });
const empty = (msg) => `<div class="panel empty"><strong>${esc(msg)}</strong></div>`;
const needTip = (n) => (n ? t("{n} 个账户该更新余额", { n }) : t("余额都是新的"));

/** 账户概览：四类账户各一张卡（余额 / 数量 / 要处理的），点进去看那一类 */
export function viewAccountsHome() {
  const rows = nwRows(), nw = (() => { try { return liveNetWorth(); } catch { return null; } })();
  const by = (g) => rows.filter((r) => r.card && groupOfKind(r.card.kind) === g);
  const cnt = (g) => live(g).length;   // 账户个数按「账户」本身数（余额没读到、没记余额也算）；合计和「要更新」才看余额
  const bank = { ...summarizeRows(by("bank")), n: cnt("bank") }, inv = { ...summarizeRows(by("invest")), n: cnt("invest") }, cr = live("credit"), gifts = live("wallet").filter((c) => c.kind === "gift");
  const giftTotal = gifts.reduce((s, c) => s + Math.max(0, giftBalance(c) ?? 0), 0), fees = cr.reduce((s, c) => s + (Number(c.annual_fee) || 0), 0), limit = cr.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0);
  const tile = (g, big, lines, to) => `<a class="panel acct-tile" href="${to}"><span class="mi" aria-hidden="true">${GROUPS[g].icon}</span><div><h3>${esc(t(GROUPS[g].name))}</h3><b class="acct-big">${big}</b><small class="muted">${lines.filter(Boolean).map(esc).join(" · ")}</small></div><span class="mch" aria-hidden="true">›</span></a>`;
  const need = bank.needUpdate + inv.needUpdate;
  return `<section class="section">${head(`${t("账户概览")}`, t("四类账户一眼看：信用卡、银行、投资、电子钱包与礼品卡。余额来自账户页的「更新余额」；投资账户只记总值（每月自动存快照），不记持仓和交易。"))}
    <div class="kpis k4">${kpi(t("现金与储蓄"), mny(nw?.assets.cash ?? 0))}${kpi(t("投资、退休与医疗"), mny((nw?.assets.investments ?? 0) + (nw?.assets.retirement ?? 0) + (nw?.assets.hsa ?? 0)))}${kpi(t("信用卡欠款"), mny(nw?.liabilities.credit_cards ?? 0))}${kpi(t("礼品卡余额"), mny(giftTotal))}</div>
    <p class="muted small" role="status">${esc(needTip(need))} · <a href="${href("bills", "networth")}">${t("看净资产")} ›</a></p>
    <div class="acct-tiles">
      ${tile("credit", t("{n} 张在用", { n: cr.length }), [limit ? t("额度合计 {m}", { m: money(limit) }) : "", fees ? t("年费合计 {m}", { m: money(fees) }) : ""], href("bills", "cards"))}
      ${tile("bank", `${mny(bank.total)}`, [t("{n} 个账户", { n: bank.n }), bank.needUpdate ? needTip(bank.needUpdate) : ""], href("bills", "banks"))}
      ${tile("invest", `${mny(inv.total)}`, [t("{n} 个账户", { n: inv.n }), inv.needUpdate ? needTip(inv.needUpdate) : ""], href("bills", "invest"))}
      ${tile("wallet", `${mny(giftTotal)}`, [t("{n} 个电子钱包", { n: live("wallet").filter((c) => c.kind === "wallet").length }), t("{n} 张礼品卡", { n: gifts.length })], href("bills", "wallets"))}
    </div></section>`;
}

/** 银行账户：支票 / 储蓄 / 现金 / 借记卡 */
export function viewBanks() {
  const rows = nwRows(), cards = live("bank"), s = summarizeRows(rows.filter((r) => r.card && groupOfKind(r.card.kind) === "bank")), off = offOf("bank");
  return `<section class="section">${head(t("银行账户"), t("支票、储蓄、现金和借记卡：账单从哪扣、收入入到哪。余额在账户页「更新余额」，每月自动存快照。"))}
    <div class="kpis">${kpi(t("总余额"), mny(s.total))}${kpi(t("账户"), esc(t("{n} 个", { n: s.n })))}${kpi(t("余额状态"), esc(needTip(s.needUpdate)))}</div>
    ${cards.length ? list(cards, rows) : empty(t("还没有银行账户。点右下角的 ＋ 添加。"))}
    ${addFab(GROUPS.bank.kinds)}
    ${off.length ? offSection(off) : ""}</section>`;
}

/** 投资账户：按用途分块（退休 / 教育 / 孩子 / 医疗 / 券商 / 加密），每块小计；只记总值 */
export function viewInvest() {
  const rows = nwRows(), all = live("invest"), s = summarizeRows(rows.filter((r) => r.card && groupOfKind(r.card.kind) === "invest")), off = offOf("invest");
  const blocks = INVEST_SECTIONS.map((sec) => {
    const cs = all.filter((c) => sec.kinds.includes(c.kind)); if (!cs.length) return "";
    const sub = summarizeRows(rows.filter((r) => r.card && sec.kinds.includes(r.card.kind)));
    return `<div class="section-head" style="margin-top:14px"><h2>${sec.icon} ${esc(t(sec.name))}</h2><p>${mny(sub.total)} · ${esc(t("{n} 个账户", { n: cs.length }))}</p></div>${list(cs, rows)}`;
  }).join("");
  return `<section class="section">${head(t("投资账户"), t("只记总值：在账户页「更新余额」记一笔当前的总额，每月自动存快照看走势；不记持仓和交易。"))}
    <div class="kpis">${kpi(t("总值"), mny(s.total))}${kpi(t("账户"), esc(t("{n} 个", { n: s.n })))}${kpi(t("余额状态"), esc(needTip(s.needUpdate)))}</div>
    ${blocks || empty(t("还没有投资账户。点右下角的 ＋ 添加。"))}
    ${addFab(GROUPS.invest.kinds)}
    ${off.length ? offSection(off) : ""}</section>`;
}

/** 电子钱包与礼品卡：两个区 */
export function viewWallets() {
  const rows = nwRows(), wallets = live("wallet").filter((c) => c.kind === "wallet"), gifts = live("wallet").filter((c) => c.kind === "gift"), off = offOf("wallet");
  return `<section class="section">${head(t("电子钱包与礼品卡"), t("电子钱包：PayPal、Venmo、Zelle、Ventra（交通卡）等；礼品卡：Amazon、Target 等，余额 = 面值 − 记在这张卡上的花费。"))}
    <div class="section-head"><h2>📱 ${t("电子钱包")}</h2><p>${esc(t("{n} 个", { n: wallets.length }))}</p></div>
    ${wallets.length ? list(wallets, rows) : empty(t("还没有电子钱包。"))}
    ${gifts.length ? giftSection(gifts) : `<div class="section-head" style="margin-top:14px"><h2>🎁 ${t("礼品卡")}</h2></div>${empty(t("还没有礼品卡。"))}`}
    ${addFab(GROUPS.wallet.kinds)}
    ${off.length ? offSection(off) : ""}</section>`;
}
