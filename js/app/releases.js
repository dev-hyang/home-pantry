/* 发布日志数据（200KB+）：只有「新版本提示」和发布日志页要用，空闲时或进发布日志页才加载。 */
import { APP_VERSION } from "../core/version.js";
import { href } from "../core/router.js";
import { initReleases } from "../core/releases-ui.js";
import { lang } from "../core/i18n.js";
import { render } from "./render.js";
import { state } from "../core/state.js";

/* 发布日志的数据 200KB+，只有「新版本提示」和发布日志页要用：不挡启动，空闲时再加载；加载完重画一次（今日页的提示、发布日志页） */
export let releasesReady = false, releasesLoading = null;
export function loadReleases() {
  return (releasesLoading ||= import("../releases-data.js").then(({ RELEASES }) => {
    initReleases({ version: APP_VERSION, releases: RELEASES, lang: () => lang, accent: "var(--pine)", appId: "home-pantry", open: `href="${href("me", "releases")}"` });
    releasesReady = true;
    if (state.enriched && (state.route?.section === "today" || (state.route?.section === "me" && state.route.sub === "releases"))) render(false);
  }).catch(() => { releasesLoading = null; }));
}
/** 「新版本」提示这台设备还会不会出现（读 releases-ui.js 记的 seen / shows）：不会了就不必为它去下载发布日志数据 */
export function releaseBadgePossible() {
  try {
    if (localStorage.getItem("home-pantry.rl.seen") === APP_VERSION) return false;
    const o = JSON.parse(localStorage.getItem("home-pantry.rl.shows") || "{}");
    return !(o.v === APP_VERSION && +o.n >= 5);
  } catch { return true; }
}
