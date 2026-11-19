/* 花费明细导出成表格的行（导出 CSV 时同步用到）。 */
import { effNature, l1Of, l2Of, leafInfo, natureName } from "../core/taxonomy.js";
import { num } from "../core/util.js";
import { paymentPayLabel } from "../bills/card-picker.js";
import { state } from "../core/state.js";
import { storeOf } from "./store-lite.js";
import { t } from "../core/i18n.js";
import { ymd } from "./store-rows-common.js";

/** 花费明细 CSV 的表头 + 每一笔（年度报表的明细、明细页「导出当前列表」共用） */
/** 一级 / 二级 / 叶子分类、经济性质（空 = 按分类默认，写出实际用的）、关联房产 都写成列，方便在表格里透视 */
export function spendDetailRows(list) {
  const propName = (id) => (id ? state.properties.find((x) => x.id === id)?.name || "" : "");
  return [[t("日期"), t("物品"), t("一级分类"), t("二级分类"), t("分类"), t("经济性质"), t("商店 / 收款方"), t("数量"), t("单位"), t("金额"), t("货币"), t("付款方式"), t("关联房产"), t("关联库存")],
    ...list.map((p) => { const [a, b, c] = [l1Of(p.category), l2Of(p.category), leafInfo(p.category)];
      return [ymd(p.purchased_at), p.name, t(a.name), t(b.name), t(c.name), t(natureName(effNature(p.category, p.nature))), storeOf(p), p.quantity == null ? "" : num(p.quantity), p.unit ? t(p.unit) : "",
        p.amount == null ? "" : num(p.amount), p.currency || "", paymentPayLabel(p), propName(p.property_id), p.item_id ? t("是") : t("否")]; })];
}
