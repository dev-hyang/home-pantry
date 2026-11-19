/* 花费统计：旅行按行程汇总（「【行程】项目」）。 */
import { LOADING, dq } from "./spend-drill.js";
import { Store } from "../core/store.js";
import { cursorOf } from "../core/list-query.js";
import { esc, money, num } from "../core/util.js";
import { href } from "../core/router.js";
import { isTransfer, knownLeafIds, leafInfo, leafLabel } from "../core/taxonomy.js";
import { spendBase } from "./spend-records.js";
import { spendSuggestions } from "../core/spend-data.js";
import { t } from "../core/i18n.js";

/* ── 旅行按行程：花费名称「【行程】项目」按行程汇总（旅途中的吃饭、加油、门票只要带了行程名也算进这趟）。
 * 数据库按名称搜「【」读出带行程的花费（不读整表）；以前记成“其他”、看着像旅行的给出归类建议。 */
const TRIPS = { rows: null, other: null, busy: false, err: "" };
window.addEventListener("spend-rows-changed", () => { TRIPS.rows = null; });
/** 按筛选把花费流水读出来（每页 500 行，最多 max 行）：行程、年度报表、打印、返现复盘、月度复盘都用它，不读整表 */
export async function fetchSpendPages(f, max) {
  const out = []; let after = null;
  while (out.length < max) {
    const raw = (await Store.listPage("spend", f, after, 500)) || [], page = raw.slice(0, 500);
    out.push(...page); if (raw.length <= 500 || !page.length) break;
    after = cursorOf(page.at(-1));
  }
  return out;
}
function loadTrips() {
  if (TRIPS.busy || TRIPS.rows) return;
  TRIPS.busy = true;
  const base = spendBase();
  Promise.all([fetchSpendPages({ ...base, q: "【" }, 3000), fetchSpendPages({ ...base, known: knownLeafIds(), lo: ["other"], hi: ["other"] }, 300)])
    .then(([a, b]) => { TRIPS.rows = a.map((r) => ({ ...r, category: canonCat(r.category) })); TRIPS.other = b; TRIPS.err = ""; })
    .catch((e) => { TRIPS.rows = []; TRIPS.other = []; TRIPS.err = e.message; })
    .finally(() => { TRIPS.busy = false; window.dispatchEvent(new Event("spend-data-loaded")); });
}
const tripsOf = (list) => {
  const map = new Map();
  for (const p of list) {
    if (p.amount == null || isTransfer(p.category, p.nature)) continue;
    const { trip } = TRIP.parse(p.name); if (!trip) continue;
    const g = map.get(trip) || { trip, total: 0, n: 0, first: p.purchased_at, last: p.purchased_at, byCat: {} };
    g.total += num(p.amount); g.n++; g.byCat[p.category] = (g.byCat[p.category] || 0) + num(p.amount);
    if (p.purchased_at < g.first) g.first = p.purchased_at; if (p.purchased_at > g.last) g.last = p.purchased_at;
    map.set(trip, g);
  }
  return [...map.values()].sort((a, b) => String(b.last).localeCompare(String(a.last)));
};
/** 记一笔时「行程」的候选：近 400 天用过的行程名（数据库 spend_suggest，迁移 057） */
export const tripDatalist = () => `<datalist id="tripList">${spendSuggestions().trips.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
export function tripsPanel() {
  loadTrips();
  if (!TRIPS.rows) return `<div class="panel">${LOADING()}</div>`;
  const trips = tripsOf(TRIPS.rows);
  // 补入以前的：以前记成“其他”、名称或商店里带机票 / 酒店 / 门票 / 加油…关键词的，给出归类建议，点一下归到对应类型（不会自动改）
  const sugg = (TRIPS.other || []).filter((p) => !p.virtual && p.amount != null && TRIP.guess(p.name, p.store)).slice(0, 12);
  const suggHtml = sugg.length ? `<div class="panel"><h3 style="font-size:15px;margin:0 0 4px">${t("以前的花费里，可能是旅行")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("名称或商店里带机票、酒店、门票、加油…的“其他”花费；点一下归到对应类型（可在明细里再改，也可以给名称加上「【行程名】」）。")}</p>
    <ul class="restock-list">${sugg.map((p) => { const id = TRIP.guess(p.name, p.store), c = leafInfo(id);
      return `<li><div class="grow"><span class="name">${esc(p.name)}</span><small>${esc(String(p.purchased_at).slice(0, 10))}${p.store ? ` · ${esc(p.store)}` : ""} · ${money(num(p.amount))}</small></div><button type="button" class="btn btn-sm" data-action="trip-reclass" data-id="${esc(p.id)}" data-cat="${id}">${t("归为")} ${c.icon} ${esc(t(c.name.split("（")[0]))}</button></li>`; }).join("")}</ul></div>` : "";
  const card = (g) => `<div class="panel trip-card"><div class="row"><div class="v"><b>🧳 ${esc(g.trip)}</b>
      <div class="muted" style="font-size:12.5px">${esc(String(g.first).slice(0, 10))}${String(g.first).slice(0, 10) !== String(g.last).slice(0, 10) ? ` → ${esc(String(g.last).slice(0, 10))}` : ""} · ${t("{n} 笔", { n: g.n })}</div></div>
      <b class="num">${money(g.total)}</b></div>
    <ul class="trip-cats">${Object.entries(g.byCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => `<li><span>${esc(leafLabel(id))}</span><b class="num">${money(v)}</b></li>`).join("")}</ul>
    <div class="form-actions" style="margin-top:6px"><a class="btn btn-sm" href="${href("bills", "spend")}?tab=records&add=1&cat=travel_other&trip=${encodeURIComponent(g.trip)}">＋ ${t("记一笔")}</a><button type="button" class="btn btn-sm btn-ghost" data-drill="${esc(dq({ q: `【${g.trip}】` }))}">${t("查看明细")} ›</button></div></div>`;
  return `<p class="muted" style="font-size:13px">${t("按行程汇总这趟出门的全部花费：机票、住宿、租车这类选「旅行」下的分类；旅途中的吃饭、加油、门票照常选外出就餐 / 燃油 / 娱乐——只要填了行程名，都会算进这趟。")}</p>
    ${TRIPS.err ? `<p class="form-error">${esc(TRIPS.err)}</p>` : ""}
    ${trips.length ? trips.map(card).join("") : `<div class="panel empty"><strong>${t("还没有行程")}</strong>${t("记一笔花费时在「行程」里写个名字（例如 东京 2026），这笔就归到这趟。以前的旅行也可以补记，日期选当时的。")}<p><a class="btn btn-primary btn-sm" href="${href("bills", "spend")}?tab=records&add=1&cat=travel_flight">${t("记一笔旅行花费")}</a></p></div>`}
    ${suggHtml}`;
}
