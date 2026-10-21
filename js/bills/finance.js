/* 预算页的联动与常用功能：固定账单、补货预估（联动库存）、大件家电基金（联动设备）、现金流预测、储蓄目标、
 * 订阅与固定账单年成本、月度复盘、家庭分摊。每一块往 budget.js 的“插槽”里注册，预算页按顺序拼出来。 */
import { state } from "../core/state.js";
import { esc, money, num, toast } from "../core/util.js";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(16).slice(2)}`);
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { memberName } from "../core/logic.js";
import { GROUPS, actualByMonth, billsThisMonth, applianceFund, bigThreshold, meta, registerAction, registerSection, restockForecast, saveMeta, groupOf } from "./budget.js";
import { freqText, upcoming } from "./logic.js";
import { lastMonths, monthKey, monthLabel } from "../stats/views.js";

const B = () => window.BILLS;
const cur = () => Units.region.currency;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : a > 0 ? 999 : 0);
const sec = (id, title, sub, body) => `<section class="section" id="${id}"><div class="section-head"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${body}</section>`;
const fmtD = (d) => new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
const barHtml = (v, total, cls = "") => `<div class="bud-bar ${cls}"><i style="width:${Math.min(100, pct(v, total))}%"></i></div>`;

/* ───────────── 顶部：页内跳转 ───────────── */
registerSection("top", 0, () => {
  const jump = [["budReview", "月度复盘"], ["budFixed", "固定账单"], ["budRestock", "补货预估"], ["budFund", "大件基金"], ["budCash", "现金流"], ["budGoals", "储蓄目标"], ["budSubs", "年成本"], ["budSplit", "家庭分摊"]];
  return `<div class="chips bud-jump" role="group" aria-label="${t("页内跳转")}">${jump.map(([id, l]) => `<button type="button" class="chip" data-action="budget-jump" data-to="${id}">${t(l)}</button>`).join("")}</div>`;
});
registerAction("budget-jump", (el) => document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: "smooth", block: "start" }));

/* ───────────── 月度复盘（上个月） ───────────── */
registerSection("top", 10, ({ plan }) => {
  const [prev, last] = lastMonths(3).slice(0, 2), abm = actualByMonth(), a = abm[last] || {}, b = abm[prev] || {};
  const spent = (m) => GROUPS.reduce((s, g) => s + (m[g.id] || 0), 0);
  if (!Object.keys(a).length) return "";
  const varSpent = spent(a), prevVar = spent(b), bills = a.bills || 0, leftover = plan.income - Math.max(bills, plan.billsM) - varSpent;   // 账单还没缴的也先扣掉，免得结余看着偏大
  const over = plan.groups.filter((g) => g.budget > 0 && (a[g.id] || 0) > g.budget).sort((x, y) => (a[y.id] - y.budget) - (a[x.id] - x.budget)).slice(0, 3);
  const under = plan.groups.filter((g) => g.budget > 0 && (a[g.id] || 0) <= g.budget * 0.7).slice(0, 2);
  const big = state.purchases.filter((p) => monthKey(p.purchased_at) === last && p.amount != null && (!p.currency || p.currency === cur())).sort((x, y) => num(y.amount) - num(x.amount)).slice(0, 3);
  const goals = meta("_goals", []);
  const lines = [
    `${t("花了 {a}（可支配部分，预算 {b}），账单 {c}。", { a: money(varSpent), b: money(plan.variable), c: money(bills) })}${prevVar > 0 ? ` ${t("比前一个月{d}{p}%。", { d: varSpent >= prevVar ? t("多") : t("少"), p: Math.abs(pct(varSpent - prevVar, prevVar)) })}` : ""}`,
    over.length ? `⚠️ ${t("超预算：{l}", { l: over.map((g) => `${g.icon}${t(g.name)} +${money((a[g.id] || 0) - g.budget)}`).join("、") })}` : `✅ ${t("各类都没有超预算")}`,
    under.length ? `👍 ${t("明显有结余：{l}", { l: under.map((g) => `${g.icon}${t(g.name)} ${t("剩 {a}", { a: money(g.budget - (a[g.id] || 0)) })}`).join("、") })}` : "",
    big.length ? `🧾 ${t("最大的几笔：{l}", { l: big.map((p) => `${esc(p.name)} ${money(num(p.amount))}`).join("、") })}` : "",
    `💰 ${t("实际结余 {a}（计划储蓄 {b}）", { a: money(leftover), b: money(plan.savings) })}`,
  ].filter(Boolean);
  const move = leftover > 1 && goals.length ? `<form id="reviewMoveForm" class="bud-move"><label class="muted" style="font-size:13px">${t("把结余存进目标")}</label>
    <select name="goal">${goals.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select>
    <input name="amount" type="number" min="1" step="1" value="${Math.floor(leftover)}" aria-label="${t("金额")}"><button class="btn btn-sm" type="submit">${t("存入")}</button></form>` : "";
  return sec("budReview", t("{m} 复盘", { m: monthLabel(last) }), t("上个月花得怎么样"), `<div class="panel"><ul class="tips bud-advice">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>${move}</div>`);
});

/* ───────────── 固定账单：本月已缴 / 还要交 / 涨价 ───────────── */
registerSection("month", 0, ({ plan }) => {
  const bm = billsThisMonth(), up = state.billsEnriched.filter((b) => b.active && !b.ended && b.priceUp && b.direction !== "receivable");
  const topFixed = state.billsEnriched.filter((b) => b.active && !b.ended && b.direction !== "receivable" && (b.currency || cur()) === cur()).sort((x, y) => y.monthly - x.monthly).slice(0, 5);
  return sec("budFixed", t("固定账单"), t("预算里的“账单”来自这里，每月折算"), `<div class="panel">
    <p style="margin:0">${t("本月已缴 {a}，还要交 {b}（{n} 笔），账单预算 {c}。", { a: money(bm.paid), b: money(bm.due), n: bm.dueN, c: money(plan.billsM) })}</p>
    ${bm.overdueN ? `<p class="form-error" style="margin:6px 0 0">${t("其中 {n} 笔已逾期，先处理。", { n: bm.overdueN })}</p>` : ""}
    ${up.length ? `<p class="down" style="margin:6px 0 0">📈 ${t("涨价了：{l}", { l: up.map((b) => esc(b.name)).join("、") })}</p>` : ""}
    <div class="bud-rank">${topFixed.map((b) => `<div class="bud-row"><div class="bud-head"><a class="link-name" href="${href("bill", b.id)}">${B().catOf(b.category).icon} ${esc(b.name)}</a><span>${money(b.monthly)} / ${t("月")}</span></div>${barHtml(b.monthly, plan.billsM)}</div>`).join("")}</div>
    <div class="form-actions"><a class="btn btn-sm btn-ghost" href="${href("bills", "list")}">${t("看全部账单")}</a></div></div>`);
});

/* ───────────── 补货预估：联动库存和采购清单 ───────────── */
registerSection("month", 10, ({ plan, mp }) => {
  const fc = restockForecast();
  const gRemain = (id) => { const r = mp.rows.find((x) => x.id === id); return r ? r.budget - r.spent : 0; };
  const rows = fc.rows.slice(0, 8);
  return sec("budRestock", t("补货预估"), t("库存告急和采购清单里的东西，按你以前买它的花费估一下"), `<div class="panel">
    ${fc.rows.length ? `<p style="margin:0">${t("共 {n} 项，预计 {a}{u}。", { n: fc.rows.length, a: money(fc.total), u: fc.unknown ? t("（另有 {k} 项没有价格记录）", { k: fc.unknown }) : "" })}</p>
      <p class="muted" style="margin:4px 0 8px;font-size:13px">${t("日常储备本月还剩 {a}，预估占 {p}%；房屋耗材预估 {b}。", { a: money(gRemain("groceries")), p: pct(fc.byGroup.groceries || 0, Math.max(0, gRemain("groceries"))), b: money(fc.byGroup.house || 0) })}</p>
      <ul class="restock-list">${rows.map((r) => `<li><span class="badge ${r.src === "stock" ? "b-low" : "b-ok"}">${r.src === "stock" ? t("告急") : t("清单")}</span><div class="grow"><span class="name">${esc(r.name)}</span></div><b>${r.est != null ? money(r.est) : `<span class="muted">${t("没价格记录")}</span>`}</b></li>`).join("")}</ul>`
      : `<div class="empty"><strong>${t("现在没有告急的库存，清单也是空的")}</strong></div>`}
    <div class="form-actions"><a class="btn btn-sm" href="${href("shopping")}">${t("去采购清单")}</a><a class="btn btn-sm btn-ghost" href="${href("pantry", "overview")}">${t("看库存")}</a></div></div>`);
});

/* ───────────── 大件家电基金：按设备寿命每月预存 ───────────── */
registerSection("month", 20, ({ plan }) => {
  const f = applianceFund(), big = plan.groups.find((g) => g.id === "big");
  const body = f.rows.length ? `<div class="panel"><p style="margin:0">${t("按设备寿命和更换估价，每月预存约 {a}；“大件家电”预算现在是 {b}。", { a: money(f.monthly), b: money(big?.budget || 0) })}</p>
      <ul class="restock-list" style="margin-top:8px">${f.rows.slice(0, 8).map((r) => `<li><span class="badge ${r.yearsLeft != null && r.yearsLeft <= 2 ? "b-low" : ""}" style="${r.yearsLeft != null && r.yearsLeft <= 2 ? "" : "background:var(--surface-2)"}">${r.yearsLeft != null ? (r.yearsLeft <= 0 ? t("已到寿命") : t("剩 {n} 年", { n: Math.max(0.1, Math.round(r.yearsLeft * 10) / 10) })) : t("寿命未知")}</span>
        <div class="grow"><a class="link-name" href="${href("asset", r.id)}">${esc(r.name)}</a><small>${t("估价 {a}，寿命 {l} 年", { a: money(r.cost), l: r.life })}</small></div><b>${money(r.monthly)} / ${t("月")}</b></li>`).join("")}</ul>
      ${f.missing ? `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("还有 {n} 台设备没填“更换估价”，填了会算进基金。", { n: f.missing })} <a href="${href("house", "assets")}">${t("去设备保养")}</a></p>` : ""}</div>`
    : `<div class="panel empty"><strong>${t("还没有可算基金的设备")}</strong>${t("在 房屋 → 设备保养 里给设备填“更换估价”和“常见寿命”，这里会算出每月该预存多少。")} <a href="${href("house", "assets")}">${t("去设备保养")}</a></div>`;
  return sec("budFund", t("大件家电基金"), t("单笔 ≥ {a} 的花费（不含账单、维修保养）记为大件", { a: money(bigThreshold()) }), body);
});

/* ───────────── 现金流预测：未来 90 天账单 vs 收入 ───────────── */
registerSection("annual", 0, ({ plan }) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = state.billsEnriched.filter((b) => b.active && !b.ended && b.direction !== "receivable");
  const ev = upcoming(list, 90).filter((x) => (x.bill.currency || cur()) === cur()).map((x) => ({ date: new Date(`${x.due}T12:00:00`), amt: -num(x.bill.est), name: x.bill.name }));
  const day = meta("_income_day", null);
  if (day) for (let i = 0; i < 4; i++) { const d = new Date(today.getFullYear(), today.getMonth() + i, Math.min(day, new Date(today.getFullYear(), today.getMonth() + i + 1, 0).getDate()), 12); if (d >= today && d <= new Date(today.getTime() + 90 * 864e5)) ev.push({ date: d, amt: plan.income, name: t("收入") }); }
  ev.sort((a, b) => a.date - b.date);
  const weeks = Array.from({ length: 13 }, () => 0);
  for (const e of ev.filter((x) => x.amt < 0)) { const w = Math.min(12, Math.floor((e.date - today) / (7 * 864e5))); if (w >= 0) weeks[w] += -e.amt; }
  const out = -ev.filter((x) => x.amt < 0).reduce((s, x) => s + x.amt, 0), inc = ev.filter((x) => x.amt > 0).reduce((s, x) => s + x.amt, 0);
  let run = 0, low = { v: 0, d: null }; for (const e of ev) { run += e.amt; if (run < low.v) low = { v: run, d: e.date }; }
  const chart = out > 0 ? Charts.bars({ title: t("未来 13 周每周要交的账单"), labels: weeks.map((_, i) => fmtD(new Date(today.getTime() + i * 7 * 864e5))), fmt: money, showTotals: false, series: [{ name: t("账单"), color: "#2f5d8a", values: weeks }] }) : "";
  const biggest = ev.filter((x) => x.amt < 0).sort((a, b) => a.amt - b.amt).slice(0, 5);
  return sec("budCash", t("现金流预测"), t("未来 90 天要交的账单"), `<div class="panel chart-panel">
    <p style="margin:0">${t("未来 90 天要交 {a}（{n} 笔）。", { a: money(out), n: ev.filter((x) => x.amt < 0).length })}${day ? ` ${t("同期收入 {a}，结余 {b}。", { a: money(inc), b: money(inc - out) })}` : ` ${t("同期按月收入估算 {a}。", { a: money(plan.income * 3) })}`}</p>
    ${day && low.d ? `<p class="${low.v < 0 ? "form-error" : "muted"}" style="margin:6px 0">${low.v < 0 ? t("⚠️ 最紧的是 {d}：到那天累计缺 {a}，账单会比收入先到。", { d: fmtD(low.d), a: money(-low.v) }) : t("按发薪日算，没有出现入不敷出的时点。")}</p>` : ""}
    ${chart}
    ${biggest.length ? `<ul class="restock-list">${biggest.map((e) => `<li><span class="badge" style="background:var(--surface-2)">${fmtD(e.date)}</span><div class="grow"><span class="name">${esc(e.name)}</span></div><b>${money(-e.amt)}</b></li>`).join("")}</ul>` : ""}
    <form id="incomeDayForm" class="bud-inline"><label class="muted" style="font-size:13px">${t("每月发薪日（选填，用来算先后）")}</label>
      <input name="day" type="number" min="1" max="31" step="1" inputmode="numeric" value="${day || ""}" placeholder="${t("几号")}" aria-label="${t("发薪日")}"><button class="btn btn-sm" type="submit">${t("保存")}</button></form></div>`);
});

/* ───────────── 储蓄目标 ───────────── */
registerSection("annual", 10, ({ plan }) => {
  const goals = meta("_goals", []), today = new Date();
  const monthsLeft = (d) => Math.max(1, Math.ceil((new Date(`${d}T12:00:00`) - today) / (30 * 864e5)));
  const rows = goals.map((g) => { const left = Math.max(0, num(g.target) - num(g.saved)), m = monthsLeft(g.date), need = Math.ceil(left / m); return { g, left, m, need, done: left <= 0 }; });
  const needTotal = rows.filter((r) => !r.done).reduce((s, r) => s + r.need, 0);
  return sec("budGoals", t("储蓄目标"), t("给大件或旅行设个目标，每月该存多少算给你"), `<div class="panel">
    ${rows.length ? rows.map(({ g, left, m, need, done }) => `<div class="bud-row"><div class="bud-head"><b>🎯 ${esc(g.name)}</b><span>${money(g.saved || 0)} / ${money(g.target)} · ${pct(g.saved || 0, g.target)}%</span></div>${barHtml(g.saved || 0, g.target)}
      <small class="muted">${done ? `✅ ${t("已攒够")}` : t("{d} 前还差 {a}，每月存 {b}（约 {m} 个月）", { d: esc(g.date), a: money(left), b: money(need), m })}</small>
      <div class="bud-inline"><input type="number" min="1" step="1" inputmode="decimal" data-goal-amt="${g.id}" placeholder="${t("存入金额")}" aria-label="${t("存入金额")}"><button type="button" class="btn btn-sm" data-action="budget-goal-save" data-id="${g.id}">${t("存入")}</button>
        <button type="button" class="btn btn-sm btn-danger-ghost" data-action="budget-goal-del" data-id="${g.id}">${t("删除")}</button></div></div>`).join("")
      : `<p class="muted" style="margin:0">${t("还没有目标，例如：旅行、洗碗机、应急金。")}</p>`}
    ${rows.length ? `<p class="${needTotal > plan.savings ? "form-error" : "muted"}" style="margin:8px 0 0;font-size:13px">${t("所有目标每月共需 {a}，计划储蓄 {b}（占 {p}%）。", { a: money(needTotal), b: money(plan.savings), p: pct(needTotal, plan.savings) })}${needTotal > plan.savings ? ` ${t("超出了，可以拉长期限或提高储蓄比例。")}` : ""}</p>` : ""}
    <form id="goalForm" class="form-grid" style="margin-top:10px"><label>${t("目标名称")}<input name="name" required maxlength="40" placeholder="${t("例如：旅行")}"></label>
      <label>${t("目标金额（{cur}）", { cur: cur() })}<input name="target" type="number" min="1" step="1" inputmode="decimal" required></label>
      <label>${t("完成日期")}<input name="date" type="date" required></label>
      <div class="form-actions" style="align-self:end"><button type="submit" class="btn btn-primary btn-sm">${t("添加目标")}</button></div></form></div>`);
});

/* ───────────── 订阅与固定账单年成本 ───────────── */
registerSection("annual", 20, ({ plan }) => {
  const list = state.billsEnriched.filter((b) => b.active && !b.ended && b.direction !== "receivable" && (b.currency || cur()) === cur()), flag = new Set(meta("_cancel", []));
  const subs = list.filter((b) => B().isSubCat(b.category)).map((b) => ({ b, annual: b.monthly * 12 })).sort((x, y) => y.annual - x.annual);
  const other = list.filter((b) => !B().isSubCat(b.category)).map((b) => ({ b, annual: b.monthly * 12 })).sort((x, y) => y.annual - x.annual).slice(0, 5);
  const subTotal = subs.reduce((s, x) => s + x.annual, 0), flagged = subs.filter((x) => flag.has(x.b.id)).reduce((s, x) => s + x.annual, 0);
  const li = ({ b, annual }, canFlag) => `<li><div class="grow"><a class="link-name" href="${href("bill", b.id)}">${B().catOf(b.category).icon} ${esc(b.name)}</a><small>${esc(freqText(b))}</small></div><b>${money(annual)} / ${t("年")}</b>
    ${canFlag ? `<button type="button" class="btn btn-sm ${flag.has(b.id) ? "btn-primary" : "btn-ghost"}" data-action="budget-flag-cancel" data-id="${b.id}" aria-pressed="${flag.has(b.id)}">${flag.has(b.id) ? t("考虑取消 ✓") : t("考虑取消")}</button>` : ""}</li>`;
  return sec("budSubs", t("年成本：订阅与固定账单"), t("月付看着小，按年算一下"), `<div class="panel">
    ${subs.length ? `<p style="margin:0">${t("订阅与会员每年 {a}，占年收入 {p}%。", { a: money(subTotal), p: pct(subTotal, plan.income * 12) })}${flagged ? ` <b>${t("标记“考虑取消”的共 {a}/年。", { a: money(flagged) })}</b>` : ""}</p><ul class="restock-list" style="margin-top:8px">${subs.map((x) => li(x, true)).join("")}</ul>` : `<p class="muted" style="margin:0">${t("还没有订阅 / 会员类账单。")}</p>`}
    ${other.length ? `<h3 style="font-size:14px;margin:12px 0 4px">${t("其他固定账单 年成本前 5")}</h3><ul class="restock-list">${other.map((x) => li(x, false)).join("")}</ul>` : ""}</div>`);
});

/* ───────────── 家庭分摊（按“谁记的账”算付款人，默认平分） ───────────── */
registerSection("plan", 0, () => {
  const members = state.members, which = state.budgetSplitMonth || "this", months = lastMonths(2), m = which === "last" ? months[0] : months[1];
  const chips = [["this", t("本月")], ["last", t("上月")]].map(([k, l]) => `<button type="button" class="chip" data-action="budget-split-month" data-m="${k}" aria-pressed="${which === k}">${l}</button>`).join("");
  if (members.length < 2) return sec("budSplit", t("家庭分摊"), "", `<div class="panel empty"><strong>${t("家里有两位以上成员时，这里会算谁多付了、谁该补多少")}</strong>${t("按“谁记的账”当作付款人；邀请家人加入后就能用（设置 → 家庭与成员）。")}</div>`);
  const w = meta("_split", {}), weight = (u) => (w[u] != null && w[u] !== "" ? num(w[u]) : 100 / members.length), wsum = members.reduce((s, x) => s + weight(x.user_id), 0) || 1;
  const ps = state.purchases.filter((p) => monthKey(p.purchased_at) === m && p.amount != null && (!p.currency || p.currency === cur()) && num(p.amount) > 0);
  const rec = ps.filter((p) => p.created_by && members.some((x) => x.user_id === p.created_by)), unrec = ps.length - rec.length, total = rec.reduce((s, p) => s + num(p.amount), 0);
  const paid = Object.fromEntries(members.map((x) => [x.user_id, rec.filter((p) => p.created_by === x.user_id).reduce((s, p) => s + num(p.amount), 0)]));
  const net = members.map((x) => ({ x, paid: paid[x.user_id], share: (total * weight(x.user_id)) / wsum })).map((r) => ({ ...r, net: Math.round((r.paid - r.share) * 100) / 100 }));
  const cred = net.filter((r) => r.net > 0.5).map((r) => ({ ...r })), debt = net.filter((r) => r.net < -0.5).map((r) => ({ ...r })), moves = [];
  for (const d of debt) for (const c of cred) { const a = Math.min(-d.net, c.net); if (a > 0.5) { moves.push({ from: d.x.display_name, to: c.x.display_name, a }); d.net += a; c.net -= a; } }
  return sec("budSplit", t("家庭分摊"), t("{m}，按“谁记的账”当作付款人", { m: monthLabel(m) }), `<div class="panel"><div class="chips">${chips}</div>
    <table class="owner-table"><thead><tr><th>${t("成员")}</th><th>${t("付了")}</th><th>${t("应摊")}</th><th>${t("差额")}</th></tr></thead><tbody>
      ${net.map((r) => `<tr><th scope="row">${esc(r.x.display_name)}</th><td>${money(r.paid)}</td><td>${money(r.share)} <small class="muted">${Math.round((weight(r.x.user_id) / wsum) * 100)}%</small></td><td class="${r.net >= 0 ? "" : "down"}">${r.net >= 0 ? "+" : ""}${money(r.net)}</td></tr>`).join("")}</tbody></table>
    ${moves.length ? `<ul class="tips bud-advice">${moves.map((x) => `<li>💸 ${t("{a} 付给 {b}：{m}", { a: esc(x.from), b: esc(x.to), m: money(x.a) })}</li>`).join("")}</ul>` : `<p class="muted" style="margin:8px 0 0">${t("这个月基本平了。")}</p>`}
    ${unrec ? `<p class="muted" style="margin:6px 0 0;font-size:13px">${t("另有 {n} 笔没有记账人（旧记录），不参与分摊。", { n: unrec })}</p>` : ""}
    <form id="splitForm" class="form-grid" style="margin-top:10px">${members.map((x) => `<label>${esc(x.display_name)} ${t("占比 %")}<input name="w_${x.user_id}" type="number" min="0" max="100" step="1" inputmode="numeric" value="${w[x.user_id] ?? Math.round(100 / members.length)}"></label>`).join("")}
      <div class="form-actions" style="align-self:end"><button class="btn btn-sm" type="submit">${t("保存占比")}</button></div></form></div>`);
});
registerAction("budget-split-month", (el, ctx) => { state.budgetSplitMonth = el.dataset.m; ctx.render(); });

/* ───────────── 交互 ───────────── */
const goals = () => [...meta("_goals", [])];
registerAction("budget-goal-del", async (el, ctx) => { await saveMeta({ _goals: goals().filter((g) => g.id !== el.dataset.id) }); toast(t("已删除")); });
registerAction("budget-goal-save", async (el) => {
  const inp = document.querySelector(`[data-goal-amt="${CSS.escape(el.dataset.id)}"]`), a = num(inp?.value, 0); if (a <= 0) return toast(t("请填写存入金额"));
  await saveMeta({ _goals: goals().map((g) => (g.id === el.dataset.id ? { ...g, saved: num(g.saved) + a } : g)) }); toast(t("已存入 {a}", { a: money(a) }));
});
registerAction("budget-flag-cancel", async (el) => {
  const s = new Set(meta("_cancel", [])); if (s.has(el.dataset.id)) s.delete(el.dataset.id); else s.add(el.dataset.id);
  await saveMeta({ _cancel: [...s] });
});
document.addEventListener("submit", async (e) => {
  const f = e.target;
  try {
    if (f.id === "goalForm") { e.preventDefault(); await saveMeta({ _goals: [...goals(), { id: uid(), name: f.elements.name.value.trim().slice(0, 40), target: num(f.elements.target.value), date: f.elements.date.value, saved: 0 }] }); toast(t("已添加目标")); }
    else if (f.id === "incomeDayForm") { e.preventDefault(); const d = Math.round(num(f.elements.day.value, 0)); await saveMeta({ _income_day: d >= 1 && d <= 31 ? d : null }); toast(t("已保存")); }
    else if (f.id === "splitForm") { e.preventDefault(); const w = {}; for (const x of state.members) w[x.user_id] = Math.max(0, num(f.elements[`w_${x.user_id}`].value, 0)); await saveMeta({ _split: w }); toast(t("已保存")); }
    else if (f.id === "reviewMoveForm") {
      e.preventDefault(); const a = num(f.elements.amount.value, 0); if (a <= 0) return;
      await saveMeta({ _goals: goals().map((g) => (g.id === f.elements.goal.value ? { ...g, saved: num(g.saved) + a } : g)) }); toast(t("已存入 {a}", { a: money(a) }));
    }
  } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
});
