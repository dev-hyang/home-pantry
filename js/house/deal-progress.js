/* 交易进展：计划（模板基线）和实际分开看。
 * · 基线：填了合同日（租赁归还是归还日）后，把每个模板事项当时推算出的日期冻结存下来（property_deals.baseline）。之后改合同日 / 交割日、单步改期，原来的参考都还在。
 * · 实际：清单勾选的完成日期 + 「进展记录」（deal_events：和卖方律师改合同、联系 ComEd 停服务……可以关联清单事项，也可以不关联）。
 * · 偏差由这里直接算（实际 − 基线）；预计（forecast）只顺延依赖它的后续步骤（data/deals.js 的 DEPS），不相干的步骤不动。
 * · AI 只在点「帮我分析」时读已经算好的偏差（日期和天数），给风险和下一步；要先勾选同意，自定义事项和进展内容不发送。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { DAY, esc, fmtDate, fmtShort, todayISO, toast } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { addDays } from "../bills/logic.js";
import { aiReady, askText } from "../core/ai.js";

const D = () => window.DEALS;
const PRIO_CLS = { must: "b-out", should: "b-soon", optional: "" };
const dayDiff = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / DAY);
const md = (iso) => (iso ? fmtShort(`${iso}T12:00:00`) : "");

/** 基线什么时候冻结：有了合同日（租赁归还没有合同日，用归还日） */
export const gateDate = (deal) => (deal.kind === "veh_return" ? deal.closing_on : deal.contract_on) || null;

/* ───────────── 基线 ───────────── */
const freezing = new Set(), failed = new Set();
/** 还有没冻结的模板日期（有推荐日期、基线里没有）吗 */
export function needsFreeze(deal, tasks) {
  if (deal.outcome || state.noBaselineCol || failed.has(deal.id) || !gateDate(deal)) return false;
  const b = deal.baseline || {};
  return !b._at || tasks.some((x) => !x.custom && x.plan && !b[x.key]) || (deal.closing_on && !b._closing_on) || (deal.contract_on && !b._contract_on);
}
/** 冻结基线：只补还没有的，已经冻结的不改（改期是「预计」，不是改基线） */
export async function freezeBaseline(deal, tasks) {
  if (!needsFreeze(deal, tasks) || freezing.has(deal.id)) return false;
  freezing.add(deal.id);
  try {
    const cur = deal.baseline || {}, next = { ...cur, _at: cur._at || new Date().toISOString() };
    for (const x of tasks) if (!x.custom && x.plan && !next[x.key]) next[x.key] = x.plan;
    if (deal.contract_on && !next._contract_on) next._contract_on = deal.contract_on;
    if (deal.closing_on && !next._closing_on) next._closing_on = deal.closing_on;
    await Store.saveDeal({ ...deal, baseline: next });
    const live = state.deals.find((d) => d.id === deal.id); if (live) live.baseline = next;   // 内存里同步，不用整页刷新
    deal.baseline = next;
    return true;
  } catch (e) { failed.add(deal.id); console.warn("[deal baseline]", e.message); return false; }
  finally { freezing.delete(deal.id); }
}

/* ───────────── 偏差与预计 ───────────── */
export const eventsOf = (deal) => (state.dealEvents || []).filter((e) => e.deal_id === deal.id)
  .sort((a, b) => a.happened_on.localeCompare(b.happened_on) || String(a.created_at).localeCompare(String(b.created_at)));

