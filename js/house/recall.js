/* 设备召回（docs/design-roadmap-2026-10.md §3；迁移 051：assets.recall jsonb）——被召回的东西不删除，走「登记召回 → 处理」
 * recall：{ status: open | stop_use | resolved, found_on, ref, url, remedy: repair | replace | refund | null, notes,
 *           resolved_on, refund_amount, refund_purchase_id, replaced_by }
 * - open / stop_use：首页提醒（停止使用 = 紧急·必须；待处理 = 尽快·必须），直到处理完（assets.js 的 assetAlertItems）
 * - 三个出口：修好了（记一条维修记录）/ 换新（#/asset/new?replaces=<旧id>，保存后旧机 replaced_by = 新机）/ 退款（记一笔负数花费）
 * - 换新、退款处理完的旧设备算「退役」：不再进设备列表、提醒和换季任务，列表底部「已更换 / 已退货」里还能打开 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, armed, catOf, esc, fmtDate, money, num, todayISO, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { categoryOptions } from "../pantry/views.js";
import { cardSelectHtml, purchasePayFields } from "../bills/cards-views.js";
import { assetName } from "./assets.js";

const H = () => window.HOUSE;
export const RECALL_STATUS = {
  stop_use: { name: "召回 · 停止使用", short: "停止使用", cls: "b-out" },
  open:     { name: "召回待处理",     short: "召回",     cls: "b-soon" },
  resolved: { name: "召回已处理",     short: "已处理",   cls: "b-ok" },
};
export const RECALL_REMEDY = { repair: "厂家维修", replace: "换新", refund: "退款" };

export const recallOf = (a) => (a?.recall && typeof a.recall === "object" && RECALL_STATUS[a.recall.status] ? a.recall : null);
/** 还没处理完的召回：stop_use / open；没有或已处理 → null */
export const recallActive = (a) => { const r = recallOf(a); return r && r.status !== "resolved" ? r.status : null; };
/** 换新或退款处理完的旧设备：退出列表、提醒和换季任务 */
export const isRetired = (a) => { const r = recallOf(a); return !!r && r.status === "resolved" && (r.remedy === "replace" || r.remedy === "refund"); };
/** 这台新设备替换了哪台被召回的旧设备 */
export const replacedFrom = (a) => (a?.id ? state.assets.find((x) => recallOf(x)?.replaced_by === a.id) || null : null);

