import { categoryOptions } from "../pantry/views.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, DAY, catOf, du, esc, fmt, money, num, showQty, toast } from "../core/util.js";

/* ── 统计：花费与消耗趋势 ── */
export const ALL_CATS = () => [...CATEGORIES, OTHER_CAT];
// 统计图里：储藏各分类单独显示，房屋耗材合并为“房屋维护”、装备合并为“装备”各一组，避免颜色过多
export const STAT_CATS = () => [...CATEGORIES.filter((c) => c.space === "pantry"), HOUSE_GROUP, GEAR_GROUP, OTHER_CAT];
export const statCat = (id) => { const c = CATEGORIES.find((x) => x.id === id); return !c ? "other" : c.space === "pantry" ? c.id : c.space; };
export const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
export const monthLabel = (k) => (k.endsWith("-01") ? `${k.slice(2, 4)}年1月` : `${+k.slice(5)}月`);
export function lastMonths(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}

export function spendData() {
  const cur = Units.region.currency;
  const months = lastMonths(state.stats.months);
  const byMC = Object.fromEntries(months.map((m) => [m, {}]));
  const counts = Object.fromEntries(months.map((m) => [m, 0]));
  let otherCurrency = 0;
  for (const p of state.purchases) {
    if (p.amount == null) continue;
    if (p.currency && p.currency !== cur) { otherCurrency++; continue; }
    const m = monthKey(p.purchased_at);
    if (!byMC[m]) continue;
    const c = statCat(p.category);
    byMC[m][c] = (byMC[m][c] || 0) + num(p.amount);
    counts[m]++;
  }
  const totals = months.map((m) => Object.values(byMC[m]).reduce((a, b) => a + b, 0));
  const cats = STAT_CATS().filter((c) => months.some((m) => byMC[m][c.id]));
  return { months, byMC, totals, cats, counts, otherCurrency };
}

export function consumptionData() {
  const WEEKS = 12, now = Date.now();
  const starts = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * 7 * DAY);
  const labels = starts.map((t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; });
  const wk = (t) => Math.floor((t - starts[0]) / (7 * DAY));
  const itemCat = Object.fromEntries(state.items.map((i) => [i.id, i.category]));
  const freq = {}, perItem = {};
  for (const l of state.logs) {
    if (l.reason !== "consume") continue;
    const w = wk(new Date(l.created_at).getTime());
    if (w < 0 || w >= WEEKS) continue;
    const c = itemCat[l.item_id];
    if (!c) continue;
    (freq[c] ||= Array(WEEKS).fill(0))[w]++;
    perItem[l.item_id] = (perItem[l.item_id] || 0) + 1;
  }
  return { WEEKS, starts, labels, freq, perItem };
}

// 周消耗量 + 每周末库存水位（用当前库存减去之后发生的所有变动倒推）
export function itemSeries(item, starts) {
  const W = starts.length, f = Units.factor(item.unit);
  const used = Array(W).fill(0), level = Array(W).fill(0);
  const logs = state.logs.filter((l) => l.item_id === item.id).map((l) => ({ t: new Date(l.created_at).getTime(), d: num(l.delta), r: l.reason }));
  for (const l of logs) {
    const w = Math.floor((l.t - starts[0]) / (7 * DAY));
    if (l.r === "consume" && w >= 0 && w < W) used[w] += -l.d;
  }
  for (let i = 0; i < W; i++) {
    const end = starts[i] + 7 * DAY;
    const after = logs.filter((l) => l.t > end).reduce((a, l) => a + l.d, 0);
    level[i] = Math.max(0, num(item.quantity) - after);
  }
  return { used: used.map((v) => v * f), level: level.map((v) => v * f), unit: du(item.unit) };
}

