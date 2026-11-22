/* 税务页的勾选 / 输入：家庭情况开关、单据「收到了」「放在哪」、每年的「已延期 / 已报完 / 单据收齐」。改完立刻存（预算表的 _tax_cfg），再重画当前页。 */
import { propOf, saveAcct, saveProp, saveSetup, saveYear, yearState } from "./tax-calendar.js";
import { toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { render } from "../app/render.js";
import { go, href } from "../core/router.js";

const done = async (p) => { try { await p; render(false); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); } };
const patchDoc = (y, id, patch) => { const docs = { ...(yearState(y).docs || {}) }; docs[id] = { ...(docs[id] || {}), ...patch }; return saveYear(y, { docs }); };

if (typeof document !== "undefined") {
  document.addEventListener("change", (e) => {
    const el = e.target; if (!el.closest?.(".tax-page")) return;
    const d = el.dataset, y = d.y;
    if ("taxYsel" in d) return go(`${href("bills", "tax")}?${d.tab === "year" ? "" : `tab=${d.tab}&`}y=${el.value}`);   // 筛选里换税务年度
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
  document.addEventListener("submit", (e) => {   // 记一条装修翻新
    const f = e.target; if (!f?.dataset?.taxImp || !f.closest(".tax-page")) return;
    e.preventDefault(); const id = f.dataset.taxImp, fd = new FormData(f), rows = [...(propOf(id).improvements || []), { on: String(fd.get("on") || ""), desc: String(fd.get("desc") || "").trim().slice(0, 60), amount: Math.round((Number(fd.get("amount")) || 0) * 100) / 100 }];
    if (!(rows[rows.length - 1].amount > 0)) return; done(saveProp(id, { improvements: rows }));
  });
  document.addEventListener("click", (e) => {   // 删一条装修翻新
    const b = e.target.closest?.("[data-tax-imp-del]"); if (!b || !b.closest(".tax-page")) return;
    const [id, n] = b.dataset.taxImpDel.split(":"); done(saveProp(id, { improvements: (propOf(id).improvements || []).filter((_, i) => i !== +n) }));
  });
}
