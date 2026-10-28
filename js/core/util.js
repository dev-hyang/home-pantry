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
export const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), { year: "numeric", month: "numeric", day: "numeric" }) : "");
// 记录的创建 / 更新时间（timestamptz）：卡片上显示“月/日”，悬停或编辑页显示完整时间
export const fmtShort = (iso) => (iso ? new Date(iso).toLocaleDateString(locale(), { month: "numeric", day: "numeric" }) : "");
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(locale(), { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
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


// 两步确认：第一次点击变成“再点一次确认”，4 秒内再点才执行（替代浏览器 confirm 弹窗）
export function armed(el, text) {
  if (el.dataset.armed) return true;
  const old = el.textContent;
  el.dataset.armed = "1"; el.textContent = text;
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 4000);
  return false;
}

export function fillUnitList() { $("#unitList").innerHTML = Units.list().map((u) => `<option value="${esc(t(u))}">`).join(""); }
