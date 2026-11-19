/* 懒加载模块加载完后要执行一次的启动调用（需要 render / refresh，所以不放进 lazy-modules.js，免得循环引用）。 */
import { LZ } from "./lazy-modules.js";
import { refresh } from "./data.js";
import { render } from "./render.js";

LZ.bankImport.onLoad((m) => m.initBankImport({ refresh }));
LZ.statements.onLoad((m) => m.initStatements({ render }));
LZ.debts.onLoad((m) => m.initDebts({ render, refresh }));
