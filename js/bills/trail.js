/* 账单页的路径：财务 / 账单概览 / 资产（房产、车辆、设备、患者…）/ 账单名 —— 周期性和一次性账单详情页共用。
 * 第二、三级点了回「账单概览」：第二级恢复默认筛选，第三级 = 同一页按这个资产筛选（#/bills/overview/<资产键>，键形如 property:ID / asset:ID / person:ID）。 */
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { assetKeys } from "./instances.js";
import { finBase } from "../core/crumb-base.js";
import { assetKeyLabel } from "./all-views.js";

/** 概览页的网址：不带资产 = 默认筛选；带资产 = 路径里加一段；extra 是 ?range=m 这类查询参数 */
export const overviewHref = (key, extra = {}) => {
  const q = new URLSearchParams(Object.entries(extra).filter(([, v]) => v)).toString();
  return `${href("bills", "overview", key && key !== "all" ? `/${encodeURIComponent(key)}` : "")}${q ? `?${q}` : ""}`;
};
/** 一张账单最能代表它的资产键：具体的设备 / 车辆 > 患者 > 房产 > 其他（家庭通用、医疗…） */
export function scopeKeyOf(b, kind) {
  const keys = assetKeys(b, kind);
  return keys.find((k) => k.startsWith("asset:")) || keys.find((k) => k.startsWith("person:")) || keys.find((k) => k.startsWith("property:")) || keys[0];
}
/** 面包屑各级：last = 最后一级（账单名，或「账单名」下的子页由调用方继续往后接） */
export function billScopeParts(b, kind) {
  const key = scopeKeyOf(b, kind), home = overviewHref();
  return [...finBase("overview"), { href: home, label: t("账单概览") }, ...(key ? [{ href: overviewHref(key), label: assetKeyLabel(key).replace(/^\S+\s/, ""), icon: assetKeyLabel(key).split(" ")[0] }] : [])];
}
