/* 列表里的多选：勾选购物车 / 库存的行、点行钻取。 */
import { $ } from "../../core/util.js";
import { applySpendDrill } from "../../stats/views.js";
import { go, href } from "../../core/router.js";
import { render } from "../render.js";
import { selBarText, shopSelText } from "../../pantry/views.js";
import { state } from "../../core/state.js";

/* 图表色块、图例、名称、数字卡片：点一下（或 Enter / 空格）看对应的花费明细 */
export function drillTo(qs) {
  if (qs.startsWith("inc=1")) return go(`${href("bills", "income")}?tab=records&${qs}`);   // 收入图表（带 inc=1）：到 收入 → 明细，筛选由 income/views.js 的 applyIncomeDrill 套上
  if (state.billsEnabled) return go(`${href("bills", "spend")}?tab=records&${qs}`);
  applySpendDrill(new URLSearchParams(qs)); render(); $("#spendRecords")?.scrollIntoView({ block: "start" });   // 账单模块关闭：明细就在统计页下面
}
/* 购物车多选：点行或勾选框选中 / 取消，只更新这一行和底部操作条 */
export function pickShop(id, on) {
  if (!state.shopSel) return;
  if (on) state.shopSel.add(id); else state.shopSel.delete(id);
  const row = document.querySelector(`[data-row-sel-shop="${CSS.escape(id)}"]`);
  if (row) { row.classList.toggle("is-picked", on); const c = row.querySelector(".shop-chk"); if (c) c.checked = on; }
  const n = document.querySelector(".shop-selbar .inv-seln"); if (n) n.textContent = shopSelText();
  const b = document.querySelector('[data-action="shop-sel-remove"]'); if (b) b.disabled = !state.shopSel.size;
}
/* 库存多选：点行（或勾选框）选中 / 取消，只更新这一行和底部操作条，不重画整页 */
export function pickRow(id, on) {
  if (!state.invSel) return;
  if (on) state.invSel.add(id); else state.invSel.delete(id);
  const row = document.querySelector(`.inv-row[data-id="${CSS.escape(id)}"]`);
  if (row) { row.classList.toggle("is-picked", on); const c = row.querySelector(".inv-chk"); if (c) c.checked = on; }
  const n = document.querySelector(".inv-seln"); if (n) n.textContent = selBarText();
  document.querySelectorAll('.inv-selbar [data-action^="inv-sel-"]:not([data-action="inv-sel-all"])').forEach((b) => { b.disabled = !state.invSel.size; });
}
