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
import { categoryOptions } from "../pantry/views.js";
import { meta, saveMeta } from "../bills/budget.js";

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
  let s = String(desc || "").replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " ").replace(/\b\d{5,}\b/g, " ").replace(/[xX*#]{2,}\s*\d+/g, " ").replace(NOISE, " ").replace(/[#*]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.split(" ").filter((w) => !/^\d+$/.test(w) && !/^[A-Z]{2}$/.test(w)).slice(0, 3).join(" ");   // 末尾的州名缩写（IL、CA）、纯数字不要
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
  ["bill_activities", /\bcamp\b|dance|piano|swim|gymnastics|karate|ymca|kumon|夏令营|兴趣班/i], ["bill_toll", /e-?zpass|ipass|sunpass|\btoll\b|过路费/i], ["bill_parking", /parking|parkmobile|spothero|停车/i],
  ["pet_care", /\bvet\b|veterinar|animal hospital|兽医/i], ["pet", /petco|petsmart|chewy|宠物/i],
  ["vehicle_fuel", /shell|chevron|exxon|mobil\b|\bbp\b|speedway|sunoco|marathon|kwik trip|wawa|citgo|casey'?s|gas station|\bfuel\b|supercharg|electrify america|chargepoint|加油|充电|洗车|car wash/i],
  ["vehicle_maint", /jiffy lube|valvoline|firestone|pep boys|autozone|o'?reilly|napa auto|midas|discount tire|auto repair|汽车维修|保养/i],
  ["house_maint", /home depot|lowe'?s|menards|ace hardware|家得宝/i],
  ["medical", /hospital|clinic|medical|dental|dentist|quest diag|labcorp|urgent care|physician|optom|医院|诊所|牙科|体检/i], ["health", /\bcvs\b|walgreens|rite aid|pharmacy|药房|药店/i],
  ["life_grocery", /costco|trader joe|whole foods|kroger|safeway|aldi|publix|wegmans|h ?mart|99 ranch|mitsuwa|jewel-?osco|mariano|meijer|food lion|giant|stop & shop|sprouts|\bheb\b|harris teeter|sam'?s club|instacart|超市|大华|永辉|盒马/i],
  ["life_dining", /restaurant|cafe|coffee|starbucks|dunkin|mcdonald|chipotle|chick-?fil|panda express|subway|domino|pizza|taco|burger|bbq|grill|sushi|ramen|doordash|uber ?eats|grubhub|bakery|boba|tea\b|餐厅|饭店|外卖|美团|饿了么|咖啡|奶茶|麦当劳|肯德基/i],
  ["life_clothes", /nordstrom|macy|old navy|\bgap\b|h&m|zara|uniqlo|nike|adidas|lululemon|tj ?maxx|marshalls|\bross\b|kohl|carter'?s|children'?s place|服装|优衣库/i],
  ["life_care", /salon|barber|haircut|\bspa\b|nail|massage|sephora|ulta|beauty|waxing|理发|美容|美甲|按摩/i], ["life_fitness", /\bgym\b|fitness|peloton|yoga|crossfit|orangetheory|健身|瑜伽|游泳/i],
  ["life_fun", /cinema|\bamc\b|regal|movie|theater|theatre|steam|playstation|xbox|nintendo|ticketmaster|stubhub|bowling|arcade|museum|\bzoo\b|aquarium|电影|游戏|演出/i],
  ["life_gifts", /\bgift|florist|1-800-flowers|hallmark|party city|红包|礼物|礼金/i],
  ["life_digital", /apple store|apple\.com|micro center|newegg|b&h|\bdell\b|lenovo|samsung|google store|数码|苹果/i], ["life_edu", /udemy|coursera|duolingo|khan|scholastic|barnes|bookstore|textbook|college board|课程|图书|书店/i],
  ["life_fees", /\bfee\b|interest charge|finance charge|annual membership|late fee|overdraft|foreign transaction|service charge|手续费|利息|年费|滞纳/i], ["life_mail", /usps|ups store|fedex|\bups\b|\bdhl\b|postage|快递|邮费|顺丰/i],
  ["life_shopping", /amazon|amzn|target|walmart|best ?buy|ikea|etsy|ebay|temu|shein|wayfair|淘宝|京东|拼多多|天猫/i],
];
const BANK_CAT = [[/grocer/i, "life_grocery"], [/food|dining|restaurant/i, "life_dining"], [/gas|fuel/i, "vehicle_fuel"], [/automotive/i, "vehicle_maint"], [/travel|airline|hotel/i, "travel_other"],
  [/shopping|merchandise/i, "life_shopping"], [/health|medical|pharmacy/i, "health"], [/entertainment/i, "life_fun"], [/home|improvement/i, "house_maint"], [/personal|beauty/i, "life_care"],
  [/education|book/i, "life_edu"], [/fee|interest/i, "life_fees"], [/gift|donation|charit/i, "life_gifts"]];

const userRules = () => meta("_bank_rules", {}) || {};
/** 归类：你教过的 > 已有账单的收款方 > 内置关键词（含旅行关键词）> 银行自带分类；都不认识返回 "" */
export function classify(row) {
  const key = keyOf(row.desc), d = row.desc.toLowerCase();
  const ur = userRules()[key]; if (ur) return ur;
  for (const b of state.bills || []) { const p = String(b.payee || b.name || "").toLowerCase(); if (p.length >= 4 && d.includes(p)) return `bill_${b.category}`; }
  for (const [id, re] of RULES) if (re.test(row.desc)) return id;
  const g = TRIP.guess(row.desc, "");   // 机票、酒店、门票、租车…
  if (g && g !== "travel_dining" && g !== "travel_fuel") return g;
  if (g === "travel_dining") return "life_dining";
  if (row.bankCat) for (const [re, id] of BANK_CAT) if (re.test(row.bankCat)) return id;
  return "";
}

/* ───────────── 把表格变成交易行 ───────────── */
const S = { file: "", raw: null, headers: [], body: [], map: null, spendSign: "auto", dmy: false, currency: "", rows: [], groups: [], pick: {}, include: {}, remember: true, last: null, busy: false };
const cur = () => S.currency || Units.region.currency;

function build() {
  const { map, body } = S, rows = [];
  const cell = (r, i) => (i >= 0 ? r[i] : "");
  // 金额正负：一列金额时看哪一边占多数（支出多于入账）；借 / 贷两列时借方 = 支出
  let sign = S.spendSign;
  if (sign === "auto" && map.amount >= 0) { const v = body.map((r) => parseAmount(cell(r, map.amount))).filter((x) => x != null && x !== 0); sign = v.filter((x) => x < 0).length >= v.length / 2 ? "neg" : "pos"; }
  S.autoSign = sign;
  for (const r of body) {
    const date = parseDate(cell(r, map.date), S.dmy ? "dmy" : "mdy"), desc = cell(r, map.desc);
    if (!date) continue;
    let out;
    if (map.amount >= 0) { const a = parseAmount(cell(r, map.amount)); if (a == null) continue; out = sign === "neg" ? -a : a; }
    else { const dr = parseAmount(cell(r, map.debit)), cr = parseAmount(cell(r, map.credit)); if (dr == null && cr == null) continue; out = Math.abs(dr || 0) - Math.abs(cr || 0); }
    if (!out) continue;
    const row = { date, desc: desc || "(无说明)", out: Math.round(out * 100) / 100, bankCat: cell(r, map.category), type: cell(r, map.type), skip: "" };
    const typeTxt = `${row.type} ${row.desc}`;
    if (SKIP.card_payment[0].test(typeTxt) || /^payment$/i.test(row.type)) row.skip = "card_payment";
    else if (SKIP.transfer[0].test(typeTxt)) row.skip = "transfer";
    else if (row.out < 0) row.skip = REFUND.test(typeTxt) ? "" : "income";   // 入账：退款算（负花费），其余是收入
    row.refund = row.out < 0 && !row.skip;
    row.key = keyOf(row.desc); row.cat = row.skip ? "" : classify(row);
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
  // 按商家合并
  const g = new Map();
  for (const r of rows) {
    const id = r.skip ? `__${r.skip}` : r.key;
    const x = g.get(id) || { id, name: r.skip ? t(SKIP[r.skip]?.[1] || "收入 / 入账") : merchantName(r.desc), skip: r.skip, rows: [], total: 0 };
    x.rows.push(r); x.total += r.out; g.set(id, x);
  }
  S.groups = [...g.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  for (const x of S.groups) { if (!(x.id in S.pick)) S.pick[x.id] = x.skip ? "" : x.rows[0].cat; if (!(x.id in S.include)) S.include[x.id] = !x.skip; }
}

async function load(file) {
  const rows = parseCSV(decode(await file.arrayBuffer()));
  const hi = headerIndex(rows);
  if (hi < 0) { S.raw = rows; S.headers = rows[0] || []; S.body = rows.slice(1); S.map = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, category: -1, type: -1 }; S.rows = []; S.groups = []; S.file = file.name; S.error = t("没认出日期和金额这两列，请在下面手动选一下对应的列。"); return; }
  S.error = ""; S.raw = rows; S.headers = rows[hi]; S.body = rows.slice(hi + 1); S.map = detect(S.headers); S.file = file.name; S.pick = {}; S.include = {}; S.last = null; S.spendSign = "auto";
  // 斜杠日期里有大于 12 的第一段 → 日 / 月 / 年
  const firsts = S.body.slice(0, 200).map((r) => (r[S.map.date] || "").match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/)).filter(Boolean).map((m) => [+m[1], +m[2]]);
  S.dmy = firsts.some(([a]) => a > 12) && !firsts.some(([, b]) => b > 12);
  build();
}

/* ───────────── 界面 ───────────── */
const rangeOf = (rows) => { const d = rows.map((r) => r.date).sort(); return d.length ? `${d[0]} → ${d.at(-1)}` : ""; };
const catOpts = (sel) => {
  const own = (cats) => cats.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${c.icon} ${esc(t(c.name))}</option>`).join("");
  const bills = window.BILLS_GROUP.cats().map((c) => ({ ...c, name: c.name }));
  return `<option value="" ${!sel ? "selected" : ""}>${esc(t("— 请选择 —"))}</option>${categoryOptions(sel, { withOther: true, travel: true })}
    <optgroup label="${esc(t("账单"))}">${own(bills)}</optgroup><optgroup label="${esc(t("其他"))}">${own([window.MEDICAL_GROUP, { id: "pet_care", name: "宠物医疗 / 服务", icon: "🐾" }])}</optgroup>`;
};
function groupRow(g) {
  const inc = !!S.include[g.id], dups = g.rows.filter((r) => r.dup).length, n = g.rows.length;
  const sel = `<select data-bank-cat="${esc(g.id)}" aria-label="${esc(t("分类"))}">${catOpts(S.pick[g.id])}</select>`;   // 默认跳过的也能勾上、选个分类导入
  return `<li class="bank-row${g.skip ? " is-skip" : ""}"><label class="bank-chk"><input type="checkbox" data-bank-inc="${esc(g.id)}" ${inc ? "checked" : ""} aria-label="${esc(t("导入"))}"></label>
    <div class="grow"><span class="name">${esc(g.name)}</span><small>${t("{n} 笔", { n })} · ${money(g.total)} · ${esc(rangeOf(g.rows))}${dups ? ` · <b class="bank-dup">${t("{k} 笔疑似已记录，会跳过", { k: dups })}</b>` : ""}</small></div>${sel}</li>`;
}
const chosen = () => {
  let n = 0, sum = 0;
  for (const g of S.groups) { if (!S.include[g.id] || !S.pick[g.id]) continue; for (const r of g.rows) { if (r.dup) continue; n++; sum += r.out; } }
  return { n, sum };
};
function panelHtml() {
  const hasRows = S.groups.length > 0, batches = meta("_bank_batches", []) || [];
  const head = `<div class="panel bank-pick"><p style="margin:0 0 8px">${t("从银行或信用卡网站下载交易记录（CSV 格式），选中文件。文件只在你的浏览器里处理，不会上传；只有你确认的那几笔会存成花费。")}</p>
    <label class="btn btn-primary btn-sm" style="cursor:pointer">${t("选择 CSV 文件")}<input type="file" id="bankFile" accept=".csv,text/csv,text/plain" hidden></label>
    ${S.file ? `<span class="muted" style="margin-left:8px">${esc(S.file)}</span>` : ""}${S.error ? `<p class="form-error" role="alert">${esc(S.error)}</p>` : ""}</div>`;
  if (!S.raw) return head + tipsHtml() + batchesHtml(batches);
  const opt = (i, cur2, none) => `<option value="${i}" ${cur2 === i ? "selected" : ""}>${i < 0 ? esc(none || t("（无）")) : esc(S.headers[i] || `#${i + 1}`)}</option>`;
  const cols = (key, label, none) => `<label>${label}<select data-bank-col="${key}">${[-1, ...S.headers.map((_, i) => i)].map((i) => opt(i, S.map[key], none)).join("")}</select></label>`;
  const mapping = `<details class="panel bank-map"${S.error ? " open" : ""}><summary>${t("认出的列对不对？{n} 行，{range}", { n: S.rows.length, range: rangeOf(S.rows) })}</summary>
    <div class="form-grid" style="margin-top:8px">${cols("date", t("日期"))}${cols("desc", t("商家 / 说明"))}${cols("amount", t("金额（一列）"))}${cols("debit", t("支出（借方）"))}${cols("credit", t("收入（贷方）"))}
      <label>${t("支出的正负")}<select data-bank-sign><option value="auto" ${S.spendSign === "auto" ? "selected" : ""}>${t("自动判断")}（${S.autoSign === "neg" ? t("支出是负数") : t("支出是正数")}）</option><option value="neg" ${S.spendSign === "neg" ? "selected" : ""}>${t("支出是负数")}</option><option value="pos" ${S.spendSign === "pos" ? "selected" : ""}>${t("支出是正数")}</option></select></label>
      <label>${t("日期顺序")}<select data-bank-dmy><option value="mdy" ${!S.dmy ? "selected" : ""}>${t("月/日/年")}</option><option value="dmy" ${S.dmy ? "selected" : ""}>${t("日/月/年")}</option></select></label></div></details>`;
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
const tipsHtml = () => `<div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("怎么归类？")}</h3><ul class="plain small" style="margin:0">
    <li>${t("只有一笔刷卡 / 扣款、没有小票也没关系：按商家名自动归类（超市、餐饮、加油、水电网、订阅、机票酒店…），认不出的你选一次，之后记住。")}</li>
    <li>${t("信用卡还款、账户之间转账、工资入账不是花费，默认跳过——否则会重复算一遍。")}</li>
    <li>${t("退款（卡上入账的退货）会记成负数花费，统计按净额算。")}</li>
    <li>${t("以前已经手动记过的花费（日期差 3 天内、金额一样）自动跳过，所以同一个文件导两次也不会重复。")}</li>
    <li>${t("导入错了可以整批撤销。银行的 CSV 格式很多，列认错了可以手动选；国内银行的 GBK 编码也认得。")}</li></ul></div>`;
const batchesHtml = (batches) => (batches.length ? `<section class="section"><div class="section-head"><h2>${t("最近导入")}</h2></div><div class="panel"><ul class="restock-list">${batches.slice().reverse().map((b) => `<li><div class="grow"><span class="name">${esc(b.file || t("银行导入"))}</span><small>${esc(String(b.at).slice(0, 10))} · ${t("{n} 笔", { n: b.ids.length })} · ${money(b.sum || 0)}</small></div><button type="button" class="btn btn-sm btn-ghost" data-bank-act="undo" data-batch="${esc(b.id)}">${t("撤销")}</button></li>`).join("")}</ul></div></section>` : "");

export function bankImportTab() { return `<section class="section" id="bankImport">${panelHtml()}</section>`; }
const redraw = () => { const el = document.getElementById("bankImport"); if (el) el.innerHTML = panelHtml(); };

/* ───────────── 导入 / 撤销 ───────────── */
async function doImport() {
  if (S.busy) return; S.busy = true; redraw();
  const picks = [], learned = {};
  for (const g of S.groups) {
    if (!S.include[g.id]) continue; const cat = S.pick[g.id]; if (!cat) continue;
    for (const r of g.rows) { if (r.dup) continue; picks.push({ r, cat }); }
    if (S.remember && !g.skip && cat && g.id.indexOf("__") !== 0) learned[g.id] = cat;
  }
  const ids = [], rowsDone = []; let sum = 0, failed = 0;
  const one = async ({ r, cat }) => {
    try {
      const id = await Store.addPurchase({ item_id: null, name: merchantName(r.desc), category: cat, quantity: null, unit: null, store: merchantName(r.desc), amount: r.out, currency: cur(), purchased_at: new Date(`${r.date}T12:00:00`).toISOString() });
      ids.push(id); sum += r.out; rowsDone.push({ id, name: merchantName(r.desc), category: cat, amount: r.out, date: r.date });
    } catch (e) { failed++; }
  };
  for (let i = 0; i < picks.length; i += 6) await Promise.all(picks.slice(i, i + 6).map(one));   // 6 个一组并发，云端模式几百笔也不会太慢
  const batch = { id: `b${Date.now().toString(36)}`, at: new Date().toISOString(), file: S.file, ids, sum: Math.round(sum * 100) / 100 };
  try {
    const rules = { ...userRules(), ...learned }, keys = Object.keys(rules); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => delete rules[k]);
    await saveMeta({ _bank_rules: rules, _bank_batches: [...(meta("_bank_batches", []) || []), ...(ids.length ? [batch] : [])].slice(-8) });
  } catch (e) { /* 记不住规则 / 撤销记录不影响已导入的花费 */ }
  S.busy = false; S.last = { n: ids.length, sum: batch.sum, id: batch.id }; S.raw = null; S.groups = []; S.rows = []; S.file = ""; S.pick = {}; S.include = {};
  toast(failed ? t("导入了 {n} 笔，{k} 笔失败", { n: ids.length, k: failed }) : t("已导入 {n} 笔", { n: ids.length }));
  if (refreshFn) await refreshFn(); else redraw();
  redraw();
}
async function undo(batchId) {
  const all = meta("_bank_batches", []) || [], b = all.find((x) => x.id === batchId); if (!b) return;
  if (!confirm(t("撤销这批导入？这 {n} 笔花费会被删除。", { n: b.ids.length }))) return;
  for (let i = 0; i < b.ids.length; i += 6) await Promise.all(b.ids.slice(i, i + 6).map((id) => Store.deletePurchase(id).catch(() => {})));
  try { await saveMeta({ _bank_batches: all.filter((x) => x.id !== batchId) }); } catch (e) { /* 忽略 */ }
  if (S.last?.id === batchId) S.last = null;
  toast(t("已撤销")); if (refreshFn) await refreshFn(); redraw();
}

/* ───────────── 事件（只处理 #bankImport 里面的） ───────────── */
document.addEventListener("change", async (e) => {
  const root = e.target.closest && e.target.closest("#bankImport"); if (!root) return;
  const el = e.target;
  if (el.id === "bankFile") { const f = el.files?.[0]; if (!f) return; try { await load(f); } catch (err) { S.error = t("读不了这个文件：{msg}", { msg: err.message }); } return redraw(); }
  if (el.dataset.bankCat !== undefined) { S.pick[el.dataset.bankCat] = el.value; if (el.value) S.include[el.dataset.bankCat] = true; return redraw(); }
  if (el.dataset.bankInc !== undefined) { S.include[el.dataset.bankInc] = el.checked; return redraw(); }
  if (el.dataset.bankCol !== undefined) { S.map[el.dataset.bankCol] = +el.value; S.pick = {}; S.include = {}; build(); return redraw(); }
  if (el.dataset.bankSign !== undefined) { S.spendSign = el.value; S.pick = {}; S.include = {}; build(); return redraw(); }
  if (el.dataset.bankDmy !== undefined) { S.dmy = el.value === "dmy"; S.pick = {}; S.include = {}; build(); return redraw(); }
  if (el.dataset.bankRemember !== undefined) { S.remember = el.checked; }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#bankImport [data-bank-act]"); if (!b) return;
  if (b.dataset.bankAct === "import") doImport();
  else if (b.dataset.bankAct === "undo") undo(b.dataset.batch);
  else if (b.dataset.bankAct === "undo-last" && S.last) undo(S.last.id);
});
