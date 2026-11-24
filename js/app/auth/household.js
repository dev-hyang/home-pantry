/* 家庭：建家 / 加入、登录后读家庭、等批准、改称呼。 */
import { CloudStore, Store } from "../../core/store.js";
import { esc, setSync, toast } from "../../core/util.js";
import { famMembers } from "../../settings/members.js";
import { gate, paintHeaderSync } from "./login.js";
import { href } from "../../core/router.js";
import { loginAlertItems } from "../../settings/logins.js";
import { promptDuplicateName, sameNameMember, suggestNames } from "../../core/name-check.js";
import { refresh, refreshSoon } from "../data.js";
import { registerAlerts } from "../../core/alerts.js";
import { render } from "../render.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

export function renderOnboarding() {
  const anon = !!state.user?.is_anonymous;   // 邀请码直接进入的匿名账号：只能加入，不能创建家庭
  gate(`<div class="panel gate-card"><h2>${t("加入你的家庭")}</h2>
    <p class="muted">${anon ? t("用家人给的邀请码加入。") : t("第一次使用请创建家庭；家人已经创建过的话，用邀请码加入。")}</p>
    <form id="joinHhForm"><input name="code" required maxlength="12" placeholder="${t("邀请码")}" autocapitalize="characters" aria-label="${t("邀请码")}">
      <input name="display_name" required maxlength="20" placeholder="${t("我的称呼，例如：爸爸")}" aria-label="${t("我的称呼")}" value="${esc(state.user?.user_metadata?.display_name || "")}">
      <input name="note" maxlength="60" placeholder="${t("给家主留一句话（可不填），例如：我是小明的妈妈")}" aria-label="${t("给家主的话")}">
      <label class="check-inline"><input type="checkbox" name="want_finance"><span>${t("我需要财务权限（对账单 / 收入 / 预算 / 用卡）")}</span></label>
      <button class="btn btn-dark" type="submit">${t("用邀请码加入")}</button></form>
    <hr>
    ${anon ? `<p class="muted">${t("创建新家庭需要用邮箱登录，这样家庭有一个能找回的主人。")}<button type="button" class="btn btn-sm btn-ghost" data-action="logout">${t("改用邮箱登录")}</button></p>`
      : `<form id="createHhForm"><input name="name" required maxlength="50" placeholder="${t("家庭名称，例如：小月亮的家")}" aria-label="${t("家庭名称")}">
      <input name="display_name" required maxlength="20" placeholder="${t("我的称呼，例如：妈妈")}" aria-label="${t("我的称呼")}">
      <button class="btn btn-primary" type="submit">${t("创建家庭")}</button></form>`}</div>`);
  setSync(t("已登录"));
}
export async function doCreateHousehold(f) {
  if (state.user?.is_anonymous) return toast(t("创建家庭请先用邮箱登录"));
  const { data, error } = await CloudStore.sb.rpc("create_household", { p_name: f.elements.name.value.trim(), p_display_name: f.elements.display_name.value.trim() });
  if (error) return toast(t("创建失败：{msg}", { msg: error.message }));
  localStorage.setItem("hmh-hid", data); afterLogin();
}
/** join_household 的结果：旧库（没执行迁移 049）返回家庭 id 字符串 = 直接加入；新库返回 { status, household_id }：invalid / expired / throttled / full / pending / active */
export function joinOutcome(data) {
  if (typeof data === "string") return { status: "active", hid: data };
  return { status: data?.status || "invalid", hid: data?.household_id || null };
}
export const JOIN_MSG = { invalid: "邀请码不正确，请向家主确认", expired: "邀请码已过期，请向家主要一个新的", throttled: "试得太多次了，请 15 分钟后再试", full: "等家主批准的申请太多了，请联系家主先处理" };
export async function doJoinHousehold(f) {
  const { data, error } = await CloudStore.sb.rpc("join_household", { p_code: f.elements.code.value.trim(), p_display_name: f.elements.display_name.value.trim(), p_note: f.elements.note?.value.trim() || null, p_want_finance: !!f.elements.want_finance?.checked });
  if (error) return toast(error.message.includes("invalid") ? t("邀请码不正确，请向家主确认") : t("加入失败：{msg}", { msg: error.message }));
  const o = joinOutcome(data);
  if (JOIN_MSG[o.status]) return toast(t(JOIN_MSG[o.status]));
  if (o.hid) localStorage.setItem("hmh-hid", o.hid);
  afterLogin();   // pending → 「等家主批准」页；active → 直接进入
}
export async function afterLogin() {
  const sb = CloudStore.sb;
  let { data, error } = await sb.from("household_members")
    .select("household_id, display_name, status, households(id, name, invite_code, invite_expires_at, created_by)").eq("user_id", state.user.id);
  if (error && /status|invite_expires_at/i.test(error.message)) ({ data, error } = await sb.from("household_members").select("household_id, display_name, households(id, name, invite_code, created_by)").eq("user_id", state.user.id));   // 迁移 049 还没执行
  if (error) return toast(t("读取家庭失败：{msg}", { msg: error.message }));
  const pend = data.filter((d) => d.status === "pending");
  data = data.filter((d) => (d.status || "active") === "active" && d.households);
  if (!data.length) return pend.length ? renderPending(pend[0]) : renderOnboarding();
  clearInterval(waitTimer);
  state.households = data.map((d) => d.households).filter(Boolean);
  const saved = localStorage.getItem("hmh-hid");
  const mine = data.find((d) => d.household_id === saved) || data[0];
  state.household = mine.households;
  state.displayName = mine.display_name;
  CloudStore.hid = mine.household_id;
  localStorage.setItem("hmh-hid", CloudStore.hid);
  const membersP = CloudStore.listMembers().then((m) => { state.members = m; paintHeaderSync(); return m; });   // 和 refresh 的数据读取并行
  state.membersReady = membersP;
  CloudStore.subscribe(refreshSoon);
  await refresh();
  // 同一个人开了多个浏览器 / 设备会变成多位“爸爸”：发现和别人同名，推荐加序列号或日期
  membersP.then(() => promptDuplicateName({ save: saveMyName }))   // refresh 读完会把 state.membersReady 清空，所以用局部变量.then((v) => { if (v) render(false); }).catch(() => {});
}
/** 申请已提交、等家主批准：每 20 秒自动再查一次，批准了就直接进去 */
export let waitTimer = null;
function renderPending(row) {
  gate(`<div class="panel gate-card"><h2>${t("申请已发出，等家主批准")}</h2>
    <p class="muted">${t("你用邀请码申请加入了这个家庭。家主在「设置 → 家庭」里点「批准」之后，你就能进来；在那之前这里看不到任何家里的数据。")}</p>
    <p class="muted small">${t("这个页面会自动检查，也可以手动再查一次。")}</p>
    <div class="form-actions"><button type="button" class="btn btn-primary" data-action="join-recheck">${t("再查一次")}</button>
      <button type="button" class="btn btn-ghost" data-action="join-cancel" data-hid="${esc(row.household_id)}">${t("取消申请")}</button>
      <button type="button" class="btn btn-ghost" data-action="logout">${t("退出登录")}</button></div></div>`);
  setSync(t("等待家主批准"));
  clearInterval(waitTimer); waitTimer = setInterval(() => { if (!document.body.classList.contains("gate")) return clearInterval(waitTimer); afterLogin(); }, 20000);
}
/** 家主：有没有等批准的加入申请（读完人数变了就重画）；顺带给提醒总线用 */
export async function loadPending() {
  const owner = state.members?.some((m) => m.user_id === state.user?.id && m.role === "owner");
  if (Store.mode === "demo" || !owner) { if (state.pendingMembers?.length) state.pendingMembers = []; return; }
  const p = await CloudStore.listPendingMembers().catch(() => []);
  const changed = p.length !== (state.pendingMembers || []).length; state.pendingMembers = p;
  if (changed) render(false);
}
registerAlerts(loginAlertItems);
   // 陌生设备 / 新网络登录（迁移 086）
