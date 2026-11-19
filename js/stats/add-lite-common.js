/* 花费页的同步小件：时间栏、范围文字、房产下拉、导出标签。 */
import { state } from "../core/state.js";

/* ── 记一笔：分类按 一级 · 二级 分组；经济性质（默认按分类）；有房产时可以选关联哪套房 ── */
export const activeProps = () => (state.properties || []).filter((p) => !p.archived);
