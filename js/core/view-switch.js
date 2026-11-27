/* 视图切换（统一控件）：靠右的深色圆角按钮「切换 [图标] 当前视图名」，点开列出几种视图（当前的打 ✓），选中后收起。
 * 2026-11-27.15 起和牧羊人同一个控件：真正的实现在 shared/ui-viewsw.js（母版，姊妹站各有逐字相同的副本），样式在 shared/ui.css 的 .ui-vsw；
 * 这里只是保留各页原来的写法：viewSwitch(options, current, { action, attr, label })，菜单项上带 data-action，页面自己的点击处理读 data-xx。
 * options = [[值, 名称, 图标?], …]（图标不再显示）；action = 页面原来的 data-action；attr = 值放在哪个 data-xx（默认 data-v）。 */
import { t } from "./i18n.js";
import { esc } from "./util.js";
import { viewSwitchHTML, watchViewSwitch } from "../../shared/ui-viewsw.js";

watchViewSwitch();   // 点外面 / Esc 收起（只注册一次）
export function viewSwitch(options, current, { action, attr = "v", label = "视图" } = {}) {
  return viewSwitchHTML(options, current, { attr, attrs: `data-action="${esc(action)}"`, label, t });
}
