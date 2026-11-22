/* 税务页的勾选 / 输入：家庭情况开关、单据「收到了」「放在哪」、每年的「已延期 / 已报完 / 单据收齐」。改完立刻存（预算表的 _tax_cfg），再重画当前页。 */
import { propOf, saveAcct, saveProp, saveSetup, saveYear, yearState } from "./tax-calendar.js";
import { toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { render } from "../app/render.js";
import { go, href } from "../core/router.js";
import { summaryCsv } from "./tax-numbers.js";
import { ui } from "./tax-sales.js";

const done = async (p) => { try { await p; render(false); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); } };
const patchDoc = (y, id, patch) => { const docs = { ...(yearState(y).docs || {}) }; docs[id] = { ...(docs[id] || {}), ...patch }; return saveYear(y, { docs }); };

if (typeof document !== "undefined") {
  document.addEventListener("change", (e) => {
    const el = e.target; if (!el.closest?.(".tax-page")) return;
    const d = el.dataset, y = d.y;
    if ("taxYsel" in d) return go(`${href("bills", "tax")}?${d.tab === "year" ? "" : `tab=${d.tab}&`}y=${el.value}`);   // 筛选里换税务年度
    if (d.taxPlan) return done(saveYear(y, { plan: { ...(yearState(y).plan || {}), [d.taxPlan]: el.value === "" ? null : Math.max(0, Number(el.value) || 0) } }));   // 预缴税参考的输入
    if ("taxPlanAgi" in d) return done(saveYear(y, { plan: { ...(yearState(y).plan || {}), priorAgiHigh: el.checked } }));
    if (d.taxProp) return done(saveProp(d.taxProp, { [d.key]: d.key === "lived" ? el.value : el.value === "" ? null : Math.max(0, Number(el.value) || 0) }));   // 买卖备忘
    if (d.taxNum) return done(saveYear(y, { nums: { ...(yearState(y).nums || {}), [d.taxNum]: el.value === "" ? null : Math.max(0, Number(el.value) || 0) } }));   // 汇总表手填的数
    if (d.taxOk) return done(saveYear(y, { ok: { ...(yearState(y).ok || {}), [d.taxOk]: el.checked } }));
    if (d.taxForeign) return done(saveAcct(d.taxForeign, { foreign: el.checked }));
    if (d.taxFsa) return done(saveAcct(d.taxFsa, { fsaType: el.value }));
    if (d.taxFlag) return done(saveSetup({ flags: { [d.taxFlag]: el.checked } }, y));   // 家庭情况按税务年度存快照（data-y）
    if ("taxItin" in d) return done(saveSetup({ spouseItin: el.checked }, y));
    if ("taxKids" in d) return done(saveSetup({ kids: Math.max(0, Math.min(12, Math.round(Number(el.value) || 0))) }, y));
    if (d.taxYear) return done(saveYear(y, { [d.taxYear]: el.checked }));
    if (d.taxDoc) return done(patchDoc(y, d.taxDoc, { got: el.checked }));
    if (d.taxWhere) return done(patchDoc(y, d.taxWhere, { where: el.value.trim().slice(0, 60) }));
  });
  /* 买卖与成本基础：一项一项加 / 删（清单见 tax-sales.js 的 SECS；展开 / 加一项的状态在 ui，重画不会折叠你正在填的那套房） */
  document.addEventListener("toggle", (e) => { const d = e.target; if (d?.dataset?.taxOpen) ui.open.set(d.dataset.taxOpen, d.open); }, true);
  document.addEventListener("click", (e) => {
    const add = e.target.closest?.("[data-tax-add]"), cancel = e.target.closest?.("[data-tax-add-cancel]"), del = e.target.closest?.("[data-tax-item-del]");
    if (!(add || cancel || del) || !e.target.closest(".tax-page")) return;
    if (add) { ui.add = add.dataset.taxAdd; return render(false); }
    if (cancel) { ui.add = null; return render(false); }
    const [id, key, third] = del.dataset.taxItemDel.split("|");
    if (key === "legacy") return done(saveProp(id, { [third]: null }));   // 以前只有一个数字框时存的合计
    done(saveProp(id, { [key]: (propOf(id)[key] || []).filter((_, i) => i !== +third) }));
  });
  document.addEventListener("submit", (e) => {
    const f = e.target; if (!f?.dataset?.taxItem || !f.closest(".tax-page")) return;
    e.preventDefault(); const [id, key] = f.dataset.taxItem.split("|"), fd = new FormData(f), desc = String(fd.get("desc") || "").trim().slice(0, 60), amount = Math.round((Number(fd.get("amount")) || 0) * 100) / 100;
    const err = f.querySelector(".tax-item-err");
    if (!desc || !(amount > 0)) { if (err) err.textContent = t("请填「内容」和大于 0 的「金额」。"); (desc ? f.elements.amount : f.elements.desc).focus(); return; }
    const row = { desc, amount }; const on = String(fd.get("on") || ""); if (on) row.on = on;
    ui.add = null; done(saveProp(id, { [key]: [...(propOf(id)[key] || []), row] }));
  });
  document.addEventListener("click", (e) => {   // 导出 CSV / 打印
    const x = e.target.closest?.("[data-tax-export]"), p = e.target.closest?.("[data-tax-print]");
    if (x && x.closest(".tax-page")) { const y = x.dataset.taxExport, a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([summaryCsv(y)], { type: "text/csv;charset=utf-8" })); a.download = `tax-summary-${y}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return; }
    if (p && p.closest(".tax-page")) window.print();
  });
}
