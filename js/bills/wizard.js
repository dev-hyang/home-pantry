/* 创建周期性账单的向导：每一步问什么、默认值、校验、最后拼出要保存的账单（纯函数，Node 可测；界面在 wizard-views.js）。
 * 设计见 docs/design-bills-overview.md §16：一次只问一两件事，聪明默认，其余字段创建后在详情页补。 */
import { initialDueFor, MONTHS_OF } from "./dates.js";

export const STEPS = [
  { id: 1, key: "what", name: "这是什么账单" },
  { id: 2, key: "when", name: "多久交一次，多少钱" },
  { id: 3, key: "pay", name: "怎么付" },
  { id: 4, key: "where", name: "挂在哪" },
  { id: 5, key: "confirm", name: "确认一下" },
];
export const LAST_STEP = STEPS.length;

/** 向导里给的频率（一次性账单走「一次性账单」，不在这里） */
export const WIZARD_FREQS = ["monthly", "quarterly", "semiannual", "annual", "biweekly", "weekly", "custom"];
/** 缴费方式（第 3 步的大卡片）：autopay 自动扣款 / online 在线手动 / escrow 贷款方代缴 / other 邮寄、电话、现场 */
export const PAY_MODES = ["autopay", "online", "escrow", "other"];
/** 常用分类（第 1 步默认展开；其余收在「更多分类」里） */
export const COMMON_CATEGORIES = ["electric", "gas", "water", "internet", "mobile", "mortgage", "rent", "hoa", "property_tax", "insurance_home", "insurance_auto", "car_loan", "credit_card", "subscription"];

/** 按分类的默认值：频率、金额是否固定、通常是否自动扣款（用户在后面的步骤里都能改） */
const DEFAULTS = {
  electric: { frequency: "monthly", amount_type: "variable" }, gas: { frequency: "monthly", amount_type: "variable" }, water: { frequency: "monthly", amount_type: "variable" },
  heating_oil: { frequency: "monthly", amount_type: "variable" }, credit_card: { frequency: "monthly", amount_type: "variable" }, toll: { frequency: "monthly", amount_type: "variable" },
  internet: { frequency: "monthly", amount_type: "fixed", pay: "autopay" }, mobile: { frequency: "monthly", amount_type: "fixed", pay: "autopay" }, cable_tv: { frequency: "monthly", amount_type: "fixed", pay: "autopay" },
  subscription: { frequency: "monthly", amount_type: "fixed", pay: "autopay" }, membership: { frequency: "annual", amount_type: "fixed", pay: "autopay" },
  mortgage: { frequency: "monthly", amount_type: "fixed" }, rent: { frequency: "monthly", amount_type: "fixed" }, hoa: { frequency: "monthly", amount_type: "fixed" },
  car_loan: { frequency: "monthly", amount_type: "fixed" }, student_loan: { frequency: "monthly", amount_type: "fixed" }, personal_loan: { frequency: "monthly", amount_type: "fixed" },
  property_tax: { frequency: "semiannual", amount_type: "fixed" }, insurance_auto: { frequency: "semiannual", amount_type: "fixed" }, insurance_home: { frequency: "annual", amount_type: "fixed" },
  insurance_health: { frequency: "monthly", amount_type: "fixed" }, insurance_life: { frequency: "annual", amount_type: "fixed" }, insurance_other: { frequency: "annual", amount_type: "fixed" },
  vehicle_reg: { frequency: "annual", amount_type: "fixed" }, income_tax: { frequency: "quarterly", amount_type: "variable" },
};
export const defaultsFor = (category) => ({ frequency: "monthly", amount_type: "variable", pay: "online", ...(DEFAULTS[category] || {}) });

/** 新草稿（category 等可来自网址参数：模板 / 房屋资料带来的） */
export function newDraft(init = {}) {
  const category = init.category || "electric", d = defaultsFor(category);
  return { category, name: init.name || "", payee: init.payee || "", trial_ends_on: "", frequency: init.frequency || d.frequency, interval_months: "", due_day: "", next_due_on: "",
    amount_type: init.amount_type || d.amount_type, typical_amount: init.typical_amount ?? "", pay: d.pay, pay_account: "", pay_other: "mail", pay_url: "",
    property_id: init.property_id || "", asset_id: "", assigned_to: "", reminder_days: "", touched: {}, ...init.extra };
}

const intOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const numOrNull = (v) => { if (v === "" || v == null) return null; const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };

/** 第 2 步的实时预览：下次到期日（算不出返回 null）。月付 / 季付 / 自定义：按「每月几号」；半年 / 年付 / 每周 / 双周：按用户填的「下一次到期日」 */
export function nextDuePreview(d, today) {
  if (d.next_due_on && /^\d{4}-\d{2}-\d{2}$/.test(d.next_due_on)) return d.next_due_on;
  const day = intOrNull(d.due_day);
  if (day && day >= 1 && day <= 31 && (MONTHS_OF[d.frequency] !== undefined || d.frequency === "custom")) return initialDueFor({ frequency: d.frequency, due_day: day, due_dates: [] }, today);
  return null;
}
/** 这个频率在第 2 步要问的是「每月几号」还是「下一次到期日」 */
export const askDay = (frequency) => ["monthly", "quarterly", "custom"].includes(frequency);

/** 每一步的校验；返回 { ok, errors: { 字段名: 提示 } }（提示是中文 key，界面用 t() 翻） */
export function validateStep(step, d, today) {
  const errors = {};
  if (step === 1 && !String(d.name || "").trim()) errors.name = "请填写账单名称。";
  if (step === 2) {
    if (!nextDuePreview(d, today)) errors[askDay(d.frequency) ? "due_day" : "next_due_on"] = askDay(d.frequency) ? "请填每月几号到期（1–31）。" : "请选下一次到期的日期。";
    if (d.frequency === "custom" && !(intOrNull(d.interval_months) >= 1)) errors.interval_months = "请填每几个月一次。";
    if (d.typical_amount !== "" && numOrNull(d.typical_amount) == null) errors.typical_amount = "金额要填数字。";
  }
  if (step === 3 && d.pay === "online" && d.pay_url && !/^https?:\/\//i.test(d.pay_url.trim())) errors.pay_url = "缴费链接需要以 http:// 或 https:// 开头。";
  return { ok: !Object.keys(errors).length, errors };
}

/** 拼出 Store.saveBill 要的账单对象；字段缺省值和整页表单（saveBillForm）一致。
 *  ctx：{ today, currency, essential, payFields }——payFields = 第 3 步选的账户解析出的 { pay_card_id, autopay_method }（界面层解析） */
export function billFromDraft(d, { today, currency, essential = true, payFields = {} } = {}) {
  const autopay = d.pay === "autopay", other = d.pay === "other";
  const channel = autopay ? "autopay" : d.pay === "escrow" ? "escrow" : other ? (["mail", "phone", "in_person"].includes(d.pay_other) ? d.pay_other : "mail") : "online";
  const reminder = String(d.reminder_days || "").split(/[,，\s]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 90);
  const b = {
    name: d.name.trim(), category: d.category, property_id: d.property_id || null, asset_id: d.asset_id || null, direction: "payable", payee: d.payee.trim() || null,
    account_last4: null, login_hint: null, pay_url: !autopay && d.pay === "online" && d.pay_url.trim() ? d.pay_url.trim() : null,
    pay_channel: channel, statement_channel: "email", amount_type: d.amount_type, typical_amount: d.amount_type === "fixed" ? numOrNull(d.typical_amount) : null, currency,
    frequency: d.frequency, interval_months: d.frequency === "custom" ? intOrNull(d.interval_months) : null, due_day: askDay(d.frequency) ? intOrNull(d.due_day) : null, due_dates: [],
    next_due_on: nextDuePreview(d, today), grace_days: 0, ends_on: null, sub_kind: null, trial_ends_on: d.trial_ends_on || null,
    reminder_days: reminder.length ? [...new Set(reminder)].sort((a, c) => c - a).slice(0, 5) : (d.frequency === "annual" ? [30, 7] : [7, 1]), late_fee_note: null,
    autopay: channel === "autopay", ...(autopay ? payFields : { pay_card_id: null, autopay_method: null }), autopay_card_expires: null,
    assigned_to: d.assigned_to || null, essential, active: true, notes: null,
  };
  if (autopay && !payFields.pay_card_id && !payFields.autopay_method) { b.pay_card_id = null; b.autopay_method = null; }
  return b;
}

/** 名称建议：优先分类名里「 / 」之前的那部分（如「水费 / 排污 / 垃圾」→「水费」） */
export const suggestName = (categoryName) => String(categoryName || "").split(" / ")[0].trim();
