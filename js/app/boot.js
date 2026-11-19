/* 启动：按配置选云端 / 演示模式，读完数据后第一次渲染。 */
import { $, esc, fillUnitList, setSync, toast } from "../core/util.js";
import * as Backup from "../core/backup.js";
import { CloudStore, DemoStore, setStore } from "../core/store.js";
import { JOIN_MSG, afterLogin, joinOutcome } from "./auth/household.js";
import { applyAllRoute } from "../bills/all-views.js";
import { applyChrome } from "./chrome.js";
import { applyOverviewRoute, loadOverviewRange } from "../bills/overview-views.js";
import { checkConfig } from "../core/config-check.js";
import { lang, loadEN, loadOpenCC, t } from "../core/i18n.js";
import { loadReleases, releaseBadgePossible } from "./releases.js";
import { parseRoute } from "../core/router.js";
import { refresh, refreshSoon } from "./data.js";
import { render } from "./render.js";
import { renderLogin } from "./auth/login.js";
import { resilientFetch } from "../core/net.js";
import { state } from "../core/state.js";

/* ───────────── 启动 ───────────── */
export async function boot() {
  Backup.initProviders(toast);   // 从 Dropbox 授权页跳回来时把 ?code= 换成令牌，再跳到备份页
  window.__hmhBooted = true;   // 告诉 index.html 的启动自检：主脚本已经运行
  try { sessionStorage.removeItem("hmh-boot-retry"); } catch (e) { /* 忽略 */ }   // 起来了：下次再起不来还可以自动重拉一次
  // 发布日志（js/core/releases-ui.js，四个姊妹应用共用）：记这台设备「新版本」提示出现几次；今日页顶上画提示，我的 → 发布日志 是整页
  if (releaseBadgePossible()) (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => loadReleases(), { timeout: 4000 });   // 提示不会再出现就不加载；发布日志页自己按需加载
  if (lang === "en") await loadEN();   // 英文字典按需加载：先拉下来再渲染，避免先中文后英文闪一下
  document.addEventListener("i18n-loaded", () => { if (state.enriched && lang !== "en") render(false); });   // 简体 / 繁體界面碰到英文名字时才加载字典，加载完重画
  if (lang === "zh-Hant") await loadOpenCC();   // 繁體：先把转换库拉下来再渲染，避免先简后繁闪一下
  applyChrome();
  fillUnitList();
  document.addEventListener("budget-saved", () => render());
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.enriched) refreshSoon(null); });
  // 跨过手机 / 宽屏分界（旋转 iPad、拖窗口）：库存页在方块仪表盘和分类导航之间切换
  window.matchMedia("(max-width: 640px)").addEventListener("change", () => { const r = state.route; if (state.enriched && ((r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear")))) render(true); });

  const cfg = checkConfig();
  state.configIssue = cfg.issue || null;
  if (cfg.mode === "blocked") {
    setSync(t("配置有安全问题"), true);
    $("#main").innerHTML = `<div class="panel" role="alert" style="border:2px solid var(--out)"><b>${t("已停止连接云端")}</b><p>${esc(t(cfg.issue))}</p></div>`;
    return;
  }
  if (cfg.mode === "cloud") {
    if (!window.supabase) { setSync(t("云端库加载失败"), true); return toast(t("无法加载 Supabase SDK，请检查网络后刷新")); }
    setStore(CloudStore);
    CloudStore.sb = window.supabase.createClient(cfg.url, cfg.key, { global: { fetch: resilientFetch } });   // 读取 15 秒不回应就重发，不再无限转圈
    let started = false;
    const start = async (session) => {
      if (started || !session) return;
      started = true; state.user = session.user;
      // 邀请码直接进入：匿名登录成功后先加入家庭，再走正常流程
      if (state.pendingJoin) {
        const { code, name } = state.pendingJoin; state.pendingJoin = null;
        const { data, error } = await CloudStore.sb.rpc("join_household", { p_code: code, p_display_name: name });
        const o = error ? null : joinOutcome(data);
        if (error || JOIN_MSG[o.status]) {
          started = false;
          await CloudStore.sb.auth.signOut();   // 加入失败就不保留这个匿名身份
          return renderLogin(error ? (error.message.includes("invalid") ? t("邀请码不正确，请向家主确认。") : t("加入失败：{msg}", { msg: error.message })) : t(JOIN_MSG[o.status]));
        }
        if (o.hid) localStorage.setItem("hmh-hid", o.hid);
      }
      afterLogin();
    };
    CloudStore.sb.auth.onAuthStateChange((evt, session) => {
      if (evt === "SIGNED_IN") start(session);
      if (evt === "SIGNED_OUT") { started = false; if (!state.pendingJoin) renderLogin(); }
    });
    const { data: { session } } = await CloudStore.sb.auth.getSession();
    state.route = parseRoute(); loadOverviewRange(); applyOverviewRoute(state.route); applyAllRoute(state.route);   // 直接打开 / 刷新带条件的「全部账单」网址（卡片链接、书签）
    if (session) start(session); else renderLogin();
  } else {
    setStore(DemoStore);
    DemoStore.load();
    state.displayName = DemoStore.members().find((m) => m.user_id === "me")?.display_name || state.displayName;   // 演示：在资料页改过的称呼
    state.household = { name: t("演示家庭（数据仅存于本浏览器）") };
    state.route = parseRoute(); loadOverviewRange(); applyOverviewRoute(state.route); applyAllRoute(state.route);
    await refresh();
  }
}
