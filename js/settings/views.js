import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc } from "../core/util.js";

/* ── 设置 ── */
export function viewSettings() {
  const cloud = Store.mode === "cloud";
  const notif = "Notification" in window ? Notification.permission : "unsupported";
  return `<section class="section"><div class="section-head"><h2>设置</h2></div><div class="settings">
    <div class="panel">
      <div class="kv"><div><b>${esc(state.household?.name || "")}</b><div class="muted">${cloud ? "云端协同：家人修改会实时同步" : "本地演示：数据只保存在这个浏览器里"}</div></div>
        ${cloud ? `<button type="button" class="btn btn-sm" data-action="reload">立即同步</button>` : ""}</div>
    </div>
    ${cloud ? `
    <div class="panel">
      <div class="kv"><div><div class="muted">邀请家人：把这个邀请码发给他们</div><div class="code">${esc(state.household.invite_code)}</div></div>
        <button type="button" class="btn btn-sm" data-action="copy-invite">复制邀请码</button></div>
      <h3 style="font-size:15px;margin:16px 0 6px">家庭成员</h3>
      <ul class="tips">${state.members.map((m) => `<li>${esc(m.display_name)}${m.role === "owner" ? "（创建者）" : ""}${m.user_id === state.user.id ? "（我）" : ""}</li>`).join("")}</ul>
      <form id="nameForm" class="add-row" style="grid-template-columns:1fr auto;margin-top:12px">
        <input name="display_name" maxlength="20" value="${esc(state.displayName)}" aria-label="我在家里的称呼">
        <button class="btn btn-sm" type="submit">保存称呼</button></form>
      ${state.households.length > 1 ? `<label style="display:grid;gap:4px;margin-top:12px">切换家庭<select id="hhSwitch">${state.households.map((h) => `<option value="${h.id}" ${h.id === state.household.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></label>` : ""}
    </div>` : `
    <div class="panel config-diag">
      <b>为什么还是本地演示模式</b>
      <p>${esc(state.configIssue || "没有检测到 Supabase 配置。")}</p>
      <p class="muted" style="margin:0">自查：在浏览器打开 <a href="config.js" target="_blank" rel="noopener">本站的 config.js</a>，确认看到的是你填好的地址和 key；改完后等 1–2 分钟，再按 Ctrl+F5（Mac：Cmd+Shift+R）强制刷新。</p>
    </div>`}
    <div class="panel">
      <label class="field-label" for="regionSel">地区与单位</label>
      <select id="regionSel">
        <option value="" ${!Units.override ? "selected" : ""}>自动（检测为${esc(Units.detected().name)}${Units.timeZone() ? `，时区 ${esc(Units.timeZone())}` : ""}）</option>
        ${Object.values(Units.REGIONS).map((r) => `<option value="${r.id}" ${Units.override === r.id ? "selected" : ""}>${r.name}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">当前：${Units.region.system === "us" ? "美制单位 lb、oz、fl oz、qt、gal" : "公制单位 kg、g、斤、L、mL"}，货币 ${Units.region.currency}。
        已有物品按原单位保存，显示时自动换算；按“个、盒、袋”计数的物品不换算。</p>
    </div>
    <div class="panel"><div class="kv"><div><b>房屋维护模块</b><div class="muted">关闭后导航和首页只显示厨房储藏，适合租房或不需要的家庭；数据不会删除</div></div>
      <label class="switch"><input type="checkbox" id="houseToggle" ${state.houseEnabled ? "checked" : ""}><span>${state.houseEnabled ? "已打开" : "已关闭"}</span></label></div></div>
    <div class="panel"><div class="kv"><div><b>浏览器通知</b><div class="muted">打开网页时，若有新的缺货或少货会弹出提醒</div></div>
      ${notif === "granted" ? `<span class="badge b-ok">已开启</span>` : notif === "unsupported" ? `<span class="muted">此浏览器不支持</span>` : `<button type="button" class="btn btn-sm" data-action="notif">开启通知</button>`}</div></div>
    <div class="panel"><div class="kv"><div><b>导出数据</b><div class="muted">下载库存和采购清单的 JSON 备份</div></div>
      <button type="button" class="btn btn-sm" data-action="export">导出 JSON</button></div></div>
    ${cloud ? `<button type="button" class="btn btn-danger-ghost" data-action="logout">退出登录</button>`
            : `<button type="button" class="btn btn-danger-ghost" data-action="reset-demo">恢复演示数据</button>`}
  </div></section>`;
}
