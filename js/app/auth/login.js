/* 云端登录：登录页、邮箱 / 手机 / 邀请码登录。 */
import { $, esc, setSync, syncState, toast } from "../../core/util.js";
import { CloudStore, Store } from "../../core/store.js";
import { applyChrome } from "../chrome.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

/* ───────────── 云端：登录与家庭 ───────────── */

/* 顶栏同步状态（和小月亮 / 家庭学堂 / 牧羊人一致）：同步好了显示“家庭同步 · N 人”，其余显示当时的状态文字；
   鼠标放上去是完整的状态（含同步时间）。成员数是登录后并行读的，读到了再刷新一次。 */
export function paintHeaderSync() {
  const h = $("#hdrSync"); if (!h) return;
  const s = syncState, ready = s.ok && !s.err && Store.mode !== "demo", n = state.members?.length || 0;
  const label = ready && n ? t("家庭同步 · {n} 人", { n }) : s.text;
  h.innerHTML = `<span class="dot${ready ? " ok" : ""}"></span>${esc(label)}`;
  h.title = s.text; h.classList.toggle("err", !!s.err);
}
syncState.onChange = paintHeaderSync;
// 购物车区块折叠 / 展开：记住这次的选择（toggle 事件不冒泡，所以用捕获）
export function gate(html) { document.body.classList.add("gate"); applyChrome(); $("#hhName").textContent = ""; $("#main").innerHTML = html; }
/* 登录：邮箱魔法链接（默认）；手机号短信验证码（config.js 里 PHONE_LOGIN = true 且 Supabase 已接短信服务商时显示） */
const COUNTRY_CODES = [["+1", "美国 / 加拿大 +1"], ["+86", "中国大陆 +86"], ["+852", "香港 +852"], ["+886", "台湾 +886"], ["+65", "新加坡 +65"], ["+61", "澳大利亚 +61"], ["+44", "英国 +44"], ["+81", "日本 +81"]];
const phoneLoginOn = () => !!window.APP_CONFIG?.PHONE_LOGIN;
const quickJoinOn = () => window.APP_CONFIG?.QUICK_JOIN !== false;
export function renderLogin(msg = "") {
  const modes = [["email", "邮箱"], phoneLoginOn() && ["phone", "手机号"], quickJoinOn() && ["quick", "邀请码直接进入"]].filter(Boolean);
  const mode = modes.some(([m]) => m === state.loginMode) ? state.loginMode : "email";
  const tabs = modes.length > 1 ? `<div class="seg" role="group" aria-label="${t("登录方式")}">${modes.map(([m, l]) =>
    `<button type="button" class="chip" data-action="login-mode" data-mode="${m}" aria-pressed="${mode === m}">${t(l)}</button>`).join("")}</div>` : "";
  let body;
  if (mode === "quick") {
    body = `<p class="muted">${t("家人已经建好家庭的话，填邀请码直接进入，不用收邮件或短信。手机号只用来标识是谁，不会发送验证码。")}</p>
      <form id="quickForm">
        <input type="tel" name="phone" required inputmode="tel" autocomplete="tel" placeholder="${t("手机号")}" aria-label="${t("手机号")}">
        <input name="display_name" maxlength="20" placeholder="${t("我的称呼（可不填），例如：爸爸")}" aria-label="${t("我的称呼")}">
        <input name="code" required maxlength="12" placeholder="${t("邀请码")}" autocapitalize="characters" aria-label="${t("邀请码")}">
        <button class="ui-btn" data-tone="primary" type="submit">${t("进入家庭")}</button></form>
      <p class="muted" style="font-size:12px">${t("这种方式的身份保存在本设备浏览器里，清除浏览器数据或换手机后需要重新用邀请码进入。创建家庭请用邮箱登录。")}</p>`;
  } else if (mode === "phone" && state.phonePending) {
    body = `<p class="muted">${t("验证码已发送到 {phone}，请输入短信里的 6 位数字。", { phone: esc(state.phonePending) })}</p>
      <form id="otpForm"><input name="token" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" maxlength="8" placeholder="${t("验证码")}" aria-label="${t("验证码")}">
        <button class="ui-btn" data-tone="primary" type="submit">${t("登录")}</button>
        <button class="ui-btn" data-tone="ghost" type="button" data-action="otp-back">${t("换个号码 / 重新发送")}</button></form>`;
  } else if (mode === "phone") {
    const def = Units.region.system === "us" ? "+1" : "+86";
    body = `<p class="muted">${t("输入手机号，我们会发一条短信验证码，无需密码。")}</p>
      <form id="phoneForm" class="phone-form">
        <select name="cc" aria-label="${t("国家或地区代码")}">${COUNTRY_CODES.map(([c, l]) => `<option value="${c}" ${c === def ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
        <input type="tel" name="phone" required inputmode="tel" autocomplete="tel-national" placeholder="${t("手机号")}" aria-label="${t("手机号")}">
        <button class="ui-btn" data-tone="primary" type="submit">${t("发送验证码")}</button></form>`;
  } else {
    body = `<p class="muted">${t("输入邮箱，我们会发一封登录链接，点开即可登录，无需密码。")}</p>
      <form id="loginForm"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com" aria-label="${t("邮箱")}">
        <button class="ui-btn" data-tone="primary" type="submit">${t("发送登录链接")}</button></form>`;
  }
  gate(`<div class="panel gate-card"><h2>${t("登录")}</h2>${tabs}${body}<p class="muted" role="status">${esc(msg)}</p></div>`);
  setSync(t("未登录"));
}
export async function doLogin(f) {
  const email = f.elements.email.value.trim();
  if (!email) return;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
  if (error) { f.querySelector("button").disabled = false; return toast(t("发送失败：{msg}", { msg: error.message })); }
  renderLogin(t("登录链接已发送到 {email}，请在本设备打开邮件。", { email }));
}
/** 手机号：拼成 E.164（+国家码+数字）后发短信验证码 */
export async function doPhoneLogin(f) {
  const digits = f.elements.phone.value.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return toast(t("请输入正确的手机号"));
  const phone = `${f.elements.cc.value}${digits}`;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.signInWithOtp({ phone });
  if (error) {
    f.querySelector("button").disabled = false;
    const m = /provider|not enabled|unsupported/i.test(error.message) ? t("Supabase 还没开启手机号登录或没有接入短信服务商，请先按 README 配置，或改用邮箱登录。") : t("发送失败：{msg}", { msg: error.message });
    return toast(m);
  }
  state.phonePending = phone;
  renderLogin();
}
/** 邀请码直接进入：匿名登录后用邀请码加入家庭（加入动作在 boot 的 start() 里完成，避免和 SIGNED_IN 事件打架） */
export async function doQuickJoin(f) {
  const digits = f.elements.phone.value.replace(/\D/g, "");
  const code = f.elements.code.value.trim();
  if (digits.length < 6 || digits.length > 15) return toast(t("请输入正确的手机号"));
  if (!code) return toast(t("请输入邀请码"));
  const name = f.elements.display_name.value.trim() || t("尾号{d}", { d: digits.slice(-4) });
  f.querySelector("button").disabled = true;
  state.pendingJoin = { code, name };
  const { error } = await CloudStore.sb.auth.signInAnonymously({ options: { data: { phone_label: digits, display_name: name } } });
  if (error) {
    state.pendingJoin = null; f.querySelector("button").disabled = false;
    return toast(/anonymous/i.test(error.message) ? t("Supabase 还没开启匿名登录（Allow anonymous sign-ins），请先按 README 开启，或改用邮箱登录。") : t("进入失败：{msg}", { msg: error.message }));
  }
}
export async function doVerifyOtp(f) {
  const token = f.elements.token.value.trim();
  if (!token || !state.phonePending) return;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.verifyOtp({ phone: state.phonePending, token, type: "sms" });
  if (error) { f.querySelector("button").disabled = false; return toast(/expired|invalid/i.test(error.message) ? t("验证码不对或已过期，请重新发送") : t("登录失败：{msg}", { msg: error.message })); }
  state.phonePending = null;   // 成功后 onAuthStateChange 会收到 SIGNED_IN
}
