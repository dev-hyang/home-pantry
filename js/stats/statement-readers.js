/* 对账单 / 导出文件读取器（给银行导入用）：OFX / QFX、QIF、Excel（xlsx）、PDF 对账单（文字层）、截图 / 扫描件（AI）。
 * 每个读取器都返回统一的交易行 { date: "YYYY-MM-DD", desc, out, bankCat, type, aiCat?, kind? }
 *   out > 0 = 花出去的钱（消费、手续费、利息）；out < 0 = 进来的钱（退款、还款、收入）。
 * PDF.js / SheetJS 只在用到时才从 CDN 加载（固定版本）；全部在浏览器里处理，PDF 和 Excel 文件本身不上传。
 * 只有你点“用 AI 解析”才会把内容发给你在设置里选的模型：发之前只保留带日期或金额的行（去掉姓名、地址）、
 * 长数字串（账号、卡号）、邮箱、电话一律抹掉。 */

const loaded = {};
export function loadScript(url) {
  return (loaded[url] ||= new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = url; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { delete loaded[url]; reject(new Error(`加载失败：${url}`)); };
    document.head.appendChild(s);
  }));
}
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

/* ───────────── OFX / QFX ───────────── */
export const looksOFX = (text) => /<OFX>|OFXHEADER/i.test(text.slice(0, 2000)) || /<STMTTRN>/i.test(text);
export function readOFX(text) {
  const rows = [], blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b, k) => { const m = b.match(new RegExp(`<${k}>([^<\\r\\n]*)`, "i")); return m ? m[1].trim() : ""; };
  readOFX.lastAcct = (text.match(/<ACCTID>([^<\r\n]*)/i) || [])[1]?.trim().slice(-4) || "";
  for (const b of blocks) {
    const dt = tag(b, "DTPOSTED").match(/^(\d{4})(\d{2})(\d{2})/), amt = parseFloat(tag(b, "TRNAMT"));
    if (!dt || !Number.isFinite(amt) || !amt) continue;
    const desc = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" ");
    rows.push({ date: isoDate(+dt[1], +dt[2], +dt[3]), desc: desc || "(无说明)", out: -amt, bankCat: "", type: tag(b, "TRNTYPE") });   // OFX：负数 = 支出
  }
  return rows.filter((r) => r.date);
}

/* ───────────── QIF ───────────── */
export const looksQIF = (text) => /^\s*!Type:/im.test(text.slice(0, 500));
export function readQIF(text) {
  const rows = []; let r = {};
  const flush = () => {
    if (r.D && r.T) {
      const m = r.D.replace(/'/g, "/").replace(/\s+/g, "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/) || r.D.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const amt = parseFloat(String(r.T).replace(/,/g, ""));
      if (m && Number.isFinite(amt) && amt) {
        const date = m[1].length === 4 ? isoDate(+m[1], +m[2], +m[3]) : isoDate(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
        if (date) rows.push({ date, desc: [r.P, r.M].filter(Boolean).join(" ") || "(无说明)", out: -amt, bankCat: r.L || "", type: "" });
      }
    }
    r = {};
  };
  for (const line of text.split(/\r?\n/)) { if (line.startsWith("^")) flush(); else if (line.length > 1) r[line[0]] = line.slice(1).trim(); }
  flush();
  return rows;
}

/* ───────────── Excel ───────────── */
/** 第一个工作表 → 字符串二维表（和 CSV 解析后的形状一样，交给同一套认列） */
export async function readXLSX(buf) {
  await loadScript(XLSX_URL);
  const wb = window.XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd", defval: "" });
  return rows.map((r) => r.map((x) => String(x ?? "").trim())).filter((r) => r.some((x) => x !== ""));
}

/* ───────────── PDF ───────────── */
let pdfReady = null;
async function pdfjs() {
  pdfReady ||= (async () => {
    await loadScript(`${PDFJS}/pdf.min.js`);
    const lib = window.pdfjsLib;
    // 跨域的 worker 不能直接用：取回来做成同源的 blob
    const src = await (await fetch(`${PDFJS}/pdf.worker.min.js`)).text();
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    return lib;
  })();
  return pdfReady;
}
/** PDF → 文字行（同一水平位置的文字拼成一行，页与页之间按顺序）；没有文字层（扫描件）时 lines 为空 */
export async function pdfLines(buf) {
  const lib = await pdfjs(), doc = await lib.getDocument({ data: buf.slice(0) }).promise, lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent(), rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3, x = it.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2); if (!row) rows.push(row = { y, items: [] });
      row.items.push({ x, s: it.str, w: it.width || 0 });
    }
    rows.sort((a, b) => b.y - a.y);   // PDF 的 y 向上，从上到下
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let line = "", end = null;
      for (const it of r.items) { line += (end != null && it.x - end > 6 ? "  " : end != null ? "" : "") + it.s; end = it.x + it.w; }
      lines.push(line.replace(/\s+/g, " ").trim());
    }
    lines.push("");   // 页分隔
  }
  return { lines, pages: doc.numPages };
}
/** 扫描件：把前几页渲染成图片（给 AI 看） */
export async function pdfImages(buf, max = 6, scale = 1.6) {
  const lib = await pdfjs(), doc = await lib.getDocument({ data: buf.slice(0) }).promise, out = [];
  for (let p = 1; p <= Math.min(doc.numPages, max); p++) {
    const page = await doc.getPage(p), vp = page.getViewport({ scale }), c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    out.push({ mime: "image/jpeg", b64: c.toDataURL("image/jpeg", 0.8).split(",")[1] });
  }
  return out;
}

