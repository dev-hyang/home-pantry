import { locale, t } from "./i18n.js";

export const DAY = 86400000;
export const RATE_WINDOW_DAYS = 60;   // 用最近 60 天的消耗记录估算日均用量
export const MIN_RATE_SPAN_DAYS = 7;  // 记录太少时至少按 7 天平摊，避免高估
export const STOCK_TARGET_DAYS = 14;  // 建议补货量：补到够用 14 天

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
export const fmt = (n) => (Math.round(n * 100) / 100).toString();
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
export const STATS_LOG_DAYS = 90;     // 消耗趋势图读取最近 90 天的库存日志

// 单位显示：数据按存储单位保存，界面按当前地区单位显示（见 units.js）
export const du = (unit) => Units.displayUnit(unit);
export const toDisp = (q, unit) => num(q) * Units.factor(unit);
export const showQty = (q, unit) => `${fmt(toDisp(q, unit))} ${esc(t(du(unit) || ""))}`.trim();
export const storedStep = (unit) => Units.step(du(unit)) / Units.factor(unit);
export const money = (v, short) => Units.money(v, undefined, !!short);
/** 单笔记录的金额：用户填了几位小数就显示几位（始终两位），不像汇总数那样 ≥ 1000 就省掉小数 */
/** 收起编辑表单时记下已填的内容、再展开时填回去（不保存到数据库）。只认 name；复选框记 checked，下拉 / 勾选变了会发 change 让联动（比如「需要还」展开的那块）跟着动 */
export function formDraft(f) {
  const d = {};
  for (const el of f.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") d[el.name] = { checked: el.checked };
    else if (el.type === "radio") { if (el.checked) d[el.name] = el.value; }
    else if (el.type !== "submit" && el.type !== "button") d[el.name] = el.value;
  }
  return d;
}
export function applyDraft(f, d) {
  for (const [n, v] of Object.entries(d || {})) {
    const el = f.elements[n]; if (!el) continue;
    if (el instanceof RadioNodeList) { el.value = v; continue; }
    if (v && typeof v === "object") { if (el.checked !== v.checked) { el.checked = v.checked; el.dispatchEvent(new Event("change", { bubbles: true })); } continue; }
    if (el.value !== v) { el.value = v; if (el.tagName === "SELECT") el.dispatchEvent(new Event("change", { bubbles: true })); }
  }
}
export const moneyExact = (v) => Units.money(v, undefined, false, true);
export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
// 分类分三个空间：pantry 日常储备 / house 房屋耗材 / gear 装备（耐用品，只记数量和位置）
export const catsOf = (space, { withHidden = false } = {}) => CATEGORIES.filter((c) => c.space === space && (withHidden || !c.hidden));   // 隐藏的内置分类不出现在方块、芯片、下拉里
export const spaceOf = (catId) => CATEGORIES.find((c) => c.id === catId)?.space || "pantry";
export const inSpace = (space) => (it) => spaceOf(it.category) === space;
export const isGear = (it) => spaceOf(it.category) === "gear";
// 空间 → 对应列表页的路由 [section, sub]
export const listRoute = (space) => (space === "house" ? ["house", "supplies"] : space === "gear" ? ["pantry", "gear"] : ["pantry", "inventory"]);

