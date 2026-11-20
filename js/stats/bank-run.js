/* 银行对账单导入：真正导入、撤销、批次。 */
import { AA_BACK, learnedKey, refundRules, ruleCat, ruleUse, todayStr, userRules } from "./bank-transfers.js";
import { BATCH_KEEP, S, cur } from "./bank-rows.js";
import { NO_ACCT, accounts } from "./bank-accounts-ai.js";
import { Store } from "../core/store.js";
import { guessChannel, incomeRules, loadIncome } from "../income/logic.js";
import { incWho, redraw } from "./bank-ui.js";
import { merchantName } from "./bank-csv.js";
import { meta, saveMeta } from "../bills/budget.js";
import { num, toast } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { incomeOk, bankHooks } from "./bank-common.js";

/* ───────────── 导入 / 撤销 ───────────── */
export async function doImport() {
  if (S.busy) return; S.busy = true; redraw();
  const picks = [], learned = {}, hits = {};
  for (const g of S.groups) {
    if (g.inc) {   // 入账组只进 income_records；只有选了「支出退回」的记成负数花费（不算收入）
      const rc = S.rcat[g.id];
      if (S.include[g.id] && S.ikind[g.id] === AA_BACK && rc) for (const r of g.rows) { if (r.idup && !r.forced) continue; picks.push({ r, cat: rc, name: t("{n} · 支出退回", { n: g.name }), store: g.name }); }
      continue;
    }
    if (!S.include[g.id]) continue; const cat = S.pick[g.id]; if (!cat) continue;   // 收入组只进 income_records，不能再记一笔负花费（以前 Zelle / 电汇转入会预选「账户间转账」，两边都记了）
    for (const r of g.rows) { if (r.dup) continue; picks.push({ r, cat }); }
    // 只记你改过的（或原来认不出、你选了的）；自动归出来的不记，免得把归错的也「学」进去，以后一直错
    if (S.remember && !g.skip && cat && g.id.indexOf("__") !== 0 && cat !== S.auto[g.id]) learned[g.id] = cat;
    else if (g.src === "learned" && cat === S.auto[g.id] && !g.skip) hits[g.id] = (hits[g.id] || 0) + g.rows.filter((r) => !r.dup).length;   // 靠记住的规则归对了
  }
  const ids = [], rowsDone = []; let sum = 0, failed = 0;
  const batchId = `b${Date.now().toString(36)}`;   // 每笔花费记上批次 id（迁移 034）；没执行迁移时退回只记 id 列表
  let tagged = !S.noBatchCol;
  const one = async ({ r, cat, name, store }) => {
    const row = { item_id: null, name: name || merchantName(r.desc), category: cat, quantity: null, unit: null, store: store || merchantName(r.desc), amount: r.out, currency: cur(), purchased_at: new Date(`${r.date}T12:00:00`).toISOString(), ...(S.account.mode === "id" && String(S.account.id).startsWith("card:") ? { card_id: String(S.account.id).slice(5) } : {}) };
    try {
      let id;
      try { id = await Store.addPurchase(tagged ? { ...row, import_batch: batchId } : row); }
      catch (e) { if (tagged && /import_batch/i.test(e.message)) { tagged = false; S.noBatchCol = true; id = await Store.addPurchase(row); } else throw e; }   // 还没执行迁移 034：不记批次，照旧导入
      ids.push(id); sum += r.out; rowsDone.push({ id, name: merchantName(r.desc), category: cat, amount: r.out, date: r.date });
    } catch (e) { failed++; }
  };
  for (let i = 0; i < picks.length; i += 6) await Promise.all(picks.slice(i, i + 6).map(one));   // 6 个一组并发，云端模式几百笔也不会太慢
  // 账户标签：新账户记进列表；这批的日期范围按文件里全部交易算（跳过的还款 / 转账也在范围里，免得月份缺口误报）
  let acctList = meta("_bank_accounts", []) || [], acct = null, metaFailed = false;
  if (S.account.mode === "new" && S.account.name.trim()) { acct = { id: `a${Date.now().toString(36)}`, name: S.account.name.trim().slice(0, 40), last4: S.account.last4 || "" }; acctList = [...acctList, acct]; }
  else if (S.account.mode === "id") acct = accounts().find((x) => x.id === S.account.id) || null;
  const cardId = acct && String(acct.id).startsWith("card:") ? String(acct.id).slice(5) : "";   // 选的是用卡模块里的卡：花费记到这张卡上（复盘 / 封顶进度用）
  const dates = S.rows.map((r) => r.date).sort();
  const batch = { id: batchId, at: new Date().toISOString(), file: S.parts.map((x) => x.name).join(", ").slice(0, 1000), files: S.parts.map((x) => String(x.name).slice(0, 150)).slice(0, 30),   // file 原来只留 60 个字符，几份文件的名字被截断；现在留 1000，另存每个文件名（files）
    ids: tagged ? [] : ids, tagged, sum: Math.round(sum * 100) / 100, n: ids.length,
    account: acct ? acct.name : "", last4: acct ? acct.last4 : "", from: dates[0] || "", to: dates.at(-1) || "" };
  // 入账（收入）：勾上的付款方写进 income_records（和花费分开存、权限也不同）；用同一个批次 id，撤销这批时一起删。
  // 选的是「卡与账户」里登记的账户：同时记 account_id（迁移 056），收入页能按账户筛；文字 account 照旧留着显示
  let inN = 0, incFailed = false; const learnedInc = {};
  if (incomeOk()) {
    const acctLabel = acct ? `${String(acct.name).replace(/^[^\p{L}\p{N}]+/u, "")}${acct.last4 && !String(acct.name).includes(acct.last4) ? ` **${acct.last4}` : ""}` : null,   // 去掉名字前的图标；和「收入 → 入到哪个账户」里的「名称 **尾号」同一个写法，编辑时对得上登记过的账户
      who = incWho() === "none" ? null : incWho(), rowsIn = [];
    for (const g of S.groups) {
      if (!g.inc || !S.include[g.id] || S.ikind[g.id] === AA_BACK) continue;
      const kind = S.ikind[g.id] || "other";
      for (const r of g.rows) { if (r.idup && !r.forced) continue; rowsIn.push({ received_on: r.date, amount: Math.round(-r.out * 100) / 100, currency: cur(), orig_amount: null, orig_currency: null, fee: null, source_name: g.name, kind, channel: guessChannel(r.desc), person_id: who, account: acctLabel, account_id: cardId || null, income_amount: null, import_batch: batchId, repay_required: false, repay_due_on: null, repay_amount: null, notes: null }); }
      if (S.remember && kind !== S.auto[g.id]) learnedInc[g.id.slice(3)] = kind;
    }
    if (rowsIn.length) { try { await Store.addIncomeRecords(rowsIn); inN = rowsIn.length; batch.inN = inN; batch.inSum = Math.round(rowsIn.reduce((a, r) => a + r.amount, 0) * 100) / 100; } catch (e) { incFailed = true; } }
    if (inN || incFailed) await loadIncome();
  }
  const refRules = { ...refundRules() }; let refChanged = false;
  if (S.remember) for (const g of S.groups) {
    if (!g.inc || !S.include[g.id]) continue; const key = g.id.slice(3);
    if (S.ikind[g.id] === AA_BACK && S.rcat[g.id]) { if (refRules[key] !== S.rcat[g.id]) { refRules[key] = S.rcat[g.id]; refChanged = true; } }
    else if (refRules[key]) { delete refRules[key]; refChanged = true; }   // 这次改成了收入类型：以后按收入类型来
  }
  try {
    const rules = { ...userRules() }, today = todayStr();
    for (const [k, c] of Object.entries(learned)) { const old = rules[learnedKey(k)] || rules[k]; rules[k] = { c, n: ruleUse(old).n, t: today }; }   // 你这次改的：记下来（沿用以前的次数）
    for (const [k, n] of Object.entries(hits)) { const lk = learnedKey(k); if (lk && !learned[lk] && !learned[k]) rules[lk] = { c: ruleCat(rules[lk]), n: ruleUse(rules[lk]).n + n, t: today }; }   // 这次靠规则归对的：用过 +1、更新最近日期
    const keys = Object.keys(rules);
    if (keys.length > 400) keys.map((k, i) => [k, ruleUse(rules[k]), i]).sort((a, b) => a[1].t.localeCompare(b[1].t) || a[1].n - b[1].n || a[2] - b[2]).slice(0, keys.length - 400).forEach(([k]) => delete rules[k]);   // 满了：先淘汰最久没用到的（旧格式没日期的最先）
    // 最近 60 批留着（查看 / 修改 / 撤销靠花费上的批次 id）；没执行迁移 034 的旧批次靠 id 列表，只有最近 6 批保留（免得预算设置里存太多）
    const all = [...(meta("_bank_batches", []) || []), ...(ids.length || (S.rows.length && !failed) ? [batch] : [])].slice(-BATCH_KEEP).map((b, i, arr) => (!b.tagged && i < arr.length - 6 ? { ...b, ids: [], n: b.n ?? b.ids?.length ?? 0 } : b));
    await saveMeta({ _bank_rules: rules, _bank_batches: all, _bank_accounts: acctList.slice(-30), ...(Object.keys(learnedInc).length ? { _income_rules: Object.fromEntries(Object.entries({ ...incomeRules(), ...learnedInc }).slice(-300)) } : {}), ...(refChanged ? { _refund_rules: Object.fromEntries(Object.entries(refRules).slice(-300)) } : {}) });
  } catch (e) { metaFailed = true; }   // 花费已经导入了；只是批次记录 / 覆盖表没存上，要告诉用户，不能悄悄吞掉
  S.force = new Set(); S.ikind = {}; S.rcat = {}; S.busy = false; S.last = { n: ids.length, sum: batch.sum, id: batch.id }; S.parts = []; S.groups = []; S.rows = []; S.pick = {}; S.include = {}; S.status = ""; S.acctTouched = false; S.account = NO_ACCT();   // 下一批回到默认「不选择」
  toast((failed ? t("导入了 {n} 笔，{k} 笔失败", { n: ids.length, k: failed }) : ids.length ? t("已导入 {n} 笔", { n: ids.length }) : inN ? "" : t("没有新的花费要导入（都已经记录过）"))
    + (inN ? (ids.length ? t("；另记了 {n} 笔收入", { n: inN }) : t("已记了 {n} 笔收入", { n: inN })) : "") + (incFailed ? t("；收入没写进去（迁移 042 没执行？），请重试") : "")
    + (metaFailed ? t("；批次记录没存上，「各账户已补到哪个月」不会更新，请重试") : !acct ? t("；没选账户，这批不计入「各账户已补到哪个月」") : ""));
  if (bankHooks.refresh) await bankHooks.refresh(); else redraw();
  redraw();
}
export async function undo(batchId) {
  const all = meta("_bank_batches", []) || [], b = all.find((x) => x.id === batchId); if (!b) return;
  if (!confirm(t("撤销这批导入？这 {n} 笔花费会被删除{inc}。", { n: b.n ?? b.ids?.length ?? 0, inc: b.inN ? t("，另有 {m} 笔收入也会删除", { m: b.inN }) : "" }))) return;
  for (let i = 0; i < (b.ids || []).length; i += 6) await Promise.all(b.ids.slice(i, i + 6).map((id) => Store.deletePurchase(id).catch(() => {})));
  if (b.inN) { try { await Store.deleteIncomeByBatch(b.id); await loadIncome(); } catch (e) { toast(t("撤销失败：{msg}", { msg: e.message })); return; } }
  if (b.tagged) { try { await Store.deletePurchasesByBatch(b.id); } catch (e) { toast(t("撤销失败：{msg}", { msg: e.message })); return; } }
  try { await saveMeta({ _bank_batches: all.filter((x) => x.id !== batchId) }); } catch (e) { /* 忽略 */ }
  if (S.last?.id === batchId) S.last = null;
  toast(t("已撤销")); if (bankHooks.refresh) await bankHooks.refresh(); redraw();
}
/** 找回早期批次：每笔花费有 created_at，批次有导入完成时间 at 和笔数 n；
 *  导入是几秒到几分钟内连续写入的，所以「at 之前 20 分钟内写入、笔数正好等于 n」的那批花费就是它。笔数对不上的不动。
 *  找到后给这些花费补上 import_batch（需要迁移 034），批次标记成 tagged。 */
