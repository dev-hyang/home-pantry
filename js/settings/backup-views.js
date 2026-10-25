/* 我的 → 设置 → 备份与恢复：同步状态、定时备份（周 / 月 / 自定义）、备份到哪（云盘同步文件夹 / 应用云端 / 下载）、SQL 文件提醒与一键拷贝、云端备份列表、从文件恢复、重建指引。逻辑在 core/backup.js */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, syncState } from "../core/util.js";
import { t } from "../core/i18n.js";
import { DR, KEEP_DAYS, PROVIDERS, SOURCES, available, folderStatus, folderSupported, inspect, intervalDays, nextDue, settings, sqlStatus } from "../core/backup.js";

const rerender = () => window.dispatchEvent(new Event("hmh-rerender"));
/** 文件夹状态和云端列表是异步的：第一次画先用空的，读完再重画一次 */
export function ensureBackupUi() {
  const u = state.backupUi; if (u && !u.stale) return u;
  state.backupUi = { ...(u || {}), stale: false, loading: true };
  const srcs = available();
  Promise.all([folderStatus().catch(() => ({ supported: false, perm: "none", name: "" })), sqlStatus().catch(() => ({ name: "" })), ...srcs.map((k) => SOURCES[k].list().catch(() => []))]).then(([folder, sql, ...ls]) => { const lists = {}; srcs.forEach((k, i) => { lists[k] = ls[i]; }); state.backupUi = { ...state.backupUi, folder, sql, lists, loading: false, stale: false }; rerender(); });
  return state.backupUi;
}
export const refreshBackupUi = () => { if (state.backupUi) state.backupUi.stale = true; };
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** 一张可勾选的「目标卡」：整张卡都能点，勾选框在左，右边标题 + 说明 + 这张卡自己的设置 */
const card = (k, on, icon, title, desc, body = "", off = false) => `<label class="bk-card ${on && !off ? "on" : ""} ${off ? "off" : ""}"><input type="checkbox" name="target" value="${k}" ${on ? "checked" : ""} ${off ? "disabled" : ""}><span class="bk-ic" aria-hidden="true">${icon}</span><span class="bk-body"><b>${title}</b><small>${desc}</small>${body ? `<span class="bk-sub">${body}</span>` : ""}</span></label>`;

