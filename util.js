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
export const showQty = (q, unit) => `${fmt(toDisp(q, unit))} ${esc(du(unit) || "")}`.trim();
export const storedStep = (unit) => Units.step(du(unit)) / Units.factor(unit);
export const money = (v, short) => Units.money(v, undefined, !!short);
export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
// 分类分两个空间：pantry 厨房储藏 / house 房屋耗材
export const catsOf = (space) => CATEGORIES.filter((c) => c.space === space);
export const spaceOf = (catId) => CATEGORIES.find((c) => c.id === catId)?.space || "pantry";
export const inSpace = (space) => (it) => spaceOf(it.category) === space;

export function setSync(text, err = false) {
  const b = $("#syncBadge"); b.textContent = text; b.classList.toggle("err", err);
}

export function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}


// 两步确认：第一次点击变成“再点一次确认”，4 秒内再点才执行（替代浏览器 confirm 弹窗）
export function armed(el, text) {
  if (el.dataset.armed) return true;
  const old = el.textContent;
  el.dataset.armed = "1"; el.textContent = text;
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 4000);
  return false;
}

export function fillUnitList() { $("#unitList").innerHTML = Units.list().map((u) => `<option value="${esc(u)}">`).join(""); }
