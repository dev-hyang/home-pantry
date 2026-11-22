/* 账单各页面共用的小件。从 views.js 抽出来，各页面依赖这里。 */
import { NEW_RECURRING } from "./kinds.js";
import { billCat } from "./logic.js";
import { billInUse, endedSuffix, propertyActive, propertyById } from "../core/lifecycle.js";
import { billScopeParts } from "./trail.js";
import { crumbNav } from "../core/hub.js";
import { finBase } from "../core/crumb-base.js";
import { detailHref } from "./medical.js";
import { esc, num } from "../core/util.js";
import { fullFormUrl } from "./wizard-views.js";
import { href } from "../core/router.js";
import { scanNewBillBar } from "../core/autofill.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { withProperty } from "../core/alerts.js";

export const B = () => window.BILLS;
export const BADGE = { overdue: "b-out", due: "b-low", verify: "b-soon", soon: "b-soon", ok: "b-ok", escrow: "b-ok", none: "", ended: "", inactive: "" };
export const STATUS_LABEL = { overdue: "逾期", due: "今天到期", verify: "待核对", soon: "即将到期", ok: "正常", escrow: "Escrow 代缴", none: "未填到期日", ended: "已结束", inactive: "已停用" };
export const mny = (v, cur) => (v == null ? "—" : Units.money(num(v), cur || Units.region.currency));
/** 房产切换条（房屋、账单页共用）；只有一套房产时不显示 */
export function propertyBar({ all = false } = {}) {
  const list = state.properties.filter((p) => propertyActive(p) || p.id === state.propertyId);   // 在用的 + 当前正看的（已卖出的从这里退出，要看历史去房屋列表）
  if (list.length < 2) return "";
  const cur = all ? state.billsFilter.property : state.propertyId;
  const chip = (id, label) => `<button type="button" class="chip" data-action="${all ? "bills-prop" : "property"}" data-id="${id}" aria-pressed="${cur === id}">${label}</button>`;
  return `<div class="chips prop-bar" role="group" aria-label="${t("选择房产")}">${all ? chip("all", t("全部房产")) : ""}${list.map((p) => chip(p.id, `🏠 ${esc(p.name)}`)).join("")}</div>`;
}
/** 添加账单页：两块。自动创建（AI 扫描 → 模板）在前；手工创建（周期性分步 → 一次性分步 → 一次填完整页）在后。每个入口一张整行卡片 */
export function billTypeChooser() {
  const row = (href_, icon, title, desc, eg = "") => `<div class="kind-card"><a class="kind-main" href="${href_}"><span class="kind-ico" aria-hidden="true">${icon}</span><span class="grow"><b>${title}</b><small>${desc}</small>${eg ? `<small>${eg}</small>` : ""}</span><span class="mch" aria-hidden="true">›</span></a></div>`;
  const ai = `<div class="kind-card kind-ai"><div class="kind-main kind-static"><span class="kind-ico" aria-hidden="true">✨</span><span class="grow"><b>${t("AI 扫描")}</b><small>${t("拍一封信、一张账单或邮件截图，AI 判断是周期性还是一次性，自动填好表单；核对后再保存。")}</small></span></div>${scanNewBillBar()}</div>`;
  return `<section class="section form-page">${crumbNav([...billRoot(), { label: t("添加账单") }])}
    <div class="section-head"><h2>${t("添加账单")}</h2></div>
    <div class="section-head kind-sec"><h2>${t("自动创建")}</h2></div>
    <div class="panel kind-cards one">
      ${ai}
      ${row(href("bills", "template"), "📋", t("常用账单模板"), t("按模板一次建好水电气、房贷、保险等常见账单。"))}
    </div>
    <div class="section-head kind-sec"><h2>${t("手工创建")}</h2></div>
    <div class="panel kind-cards one">
      ${row(NEW_RECURRING(), "🔁", t("周期性账单（分步）"), t("按周期反复出现：系统算下次到期、提前提醒，记缴费后自动推到下一期。"), t("水电气网、房贷房租、保险、订阅、信用卡"))}
      ${row(detailHref("new"), "🧾", t("一次性账单（分步）"), t("一次事件产生：有总额、可以分次付、有余额，付清就结束。"), t("医疗、宠物、法律税务、装修工程、旅行"))}
      ${row(fullFormUrl(), "📝", t("一次填完（整页）"), t("不分步，一页填完周期性账单的所有项目。"))}
    </div></section>`;
}
/** 账单页面包屑：账单 / 房产 / 账单名 / 当前块 —— 有房产的账单带上房产（点它回到这套房产的账单清单），免得多套房产时分不清是哪套的 */
export const billRoot = () => finBase("overview");   // 财务 / 账单（分组）
   // 添加账单页等「还没有具体账单」的面包屑第一级
/** 账单详情页路径：财务 / 账单概览 / 资产 / 账单名（后面接分区时再追加一级） */
export const billTrail = (b, _root, hubHref) => [...billScopeParts(b, "recurring"), { href: hubHref, label: b.name, icon: billCat(b.category).icon }];
export const billCrumb = (b, root, hubHref, cur) => crumbNav([...billTrail(b, root, hubHref), { label: cur }]);
/** 多套房产时账单名带房产前缀（“房 1 · 电费”），单套房产不变 */
export const billLabel = (b) => (b ? withProperty(b.property_id, b.name) : "");
/** 下拉里用：已卖出 / 已退租房产的账单带上状态，在用的排前面 */
export const billOption = (b) => `${billLabel(b)}${endedSuffix(propertyById(b.property_id))}`;
export const byInUse = (x, y) => (billInUse(y) ? 1 : 0) - (billInUse(x) ? 1 : 0);
