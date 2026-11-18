/* 买卖计划：计划 → 候选（一套房 / 一辆车）→ 出价记录（迁移 078，全家共享；设计见 docs/design-bills-overview.md §17）
 * 页面：#/house/plan?p=<计划 id>。买房 / 买车指南页上有「我的计划」列表和新建入口。
 * 还没买，所以不产生房产 / 车辆；候选被接受后再建房产 / 车辆（版本 D）。价格只给有财务权限的人看和填（界面闸门，和交易页一致）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { href } from "../core/router.js";
import { $, armed, confirmDelete, esc, fmtDate, money, num, todayISO, toast } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { pricesOk, priceInput } from "../core/finance-access.js";
const L = (zh, en) => (lang === "en" ? en : zh);

export const PLAN_STATUS = { active: ["进行中", "In progress"], won: ["已买到", "Bought"], dropped: ["放弃了", "Dropped"] };
export const CAND_STATUS = { considering: ["考虑中", "Considering"], viewed: ["已看过", "Viewed"], offered: ["已出价", "Offer made"], won: ["拿下了", "Won"], rejected: ["不要了", "Passed"] };
export const OFFER_OUTCOME = { pending: ["等回复", "Waiting"], accepted: ["被接受", "Accepted"], countered: ["对方还价", "Countered"], rejected: ["被拒绝", "Rejected"], withdrawn: ["撤回了", "Withdrawn"] };
/** 对比字段（存在候选的 details 里）：[键, [中文, 英文], 数字?] */
export const DETAIL_FIELDS = {
  buy_home: [["beds", ["卧室", "Bedrooms"], 1], ["baths", ["卫浴", "Baths"], 1], ["sqft", ["面积 (sqft)", "Size (sqft)"], 1], ["built", ["建成年份", "Year built"], 1], ["hoa", ["HOA ($/月)", "HOA ($/mo)"], 1], ["tax", ["房产税 ($/年)", "Property tax ($/yr)"], 1]],
  buy_vehicle: [["year", ["年款", "Year"], 1], ["mileage", ["里程", "Mileage"], 1], ["trim", ["车型 / 配置", "Model / trim"], 0], ["fuel", ["动力", "Powertrain"], 0]],
};
const lab = (m, k) => L(...(m[k] || [k, k]));
const plansOf = (kind) => (state.plans || []).filter((p) => !kind || p.kind === kind);
const candsOf = (pid) => (state.planCands || []).filter((c) => c.plan_id === pid);
const offersOf = (cid) => (state.planOffers || []).filter((o) => o.candidate_id === cid).sort((a, b) => (a.offered_on || "").localeCompare(b.offered_on || ""));
const mny = (v) => (v == null || v === "" ? "—" : `<span data-money>${money(num(v))}</span>`);
const opts = (m, cur) => Object.keys(m).map((k) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(lab(m, k))}</option>`).join("");

/** 房屋首页 / 指南页上的计划列表 */
export function planListHtml(kind) {
  const list = plansOf(kind);
  const row = (p) => { const n = candsOf(p.id).length;
    return `<a class="plan-row" href="${esc(planPageHref(p.id))}"><span class="plan-row-t"><b>${esc(p.title)}</b><small>${esc([lab(PLAN_STATUS, p.status), t("{n} 个候选", { n }), p.budget != null && pricesOk() ? t("预算 {m}", { m: money(num(p.budget)) }) : ""].filter(Boolean).join(" · "))}</small></span><span class="mch" aria-hidden="true">›</span></a>`; };
  return list.length ? `<div class="plan-rows">${list.map(row).join("")}</div>` : "";
}
export const planPageHref = (id) => `${href("house", "plan")}?p=${id}`;

/** 新建 / 编辑计划的表单 */
export function planFormHtml(kind) {
  const e = state.planEdit; if (e?.type !== "plan") return "";
  const p = e.id ? (state.plans || []).find((x) => x.id === e.id) : null;
  return `<form id="planForm" class="panel plan-form" novalidate><input type="hidden" name="rec_id" value="${esc(p?.id || "")}"><input type="hidden" name="kind" value="${esc(p?.kind || e.kind || kind)}">
    <div class="field"><label for="plTitle">${t("计划名称")}</label><input id="plTitle" name="title" maxlength="80" required value="${esc(p?.title || "")}" placeholder="${esc(t("例如：2027 年换一套大点的房子"))}"></div>
    ${pricesOk() ? `<div class="field"><label for="plBudget">${t("预算上限")}</label><input id="plBudget" name="budget" type="number" inputmode="decimal" min="0" step="any" value="${esc(p?.budget ?? "")}"></div>` : ""}
    <div class="field"><label for="plNotes">${t("备注")}</label><textarea id="plNotes" name="notes" rows="2" maxlength="2000">${esc(p?.notes || "")}</textarea></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">${t("保存")}</button><button class="btn" type="button" data-action="plan-cancel">${t("取消")}</button></div></form>`;
}

