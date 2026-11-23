/* 税务 → 买卖与成本基础：清单里的「链接行」。一行可以不手填，而是链接到一条花费记录（purchases，按房产关联）：
 *  · 存的是 { link: "spend", ref: 花费 id, desc, amount, on }：desc / amount / on 只是备份（记录还没读到时先显示、先算）；
 *    读到记录后金额和名称一律以记录为准（记录里改了，这里跟着变）；记录被删了 → 这一行不计入，标「记录已删除」，由你 × 掉。
 *  · 花费记录只在打开买卖页时、按房产读一次（ui.spend），不读整表；只列这套房的、不是转账的、不是账单虚拟行的。
 *  · 同一笔只能放进一张清单（已链接过的不再出现在选择器里）。 */
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { ui } from "./tax-ui.js";
import { dayOf, linkedRefs, pickable, r2, resolveLink } from "./tax-links-lib.js";
export { linkedRefs, pickable, resolveLink };
import { propOf, saveProp } from "./tax-calendar.js";
import { toast } from "../core/util.js";
import { render } from "../app/render.js";


/** 读这套房关联的花费（每套房读一次；读完调 done 重画）。出错记下 err，不反复重试 */
export async function ensureSpend(pids, done) {
  const todo = pids.filter((id) => !ui.spend.has(id)); if (!todo.length) return;
  for (const id of todo) ui.spend.set(id, { rows: [], loading: true });
  const [{ fetchSpendPages }, { spendBase }] = await Promise.all([import("../stats/spend-trips.js"), import("../stats/records-lite.js")]);
  await Promise.all(todo.map(async (id) => {
    try { ui.spend.set(id, { rows: await fetchSpendPages({ ...spendBase(), prop: id }, 2000) }); }
    catch (e) { ui.spend.set(id, { rows: [], err: e.message }); }
  }));
  done();
}
if (typeof window !== "undefined") window.addEventListener("spend-rows-changed", () => ui.spend.clear());

/** 选择器表单：勾选要链接的花费 */
export function pickerHtml(p, key, leafLabelOf, isTransfer, linked, money) {
  const got = ui.spend.get(p.id);
  if (!got || got.loading) return `<p class="muted">${t("正在读这套房的花费记录…")}</p>`;
  if (got.err) return `<p class="form-error" role="alert">${esc(t("读花费记录失败：{msg}", { msg: got.err }))}</p>`;
  const list = pickable(p.id, linked, isTransfer);
  const rows = list.map((r) => `<li class="tax-pick-row"><label class="check-inline"><input type="checkbox" name="pick" value="${esc(r.id)}"><span class="tax-pick-d"><small class="muted">${esc(dayOf(r.purchased_at))}</small> ${esc(r.name)}<small class="muted tax-pick-c">${esc(leafLabelOf(r.category))}</small></span><b class="tax-imp-a">${money(r2(r.amount))}</b></label></li>`).join("");
  return `<form class="tax-link-form" data-tax-link="${esc(key)}" novalidate>${rows ? `<ul class="tax-pick">${rows}</ul>` : `<p class="muted">${t("这套房没有可链接的花费记录。花费记账时选「房产」，这里就能选到。")}</p>`}
    <div class="tax-item-actions">${rows ? `<button type="submit" class="btn btn-sm btn-primary">${t("链接所选")}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-tax-pick-cancel>${t("取消")}</button></div></form>`;
}

/* 点「从花费记录里选」/ 取消 / 提交勾选（链接所选）。删除（解除链接）走 tax-actions.js 里和手填行一样的 × */
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const pick = e.target.closest?.("[data-tax-pick]"), cancel = e.target.closest?.("[data-tax-pick-cancel]");
    if (!(pick || cancel) || !e.target.closest(".tax-page")) return;
    ui.pick = pick ? pick.dataset.taxPick : null; if (pick) ui.add = null; render(false);
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target; if (!f?.dataset?.taxLink || !f.closest(".tax-page")) return;
    e.preventDefault(); const [id, key] = f.dataset.taxLink.split("|"), ids = new Set(new FormData(f).getAll("pick").map(String));
    if (!ids.size) return toast(t("先勾选要链接的花费。"));
    const rows = (ui.spend.get(id)?.rows || []).filter((r) => ids.has(String(r.id))).map((r) => ({ link: "spend", ref: r.id, desc: String(r.name || "").slice(0, 60), amount: r2(r.amount), on: dayOf(r.purchased_at) }));
    ui.pick = null;
    try { await saveProp(id, { [key]: [...(propOf(id)[key] || []), ...rows] }); } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
    render(false);
  });
}
