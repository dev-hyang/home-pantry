import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtShort } from "../core/util.js";
import { LANGS, detectLang, langOverride, t } from "../core/i18n.js";

/** 当前用户是否家主（household_members.role = owner） */
export const isOwner = () => state.members.some((m) => m.user_id === state.user?.id && m.role === "owner");

/** 家庭成员列表：家主能设 / 取消家主、移出成员；不能对自己操作（退出走“退出登录”），最后一位家主不能被取消或移出（数据库同样校验） */
function membersList() {
  const me = state.user?.id, owner = isOwner();
  const owners = state.members.filter((m) => m.role === "owner").length;
  return `<ul class="member-list">${state.members.map((m) => {
    const self = m.user_id === me, isO = m.role === "owner";
    // 家主正在改某位家人的称呼：这一行换成内联表单
    if (owner && !self && state.editMember === m.user_id) {
      return `<li><form class="member-rename" data-id="${m.user_id}">
        <input name="display_name" required maxlength="20" value="${esc(m.display_name)}" aria-label="${t("家人的称呼")}">
        <button class="btn btn-sm btn-primary" type="submit">${t("保存")}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="member-rename" data-id="">${t("取消")}</button></form></li>`;
    }
    const acts = owner && !self ? `<span class="head-acts">
        <button type="button" class="btn btn-sm btn-ghost" data-action="member-rename" data-id="${m.user_id}">${t("改称呼")}</button>
        ${isO ? (owners > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="member-role" data-id="${m.user_id}" data-role="member">${t("取消家主")}</button>` : "")
              : `<button type="button" class="btn btn-sm btn-ghost" data-action="member-role" data-id="${m.user_id}" data-role="owner">${t("设为家主")}</button>`}
        ${!isO || owners > 1 ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-remove" data-id="${m.user_id}">${t("移出家庭")}</button>` : ""}
      </span>` : "";
    return `<li><div class="grow"><b>${esc(m.display_name)}</b>${isO ? ` <span class="badge b-ok">${t("家主")}</span>` : ""}${self ? ` <span class="muted">${t("（我）")}</span>` : ""}
      ${m.joined_at ? `<small class="muted">${t("{d} 加入", { d: fmtShort(m.joined_at) })}</small>` : ""}</div>${acts}</li>`;
  }).join("")}</ul>`;
}

/* ── 设置 ── */
export function viewSettings() {
  const cloud = Store.mode === "cloud";
  const notif = "Notification" in window ? Notification.permission : "unsupported";
  const sw = (id, on, title, desc) => `<div class="panel"><div class="kv"><div><b>${title}</b><div class="muted">${desc}</div></div>
      <label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span>${on ? t("已打开") : t("已关闭")}</span></label></div></div>`;
  return `<section class="section"><div class="section-head"><h2>${t("设置")}</h2></div><div class="settings">
    <div class="panel">
      <div class="kv"><div><b>${esc(state.household?.name || "")}</b><div class="muted">${cloud ? t("云端协同：家人修改会实时同步") : t("本地演示：数据只保存在这个浏览器里")}</div></div>
        ${cloud ? `<button type="button" class="btn btn-sm" data-action="reload">${t("立即同步")}</button>` : ""}</div>
    </div>
    ${cloud ? `
    <div class="panel">
      <div class="kv"><div><div class="muted">${t("邀请家人：把这个邀请码发给他们")}</div><div class="code">${esc(state.household.invite_code)}</div></div>
        <div class="head-acts"><button type="button" class="btn btn-sm" data-action="copy-invite">${t("复制邀请码")}</button>
          ${isOwner() ? `<button type="button" class="btn btn-sm btn-ghost" data-action="rotate-invite">${t("重置邀请码")}</button>` : ""}</div></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${t("家人可以用邀请码直接进入（不用收邮件）。邀请码就是这个家的钥匙，泄露了请家主点“重置邀请码”，旧码立即失效，已加入的家人不受影响。")}</p>
      ${state.user?.is_anonymous ? `<p class="muted" style="font-size:12px;margin:6px 0 0">${t("你是通过邀请码直接进入的，身份保存在本设备浏览器里；清除浏览器数据或换手机后需要重新用邀请码进入。")}</p>` : ""}
      <h3 style="font-size:15px;margin:16px 0 6px">${t("家庭成员")}</h3>
      ${membersList()}
      ${isOwner() ? `<p class="muted" style="font-size:12px;margin:6px 0 0">${t("家主可以改家人的称呼、把家人设为家主（可以有多位）、取消家主，或把误加入的人移出家庭。最后一位家主不能被取消或移出。")}</p>` : ""}
      <form id="nameForm" class="add-row" style="grid-template-columns:1fr auto;margin-top:12px">
        <input name="display_name" maxlength="20" value="${esc(state.displayName)}" aria-label="${t("我在家里的称呼")}">
        <button class="btn btn-sm" type="submit">${t("保存称呼")}</button></form>
      ${state.households.length > 1 ? `<label style="display:grid;gap:4px;margin-top:12px">${t("切换家庭")}<select id="hhSwitch">${state.households.map((h) => `<option value="${h.id}" ${h.id === state.household.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></label>` : ""}
    </div>` : `
    <div class="panel config-diag">
      <b>${t("为什么还是本地演示模式")}</b>
      <p>${esc(t(state.configIssue || "没有检测到 Supabase 配置。"))}</p>
      <p class="muted" style="margin:0">${t("自查：在浏览器打开 {link}，确认看到的是你填好的地址和 key；改完后等 1–2 分钟，再按 Ctrl+F5（Mac：Cmd+Shift+R）强制刷新。", { link: `<a href="config.js" target="_blank" rel="noopener">${t("本站的 config.js")}</a>` })}</p>
    </div>`}
    <div class="panel">
      <label class="field-label" for="langSel">${t("语言")}</label>
      <select id="langSel">
        <option value="" ${!langOverride() ? "selected" : ""}>${t("自动（检测为{lang}）", { lang: LANGS[detectLang()] })}</option>
        ${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${langOverride() === k ? "selected" : ""}>${v}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("繁體中文由简体自动转换；English 没有翻译到的文案会显示中文。物品名称等自己填写的内容不会翻译。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="regionSel">${t("地区与单位")}</label>
      <select id="regionSel">
        <option value="" ${!Units.override ? "selected" : ""}>${t("自动（检测为{region}{tz}）", { region: esc(t(Units.detected().name)), tz: Units.timeZone() ? t("，时区 {tz}", { tz: esc(Units.timeZone()) }) : "" })}</option>
        ${Object.values(Units.REGIONS).map((r) => `<option value="${r.id}" ${Units.override === r.id ? "selected" : ""}>${t(r.name)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("当前：{units}，货币 {cur}。", { units: Units.region.system === "us" ? t("美制单位 lb、oz、fl oz、qt、gal") : t("公制单位 kg、g、斤、L、mL"), cur: Units.region.currency })}
        ${t("已有物品按原单位保存，显示时自动换算；按“个、盒、袋”计数的物品不换算。")}</p>
    </div>
    ${sw("houseToggle", state.houseEnabled, t("房屋维护模块"), t("关闭后导航和首页只显示厨房储藏，适合租房或不需要的家庭；数据不会删除"))}
    ${sw("gearToggle", state.gearEnabled, t("装备模块"), t("床品、电器、自行车、工具等耐用品，只记数量和位置；关闭后导航里不再显示，数据不会删除"))}
    <div class="panel"><div class="kv"><div><b>${t("浏览器通知")}</b><div class="muted">${t("打开网页时，若有新的缺货或少货会弹出提醒")}</div></div>
      ${notif === "granted" ? `<span class="badge b-ok">${t("已开启")}</span>` : notif === "unsupported" ? `<span class="muted">${t("此浏览器不支持")}</span>` : `<button type="button" class="btn btn-sm" data-action="notif">${t("开启通知")}</button>`}</div></div>
    <div class="panel"><div class="kv"><div><b>${t("导出数据")}</b><div class="muted">${t("下载库存和采购清单的 JSON 备份")}</div></div>
      <button type="button" class="btn btn-sm" data-action="export">${t("导出 JSON")}</button></div></div>
    ${cloud ? `<button type="button" class="btn btn-danger-ghost" data-action="logout">${t("退出登录")}</button>`
            : `<button type="button" class="btn btn-danger-ghost" data-action="reset-demo">${t("恢复演示数据")}</button>`}
  </div></section>`;
}
