/* 「我的」区域（我的首页、家里的数字、设置各分区、介绍、发布日志）统一的页头：[目录] 我的 / 页面 / 分区
 * 目录 = 嵌套目录（treePop）：设置下面是各个分区，打开就停在当前页；路径每一段都能点。
 * 成员 / 家人的详情仍带自己的面包屑（有人名，在 menu.js 的 crumb）。 */
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";
import { SETTING_SECTIONS } from "./settings-menu.js";

const secIcon = (s) => (s.icon === "__AI__" ? "✨" : s.icon);

export function meTree(r) {
  const sub = r?.sub || "menu", sec = r?.q?.get("sec") || "";
  const kids = SETTING_SECTIONS.map((s) => ({ label: t(s.name), icon: secIcon(s), href: `${href("me", "settings")}?sec=${s.id}`, current: sub === "settings" && sec === s.id }));
  return [{ label: t("我的首页"), icon: "👤", href: href("me"), current: sub === "menu" },
    { label: t("家里的数字"), icon: "📊", href: href("me", "stats"), current: sub === "stats" },
    { label: t("设置"), icon: "⚙️", href: href("me", "settings"), current: sub === "settings" && !sec, open: sub === "settings", children: kids },
    { label: t("介绍"), icon: "✎", href: href("me", "about"), current: sub === "about" },
    { label: t("发布日志"), icon: "📰", href: href("me", "releases"), current: sub === "releases" }];
}

/** 页头一行；路径：我的 / 页面（/ 设置分区） */
export function meHead(r) {
  const sub = r?.sub || "menu", sec = r?.q?.get("sec") || "", root = `<a class="h-root" href="${esc(href("me"))}">${t("我的")}</a>`;
  const NAME = { stats: "家里的数字", settings: "设置", about: "介绍", releases: "发布日志" };
  const s = sub === "settings" && sec ? SETTING_SECTIONS.find((x) => x.id === sec) : null;
  const path = sub === "menu" || !NAME[sub] ? t("我的")
    : s ? `${root} / <a class="h-root" href="${esc(href("me", "settings"))}">${t("设置")}</a> / <b aria-current="page">${esc(t(s.name))}</b>`
      : `${root} / <b aria-current="page">${esc(t(NAME[sub]))}</b>`;
  return `<div class="section-head fin-head sec-head"><div class="sh-title">${treePop(meTree(r), { id: "metree" })}<nav class="sec-path" aria-label="${esc(t("当前位置"))}">${path}</nav></div></div>`;
}
