/* 房屋维护 · 第二期：季节任务
 * 模板在 data/house.js（按地区、月份、设施）；完成记录存 seasonal_tasks(task_key, period = "YYYY-MM")。
 * 连续的月份算同一个窗口（例如 9–10 月的炉子检修），窗口内任何一个月勾了就算完成；12 个月都有的是每月任务。
 * 自定义任务（custom_seasonal_tasks，按房产）：每年重复的（months）完成记录同样走 seasonal_tasks，key = c_<id>；
 * 一次性的（due_on）出现在到期那个月，完成日期记在它自己那一行。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, todayISO, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { compare, joinList, t } from "../core/i18n.js";
import { houseBar } from "./property-form.js";
import { careCard } from "./assets.js";

const H = () => window.HOUSE;
export const MONTHS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
export const monthName = (m) => t(MONTHS[m - 1]);
export const periodOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
export const seasonOf = (m) => (m >= 3 && m <= 5 ? "春" : m >= 6 && m <= 8 ? "夏" : m >= 9 && m <= 11 ? "秋" : "冬");
/** 加载完成记录的起点：去年 1 月起，足够覆盖跨年的窗口 */
export const seasonalSince = () => `${new Date().getFullYear() - 1}-01`;

/** 任务在 (year, month) 所在窗口覆盖的 period 列表 */
export function windowPeriods(task, year, month) {
  const ms = task.months;
  if (ms.length >= 12) return [periodOf(year, month)];
  const has = (m) => ms.includes(((m - 1 + 12) % 12) + 1);
  const out = [[year, month]];
  let y = year, m = month;
  for (let i = 0; i < 11 && has(m - 1); i++) { m -= 1; if (m === 0) { m = 12; y -= 1; } out.unshift([y, m]); }
  y = year; m = month;
  for (let i = 0; i < 11 && has(m + 1); i++) { m += 1; if (m === 13) { m = 1; y += 1; } out.push([y, m]); }
  return out.map(([yy, mm]) => periodOf(yy, mm));
}

/** 自定义重复任务在 seasonal_tasks 里的 key（表里只允许 [a-z0-9_]，去掉 uuid 的横线） */
export const customKey = (c) => `c_${String(c.id).replace(/-/g, "")}`;

/** 某个月适用的任务及完成状态（模板 + 该房产的自定义；默认当前房产，提醒总线会逐套房产调用）
 *  没有房屋资料时模板为空，只剩自定义任务 */
export function monthTasks(year, month, profile = state.houseProfile, pid = state.propertyId) {
  const period = periodOf(year, month);
  const doneOf = (key, periods) => state.seasonalDone.find((d) => d.task_key === key && d.property_id === pid && periods.includes(d.period)) || null;
  const tpl = H().seasonalTasksFor(profile)
    .filter((x) => x.months.includes(month))
    .map((task) => { const periods = windowPeriods(task, year, month); return { task, periods, done: doneOf(task.key, periods), pid }; });
  const custom = (state.customSeasonal || []).filter((c) => c.property_id === pid).flatMap((c) => {
    if (c.months?.length) {   // 每年重复
      if (!c.months.includes(month)) return [];
      const task = { key: customKey(c), name: c.name, note: c.note, months: c.months, custom: true, rec: c };
      const periods = windowPeriods(task, year, month);
      return [{ task, periods, done: doneOf(task.key, periods), pid }];
    }
    if (c.due_on && c.due_on.slice(0, 7) === period) {   // 一次性：出现在到期那个月
      const task = { key: `once_${c.id}`, name: c.name, note: c.note, months: [month], custom: true, once: true, rec: c };
      return [{ task, periods: [period], done: c.done_on ? { done_on: c.done_on, done_by_name: c.done_by_name } : null, pid }];
    }
    return [];
  });
  return [...tpl, ...custom].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || compare(t(a.task.name), t(b.task.name)));
}

export const undoneThisMonth = () => { const d = new Date(); return monthTasks(d.getFullYear(), d.getMonth() + 1).filter((x) => !x.done); };

