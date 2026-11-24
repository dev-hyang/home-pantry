/* 银行对账单导入：把表格变成交易行，导入页的状态 S。 */
import { AA_BACK, AA_KINDS, SKIP_CAT, classifyWhy, isP2POut, refundRules } from "./bank-transfers.js";
import { REFUND, SKIP, XFER_WORDS, decode, detect, fixP2PSign, headerIndex, keyOf, merchantName, parseAmount, parseCSV, parseDate, transferKind } from "./bank-csv.js";
import { askText } from "../core/ai.js";
import { detectAccount, looksOFX, looksQIF, parseStatementLines, pdfLines, readOFX, readQIF, readXLSX, statementTotals } from "./statement-readers.js";
import { guessKind, incomeRules, senderName, similarIncome, skey } from "../income/logic.js";
import { loadNear, nearRows, poolRows } from "./dup-check.js";
import { matchTrips } from "./dup-trips.js";
import { acctKeyOf, importKeyOf, knownKey, loadKnownKeys } from "./bank-keys.js";
import { matchPayments, paymentPool } from "./dup-bills.js";
import { state } from "../core/state.js";
import { money, num } from "../core/util.js";
import { redraw } from "./bank-ui.js";
import { t } from "../core/i18n.js";
import { incomeOk } from "./bank-common.js";

/* ───────────── 把表格变成交易行 ───────────── */
export const BATCH_KEEP = 120;
   // 「最近导入」记几批（存在家庭设置里；原来 60）
export const S = { parts: [], auto: {}, account: { mode: "none", id: "", name: "", last4: "" }, acctTouched: false, spendSign: "auto", autoSign: "pos", dmy: false, currency: "", rows: [], groups: [], pick: {}, include: {}, remember: true, last: null, busy: false, status: "", error: "", ikind: {}, rcat: {}, incPerson: null, batchAcct: "all", editDates: "", force: new Set() };
   // force：看过以后手动改成「仍然导入」的那几笔（按 日期|金额|描述#序号 记，重新解析 / 改列也保留）   // batchAcct / batchShow：「最近导入」列表的账户筛选和已展开的条数（重画也不丢）
