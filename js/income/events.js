/* 收入页的事件：initIncome 在页面加载后注册点击、清除筛选、hashchange 等处理。 */
import { $, applyDraft, confirmDelete, daysUntil, formDraft, money, num, toast, todayISO } from "../core/util.js";
import { DEF_FIELDS, defAcct, defOf, incCfg, kindHint, saveRecord } from "./record-form.js";
import { FD, changed, clearUrlParams, onClearFilters } from "../core/clear-filters.js";
import { GAIN_KINDS, customKinds, inc, incomeIn, kindLabel, loadIncome, openRepayments, repaidOf, setIncMerge, skey, spanWindow } from "./logic.js";
import { INC_L1S } from "../core/income-taxonomy.js";
import { OV } from "./overview-tab.js";
import { R, S_PAGE, rememberSenders, renderSenders, sMainKind, sNameOf, senderGroups } from "./senders-tab.js";
import { Store } from "../core/store.js";
import { activeTab } from "../core/tabs.js";
import { canEdit, inlineEditId, renderIncList } from "./records-tab.js";
import { debounce, pageSize } from "../core/pager.js";
import { detailRows, exportReport, fileHead, printIncome, runAi } from "./export-ai.js";
import { hooks, rerender } from "./rollup.js";
import { href } from "../core/router.js";
import { incDraw, incList } from "./list.js";
import { initAaFix } from "./aa-fix.js";
import { initIncomeScan } from "./scan.js";
import { registerAlerts } from "../core/alerts.js";
import { sameAmountNear } from "../stats/dup-check.js";
import { saveMeta } from "../bills/budget.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { cur, incomeHref, rate, redraw, staleAll } from "./shared.js";
import { download, toCsv } from "../stats/store-lite.js";

