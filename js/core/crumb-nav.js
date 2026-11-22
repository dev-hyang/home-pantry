/* 深层页面（详情、表单、子页）的「目录」按钮：这些页面仍用带名字的面包屑回上一层，这里在面包屑最前面放一个目录按钮，
 * 打开的是所在区域的同一棵嵌套目录（财务 / 房屋 / 储藏 / 采购 / 我的），所以全站任何页面都能直接跳到别处。
 * 已经有页头（页头自带目录）的页面不重复加。每次画完页面由 app/render.js 调一次。 */
import { treePop } from "./tree-pop.js";
import { finTree } from "../bills/fin-tree.js";
import { houseTree } from "../house/house-nav.js";
import { buyTree } from "../shops/buy-nav.js";
import { meTree } from "../settings/me-nav.js";
import { pantryNodes } from "../pantry/restock-sync.js";

/** 这一页属于哪个区域 → 目录的树；不属于任何区域（今日、咩咩咩…）返回 null */
function treeFor(r) {
  switch (r?.section) {
    case "bills": case "bill": case "otbill": return finTree(r);
    case "house": case "asset": return houseTree(r);
    case "pantry": case "item": return pantryNodes("");
    case "shopping": case "shops": return buyTree("");
    case "me": return meTree(r);
    default: return null;
  }
}

export function addCrumbNav(r) {
  const main = document.getElementById("main"); if (!main || main.querySelector(".fin-head")) return;   // 有页头 = 已经有目录
  const crumb = main.querySelector("nav.crumb"); if (!crumb || crumb.closest(".crumb-row")) return;
  const nodes = treeFor(r); if (!nodes) return;
  const row = document.createElement("div"); row.className = "crumb-row";
  crumb.before(row); row.innerHTML = treePop(nodes, { id: "decktree" }); row.append(crumb);
}
