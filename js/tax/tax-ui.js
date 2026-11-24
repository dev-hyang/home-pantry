/* 税务页的界面状态（只在内存里，不入库）：重画页面（每次保存后都会）时保持用户正在做的事。
 *  open：买卖页每套房 / 每辆车的展开 / 折叠（用户点过的以用户为准）；add：正在「添加一项」的那一块 "房产 id|清单名"；
 *  cd：Closing Disclosure 自动识别的结果，等你核对后再加进清单 { id: 房产 id, data: 识别结果 }。 */
export const ui = { open: new Map(), add: null, cd: null, spend: new Map(), pick: null };
/* spend：房产 id → { rows, err }，这套房关联的花费记录（打开买卖页时读，不入库）；pick：正在「从记录里选」的那一块 "房产 id|清单名" */
