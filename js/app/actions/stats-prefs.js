/* 统计页的偏好：排除资本性 / 投资、各页共用的时间范围。 */
import { normRange, setFinRange } from "../../core/time-range.js";
import { state } from "../../core/state.js";

   // 账单概览右下角「＋」：点别处收起
/** 改共享的时间范围：花费（state.stats.months）和收入页一起变，存在本机 */
/** 排除资本性 / 排除投资：和时间范围一样存在本机，下次打开照旧（默认都排除） */
export function saveStatToggles() { try { localStorage.setItem("hmh-fin-excap", state.stats.exCap ? "1" : "0"); localStorage.setItem("hmh-fin-exinv", state.stats.exInv ? "1" : "0"); } catch { /* 忽略 */ } }
export function setSharedRange(v) { state.stats.months = normRange(v); state.stats.month = null; setFinRange(state.stats.months); }