export function viewStats() {
  const st = state.stats;
  const sd = spendData();
  const { months, byMC, totals, cats } = sd;
  const thisTotal = totals.at(-1) || 0, prevTotal = totals.at(-2) || 0;
  const avg = totals.reduce((a, b) => a + b, 0) / (totals.length || 1);
  const change = prevTotal > 0 ? Math.round(((thisTotal - prevTotal) / prevTotal) * 100) : null;
  const selMonth = st.month && byMC[st.month] ? st.month : months.at(-1);
  const selCat = st.cat && cats.some((c) => c.id === st.cat) ? st.cat : cats[0]?.id;
  const hasSpend = totals.some((v) => v > 0);

  const rangeChips = [6, 12].map((n) => `<button type="button" class="chip" data-action="stats-months" data-months="${n}" aria-pressed="${st.months === n}">近 ${n} 个月</button>`).join("");

  const spendBars = Charts.bars({
    title: "月度采购花费（按分类堆叠）", labels: months.map(monthLabel), fmt: money,
    series: cats.map((c) => ({ name: c.name, color: c.color, values: months.map((m) => byMC[m][c.id] || 0) })),
  });
  const donut = Charts.donut({
    title: `${monthLabel(selMonth)}分类占比`, fmt: money,
    center: money(Object.values(byMC[selMonth]).reduce((a, b) => a + b, 0), true),
    items: STAT_CATS().map((c) => ({ name: `${c.icon} ${c.name}`, color: c.color, value: byMC[selMonth][c.id] || 0 })),
  });
  const catObj = STAT_CATS().find((c) => c.id === selCat);
  const catTrend = catObj ? Charts.line({
    title: `${catObj.name}月度花费趋势`, labels: months.map(monthLabel), fmt: money,
    series: [{ name: catObj.name, color: catObj.color, values: months.map((m) => byMC[m][selCat] || 0) }],
  }) : "";

  // 消耗趋势
  const cd = consumptionData();
  const freqCats = CATEGORIES.filter((c) => cd.freq[c.id]);
  const freqChart = freqCats.length ? Charts.bars({
    title: "每周使用记录次数（按分类）", labels: cd.labels, fmt: (v) => `${Math.round(v)} 次`, showTotals: false,
    series: freqCats.map((c) => ({ name: c.name, color: c.color, values: cd.freq[c.id] })),
  }) : "";
  const ranked = state.items.filter((i) => cd.perItem[i.id]).sort((a, b) => cd.perItem[b.id] - cd.perItem[a.id]);
  const selItem = state.items.find((i) => i.id === st.itemId && cd.perItem[i.id]) || ranked[0];
  let itemChart = "";
  if (selItem) {
    const ser = itemSeries(selItem, cd.starts);
    const c = catOf(selItem.category);
    itemChart = Charts.line({
      title: `${selItem.name}每周用量与库存`, labels: cd.labels, fmt: (v) => `${fmt(v)} ${ser.unit}`,
      barSeries: { name: `每周用量（${ser.unit}）`, color: c.color, values: ser.used },
      series: [{ name: `周末库存（${ser.unit}）`, color: "var(--ink)", values: ser.level }],
    });
  }

  const recent = [...state.purchases].sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at)).slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);

  return `
    <section class="section">
      <div class="section-head"><h2>采购花费</h2><div class="seg" role="group" aria-label="时间范围" style="margin:0">${rangeChips}</div></div>
      <div class="kpis">
        <div class="kpi"><span>本月花费</span><b>${money(thisTotal)}</b><small>${sd.counts[months.at(-1)]} 笔</small></div>
        <div class="kpi"><span>上月花费</span><b>${money(prevTotal)}</b>
          <small class="${change > 0 ? "up" : "down"}">${change == null ? "上月无记录" : `${change > 0 ? "多" : "少"}了 ${Math.abs(change)}%`}</small></div>
        <div class="kpi"><span>近 ${st.months} 个月月均</span><b>${money(avg)}</b><small>本月进度供参考</small></div>
      </div>
      ${sd.otherCurrency ? `<p class="muted" style="font-size:13px">另有 ${sd.otherCurrency} 笔非 ${Units.region.currency} 记录未计入。</p>` : ""}
      ${hasSpend ? `
      <div class="panel chart-panel"><h3>每月花了多少</h3>${spendBars}</div>
      <div>
        <div class="panel chart-panel"><div class="chart-head"><h3>分类占比</h3>
          <select id="statsMonth" aria-label="选择月份">${[...months].reverse().map((m) => `<option value="${m}" ${m === selMonth ? "selected" : ""}>${m.replace("-", " 年 ")} 月</option>`).join("")}</select></div>${donut}</div>
        <div class="panel chart-panel"><h3>单个分类的月度趋势</h3>
          <div class="chips" role="group" aria-label="选择分类">${cats.map((c) => `<button type="button" class="chip" data-action="stats-cat" data-cat="${c.id}" aria-pressed="${c.id === selCat}">${c.icon} ${c.name}</button>`).join("")}</div>
          ${catTrend}</div>
      </div>` : `<div class="panel empty"><strong>还没有花费记录</strong>在采购清单点“已买到”时填上实际花费，或在下方补记一笔。</div>`}
    </section>

    ${viewStoreStats(months)}
    ${viewAnnualExport()}

    <section class="section">
      <div class="section-head"><h2>消耗趋势</h2><p>最近 12 周，来自家人点“−”的记录</p></div>
      ${selItem ? `
      <div class="panel chart-panel"><div class="chart-head"><h3>单品用量与库存</h3>
        <select id="statsItem" aria-label="选择物品">${ranked.map((i) => `<option value="${i.id}" ${i.id === selItem.id ? "selected" : ""}>${esc(i.name)}（${cd.perItem[i.id]} 次）</option>`).join("")}</select></div>
        ${itemChart}</div>
      <div class="panel chart-panel"><h3>各分类使用频率</h3><p class="muted" style="margin:0 0 6px;font-size:13px">按记录次数统计，不同物品单位不同，不能直接相加数量。</p>${freqChart}</div>`
      : `<div class="panel empty"><strong>还没有使用记录</strong>在库存页用掉东西时点一下 −，这里就会出现趋势。</div>`}
    </section>

    <section class="section">
      <div class="section-head"><h2>补记一笔花费</h2><p>没走采购清单的，也可以记在这里</p></div>
      ${storeDatalist()}
      <form id="purchaseForm" class="panel add-row purchase-row">
        <input name="name" required maxlength="60" placeholder="买了什么，例如：超市采购" aria-label="名称">
        <select name="category" aria-label="分类">${categoryOptions()}</select>
        <input name="amount" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="金额（${Units.region.currency}）" aria-label="金额">
        <input name="store" maxlength="40" list="storeList" value="${esc(lastStore())}" placeholder="商店（可不填）" aria-label="商店">
        <input name="date" type="date" value="${today}" max="${today}" aria-label="日期">
        <button class="btn btn-primary" type="submit">记一笔</button>
      </form>
      ${recent.length ? `<div class="panel" style="margin-top:10px"><h3 style="font-size:15px;margin-bottom:6px">最近的记录</h3><ul class="restock-list">${recent.map((p) => `<li>
        <span class="badge" style="background:var(--surface-2)">${esc(new Date(p.purchased_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }))}</span>
        <div class="grow"><span class="name">${esc(p.name)}</span><small>${esc((ALL_CATS().find((c) => c.id === p.category) || OTHER_CAT).name)}${p.store ? `，${esc(p.store)}` : ""}${p.quantity ? `，${showQty(p.quantity, p.unit || "")}` : ""}</small></div>
        <b>${p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : `<span class="muted">未填金额</span>`}</b>
        <button type="button" class="btn btn-sm btn-ghost" data-action="purchase-del" data-id="${p.id}" aria-label="删除 ${esc(p.name)} 这笔记录">删除</button></li>`).join("")}</ul></div>` : ""}
    </section>`;
}

