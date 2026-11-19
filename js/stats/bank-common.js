/* 银行对账单导入各部分共用的小件。从 bank-import.js 抽出来，各部分依赖这里。 */
import { inc as incState } from "../income/logic.js";

/** 导入完 / 撤销后让应用重读数据的函数：initBankImport 时才交进来（用对象装，别的文件才能改） */
export const bankHooks = { refresh: null };
/** 收入功能可用（迁移 042 已执行、已读到）：入账（工资 / 电汇 / Zelle 转入…）才会单独列出来，否则照旧默认跳过 */
export const incomeOk = () => incState().loaded && incState().ok;
