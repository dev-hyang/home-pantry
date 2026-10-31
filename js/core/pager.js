import { t } from "./i18n.js";

/* ───────────── 列表分批显示（「继续加载」） ─────────────
 * 全站一个「每页条数」设置（5 / 10 / 20 / 50），存在本机（localStorage hmh-page-size），不同设备可以不一样；
 * 没设过：手机 10、电脑 20。筛选 / 排序 / 小计都按完整的筛选结果算，只是画的时候截前 N 行，不另加「共 N 条」。 */
export const PAGE_SIZES = [5, 10, 20, 50];
const KEY = "hmh-page-size";
const phone = () => { try { return window.matchMedia("(max-width: 640px)").matches; } catch { return false; } };
export function pageSize() {
  try { const v = +localStorage.getItem(KEY); if (PAGE_SIZES.includes(v)) return v; } catch { /* 忽略 */ }
  return phone() ? 10 : 20;
}
export function setPageSize(n) {
  try { if (PAGE_SIZES.includes(+n)) localStorage.setItem(KEY, String(+n)); else localStorage.removeItem(KEY); } catch { /* 忽略 */ }
  resetPages();
}

/* 没有自带分页状态的列表：按 key 记已显示几行；sig（筛选、搜索、排序、所在页面拼成的字符串）一变就回到一页 */
const pages = new Map();
export function pageLimit(key, sig = "") {
  const p = pages.get(key);
  if (p && p.sig === sig) return p.n;
  const n = pageSize(); pages.set(key, { sig, n }); return n;
}
export function pageMore(key) { const p = pages.get(key); if (p) p.n += pageSize(); }
/** 换页面 / 改每页条数：全部回到一页 */
export function resetPages() { pages.clear(); }

/** 「继续加载」按钮：more 为真才画；attrs = 按钮上的 data-*（默认走 main.js 的 page-more） */
export const moreBtn = (more, attrs) => (more ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-ghost" ${attrs}>${t("继续加载")}</button></div>` : "");
export const pageMoreBtn = (key, total, shown) => moreBtn(total > shown, `data-action="page-more" data-page="${key}"`);

/** 搜索框防抖：连续输入停下 ~200ms 再重画 */
export function debounce(fn, ms = 200) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }
