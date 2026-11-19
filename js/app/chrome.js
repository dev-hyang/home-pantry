/* 页面外框：顶栏站名 / 导航文字、语言切换、应用切换。 */
import { $ } from "../core/util.js";
import { APP_VERSION } from "../core/version.js";
import { LANGS, lang, t } from "../core/i18n.js";
import { SECTIONS } from "../core/router.js";
import { changeLang } from "./page-events.js";
import { mountAppSwitcher } from "../../shared/app-switcher.js";
import { mountLangSwitcher } from "../../shared/lang-switcher.js";
import { updateMiniBar } from "../minibar.js";

export const APP_NAME = "爱家小助手";
/** 顶部导航、站名按当前语言写入（index.html 里是简体默认值） */
export function applyChrome() {
  document.querySelectorAll("#tabs a[data-section]").forEach((a) => {
    const textNode = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = t(SECTIONS[a.dataset.section]?.name || textNode.textContent.trim());
  });
  const title = $("#appTitle"); if (title) title.textContent = t(APP_NAME);
  if (title) updateMiniBar(title.textContent, t("回到顶部"));
  $("#tabs").setAttribute("aria-label", t("主导航"));
  renderAppSwitch();
  renderLangSwitch();
}
/* 顶栏右上角的语言切换（登录页也显示）：一个按钮，点开是列表（宽屏浮层 / 手机底部抽屉），以后加语言只要在 LANGS 里加一项；和 设置 → 语言 存同一个值 */
export const uiKind = () => (lang === "en" ? "en" : lang === "zh-Hant" ? "tw" : "zh");
function renderLangSwitch() {
  const ver = $("#appVer"); if (ver) { ver.textContent = "v" + APP_VERSION; ver.setAttribute("aria-label", `${t("发布日志")} · v${APP_VERSION}`); ver.title = t("发布日志"); }   // 版本号放在顶栏，点一下进 我的 → 发布日志
  mountLangSwitcher({ host: $("#langSwitch"), languages: Object.entries(LANGS).map(([code, name]) => ({ code, name })), current: lang, ui: uiKind(), onSelect: (code) => changeLang(code) });
}
/* ───────────── 应用切换：顶栏右侧九宫格按钮，宽屏浮层 / 窄屏底部抽屉；名单在 shared/apps.json（四个站点共用） ───────────── */
const APP_ID = "home-pantry";
export const sisterApps = () => window.SISTER_APPS || [];
function renderAppSwitch() {
  const box = $("#apps"); if (!box) return;
  mountAppSwitcher({ host: box, current: APP_ID, lang, onApps: (fresh) => { window.SISTER_APPS = fresh.map(toSister); } });
}
// 共享名单的格式 → 设置页、介绍页、“我的”目录用的旧格式（name / short / sub 按当前语言取）
const toSister = (a) => ({ id: a.id, icon: a.icon, url: a.url, name: a.name?.zh || a.name, short: a.short?.zh || a.name?.zh || a.name, sub: a.sub?.zh || a.sub || "" });
