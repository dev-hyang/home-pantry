export { pantryNav, restockPanel, rsHint, setFold, shelfGrid, viewDashboard } from "./restock.js";
export { catFormHtml, catStatus, groupedCats, isPhone, matchItem, moveCat, orderedCats } from "./inventory.js";
export { cartTag, catNeed, invView, itemCard, itemRow, renderInvList, secNeed, selBarText, setInvView, statusTag, viewInventory, visibleItemIds } from "./inventory-items.js";
export { importNames, renderShopList, shopSelText, shopUnit, shopVisibleIds, viewShopping } from "./shopping.js";
export { categoryOptions, scoreRecipes, viewMeals } from "./meals.js";


/* 下拉导航（储藏概览在手机上的入口）：选了就跳过去 */
document.addEventListener("change", (e) => { if (e.target.matches?.("select[data-go]") && e.target.value) location.hash = e.target.value; });
