/* 成员页面和同步小件共用的小件。 */
import { Store } from "../core/store.js";

export const demo = () => Store.mode === "demo";
export const F = { edit: null, devShow: 6, devOpen: null, scopeAll: false, renameDev: null, linkDev: null };
