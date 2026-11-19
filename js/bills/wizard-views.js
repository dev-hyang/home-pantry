/* 创建周期性账单的向导（#/bill/new?type=recurring&step=n）：一屏一个问题，5 步，完成后进新账单的详情页。
 * 逻辑（默认值、预览、校验、拼账单）在 wizard.js；这里只管画面和事件。设计见 docs/design-bills-overview.md §16。
 * 草稿放在 state.billDraft（内存，不入库；创建成功或换一次新的进入就清掉）；步骤在网址里（返回键 = 上一步）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDate, todayISO } from "../core/util.js";
import { go, href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { crumbNav } from "../core/hub.js";
import { propertyActive } from "../core/lifecycle.js";
import { assetChoices } from "./asset-suggest.js";
import { COMMON_CATEGORIES, LAST_STEP, PAY_MODES, STEPS, WIZARD_FREQS, askDay, billFromDraft, defaultsFor, newDraft, nextDuePreview, suggestName, validateStep } from "./wizard.js";
import { PAY_EXTRA, accountOptions, payAcctValue, resolvePayAccount } from "./card-picker.js";
import { adultPeople } from "../settings/family-lite.js";

const B = () => window.BILLS;
const catOf = (id) => B().catOf(id);
const stepUrl = (n, extra = "") => `${href("bill", "new")}?type=recurring&n=${encodeURIComponent(state.billDraft?.__n || "")}&step=${n}${extra}`;
export const fullFormUrl = () => `${href("bill", "new")}?type=recurring&mode=full`;

/** 网址参数（模板 / 房屋资料带来的 category、name、payee、amount、freq、prop）→ 新草稿的初始值 */
function initFromQuery(q) {
  const cat = q.get("category"), amt = parseFloat(q.get("amount")), freq = q.get("freq"), prop = q.get("prop");
  return { category: cat && B().CATEGORIES.some((c) => c.id === cat) ? cat : undefined, name: (q.get("name") || "").slice(0, 60), payee: (q.get("payee") || "").slice(0, 60),
    frequency: freq && WIZARD_FREQS.includes(freq) ? freq : undefined, ...(Number.isFinite(amt) && amt >= 0 ? { typical_amount: Math.round(amt * 100) / 100, amount_type: "fixed" } : {}),
    property_id: prop && state.properties.some((p) => p.id === prop) ? prop : state.propertyId || "" };
}
function ensureDraft(q) {
  const n = q.get("n") || "";
  if (!state.billDraft || state.billDraft.__n !== n || (!n && !q.get("step"))) {   // 没带 n 又不是某一步（模板 / 房屋资料的链接）：总是新草稿
    state.billDraft = newDraft(initFromQuery(q)); state.billDraft.__n = n; state.billDraft.__sug = ""; }
  return state.billDraft;
}

const STEP_TEXT = {
  1: ["这是什么账单？", "先选个分类，名字我帮你起好了，可以改。"],
  2: ["多久交一次，多少钱？", "我会据此算出下次到期日，到期前提醒你。"],
  3: ["怎么付？", "决定到期前提醒你去缴费，还是去核对。"],
  4: ["挂在哪？（可以跳过）", "挂到房产 / 车辆 / 设备上，之后能按它们筛选账单。"],
  5: ["确认一下", "点任何一项旁边的“修改”可以回到那一步。创建后在账单详情页还能补账号尾号、登录提示等。"],
};