const rawAsset = (id) => state.assets.find((x) => x.id === id) || null;
const recallHref = (a) => `${href("asset", a.id)}?sec=recall`;
const refText = (r) => [r.ref, r.url && !r.ref ? r.url.replace(/^https?:\/\//, "").slice(0, 40) : null].filter(Boolean).join(" ");

/** 提醒 / 卡片上的一句话 */
export function recallAlertText(a) {
  const r = recallOf(a); if (!r) return "";
  const ref = refText(r) ? ` · ${refText(r)}` : "";
  return r.status === "stop_use" ? t("厂家召回，要求立即停止使用{ref}", { ref }) : t("产品召回待处理：联系厂家修、换或退{ref}", { ref });
}
export const recallBadge = (a) => { const s = recallActive(a); return s ? `<span class="badge ${RECALL_STATUS[s].cls}">⚠️ ${t(RECALL_STATUS[s].name)}</span>` : ""; };

/** 已处理的去向一句话：换成了哪台 / 退了多少 / 修好了 */
function resolvedText(a) {
  const r = recallOf(a); if (!r || r.status !== "resolved") return "";
  const when = r.resolved_on ? fmtDate(r.resolved_on) : "";
  if (r.remedy === "replace") { const n = rawAsset(r.replaced_by); return t("{d} 已换新：{name}", { d: when, name: n ? `<a href="${href("asset", n.id)}">${esc(assetName(n))}</a>` : esc(t("新机已删除")) }); }
  if (r.remedy === "refund") return esc(t("{d} 已退款 {m}", { d: when, m: r.refund_amount != null ? money(num(r.refund_amount)) : "" }));
  if (r.remedy === "repair") return esc(t("{d} 厂家已修好", { d: when }));
  return esc(t("{d} 已处理", { d: when }));
}

/** 设备枢纽顶部的横幅：没处理完的召回 / 已退役 / 替换了哪台旧机 */
export function recallBanner(a, { here = false } = {}) {
  const s = recallActive(a), r = recallOf(a), from = replacedFrom(a);
  if (s) return `<div class="panel cta-panel recall-banner ${s === "stop_use" ? "is-stop" : ""}" role="status">
      <div><b>${s === "stop_use" ? `⛔ ${t("停止使用")}` : `⚠️ ${t("产品召回待处理")}`}</b>
        <p class="muted">${esc(recallAlertText(a))}${r.found_on ? ` · ${esc(t("{d} 登记", { d: fmtDate(r.found_on) }))}` : ""}</p></div>
      ${here ? "" : `<a class="btn btn-sm btn-primary" href="${recallHref(a)}">${t("处理召回")}</a>`}</div>`;
  if (isRetired(a)) return `<div class="panel cta-panel recall-banner is-done" role="status"><div><b>${t("已退役（召回）")}</b><p class="muted">${resolvedText(a)}${t("；不再提醒，档案和保养记录保留。")}</p></div></div>`;
  if (from) return `<p class="muted recall-from">🔁 ${t("替换了被召回的 {name}", { name: `<a href="${href("asset", from.id)}">${esc(assetName(from))}</a>` })}</p>`;
  return "";
}

/** 枢纽里的入口行（hubRow 的参数） */
export function recallHubRow(a) {
  const s = recallActive(a), r = recallOf(a);
  return { href: recallHref(a), icon: "📣", title: t("产品召回"),
    desc: s ? esc(recallAlertText(a)) : r ? resolvedText(a).replace(/<[^>]+>/g, "") : t("被厂家召回了？登记召回编号，跟进修、换、退，不用删档案"),
    badge: s ? `<span class="badge ${RECALL_STATUS[s].cls} mcount">${t(RECALL_STATUS[s].short)}</span>` : r ? `<span class="badge b-ok mcount">${t("已处理")}</span>` : "" };
}

/** ?sec=recall：登记 / 修改召回信息 + 处理完的三个出口 */
export function recallSection(a) {
  const r = recallOf(a) || {}, s = recallActive(a), resolved = r.status === "resolved";
  const d = (x) => esc(x ?? "");
  const remedyOpts = [["", "还不知道"], ...Object.entries(RECALL_REMEDY)].map(([k, n]) => `<option value="${k}" ${k === (r.remedy || "") ? "selected" : ""}>${t(n)}</option>`).join("");
  const info = `<form id="recallForm" class="panel" novalidate>
      <input type="hidden" name="asset_id" value="${esc(a.id)}">
      <p class="hint" style="margin-top:0">${t("型号、批次或序列号范围对得上才算被召回。北美到 CPSC.gov / SaferProducts.gov 或厂家官网按型号查；国内看市场监管总局缺陷产品召回公告。")}</p>
      <div class="form-grid">
        <label>${t("召回编号")}<input name="ref" maxlength="60" value="${d(r.ref)}" placeholder="${t("例如：CPSC 25-123 或厂家公告号")}"></label>
        <label>${t("公告链接")}<input name="url" type="url" inputmode="url" maxlength="300" value="${d(r.url)}" placeholder="https://"></label>
        <label>${t("哪天发现的")}<input name="found_on" type="date" value="${d(r.found_on || todayISO())}" max="${todayISO()}"></label>
        <label>${t("厂家给的方案")}<select name="remedy">${remedyOpts}</select></label>
        ${resolved ? "" : `<label class="span-2 check-inline"><input type="checkbox" name="stop_use" ${r.status === "stop_use" || !s ? "checked" : ""}><span>${t("厂家要求立即停止使用（首页按“紧急”提醒）")}</span></label>`}
        <label class="span-2">${t("备注")}<input name="notes" maxlength="300" value="${d(r.notes)}" placeholder="${t("例如：寄回电源线、厂家寄修理包、客服电话")}"></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${s || resolved ? t("保存召回信息") : t("标记为召回")}</button>
        ${r.status ? `<span class="spacer"></span><button type="button" class="btn btn-sm btn-danger-ghost" data-action="recall-clear" data-id="${esc(a.id)}">${t("清除召回标记")}</button>` : ""}</div>
    </form>`;
  if (!s) {
    const done = resolved ? `<div class="panel cta-panel recall-banner is-done"><div><b>${t("召回已处理")}</b><p class="muted">${resolvedText(a)}</p></div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="recall-reopen" data-id="${esc(a.id)}">${t("重新打开")}</button></div>` : "";
    return `${done}${info}${resolved ? "" : `<p class="muted" style="font-size:13px">${t("登记后首页会一直提醒，直到你在这里选“修好了 / 换了新的 / 退款了”。设备档案不会被删除。")}</p>`}`;
  }
  // 处理完的三个出口：每个是一张可展开的小卡，各自一个表单（不用脚本切换字段）
  const portable = H().isPortableType?.(a.type), defCat = portable && catOf("gear_home")?.id === "gear_home" ? "gear_home" : MAINT_CAT.id;
  const pay = cardSelectHtml("pay");
  const exits = `<div class="section-head" style="margin-top:16px"><h3 style="font-size:15px">${t("处理完了？")}</h3><p>${t("选一种结果；处理完首页就不再提醒")}</p></div>
    <div class="recall-exits">
      <details class="panel rc-exit"><summary><span class="rc-ico" aria-hidden="true">🔧</span><span><b>${t("修好了")}</b><small>${t("厂家上门、寄修理包或寄修")}</small></span></summary>
        <form id="recallFixForm" class="rc-body"><input type="hidden" name="asset_id" value="${esc(a.id)}">
          <label>${t("日期")}<input name="done_on" type="date" required value="${todayISO()}" max="${todayISO()}"></label>
          <label>${t("备注")}<input name="notes" maxlength="200" placeholder="${t("例如：换了电源线，厂家免费")}"></label>
          <p class="hint">${t("会在保养记录里记一条“维修 · 召回维修”，设备继续使用。")}</p>
          <button type="submit" class="btn btn-sm btn-primary">${t("记为已修好")}</button></form></details>
      <details class="panel rc-exit"><summary><span class="rc-ico" aria-hidden="true">🔁</span><span><b>${t("换了新的")}</b><small>${t("厂家寄来一台新的")}</small></span></summary>
        <div class="rc-body"><p class="hint">${t("新机单独建一条档案（带入名称、类型、位置），记新的序列号和保修；保存后这台旧机标成“已更换”，从列表和提醒里退出。")}</p>
          <a class="btn btn-sm btn-primary" href="${href("asset", "new")}?replaces=${encodeURIComponent(a.id)}">${t("登记换来的新机")}</a></div></details>
      <details class="panel rc-exit"><summary><span class="rc-ico" aria-hidden="true">💵</span><span><b>${t("退款了")}</b><small>${t("退货退款，东西不要了")}</small></span></summary>
        <form id="recallRefundForm" class="rc-body"><input type="hidden" name="asset_id" value="${esc(a.id)}">
          <label>${t("退款金额（{cur}）", { cur: Units.region.currency })}<input name="amount" type="number" inputmode="decimal" min="0" step="0.01" value="${d(a.purchase_price)}"></label>
          <label>${t("日期")}<input name="date" type="date" required value="${todayISO()}" max="${todayISO()}"></label>
          <label>${t("记到哪个分类")}<select name="category">${categoryOptions(defCat, { spend: true })}</select></label>
          ${pay ? `<label>${t("退回到")}${pay}</label>` : ""}
          <p class="hint">${t("记成一笔负数花费，统计里按净额算；金额留空则只标记已退款。")}</p>
          <button type="submit" class="btn btn-sm btn-primary">${t("记为已退款")}</button></form></details>
    </div>`;
  return `${recallBanner(a, { here: true })}${info}${exits}`;
}

/** 新设备表单 ?replaces=<旧id>：带入的默认值 */
export function replaceDefaults(oldId) {
  const o = rawAsset(oldId); if (!o) return null;
  return { from: o, v: { kind: o.kind, type: o.type, name: o.name, location: o.location || "", brand: o.brand || "", expected_life_years: o.expected_life_years ?? "", service_interval_months: o.service_interval_months ?? "", owner: o.owner || "self", notes: "", units: o.units || null } };
}

const saveRecall = (a, recall) => Store.saveAsset({ ...a, recall });

/** 新机保存后：旧机标成已更换、退役 */
export async function finishReplace(oldId, newId) {
  const o = rawAsset(oldId); if (!o || !newId) return;
  const r = recallOf(o) || { found_on: todayISO() };
  await saveRecall(o, { ...r, status: "resolved", remedy: "replace", resolved_on: todayISO(), replaced_by: newId });
}

/** 三个表单：登记 / 修好了 / 退款；返回 true 表示已保存 */
export async function saveRecallForm(f, { refresh, render }) {
  const fe = f.elements, a = rawAsset(fe.asset_id.value);
  if (!a) { toast(t("设备不存在")); return false; }
  const r = recallOf(a) || {}, btn = f.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    if (f.id === "recallForm") {
      const s = (el) => (el?.value || "").trim() || null;
      const url = s(fe.url);
      if (url && !/^https?:\/\//i.test(url)) { toast(t("链接要以 http:// 或 https:// 开头")); fe.url.focus(); return false; }
      const status = r.status === "resolved" ? "resolved" : fe.stop_use?.checked ? "stop_use" : "open";
      await saveRecall(a, { ...r, status, ref: s(fe.ref), url, found_on: fe.found_on.value || todayISO(), remedy: fe.remedy.value || (status === "resolved" ? r.remedy : null) || null, notes: s(fe.notes) });
      toast(r.status ? t("已保存召回信息") : status === "stop_use" ? t("已标记召回：停止使用，首页会按紧急提醒") : t("已标记召回，处理完前首页会提醒"));
    } else if (f.id === "recallFixForm") {
      const done_on = fe.done_on.value || todayISO(), note = (fe.notes.value || "").trim();
      await Store.addMaintLog({ asset_id: a.id, done_on, kind: "repair", cost: null, currency: null, diy: false, vendor: a.brand || null,
        notes: [t("召回维修"), r.ref, note].filter(Boolean).join(" · ").slice(0, 500), purchase_id: null, result: null, service_item: null, odometer: null });
      await saveRecall(a, { ...r, status: "resolved", remedy: "repair", resolved_on: done_on });
      toast(t("已记为召回维修完成"));
    } else if (f.id === "recallRefundForm") {
      const amt = fe.amount.value === "" ? null : Math.round(Math.max(0, num(fe.amount.value)) * 100) / 100, day = fe.date.value || todayISO();
      let refund_purchase_id = r.refund_purchase_id || null;
      if (amt) {   // 退款：负数花费（迁移 028 起允许），统计按净额算
        refund_purchase_id = await Store.addPurchase({ item_id: null, name: `${a.name} · ${t("召回退款")}`, category: fe.category.value || MAINT_CAT.id, quantity: null, unit: null,
          store: a.brand || null, amount: -amt, currency: Units.region.currency, purchased_at: new Date(`${day}T12:00:00`).toISOString(), ...(fe.pay ? purchasePayFields(fe.pay.value) : {}) });
      }
      await saveRecall(a, { ...r, status: "resolved", remedy: "refund", resolved_on: day, refund_amount: amt, refund_purchase_id });
      toast(amt ? t("已记退款 {m}，这台设备已退役", { m: money(amt) }) : t("已标记退款，这台设备已退役"));
    } else return false;
  } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); return false; }
  finally { if (btn) btn.disabled = false; }
  await refresh(); render(true);
  return true;
}

/** recall-clear：清除召回标记（登记错了）；recall-reopen：已处理的重新打开（退款记录不动） */
export async function recallAction(action, el, { refresh, render }) {
  const a = rawAsset(el.dataset.id); if (!a) return;
  try {
    if (action === "recall-clear") {
      if (!armed(el, t("再点一次确认清除"))) return;
      await saveRecall(a, null); toast(t("已清除召回标记"));
    } else if (action === "recall-reopen") {
      const r = recallOf(a); if (!r) return;
      await saveRecall(a, { ...r, status: "open", remedy: r.remedy, resolved_on: null }); toast(t("已重新打开，首页会继续提醒"));
    } else return;
  } catch (e) { return toast(t("保存失败：{msg}", { msg: e.message })); }
  await refresh(); render(true);
  $("#recallForm")?.scrollIntoView?.({ block: "nearest" });
}
