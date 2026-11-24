/* 银行对账单导入：界面和「最近导入」的统计。 */
import { AA_BACK, redundantRules, ruleCat, ruleUse, staleRules, userRules } from "./bank-transfers.js";
import { BATCH_KEEP, S, tableRows } from "./bank-rows.js";
import { NO_ACCT, accountHtml, coverageHtml, reconcileHtml } from "./bank-accounts-ai.js";
import { Store } from "../core/store.js";
import { adults, kindOptionsHtml, myPersonId } from "../income/logic.js";
import { aiReady } from "../core/ai.js";
import { esc, money, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { isIncomeKind } from "../core/income-taxonomy.js";
import { meta, saveMeta } from "../bills/budget.js";
import { pageLimit } from "../core/pager.js";
import { t } from "../core/i18n.js";
import { tidyHintHtml } from "./payees.js";
import { bankHooks } from "./bank-common.js";
import { categoryOptions } from "../pantry/meals-sync.js";

/* ───────────── 界面 ───────────── */
const rangeOf = (rows) => { const d = rows.map((r) => r.date).sort(); return d.length ? `${d[0]} → ${d.at(-1)}` : ""; };
/** 分类下拉：和手动记一笔同一份（categoryOptions 的 spend 模式 = js/core/taxonomy.js 的三级分类，含账单、医疗、转账） */
const catOpts = (sel) => `<option value="" ${!sel ? "selected" : ""}>${esc(t("— 请选择 —"))}</option>${categoryOptions(sel, { withOther: true, spend: true })}`;
/** 疑似已记录的几笔：每笔写出对上的是哪条已有花费，核对过确实不是重复的，勾上「仍然导入」就不再跳过 */
const dupListHtml = (rows) => '<details class="bank-dups" ' + (rows.some((r) => r.forced) ? "open" : "") + '><summary>' + t("核对 / 取消跳过") + '</summary><ul class="plain small" style="margin:6px 0 0">'
  + rows.map((r) => '<li><label class="check-inline"><input type="checkbox" data-bank-force="' + esc(r.fk) + '" ' + (r.forced ? "checked" : "") + '><span>' + t("仍然导入") + ' · ' + esc(r.date) + ' · ' + money(r.out) + ' · <span class="muted">' + esc(t("对上的：{x}", { x: r.dupOf })) + '</span></span></label></li>').join("") + '</ul></details>';
/** 中档：合计差一点（小费 / 折扣）且商店对上，照常导入，只提醒 */
const weakHint = (rows) => { const w = rows.filter((r) => r.tripWeak); return w.length ? ` · <span class="bank-src" title="${esc(w.map((r) => `${r.date} ${money(r.out)} → ${r.tripWeak}`).join("\n"))}">${t("{n} 笔可能已记录过（小票 / 账单缴费），请核对", { n: w.length })}</span>` : ""; };
function groupRow(g) {
  const inc = !!S.include[g.id], dups = g.rows.filter((r) => r.dup).length, n = g.rows.length, matched = g.rows.filter((r) => r.dupOf);
  const sel = `<select data-bank-cat="${esc(g.id)}" aria-label="${esc(t("分类"))}">${catOpts(S.pick[g.id])}</select>`;   // 默认跳过的也能勾上、选个分类导入
  return `<li class="bank-row${g.skip ? " is-skip" : ""}"><label class="bank-chk"><input type="checkbox" data-bank-inc="${esc(g.id)}" ${inc ? "checked" : ""} aria-label="${esc(t("导入"))}"></label>
    <div class="grow"><span class="name">${esc(g.name)}</span><small>${t("{n} 笔", { n })} · ${money(g.total)} · ${esc(rangeOf(g.rows))}${weakHint(g.rows)}${g.rows.every((r) => r.p2p) && !S.pick[g.id] ? ` · <span class="bank-src">${t("Zelle / Venmo 转出：替你付的、上门维修等选实际的分类；借给朋友 / 还朋友的钱选「借贷本金」，不算消费")}</span>` : ""}${g.src === "learned" ? ` · <span class="bank-src" title="${esc(t("上次你给这家选的分类；改了会记住新的"))}">${t("上次你选的")}</span>` : g.src === "ai" ? ` · <span class="bank-src">${t("AI 猜的")}</span>` : g.src === "bill" ? ` · <span class="bank-src">${t("按账单收款方")}</span>` : ""}${dups ? ` · <b class="bank-dup">${t("{k} 笔疑似已记录，会跳过", { k: dups })}</b>` : ""}</small>${matched.length ? dupListHtml(matched) : ""}</div>${sel}</li>`;
}
const incChosen = () => { let n = 0, sum = 0; for (const g of S.groups) { if (!g.inc || !S.include[g.id] || S.ikind[g.id] === AA_BACK) continue; for (const r of g.rows) { if (r.idup && !r.forced) continue; n++; sum += -r.out; } } return { n, sum: Math.round(sum * 100) / 100 }; };
export const incWho = () => S.incPerson ?? (myPersonId() || "none");
function incomeRow(g) {
  const on = !!S.include[g.id], dups = g.rows.filter((r) => r.idup).length, matched = g.rows.filter((r) => r.dupOf), unsure = g.rows.every((r) => r.incUnsure);
  const aa = S.ikind[g.id] === AA_BACK;
  const kinds = `<optgroup label="${esc(t("不算收入"))}"><option value="${AA_BACK}" ${aa ? "selected" : ""}>${esc(t("支出退回（AA / 垫付还回）→ 负数花费"))}</option></optgroup>${kindOptionsHtml(aa ? "" : S.ikind[g.id] || "other")}`;   // 收入类型按「一级 · 叶子」分组，和 收入 → 明细 同一个下拉
  const capNote = aa ? ` · <span class="bank-src">${t("不算收入：记成所选分类的负数花费，抵掉你先付的那部分")}</span>${S.rcat[g.id] ? "" : ` · <b class="bank-dup">${t("选个花费分类才会导入")}</b>`}`
    : isIncomeKind(S.ikind[g.id] || "other") ? "" : ` · <span class="bank-src">${t("资本流入：记下来，但不算收入")}</span>`;
  return `<li class="bank-row"><label class="bank-chk"><input type="checkbox" data-bank-inc="${esc(g.id)}" ${on ? "checked" : ""} aria-label="${esc(t("导入"))}"></label>
    <div class="grow"><span class="name">${esc(g.name)}</span><small>${t("{n} 笔", { n: g.rows.length })} · ${money(-g.total)} · ${esc(rangeOf(g.rows))}${unsure ? ` · <span class="bank-src">${t("只写着转账 / 存款，看不出来源，默认没勾")}</span>` : ""}${capNote}${dups ? ` · <b class="bank-dup">${t("{k} 笔疑似已记录，会跳过", { k: dups })}</b>` : ""}</small>${matched.length ? dupListHtml(matched) : ""}</div>
    <div class="bank-ipick"><select data-bank-ikind="${esc(g.id)}" aria-label="${esc(t("收入类型"))}">${kinds}</select>${aa ? `<select data-bank-rcat="${esc(g.id)}" aria-label="${esc(t("退回到哪个花费分类"))}">${catOpts(S.rcat[g.id])}</select>` : ""}</div></li>`;
}
const incomeSection = (list) => (list.length ? `<section class="section"><div class="section-head"><h2>💵 ${t("收入 / 入账")}（${list.length}）</h2><p>${t("工资、电汇、赠与等：勾上的会记进「财务 → 收入」，不会算进花费。Zelle / Venmo 转入、报销默认是「支出退回」（朋友 AA 还你、替人垫付后还回）：记成负数花费，不算收入；真是赠与或副业收款就在下拉里改。自己账户之间的转账已自动跳过；商家退款仍按负花费算。")}</p></div>
  <div class="panel"><label class="tb-field" style="margin-bottom:8px"><span>${t("这些收入记给谁")}</span><select data-bank-iperson data-nosearch><option value="none" ${incWho() === "none" ? "selected" : ""}>${t("未指定 / 全家")}</option>${adults().map((p) => `<option value="${p.id}" ${incWho() === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
  <ul class="restock-list bank-list">${list.map(incomeRow).join("")}</ul></div></section>` : "");
const chosen = () => {
  let n = 0, sum = 0;
  for (const g of S.groups) {
    if (g.inc) { if (S.include[g.id] && S.ikind[g.id] === AA_BACK && S.rcat[g.id]) for (const r of g.rows) { if (r.idup && !r.forced) continue; n++; sum += r.out; } continue; }   // 支出退回：负数花费
    if (!S.include[g.id] || !S.pick[g.id]) continue; for (const r of g.rows) { if (r.dup) continue; n++; sum += r.out; }
  }
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
  const head = `<div class="panel bank-pick"><p class="muted small" style="margin:0 0 8px">${t("一份对账单，花费和收入一次导入：刷卡 / 扣款记成花费；入账（工资、电汇、Zelle 转入…）单独列在「收入」一栏，勾上就记成收入（只有家主和被允许的人看得到）；信用卡还款、自己账户之间的转账跳过。")}</p><p style="margin:0 0 8px">${t("从银行或信用卡网站下载对账单，选中文件：支持 CSV、Excel、OFX / QFX、QIF，以及 PDF 月结单、截图（PDF 先用本地规则读，读不准再用 AI）。可以一次选多个月。文件只在你的浏览器里处理；只有你点“用 AI 解析”才会把内容发给你设置的模型。")}</p>
    <label class="btn btn-primary btn-sm" style="cursor:pointer">${t("选择文件（可多选）")}<input type="file" id="bankFile" multiple accept=".csv,.tsv,.txt,.xlsx,.xls,.ofx,.qfx,.qif,.pdf,image/*,text/csv,text/plain,application/pdf" hidden></label>
    <details class="bank-paste" style="margin-top:8px"><summary>${t("或者直接粘贴文字")}</summary><textarea id="bankPaste" data-autosize rows="5" placeholder="${esc(t("把网银页面或 PDF 里的交易几行直接复制粘贴到这里"))}" style="margin-top:6px"></textarea>
      <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-sm" data-bank-act="paste">${t("读取这段文字")}</button></div></details>
    ${partsHtml()}${S.error ? `<p class="form-error" role="alert">${esc(S.error)}</p>` : ""}</div>`;
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
  const todo = S.groups.filter((g) => !g.skip && !S.pick[g.id]), auto = S.groups.filter((g) => !g.skip && S.pick[g.id]), skipped = S.groups.filter((g) => g.skip && !g.inc), incs = S.groups.filter((g) => g.inc);
  const c = chosen(), ic = incChosen();
  return `${head}${mapping}
    <div class="panel bank-sum"><b>${t("将导入 {n} 笔，合计 {m}", { n: c.n, m: money(c.sum) })}</b>${ic.n ? ` · <b>${t("另有 {n} 笔收入，合计 {m}", { n: ic.n, m: money(ic.sum) })}</b>` : ""}<div class="muted" style="font-size:13px">${t("信用卡还款、转账、收入默认不导入（不是花费）；和已有花费对得上的会自动跳过。")}</div></div>
    ${todo.length ? `<section class="section"><div class="section-head"><h2>${t("请归类")}（${todo.length}）</h2><p>${t("按商家合并，选一次就管这个商家的所有笔。认不出的不选就不会导入。")}</p></div><div class="panel"><ul class="restock-list bank-list">${todo.map(groupRow).join("")}</ul></div></section>` : ""}
    ${auto.length ? `<section class="section"><details class="ref-panel panel" ${todo.length ? "" : "open"}><summary><b>${t("已自动归类")}</b><small>${t("{n} 个商家，可以改", { n: auto.length })}</small><span class="ui-chev" aria-hidden="true">›</span></summary><ul class="restock-list bank-list ref-body">${auto.map(groupRow).join("")}</ul></details></section>` : ""}
    ${incomeSection(incs)}
    ${skipped.length ? `<section class="section"><details class="ref-panel panel"><summary><b>${t("默认跳过")}</b><small>${t("还款 / 转账 / 收入")}</small><span class="ui-chev" aria-hidden="true">›</span></summary><ul class="restock-list bank-list ref-body">${skipped.map(groupRow).join("")}</ul></details></section>` : ""}
    <div class="panel bank-go"><label class="check-inline"><input type="checkbox" data-bank-remember ${S.remember ? "checked" : ""}><span>${t("记住我选的归类（下次同一商家自动归类，全家共用）")}</span></label>
      ${accountHtml()}
      <div class="form-actions"><button type="button" class="btn btn-primary" data-bank-act="import" ${(c.n || ic.n) && !S.busy ? "" : "disabled"}>${S.busy ? t("导入中…") : ic.n ? t("导入 {n} 笔花费 + {m} 笔收入", { n: c.n, m: ic.n }) : t("导入 {n} 笔", { n: c.n })}</button></div></div>
    ${S.last ? `<div class="panel" role="status"><b>${t("已导入 {n} 笔，合计 {m}", { n: S.last.n, m: money(S.last.sum) })}</b> <button type="button" class="btn btn-sm btn-ghost" data-bank-act="undo-last">${t("撤销这批")}</button>${tidyHintHtml()}</div>` : ""}
    ${batchesHtml(batches)}`;
}
/** 记住的归类规则：列出来、可逐条删或全部清除（归错了一次又勾了「记住」，不清掉会一直错） */
function rulesHtml() {
  const rules = userRules(), keys = Object.keys(rules); if (!keys.length) return "";
  const nameOf = (id) => { const c = [...window.CATEGORIES, ...window.BILLS_GROUP.cats(), ...window.LIFE_CATS, ...window.WORK_CATS, ...window.TRAVEL_CATS, window.GROCERY_MISC, window.FEES_CAT, window.VEHICLE_FUEL, window.MAINT_CAT, window.VEHICLE_CAT, window.MEDICAL_GROUP, window.PET_CARE_CAT, window.OTHER_CAT].find((x) => x && x.id === id); return c ? `${c.icon} ${t(c.name)}` : id; };
  return `<details class="ref-panel panel" style="margin-top:10px"><summary><b>${t("记住的归类")}</b><small>${t("{n} 家商家", { n: keys.length })}</small><span class="ui-chev" aria-hidden="true">›</span></summary>
    <div class="ref-body"><p class="muted" style="margin:0 0 6px;font-size:12.5px">${t("导入时勾了「记住我选的归类」后，这些商家下次自动按这里归。归错了就删掉这一条（或在导入清单里改选，会记住新的）。")}</p>
    <ul class="restock-list">${keys.sort((a, b) => ruleUse(rules[b]).t.localeCompare(ruleUse(rules[a]).t) || a.localeCompare(b)).map((k) => { const u = ruleUse(rules[k]); return `<li><div class="grow"><span class="name">${esc(k)}</span><small>${esc(nameOf(ruleCat(rules[k])))}${u.t ? ` · ${t("用过 {n} 次 · 最近 {d}", { n: u.n, d: u.t })}` : ""}</small></div><button type="button" class="btn btn-sm btn-ghost" data-bank-act="rule-del" data-key="${esc(k)}" aria-label="${esc(t("删除这条"))}">✕</button></li>`; }).join("")}</ul>
    <div class="form-actions" style="margin-top:8px">${redundantRules().length ? `<button type="button" class="btn btn-sm" data-bank-act="rules-tidy" title="${esc(t("你记的分类和内置关键词现在给的一样，删了结果不变"))}">${t("清理多余规则（{n}）", { n: redundantRules().length })}</button>` : ""}${staleRules().length ? `<button type="button" class="btn btn-sm btn-ghost" data-bank-act="rules-stale">${t("清理 90 天没用到的（{n}）", { n: staleRules().length })}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-bank-act="rules-clear">${t("全部清除")}</button></div>
    <p class="muted" style="margin:6px 0 0;font-size:12px">${t("最多记 400 条，满了先淘汰最久没用到的。")}</p></div></details>`;
}
const tipsHtml = () => `<div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("怎么归类？")}</h3><ul class="plain small" style="margin:0">
    <li>${t("只有一笔刷卡 / 扣款、没有小票也没关系：按商家名自动归类（超市、餐饮、加油、水电网、订阅、机票酒店…），认不出的你选一次，之后记住。")}</li>
    <li>${t("信用卡还款、自己账户之间的转账（活期 ↔ 储蓄）跳过——否则会重复算一遍。除此之外钱出去了就算花费：转给别人（Zelle / Venmo / 电汇）、取现、转到别的账户（如 Robinhood）都会按花费记（默认分到“其他”，可以改）。钱进来的（工资、电汇、Zelle / Venmo 的 from、退税…）单独列在「收入」一栏，勾上就记成收入；商家退款记成负数花费。")}</li>
    <li>${t("分类按买的是什么，不按在哪家店买：买菜 → 食品杂货；纸巾、洗洁精、洗发水 → 日用个护；衣服鞋子 → 服饰鞋包；下馆子、外卖、咖啡 → 餐饮。银行流水里看不出买了什么的：买菜的超市（H Mart、Weee、Kroger…）算“超市买菜（未细分）”；Costco、Walmart、Target、Amazon 这类什么都卖的算“综合购物（待细分）”，改过一次这家就记住了。")}</li>
    <li>${t("退款（卡上入账的退货）会记成负数花费，统计按净额算。")}</li>
    <li>${t("以前已经手动记过的花费（日期差 3 天内、金额一样）自动跳过，所以同一个文件导两次也不会重复。")}</li>
    <li>${t("导入错了可以整批撤销。银行的 CSV 格式很多，列认错了可以手动选；国内银行的 GBK 编码也认得。")}</li></ul></div>`;
/** 手动改一批的起止日期（AI 没读出日期、或读错了年份）：只改这一批的记录，覆盖表按它算；不动每一笔花费的日期 */
const datesEditHtml = (b) => '<div class="bank-dates-edit" style="flex:1 1 100%;display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:6px">'
  + '<label>' + t("起") + '<input type="date" name="bfrom" value="' + esc(b.from || "") + '"></label>'
  + '<label>' + t("止") + '<input type="date" name="bto" value="' + esc(b.to || "") + '"></label>'
  + '<button type="button" class="btn btn-sm btn-primary" data-bank-act="dates-save" data-batch="' + esc(b.id) + '">' + t("保存") + '</button>'
  + '<button type="button" class="btn btn-sm btn-ghost" data-bank-act="dates-cancel">' + t("取消") + '</button>'
  + '<small class="muted" style="flex-basis:100%">' + t("只改这批记录的起止日期（“各账户已补到哪个月”按它算），不改每一笔花费的日期。") + '</small></div>';
export async function saveBatchDates(id, li) {
  const from = li.querySelector('[name="bfrom"]')?.value || "", to = li.querySelector('[name="bto"]')?.value || "";
  if (!from || !to) return toast(t("起止日期都要填"));
  if (from > to) return toast(t("起始日期不能晚于结束日期"));
  const all = (meta("_bank_batches", []) || []).map((b) => (b.id === id ? { ...b, from, to, datesEdited: true } : b));
  try { await saveMeta({ _bank_batches: all }); S.editDates = ""; toast(t("已更新这批的日期：{a} → {b}", { a: from, b: to })); }
  catch (e) { return toast(t("保存失败：{msg}", { msg: e.message })); }
  if (bankHooks.refresh) await bankHooks.refresh(); redraw();
}
/* ── 「最近导入」的统计（2026-11-02 重新设计）──
 * 以前每批显示的「N 笔 · 合计」是导入那一刻存下的快照：之后在「查看 / 修改」里删了、改了金额，或者整批撤销了一部分，这里还是旧数字，和点进去看到的对不上。
 * 现在：笔数和合计按现在还带着这批标记的花费 / 收入实时算（Store.batchTotals，只读当前这一页的几批、两列），和「查看」页的合计同一口径（净额，退款是负数）；
 * 和导入时不一样就在后面注一句「导入时 N 笔」。早期没有批次标记的批次（只存了 id 列表）照旧显示快照。数字读到前先显示快照。 */
export const LIVE = new Map();
   // 批次 id → { sn, ss, in, is }（in / is = null：没有收入权限）
let liveBusy = false;
if (typeof window !== "undefined") for (const ev of ["spend-rows-changed", "income-rows-changed", "income-data-changed"]) window.addEventListener(ev, () => LIVE.clear());
function ensureLive(list) {
  const ids = list.filter((b) => b.tagged && !LIVE.has(b.id)).map((b) => b.id);
  if (!ids.length || liveBusy) return;
  liveBusy = true;
  Store.batchTotals(ids).then((r) => { for (const id of ids) LIVE.set(id, { sn: r.spend[id]?.n ?? 0, ss: r.spend[id]?.sum ?? 0, in: r.inc ? r.inc[id]?.n ?? 0 : null, is: r.inc ? r.inc[id]?.sum ?? 0 : null }); })
    .catch((e) => console.warn("[batch totals]", e.message))
    .finally(() => { liveBusy = false; redraw(); });
}
/** 一批现在的数字：{ n, sum, inN, inSum, changed, live } */
function batchNums(b) {
  const L = b.tagged ? LIVE.get(b.id) : null, n0 = b.n ?? b.ids?.length ?? 0;
  if (!L) return { n: n0, sum: b.sum || 0, inN: b.inN || 0, inSum: b.inSum || 0, changed: false, live: false };
  const inN = L.in ?? (b.inN || 0), inSum = L.is ?? (b.inSum || 0);
  return { n: L.sn, sum: L.ss, inN, inSum, live: true, changed: L.sn !== n0 || Math.abs(L.ss - (b.sum || 0)) >= 0.005 || (L.in != null && L.in !== (b.inN || 0)) };
}
const batchRow = (b) => {
  const x = batchNums(b), n0 = b.n ?? b.ids?.length ?? 0, can = (b.tagged && (x.n || x.inN)) || b.ids?.length;
  const gone = b.tagged && x.live && !x.n && !x.inN && (n0 || b.inN);   // 导入的那几笔后来全删了
  const stats = [b.from ? `${esc(b.from)} → ${esc(b.to)}` : null, x.n || !x.inN ? `${t("花费 {n} 笔", { n: x.n })} ${money(x.sum)}` : null, x.inN ? `${t("收入 {n} 笔", { n: x.inN })} ${money(x.inSum)}` : null].filter(Boolean).join(" · ");
  const note = gone ? t("（导入的都已删除）") : x.changed ? t("（导入时 {n} 笔 {m}，之后改过）", { n: n0, m: money(b.sum || 0) }) : !b.tagged && !b.ids?.length ? (n0 === 0 ? t("（都是已记录过的，只更新了补到哪个月）") : t("（早期批次，只留了汇总）")) : b.tagged && n0 === 0 && !b.inN ? t("（都是已记录过的，只更新了补到哪个月）") : "";
  return `<li><div class="grow"><span class="name">${b.account ? `🏦 ${esc(b.account)}${b.last4 ? ` <span class="muted">··${esc(b.last4)}</span>` : ""}` : esc(b.file || t("银行导入"))}</span>
    <small class="bank-batch-stats">${stats}${note ? ` <span class="${x.changed || gone ? "bank-dup" : "muted"}">${note}</span>` : ""}</small>
    <small class="muted">${t("导入于 {d}", { d: String(b.at).slice(0, 10) })}${b.account && b.file ? ` · ${esc(b.file)}` : ""}</small></div>
    <span class="bank-batch-acts">${can ? `${x.n > 0 || (!x.inN && b.ids?.length) ? `<a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}?tab=records&batch=${esc(b.id)}">${x.inN ? t("查看花费") : t("查看 / 修改")}</a>` : ""}${x.inN ? `<a class="btn btn-sm btn-ghost" href="${href("bills", "income")}?tab=records&batch=${esc(b.id)}">${t("查看收入")}</a>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-bank-act="undo" data-batch="${esc(b.id)}">${t("撤销")}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-bank-act="dates-edit" data-batch="${esc(b.id)}" title="${esc(t("AI 没读出日期、或读错了时，手动填这批的起止日期"))}">${t("改日期")}</button></span>${S.editDates === b.id ? datesEditHtml(b) : ""}</li>`;
};
export const batchAcctKey = (b) => (b.account ? `${b.account}${b.last4 ? ` ··${b.last4}` : ""}` : "");
const batchesHtml = (batches) => {
  const lost = batches.filter((b) => !b.tagged && !b.ids?.length).length;   // 早期批次：没有批次标记、花费 id 列表也被丢掉了
  const accts = [...new Set(batches.map(batchAcctKey).filter(Boolean))].sort(), hasNone = batches.some((b) => !batchAcctKey(b));
  if (S.batchAcct !== "all" && S.batchAcct !== "__none__" && !accts.includes(S.batchAcct)) S.batchAcct = "all";
  const all = batches.slice().reverse().filter((b) => S.batchAcct === "all" || (S.batchAcct === "__none__" ? !batchAcctKey(b) : batchAcctKey(b) === S.batchAcct));
  const lim = pageLimit("bank-batches", S.batchAcct), head = all.slice(0, lim), rest = all.length - head.length;   // 全站每页条数（pager.js）；换账户回到一页
  ensureLive(head);   // 只给这一页的几批读实时数字
  const nOf = (pred) => batches.filter(pred).length;
  const opt = (v, l) => `<option value="${esc(v)}" ${S.batchAcct === v ? "selected" : ""}>${esc(l)}</option>`;
  const recover = `<p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("以前导入过、这里却没有的批次（记录丢了或迁移前导入的）：")}<button type="button" class="btn btn-sm btn-ghost" data-bank-act="recover" style="margin-left:4px">${t("找回批次")}</button></p>`;
  if (!batches.length) return `<section class="section"><div class="panel">${recover}</div></section>`;
  return `<section class="section"><div class="section-head"><h2>${t("最近导入")}</h2><p>${t("「查看 / 修改」打开这一批的明细，每一笔都能改分类、金额、商店或删掉；「撤销」整批删除。")}</p></div>${coverageHtml(batches)}<div class="panel" style="margin-top:10px">${lost ? `<div class="notice" role="status" style="margin-bottom:8px"><b>${t("有 {n} 批早期导入只留了汇总，不能查看 / 修改 / 撤销。", { n: lost })}</b><br><small>${t("这是迁移 034 之前导入的（那时只保留最近 6 批的明细）。先在 Supabase 执行 034_purchase_import_batch.sql，再点下面的按钮：按导入时间和笔数把它们的花费找回来、补上批次标记，之后和新的批次一样。笔数对不上的会跳过，不会乱标。")}</small><div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-sm" data-bank-act="recover">${t("找回早期批次")}</button></div></div>` : ""}
    ${accts.length > 1 || hasNone ? `<div class="bank-acct-bar"><span class="bab-ico" aria-hidden="true">🏦</span><select data-bank-batch-acct aria-label="${esc(t("按账户筛选"))}">${opt("all", t("全部账户（{n} 批）", { n: batches.length }))}${accts.map((a) => opt(a, `${a}（${t("{n} 批", { n: nOf((b) => batchAcctKey(b) === a) })}）`)).join("")}${hasNone ? opt("__none__", `${t("没记账户")}（${t("{n} 批", { n: nOf((b) => !batchAcctKey(b)) })}）`) : ""}</select></div>` : ""}
    <ul class="restock-list bank-batches">${head.map(batchRow).join("")}</ul>
    <p class="muted bank-batch-count">${t("显示 {a} / 共 {b} 批", { a: head.length, b: all.length })}${batches.length >= BATCH_KEEP ? ` · ${t("只保留最近 {n} 批的记录；更早的花费 / 收入都还在，只是不在这里列出、不能整批撤销", { n: BATCH_KEEP })}` : ""}</p>
    ${rest ? `<div class="form-actions" style="justify-content:center;margin-top:4px"><button type="button" class="btn btn-ghost" data-bank-act="batches-more">${t("继续加载")}</button></div>` : ""}
    ${lost ? "" : recover}</div></section>`;
};
export function bankImportTab() { return `<section class="section" id="bankImport">${panelHtml()}</section>`; }
export const redraw = () => { const el = document.getElementById("bankImport"); if (el) el.innerHTML = panelHtml(); };
/** 删掉以前导入时建的账户（只删 _bank_accounts 里这一条）：已导入的批次存的是账户名字和尾号文字，不是 id，所以「最近导入」和按账户筛选都不受影响；
 *  用卡里的卡 / 账单里的尾号不在这里删（分别到 用卡 停用、到账单里改）。删掉后这个尾号的「自己账户之间的转账」不再自动认出。 */
export async function deleteOwnAccount(id) {
  const list = meta("_bank_accounts", []) || [], a = list.find((x) => x.id === id); if (!a) return;
  const used = (meta("_bank_batches", []) || []).filter((b) => b.account === a.name).length;
  if (!confirm(used ? t("从列表删掉「{n}」？已经导入的 {k} 批不受影响（批次上记的是账户名字），只是以后选不到它。", { n: a.name, k: used }) : t("从列表删掉「{n}」？", { n: a.name }))) return;
  try { await saveMeta({ _bank_accounts: list.filter((x) => x.id !== id) }); if (S.account.id === id) { S.account = NO_ACCT(); S.acctTouched = true; } toast(t("已删除")); }
  catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); }
  redraw();
}
