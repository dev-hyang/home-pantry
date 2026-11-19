/* 卡与账户各部分共用的小件。从 cards-views.js 抽出来，各部分依赖这里。 */
import { cardsRO } from "../core/finance-access.js";
import { esc, toast } from "../core/util.js";
import { t } from "../core/i18n.js";

/** 没有财务权限的家人：用卡只读。写入口都先过这里（界面上的按钮也不画；数据库由迁移 050 的行级安全兜底） */
export function roStop() {
  if (!cardsRO()) return false;
  toast(t("用卡是只读的：家主开放财务权限后才能修改")); return true;
}
export const D = () => window.CARDS;
export const d = (v) => esc(v ?? "");
export const cur = () => Units.region.currency;
export const catalogAge = () => Math.round((Date.now() - new Date(`${D().AS_OF}T12:00:00`)) / 864e5);
