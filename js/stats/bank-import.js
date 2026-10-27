/* 银行 / 信用卡 CSV 导入：很多花费没有小票，只剩一笔刷卡或扣款记录——把银行网站导出的 CSV 补进花费。
 *
 * 全程在浏览器里处理，文件不上传；只把你确认的那几笔存成花费（名称 = 商家，分类 = 你选的），原始整行文字不保存。
 * 流程：选文件 → 自动认出列（日期 / 商家说明 / 金额 或 借贷两列）和金额正负 → 按「商家」合并成一张清单 →
 *   每个商家自动归类（你教过的规则 > 已有账单的收款方 > 内置关键词 > 银行自带分类），认不出的请你选一次 →
 *   信用卡还款、转账、收入默认跳过（它们不是花费），和已有花费对得上的（日期差 ≤ 3 天、金额一样）也跳过，防止重复；
 *   确认后一次导入，可以整批撤销。选过的归类可以记住（存在家庭预算设置里，全家共用，下次同一商家自动归类）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, money, num, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { categoryOptions } from "../pantry/views.js";
import { meta, saveMeta } from "../bills/budget.js";
import { aiReady, aiSettings, askText, providerOf, visionCapable } from "../core/ai.js";
import { compressImage } from "../core/autofill.js";
import { aiExtract, chunkLines, detectAccount, looksOFX, looksQIF, parseStatementLines, pdfImages, pdfLines, readOFX, readQIF, readXLSX, redactLines, statementTotals } from "./statement-readers.js";

let refreshFn = null;
export const initBankImport = ({ refresh }) => { refreshFn = refresh; };

/* ───────────── CSV 解析 ───────────── */
function decode(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { /* 不是 UTF-8 */ }
  try { return new TextDecoder("gb18030").decode(buf); } catch { return new TextDecoder().decode(buf); }   // 国内银行常见的 GBK 编码
}
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, "");
  const head = text.split(/\r?\n/, 6).join("\n");
  const count = (d) => head.split(d).length - 1;
  const delim = [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** 数字：1,234.56 / 1.234,56 / (12.30) / -12.30 / ¥-1,234.50 / 12.30 CR */
export function parseAmount(s) {
  let v = String(s ?? "").trim(); if (!v) return null;
  let neg = /^\(.*\)$/.test(v) || /-/.test(v) || /\bDR\b/i.test(v);
  v = v.replace(/[^\d.,]/g, "");
  if (!/\d/.test(v)) return null;
  const lc = v.lastIndexOf(","), ld = v.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) v = lc > ld ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");   // 最后出现的那个是小数点
  else if (lc >= 0) v = /,\d{2}$/.test(v) && v.split(",").length === 2 ? v.replace(",", ".") : v.replace(/,/g, "");
  const n = parseFloat(v); if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
/** 日期 → YYYY-MM-DD；order = "mdy" | "dmy"（斜杠写法里不确定时用） */
export function parseDate(s, order = "mdy") {
  const v = String(s ?? "").trim(); let m;
  if ((m = v.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{4})(\d{2})(\d{2})$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return order === "dmy" ? iso(y, +m[2], +m[1]) : iso(y, +m[1], +m[2]); }
  return null;
}
const iso = (y, mo, d) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);

/* ───────────── 认列 ───────────── */
const HEAD = {
  date: [/^transaction date$/i, /^trans\.? date$/i, /^date$/i, /^posted? date$/i, /^posting date$/i, /^post date$/i, /交易日期|交易时间|记账日期|日期/],
  desc: [/^description$/i, /^merchant$/i, /^payee$/i, /^name$/i, /^memo$/i, /^details?$/i, /^narrative$/i, /交易摘要|摘要|商户|对方户名|交易说明|交易对方|备注|用途/],
  amount: [/^amount$/i, /^transaction amount$/i, /交易金额|金额|发生额/],
  debit: [/^debit$/i, /withdraw|money out|^paid out$/i, /支出|借方|付款金额/],
  credit: [/^credit$/i, /deposit|money in|^paid in$/i, /收入|贷方|存入/],
  category: [/^category$/i, /分类/],
  type: [/^type$/i, /^transaction type$/i, /交易类型/],
};
function detect(headers) {
  const used = new Set(), pick = (key) => { for (const re of HEAD[key]) { const i = headers.findIndex((h, k) => !used.has(k) && re.test(h)); if (i >= 0) { used.add(i); return i; } } return -1; };
  const m = { date: pick("date"), desc: pick("desc"), amount: pick("amount"), debit: -1, credit: -1, category: pick("category"), type: pick("type") };
  if (m.amount < 0) { m.debit = pick("debit"); m.credit = pick("credit"); }
  return m;
}
/** 第一行像表头（含日期列和金额 / 说明列）的位置；前面的账户摘要行跳过 */
function headerIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) { const m = detect(rows[i]); if (m.date >= 0 && (m.amount >= 0 || m.debit >= 0 || m.credit >= 0)) return i; }
  return -1;
}

