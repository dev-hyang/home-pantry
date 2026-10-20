/* 房产生命周期：状态、买入 / 卖出 / 退租交易、清单任务（模板在 data/deals.js）、退出向导、首页提醒 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, DAY, daysUntil, esc, fmtDate, money, num, todayISO, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { joinList, t } from "../core/i18n.js";
import { addDays } from "../bills/logic.js";
import { houseBar } from "./property-form.js";

const D = () => window.DEALS;
const B = () => window.BILLS;
const PRIO_CLS = { must: "b-out", should: "b-soon", optional: "" };
// 退出向导里各类账单默认延后多少天结束（水电气网会有最后一期账单）
const END_LAG = { electric: 30, gas: 30, water: 45, internet: 14, mobile: 0, hoa: 0, property_tax: 0, mortgage: 0, rent: 0, insurance_home: 0, insurance_auto: 0 };

export const currentProp = () => state.properties.find((p) => p.id === state.propertyId) || null;
export const openDeal = (pid = state.propertyId) => state.deals.find((d) => d.property_id === pid && !d.outcome) || null;
/** 交易子页在面包屑里的名字（?sec=info / stage:xxx / closeout） */
export function dealSubLabel(sec) {
  if (!sec) return null;
  if (sec === "info") return t("交易信息");
  if (sec.startsWith("stage:")) return t(D().STAGES[sec.slice(6)] || "");
  if (sec === "closeout") return openDeal()?.kind === "buy" ? t("完成交割") : t("交割与退出");
  return null;
}
export const statusText = (p) => t(D().PROPERTY_STATUS[p?.status] || "持有");
/** 房产是否还在“使用中”（提醒只对这些房产生效） */
export const propertyLive = (p) => !!p && !p.archived && !["sold", "moved_out"].includes(p.status);

/** 条件：bill:<分类>（该房产有这类账单）、kind:condo（condo / townhome）、role:landlord、autopay（有自动扣款账单） */
function matches(cond, prop, bills) {
  if (cond === "autopay") return bills.some((b) => b.autopay);
  const [k, v] = cond.split(":");
  if (k === "bill") return bills.some((b) => b.category === v);
  if (k === "kind") return v === "condo" ? ["condo", "townhome"].includes(prop.kind) : prop.kind === v;
  if (k === "role") return prop.role === v;
  return false;
}

const dayDiff = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / DAY);

/** 补上到期天数、是否逾期、完成相对应完成日期的滞后天数（lag > 0 = 滞后，< 0 = 提前；只有已完成且有应完成日期时才有） */
function finishTask(x, dn) {
  const daysLeft = x.due ? daysUntil(x.due) : null;
  return { ...x, daysLeft, done: dn, overdue: !dn && daysLeft != null && daysLeft < 0, lag: dn && x.due ? dayDiff(dn.done_on, x.due) : null };
}

/** 交易的清单任务：
 *  模板任务的推荐日期（plan）按合同日 / 交割日 + 偏移，可被手动调整（due = 调整后的应完成日期，moved = 是否调过）；没填基准日期时 plan 为 null。
 *  自定义事项（key = "c:<id>"，custom = true）自带应完成 / 实际完成日期。 */
export function dealTasks(deal) {
  const prop = state.properties.find((p) => p.id === deal.property_id);
  if (!prop) return [];
  const bills = state.bills.filter((b) => b.property_id === deal.property_id && b.active);
  const done = state.dealDone.filter((x) => x.deal_id === deal.id);
  const over = state.dealOverrides.filter((o) => o.deal_id === deal.id);
  const tpl = (D().TASKS[deal.kind] || []).filter((x) => (x.when || []).every((c) => matches(c, prop, bills))).map((x) => {
    const base = x.base === "contract" ? deal.contract_on : deal.closing_on;
    const plan = base ? addDays(base, x.offset) : null;
    const ov = over.find((o) => o.task_key === x.key) || null;
    const dn = done.find((d) => d.task_key === x.key) || null;
    return finishTask({ ...x, deal, plan, due: ov?.due_on || plan, moved: !!ov?.due_on && ov.due_on !== plan, userNote: ov?.note || null, custom: false }, dn);
  });
  const custom = state.dealCustom.filter((c) => c.deal_id === deal.id).map((c) =>
    finishTask({ key: `c:${c.id}`, name: c.name, priority: c.priority, stage: c.stage, note: c.note, deal, plan: null, due: c.due_on, moved: false, custom: true, rec: c },
      c.done_on ? { done_on: c.done_on, done_by_name: c.done_by_name } : null));
  return [...tpl, ...custom];
}

/** 首页：所有进行中交易里 7 天内到期或已逾期的未完成任务，必须项优先 */
export function dealAlerts() {
  const rank = { must: 0, should: 1, optional: 2 };
  return state.deals.filter((d) => !d.outcome).flatMap(dealTasks)
    .filter((x) => !x.done && x.daysLeft != null && x.daysLeft <= 7)
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.daysLeft - b.daysLeft);
}