/* ── 每一步的内容 ── */
function catCard(c, sel) { return `<label class="wz-cat"><input type="radio" name="category" value="${c.id}" ${c.id === sel ? "checked" : ""}><span><b aria-hidden="true">${c.icon}</b> ${esc(t(c.name))}</span></label>`; }
function stepWhat(d) {
  const common = COMMON_CATEGORIES.map(catOf), rest = B().CATEGORIES.filter((c) => !COMMON_CATEGORIES.includes(c.id));
  const sub = B().isSubCat(d.category);
  return `<fieldset class="wz-cats" aria-label="${esc(t("分类"))}">${common.map((c) => catCard(c, d.category)).join("")}</fieldset>
    <details class="wz-more" ${rest.some((c) => c.id === d.category) ? "open" : ""}><summary>${t("更多分类")}</summary><fieldset class="wz-cats" aria-label="${esc(t("更多分类"))}">${rest.map((c) => catCard(c, d.category)).join("")}</fieldset></details>
    <div class="form-grid" style="margin-top:12px">
      <label class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${esc(d.name)}" placeholder="${t("例如：ComEd 电费")}"></label>
      <label class="span-2">${t("付款方（可选）")}<input name="payee" maxlength="60" value="${esc(d.payee)}" placeholder="${t("例如：ComEd")}"></label>
      <label class="span-2" data-wz-sub ${sub ? "" : "hidden"}>${t("免费试用到期日（可选）")}<input name="trial_ends_on" type="date" value="${esc(d.trial_ends_on)}"><small>${t("到期前 3 天提醒“不续就取消”")}</small></label>
    </div>`;
}
function stepWhen(d, today) {
  const f = d.frequency;
  const when = askDay(f)
    ? `<label>${t("每月几号到期")}<input name="due_day" type="number" inputmode="numeric" min="1" max="31" value="${esc(d.due_day)}" placeholder="${t("例如 20")}"></label>${f === "custom" ? `<label>${t("每几个月一次")}<input name="interval_months" type="number" inputmode="numeric" min="1" max="60" value="${esc(d.interval_months)}"></label>` : ""}`
    : `<label>${t("下一次到期日")}<input name="next_due_on" type="date" value="${esc(d.next_due_on)}"></label>`;
  return `<div class="form-grid">
      <label>${t("多久交一次")}<select name="frequency">${WIZARD_FREQS.map((k) => `<option value="${k}" ${k === f ? "selected" : ""}>${t(B().FREQUENCIES[k])}</option>`).join("")}</select></label>
      ${when}
    </div>
    <p id="wizPreview" class="notice" role="status" style="margin:10px 0">${previewText(d, today)}</p>
    <fieldset class="wz-radios"><legend>${t("金额")}</legend>
      <label class="wz-opt"><input type="radio" name="amount_type" value="fixed" ${d.amount_type === "fixed" ? "checked" : ""}><span><b>${t("固定金额")}</b><small>${t("每次一样，例如房贷、网络、订阅")}</small></span></label>
      <label class="wz-opt"><input type="radio" name="amount_type" value="variable" ${d.amount_type !== "fixed" ? "checked" : ""}><span><b>${t("每次不一样")}</b><small>${t("例如水电燃气：先不填，记缴费时填实际金额，我按最近几次的均值估")}</small></span></label>
    </fieldset>
    <label data-wz-amount ${d.amount_type === "fixed" ? "" : "hidden"} style="display:${d.amount_type === "fixed" ? "grid" : "none"};margin-top:8px">${t("每次金额（{cur}）", { cur: Units.region.currency })}<input name="typical_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.typical_amount)}"></label>`;
}
const previewText = (d, today) => { const n = nextDuePreview(d, today); return n ? `📅 ${t("下次到期：{d}", { d: esc(fmtDate(n)) })}` : t(askDay(d.frequency) ? "填上每月几号，我来算下次到期日。" : "选一个下一次到期的日期。"); };
const PAY_TEXT = { autopay: ["自动扣款", "银行 / 卡每期自动扣；到期前后提醒你核对金额"], online: ["在线手动缴费", "到期前提醒你去缴费，可以贴缴费链接"], escrow: ["Escrow 代缴", "房产税、保险由贷款方从房贷月供里代缴：不重复提醒"], other: ["其他方式", "邮寄支票、电话、现场缴费"] };
function stepPay(d) {
  const cards = PAY_MODES.map((k) => `<label class="wz-opt"><input type="radio" name="pay" value="${k}" ${d.pay === k ? "checked" : ""}><span><b>${t(PAY_TEXT[k][0])}</b><small>${t(PAY_TEXT[k][1])}</small></span></label>`).join("");
  const detail = d.pay === "autopay" ? `<label>${t("从哪张卡 / 账户扣（可选）")}<select name="pay_account" data-pay-acct>${accountOptions(d.pay_account || payAcctValue(null, ""), { none: "（未指定）", extra: PAY_EXTRA })}</select></label>`
    : d.pay === "online" ? `<label>${t("缴费链接（可选）")}<input name="pay_url" type="url" maxlength="300" placeholder="https://" value="${esc(d.pay_url)}"></label>`
    : d.pay === "other" ? `<label>${t("具体方式")}<select name="pay_other">${[["mail", "邮寄支票"], ["phone", "电话缴费"], ["in_person", "现场缴费"]].map(([k, n]) => `<option value="${k}" ${d.pay_other === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>` : "";
  return `<fieldset class="wz-radios"><legend class="sr-only">${t("缴费方式")}</legend>${cards}</fieldset>${detail ? `<div class="form-grid" style="margin-top:10px">${detail}</div>` : ""}`;
}
function stepWhere(d) {
  const props = state.properties.filter((p) => propertyActive(p) || p.id === d.property_id), assets = assetChoices(state.assets, d.asset_id);
  const parts = [];
  if (props.length) parts.push(`<label>${t("房产")}<select name="property_id"><option value="">${t("与房产无关")}</option>${props.map((p) => `<option value="${p.id}" ${p.id === d.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`);
  if (assets.length) parts.push(`<label>${t("关联资产（车辆 / 设备）")}<select name="asset_id"><option value="">${t("不关联")}</option>${assets.map((a) => `<option value="${a.id}" ${a.id === d.asset_id ? "selected" : ""}>${a.kind === "vehicle" ? "🚗" : "🔧"} ${esc(a.name)}</option>`).join("")}</select></label>`);
  if (adultPeople().length > 1) parts.push(`<label>${t("谁负责")}<select name="assigned_person_id"><option value="">${t("不指定")}</option>${adultPeople().map((p) => `<option value="${p.id}" ${p.id === d.assigned_person_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`);
  return parts.length ? `<div class="form-grid">${parts.join("")}</div><p class="muted" style="font-size:13px">${t("都是可选的，直接点“下一步”跳过也行。")}</p>` : `<p class="muted">${t("没有需要选的，直接点“下一步”。")}</p>`;
}
function stepConfirm(d, today) {
  const cat = catOf(d.category), n = nextDuePreview(d, today), row = (label, val, step) => `<div class="fact"><dt>${label}</dt><dd>${val || `<span class="muted">${t("未填")}</span>`} <button type="button" class="btn btn-sm btn-ghost" data-wz="goto" data-step="${step}" aria-label="${esc(t("修改 {name}", { name: label }))}">${t("修改")}</button></dd></div>`;
  const prop = state.properties.find((p) => p.id === d.property_id), asset = state.assets.find((a) => a.id === d.asset_id);
  const amount = d.amount_type === "fixed" ? (d.typical_amount !== "" ? Units.money(parseFloat(d.typical_amount) || 0, Units.region.currency) : "") : t("每次不一样（记缴费后按均值估）");
  return `<dl class="fact-grid one">
      ${row(t("账单"), `${cat.icon} ${esc(d.name)} · ${esc(t(cat.name))}${d.payee ? ` · ${esc(d.payee)}` : ""}`, 1)}
      ${row(t("多久一次"), `${esc(t(B().FREQUENCIES[d.frequency]))}${n ? ` · ${t("下次 {d}", { d: esc(fmtDate(n)) })}` : ""}`, 2)}
      ${row(t("金额"), esc(amount), 2)}
      ${row(t("怎么付"), esc(t(PAY_TEXT[d.pay][0])), 3)}
      ${row(t("挂在哪"), [prop && esc(prop.name), asset && esc(asset.name)].filter(Boolean).join(" · "), 4)}
    </dl>
    <div class="form-grid" style="margin-top:12px"><label class="span-2">${t("提前几天提醒（逗号分隔）")}<input name="reminder_days" value="${esc(d.reminder_days)}" placeholder="${d.frequency === "annual" ? "30, 7" : "7, 1"}"><small>${t("留空 = 默认。")}</small></label></div>`;
}
const BODY = { 1: stepWhat, 2: stepWhen, 3: stepPay, 4: stepWhere, 5: stepConfirm };

export function viewBillWizard() {
  const q = state.route.q, d = ensureDraft(q), step = Math.min(LAST_STEP, Math.max(1, parseInt(q.get("step"), 10) || 1)), today = todayISO();
  const [title, why] = STEP_TEXT[step], pct = Math.round((step / LAST_STEP) * 100), last = step === LAST_STEP;
  return `<section class="section form-page wiz">
    ${crumbNav([{ href: href("bills", "all"), label: t("账单") }, { label: t("添加账单") }])}
    <p class="wiz-step" role="status" aria-live="polite">${t("第 {n} 步 / 共 {m} 步", { n: step, m: LAST_STEP })} · ${t(STEPS[step - 1].name)}</p>
    <span class="mprog" aria-hidden="true"><i style="width:${pct}%"></i></span>
    <form id="wizForm" class="panel" novalidate data-step="${step}">
      <h2 id="wizTitle" tabindex="-1">${t(title)}</h2><p class="muted" style="margin:2px 0 12px">${t(why)}</p>
      <div id="wizBody">${BODY[step](d, today)}</div>
      <p id="wizError" class="form-error" role="alert"></p>
      <div class="form-actions sticky-actions">
        ${step > 1 ? `<button type="button" class="btn btn-ghost" data-wz="back">${t("上一步")}</button>` : `<a class="btn btn-ghost" href="${href("bill", "new")}">${t("取消")}</a>`}
        <button type="button" class="btn btn-primary" data-wz="${last ? "finish" : "next"}">${last ? t("完成并创建") : t("下一步")}</button>
      </div>
    </form>
    <p class="muted" style="margin-top:12px;font-size:13px"><a href="${fullFormUrl()}">${t("我想一次填完（整页表单）")} ›</a></p>
  </section>`;
}

/* ── 事件 ── */
const form = () => $("#wizForm");
function repaint() { const d = state.billDraft, step = +form().dataset.step; $("#wizBody").innerHTML = BODY[step](d, todayISO()); }
function say(msg, field) { const e = $("#wizError"); if (e) e.textContent = msg ? t(msg) : ""; if (field) form()?.elements[field]?.focus(); }

function onChange(e) {
  const f = e.target.closest?.("#wizForm"); if (!f || !state.billDraft) return;
  const d = state.billDraft, el = e.target, name = el.name; if (!name) return;
  if (el.type === "radio" && !el.checked) return;
  d[name] = el.value;
  if (name === "category") {
    const df = defaultsFor(d.category), sug = suggestName(t(catOf(d.category).name));
    if (!d.touched.frequency) d.frequency = df.frequency; if (!d.touched.amount_type) d.amount_type = df.amount_type; if (!d.touched.pay) d.pay = df.pay;
    if (!d.name.trim() || d.name === d.__sug) { d.name = sug; f.elements.name.value = sug; }
    d.__sug = sug; f.querySelector("[data-wz-sub]")?.toggleAttribute("hidden", !B().isSubCat(d.category));
  }
  if (["frequency", "amount_type", "pay"].includes(name)) { d.touched[name] = true; repaint(); }
  if (["due_day", "next_due_on", "interval_months", "frequency"].includes(name)) { const p = $("#wizPreview"); if (p) p.innerHTML = previewText(d, todayISO()); }
  say("");
}
function onInput(e) { const f = e.target.closest?.("#wizForm"); if (!f || !state.billDraft || e.target.type === "radio") return; if (e.target.name) state.billDraft[e.target.name] = e.target.value; if (["due_day", "interval_months"].includes(e.target.name)) { const p = $("#wizPreview"); if (p) p.innerHTML = previewText(state.billDraft, todayISO()); } }

async function finish() {
  const d = state.billDraft; if (!d) return;
  for (const s of [1, 2, 3]) { const v = validateStep(s, d, todayISO()); if (!v.ok) { const [field, msg] = Object.entries(v.errors)[0]; go(stepUrl(s)); setTimeout(() => say(msg, field), 150); return; } }
  const hit = (state.bills || []).find((x) => x.active !== false && !x.ended_on && x.name.trim().toLowerCase() === d.name.trim().toLowerCase());
  if (hit && !d.__dupAck) { d.__dupAck = true; return say(t("已经有在用的账单「{name}」。确认是另一条，再点一次“完成并创建”。", { name: hit.name })); }
  const acct = d.pay === "autopay" ? resolvePayAccount(d.pay_account, "") : { card_id: null, method: null };
  const bill = billFromDraft(d, { today: todayISO(), currency: Units.region.currency, essential: catOf(d.category).essential !== false, payFields: { pay_card_id: acct.card_id, autopay_method: acct.method } });
  const btn = document.querySelector('[data-wz="finish"]'); if (btn) btn.disabled = true;
  try {
    const id = await Store.saveBill(bill);
    state.billDraft = null;
    document.dispatchEvent(new CustomEvent("bill-created", { detail: { id, via: "wizard" } }));
  } catch (err) { if (btn) btn.disabled = false; say(t("保存失败：{msg}", { msg: err.message })); }
}

function onClick(e) {
  const b = e.target.closest?.("[data-wz]"); if (!b || !state.billDraft) return;
  const d = state.billDraft, step = +form().dataset.step, a = b.dataset.wz;
  if (a === "back") return go(stepUrl(step - 1));
  if (a === "goto") return go(stepUrl(+b.dataset.step));
  if (a === "finish") return finish();
  if (a === "next") { const v = validateStep(step, d, todayISO()); if (!v.ok) { const [field, msg] = Object.entries(v.errors)[0]; return say(msg, field); } go(stepUrl(step + 1)); }
}
// 换步后把焦点放到标题（读屏会读出新一步）
window.addEventListener("hashchange", () => setTimeout(() => { if (form()) $("#wizTitle")?.focus({ preventScroll: false }); }, 60));
document.addEventListener("change", onChange);
document.addEventListener("input", onInput);
document.addEventListener("click", onClick);
// 回车 = 下一步（不提交整页）
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.closest?.("#wizForm") && e.target.tagName === "INPUT" && e.target.type !== "radio") { e.preventDefault(); document.querySelector('[data-wz="next"], [data-wz="finish"]')?.click(); } });
