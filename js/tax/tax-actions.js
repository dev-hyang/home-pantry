/* 税务页的勾选 / 输入：家庭情况开关、单据「收到了」「放在哪」、每年的「已延期 / 已报完 / 单据收齐」。改完立刻存（预算表的 _tax_cfg），再重画当前页。 */
import { saveSetup, saveYear, yearState } from "./tax-calendar.js";
import { toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { render } from "../app/render.js";

const done = async (p) => { try { await p; render(false); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); } };
const patchDoc = (y, id, patch) => { const docs = { ...(yearState(y).docs || {}) }; docs[id] = { ...(docs[id] || {}), ...patch }; return saveYear(y, { docs }); };

if (typeof document !== "undefined") {
  document.addEventListener("change", (e) => {
    const el = e.target; if (!el.closest?.(".tax-page")) return;
    const d = el.dataset, y = d.y;
    if (d.taxFlag) return done(saveSetup({ flags: { [d.taxFlag]: el.checked } }));
    if ("taxItin" in d) return done(saveSetup({ spouseItin: el.checked }));
    if ("taxKids" in d) return done(saveSetup({ kids: Math.max(0, Math.min(12, Math.round(Number(el.value) || 0))) }));
    if (d.taxYear) return done(saveYear(y, { [d.taxYear]: el.checked }));
    if (d.taxDoc) return done(patchDoc(y, d.taxDoc, { got: el.checked }));
    if (d.taxWhere) return done(patchDoc(y, d.taxWhere, { where: el.value.trim().slice(0, 60) }));
  });
}