export const dueText = (x) => (x.due == null ? t("填日期后计算") : x.daysLeft < 0 ? t("逾期 {d} 天", { d: -x.daysLeft }) : x.daysLeft === 0 ? t("今天") : t("{d} 天后", { d: x.daysLeft }));

/** 提醒总线：必须项逾期 = 紧急，其余逾期或今天 = 今天级，7 天内 = 尽快 */
export function dealAlertItems() {
  if (!state.houseEnabled) return [];
  return dealAlerts().map((x) => ({
    source: "deal", severity: x.daysLeft < 0 ? (x.priority === "must" ? 0 : 1) : x.daysLeft === 0 ? 1 : 2, must: x.priority === "must",
    due: x.due, daysLeft: x.daysLeft, property_id: x.deal.property_id, title: t(x.name), detail: `${x.due ? `${fmtDate(x.due)} · ` : ""}${dueText(x)}${x.note ? ` · ${t(x.note)}` : ""}`,
    href: href("house", "deal"), actions: [{ type: "check", attrs: { "data-deal-task": x.key, "data-deal": x.deal.id } }],
  }));
}

/** 已完成事项相对应完成日期：滞后 / 提前 / 按时（没有应完成日期时为空） */
export function lagText(x) {
  if (!x.done || x.lag == null) return "";
  return x.lag > 0 ? t("滞后 {n} 天", { n: x.lag }) : x.lag < 0 ? t("提前 {n} 天", { n: -x.lag }) : t("按时完成");
}

/** 日期对比一行：应完成 / 实际完成 / 滞后；调整过的标出推荐日期。showDue=false 时不重复应完成日期（时间线上日期已在节点标题里） */
function dateLine(x, { showDue = true } = {}) {
  const bits = [];
  if (showDue && x.due) bits.push(t("应完成 {d}", { d: fmtDate(x.due) }));
  if (x.done) {
    bits.push(t("实际 {d}", { d: fmtDate(x.done.done_on) }) + (x.done.done_by_name ? ` · ${esc(x.done.done_by_name)}` : ""));
    if (x.lag != null) bits.push(`<b class="${x.lag > 0 ? "lag-late" : "lag-ok"}">${lagText(x)}</b>`);
  } else bits.push(x.due == null ? t(x.custom ? "没设日期" : "填日期后计算") : dueText(x));
  if (x.moved) bits.push(x.plan ? t("已调整，推荐 {d}", { d: fmtDate(x.plan) }) : t("手动设置的日期"));
  return bits.join(" · ");
}

const isEditing = (x) => state.dealTaskEdit?.deal === x.deal.id && state.dealTaskEdit.key === x.key;
const editBtn = (x) => `<button type="button" class="task-edit" data-action="deal-task-edit" data-deal="${x.deal.id}" data-key="${esc(x.key)}" aria-label="${esc(t("调整日期 / 备注：{name}", { name: t(x.name) }))}" title="${esc(t("调整日期 / 备注"))}">✎</button>`;
const taskNotes = (x) => [x.note && esc(t(x.note)), x.userNote && `${t("备注")}：${esc(x.userNote)}`].filter(Boolean).map((n) => `<br>${n}`).join("");
const customBadge = (x) => (x.custom ? ` <span class="badge" style="background:var(--surface-2)">${t("自定义")}</span>` : "");

export function taskRow(x, { showProp = false } = {}) {
  const id = `deal-${x.deal.id}-${x.key}`;
  const prop = showProp ? state.properties.find((p) => p.id === x.deal.property_id) : null;
  const editing = isEditing(x);
  return `<li class="task-row ${x.done ? "done" : ""} ${x.overdue ? "overdue" : ""} ${editing ? "editing" : ""}">
    <input type="checkbox" id="${id}" data-deal-task="${esc(x.key)}" data-deal="${x.deal.id}" ${x.done ? "checked" : ""}>
    <label for="${id}"><span class="tt"><b>${esc(t(x.name))}</b> <span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span>${customBadge(x)}</span>
      <small>${dateLine(x)}${prop ? ` · ${esc(prop.name)}` : ""}${taskNotes(x)}</small></label>
    ${editBtn(x)}
    ${editing ? taskEditForm(x.deal, x) : ""}
  </li>`;
}