export async function recoverBatches() {
  if (S.busy) return; S.busy = true; redraw();
  try {
    let all = meta("_bank_batches", []) || [];
    // 第一步：花费上有批次标记、但批次记录不在列表里的（导入时记录没存上、或列表被改坏）——按标记把批次记录重建出来
    const tagged = await Store.listTaggedPurchases().catch((e) => { if (/import_batch/i.test(e.message || "")) return []; throw e; });
    const known = new Set(all.map((b) => b.id)), groups = new Map();
    for (const p of tagged) {
      if (known.has(p.import_batch)) continue;
      const g = groups.get(p.import_batch) || { n: 0, sum: 0, dates: [], at: p.created_at || "", card: p.card_id || "" };
      g.n++; g.sum += num(p.amount) || 0; g.dates.push(String(p.purchased_at).slice(0, 10)); if ((p.created_at || "") > g.at) g.at = p.created_at; groups.set(p.import_batch, g);
    }
    const rebuilt = [...groups].map(([id, g]) => { g.dates.sort(); const card = g.card && (state.cards || []).find((c) => c.id === g.card); return { id, at: g.at || new Date().toISOString(), file: "", ids: [], tagged: true, sum: Math.round(g.sum * 100) / 100, n: g.n, account: card ? card.name : "", last4: card?.last4 || "", from: g.dates[0] || "", to: g.dates.at(-1) || "", rebuilt: true }; });
    if (rebuilt.length) { all = [...all, ...rebuilt].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-BATCH_KEEP); await saveMeta({ _bank_batches: all }); }
    const lost = all.filter((b) => !b.tagged && !b.ids?.length && b.from && b.to);
    const day = (s, d) => new Date(new Date(`${s}T00:00:00Z`).getTime() + d * 864e5).toISOString();
    let fixed = 0, skipped = 0, rows = 0; const done = new Map();
    for (const b of lost) {
      const found = await Store.listPurchasesRange(day(b.from, -1), day(b.to, 2)).catch(() => []);
      const at = new Date(b.at).getTime(), pool = found;   // 这一批日期范围内的花费（按需读这一小段，迁移 057 起浏览器里没有整表）
      const hit = pool.filter((p) => !p.import_batch && p.created_at && new Date(p.created_at).getTime() <= at + 60000 && new Date(p.created_at).getTime() >= at - 20 * 60000);
      if (!hit.length || hit.length !== (b.n ?? -1)) { skipped++; continue; }
      for (const p of hit) { await Store.updatePurchase(p.id, { import_batch: b.id }); p.import_batch = b.id; rows++; }
      done.set(b.id, true); fixed++;
    }
    if (fixed) await saveMeta({ _bank_batches: all.map((b) => (done.has(b.id) ? { ...b, tagged: true, ids: [] } : b)) });
    const re = rebuilt.length ? t("按花费上的批次标记重建了 {n} 批记录", { n: rebuilt.length }) : "";
    toast([re, fixed ? t("找回 {f} 批（{r} 笔）{s}", { f: fixed, r: rows, s: skipped ? t("，{n} 批笔数对不上，已跳过", { n: skipped }) : "" }) : lost.length ? t("没能找回：{n} 批笔数对不上或花费已被删改", { n: skipped }) : ""].filter(Boolean).join("；") || t("没有要找回的批次：所有带标记的花费都已在列表里"));
  } catch (e) {
    toast(/import_batch/i.test(e.message || "") ? t("还没执行迁移 034（purchases.import_batch），先在 Supabase 执行 034_purchase_import_batch.sql") : t("找回失败：{msg}", { msg: e.message }));
  }
  S.busy = false; if (bankHooks.refresh) await bankHooks.refresh(); redraw();
}
