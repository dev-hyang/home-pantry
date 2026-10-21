/* 预算分组的登记处：明细页要按“预算分组”（日常储备 / 房屋维护 / 大件家电…）筛选，但分组规则在 bills/budget.js，
 * 而 budget.js 又依赖 stats/views.js，直接互相引用会成环；所以由 budget.js 把判断函数登记到这里，明细页从这里取。 */
export const budgetBridge = { groupOf: null, groups: [] };
