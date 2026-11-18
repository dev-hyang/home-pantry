/* 季节任务的纯逻辑（不碰界面）：某个月适用的任务及完成状态、窗口、自定义任务 key、去年 1 月起的读取起点。
 * 从 tasks.js 抽出来：启动时读完成记录、统计页要数「本月做了几项」，不必为此加载整个季节任务页面。tasks.js 照旧从这里转出口。 */
import { state } from "../core/state.js";
import { compare, t } from "../core/i18n.js";
import { isRetired } from "./assets-logic.js";

const H = () => window.HOUSE;
export const periodOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
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
  // 这套房产已有的设备类型（不含召回后退役的）：小家电的换季任务按“有这台设备”出现（a:<类型>）
  const have = [...new Set(state.assets.filter((a) => a.property_id === pid && !isRetired(a)).map((a) => a.type))];
  const tpl = H().seasonalTasksFor(profile, have)
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
