/* 税务 → 买卖与成本基础：清单里的「链接行」。一行可以不手填，而是链接到一条花费记录（purchases，按房产关联）：
 *  · 存的是 { link: "spend", ref: 花费 id, desc, amount, on }：desc / amount / on 只是备份（记录还没读到时先显示、先算）；
 *    读到记录后金额和名称一律以记录为准（记录里改了，这里跟着变）；记录被删了 → 这一行不计入，标「记录已删除」，由你 × 掉。
 *  · 花费记录只在打开买卖页时、按房产读一次（ui.spend），不读整表；只列这套房的、不是转账的、不是账单虚拟行的。
 *  · 同一笔只能放进一张清单（已链接过的不再出现在选择器里）。 */
import { numAttrs } from "../core/ui-num.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { ui } from "./tax-ui.js";
import { AMT_BUCKETS, bucketOk, dayOf, linkRows, linkedRefs, pickable, pickableIncome, r2, resolveLink } from "./tax-links-lib.js";
import { state } from "../core/state.js";
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

/** 清单 / 选择器上面的搜索 + 金额档位（条数多时才放；只在页面里把不符合的行藏起来，不重画，输入不会丢） */
export const FILTER_MIN = 7;
export const filterBar = () => `<div class="tax-fbar"><input type="search" data-tax-fq placeholder="${esc(t("搜索名称 / 日期 / 金额"))}" aria-label="${esc(t("搜索"))}"><select data-tax-fa data-nosearch aria-label="${esc(t("按金额筛选"))}">${AMT_BUCKETS.map(([v, l]) => `<option value="${v}">${v === "all" ? t(l) : l}</option>`).join("")}</select><span class="muted tax-fc" data-tax-fc></span></div>`;
/** 一行的搜索文字 / 金额属性 */
export const rowAttrs = (date, name, amount) => `data-fq="${esc(`${date || ""} ${name || ""} ${Math.abs(Number(amount) || 0).toFixed(2)}`.toLowerCase())}" data-fa="${Math.abs(Number(amount) || 0)}"`;
if (typeof document !== "undefined") {
  const apply = (box) => {
    const q = box.querySelector("[data-tax-fq]")?.value.trim().toLowerCase() || "", b = box.querySelector("[data-tax-fa]")?.value || "all", rows = [...box.querySelectorAll("li[data-fq]")];
    let n = 0; for (const li of rows) { const ok = (!q || li.dataset.fq.includes(q)) && bucketOk(b, li.dataset.fa); li.hidden = !ok; if (ok) n++; }
    const c = box.querySelector("[data-tax-fc]"); if (c) c.textContent = q || b !== "all" ? t("显示 {n} / {m}", { n, m: rows.length }) : "";
  };
  const on = (e) => { const box = e.target.closest?.("[data-tax-filter]"); if (box && e.target.matches("[data-tax-fq],[data-tax-fa]")) apply(box); };
  document.addEventListener("input", on); document.addEventListener("change", on);
}

/** 搜索 / 筛选：默认不放（列表本来就短），点「搜索」才展开；展开状态只在这一块里，不重画 */
const searchBtn = () => `<button type="button" class="ui-btn tax-search-btn" data-size="sm" data-tone="ghost" data-tax-fsearch aria-expanded="false">🔍 ${t("搜索")}</button>`;
const searchWrap = () => `<div class="tax-fwrap" data-tax-fwrap hidden>${filterBar()}</div>`;