/* ── 商店统计与年度报表 ── */
export const STORE_COLORS = ["#2c6a57", "#d4694c", "#3b7fc4", "#b07a1a", "#7563c0", "#c75a85"];
export const STORE_REST = { name: "其他商店", color: "#8a948f" }, STORE_NONE = { name: "未填写商店", color: "#c3cbc6" };
export const cleanStore = (v) => (v || "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
export const lastStore = () => { try { return localStorage.getItem("hmh-last-store") || ""; } catch { return ""; } };
export const rememberStore = (v) => { try { localStorage.setItem("hmh-last-store", v); } catch { /* 忽略 */ } };
// 商店名大小写、空格不同视为同一家（Costco 与 costco）
export const storeKey = (v) => (v || "").trim().toLowerCase();
export function knownStores() {
  const m = new Map();
  for (const p of state.purchases) if (p.store && !m.has(storeKey(p.store))) m.set(storeKey(p.store), p.store.trim());
  return [...m.values()].sort((a, b) => a.localeCompare(b, "zh"));
}
export const storeDatalist = () => `<datalist id="storeList">${knownStores().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;

export function viewStoreStats(months) {
  const cur = Units.region.currency, inRange = new Set(months);
  const agg = new Map();   // key → { name, total, count, byMonth }
  for (const p of state.purchases) {
    if (p.amount == null || (p.currency && p.currency !== cur)) continue;
    const m = monthKey(p.purchased_at);
    if (!inRange.has(m)) continue;
    const k = storeKey(p.store) || "__none__";
    const a = agg.get(k) || { name: p.store ? p.store.trim() : STORE_NONE.name, total: 0, count: 0, byMonth: {} };
    a.total += num(p.amount); a.count++; a.byMonth[m] = (a.byMonth[m] || 0) + num(p.amount);
    agg.set(k, a);
  }
  if (!agg.size) return "";
  const named = [...agg.entries()].filter(([k]) => k !== "__none__").map(([, v]) => v).sort((a, b) => b.total - a.total);
  const groups = named.slice(0, STORE_COLORS.length).map((v, i) => ({ ...v, color: STORE_COLORS[i] }));
  const rest = named.slice(STORE_COLORS.length);
  if (rest.length) groups.push(rest.reduce((g, v) => {
    g.total += v.total; g.count += v.count;
    for (const [m, x] of Object.entries(v.byMonth)) g.byMonth[m] = (g.byMonth[m] || 0) + x;
    return g;
  }, { ...STORE_REST, total: 0, count: 0, byMonth: {} }));
  if (agg.has("__none__")) groups.push({ ...agg.get("__none__"), color: STORE_NONE.color });
  const total = groups.reduce((a, g) => a + g.total, 0);

  const donut = Charts.donut({
    title: `近 ${months.length} 个月各商店花费占比`, fmt: money, center: money(total, true),
    items: groups.map((g) => ({ name: g.name, color: g.color, value: g.total })),
  });
  const bars = Charts.bars({
    title: "各商店月度花费", labels: months.map(monthLabel), fmt: money,
    series: groups.map((g) => ({ name: g.name, color: g.color, values: months.map((m) => g.byMonth[m] || 0) })),
  });
  const rows = groups.map((g) => `<tr><th scope="row"><i class="sw" style="background:${g.color}"></i>${esc(g.name)}</th>
    <td>${g.count}</td><td>${esc(money(g.total))}</td><td>${esc(money(g.total / g.count))}</td><td>${Math.round((g.total / total) * 100)}%</td></tr>`).join("");
  return `<section class="section">
    <div class="section-head"><h2>按商店统计</h2><p>近 ${months.length} 个月；商店名不区分大小写</p></div>
    <div class="panel chart-panel"><h3>在哪里花得最多</h3>${donut}
      <div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">商店</th><th scope="col">次数</th><th scope="col">合计</th><th scope="col">平均每次</th><th scope="col">占比</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="panel chart-panel"><h3>每月在各商店的花费</h3>${bars}</div>
  </section>`;
}

export function viewAnnualExport() {
  const y = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y - i);
  return `<section class="section">
    <div class="section-head"><h2>年度花费报表</h2><p>导出 CSV，可用 Excel、Numbers 或 Google 表格打开</p></div>
    <div class="panel export-row">
      <label class="field-label" for="csvYear" style="margin:0">年份</label>
      <select id="csvYear">${years.map((v) => `<option value="${v}">${v} 年</option>`).join("")}</select>
      <button type="button" class="btn btn-primary btn-sm" data-action="csv-summary">导出汇总（月份 × 分类、商店）</button>
      <button type="button" class="btn btn-sm" data-action="csv-detail">导出明细（每一笔）</button>
    </div>
  </section>`;
}

// CSV：加 UTF-8 BOM（Excel 打开中文不乱码）；以 = + - @ 开头的文本加 ' 前缀，防止表格公式注入
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let t = String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
export const toCsv = (rows) => "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export function download(name, text, type = "text/csv;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function exportAnnual(kind) {
  const year = +($("#csvYear")?.value || new Date().getFullYear());
  // 按本地时间：当年 1 月 1 日 0 点到次年 1 月 1 日 0 点
  const from = new Date(year, 0, 1).toISOString(), to = new Date(year + 1, 0, 1).toISOString();
  const list = await Store.listPurchasesRange(from, to);
  if (!list.length) return toast(`${year} 年没有采购记录`);
  const catName = (id) => (ALL_CATS().find((c) => c.id === id) || OTHER_CAT).name;
  const r2 = (v) => Math.round(v * 100) / 100;
  const fileBase = `${(state.household?.name || "家庭").replace(/[\\/:*?"<>|（）()\s]/g, "")}-${year}`;

  if (kind === "detail") {
    const rows = [["日期", "物品", "分类", "商店", "数量", "单位", "金额", "货币", "关联库存"]];
    for (const p of list) {
      rows.push([ymd(p.purchased_at), p.name, catName(p.category), p.store || "", p.quantity == null ? "" : num(p.quantity), p.unit || "",
        p.amount == null ? "" : num(p.amount), p.currency || "", p.item_id ? "是" : "否"]);
    }
    download(`${fileBase}-采购明细.csv`, toCsv(rows));
    return toast(`已导出 ${list.length} 笔明细`);
  }

  // 汇总：只统计当前地区货币，其他币种和未填金额的笔数在文末说明
  const cur = Units.region.currency;
  const valid = list.filter((p) => p.amount != null && (!p.currency || p.currency === cur));
  const skipped = list.filter((p) => p.amount != null && p.currency && p.currency !== cur).length;
  const noAmount = list.filter((p) => p.amount == null).length;
  const cats = STAT_CATS();
  const grid = Array.from({ length: 12 }, () => Object.fromEntries(cats.map((c) => [c.id, 0])));
  const stores = new Map();
  for (const p of valid) {
    const m = new Date(p.purchased_at).getMonth();
    const c = statCat(p.category);
    grid[m][c] += num(p.amount);
    const k = storeKey(p.store) || "__none__";
    const st = stores.get(k) || { name: p.store ? p.store.trim() : STORE_NONE.name, count: 0, total: 0 };
    st.count++; st.total += num(p.amount); stores.set(k, st);
  }
  const used = cats.filter((c) => grid.some((g) => g[c.id] > 0));
  const catYear = (id) => grid.reduce((a, g) => a + g[id], 0);
  const yearTotal = valid.reduce((a, p) => a + num(p.amount), 0);
  const rows = [
    [`${state.household?.name || "家庭"} ${year} 年采购花费汇总`],
    [`货币：${cur}`, `导出时间：${new Date().toLocaleString("zh-CN")}`],
    [],
    ["月份", ...used.map((c) => c.name), "合计"],
  ];
  grid.forEach((g, i) => rows.push([`${i + 1}月`, ...used.map((c) => r2(g[c.id])), r2(used.reduce((a, c) => a + g[c.id], 0))]));
  rows.push(["全年", ...used.map((c) => r2(catYear(c.id))), r2(yearTotal)]);
  rows.push(["占比", ...used.map((c) => (yearTotal ? `${r2((catYear(c.id) / yearTotal) * 100)}%` : "")), "100%"]);
  rows.push([], ["商店", "次数", "合计", "平均每次", "占比"]);
  [...stores.values()].sort((a, b) => b.total - a.total).forEach((st) =>
    rows.push([st.name, st.count, r2(st.total), r2(st.total / st.count), yearTotal ? `${r2((st.total / yearTotal) * 100)}%` : ""]));
  if (skipped || noAmount) rows.push([], [`说明：${skipped ? `${skipped} 笔非 ${cur} 记录未计入；` : ""}${noAmount ? `${noAmount} 笔未填金额；` : ""}明细表中仍可查看。`]);
  download(`${fileBase}-花费汇总.csv`, toCsv(rows));
  toast(`已导出 ${year} 年汇总，共 ${valid.length} 笔`);
}
