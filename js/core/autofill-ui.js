/* 自动填表：页面上的按钮和交互。 */
import { $, esc, num, todayISO } from "./util.js";
import { KINDS } from "./autofill-forms.js";
import { SCAN_SHAPE, needsConsent, onetimeFromScan, recurringFromScan, routeScan } from "../bills/scan-lib.js";
import { Store } from "./store.js";
import { aiReady, askText, visionCapable } from "./ai.js";
import { aiSettings, providerOf } from "./ai-common.js";
import { go, href } from "./router.js";
import { state } from "./state.js";
import { suggestAssetLinks } from "../bills/asset-suggest.js";
import { t } from "./i18n.js";
import { B, CONSENT_TEXT, MAX_IMAGES, MED, SYSTEM, compressImage, idList, parseJson } from "./autofill-common.js";

/* ───────────── 页面上的按钮 ───────────── */
/** 表单上方的“拍照自动填写”条；formSel 是要填的表单的选择器 */
export function autofillBar(kind, formSel, extra = "") {
  const def = KINDS[kind]; if (!def) return "";
  const s = aiSettings(), p = providerOf(s.provider), ready = aiReady(), canImg = visionCapable(p);
  const off = !ready ? t("先在 设置 → AI 助手 填一个 key（推荐 Gemini，有免费额度）") : !canImg ? t("当前的 {p} 不能读图片，换成 Gemini 才能用", { p: t(p.name) }) : "";
  return `<div class="af-bar" data-af="${kind}">
    <label class="ui-btn af-btn ${off ? "is-off" : ""}" data-size="sm"><input type="file" accept="image/*" multiple data-autofill="${kind}" data-form="${esc(formSel)}" ${off ? "disabled" : ""}><span>📷 ${t(def.label)}</span></label>${extra}
    <span class="muted af-hint">${off ? `${esc(off)} · <a href="#/me/settings?sec=ai">${t("去设置")}</a>` : `${esc(t(def.hint))}。${t("图片发给你选的 AI 服务商，不保存；识别结果请核对后再保存。")}`}</span>
    <div class="af-status" role="status" aria-live="polite"></div><div class="af-thumbs"></div></div>`;
}
/** 「添加账单」选类型页上的扫描条：拍信件 / 账单，AI 判断是周期性还是一次性，跳到对应的表单并预填（只填空字段，核对后再保存） */
export function scanNewBillBar() {
  const s = aiSettings(), p = providerOf(s.provider), ready = aiReady(), canImg = visionCapable(p);
  const off = !ready ? t("先在 设置 → AI 助手 填一个 key（推荐 Gemini，有免费额度）") : !canImg ? t("当前的 {p} 不能读图片，换成 Gemini 才能用", { p: t(p.name) }) : "";
  return `<div class="af-bar" data-af="scan">
    <label class="ui-btn af-btn ${off ? "is-off" : ""}" data-size="sm"><input type="file" accept="image/*" multiple data-autoscan ${off ? "disabled" : ""}><span>📷 ${t("扫描信件 / 账单，自动判断类型")}</span></label>
    <span class="muted af-hint">${off ? `${esc(off)} · <a href="#/me/settings?sec=ai">${t("去设置")}</a>` : `${esc(t("拍一封信、一张账单或邮件截图：识别后自动进到周期性或一次性账单表单并填好，你核对后再保存。图片发给你选的 AI 服务商，不保存。"))}`}</span>
    <div class="af-status" role="status" aria-live="polite"></div></div>`;
}
const norm = (x) => String(x || "").trim().toLowerCase();
/** 周期性：够了就直接建（疑似重复先问），成功 → 进详情页（?ai=1）；缺到期日 → 草稿交给向导（从第 2 步问）。返回 true = 已建好 / 已转交 */
async function createRecurringFromScan(d, say) {
  const B_ = B(), today = todayISO();
  const { bill, draft } = recurringFromScan(d, { catIds: B_.CATEGORIES.map((c) => c.id), catName: (id) => String(t(B_.catOf(id).name)).split(" / ")[0], essential: (id) => B_.catOf(id).essential !== false, currency: Units.region.currency, today });
  if (!bill) {   // 读不出下次到期日：把读到的放进向导草稿，从第 2 步（多久交一次）开始问
    const n = String(Date.now()); draft.__n = n; draft.__sug = ""; draft.property_id = state.propertyId || ""; state.billDraft = draft;
    say(t("到期日没读出来，打开向导补上这一项。")); go(`${href("bill", "new")}?type=recurring&n=${n}&step=2`); return true;
  }
  const hit = (state.bills || []).find((x) => x.active !== false && !x.ended_on && (norm(x.name) === norm(bill.name) || (bill.payee && norm(x.payee) === norm(bill.payee) && x.category === bill.category)));
  if (hit && !window.confirm(t("已经有类似的账单「{name}」。确定 = 仍然新建一张；取消 = 打开已有的那张。", { name: hit.name }))) { go(href("bill", hit.id)); return true; }
  const asset = suggestAssetLinks([{ id: "scan", name: bill.name, payee: bill.payee, category: bill.category, active: true }], state.assets)[0];
  if (asset) bill.asset_id = asset.assetId;
  if (state.propertyId && state.properties.length === 1) bill.property_id = state.propertyId;
  const id = await Store.saveBill(bill);
  document.dispatchEvent(new CustomEvent("bill-created", { detail: { id, via: "ai", kind: "recurring" } }));
  return true;
}
/** 一次性：有机构名 + 至少一个金额就直接建（疑似重复先问），成功 → 进它的详情页；否则返回 false 退回一次性账单表单 */
async function createOnetimeFromScan(d, kind, say) {
  const K = MED()[kind] || MED().medical;
  const row = onetimeFromScan(d, { kind, subIds: K.subs.map(([id]) => id), currency: Units.region.currency, visibility: K.visibility });
  if (!row) { say(t("没读到机构名或金额，打开表单补上。")); return false; }
  const hit = (state.medBills || []).find((x) => norm(x.provider) === norm(row.provider) && ((row.bill_ref && x.bill_ref === row.bill_ref) || (!row.bill_ref && (x.bill_date || x.service_date) === (row.bill_date || row.service_date) && num(x.patient_amount) === num(row.patient_amount))));
  if (hit && !window.confirm(t("已经有类似的账单「{name}」。确定 = 仍然新建一张；取消 = 打开已有的那张。", { name: hit.provider }))) { go(`${href("bills", "onetime")}?bill=${hit.id}`); return true; }
  const id = await Store.saveMedicalBill(row);
  document.dispatchEvent(new CustomEvent("bill-created", { detail: { id, via: "ai", kind: "onetime" } }));
  return true;
}
async function scanNewBill(input) {
  const bar = input.closest(".af-bar"), files = [...input.files].slice(0, MAX_IMAGES); input.value = "";
  if (!bar || !files.length) return;
  const status = bar.querySelector(".af-status"), say = (msg, err = false) => { status.textContent = msg; status.className = `af-status ${err ? "form-error" : ""}`; };
  if (needsConsent("unknown") && !window.confirm(t(CONSENT_TEXT))) return;   // 还不知道是什么账单：每次都确认
  say(t("正在识别…（几十秒）")); bar.classList.add("is-busy");
  try {
    const images = []; for (const f of files) images.push(await compressImage(f));
    const cats = B().CATEGORIES.map((c) => ({ id: c.id, name: c.name })), freqs = Object.entries(B().FREQUENCIES).map(([id, name]) => ({ id, name }));
    const kinds = Object.entries(MED()).map(([id, k]) => ({ id, name: k.name }));
    const user = [
      "Photos / screenshots of a BILL, statement or notice LETTER. Decide whether it is a RECURRING bill or a ONE-TIME bill.",
      "bill_type = \"recurring\" for bills that come again on a schedule (utilities, internet, mobile, rent, mortgage, insurance premium or renewal, property tax, subscriptions, credit card, HOA); \"onetime\" for a single event with a total that may be paid in parts (medical, vet, legal / tax-preparation, contractor / renovation project, travel booking).",
      `For onetime: kind = best id from: ${idList(kinds)}.`,
      `For recurring: category = best id from: ${idList(cats)}. frequency = best id from: ${idList(freqs)}. name = short bill name. payee = who is paid. account_last4 = last 4 characters of the account number only. amount = amount due. due_date = due date. autopay = true only if it says autopay.`,
      "For onetime: provider = who billed. patient = the person / pet / project name. subkind = unknown ids may be null. bill_ref = invoice / statement number. claim_ref = insurance claim number. service_date / bill_date / due_on = dates. billed_amount = total charges. insurance_paid, adjustment, patient_amount (what is owed now).",
      "NEVER extract diagnoses, procedure / ICD codes, medications or any clinical details. Fill only what is clearly visible; use null otherwise.",
      "Return exactly: " + JSON.stringify(SCAN_SHAPE) ].join("\n");
    const d = parseJson(await askText(SYSTEM, user, { json: true, images, temperature: 0.1, maxTokens: 1800 }));
    const { type, kind } = routeScan(d);
    say(t("识别完成，正在创建账单…"));
    if (type === "recurring" ? await createRecurringFromScan(d, say) : await createOnetimeFromScan(d, kind, say)) return;
    // 缺必填项：不硬建，退回对应的表单 / 向导，把读到的填进去（周期性：向导从缺的那一步开始）
    if (type === "recurring") return;   // createRecurringFromScan 已经把草稿放好并跳到向导
    go(`${href("otbill", "new")}?mode=full&kind=${encodeURIComponent(kind)}`);
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const form = $("#medBillForm"); if (!form || form.dataset.id) continue;
      const filled = []; KINDS.medbill.apply({ form, d, fill: makeFill(form, filled), isNew: true }); form.dataset.afPending = "1";
      const st = form.closest("section")?.querySelector(".af-status");
      if (st) st.textContent = filled.length ? t("已填入 {n} 项：{list}。标黄带“？”的是推测，请核对后点保存。", { n: filled.length, list: filled.join("、") }) : t("没有识别到可以填的内容。换一张更清楚的图再试。");
      return;
    }
  } catch (e) { say(e.message || String(e), true); }
  finally { bar.classList.remove("is-busy"); }
}
function makeFill(form, filled) {
  return (name, value, label, { force = false, guess = false } = {}) => {
    const el = form.elements[name];
    if (!el || value == null || value === "" || el.disabled) return false;
    if (el.closest("fieldset[hidden]")) return false;   // 只填当前看得到的分区
    if (el.type === "checkbox") { if (el.checked && !force) return false; el.checked = !!value; }
    else {
      if (!force && String(el.value).trim() !== "") return false;   // 只填空着的，不覆盖你已经填的
      if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === String(value))) return false;
      el.value = String(value);
    }
    el.classList.add(guess ? "af-guess" : "af-filled");
    el.dispatchEvent(new Event(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", { bubbles: true }));
    filled.push(guess ? `${label}？` : label);
    return true;
  };
}
async function run(input) {
  const kind = input.dataset.autofill, def = KINDS[kind], form = $(input.dataset.form), bar = input.closest(".af-bar");
  const files = [...input.files].slice(0, MAX_IMAGES); input.value = "";
  if (!def || !form || !bar || !files.length) return;
  // 一次性账单：已经保存过的这张账单页上再拍 = 要录下一张新账单，别把识别结果填进这张已存的（会改掉它）。
  // 先去一张空白的同类新账单表单，再把照片交给那里的识别
  if (kind === "medbill" && form.dataset.id) {
    go(`${href("otbill", "new")}?mode=full&kind=${encodeURIComponent(form.elements.kind?.value || "medical")}`);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const nf = $(input.dataset.form), ni = nf && !nf.dataset.id ? nf.closest("section")?.querySelector("input[data-autofill]") : null;
      if (ni) { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); ni.files = dt.files; ni.dispatchEvent(new Event("change", { bubbles: true })); return; }
    }
    return;
  }
  // 医疗 / 法律账单默认私密：图片发给 AI 之前每次都要确认
  if (kind === "medbill" && needsConsent("onetime", form.elements.kind?.value || "medical") && !window.confirm(t(CONSENT_TEXT))) return;
  const status = bar.querySelector(".af-status"), thumbs = bar.querySelector(".af-thumbs");
  const say = (msg, err = false) => { status.textContent = msg; status.className = `af-status ${err ? "form-error" : ""}`; };
  say(t("正在识别…（几十秒）")); bar.classList.add("is-busy");
  try {
    const images = []; for (const f of files) images.push(await compressImage(f));
    thumbs.innerHTML = images.map((i) => `<img src="${i.url}" alt="${t("拍的照片，供核对")}">`).join("");   // 留在这里方便对着核对
    const { system, user } = def.prompt(form);
    const d = parseJson(await askText(system, user, { json: true, images, temperature: 0.1, maxTokens: 1500 }));
    const filled = [];
    def.apply({ form, d, fill: makeFill(form, filled), isNew: !(form.elements.asset_id?.value || form.elements.bill_id?.value || form.elements.item_id?.value) });
    form.dataset.afPending = "1";   // 还没核对：离开页面时不自动保存
    say(filled.length ? t("已填入 {n} 项：{list}。标黄带“？”的是推测，请核对后点保存。", { n: filled.length, list: filled.join("、") })
      : t("没有识别到可以填的内容（已有内容不会被覆盖）。换一张更清楚的图再试。"));
  } catch (e) { say(e.message || String(e), true); }
  finally { bar.classList.remove("is-busy"); }
}
document.addEventListener("change", (e) => { if (e.target.matches?.("input[data-autofill]")) run(e.target); else if (e.target.matches?.("input[data-autoscan]")) scanNewBill(e.target); });
document.addEventListener("input", (e) => { if (e.isTrusted) e.target.classList?.remove("af-filled", "af-guess"); });
