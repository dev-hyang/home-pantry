/* 创建一次性账单的向导（#/bills/onetime?bill=new&type=wizard…&step=n）：5 步，完成后进这张账单的详情页。
 * 逻辑在 ot-wizard.js；样式沿用周期性向导（.wiz / .wz-*）。设计见 docs/design-bills-overview.md §16.5。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc } from "../core/util.js";
import { go, href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { propertyActive } from "../core/lifecycle.js";
import { assetChoices } from "./asset-suggest.js";
import { KINDS, PEOPLE_KINDS, peopleFor } from "./medical.js";
import { OT_KINDS, OT_LAST, OT_STEPS, newOtDraft, otRowFromDraft, validateOtStep } from "./ot-wizard.js";

const base = () => `${href("bills", "onetime")}?bill=new`;
const stepUrl = (n) => `${base()}&n=${encodeURIComponent(state.otDraft?.__n || "")}&step=${n}`;
export const otFullFormUrl = (kind) => `${base()}&mode=full${kind ? `&kind=${encodeURIComponent(kind)}` : ""}`;
const Kof = (d) => KINDS[d.kind] || KINDS.medical;
const whoName = (d) => (d.patient_id ? (state.people || []).find((p) => p.id === d.patient_id)?.name || "" : d.patient.trim());

function ensureDraft(q) {
  const n = q.get("n") || "";
  if (!state.otDraft || state.otDraft.__n !== n || (!n && !q.get("step"))) {   // 没带 n 又不是某一步 = 从别处直接进来的新一次（带 kind / prop 的链接）：总是新草稿
    const kind = q.get("kind"), prop = q.get("prop");
    state.otDraft = newOtDraft({ kind, property_id: prop && state.properties.some((p) => p.id === prop) ? prop : (kind === "project" ? state.propertyId || "" : "") }); state.otDraft.__n = n;
  }
  return state.otDraft;
}
const STEP_TEXT = {
  1: ["哪一类账单？", "选一类，后面问的内容会跟着变（比如医疗会问保险已付多少）。"],
  2: ["谁收的、关于谁？", "机构名称必填；其余可以跳过。"],
  3: ["多少钱、什么时候？", "至少填一个金额；日期没有就空着。"],
  4: ["挂在哪、谁能看？（可以跳过）", "挂到房产 / 车辆 / 设备上，之后能按它们筛选；并决定谁看得到这张账单。"],
  5: ["确认一下", "点任何一项旁边的“修改”可以回到那一步。创建后在账单页还能补账单号、理赔号等，并记付款。"],
};
const KIND_DESC = { medical: "医院、化验所、牙科；可以记保险已付和自付", pet: "兽医、宠物美容", legal: "律师、税务 / 会计事务所", project: "装修、屋顶、翻新等工程；可分次付", travel: "机票、酒店、邮轮、旅行团：定金 + 尾款" };

function stepKind(d) {
  return `<fieldset class="wz-radios"><legend class="sr-only">${t("账单种类")}</legend>${OT_KINDS.map((k) => `<label class="wz-opt"><input type="radio" name="kind" value="${k}" ${d.kind === k ? "checked" : ""}><span><b>${KINDS[k].icon} ${esc(t(KINDS[k].name))}</b><small>${t(KIND_DESC[k])}</small></span></label>`).join("")}</fieldset>`;
}
function stepWho(d) {
  const K = Kof(d), subs = K.subs.map(([k, n, ic]) => `<option value="${k}" ${d.subkind === k ? "selected" : ""}>${ic} ${esc(t(n))}</option>`).join("");
  const kinds = peopleFor(d.kind), ICON = { adult: "🧑", child: "🧒", pet: "🐾" };
  // 医疗 / 宠物：从家庭成员里选（大人、孩子 / 宠物）；其余种类是「事项 / 项目名」，自己写
  const who = kinds
    ? `<label>${t(K.who)}<select name="patient_id"><option value="">${t("（未选）")}</option>${(state.people || []).filter((p) => kinds.includes(p.kind)).map((p) => `<option value="${esc(p.id)}" ${p.id === d.patient_id ? "selected" : ""}>${ICON[p.kind] || ""} ${esc(p.name)}</option>`).join("")}</select>
        <small>${(state.people || []).some((p) => kinds.includes(p.kind)) ? t("家庭成员里没有他 / 她？创建后在账单页的“这是什么账单 → 编辑”里添加。") : t("还没有家庭成员：创建后在账单页的“这是什么账单 → 编辑”里添加，或先到 {link}。", { link: `<a href="${href("bills", "onetime")}?people=1">${t("管理家庭成员")}</a>` })}</small></label>`
    : `<label>${t(K.who)}<input name="patient" maxlength="40" value="${esc(d.patient)}"></label>`;
  return `<div class="form-grid">
    <label class="span-2">${t(K.provider)}<input name="provider" required maxlength="60" value="${esc(d.provider)}" list="otProviders"></label>
    <label>${t("小类（可选）")}<select name="subkind"><option value="">${t("未指定")}</option>${subs}</select></label>
    ${who}
    </div><datalist id="otProviders">${[...new Set((state.medBills || []).map((x) => x.provider))].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
}
function stepMoney(d) {
  const K = Kof(d), cur = Units.region.currency;
  return `<div class="form-grid">
    <label>${t(K.billed)}（${cur}）<input name="billed_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.billed_amount)}"></label>
    ${K.insurance ? `<label>${t("保险已付")}<input name="insurance_paid" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.insurance_paid)}"></label>` : ""}
    <label>${t(K.owed)}<input name="patient_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.patient_amount)}"><small>${t(K.insurance ? "留空 = 总额 − 保险已付" : "留空 = 总额")}</small></label>
    <label>${t(d.kind === "medical" || d.kind === "pet" ? "就诊日期" : d.kind === "travel" ? "出发日期" : "服务日期")}<input name="service_date" type="date" value="${esc(d.service_date)}"></label>
    <label>${t("账单日期 Bill date")}<input name="bill_date" type="date" value="${esc(d.bill_date)}"></label>
    <label>${t("到期日")}<input name="due_on" type="date" value="${esc(d.due_on)}"></label></div>`;
}
function stepWhere(d) {
  const K = Kof(d), vis = d.visibility || K.visibility, props = state.properties.filter((p) => propertyActive(p) || p.id === d.property_id), assets = assetChoices(state.assets, d.asset_id);
  const parts = [];
  if (props.length) parts.push(`<label>${t("房产")}<select name="property_id"><option value="">${t("与房产无关")}</option>${props.map((p) => `<option value="${p.id}" ${p.id === d.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`);
  if (assets.length) parts.push(`<label>${t("关联资产（车辆 / 设备）")}<select name="asset_id"><option value="">${t("不关联")}</option>${assets.map((a) => `<option value="${a.id}" ${a.id === d.asset_id ? "selected" : ""}>${a.kind === "vehicle" ? "🚗" : "🔧"} ${esc(a.name)}</option>`).join("")}</select></label>`);
  return `${parts.length ? `<div class="form-grid">${parts.join("")}</div>` : ""}
    <fieldset class="wz-radios"><legend>${t("谁能看到")}</legend>
      <label class="wz-opt"><input type="radio" name="visibility" value="private" ${vis === "private" ? "checked" : ""}><span><b>🔒 ${t("仅自己和家主可见")}</b><small>${t("医疗、法律账单默认这样；金额和机构不会出现在家人的花费明细里")}</small></span></label>
      <label class="wz-opt"><input type="radio" name="visibility" value="family" ${vis === "family" ? "checked" : ""}><span><b>👪 ${t("全家可见")}</b><small>${t("装修、旅行、宠物等默认这样")}</small></span></label></fieldset>`;
}
function stepConfirm(d) {
  const K = Kof(d), cur = Units.region.currency, m = (v) => (v !== "" ? Units.money(parseFloat(v) || 0, cur) : ""), row = (label, val, step) => `<div class="fact"><dt>${label}</dt><dd>${val || `<span class="muted">${t("未填")}</span>`} <button type="button" class="btn btn-sm btn-ghost" data-otw="goto" data-step="${step}" aria-label="${esc(t("修改 {name}", { name: label }))}">${t("修改")}</button></dd></div>`;
  const prop = state.properties.find((p) => p.id === d.property_id), asset = state.assets.find((a) => a.id === d.asset_id), vis = d.visibility || K.visibility;
  return `<dl class="fact-grid one">
      ${row(t("种类"), `${K.icon} ${esc(t(K.name))}`, 1)}
      ${row(t(K.provider), [esc(d.provider), whoName(d) && esc(whoName(d))].filter(Boolean).join(" · "), 2)}
      ${row(t("金额"), [d.billed_amount !== "" && `${t(K.billed)} ${m(d.billed_amount)}`, K.insurance && d.insurance_paid !== "" && `${t("保险已付")} ${m(d.insurance_paid)}`, d.patient_amount !== "" && `${t(K.owed)} ${m(d.patient_amount)}`].filter(Boolean).join(" · "), 3)}
      ${row(t("到期日"), esc(d.due_on || ""), 3)}
      ${row(t("挂在哪"), [prop && esc(prop.name), asset && esc(asset.name)].filter(Boolean).join(" · "), 4)}
      ${row(t("谁能看到"), vis === "private" ? `🔒 ${t("仅自己和家主可见")}` : `👪 ${t("全家可见")}`, 4)}
    </dl>
    <div class="form-grid" style="margin-top:12px"><label class="span-2">${t("备注（可选）")}<input name="notes" maxlength="500" value="${esc(d.notes)}" placeholder="${t(d.kind === "medical" ? "不要记诊断、保单号全文或身份证号" : "合同要点、付款计划…")}"></label></div>`;
}
const BODY = { 1: stepKind, 2: stepWho, 3: stepMoney, 4: stepWhere, 5: stepConfirm };

export function viewOneTimeWizard() {
  const q = state.route.q, d = ensureDraft(q), step = Math.min(OT_LAST, Math.max(1, parseInt(q.get("step"), 10) || 1)), [title, why] = STEP_TEXT[step], last = step === OT_LAST;
  return `<section class="section form-page wiz">
    <p class="wiz-step" role="status" aria-live="polite">${t("第 {n} 步 / 共 {m} 步", { n: step, m: OT_LAST })} · ${t(OT_STEPS[step - 1].name)}</p>
    <span class="mprog" aria-hidden="true"><i style="width:${Math.round((step / OT_LAST) * 100)}%"></i></span>
    <form id="otWizForm" class="panel" novalidate data-step="${step}">
      <h2 id="otwTitle" tabindex="-1">${t(title)}</h2><p class="muted" style="margin:2px 0 12px">${t(why)}</p>
      <div id="otwBody">${BODY[step](d)}</div>
      <p id="otwError" class="form-error" role="alert"></p>
      <div class="form-actions sticky-actions">
        ${step > 1 ? `<button type="button" class="btn btn-ghost" data-otw="back">${t("上一步")}</button>` : `<a class="btn btn-ghost" href="${href("bill", "new")}">${t("取消")}</a>`}
        <button type="button" class="btn btn-primary" data-otw="${last ? "finish" : "next"}">${last ? t("完成并创建") : t("下一步")}</button>
      </div>
    </form>
    <p class="muted" style="margin-top:12px;font-size:13px"><a href="${otFullFormUrl(d.kind)}">${t("我想一次填完（整页表单）")} ›</a></p>
  </section>`;
}

/* ── 事件 ── */
const form = () => $("#otWizForm");
const say = (msg, field) => { const e = $("#otwError"); if (e) e.textContent = msg ? t(msg) : ""; if (field) form()?.elements[field]?.focus(); };

