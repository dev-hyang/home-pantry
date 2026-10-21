/* 应用切换器：四个姊妹站点（小月亮 / 学堂 / 爱家小助手 / 牧羊人）共用的顶栏入口。
 *
 * 位置：顶栏右侧一个“九宫格”按钮（Google Workspace 的做法）。标题本身留给各站自己的用途——
 * 小月亮、学堂点标题是切换孩子，所以应用切换不能占用标题。
 * 外观：宽屏是按钮下方的浮层，窄屏（≤ 440px，iPhone Pro Max 宽度）是底部抽屉。
 * 数据：shared/apps.json 是唯一名单（固定顺序）；先用缓存 / 内置兜底立刻显示，后台再取最新的，取不到也不影响使用。
 * 同一个 github.io 域名下各站同源，名单缓存键带 ecosys 前缀，各站共用。
 *
 * 接入（任何站点）：
 *   import { mountAppSwitcher } from "https://dev-hyang.github.io/home-pantry/shared/app-switcher.js";
 *   mountAppSwitcher({ host: document.getElementById("apps"), current: "baby-log", lang: "zh" | "tw" | "en" });
 * 换语言后再调一次即可（会替换上一次的内容）。 */

const REGISTRY_URL = "https://dev-hyang.github.io/home-pantry/shared/apps.json";
const CACHE_KEY = "ecosys.apps.v1";
const FALLBACK = [
  { id: "baby-log", icon: "🌙", url: "https://dev-hyang.github.io/baby-log/", name: { zh: "小月亮", tw: "小月亮", en: "Little Moon" }, sub: { zh: "母婴记录", tw: "母嬰記錄", en: "Baby log" } },
  { id: "homeschool", icon: "📚", url: "https://dev-hyang.github.io/homeschool/", name: { zh: "家庭学堂", tw: "家庭學堂", en: "Family Homeschool" }, sub: { zh: "在家教育", tw: "在家教育", en: "Homeschooling" } },
  { id: "home-pantry", icon: "🥫", url: "https://dev-hyang.github.io/home-pantry/", name: { zh: "爱家小助手", tw: "愛家小助手", en: "Loving Home Helper" }, sub: { zh: "储藏 · 房屋 · 账单", tw: "儲藏 · 房屋 · 帳單", en: "Pantry · home · bills" } },
  { id: "shepherd", icon: "🐑", url: "https://dev-hyang.github.io/shepherd/", name: { zh: "牧羊人", tw: "牧羊人", en: "Shepherd" }, sub: { zh: "身心灵记录", tw: "身心靈記錄", en: "Body, mind & spirit" } },
];
const TEXT = {
  zh: { open: "切换应用", title: "切换应用", close: "关闭", current: "当前" },
  tw: { open: "切換應用", title: "切換應用", close: "關閉", current: "目前" },
  en: { open: "Switch app", title: "Switch app", close: "Close", current: "Current" },
};
const CSS = `
.eco-sw { position: relative; display: inline-flex; }
.eco-sw-btn { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; color: var(--ink, #1e3a32); }
.eco-sw-btn:hover, .eco-sw-btn[aria-expanded="true"] { background: var(--surface-2, var(--bg, #e3ebe4)); }
.eco-sw-btn:focus-visible, .eco-sw-row:focus-visible, .eco-sw-close:focus-visible { outline: 3px solid var(--focus, #1f6feb); outline-offset: 2px; }
.eco-sw-grid { display: grid; grid-template-columns: repeat(3, 5px); gap: 3px; }
.eco-sw-grid i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.eco-sw-panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 1000; width: min(320px, 92vw); padding: 8px; background: var(--surface, #fff); color: var(--ink, #1e3a32); border: 1px solid var(--line, #cfdcd2); border-radius: 16px; box-shadow: 0 12px 32px rgba(0, 0, 0, .18); }
.eco-sw-panel[hidden], .eco-sw-scrim[hidden] { display: none; }
.eco-sw-head { display: none; align-items: center; justify-content: space-between; padding: 4px 8px 8px; }
.eco-sw-head b { font-size: 16px; }
.eco-sw-close { all: unset; box-sizing: border-box; cursor: pointer; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 20px; }
.eco-sw-list { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.eco-sw-row { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 10px; border-radius: 12px; }
.eco-sw-row:hover, .eco-sw-row[aria-current="true"] { background: var(--surface-2, var(--bg, #e3ebe4)); }
.eco-sw-ico { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: var(--bg, #eef3ee); font-size: 22px; }
.eco-sw-txt { flex: 1 1 auto; min-width: 0; display: grid; }
.eco-sw-txt b { font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eco-sw-txt small { font-size: 13px; color: var(--muted, #55695f); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eco-sw-now { flex: 0 0 auto; font-size: 12px; font-weight: 700; color: var(--pine, var(--slate, #2c6a57)); }
.eco-sw-scrim { position: fixed; inset: 0; z-index: 999; background: rgba(0, 0, 0, .4); }
@media (max-width: 440px) {
  .eco-sw { position: static; }
  .eco-sw-panel { position: fixed; top: auto; left: 0; right: 0; bottom: 0; width: auto; border-radius: 20px 20px 0 0; border-width: 1px 0 0; padding: 8px 12px calc(12px + env(safe-area-inset-bottom)); animation: eco-sw-up .2s ease-out; }
  .eco-sw-head { display: flex; }
}
@keyframes eco-sw-up { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .eco-sw-panel { animation: none; } }
`;

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);
const pick = (o, k) => (o && typeof o === "object" ? o[k] || o.zh || "" : o || "");
const kindOf = (lang) => (lang === "en" ? "en" : lang === "tw" || /^zh-(Hant|TW|HK)/i.test(lang || "") ? "tw" : "zh");
const readCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return Array.isArray(c?.apps) && c.apps.length ? c.apps : null; } catch { return null; } };
// 只接受自家域名的地址：名单被改坏也不会把人带到别处
const validApp = (a) => !!a && typeof a.id === "string" && /^https:\/\/dev-hyang\.github\.io\//.test(a.url || "") && !!a.name;

