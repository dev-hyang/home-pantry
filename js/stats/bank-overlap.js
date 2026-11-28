/* 对账单导入页：「这份文件和已导入的批次重叠吗」的提示条（只提醒，防重复本身靠指纹 + 日期金额比对）。 */
import { needsAccountHint, overlapBatches, rangeOfRows } from "./bank-overlap-lib.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";

/** rows = 读出来的交易行（带 dup / idup / forced 标记）；batches = 已导入批次；acct = 现在选的账户 */
export function overlapHtml(rows, batches, acct) {
  const range = rangeOfRows(rows); if (!range) return "";
  const hits = overlapBatches(batches, acct, range), skipN = rows.filter((r) => (r.dup || r.idup) && !r.forced).length;
  const lines = hits.slice(0, 3).map((b) => `<li>${t("{at} 导入的一批（{from} → {to}{n}）", { at: esc(b.at || "?"), from: esc(b.from), to: esc(b.to), n: b.n != null ? t("，{n} 笔", { n: b.n }) : "" })}</li>`).join("");
  const hint = needsAccountHint(acct, range) ? `<p class="muted" style="margin:6px 0 0">${t("这份文件跨了 {d} 天，又没选账户：重叠的文件更容易漏判。建议在下面选好账户再导入。", { d: range.days })}</p>` : "";
  if (!hits.length && !hint) return "";
  return `<div class="panel bank-overlap" role="status"><b>${hits.length ? t("和已导入的批次有重叠") : t("提醒")}</b>
    ${hits.length ? `<ul class="muted" style="margin:6px 0 0;padding-left:18px">${lines}${hits.length > 3 ? `<li>${t("还有 {n} 批", { n: hits.length - 3 })}</li>` : ""}</ul>
    <p class="muted" style="margin:6px 0 0">${skipN ? t("这份文件里有 {n} 笔已经记录过，会自动跳过，不会重复导入。", { n: skipN }) : t("重叠区间里已经记过的笔会按指纹和日期 + 金额自动跳过；没有对上的才会导入。")}</p>` : ""}${hint}</div>`;
}
