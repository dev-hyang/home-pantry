/* 列表的「多选删除」（统一做法）：长按 / 右键一行 → 菜单里的「多选删除」进入；进入后点行就是勾选（不跳详情），顶上一条操作栏：全选 / 清空 / 删除所选 / 退出。
 * 用法（每个列表）：
 *   bulkRegister(key, { ids: () => 当前筛选结果里能删的 id 数组, del: async (id) => 删一条, label: "条" })
 *   行：bulkOn(key) 时不画长按菜单 / 点击跳转，改成 data-row-chk + bulkCheck(key, id)；没进入时菜单里放 bulkMenuItem(key, id)
 *   列表上方：bulkBar(key)
 * 一次只在一个列表里多选；离开页面自动退出。点行勾选由 main.js 的 [data-row-chk] 处理（它去点行里的勾选框，这里监听 change）。
 * 花费明细 / 收入明细是更早做的，有自己的一套（spendSel / inc.selMode），长按菜单的交互和这里一致。 */
import { esc, confirmDelete, toast } from "./util.js";
import { t } from "./i18n.js";
import { refresh } from "../app/data.js";
import { render } from "../app/render.js";

const regs = new Map();
let cur = null;   // { key, sel: Set }

export const bulkRegister = (key, cfg) => { regs.set(key, cfg); };
/** 这个列表正处在多选里？（是 = 已勾选的 Set，否则 null） */
export const bulkOn = (key) => (cur?.key === key ? cur.sel : null);
/** 长按菜单项：进入多选，这一行先勾上 */
export const bulkMenuItem = (key, id) => ({ label: t("多选删除"), data: { bulk: "start", key, id } });
export const bulkCheck = (key, id) => `<input type="checkbox" class="sel" data-bulk-id="${esc(id)}" aria-label="${esc(t("选择"))}" ${cur?.sel.has(id) ? "checked" : ""}>`;

const idsOf = (key) => regs.get(key)?.ids() || [];
export function bulkBar(key) {
  if (cur?.key !== key) return "";
  const n = [...cur.sel].filter((id) => idsOf(key).includes(id)).length;
  return `<div class="sel-bar" role="region" aria-label="${esc(t("多选删除"))}" data-bulk-key="${esc(key)}"><b id="bulkCount">${t("已选 {n} 笔", { n })}</b>
    <button type="button" class="btn btn-sm btn-ghost" data-bulk="all" data-key="${esc(key)}">${t("全选当前显示的 {n} 笔", { n: idsOf(key).length })}</button>
    <button type="button" class="btn btn-sm btn-ghost" data-bulk="none" data-key="${esc(key)}">${t("清空")}</button>
    <button type="button" class="btn btn-sm btn-danger-ghost" data-bulk="del" data-key="${esc(key)}" ${n ? "" : "disabled"}>${t("删除所选")}</button>
    <button type="button" class="btn btn-sm btn-ghost" data-bulk="exit" data-key="${esc(key)}">${t("退出多选")}</button></div>`;
}

async function deleteSelected(key) {
  const cfg = regs.get(key), ids = [...cur.sel].filter((id) => idsOf(key).includes(id));
  if (!cfg || !ids.length || !confirmDelete(t("删除选中的 {n} 条记录？删了就找不回来，建议先备份。", { n: ids.length }))) return;
  let fail = 0;
  for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map((id) => cfg.del(id).catch(() => { fail++; })));
  cur = null;
  toast(fail ? t("删了 {n} 笔，{k} 笔失败", { n: ids.length - fail, k: fail }) : t("已删除 {n} 笔", { n: ids.length }));
  await refresh(); render(true);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-bulk]"); if (!b) return;
  const key = b.dataset.key, act = b.dataset.bulk;
  if (act === "start") cur = { key, sel: new Set([b.dataset.id]) };
  else if (cur?.key !== key) return;
  else if (act === "all") idsOf(key).forEach((id) => cur.sel.add(id));
  else if (act === "none") cur.sel = new Set();
  else if (act === "exit") cur = null;
  else if (act === "del") return deleteSelected(key);
  render(true);
});
document.addEventListener("change", (e) => {
  const c = e.target.closest?.("input[data-bulk-id]"); if (!c || !cur) return;
  if (c.checked) cur.sel.add(c.dataset.bulkId); else cur.sel.delete(c.dataset.bulkId);
  const n = [...cur.sel].filter((id) => idsOf(cur.key).includes(id)).length, el = document.getElementById("bulkCount"), d = document.querySelector('[data-bulk="del"]');
  if (el) el.textContent = t("已选 {n} 笔", { n }); if (d) d.disabled = !n;
});
window.addEventListener("hashchange", () => { cur = null; });