/* ───────────── 事件 ───────────── */
function armed(el, msg) { if (el.dataset.armed) return true; el.dataset.armed = "1"; const old = el.textContent; el.textContent = msg; setTimeout(() => { delete el.dataset.armed; el.textContent = old; }, 4000); return false; }
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const reload = async () => { await loadIncome(); redraw(); };
const goTab = (id) => { location.hash = incomeHref(id); };
/** 去「明细」前清掉所有筛选（含图表钻取带来的日期段 / 不含资本流入） */
const NO_FILTER = () => ({ q: "", kind: "all", acct: "all", year: "all", month: "all", person: "all", batch: null, from: "", to: "", ex: false, limit: pageSize() });
export function initIncome({ render, refresh }) {
  Object.assign(hooks, { render, refresh }); initIncomeScan({ render }); initAaFix({ redraw: () => hooks.render(true) });
  // 清除筛选：收入记录（搜索、下拉、下钻日期段、导入批次，网址参数一起去掉）/ 付款方汇总
  onClearFilters("incRec", () => { Object.assign(inc(), FD.incRec, { limit: pageSize() }); clearUrlParams("*"); redraw(); }, () => changed(inc(), FD.incRec));
  onClearFilters("incSend", () => { Object.assign(inc(), FD.incSend, { slimit: null }); redraw(); }, () => changed(inc(), FD.incSend));
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/bills/income")) { const I = inc(); I.form = null; I.scanOpen = false; I.selMode = false; I.open = null; I._lastTab = undefined; } });   // 离开收入页：下次进来是干净的，不会看着像「选了好几个」
  const main = document.getElementById("main");
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-inc]"); if (!b) return;
    const I = inc(), id = b.dataset.id, act = b.dataset.inc;
    if (act === "add") { I.form = { rec: null }; I.scanOpen = false; I._keep = true; if (activeTab(state.route) !== "records" || state.route.sub !== "income") goTab("records"); else redraw(); return; }
    if (act === "way-manual") { I.form = I.form && !I.form.rec?.id ? null : { rec: null }; I.scanOpen = false; return redraw(); }
    if (act === "batch-clear") { I.batch = null; history.replaceState(null, "", `${href("bills", "income")}?tab=records`); return redraw(); }
    if (act === "way-scan") { I.scanOpen = !I.scanOpen; I.form = null; return redraw(); }
    if (act === "cancel") { if (I.drafts && I.form?.rec?.id) delete I.drafts[I.form.rec.id]; I.form = null; return redraw(); }
    if (act === "open") { I.open = I.open === id ? null : id; if (activeTab(state.route) !== "records") { Object.assign(I, NO_FILTER()); goTab("records"); return; } return redraw(); }
    if (act === "more") return incList.more();   // 「继续加载」：向数据库要下一页
    if (act === "node") { OV().node = b.dataset.node || ""; return redraw(); }   // 类型页：逐层点进去 / 面包屑回上层
    if (act === "copy") {   // 复制：新记一笔，带上这笔的内容（日期回到今天，不带 id、导入批次、还款记录）
      const src = I.rec.find((r) => r.id === id) || incList.rows.find((r) => r.id === id); if (!src) return;
      const rec = { ...src }; for (const k of ["id", "household_id", "created_at", "updated_at", "created_by", "updated_by", "import_batch", "received_on", "purchase_id"]) delete rec[k];
      I.form = { rec }; I.scanOpen = false; I.open = null;
      if (activeTab(state.route) !== "records") { Object.assign(I, NO_FILTER()); I._keep = true; goTab("records"); return; }
      redraw(); setTimeout(() => { const f = $("#incForm"); f?.scrollIntoView({ block: "center", behavior: "smooth" }); f?.elements.amount?.focus({ preventScroll: true }); }, 0); return;
    }
    if (act === "edit") {   // 点行 / 点「编辑」：打开编辑表单（不在「明细」标签就先切过去）；这一行已经展开着，再点一下行就收起（不保存）
      if (b.classList.contains("ix-main") && I.form?.rec?.id === id && inlineEditId() === id) {   // 收起但留着草稿：再展开时填回去，行上有「草稿」小标
        const f = $("#incForm"); if (f) (I.drafts = I.drafts || {})[id] = formDraft(f);
        I.form = null; return redraw();
      }
      I.form = { rec: I.rec.find((r) => r.id === id) || incList.rows.find((r) => r.id === id) }; I.scanOpen = false;
      if (activeTab(state.route) !== "records") { Object.assign(I, NO_FILTER()); I._keep = true; goTab("records"); return; }
      redraw(); const dr = I.drafts?.[id]; if (dr) applyDraft($("#incForm"), dr);   // 之前收起时留的草稿
      setTimeout(() => { const f = $("#incForm"); f?.scrollIntoView({ block: "center", behavior: "smooth" }); f?.elements.amount?.focus({ preventScroll: true }); }, 0); return;
    }
    if (act === "del-swipe") { if (!confirmDelete(t("删除这笔收入？"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }   // 左滑删除：用确认框（滑动代码按它判断用户有没有取消）
    if (act === "del") { if (!confirmDelete(t("删除这笔收入？"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }
    if (act === "rep-del") { if (!confirmDelete(t("删除这条还款记录？"))) return; return guard(async () => { const p = I.rep.find((x) => x.id === id); await Store.deleteIncomeRepayment(id); if (p?.purchase_id) { await Store.deletePurchase(p.purchase_id).catch(() => {}); hooks.refresh(); } await reload(); }); }
    if (act === "sender-open") { Object.assign(I, NO_FILTER(), { q: b.dataset.key }); goTab("records"); return; }
    if (act === "drill-clear") { if (b.dataset.k === "range") { I.from = ""; I.to = ""; } else if (b.dataset.k === "ex") I.ex = false; I.limit = pageSize(); return redraw(); }
    if (act === "sender-rename") { I.renameKey = b.dataset.key || null; return redraw(); }
    if (act === "sender-trend") { I.sopen = I.sopen === b.dataset.key ? null : b.dataset.key; return renderSenders(); }
    if (act === "sender-sel") { I.ssel = I.ssel ? null : new Set(); I.smergeTo = ""; I.renameKey = null; return redraw(); }
    if (act === "sender-pick") { const k = b.dataset.key; I.ssel.has(k) ? I.ssel.delete(k) : I.ssel.add(k); return renderSenders(); }
    if (act === "sender-merge") return guard(async () => {
      const to = ($("#incMergeTo")?.value || "").trim(), keys = [...(I.ssel || [])]; if (!to || keys.length < 2) return;
      const ids = I.rec.filter((r) => keys.includes(skey(r.source_name)) && canEdit(r)).map((r) => r.id);
      await Store.renameIncomeSource(ids, to); await rememberSenders(keys, to);
      I.ssel = null; I.smergeTo = ""; toast(t("已合并：{n} 笔记成「{to}」", { n: ids.length, to })); await reload();
    });
    if (act === "csv-detail") return guard(async () => { const l = await incList.fetchAll(); if (!l.length) return toast(t("没有可导出的记录")); download(`${fileHead()}-${t("明细")}.csv`, toCsv(detailRows(l))); });   // 按当前筛选从数据库读全部，不只是已显示的
    if (act === "csv-detail-window") { const w = spanWindow(R().range), l = incomeIn(w.from, w.to, R().person); if (!l.length) return toast(t("这段时间没有收入")); download(`${fileHead()}-${w.from}_${w.to}-${t("明细")}.csv`, toCsv(detailRows(l))); return; }
    if (act === "csv-senders") {   // 导出：和表格同样的筛选和排序，不分页
      const { w, list, total: tot } = senderGroups();
      return download(`${fileHead()}-${t("付款方汇总")}-${w.from}_${w.to}.csv`, toCsv([[t("付款方"), t("主要类型"), t("次数"), t("收入"), t("资本流入"), t("占比"), t("第一次"), t("最近一次")], ...list.map((x) => [sNameOf(x), kindLabel(sMainKind(x)), x.n, x.total, x.cap, rate(x.total, tot), x.first, x.last])]));
    }
    if (act === "s-sort") { const k = b.dataset.k, o = I.ssort || { k: "total", dir: "desc" }; I.ssort = { k, dir: o.k === k ? (o.dir === "asc" ? "desc" : "asc") : k === "name" || k === "kind" ? "asc" : "desc" }; I.slimit = S_PAGE(); renderSenders(); $(`#incSendersList [data-k="${k}"]`)?.focus(); return; }
    if (act === "s-more") { I.slimit = (I.slimit || S_PAGE()) + S_PAGE(); return renderSenders(); }
    if (act === "csv-report") return guard(exportReport);
    if (act === "print-report") return guard(() => printIncome("report"));
    if (act === "print-list") return printIncome("list");
    if (act === "kind-open") { Object.assign(I, NO_FILTER(), { kind: id, person: OV().person }); goTab("records"); return; }
    if (act === "sel-toggle") { I.selMode = !I.selMode; I.sel = new Set(); return redraw(); }
    if (act === "sel-all") { I.sel = new Set(incList.rows.filter(canEdit).map((r) => r.id)); return renderIncList(); }
    if (act === "sel-del") { const ids = [...(I.sel || [])]; if (!ids.length) return toast(t("先勾选要删的收入")); if (!confirmDelete(t("删除选中的 {n} 笔收入？", { n: ids.length }))) return; return guard(async () => { for (const x of ids) await Store.deleteIncomeRecord(x); I.sel = new Set(); I.selMode = false; I.open = null; toast(t("已删除 {n} 笔", { n: ids.length })); await reload(); }); }
    if (act === "ai-run") return runAi();
    if (act === "kind-del") { if (!confirmDelete(t("删除这个收入类型？"))) return; if (I.rec.some((r) => r.kind === id)) return toast(t("还有收入记录用着这个类型，先把它们改成别的类型")); return guard(async () => { await saveMeta({ _income_kinds: rawKinds().filter((k) => k.id !== id) }); redraw(); }); }
  });
  main.addEventListener("submit", (e) => {
    const f = e.target.closest?.("[data-inc-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const kind = f.dataset.incForm, I = inc(), fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim();
    if (kind === "record") return saveRecord(f);
    if (kind === "repay") return guard(async () => {
      const rec = I.rec.find((r) => r.id === f.dataset.id), amount = num(g("amount")), paid_on = g("paid_on") || todayISO(); if (!rec || !(amount > 0)) return;
      let purchase_id = null, note = "";
      if (fd.get("as_spend") === "on") {   // 还款是钱从账户里出去了：同时记一笔花费，花费统计里才看得到
        const dup = await sameAmountNear(paid_on, amount).catch(() => null);   // ±3.5 天内金额一样的已有花费（那几天的花费读进内存比，dup-check.js）
        if (dup) note = t("；已有对上的花费（{n}），没有重复记", { n: dup.name });
        else purchase_id = await Store.addPurchase({ item_id: null, name: t("还款给 {n}", { n: rec.source_name }), category: "other", quantity: null, unit: null, store: rec.source_name, amount, currency: cur(), purchased_at: new Date(paid_on + "T12:00:00").toISOString() });
      }
      await Store.addIncomeRepayment({ record_id: rec.id, paid_on, amount, method: g("method") || null, notes: null, ...(purchase_id ? { purchase_id } : {}) });
      toast(t("已记录还款") + note); await reload(); if (purchase_id) hooks.refresh();
    });
    if (kind === "kind") return guard(async () => { const name = g("name"); if (!name) return; const parent = INC_L1S.some((x) => x.id === g("parent")) ? g("parent") : "other_income"; await saveMeta({ _income_kinds: [...rawKinds(), { id: `c_${Date.now().toString(36)}`, name, icon: g("icon") || "🏷️", parent }].slice(0, 30) }); rerender(); });
    if (kind === "rename") return guard(async () => { const to = g("to"), key = f.dataset.key; if (!to) return; const ids = I.rec.filter((r) => skey(r.source_name) === key && canEdit(r)).map((r) => r.id); await Store.renameIncomeSource(ids, to); await rememberSenders([key], to); I.renameKey = null; toast(t("已改名 {n} 笔", { n: ids.length })); await reload(); });
  }, true);
  const incListSoon = debounce(() => renderIncList()), sendersSoon = debounce(() => renderSenders());
  let datePend = null, dateT = 0;
  const dateNow = () => { clearTimeout(dateT); const fn = datePend; datePend = null; if (fn) fn(); };
  const dateLater = (v, fn) => { clearTimeout(dateT); datePend = fn; const y = +String(v).slice(0, 4); if (!v || (y >= 1900 && y <= 2100)) dateT = setTimeout(dateNow, 1200); };
  const isDateBox = (el) => el?.dataset && (el.dataset.incR === "from" || el.dataset.incR === "to" || el.dataset.incAnchor !== undefined);
  main.addEventListener("focusout", (e) => { if (isDateBox(e.target) && datePend) { const y = +String(e.target.value).slice(0, 4); if (!e.target.value || (y >= 1900 && y <= 2100)) dateNow(); else { clearTimeout(dateT); datePend = null; } } });   // 离开时年份还不完整：不应用
  main.addEventListener("keydown", (e) => { if (e.key === "Enter" && isDateBox(e.target)) { e.preventDefault(); e.target.blur(); } });   // 搜索：停下 ~200ms 再重画，不是每敲一个字都重画
  main.addEventListener("input", (e) => { const el = e.target; if (el.dataset?.incF === "q") { inc().q = el.value; inc().limit = pageSize(); incListSoon(); } if (el.dataset?.incSq !== undefined) { inc().sq = el.value; inc().slimit = S_PAGE(); sendersSoon(); } });
  main.addEventListener("change", (e) => {
    const el = e.target, I = inc();
    if (el.dataset?.incAcct !== undefined) { const f = el.closest("form"), box = f?.elements.account, cb = f?.elements.acct_default; if (box) { box.hidden = el.value !== "other"; if (!box.hidden) box.focus(); } if (cb) cb.checked = !!el.value && el.value === defAcct(); return; }
    if (el.dataset?.incKind !== undefined) {   // 换类型：卖出类显示「其中已实现收益」，资本流入给一句说明
      const f = el.closest("form"), box = f?.querySelector("[data-inc-gain]"), hint = f?.querySelector("[data-inc-kind-hint]");
      if (box) box.hidden = !(GAIN_KINDS.includes(el.value) || (box.querySelector("input")?.value || "") !== "");
      if (hint) hint.textContent = kindHint(el.value);
    }
    if (el.name && DEF_FIELDS.some(([k]) => k === el.name)) { const cb = el.closest("form")?.elements[`def_${el.name}`]; if (cb) cb.checked = !!el.value && el.value === defOf(el.name); }   // 改了值：「设为默认」跟着当前值是不是默认来（不 return，别的处理照走）
    if (el.dataset?.incRepay !== undefined) { const box = el.closest("form")?.querySelector("[data-inc-repay-box]"); if (box) box.hidden = !el.checked; return; }
    if (el.dataset?.incSel !== undefined) { (I.sel ||= new Set())[el.checked ? "add" : "delete"](el.dataset.incSel); const n = $("#incSelN"); if (n) n.textContent = t("已选 {n} 笔", { n: I.sel.size }); return; }
    if (el.dataset?.incOv) { const o = OV(); o[el.dataset.incOv] = el.value; if (el.dataset.incOv === "range") o.month = ""; return rerender(); }
    if (el.dataset?.incTog === "merge") { setIncMerge(el.checked); return rerender(); }
    if (el.dataset?.incKparent) { const kid = el.dataset.incKparent, v = el.value; guard(async () => { await saveMeta({ _income_kinds: rawKinds().map((k) => (k.id === kid ? { ...k, parent: v } : k)) }); rerender(); }); return; }
    if (el.dataset?.incSsort !== undefined) { const [k, dir] = el.value.split(":"); I.ssort = { k, dir }; I.slimit = S_PAGE(); return renderSenders(); }
    if (el.dataset?.incF) {
      const k = el.dataset.incF; if (k === "q") return; I[k] = el.value; I.limit = pageSize(); I.slimit = S_PAGE();
      // 明细 / 付款方的筛选条：只重画列表（手机上「筛选」面板不会因为整页重画被收起，选完一个还能接着选）
      if (el.closest(".ix-toolbar")) return renderIncList();
      if (el.closest(".ix-stoolbar")) return renderSenders();
      return rerender();
    }
    // 日期框：浏览器每敲完一段（比如年份的第一位）就发 change，立刻重画会把输入框换掉、光标丢了，年月根本输不完。
    // 所以只记下值，等年份像样（1900–2100）后停顿一下、离开输入框或按回车时才应用；空值（清掉）也照样应用
    if (el.dataset?.incR === "from" || el.dataset?.incR === "to") { const r = R(), k = el.dataset.incR, v = el.value; r[k] = v; dateLater(v, () => rerender()); return; }
    if (el.dataset?.incR) { const r = R(); r[el.dataset.incR] = el.value; return rerender(); }
    if (el.dataset?.incAnchor !== undefined) { const v = el.value; if (v) dateLater(v, () => guard(async () => { await saveMeta({ _income_cfg: { ...incCfg(), anchor: v } }); staleAll(["ledger"]); rerender(); })); return; }
    if (el.dataset?.incAi === "consent") { try { localStorage.setItem("hmh-income-ai-ok", el.checked ? "1" : "0"); } catch { /* 忽略 */ } return rerender(); }
    if (el.dataset?.incAi === "unmask") { R().unmask = el.checked; return; }
  });
  document.addEventListener("budget-saved", () => { if (state.route?.section === "bills" && state.route?.sub === "income") rerender(); });
}
/** 存回预算设置时用原样的自定义类型（不带换算出来的 parent 以外的显示字段） */
const rawKinds = () => customKinds().map(({ id, name, icon, parent }) => ({ id, name, icon, parent }));
/** 提醒：个人赠与 / 借款的还款逾期、一个月内到期（只有能看到这条收入的人才有：行级安全已经过滤） */
export function incomeAlertItems() {
  if (!state.billsEnabled || !inc().ok) return [];
  const link = `${href("bills", "income")}?tab=records`, out = [];
  for (const { r, s } of openRepayments()) {
    if (!r.repay_due_on) continue;
    const d = daysUntil(r.repay_due_on); if (d > 30) continue;
    const sev = d < 0 ? 0 : d <= 7 ? 2 : 3;
    out.push({ source: "income", severity: sev, must: sev <= 1, due: r.repay_due_on, daysLeft: d, title: `🤝 ${d < 0 ? t("还款已逾期：{who}", { who: r.source_name }) : t("还款快到期：{who}", { who: r.source_name })}`,
      detail: d < 0 ? t("逾期 {d} 天，还差 {a}", { d: -d, a: money(s.left) }) : t("{d} 天后到期，还差 {a}", { d, a: money(s.left) }), href: link, badge: { label: d < 0 ? t("逾期") : t("{d} 天", { d }), cls: sev === 0 ? "b-out" : sev === 2 ? "b-soon" : "b-ok" }, actions: [{ type: "link", href: link, label: t("去还款"), cls: "btn-ghost" }] });
  }
  return out;
}
registerAlerts(incomeAlertItems);
export { openRepayments, repaidOf };
// 付款方多选合并：输入的「合并为」名字记下来，勾选别的付款方重画时不丢
if (typeof document !== "undefined") document.addEventListener("input", (e) => { if (e.target?.id === "incMergeTo") inc().smergeTo = e.target.value; });
incDraw.fn = () => renderIncList();
