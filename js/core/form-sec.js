/* 编辑页「只改一块」：详情页每一块的「编辑」带 &sec=<块 id>，编辑页只显示那一块的字段。
 * 做法：表单里每个字段（或一组字段）的外壳带上 data-fsec="块 id"；不是这一块的加 hidden（CSS 保证真的藏起来）。
 * 藏起来的字段还在表单里、值原样带着，所以保存时整条记录照存，没改的不会丢。没有 sec（新建、旧链接）= 全部显示。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { state } from "./state.js";

/** 路由里的 sec（没有、或不在这张表单认识的块里 = 空串，显示全部）；known：块 id 的对象或数组 */
export const curSec = (known) => { const s = state.route?.q?.get("sec") || ""; return !s || !known || (Array.isArray(known) ? known.includes(s) : s in known) ? s : ""; };
/** 放在字段外壳的开始标签里：`<label ${fsec("basic", sec)}>` */
export const fsec = (id, sec = curSec()) => `data-fsec="${id}"${sec && sec !== id ? " hidden" : ""}`;
/** 只改一块时表单顶上的小标题：编辑 · 基本信息（没有 sec 返回空串） */
export const secTitle = (name, sec = curSec()) => (sec ? `<h3 class="fsec-title">${esc(t("编辑 {name}", { name: t(name) }))}</h3>` : "");