/* ───────────── 对账单文字 → 交易行（本地规则） ───────────── */
const DATE_RE = "(?:\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.? \\d{1,2}(?:,? \\d{4})?|\\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?(?: \\d{4})?)";
const MONEY = "[-+(]?\\$?\\s?\\d{1,3}(?:,\\d{3})*\\.\\d{2}\\)?-?(?:\\s?(?:CR|DR))?";
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const hasDate = (l) => new RegExp(`(^|\\s)${DATE_RE}(\\s|$)`, "i").test(l), hasMoney = (l) => new RegExp(MONEY).test(l);
const moneyVal = (tok) => { const neg = /^\(|-$|^-|CR/i.test(tok.trim()); const n = parseFloat(tok.replace(/[^\d.]/g, "")); return Number.isFinite(n) ? (neg ? -n : n) : null; };

function yearHint(lines) {
  const txt = lines.slice(0, 80).join(" ");
  const m = txt.match(/(?:statement|closing|billing|period|through|ending)[^0-9]{0,40}(?:\d{1,2}[/.-]\d{1,2}[/.-](\d{2,4})|[A-Za-z]{3,9}\.? \d{1,2},? (\d{4}))/i);
  if (m) { const y = +(m[1] || m[2]); return y < 100 ? 2000 + y : y; }
  // 没找到账单日期：取开头文字里出现最多的年份（并列取较新的）——不能取第一个，「2019 年开户 / 会员」这类字样会把整份账单的年份带偏
  const cnt = new Map(); for (const y of txt.match(/\b20\d{2}\b/g) || []) cnt.set(+y, (cnt.get(+y) || 0) + 1);
  const best = [...cnt].sort((p, q) => q[1] - p[1] || q[0] - p[0])[0];
  return best ? best[0] : new Date().getFullYear();
}
function toISO(token, year, stmtMonth) {
  let m;
  if ((m = token.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return isoDate(+m[1], +m[2], +m[3]);
  if ((m = token.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) { const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : year; return adj(y, +m[1], +m[2], !m[3], stmtMonth); }
  if ((m = token.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2})(?:,? (\d{4}))?$/))) return adj(m[3] ? +m[3] : year, MONTHS[m[1].toLowerCase()], +m[2], !m[3], stmtMonth);
  if ((m = token.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.?(?: (\d{4}))?$/))) return adj(m[3] ? +m[3] : year, MONTHS[m[2].toLowerCase()], +m[1], !m[3], stmtMonth);
  return null;
}
// 没写年份的日期：跨年的对账单（一月的账单里有十二月的交易）月份比账单月份大很多时算前一年
const adj = (y, mo, d, noYear, stmtMonth) => isoDate(noYear && stmtMonth && mo - stmtMonth > 6 ? y - 1 : y, mo, d);