/** 调整一条事项：应完成日期、实际完成日期（填了 = 已完成，清空 = 未完成）、备注；自定义事项还能改名称 / 阶段 / 重要程度。x 为 null = 新建自定义事项 */
function taskEditForm(deal, x, stage = "special") {
  const custom = !x || x.custom, rec = x?.custom ? x.rec : null;
  const opts = (map, cur) => Object.entries(map).map(([k, n]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(t(n))}</option>`).join("");
  return `<form id="dealTaskForm" class="task-edit-form" novalidate>
    <input type="hidden" name="deal_id" value="${esc(deal.id)}"><input type="hidden" name="key" value="${esc(x?.key || "")}">
    <div class="form-grid">
      ${custom ? `<label class="span-2">${t("事项名称")}<input name="name" required maxlength="120" value="${esc(rec?.name || "")}" placeholder="${esc(t("如：向 HOA 提交 intent to sell 通知"))}"></label>
        <label>${t("所属阶段")}<select name="stage">${opts(D().STAGES, rec?.stage || stage)}</select></label>
        <label>${t("重要程度")}<select name="priority">${opts(D().PRIORITY, rec?.priority || "should")}</select></label>` : ""}
      <label>${t("应完成日期")}<input name="due_on" type="date" value="${esc(x?.due || "")}">
        ${x && !x.custom ? `<small>${x.plan ? `${t("推荐日期 {d}", { d: fmtDate(x.plan) })} <button type="button" class="link-btn" data-action="deal-due-reset" data-plan="${esc(x.plan)}">${t("恢复推荐")}</button>` : t("填了合同日 / 交割日才有推荐日期")}</small>` : ""}</label>
      <label>${t("实际完成日期")}<input name="done_on" type="date" value="${esc(x?.done?.done_on || "")}"><small>${t("填了就算已完成，清空 = 未完成")}</small></label>
      <label class="span-2">${t("备注")}<input name="note" maxlength="1000" value="${esc((rec ? rec.note : x?.userNote) ?? "")}" placeholder="${esc(t("延迟原因、对方要求、联系人…"))}"></label>
    </div>
    <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary btn-sm" type="submit">${t("保存")}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="deal-task-cancel">${t("取消")}</button>
      ${rec ? `<button class="btn btn-ghost btn-sm" type="button" data-action="deal-task-delete" data-id="${esc(rec.id)}">${t("删除这条事项")}</button>` : ""}
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span></div>
  </form>`;
}

/** 新建自定义事项的表单面板（交易枢纽页 / 阶段页顶部） */
function newTaskPanel(deal) {
  const e = state.dealTaskEdit;
  return e && e.deal === deal.id && e.key === "" ? `<section class="section"><div class="panel">${taskEditForm(deal, null, e.stage)}</div></section>` : "";
}
const addTaskRow = (deal, stage, row) => row(null, "➕", t("添加自定义事项"), t("某个 condo / village / HOA 的特别要求，如必须申报 intent to sell；也留作记录"), null, "", `data-action="deal-task-new" data-deal="${deal.id}" data-stage="${stage}"`);

/** 时间线视图：竖线 + 每条事项一个圆点（就是勾选框），按应完成日期排；签约 / 交割日和“今天”做标记，没日期的排在最后 */
function timeline(deal, tasks) {
  const rank = { must: 0, should: 1, optional: 2 }, today = todayISO();
  const dated = tasks.filter((x) => x.due).sort((a, b) => a.due.localeCompare(b.due) || rank[a.priority] - rank[b.priority]);
  const nodes = [
    ...[[deal.contract_on, "签约（合同日）"], [deal.closing_on, deal.kind === "move_out" ? "退租日" : "交割日"]].filter(([d]) => d).map(([date, mark]) => ({ date, mark, order: 0 })),
    ...dated.map((task) => ({ date: task.due, task, order: 1 })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  if (nodes.length) {
    const at = nodes.findIndex((n) => n.date > today);
    nodes.splice(at < 0 ? nodes.length : at, 0, { date: today, today: true });
  }
  const node = (n) => {
    if (n.today) return `<li class="tl-today"><span>${t("今天")} · ${fmtDate(today)}</span></li>`;
    if (n.mark) return `<li class="tl-mark"><span class="tl-dot" aria-hidden="true"></span><time datetime="${n.date}">${fmtDate(n.date)}</time><b>${t(n.mark)}</b></li>`;
    return tlItem(n.task, true);
  };
  const undated = tasks.filter((x) => !x.due);
  return `<div class="panel"><ol class="tl">${nodes.map(node).join("")}</ol>
    ${undated.length ? `<h3 class="tl-sub">${t("还没排期")}</h3><p class="muted" style="font-size:12.5px;margin:0 0 4px">${t("填了合同日 / 交割日，或点 ✎ 手动设日期，就会排进上面的时间线")}</p><ol class="tl tl-undated">${undated.map((x) => tlItem(x, false)).join("")}</ol>` : ""}</div>`;
}
function tlItem(x, withDate) {
  const id = `deal-${x.deal.id}-${x.key}-tl`, editing = isEditing(x);
  return `<li class="tl-item ${x.done ? "done" : ""} ${x.overdue ? "overdue" : ""} ${x.priority === "must" ? "must" : ""}">
    <input type="checkbox" id="${id}" data-deal-task="${esc(x.key)}" data-deal="${x.deal.id}" ${x.done ? "checked" : ""}>
    <label for="${id}">${withDate ? `<time datetime="${x.due}">${fmtDate(x.due)}</time>` : ""}
      <span class="tt"><b>${esc(t(x.name))}</b> <span class="badge ${PRIO_CLS[x.priority]}">${t(D().PRIORITY[x.priority])}</span> <span class="badge" style="background:var(--surface-2)">${esc(t(D().STAGES[x.stage] || ""))}</span>${customBadge(x)}</span>
      <small>${dateLine(x, { showDue: !withDate })}${taskNotes(x)}</small></label>
    ${editBtn(x)}
    ${editing ? taskEditForm(x.deal, x) : ""}
  </li>`;
}

/* ── 交易页 ── */
export function viewDeal() {
  const p = currentProp();
  if (!p) return `<section class="section"><div class="panel empty"><strong>${t("还没有房产")}</strong></div></section>`;
  // ?deal=<id>：查看历史交易（已交割 / 已取消）—— 清单、时间线、交易信息都还能看、能改，只是没有“完成交割”入口
  const q = state.route?.q;
  const viewed = q?.get("deal") ? state.deals.find((d) => d.id === q.get("deal") && d.property_id === p.id) || null : null;
  const deal = viewed || openDeal(p.id);
  const closed = !!deal?.outcome;
  const history = state.deals.filter((d) => d.property_id === p.id && d.outcome);
  const live = propertyLive(p);
  // 子页链接：查看历史交易时把 deal= 一路带着，否则回到进行中的交易
  const link = (sec) => { const ps = new URLSearchParams(); if (sec) ps.set("sec", sec); if (viewed) ps.set("deal", deal.id); const qs = ps.toString(); return `${href("house", "deal")}${qs ? `?${qs}` : ""}`; };
  const statusCard = `<section class="section"><div class="house-card">
      <span class="house-ico" aria-hidden="true">🏠</span>
      <div class="grow"><h2>${esc(p.name)}<span class="badge ${live ? "b-ok" : ""}" style="${live ? "" : "background:var(--surface-2)"}">${statusText(p)}</span></h2>
        <p class="muted">${[t(B().PROPERTY_KINDS[p.kind] || ""), t(B().PROPERTY_ROLES[p.role] || ""), p.acquired_on ? t("{d} 买入", { d: fmtDate(p.acquired_on) }) : null, p.purchase_price ? money(num(p.purchase_price)) : null,
          p.sold_on ? t("{d} 卖出", { d: fmtDate(p.sold_on) }) : null, p.sale_price ? money(num(p.sale_price)) : null].filter(Boolean).map(esc).join(" · ")}</p></div>
    </div></section>`;
  if (!deal) {
    const starts = [
      !["sold", "moved_out", "selling"].includes(p.status) && p.role !== "tenant" && ["looking", "buying"].includes(p.status) ? ["buy", t("开始买入流程")] : null,
      ["owned", "selling"].includes(p.status) && p.role !== "tenant" ? ["sell", t("开始卖出流程")] : null,
      p.role === "tenant" && p.status === "renting" ? ["move_out", t("开始退租流程")] : null,
      p.status === "owned" && p.role !== "tenant" ? ["buy", t("记录买入流程（刚签约）")] : null,
    ].filter(Boolean);
    return `${houseBar()}${statusCard}
      <section class="section"><div class="panel empty"><strong>${t("这套房产没有进行中的交易")}</strong>
        ${t("买入或卖出时，按伊利诺伊州流程生成带截止日期的清单：律师审查、验房、贷款承诺、停服务通知、交割后事项，逐项提醒。")}
        <p>${starts.map(([k, l]) => `<button type="button" class="btn btn-primary" data-action="deal-start" data-kind="${k}">${l}</button>`).join(" ")}
           ${!live ? `<span class="muted">${t("已卖出或退租的房产只保留历史。")}</span>` : ""}</p></div></section>
      ${dealHistory(history, null)}`;
  }
  const tasks = dealTasks(deal);
  const groups = Object.entries(D().STAGES).map(([k, n]) => ({ k, n, rows: tasks.filter((x) => x.stage === k) })).filter((g) => g.rows.length);
  const undone = tasks.filter((x) => !x.done), mustLeft = undone.filter((x) => x.priority === "must").length;
  const K = D().KINDS;
  const sec = (closed && q?.get("sec") === "closeout" ? "" : q?.get("sec")) || "";   // 历史交易没有交割页
  // ── 子页：交易信息 / 某个阶段的清单 / 交割（面包屑由 menu.js 统一画：‹ 房产 / 交易 / 子页名）──
  if (sec === "info") return `<section class="section">${dealForm(deal)}</section>`;
  if (sec.startsWith("stage:")) {
    const sk = sec.slice(6), g = groups.find((x) => x.k === sk) || (D().STAGES[sk] ? { k: sk, n: D().STAGES[sk], rows: [] } : null);   // 空阶段（如删光自定义事项后）也画出来，方便再添加
    if (!g) return `<section class="section"><div class="panel empty"><strong>${t("没有这个阶段")}</strong></div></section>`;
    const done = g.rows.filter((x) => x.done).length;
    return `${newTaskPanel(deal)}<section class="section">
      <p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("{kind}流程", { kind: t(K[deal.kind]) })} · ${t("已完成 {a} / {b}", { a: done, b: g.rows.length })}</p>
      <div class="panel"><ul class="task-list">${g.rows.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).map((x) => taskRow(x)).join("")}</ul></div>
      <p><button type="button" class="btn btn-sm btn-ghost" data-action="deal-task-new" data-deal="${deal.id}" data-stage="${g.k}">＋ ${t("添加自定义事项")}</button></p>
      <p class="disclaimer">${t("清单按伊利诺伊州（芝加哥）常见流程整理，日期和税费以合同、律师和产权公司为准；其他州请按本地流程增删。点事项右侧的 ✎ 可以调整应完成日期、记录实际完成日期。")}</p>
    </section>`;
  }
  if (sec === "closeout") return `<section class="section">
      ${state.closeout ? closeoutPanel(p, deal) : `<div class="panel"><div class="kv"><div class="muted">${deal.kind === "buy" ? t("交割完成后，把房产状态改为“持有”，记下买入日期和价格。") : t("交割完成后：账单设结束日期、生成取消自动扣款清单、房产归档保留历史。")}</div>
        <div class="head-acts"><button type="button" class="btn btn-primary btn-sm" data-action="deal-closeout">${deal.kind === "buy" ? t("已交割，标为持有") : t("开始退出向导")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="deal-cancel">${t("取消这笔交易")}</button></div></div></div>`}
    </section>`;
  // ── 枢纽页：总进度 + 一行一个入口，各带完成度 ──
  const total = tasks.length, doneN = total - undone.length, pct = total ? Math.round((doneN / total) * 100) : 0;
  const INFO_FIELDS = ["contract_on", "closing_on", "review_deadline", "financing_deadline", "price", "earnest_money", "attorney", "lender", "agent", "title_company", "inspector"];
  const infoN = INFO_FIELDS.filter((k) => deal[k] != null && deal[k] !== "").length;
  const nextDue = undone.filter((x) => x.due).sort((a, b) => a.due.localeCompare(b.due))[0];
  // url 为 null 时画成按钮（attrs 里带 data-action）
  const row = (url, icon, title, desc, prog, badge = "", attrs = "") => `<${url ? `a href="${url}"` : `button type="button" ${attrs}`} class="mrow">
      <span class="mi" aria-hidden="true">${icon}</span>
      <span class="mt"><b>${title}</b><small>${desc}</small>${prog != null ? `<span class="mprog"><i style="width:${prog}%"></i></span>` : ""}</span>
      ${badge}<span class="mch" aria-hidden="true">›</span></${url ? "a" : "button"}>`;
  const stageRows = groups.map((g) => {
    const d = g.rows.filter((x) => x.done).length, late = g.rows.filter((x) => !x.done && x.overdue).length, must = g.rows.filter((x) => !x.done && x.priority === "must").length;
    const next = g.rows.filter((x) => !x.done && x.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    const desc = d === g.rows.length ? t("全部完成") : [next ? t("下一项 {date}：{name}", { date: fmtDate(next.due), name: t(next.name) }) : null, must ? t("{n} 项必须", { n: must }) : null].filter(Boolean).join(" · ") || t("还有 {n} 项", { n: g.rows.length - d });
    const badge = late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: late })}</span>` : d === g.rows.length ? `<span class="badge b-ok mcount">✓</span>` : `<span class="badge mcount" style="background:var(--surface-2)">${d}/${g.rows.length}</span>`;
    return row(link(`stage:${g.k}`), d === g.rows.length ? "✅" : "☐", t(g.n), esc(desc), Math.round((d / g.rows.length) * 100), badge);
  }).join("");
  const infoRow = row(link("info"), "📝", t("交易信息"), infoN ? t("合同日、交割日、价格、律师、贷款行、经纪人等") : t("先填合同日和交割日，清单截止日按它们推算"), Math.round((infoN / INFO_FIELDS.length) * 100), `<span class="badge mcount" style="background:var(--surface-2)">${infoN}/${INFO_FIELDS.length}</span>`);
  const addRow = addTaskRow(deal, "special", row);
  const closeRow = closed ? "" : row(link("closeout"), deal.kind === "buy" ? "🔑" : "📦", deal.kind === "buy" ? t("完成交割") : t("交割与退出"), deal.kind === "buy" ? t("交割后标为持有，记买入日期和价格") : t("账单结束日期、取消自动扣款、归档房产"), null);
  return `${houseBar()}${statusCard}
    <section class="section">
      <div class="section-head"><h2>${closed ? (deal.outcome === "cancelled" ? t("{kind}已取消", { kind: t(K[deal.kind]) }) : t("{kind}已交割", { kind: t(K[deal.kind]) })) : t("{kind}进行中", { kind: t(K[deal.kind]) })}</h2><p>${deal.closing_on ? t("交割 {d}", { d: fmtDate(deal.closing_on) }) : t("还没填交割日")}</p></div>
      ${closed ? `<p class="muted" style="margin:-6px 0 10px;font-size:13px">${t("这是历史交易。清单、时间线和交易信息仍可查看和修改，供日后参考。")}${openDeal(p.id) ? ` <a href="${href("house", "deal")}">${t("回到进行中的交易")}</a>` : ""}</p>` : ""}
      <div class="panel deal-progress">
        <div class="kv"><div><b>${t("总进度 {p}%", { p: pct })}</b><div class="muted">${t("已完成 {a} / {b}", { a: doneN, b: total })}${mustLeft ? ` · ${t("必须项还剩 {n}", { n: mustLeft })}` : ""}${nextDue ? ` · ${t("最近截止 {date}", { date: fmtDate(nextDue.due) })}` : ""}</div></div></div>
        <div class="life-bar big"><i style="width:${pct}%"></i></div>
      </div>
    </section>
    ${newTaskPanel(deal)}
    <section class="section">
      <div class="seg deal-view" role="group" aria-label="${esc(t("视图"))}">
        <button type="button" class="chip" data-action="deal-view" data-view="list" aria-pressed="${state.dealView !== "timeline"}">☰ ${t("清单")}</button>
        <button type="button" class="chip" data-action="deal-view" data-view="timeline" aria-pressed="${state.dealView === "timeline"}">⏐ ${t("时间线")}</button>
      </div>
      ${state.dealView === "timeline" ? `<div class="panel mlist">${infoRow}</div>${timeline(deal, tasks)}<div class="panel mlist" style="margin-top:12px">${addRow}${closeRow}</div>`
        : `<div class="panel mlist">${infoRow}${stageRows}${addRow}${closeRow}</div>`}
      <p class="disclaimer">${t("截止日按合同日和交割日推算，可点 ✎ 调整；必须项逾期会在首页置顶")}</p>
    </section>
    ${dealHistory(history, viewed?.id || null)}`;
}

