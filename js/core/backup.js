/* 备份与恢复：把这个家庭在数据库里的全部数据打成一个 JSON（云端按表读，演示模式直接存整个本地库），
 * 可以手动下载，也可以按周 / 按月 / 自定义天数定时备份到：云端（Supabase Storage 的 backups 桶，迁移 037）、
 * 这台电脑的文件夹（File System Access API，桌面 Chrome / Edge）、或直接下载。备份只留 60 天，更早的自动清掉。
 * 恢复：换了手机、数据库被删、换了 Supabase 项目——先按 supabase/schema.sql 重建表，登录并建好家庭，再把备份文件导回来（同 id 的行覆盖，其余新增）。
 * 定时备份是网页，只能在打开应用时检查「上次备份是不是已经超过间隔」，到了就在后台做一次。界面在 settings/backup-views.js。 */
import { state } from "./state.js";
import { Store, CloudStore, DemoStore } from "./store.js";
import { t } from "./i18n.js";
import { createDrives } from "./cloud-drives.js";

export const APP = "home-pantry", FORMAT = 2, KEEP_DAYS = 60, KEY = "hmh-backup";
/** 云盘：Google Drive / Dropbox / OneDrive / iCloud Drive 的电脑客户端都会在本机放一个同步文件夹，把备份写进去就等于上了那家云盘（网页没法直接调它们的 API：要各家注册 OAuth 应用，这里不做） */
export const PROVIDERS = [
  { id: "any", name: "任意文件夹 / 其他云盘", hint: "电脑上的任何文件夹都行；用别家云盘就选它的同步文件夹" },
  { id: "gdrive", name: "Google Drive", hint: "装了 Google Drive 桌面版后，Windows 一般在「G:\\我的云端硬盘」或「Google Drive」盘，Mac 在 ~/Google Drive" },
  { id: "dropbox", name: "Dropbox", hint: "Windows 一般在 C:\\Users\\<你>\\Dropbox，Mac 在 ~/Dropbox" },
  { id: "onedrive", name: "OneDrive", hint: "Windows 一般在 C:\\Users\\<你>\\OneDrive，Mac 在 ~/OneDrive" },
  { id: "icloud", name: "iCloud Drive", hint: "Mac 在 ~/Library/Mobile Documents/com~apple~CloudDocs（访达侧栏的 iCloud 云盘）；Windows 装 iCloud 后在 C:\\Users\\<你>\\iCloudDrive" },
];
/** 恢复时的写入顺序：被引用的表在前（assets → items/property_deals，cards → purchases/bills，purchases → maintenance_logs/bill_payments，household_people → medical_bills）。
 *  cards.bill_id 和 bills.pay_card_id 互相引用：cards 先不带 bill_id 写入，bills 写完再补。 */
export const TABLES = ["properties", "house_profiles", "custom_categories", "custom_locations", "custom_terms", "custom_seasonal_tasks", "seasonal_tasks", "assets", "items", "stock_logs", "shopping_list",
  "property_deals", "deal_task_done", "deal_task_overrides", "deal_custom_tasks", "household_people", "cards", "purchases", "maintenance_logs", "bills", "bill_payments", "medical_bills", "medical_payments",
  "member_incomes", "household_budgets"];
const PAGE = 1000;   // PostgREST 单次最多 1000 行，大表分页读

/* ───────────── 设置（存本机：文件夹本来就是这台电脑的） ───────────── */
const DEFAULTS = { every: "off", days: 14, targets: ["download"], provider: "any", gdPath: "", dbxPath: "", last: null, lastInfo: "" };
export function settings() { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "null") || {}) }; } catch { return { ...DEFAULTS }; } }
export function saveSettings(patch) { const s = { ...settings(), ...patch }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 隐私模式 */ } return s; }
export const intervalDays = (s = settings()) => (s.every === "week" ? 7 : s.every === "month" ? 30 : s.every === "custom" ? Math.max(1, +s.days || 14) : 0);
/** 下次该备份的时间（关了返回 null） */
export function nextDue(s = settings()) { const d = intervalDays(s); if (!d) return null; return s.last ? new Date(new Date(s.last).getTime() + d * 864e5) : new Date(); }
export const isDue = (s = settings()) => { const n = nextDue(s); return !!n && n.getTime() <= Date.now(); };

