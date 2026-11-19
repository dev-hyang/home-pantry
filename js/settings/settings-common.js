/* 设置各部分共用的小件。从 views.js 抽出来，各部分依赖这里。 */
import { amOwner } from "./members.js";
import { esc, fmtShort } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 当前用户是否家主（household_members.role = owner） */
export const isOwner = () => amOwner();
/** 邀请码有效期的一句话（家主看得到到期时间；没执行迁移 049 时没有这个字段 = 不显示） */
export const inviteLine = () => {
  const exp = state.household?.invite_expires_at; if (!exp) return "";
  const ms = new Date(exp).getTime() - Date.now();
  return ms <= 0 ? `<b style="color:var(--out)">${t("邀请码已过期")}</b>` : t("有效期至 {d}（还有 {n} 天）", { d: fmtShort(exp), n: Math.max(1, Math.ceil(ms / 864e5)) });
};
/** 家主：等批准的加入申请 */
export function pendingList() {
  const p = state.pendingMembers || []; if (!isOwner() || !p.length) return "";
  const row = (m) => `<li><div class="grow"><b>${esc(m.display_name)}</b>${m.joined_at ? `<small class="muted">${t("{d} 申请", { d: fmtShort(m.joined_at) })}</small>` : ""}</div>
      <span class="head-acts"><button type="button" class="btn btn-sm btn-primary" data-action="member-approve" data-id="${m.user_id}">${t("批准")}</button><button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-reject" data-id="${m.user_id}">${t("拒绝")}</button></span></li>`;
  return `<div class="panel pend-panel"><h3 style="font-size:15px;margin:0 0 6px">${t("等你批准（{n}）", { n: p.length })}</h3>
    <p class="muted small" style="margin:0 0 8px">${t("认识这个人再批准：批准后对方能看到家里的数据（对账单、收入、预算除外，要另外开财务权限）。不认识就拒绝，并重新生成邀请码。")}</p>
    <ul class="member-list">${p.map(row).join("")}</ul></div>`;
}
/** 姐妹站点：和顶栏切换器同一份数据（data.js 的 SISTER_APPS） */
export function sisterAppsPanel() {
  const list = window.SISTER_APPS || []; if (list.length < 2) return "";
  return `<div class="panel">
    <div class="kv"><div><b>${t("姐妹站点")}</b><div class="muted">${t("同一作者的其他小工具；顶栏站名旁的「‹」「›」小胶囊也能切换")}</div></div></div>
    <ul class="app-list">${list.map((a) => `<li class="${a.id === "home-pantry" ? "current" : ""}">
      <span class="app-ico" aria-hidden="true">${a.icon}</span>
      <div class="grow"><b>${esc(t(a.name))}</b><small>${esc(t(a.sub))}</small></div>
      ${a.id === "home-pantry" ? `<span class="badge b-ok">${t("当前")}</span>` : `<a class="btn btn-sm" href="${esc(a.url)}">${t("打开")}</a>`}</li>`).join("")}</ul>
  </div>`;
}