function candFormHtml(plan) {
  const e = state.planEdit; if (e?.type !== "cand" || e.plan !== plan.id) return "";
  const c = e.id ? (state.planCands || []).find((x) => x.id === e.id) : null, d = c?.details || {};
  const isHome = plan.kind === "buy_home";
  return `<form id="candForm" class="panel plan-form" novalidate><input type="hidden" name="rec_id" value="${esc(c?.id || "")}"><input type="hidden" name="plan_id" value="${plan.id}">
    <div class="field"><label for="cdName">${isHome ? t("这套房叫什么") : t("这辆车叫什么")}</label><input id="cdName" name="name" maxlength="120" required value="${esc(c?.name || "")}" placeholder="${esc(isHome ? t("例如：Oak St 三卧") : t("例如：2021 Camry LE"))}"></div>
    <div class="field"><label for="cdAddr">${isHome ? t("地址") : t("在哪里看车 / 卖家")}</label><input id="cdAddr" name="address" maxlength="200" value="${esc(c?.address || "")}"></div>
    <div class="field"><label for="cdUrl">${t("链接")}</label><input id="cdUrl" name="url" type="url" maxlength="500" value="${esc(c?.url || "")}" placeholder="https://"></div>
    <div class="plan-grid2">
      ${pricesOk() ? `<div class="field"><label for="cdPrice">${t("挂牌价 / 报价")}</label><input id="cdPrice" name="price" type="number" inputmode="decimal" min="0" step="any" value="${esc(c?.price ?? "")}"></div>` : priceInput("", "price", c?.price)}
      <div class="field"><label for="cdStatus">${t("状态")}</label><select id="cdStatus" name="status">${opts(CAND_STATUS, c?.status || "considering")}</select></div>
      <div class="field"><label for="cdScore">${t("总体打分")}</label><select id="cdScore" name="score"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${c?.score === n ? "selected" : ""}>${"★".repeat(n)}</option>`).join("")}</select></div>
      ${DETAIL_FIELDS[plan.kind].map(([k, nm, isNum]) => `<div class="field"><label for="cd_${k}">${esc(lab({ x: nm }, "x"))}</label><input id="cd_${k}" name="d_${k}" ${isNum ? 'type="number" inputmode="decimal" step="any" min="0"' : "maxlength=\"60\""} value="${esc(d[k] ?? "")}"></div>`).join("")}
    </div>
    <div class="field"><label for="cdPros">${t("优点")}</label><textarea id="cdPros" name="pros" rows="2" maxlength="1000">${esc(c?.pros || "")}</textarea></div>
    <div class="field"><label for="cdCons">${t("缺点 / 担心的")}</label><textarea id="cdCons" name="cons" rows="2" maxlength="1000">${esc(c?.cons || "")}</textarea></div>
    <div class="field"><label for="cdNotes">${t("备注")}</label><textarea id="cdNotes" name="notes" rows="2" maxlength="2000">${esc(c?.notes || "")}</textarea></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">${t("保存")}</button><button class="btn" type="button" data-action="plan-cancel">${t("取消")}</button></div></form>`;
}

