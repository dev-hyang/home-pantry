/* 银行对账单导入：Zelle / Venmo 这类个人转账的识别和处理。 */
import { P2P, keyOf } from "./bank-csv.js";
import { canonicalPayee } from "../core/payee-alias.js";
import { meta } from "../bills/budget.js";
import { num } from "../core/util.js";
import { state } from "../core/state.js";

/* ── Zelle / Venmo 这类个人转账（2026-11-04 用户定）──
 * 转入：朋友 AA 还给我、我替人垫付后还回 = 我自己的钱回来了，不是收入 → 「支出退回」：记成所选花费分类的负数花费，抵掉我先付的那部分。
 *       付款方猜成 Zelle 转入 / 报销 时默认就是支出退回（要选个分类才会导入）；真是赠与、副业收款，在下拉里改成收入类型。
 * 转出：大多是朋友先垫付、我转回给他（我的消费，按实际买的东西归类），或付上门维修；借给朋友 / 还朋友借款选「借贷本金」，不算消费。
 *       所以不再自动归到「其他」，而是放进「请归类」让你选；选过的按收款人记住。 */
export const AA_BACK = "__aa";
export const AA_KINDS = ["zelle", "reimburse"];
   // 猜成这两种的入账：默认当支出退回
export const refundRules = () => meta("_refund_rules", {}) || {};
   // { 付款方 key: 花费分类 }，和收入类型规则、花费归类规则分开存
export const isP2POut = (r) => r.out > 0 && P2P.test(r.desc);
/** 默认跳过的几组（还款 / 自己账户之间），勾上导入时分类预选成对应的转账分类：不算任何花费（以前要手动挑一个花费分类） */
export const SKIP_CAT = { card_payment: "bill_credit_card", transfer: "transfer_account" };
/* 转账类（「转账」一级分类，见 js/core/taxonomy.js：不算花费、不算现金流出、不进预算）排在最前面：信用卡还款、自己账户之间、投资账户内部；
 * 转到券商 / 投资账户（钱离开银行账户去买基金股票）是「投资」（capital_invest：算现金流出，不算日常）。 */
const RULES = [
  ["bill_credit_card", /payment,? thank you|autopay payment|credit card (pmt|payment)|crcardpmt|card ?services? payment|信用卡还款|自动还款/i],
  ["transfer_invest", /(internal|journal(ed)?|sweep|core position|money ?market) (transfer|trf|xfer|journal)|journal(ed)? (between|to|from) (accounts?|brokerage)|证券.*(内部|转换)/i],
  ["transfer_account", /online (banking )?transfer (to|from)|(transfer|xfer) (to|from) (my |your )?(sav|savings|chk|checking)\b|between (my |your )?accounts|账户间|本人账户|行内转/i],
  ["capital_invest", /robinhood|fidelity(?! national)|schwab|vanguard|e\*?trade|webull|wealthfront|betterment|acorns|interactive brokers|\bm1 finance|treasurydirect|brokerage|券商|基金申购|证券转入/i],
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
  ["grocery_misc", /weee|sayweee|hmart|h-mart|yamibuy|亚米|trader joe|whole foods|kroger|safeway|aldi|publix|wegmans|h ?mart|99 ranch|mitsuwa|jewel-?osco|mariano|meijer|food lion|giant|stop & shop|sprouts|\bheb\b|harris teeter|instacart|超市|大华|永辉|盒马/i],
  ["life_dining", /restaurant|cafe|coffee|starbucks|dunkin|mcdonald|chipotle|chick-?fil|panda express|subway|domino|pizza|taco|burger|bbq|grill|sushi|ramen|doordash|uber ?eats|grubhub|bakery|boba|tea\b|餐厅|饭店|外卖|美团|饿了么|咖啡|奶茶|麦当劳|肯德基/i],
  ["life_laundry", /laundr|wash ?(&|and|n) ?fold|dry ?clean|(?<!house |home |maid )cleaners|tailor|alteration|洗衣|干洗|改衣/i],   // 洗衣店 / 干洗 / 改衣（上门保洁不算：house cleaners）
  ["gear_clothes", /nordstrom|macy|old navy|\bgap\b|h&m|zara|uniqlo|nike|adidas|lululemon|tj ?maxx|marshalls|\bross\b|kohl|carter'?s|children'?s place|服装|优衣库/i],
  ["life_care", /salon|barber|haircut|\bspa\b|nail|massage|sephora|ulta|beauty|waxing|理发|美容|美甲|按摩/i], ["life_fitness", /\bgym\b|fitness|peloton|yoga|crossfit|orangetheory|健身|瑜伽|游泳/i],
  ["life_fun", /cinema|\bamc\b|regal|movie|theater|theatre|steam|playstation|xbox|nintendo|ticketmaster|stubhub|bowling|arcade|museum|\bzoo\b|aquarium|电影|游戏|演出/i],
  ["life_gifts", /\bgift|florist|1-800-flowers|hallmark|party city|红包|礼物|礼金/i],
  ["gear_digital", /apple store|apple\.com|micro center|newegg|b&h|\bdell\b|lenovo|samsung|google store|数码|苹果/i], ["life_edu", /udemy|coursera|duolingo|khan|college board|课程/i], ["gear_study", /scholastic|barnes|bookstore|textbook|图书|书店/i],
  ["capital_home", /title (company|co\b|insurance)|first american|fidelity national title|chicago title|stewart title|closing (cost|fee)|settlement (statement|fee)|real estate attorney|realtor commission|earnest money|过户|契税|首付|房款|中介费|律师费.*(房|购)/i],
  ["life_gov", /\bdmv\b|secretary of state|\bsos\b|passport|vital records|county clerk|city clerk|citation|violation|court|turbotax|h&r block|freetaxusa|taxact|罚单|交警|车管所|护照|签证|出生证|公证|社保局|税务局/i],
  ["life_fees", /\bfee\b|interest charge|finance charge|annual membership|late fee|overdraft|foreign transaction|service charge|手续费|利息|年费|滞纳/i], ["life_mail", /usps|ups store|fedex|\bups\b|\bdhl\b|postage|快递|邮费|顺丰/i],
  // 仓储 / 综合超市（Costco、Sam's、BJ's、Walmart、Target）一张单子里吃的用的穿的都有：先进 综合购物（待细分），你改过一次这家就记住了
  ["life_shopping", /costco|sam'?s club|bj'?s wholesale|amazon|amzn|target|walmart|best ?buy|ikea|etsy|ebay|temu|shein|wayfair|淘宝|京东|拼多多|天猫/i],
];
const BANK_CAT = [[/credit card payment|payment\/credit/i, "bill_credit_card"], [/grocer/i, "grocery_misc"], [/food|dining|restaurant/i, "life_dining"], [/gas|fuel/i, "vehicle_fuel"], [/automotive/i, "vehicle_maint"], [/travel|airline|hotel/i, "travel_other"],
  [/shopping|merchandise/i, "life_shopping"], [/health|medical|pharmacy/i, "health"], [/entertainment/i, "life_fun"], [/home|improvement/i, "house_maint"], [/personal|beauty/i, "life_care"],
  [/education|book/i, "life_edu"], [/fee|interest/i, "life_fees"], [/gift|donation|charit/i, "life_gifts"]];