registerAlerts(() => {   // 家主：待处理的财务权限申请
  const n = state.members?.some((m) => m.user_id === state.user?.id && m.role === "owner") ? state.members.filter((m) => m.finance_requested_at && m.role !== "owner" && m.can_finance !== true) : [];
  if (!n.length) return [];
  const link = `${href("me", "settings")}?sec=family`;
  return [{ source: "join", severity: 1, must: true, title: t("{n} 人申请财务权限", { n: n.length }), detail: n.map((m) => m.display_name).join("、"), href: link, actions: [{ type: "link", href: link, label: t("去处理"), cls: "btn-primary" }] }];
});
registerAlerts(() => {
  const p = state.pendingMembers || []; if (!p.length) return [];
  const link = `${href("me", "settings")}?sec=family`;
  return [{ source: "join", severity: 1, must: true, title: t("{n} 人申请加入家庭", { n: p.length }), detail: p.map((m) => m.display_name).join("、"), href: link, actions: [{ type: "link", href: link, label: t("去批准"), cls: "btn-primary" }] }];
});
/** 保存我自己的称呼（家庭成员表），并刷新成员列表 */
async function saveMyName(v) {
  const { error } = await CloudStore.sb.from("household_members").update({ display_name: v }).eq("household_id", CloudStore.hid).eq("user_id", state.user.id);
  if (error) throw new Error(error.message);
  state.displayName = v; state.members = await CloudStore.listMembers();
}
/** 改称呼前检查：和别的成员同名就拦住，并给出推荐（exceptId = 正在被改名的那位） */
export function dupNameCheck(v, exceptId) {
  const list = famMembers();
  if (!sameNameMember(v, list, exceptId)) return;
  throw new Error(t("已有成员叫“{n}”，建议改成：{s}", { n: v, s: suggestNames(v, list, exceptId).join(" / ") }));
}
