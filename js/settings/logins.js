/* 登录记录（迁移 086 / 087）：数据读取、陌生设备 / IP 告警、记录行的画法（画在家庭成员页的「登录记录」「登录设备」里）。
 *   · 登录后记一笔（同一设备 6 小时内不重复发请求）：时间、设备、浏览器、IP、地点（只有国家）——IP / 国家由服务端从请求头取，客户端不报。
 *   · 服务端判断「新设备 / 新 IP」：这个人以前没出现过的设备 / 网络（第一次登录不算）。
 *   · 新设备 / 新 IP 且没被确认 → 标「可疑」，并进「待办 | 注意事项」；家主看全家，本人看自己；点「是我们家人」确认后消失。
 *   · 记录读最近 60 天，默认显示最近 6 天，「加载更多」再往前 6 天。家主看全家，普通成员只看自己（数据库 RLS 同样限制）。
 * 登录记录是安全日志：不进备份 / 恢复，也不进 AI 提示词。 */
import { state } from "../core/state.js";
import { CloudStore, Store } from "../core/store.js";
import { esc, fmtDateTime, toast } from "../core/util.js";
import { moreMenu } from "../core/more-menu.js";
import { t } from "../core/i18n.js";
import { DEVICE_ICON, deviceInfo } from "../core/device-info.js";
import { amOwner, famMembers, familyHref, meId } from "./members.js";

const cloud = () => Store.mode === "cloud";
export const LOGIN_STEP = 6, FETCH_DAYS = 60;
const REC_KEY = "hmh-login-rec", REC_EVERY = 6 * 3600e3;
export const L = { days: LOGIN_STEP, rows: [], busy: false, loaded: false, bad: [] };   // rows = 最近 60 天；days = 当前显示的天数窗口；bad = 待确认的可疑登录
export const deviceText = (d) => ({ iPhone: t("iPhone"), iPad: t("iPad"), "Android phone": t("Android 手机"), "Android tablet": t("Android 平板"), Chromebook: "Chromebook", "Windows computer": t("Windows 电脑"), "Mac computer": t("Mac 电脑"), "Linux computer": t("Linux 电脑"), Computer: t("电脑") }[d] || d || "—");
export const deviceName = (userId) => famMembers().find((m) => m.user_id === userId)?.display_name || t("已移出的设备");
export const personOfDevice = (userId) => famMembers().find((m) => m.user_id === userId)?.person_id || null;
export const isSuspicious = (e) => (e.new_device || e.new_ip) && !e.acked_at;

/** 登录后调用：记一笔（同一设备 6 小时内只记一次）；失败不影响使用 */
export async function recordLoginOnce() {
  if (!cloud() || !CloudStore.hid || !state.user) return;
  const info = deviceInfo(navigator.userAgent, { touchPoints: navigator.maxTouchPoints || 0 }), key = `${CloudStore.hid}|${state.user.id}|${info.device}|${info.browser}`;
  try { const last = JSON.parse(localStorage.getItem(REC_KEY) || "null"); if (last && last.k === key && Date.now() - last.t < REC_EVERY) return; } catch { /* 忽略 */ }
  try {
    await CloudStore.recordLogin({ device: info.device, os: info.os, browser: info.browser, ua: navigator.userAgent.slice(0, 300) });
    try { localStorage.setItem(REC_KEY, JSON.stringify({ k: key, t: Date.now() })); } catch { /* 忽略 */ }
    L.loaded = false;
  } catch (e) { console.warn("[login record]", e.message); }
}
/** 待确认的可疑登录（新设备 / 新 IP、没确认、近 30 天）：告警用 */
export async function loadLoginAlerts() { if (!cloud()) return; try { L.bad = await CloudStore.listSuspiciousLogins(); } catch (e) { console.warn("[login alerts]", e.message); L.bad = []; } }
/** 读最近 60 天的登录记录（只读一次；记了新登录或确认后会重读）；读完重画当前页 */
export async function loadLogins() {
  if (!cloud() || L.busy) return; L.busy = true;
  try { L.rows = await CloudStore.listLogins(new Date(Date.now() - FETCH_DAYS * 864e5).toISOString()); }
  catch (e) { console.warn("[logins]", e.message); L.rows = []; }
  L.loaded = true; L.busy = false; window.dispatchEvent(new HashChangeEvent("hashchange"));
}
export const ensureLogins = () => { if (cloud() && !L.loaded && !L.busy) loadLogins(); };
export const loginsMore = () => { const y = window.scrollY; L.days = Math.min(FETCH_DAYS, L.days + LOGIN_STEP); window.dispatchEvent(new HashChangeEvent("hashchange")); requestAnimationFrame(() => window.scrollTo(0, y)); setTimeout(() => window.scrollTo(0, y), 60); };   // 留在原来的位置，不回到页面顶端
export async function ackLoginDo(id) {
  try { await CloudStore.ackLogin(id); toast(t("已确认")); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); }
  await loadLoginAlerts(); L.loaded = false; L.busy = false; ensureLogins();
}

/** 某些设备（userId 列表）最近一次登录；没有记录返回 null */
export const lastLoginOf = (userIds) => { const set = new Set(userIds); return L.rows.find((e) => set.has(e.user_id)) || null; };   // rows 按时间倒序
/** 当前窗口（最近 days 天）内、属于这些设备的记录（userIds 为 null = 当前人能看到的全部） */
export function loginWindow(userIds = null) {
  const since = Date.now() - L.days * 864e5, set = userIds ? new Set(userIds) : null;
  return L.rows.filter((e) => (amOwner() || e.user_id === meId() || set?.has(e.user_id)) && (!set || set.has(e.user_id)) && new Date(e.at).getTime() >= since);
}
export const loginHasMore = (userIds = null) => { const set = userIds ? new Set(userIds) : null; return L.days < FETCH_DAYS && L.rows.some((e) => (amOwner() || e.user_id === meId() || set?.has(e.user_id)) && (!set || set.has(e.user_id)) && new Date(e.at).getTime() < Date.now() - L.days * 864e5); };

/** 一行登录记录：设备图标、设备 + 浏览器、时间 · 地点 · IP、哪台设备 / 哪位家庭成员；可疑的标红「可疑」 */
export function loginRowHtml(e, personNameOf, canRemove = () => false) {
  const bad = isSuspicious(e), dev = deviceName(e.user_id), who = personNameOf(personOfDevice(e.user_id));
  return `<li class="login-row ${bad ? "is-bad" : ""}">
      <span class="login-ico" aria-hidden="true">${DEVICE_ICON[e.device] || "💻"}</span>
      <div class="grow"><b>${esc(deviceText(e.device))}</b> <small class="muted">${esc([e.os, e.browser].filter(Boolean).join(" · "))}</small>
        <small class="login-meta">${esc(fmtDateTime(e.at))}${e.location ? ` · 🌐 ${esc(e.location)}` : ""}${e.ip ? ` · IP ${esc(e.ip)}` : ""}</small>
        <small class="login-meta">${t("登录设备")}：${esc(dev)}${who ? ` · ${t("家庭成员")}：${esc(who)}` : ""}</small>
        ${bad ? `<small class="login-flag" role="status"><i class="login-dot" aria-hidden="true"></i>${t("可疑")}${e.new_device ? ` · ${t("新设备")}` : ` · ${t("新网络")}`}</small>` : ""}</div>
      <div class="login-tags">${bad ? moreMenu([{ label: t("确认是家人"), action: "login-ack", data: { id: e.id }, first: true }, canRemove(e.user_id) ? { label: t("移出设备"), action: "member-remove", data: { id: e.user_id }, danger: true } : null], { label: t("更多操作") })
        : (e.new_device || e.new_ip) ? `<span class="muted login-ok">✓ ${t("已确认")}</span>` : ""}</div></li>`;
}

/** 提醒总线：每条可疑登录一条提醒；新设备更紧急 */
export function loginAlertItems() {
  if (!cloud()) return [];
  const link = familyHref();
  return L.bad.filter((e) => amOwner() || e.user_id === meId()).map((e) => {
    const isNewDev = e.new_device, name = e.user_id === meId() ? t("你") : deviceName(e.user_id);
    return { source: "security", severity: isNewDev ? 1 : 2, must: isNewDev, due: String(e.at).slice(0, 10),
      title: `🔐 ${isNewDev ? t("{n} 用一台没见过的设备登录", { n: name }) : t("{n} 从一个新的网络登录", { n: name })}`,
      detail: `${fmtDateTime(e.at)} · ${deviceText(e.device)} · ${e.browser || ""}${e.location ? ` · ${e.location}` : ""}${e.ip ? ` · IP ${e.ip}` : ""}。${t("如果不是你们家人，可能账号被盗了：家主请马上重新生成邀请码、把这台设备移出家庭，并检查登录用的邮箱 / 手机。")}`,
      href: link, actions: [{ type: "button", action: "login-ack", id: e.id, label: t("是我们家人"), cls: "btn-primary" }, { type: "link", href: link, label: t("去处理") }] };
  });
}