export const cur = () => S.currency || Units.region.currency;
export let askFn = askText;
   // 测试时可替换
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
export function tableRows(part) {
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
export async function readPart(file) {
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
export function pastePart(text) {
  const rows = parseCSV(text);
  if (headerIndex(rows) >= 0) return tablePart(t("粘贴的文字"), "paste", rows);
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (looksOFX(text)) return { name: t("粘贴的文字"), kind: "ofx", rows: readOFX(text) };
  return { name: t("粘贴的文字"), kind: "paste", lines, rows: parseStatementLines(lines), local: true, totals: statementTotals(lines), acct: detectAccount("", lines) };
}
/** 所有 part 的行合并 → 判跳过 / 归类 / 查重 / 按商家合并 */
export function rebuild() {
  const all = [];
  for (const p of S.parts) { if (p.table) p.rows = tableRows(p); all.push(...p.rows); }
  const single = S.parts.length === 1 && S.parts[0].table ? S.parts[0] : null; S.autoSign = single?.autoSign || S.autoSign;
  const rows = [];
  for (const r0 of all) {
    const row = { ...fixP2PSign(r0), skip: "" }, typeTxt = `${row.type} ${row.desc}`;
    if (row.kind === "card_payment" || SKIP.card_payment[0].test(typeTxt) || /^payment$/i.test(row.type)) row.skip = "card_payment";
    else if (row.kind === "transfer" || XFER_WORDS.test(typeTxt)) {
      if (row.out > 0 && transferKind(typeTxt) !== "internal") row.xfer = "external";   // 支出方向、不是自己账户之间的：转给别人 / 取现 / 汇款 / 转到别的账户（Robinhood…），按花费记
      else row.skip = "transfer";
    }
    else if (row.kind === "income") row.skip = "income";
    else if (row.out < 0) row.skip = row.kind === "refund" || REFUND.test(typeTxt) ? "" : "income";   // 入账：退款算（负花费），其余是收入
    row.refund = row.out < 0 && !row.skip;
    // 入账：商家退款留在花费里（负花费）；自己账户之间的转账（写着自己尾号 / 转自 SAV·CHK）两边都不算；其余（工资、电汇、Zelle 转入、赠与…）是收入候选
    row.inc = incomeOk() && row.out < 0 && !row.refund && !row.xfer && (row.skip === "income" || (row.skip === "transfer" && transferKind(typeTxt) !== "internal"));
    row.incUnsure = row.inc && row.skip === "transfer" && transferKind(typeTxt) === "unknown";   // 只写着「转账 / 存款」看不出来源：默认不勾
    row.key = keyOf(row.desc); const cw = row.skip ? { cat: "", src: "" } : classifyWhy(row), p2pOut = row.xfer && isP2POut(row);
    // 转出的 Zelle / Venmo：可能是消费（朋友垫付后转回、上门维修），也可能是借给朋友 / 还朋友的钱——不猜，放进「请归类」（记住过的照用）
    row.p2p = p2pOut; row.cat = cw.cat || (row.xfer && !p2pOut ? "other" : ""); row.src = cw.cat ? cw.src : row.xfer && !p2pOut ? "rule" : cw.src;
    rows.push(row);
  }
  // 和已有花费对得上的（金额一样、日期差 ≤ 3.5 天，每条已有花费只配一次）：疑似已记录，默认跳过；重复导入同一个文件也靠它防重。
  // 已有花费不在浏览器里：对账单这段日期（前后各多 4 天）一次读进内存（dup-check.js），每行在内存里比；还没读完的先按没有算，读完重新判断
  const cands = [...rows.filter((r) => !r.skip).map((r) => ({ d: r.date, a: r.out })), ...rows.filter((r) => r.inc).map((r) => ({ d: r.date, a: r.out }))];   // 收入行：找记成退款的（金额 = −到账）
  loadNear(cands).then((fresh) => { if (fresh) { rebuild(); redraw(); } }).catch(() => {});
  const used = new Set(), seen = {};
  for (const r of rows) {
    const k0 = `${r.date}|${r.out}|${r.desc}`; r.fk = `${k0}#${seen[k0] = (seen[k0] || 0) + 1}`;
    r.ik = importKeyOf(acctKeyOf(S.account), r.fk);
    if (r.skip) continue;
    const kid = knownKey(r.ik);   // 指纹：这一行以前导入过（同一份对账单、同一行）：默认不再导入；它对应的那条记录不再去配别的行
    if (kid) { used.add(kid); r.keyDup = true; r.dupOf = t("以前导入过这一行（同一份对账单）"); if (S.force.has(r.fk)) r.forced = true; else { r.dup = true; if (r.inc) r.idup = true; } continue; }
    const hit = (nearRows(r.date, r.out) || []).find((p) => !used.has(p.id));   // 数据库按 时间新 → 旧 给出
    if (hit) { used.add(hit.id); r.dupOf = `${hit.name} · ${String(hit.purchased_at).slice(0, 10)}`; if (S.force.has(r.fk)) r.forced = true; else r.dup = true; }   // 手动确认过不是重复的：照常导入
  }
  // 小票 ↔ 整笔流水：已有花费里一张张小票（一行一个物品）的合计，和流水里的一笔对得上 = 已经按小票记过了（dup-trips.js）。强：默认不导入；中：只提醒
  const cardId = S.account.mode === "id" && String(S.account.id).startsWith("card:") ? String(S.account.id).slice(5) : "";
  const trips = matchTrips(rows.filter((r) => !r.skip && !r.inc && !r.dup && r.out > 0).map((r) => ({ fk: r.fk, date: r.date, out: r.out, texts: [r.desc, merchantName(r.desc)] })), poolRows(), { card: cardId, used });
  for (const r of rows) {
    const m = trips.get(r.fk); if (!m) continue;
    const label = t("小票：{s} · {n} 项 · 合计 {a}（{d}）", { s: m.store || t("商店未填"), n: m.n, a: money(m.total), d: m.day });
    if (m.tier === "strong") { r.dupOf = label; if (S.force.has(r.fk)) r.forced = true; else r.dup = true; } else r.tripWeak = label;
  }
  // 账单缴费 ↔ 流水：拿缴费记录（不管有没有写花费；医疗等一次性账单、房贷车贷的整笔也在内）比：金额一样 + 收款方或日期近 = 强，金额差一点 + 收款方对上 = 中（dup-bills.js）
  loadMedicalOnce(rebuild);
  const pays = matchPayments(rows.filter((r) => !r.skip && !r.inc && !r.dup && r.out > 0).map((r) => ({ fk: r.fk, date: r.date, out: r.out, texts: [r.desc, merchantName(r.desc)] })),
    paymentPool({ bills: state.bills, payments: state.billPayments, medBills: state.medBills, medPayments: state.medPayments }), { card: cardId, usedPurchases: used });
  for (const r of rows) {
    const m = pays.get(r.fk); if (!m) continue;
    const label = t("账单缴费：{n} · {d} · {a}", { n: m.label || t("账单"), d: m.date, a: money(m.amount) });
    if (m.tier === "strong") { r.dupOf = label; r.tripWeak = ""; if (S.force.has(r.fk)) r.forced = true; else r.dup = true; } else if (!r.tripWeak) r.tripWeak = label;
  }
  for (const r of rows) {
    if (!r.inc) continue;
    const amt = Math.round(-r.out * 100) / 100, hit = similarIncome({ received_on: r.date, amount: amt, source_name: senderName(r.desc) });
    const ref = !hit && (nearRows(r.date, r.out) || []).find((p) => num(p.amount) < 0);   // 已经记成退款（负花费）的
    if (hit || ref) { r.dupOf = hit ? `${hit.source_name} · ${hit.received_on}` : `${ref.name} · ${String(ref.purchased_at).slice(0, 10)}（${t("已记成退款")}）`; if (S.force.has(r.fk)) r.forced = true; else r.idup = true; }
  }
  loadKnownKeys(rows.filter((r) => !r.skip).map((r) => r.ik)).then((fresh) => { if (fresh) { rebuild(); redraw(); } }).catch(() => {});   // 指纹查回来有已导入的，重新判断
  S.rows = rows;
  const g = new Map();
  for (const r of rows) {
    const sn = r.inc ? senderName(r.desc) : "", id = r.inc ? `in:${skey(sn)}` : r.skip ? `__${r.skip}` : r.key;
    const x = g.get(id) || { id, name: r.inc ? sn : r.skip ? t(SKIP[r.skip]?.[1] || "收入 / 入账") : merchantName(r.desc), skip: r.skip, inc: !!r.inc, rows: [], total: 0 };
    x.rows.push(r); x.total += r.out; g.set(id, x);
  }
  S.groups = [...g.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  for (const x of S.groups) { x.src = x.rows[0].src || ""; if (!(x.id in S.auto)) S.auto[x.id] = x.inc ? (incomeRules()[x.id.slice(3)] || guessKind(x.rows[0].desc)) : x.skip ? "" : x.rows[0].cat; if (!(x.id in S.pick)) S.pick[x.id] = x.inc ? "" : x.skip ? SKIP_CAT[x.skip] || "" : x.rows[0].cat; if (x.inc && !(x.id in S.ikind)) { const rr = refundRules()[x.id.slice(3)]; S.ikind[x.id] = rr ? AA_BACK : !incomeRules()[x.id.slice(3)] && AA_KINDS.includes(S.auto[x.id]) ? AA_BACK : S.auto[x.id]; if (rr && !(x.id in S.rcat)) S.rcat[x.id] = rr; } if (!(x.id in S.include)) S.include[x.id] = x.inc ? !x.rows.every((r) => r.incUnsure) : !x.skip; }
}
/** 医疗等一次性账单的缴费不一定读进来过（按需加载）：对账单导入时读一次，读完重新判断 */
let medTried = false;
function loadMedicalOnce(rebuildFn) {
  if (medTried || state.medPayments?.length) return; medTried = true;
  import("../bills/medical-data.js").then((m) => m.reloadMedical()).then(() => { rebuildFn(); redraw(); }).catch(() => {});
}
export const resetPicks = () => { S.pick = {}; S.include = {}; S.auto = {}; S.rcat = {}; };
