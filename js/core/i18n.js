/* 多语言：简体（源码即键）/ 繁體（OpenCC 运行时转换）/ English（字典 js/i18n/en.js）
 * 用法：t("添加物品")；带参数 t("今天有 {n} 件事要留意", { n })；字典里没有的英文回落到简体。
 * 语言：自动按浏览器语言判断（zh-TW / zh-HK → 繁體，其余 zh → 简体，其它 → English），设置页可手动改。 */
import { EN } from "../i18n/en.js";

export const LANGS = { zh: "简体中文", "zh-Hant": "繁體中文", en: "English" };
const KEY = "hmh-lang";
let override = null;
try { override = localStorage.getItem(KEY); } catch { /* 忽略 */ }
if (override && !LANGS[override]) override = null;

export function detectLang() {
  const l = (navigator.language || "").toLowerCase();
  if (l.startsWith("zh")) return /tw|hk|mo|hant/.test(l) ? "zh-Hant" : "zh";
  return "en";
}
export let lang = override || detectLang();
export const langOverride = () => override;

/** 切换语言；繁體需要先加载转换库。返回 Promise，完成后由调用方重新渲染 */
export async function setLang(code) {
  override = LANGS[code] ? code : null;
  try { override ? localStorage.setItem(KEY, override) : localStorage.removeItem(KEY); } catch { /* 忽略 */ }
  lang = override || detectLang();
  applyLang();
  if (lang === "zh-Hant") await loadOpenCC();
}

export const locale = () => (lang === "en" ? "en-US" : lang === "zh-Hant" ? "zh-TW" : "zh-CN");
export const isZh = () => lang !== "en";
export function applyLang() { document.documentElement.lang = lang === "zh" ? "zh-CN" : lang === "zh-Hant" ? "zh-Hant" : "en"; }

/* ── 繁體：OpenCC（简体 → 台湾正体含用词），按需加载，失败则显示简体 ── */
let convert = null, loading = null;
const cache = new Map();
export function loadOpenCC() {
  if (convert || loading) return loading || Promise.resolve();
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/cn2t.js";
    s.onload = () => { try { convert = window.OpenCC.Converter({ from: "cn", to: "twp" }); } catch { convert = null; } resolve(); };
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return loading;
}
export const openccReady = () => !!convert;
function toHant(s) {
  if (!convert) return s;
  let v = cache.get(s);
  if (v == null) { v = convert(s); cache.set(s, v); }
  return v;
}

/* ── 家庭自己起的名字（自定义位置、分类、小类）在其他语言下怎么叫：custom_terms 表，加载数据后 setGlossary 装进来 ──
 * 行：{ term, zh, en, hant }，term 是存在数据里的原字符串（可能是中文也可能是英文），t() 先查这里再查内置字典 */
let glossary = new Map();
export function setGlossary(rows) { glossary = new Map((rows || []).map((r) => [r.term, r])); }
export const glossaryOf = (term) => glossary.get(term) || null;

/** 翻译一条文案；params 替换 {name} 占位符 */
export function t(zh, params) {
  if (zh == null || zh === "") return "";
  let s = String(zh);
  const g = glossary.size ? glossary.get(s) : null;
  if (lang === "en") { if (g?.en) s = g.en; else { const e = EN[s]; if (e != null) s = e; } }
  else if (lang === "zh-Hant") s = g?.hant || toHant(g?.zh || s);
  else if (g?.zh) s = g.zh;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** 中文里的顿号列表在英文里用逗号 */
export const joinList = (arr) => arr.join(lang === "en" ? ", " : "、");
/** 本地化排序 */
export const compare = (a, b) => String(a).localeCompare(String(b), lang === "en" ? "en" : "zh");

// 非模块脚本（charts.js、units.js、data）也能用
window.__t = t;
window.__lang = () => lang;
applyLang();
