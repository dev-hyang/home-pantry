/* 我的 → 家里的数字（2026-11-06，原「统计」重做；钱的统计在 财务 → 花费）
 * 讲家里的事，不讲钱：年度回顾、最常用、补货节奏、谁在出力、保养与季节任务、一周节奏、浪费。
 * 数据：库存日志近一年（只在打开这一页时读一次，按 1000 行一页，存在 state.homeStats，10 分钟内不重读），
 *       内存里已有的物品 / 采购 / 设备保养记录 / 季节任务完成记录。不新增别的查询。
 * 浪费靠库存日志的新原因 discard（迁移 065）：过期的物品卡上点「扔掉」记一笔，不算进日均用量。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { DAY, catOf, esc, fmt } from "../core/util.js";
import { compare, lang, t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { href } from "../core/router.js";
import { liveProperties } from "../core/alerts.js";
import { propertyActive } from "../core/lifecycle.js";
import { monthTasks } from "../house/tasks.js";
import { consumptionData, itemSeries } from "./views.js";

const HS = (state.homeStats ||= { logs: [], key: "", at: 0, loading: false, err: "" });
const FRESH = 10 * 60e3;
let rerender = () => {};
export const initHomeStats = (fn) => { rerender = fn; };
async function load() {
  const key = `${Store.mode}|${Store.hid || ""}`;
  if (HS.loading || (HS.key === key && Date.now() - HS.at < FRESH)) return;
  HS.loading = true; HS.err = "";
  try { HS.logs = await Store.listLogsSince(new Date(Date.now() - 366 * DAY).toISOString()); HS.key = key; HS.at = Date.now(); }
  catch (e) { HS.err = e.message || "error"; }
  HS.loading = false;
  if (state.route?.section === "me" && state.route?.sub === "stats") rerender();
}

/* ── 小工具 ── */
const ts = (l) => new Date(l.created_at).getTime();
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const lastMonths = (n) => { const out = [], d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(monthKey(x)); } return out; };
const mLabel = (m) => (lang === "en" ? new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleDateString("en", { month: "short" }) : t("{m} 月", { m: +m.slice(5) }));
const itemName = (id) => state.items.find((i) => i.id === id)?.name || t("（已删除的物品）");
const who = (uid) => (uid ? memberName(uid) || t("家人") : t("我"));
const PALETTE = ["var(--pine)", "var(--mustard)", "#4f7f9f", "#b8576f", "#7563c0", "#8a6d3b"];
const sec = (id, title, sub, body) => `<section class="section" aria-labelledby="hs-${id}"><div class="section-head"><h2 id="hs-${id}">${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${body}</section>`;
const emptyP = (s) => `<div class="panel empty"><strong>${s}</strong></div>`;
const WEEK = () => [t("周一"), t("周二"), t("周三"), t("周四"), t("周五"), t("周六"), t("周日")];
const wdIdx = (d) => (d.getDay() + 6) % 7;   // 周一 = 0

/* (f) 年度回顾：今年到现在的几个数 + 三个「之最」 */
function yearReview(logs) {
  const y = new Date().getFullYear(), from = new Date(y, 0, 1).getTime(), mine = logs.filter((l) => ts(l) >= from);
  const n = (r) => mine.filter((l) => l.reason === r).length;
  const top = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); if (k != null) m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1])[0] || null; };
  const topItem = top(mine.filter((l) => l.reason === "consume"), (l) => l.item_id);
  const multi = new Set(mine.map((l) => l.created_by || "me")).size > 1;
  const topBuyer = multi ? top(mine.filter((l) => l.reason === "restock"), (l) => l.created_by || "me") : null;
  const topDay = top(mine, (l) => wdIdx(new Date(l.created_at)));
  const added = state.items.filter((i) => i.created_at && new Date(i.created_at).getTime() >= from).length;
  const maint = (state.maintLogs || []).filter((l) => String(l.done_on || "").startsWith(String(y))).length;
  const season = (state.seasonalDone || []).filter((d) => String(d.done_on || "").startsWith(String(y))).length;
  const stat = (v, k) => `<div class="hs-stat"><b class="num">${v}</b><span>${k}</span></div>`;
  const facts = [
    topItem && t("最常用的是「{name}」，用了 {n} 次", { name: itemName(topItem[0]), n: topItem[1] }),
    topBuyer && t("最勤快的补货员：{who}（{n} 次）", { who: topBuyer[0] === "me" ? t("我") : who(topBuyer[0]), n: topBuyer[1] }),
    topDay && t("{d}最忙：这一天记得最多", { d: WEEK()[topDay[0]] }),
  ].filter(Boolean);
  return `<div class="panel hs-year"><div class="hs-stats">${stat(n("consume"), t("次用掉"))}${stat(n("restock"), t("次补货"))}${stat(added, t("件新物品"))}${state.houseEnabled ? stat(maint, t("次保养")) + stat(season, t("项季节任务")) : ""}${stat(n("discard"), t("件扔掉"))}</div>
    ${facts.length ? `<ul class="hs-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="muted" style="margin:8px 0 0">${t("今年还没有使用记录。在库存里用掉东西时点一下 −，补货点 +，这里就会热闹起来。")}</p>`}</div>`;
}

