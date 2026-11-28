/* 银行对账单导入：#bankImport 里面的点击和输入事件。 */
import { NO_ACCT, accounts, aiParse, guessAcctName, ingest, suggestAccount } from "./bank-accounts-ai.js";
import { S, pastePart, rebuild, resetPicks } from "./bank-rows.js";
import { confirmDelete, toast } from "../core/util.js";
import { LIVE, deleteOwnAccount, redraw, saveBatchDates } from "./bank-ui.js";
import { toggleSup, undoSup } from "./bank-superseded.js";
import { bankHooks } from "./bank-common.js";
import { doImport, recoverBatches, undo } from "./bank-run.js";
import { pageMore } from "../core/pager.js";
import { redundantRules, staleRules, userRules } from "./bank-transfers.js";
import { saveMeta } from "../bills/budget.js";
import { t } from "../core/i18n.js";

/* ───────────── 事件（只处理 #bankImport 里面的） ───────────── */
document.addEventListener("change", async (e) => {
  const root = e.target.closest && e.target.closest("#bankImport"); if (!root) return;
  const el = e.target, tp = S.parts.length === 1 && S.parts[0].table ? S.parts[0].table : null;
  if (el.id === "bankFile") { const fs = [...(el.files || [])]; if (!fs.length) return; S.status = t("正在读取…"); redraw(); await ingest(fs); S.status = ""; return redraw(); }
  if (el.dataset.bankCat !== undefined) { S.pick[el.dataset.bankCat] = el.value; if (el.value) S.include[el.dataset.bankCat] = true; return redraw(); }
  if (el.dataset.bankIkind !== undefined) { S.ikind[el.dataset.bankIkind] = el.value; return redraw(); }
  if (el.dataset.bankRcat !== undefined) { S.rcat[el.dataset.bankRcat] = el.value; if (el.value) S.include[el.dataset.bankRcat] = true; return redraw(); }
  if (el.dataset.bankIperson !== undefined) { S.incPerson = el.value; return; }
  if (el.dataset.bankInc !== undefined) { S.include[el.dataset.bankInc] = el.checked; return redraw(); }
  if (el.dataset.bankForce !== undefined) { if (el.checked) S.force.add(el.dataset.bankForce); else S.force.delete(el.dataset.bankForce); rebuild(); return redraw(); }
  if (el.dataset.bankCol !== undefined && tp) { tp.map[el.dataset.bankCol] = +el.value; S.parts[0].error = ""; resetPicks(); rebuild(); return redraw(); }
  if (el.dataset.bankSign !== undefined) { S.spendSign = el.value; resetPicks(); rebuild(); return redraw(); }
  if (el.dataset.bankDmy !== undefined) { S.dmy = el.value === "dmy"; resetPicks(); rebuild(); return redraw(); }
  if (el.dataset.bankRemember !== undefined) { S.remember = el.checked; }
  if (el.dataset.bankBatchAcct !== undefined) { S.batchAcct = el.value; return redraw(); }
  if (el.dataset.bankAcct !== undefined) { S.acctTouched = true; const v = el.value; const hit = accounts().find((x) => x.id === v);
    S.account = v === "none" ? NO_ACCT() : hit ? { mode: "id", id: hit.id, name: hit.name, last4: hit.last4 } : { mode: "new", id: "", name: S.account.mode === "new" ? S.account.name : guessAcctName(), last4: S.parts.map((x) => x.acct?.last4).find(Boolean) || "" }; return redraw(); }
  if (el.dataset.bankAcctName !== undefined) { S.acctTouched = true; S.account.name = el.value; }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#bankImport [data-bank-act]"); if (!b) return;
  if (b.dataset.bankAct === "import") doImport();
  else if (b.dataset.bankAct === "rule-del") { if (!confirmDelete(t("删除这条记住的分类规则？"))) return; const rules = { ...userRules() }; delete rules[b.dataset.key]; saveMeta({ _bank_rules: rules }).then(() => { toast(t("已删除")); if (S.parts.length) { resetPicks(); rebuild(); } redraw(); }); }
  else if (b.dataset.bankAct === "rules-tidy" || b.dataset.bankAct === "rules-stale") {
    const list = b.dataset.bankAct === "rules-tidy" ? redundantRules() : staleRules();
    if (list.length && confirm(t("删除这 {n} 条规则？{names}", { n: list.length, names: `\n${list.slice(0, 8).join("、")}${list.length > 8 ? "…" : ""}` }))) { const rules = { ...userRules() }; list.forEach((k) => delete rules[k]); saveMeta({ _bank_rules: rules }).then(() => { toast(t("已清理 {n} 条", { n: list.length })); if (S.parts.length) { resetPicks(); rebuild(); } redraw(); }); }
  }
  else if (b.dataset.bankAct === "rules-clear") { if (confirm(t("清除全部记住的归类？下次导入这些商家会重新按关键词归类。"))) saveMeta({ _bank_rules: {} }).then(() => { toast(t("已清除")); if (S.parts.length) { resetPicks(); rebuild(); } redraw(); }); }
  else if (b.dataset.bankAct === "dates-edit") { S.editDates = S.editDates === b.dataset.batch ? "" : b.dataset.batch; redraw(); }
  else if (b.dataset.bankAct === "dates-cancel") { S.editDates = ""; redraw(); }
  else if (b.dataset.bankAct === "dates-save") saveBatchDates(b.dataset.batch, b.closest("li"));
  else if (b.dataset.bankAct === "undo") undo(b.dataset.batch);
  else if (b.dataset.bankAct === "sup-open") toggleSup(b.dataset.batch, redraw);
  else if (b.dataset.bankAct === "sup-undo") undoSup(b.dataset.id, b.dataset.batch, redraw, async () => { LIVE.clear(); window.dispatchEvent(new Event("spend-rows-changed")); if (bankHooks.refresh) await bankHooks.refresh(); });
  else if (b.dataset.bankAct === "acct-del") deleteOwnAccount(b.dataset.id);
  else if (b.dataset.bankAct === "recover") recoverBatches();
  else if (b.dataset.bankAct === "batches-more") { pageMore("bank-batches"); redraw(); }
  else if (b.dataset.bankAct === "undo-last" && S.last) undo(S.last.id);
  else if (b.dataset.bankAct === "ai") aiParse(+b.dataset.i);
  else if (b.dataset.bankAct === "rm") { S.parts.splice(+b.dataset.i, 1); resetPicks(); rebuild(); redraw(); }
  else if (b.dataset.bankAct === "paste") { const v = document.getElementById("bankPaste")?.value.trim(); if (v) { S.parts.push(pastePart(v)); suggestAccount(); resetPicks(); rebuild(); redraw(); } }
});
