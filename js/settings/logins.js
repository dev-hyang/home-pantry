/* 登录记录（迁移 086）：设置 → 家庭与成员 里的「登录记录」面板 + 陌生设备 / IP 告警。
 *   · 登录后记一笔（同一设备 6 小时内不重复发请求）：时间、设备、浏览器、IP（IP 由服务端从请求头取，客户端不报）。
 *   · 服务端判断「新设备 / 新 IP」：这个人以前没出现过的设备 / 网络（第一次登录不算）。
 *   · 新设备 / 新 IP 且没被确认 → 进「待办 | 注意事项」，家主看全家，本人看自己；点「是我们家人」确认后消失。
 *   · 记录默认显示最近 6 天，「加载更多」再往前 6 天。家主看全家，普通成员只看自己。
 * 登录记录是安全日志：不进备份 / 恢复，也不进 AI 提示词。 */
import { state } from "../core/state.js";
import { CloudStore, Store } from "../core/store.js";
import { esc, fmtDateTime, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { DEVICE_ICON, deviceInfo } from "../core/device-info.js";
import { amOwner, famMembers, familyHref, meId } from "./members.js";

const cloud = () => Store.mode === "cloud";
const DAYS = 6, REC_KEY = "hmh-login-rec", REC_EVERY = 6 * 3600e3;
const L = { days: DAYS, rows: [], busy: false, loaded: false, more: true, bad: [] };   // 记录列表窗口（最近 days 天）+ 待确认的可疑登录
const deviceText = (d) => ({ iPhone: t("iPhone"), iPad: t("iPad"), "Android phone": t("Android 手机"), "Android tablet": t("Android 平板"), Chromebook: "Chromebook", "Windows computer": t("Windows 电脑"), "Mac computer": t("Mac 电脑"), "Linux computer": t("Linux 电脑"), Computer: t("电脑") }[d] || d || "—");
const who = (e) => famMembers().find((m) => m.user_id === e.user_id)?.display_name || t("某位成员");

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
async function loadLogins() {
  if (!cloud() || L.busy) return; L.busy = true;
  try {
    const rows = await CloudStore.listLogins(new Date(Date.now() - L.days * 864e5).toISOString());
    L.more = rows.length > L.rows.length || !L.loaded; L.rows = rows; L.loaded = true;
  } catch (e) { console.warn("[logins]", e.message); L.rows = []; L.loaded = true; L.more = false; }
  L.busy = false; window.dispatchEvent(new HashChangeEvent("hashchange"));
}
export async function loginsMore() { L.days += DAYS; L.loaded = false; L.busy = false; await loadLogins(); }
export async function ackLoginDo(id) {
  try { await CloudStore.ackLogin(id); toast(t("已确认")); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); }
  await loadLoginAlerts(); L.loaded = false; L.busy = false;
}

/** 提醒总线：每条可疑登录一条提醒；新设备更紧急 */
export function loginAlertItems() {
  if (!cloud()) return [];
  const link = familyHref();
  return L.bad.filter((e) => amOwner() || e.user_id === meId()).map((e) => {
    const isNewDev = e.new_device, name = e.user_id === meId() ? t("你") : who(e);
    return { source: "security", severity: isNewDev ? 1 : 2, must: isNewDev, due: String(e.at).slice(0, 10),
      title: `🔐 ${isNewDev ? t("{n} 用一台没见过的设备登录", { n: name }) : t("{n} 从一个新的网络登录", { n: name })}`,
      detail: `${fmtDateTime(e.at)} · ${deviceText(e.device)} · ${e.browser || ""}${e.ip ? ` · IP ${e.ip}` : ""}。${t("如果不是你们家人，可能账号被盗了：家主请马上重新生成邀请码、把这台设备移出家庭，并检查登录用的邮箱 / 手机。")}`,
      href: link, actions: [{ type: "button", action: "login-ack", id: e.id, label: t("是我们家人"), cls: "btn-primary" }, { type: "link", href: link, label: t("去处理") }] };
  });
}

/** 登录记录面板（家庭页）；家主全家，本人只有自己 */
export function loginsPanel() {
  if (!cloud()) return "";
  if (!L.loaded && !L.busy) loadLogins();
  const rows = L.rows.filter((e) => amOwner() || e.user_id === meId());
  const bad = (e) => (e.new_device || e.new_ip) && !e.acked_at;
  const row = (e) => `<li class="login-row ${bad(e) ? "is-bad" : ""}">
      <span class="login-ico" aria-hidden="true">${DEVICE_ICON[e.device] || "💻"}</span>
      <div class="grow"><b>${esc(deviceText(e.device))}</b> <small class="muted">${esc([e.os, e.browser].filter(Boolean).join(" · "))}</small>
        <small class="login-meta">${esc(fmtDateTime(e.at))}${e.ip ? ` · IP ${esc(e.ip)}` : ""}${amOwner() ? ` · ${esc(who(e))}` : ""}</small></div>
      <div class="login-tags">${e.new_device ? `<span class="badge b-out">${t("新设备")}</span>` : ""}${e.new_ip ? `<span class="badge b-soon">${t("新网络")}</span>` : ""}${bad(e) ? `<button type="button" class="btn btn-sm" data-action="login-ack" data-id="${esc(e.id)}">${t("是我们家人")}</button>` : ""}</div></li>`;
  return `<div class="panel"><h3 class="mem-h">${t("登录记录")}</h3>
    <p class="muted mem-note" style="margin-top:0">${amOwner() ? t("最近 {d} 天全家的登录；出现没见过的设备或网络会在“注意事项”里提醒。", { d: L.days }) : t("最近 {d} 天你自己的登录。", { d: L.days })}</p>
    ${!L.loaded ? `<p class="muted" role="status">${t("加载中…")}</p>` : rows.length ? `<ul class="restock-list login-list">${rows.map(row).join("")}</ul>` : `<div class="empty"><strong>${t("这段时间没有登录记录")}</strong></div>`}
    ${L.loaded && L.more ? `<div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="logins-more">${t("加载更多（再往前 {d} 天）", { d: DAYS })}</button></div>` : ""}
    ${amOwner() && L.bad.length ? `<details class="login-help" open><summary>${t("不是我们家人登录的？怎么办")}</summary><ol class="muted"><li>${t("在上面“登录设备”里把这台设备移出家庭（点进去 → 移出家庭）")}</li><li>${t("回到上面点“重新生成”换一个邀请码，旧邀请码立刻作废")}</li><li>${t("检查登录用的邮箱 / 手机号有没有被别人动过，必要时改密码或开启两步验证")}</li></ol></details>` : ""}</div>`;
}