function offerFormHtml(cand) {
  const e = state.planEdit; if (e?.type !== "offer" || e.cand !== cand.id) return "";
  const o = e.id ? (state.planOffers || []).find((x) => x.id === e.id) : null;
  return `<form id="offerForm" class="panel plan-form" novalidate><input type="hidden" name="rec_id" value="${esc(o?.id || "")}"><input type="hidden" name="candidate_id" value="${cand.id}">
    <div class="plan-grid2">
      <div class="field"><label for="ofOn">${t("出价日期")}</label><input id="ofOn" name="offered_on" type="date" required value="${esc(o?.offered_on || todayISO())}"></div>
      ${pricesOk() ? `<div class="field"><label for="ofAmt">${t("我的出价")}</label><input id="ofAmt" name="amount" type="number" inputmode="decimal" min="0" step="any" required value="${esc(o?.amount ?? "")}"></div>
      <div class="field"><label for="ofCtr">${t("对方还价")}</label><input id="ofCtr" name="counter_amount" type="number" inputmode="decimal" min="0" step="any" value="${esc(o?.counter_amount ?? "")}"></div>` : `<input type="hidden" name="amount" value="${esc(o?.amount ?? 0)}">`}
      <div class="field"><label for="ofOut">${t("结果")}</label><select id="ofOut" name="outcome">${opts(OFFER_OUTCOME, o?.outcome || "pending")}</select></div>
    </div>
    <div class="field"><label for="ofCond">${t("条件（定金、验房、贷款、交割日…）")}</label><textarea id="ofCond" name="conditions" rows="2" maxlength="1000">${esc(o?.conditions || "")}</textarea></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">${t("保存")}</button><button class="btn" type="button" data-action="plan-cancel">${t("取消")}</button></div></form>`;
}

function candCard(plan, c) {
  const offers = offersOf(c.id), d = c.details || {}, fields = DETAIL_FIELDS[plan.kind];
  const facts = fields.filter(([k]) => d[k] != null && d[k] !== "").map(([k, nm]) => `<span class="rf-seg">${esc(lab({ x: nm }, "x"))} ${esc(d[k])}</span>`).join("");
  return `<article class="panel plan-cand ${c.status === "rejected" ? "is-passed" : ""}" data-money-block>
    <div class="plan-cand-h"><div class="grow"><b>${esc(c.name)}</b>${c.score ? ` <span class="plan-score" aria-label="${esc(t("打分"))} ${c.score}/5">${"★".repeat(c.score)}</span>` : ""}
      <small class="muted">${esc([c.address].filter(Boolean).join(" · "))}</small></div>
      <span class="badge ${c.status === "won" ? "b-ok" : c.status === "rejected" ? "" : "b-soon"}">${esc(lab(CAND_STATUS, c.status))}</span></div>
    <div class="plan-cand-p"><b>${mny(c.price)}</b>${c.url ? ` <a class="link-name" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${t("打开链接")}</a>` : ""}</div>
    ${facts ? `<div class="rf-meta">${facts}</div>` : ""}
    ${c.pros ? `<p class="plan-pc"><span aria-hidden="true">👍</span> ${esc(c.pros)}</p>` : ""}${c.cons ? `<p class="plan-pc"><span aria-hidden="true">⚠️</span> ${esc(c.cons)}</p>` : ""}${c.notes ? `<p class="muted">${esc(c.notes)}</p>` : ""}
    ${offers.length ? `<ul class="plan-offers" aria-label="${esc(t("出价记录"))}">${offers.map((o) => `<li><span>${esc(fmtDate(o.offered_on))}</span><b>${mny(o.amount)}</b>${o.counter_amount != null ? `<span class="muted">→ ${mny(o.counter_amount)}</span>` : ""}<span class="badge">${esc(lab(OFFER_OUTCOME, o.outcome))}</span>
      <span class="plan-mini"><button type="button" class="btn btn-sm btn-ghost" data-action="offer-edit" data-id="${o.id}">${t("编辑")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="offer-delete" data-id="${o.id}">${t("删除")}</button></span>${o.conditions ? `<small class="muted plan-cond">${esc(o.conditions)}</small>` : ""}</li>`).join("")}</ul>` : ""}
    ${offerFormHtml(c)}
    <div class="plan-acts"><button type="button" class="btn btn-sm" data-action="offer-new" data-cand="${c.id}">＋ ${t("记一次出价")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="cand-edit" data-id="${c.id}">${t("编辑")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="cand-delete" data-id="${c.id}">${t("删除")}</button></div>
  </article>`;
}

