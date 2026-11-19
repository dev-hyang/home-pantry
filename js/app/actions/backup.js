/* 备份与恢复：导出到云盘 / 文件夹、从文件恢复。 */
import * as Backup from "../../core/backup.js";
import { friendlyErr } from "../errors.js";
import { refresh } from "../data.js";
import { refreshBackupUi } from "../../settings/backup-views.js";
import { render } from "../render.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

/** 备份：手动 / 定时到期后点「继续」 */
export const backupTargetName = (k) => ({ download: t("下载"), folder: t("文件夹"), cloud: t("云端"), gdrive: "Google Drive", dropbox: "Dropbox" }[k] || k);
export async function doBackup(targets, el) {
  if (el) el.disabled = true;
  try {
    const r = await Backup.runBackup(targets, { gesture: true });
    state.backupPending = r.needGesture;
    const sqlNote = r.sqlN ? t("已顺带拷贝 {n} 个 SQL 文件。", { n: r.sqlN }) : t("提醒：数据库脚本（supabase/*.sql）不在备份里，请手动把它拷到云盘或别的位置。");
    state.backupResult = r.ok.length ? { title: t("已备份到 {to}：{name}（{n} 行）", { to: r.ok.map(backupTargetName).join("、"), name: r.name, n: r.rows }), detail: [sqlNote, ...r.failed.map(([k, why]) => `${backupTargetName(k)}：${why}`)].join("；") }
      : { ok: false, title: t("备份没成功"), detail: r.failed.map(([k, why]) => `${backupTargetName(k)}：${why}`).join("；") };
  } catch (err) { state.backupResult = { title: t("备份没成功"), detail: friendlyErr(err.message) }; }
  if (el) el.disabled = false;
  refreshBackupUi(); render(false);
}
export async function doRestore(el) {
  const pv = state.backupPreview; if (!pv?.ok || !pv.data) return;
  if (!confirm(t("把备份（{d}，{n} 行）导回当前家庭「{h}」？只补缺的，已有的不动、不删。", { d: String(pv.exported_at).slice(0, 16).replace("T", " "), n: pv.rows, h: state.household?.name || t("演示家庭") }))) return;
  el.disabled = true; el.textContent = t("恢复中…");
  try {
    const r = await Backup.restore(pv.data, (tb) => { el.textContent = t("恢复中… {t}", { t: tb }); });
    const n = Object.values(r.done).reduce((a, b) => a + b, 0), sk = Object.entries(r.skipped).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join("、");
    state.backupResult = { title: r.errors.length ? t("恢复了 {n} 行，但有表出错", { n }) : t("已恢复 {n} 行", { n }), detail: [sk ? t("跳过：{s}", { s: sk }) : "", ...r.errors.map(([tb, why]) => `${tb}：${friendlyErr(why)}`)].filter(Boolean).join("；") };
    state.backupPreview = null;
    await refresh();
  } catch (err) { state.backupResult = { title: t("恢复失败"), detail: friendlyErr(err.message) }; }
  render(false);
}
