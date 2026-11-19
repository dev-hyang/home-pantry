/* 卡与账户页面：卡片列表、礼品卡（余额 = 面值 − 花费）、停用的卡。 */
import { ACCT_KINDS, ACCT_SHORT, bonusLeft, cardById, cardHref, cardTotal, expDays, feeDays, giftBalance, holderName, isBankAcct, kindName, networkName, noRewards, reloadCards, rewardCatIcon, rewardCatName, rotatingNow, usage } from "./cards.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { Store } from "../core/store.js";
import { attentionPanel } from "../core/alerts.js";
import { cardForm } from "./card-form.js";
import { cardsRO } from "../core/finance-access.js";
import { daysUntil, esc, fmtDate, money, num, toast, todayISO } from "../core/util.js";
import { pickPanel, reviewHtml } from "./cards-review.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { D, catalogAge, d, roStop } from "./card-common.js";
import { lpAttr } from "../core/long-press.js";

/* ───────────── 页面 ───────────── */
export function viewCards() {
  const id = state.route.q.get("card"), ro = cardsRO();
  if (id && !(ro && id === "new")) return cardForm(id, ro);   // 只读：能打开看，不能新建
  const live = state.cards.filter((c) => c.active !== false), cards = live.filter((c) => !noRewards(c)), banks = live.filter(isBankAcct), gifts = live.filter((c) => c.kind === "gift");
  // 停用的：最近停用的在前（没有停用日期的老记录按最后修改时间）
  const off = state.cards.filter((c) => c.active === false).sort((a, b) => String(b.inactive_since || "").localeCompare(String(a.inactive_since || "")) || String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  const addChips = `<div class="acct-add">${Object.entries(ACCT_KINDS).map(([k, [name, icon]]) => `<a class="chip" href="${cardHref("new")}&kind=${k}">＋ ${icon} ${esc(t(name))}</a>`).join("")}</div>`;
  return `<section class="section">
    <div class="section-head"><h2>${t("卡与账户")}</h2><p>${t("按场景比返现：该刷哪张、为什么；到期、年费、轮换类别、开卡奖励按时提醒。银行账户也记在这里，账单扣款、缴费记录能直接选。")}</p>
      <div class="head-acts">${ro ? `<span class="badge" style="background:var(--surface-2)">${t("只读")}</span>` : `<a class="btn btn-primary btn-sm" href="${cardHref("new")}">${t("添加卡 / 账户")}</a>`}</div></div>
    ${ro ? `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("你可以查看卡和推荐；添加、修改、停用、删除要家主在「设置 → 家庭与成员」里给你开财务权限。")}</p>` : ""}
    ${state.cardDelete && !ro ? deleteConfirmHtml(state.cardDelete) : ""}
    ${attentionPanel(["card"], { title: t("要处理"), sub: t("到期、年费、轮换类别、开卡奖励") })}
    ${cards.length ? pickPanel() : ""}
    ${cards.length ? reviewHtml() : ""}
    ${cards.length ? `<div class="section-head" style="margin-top:14px"><h2>${t("我的卡")}</h2><p>${t("{n} 张在用", { n: cards.length })}${catalogAge() > 90 ? ` · <span class="bank-dup">${t("目录更新于 {d}，可能过期，返现规则以发卡行为准", { d: D().AS_OF })}</span>` : ""}</p></div>
      <div class="panel"><ul class="restock-list card-list">${cards.map(cardRow).join("")}</ul></div>` : live.length ? "" : emptyHtml()}
    ${banks.length ? `<div class="section-head" style="margin-top:14px"><h2>${t("银行与投资账户")}</h2><p>${t("支票 / 储蓄 / 券商 / 退休 / HSA / 贷款 / 现金：账单从哪扣、收入入到哪")}</p></div>
      <div class="panel"><ul class="restock-list card-list">${banks.map(cardRow).join("")}</ul></div>` : ""}
    ${gifts.length ? giftSection(gifts) : ""}
    ${ro ? "" : addChips}
    ${off.length ? offSection(off) : ""}
    <p class="muted" style="margin-top:8px;font-size:12.5px" ${ro ? "hidden" : ""}>${t("手机上：一行向右滑 = 停用 / 启用，向左滑 = 删除（删除前会问花费记录怎么办）；电脑上鼠标移到行上出现同样的按钮。")}</p>
    <p class="muted kinds-note" style="margin-top:10px">${t("只记发卡行、产品、末四位、到期年月，不记完整卡号和密码。返现规则来自内置目录或你自己填，会变，以发卡行为准。")}</p>
  </section>`;
}
/* ── 礼品卡：一组、带筛选排序；余额 = 面值 − 花费；用完就停用（右滑） ── */
const GIFT_SORTS = [["balance", "余额：多 → 少"], ["balance_asc", "余额：少 → 多"], ["expiry", "有效期：近 → 远"], ["opened", "购入：新 → 旧"], ["name", "名称 A → Z"]];
const giftFilter = () => (state.giftFilter ||= { issuer: "all", sort: "balance", used: false });
const giftOf = (c) => ({ c, bal: giftBalance(c), exp: c.expires_on ? daysUntil(c.expires_on) : null, n: cardTotal(c.id).n });
   // 名下花费：数据库按卡聚合（card_totals，迁移 057）