/* ───────────── 打包 ───────────── */
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
export const fileName = () => `${APP}-${stamp()}.json`;
export const FILE_RE = /^home-pantry-(\d{4}-\d{2}-\d{2})-\d{4}\.json$/;   // 清理旧备份时只认我们自己起的名字
async function readAll(sb, table) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").eq("household_id", CloudStore.hid).range(from, from + PAGE - 1);
    if (error) { if (/does not exist|schema cache/i.test(error.message)) return out; throw new Error(`${table}: ${error.message}`); }   // 还没执行迁移的表：当作空
    out.push(...(data || [])); if (!data || data.length < PAGE) return out;
  }
}
/** 当前家庭的全部数据 → 备份对象 */
export async function collect() {
  const base = { app: APP, format: FORMAT, app_version: window.APP_VERSION || "", exported_at: new Date().toISOString(), mode: Store.mode };
  if (Store.mode === "demo") return { ...base, household: { name: t("演示家庭") }, db: JSON.parse(JSON.stringify(DemoStore.db)) };   // 拷一份：预览里拿着的备份不能跟着之后的改动变
  const sb = CloudStore.sb, tables = {};
  for (const tb of TABLES) tables[tb] = await readAll(sb, tb);
  return { ...base, household: { id: CloudStore.hid, name: state.household?.name || "" }, exporter: state.user?.id || null,
    members: (state.members || []).map((m) => ({ user_id: m.user_id, display_name: m.display_name })), tables };
}
export const rowCount = (data) => (data.tables ? Object.values(data.tables).reduce((a, r) => a + (r?.length || 0), 0) : Object.values(data.db || {}).reduce((a, r) => a + (Array.isArray(r) ? r.length : 0), 0));
export const toBlob = (data) => new Blob([JSON.stringify(data)], { type: "application/json" });