function dealForm(d) {
  const v = (k) => esc(d[k] ?? "");
  return `<form id="dealForm" class="panel" novalidate>
    <input type="hidden" name="deal_id" value="${esc(d.id)}">
    <div class="form-grid">
      <label>${t("合同日")}<input name="contract_on" type="date" value="${v("contract_on")}"><small>${t("签约日期；律师审查、定金等按它推算")}</small></label>
      <label>${t("交割日")}<input name="closing_on" type="date" value="${v("closing_on")}"><small>${t("停服务、保险、交割后事项按它推算")}</small></label>
      <label>${t("律师审查截止")}<input name="review_deadline" type="date" value="${v("review_deadline")}"></label>
      <label>${t("贷款条款截止")}<input name="financing_deadline" type="date" value="${v("financing_deadline")}"></label>
      <label>${t("成交价")}<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${v("price")}"></label>
      <label>${t("定金")}<input name="earnest_money" type="number" inputmode="decimal" min="0" step="0.01" value="${v("earnest_money")}"></label>
      <label>${t("律师")}<input name="attorney" maxlength="120" placeholder="${t("姓名 · 电话 / 邮箱")}" value="${v("attorney")}"></label>
      <label>${t("贷款行 / 贷款经纪")}<input name="lender" maxlength="120" value="${v("lender")}"></label>
      <label>${t("经纪人")}<input name="agent" maxlength="120" value="${v("agent")}"></label>
      <label>${t("产权公司")}<input name="title_company" maxlength="120" value="${v("title_company")}"></label>
      <label>${t("验房师")}<input name="inspector" maxlength="120" value="${v("inspector")}"></label>
      <label class="span-2">${t("备注")}<input name="notes" maxlength="1000" value="${v("notes")}"></label>
    </div>
    <div class="form-actions sticky-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${t("保存交易信息")}</button>
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span>
      <small class="muted">${t("切换标签页或家人改动时不会丢，但要点保存才写入")}</small></div>
  </form>`;
}

