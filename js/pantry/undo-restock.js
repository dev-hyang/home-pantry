/* 撤销入库的确认框（物品详情页「库存记录」里点「撤销入库」）。不是静默全撤：
 *   ① 「这次实际入库了多少」默认 0 = 整笔撤销；数量打错了（输入 12 其实是 2）就填对的数量
 *   ② 「库存扣回」按 undo-calc.js 预填（入库量 − 实际入库量 − 之后已经手动调低的），可以改；下面实时显示「库存 2 → 1」
 *   ③ 找到对应的花费时（入库时记下的 purchase_id，或旧记录按时间对上唯一一笔），可选：保留（默认）/ 改成实际入库量 / 删除（导入的、刷卡的、别人记的不能删）
 * 数据库那边是 undo_restock（迁移 111）：作废这条入库记录、按需扣库存、实际入库量 > 0 时补一条正确数量的入库。
 * 返回 true = 做了（调用方刷新页面），false = 取消。 */
import { numAttrs } from "../core/ui-num.js";
import { Store } from "../core/store.js";
import { state } from "../core/state.js";
import { esc, fmt, fmtDateTime, money, num, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { spendChanged } from "../core/spend-data.js";
import { MATCH_MS, corrected, defaultDeduct, matchPurchase, purchaseDeletable } from "./undo-calc.js";

const r2 = (v) => Math.round(v * 100) / 100;
/** 这次入库对应的花费（读不到不影响撤销，只是没有花费那一项） */
async function findPurchase(log) {
  try {
    if (log.purchase_id) return (await Store.getPurchase(log.purchase_id)) || null;
    const t0 = new Date(log.created_at).getTime();
    return matchPurchase(log, await Store.listPurchasesRange(new Date(t0 - MATCH_MS).toISOString(), new Date(t0 + MATCH_MS).toISOString()));
  } catch { return null; }
}
export async function openUndoRestock(logId) {
  const log = (state.logs || []).find((l) => String(l.id) === String(logId)), it = log && (state.enriched.find((x) => x.id === log.item_id) || state.items.find((x) => x.id === log.item_id));   // enrich 过的物品才有显示单位 du
  if (!log || !it) { toast(t("找不到这条记录，可能已经超过 90 天")); return false; }
  const f = Units.factor(it.unit) || 1, unitTxt = t(it.du || it.unit || ""), unit = esc(unitTxt), delta = num(log.delta), qty = num(it.quantity), c = corrected(log, state.logs);
  const p = await findPurchase(log), canDel = purchaseDeletable(p, state.user?.id);
  const sameUnit = !!p && p.quantity != null && (!p.unit || Units.fit(p.unit, it.unit).kind === "same");
  const D = (v) => fmt(r2(v * f)), S = (v) => r2(num(v) / f);   // 存储单位 ↔ 显示单位
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "ask-dlg ask-undo";
    dlg.setAttribute("aria-labelledby", "askUndoTitle");
    const hint = c > 0 ? `<br><small class="muted">${esc(t("这次入库之后，你已经手动调低了 {q}，所以预填的扣回数量会少一些。", { q: `${D(c)} ${unitTxt}` }))}</small>` : "";
    const purchase = p ? `<label>${esc(t("对应的花费"))}<span class="muted" style="font-size:13px">${esc([p.store, p.name, p.amount != null ? money(p.amount) : ""].filter(Boolean).join(" · "))}</span>
          <select name="pact"><option value="keep">${esc(t("保留这笔花费"))}</option>${sameUnit ? `<option value="qty">${esc(t("花费的数量改成实际入库量"))}</option>` : ""}${canDel ? `<option value="del">${esc(t("同时删除这笔花费"))}</option>` : ""}</select>
          ${canDel ? "" : `<small class="muted">${esc(t("这笔花费是导入 / 刷卡 / 别人记的，不能在这里删。"))}</small>`}</label>` : "";
    dlg.innerHTML = `<form class="ask-form" novalidate>
      <h3 id="askUndoTitle">↩ ${esc(t("撤销入库：{name}", { name: it.name }))}</h3>
      <p class="ask-body">${esc(t("{d} 入库 +{q}", { d: fmtDateTime(log.created_at), q: `${D(delta)} ${unitTxt}` }))}${hint}</p>
      <div class="ask-fields">
        <label>${esc(t("这次实际入库了多少"))}<span class="ask-unit-line"><input ${numAttrs("qty")} name="actual" value="0"><b>${unit}</b></span><small class="muted">${esc(t("整笔都录错了就填 0；只是数量打错，填对的数量。"))}</small></label>
        <label>${esc(t("库存扣回"))}<span class="ask-unit-line"><input ${numAttrs("qty")} name="deduct" value="${D(defaultDeduct({ delta, actual: 0, corrected: c, qty }))}"><b>${unit}</b></span><small class="muted" data-prev></small></label>
        ${purchase}
      </div>
      <p class="form-error ask-err" role="alert"></p>
      <div class="ui-acts ask-acts"><button type="button" class="ui-btn" data-tone="ghost" data-ask="cancel">${esc(t("取消"))}</button><button type="submit" class="ui-btn" data-tone="primary">${esc(t("撤销入库"))}</button></div>
    </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector("form"), actualEl = form.elements.actual, dedEl = form.elements.deduct, prev = dlg.querySelector("[data-prev]"), err = dlg.querySelector(".ask-err");
    let touched = false;   // 手动改过「扣回」之后，就不再跟着「实际入库」自动预填
    const vals = () => ({ actual: Math.min(Math.max(S(actualEl.value), 0), delta), deduct: Math.max(S(dedEl.value), 0) });
    const sync = () => {
      const v = vals(), max = Math.max(0, Math.min(delta - v.actual, qty));
      prev.textContent = `${t("库存")} ${D(qty)} → ${D(qty - Math.min(v.deduct, max))} ${unitTxt}${v.deduct > max ? `（${t("最多只能扣 {q}", { q: D(max) })}）` : ""}`;
    };
    actualEl.addEventListener("input", () => { if (!touched) dedEl.value = D(defaultDeduct({ delta, actual: vals().actual, corrected: c, qty })); sync(); });
    dedEl.addEventListener("input", () => { touched = true; sync(); });
    sync();
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const { actual, deduct } = vals(), act = form.elements.pact?.value || "keep", btn = form.querySelector('[type="submit"]');
      if (S(actualEl.value) > delta + 1e-9) { err.textContent = t("实际入库不能比记录的入库量还多。"); return; }
      btn.disabled = true; err.textContent = "";
      try {
        await Store.undoRestock(log.id, deduct, actual);
        if (p && act === "del") { await Store.deletePurchases([p.id]); spendChanged(); }
        else if (p && act === "qty") { await Store.updatePurchase(p.id, { quantity: actual > 0 ? actual : null }); spendChanged(); }
        toast(t("已撤销 {name} 的这次入库", { name: it.name }));
        finish(true);
      } catch (ex) { btn.disabled = false; err.textContent = ex.message || String(ex); }
    });
    dlg.querySelector('[data-ask="cancel"]').addEventListener("click", () => finish(false));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(false); });
    dlg.showModal();
    actualEl.focus({ preventScroll: true }); actualEl.select?.();
  });
}