/** 给每个事项补上：基线、实际完成日、预计完成日、偏差天数、已晚天数、被哪些没做的前置步骤卡住。tasks 来自 dealTasks（x.baseline 已有） */
export function analyze(deal, tasks) {
  const today = todayISO(), deps = D().DEPS?.[deal.kind] || {}, byKey = new Map(tasks.map((x) => [x.key, x])), memo = new Map();
  const base = (x) => x.baseline || null;
  const eff = (x) => {   // 这一步的实际 / 预计完成日
    if (memo.has(x.key)) return memo.get(x.key);
    memo.set(x.key, x.done?.done_on || x.due || null);   // 先占位，防止依赖成环
    let v;
    if (x.skipped) v = null;
    else if (x.done) v = x.done.done_on;
    else {
      v = x.due || null;
      for (const k of deps[x.key] || []) {
        const d = byKey.get(k); if (!d || d.skipped) continue;   // 跳过的前置步骤不拖后面
        const de = eff(d), b0 = base(x), bd = base(d); if (!de || !b0 || !bd) continue;
        const from = d.done ? de : de < today ? today : de;   // 没做完的前置步骤，最早也是今天才能做完
        const cand = addDays(from, Math.max(0, dayDiff(b0, bd)));   // 保持模板里两步之间的间隔
        if (!v || cand > v) v = cand;
      }
    }
    memo.set(x.key, v); return v;
  };
  const evs = eventsOf(deal);
  const rows = tasks.map((x) => {
    const off = !!x.skipped, baseline = base(x), actual = x.done?.done_on || null, forecast = x.done || off ? null : eff(x), ref = actual || forecast;
    const held = x.done || off ? [] : (deps[x.key] || []).map((k) => byKey.get(k)).filter((d) => d && !d.done && !d.skipped && d.baseline && d.baseline < today).map((d) => d.name);
    return { ...x, baseline, actual, forecast, slip: !off && baseline && ref ? dayDiff(ref, baseline) : null, lateNow: !x.done && !off && baseline && baseline < today ? dayDiff(today, baseline) : 0, held,
      prog: !x.done && !off && evs.some((e) => (e.task_keys || []).includes(x.key)) };   // 进行中：已经记过进展、还没完成
  });
  const overdue = rows.filter((r) => r.lateNow > 0).sort((a, b) => b.lateNow - a.lateNow || (a.baseline || "").localeCompare(b.baseline || ""));
  const ms = rows.find((r) => r.key === D().MILESTONE?.[deal.kind]) || null;
  const skipped = rows.filter((r) => r.skipped).length;
  return { rows, overdue, skipped, done: rows.filter((r) => r.done).length, total: rows.length - skipped, late: rows.filter((r) => r.slip > 0).length, ms };
}

