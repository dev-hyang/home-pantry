/* 录入购物各部分共用的小件。从 scan.js 抽出来，各部分依赖这里。 */
import { $ } from "../core/util.js";
import { guessFor } from "../core/sub-guess.js";
import { state } from "../core/state.js";
import { viewScan } from "./scan-page.js";
import { refreshFormChrome } from "../core/form-chrome.js";

/** 新物品的小类：按名称猜（只在 AI / 用户选的那个分类里取）；猜不到留空 */
export const subGuess = (name, cat) => { const g = guessFor(name, cat, null); return g && g[0] === cat ? g[1] : null; };
export const MAX_IMAGES = 8;
   // 一次最多 8 张：可以是几张不同的小票，也可以是一张长小票的几段
export const sc = { kind: "receipt", stage: 1, skipPhoto: false, mode: "auto", record: "both", step: "input", images: [], text: "", json: "", date: "", busy: false, progress: "", error: "", result: null, pool: [] };
export function resetScan() { Object.assign(sc, { kind: "receipt", stage: 1, skipPhoto: false, mode: "auto", record: "both", step: "input", images: [], text: "", json: "", date: "", busy: false, progress: "", error: "", result: null, pool: [] }); }
export const repaint = () => { const sec = $("#main .scan-page"); if (sec && state.route.section === "pantry" && state.route.sub === "scan") sec.outerHTML = viewScan(); refreshFormChrome(); };   // 局部重画后补回：底部取消 / 确认同一行、顶部置顶条、隐藏底部导航