/* ───────────── 目标 1：下载 ───────────── */
export function download(blob, name) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ───────────── 目标 2：这台电脑的文件夹（File System Access API：桌面 Chrome / Edge；手机和 Safari 没有） ───────────── */
export const folderSupported = () => typeof window.showDirectoryPicker === "function";
const IDB = "hmh-fs", IDB_STORE = "handles";
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k) { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch { return null; } }
async function idbSet(k, v) { try { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, "readwrite"); if (v == null) tx.objectStore(IDB_STORE).delete(k); else tx.objectStore(IDB_STORE).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch { /* 忽略 */ } }
export async function pickFolder() {   // 必须在点击里调用
  const h = await window.showDirectoryPicker({ mode: "readwrite", id: "hmh-backup", startIn: "documents" });
  await idbSet("dir", h); return h;
}
export const forgetFolder = () => idbSet("dir", null);
/** { supported, name, perm: granted | prompt | none } */
export async function folderStatus() {
  if (!folderSupported()) return { supported: false, name: "", perm: "none" };
  const h = await idbGet("dir"); if (!h) return { supported: true, name: "", perm: "none" };
  let perm = "prompt"; try { perm = await h.queryPermission({ mode: "readwrite" }); } catch { /* 旧版 */ }
  return { supported: true, name: h.name, perm, handle: h };
}
/** 写进文件夹；没有权限时若在点击里就申请，否则抛 NEED_GESTURE 让界面提示用户点一下 */
export async function writeFolder(blob, name, { gesture = false } = {}) {
  const st = await folderStatus(); if (!st.handle) throw new Error("NO_FOLDER");
  if (st.perm !== "granted") { if (!gesture) throw new Error("NEED_GESTURE"); const p = await st.handle.requestPermission({ mode: "readwrite" }); if (p !== "granted") throw new Error("NEED_GESTURE"); }
  const fh = await st.handle.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close();
  await pruneFolder(st.handle);
  try { const n = await copySqlInto(st.handle, gesture); if (n) lastSqlCopied = n; } catch { /* 拷不动 SQL 不影响备份本身 */ }
}
let lastSqlCopied = 0;
/* ---- 数据库脚本：supabase/ 目录在电脑上、不进 git，备份文件里也没有；选一次它的位置，每次写云盘文件夹时把 *.sql 一起拷进 sql/ 子目录 ---- */
export async function pickSqlFolder() { const h = await window.showDirectoryPicker({ mode: "read", id: "hmh-sql", startIn: "documents" }); await idbSet("sqldir", h); return h; }
export const forgetSqlFolder = () => idbSet("sqldir", null);
export async function sqlStatus() { const h = await idbGet("sqldir"); return h ? { name: h.name, handle: h } : { name: "" }; }
async function copySqlInto(dst, gesture) {
  const src = await idbGet("sqldir"); if (!src) return 0;
  let perm = "prompt"; try { perm = await src.queryPermission({ mode: "read" }); } catch { /* 旧版 */ }
  if (perm !== "granted") { if (!gesture) return 0; if ((await src.requestPermission({ mode: "read" })) !== "granted") return 0; }
  const out = await dst.getDirectoryHandle("sql", { create: true }); let n = 0;
  const walk = async (dir, to) => { for await (const [name, h] of dir.entries()) {
    if (h.kind === "directory") { if (name.startsWith(".")) continue; await walk(h, await to.getDirectoryHandle(name, { create: true })); }
    else if (/\.(sql|md)$/i.test(name)) { const f = await h.getFile(), w = await (await to.getFileHandle(name, { create: true })).createWritable(); await w.write(await f.arrayBuffer()); await w.close(); n++; }
  } };
  await walk(src, out); return n;
}
async function pruneFolder(handle) {
  const cut = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  try { for await (const [n] of handle.entries()) { const m = FILE_RE.exec(n); if (m && m[1] < cut) await handle.removeEntry(n).catch(() => {}); } } catch { /* 忽略 */ }
}

/* ───────────── 目标 3：云端（Supabase Storage，backups 桶，路径 家庭id/文件名；迁移 037 建桶和权限） ───────────── */
const bucket = () => CloudStore.sb.storage.from("backups");
export async function writeCloud(blob, name) {
  if (Store.mode !== "cloud") throw new Error("NOT_CLOUD");
  const { error } = await bucket().upload(`${CloudStore.hid}/${name}`, blob, { contentType: "application/json", upsert: true });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? t("还没执行迁移 037（云端备份桶），先在 Supabase 里执行 supabase/migrations/037_backups.sql") : error.message);
  await pruneCloud();
}
export async function listCloud() {
  if (Store.mode !== "cloud") return [];
  const { data, error } = await bucket().list(CloudStore.hid, { limit: 200, sortBy: { column: "name", order: "desc" } });
  if (error) return [];
  return (data || []).filter((f) => FILE_RE.test(f.name)).map((f) => ({ name: f.name, at: f.created_at || f.updated_at || "", size: f.metadata?.size || 0 }));
}
async function pruneCloud() {
  const cut = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  const old = (await listCloud()).filter((f) => (FILE_RE.exec(f.name) || [])[1] < cut).map((f) => `${CloudStore.hid}/${f.name}`);
  if (old.length) await bucket().remove(old).catch(() => {});
}
export async function readCloud(name) {
  const { data, error } = await bucket().download(`${CloudStore.hid}/${name}`);
  if (error) throw new Error(error.message);
  return JSON.parse(await data.text());
}
export async function deleteCloud(name) { await bucket().remove([`${CloudStore.hid}/${name}`]); }

/* ───────────── 云盘直连：Google Drive、Dropbox（代码在 cloud-drives.js，四个应用共用；在 config.js 填应用 key，见 README「云盘备份」）
   备份放在你在卡片里填的文件夹路径下（Drive 默认「爱家小助手备份」；Dropbox 相对应用文件夹），不往根目录随便放 ───────────── */