/** 进展记录 + 没有被记录覆盖的清单完成，按时间正序（和计划方向一致） */
export function actualEntries(deal, rows) {
  const evs = eventsOf(deal), covered = new Set(evs.flatMap((e) => (e.task_keys || []).map((k) => `${k}|${e.happened_on}`)));
  const out = evs.map((ev) => ({ date: ev.happened_on, ev }));
  for (const r of rows) if (r.done && !covered.has(`${r.key}|${r.done.done_on}`)) out.push({ date: r.done.done_on, task: r });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ───────────── 小件 ───────────── */
const pill = (cls, txt) => `<span class="dl-pill ${cls}">${txt}</span>`;
const varPill = (n) => (n == null ? "" : n > 0 ? pill("late", t("晚 {n} 天", { n })) : n < 0 ? pill("early", t("早 {n} 天", { n: -n })) : pill("ok", t("按计划")));
const stageName = (deal, x) => t(D().stagesOf(deal.kind)[x.stage] || "");
const kpiS = (label, val, small = "") => `<div class="kpi"><span>${esc(label)}</span><b>${val}</b>${small}</div>`;

/** 一条进展记录（可点 ✎ 修改） */
function evLine(ev) {
  const bits = [ev.contact && `👤 ${esc(ev.contact)}`, ev.created_by_name && esc(ev.created_by_name)].filter(Boolean).join(" · ");
  return `<div class="dl-ev"><div class="dl-top"><time datetime="${ev.happened_on}">${md(ev.happened_on)}</time><b>${esc(ev.title)}</b>
    <button type="button" class="task-edit" data-action="deal-event-edit" data-id="${esc(ev.id)}" aria-label="${esc(t("修改这条进展"))}" title="${esc(t("修改"))}">✎</button></div>
    ${ev.note ? `<small>${esc(ev.note)}</small>` : ""}${bits ? `<small class="muted">${bits}</small>` : ""}</div>`;
}

/** 计划那一侧：模板事项（基线日期） */
function planCell(deal, x) {
  const moved = x.baseline && x.due && x.due !== x.baseline;
  return `<span class="dl-tag">📋 ${t("计划")}</span><div class="dl-card dl-plan ${x.priority === "must" ? "must" : ""} ${x.skipped ? "skipped" : ""}">
    <div class="dl-top"><time>${x.baseline ? md(x.baseline) : x.due ? md(x.due) : t("未排期")}</time><b>${esc(t(x.name))}</b></div>
    <div class="dl-meta"><span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span> <span class="badge" style="background:var(--surface-2)">${esc(stageName(deal, x))}</span>${x.custom ? ` <span class="badge" style="background:var(--surface-2)">${t("自定义")}</span>` : ""}</div>
    ${moved ? `<small>${t("现计划 {d}", { d: md(x.due) })}${x.moved ? ` · ${t("已手动调整")}` : ""}</small>` : ""}${x.note ? `<small class="muted">${esc(t(x.note))}</small>` : ""}</div>`;
}

/** 实际那一侧：完成情况 + 关联的进展记录 + 操作 */
function actCell(deal, x, evs, h) {
  const today = todayISO(), id = `dl-${deal.id}-${x.key}`;
  let head;
  if (x.done) head = `<div class="dl-top"><time>${md(x.done.done_on)}</time><b>✓ ${t("已完成")}</b>${varPill(x.slip)}</div>${x.done.done_by_name ? `<small class="muted">${esc(x.done.done_by_name)}</small>` : ""}`;
  else if (x.lateNow > 0) head = `<div class="dl-top"><b>${t("还没做")}</b>${pill("late", t("已晚 {n} 天", { n: x.lateNow }))}</div><small>${t("本来应该 {d} 完成", { d: md(x.baseline) })}${x.forecast && x.forecast >= today ? ` · ${t("预计 {d}", { d: md(x.forecast) })}` : ""}</small>`;
  else head = `<div class="dl-top">${x.prog ? `<b>◐ ${t("进行中")}</b>` : ""}<b class="muted">${x.forecast ? t("预计 {d}", { d: md(x.forecast) }) : t("还没排期")}</b>${x.slip > 0 ? pill("late", t("预计晚 {n} 天", { n: x.slip })) : ""}</div>`;
  const held = x.held.length ? `<small class="dl-held">⏳ ${t("在等：{n}", { n: x.held.map((n) => t(n)).join("、") })}</small>` : "";
  const editing = h.isEditing(x);
  if (x.skipped) return `<span class="dl-tag">✅ ${t("实际")}</span><div class="dl-card dl-act skipped"><div class="dl-top"><b>⊘ ${t("已跳过")}</b></div><small>${t("这一步不适用于这笔交易，不算完成也不算延误")}</small>${evs.map(evLine).join("")}
    <div class="dl-acts"><button type="button" class="btn btn-sm btn-ghost" data-action="deal-task-skip" data-deal="${deal.id}" data-key="${esc(x.key)}" data-skip="0">↩ ${t("恢复这一步")}</button></div></div>`;
  return `<span class="dl-tag">✅ ${t("实际")}</span><div class="dl-card dl-act ${x.done ? "done" : x.lateNow > 0 ? "late" : "todo"}">
    ${head}${held}${evs.map(evLine).join("")}
    <div class="dl-acts"><label class="dl-check" for="${id}"><input type="checkbox" id="${id}" data-deal-task="${esc(x.key)}" data-deal="${deal.id}" ${x.done ? "checked" : ""}><span>${x.done ? t("已完成") : t("标记完成")}</span></label>
      <button type="button" class="btn btn-sm btn-ghost" data-action="deal-event-new" data-deal="${deal.id}" data-key="${esc(x.key)}">＋ ${t("记一笔进展")}</button>${x.done ? "" : `<button type="button" class="btn btn-sm btn-ghost" data-action="deal-task-skip" data-deal="${deal.id}" data-key="${esc(x.key)}" data-skip="1" title="${esc(t("跳过这一步（不适用）"))}">⊘ ${t("跳过此步")}</button>`}${h.editBtn(x)}</div>
    ${editing ? h.editForm(x) : ""}</div>`;
}

/** 里程碑（合同日 / 交割日）：计划那侧是冻结的日期，实际那侧是现在填的日期 */
function markRow(deal, kind) {
  const [cLabel, zLabel] = D().DATE_LABELS[deal.kind] || D().DATE_LABELS.buy, b = deal.baseline || {};
  const base = kind === "contract" ? b._contract_on || deal.contract_on : b._closing_on || deal.closing_on, now = kind === "contract" ? deal.contract_on : deal.closing_on;
  if (!base) return null;
  const shift = now && base && now !== base ? dayDiff(now, base) : 0;
  return { d: base, html: `<li class="dl-row dl-markrow"><div class="dl-c dl-cp"><span class="dl-tag">📋 ${t("计划")}</span><div class="dl-mark"><span aria-hidden="true">◆</span><time>${md(base)}</time><b>${t(kind === "contract" ? cLabel : zLabel)}</b></div></div>
    <i class="dl-dot dl-diamond" aria-hidden="true"></i>
    <div class="dl-c dl-ca"><span class="dl-tag">✅ ${t("实际")}</span>${shift ? `<div class="dl-mark"><time>${md(now)}</time><b>${t("现在是 {d}", { d: fmtDate(now) })}</b>${varPill(shift)}</div>` : now ? `<div class="dl-mark muted"><b>${t("没有变化")}</b></div>` : ""}</div></li>` };
}

/* ───────────── 三种视图：计划 / 实际 / 对比 ───────────── */
/** mode: plan / actual / compare。an = analyze() 的结果（已按筛选过滤的 rows 通过 rows 传进来）；h = deals.js 传来的编辑小件 */
export function lanesHtml(deal, an, rows, mode, h) {
  const today = todayISO(), evs = eventsOf(deal);
  if (mode === "actual") return actualHtml(deal, an, h);
  const firstKey = (e) => (e.task_keys || []).find((k) => an.rows.some((r) => r.key === k));
  const items = rows.filter((x) => x.baseline || x.due).map((x) => ({ d: x.baseline || x.due, html: `<li class="dl-row ${x.skipped ? "is-skip" : x.done ? "is-done" : x.lateNow > 0 ? "is-late" : ""}${x.prog ? " is-prog" : ""}"><div class="dl-c dl-cp">${planCell(deal, x)}</div><i class="dl-dot" aria-hidden="true"></i>
    <div class="dl-c dl-ca">${mode === "compare" ? actCell(deal, x, evs.filter((e) => firstKey(e) === x.key), h) : ""}</div></li>` }));
  if (mode === "compare") for (const e of evs.filter((e) => !firstKey(e))) items.push({ d: e.happened_on, html: `<li class="dl-row dl-solo"><div class="dl-c dl-cp"><span class="dl-empty">${t("清单之外")}</span></div><i class="dl-dot dl-dot-ev" aria-hidden="true"></i><div class="dl-c dl-ca"><span class="dl-tag">✅ ${t("实际")}</span><div class="dl-card dl-act done">${evLine(e)}</div></div></li>` });
  for (const k of ["contract", "closing"]) { const m = markRow(deal, k); if (m) items.push(m); }
  items.sort((a, b) => a.d.localeCompare(b.d));
  const at = items.findIndex((i) => i.d > today);
  items.splice(at < 0 ? items.length : at, 0, { d: today, html: `<li class="dl-today"><span>${t("今天")} · ${fmtDate(today)}</span></li>` });
  const undated = rows.filter((x) => !x.baseline && !x.due);
  const legend = `<p class="dl-legend" aria-label="${esc(t("图例"))}"><span><i class="dl-lg done"></i>${t("已完成")}</span><span><i class="dl-lg prog"></i>${t("进行中")}</span><span><i class="dl-lg skp"></i>${t("已跳过")}</span><span><i class="dl-lg"></i>${t("未开始")}</span><span><i class="dl-lg late"></i>${t("已晚")}</span></p>`;
  return `<div class="panel dl dl-m-${mode}">${legend}${mode === "compare" ? `<div class="dl-head" aria-hidden="true"><span>📋 ${t("计划（模板，冻结的日期）")}</span><span></span><span>✅ ${t("实际（我们做的）")}</span></div>` : ""}
    <ol class="dl-rows">${items.map((i) => i.html).join("")}</ol>
    ${undated.length ? `<h3 class="tl-sub">${t("还没排期")}</h3><p class="muted" style="font-size:12.5px;margin:0 0 6px">${t("填了合同日 / 交割日，或点 ✎ 手动设日期，就会排进上面的时间线")}</p><ul class="dl-undated">${undated.map((x) => `<li>${esc(t(x.name))}</li>`).join("")}</ul>` : ""}</div>`;
}
function actualHtml(deal, an, h) {
  const today = todayISO(), list = actualEntries(deal, an.rows), byKey = new Map(an.rows.map((r) => [r.key, r]));
  if (!list.length) return `<div class="panel empty"><strong>${t("还没有实际进展")}</strong>${t("做了什么就记一笔：和卖方律师改合同、联系 ComEd 停服务、签字……也可以在清单里勾选完成。")}</div>`;
  const items = list.map((en) => {
    if (en.task) {
      const x = en.task;
      return { d: en.date, html: `<li class="dl-row dl-solo"><i class="dl-dot" aria-hidden="true"></i><div class="dl-c"><div class="dl-card dl-act done"><div class="dl-top"><time>${md(en.date)}</time><b>✓ ${esc(t(x.name))}</b>${varPill(x.slip)}</div>
        ${x.baseline ? `<small class="muted">${t("原计划 {d}", { d: md(x.baseline) })}</small>` : ""}</div></div></li>` };
    }
    const links = (en.ev.task_keys || []).map((k) => byKey.get(k)).filter(Boolean);
    const link = links.length ? `<div class="dl-links">${links.map((x) => `<span class="dl-link">↳ ${esc(t(x.name))}${x.baseline ? ` · ${t("原计划 {d}", { d: md(x.baseline) })}` : ""}${x.done?.done_on === en.date ? ` ${varPill(x.slip)}` : ""}</span>`).join("")}</div>` : "";
    return { d: en.date, html: `<li class="dl-row dl-solo"><i class="dl-dot dl-dot-ev" aria-hidden="true"></i><div class="dl-c"><div class="dl-card dl-act done">${evLine(en.ev)}${link}</div></div></li>` };
  });
  const at = items.findIndex((i) => i.d > today);
  items.splice(at < 0 ? items.length : at, 0, { d: today, html: `<li class="dl-today"><span>${t("今天")} · ${fmtDate(today)}</span></li>` });
  return `<div class="panel dl dl-m-actual"><ol class="dl-rows">${items.map((i) => i.html).join("")}</ol></div>`;
}

/* ───────────── 对照提醒 + AI ───────────── */
export function briefHtml(deal, an, h) {
  const ms = an.ms, label = (D().DATE_LABELS[deal.kind] || [])[1];
  const msLine = ms && ms.baseline ? `<p class="dl-ms">${t("{l}：原计划 {a}", { l: t(label || ms.name), a: `<b>${fmtDate(ms.baseline)}</b>` })}${ms.done ? ` → ${t("实际 {b}", { b: `<b>${fmtDate(ms.done.done_on)}</b>` })} ${varPill(ms.slip)}`
    : ms.forecast && ms.forecast !== ms.baseline ? ` → ${t("预计 {b}", { b: `<b class="${ms.slip > 0 ? "lag-late" : ""}">${fmtDate(ms.forecast)}</b>` })} ${varPill(ms.slip)}` : ` · ${pill("ok", t("预计按计划"))}`}</p>` : "";
  const list = an.overdue.slice(0, 5).map((x) => `<li><div class="grow"><b>${esc(t(x.name))}</b><small>${t("本来应该 {d} 完成，已晚 {n} 天", { d: fmtDate(x.baseline), n: x.lateNow })}${x.priority === "must" ? ` · ${t("必须项")}` : ""}${x.held.length ? ` · ${t("在等：{n}", { n: x.held.map((n) => t(n)).join("、") })}` : ""}</small></div>
    <button type="button" class="btn btn-sm btn-ghost" data-action="deal-event-new" data-deal="${deal.id}" data-key="${esc(x.key)}">＋ ${t("记一笔进展")}</button></li>`).join("");
  return `<div class="panel dl-brief"><h3 style="margin:0 0 8px">${t("对照计划")}</h3>
    <div class="kpis">${kpiS(t("已完成"), `${an.done} / ${an.total}`, an.skipped ? `<small>⊘ ${t("跳过 {n} 项", { n: an.skipped })}</small>` : "")}${kpiS(t("晚于计划"), `<span class="${an.late ? "down" : ""}">${an.late}</span>`, `<small>${t("含预计会晚的")}</small>`)}${kpiS(t("已过原计划日"), `<span class="${an.overdue.length ? "down" : ""}">${an.overdue.length}</span>`, `<small>${t("还没做")}</small>`)}</div>
    ${msLine}${an.overdue.length ? `<ul class="restock-list dl-late-list">${list}</ul>${an.overdue.length > 5 ? `<p class="muted small" style="margin:6px 0 0">${t("还有 {n} 项…", { n: an.overdue.length - 5 })}</p>` : ""}` : `<p class="muted small" style="margin:6px 0 0">${t("没有超过原计划日的事项。")}</p>`}
    ${aiHtml(deal)}</div>`;
}
const aiConsent = () => { try { return localStorage.getItem("hmh-deal-ai-ok") === "1"; } catch { return false; } };
export const setDealAiConsent = (on) => { try { localStorage.setItem("hmh-deal-ai-ok", on ? "1" : "0"); } catch { /* 忽略 */ } };
function aiHtml(deal) {
  const out = state.dealAi[deal.id];
  if (!aiReady()) return `<details class="dl-ai"><summary>✨ ${t("AI 分析")}</summary><p class="muted small" style="margin:6px 0 0">${t("到 设置 → AI 助手 填 key 后，可以让 AI 读上面算好的偏差，给出风险和下一步。")}</p></details>`;
  return `<details class="dl-ai" ${out ? "open" : ""}><summary>✨ ${t("AI 分析")}</summary>
    <p class="muted small" style="margin:6px 0 8px">${t("只发送每个清单事项的名称、计划日期、实际 / 预计日期和晚了几天，不发进展记录的内容、联系人、金额和地址；自定义事项只发「自定义事项 N」。会发给你在设置里选的 AI 服务商。")}</p>
    <label class="check-inline"><input type="checkbox" data-deal-ai="consent" ${aiConsent() ? "checked" : ""}><span>${t("我同意把这些日期对照发给 AI 服务商")}</span></label>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="deal-ai-run" data-deal="${deal.id}" ${aiConsent() && !state.dealAiBusy ? "" : "disabled"}>${state.dealAiBusy ? t("分析中…") : out ? t("重新分析") : t("帮我分析")}</button></div>
    ${out ? `<div class="ai-out" style="margin-top:10px;white-space:pre-wrap">${esc(out)}</div><p class="muted small" style="margin:6px 0 0">${t("AI 的建议仅供参考，合同期限和法律问题以律师为准。")}</p>` : ""}</details>`;
}
/** 点「帮我分析」：把算好的偏差发给 AI */
export async function runDealAi(deal, an) {
  if (!aiConsent() || state.dealAiBusy) return;
  state.dealAiBusy = true;
  let ci = 0;
  const steps = an.rows.filter((x) => x.baseline || x.due).map((x) => ({ step: x.custom ? t("自定义事项 {n}", { n: ++ci }) : t(x.name), priority: x.priority, planned: x.baseline || null, currently_planned: x.due || null,
    skipped_not_applicable: !!x.skipped, actual_done: x.actual, expected: x.forecast, days_late_or_early: x.slip, days_overdue_now: x.lateNow || 0, waiting_on: x.held }));
  const data = { kind: D().KINDS[deal.kind], today: todayISO(), anchors: { contract_planned: deal.baseline?._contract_on || null, contract_now: deal.contract_on, closing_planned: deal.baseline?._closing_on || null, closing_now: deal.closing_on },
    progress: { done: an.done, total: an.total }, milestone: an.ms ? { step: an.ms.name, planned: an.ms.baseline, expected: an.ms.forecast || an.ms.actual, days_late: an.ms.slip } : null,
    note_count: eventsOf(deal).length, steps };
  const sys = `You are an experienced Illinois (Chicago area) ${deal.asset_id ? "vehicle purchase / sale / lease-return" : "residential real-estate"} transaction coordinator. The user shows you a baseline schedule (planned dates from a standard template) versus what actually happened or is now expected, as JSON. Reply in ${lang === "en" ? "English" : lang === "zh-Hant" ? "Traditional Chinese" : "Simplified Chinese"}, concise plain text with short sections: 1) Where things stand (one or two sentences) 2) Delays that matter, and why (contract deadlines such as attorney review or financing commitment, utility shut-off lead times, insurance before pickup, plates / title) 3) What to do next, in order, and who to contact (by role) 4) What can safely wait. Use only the data given; do not invent dates or amounts. You are not a lawyer; remind to confirm contract deadlines with the attorney only if a contract deadline looks at risk.`;
  try { state.dealAi[deal.id] = String(await askText(sys, JSON.stringify(data), { maxTokens: 1200, temperature: 0.3 })).trim(); }
  catch (e) { toast(e.message || String(e)); }
  state.dealAiBusy = false;
}

/* ───────────── 进展记录表单 ───────────── */
export function eventFormPanel(deal, an) {
  const e = state.dealEventEdit; if (!e || e.deal !== deal.id) return "";
  const ev = e.id ? (state.dealEvents || []).find((x) => x.id === e.id) : null, key = ev ? (ev.task_keys || [])[0] || "" : e.key || "";
  const opt = (x) => `<option value="${esc(x.key)}" ${x.key === key ? "selected" : ""}>${x.done ? "✓ " : ""}${esc(t(x.name))}</option>`;
  const undone = an.rows.filter((x) => !x.done && !x.skipped), done = an.rows.filter((x) => x.done);
  const step = key ? an.rows.find((x) => x.key === key) : null;
  return `<section class="section"><form id="dealEventForm" class="panel" novalidate>
    <h3 style="margin:0 0 8px">${ev ? t("修改进展记录") : t("记一笔进展")}</h3>
    <input type="hidden" name="deal_id" value="${esc(deal.id)}"><input type="hidden" name="event_id" value="${esc(ev?.id || "")}">
    <div class="form-grid">
      <label>${t("发生日期")}<input name="happened_on" type="date" required value="${esc(ev?.happened_on || todayISO())}"></label>
      <label>${t("联系人（可选）")}<input name="contact" maxlength="120" value="${esc(ev?.contact || "")}" placeholder="${esc(t("律师 / 经纪人 / ComEd …"))}"></label>
      <label class="span-2">${t("做了什么")}<input name="title" required maxlength="200" value="${esc(ev?.title || "")}" placeholder="${esc(t("例如：和卖方律师改完合同第二版；联系 ComEd 预约停服务"))}"></label>
      <label class="span-2">${t("对应的清单事项（可选）")}<select name="task_key"><option value="">${t("（不对应清单事项，只是记录）")}</option>
        ${undone.length ? `<optgroup label="${esc(t("还没完成"))}">${undone.map(opt).join("")}</optgroup>` : ""}${done.length ? `<optgroup label="${esc(t("已完成"))}">${done.map(opt).join("")}</optgroup>` : ""}</select></label>
      <label class="check-inline span-2"><input type="checkbox" name="mark_done" ${step && !step.done ? "" : ""}><span>${t("同时把这一步标为已完成（完成日期 = 上面的日期）")}</span></label>
      <label class="span-2">${t("备注（可选）")}<input name="note" maxlength="1000" value="${esc(ev?.note || "")}" placeholder="${esc(t("对方要求、延迟原因、下一步…"))}"></label>
    </div>
    <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary btn-sm" type="submit">${t("保存")}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="deal-event-cancel">${t("取消")}</button>
      ${ev ? `<button class="btn btn-ghost btn-sm" type="button" data-action="deal-event-delete" data-id="${esc(ev.id)}">${t("删除这条")}</button>` : ""}
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span></div></form></section>`;
}
export async function saveDealEventForm(f) {
  const fe = f.elements, deal = state.deals.find((d) => d.id === fe.deal_id.value); if (!deal) return;
  const title = fe.title.value.trim(), on = fe.happened_on.value || todayISO(), key = fe.task_key.value;
  if (!title) throw new Error(t("请填写做了什么"));
  const prev = fe.event_id.value ? (state.dealEvents || []).find((x) => x.id === fe.event_id.value) : null;
  await Store.saveDealEvent({ id: prev?.id, deal_id: deal.id, happened_on: on, title, note: fe.note.value.trim() || null, contact: fe.contact.value.trim() || null, task_keys: key ? [key] : [], created_by_name: prev?.created_by_name || state.displayName || null });
  if (key && fe.mark_done.checked) {
    if (key.startsWith("c:")) { const c = state.dealCustom.find((x) => x.id === key.slice(2)); if (c && !c.done_on) await Store.saveDealCustom({ ...c, done_on: on, done_by_name: state.displayName }); }
    else if (!state.dealDone.some((d) => d.deal_id === deal.id && d.task_key === key)) await Store.setDealDone(deal.id, key, true, state.displayName, on);
  }
  toast(t("已记录"));
}
export const deleteDealEvent = (id) => Store.deleteDealEvent(id);
