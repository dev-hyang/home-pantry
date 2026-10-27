/* ============ 存储用量 ============
   设置页里的「存储用量」：数据库和文件存储各一根进度条，对照 Supabase 免费套餐的上限（数据库 500 MB、文件存储 1 GB）。
   数字来自数据库函数 storage_usage()（本仓库迁移 044，SECURITY DEFINER，只返回汇总字节数，不暴露任何文件名或行）。
   到 70% 变黄提醒，到 90% 变红；歌曲上传前也会用 storageRoom() 检查，放不下就拦住，免得把备份和别的数据挤满。
   爱家小助手有自己的 Supabase 项目，用量只统计这个项目。
   爱家小助手这份：数据库函数在 supabase/migrations/044_usage.sql，客户端用 CloudStore.sb。 */
import { CloudStore, Store } from "./store.js";
import { t } from "./i18n.js";
import { esc } from "./util.js";

const MB = 1048576;
const MIGRATION = "044_usage.sql";
/* 套餐上限。升级到 Pro 后改这里（数据库 8 GB、文件存储 100 GB）。 */
const PLAN = { name: "Free", db: 500 * MB, storage: 1024 * MB };
const WARN = 0.7, FULL = 0.9;
const SHARED_NOTE = "";   // 爱家小助手有自己的 Supabase 项目，不和别的应用合计
const BUCKET_NAMES = { media: "睡前歌曲", backups: "云端备份" };

let last = null, failure = null, at = 0, inflight = null;

function fmtBytes(b) {
  b = +b || 0;
  return b >= 1024 * MB ? (b / (1024 * MB)).toFixed(2) + " GB" : b >= MB ? (b / MB).toFixed(b >= 100 * MB ? 0 : 1) + " MB" : Math.round(b / 1024) + " KB";
}
const levelOf = (r) => (r >= FULL ? "full" : r >= WARN ? "warn" : "ok");
const isMissing = (e) => !!e && /storage_usage|PGRST202|schema cache|does not exist/i.test(`${e.code || ""} ${e.message || ""}`);

/** 向数据库要一次用量；一分钟内的重复调用直接用上次的结果（force 跳过） */
function fetchUsage(force = false) {
  if (inflight) return inflight;
  if (!force && last && Date.now() - at < 60000) return Promise.resolve(last);
  const c = CloudStore.sb; if (!c) return Promise.resolve(null);
  inflight = (async () => {
    try {
      const { data, error } = await c.rpc("storage_usage");
      if (error) throw error;
      last = data; at = Date.now(); failure = null;
    } catch (e) { failure = e; }
    inflight = null; paint(); return last;
  })();
  paint();
  return inflight;
}

/** 上传前检查：加上这个文件后文件存储会不会超过 90%。查不到用量（离线、没迁移）时不拦，交给服务器自己的限制 */
async function storageRoom(addBytes) {
  const u = await fetchUsage(true);
  if (!u) return { ok: true, unknown: true };
  const used = +u.storage_bytes || 0, after = used + (+addBytes || 0);
  return { ok: after <= PLAN.storage * FULL, used, after, cap: PLAN.storage };
}

function row(icon, title, desc, used, cap, tail) {
  const r = cap ? used / cap : 0, lv = levelOf(r), pct = Math.min(100, Math.round(r * 100));
  const note = lv === "full" ? t("🚨 快满了：再传可能失败，也会挤占备份。先删掉不用的，或升级套餐。")
    : lv === "warn" ? t("⚠️ 已经用了一大半，别再大量上传，先清理不用的。")
    : t("✅ 空间还很宽裕。");
  return `<div class="usage-row ${lv}">
    <div class="usage-top"><b>${icon} ${esc(title)}</b><span class="usage-num">${t("{used} / {cap} · {p}%", { used: fmtBytes(used), cap: fmtBytes(cap), p: pct })}</span></div>
    <div class="usage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(title)} ${pct}%"><i style="width:${used > 0 ? Math.max(pct, 2) : 0}%"></i></div>
    <p class="usage-note"><span class="muted">${esc(desc)}</span><br>${note}${tail || ""}</p>
  </div>`;
}

function body() {
  if (Store.mode !== "cloud" || !CloudStore.sb) return `<p class="muted usage-small">${t("登录并进入家庭后，这里会显示用量。")}</p>`;
  if (failure && !last) {
    const msg = isMissing(failure) ? t("还没执行迁移 {n}（用量查询），先在 Supabase 里执行 supabase/migrations/{n}", { n: MIGRATION }) : t("查询失败：{msg}", { msg: failure.message || "error" });
    return `<p class="usage-small">${esc(msg)}</p><div class="btns" style="margin-top:8px"><button class="btn btn-sm" data-usage-refresh>${t("重试")}</button></div>`;
  }
  if (!last) return `<p class="muted usage-small" aria-live="polite">${t("正在查看用量…")}</p>`;
  const files = Array.isArray(last.buckets) ? last.buckets : [];
  const parts = files.filter((b) => +b.bytes > 0).map((b) => `${esc(t(BUCKET_NAMES[b.name] || b.name))} ${fmtBytes(b.bytes)}`);
  const tail = parts.length ? `<br><span class="muted">${t("其中：")}${parts.join(" · ")}</span>` : "";
  return `${row("🗄️", t("数据库"), t("记录、任务、日志这些文字数据"), +last.db_bytes, PLAN.db)}
  ${row("📦", t("文件存储"), t("上传的文件和云端备份"), +last.storage_bytes, PLAN.storage, tail)}
  <div class="usage-foot"><span class="muted usage-small">${t("更新于 {time}", { time: new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}${failure ? " · " + t("刚才刷新失败，显示的是上次的数字") : ""}</span>
    <button class="btn btn-sm" data-usage-refresh ${inflight ? "disabled" : ""}>${inflight ? t("刷新中…") : t("刷新")}</button></div>
  <p class="muted usage-small">${t("{plan} 套餐上限：数据库 {db}、文件存储 {st}（以 Supabase 控制台为准）。{shared}", { plan: PLAN.name, db: fmtBytes(PLAN.db), st: fmtBytes(PLAN.storage), shared: SHARED_NOTE ? t(SHARED_NOTE) : "" })}</p>`;
}

function paint() { document.querySelectorAll("[data-usage]").forEach((el) => { el.innerHTML = body(); }); }

/** 设置页里放这一块：先画已有的数字（或「正在查看」），再后台刷新 */
function usageHTML() {
  setTimeout(() => fetchUsage(), 0);
  return `<div class="panel usage" data-usage>${body()}</div>`;
}

document.addEventListener("click", (e) => { if (e.target.closest("[data-usage-refresh]")) fetchUsage(true); });

export { usageHTML, fetchUsage, storageRoom, fmtBytes, levelOf, PLAN, WARN, FULL, MB };