/** 收入的选择器：默认只列关联了这套房的收入；点「显示全部收入」才列全部（记录都在内存里，不用读） */
function incomePicker(p, key, linked, money) {
  if (!state.inc?.loaded) return `<p class="muted">${t("收入记录还没读到；打开一次 财务 → 收入 再回来。")}</p>`;
  const all = pickableIncome(p.id, linked), mine = all.filter((r) => r.property_id === p.id), showAll = ui.pickAll === key;
  const list = showAll ? all : mine;
  const rows = list.map((r) => `<li class="tax-pick-row" ${rowAttrs(String(r.received_on || "").slice(0, 10), r.source_name, r.amount)}><label class="check-inline"><input type="checkbox" name="pick" value="${esc(r.id)}"><span class="tax-pick-d"><small class="muted">${esc(String(r.received_on || "").slice(0, 10))}</small> ${esc(r.source_name || "—")}</span><b class="tax-imp-a">${money(Number(r.amount) || 0)}</b></label></li>`).join("");
  const scope = all.length > mine.length ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-tax-pick-all="${esc(key)}">${showAll ? t("只看这套房的收入") : t("显示全部收入（{n}）", { n: all.length })}</button>` : "";
  const empty = `<p class="muted">${showAll || !all.length ? t("没有可链接的收入记录。先到 财务 → 收入 记一笔，这里就能选到。") : t("没有关联这套房的收入记录。在收入记录里选「关联房产」，这里就默认能选到；或者点下面显示全部。")}</p>`;
  return `<form class="tax-link-form" data-tax-link="${esc(key)}" novalidate>${rows ? `<div data-tax-filter><div class="tax-pick-tools">${searchBtn()}${scope}</div>${searchWrap()}<ul class="tax-pick">${rows}</ul></div>` : `${empty}${scope ? `<div class="tax-pick-tools">${scope}</div>` : ""}`}
    <div class="tax-item-actions">${rows ? `<button type="submit" class="ui-btn" data-size="sm" data-tone="primary">${t("链接所选")}</button>` : ""}<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-tax-pick-cancel>${t("取消")}</button></div></form>`;
}

/** 选择器表单：勾选要链接的花费 */
export function pickerHtml(p, key, kind, leafLabelOf, isTransfer, linked, money) {
  if (kind === "income") return incomePicker(p, key, linked, money);
  const got = ui.spend.get(p.id);
  if (!got || got.loading) return `<p class="muted">${t("正在读这套房的花费记录…")}</p>`;
  if (got.err) return `<p class="form-error" role="alert">${esc(t("读花费记录失败：{msg}", { msg: got.err }))}</p>`;
  const list = pickable(p.id, linked, isTransfer);
  const rows = list.map((r) => `<li class="tax-pick-row" ${rowAttrs(dayOf(r.purchased_at), `${r.name} ${leafLabelOf(r.category)}`, r.amount)}><label class="check-inline"><input type="checkbox" name="pick" value="${esc(r.id)}"><span class="tax-pick-d"><small class="muted">${esc(dayOf(r.purchased_at))}</small> ${esc(r.name)}<small class="muted tax-pick-c">${esc(leafLabelOf(r.category))}</small></span><b class="tax-imp-a">${money(r2(r.amount))}</b></label></li>`).join("");
  return `<form class="tax-link-form" data-tax-link="${esc(key)}" novalidate>${rows ? `<div data-tax-filter><div class="tax-pick-tools">${searchBtn()}</div>${searchWrap()}<ul class="tax-pick">${rows}</ul></div>` : `<p class="muted">${t("这套房没有可链接的花费记录。花费记账时选「房产」，这里就能选到。")}</p>`}
    <div class="tax-item-actions">${rows ? `<button type="submit" class="ui-btn" data-size="sm" data-tone="primary">${t("链接所选")}</button>` : ""}<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-tax-pick-cancel>${t("取消")}</button></div></form>`;
}

/* 点「从花费记录里选」/ 取消 / 提交勾选（链接所选）。删除（解除链接）走 tax-actions.js 里和手填行一样的 × */
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const fs = e.target.closest?.("[data-tax-fsearch]");   // 点「搜索」：展开 / 收起这一块的搜索 + 金额筛选
    if (fs && fs.closest(".tax-page")) { const w = fs.closest("[data-tax-filter]")?.querySelector("[data-tax-fwrap]"); if (w) { w.hidden = !w.hidden; fs.setAttribute("aria-expanded", String(!w.hidden)); if (!w.hidden) w.querySelector("input")?.focus(); } return; }
    const all = e.target.closest?.("[data-tax-pick-all]");   // 收入选择器：只看这套房 ↔ 显示全部
    if (all && all.closest(".tax-page")) { ui.pickAll = ui.pickAll === all.dataset.taxPickAll ? null : all.dataset.taxPickAll; render(false); return; }
    const pick = e.target.closest?.("[data-tax-pick]"), cancel = e.target.closest?.("[data-tax-pick-cancel]");
    if (!(pick || cancel) || !e.target.closest(".tax-page")) return;
    ui.pick = pick ? pick.dataset.taxPick : null; ui.pickAll = null; if (pick) ui.add = null; render(false);
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target; if (!f?.dataset?.taxLink || !f.closest(".tax-page")) return;
    e.preventDefault(); const [id, key] = f.dataset.taxLink.split("|"), ids = new Set(new FormData(f).getAll("pick").map(String));
    if (!ids.size) return toast(t("先勾选要链接的花费。"));
    const rows = linkRows(key.startsWith("creditItems") ? "income" : "spend", id, ids);
    ui.pick = null;
    try { await saveProp(id, { [key]: [...(propOf(id)[key] || []), ...rows] }); } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
    render(false);
  });
}
