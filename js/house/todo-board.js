/* 房屋页签首页（#/house，房产目录）· 各房产要处理的事（2026-11）：设备保养、季节任务、交易清单、房屋耗材 / HOA / 保险的提醒，按房产分组一处看全。
 * 为什么要有：这些提醒分属几套房产（和车辆），而设备、季节任务、交易页面一次只看「当前房产」——首页待办只给一个数字时，
 * 点进某一套房产的页面数字对不上（例如首页 3 台、当前房产的设备页 2 台，另一台是车）。这里不分当前房产，全部列出，每条链接带 ?prop= 先切到那套房产。
 * 网址：#/house?todo=asset|season|deal|house 只看某一类（首页待办点进来带着）；不带 = 全部。
 * 数据：提醒总线（collectAlerts），全在内存里，和首页、#/alerts 同一份。 */
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { SEVERITY_CLS, SEVERITY_LABEL, alertRow, collectAlerts, propertyName } from "../core/alerts.js";
import { activeProperties } from "../core/lifecycle.js";
import { tabBar } from "../core/hub.js";

const KINDS = [["asset", "⚙️", "设备与车辆"], ["season", "📅", "季节任务"], ["deal", "📝", "交易"], ["house", "🧰", "耗材 · HOA · 保险"]];
const GROUP_MAX = 6;

/** 房屋这边的提醒（四个来源），不分当前房产 */
export const houseAlerts = () => collectAlerts().filter((x) => KINDS.some(([k]) => k === x.source));

export function houseTodoBoard() {
  if (!state.houseEnabled) return "";
  const all = houseAlerts();
  const want = state.route?.q?.get("todo"), sel = KINDS.some(([k]) => k === want) ? want : null;
  if (!all.length) return `<section class="section house-todo" id="house-todo"><div class="panel empty tempty"><strong>${t("各房产都没有要处理的事 ✓")}</strong>${t("设备保养、季节任务、交易清单、耗材和 HOA / 保险有动静时会出现在这里。")}</div></section>`;
  const list = sel ? all.filter((x) => x.source === sel) : all;
  const n = (k) => all.filter((x) => x.source === k).length;
  // 切换类别：和其他页面同一套（宽屏标签条、手机整宽下拉框，core/hub.js 的 tabBar），名字后面带件数
  const tabs = [["all", `${t("全部")} · ${all.length}`, "🗂️"], ...KINDS.filter(([k]) => n(k)).map(([k, ic, nm]) => [k, `${t(nm)} · ${n(k)}`, ic])];
  const chips = tabs.length > 2 ? `<div class="house-todo-tabs">${tabBar(tabs, sel || "all", (k) => (k === "all" ? href("house") : `${href("house")}?todo=${k}`), t("按类别看"))}</div>` : "";
  // 分组：在用的房产（当前房产在前）→ 车辆 → 不分房产的（家里的耗材补货）
  const props = activeProperties().slice().sort((a, b) => (b.id === state.propertyId) - (a.id === state.propertyId));
  const groups = props.map((p) => ({ key: p.id, title: `🏠 ${propertyName(p.id) || p.name}`, cur: p.id === state.propertyId, items: list.filter((x) => x.property_id === p.id) }));
  const known = new Set(props.map((p) => p.id));
  groups.push({ key: "veh", title: `🚗 ${t("车辆")}`, items: list.filter((x) => x.source === "asset" && !x.property_id) });
  groups.push({ key: "other", title: `🧰 ${t("不分房产")}`, items: list.filter((x) => !(x.source === "asset" && !x.property_id) && (!x.property_id || !known.has(x.property_id))) });
  const shown = groups.filter((g) => g.items.length);
  const group = (g) => {
    const worst = Math.min(...g.items.map((x) => x.severity));
    return `<details class="panel ref-panel house-todo-grp" open><summary><b>${esc(g.title)}</b>${g.cur && shown.length > 1 ? ` <span class="badge" style="background:var(--surface-2)">${t("当前")}</span>` : ""}
        <small>${t("{n} 件", { n: g.items.length })}${worst <= 2 ? `<span class="badge ${SEVERITY_CLS[worst]}">${esc(t(SEVERITY_LABEL[worst]))}</span>` : ""}</small><span class="mch" aria-hidden="true">›</span></summary>
      <ul class="restock-list alert-list">${g.items.slice(0, GROUP_MAX).map(alertRow).join("")}</ul>
      ${g.items.length > GROUP_MAX ? `<p class="house-todo-more"><a class="btn btn-sm btn-ghost" href="${href("alerts")}">${t("看全部 {n} 条", { n: g.items.length })}</a></p>` : ""}</details>`;
  };
  const hot = all.filter((x) => x.severity <= 2).length;
  return `<section class="section house-todo${hot ? " is-hot" : ""}" id="house-todo" aria-labelledby="h-house-todo">
    <div class="section-head house-todo-head"><h2 id="h-house-todo">${t("各房产要处理的事")}<span class="badge attn-count ${hot ? "b-out" : ""}">${all.length}</span></h2><p>${t("所有在用的房产和车辆，不用来回切换")}</p></div>
    ${chips}
    ${shown.length ? shown.map(group).join("") : `<div class="panel empty"><strong>${t("这一类没有要处理的事")}</strong></div>`}
  </section>`;
}