export const taskAttrs = ({ task, done, pid }, year, month) => ({ "data-task": task.key, "data-period": periodOf(year, month), "data-undo": done?.period || "", "data-prop": pid || state.propertyId || "", "data-once": task.once ? task.rec.id : "" });

/** 一次性任务的到期提示：逾期 / 今天 / 几天后 */
const onceDue = (task) => {
  const d = task.rec.due_on, today = todayISO();
  const days = Math.round((new Date(`${d}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  return `${fmtDate(d)} · ${days < 0 ? t("逾期 {d} 天", { d: -days }) : days === 0 ? t("今天") : t("{d} 天后", { d: days })}`;
};

export function taskRow(x, year, month) {
  const { task, done } = x;
  const id = `task-${task.key}-${year}-${month}`;
  const when = done ? t("{date} {who}已完成", { date: fmtDate(done.done_on), who: done.done_by_name ? `${esc(done.done_by_name)} ` : "" })
    : task.once ? `${onceDue(task)}${task.note ? ` · ${esc(t(task.note))}` : ""}`
    : task.note ? esc(t(task.note)) : task.months.length >= 12 ? t("每月一次") : joinList(task.months.map(monthName));
  const attrs = Object.entries(taskAttrs(x, year, month)).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");
  const card = task.custom ? "" : careCard(task.card || task.key);   // 有检查卡的任务，行下带“怎么查、什么时候叫人”
  const badge = task.custom ? ` <span class="badge" style="background:var(--surface-2)">${task.once ? t("一次性") : t("自定义")}</span>` : "";
  const overdue = task.once && !done && task.rec.due_on < todayISO();
  const editing = task.custom && state.seasonForm?.id === task.rec.id;
  return `<li class="task-row ${done ? "done" : ""} ${overdue ? "overdue" : ""} ${editing ? "editing" : ""}">
    <input type="checkbox" id="${id}" ${attrs} ${done ? "checked" : ""}>
    <div class="grow"><label for="${id}"><b>${esc(task.custom ? task.name : t(task.name))}${badge}</b><small>${when}</small></label>${card}</div>
    ${task.custom ? `<button type="button" class="task-edit" data-action="season-edit" data-id="${esc(task.rec.id)}" aria-label="${esc(t("编辑：{name}", { name: task.name }))}" title="${esc(t("编辑"))}">✎</button>` : ""}
    ${editing ? seasonForm(task.rec, year, month) : ""}
  </li>`;
}

/** 提醒总线：所有活跃房产本月没做的季节任务（留意级；一次性任务逾期升为“今天”级） */
export function seasonAlertItems() {
  if (!state.houseEnabled) return [];
  const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1, today = todayISO();
  return state.properties.filter((p) => !p.archived && !["sold", "moved_out"].includes(p.status)).flatMap((p) => {
    const profile = state.houseProfiles[p.id] || null;
    return monthTasks(y, m, profile, p.id).filter((x) => !x.done).map((x) => {
      const late = x.task.once && x.task.rec.due_on < today;
      return {
        source: "season", severity: late ? 1 : 3, must: false, due: x.task.once ? x.task.rec.due_on : null, daysLeft: null, property_id: p.id,
        title: x.task.custom ? x.task.name : t(x.task.name), detail: x.task.once ? onceDue(x.task) : x.task.note ? t(x.task.note) : t("{month}季节任务", { month: monthName(m) }), href: href("house", "tasks"),
        actions: [{ type: "check", attrs: taskAttrs(x, y, m) }],
      };
    });
  });
}

/* ── 页面：一次只看一个月，‹ › 或左右滑动换月 ── */
/** 当前查看的年月（state.tasksYM = "YYYY-MM"，空 = 本月） */
export function tasksYM() {
  const now = new Date();
  const [y, m] = (state.tasksYM || periodOf(now.getFullYear(), now.getMonth() + 1)).split("-").map(Number);
  return { y, m };
}
export function shiftTasksMonth(delta) {
  const { y, m } = tasksYM();
  const d = new Date(y, m - 1 + delta, 1);
  state.tasksYM = periodOf(d.getFullYear(), d.getMonth() + 1);
  state.seasonForm = null;
}

export function viewTasks() {
  const p = state.houseProfile;
  const now = new Date(), curY = now.getFullYear(), curM = now.getMonth() + 1;
  const { y: year, m: month } = tasksYM();
  const isCur = year === curY && month === curM;
  const list = monthTasks(year, month);
  const nextM = month === 12 ? 1 : month + 1, nextY = month === 12 ? year + 1 : year;
  const next = monthTasks(nextY, nextM).filter((x) => !x.done);
  const undone = list.filter((x) => !x.done).length;
  const newForm = state.seasonForm && !state.seasonForm.id ? `<div class="panel" style="margin-bottom:12px">${seasonForm(null, year, month)}</div>` : "";
  return `
    ${houseBar()}
    <section class="section">
      ${p ? `<p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("{region}模板，按你家的设施筛选；也可以添加自己的任务", { region: esc(t(H().REGIONS[p.region]?.name || "")) })}</p>`
        : `<p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("还没填房屋资料，只显示自己添加的任务。")} <a href="${href("house", "profile")}">${t("填写房屋资料")}</a> ${t("后会按地区和设施生成模板任务。")}</p>`}
      <div class="month-nav tasks-swipe" role="group" aria-label="${t("选择月份")}">
        <button type="button" class="month-btn" data-action="tasks-prev" aria-label="${t("上个月")}">‹</button>
        <div class="month-cur"><b>${monthName(month)}</b><small>${year} · ${t("{season}季", { season: t(seasonOf(month)) })}${isCur ? ` · ${t("本月")}` : ""}</small></div>
        <button type="button" class="month-btn" data-action="tasks-next" aria-label="${t("下个月")}">›</button>
      </div>
      <div class="section-head" style="margin-top:10px"><p>${list.length ? `${undone ? t("还有 {n} 项没做", { n: undone }) : t("都做完了")}${t("，共 {n} 项", { n: list.length })}` : t("这个月没有任务")}</p>
        <div class="head-acts">${isCur ? "" : `<button type="button" class="btn btn-sm btn-ghost" data-action="tasks-today">${t("回到本月")}</button>`}
          <button type="button" class="btn btn-sm btn-primary" data-action="season-new">＋ ${t("添加任务")}</button></div></div>
      ${newForm}
      <div class="panel tasks-swipe">${list.length ? `<ul class="task-list">${list.map((x) => taskRow(x, year, month)).join("")}</ul>` : `<div class="empty"><strong>${t("这个月没有季节任务")}</strong>${t("左右滑动或点 ‹ › 看前后月份；也可以添加自己的任务。")}</div>`}</div>
      <p class="disclaimer">${t("任务清单为常见做法，频次以设备说明书和当地气候为准；涉及燃气、电、屋顶作业请找专业人员。")} ${t("手机上左右滑动可切换月份。")}</p>
    </section>
    ${next.length ? `<section class="section"><div class="section-head"><h2>${t("{month}预告", { month: monthName(nextM) })}</h2><p>${t("提前安排师傅或采购")}</p></div>
      <div class="panel"><ul class="tips">${next.slice(0, 8).map((x) => `<li>${esc(x.task.custom ? x.task.name : t(x.task.name))}</li>`).join("")}</ul></div></section>` : ""}`;
}

/** 自定义任务表单：每年重复（选月份）或一次性（选日期）；rec 为 null = 新建 */
function seasonForm(rec, year, month) {
  const once = rec ? !rec.months?.length : false;
  const months = rec?.months?.length ? rec.months : [month];
  const dueDefault = rec?.due_on || periodOf(year, month) + "-" + String(Math.min(new Date().getDate(), 28)).padStart(2, "0");
  return `<form id="seasonForm" class="task-edit-form ${once ? "is-once" : ""}" novalidate>
    <input type="hidden" name="task_id" value="${esc(rec?.id || "")}">   <!-- 不能叫 id：会盖掉 form.id，submit 分发认不出这个表单 -->
    <div class="form-grid">
      <label class="span-2">${t("任务名称")}<input name="name" required maxlength="120" value="${esc(rec?.name || "")}" placeholder="${esc(t("如：清洗露台家具、换净水器滤芯、修栅栏"))}"></label>
      <div class="span-2 seg-radio">
        <label class="radio-pill"><input type="radio" name="mode" value="recurring" ${once ? "" : "checked"}><span>🔁 ${t("每年重复")}</span></label>
        <label class="radio-pill"><input type="radio" name="mode" value="once" ${once ? "checked" : ""}><span>📌 ${t("一次性")}</span></label>
      </div>
      <div class="span-2 months-pick only-recurring" role="group" aria-label="${t("哪些月份")}">
        ${MONTHS.map((n, i) => `<label class="chip-check"><input type="checkbox" name="months" value="${i + 1}" ${months.includes(i + 1) ? "checked" : ""}><span>${t(n)}</span></label>`).join("")}
        <small class="muted span-all">${t("连续的月份算一个窗口，窗口内勾一次就算完成；12 个月都选 = 每月任务")}</small>
      </div>
      <label class="only-once">${t("日期")}<input name="due_on" type="date" value="${esc(dueDefault)}"><small>${t("出现在那个月的任务里；逾期会在首页提醒")}</small></label>
      <label class="span-2">${t("备注")}<input name="note" maxlength="500" value="${esc(rec?.note || "")}" placeholder="${esc(t("怎么做、找谁、注意什么…"))}"></label>
    </div>
    <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary btn-sm" type="submit">${t("保存")}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="season-cancel">${t("取消")}</button>
      ${rec ? `<button class="btn btn-ghost btn-sm" type="button" data-action="season-delete" data-id="${esc(rec.id)}">${t("删除这条任务")}</button>` : ""}
      <span class="dirty-note" hidden>● ${t("有未保存的修改")}</span></div>
  </form>`;
}

export async function saveSeasonForm(f) {
  const fe = f.elements;
  const name = fe.name.value.trim();
  if (!name) { toast(t("请填任务名称")); fe.name.focus(); return false; }
  const once = fe.mode.value === "once";
  const months = once ? [] : [...f.querySelectorAll('input[name="months"]:checked')].map((x) => +x.value).sort((a, b) => a - b);
  if (!once && !months.length) { toast(t("至少选一个月份")); return false; }
  const due_on = once ? fe.due_on.value || null : null;
  if (once && !due_on) { toast(t("请选日期")); fe.due_on.focus(); return false; }
  const cur = fe.task_id.value ? (state.customSeasonal || []).find((c) => c.id === fe.task_id.value) : null;
  await Store.saveCustomSeasonal({ id: cur?.id, property_id: cur?.property_id || state.propertyId, name, note: fe.note.value.trim() || null, months, due_on,
    done_on: once ? cur?.done_on || null : null, done_by_name: once ? cur?.done_by_name || null : null });
  toast(cur ? t("已保存") : t("已添加任务"));
  return true;
}
export const deleteSeasonTask = (id) => Store.deleteCustomSeasonal(id);

/** 勾选 / 取消勾选：模板和重复任务写 seasonal_tasks（取消时删掉实际记录所在的 period，可能是窗口里的另一个月）；一次性任务改它自己那行 */
export async function toggleTask(input) {
  const key = input.dataset.task, period = input.dataset.period, undo = input.dataset.undo, pid = input.dataset.prop || state.propertyId;
  input.disabled = true;
  if (input.dataset.once) {
    const c = (state.customSeasonal || []).find((x) => x.id === input.dataset.once);
    if (c) await Store.saveCustomSeasonal({ ...c, done_on: input.checked ? todayISO() : null, done_by_name: input.checked ? state.displayName : null });
    return;
  }
  if (input.checked) await Store.setSeasonal(key, period, true, state.displayName, pid);
  else await Store.setSeasonal(key, undo || period, false, null, pid);
}