function giftRows(gifts) {
  const f = giftFilter();
  const rows = gifts.map(giftOf).filter((g) => (f.issuer === "all" || (g.c.issuer || "") === f.issuer) && (f.used || g.bal == null || g.bal > 0));
  const by = { balance: (a, b) => (b.bal ?? -1) - (a.bal ?? -1), balance_asc: (a, b) => (a.bal ?? 1e12) - (b.bal ?? 1e12), expiry: (a, b) => (a.exp ?? 1e9) - (b.exp ?? 1e9),
    opened: (a, b) => String(b.c.opened_on || "").localeCompare(String(a.c.opened_on || "")), name: (a, b) => String(a.c.name).localeCompare(String(b.c.name), undefined, { sensitivity: "base" }) }[f.sort] || (() => 0);
  return rows.sort((a, b) => by(a, b) || String(a.c.name).localeCompare(String(b.c.name)));
}
function giftSection(gifts) {
  const f = giftFilter(), rows = giftRows(gifts), all = gifts.map(giftOf);
  const total = all.reduce((s, g) => s + Math.max(0, g.bal ?? 0), 0), used = all.filter((g) => g.bal != null && g.bal <= 0).length;
  const issuers = [...new Set(gifts.map((c) => c.issuer || ""))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  const toolbar = gifts.length > 1 ? `<div class="toolbar gift-toolbar">
      ${issuers.length > 1 ? `<select id="giftIssuer" aria-label="${esc(t("按商家筛选"))}">${opt("all", t("全部商家"), f.issuer)}${issuers.map((i) => opt(i, i || t("（没填商家）"), f.issuer)).join("")}</select>` : ""}
      <select id="giftSort" aria-label="${esc(t("排序"))}">${GIFT_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>
      ${used ? `<label class="check-inline"><input type="checkbox" id="giftUsed" ${f.used ? "checked" : ""}><span>${t("显示已用完的（{n}）", { n: used })}</span></label>` : ""}${clearFiltersBtn("gift", changed(f, FD.gift))}</div>` : "";
  return `<div class="section-head" style="margin-top:14px"><h2>${t("礼品卡")}</h2><p>${t("{n} 张卡", { n: gifts.length })}${total ? ` · ${t("余额合计 {m}", { m: money(total) })}` : ""}${used ? ` · ${t("{n} 张已用完", { n: used })}` : ""}</p></div>
    ${toolbar}
    <div class="panel">${rows.length ? `<ul class="restock-list card-list">${rows.map((g) => cardRow(g.c)).join("")}</ul>` : `<p class="muted" style="margin:0">${t("没有符合条件的礼品卡")}</p>`}</div>
    <p class="muted" style="margin:6px 0 0;font-size:12.5px">${t("「商家」填在哪用（Amazon、Target、Costco…），通用的 Visa / Mastercard 礼品卡写「通用」；用完的卡右滑停用，就不会再出现在付款下拉里。")}</p>`;
}
/* ── 停用的卡：按停用时间由近到远；≥ 6 张时给搜索（名字 / 商家 / 末四位）、种类切换、两档排序；一键清理用完的礼品卡 ── */
const OFF_KINDS = [["all", "全部种类"], ["gift", "礼品卡"], ["card", "信用卡 / 借记卡 / 钱包"], ["bank", "银行账户"]];
const offFilter = () => (state.offFilter ||= { q: "", kind: "all", sort: "since" });
const offKindOf = (c) => (c.kind === "gift" ? "gift" : isBankAcct(c) ? "bank" : "card");
const CLEAN_DAYS = 365;
/** 可一键清理的：停用超过一年（或老记录没有停用日期）、余额为 0 / 没填面值、名下没有花费的礼品卡；recent = 一年内停用但其余条件满足的 */
function cleanupPool(off) {
  const ok = (c) => c.kind === "gift" && !cardTotal(c.id).n && !(giftBalance(c) > 0);
  const old = (c) => !c.inactive_since || daysUntil(c.inactive_since) <= -CLEAN_DAYS;
  const pool = off.filter(ok);
  return { eligible: pool.filter(old), recent: pool.filter((c) => !old(c)), withSpend: off.filter((c) => c.kind === "gift" && !(giftBalance(c) > 0) && cardTotal(c.id).n > 0).length };
}
function offSection(off) {
  const f = offFilter(), q = f.q.trim().toLowerCase();
  const counts = { gift: off.filter((c) => offKindOf(c) === "gift").length, card: off.filter((c) => offKindOf(c) === "card").length, bank: off.filter((c) => offKindOf(c) === "bank").length };
  const rows = off.filter((c) => (f.kind === "all" || offKindOf(c) === f.kind) && (!q || [c.name, c.issuer, c.last4].filter(Boolean).some((x) => String(x).toLowerCase().includes(q))))
    .sort(f.sort === "name" ? (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }) : () => 0);   // 默认顺序 = 传进来的停用时间顺序
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  const toolbar = off.length >= 6 ? `<div class="toolbar off-toolbar">
      <input type="search" id="offQ" value="${esc(f.q)}" placeholder="${esc(t("搜名字 / 商家 / 末四位"))}" aria-label="${esc(t("搜索停用的卡"))}">
      <select id="offKind" aria-label="${esc(t("按种类筛选"))}">${OFF_KINDS.filter(([v]) => v === "all" || counts[v]).map(([v, l]) => opt(v, v === "all" ? t(l) : `${t(l)}（${counts[v]}）`, f.kind)).join("")}</select>
      <select id="offSort" aria-label="${esc(t("排序"))}">${opt("since", t("停用时间：近 → 远"), f.sort)}${opt("name", t("名称 A → Z"), f.sort)}</select>${clearFiltersBtn("off", changed(f, FD.off))}</div>` : "";
  const pool = cleanupPool(off), cleanable = pool.eligible.length + pool.recent.length;
  const summary = [counts.gift ? t("礼品卡 {n}", { n: counts.gift }) : "", counts.card ? t("信用卡 {n}", { n: counts.card }) : "", counts.bank ? t("账户 {n}", { n: counts.bank }) : ""].filter(Boolean).join(" · ");
  return `<details class="ref-panel panel" style="margin-top:10px" ${state.cardCleanup || q || f.kind !== "all" || f.sort !== "since" ? "open" : ""}><summary><b>${t("停用的卡")}</b><small>${t("{n} 张卡", { n: off.length })}${summary ? ` · ${summary}` : ""}</small><span class="mch" aria-hidden="true">›</span></summary>
    <div class="ref-body" style="padding:10px 14px 0">${toolbar}
      ${cardsRO() ? "" : state.cardCleanup ? cleanupHtml(pool) : cleanable ? `<p class="muted" style="margin:0 0 8px;font-size:12.5px">${t("有 {n} 张用完的礼品卡可以一键清掉", { n: cleanable })} <button type="button" class="btn btn-sm btn-ghost" data-action="card-cleanup-open">${t("清理")}</button></p>` : ""}</div>
    <ul class="restock-list card-list ref-body" style="padding-top:0">${rows.length ? rows.map(cardRow).join("") : `<li class="muted" style="font-size:13px">${t("没有符合条件的卡")}</li>`}</ul>
    <p class="muted" style="margin:0;padding:6px 14px 10px;font-size:12.5px">${t("按停用时间由近到远；右滑一行可重新启用。停用了但还有余额的会标出来。")}</p></details>`;
}
/** 清理确认：列出要删的卡；一年内停用的可勾选加入；名下有花费的不在这里（单张删除时选保留 / 一起删） */
function cleanupHtml(pool) {
  const inc = !!state.cardCleanupRecent, list = inc ? [...pool.eligible, ...pool.recent] : pool.eligible;
  return `<div class="panel cta-panel card-del-box" role="alertdialog" aria-labelledby="cleanTitle" style="margin-bottom:10px"><div>
      <b id="cleanTitle">${t("清理用完的礼品卡")}</b>
      <p class="muted" style="margin:4px 0 0">${t("条件：余额为 0 或没填面值、名下没有花费记录、停用超过 {d} 天（老记录没有停用日期的也算）。", { d: CLEAN_DAYS })}${pool.withSpend ? ` ${t("另有 {n} 张用完的卡名下有花费，请单张删除并选择花费去留。", { n: pool.withSpend })}` : ""}</p>
      ${pool.recent.length ? `<label class="check-inline" style="margin:6px 0 0"><input type="checkbox" id="cleanRecent" ${inc ? "checked" : ""}><span>${t("也包括 {d} 天内停用的（{n} 张）", { d: CLEAN_DAYS, n: pool.recent.length })}</span></label>` : ""}
      ${list.length ? `<p style="margin:6px 0 0;font-size:13px">${t("将删除 {n} 张：", { n: list.length })}${esc(list.map((c) => c.name).join("、"))}</p>` : `<p class="muted" style="margin:6px 0 0">${t("没有符合条件的卡。")}</p>`}
      <div class="form-actions">
        ${list.length ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="card-cleanup-run">${t("删除这 {n} 张", { n: list.length })}</button>` : ""}
        <button type="button" class="btn btn-sm btn-ghost" data-action="card-cleanup-cancel">${t("取消")}</button></div></div></div>`;
}
export async function runCleanup() {
  if (roStop()) return;
  const off = state.cards.filter((c) => c.active === false), pool = cleanupPool(off);
  const list = state.cardCleanupRecent ? [...pool.eligible, ...pool.recent] : pool.eligible;
  for (const c of list) await Store.deleteCard(c.id);
  state.cardCleanup = false; state.cardCleanupRecent = false;
  await reloadCards(); toast(t("已清掉 {n} 张礼品卡", { n: list.length }));
}
/** 删除卡前的确认：这张卡名下的花费记录怎么办——保留（花费上改成文字）还是一起删 */
function deleteConfirmHtml(id) {
  const c = cardById(id); if (!c) return "";
  const tot = cardTotal(c.id), ps = { length: tot.n }, sum = tot.sum;   // 名下花费的笔数、合计（card_totals）
  const bills = state.bills.filter((b) => b.pay_card_id === c.id).length;
  const label = `${kindName(c.kind)} · ${c.name}`.slice(0, 40);
  return `<div class="panel cta-panel card-del-box" role="alertdialog" aria-labelledby="cardDelTitle"><div>
      <b id="cardDelTitle">${t("删除「{name}」？", { name: c.name })}</b>
      <p class="muted" style="margin:4px 0 0">${ps.length ? t("这张卡名下有 {n} 笔花费记录，合计 {m}。", { n: ps.length, m: money(sum) }) : t("这张卡名下没有花费记录。")}${bills ? ` ${t("有 {n} 条账单从它扣款，删除后改成未指定。", { n: bills })}` : ""}</p>
      <div class="form-actions">
        ${ps.length ? `<button type="button" class="btn btn-sm btn-primary" data-action="card-del-keep" data-id="${esc(c.id)}">${t("保留花费，只删卡")}</button>
          <button type="button" class="btn btn-sm btn-danger-ghost" data-action="card-del-all" data-id="${esc(c.id)}">${t("连 {n} 笔花费一起删", { n: ps.length })}</button>`
        : `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="card-del-all" data-id="${esc(c.id)}">${t("删除")}</button>`}
        <button type="button" class="btn btn-sm btn-ghost" data-action="card-del-cancel">${t("取消")}</button></div>
      ${ps.length ? `<small class="muted">${t("保留时花费上的付款方式改成文字「{label}」，统计照旧算进去。", { label })}</small>` : ""}</div></div>`;
}
const emptyHtml = () => `<div class="panel empty"><strong>${t("还没有卡")}</strong>${t("从内置目录选一张常见卡，填上末四位、到期月、还款日就行；不在目录里的手填规则。")}<p><a class="btn btn-primary" href="${cardHref("new")}">${t("添加第一张卡")}</a></p></div>`;
function cardRow(c) {
  const offSince = c.active === false && c.inactive_since ? t("停用于 {d}", { d: fmtDate(c.inactive_since) }) : null;
  if (c.kind === "gift") {   // 礼品卡：右侧大字余额；商家、购入日期、有效期、几笔花费
    const g = giftOf(c), tags = [];
    if (g.exp != null && g.exp < 0) tags.push(`<span class="badge b-out">${t("已过期")}</span>`); else if (g.exp != null && g.exp <= 60) tags.push(`<span class="badge b-soon">${t("{d} 天后到期", { d: g.exp })}</span>`);
    if (g.bal != null && g.bal <= 0) tags.push(`<span class="badge" style="background:var(--surface-2)">${t("已用完")}</span>`);
    if (c.active === false && g.bal != null && g.bal > 0) tags.push(`<span class="badge b-soon">${t("还有余额 {m}", { m: money(g.bal) })}</span>`);   // 停用了但没用完：多半是误停用或又充值了
    return `<li class="card-row gift-row ${c.active === false ? "inactive" : ""}" ${swipeAttrs(c)} ${lpCard(c)}><span class="card-net net-gift" aria-hidden="true">🎁</span>
      <div class="grow"><a class="link-name" href="${cardHref(c.id)}">${d(c.name)}</a>${c.last4 ? ` <span class="muted">••${d(c.last4)}</span>` : ""}
        <small>${[c.issuer, holderName(c), c.opened_on ? t("{d} 购入", { d: fmtDate(c.opened_on) }) : null, c.expires_on ? t("有效期至 {d}", { d: String(c.expires_on).slice(0, 7) }) : null, g.n ? t("{n} 笔花费", { n: g.n }) : null, offSince].filter(Boolean).map(esc).join(" · ")}</small>
        ${tags.length ? `<div class="card-tags">${tags.join(" ")}</div>` : ""}</div>
      ${g.bal != null ? `<b class="gift-bal ${g.bal <= 0 ? "done" : ""}">${g.bal <= 0 ? t("已用完") : money(g.bal)}${c.balance != null && g.bal > 0 ? `<small>/ ${money(num(c.balance))}</small>` : ""}</b>` : `<span class="gift-bal done">${t("未填面值")}</span>`}
      ${rowActs(c)}</li>`;
  }
  if (noRewards(c)) {   // 银行账户：没有返现 / 到期，只看哪些账单从这里扣、记了多少笔
    const bills = state.billsEnriched.filter((b) => b.pay_card_id === c.id && b.active), n = cardTotal(c.id).n;
    return `<li class="card-row ${c.active === false ? "inactive" : ""}" ${swipeAttrs(c)} ${lpCard(c)}><span class="card-net net-bank" aria-hidden="true">${t(ACCT_SHORT[c.kind] || "支票")}</span>
      <div class="grow"><a class="link-name" href="${cardHref(c.id)}">${d(c.name)}</a>${c.last4 ? ` <span class="muted">••${d(c.last4)}</span>` : ""}
        <small>${[c.issuer, holderName(c), bills.length ? t("{n} 条账单从这里扣：{names}", { n: bills.length, names: bills.slice(0, 3).map((b) => b.name).join("、") + (bills.length > 3 ? "…" : "") }) : t("还没有账单从这里扣"), n ? t("{n} 笔花费", { n }) : null, offSince].filter(Boolean).map(esc).join(" · ")}</small></div>
      ${rowActs(c)}</li>`;
  }
  const ed = expDays(c), fd = feeDays(c), rot = rotatingNow(c), bl = bonusLeft(c), rw = c.rewards || {};
  const best = Object.entries(rw.cats || {}).sort((a, b) => num(b[1]) - num(a[1])).slice(0, 3).map(([k, v]) => `${rewardCatIcon(k)} ${v}%`).join(" ");
  const tags = [];
  if (ed != null && ed < 0) tags.push(`<span class="badge b-out">${t("已过期")}</span>`); else if (ed != null && ed <= 60) tags.push(`<span class="badge b-soon">${t("{d} 天后到期", { d: ed })}</span>`);
  if (fd != null && fd <= 30) tags.push(`<span class="badge b-soon">${t("年费 {a}", { a: money(num(c.annual_fee)) })}</span>`);
  if (rot?.empty) tags.push(`<span class="badge b-soon">${t("本季类别未填")}</span>`); else if (rot && !rot.activated) tags.push(`<span class="badge b-soon">${t("本季未激活")}</span>`); else if (rot) tags.push(`<span class="badge b-ok">${t("本季 5%：{c}", { c: (rot.cats || []).map(rewardCatName).join(" / ") })}</span>`);
  if (bl) tags.push(`<span class="badge b-low">${t("开卡奖励还差 {a}", { a: money(bl.left) })}</span>`);
  const bill = c.bill_id && state.billsEnriched.find((b) => b.id === c.bill_id);
  const bars = [];
  if (c.bonus?.spend && !c.bonus.done) { const spent = num(c.bonus.spent_manual ?? usage(c).bonusSpent, 0), pct = Math.min(100, Math.round(spent / c.bonus.spend * 100)); bars.push(progressHtml(t("开卡奖励"), pct, `${money(spent)} / ${money(c.bonus.spend)}${c.bonus.by ? ` · ${t("{d} 天", { d: Math.max(0, bonusLeft(c)?.days ?? 0) })}` : ""}`)); }
  for (const [cat, cap] of Object.entries(c.rewards?.caps || {})) { const used = usage(c).cap(cat); if (cap?.limit && used > 0) bars.push(progressHtml(`${cat === "*" ? t("奖励类别合计") : rewardCatName(cat)} ${t("封顶")}`, Math.min(100, Math.round(used / cap.limit * 100)), `${money(used)} / ${money(cap.limit)}`)); }
  const rot0 = rotatingNow(c), rotLim = num(rot0?.cap ?? c.rewards?.rotating_cap, 0);
  if (rot0 && !rot0.empty && rotLim) { const used = usage(c).rotUsed(); bars.push(progressHtml(t("本季轮换封顶"), Math.min(100, Math.round(used / rotLim * 100)), `${money(used)} / ${money(rotLim)}`)); }
  const NET_SHORT = { visa: "VISA", mastercard: "MC", amex: "AMEX", discover: "DISC", unionpay: "银联", other: "卡" };
  return `<li class="card-row ${c.active === false ? "inactive" : ""}" ${swipeAttrs(c)} ${lpCard(c)}><span class="card-net net-${esc(c.network || "other")}" aria-hidden="true" title="${esc(networkName(c.network))}">${esc(NET_SHORT[c.network] || NET_SHORT.other)}</span>
    <div class="grow"><a class="link-name" href="${cardHref(c.id)}">${d(c.name)}</a>${c.last4 ? ` <span class="muted">••${d(c.last4)}</span>` : ""}
      <small>${[holderName(c), c.expires_on ? t("到期 {d}", { d: c.expires_on.slice(0, 7) }) : null, num(c.annual_fee) ? t("年费 {a}", { a: money(num(c.annual_fee)) }) : t("无年费"), bill ? t("还款 {d}", { d: fmtDate(bill.next_due_on) }) : c.due_day ? t("每月 {d} 号还款", { d: c.due_day }) : null, best ? `${t("其他 {b}%", { b: num(rw.base, 0) })} · ${best}` : t("所有消费 {b}%", { b: num(rw.base, 0) })].filter(Boolean).map(esc).join(" · ")}</small>
      ${tags.length ? `<div class="card-tags">${tags.join(" ")}${offSince ? ` <span class="badge" style="background:var(--surface-2)">${esc(offSince)}</span>` : ""}</div>` : offSince ? `<div class="card-tags"><span class="badge" style="background:var(--surface-2)">${esc(offSince)}</span></div>` : ""}${bars.length ? `<div class="card-bars">${bars.join("")}</div>` : ""}</div>
    ${rowActs(c)}</li>`;
}
/** 长按这一行的菜单（js/core/long-press.js）：编辑 / 停用·启用 / 删除 */
const lpCard = (c) => (cardsRO() ? "" : lpAttr([{ label: t("编辑"), href: cardHref(c.id), first: true }, { label: c.active === false ? t("启用") : t("停用"), action: c.active === false ? "card-react" : "card-deact", data: { id: c.id } }, { label: t("删除"), action: "card-del", data: { id: c.id }, danger: true }], c.name));
/** 行的手势属性：右滑 停用 / 启用，左滑 删除（js/swipe-rows.js） */
const swipeAttrs = (c) => cardsRO() ? "" : `data-swipe-del="card" data-swipe-alt="card" data-swipe-alt-label="${esc(c.active === false ? t("启用") : t("停用"))}" data-swipe-alt-go="${esc(c.active === false ? t("松手启用") : t("松手停用"))}"`;
/** 行右侧：编辑 + （手势 / 悬停才出现的）停用 / 启用、删除 */
const rowActs = (c) => cardsRO() ? "" : `<span class="row-acts"><a class="btn btn-sm btn-ghost" href="${cardHref(c.id)}">${t("编辑")}</a>
    <button type="button" class="btn btn-sm btn-ghost swipe-alt-src" data-action="${c.active === false ? "card-react" : "card-deact"}" data-id="${esc(c.id)}">${c.active === false ? t("启用") : t("停用")}</button>
    <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="card-del" data-id="${esc(c.id)}" aria-label="${esc(t("删除 {name}", { name: c.name }))}">${t("删除")}</button></span>`;
/** 停用 / 启用：记停用日期，「停用的卡」按它排 */
export async function setCardActive(id, on) {
  if (roStop()) return;
  const c = cardById(id); if (!c) return;
  await Store.saveCard({ ...c, active: on, inactive_since: on ? null : todayISO() });
  await reloadCards();
  toast(on ? t("已启用「{name}」", { name: c.name }) : t("已停用「{name}」，在「停用的卡」里", { name: c.name }));
}
const progressHtml = (label, pct, text) => `<div class="prog"><span>${esc(label)}</span><i class="prog-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><b style="width:${pct}%"></b></i><small>${esc(text)}</small></div>`;
