/* 银行导入「最近导入」里：被小票替换的整笔（迁移 114 的归档表）。
 * 对账单页的笔数 / 合计把它们算在内（和导入时一样，才能核对）；花费统计不算它们（它们已不在 purchases 里，不会重复）。
 * 这里只管这一小块：一行说明 + 点开的清单，每条可以「撤销替换」（搬回花费，统计里又会算上它）。 */
import { Store } from "../core/store.js";
import { esc, fmtShort, money, num, toast } from "../core/util.js";
import { t } from "../core/i18n.js";

const ST = { open: "", rows: [], busy: false };

/** 一批下面的说明行（x = 这批现在的数字，x.un / x.us = 其中已被替换的笔数 / 合计）；没有被替换的就不画 */
export function supHtml(b, x) {
  if (!x.un) return "";
  const open = ST.open === b.id;
  const list = !open ? "" : ST.busy ? `<p class="muted">${esc(t("读取中…"))}</p>` : !ST.rows.length ? `<p class="muted">${esc(t("没有读到被替换的记录。"))}</p>`
    : `<ul class="bank-sup-list">${ST.rows.map((r) => `<li><span class="grow"><b>${esc(r.store || r.name || "")}</b> <small class="muted">${esc(fmtShort(r.purchased_at))} · ${money(num(r.amount))}</small></span><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-bank-act="sup-undo" data-id="${esc(r.id)}" data-batch="${esc(b.id)}">${esc(t("撤销替换"))}</button></li>`).join("")}</ul>`;
  return `<small class="muted bank-sup">${esc(t("其中 {n} 笔 {m} 已被小票替换（花费统计里已去掉，免得重复；上面的笔数和合计仍然包含它们）", { n: x.un, m: money(x.us) }))}
    <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-bank-act="sup-open" data-batch="${esc(b.id)}" aria-expanded="${open}">${esc(open ? t("收起") : t("查看 / 撤销"))}</button></small>${list}`;
}

export async function toggleSup(batch, redraw) {
  if (ST.open === batch) { ST.open = ""; return redraw(); }
  ST.open = batch; ST.busy = true; ST.rows = []; redraw();
  try { ST.rows = await Store.listSuperseded(batch); } catch (e) { toast(t("读取失败：{msg}", { msg: e.message })); }
  ST.busy = false; redraw();
}

/** 撤销替换：这一笔搬回花费；done() 之后刷新花费数据和这一页的数字 */
export async function undoSup(id, batch, redraw, done) {
  if (!confirm(t("撤销这次替换？这一笔对账单整笔会回到花费里（统计会重新算上它）。如果对应的小票明细还在，花费会重复，请先删掉那张小票的记录。"))) return;
  try { await Store.restoreSuperseded([id]); } catch (e) { return toast(t("撤销失败：{msg}", { msg: e.message })); }
  toast(t("已撤销替换"));
  ST.rows = ST.rows.filter((r) => r.id !== id);
  if (done) await done();
  redraw();
}
