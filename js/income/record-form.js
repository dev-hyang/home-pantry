/* 记一笔收入的表单：入账账户、其他默认值（付款方 / 类型 / 收款方式）、表单本体。 */
import { $, esc, num, toast, todayISO } from "../core/util.js";
import { ACCT_KINDS, CARDS_HREF } from "../bills/cards.js";
import { CHANNELS, GAIN_KINDS, inc, isIncomeKind, isOwnerNow, kindList, kindOptionsHtml, knownSenders, loadIncome, myPersonId, personName, similarIncome, skey } from "./logic.js";
import { Store } from "../core/store.js";
import { ensureBorrowDebt } from "../bills/debt-logic.js";
import { meta, saveMeta } from "../bills/budget.js";
import { rerender } from "./rollup.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { cur, fmtMoney, incomeHref, personOptions, selOpts } from "./shared.js";
import { go } from "../core/router.js";
import { acctById } from "../bills/card-picker.js";

/* ── 入账账户：「卡与账户」里登记的账户（支票 / 储蓄 / 券商 / 退休 / HSA / 借记卡 / 钱包 / 现金…），可设默认 ──
 * 记录上存 account_id（迁移 056）和一份文字 account（「名称 **尾号」，显示兜底；没登记的现金存「现金」，其他手填）。
 * 默认账户按人存在预算设置 _income_cfg.defAcct[用户 id]（登记账户的 id 或 cash）。 */
