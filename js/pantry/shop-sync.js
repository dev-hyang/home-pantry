/* 购物车的同步小件：选中文字、单位、可见条目。 */
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { shopRows } from "./shop-sync-common.js";

/* ── 购物车 ── */
/** 待买 / 认领中的数量可改：−/+ 按单位步进（kg 0.5、lb 1、个 1…），也能直接在框里输数；按显示单位算，存回时换回原单位 */
/** 采购条目的单位：自己改过的优先，没有就跟库存里这件东西的单位 */
export const shopUnit = (s) => s.unit || state.items.find((i) => i.id === s.item_id)?.unit || "";
/** 清单页的一行：数量可改、在哪买 / 花费 / 用卡、认领和买到 */
export const shopSelText = () => (state.shopSel?.size ? t("已选 {n} 项", { n: state.shopSel.size }) : t("点行来选"));
/** 购物车当前筛选下看得见的条目（全选用） */
export const shopVisibleIds = () => shopRows().map((s) => s.id);
