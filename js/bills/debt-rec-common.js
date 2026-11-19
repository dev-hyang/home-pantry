/* 借贷流水各部分共用的小件。从 debt-records.js 抽出来，各部分依赖这里。 */
import { num } from "../core/util.js";
import { state } from "../core/state.js";

export const ui = () => (state.debtUi ||= {});
export const mny = (v, c) => (v == null ? "—" : Units.money(v, c || Units.region.currency));
export const r2 = (v) => Math.round(num(v) * 100) / 100;