function onChange(e) {
  const f = e.target.closest?.("#otWizForm"); if (!f || !state.otDraft) return;
  const d = state.otDraft, el = e.target; if (!el.name || (el.type === "radio" && !el.checked)) return;
  d[el.name] = el.value;
  if (el.name === "kind") { d.visibility = ""; d.subkind = ""; d.patient_id = ""; d.patient = ""; if (d.kind === "project" && !d.property_id) d.property_id = state.propertyId || ""; }
  say("");
}
const onInput = (e) => { const f = e.target.closest?.("#otWizForm"); if (f && state.otDraft && e.target.name && e.target.type !== "radio") state.otDraft[e.target.name] = e.target.value; };

async function finish() {
  const d = state.otDraft; if (!d) return;
  for (const s of [2, 3]) { const v = validateOtStep(s, d); if (!v.ok) { const [field, msg] = Object.entries(v.errors)[0]; go(stepUrl(s)); setTimeout(() => say(msg, field), 150); return; } }
  const K = Kof(d), pid = d.patient_id ? d.patient_id : (d.patient.trim() ? ((state.people || []).find((p) => String(p.name).trim() === d.patient.trim())?.id || null) : null);
  const dup = (state.medBills || []).find((x) => x.provider.trim().toLowerCase() === d.provider.trim().toLowerCase() && (x.bill_date || x.service_date || "") === (d.bill_date || d.service_date || "") && Number(x.patient_amount ?? x.billed_amount ?? -1) === Number(d.patient_amount || d.billed_amount || -2));
  if (dup && !d.__dupAck) { d.__dupAck = true; return say(t("已经有一张很像的账单（同一机构、同一天、同一金额）。确认是另一张，再点一次“完成并创建”。")); }
  const btn = document.querySelector('[data-otw="finish"]'); if (btn) btn.disabled = true;
  try {
    const id = await Store.saveMedicalBill(otRowFromDraft(d, { currency: Units.region.currency, K, patientId: pid, patientName: whoName(d) || null }));
    state.otDraft = null;
    document.dispatchEvent(new CustomEvent("bill-created", { detail: { id, via: "wizard", kind: "onetime" } }));
  } catch (err) { if (btn) btn.disabled = false; say(t("保存失败：{msg}", { msg: err.message })); }
}
function onClick(e) {
  const b = e.target.closest?.("[data-otw]"); if (!b || !state.otDraft) return;
  const d = state.otDraft, step = +form().dataset.step, a = b.dataset.otw;
  if (a === "back") return go(stepUrl(step - 1));
  if (a === "goto") return go(stepUrl(+b.dataset.step));
  if (a === "finish") return finish();
  if (a === "next") { const v = validateOtStep(step, d); if (!v.ok) { const [field, msg] = Object.entries(v.errors)[0]; return say(msg, field); } go(stepUrl(step + 1)); }
}
window.addEventListener("hashchange", () => setTimeout(() => { if (form()) $("#otwTitle")?.focus(); }, 60));
document.addEventListener("change", onChange);
document.addEventListener("input", onInput);
document.addEventListener("click", onClick);
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.closest?.("#otWizForm") && e.target.tagName === "INPUT" && e.target.type !== "radio") { e.preventDefault(); document.querySelector('[data-otw="next"], [data-otw="finish"]')?.click(); } });