/** 候选并排对比表（宽屏）；手机上用上面的卡片，不显示这张表 */
function compareTable(plan, cands) {
  if (cands.length < 2) return "";
  const fields = DETAIL_FIELDS[plan.kind];
  const best = cands.filter((c) => c.price != null).sort((a, b) => num(a.price) - num(b.price))[0]?.id;
  const row = (label, f) => `<tr><th scope="row">${esc(label)}</th>${cands.map((c) => `<td>${f(c)}</td>`).join("")}</tr>`;
  return `<section class="panel plan-cmp" data-money-block aria-label="${esc(t("并排对比"))}"><h3>${t("并排对比")}</h3><div class="plan-cmp-scroll"><table class="plan-table"><thead><tr><th></th>${cands.map((c) => `<th scope="col">${esc(c.name)}</th>`).join("")}</tr></thead><tbody>
    ${row(t("状态"), (c) => esc(lab(CAND_STATUS, c.status)))}${row(t("总体打分"), (c) => (c.score ? "★".repeat(c.score) : "—"))}
    ${pricesOk() ? row(t("价格"), (c) => `${mny(c.price)}${c.id === best && cands.filter((x) => x.price != null).length > 1 ? ` <span class="badge b-ok">${t("最低")}</span>` : ""}`) : ""}
    ${fields.map(([k, nm]) => row(lab({ x: nm }, "x"), (c) => esc((c.details || {})[k] ?? "—"))).join("")}
    ${row(t("优点"), (c) => esc(c.pros || "—"))}${row(t("缺点 / 担心的"), (c) => esc(c.cons || "—"))}</tbody></table></div></section>`;
}

