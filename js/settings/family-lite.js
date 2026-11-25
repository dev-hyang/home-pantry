/* 家庭成员的同步小件：我是谁、成员名字、成年人名单、设备链接提示（别处拼页面时要立刻用到）。 */
import { amOwner, famMembers, familyHref, meId } from "./members.js";
import { esc } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { F, demo } from "./family-common.js";

export const personHref = (id) => `${familyHref()}&person=${encodeURIComponent(id)}`;
   // renameDev = 正在改名的设备；linkDev = 正在选「属于哪位家庭成员」的设备（底部弹出）   // 当前正在编辑的块、设备显示几行、哪台设备展开了详情、登录记录是否看全家

/* ── 数据小工具 ── */
export const myMember = () => famMembers().find((m) => m.user_id === meId()) || null;
export const myPersonOf = () => myMember()?.person_id || null;
export const devicesOf = (personId) => famMembers().filter((m) => m.person_id === personId);
export const personNameOf = (id) => state.people.find((p) => p.id === id)?.name || "";
/** 我在全应用里「署名」用的名字：家庭成员的名字；这台设备还没链接家庭成员才用设备的称呼。所有写进记录里的「谁做的」文字（完成人、认领人、进展记录人…）都用它 */
export const myName = () => personNameOf(myPersonOf()) || state.displayName;
export const adultPeople = () => state.people.filter((p) => (p.kind || "adult") === "adult");
export const visiblePeople = () => (amOwner() ? state.people : state.people.filter((p) => p.id === myPersonOf()));
/* ── 这台设备是谁？（可折叠；已经链接就不显示） ── */
export function deviceLinkPrompt() {
  if (demo()) return "";
  const m = myMember(); if (!m || m.person_id) return "";
  const opts = adultPeople().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${devicesOf(p.id).length ? ` · ${t("{n} 台设备", { n: devicesOf(p.id).length })}` : ""}</option>`).join("");
  return `<details class="panel device-link" open><summary><b>📱 ${t("这台设备是谁？")}</b></summary>
    <p class="muted">${t("选你自己，账单的“谁负责”、收入和医疗账单才会记在同一个人名下；换了新设备再登录，选同一个人就行，不会多出一个人。")}</p>
    ${opts ? `<div class="dl-row"><select id="devLinkPick" aria-label="${esc(t("选择家庭成员"))}"><option value="">${t("选择家庭成员…")}</option>${opts}</select><button type="button" class="ui-btn" data-tone="primary" data-action="device-link">${t("就是我")}</button></div>` : ""}
    <div class="dl-row"><input id="devLinkNew" maxlength="40" placeholder="${esc(t("我是新成员，名字："))}" value="${esc(opts ? "" : m.display_name || "")}" aria-label="${esc(t("新成员的名字"))}"><button type="button" class="ui-btn" data-tone="${opts ? "ghost" : "primary"}" data-action="device-link-new">${t("新建并链接")}</button></div></details>`;
}
export const resetFamilyUi = () => { F.edit = null; F.devShow = 6; F.devOpen = null; F.scopeAll = false; };
