/* 点击动作：财务：账单、缴费、卡、花费、统计、导出。 */
import { $, applyDraft, confirmDelete, fmtDate, formDraft, money, num, toast } from "../../core/util.js";
import { Store } from "../../core/store.js";
import { backfillPayments, deleteBillPay, leaveBill, quickVerify } from "../lazy-modules.js";
import { friendlyErr } from "../errors.js";
import { go, href } from "../../core/router.js";
import { ignoreSuggestion, linkBillAsset } from "../../bills/asset-ui.js";
import { printSheet } from "../../settings/print.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { setSharedRange } from "../actions/stats-prefs.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";
import { deleteMedBill, deleteMedPay } from "../lazy-modules.js";
import { payAcctValue } from "../../bills/card-picker.js";
import { aiDraftCard, deleteCard, runCleanup, setCardActive } from "../lazy-modules.js";
import { exportAnnual } from "../../stats/spend-stores.js";
import { spendListNow } from "../lazy-modules.js";
import { clearSpendFilter, renderSpendList, renderSpendRecords, spendRowsLoaded } from "../lazy-modules.js";

/** 点击动作（财务：账单、缴费、卡、花费、统计、导出）：这一组处理的 data-action */
export const MONEY_ACTIONS = new Set(["print-run","ov-group","bill-cancel","assess-cancel","assess-del","assess-undo","billpay-cancel","bill-delete","billpay-del","bill-verify","bill-link-asset","bill-link-ignore","billpay-backfill","bills-enable","tpl-all","spend-edit","spend-edit-collapse","trip-reclass","spend-copy","spend-open","spend-edit-cancel","spend-chip-clear","med-del","card-ai","card-del","card-del-keep","card-del-all","card-del-cancel","card-cleanup-open","card-cleanup-cancel","card-cleanup-run","card-deact","card-react","med-pay-del","spend-more","spend-sel-start","spend-sel-toggle","spend-sel-all","spend-sel-none","spend-sel-del","stats-months","spend-add-toggle","stats-node","stats-trips","csv-summary","csv-detail"]);
/** 点击动作（财务：账单、缴费、卡、花费、统计、导出）：按 data-action 分支；el 是被点的元素，id 是它的 data-id，e 是点击事件 */
export async function clickMoney(action, el, id, e) {
  switch (action) {
      case "print-run": return printSheet(el.dataset.kind, el.dataset.kind === "spend" ? { months: +($("#printRange")?.value || +state.stats.months || 6) } : $("#printProp")?.value || "all");
      case "ov-group": state.ovFilter.group = el.dataset.group === "cycle" ? "cycle" : "asset"; return render();   // 账单概览：账单分组切换（按资产 / 按周期）
      case "bill-cancel": return leaveBill(false);
      case "assess-cancel": return go(`${href("bill", state.route.id)}?sec=assess`, { replace: true });
      case "assess-undo": {   // 撤销一期「已缴（无缴费记录）」：改回待缴（交在某笔缴费里的，要到那笔缴费里取消勾选）
        const x = state.assessItems.find((y) => y.id === id); if (!x || x.payment_id) return;
        if (!confirmDelete(t("把这一期改回待缴？"))) return;
        await Store.saveAssessItem({ id: x.id, assessment_id: x.assessment_id, due_on: x.due_on, amount: x.amount, kind: x.kind, payment_id: null, settled_on: null });
        toast(t("已改回待缴")); return refresh();
      }
      case "assess-del": {
        { const n = state.assessItems.filter((x) => x.assessment_id === id && x.payment_id).length;
          if (!confirmDelete(n ? t("删除这笔摊派和它的付款计划？已缴的 {n} 期对应的缴费记录会保留，只是不再关联。", { n }) : t("删除这笔摊派和它的付款计划？已缴的缴费记录保留。"))) return; }
        await Store.deleteAssess(id); toast(t("已删除")); await refresh(); return go(`${href("bill", state.route.id)}?sec=assess`, { replace: true });
      }
      case "billpay-cancel": return go(`${href("bill", state.route.id)}?sec=pay`, { replace: true });   // 缴费表单取消：回全部缴费记录
      case "bill-delete":
        if (!confirmDelete(t("删除这个账单和它的缴费记录？"))) return;
        if (id) { await Store.deleteBill(id); toast(t("已删除账单及其缴费记录")); await refresh(); return render(true); }   // 清单 / 滑动卡里的菜单：按卡片的 id 删，留在当前页
        await Store.deleteBill(state.route.id); toast(t("已删除账单及其缴费记录")); return leaveBill(true);
      case "billpay-del":
        if (!confirmDelete(t("删除这条缴费记录？"))) return;
        { const back = await deleteBillPay(id); toast(back ? t("已删除这条记录，到期日回到 {d}", { d: fmtDate(back) }) : t("已删除这条记录")); }
        await refresh(); return render(true);
      case "bill-verify": el.disabled = true; await quickVerify(id); return refresh();
      case "bill-link-asset": el.disabled = true; try { await linkBillAsset(id, el.dataset.asset); toast(t("已挂到这辆车上")); } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); } return refresh();
      case "bill-link-ignore": ignoreSuggestion(id); return render(true);
      case "billpay-backfill": el.disabled = true; try { await backfillPayments(el.dataset.id); } catch (err) { toast(t("补标失败：{msg}", { msg: friendlyErr(err.message) })); } return refresh();
      case "bills-enable":
        state.billsEnabled = true; try { localStorage.setItem("hmh-bills-off", "0"); } catch { /* 忽略 */ }
        return render();
      case "tpl-all": e.preventDefault(); el.form.querySelectorAll('input[name="tpl"]:not(:disabled)').forEach((x) => { x.checked = el.dataset.on === "1"; }); return;
      case "spend-edit": return go(`${href("bills", "spend")}?form=${encodeURIComponent(id)}`);   // 编辑：独立的表单页（stats/spend-form-page.js）
      case "spend-edit-collapse": { const f = $("#spendEditForm"); if (f) (state.spendDrafts = state.spendDrafts || {})[f.dataset.id] = formDraft(f); state.spendEdit = null; return renderSpendList(); }   // 收起但留着草稿
      case "trip-reclass": {   // 旅行页的归类建议：把以前记成“其他”的花费归到某个旅行类型
        await Store.updatePurchase(id, { category: el.dataset.cat });
        toast(t("已归类")); render(); return refresh();
      }
      case "spend-copy": return go(`${href("bills", "spend")}?form=new&copy=${encodeURIComponent(id)}`);   // 复制：同一个表单页，带上这笔的内容，日期今天
      case "spend-open": { state.spendOpen = state.spendOpen === id ? null : id; return renderSpendList(); }   // 花费明细一行的 ▾：编辑 / 复制 / 删除
      case "spend-edit-cancel": { if (state.spendDrafts && state.spendEdit) delete state.spendDrafts[state.spendEdit]; state.spendEdit = null; return renderSpendList(); }
      case "spend-chip-clear": clearSpendFilter(el.dataset.k); return renderSpendRecords();
      case "med-del": if (!confirmDelete(t("删除这张医疗账单？"))) return; { const stay = !!el.dataset.stay; await deleteMedBill(el.dataset.id, stay); if (stay) render(true); return; }
      case "card-ai": return aiDraftCard(el.closest("form"));
      case "card-del": state.cardDelete = el.dataset.id; render(); document.getElementById("cardDelTitle")?.scrollIntoView({ block: "center" }); return;   // 先问花费记录怎么办
      case "card-del-keep": el.disabled = true; await deleteCard(el.dataset.id, { purchases: "keep" }); return refresh();
      case "card-del-all": el.disabled = true; await deleteCard(el.dataset.id, { purchases: "delete" }); return refresh();
      case "card-del-cancel": state.cardDelete = null; return render();
      case "card-cleanup-open": state.cardCleanup = true; render(); document.getElementById("cleanTitle")?.scrollIntoView({ block: "center" }); return;
      case "card-cleanup-cancel": state.cardCleanup = false; state.cardCleanupRecent = false; return render();
      case "card-cleanup-run": el.disabled = true; await runCleanup(); return refresh();
      case "card-deact": el.disabled = true; await setCardActive(el.dataset.id, false); return refresh();
      case "card-react": el.disabled = true; await setCardActive(el.dataset.id, true); return refresh();
      case "med-pay-del": if (!confirmDelete(t("删除这条缴费记录？"))) return; return deleteMedPay(el.dataset.id);
      case "spend-more": return spendListNow()?.more();   // 「继续加载」：向数据库要下一页
      case "spend-sel-start": state.spendSel = new Set([id]); state.spendEdit = null; return render();   // 长按菜单「多选删除」：进入多选，这一行先勾上
      case "spend-sel-toggle": state.spendSel = state.spendSel ? null : new Set(); state.spendEdit = null; return render();
      case "spend-sel-all": { const S = state.spendSel || (state.spendSel = new Set()); spendRowsLoaded().forEach((p) => S.add(p.id)); return renderSpendList(); }   // 已经读到的（要更多先「继续加载」）
      case "spend-sel-none": state.spendSel = new Set(); return renderSpendList();
      case "spend-sel-del": {   // 多选删除：只删当前筛选结果里选中的
        const S = state.spendSel; if (!S?.size) return;
        const list = spendRowsLoaded().filter((p) => S.has(p.id)), sum = list.reduce((a, p) => a + (p.amount != null ? num(p.amount) : 0), 0);
        if (!list.length || !confirm(t("删除选中的 {n} 笔花费（合计 {m}）？删了就找不回来，建议先备份。", { n: list.length, m: money(sum) }))) return;
        el.disabled = true; let fail = 0;
        for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map((p) => Store.deletePurchase(p.id).catch(() => { fail++; })));
        const gone = new Set(list.map((p) => p.id)); const sl = spendListNow(); if (sl) sl.rows = sl.rows.filter((p) => !gone.has(p.id)); state.spendSel = null;
        toast(fail ? t("删了 {n} 笔，{k} 笔失败", { n: list.length - fail, k: fail }) : t("已删除 {n} 笔", { n: list.length })); render(); return refresh();
      }
      case "stats-months": setSharedRange(String(el.dataset.months)); return render();
      case "spend-add-toggle": { state.spendAddOpen = !state.spendAddOpen; render(); if (state.spendAddOpen) requestAnimationFrame(() => $("#purchaseForm")?.elements.name.focus({ preventScroll: true })); return; }
      case "stats-node": state.stats.node = el.dataset.node || null; state.stats.byTrip = false; render(); return requestAnimationFrame(() => document.querySelector(".node-crumb")?.scrollIntoView({ block: "nearest" }));   // 分类页：点进下一层 / 面包屑回上层
      case "stats-trips": state.stats.byTrip = !state.stats.byTrip; return render();   // 分类 → 旅行：按行程看
      case "csv-summary": return exportAnnual("summary");
      case "csv-detail": return exportAnnual("detail");
  }
}