export function backupPanel() {
  const s = settings(), ui = ensureBackupUi(), cloud = Store.mode === "cloud";
  const folder = ui.folder || { supported: folderSupported(), perm: "none", name: "" }, sql = ui.sql || { name: "" };
  const has = (k) => s.targets.includes(k), due = nextDue(s);
  const prov = PROVIDERS.find((p) => p.id === s.provider) || PROVIDERS[0];
  /* 云盘同步文件夹：Google Drive / Dropbox / OneDrive / iCloud Drive 的桌面客户端都会在电脑上放一个同步文件夹，选它就等于备份上了那家云盘 */
  const provSel = `<select name="provider" aria-label="${esc(t("云盘"))}">${PROVIDERS.map((p) => `<option value="${p.id}" ${p.id === prov.id ? "selected" : ""}>${esc(t(p.name))}</option>`).join("")}</select>`;
  const folderBody = !folder.supported ? `<em class="bk-warn">${t("这个浏览器不能直接写文件夹（手机、iPad 和 Safari 都不行）。手机上用「下载到设备」，再在系统的分享 / 文件里存到 iCloud Drive 或 Google Drive。")}</em>`
    : `<span class="bk-row">${provSel}${folder.name ? `<span class="bk-pill ok">📁 ${esc(folder.name)}${folder.perm !== "granted" ? ` · ${t("待授权")}` : ""}</span>` : ""}</span>
       <span class="bk-row">${folder.name ? `${folder.perm !== "granted" ? `<button type="button" class="btn btn-sm" data-action="backup-grant">${t("授权这台电脑写入")}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-action="backup-pick-folder">${t("换文件夹")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-folder">${t("不再用")}</button>` : `<button type="button" class="btn btn-sm" data-action="backup-pick-folder">${t("选同步文件夹")}</button>`}</span>
       <em>${esc(t(prov.hint))}</em>`;
  const sqlBody = `<span class="bk-row">${sql.name ? `<span class="bk-pill ok">📁 ${esc(sql.name)}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-sql">${t("不再用")}</button>` : folder.supported ? `<button type="button" class="btn btn-sm" data-action="backup-pick-sql">${t("选 supabase 文件夹")}</button>` : ""}</span>`;
  const status = s.last ? t("上次备份 {d}", { d: when(s.last) }) : t("还没备份过");
  const nextTxt = !intervalDays(s) ? t("没开定时") : due && due.getTime() <= Date.now() ? t("已到期，下次打开应用时自动备份") : t("下次 {d}", { d: when(due?.toISOString()) });
  // 已有的备份：按来源切换（应用云端 / Google Drive / Dropbox）；文件夹和下载的备份通过「选备份文件」读回来
  const srcs = available(); let cloudList = "";
  if (srcs.length) {
    state.backupSrc = srcs.includes(state.backupSrc) ? state.backupSrc : srcs[0]; const src = state.backupSrc, list = (ui.lists || {})[src] || [], S0 = SOURCES[src];
    const row = (f) => `<li><div class="grow"><span class="name">${esc(f.name)}</span><small>${esc(when(f.at))} · ${kb(f.size)}</small></div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="backup-dl" data-src="${src}" data-id="${esc(f.id || f.name)}" data-name="${esc(f.name)}">${t("下载")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-use" data-src="${src}" data-id="${esc(f.id || f.name)}">${t("恢复")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-rm" data-src="${src}" data-id="${esc(f.id || f.name)}" data-name="${esc(f.name)}" aria-label="${esc(t("删除"))}">✕</button></li>`;
    const shown = list.slice(0, 3), rest = list.slice(3, 30);
    cloudList = `<div class="panel bk-panel"><h3>${t("备份记录")}</h3>${srcs.length > 1 ? `<div class="chips bk-srcs">${srcs.map((k) => `<button type="button" class="chip" data-action="backup-src" data-src="${k}" aria-pressed="${k === src}">${SOURCES[k].icon} ${t(SOURCES[k].label)}</button>`).join("")}</div>` : `<p class="muted">${S0.icon} ${t(S0.label)}</p>`}
      ${ui.loading ? `<p class="muted">${t("读取中…")}</p>` : list.length ? `<ul class="restock-list">${shown.map(row).join("")}</ul>${rest.length ? `<details class="bk-more"><summary>${t("更早的 {n} 条", { n: rest.length })}</summary><ul class="restock-list">${rest.map(row).join("")}</ul></details>` : ""}` : `<p class="muted" style="margin:0">${t("这里还没有备份。上面勾上它，再点「现在备份」。")}</p>`}</div>`;
  }
  const notCfg = t("需要先在 config.js 里填好（见 README「云盘备份」）");
  const driveCard = (k, icon, label, cfgd, tk, pathName, pathLabel, pathVal, ph, pathText) => card(k, has(k), icon, label, cfgd ? t("放在你 {d} 里指定的文件夹，手机电脑都能用；只留 {n} 天", { d: label, n: KEEP_DAYS }) : notCfg,
    !cfgd ? "" : (k === "gdrive" && s.gdId ? `<span class="bk-row"><span class="bk-pill ok">📁 ${esc(s.gdName || t("已选的文件夹"))}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-gd-clear">${t("改用路径")}</button></span>` : `<span class="bk-row bk-path"><label class="muted">${pathLabel}</label><input name="${pathName}" value="${esc(pathVal || "")}" placeholder="${esc(ph)}" maxlength="120" autocomplete="off"></span>${k === "gdrive" ? `<small class="bk-hint">${t("只能用应用自己建的文件夹；想用你在 Drive 里已有的文件夹，请点下面的「或在 Drive 里选一个文件夹…」。")}</small>` : ""}${k === "gdrive" && tk && DR.gdPickerAvailable() ? `<span class="bk-row"><button type="button" class="btn btn-sm btn-ghost" data-action="backup-gd-pick">${t("或在 Drive 里选一个文件夹…")}</button></span>` : ""}`) + `<span class="bk-row">${tk ? `<span class="bk-pill ok">${t("已连接")}${tk.email ? ` ${esc(tk.email)}` : ""}${pathText ? ` · ${esc(pathText)}` : ""}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-${k === "gdrive" ? "gd" : "dbx"}-off">${t("断开")}</button>` : `<button type="button" class="btn btn-sm" data-action="backup-${k === "gdrive" ? "gd" : "dbx"}-on">${t("连接 {d}", { d: label })}</button>`}</span>`, !cfgd || !tk);
  const pv = state.backupPreview;
  const preview = pv ? (pv.ok ? `<div class="notice" role="status"><b>${t("备份来自 {h}，{d}，共 {n} 行", { h: esc(pv.household || t("未知家庭")), d: when(pv.exported_at), n: pv.rows })}</b>
      <div class="muted" style="font-size:12.5px;margin:4px 0">${Object.entries(pv.counts).map(([k, v]) => `${esc(k)} ${v}`).join(" · ")}</div>
      ${!pv.sameHousehold ? `<p class="muted" style="margin:4px 0;font-size:12.5px">${t("这是另一个家庭 id 的备份（换了项目或重建过家庭时正常）：会导进现在这个家庭。")}</p>` : ""}
      <p style="margin:6px 0 0;font-size:13px">${t("恢复 = 把文件里的数据导回当前家庭：只补缺的，已有同 id 的行不动，也不删任何行。导出者的记录归到现在登录的你。")}</p>
      <div class="bk-row" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="backup-restore-confirm">${t("恢复到当前家庭")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${t("取消")}</button></div></div>`
    : `<div class="notice" role="alert"><b>${t("不能恢复：{why}", { why: esc(pv.why) })}</b> <button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${t("关闭")}</button></div>`) : "";
  const result = state.backupResult ? `<div class="notice ${state.backupResult.ok === false ? "bad" : ""}" role="status"><b>${esc(state.backupResult.title)}</b>${state.backupResult.detail ? `<div class="muted" style="font-size:12.5px;margin-top:4px">${esc(state.backupResult.detail)}</div>` : ""}</div>` : "";
  const sync = cloud ? `<div class="bk-sync"><span id="syncBadge" class="sync ${syncState.err ? "err" : ""}" role="status">${esc(syncState.text || t("已同步"))}</span><button type="button" class="btn btn-sm" data-action="reload">${t("立即同步")}</button></div>` : `<div class="bk-sync"><span class="sync">${t("本地演示：数据只在这个浏览器里，更要备份")}</span></div>`;
  return `${sync}
    ${state.backupPending ? `<div class="notice" role="status"><b>${t("定时备份在等你点一下")}</b> ${t("写入这台电脑的文件夹需要你授权一次。")} <button type="button" class="btn btn-sm" data-action="backup-continue">${t("继续备份")}</button></div>` : ""}
    ${result}
    <div class="panel bk-panel bk-status"><div><b>${esc(status)}</b><small>${s.lastInfo ? `${esc(s.lastInfo)} · ` : ""}${esc(nextTxt)}</small></div>
      <div class="bk-row"><button type="button" class="btn btn-primary" data-action="backup-now">${t("现在备份")}</button><button type="button" class="btn btn-ghost" data-action="backup-download">${t("下载一份")}</button></div></div>
    <form id="backupForm" class="panel bk-panel" onsubmit="return false">
      <div class="bk-sched"><label>${t("多久备份一次")} <select name="every" aria-label="${esc(t("多久备份一次"))}">${[["off", "不自动备份"], ["week", "每周"], ["month", "每月"], ["custom", "自定义（天）"]].map(([v, l]) => `<option value="${v}" ${s.every === v ? "selected" : ""}>${t(l)}</option>`).join("")}</select></label>
        <label data-backup-days ${s.every === "custom" ? "" : "hidden"}>${t("每隔几天")} <input name="days" type="number" min="1" max="365" inputmode="numeric" value="${s.days}" aria-label="${esc(t("每隔几天"))}"> ${t("天")}</label></div>
      <p class="muted">${t("网页关着时跑不了：到期后下次打开应用时自动备份一次。")}</p>
      <h3>${t("备份到哪")} <small class="muted">${t("可多选")}</small></h3>
      <div class="bk-cards">
        ${card("folder", has("folder"), "☁️", t("云盘同步文件夹"), t("Google Drive / Dropbox / OneDrive / iCloud Drive 的电脑客户端都有一个同步文件夹，选它就等于备份上了那家云盘；也可以选电脑上任何位置。只留 {n} 天。", { n: KEEP_DAYS }), folderBody)}
        ${cloud ? card("cloud", has("cloud"), "🗄️", t("应用自己的云端"), t("这个家庭在 Supabase 里的存储，全家任何设备都能恢复；只留 {n} 天；需要先执行迁移 037。", { n: KEEP_DAYS })) : ""}
        ${driveCard("gdrive", "▲", "Google Drive", DR.gdConfigured(), DR.tok("gd"), "gdPath", t("Drive 里的文件夹路径"), s.gdPath, "爱家小助手备份", DR.gdOn() ? DR.gdPathText() : "")}
        ${driveCard("dropbox", "◆", "Dropbox", DR.dbxConfigured(), DR.tok("dbx"), "dbxPath", t("应用文件夹里的子路径"), s.dbxPath, t("留空 = 直接放应用文件夹"), "")}
        ${card("download", has("download"), "⬇️", t("下载到设备"), t("每次弹出下载。手机上下载后可以「存储到文件」放进 iCloud Drive / Google Drive；浏览器下载的旧文件不会自动清理。"))}
      </div>
      <div class="bk-sql"><b>⚠️ ${t("数据库脚本不在备份里")}</b><small>${t("supabase/schema.sql 和 migrations 只在你的电脑上（不进 git）。电脑没了，备份文件就导不回去。请把这个文件夹手动拷到云盘或别的位置；选了云盘同步文件夹的话，可以让每次备份顺带把 .sql 一起拷进去：")}</small>${sqlBody}</div>
    </form>
    ${cloudList}
    <div class="panel bk-panel"><h3>${t("从备份恢复")}</h3><p class="muted">${t("换了手机、数据库被删、或换了 Supabase 项目：先登录并建好家庭（新项目要先在 SQL Editor 执行 supabase/schema.sql），再选备份文件导回来。")}</p>
      <div class="bk-row"><label class="btn btn-sm">${t("选备份文件")}<input id="backupFile" type="file" accept="application/json,.json" hidden></label></div>
      ${preview}</div>
    <details class="ref-panel panel"><summary><b>${t("数据库没了怎么重建")}</b><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body"><ol class="small" style="margin:0;padding-left:18px">
      <li>${t("新建 Supabase 项目（或在原项目里），SQL Editor 执行 supabase/schema.sql（完整建表，含所有迁移；再执行 037_backups.sql 建备份桶）。")}</li>
      <li>${t("把新项目的 URL 和 anon key 填进 config.js，重新部署。")}</li>
      <li>${t("每位家人重新注册登录；家主创建家庭，其他人用邀请码加入。")}</li>
      <li>${t("家主在这里「选备份文件」导入最近一份备份（应用云端里的备份跟着旧项目一起没了，所以云盘 / 下载的那份才是保险）。")}</li>
      <li>${t("家人各自的收入只能由本人登录后再填一次（收入按登录账号存，新账号对不上）。")}</li></ol></div></details>`;
}
export const backupSummary = () => { const s = settings(); return `${!intervalDays(s) ? t("没开定时") : s.every === "week" ? t("每周") : s.every === "month" ? t("每月") : t("每 {n} 天", { n: s.days })} · ${s.last ? t("上次 {d}", { d: fmtDate(s.last.slice(0, 10)) }) : t("还没备份过")}`; };
export { inspect };