const lsLoad = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } };
const lsSave = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式 */ } };
export const DR = createDrives({ googleClientId: window.APP_CONFIG?.GOOGLE_CLIENT_ID || "", dropboxAppKey: window.APP_CONFIG?.DROPBOX_APP_KEY || "", tokPrefix: KEY, defaultFolder: "爱家小助手备份", fileRe: FILE_RE, keepDays: KEEP_DAYS, t, load: lsLoad, save: lsSave, getPaths: () => ({ gd: settings().gdPath, dbx: settings().dbxPath }) });
/** 能列出 / 恢复的来源（文件夹和下载的备份通过「选备份文件」读回来） */
export const SOURCES = {
  cloud: { icon: "🗄️", label: "应用云端", ready: () => Store.mode === "cloud" && !!CloudStore.hid, list: listCloud, read: readCloud, del: deleteCloud },
  gdrive: { icon: "▲", label: "Google Drive", ready: () => DR.gdOn(), list: () => DR.gdList(false), read: DR.gdRead, del: DR.gdDelete },
  dropbox: { icon: "◆", label: "Dropbox", ready: () => DR.dbxOn(), list: DR.dbxList, read: DR.dbxRead, del: DR.dbxDelete },
};
export const available = () => Object.keys(SOURCES).filter((k) => SOURCES[k].ready());
/** 打开应用时调一次：从 Dropbox 授权页跳回来（?code=…&state=dbx）就换成令牌，勾上 Dropbox，并跳到备份页 */
export async function initProviders(toast) {
  if (!new URL(location.href).searchParams.get("code")) return;
  try { if (await DR.initProviders()) { saveSettings({ targets: [...new Set([...settings().targets, "dropbox"])] }); toast(t("已连接 Dropbox")); } }
  catch (e) { toast(t("连接 Dropbox 失败：{msg}", { msg: e.message })); }
  location.hash = "#/me/settings?sec=backup";
}

/* ───────────── 跑一次备份（手动或定时） ───────────── */
/** targets：download / folder / cloud。返回 { ok: [...], failed: [[目标, 原因]], needGesture } */
export async function runBackup(targets, { gesture = false } = {}) {
  const data = await collect(), blob = toBlob(data), name = fileName(), ok = [], failed = []; let needGesture = false;
  for (const tg of targets) {
    try {
      if (tg === "download") download(blob, name);
      else if (tg === "folder") await writeFolder(blob, name, { gesture });
      else if (tg === "cloud") await writeCloud(blob, name);
      else if (tg === "gdrive") await DR.gdWrite(blob, name, gesture); else if (tg === "dropbox") await DR.dbxWrite(blob, name);
      else continue;
      ok.push(tg);
    } catch (e) { if (e.message === "NEED_GESTURE") needGesture = true; failed.push([tg, e.message === "NO_FOLDER" ? t("还没选文件夹") : e.message === "NEED_GESTURE" ? (tg === "gdrive" ? t("需要重新登录 Google") : t("需要你点一下授权")) : e.message]); }
  }
  const sqlN = lastSqlCopied; lastSqlCopied = 0;
  if (ok.length) saveSettings({ last: new Date().toISOString(), lastInfo: `${name} · ${ok.join("+")} · ${rowCount(data)} ${t("行")}${sqlN ? ` · ${t("SQL {n} 个", { n: sqlN })}` : ""}` });
  return { ok, failed, needGesture, name, rows: rowCount(data), sqlN };
}
/** 打开应用时的定时检查：到期了就在后台做一次（文件夹要点一下授权的，记下来让界面提示） */
let checked = false;
export async function runScheduled() {
  if (checked) return null; checked = true;
  const s = settings(); if (!isDue(s) || !s.targets.length) return null;
  if (Store.mode === "cloud" && !CloudStore.hid) return null;
  try { const r = await runBackup(s.targets, { gesture: false }); state.backupPending = r.needGesture; return r; }
  catch (e) { state.backupPending = false; return { ok: [], failed: [["all", e.message]], needGesture: false }; }
}