export const userRules = () => meta("_bank_rules", {}) || {};
/* 记住的规则：旧格式是 "商家": "分类"，新格式 "商家": { c: 分类, n: 用过几次, t: 最近用到的日期 }；两种都认。满 400 条时淘汰最久没用到的 */
export const ruleCat = (v) => (typeof v === "string" ? v : v?.c || "");
export const ruleUse = (v) => (typeof v === "string" ? { n: 0, t: "" } : { n: v?.n || 0, t: v?.t || "" });
export const todayStr = () => new Date().toISOString().slice(0, 10);
/** 归类：你教过的 > 已有账单的收款方（金额也得像那条账单）> AI 给的 > 内置关键词（含旅行关键词）> 银行自带分类；都不认识返回 ""
 *  账单收款方那条原来太宽：Amazon Prime / Costco 会员建了账单后，所有 Amazon / Costco 的购物都被归成「会员」。
 *  现在要么金额和账单的通常金额对得上（±15%），要么这家商家内置关键词也认不出，才按账单归类 */
// 以前记住的规则是按老的商家名存的（带流水码，如「costco gas 0123」）；商家名清理规则改过之后对不上了——把老键按同样的清理再比一次
const normKey = (k) => String(k).split(" ").filter((w) => !/^\d+$/.test(w) && !(/\d/.test(w) && /[a-z]/i.test(w) && !/^\d+-[a-z]+$/i.test(w))).join(" ");
// 收款方归一之后（AMAZON MKTPL → Amazon）老规则的键也要按同样的归一再比一次，记住的归类才不会失效
export const learnedKey = (key) => { const rules = userRules(); return rules[key] ? key : Object.keys(rules).find((x) => normKey(x) === key) || Object.keys(rules).find((x) => canonicalPayee(normKey(x)).toLowerCase() === key) || ""; };
const learnedFor = (key) => { const k = learnedKey(key); return k ? ruleCat(userRules()[k]) : ""; };
/** 内置关键词（含旅行关键词）现在会给这家商家什么分类；认不出返回 "" */
const builtinCat = (key) => (RULES.find(([, re]) => re.test(key)) || [])[0] || TRIP.guess(key, "") || "";
/** 多余的规则：你记的分类和内置关键词现在给的一样（删了结果不变，还省名额） */
export const redundantRules = () => Object.entries(userRules()).filter(([k, v]) => { const b = builtinCat(k); return b && canonCat(b) === canonCat(ruleCat(v)); }).map(([k]) => k);
/** 90 天没用到的规则（旧格式没有日期，没法判断，不算） */
export const staleRules = () => { const cut = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10); return Object.entries(userRules()).filter(([, v]) => { const u = ruleUse(v); return u.t && u.t < cut; }).map(([k]) => k); };
export function classify(row) { return classifyWhy(row).cat; }
/** 同上，但带来源：learned（你教过的）/ bill / rule / ai / bank / ""。内置关键词认得的商家（Amazon、Costco、Shell…）优先于 AI 的猜测——AI 常把 Amazon 购物猜成会员 */
export function classifyWhy(row) {
  const key = keyOf(row.desc), d = row.desc.toLowerCase();
  const ur = learnedFor(key); if (ur) return { cat: canonCat(ur), src: "learned" };
  let rule = (RULES.find(([, re]) => re.test(row.desc)) || [])[0] || "";
  if ((rule === "grocery_misc" || rule === "life_shopping") && row.bankCat && /gas|fuel/i.test(row.bankCat)) rule = "vehicle_fuel";   // 银行自己标了 Gas：超市 / 仓储超市的加油站
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
