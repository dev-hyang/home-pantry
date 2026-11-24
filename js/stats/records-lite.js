/* 花费列表的同步小件：基础查询条件、筛选默认值。 */
import { TZ } from "./spend-roll.js";
import { natureParams } from "../core/taxonomy.js";
import { medNames } from "./records-lite-common.js";

/** 花费流水查询的基本参数（时区、本币、事件型账单的名称、分类的默认性质 / 转账）：别的模块按需读花费时在它上面加筛选 */
export const spendBase = (sort = "new") => ({ tz: TZ(), cur: Units.region.currency, med: medNames(), sort, ...natureParams() });
export const NO_SPEND_FILTER = () => ({ q: "", cat: "all", grp: null, nat: "all", prop: "all", store: "all", stores: null, range: "all", amt: "all", amin: "", amax: "", year: "all", mon: "all", months: null, dmax: null, batch: null });