/* ───────────── 恢复 ───────────── */
/** 看一眼备份文件：{ ok, why, app, exported_at, household, mode, counts: {表: 行数}, rows } */
export function inspect(data) {
  if (!data || data.app !== APP) return { ok: false, why: t("这不是爱家小助手的备份文件") };
  if (!(data.tables || data.db)) return { ok: false, why: t("文件里没有数据") };
  if ((data.mode || "cloud") !== Store.mode) return { ok: false, why: Store.mode === "demo" ? t("这是云端家庭的备份，要先登录到云端家庭再恢复") : t("这是本地演示数据的备份，只能恢复到演示模式") };
  const counts = data.tables ? Object.fromEntries(TABLES.map((tb) => [tb, (data.tables[tb] || []).length]).filter(([, n]) => n)) : Object.fromEntries(Object.entries(data.db).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => [k, v.length]));
  return { ok: true, app: data.app, exported_at: data.exported_at, household: data.household?.name || "", mode: data.mode || "cloud", counts, rows: rowCount(data), sameHousehold: !data.household?.id || data.household.id === CloudStore.hid };
}
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
/** 导回当前家庭：同 id 的行覆盖，其余新增；household_id 一律换成当前家庭；导出者的 user id 换成现在登录的人。
 *  返回 { done: {表: 行数}, skipped: {表: 行数}, errors: [[表, 原因]] } */
export async function restore(data, onProgress = () => {}) {
  if (Store.mode === "demo") { DemoStore.db = data.db; DemoStore.persist(); DemoStore.load(); return { done: { demo: rowCount(data) }, skipped: {}, errors: [] }; }
  const sb = CloudStore.sb, hid = CloudStore.hid, me = state.user?.id, exporter = data.exporter, members = new Set((state.members || []).map((m) => m.user_id));
  const uid = (v) => (v && v === exporter ? me : v);   // 导出者 → 现在登录的人；别的家人 id 原样留着（没有外键的列只是查不到名字）
  const done = {}, skipped = {}, errors = [], cardBills = [];
  for (const tb of TABLES) {
    let rows = (data.tables?.[tb] || []).map((r) => ({ ...r, household_id: hid }));
    if (!rows.length) continue;
    onProgress(tb);
    if (tb === "member_incomes") { const keep = rows.filter((r) => members.has(uid(r.user_id))); skipped[tb] = rows.length - keep.length; rows = keep.map((r) => ({ ...r, user_id: uid(r.user_id) })); }   // 收入按人存，人不在这个家庭里的导不进（外键）
    if (tb === "cards") rows = rows.map((r) => { if (r.bill_id) cardBills.push([r.id, r.bill_id]); return { ...r, bill_id: null }; });   // 和 bills 互相引用：先不带 bill_id
    if (tb === "stock_logs") {   // id 是自增、不能指定：去掉 id，按 (item_id, created_at) 跳过已有的
      const { data: have } = await sb.from("stock_logs").select("item_id,created_at").eq("household_id", hid).limit(10000);
      const seen = new Set((have || []).map((x) => `${x.item_id}|${x.created_at}`)), before = rows.length;
      rows = rows.filter((r) => !seen.has(`${r.item_id}|${r.created_at}`)).map(({ id, ...r }) => r); skipped[tb] = before - rows.length;
    }
    for (const k of ["created_by", "updated_by", "paid_by", "done_by", "claimed_by", "assigned_to", "holder_user_id", "owner"]) rows = rows.map((r) => (k in r ? { ...r, [k]: uid(r[k]) } : r));
    let n = 0;
    for (const part of chunks(rows, 200)) {
      const q = tb === "stock_logs" ? sb.from(tb).insert(part) : sb.from(tb).upsert(part, { defaultToNull: false });
      const { error } = await q;
      if (error) { errors.push([tb, error.message]); break; }
      n += part.length;
    }
    done[tb] = n;
  }
  for (const [id, bill_id] of cardBills) await sb.from("cards").update({ bill_id }).eq("id", id).then(() => {}, () => {});
  return { done, skipped, errors };
}
