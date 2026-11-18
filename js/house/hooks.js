/* 房屋页面模块加载后把几个函数挂在这里，让目录 / 面包屑（menu.js，每个页面都会用）不必静态引用整个房屋模块。
 * 房屋模块没加载时对应函数不存在：menu.js 用 houseHooks.xxx?.() 取，缺了就当没有（那时房屋页面也还没画）。 */
export const houseHooks = {};