/* ───────────── 商家合并、归类规则 ───────────── */
const NOISE = /\b(pos|debit card|purchase|authorized on|checkcard|recurring|payment to|sq \*|tst\*|sp \*|pp\*|paypal \*|ach|web id|ref|card ending|visa|mastercard|dda)\b/gi;
/** 说明 → 商家显示名（去掉卡号 / 流水号 / 日期等噪音，最多 3 个词） */
export function merchantName(desc) {
  let s = String(desc || "").replace(/^\s*(sq|tst|sp|pp|py|dd|ub|pos|dbt)\s*\*\s*/i, " ").replace(/amzn\.com\/bill|amzn\.com/gi, " ").replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " ").replace(/\b\d{5,}\b/g, " ").replace(/[xX*#]{2,}\s*\d+/g, " ").replace(NOISE, " ").replace(/[#*]+/g, " ").replace(/\s+/g, " ").trim();
  // 纯数字、字母数字混杂的流水码（AB12、2X4R5、XY99）、州名缩写（IL、CA）不要——否则 AMAZON MKTPL*AB12 和 AMAZON MKTPL*2X4R5 会被当成两家，记住的归类也对不上
  s = s.split(" ").filter((w) => !/^\d+$/.test(w) && !(/\d/.test(w) && /[a-z]/i.test(w) && !/^\d+-[a-z]+$/i.test(w)) && !/^[A-Z]{2}$/.test(w)).slice(0, 3).join(" ");
  return (s || String(desc || "").trim()).slice(0, 40);
}
const keyOf = (desc) => merchantName(desc).toLowerCase();

const SKIP = {
  card_payment: [/(payment|pmt).*(thank|received|autopay)|autopay|auto pay|automatic payment|online (payment|pmt)|e-?payment|credit card (pmt|payment)|crcardpmt|card payment|epay|还款|信用卡还款|自动还款/i, "信用卡还款"],
  transfer: [/transfer|xfer|zelle|venmo|cash ?app|apple cash|wire|ach (credit|debit)|转账|汇款|转入|转出|财付通|支付宝|微信|\batm\b|取款|存款|withdrawal|\bdeposit\b/i, "转账 / 取现"],
};
const REFUND = /refund|return|reversal|credit adjustment|退款|退货|冲正/i;
const RULES = [
  ["bill_mortgage", /mortgage|mr\.? cooper|rocket mortgage|loancare|房贷/i], ["bill_rent", /\brent\b|apartments?\b|property management|房租|租金/i],
  ["bill_property_tax", /property tax|county treasurer|房产税/i], ["bill_income_tax", /\birs\b|usataxpymt|treas ?310|state tax|dept of revenue|个人所得税/i],
  ["bill_heating_oil", /heating oil|propane|ferrellgas|amerigas|取暖油/i], ["bill_solar", /sunrun|tesla energy|sunpower|solar/i], ["bill_storage", /public storage|extra space|cubesmart|life storage|储物/i], ["bill_pool", /pool (service|supply)|leslie'?s|泳池/i],
  ["bill_electric", /comed|pg&e|duke energy|con ?ed(ison)?|xcel energy|national grid|dte energy|国家电网|电费/i], ["bill_gas", /peoples gas|nicor|socalgas|atmos energy|燃气/i],
  ["bill_water", /water (dept|district|bill|utilit)|waste management|republic services|水费|自来水|垃圾/i], ["bill_internet", /xfinity|comcast|spectrum|frontier|google fiber|宽带/i],
  ["bill_mobile", /verizon|t-?mobile|mint mobile|visible|cricket wireless|at&t|中国移动|中国联通|中国电信|话费/i],
  ["bill_insurance_auto", /geico|progressive|state farm|allstate|liberty mutual|farmers ins|usaa|nationwide|车险/i],
  ["bill_subscription", /netflix|spotify|hulu|disney ?\+|disney plus|hbo|apple\.com\/bill|itunes|icloud|google (one|storage|youtube)|youtube ?(premium|tv)|openai|chatgpt|anthropic|claude\.ai|adobe|microsoft 365|dropbox|amazon prime|audible|paramount|peacock|会员|订阅/i],
  ["bill_donation", /donation|church|tithe|gofundme|red cross|unicef|捐款|教会|奉献/i], ["bill_tuition", /tuition|daycare|preschool|学费|托儿/i],
  ["bill_activities", /\bcamp\b|dance|piano|swim|gymnastics|karate|ymca|kumon|夏令营|兴趣班/i], ["bill_toll", /e-?zpass|ipass|sunpass|\btoll\b|过路费/i], ["life_transit", /parking|parkmobile|spothero|停车|uber|lyft|taxi|滴滴|打车|metra|\bcta\b|\bmta\b|bus pass|公交|地铁/i],
  ["pet_care", /\bvet\b|veterinar|animal hospital|兽医/i], ["pet", /petco|petsmart|chewy|宠物/i],
  // 加油排在超市 / 仓储超市关键词之前：COSTCO GAS、SAM'S FUEL、KROGER FUEL 是加油不是买菜——说明里带 gas / fuel 的都先算加油（燃气公司在更前面的账单规则里）
  ["vehicle_fuel", /shell|chevron|exxon|mobil\b|\bbp\b|speedway|sunoco|marathon|kwik trip|wawa|citgo|casey'?s|gas station|\bgas\b|gasoline|petrol|\bfuel\b|supercharg|electrify america|chargepoint|加油|油费|燃油|充电|洗车|car wash/i],
  ["vehicle_maint", /jiffy lube|valvoline|firestone|pep boys|autozone|o'?reilly|napa auto|midas|discount tire|auto repair|汽车维修|保养/i],
  ["house_maint", /home depot|lowe'?s|menards|ace hardware|家得宝/i],
  ["medical", /hospital|clinic|medical|dental|dentist|quest diag|labcorp|urgent care|physician|optom|医院|诊所|牙科|体检/i], ["health", /\bcvs\b|walgreens|rite aid|pharmacy|药房|药店/i],
  ["grocery_misc", /weee|sayweee|hmart|h-mart|yamibuy|亚米|costco|trader joe|whole foods|kroger|safeway|aldi|publix|wegmans|h ?mart|99 ranch|mitsuwa|jewel-?osco|mariano|meijer|food lion|giant|stop & shop|sprouts|\bheb\b|harris teeter|sam'?s club|instacart|超市|大华|永辉|盒马/i],
  ["life_dining", /restaurant|cafe|coffee|starbucks|dunkin|mcdonald|chipotle|chick-?fil|panda express|subway|domino|pizza|taco|burger|bbq|grill|sushi|ramen|doordash|uber ?eats|grubhub|bakery|boba|tea\b|餐厅|饭店|外卖|美团|饿了么|咖啡|奶茶|麦当劳|肯德基/i],
  ["gear_clothes", /nordstrom|macy|old navy|\bgap\b|h&m|zara|uniqlo|nike|adidas|lululemon|tj ?maxx|marshalls|\bross\b|kohl|carter'?s|children'?s place|服装|优衣库/i],
  ["life_care", /salon|barber|haircut|\bspa\b|nail|massage|sephora|ulta|beauty|waxing|理发|美容|美甲|按摩/i], ["life_fitness", /\bgym\b|fitness|peloton|yoga|crossfit|orangetheory|健身|瑜伽|游泳/i],
  ["life_fun", /cinema|\bamc\b|regal|movie|theater|theatre|steam|playstation|xbox|nintendo|ticketmaster|stubhub|bowling|arcade|museum|\bzoo\b|aquarium|电影|游戏|演出/i],
  ["life_gifts", /\bgift|florist|1-800-flowers|hallmark|party city|红包|礼物|礼金/i],
  ["gear_digital", /apple store|apple\.com|micro center|newegg|b&h|\bdell\b|lenovo|samsung|google store|数码|苹果/i], ["life_edu", /udemy|coursera|duolingo|khan|college board|课程/i], ["gear_study", /scholastic|barnes|bookstore|textbook|图书|书店/i],
  ["capital_home", /title (company|co\b|insurance)|first american|fidelity national title|chicago title|stewart title|closing (cost|fee)|settlement (statement|fee)|real estate attorney|realtor commission|earnest money|过户|契税|首付|房款|中介费|律师费.*(房|购)/i],
  ["life_gov", /\bdmv\b|secretary of state|\bsos\b|passport|vital records|county clerk|city clerk|citation|violation|court|turbotax|h&r block|freetaxusa|taxact|罚单|交警|车管所|护照|签证|出生证|公证|社保局|税务局/i],
  ["life_fees", /\bfee\b|interest charge|finance charge|annual membership|late fee|overdraft|foreign transaction|service charge|手续费|利息|年费|滞纳/i], ["life_mail", /usps|ups store|fedex|\bups\b|\bdhl\b|postage|快递|邮费|顺丰/i],
  ["life_shopping", /amazon|amzn|target|walmart|best ?buy|ikea|etsy|ebay|temu|shein|wayfair|淘宝|京东|拼多多|天猫/i],
];
const BANK_CAT = [[/grocer/i, "grocery_misc"], [/food|dining|restaurant/i, "life_dining"], [/gas|fuel/i, "vehicle_fuel"], [/automotive/i, "vehicle_maint"], [/travel|airline|hotel/i, "travel_other"],
  [/shopping|merchandise/i, "life_shopping"], [/health|medical|pharmacy/i, "health"], [/entertainment/i, "life_fun"], [/home|improvement/i, "house_maint"], [/personal|beauty/i, "life_care"],
  [/education|book/i, "life_edu"], [/fee|interest/i, "life_fees"], [/gift|donation|charit/i, "life_gifts"]];

const userRules = () => meta("_bank_rules", {}) || {};
/* 记住的规则：旧格式是 "商家": "分类"，新格式 "商家": { c: 分类, n: 用过几次, t: 最近用到的日期 }；两种都认。满 400 条时淘汰最久没用到的 */
const ruleCat = (v) => (typeof v === "string" ? v : v?.c || "");
const ruleUse = (v) => (typeof v === "string" ? { n: 0, t: "" } : { n: v?.n || 0, t: v?.t || "" });
const todayStr = () => new Date().toISOString().slice(0, 10);
/** 归类：你教过的 > 已有账单的收款方（金额也得像那条账单）> AI 给的 > 内置关键词（含旅行关键词）> 银行自带分类；都不认识返回 ""
 *  账单收款方那条原来太宽：Amazon Prime / Costco 会员建了账单后，所有 Amazon / Costco 的购物都被归成「会员」。
 *  现在要么金额和账单的通常金额对得上（±15%），要么这家商家内置关键词也认不出，才按账单归类 */
// 以前记住的规则是按老的商家名存的（带流水码，如「costco gas 0123」）；商家名清理规则改过之后对不上了——把老键按同样的清理再比一次
const normKey = (k) => String(k).split(" ").filter((w) => !/^\d+$/.test(w) && !(/\d/.test(w) && /[a-z]/i.test(w) && !/^\d+-[a-z]+$/i.test(w))).join(" ");
const learnedKey = (key) => { const rules = userRules(); return rules[key] ? key : Object.keys(rules).find((x) => normKey(x) === key) || ""; };
const learnedFor = (key) => { const k = learnedKey(key); return k ? ruleCat(userRules()[k]) : ""; };
/** 内置关键词（含旅行关键词）现在会给这家商家什么分类；认不出返回 "" */
const builtinCat = (key) => (RULES.find(([, re]) => re.test(key)) || [])[0] || TRIP.guess(key, "") || "";
/** 多余的规则：你记的分类和内置关键词现在给的一样（删了结果不变，还省名额） */
const redundantRules = () => Object.entries(userRules()).filter(([k, v]) => { const b = builtinCat(k); return b && canonCat(b) === canonCat(ruleCat(v)); }).map(([k]) => k);
/** 90 天没用到的规则（旧格式没有日期，没法判断，不算） */
const staleRules = () => { const cut = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10); return Object.entries(userRules()).filter(([, v]) => { const u = ruleUse(v); return u.t && u.t < cut; }).map(([k]) => k); };
export function classify(row) { return classifyWhy(row).cat; }
/** 同上，但带来源：learned（你教过的）/ bill / rule / ai / bank / ""。内置关键词认得的商家（Amazon、Costco、Shell…）优先于 AI 的猜测——AI 常把 Amazon 购物猜成会员 */
export function classifyWhy(row) {
  const key = keyOf(row.desc), d = row.desc.toLowerCase();
  const ur = learnedFor(key); if (ur) return { cat: canonCat(ur), src: "learned" };
  let rule = (RULES.find(([, re]) => re.test(row.desc)) || [])[0] || "";
  if (rule === "grocery_misc" && row.bankCat && /gas|fuel/i.test(row.bankCat)) rule = "vehicle_fuel";   // 银行自己标了 Gas：超市 / 仓储超市的加油站
  for (const b of (state.billsEnriched?.length ? state.billsEnriched : state.bills) || []) {
    const p = String(b.payee || b.name || "").toLowerCase(); if (p.length < 4 || !d.includes(p)) continue;
    const est = num(b.est ?? b.typical_amount, 0), amt = Math.abs(num(row.out, 0));
    const amtOk = est > 0 && Math.abs(amt - est) <= Math.max(2, est * 0.15);
    if (amtOk || !rule) return { cat: `bill_${b.category}`, src: "bill" };
  }
  if (rule) return { cat: rule, src: "rule" };
  if (row.aiCat) return { cat: row.aiCat, src: "ai" };   // AI 读对账单时给的分类（内置关键词认不出的商家才用它）
  const g = TRIP.guess(row.desc, "");   // 机票、酒店、长途车票、住宿、租车…（以及它顺带认得的加油、餐厅、门票、打车停车）
  if (g) return { cat: g, src: "rule" };
  if (row.bankCat) for (const [re, id] of BANK_CAT) if (re.test(row.bankCat)) return { cat: id, src: "bank" };
  return { cat: "", src: "" };
}

/* ───────────── 把表格变成交易行 ───────────── */
const S = { parts: [], auto: {}, account: { mode: "none", id: "", name: "", last4: "" }, acctTouched: false, spendSign: "auto", autoSign: "pos", dmy: false, currency: "", rows: [], groups: [], pick: {}, include: {}, remember: true, last: null, busy: false, status: "", error: "", batchAcct: "all", batchShow: 20 };   // batchAcct / batchShow：「最近导入」列表的账户筛选和已展开的条数（重画也不丢）
const cur = () => S.currency || Units.region.currency;
let askFn = askText;   // 测试时可替换
export const _setAsk = (fn) => { askFn = fn || askText; };

/* 一个文件 = 一个 part：表格类（CSV / Excel）带列对应，其余直接是交易行 */
function tablePart(name, kind, rows) {
  const hi = headerIndex(rows);
  if (hi < 0) return { name, kind, table: { headers: rows[0] || [], body: rows.slice(1), map: { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, category: -1, type: -1 } }, rows: [], error: t("没认出日期和金额这两列，请在下面手动选一下对应的列。") };
  const headers = rows[hi], body = rows.slice(hi + 1), map = detect(headers);
  // 斜杠日期里有大于 12 的第一段 → 日 / 月 / 年
  const firsts = body.slice(0, 200).map((r) => (r[map.date] || "").match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/)).filter(Boolean).map((m) => [+m[1], +m[2]]);
  if (firsts.some(([a]) => a > 12) && !firsts.some(([, b]) => b > 12)) S.dmy = true;
  return { name, kind, table: { headers, body, map }, rows: [] };
}
function tableRows(part) {
  const { map, body } = part.table, rows = [], cell = (r, i) => (i >= 0 ? r[i] : "");
  if (map.date < 0 || (map.amount < 0 && map.debit < 0 && map.credit < 0)) return rows;
  // 金额正负：一列金额时看哪一边占多数（支出多于入账）；借 / 贷两列时借方 = 支出
  let sign = S.spendSign;
  if (sign === "auto" && map.amount >= 0) { const v = body.map((r) => parseAmount(cell(r, map.amount))).filter((x) => x != null && x !== 0); sign = v.filter((x) => x < 0).length >= v.length / 2 ? "neg" : "pos"; }
  part.autoSign = sign;
  for (const r of body) {
    const date = parseDate(cell(r, map.date), S.dmy ? "dmy" : "mdy"), desc = cell(r, map.desc);
    if (!date) continue;
    let out;
    if (map.amount >= 0) { const a = parseAmount(cell(r, map.amount)); if (a == null) continue; out = sign === "neg" ? -a : a; }
    else { const dr = parseAmount(cell(r, map.debit)), cr = parseAmount(cell(r, map.credit)); if (dr == null && cr == null) continue; out = Math.abs(dr || 0) - Math.abs(cr || 0); }
    if (!out) continue;
    rows.push({ date, desc: desc || "(无说明)", out: Math.round(out * 100) / 100, bankCat: cell(r, map.category), type: cell(r, map.type) });
  }
  return rows;
}

const IMG_EXT = /\.(png|jpe?g|webp|heic|heif|gif|bmp)$/i;
async function readPart(file) {
  const name = file.name, ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf" || file.type === "application/pdf") {
    const buf = await file.arrayBuffer(), { lines, pages } = await pdfLines(buf), hasText = lines.some((l) => l.trim().length > 3);
    return { name, kind: "pdf", lines, pages, buf, scan: !hasText, rows: hasText ? parseStatementLines(lines) : [], local: hasText, totals: hasText ? statementTotals(lines) : null, acct: detectAccount(name, lines) };
  }
  if (IMG_EXT.test(name) || file.type.startsWith("image/")) return { name, kind: "image", file, rows: [], scan: true, acct: detectAccount(name) };
  if (ext === "xlsx" || ext === "xls") return { ...tablePart(name, "xlsx", await readXLSX(await file.arrayBuffer())), acct: detectAccount(name) };
  const text = decode(await file.arrayBuffer());
  if (looksOFX(text)) { const rows = readOFX(text); return { name, kind: "ofx", rows, acct: { ...detectAccount(name), last4: readOFX.lastAcct || detectAccount(name).last4 } }; }
  if (looksQIF(text)) return { name, kind: "qif", rows: readQIF(text), acct: detectAccount(name) };
  return { ...tablePart(name, "csv", parseCSV(text)), acct: detectAccount(name) };
}
/** 粘贴的文字：像表格（有表头）就当表格，否则当对账单文字行 */
function pastePart(text) {
  const rows = parseCSV(text);
  if (headerIndex(rows) >= 0) return tablePart(t("粘贴的文字"), "paste", rows);
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (looksOFX(text)) return { name: t("粘贴的文字"), kind: "ofx", rows: readOFX(text) };
  return { name: t("粘贴的文字"), kind: "paste", lines, rows: parseStatementLines(lines), local: true, totals: statementTotals(lines), acct: detectAccount("", lines) };
}

/** 所有 part 的行合并 → 判跳过 / 归类 / 查重 / 按商家合并 */
function rebuild() {
  const all = [];
  for (const p of S.parts) { if (p.table) p.rows = tableRows(p); all.push(...p.rows); }
  const single = S.parts.length === 1 && S.parts[0].table ? S.parts[0] : null; S.autoSign = single?.autoSign || S.autoSign;
  const rows = [];
  for (const r0 of all) {
    const row = { ...r0, skip: "" }, typeTxt = `${row.type} ${row.desc}`;
    if (row.kind === "card_payment" || SKIP.card_payment[0].test(typeTxt) || /^payment$/i.test(row.type)) row.skip = "card_payment";
    else if (row.kind === "transfer" || SKIP.transfer[0].test(typeTxt)) row.skip = "transfer";
    else if (row.kind === "income") row.skip = "income";
    else if (row.out < 0) row.skip = row.kind === "refund" || REFUND.test(typeTxt) ? "" : "income";   // 入账：退款算（负花费），其余是收入
    row.refund = row.out < 0 && !row.skip;
    row.key = keyOf(row.desc); const cw = row.skip ? { cat: "", src: "" } : classifyWhy(row); row.cat = cw.cat; row.src = cw.src;
    rows.push(row);
  }
  // 和已有花费对得上的（金额一样、日期差 ≤ 3 天，每条已有花费只配一次）：疑似已记录，默认跳过；重复导入同一个文件也靠它防重
  const pool = state.purchases.filter((p) => !p.virtual && p.amount != null).map((p) => ({ a: Math.round(num(p.amount) * 100) / 100, t: new Date(p.purchased_at).getTime(), used: false }));
  for (const r of rows) {
    if (r.skip) continue;
    const tm = new Date(`${r.date}T12:00:00`).getTime();
    const hit = pool.find((p) => !p.used && Math.abs(p.a - r.out) < 0.005 && Math.abs(p.t - tm) <= 3.5 * 864e5);
    if (hit) { hit.used = true; r.dup = true; }
  }
  S.rows = rows;
  const g = new Map();
  for (const r of rows) {
    const id = r.skip ? `__${r.skip}` : r.key;
    const x = g.get(id) || { id, name: r.skip ? t(SKIP[r.skip]?.[1] || "收入 / 入账") : merchantName(r.desc), skip: r.skip, rows: [], total: 0 };
    x.rows.push(r); x.total += r.out; g.set(id, x);
  }
  S.groups = [...g.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  for (const x of S.groups) { x.src = x.rows[0].src || ""; if (!(x.id in S.auto)) S.auto[x.id] = x.skip ? "" : x.rows[0].cat; if (!(x.id in S.pick)) S.pick[x.id] = x.skip ? "" : x.rows[0].cat; if (!(x.id in S.include)) S.include[x.id] = !x.skip; }
}
const resetPicks = () => { S.pick = {}; S.include = {}; S.auto = {}; };

/* ───────────── 账户（哪张卡 / 哪个账户）：每批导入记一个标签，用来看“哪个账户哪几个月已经补过” ─────────────
 * 账户列表 = 以前导入时建的（预算设置 _bank_accounts）+ 账单里有账号尾号 / 信用卡类的账单。不改数据库、不记到每一笔上。 */
export function accounts() {
  const icon = { checking: "🏦 ", savings: "🏦 ", wallet: "📱 " };
  const cards = (state.cards || []).filter((c) => c.active !== false).map((c) => ({ id: `card:${c.id}`, name: `${icon[c.kind] || ""}${c.name}`, last4: c.last4 || "", src: "card" }));   // 用卡模块里的卡：选它，这批花费就记到这张卡上
  const own = (meta("_bank_accounts", []) || []).filter((a) => !(a.last4 && cards.some((c) => c.last4 === a.last4))).map((a) => ({ ...a, src: "own" }));
  const bills = (state.bills || []).filter((b) => b.category === "credit_card" || b.account_last4).map((b) => ({ id: `bill:${b.id}`, name: b.name, last4: String(b.account_last4 || "").slice(-4), src: "bill" }));
  const seen = new Set([...cards, ...own].map((a) => a.last4).filter(Boolean));
  return [...cards, ...own, ...bills.filter((b) => !(b.last4 && seen.has(b.last4)))];
}
/** 文件里认出的发卡行 / 末四位 → 对上已有账户就选它，否则预填一个新账户名；用户动过选择就不再改 */
function suggestAccount() {
  if (S.acctTouched) return;
  const hints = S.parts.map((x) => x.acct).filter(Boolean), last4 = hints.map((h) => h.last4).find(Boolean) || "", issuer = hints.map((h) => h.issuer).find(Boolean) || "";
  const list = accounts(), hit = last4 ? list.find((a) => a.last4 === last4) : null;
  if (hit) S.account = { mode: "id", id: hit.id, name: hit.name, last4: hit.last4 };
  else if (last4 || issuer) S.account = { mode: "new", id: "", name: `${issuer || t("银行卡")}${last4 ? ` ••${last4}` : ""}`, last4 };
  else if (S.account.mode === "new") S.account = { mode: "none", id: "", name: "", last4: "" };
}
function accountHtml() {
  const list = accounts(), a = S.account;
  const opt = (v, label, on) => `<option value="${esc(v)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  return `<div class="bank-acct"><label>${t("这批是哪个账户的")}<select data-bank-acct>${opt("none", t("（不记账户）"), a.mode === "none")}${list.map((x) => opt(x.id, `${x.name}${x.last4 && !x.name.includes(x.last4) ? ` ••${x.last4}` : ""}`, a.mode === "id" && a.id === x.id)).join("")}${opt("new", t("新账户…"), a.mode === "new")}</select></label>
    ${a.mode === "new" ? `<label>${t("账户名")}<input data-bank-acct-name maxlength="40" value="${esc(a.name)}" placeholder="${esc(t("例如 Chase Freedom ••1234"))}"></label>` : ""}
    <small class="muted">${t("记在这批导入上（不记到每一笔花费上），用来看哪个账户哪几个月已经补过。")}</small></div>`;
}
/** 对账单合计 vs 读出来的：差太多就提示可能漏读 */
function reconcileHtml(p) {
  const tt = p.totals; if (!tt || tt.purchases == null || !p.rows.length) return "";
  const stated = Math.round((tt.purchases + (tt.fees || 0) + (tt.interest || 0)) * 100) / 100;
  const read = Math.round(p.rows.filter((r) => r.out > 0).reduce((s, r) => s + r.out, 0) * 100) / 100, diff = Math.round((stated - read) * 100) / 100;
  return Math.abs(diff) < 0.015 ? ` · <span style="color:var(--ok)">✓ ${t("和对账单合计对上")}</span>` : ` · <b class="bank-dup">${t("对账单写的消费 {a}（含手续费 / 利息），读出 {b}，差 {d}——可能漏读或多读了几行，核对一下或用 AI 解析", { a: money(stated), b: money(read), d: money(diff) })}</b>`;
}
const monthsBetween = (a, b) => { const out = []; let [y, m] = String(a).slice(0, 7).split("-").map(Number); const end = String(b).slice(0, 7); for (let i = 0; i < 60; i++) { const k = `${y}-${String(m).padStart(2, "0")}`; out.push(k); if (k >= end) break; if (++m > 12) { m = 1; y++; } } return out; };
/** 覆盖表：每个账户最近 12 个月哪些已经导过（按每批的日期范围算） */
function coverageHtml(batches) {
  const withAcct = batches.filter((b) => b.account && b.from && b.to); if (!withAcct.length) return "";
  const now = new Date(), months = []; for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  const by = new Map();
  for (const b of withAcct) { const set = by.get(b.account) || new Set(); monthsBetween(b.from, b.to).forEach((k) => set.add(k)); by.set(b.account, set); }
  const rows = [...by.entries()].map(([name, set]) => { const first = months.findIndex((k) => set.has(k)); const gaps = months.filter((k, i) => first >= 0 && i > first && i < months.length - 1 && !set.has(k)).length;
    return `<tr><th scope="row">${esc(name)}${gaps ? ` <small class="bank-dup">${t("缺 {n} 个月", { n: gaps })}</small>` : ""}</th>${months.map((k) => `<td class="${set.has(k) ? "on" : ""}" title="${k}">${set.has(k) ? "✓" : "·"}</td>`).join("")}</tr>`; });
  return `<div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("各账户已补到哪个月")}</h3><div class="ch-scroll"><table class="cover-table"><thead><tr><th></th>${months.map((k) => `<th>${k.slice(5)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <p class="muted" style="margin:6px 0 0;font-size:12.5px">${t("按每批导入的交易日期范围算；中间空着的月份就是还没补的。只看最近 12 个月。")}</p></div>`;
}

async function ingest(files) {
  S.error = ""; S.last = null;
  for (const f of files) {
    try { S.parts.push(await readPart(f)); }
    catch (err) { S.error = t("读不了 {name}：{msg}", { name: f.name, msg: err.message }); }
  }
  suggestAccount(); resetPicks(); rebuild();
}

/* ───────────── AI 解析（PDF 对账单 / 截图 / 扫描件 / 粘贴的文字） ───────────── */
const catalog = () => {
  const cats = [...window.CATEGORIES.filter((c) => c.space === "pantry" || c.space === "gear"), window.GROCERY_MISC, ...window.LIFE_CATS, ...window.WORK_CATS, window.VEHICLE_FUEL, { id: "vehicle_maint", name: "车辆维修保养" }, window.MAINT_CAT, ...window.TRAVEL_CATS, ...window.BILLS_GROUP.cats(), { id: "medical", name: "医疗" }, { id: "pet_care", name: "宠物医疗 / 服务" }];
  return { text: cats.map((c) => `${c.id}=${t(c.name)}`).join("; "), ids: new Set(cats.map((c) => c.id)) };
};
async function aiParse(i) {
  const p = S.parts[i]; if (!p || S.busy) return;
  if (!aiReady()) return toast(t("还没填 API key，去 设置 → AI 助手 填一个（Gemini 有免费额度）"));
  const s = aiSettings(), prov = t(providerOf(s.provider).name), imagesMode = p.scan || p.kind === "image";
  if (imagesMode && !visionCapable(providerOf(s.provider))) return toast(t("{p} 不能读图片，这份文件需要能读图的模型（Gemini 可以）", { p: prov }));
  const warn = imagesMode ? t("这份文件是图片 / 扫描件，会把页面图片原样发给 {p}（可能含姓名、账号等）。继续？", { p: prov })
    : t("将把这份对账单里带日期或金额的行（已抹掉账号、卡号、邮箱、电话，没有姓名和地址）发给 {p} 来识别交易。继续？", { p: prov });
  if (!confirm(warn)) return;
  S.busy = true; S.error = ""; const { text, ids } = catalog(); let rows = [];
  try {
    if (imagesMode) {
      const imgs = p.kind === "image" ? [await compressImage(p.file, 1800)] : await pdfImages(p.buf, 8);
      for (let k = 0; k < imgs.length; k++) { S.status = t("AI 正在读第 {i} / {n} 页…", { i: k + 1, n: imgs.length }); redraw(); rows.push(...await aiExtract({ images: [imgs[k]], categories: text, ask: askFn, validIds: ids, hint: p.name })); }
    } else {
      const chunks = chunkLines(redactLines(p.lines || []));
      for (let k = 0; k < chunks.length; k++) { S.status = t("AI 正在读第 {i} / {n} 段…", { i: k + 1, n: chunks.length }); redraw(); rows.push(...await aiExtract({ lines: chunks[k], categories: text, ask: askFn, validIds: ids, hint: p.name })); }
    }
    p.rows = rows; p.ai = true; p.scan = false; resetPicks(); rebuild();
    S.status = ""; toast(rows.length ? t("AI 读出 {n} 笔交易，请核对", { n: rows.length }) : t("AI 没读出交易，换个文件或手动用 CSV 导入"));
  } catch (err) { S.error = t("AI 解析失败：{msg}", { msg: err.message }); S.status = ""; }
  S.busy = false; redraw();
}

/* ───────────── 界面 ───────────── */
const rangeOf = (rows) => { const d = rows.map((r) => r.date).sort(); return d.length ? `${d[0]} → ${d.at(-1)}` : ""; };
const catOpts = (sel) => {
  const own = (cats) => cats.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${c.icon} ${esc(t(c.name))}</option>`).join("");
  const bills = window.BILLS_GROUP.cats().map((c) => ({ ...c, name: c.name }));
  return `<option value="" ${!sel ? "selected" : ""}>${esc(t("— 请选择 —"))}</option>${categoryOptions(sel, { withOther: true, spend: true })}
    <optgroup label="${esc(t("账单"))}">${own(bills)}</optgroup><optgroup label="${esc(t("其他"))}">${own([window.MEDICAL_GROUP, { id: "pet_care", name: "宠物医疗 / 服务", icon: "🐾" }])}</optgroup>`;
};
function groupRow(g) {
  const inc = !!S.include[g.id], dups = g.rows.filter((r) => r.dup).length, n = g.rows.length;
  const sel = `<select data-bank-cat="${esc(g.id)}" aria-label="${esc(t("分类"))}">${catOpts(S.pick[g.id])}</select>`;   // 默认跳过的也能勾上、选个分类导入
  return `<li class="bank-row${g.skip ? " is-skip" : ""}"><label class="bank-chk"><input type="checkbox" data-bank-inc="${esc(g.id)}" ${inc ? "checked" : ""} aria-label="${esc(t("导入"))}"></label>
    <div class="grow"><span class="name">${esc(g.name)}</span><small>${t("{n} 笔", { n })} · ${money(g.total)} · ${esc(rangeOf(g.rows))}${g.src === "learned" ? ` · <span class="bank-src" title="${esc(t("上次你给这家选的分类；改了会记住新的"))}">${t("上次你选的")}</span>` : g.src === "ai" ? ` · <span class="bank-src">${t("AI 猜的")}</span>` : g.src === "bill" ? ` · <span class="bank-src">${t("按账单收款方")}</span>` : ""}${dups ? ` · <b class="bank-dup">${t("{k} 笔疑似已记录，会跳过", { k: dups })}</b>` : ""}</small></div>${sel}</li>`;
}
const chosen = () => {
  let n = 0, sum = 0;
  for (const g of S.groups) { if (!S.include[g.id] || !S.pick[g.id]) continue; for (const r of g.rows) { if (r.dup) continue; n++; sum += r.out; } }
  return { n, sum };
};
const KIND_ICON = { csv: "📄", xlsx: "📊", ofx: "🏦", qif: "🏦", pdf: "📕", image: "🖼️", paste: "📋" };
/** 这个文件里交易日期的范围；跨度超过一年的，标出落在「主要那一年」之外的笔数（年份读错的典型症状） */
function spanOf(p) {
  const rows = p.table ? tableRows(p) : p.rows; if (!rows.length) return "";
  const ds = rows.map((r) => r.date).sort(), from = ds[0], to = ds.at(-1), span = (new Date(to) - new Date(from)) / 864e5;
  if (span <= 366) return ` · ${esc(from)} → ${esc(to)}`;
  const cnt = {}; ds.forEach((d) => { cnt[d.slice(0, 4)] = (cnt[d.slice(0, 4)] || 0) + 1; });
  const [main, nMain] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return ` · <b class="bank-dup">${t("日期 {a} → {b}，有 {n} 笔不在 {y} 年：如果这是一份 {y} 年的对账单，多半是年份读错了——检查文件，或用 AI 重新解析（也可以导入后在「查看 / 修改」里改）", { a: from, b: to, n: ds.length - nMain, y: main })}</b>`;
}
function partsHtml() {
  if (!S.parts.length) return "";
  const ai = aiReady(), needsAiHint = S.parts.some((p) => ["pdf", "image", "paste"].includes(p.kind));
  return `<ul class="restock-list bank-parts">${S.parts.map((p, i) => {
    const how = p.ai ? t("AI 解析") : p.local ? t("本地规则") : p.table ? t("表格") : ["ofx", "qif"].includes(p.kind) ? p.kind.toUpperCase() : "";
    const canAi = ["pdf", "image", "paste"].includes(p.kind);
    return `<li><div class="grow"><span class="name">${KIND_ICON[p.kind] || "📄"} ${esc(p.name)}</span><small>${p.scan ? t("没有文字层的扫描件 / 图片，需要 AI 才能读") : t("读出 {n} 笔", { n: p.rows.length })}${how ? ` · ${how}` : ""}${p.pages ? ` · ${t("{n} 页", { n: p.pages })}` : ""}${p.scan ? "" : spanOf(p)}${reconcileHtml(p)}${p.error ? ` · <b class="bank-dup">${esc(p.error)}</b>` : ""}</small></div>
      ${canAi ? `<button type="button" class="btn btn-sm ${p.scan ? "" : "btn-ghost"}" data-bank-act="ai" data-i="${i}" ${S.busy ? "disabled" : ""}>${p.ai ? t("用 AI 重新解析") : t("用 AI 解析")}</button>` : ""}
      <button type="button" class="btn btn-sm btn-ghost" data-bank-act="rm" data-i="${i}" aria-label="${esc(t("移除"))}">✕</button></li>`;
  }).join("")}</ul>${needsAiHint && !ai ? `<p class="muted" style="font-size:13px;margin:6px 0 0">${t("PDF / 截图本地规则读不准或读不了时，可以用 AI 解析：到 设置 → AI 助手 填 key（Gemini 有免费额度）。")}</p>` : ""}
    ${S.status ? `<p role="status" class="muted" style="margin:6px 0 0">${esc(S.status)}</p>` : ""}`;
}
function panelHtml() {
  const hasRows = S.groups.length > 0, batches = meta("_bank_batches", []) || [];
  const head = `<div class="panel bank-pick"><p style="margin:0 0 8px">${t("从银行或信用卡网站下载对账单，选中文件：支持 CSV、Excel、OFX / QFX、QIF，以及 PDF 月结单、截图（PDF 先用本地规则读，读不准再用 AI）。可以一次选多个月。文件只在你的浏览器里处理；只有你点“用 AI 解析”才会把内容发给你设置的模型。")}</p>
    <label class="btn btn-primary btn-sm" style="cursor:pointer">${t("选择文件（可多选）")}<input type="file" id="bankFile" multiple accept=".csv,.tsv,.txt,.xlsx,.xls,.ofx,.qfx,.qif,.pdf,image/*,text/csv,text/plain,application/pdf" hidden></label>
    <details class="bank-paste" style="margin-top:8px"><summary>${t("或者直接粘贴文字")}</summary><textarea id="bankPaste" rows="5" placeholder="${esc(t("把网银页面或 PDF 里的交易几行直接复制粘贴到这里"))}" style="margin-top:6px"></textarea>
      <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-sm" data-bank-act="paste">${t("读取这段文字")}</button></div></details>
    ${partsHtml()}${S.parts.length ? accountHtml() : ""}${S.error ? `<p class="form-error" role="alert">${esc(S.error)}</p>` : ""}</div>`;
  if (!S.parts.length) return head + tipsHtml() + rulesHtml() + batchesHtml(batches);
  const tp = S.parts.length === 1 && S.parts[0].table ? S.parts[0].table : null;
  let mapping = "";
  if (tp) {
    const opt = (i, cur2, none) => `<option value="${i}" ${cur2 === i ? "selected" : ""}>${i < 0 ? esc(none || t("（无）")) : esc(tp.headers[i] || `#${i + 1}`)}</option>`;
    const cols = (key, label, none) => `<label>${label}<select data-bank-col="${key}" data-nosearch>${[-1, ...tp.headers.map((_, i) => i)].map((i) => opt(i, tp.map[key], none)).join("")}</select></label>`;
    mapping = `<details class="panel bank-map"${S.parts[0].error ? " open" : ""}><summary>${t("认出的列对不对？{n} 行，{range}", { n: S.rows.length, range: rangeOf(S.rows) })}</summary>
    <div class="form-grid" style="margin-top:8px">${cols("date", t("日期"))}${cols("desc", t("商家 / 说明"))}${cols("amount", t("金额（一列）"))}${cols("debit", t("支出（借方）"))}${cols("credit", t("收入（贷方）"))}
      <label>${t("支出的正负")}<select data-bank-sign><option value="auto" ${S.spendSign === "auto" ? "selected" : ""}>${t("自动判断")}（${S.autoSign === "neg" ? t("支出是负数") : t("支出是正数")}）</option><option value="neg" ${S.spendSign === "neg" ? "selected" : ""}>${t("支出是负数")}</option><option value="pos" ${S.spendSign === "pos" ? "selected" : ""}>${t("支出是正数")}</option></select></label>
      <label>${t("日期顺序")}<select data-bank-dmy><option value="mdy" ${!S.dmy ? "selected" : ""}>${t("月/日/年")}</option><option value="dmy" ${S.dmy ? "selected" : ""}>${t("日/月/年")}</option></select></label></div></details>`;
  }
  if (!hasRows) return head + mapping;
  const todo = S.groups.filter((g) => !g.skip && !S.pick[g.id]), auto = S.groups.filter((g) => !g.skip && S.pick[g.id]), skipped = S.groups.filter((g) => g.skip);
  const c = chosen();
  return `${head}${mapping}
    <div class="panel bank-sum"><b>${t("将导入 {n} 笔，合计 {m}", { n: c.n, m: money(c.sum) })}</b><div class="muted" style="font-size:13px">${t("信用卡还款、转账、收入默认不导入（不是花费）；和已有花费对得上的会自动跳过。")}</div></div>
    ${todo.length ? `<section class="section"><div class="section-head"><h2>${t("请归类")}（${todo.length}）</h2><p>${t("按商家合并，选一次就管这个商家的所有笔。认不出的不选就不会导入。")}</p></div><div class="panel"><ul class="restock-list bank-list">${todo.map(groupRow).join("")}</ul></div></section>` : ""}
    ${auto.length ? `<section class="section"><details class="ref-panel panel" ${todo.length ? "" : "open"}><summary><b>${t("已自动归类")}</b><small>${t("{n} 个商家，可以改", { n: auto.length })}</small><span class="mch" aria-hidden="true">›</span></summary><ul class="restock-list bank-list ref-body">${auto.map(groupRow).join("")}</ul></details></section>` : ""}
    ${skipped.length ? `<section class="section"><details class="ref-panel panel"><summary><b>${t("默认跳过")}</b><small>${t("还款 / 转账 / 收入")}</small><span class="mch" aria-hidden="true">›</span></summary><ul class="restock-list bank-list ref-body">${skipped.map(groupRow).join("")}</ul></details></section>` : ""}
    <div class="panel bank-go"><label class="check-inline"><input type="checkbox" data-bank-remember ${S.remember ? "checked" : ""}><span>${t("记住我选的归类（下次同一商家自动归类，全家共用）")}</span></label>
      <div class="form-actions"><button type="button" class="btn btn-primary" data-bank-act="import" ${c.n && !S.busy ? "" : "disabled"}>${S.busy ? t("导入中…") : t("导入 {n} 笔", { n: c.n })}</button></div></div>
    ${S.last ? `<div class="panel" role="status"><b>${t("已导入 {n} 笔，合计 {m}", { n: S.last.n, m: money(S.last.sum) })}</b> <button type="button" class="btn btn-sm btn-ghost" data-bank-act="undo-last">${t("撤销这批")}</button></div>` : ""}
    ${batchesHtml(batches)}`;
}
/** 记住的归类规则：列出来、可逐条删或全部清除（归错了一次又勾了「记住」，不清掉会一直错） */
function rulesHtml() {
  const rules = userRules(), keys = Object.keys(rules); if (!keys.length) return "";
  const nameOf = (id) => { const c = [...window.CATEGORIES, ...window.BILLS_GROUP.cats(), ...window.LIFE_CATS, ...window.WORK_CATS, ...window.TRAVEL_CATS, window.GROCERY_MISC, window.VEHICLE_FUEL, window.MAINT_CAT, window.VEHICLE_CAT, window.MEDICAL_GROUP, { id: "pet_care", name: "宠物医疗 / 服务", icon: "🐾" }, window.OTHER_CAT].find((x) => x && x.id === id); return c ? `${c.icon} ${t(c.name)}` : id; };
  return `<details class="ref-panel panel" style="margin-top:10px"><summary><b>${t("记住的归类")}</b><small>${t("{n} 家商家", { n: keys.length })}</small><span class="mch" aria-hidden="true">›</span></summary>
    <div class="ref-body"><p class="muted" style="margin:0 0 6px;font-size:12.5px">${t("导入时勾了「记住我选的归类」后，这些商家下次自动按这里归。归错了就删掉这一条（或在导入清单里改选，会记住新的）。")}</p>
    <ul class="restock-list">${keys.sort((a, b) => ruleUse(rules[b]).t.localeCompare(ruleUse(rules[a]).t) || a.localeCompare(b)).map((k) => { const u = ruleUse(rules[k]); return `<li><div class="grow"><span class="name">${esc(k)}</span><small>${esc(nameOf(ruleCat(rules[k])))}${u.t ? ` · ${t("用过 {n} 次 · 最近 {d}", { n: u.n, d: u.t })}` : ""}</small></div><button type="button" class="btn btn-sm btn-ghost" data-bank-act="rule-del" data-key="${esc(k)}" aria-label="${esc(t("删除这条"))}">✕</button></li>`; }).join("")}</ul>
    <div class="form-actions" style="margin-top:8px">${redundantRules().length ? `<button type="button" class="btn btn-sm" data-bank-act="rules-tidy" title="${esc(t("你记的分类和内置关键词现在给的一样，删了结果不变"))}">${t("清理多余规则（{n}）", { n: redundantRules().length })}</button>` : ""}${staleRules().length ? `<button type="button" class="btn btn-sm btn-ghost" data-bank-act="rules-stale">${t("清理 90 天没用到的（{n}）", { n: staleRules().length })}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-bank-act="rules-clear">${t("全部清除")}</button></div>
    <p class="muted" style="margin:6px 0 0;font-size:12px">${t("最多记 400 条，满了先淘汰最久没用到的。")}</p></div></details>`;
}
const tipsHtml = () => `<div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("怎么归类？")}</h3><ul class="plain small" style="margin:0">
    <li>${t("只有一笔刷卡 / 扣款、没有小票也没关系：按商家名自动归类（超市、餐饮、加油、水电网、订阅、机票酒店…），认不出的你选一次，之后记住。")}</li>
    <li>${t("信用卡还款、账户之间转账、工资入账不是花费，默认跳过——否则会重复算一遍。")}</li>
    <li>${t("分类怎么选：买回家吃的、用的（会用完）→ 日常储备；买回家长期用的 → 装备；花钱买体验或服务、没有东西留在家里 → 外出与服务。银行流水里看不出买了什么的，超市算“超市杂货”（归日常储备），网购算“网购 / 综合购物（未细分）”。")}</li>
    <li>${t("退款（卡上入账的退货）会记成负数花费，统计按净额算。")}</li>
    <li>${t("以前已经手动记过的花费（日期差 3 天内、金额一样）自动跳过，所以同一个文件导两次也不会重复。")}</li>
    <li>${t("导入错了可以整批撤销。银行的 CSV 格式很多，列认错了可以手动选；国内银行的 GBK 编码也认得。")}</li></ul></div>`;
const batchRow = (b) => { const can = (b.tagged && b.n !== 0) || b.ids?.length; return `<li><div class="grow"><span class="name">${b.account ? `🏦 ${esc(b.account)}` : esc(b.file || t("银行导入"))}</span><small>${b.from ? `${esc(b.from)} → ${esc(b.to)} · ` : ""}${t("{n} 笔", { n: b.n ?? b.ids?.length ?? 0 })} · ${money(b.sum || 0)} · ${t("导入于 {d}", { d: String(b.at).slice(0, 10) })}${b.account && b.file ? ` · ${esc(b.file)}` : ""}${can ? "" : ` · ${b.n === 0 ? t("（都是已记录过的，只更新了补到哪个月）") : t("（早期批次，只留了汇总）")}`}</small></div>${can ? `<a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}?tab=records&batch=${esc(b.id)}">${t("查看 / 修改")}</a><button type="button" class="btn btn-sm btn-ghost" data-bank-act="undo" data-batch="${esc(b.id)}">${t("撤销")}</button>` : ""}</li>`;};
const batchAcctKey = (b) => (b.account ? `${b.account}${b.last4 ? ` ····${b.last4}` : ""}` : "");
const batchesHtml = (batches) => {
  const lost = batches.filter((b) => !b.tagged && !b.ids?.length).length;   // 早期批次：没有批次标记、花费 id 列表也被丢掉了
  const accts = [...new Set(batches.map(batchAcctKey).filter(Boolean))].sort(), hasNone = batches.some((b) => !batchAcctKey(b));
  if (S.batchAcct !== "all" && S.batchAcct !== "__none__" && !accts.includes(S.batchAcct)) S.batchAcct = "all";
  const all = batches.slice().reverse().filter((b) => S.batchAcct === "all" || (S.batchAcct === "__none__" ? !batchAcctKey(b) : batchAcctKey(b) === S.batchAcct));
  const head = all.slice(0, S.batchShow), rest = all.length - head.length;   // 默认最多 20 批，点「再看 20 批」继续（账户下拉和展开条数记在 S 里，重画不会收回去）
  const opt = (v, l) => `<option value="${esc(v)}" ${S.batchAcct === v ? "selected" : ""}>${esc(l)}</option>`;
  const recover = `<p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("以前导入过、这里却没有的批次（记录丢了或迁移前导入的）：")}<button type="button" class="btn btn-sm btn-ghost" data-bank-act="recover" style="margin-left:4px">${t("找回批次")}</button></p>`;
  if (!batches.length) return `<section class="section"><div class="panel">${recover}</div></section>`;
  return `<section class="section"><div class="section-head"><h2>${t("最近导入")}</h2><p>${t("「查看 / 修改」打开这一批的明细，每一笔都能改分类、金额、商店或删掉；「撤销」整批删除。")}</p></div>${coverageHtml(batches)}<div class="panel" style="margin-top:10px">${lost ? `<div class="notice" role="status" style="margin-bottom:8px"><b>${t("有 {n} 批早期导入只留了汇总，不能查看 / 修改 / 撤销。", { n: lost })}</b><br><small>${t("这是迁移 034 之前导入的（那时只保留最近 6 批的明细）。先在 Supabase 执行 034_purchase_import_batch.sql，再点下面的按钮：按导入时间和笔数把它们的花费找回来、补上批次标记，之后和新的批次一样。笔数对不上的会跳过，不会乱标。")}</small><div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-sm" data-bank-act="recover">${t("找回早期批次")}</button></div></div>` : ""}
    ${accts.length > 1 || hasNone ? `<div class="bank-acct-bar"><span class="bab-ico" aria-hidden="true">🏦</span><select data-bank-batch-acct aria-label="${esc(t("按账户筛选"))}">${opt("all", t("全部账户（{n} 批）", { n: batches.length }))}${accts.map((a) => opt(a, a)).join("")}${hasNone ? opt("__none__", t("没记账户")) : ""}</select></div>` : ""}
    <ul class="restock-list bank-batches">${head.map(batchRow).join("")}</ul>
    ${rest ? `<div class="form-actions" style="justify-content:center;margin-top:8px"><button type="button" class="btn btn-ghost btn-sm" data-bank-act="batches-more">${t("再看 {n} 批（还有 {m} 批）", { n: Math.min(20, rest), m: rest })}</button></div>` : ""}
    ${lost ? "" : recover}</div></section>`;
};

export function bankImportTab() { return `<section class="section" id="bankImport">${panelHtml()}</section>`; }
const redraw = () => { const el = document.getElementById("bankImport"); if (el) el.innerHTML = panelHtml(); };

/* ───────────── 导入 / 撤销 ───────────── */
async function doImport() {
  if (S.busy) return; S.busy = true; redraw();
  const picks = [], learned = {}, hits = {};
  for (const g of S.groups) {
    if (!S.include[g.id]) continue; const cat = S.pick[g.id]; if (!cat) continue;
    for (const r of g.rows) { if (r.dup) continue; picks.push({ r, cat }); }
    // 只记你改过的（或原来认不出、你选了的）；自动归出来的不记，免得把归错的也「学」进去，以后一直错
    if (S.remember && !g.skip && cat && g.id.indexOf("__") !== 0 && cat !== S.auto[g.id]) learned[g.id] = cat;
    else if (g.src === "learned" && cat === S.auto[g.id] && !g.skip) hits[g.id] = (hits[g.id] || 0) + g.rows.filter((r) => !r.dup).length;   // 靠记住的规则归对了
  }
  const ids = [], rowsDone = []; let sum = 0, failed = 0;
  const batchId = `b${Date.now().toString(36)}`;   // 每笔花费记上批次 id（迁移 034）；没执行迁移时退回只记 id 列表
  let tagged = !S.noBatchCol;
  const one = async ({ r, cat }) => {
    const row = { item_id: null, name: merchantName(r.desc), category: cat, quantity: null, unit: null, store: merchantName(r.desc), amount: r.out, currency: cur(), purchased_at: new Date(`${r.date}T12:00:00`).toISOString(), ...(S.account.mode === "id" && String(S.account.id).startsWith("card:") ? { card_id: String(S.account.id).slice(5) } : {}) };
    try {
      let id;
      try { id = await Store.addPurchase(tagged ? { ...row, import_batch: batchId } : row); }
      catch (e) { if (tagged && /import_batch/i.test(e.message)) { tagged = false; S.noBatchCol = true; id = await Store.addPurchase(row); } else throw e; }   // 还没执行迁移 034：不记批次，照旧导入
      ids.push(id); sum += r.out; rowsDone.push({ id, name: merchantName(r.desc), category: cat, amount: r.out, date: r.date });
    } catch (e) { failed++; }
  };
  for (let i = 0; i < picks.length; i += 6) await Promise.all(picks.slice(i, i + 6).map(one));   // 6 个一组并发，云端模式几百笔也不会太慢
  // 账户标签：新账户记进列表；这批的日期范围按文件里全部交易算（跳过的还款 / 转账也在范围里，免得月份缺口误报）
  let acctList = meta("_bank_accounts", []) || [], acct = null, metaFailed = false;
  if (S.account.mode === "new" && S.account.name.trim()) { acct = { id: `a${Date.now().toString(36)}`, name: S.account.name.trim().slice(0, 40), last4: S.account.last4 || "" }; acctList = [...acctList, acct]; }
  else if (S.account.mode === "id") acct = accounts().find((x) => x.id === S.account.id) || null;
  const cardId = acct && String(acct.id).startsWith("card:") ? String(acct.id).slice(5) : "";   // 选的是用卡模块里的卡：花费记到这张卡上（复盘 / 封顶进度用）
  const dates = S.rows.map((r) => r.date).sort();
  const batch = { id: batchId, at: new Date().toISOString(), file: S.parts.map((x) => x.name).join(", ").slice(0, 1000), files: S.parts.map((x) => String(x.name).slice(0, 150)).slice(0, 30),   // file 原来只留 60 个字符，几份文件的名字被截断；现在留 1000，另存每个文件名（files）
    ids: tagged ? [] : ids, tagged, sum: Math.round(sum * 100) / 100, n: ids.length,
    account: acct ? acct.name : "", last4: acct ? acct.last4 : "", from: dates[0] || "", to: dates.at(-1) || "" };
  try {
    const rules = { ...userRules() }, today = todayStr();
    for (const [k, c] of Object.entries(learned)) { const old = rules[learnedKey(k)] || rules[k]; rules[k] = { c, n: ruleUse(old).n, t: today }; }   // 你这次改的：记下来（沿用以前的次数）
    for (const [k, n] of Object.entries(hits)) { const lk = learnedKey(k); if (lk && !learned[lk] && !learned[k]) rules[lk] = { c: ruleCat(rules[lk]), n: ruleUse(rules[lk]).n + n, t: today }; }   // 这次靠规则归对的：用过 +1、更新最近日期
    const keys = Object.keys(rules);
    if (keys.length > 400) keys.map((k, i) => [k, ruleUse(rules[k]), i]).sort((a, b) => a[1].t.localeCompare(b[1].t) || a[1].n - b[1].n || a[2] - b[2]).slice(0, keys.length - 400).forEach(([k]) => delete rules[k]);   // 满了：先淘汰最久没用到的（旧格式没日期的最先）
    // 最近 60 批留着（查看 / 修改 / 撤销靠花费上的批次 id）；没执行迁移 034 的旧批次靠 id 列表，只有最近 6 批保留（免得预算设置里存太多）
    const all = [...(meta("_bank_batches", []) || []), ...(ids.length || (S.rows.length && !failed) ? [batch] : [])].slice(-60).map((b, i, arr) => (!b.tagged && i < arr.length - 6 ? { ...b, ids: [], n: b.n ?? b.ids?.length ?? 0 } : b));
    await saveMeta({ _bank_rules: rules, _bank_batches: all, _bank_accounts: acctList.slice(-30) });
  } catch (e) { metaFailed = true; }   // 花费已经导入了；只是批次记录 / 覆盖表没存上，要告诉用户，不能悄悄吞掉
  S.busy = false; S.last = { n: ids.length, sum: batch.sum, id: batch.id }; S.parts = []; S.groups = []; S.rows = []; S.pick = {}; S.include = {}; S.status = ""; S.acctTouched = false; S.account = acct ? { mode: "id", id: acct.id, name: acct.name, last4: acct.last4 } : { mode: "none", id: "", name: "", last4: "" };
  toast((failed ? t("导入了 {n} 笔，{k} 笔失败", { n: ids.length, k: failed }) : ids.length ? t("已导入 {n} 笔", { n: ids.length }) : t("没有新的花费要导入（都已经记录过）"))
    + (metaFailed ? t("；批次记录没存上，「各账户已补到哪个月」不会更新，请重试") : !acct ? t("；没选账户，这批不计入「各账户已补到哪个月」") : ""));
  if (refreshFn) await refreshFn(); else redraw();
  redraw();
}
async function undo(batchId) {
  const all = meta("_bank_batches", []) || [], b = all.find((x) => x.id === batchId); if (!b) return;
  if (!confirm(t("撤销这批导入？这 {n} 笔花费会被删除。", { n: b.n ?? b.ids?.length ?? 0 }))) return;
  for (let i = 0; i < (b.ids || []).length; i += 6) await Promise.all(b.ids.slice(i, i + 6).map((id) => Store.deletePurchase(id).catch(() => {})));
  if (b.tagged) { try { await Store.deletePurchasesByBatch(b.id); } catch (e) { toast(t("撤销失败：{msg}", { msg: e.message })); return; } }
  try { await saveMeta({ _bank_batches: all.filter((x) => x.id !== batchId) }); } catch (e) { /* 忽略 */ }
  if (S.last?.id === batchId) S.last = null;
  toast(t("已撤销")); if (refreshFn) await refreshFn(); redraw();
}

/** 找回早期批次：每笔花费有 created_at，批次有导入完成时间 at 和笔数 n；
 *  导入是几秒到几分钟内连续写入的，所以「at 之前 20 分钟内写入、笔数正好等于 n」的那批花费就是它。笔数对不上的不动。
 *  找到后给这些花费补上 import_batch（需要迁移 034），批次标记成 tagged。 */
async function recoverBatches() {
  if (S.busy) return; S.busy = true; redraw();
  try {
    let all = meta("_bank_batches", []) || [];
    // 第一步：花费上有批次标记、但批次记录不在列表里的（导入时记录没存上、或列表被改坏）——按标记把批次记录重建出来
    const tagged = await Store.listTaggedPurchases().catch((e) => { if (/import_batch/i.test(e.message || "")) return []; throw e; });
    const known = new Set(all.map((b) => b.id)), groups = new Map();
    for (const p of tagged) {
      if (known.has(p.import_batch)) continue;
      const g = groups.get(p.import_batch) || { n: 0, sum: 0, dates: [], at: p.created_at || "", card: p.card_id || "" };
      g.n++; g.sum += num(p.amount) || 0; g.dates.push(String(p.purchased_at).slice(0, 10)); if ((p.created_at || "") > g.at) g.at = p.created_at; groups.set(p.import_batch, g);
    }
    const rebuilt = [...groups].map(([id, g]) => { g.dates.sort(); const card = g.card && (state.cards || []).find((c) => c.id === g.card); return { id, at: g.at || new Date().toISOString(), file: "", ids: [], tagged: true, sum: Math.round(g.sum * 100) / 100, n: g.n, account: card ? card.name : "", last4: card?.last4 || "", from: g.dates[0] || "", to: g.dates.at(-1) || "", rebuilt: true }; });
    if (rebuilt.length) { all = [...all, ...rebuilt].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-60); await saveMeta({ _bank_batches: all }); }
    const lost = all.filter((b) => !b.tagged && !b.ids?.length && b.from && b.to);
    const day = (s, d) => new Date(new Date(`${s}T00:00:00Z`).getTime() + d * 864e5).toISOString();
    const have = new Set(state.purchases.map((p) => p.id)); let fixed = 0, skipped = 0, rows = 0; const done = new Map();
    for (const b of lost) {
      const found = await Store.listPurchasesRange(day(b.from, -1), day(b.to, 2)).catch(() => []);
      for (const p of found) if (!have.has(p.id)) { state.purchases = [...state.purchases, p]; have.add(p.id); }   // 老批次的花费可能不在内存里
      const at = new Date(b.at).getTime(), pool = found.length ? found : state.purchases;
      const hit = pool.filter((p) => !p.import_batch && p.created_at && new Date(p.created_at).getTime() <= at + 60000 && new Date(p.created_at).getTime() >= at - 20 * 60000);
      if (!hit.length || hit.length !== (b.n ?? -1)) { skipped++; continue; }
      for (const p of hit) { await Store.updatePurchase(p.id, { import_batch: b.id }); p.import_batch = b.id; rows++; }
      done.set(b.id, true); fixed++;
    }
    if (fixed) await saveMeta({ _bank_batches: all.map((b) => (done.has(b.id) ? { ...b, tagged: true, ids: [] } : b)) });
    const re = rebuilt.length ? t("按花费上的批次标记重建了 {n} 批记录", { n: rebuilt.length }) : "";
    toast([re, fixed ? t("找回 {f} 批（{r} 笔）{s}", { f: fixed, r: rows, s: skipped ? t("，{n} 批笔数对不上，已跳过", { n: skipped }) : "" }) : lost.length ? t("没能找回：{n} 批笔数对不上或花费已被删改", { n: skipped }) : ""].filter(Boolean).join("；") || t("没有要找回的批次：所有带标记的花费都已在列表里"));
  } catch (e) {
    toast(/import_batch/i.test(e.message || "") ? t("还没执行迁移 034（purchases.import_batch），先在 Supabase 执行 034_purchase_import_batch.sql") : t("找回失败：{msg}", { msg: e.message }));
  }
  S.busy = false; if (refreshFn) await refreshFn(); redraw();
}

/* ───────────── 事件（只处理 #bankImport 里面的） ───────────── */
document.addEventListener("change", async (e) => {
  const root = e.target.closest && e.target.closest("#bankImport"); if (!root) return;
  const el = e.target, tp = S.parts.length === 1 && S.parts[0].table ? S.parts[0].table : null;
  if (el.id === "bankFile") { const fs = [...(el.files || [])]; if (!fs.length) return; S.status = t("正在读取…"); redraw(); await ingest(fs); S.status = ""; return redraw(); }
  if (el.dataset.bankCat !== undefined) { S.pick[el.dataset.bankCat] = el.value; if (el.value) S.include[el.dataset.bankCat] = true; return redraw(); }
  if (el.dataset.bankInc !== undefined) { S.include[el.dataset.bankInc] = el.checked; return redraw(); }
  if (el.dataset.bankCol !== undefined && tp) { tp.map[el.dataset.bankCol] = +el.value; S.parts[0].error = ""; resetPicks(); rebuild(); return redraw(); }
  if (el.dataset.bankSign !== undefined) { S.spendSign = el.value; resetPicks(); rebuild(); return redraw(); }
  if (el.dataset.bankDmy !== undefined) { S.dmy = el.value === "dmy"; resetPicks(); rebuild(); return redraw(); }
  if (el.dataset.bankRemember !== undefined) { S.remember = el.checked; }
  if (el.dataset.bankBatchAcct !== undefined) { S.batchAcct = el.value; S.batchShow = 20; return redraw(); }
  if (el.dataset.bankAcct !== undefined) { S.acctTouched = true; const v = el.value; const hit = accounts().find((x) => x.id === v);
    S.account = v === "none" ? { mode: "none", id: "", name: "", last4: "" } : hit ? { mode: "id", id: hit.id, name: hit.name, last4: hit.last4 } : { mode: "new", id: "", name: S.account.mode === "new" ? S.account.name : "", last4: S.parts.map((x) => x.acct?.last4).find(Boolean) || "" }; return redraw(); }
  if (el.dataset.bankAcctName !== undefined) { S.acctTouched = true; S.account.name = el.value; }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#bankImport [data-bank-act]"); if (!b) return;
  if (b.dataset.bankAct === "import") doImport();
  else if (b.dataset.bankAct === "rule-del") { const rules = { ...userRules() }; delete rules[b.dataset.key]; saveMeta({ _bank_rules: rules }).then(() => { toast(t("已删除")); if (S.parts.length) { resetPicks(); rebuild(); } redraw(); }); }
  else if (b.dataset.bankAct === "rules-tidy" || b.dataset.bankAct === "rules-stale") {
    const list = b.dataset.bankAct === "rules-tidy" ? redundantRules() : staleRules();
    if (list.length && confirm(t("删除这 {n} 条规则？{names}", { n: list.length, names: `\n${list.slice(0, 8).join("、")}${list.length > 8 ? "…" : ""}` }))) { const rules = { ...userRules() }; list.forEach((k) => delete rules[k]); saveMeta({ _bank_rules: rules }).then(() => { toast(t("已清理 {n} 条", { n: list.length })); if (S.parts.length) { resetPicks(); rebuild(); } redraw(); }); }
  }
  else if (b.dataset.bankAct === "rules-clear") { if (confirm(t("清除全部记住的归类？下次导入这些商家会重新按关键词归类。"))) saveMeta({ _bank_rules: {} }).then(() => { toast(t("已清除")); if (S.parts.length) { resetPicks(); rebuild(); } redraw(); }); }
  else if (b.dataset.bankAct === "undo") undo(b.dataset.batch);
  else if (b.dataset.bankAct === "recover") recoverBatches();
  else if (b.dataset.bankAct === "batches-more") { S.batchShow += 20; redraw(); }
  else if (b.dataset.bankAct === "undo-last" && S.last) undo(S.last.id);
  else if (b.dataset.bankAct === "ai") aiParse(+b.dataset.i);
  else if (b.dataset.bankAct === "rm") { S.parts.splice(+b.dataset.i, 1); resetPicks(); rebuild(); redraw(); }
  else if (b.dataset.bankAct === "paste") { const v = document.getElementById("bankPaste")?.value.trim(); if (v) { S.parts.push(pastePart(v)); suggestAccount(); resetPicks(); rebuild(); redraw(); } }
});