/** 历史交易：每条可点开（?deal=<id>）查看、修改当时的清单、时间线和交易信息；current = 正在看的那条 */
function dealHistory(list, current) {
  if (!list.length) return "";
  const K = D().KINDS;
  return `<section class="section"><div class="section-head"><h2>${t("历史交易")}</h2></div><div class="panel"><ul class="restock-list">${list.map((d) => `<li ${d.id === current ? 'aria-current="true"' : ""}>
    <span class="badge" style="background:var(--surface-2)">${t(K[d.kind])}</span>
    <div class="grow"><a class="link-name" href="${href("house", "deal")}?deal=${esc(d.id)}">${d.closing_on ? fmtDate(d.closing_on) : fmtDate((d.closed_at || d.updated_at || "").slice(0, 10))}</a>
      <small>${[d.outcome === "cancelled" ? t("已取消") : t("已交割"), d.price ? money(num(d.price)) : null, d.attorney, d.agent].filter(Boolean).map(esc).join(" · ")}</small></div>
    ${d.id === current ? `<span class="badge b-ok">${t("正在查看")}</span>` : `<a class="btn btn-sm btn-ghost" href="${href("house", "deal")}?deal=${esc(d.id)}">${t("查看清单")}</a>`}</li>`).join("")}</ul></div></section>`;
}