/* (b) 最常用 Top 10（近 90 天按「用掉」次数）+ 单品用量与库存（原来的图） */
function topUsed(logs) {
  const since = Date.now() - 90 * DAY, m = new Map();
  for (const l of logs) if (l.reason === "consume" && ts(l) >= since) m.set(l.item_id, (m.get(l.item_id) || 0) + 1);
  const items = [...m].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, v]) => ({ name: itemName(id), value: v, color: catOf(state.items.find((i) => i.id === id)?.category).color }));
  if (!items.length) return emptyP(t("近 90 天还没有「用掉」的记录"));
  const cd = consumptionData(), ranked = state.items.filter((i) => cd.perItem[i.id]).sort((a, b) => cd.perItem[b.id] - cd.perItem[a.id]);
  const sel = state.items.find((i) => i.id === state.stats.itemId && cd.perItem[i.id]) || ranked[0];
  let one = "";
  if (sel) {
    const ser = itemSeries(sel, cd.starts), c = catOf(sel.category);
    one = `<div class="panel chart-panel"><div class="chart-head"><h3>${t("单品用量与库存")}</h3>
      <select id="statsItem" aria-label="${t("选择物品")}">${ranked.map((i) => `<option value="${i.id}" ${i.id === sel.id ? "selected" : ""}>${esc(i.name)}（${t("{n} 次", { n: cd.perItem[i.id] })}）</option>`).join("")}</select></div>
      ${window.Charts.line({ title: t("{name}每周用量与库存", { name: sel.name }), labels: cd.labels, fmt: (v) => `${fmt(v)} ${ser.unit}`,
        barSeries: { name: t("每周用量（{u}）", { u: ser.unit }), color: c.color, values: ser.used }, series: [{ name: t("周末库存（{u}）", { u: ser.unit }), color: "var(--ink)", values: ser.level }] })}</div>`;
  }
  return `<div class="panel chart-panel">${window.Charts.hbars({ items, fmt: (v) => t("{n} 次", { n: v }), title: t("最常用 Top 10") })}</div>${one}`;
}

/* (a) 补货节奏：一年里补过 2 次以上的物品，平均几天补一次；按「预计几天后用完」排（库存页同一套估算） */
function restockRhythm(logs) {
  const by = new Map();
  for (const l of logs) if (l.reason === "restock") (by.get(l.item_id) || by.set(l.item_id, []).get(l.item_id)).push(ts(l));
  const rows = [];
  for (const [id, list] of by) {
    const it = (state.enriched || []).find((x) => x.id === id); if (!it || list.length < 2) continue;
    list.sort((a, b) => a - b);
    const gaps = list.slice(1).map((x, i) => (x - list[i]) / DAY).filter((g) => g >= 0.5);   // 同一天连点几下不算两次
    if (!gaps.length) continue;
    rows.push({ it, every: gaps.reduce((a, b) => a + b, 0) / gaps.length, last: list.at(-1), left: it.daysLeft != null && it.qty > 0 ? Math.max(0, Math.floor(it.daysLeft)) : it.qty <= 0 ? 0 : null });
  }
  if (!rows.length) return emptyP(t("还看不出节奏：同一件东西补货（点 +）两次以上，这里就会算出平均几天补一次"));
  rows.sort((a, b) => (a.left ?? 9999) - (b.left ?? 9999) || compare(a.it.name, b.it.name));
  const max = Math.max(...rows.map((r) => Math.max(r.every, r.left ?? 0)), 1);
  return `<div class="panel"><ul class="hs-rhythm">${rows.slice(0, 12).map((r) => `<li>
    <div class="hs-r-top"><b>${esc(r.it.name)}</b><span class="muted">${t("平均 {n} 天补一次", { n: Math.round(r.every) })}</span></div>
    <div class="hs-r-bar" aria-hidden="true"><i style="width:${Math.min(100, (r.every / max) * 100)}%"></i>${r.left != null ? `<em style="left:${Math.min(100, (r.left / max) * 100)}%"></em>` : ""}</div>
    <small class="${r.left != null && r.left <= 3 ? "down" : "muted"}">${r.left == null ? t("还估不出什么时候用完") : r.left === 0 ? t("已经用完了") : t("预计 {n} 天后用完", { n: r.left })} · ${t("上次补货 {d}", { d: new Date(r.last).toLocaleDateString() })}</small></li>`).join("")}</ul>
    <p class="legend-line small muted"><span><i class="hs-sw"></i>${t("条长 = 平均补货间隔")}</span><span><i class="hs-sw hs-mark"></i>${t("竖线 = 预计还能用几天")}</span></p></div>`;
}

