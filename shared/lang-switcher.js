/* 语言切换器：四个姊妹站点共用的顶栏入口（地球图标 + 当前语言简称）。
 *
 * 为什么不用“简体 | 繁體 | EN”并排按钮：语言只有 3 个时还行，再多就放不下顶栏。这里是一个按钮，点开是列表：
 * 宽屏浮层、窄屏（≤ 440px）底部抽屉，和应用切换器同一套外观；每行用该语言自己的文字写名字（日本語、한국어…），
 * 带 lang 属性；语言超过 8 个时自动出现搜索框。以后加语言：在各站的 languages 里加一项即可，这里不用改。
 *
 * 接入：
 *   import { mountLangSwitcher } from "https://dev-hyang.github.io/home-pantry/shared/lang-switcher.js";
 *   mountLangSwitcher({ host, languages: [{ code: "zh-CN", name: "简体中文", short: "简" }, …], current: "zh-CN", onSelect: (code) => {…重画页面…}, ui: "zh" | "tw" | "en" });
 * onSelect 里换完语言后再调一次 mountLangSwitcher（更新选中项和按钮简称）。 */
import { ensureStyles } from "./app-switcher.js";

// 常见语言的本族文字名称和简称：各站只传 code 也能用；站点自己传了 name / short 就以站点的为准
export const LANGUAGE_NAMES = {
  "zh-CN": ["简体中文", "简"], zh: ["简体中文", "简"], "zh-TW": ["繁體中文", "繁"], "zh-Hant": ["繁體中文", "繁"],
  en: ["English", "EN"], ja: ["日本語", "日"], ko: ["한국어", "한"], es: ["Español", "ES"], fr: ["Français", "FR"], de: ["Deutsch", "DE"],
  pt: ["Português", "PT"], it: ["Italiano", "IT"], ru: ["Русский", "RU"], vi: ["Tiếng Việt", "VI"], th: ["ไทย", "TH"], id: ["Bahasa Indonesia", "ID"], ar: ["العربية", "AR"], hi: ["हिन्दी", "HI"],
};
const TEXT = {
  zh: { open: "切换语言", title: "语言 / Language", close: "关闭", search: "搜索语言", none: "没有匹配的语言" },
  tw: { open: "切換語言", title: "語言 / Language", close: "關閉", search: "搜尋語言", none: "沒有符合的語言" },
  en: { open: "Change language", title: "Language", close: "Close", search: "Search languages", none: "No matching language" },
};
const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);
const GLOBE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';
let cleanup = null;

export function mountLangSwitcher({ host, languages, current, onSelect, ui = "zh" }) {
  if (!host) return;
  ensureStyles();
  const tx = TEXT[ui] || TEXT.zh;
  const list = (languages || []).map((l) => {
    const known = LANGUAGE_NAMES[l.code] || [];
    return { code: l.code, name: l.name || known[0] || l.code, short: l.short || known[1] || String(l.code).slice(0, 2).toUpperCase(), sub: l.sub || "" };
  });
  if (list.length < 2) { host.innerHTML = ""; return; }
  const key = `${current}|${ui}|${JSON.stringify(list)}`;
  if (host.dataset.ecoKey === key && host.firstChild) return;   // 没变就不重画，别把打开的面板关掉
  host.dataset.ecoKey = key;
  cleanup?.(); cleanup = null;
  const cur = list.find((l) => l.code === current) || list[0];
  const searchable = list.length > 8;
  const row = (l) => `<li><button type="button" class="eco-sw-row eco-lg-row" role="menuitemradio" aria-checked="${l.code === cur.code}" data-code="${esc(l.code)}" lang="${esc(l.code)}" data-q="${esc(`${l.name} ${l.code} ${l.sub}`.toLowerCase())}">
      <span class="eco-sw-txt"><b>${esc(l.name)}</b>${l.sub ? `<small>${esc(l.sub)}</small>` : ""}</span>
      ${l.code === cur.code ? '<span class="eco-sw-now" aria-hidden="true">✓</span>' : ""}</button></li>`;
  host.innerHTML = `<span class="eco-sw">
    <button type="button" class="eco-sw-btn eco-lg-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(tx.open)}：${esc(cur.name)}" title="${esc(tx.open)}">${GLOBE}<span>${esc(cur.short)}</span></button>
    <div class="eco-sw-scrim" hidden></div>
    <div class="eco-sw-panel" role="dialog" aria-modal="true" aria-label="${esc(tx.title)}" hidden>
      <div class="eco-sw-head"><b>${esc(tx.title)}</b><button type="button" class="eco-sw-close" aria-label="${esc(tx.close)}">✕</button></div>
      ${searchable ? `<input type="search" class="eco-lg-search" placeholder="${esc(tx.search)}" aria-label="${esc(tx.search)}">` : ""}
      <ul class="eco-sw-list eco-lg-list" role="menu">${list.map(row).join("")}</ul>
      ${searchable ? `<p class="eco-lg-none" hidden style="margin:8px;font-size:13px;color:var(--muted,#55695f)">${esc(tx.none)}</p>` : ""}</div></span>`;
  const btn = host.querySelector(".eco-lg-btn"), panel = host.querySelector(".eco-sw-panel"), scrim = host.querySelector(".eco-sw-scrim");
  const search = host.querySelector(".eco-lg-search");
  const rows = () => [...panel.querySelectorAll(".eco-lg-row")].filter((r) => !r.parentElement.hidden);
  const close = (refocus = true) => { panel.hidden = true; scrim.hidden = true; btn.setAttribute("aria-expanded", "false"); cleanup?.(); cleanup = null; if (refocus) btn.focus(); };
  const open = () => {
    cleanup?.();
    panel.hidden = false; scrim.hidden = false; btn.setAttribute("aria-expanded", "true");
    if (search) { search.value = ""; filter(""); search.focus(); } else (rows().find((r) => r.getAttribute("aria-checked") === "true") || rows()[0])?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") {
        const items = [search, ...rows(), panel.querySelector(".eco-sw-close")].filter((x) => x && x.offsetParent !== null), i = items.indexOf(document.activeElement);
        if (items.length && e.shiftKey && i <= 0) { e.preventDefault(); items.at(-1).focus(); } else if (items.length && !e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); const r = rows(), i = r.indexOf(document.activeElement);
        r[(i + (e.key === "ArrowDown" ? 1 : -1) + r.length) % r.length]?.focus();
      }
    };
    const onDoc = (e) => { if (!panel.contains(e.target) && !btn.contains(e.target)) close(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("pointerdown", onDoc, true);
    cleanup = () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDoc, true); };
  };
  function filter(q) {
    const s = q.trim().toLowerCase(); let n = 0;
    panel.querySelectorAll(".eco-lg-row").forEach((r) => { const hide = !!s && !r.dataset.q.includes(s); r.parentElement.hidden = hide; if (!hide) n++; });
    const none = panel.querySelector(".eco-lg-none"); if (none) none.hidden = n > 0;
  }
  search?.addEventListener("input", () => filter(search.value));
  btn.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.querySelector(".eco-sw-close").addEventListener("click", () => close());
  panel.addEventListener("click", (e) => {
    const r = e.target.closest(".eco-lg-row"); if (!r) return;
    close(false);
    if (r.dataset.code !== cur.code) onSelect?.(r.dataset.code);
  });
}