/** 退出向导（卖出 / 退租）：交割日、成交价、每条账单的结束日期 */
function closeoutPanel(p, deal) {
  const closing = deal.closing_on || todayISO();
  const bills = state.bills.filter((b) => b.property_id === p.id && b.active);
  return `<form id="closeoutForm" class="panel" novalidate>
    <div class="form-grid">
      <label>${deal.kind === "move_out" ? t("退租日") : t("交割日")}<input name="closing_on" type="date" required value="${esc(closing)}"></label>
      ${deal.kind === "sell" ? `<label>${t("成交价")}<input name="sale_price" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(deal.price ?? "")}"></label>` : ""}
    </div>
    <h3 style="font-size:15px;margin:14px 0 6px">${t("这套房产的账单（{n} 条）", { n: bills.length })}</h3>
    <p class="muted" style="font-size:13px;margin:0 0 8px">${t("结束日期之后不再提醒；水电气网默认多留 2–6 周等最后一期账单。自动扣款的请在清单里按“取消自动扣款”任务逐条去取消。")}</p>
    ${bills.length ? `<ul class="bill-list">${bills.map((b) => `<li class="bill-row">
        <div class="grow"><b>${esc(b.name)}</b>${b.autopay ? ` <span class="badge b-soon">${t("自动扣款")}</span>` : ""}<small>${esc(b.payee || "")}</small></div>
        <label>${t("结束于")}<input name="end_${b.id}" type="date" value="${esc(addDays(closing, END_LAG[b.category] ?? 0))}"></label></li>`).join("")}</ul>` : `<p class="muted">${t("没有挂在这套房产的账单。")}</p>`}
    <label class="check-inline" style="margin-top:10px"><input type="checkbox" name="archive" checked><span>${t("归档房产（从切换条隐藏，资料和记录保留只读）")}</span></label>
    <p class="muted" style="font-size:12px">${t("不会删除任何数据。以后在设置里可以恢复，或在归档后彻底删除。")}</p>
    <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary" type="submit">${deal.kind === "move_out" ? t("确认退租") : t("确认已卖出")}</button>
      <button class="btn btn-ghost" type="button" data-action="deal-closeout-cancel">${t("取消")}</button></div>
  </form>`;
}

/* ── 动作 ── */
export async function startDeal(kind) {
  const p = currentProp();
  if (!p || openDeal(p.id)) return;
  await Store.saveDeal({ property_id: p.id, kind, contract_on: null, review_deadline: null, financing_deadline: null, closing_on: null, price: null, earnest_money: null,
    attorney: null, lender: null, agent: null, title_company: null, inspector: null, notes: null, outcome: null, closed_at: null });
  const status = kind === "buy" ? "buying" : kind === "sell" ? "selling" : p.status;
  if (status !== p.status) await Store.saveProperty({ ...p, status });
  toast(t("已开始{kind}流程，先填合同日和交割日", { kind: t(D().KINDS[kind]) }));
}

export async function saveDealForm(f) {
  const fe = f.elements, d = state.deals.find((x) => x.id === fe.deal_id.value);
  if (!d) return;
  const v = (k) => fe[k].value || null, n = (k) => (fe[k].value === "" ? null : Math.round(num(fe[k].value) * 100) / 100);
  const patch = { ...d, contract_on: v("contract_on"), closing_on: v("closing_on"), review_deadline: v("review_deadline"), financing_deadline: v("financing_deadline"),
    price: n("price"), earnest_money: n("earnest_money"), attorney: fe.attorney.value.trim() || null, lender: fe.lender.value.trim() || null, agent: fe.agent.value.trim() || null,
    title_company: fe.title_company.value.trim() || null, inspector: fe.inspector.value.trim() || null, notes: fe.notes.value.trim() || null };
  // 合同日填了、审查截止没填：按 5 个工作日估一个
  if (patch.contract_on && !patch.review_deadline) patch.review_deadline = addBusinessDays(patch.contract_on, 5);
  await Store.saveDeal(patch);
  toast(t("交易信息已保存"));
}
function addBusinessDays(iso, n) {
  let d = iso, left = n;
  while (left > 0) { d = addDays(d, 1); const wd = new Date(`${d}T12:00:00`).getDay(); if (wd !== 0 && wd !== 6) left--; }
  return d;
}

export async function toggleDealTask(input) {
  input.disabled = true;
  const key = input.dataset.dealTask;
  if (key.startsWith("c:")) {   // 自定义事项：完成状态存在它自己那一行
    const c = state.dealCustom.find((x) => x.id === key.slice(2));
    if (c) await Store.saveDealCustom({ ...c, done_on: input.checked ? todayISO() : null, done_by_name: input.checked ? state.displayName : null });
    return;
  }
  await Store.setDealDone(input.dataset.deal, key, input.checked, state.displayName);
}

/** 保存“调整事项”表单：模板任务存应完成日期调整 + 备注 + 实际完成日期；自定义事项（新建 / 修改）整行保存 */
export async function saveDealTaskForm(f) {
  const fe = f.elements, deal = state.deals.find((d) => d.id === fe.deal_id.value);
  if (!deal) return;
  const key = fe.key.value, due = fe.due_on.value || null, doneOn = fe.done_on.value || null, note = fe.note.value.trim() || null;
  if (!key || key.startsWith("c:")) {
    const name = fe.name.value.trim();
    if (!name) throw new Error(t("请填事项名称"));
    const cur = key ? state.dealCustom.find((c) => c.id === key.slice(2)) : null;
    await Store.saveDealCustom({ id: cur?.id, deal_id: deal.id, name, stage: fe.stage.value, priority: fe.priority.value, due_on: due, note, done_on: doneOn,
      done_by_name: doneOn ? (cur?.done_on ? cur.done_by_name : state.displayName) : null });
    toast(cur ? t("已保存") : t("已添加自定义事项"));
    return;
  }
  const task = dealTasks(deal).find((x) => x.key === key);
  if (!task) return;
  await Store.saveDealOverride(deal.id, key, due && due !== task.plan ? due : null, note);   // 和推荐日期一样 = 不留调整
  if (doneOn) await Store.setDealDone(deal.id, key, true, state.displayName, doneOn);
  else if (task.done) await Store.setDealDone(deal.id, key, false, state.displayName);
  toast(t("已保存"));
}
export const deleteCustomTask = (id) => Store.deleteDealCustom(id);

export async function cancelDeal() {
  const p = currentProp(), d = openDeal(p?.id);
  if (!d) return;
  await Store.saveDeal({ ...d, outcome: "cancelled", closed_at: new Date().toISOString() });
  const back = d.kind === "buy" ? (p.acquired_on ? "owned" : "looking") : d.kind === "sell" ? "owned" : "renting";
  await Store.saveProperty({ ...p, status: back });
  toast(t("交易已取消"));
}

/** 买入交割：状态改持有，记买入日期和价格 */
export async function completeBuy() {
  const p = currentProp(), d = openDeal(p?.id);
  if (!d) return;
  await Store.saveDeal({ ...d, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveProperty({ ...p, status: "owned", acquired_on: d.closing_on || todayISO(), purchase_price: d.price ?? p.purchase_price ?? null });
  toast(t("已标为持有，可以建房屋资料、设备和账单了"));
}

/** 卖出 / 退租交割：账单写结束日期、房产状态与归档、交易关闭 */
export async function applyCloseout(f) {
  const p = currentProp(), d = openDeal(p?.id);
  if (!d) return;
  const fe = f.elements, closing = fe.closing_on.value || todayISO();
  const entries = state.bills.filter((b) => b.property_id === p.id && b.active).map((b) => ({ id: b.id, ends_on: fe[`end_${b.id}`]?.value || closing }));
  await Store.endBills(entries);
  await Store.saveDeal({ ...d, closing_on: closing, price: d.kind === "sell" ? (fe.sale_price?.value === "" ? d.price : Math.round(num(fe.sale_price.value) * 100) / 100) : d.price, outcome: "closed", closed_at: new Date().toISOString() });
  await Store.saveProperty({ ...p, status: d.kind === "sell" ? "sold" : "moved_out", sold_on: closing, sale_price: d.kind === "sell" && fe.sale_price?.value !== "" ? Math.round(num(fe.sale_price.value) * 100) / 100 : p.sale_price ?? null,
    archived: fe.archive.checked, is_default: fe.archive.checked ? false : p.is_default });
  state.closeout = null;
  const autopays = state.bills.filter((b) => b.property_id === p.id && b.active && b.autopay).map((b) => b.name);
  toast(autopays.length ? t("已记录。记得去取消自动扣款：{list}", { list: joinList(autopays) }) : t("已记录，相关账单到结束日期后不再提醒"));
}
