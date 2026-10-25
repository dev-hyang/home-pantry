/* 我的 → 设置 → 备份与恢复：定时备份（周 / 月 / 自定义）、备份到哪（云端 / 这台电脑的文件夹 / 下载）、现在备份、云端备份列表、从文件恢复、重建数据库指引。逻辑在 core/backup.js */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate } from "../core/util.js";
import { t } from "../core/i18n.js";
import { KEEP_DAYS, folderStatus, folderSupported, inspect, intervalDays, listCloud, nextDue, settings } from "../core/backup.js";

const rerender = () => window.dispatchEvent(new Event("hmh-rerender"));
/** 文件夹状态和云端列表是异步的：第一次画先用空的，读完再重画一次 */
export function ensureBackupUi() {
  const u = state.backupUi; if (u && !u.stale) return u;
  state.backupUi = { ...(u || {}), stale: false, loading: true };
  Promise.all([folderStatus().catch(() => ({ supported: false, perm: "none", name: "" })), listCloud().catch(() => [])]).then(([folder, cloud]) => { state.backupUi = { folder, cloud, loading: false, stale: false }; rerender(); });
  return state.backupUi;
}
export const refreshBackupUi = () => { if (state.backupUi) state.backupUi.stale = true; };
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function backupPanel() {
  const s = settings(), ui = ensureBackupUi(), cloud = Store.mode === "cloud", folder = ui.folder || { supported: folderSupported(), perm: "none", name: "" };
  const has = (k) => s.targets.includes(k), chk = (k, label, desc, extra = "") => `<label class="check-inline"><input type="checkbox" name="target" value="${k}" ${has(k) ? "checked" : ""}><span><b>${label}</b><small class="muted"> · ${desc}</small></span></label>${extra}`;
  const due = nextDue(s);
  const status = s.last ? t("上次备份 {d}（{info}）", { d: when(s.last), info: s.lastInfo || "" }) : t("还没备份过");
  const nextTxt = !intervalDays(s) ? t("定时备份已关") : due && due.getTime() <= Date.now() ? t("已到期：下次打开应用时自动备份（现在就可以点「现在备份」）") : t("下次 {d}", { d: when(due?.toISOString()) });
  const folderLine = !folder.supported ? `<small class="muted">${t("这个浏览器不支持直接写文件夹（手机和 Safari 没有）；用「下载」或云端")}</small>`
    : folder.name ? `<small class="muted">${t("文件夹：{n}", { n: folder.name })}${folder.perm !== "granted" ? ` · <b>${t("需要点一下授权")}</b> <button type="button" class="btn btn-sm btn-ghost" data-action="backup-grant">${t("授权")}</button>` : ""} · <button type="button" class="btn btn-sm btn-ghost" data-action="backup-pick-folder">${t("换文件夹")}</button> <button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-folder">${t("不再用")}</button></small>`
    : `<small class="muted"><button type="button" class="btn btn-sm" data-action="backup-pick-folder">${t("选一个文件夹")}</button> ${t("选一次就记住，以后自动写进去；放在 OneDrive / iCloud 同步的文件夹里就等于也上了云")}</small>`;
  const cloudList = cloud ? `<div class="panel"><div class="kv"><div><b>${t("云端备份")}</b><div class="muted">${t("存在这个家庭自己的 Supabase 存储里（backups 桶），只留 {n} 天", { n: KEEP_DAYS })}</div></div></div>
      ${ui.loading ? `<p class="muted">${t("读取中…")}</p>` : (ui.cloud || []).length ? `<ul class="restock-list">${ui.cloud.slice(0, 12).map((f) => `<li><div class="grow"><span class="name">${esc(f.name)}</span><small>${esc(when(f.at))} · ${kb(f.size)}</small></div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="backup-cloud-dl" data-name="${esc(f.name)}">${t("下载")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-cloud-restore" data-name="${esc(f.name)}">${t("恢复")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-cloud-del" data-name="${esc(f.name)}" aria-label="${esc(t("删除"))}">✕</button></li>`).join("")}</ul>` : `<p class="muted" style="margin:0">${t("还没有云端备份。勾上「云端」再点「现在备份」。")}</p>`}</div>` : "";
  const pv = state.backupPreview;
  const preview = pv ? (pv.ok ? `<div class="notice" role="status"><b>${t("备份来自 {h}，{d}，共 {n} 行", { h: esc(pv.household || t("未知家庭")), d: when(pv.exported_at), n: pv.rows })}</b>
      <div class="muted" style="font-size:12.5px;margin:4px 0">${Object.entries(pv.counts).map(([k, v]) => `${esc(k)} ${v}`).join(" · ")}</div>
      ${!pv.sameHousehold ? `<p class="muted" style="margin:4px 0;font-size:12.5px">${t("这是另一个家庭 id 的备份（换了项目或重建过家庭时正常）：会导进现在这个家庭。")}</p>` : ""}
      <p style="margin:6px 0 0;font-size:13px">${t("恢复 = 把文件里的数据导回当前家庭：同 id 的行覆盖成文件里的样子，文件里没有的行不会删。导出者的记录归到现在登录的你。")}</p>
      <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-primary btn-sm" data-action="backup-restore-confirm">${t("恢复到当前家庭")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${t("取消")}</button></div></div>`
    : `<div class="notice" role="alert"><b>${t("不能恢复：{why}", { why: esc(pv.why) })}</b> <button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${t("关闭")}</button></div>`) : "";
  const result = state.backupResult ? `<div class="notice" role="status"><b>${esc(state.backupResult.title)}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${esc(state.backupResult.detail)}</div></div>` : "";
  return `
    ${state.backupPending ? `<div class="notice" role="status"><b>${t("定时备份在等你点一下")}</b> ${t("写入这台电脑的文件夹需要你授权一次。")} <button type="button" class="btn btn-sm" data-action="backup-continue">${t("继续备份")}</button></div>` : ""}
    ${result}
    <div class="panel"><div class="kv"><div><b>${t("备份")}</b><div class="muted">${esc(status)}<br>${esc(nextTxt)}</div></div>
      <div class="btns-col"><button type="button" class="btn btn-sm btn-primary" data-action="backup-now">${t("现在备份")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-download">${t("只下载一份")}</button></div></div></div>
    <form id="backupForm" class="panel" onsubmit="return false">
      <div class="form-grid">
        <label>${t("多久备份一次")}<select name="every">${[["off", "关闭"], ["week", "每周"], ["month", "每月"], ["custom", "自定义（天）"]].map(([v, l]) => `<option value="${v}" ${s.every === v ? "selected" : ""}>${t(l)}</option>`).join("")}</select><small>${t("网页没法在关着的时候跑：到期后下次打开应用时自动备份一次")}</small></label>
        <label ${s.every === "custom" ? "" : "hidden"} data-backup-days>${t("每隔几天")}<input name="days" type="number" min="1" max="365" inputmode="numeric" value="${s.days}"></label>
        <div class="span-2"><div class="lab" style="font-size:13px;font-weight:700;margin-bottom:4px">${t("备份到哪（可多选）")}</div>
          ${cloud ? chk("cloud", t("云端"), t("家庭自己的 Supabase 存储，全家任何设备都能恢复；需要迁移 037")) : ""}
          ${chk("folder", t("这台电脑的文件夹"), t("无需每次确认，自动清掉 {n} 天前的", { n: KEEP_DAYS }), `<div style="margin:-2px 0 8px 26px">${folderLine}</div>`)}
          ${chk("download", t("下载"), t("每次备份弹出下载；浏览器下载的文件不会自动清理"))}
        </div>
      </div>
    </form>
    ${cloudList}
    <div class="panel"><div class="kv"><div><b>${t("从备份恢复")}</b><div class="muted">${t("换了手机、数据库被删、或换了 Supabase 项目：先登录并建好家庭（新项目要先在 SQL Editor 执行 supabase/schema.sql），再选备份文件导回来")}</div></div>
      <label class="btn btn-sm">${t("选文件")}<input id="backupFile" type="file" accept="application/json,.json" hidden></label></div>
      ${preview}</div>
    <details class="ref-panel panel"><summary><b>${t("数据库没了怎么重建")}</b><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body"><ol class="small" style="margin:0;padding-left:18px">
      <li>${t("新建 Supabase 项目（或在原项目里），SQL Editor 执行 supabase/schema.sql（完整建表，含所有迁移；再执行 037_backups.sql 建备份桶）。")}</li>
      <li>${t("把新项目的 URL 和 anon key 填进 config.js，重新部署。")}</li>
      <li>${t("每位家人重新注册登录；家主创建家庭，其他人用邀请码加入。")}</li>
      <li>${t("家主在这里「选文件」导入最近一份备份（云端备份跟着旧项目一起没了，所以文件夹 / 下载的那份才是保险）。")}</li>
      <li>${t("家人各自的收入只能由本人登录后再填一次（收入按登录账号存，新账号对不上）。")}</li></ol>
      <p class="muted" style="margin:6px 0 0;font-size:12.5px">${t("schema.sql 和迁移文件不在 git 里，只在你的电脑上——记得和备份放在一起。")}</p></div></details>`;
}
export const backupSummary = () => { const s = settings(); return `${!intervalDays(s) ? t("定时备份已关") : s.every === "week" ? t("每周") : s.every === "month" ? t("每月") : t("每 {n} 天", { n: s.days })} · ${s.last ? t("上次 {d}", { d: fmtDate(s.last.slice(0, 10)) }) : t("还没备份过")}`; };
export { inspect };
