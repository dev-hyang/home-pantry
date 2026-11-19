/* 设备各页面共用的小件：保养 / 保修状态徽章、固定装置与小家电的判断、位置数量文字、设备提醒文字、车辆状态。从 assets.js 抽出来，各页面依赖这里。 */
import { RECALL_STATUS, recallAlertText } from "./recall.js";
import { debts as allDebts, debtHref, enrichDebt } from "../bills/debt-logic.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { href } from "../core/router.js";
import { isClosedStatus } from "../core/debt-rules.js";
import { isVehicle, rank } from "./assets-logic.js";
import { pricesOk } from "../core/finance-access.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 车辆的车贷（按 id 关联，迁移 058）：有财务权限才显示，链到 财务 → 借贷；没有车贷时给「添加车贷」 */
export function vehicleLoanNote(a) {
  if (!a?.id || !pricesOk() || !state.debtsOk) return "";
  const list = allDebts().filter((x) => x.asset_id === a.id && x.direction === "payable");
  const live = list.filter((x) => !isClosedStatus(x.status)).map(enrichDebt);
  if (live.length) return `<small>${live.map((e) => `<a href="${esc(debtHref(e.id))}">${esc(e.name)}</a>${e.balance != null ? ` · ${t("未还 {a}", { a: money(e.balance) })}` : ""}${e.link_confirmed === false ? ` · ${t("待确认")}` : ""}`).join("；")}</small>`;
  return list.length ? `<small>${t("车贷已还清")}</small>` : `<small><a href="${esc(debtHref(null, `new=1&cat=auto_loan&asset=${encodeURIComponent(a.id)}`))}">${t("添加车贷")}</a></small>`;
}
   // 纯逻辑在 assets-logic.js

export const H = () => window.HOUSE;
export const V = () => window.VEHICLES;
export const C = () => window.CARE;
export const OWNER_OPTS = ["self", "hoa", "landlord", "property", "varies"];
/** 固定装置：一类一条（马桶 ×3 是一条），位置和数量在 units：[{ loc, qty, note }] */
export const isFixture = (a) => !!(a?.t?.fixture || H().isFixtureType?.(a?.type));
/** 小家电 / 季节电器：一台一条，只是列表里单独一组 */
export const isPortable = (a) => !!(a?.t?.portable || H().isPortableType?.(a?.type));
export const unitsOf = (a) => (Array.isArray(a?.units) ? a.units.filter((u) => u && (u.loc || u.note || num(u.qty) > 0)) : []);
export const unitsCount = (a) => unitsOf(a).reduce((n, u) => n + (num(u.qty) > 0 ? num(u.qty) : 1), 0);
/** “共 3 处：主卫 1 · 客卫 1 · 地下室 1” */
export const unitsText = (a, max = 4) => {
  const u = unitsOf(a); if (!u.length) return "";
  const parts = u.slice(0, max).map((x) => `${x.loc ? t(x.loc) : t("未指定位置")}${num(x.qty) > 1 ? ` ${num(x.qty)}` : ""}`);
  return `${t("共 {n} 处", { n: unitsCount(a) })}：${parts.join(" · ")}${u.length > max ? " …" : ""}`;
};
/** 车辆拥有状态（选购中 / 持有 / 贷款中 / 租赁 / 已卖出 / 已归还）与徽章 */
export const vehStatus = (a) => V().statusOf(a);
export const vehStatusBadge = (a) => { const st = V().STATUS[vehStatus(a)]; return `<span class="badge ${st.cls}" ${st.cls ? "" : 'style="background:var(--surface-2)"'}>${t(st.name)}</span>`; };
/** 里程单位：美制英里，其余公里（模板里的数字按用户单位理解） */
export const distUnit = () => (Units.region.system === "us" ? t("英里") : t("公里"));
export const SERVICE_BADGE = {
  overdue: { cls: "b-out",  label: "保养逾期" },
  due:     { cls: "b-soon", label: "该保养了" },
  ok:      { cls: "b-ok",   label: "保养正常" },
  unknown: { cls: "b-low",  label: "未记录保养" },
  none:    { cls: "",       label: "" },
};
export const WARRANTY_BADGE = {
  expiring: { cls: "b-soon", label: "保修快到期" },
  expired:  { cls: "",       label: "已过保" },
  active:   { cls: "b-ok",   label: "保修中" },
  none:     { cls: "",       label: "" },
};
/** 当前房产的设备（不含车辆，车辆挂在家庭上） */
export const myAssets = () => state.assetsEnriched.filter((a) => a.property_id === state.propertyId && !isVehicle(a) && !a.retired);
/** 当前房产里召回后已换新 / 退款的旧设备 */
export const retiredAssets = () => state.assetsEnriched.filter((a) => a.property_id === state.propertyId && !isVehicle(a) && a.retired);
/** 概览用：召回停止使用 > 召回待处理 > 检查发现问题 > 逾期 > 该保养 > 保修快到期（退役的不算） */
export const assetAlerts = (list) => list
  .filter((a) => !a.retired && (a.recallSt || a.followUp || a.service === "overdue" || a.service === "due" || a.warranty === "expiring"))
  .sort((x, y) => rank(x) - rank(y) || (x.dueDays ?? 999) - (y.dueDays ?? 999));
/** 列表 / 提醒里的徽章和主操作：召回 → 处理召回；其余 → 记保养 */
export const alertBadge = (a) => (a.recallSt ? { label: t(RECALL_STATUS[a.recallSt].short), cls: RECALL_STATUS[a.recallSt].cls }
  : a.followUp ? { label: t(C().RESULTS[a.followUp.result]), cls: "b-out" } : a.service === "overdue" ? { label: t("逾期"), cls: "b-out" } : a.service === "due" ? { label: t("保养"), cls: "b-soon" } : { label: t("保修"), cls: "b-soon" });
export const alertAct = (a) => (a.recallSt ? { href: `${href("asset", a.id)}?sec=recall`, label: t("处理召回") } : { href: `${href("asset", a.id)}?log=1`, label: a.followUp ? t("记处理结果") : t("记保养") });
export function alertText(a) {
  if (a.recallSt) return recallAlertText(a);
  if (a.followUp) return t("{date} 检查结论：{r}，还没记处理", { date: fmtDate(a.followUp.done_on), r: t(C().RESULTS[a.followUp.result]) });
  if (isVehicle(a) && a.vSoonest && (a.service === "overdue" || a.service === "due")) {
    const s = a.vSoonest, item = t(s.name);
    return a.dueDays < 0 ? t("{item}逾期 {d} 天", { item, d: -a.dueDays }) : a.dueDays === 0 ? t("{item}今天到期", { item }) : t("{item}{d} 天后到期", { item, d: a.dueDays });
  }
  if (a.service === "overdue") return t("保养逾期 {d} 天（上次 {last}）", { d: -a.dueDays, last: a.lastService ? fmtDate(a.lastService) : t("按安装日期算") });
  if (a.service === "due") return a.dueDays === 0 ? t("今天该保养了") : t("{d} 天后该保养", { d: a.dueDays });
  if (a.warranty === "expiring") return a.wDays === 0 ? t("保修今天到期") : t("保修 {d} 天后到期", { d: a.wDays });
  return "";
}