/* (c) 谁在出力：近 6 个月每月每人记了几次（用掉 / 补货 / 扔掉），今年合计谁做了什么 */
function whoHelps(logs) {
  const ids = [...new Set(logs.map((l) => l.created_by || "me"))];
  if (!logs.length) return emptyP(t("还没有记录"));
  const ms = lastMonths(6), y = new Date().getFullYear(), from = new Date(y, 0, 1).getTime();
  const name = (k) => (k === "me" ? t("我") : who(k));
  const series = ids.map((k, i) => ({ name: name(k), color: PALETTE[i % PALETTE.length], values: ms.map((m) => logs.filter((l) => (l.created_by || "me") === k && monthKey(new Date(l.created_at)) === m).length) }));
  const totals = ids.map((k) => { const mine = logs.filter((l) => (l.created_by || "me") === k && ts(l) >= from); return { k, c: mine.filter((l) => l.reason === "consume").length, r: mine.filter((l) => l.reason === "restock").length, d: mine.filter((l) => l.reason === "discard").length }; })
    .sort((a, b) => b.c + b.r - (a.c + a.r));
  const note = ids.length < 2 ? `<p class="muted small" style="margin:8px 0 0">${t("目前只有一个人在记。邀请家人一起用后，这里能看到谁在补货、谁在用。")}</p>` : "";
  return `<div class="panel chart-panel">${window.Charts.bars({ title: t("每月记录次数（按人）"), labels: ms.map(mLabel), series, fmt: (v) => t("{n} 次", { n: Math.round(v) }) })}
    <ul class="hs-who">${totals.map((x) => `<li><b>${esc(name(x.k))}</b><span>${t("今年：用掉 {c} 次 · 补货 {r} 次 · 扔掉 {d} 件", x)}</span></li>`).join("")}</ul>${note}</div>`;
}

/* (d) 保养与季节任务：近 12 个月，季节任务每月完成 / 没完成（全部在用房产），保养记录每月按类型 */
function careRate() {
  if (!state.houseEnabled) return "";
  const ms = lastMonths(12), props = liveProperties().filter(propertyActive);
  const done = [], undone = [];
  for (const m of ms) {
    let a = 0, b = 0;
    for (const p of props) { const list = monthTasks(+m.slice(0, 4), +m.slice(5), state.houseProfiles?.[p.id], p.id); a += list.filter((x) => x.done).length; b += list.filter((x) => !x.done).length; }
    done.push(a); undone.push(b);
  }
  const K = { inspect: t("检查"), service: t("保养"), repair: t("维修"), replace: t("更换") }, KC = { inspect: "#4f7f9f", service: "var(--pine)", repair: "var(--low)", replace: "var(--exp)" };
  const logs = state.maintLogs || [];
  const mSeries = Object.keys(K).map((k) => ({ name: K[k], color: KC[k], values: ms.map((m) => logs.filter((l) => l.kind === k && String(l.done_on || "").startsWith(m)).length) })).filter((s) => s.values.some(Boolean));
  const planned = done.reduce((a, b) => a + b, 0) + undone.reduce((a, b) => a + b, 0), rate = planned ? Math.round(done.reduce((a, b) => a + b, 0) / planned * 100) : null;
  const seasonChart = planned ? window.Charts.bars({ title: t("季节任务：每月完成 / 没完成"), labels: ms.map(mLabel), fmt: (v) => t("{n} 项", { n: Math.round(v) }),
    series: [{ name: t("完成"), color: "var(--ok)", values: done }, { name: t("没完成"), color: "var(--line)", values: undone }] }) : `<p class="muted">${t("还没有季节任务（填了房屋资料后会按月份列出）。")}</p>`;
  const maintChart = mSeries.length ? window.Charts.bars({ title: t("设备保养记录：每月按类型"), labels: ms.map(mLabel), fmt: (v) => t("{n} 次", { n: Math.round(v) }), series: mSeries }) : `<p class="muted">${t("近 12 个月还没有保养记录。")}</p>`;
  return sec("care", t("保养与季节任务"), rate != null ? t("近 12 个月季节任务完成 {p}%", { p: rate }) : "", `<div class="panel chart-panel"><h3>${t("季节任务完成率")}</h3>${seasonChart}</div><div class="panel chart-panel"><h3>${t("设备保养")}</h3>${maintChart}</div>`);
}

