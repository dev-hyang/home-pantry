/* 买卖清单链接行的纯逻辑（不碰页面，方便测试）；说明见 tax-links.js */
import { ui } from "./tax-ui.js";
import { state } from "../core/state.js";

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** 金额档位（从高到低，第一项 = 全部金额）：按金额的绝对值；[含下限, 不含上限) */
export const AMT_BUCKETS = [["all", "全部金额"], ["1000", "1000+"], ["500", "500–999"], ["200", "200–499"], ["100", "100–199"], ["50", "50–99"], ["0", "0–49"]];
const AMT_RANGE = { 1000: [1000, Infinity], 500: [500, 1000], 200: [200, 500], 100: [100, 200], 50: [50, 100], 0: [0, 50] };
export const bucketOk = (b, amt) => { const r = AMT_RANGE[b]; if (!r) return true; const a = Math.abs(Number(amt) || 0); return a >= r[0] && a < r[1]; };
export const dayOf = (iso) => String(iso || "").slice(0, 10);

/** 一行链接解析成显示 / 计算用的行：missing = 记录读到了但找不到（已删除）→ 金额按 0 算 */
export function resolveLink(row, pid) {
  if (row.link === "income") {   // 收入记录全部在内存里（state.inc.rec），读到了就以记录为准
    const live = (state.inc?.rec || []).find((r) => r.id === row.ref);
    if (live) return { ...row, desc: live.source_name || row.desc, amount: r2(live.amount), on: dayOf(live.received_on) || row.on };
    return state.inc?.loaded ? { ...row, missing: true, amount: 0 } : row;
  }
  const got = ui.spend.get(pid), live = got && !got.err ? got.rows.find((r) => r.id === row.ref) : null;
  if (live) return { ...row, desc: live.name || row.desc, amount: r2(live.amount), on: dayOf(live.purchased_at) || row.on };
  if (got && !got.err && got.rows) return { ...row, missing: true, amount: 0 };
  return row;
}
/** 这套房所有清单里已经链接过的花费 id */
export function linkedRefs(x, keys, kind = "spend") {
  return new Set(keys.flatMap((k) => (x[k] || []).filter((r) => r.link === kind).map((r) => r.ref)));
}
/** 选择器里能选的收入：还没被链接、金额为正的全部收入记录；关联了这套房的排前面（再按日期从近到远），找不到时在搜索框里按名称 / 日期 / 金额筛 */
export function pickableIncome(pid, linked) {
  const mine = (r) => (r.property_id === pid ? 0 : 1);
  return (state.inc?.rec || []).filter((r) => Number(r.amount) > 0 && !linked.has(r.id)).sort((a, b) => mine(a) - mine(b) || String(b.received_on).localeCompare(String(a.received_on)));
}

/* ── AI 识别查重：和清单里已有的行比 ── */
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
const words = (s) => norm(s).split(" ").filter((w) => w.length >= 3 || /[\u4e00-\u9fff]/.test(w));
/** 两个名字像不像：一个包含另一个，或共有一个像样的词（英文 ≥ 3 个字母、中文任意一个词） */
export function similarName(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const wy = new Set(words(y)); return words(x).some((w) => wy.has(w));
}
/** 一个识别出来的项在已有行里有没有对上：金额相同（差 ≤ 1 分）才算；名字也像 = strong。返回 { row, strong } 或 null */
export function dupInfo(line, rows) {
  const hits = rows.filter((r) => !r.missing && Math.abs((Number(r.amount) || 0) - (Number(line.amount) || 0)) <= 0.01);
  if (!hits.length) return null;
  const named = hits.find((r) => similarName(line.desc, r.desc));
  return { row: named || hits[0], strong: !!named };
}
/** 一张清单（含链接行解析后的金额）当前所有行 */
export const rowsOf = (x, key, pid) => (x[key] || []).map((it) => (it.link ? resolveLink(it, pid) : it));

/** 勾选的记录 → 要存进清单的链接行（备份名称 / 金额 / 日期只在记录没读到时用） */
export function linkRows(kind, pid, ids) {
  if (kind === "income") return (state.inc?.rec || []).filter((r) => ids.has(String(r.id))).map((r) => ({ link: "income", ref: r.id, desc: String(r.source_name || "").slice(0, 60), amount: r2(r.amount), on: dayOf(r.received_on) }));
  return (ui.spend.get(pid)?.rows || []).filter((r) => ids.has(String(r.id))).map((r) => ({ link: "spend", ref: r.id, desc: String(r.name || "").slice(0, 60), amount: r2(r.amount), on: dayOf(r.purchased_at) }));
}
/** 选择器里能选的花费：这套房的、不是转账、不是账单虚拟行、有金额、还没被链接 */
export function pickable(pid, linked, isTransfer) {
  const got = ui.spend.get(pid); if (!got || got.err) return [];
  return got.rows.filter((r) => !r.virtual && r.amount != null && Number(r.amount) !== 0 && !isTransfer(r.category, r.nature) && !linked.has(r.id))
    .sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)));
}

