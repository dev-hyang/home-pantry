/* 银行对账单导入：账户（哪张卡 / 账户）标签，和 AI 解析（PDF / 截图 / 扫描件 / 粘贴的文字）。 */
import { LIVE, batchAcctKey, redraw } from "./bank-ui.js";
import { S, askFn, readPart, rebuild, resetPicks } from "./bank-rows.js";
import { aiCatalog } from "../core/taxonomy.js";
import { aiExtract, chunkLines, pdfImages, redactLines } from "./statement-readers.js";
import { aiReady, visionCapable } from "../core/ai.js";
import { esc, fmtDate, money, toast } from "../core/util.js";
import { meta } from "../bills/budget.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { aiSettings, providerOf } from "../core/ai-common.js";
import { compressImage } from "../core/autofill-common.js";

/* ───────────── 账户（哪张卡 / 哪个账户）：每批导入记一个标签，用来看“哪个账户哪几个月已经补过” ─────────────
 * 账户列表 = 以前导入时建的（预算设置 _bank_accounts）+ 账单里有账号尾号 / 信用卡类的账单。不改数据库、不记到每一笔上。 */
export function accounts() {
  const icon = { checking: "🏦 ", savings: "🏦 ", wallet: "📱 ", brokerage: "📈 ", retirement: "🧓 ", hsa: "🩺 ", loan: "🏦 ", cash: "💵 " };
  const cards = (state.cards || []).filter((c) => c.active !== false).map((c) => ({ id: `card:${c.id}`, name: `${icon[c.kind] || ""}${c.name}`, last4: c.last4 || "", src: "card" }));   // 用卡模块里的卡：选它，这批花费就记到这张卡上
  const own = (meta("_bank_accounts", []) || []).filter((a) => !(a.last4 && cards.some((c) => c.last4 === a.last4))).map((a) => ({ ...a, src: "own" }));
  const bills = (state.bills || []).filter((b) => b.category === "credit_card" || b.account_last4).map((b) => ({ id: `bill:${b.id}`, name: b.name, last4: String(b.account_last4 || "").slice(-4), src: "bill" }));
  const seen = new Set([...cards, ...own].map((a) => a.last4).filter(Boolean));
  return [...cards, ...own, ...bills.filter((b) => !(b.last4 && seen.has(b.last4)))];
}
/** 默认「不选择」；只有文件里认出的末四位正好对上一个已有账户时才替你选上它（不再自动预填「新账户」）；用户动过选择就不再改 */
export const NO_ACCT = () => ({ mode: "none", id: "", name: "", last4: "" });
export function suggestAccount() {
  if (S.acctTouched) return;
  const hints = S.parts.map((x) => x.acct).filter(Boolean), last4 = hints.map((h) => h.last4).find(Boolean) || "";
  const hit = last4 ? accounts().find((a) => a.last4 === last4) : null;
  S.account = hit ? { mode: "id", id: hit.id, name: hit.name, last4: hit.last4 } : NO_ACCT();
}
/** 新账户的预填名字：文件里认出的发卡行 + 末四位 */
export const guessAcctName = () => { const hints = S.parts.map((x) => x.acct).filter(Boolean), last4 = hints.map((h) => h.last4).find(Boolean) || "", issuer = hints.map((h) => h.issuer).find(Boolean) || ""; return last4 || issuer ? `${issuer || t("银行卡")}${last4 ? ` **${last4}` : ""}` : ""; };
/** 「这批是哪个账户的」：放在「记住我选的归类」下面、导入按钮上面。选项顺序：不选择 → 新账户… → 已有账户（用卡里的卡 / 以前导入建的 / 账单里带尾号的） */
export function accountHtml() {
  const list = accounts(), a = S.account, cur = a.mode === "id" ? list.find((x) => x.id === a.id) : null;
  const opt = (v, label, on) => `<option value="${esc(v)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  const hint = cur?.src === "own" ? `<button type="button" class="btn btn-sm btn-ghost" data-bank-act="acct-del" data-id="${esc(cur.id)}">${t("从列表删掉这个账户")}</button>`
    : cur?.src === "card" ? `<small class="muted">${t("这是「用卡」里登记的卡：不用了就到 用卡 里停用，这里就不再列出。")}</small>`
    : cur?.src === "bill" ? `<small class="muted">${t("这个账户来自账单里的尾号：到对应账单里清掉尾号或删掉账单，这里就不再列出。")}</small>` : "";
  return `<div class="bank-acct"><label>${t("这批是哪个账户的")}<select data-bank-acct>${opt("none", t("不选择（不记账户）"), a.mode === "none")}${opt("new", t("新账户…"), a.mode === "new")}${list.length ? `<optgroup label="${esc(t("已有账户"))}">${list.map((x) => opt(x.id, `${x.name}${x.last4 && !x.name.includes(x.last4) ? ` **${x.last4}` : ""}`, a.mode === "id" && a.id === x.id)).join("")}</optgroup>` : ""}</select></label>
    ${a.mode === "new" ? `<label>${t("账户名")}<input data-bank-acct-name maxlength="40" value="${esc(a.name)}" placeholder="${esc(t("例如 Chase Freedom **1234"))}"></label>` : ""}
    ${hint ? `<div class="bank-acct-tools">${hint}</div>` : ""}
    <small class="muted">${t("记在这批导入上（不记到每一笔花费上），用来看哪个账户哪几个月已经补过。")}</small></div>`;
}
/** 对账单合计 vs 读出来的：差太多就提示可能漏读 */
export function reconcileHtml(p) {
  const tt = p.totals; if (!tt || tt.purchases == null || !p.rows.length) return "";
  const stated = Math.round((tt.purchases + (tt.fees || 0) + (tt.interest || 0)) * 100) / 100;
  const read = Math.round(p.rows.filter((r) => r.out > 0).reduce((s, r) => s + r.out, 0) * 100) / 100, diff = Math.round((stated - read) * 100) / 100;
  return Math.abs(diff) < 0.015 ? ` · <span style="color:var(--ok)">✓ ${t("和对账单合计对上")}</span>` : ` · <b class="bank-dup">${t("对账单写的消费 {a}（含手续费 / 利息），读出 {b}，差 {d}——可能漏读或多读了几行，核对一下或用 AI 解析", { a: money(stated), b: money(read), d: money(diff) })}</b>`;
}
/** 各账户最近补到哪天（2026-11-03 第二版：去掉了 12 个月的 ✓ / ◐ 覆盖表）。
 * 覆盖表靠每批的 from / to 推断哪几天补过，但 from / to 只是文件里第一笔和最后一笔交易的日期，不是对账单周期：
 * 账单开头 / 结尾几天没交易、早期批次没记日期或没选账户、只保留最近 BATCH_KEEP 批，都会被画成「缺」，看起来很确定、其实不准。
 * 现在每个账户只说一件靠得住的事：导入过的最晚一笔交易是哪天、离今天几天、上次是哪天导入的；最久没补的排前面。
 * 不判断中间有没有缺——要核对，用下面的账户筛选看这个账户的每一批。导入的几笔后来全删了的批次不算。 */
const DAY_MS = 864e5;
const dayN = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };
   // 按 UTC 的日数算，不受时区影响
const STALE_DAYS = 35;
   // 月结账户超过一个账单周期没补，提示一下
export function coverageHtml(batches) {
  const gone = (b) => { const L = b.tagged ? LIVE.get(b.id) : null; return L && !L.sn && !L.in && ((b.n ?? 0) > 0 || (b.inN || 0) > 0); };
  const by = new Map();
  for (const b of batches) {
    const k = batchAcctKey(b); if (!k || !b.to || gone(b)) continue;
    const x = by.get(k) || { name: k, to: "", at: "" };
    if (b.to > x.to) x.to = b.to; if ((b.at || "") > x.at) x.at = b.at || "";
    by.set(k, x);
  }
  if (!by.size) return "";
  const now = new Date(), todayN = dayN(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
  const list = [...by.values()].map((x) => ({ ...x, ago: Math.max(0, todayN - dayN(x.to)) })).sort((p, q) => q.ago - p.ago || p.name.localeCompare(q.name));
  const row = (x) => { const stale = x.ago > STALE_DAYS;
    return `<li class="bank-last${stale ? " stale" : ""}"><b>${esc(x.name)}</b><span>${t("补到 {d}", { d: fmtDate(x.to) })} · <span class="${stale ? "bank-dup" : "muted"}">${x.ago === 0 ? t("今天") : t("{n} 天前", { n: x.ago })}</span>${x.at ? ` · <span class="muted">${t("上次导入 {d}", { d: fmtDate(x.at.slice(0, 10)) })}</span>` : ""}</span></li>`; };
  return `<div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("各账户最近补到哪天")}</h3><ul class="bank-last-list">${list.map(row).join("")}</ul>
    <p class="muted" style="margin:6px 0 0;font-size:12.5px">${t("按每个账户导入过的最晚一笔交易算；超过 {n} 天标出来。只说明最近补到哪，不判断中间有没有漏——要核对某个账户，用下面的账户筛选看它的每一批。", { n: STALE_DAYS })}</p></div>`;
}
export async function ingest(files) {
  S.error = ""; S.last = null;
  for (const f of files) {
    try { S.parts.push(await readPart(f)); }
    catch (err) { S.error = t("读不了 {name}：{msg}", { name: f.name, msg: err.message }); }
  }
  suggestAccount(); resetPicks(); rebuild();
}
/* ───────────── AI 解析（PDF 对账单 / 截图 / 扫描件 / 粘贴的文字） ───────────── */
/** 给 AI 的分类表：三级分类树（id=名称（一级 / 二级）），含转账、投资、资本性；见 js/core/taxonomy.js */
const catalog = () => aiCatalog();
export async function aiParse(i) {
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
