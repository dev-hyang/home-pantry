/* 对账单导入前的「和已导入的批次重叠吗」（纯函数，不碰页面，方便测试）。
 * 只是提醒：真正防重复靠每一行的指纹（bank-keys-lib.js）和已有花费的日期 + 金额比对，重叠的行会自动跳过。 */
const DAY = 864e5;
const dayN = (iso) => Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`) / DAY;

/** 这份文件的日期范围：{ from, to, days }；没有日期返回 null */
export function rangeOfRows(rows) {
  const d = rows.map((r) => String(r.date || "").slice(0, 10)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  return d.length ? { from: d[0], to: d.at(-1), days: Math.round(dayN(d.at(-1)) - dayN(d[0])) + 1 } : null;
}

/** 和这个文件日期范围重叠、且是同一个账户的已导入批次。账户：有尾号按尾号比，否则有名字按名字比，都没有（没选账户）就和所有批次比。
 *  批次按「导入时间」从近到远；重叠区间 = 两个范围的交集。 */
export function overlapBatches(batches, acct, range) {
  if (!range) return [];
  const last4 = String(acct?.last4 || "").trim(), name = String(acct?.name || "").trim();
  const same = (b) => (last4 ? String(b.last4 || "") === last4 : name ? (b.account || "") === name : true);
  return (batches || []).filter((b) => b.from && b.to && same(b) && b.from <= range.to && b.to >= range.from)
    .map((b) => ({ id: b.id, at: String(b.at || "").slice(0, 10), n: b.n ?? null, from: b.from > range.from ? b.from : range.from, to: b.to < range.to ? b.to : range.to }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** 没选账户、文件又跨了一个多月：值得提醒「选账户」（没有账户，指纹里就没有账户，重叠的文件更容易漏判） */
export const needsAccountHint = (acct, range) => !!range && range.days > 40 && !(String(acct?.last4 || "").trim() || String(acct?.name || "").trim());
