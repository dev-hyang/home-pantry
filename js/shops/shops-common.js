/* 常去的商店各页面共用的小件：页面状态（ui / dealUi）、星期、距离、商店链接、「迁移没执行」提示。从 views.js 抽出来，各页面依赖这里。 */
import { href } from "../core/router.js";
import { miles, savedZip } from "./logic.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

export const DOW = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export const ui = () => (state.shopUi ||= { q: "", cat: "", status: "active", sort: "name", edit: null, find: { zip: savedZip()?.zip || "", radius: 10, cats: ["groceries", "warehouse", "department"], results: null, busy: false, error: "", pt: savedZip() }, deal: {} });
export const dealUi = (id) => (ui().deal[id] ||= { busy: false, error: "", rows: null, replace: true, filter: "all", cat: "", sort: "unit", q: "", edit: null });
export const home = () => ui().find.pt || savedZip();
export const distOf = (s) => miles(home(), s);
export const shopHref = (s) => `${href("shops", "shop")}/${encodeURIComponent(s.id)}`;
export const missingPanel = () => (state.shopsMissing ? `<div class="panel cta-panel"><div><b>${t("数据库还没升级")}</b><p class="muted">${t("请在 Supabase 的 SQL Editor 执行 migrations/067_shops_deals.sql，商店和特价才能保存。")}</p></div></div>` : "");
