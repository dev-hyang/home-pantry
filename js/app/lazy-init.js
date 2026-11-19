/* 懒加载模块加载完后要执行一次的启动调用（需要 render / refresh，所以不放进 lazy-modules.js，免得循环引用）。 */
import { LZ } from "./lazy-modules.js";
import { refresh } from "./data.js";
import { render } from "./render.js";
import { hooks as incomeRollupHooks } from "../income/rollup.js";

LZ.bankImport.onLoad((m) => m.initBankImport({ refresh }));
LZ.statements.onLoad((m) => m.initStatements({ render }));
LZ.debts.onLoad((m) => m.initDebts({ render, refresh }));
LZ.netWorth.onLoad((m) => m.initNetWorth({ render }));
LZ.incomeViews.onLoad((m) => m.initIncome({ render, refresh }));
Object.assign(incomeRollupHooks, { render, refresh });   // 净资产页等也会读收入聚合：读完要能重画，所以不等收入页加载
LZ.shopsViews.onLoad((m) => m.bindShops((force) => render(force !== false)));   // 常去的商店：表单提交、搜索框、筛选（商店页加载后才绑定）