const IN_SEC = /(payments?|credits?|deposits?|other credits|refunds?)\b/i, OUT_SEC = /(purchases?|charges?|withdrawals?|debits?|fees?|interest charged|checks? paid|transactions?)\b/i;
const SUMMARY = /\b(total|balance|minimum|summary|credit limit|apr|available|previous|new balance|payment due|interest rate|rewards?|points)\b/i;
export function parseStatementLines(lines) {
  const year = yearHint(lines), mm = lines.join(" ").match(/(?:closing|statement|period)[^0-9]{0,30}(\d{1,2})[/.-]\d{1,2}[/.-]\d{2,4}/i), stmtMonth = mm ? +mm[1] : null;
  const rows = []; let sec = null;
  const lineRe = new RegExp(`^(${DATE_RE})(?:\\s+(${DATE_RE}))?\\s+(.+?)\\s+(${MONEY})(?:\\s+(${MONEY}))?\\s*$`, "i");
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(lineRe);
    if (!m) { if (!hasDate(line) && !hasMoney(line) && line.length < 70) { if (IN_SEC.test(line) && !OUT_SEC.test(line)) sec = "in"; else if (OUT_SEC.test(line)) sec = "out"; } continue; }
    const date = toISO(m[1], year, stmtMonth); if (!date) continue;
    const desc = m[3].replace(/\s+/g, " ").trim();
    if (SUMMARY.test(desc) && !/purchase|payment to/i.test(desc)) continue;
    const amt = moneyVal(m[5] ? m[4] : m[4]); if (amt == null || amt === 0) continue;   // 有“金额 + 余额”两列时 m[4] 是金额
    // 正负：行里自带的 - / CR 最可信；其次看所在小节（付款 / 存款小节里的正数是进账）；都没有就当支出
    const signed = /^\(|-$|^-|CR/i.test(m[4].trim());
    const out = signed ? -Math.abs(amt) : sec === "in" ? -Math.abs(amt) : Math.abs(amt);
    rows.push({ date, desc, out, bankCat: "", type: "" });
  }
  return rows;
}

/* ───────────── 对账单上的合计（用来核对读出来的交易有没有漏） ───────────── */
const notTx = (l) => !new RegExp(`^${DATE_RE}`, "i").test(l.trim());   // 合计行不以日期开头
const grab = (lines, re) => { for (const l of lines) { if (!notTx(l)) continue; const m = l.match(re); if (m) { const v = moneyVal(m[m.length - 1]); if (v != null) return Math.abs(v); } } return null; };
/** { purchases, fees, interest, payments }：对账单摘要里印的本期消费 / 手续费 / 利息 / 还款合计；没找到的为 null */
export function statementTotals(lines) {
  const M = `(${MONEY})`;
  return {
    purchases: grab(lines, new RegExp(`\\b(?:purchases?|new charges?|total (?:new )?charges|charges and adjustments|本期消费|消费合计|本期支出|本期交易)\\b[^0-9$(-]{0,30}${M}`, "i")),
    fees: grab(lines, new RegExp(`\\b(?:fees? charged|total fees|手续费合计)\\b[^0-9$(-]{0,30}${M}`, "i")),
    interest: grab(lines, new RegExp(`\\b(?:interest charged|total interest|利息合计)\\b[^0-9$(-]{0,30}${M}`, "i")),
    payments: grab(lines, new RegExp(`\\b(?:payments?(?: and (?:other )?credits)?|total payments|本期还款)\\b[^0-9$(-]{0,30}${M}`, "i")),
  };
}

/* ───────────── 认账户：文件名 / 对账单抬头里的发卡行和卡号末四位 ───────────── */
const ISSUERS = [["Chase", /chase/i], ["Amex", /american express|amex/i], ["Citi", /\bciti/i], ["Discover", /discover/i], ["Capital One", /capital ?one/i], ["Bank of America", /bank of america|bofa/i], ["Wells Fargo", /wells ?fargo/i], ["US Bank", /u\.?s\.? ?bank/i], ["Barclays", /barclays/i], ["Apple Card", /apple card/i], ["Synchrony", /synchrony/i],
  ["招商", /招商|\bcmb\b/i], ["工商", /工商|icbc/i], ["建设", /建设|\bccb\b/i], ["中国银行", /中国银行|\bboc\b/i], ["农业", /农业银行|\babc\b/i], ["交通", /交通银行|bocom/i], ["浦发", /浦发|spdb/i], ["民生", /民生/], ["兴业", /兴业/], ["平安", /平安/], ["中信", /中信/], ["光大", /光大/], ["广发", /广发/], ["支付宝", /支付宝|alipay/i], ["微信", /微信|wechat/i]];
