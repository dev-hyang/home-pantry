import { Store } from "./store.js";
import { toast } from "./util.js";
import { t } from "./i18n.js";
import { pageSize } from "./pager.js";
import { cursorOf } from "./list-query.js";

/* ───────────── 服务器分页的列表（花费明细 / 账单付款 / 收入流水，迁移 054） ─────────────
 * 列表只留已经读到的几页（rows）；「继续加载」按上一页最后一行的排序键（cursor）向数据库要下一页，每页条数跟 pager.js 的设置走。
 * 筛选对象一变（序列化后比较）就回到第一页，同时读这组筛选的统计（合计、笔数、月小计…，SQL 一次聚合）；第一次还顺带读筛选框的选项（facets）。
 * 每次请求带序号，筛选连着改时晚到的旧结果直接丢掉。读失败弹提示（多半是迁移 054 没执行）。
 *   kind  = spend / pay / inc（对应 *_page / *_stats RPC）
 *   map   = 每行读回来后的整理（虚拟花费 id 加前缀等）；cursor 用的是整理前的原始行
 *   draw  = 数据到了之后重画列表（只重画列表那一块，不动筛选框，输入框不丢焦点）
 *   host  = 列表所在元素的选择器：不在页面上时，数据变了只记下「过期」，下次画的时候再读 */
export function serverList(kind, { map = (r) => r, draw, host }) {
  const L = { kind, sig: null, f: null, rows: [], after: null, hasMore: false, stats: null, facets: null, needFacets: false, busy: false, err: "", seq: 0 };
  const fail = (e) => {
    L.err = e?.message || String(e);
    toast(/could not find the function|schema cache|does not exist/i.test(L.err) ? t("读取列表失败：数据库还没升级，请先执行 supabase/migrations/054_server_paging.sql") : t("读取列表失败：{msg}", { msg: L.err }));
  };
  function take(raw, size) {
    const more = raw.length > size, page = more ? raw.slice(0, size) : raw;
    if (page.length) L.after = cursorOf(page.at(-1));
    L.rows = [...L.rows, ...page.map(map)]; L.hasMore = more;
  }
  async function first() {
    const seq = ++L.seq, f = L.f, size = pageSize(), wantFacets = !L.facets || L.needFacets;
    let changed = false;   // 筛选框的选项变了（第一次读到 / 有了新的年份、商店…）：调用方可以连筛选框一起重画
    Object.assign(L, { busy: true, rows: [], after: null, hasMore: false, stats: null, err: "", needFacets: false });
    try {
      const [raw, st] = await Promise.all([Store.listPage(kind, f, null, size), Store.listStats(kind, f, wantFacets)]);
      if (seq !== L.seq) return;
      take(raw || [], size); L.stats = st || {};
      if (st?.facets) { changed = JSON.stringify(st.facets) !== JSON.stringify(L.facets); L.facets = st.facets; }
    } catch (e) { if (seq === L.seq) fail(e); }
    finally { if (seq === L.seq) { L.busy = false; draw(changed); } }
  }
  /** 画列表前调用：筛选变了就回到第一页重读（异步，读完自己 draw）；返回列表状态 */
  L.sync = (f) => { const sig = JSON.stringify(f); if (sig !== L.sig) { L.sig = sig; L.f = f; first(); } return L; };
  /** 「继续加载」：读下一页接在后面 */
  L.more = async () => {
    if (L.busy || !L.hasMore || !L.f) return;
    const seq = L.seq, size = pageSize();
    L.busy = true; draw(false);
    try { const raw = await Store.listPage(kind, L.f, L.after, size); if (seq === L.seq) take(raw || [], size); }
    catch (e) { if (seq === L.seq) fail(e); }
    finally { if (seq === L.seq) { L.busy = false; draw(false); } }
  };
  /** 数据变了（实时同步 / 自己改了）：统计 + 第一页重读（顺带重读筛选框的选项）；列表不在页面上就只标记过期。连着几次变更合成一次 */
  let soon = null;
  L.reload = () => {
    L.needFacets = true;
    if (!L.f) return;
    if (host && !document.querySelector(host)) { L.sig = null; return; }
    clearTimeout(soon); soon = setTimeout(() => { L.sig = JSON.stringify(L.f); first(); }, 60);
  };
  /** 换页面 / 改了每页条数：下次画的时候回到第一页重读（不在这里发请求） */
  L.stale = () => { L.sig = null; };
  /** 按当前筛选把全部结果读出来（导出 / 打印用），每页 500 行，最多 max 行 */
  L.fetchAll = async (max = 20000) => {
    if (!L.f) return [];
    const out = []; let after = null;
    while (out.length < max) {
      const raw = (await Store.listPage(kind, L.f, after, 500)) || [], page = raw.slice(0, 500);
      out.push(...page.map(map)); if (raw.length <= 500 || !page.length) break;
      after = cursorOf(page.at(-1));
    }
    return out.slice(0, max);
  };
  return L;
}