// 日期（只到天，按本地时间）
/** 物品“不再提醒”的截止日；这个值 = 一直不提醒（直到下次补货入库或手动恢复） */
export const MUTE_FOREVER = "9999-12-31";
/** 今天起 n 天后的日期（本地日期，YYYY-MM-DD） */
export const daysFromTodayISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const daysUntil = (iso) => (iso ? Math.round((new Date(`${iso}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / DAY) : null);
export function addMonths(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/* ── 日期显示格式（设置 → 语言、地区与单位 → 日期格式）：全站的 fmtDate / fmtShort / fmtDateTime 都走这里；只存在这台设备上。
 * 默认 YYYY-MM-DD：不随排序 / 语言变化，年份永远在，不会把 03/04 看成 3 月 4 日还是 4 月 3 日。CSV / 数据库照旧用 ISO，不受影响。 */
export const DATE_FMTS = ["ymd", "mdy", "dmy", "cn", "auto"];
let dateFmt = "ymd";
try { const v = localStorage.getItem("hmh-datefmt"); if (DATE_FMTS.includes(v)) dateFmt = v; } catch { /* 忽略 */ }
export const dateFormat = () => dateFmt;
export function setDateFormat(v) {
  dateFmt = DATE_FMTS.includes(v) ? v : "ymd";
  try { dateFmt === "ymd" ? localStorage.removeItem("hmh-datefmt") : localStorage.setItem("hmh-datefmt", dateFmt); } catch { /* 忽略 */ }
}
const pad2 = (n) => String(n).padStart(2, "0");
/** 按用户选的格式显示一个日期（Date / 时间戳 / "YYYY-MM-DD"）；short = 不带年份（卡片上的“月/日”）；fmt 用来在设置里出示例 */
export function fmtDay(v, short = false, fmt = dateFmt) {
  if (v == null || v === "") return "";
  const x = v instanceof Date ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T12:00:00` : v);   // 只有日期的按本地中午，避免时区把日期挪一天
  if (Number.isNaN(x.getTime())) return "";
  const y = x.getFullYear(), m = x.getMonth() + 1, d = x.getDate();
  switch (fmt) {
    case "ymd": return short ? `${pad2(m)}-${pad2(d)}` : `${y}-${pad2(m)}-${pad2(d)}`;
    case "mdy": return short ? `${pad2(m)}/${pad2(d)}` : `${pad2(m)}/${pad2(d)}/${y}`;
    case "dmy": return short ? `${pad2(d)}/${pad2(m)}` : `${pad2(d)}/${pad2(m)}/${y}`;
    case "cn": return short ? `${m}月${d}日` : `${y}年${m}月${d}日`;
    default: return x.toLocaleDateString(locale(), short ? { month: "numeric", day: "numeric" } : { year: "numeric", month: "numeric", day: "numeric" });   // auto：跟随语言
  }
}
export const fmtDate = (iso) => fmtDay(iso);
// 记录的创建 / 更新时间（timestamptz）：卡片上显示“月/日”，悬停或编辑页显示完整时间
export const fmtShort = (iso) => fmtDay(iso, true);
export const fmtDateTime = (iso) => (iso ? `${fmtDay(iso)} ${new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}` : "");
export const stampText = (r) => [r?.created_at && t("添加于 {d}", { d: fmtDateTime(r.created_at) }), r?.updated_at && r.updated_at !== r.created_at && t("更新于 {d}", { d: fmtDateTime(r.updated_at) })].filter(Boolean).join(t("，"));

/** 同步状态只显示在设置页（顶栏小屏幕放不下）；设置页没打开时先记着，渲染时再读 */
export const syncState = { text: "", err: false, ok: false, onChange: null };
// ok：这一刻数据是同步好的（顶栏显示“家庭同步 · N 人”和绿点）；err：同步出错
export function setSync(text, err = false, ok = false) {
  syncState.text = text; syncState.err = err; syncState.ok = ok;
  const b = $("#syncBadge"); if (b) { b.textContent = text; b.classList.toggle("err", err); }
  if (syncState.onChange) syncState.onChange();
}

export function toast(msg) {
  const t = $("#toast"), parts = String(msg).split(/[；;]s*/).filter(Boolean);   // 「；」分开的几段各占一行，第一行是结论
  t.replaceChildren(...parts.map((p, i) => Object.assign(document.createElement("div"), { textContent: p, className: i ? "toast-line" : "toast-main" })));
  t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), Math.min(9000, 2600 + String(msg).length * 60));   // 字多的多停一会儿
}


/** 删除前的确认框（全应用统一，2026-11-04 用户定：所有删除按钮和左滑删除都弹确认框，和 收入 → 明细 一样）。
 *  用浏览器原生 confirm：左滑删除（js/swipe-rows.js）替行里的删除按钮点一下，再靠包住 window.confirm 判断用户有没有点取消（取消 = 行弹回去）。
 *  msg 写清楚删的是什么，例如「删除这笔花费？」；不传就用通用的一句。 */
export const confirmDelete = (msg) => window.confirm(`${msg || t("确认删除？")}\n${t("删了就找不回来。")}`);

// 两步确认：第一次点击变成“再点一次确认”，4 秒内再点才执行（替代浏览器 confirm 弹窗）。删除不要再用它，用上面的 confirmDelete
export function armed(el, text) {
  if (el.dataset.armed) return true;
  const old = el.textContent;
  el.dataset.armed = "1"; el.textContent = text;
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 4000);
  return false;
}

export function fillUnitList() { $("#unitList").innerHTML = Units.list().map((u) => `<option value="${esc(t(u))}">`).join(""); }
