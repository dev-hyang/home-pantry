/* 房屋维护 · 第二期：季节任务
 * 模板在 data/house.js（按地区、月份、设施）；完成记录存 seasonal_tasks(task_key, period = "YYYY-MM")。
 * 连续的月份算同一个窗口（例如 9–10 月的炉子检修），窗口内任何一个月勾了就算完成；12 个月都有的是每月任务。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate } from "../core/util.js";
import { href } from "../core/router.js";
import { compare, joinList, t } from "../core/i18n.js";

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

/** 某个月适用的任务及完成状态 */
export function monthTasks(year, month) {
  return H().seasonalTasksFor(state.houseProfile)
    .filter((x) => x.months.includes(month))
    .map((task) => {
      const periods = windowPeriods(task, year, month);
      const done = state.seasonalDone.find((d) => d.task_key === task.key && periods.includes(d.period)) || null;
      return { task, periods, done };
    })
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || compare(t(a.task.name), t(b.task.name)));
}

export const undoneThisMonth = () => { const d = new Date(); return monthTasks(d.getFullYear(), d.getMonth() + 1).filter((x) => !x.done); };

export function taskRow({ task, done }, year, month) {
  const id = `task-${task.key}-${year}-${month}`;
  const when = done ? t("{date} {who}已完成", { date: fmtDate(done.done_on), who: done.done_by_name ? `${esc(done.done_by_name)} ` : "" })
    : task.note ? esc(t(task.note)) : task.months.length >= 12 ? t("每月一次") : joinList(task.months.map(monthName));
  return `<li class="task-row ${done ? "done" : ""}">
    <input type="checkbox" id="${id}" data-task="${esc(task.key)}" data-period="${periodOf(year, month)}" data-undo="${esc(done?.period || "")}" ${done ? "checked" : ""}>
    <label for="${id}"><b>${esc(t(task.name))}</b><small>${when}</small></label>
  </li>`;
}

export function viewTasks() {
  const p = state.houseProfile;
  if (!p) return `<section class="section"><div class="panel empty"><strong>${t("先填写房屋资料")}</strong>${t("季节任务按地区、房型和设施生成，例如秋季关闭室外水龙头、春季测试排水泵。")}<p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></p></div></section>`;
  const now = new Date(), curM = now.getMonth() + 1, year = now.getFullYear();
  const month = state.tasksMonth || curM;
  // 查看的月份在今年；看“去年 12 月”这类情况不处理，季节任务只看前后
  const list = monthTasks(year, month);
  const nextM = month === 12 ? 1 : month + 1, nextY = month === 12 ? year + 1 : year;
  const next = monthTasks(nextY, nextM).filter((x) => !x.done);
  const chips = MONTHS.map((n, i) => `<button type="button" class="chip" data-action="tasks-month" data-month="${i + 1}" aria-pressed="${month === i + 1}">${t(n)}${i + 1 === curM ? t("·今") : ""}</button>`).join("");
  const undone = list.filter((x) => !x.done).length;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("季节任务")}</h2><p>${t("{region}模板，按你家的设施筛选", { region: esc(t(H().REGIONS[p.region]?.name || "")) })}</p></div>
      <div class="chips" role="group" aria-label="${t("选择月份")}">${chips}</div>
      <div class="section-head"><h3 style="font-size:17px">${monthName(month)}${month === curM ? t("（本月）") : ""} · ${t("{season}季", { season: t(seasonOf(month)) })}</h3>
        <p>${list.length ? `${undone ? t("还有 {n} 项没做", { n: undone }) : t("都做完了")}${t("，共 {n} 项", { n: list.length })}` : t("这个月没有任务")}</p></div>
      <div class="panel">${list.length ? `<ul class="task-list">${list.map((x) => taskRow(x, year, month)).join("")}</ul>` : `<div class="empty"><strong>${t("这个月没有季节任务")}</strong>${t("看看前后月份。")}</div>`}</div>
      <p class="disclaimer">${t("任务清单为常见做法，频次以设备说明书和当地气候为准；涉及燃气、电、屋顶作业请找专业人员。")}</p>
    </section>
    ${next.length ? `<section class="section"><div class="section-head"><h2>${t("{month}预告", { month: monthName(nextM) })}</h2><p>${t("提前安排师傅或采购")}</p></div>
      <div class="panel"><ul class="tips">${next.slice(0, 8).map((x) => `<li>${esc(t(x.task.name))}</li>`).join("")}</ul></div></section>` : ""}`;
}

/** 勾选 / 取消勾选：取消时删掉实际记录所在的 period（可能是窗口里的另一个月） */
export async function toggleTask(input) {
  const key = input.dataset.task, period = input.dataset.period, undo = input.dataset.undo;
  input.disabled = true;
  if (input.checked) await Store.setSeasonal(key, period, true, state.displayName);
  else await Store.setSeasonal(key, undo || period, false);
}