/* (e) 一周节奏：周一到周日 × 五个时段，格子越深记得越多（用掉 + 补货，近一年） */
function weekRhythm(logs) {
  const BANDS = [[6, 11, t("早上")], [11, 14, t("中午")], [14, 18, t("下午")], [18, 23, t("晚上")], [23, 30, t("深夜")]];
  const band = (h) => BANDS.findIndex(([a, b]) => (h >= a && h < b) || (h + 24 >= a && h + 24 < b));
  const grid = Array.from({ length: 7 }, () => Array(5).fill(0));
  for (const l of logs) { if (l.reason !== "consume" && l.reason !== "restock") continue; const d = new Date(l.created_at), b = band(d.getHours()); if (b >= 0) grid[wdIdx(d)][b]++; }
  const max = Math.max(1, ...grid.flat());
  if (max === 1 && !grid.flat().some(Boolean)) return emptyP(t("还没有记录"));
  const cell = (v) => `<td style="--a:${(v / max).toFixed(2)}" title="${v}"><span>${v || ""}</span></td>`;
  return `<div class="panel"><div class="scroll-x"><table class="hs-heat"><caption class="sr-only">${t("一周里每个时段的记录次数")}</caption>
    <thead><tr><th></th>${BANDS.map(([, , n]) => `<th scope="col">${n}</th>`).join("")}</tr></thead>
    <tbody>${grid.map((row, i) => `<tr><th scope="row">${WEEK()[i]}</th>${row.map(cell).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="muted small" style="margin:8px 0 0">${t("颜色越深，那个时段点 −/+ 越多：看出家里什么时候最忙、什么时候适合补货。")}</p></div>`;
}

/* (g) 浪费：过期扔掉（库存日志 discard，迁移 065）——每月几件、扔得最多的东西 */
function waste(logs) {
  const ds = logs.filter((l) => l.reason === "discard");
  if (!ds.length) return `<div class="panel"><p style="margin:0">${t("还没有扔掉的记录。过期的物品卡上会有「扔掉」按钮，点一下记一笔：这里就能看出哪些东西总是买多了。")}</p></div>`;
  const ms = lastMonths(12), m = new Map();
  for (const l of ds) m.set(l.item_id, (m.get(l.item_id) || 0) + 1);
  const items = [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => ({ name: itemName(id), value: v, color: "var(--out)" }));
  return `<div class="panel chart-panel">${window.Charts.bars({ title: t("每月扔掉几件"), labels: ms.map(mLabel), fmt: (v) => t("{n} 件", { n: Math.round(v) }), series: [{ name: t("扔掉"), color: "var(--out)", values: ms.map((mm) => ds.filter((l) => monthKey(new Date(l.created_at)) === mm).length) }] })}</div>
    <div class="panel chart-panel"><h3>${t("扔得最多的")}</h3>${window.Charts.hbars({ items, fmt: (v) => t("{n} 次", { n: v }), title: t("扔得最多的") })}<p class="muted small" style="margin:6px 0 0">${t("经常扔的东西：下次少买一点、换小包装，或者把少货线调低。")}</p></div>`;
}

export function viewHomeStats() {
  if (!HS.at && !HS.loading && !HS.err) setTimeout(load, 0); else if (Date.now() - HS.at > FRESH && !HS.loading) setTimeout(load, 0);
  const logs = HS.logs;
  const head = `<div class="section-head"><h2>${t("家里的数字")}</h2><p>${t("库存、家务、谁在出力")}${state.billsEnabled ? ` · <a href="${href("bills", "spend")}">${t("钱的统计在 财务 → 花费")} ›</a>` : ""}</p></div>`;
  if (!HS.at) return `<section class="section">${head}<div class="panel"><p class="muted" style="margin:0" role="status">${HS.err ? t("读不到记录：{m}", { m: esc(HS.err) }) : t("正在读取近一年的记录…")}</p></div></section>`;
  return `<section class="section">${head}</section>
    ${sec("year", t("{y} 年回顾", { y: new Date().getFullYear() }), t("今年到现在"), yearReview(logs))}
    ${sec("top", t("最常用"), t("近 90 天，按「用掉」次数"), topUsed(logs))}
    ${sec("rhythm", t("补货节奏"), t("平均几天补一次、还能用几天"), restockRhythm(logs))}
    ${sec("who", t("谁在出力"), t("近 6 个月，按记录的人"), whoHelps(logs))}
    ${careRate()}
    ${sec("week", t("一周节奏"), t("近一年，什么时候最忙"), weekRhythm(logs))}
    ${sec("waste", t("浪费"), t("过期扔掉的东西"), waste(logs))}`;
}