/** { issuer, last4 }：认不出的为空 */
export function detectAccount(name, lines = []) {
  const head = (lines || []).slice(0, 60).join("\n");
  const issuer = (ISSUERS.find(([, re]) => re.test(name)) || ISSUERS.find(([, re]) => re.test(head)) || [])[0] || "";
  // 「Account Number: 4111 1111 1111 1234」「Card ending in 1234」「卡号 ****1234」：取整串号码的最后 4 位
  const m = head.match(/(?:account|acct|card|ending|卡号|账号|尾号)[^0-9\n]{0,30}((?:[0-9x*•#][\s-]?){3,24}[0-9])\b/i);
  let last4 = m ? m[1].replace(/[^0-9]/g, "").slice(-4) : "";
  if (last4.length < 4) last4 = "";
  if (!last4) last4 = (String(name).match(/\d{4}/g) || []).filter((x) => !/^(19|20)\d\d$/.test(x))[0] || "";   // 文件名里的 4 位数（年份不算）
  return { issuer, last4 };
}

/* ───────────── 隐私：发给 AI 之前 ───────────── */
/** 只保留带日期或金额的行（去掉姓名、地址、客服电话等），再抹掉长数字串、邮箱、电话 */
export function redactLines(lines) {
  return lines.filter((l) => l.trim() && (hasDate(l) || hasMoney(l)))
    .map((l) => l.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[邮箱]").replace(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g, "[电话]").replace(/\b(?:\d[ -]?){12,19}\b/g, "[卡号]").replace(/\b\d{7,}\b/g, "[号码]"));
}

/* ───────────── AI 解析 ───────────── */
function lenientJson(text) {
  const c = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(c); } catch { /* 再试截取 */ }
  const a = c.indexOf("{"), b = c.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(c.slice(a, b + 1));
  throw new Error("没能读出内容");
}
const SYSTEM = [
  "You read bank / credit-card statement text or images and return ONLY JSON. Never invent transactions; copy dates and amounts exactly.",
  'Return {"currency": "USD"|null, "transactions": [{"date":"YYYY-MM-DD","description":"merchant as printed (no account numbers)","amount":number,"kind":"purchase|refund|card_payment|transfer|income|fee|interest","category":"id or null"}]}.',
  "amount: positive = money that LEFT the account (purchase, fee, interest); negative = money that CAME IN (refund, card payment received, deposit, salary). kind: card_payment = payment toward a credit card; transfer = movement between accounts, Zelle/Venmo, ATM; income = salary/deposit; refund = returned purchase credited back.",
  "Direction of person-to-person payments follows the wording, not your guess: \"Zelle payment FROM x\" / \"Venmo from x\" is money that CAME IN (negative amount), \"Zelle payment TO x\" is money that LEFT (positive amount). Skip running balances, totals, summaries, rewards and marketing text. If a date has no year, use the statement period to infer it (a January statement can contain December transactions).",
  "category = the best matching id from the list given below for purchases / refunds / fees; null when unsure or for payments / transfers / income.",
].join("\n");
const VALID_KIND = new Set(["purchase", "refund", "card_payment", "transfer", "income", "fee", "interest"]);
/** 一次调用：lines（已脱敏的文字行）或 images；ask = askText；返回交易行 */
export async function aiExtract({ lines, images, categories, ask, validIds, hint = "" }) {
  const user = [`Category ids (id=name): ${categories}`, hint, images?.length ? "The statement pages are attached as images." : `Statement text:\n${lines.join("\n")}`].filter(Boolean).join("\n\n");
  const d = lenientJson(await ask(SYSTEM, user, { json: true, images: images || [], temperature: 0.1, maxTokens: 6000 }));
  const out = [];
  for (const x of d.transactions || []) {
    const amt = typeof x.amount === "number" ? x.amount : parseFloat(String(x.amount ?? "").replace(/[^\d.-]/g, ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || "") || !Number.isFinite(amt) || !amt) continue;
    const kind = VALID_KIND.has(x.kind) ? x.kind : "purchase";
    out.push({ date: x.date, desc: String(x.description || "(无说明)").slice(0, 80), out: Math.round(amt * 100) / 100, bankCat: "", type: kind, kind, aiCat: validIds.has(x.category) ? x.category : "" });
  }
  return out;
}
/** 文字太长就按行分段（每段不超过 maxChars），段与段之间不重叠 */
export function chunkLines(lines, maxChars = 7000) {
  const chunks = []; let cur = [], n = 0;
  for (const l of lines) { if (n + l.length > maxChars && cur.length) { chunks.push(cur); cur = []; n = 0; } cur.push(l); n += l.length + 1; }
  if (cur.length) chunks.push(cur);
  return chunks;
}