export function planPageHtml(id) {
  const plan = (state.plans || []).find((p) => p.id === id);
  if (!plan) return `<section class="section"><div class="panel empty"><strong>${t("找不到这个计划")}</strong><p><a class="btn btn-primary" href="${esc(href("house", "plan"))}">${t("回到买卖计划")}</a></p></div></section>`;
  const cands = candsOf(plan.id).sort((a, b) => ["won", "offered", "viewed", "considering", "rejected"].indexOf(a.status) - ["won", "offered", "viewed", "considering", "rejected"].indexOf(b.status) || (b.score || 0) - (a.score || 0));
  const guide = `${href("house", "plan")}?k=${plan.kind}`;
  const isHome = plan.kind === "buy_home";
  return `<section class="section menu-page plan-page">
    <p class="plan-back"><a class="link-name" href="${esc(guide)}">‹ ${isHome ? t("买房指南") : t("买车指南")}</a></p>
    <div class="section-head"><h2>${isHome ? "🏠" : "🚗"} ${esc(plan.title)}</h2></div>
    <p class="muted"><span class="badge">${esc(lab(PLAN_STATUS, plan.status))}</span> ${plan.budget != null && pricesOk() ? ` ${t("预算 {m}", { m: `<span data-money>${money(num(plan.budget))}</span>` })}` : ""} ${plan.notes ? `· ${esc(plan.notes)}` : ""}</p>
    ${state.planEdit?.type === "plan" ? planFormHtml(plan.kind) : `<div class="plan-acts"><button type="button" class="btn btn-sm" data-action="plan-edit" data-id="${plan.id}">${t("编辑计划")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="plan-status" data-id="${plan.id}" data-to="${plan.status === "dropped" ? "active" : "dropped"}">${plan.status === "dropped" ? t("恢复计划") : t("放弃这个计划")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="plan-delete" data-id="${plan.id}">${t("删除计划")}</button></div>`}
    <div class="section-head"><h3>${isHome ? t("候选的房子") : t("候选的车")}</h3></div>
    ${state.planEdit?.type === "cand" && !state.planEdit.id && state.planEdit.plan === plan.id ? candFormHtml(plan) : `<p><button type="button" class="btn btn-primary" data-action="cand-new" data-plan="${plan.id}">＋ ${isHome ? t("加一套候选") : t("加一辆候选")}</button></p>`}
    ${cands.length ? "" : `<div class="panel empty"><strong>${t("还没有候选")}</strong>${t("看到不错的就加进来，打分、写优缺点；两个以上就能并排对比。")}</div>`}
    ${compareTable(plan, cands)}
    <div class="plan-cands">${cands.map((c) => (state.planEdit?.type === "cand" && state.planEdit.id === c.id ? candFormHtml(plan) : candCard(plan, c))).join("")}</div>
  </section>`;
}

/* ───── 保存 / 动作 ───── */
const numOrNull = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : Number(s); };
export async function savePlanForm(f) {
  const fe = f.elements, title = fe.title.value.trim();
  if (!title) throw new Error(t("请填写计划名称"));
  const prev = fe.rec_id.value ? state.plans.find((p) => p.id === fe.rec_id.value) : null;
  const id = await Store.savePlan({ id: prev?.id, kind: fe.kind.value, title, status: prev?.status || "active", budget: pricesOk() ? numOrNull(fe.budget?.value) : prev?.budget ?? null, notes: fe.notes.value.trim() || null });
  toast(t("已保存")); return id;
}
export async function saveCandForm(f) {
  const fe = f.elements, name = fe.name.value.trim();
  if (!name) throw new Error(t("请填写名称"));
  const plan = state.plans.find((p) => p.id === fe.plan_id.value), prev = fe.rec_id.value ? state.planCands.find((c) => c.id === fe.rec_id.value) : null;
  const details = {}; for (const [k, , isNum] of DETAIL_FIELDS[plan.kind]) { const v = fe[`d_${k}`].value.trim(); if (v !== "") details[k] = isNum ? Number(v) : v; }
  await Store.savePlanCand({ id: prev?.id, plan_id: plan.id, name, address: fe.address.value.trim() || null, url: fe.url.value.trim() || null, price: pricesOk() ? numOrNull(fe.price.value) : prev?.price ?? null,
    status: fe.status.value, score: numOrNull(fe.score.value), pros: fe.pros.value.trim() || null, cons: fe.cons.value.trim() || null, details, notes: fe.notes.value.trim() || null });
  toast(t("已保存"));
}
export async function saveOfferForm(f) {
  const fe = f.elements, amount = numOrNull(fe.amount.value);
  if (amount == null || !fe.offered_on.value) throw new Error(t("请填写出价日期和金额"));
  const prev = fe.rec_id.value ? state.planOffers.find((o) => o.id === fe.rec_id.value) : null;
  await Store.savePlanOffer({ id: prev?.id, candidate_id: fe.candidate_id.value, offered_on: fe.offered_on.value, amount, counter_amount: pricesOk() ? numOrNull(fe.counter_amount?.value) : prev?.counter_amount ?? null, conditions: fe.conditions.value.trim() || null, outcome: fe.outcome.value });
  // 出价后候选自动标成「已出价」（只往前推，不覆盖「拿下了 / 不要了」）
  const c = state.planCands.find((x) => x.id === fe.candidate_id.value);
  if (c && ["considering", "viewed"].includes(c.status)) await Store.savePlanCand({ ...c, status: "offered" });
  toast(t("已保存"));
}

/** 买卖计划的按钮；返回 Promise（要刷新）或 undefined（不是我的动作 / 只需重画） */
export async function planAction(act, el, { render, refresh, go }) {
  const d = el.dataset;
  switch (act) {
    case "plan-new": state.planEdit = { type: "plan", id: "", kind: d.kind }; return render();
    case "plan-edit": state.planEdit = { type: "plan", id: d.id }; return render();
    case "plan-cancel": state.planEdit = null; return render();
    case "plan-status": await Store.savePlan({ ...state.plans.find((p) => p.id === d.id), status: d.to }); return refresh();
    case "plan-delete": {
      if (!confirmDelete(t("删除这个计划，连同里面的候选和出价记录？"))) return;
      await Store.deletePlan(d.id); toast(t("已删除")); go(`${href("house", "plan")}`); return refresh();
    }
    case "cand-new": state.planEdit = { type: "cand", plan: d.plan, id: "" }; render(); $("#cdName")?.focus(); return;
    case "cand-edit": state.planEdit = { type: "cand", plan: state.planCands.find((c) => c.id === d.id)?.plan_id, id: d.id }; return render();
    case "cand-delete": if (!armed(el, t("再点一次确认删除"))) return; await Store.deletePlanCand(d.id); return refresh();
    case "offer-new": state.planEdit = { type: "offer", cand: d.cand, id: "" }; render(); $("#ofAmt")?.focus(); return;
    case "offer-edit": state.planEdit = { type: "offer", cand: state.planOffers.find((o) => o.id === d.id)?.candidate_id, id: d.id }; return render();
    case "offer-delete": if (!armed(el, t("再点一次确认删除"))) return; await Store.deletePlanOffer(d.id); return refresh();
  }
}
