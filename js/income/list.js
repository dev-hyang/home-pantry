/* 收入明细的服务端分页列表：刷新数据时要把它标过期，所以放在启动就有的小文件里；画列表的函数由收入页加载后挂上来（incDraw）。 */
import { num } from "../core/util.js";
import { serverList } from "../core/server-list.js";

/** 画明细列表的函数：收入页加载后才挂上来（本文件末尾）。list.js 启动时就要，不能反过来引用本文件 */
export const incDraw = { fn: () => {} };
/** 明细列表：读到的几页 + 当前筛选的笔数、合计 */
export const incList = serverList("inc", { host: "#incList", map: (r) => ({ ...r, amount: num(r.amount), income_amount: r.income_amount == null ? null : num(r.income_amount) }), draw: () => incDraw.fn() });
window.addEventListener("income-rows-changed", () => incList.reload());