/** 取最新名单：成功就写缓存并返回；失败返回 null（调用方继续用现有的）。固定顺序 = 文件里的顺序 */
export async function loadApps() {
  try {
    const r = await fetch(REGISTRY_URL, { cache: "no-cache" }); if (!r.ok) return null;
    const apps = ((await r.json()).apps || []).filter(validApp); if (!apps.length) return null;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), apps })); } catch { /* 忽略 */ }
    return apps;
  } catch { return null; }
}

let cssDone = false, openCleanup = null;
export function mountAppSwitcher({ host, current, lang = "zh", apps = null, onApps = null }) {
  if (!host) return;
  if (!cssDone) { const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }
  const k = kindOf(lang), tx = TEXT[k];
  const list = (apps || readCache() || FALLBACK).filter(validApp);
  if (list.length < 2) { host.innerHTML = ""; return; }
  const key = `${current}|${k}|${JSON.stringify(list)}`;
  if (host.dataset.ecoKey === key && host.firstChild) return;   // 内容没变就不重画：各站每次刷新页面都会调用，别把打开着的面板关掉
  host.dataset.ecoKey = key;
  openCleanup?.(); openCleanup = null;
  const row = (a) => {
    const here = a.id === current, label = `${pick(a.name, k)}${here ? `（${tx.current}）` : ""}，${pick(a.sub, k)}`;
    return `<li><a class="eco-sw-row" href="${esc(a.url)}" ${here ? 'aria-current="true"' : ""} aria-label="${esc(label)}">
      <span class="eco-sw-ico" aria-hidden="true">${esc(a.icon || "•")}</span>
      <span class="eco-sw-txt"><b>${esc(pick(a.name, k))}</b><small>${esc(pick(a.sub, k))}</small></span>
      ${here ? `<span class="eco-sw-now" aria-hidden="true">✓ ${esc(tx.current)}</span>` : ""}</a></li>`;
  };
  host.innerHTML = `<span class="eco-sw">
    <button type="button" class="eco-sw-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(tx.open)}" title="${esc(tx.open)}"><span class="eco-sw-grid" aria-hidden="true">${"<i></i>".repeat(9)}</span></button>
    <div class="eco-sw-scrim" hidden></div>
    <div class="eco-sw-panel" role="dialog" aria-modal="true" aria-label="${esc(tx.title)}" hidden>
      <div class="eco-sw-head"><b>${esc(tx.title)}</b><button type="button" class="eco-sw-close" aria-label="${esc(tx.close)}">✕</button></div>
      <ul class="eco-sw-list">${list.map(row).join("")}</ul></div></span>`;
  const btn = host.querySelector(".eco-sw-btn"), panel = host.querySelector(".eco-sw-panel"), scrim = host.querySelector(".eco-sw-scrim");
  const rows = () => [...panel.querySelectorAll(".eco-sw-row")];
  const close = (refocus = true) => {
    panel.hidden = true; scrim.hidden = true; btn.setAttribute("aria-expanded", "false");
    openCleanup?.(); openCleanup = null; if (refocus) btn.focus();
  };
  const open = () => {
    openCleanup?.();
    panel.hidden = false; scrim.hidden = false; btn.setAttribute("aria-expanded", "true");
    (rows().find((r) => r.getAttribute("aria-current")) || rows()[0])?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") {   // 焦点只在面板里转
        const items = [...rows(), panel.querySelector(".eco-sw-close")].filter((x) => x && x.offsetParent !== null), i = items.indexOf(document.activeElement);
        if (items.length && e.shiftKey && i <= 0) { e.preventDefault(); items.at(-1).focus(); } else if (items.length && !e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); const r = rows(), i = r.indexOf(document.activeElement); r[(i + (e.key === "ArrowDown" ? 1 : -1) + r.length) % r.length]?.focus();
      }
    };
    const onDoc = (e) => { if (!panel.contains(e.target) && !btn.contains(e.target)) close(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("pointerdown", onDoc, true);
    openCleanup = () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDoc, true); };
  };
  btn.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.querySelector(".eco-sw-close").addEventListener("click", () => close());
  panel.addEventListener("click", (e) => { if (e.target.closest("a[aria-current]")) { e.preventDefault(); close(); } });   // 点当前应用：只关闭
  // 后台取最新名单：和现有的不同才重画一次
  if (!apps) loadApps().then((fresh) => { if (fresh && JSON.stringify(fresh) !== JSON.stringify(list)) { onApps?.(fresh); mountAppSwitcher({ host, current, lang, apps: fresh, onApps }); } });
}