const INCOME_ACCT_KINDS = ["checking", "savings", "brokerage", "retirement", "hsa", "cash", "debit", "wallet", "loan"];
const INCOME_ACCT_EXTRA = [["cash", "现金（没登记的）"], ["other", "其他（手填）"]];
const acctText = (c) => `${c.name}${c.last4 ? ` **${c.last4}` : ""}`;
const incomeAccts = () => (state.cards || []).filter((c) => INCOME_ACCT_KINDS.includes(c.kind || "credit"));
const hasBankAcct = () => incomeAccts().some((c) => c.active !== false);
export const incCfg = () => meta("_income_cfg", {}) || {};
export const defAcct = () => incCfg().defAcct?.[state.user?.id || "me"] || "";
/** 默认账户还在（没被删 / 没停用）才用 */
const defAcctValid = () => { const v = defAcct(); return v === "cash" || (v && incomeAccts().some((c) => c.id === v && c.active !== false)) ? v : ""; };
/** 记录 → 下拉的值：登记账户 id / cash / other / 空。有 account_id 用它；老记录按原来的文字对上登记过的账户 */
function acctValueOf(r) {
  if (r.account_id && acctById(r.account_id)) return r.account_id;
  const s = String(r.account || "").trim(); if (!s) return "";
  if (s === "现金" || /^cash$/i.test(s)) return "cash";
  const list = incomeAccts(), exact = list.find((c) => acctText(c) === s || c.name === s);
  if (exact) return exact.id;
  const byLast4 = list.find((c) => c.last4 && new RegExp(`(^|[^0-9])${c.last4}($|[^0-9])`).test(s));   // 银行导入记的「Chase ····1234」这类
  return byLast4 ? byLast4.id : "other";
}
function acctSelectHtml(sel) {
  const def = defAcct(), list = incomeAccts().filter((c) => c.active !== false || c.id === sel);
  const opt = (v, label) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(label)}${v && v === def ? ` ★ ${t("默认")}` : ""}</option>`;
  const groups = Object.entries(ACCT_KINDS).map(([k, [name]]) => { const cs = list.filter((c) => (c.kind || "credit") === k); return cs.length ? `<optgroup label="${esc(t(name))}">${cs.map((c) => opt(c.id, acctText(c))).join("")}</optgroup>` : ""; }).join("");
  return `${opt("", t("（未指定）"))}${groups}${INCOME_ACCT_EXTRA.map(([v, l]) => opt(v, t(l))).join("")}`;
}
/* ── 其他默认值（选填）：付款方 / 类型 / 收款方式，同样按人存在 _income_cfg.defs[用户 id]；只在「新记一笔」时预填 ── */
export const DEF_FIELDS = [["source_name", "付款方"], ["kind", "类型"], ["channel", "收款方式"]];
export const defOf = (k) => String(incCfg().defs?.[state.user?.id || "me"]?.[k] || "");
/** 类型 / 收款方式的默认值已经被删掉（自定义类型）时不再用 */
const defValid = (k) => { const v = defOf(k); return k === "kind" ? (kindList().some((x) => x.id === v) ? v : "") : k === "channel" ? (CHANNELS.some((c) => c[0] === v) ? v : "") : v; };
const defsHtml = (r) => `<div class="ix-acct-def"><small class="muted">${t("设为我的默认（选填，下次记收入时自动带上）")}</small><div class="chips">${DEF_FIELDS.map(([k, l]) => `<label class="check-inline"><input type="checkbox" name="def_${k}" data-inc-def="${k}" ${r[k] && r[k] === defValid(k) ? "checked" : ""}><span>${t(l)}</span></label>`).join("")}</div></div>`;
async function saveDefaults(fd) {
  const g = (k) => String(fd.get(k) ?? "").trim(), cfg = incCfg(), uid = state.user?.id || "me", mine = { ...(cfg.defs?.[uid] || {}) };
  let changed = false;
  for (const [k] of DEF_FIELDS) {
    const want = fd.get(`def_${k}`) === "on", val = g(k), was = defOf(k);
    const next = want && val ? val : !want && val === was ? "" : was;   // 勾上：记住当前值；取消勾选且当前值正是默认：清掉
    if (next !== was) { changed = true; if (next) mine[k] = next; else delete mine[k]; }
  }
  if (changed) await saveMeta({ _income_cfg: { ...cfg, defs: { ...(cfg.defs || {}), [uid]: mine } } });
}
async function saveDefaultAcct(value) {
  const cfg = incCfg(); await saveMeta({ _income_cfg: { ...cfg, defAcct: { ...(cfg.defAcct || {}), [state.user?.id || "me"]: value } } });
}
/* ── 表单 ── */
/** 类型下面的一句说明：资本流入不算收入；卖出类可以填「其中已实现收益」 */
export const kindHint = (kind) => (kind === "zelle" || kind === "reimburse" ? t("朋友 AA 还你、替人垫付后还回、报销：是你自己的钱回来了，不算收入——请在 花费 里记一笔负数（勾「退款 / 报销」，选当初那笔的分类）。这里只记真正的收入：赠与、副业收款等。")
  : GAIN_KINDS.includes(kind) ? t("卖出 / 资本利得：到账金额里只有赚的那部分算收入，填在下面「其中已实现收益」；不填 = {d}。", { d: isIncomeKind(kind) ? t("整笔都算收入") : t("整笔都不算收入") })
  : isIncomeKind(kind) ? "" : t("资本与资产流入：记下来（现金流里看得到），但不算收入。"));
export function formHtml() {
  const I = inc(), f = I.form, owner = isOwnerNow(), mine = myPersonId();
  let r = f.rec || {};
  const person = r.person_id !== undefined ? r.person_id : mine, d = (v) => esc(v ?? "");
  if (!r.id) r = { ...r, source_name: r.source_name || defValid("source_name") || undefined, kind: r.kind || defValid("kind") || undefined, channel: r.channel || defValid("channel") || undefined };   // 新记一笔：预填默认的付款方 / 类型 / 收款方式
  const accVal = r.id ? acctValueOf(r) : defAcctValid(), kind = r.kind || "other", gain = GAIN_KINDS.includes(kind) || r.income_amount != null;   // 新记一笔默认选上你设的默认账户；编辑按 account_id（老记录按文字）对上登记过的账户
  const persons = owner ? personOptions(person || "none") : `<option value="${mine || "none"}">${esc(personName(mine) || t("未指定 / 全家"))}</option>`;
  return `<form class="panel" data-inc-form="record" id="incForm" autocomplete="off"><h3 style="margin:0 0 8px">${r.id ? t("编辑收入") : t("记一笔收入")}</h3>
    <div class="form-grid">
      <label>${t("到账日期")}<input type="date" name="received_on" value="${d(r.received_on || todayISO())}" max="${todayISO()}" required></label>
      <label>${t("到账金额")}（${esc(cur())}）<input type="number" name="amount" step="0.01" min="0.01" inputmode="decimal" value="${d(r.amount)}" required></label>
      <label>${t("谁给的（付款方 / 雇主）")}<input name="source_name" list="incSenders" maxlength="80" value="${d(r.source_name)}" required placeholder="${esc(t("公司名 / 汇款人"))}"><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label>${t("类型")}<select name="kind" data-inc-kind>${kindOptionsHtml(kind)}</select><small class="muted" data-inc-kind-hint>${esc(kindHint(kind))}</small></label>
      <label data-inc-gain ${gain ? "" : "hidden"}>${t("其中已实现收益（算收入的部分，选填）")}<input type="number" name="income_amount" step="0.01" min="0" inputmode="decimal" value="${d(r.income_amount)}" aria-describedby="incGainHelp"><small class="muted" id="incGainHelp">${t("例：成本 $10,000 的股票卖了 $15,000，到账 15,000，这里填 5,000。")}</small></label>
      <label>${t("收款方式")}<select name="channel" data-nosearch><option value="">${t("未填")}</option>${selOpts(CHANNELS, r.channel)}</select></label>
      ${defsHtml(r)}
      <label>${t("这是谁的收入")}<select name="person_id" data-nosearch>${persons}</select></label>
      <label>${t("入到哪个账户")}<select name="acct_sel" data-inc-acct>${acctSelectHtml(accVal)}</select>
        <input name="account" maxlength="60" value="${accVal === "other" ? d(r.account) : ""}" placeholder="Chase ····1234" style="margin-top:6px" ${accVal === "other" ? "" : "hidden"}></label>
      <div class="ix-acct-def"><label class="check-inline"><input type="checkbox" name="acct_default" ${accVal && accVal === defAcct() ? "checked" : ""}><span>${t("设为我的默认入账账户")}</span></label>
        ${hasBankAcct() ? "" : `<small class="muted">${t("还没登记账户？到「卡与账户」里登记银行、券商、退休账户后，这里就能选。")} <a href="${CARDS_HREF()}">${t("去登记")}</a></small>`}</div>
      <label>${t("备注")}<input name="notes" maxlength="500" value="${d(r.notes)}"></label></div>
    <details style="margin-top:8px" ${r.orig_amount || r.fee != null ? "open" : ""}><summary>${t("国际电汇 / 外币（选填）")}</summary><div class="form-grid" style="margin-top:6px">
      <label>${t("汇出金额（原币种）")}<input type="number" name="orig_amount" step="0.01" min="0" value="${d(r.orig_amount)}"></label><label>${t("原币种")}<input name="orig_currency" maxlength="3" value="${d(r.orig_currency)}" placeholder="CNY"></label>
      <label>${t("手续费")}<input type="number" name="fee" step="0.01" min="0" value="${d(r.fee)}"></label></div><small class="muted">${t("到账金额填实际收到的（已扣手续费、已换成家庭货币）；这里只是留个底，方便对账。")}</small></details>
    <label class="check-inline" style="margin-top:8px"><input type="checkbox" name="repay_required" data-inc-repay ${r.repay_required ? "checked" : ""}><span>${t("需要还（个人赠与 / 借款）——当借款到账，不算收入")}</span></label>
    <div class="form-grid" data-inc-repay-box ${r.repay_required ? "" : "hidden"} style="margin-top:6px"><label>${t("还款到期日")}<input type="date" name="repay_due_on" value="${d(r.repay_due_on)}"></label><label>${t("需要还的总额（空 = 收到的金额）")}<input type="number" name="repay_amount" step="0.01" min="0" value="${d(r.repay_amount)}"></label></div>
    <p class="form-error" role="alert" id="incFormErr" hidden></p>
    <div class="form-actions"><button class="btn btn-primary" id="incSave">${t("保存")}</button><button type="button" class="btn btn-ghost" data-inc="cancel">${t("取消")}</button></div></form>`;
}
export async function saveRecord(form) {
  const I = inc(), f = I.form, fd = new FormData(form), g = (k) => String(fd.get(k) ?? "").trim(), err = $("#incFormErr");
  const fail = (m) => { if (err) { err.textContent = m; err.hidden = false; } };
  const amount = num(g("amount")), name = g("source_name");
  if (!(amount > 0)) return fail(t("请填写大于 0 的金额"));
  if (!name) return fail(t("请填写付款方"));
  const gainBox = form.querySelector("[data-inc-gain]"), gainRaw = gainBox && !gainBox.hidden ? g("income_amount") : "";
  const income_amount = gainRaw === "" ? null : Math.round(num(gainRaw) * 100) / 100;
  if (income_amount != null && !(income_amount >= 0 && income_amount <= amount)) return fail(t("「其中已实现收益」要在 0 和到账金额之间"));
  const repay = fd.get("repay_required") === "on", pid = g("person_id");
  const accSel = g("acct_sel"), accCard = accSel && accSel !== "cash" && accSel !== "other" ? acctById(accSel) : null;
  const account = accSel === "cash" ? "现金" : accSel === "other" ? g("account") || null : accCard ? acctText(accCard) : null;
  const row = { id: f.rec?.id, received_on: g("received_on") || todayISO(), amount, currency: cur(), orig_amount: num(g("orig_amount")) > 0 ? num(g("orig_amount")) : null, orig_currency: g("orig_currency").toUpperCase().slice(0, 3) || null,
    fee: g("fee") === "" ? null : num(g("fee")), source_name: name, kind: g("kind") || "other", channel: g("channel") || null, person_id: pid && pid !== "none" ? pid : null, account, account_id: accCard?.id || null, income_amount,
    import_batch: f.rec?.import_batch || null, repay_required: repay, repay_due_on: repay ? g("repay_due_on") || null : null, repay_amount: repay && num(g("repay_amount")) > 0 ? num(g("repay_amount")) : null, notes: g("notes") || null };
  if (row.orig_currency && !/^[A-Z]{3}$/.test(row.orig_currency)) return fail(t("原币种填 3 位字母，如 CNY"));
  const dup = !row.id && similarIncome(row), key = `${row.received_on}|${row.amount}|${skey(name)}`;
  if (dup && f.dupAck !== key) { f.dupAck = key; return fail(t("看起来已经记过：{d} · {n} · {a}。确认不是重复的话，再点一次保存。", { d: dup.received_on, n: dup.source_name, a: fmtMoney(dup.amount) })); }
  try {
    const savedId = await Store.saveIncomeRecord(row);
    if (repay && state.debtsOk) await ensureBorrowDebt({ ...row, id: row.id || savedId }).catch((e) => console.warn("[debt]", e.message));   // 需要还 = 借入：建（或更新）对应的借款（迁移 058）
    await saveDefaults(fd).catch(() => toast(t("默认值没存上，下次再试")));
    const was = defAcct(), want = fd.get("acct_default") === "on";   // 勾「设为默认」：记住；取消勾选且现在选的正是默认：清掉
    const next = want && accSel && accSel !== "other" ? accSel : !want && accSel && accSel === was ? "" : was;
    if (next !== was) await saveDefaultAcct(next).catch(() => toast(t("默认账户没存上，下次再试")));
    if (I.drafts && f.rec?.id) delete I.drafts[f.rec.id];
    const onPage = !!state.route?.q?.get("form"), back = onPage && f.rec?.id; I.form = null; await loadIncome(); toast(t("已保存")); if (back) return go(`${incomeHref("records")}&view=${encodeURIComponent(back)}`, { replace: true }); if (onPage) return go(incomeHref("records"), { replace: true }); rerender(); }
  catch (e) { fail(/income_amount|account_id/i.test(e.message || "") ? t("数据库还没升级：请先执行 supabase/migrations/056_income_ledger.sql") : t("保存失败：{msg}", { msg: e.message })); }
}
