/* 更新记录（什么时候、怎么录的、哪几家、加了几条、失败原因）和给每周定时任务用的入口。 */
import { FOCUS_SECTIONS, adUrl, chainOf, dealsDue, flippUrl, importGroups, myItemNames, parseLooseJson, restockWatch, savedZip, weekWindow } from "./logic.js";
import { R, applyDeals, logRun, shopById } from "./shops-actions.js";
import { crumbNav } from "../core/hub.js";
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { loadShops } from "./lite.js";
import { state } from "../core/state.js";
import { DOW, shopHref, ui } from "./shops-common.js";

/* ───────────── 更新记录（迁移 068）：什么时候、怎么录的、哪几家、加了几条、失败原因 ───────────── */
const RUN_SRC = { auto: ["🤖", "每周自动更新"], claude: ["🧩", "Claude 整理导入"], photo: ["📷", "拍广告 / 截图"], paste: ["📋", "粘贴文字"], manual: ["✍️", "手动"] };
const RUN_ST = { ok: ["tag-ok", "成功"], partial: ["tag-warn", "部分失败"], failed: ["tag-hot", "失败"] };
export function viewRuns() {
  const u = ui(), lf = (u.log ||= { src: "", shop: "" });
  const runs = (state.dealRuns || []).filter((r) => (!lf.src || r.source === lf.src) && (!lf.shop || (r.stores || []).some((x) => x.shop_id === lf.shop)));
  const autos = (state.shops || []).filter((x) => !x.archived && x.auto_update && x.refresh === "weekly");
  const lastAuto = (state.dealRuns || []).find((r) => r.source === "auto");
  const opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  return `<section class="section shops-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }, { label: t("更新记录"), icon: "📜" }])}
    ${state.runsMissing ? `<div class="panel cta-panel"><div><b>${t("数据库还没升级")}</b><p class="muted">${t("请在 Supabase 的 SQL Editor 执行 migrations/068_shop_deal_runs.sql，才能记录每次更新、打开每周自动更新。")}</p></div></div>` : ""}
    <div class="panel runs-auto">
      <b>🤖 ${t("每周自动更新")}</b>
      <p class="muted">${autos.length ? t("Claude 定时任务每天早上 10 点看一次，到了换广告日就更新这家：{names}", { names: autos.map((x) => `${esc(x.name)}（${t(DOW[x.refresh_dow ?? 3])}）`).join("、") }) : t("还没有商店打开「换广告那天自动更新」。在商店的编辑里打开（只对每周换广告的商店）。")}</p>
      <p class="muted">${lastAuto ? t("上次自动更新：{d}", { d: fmtWhen(lastAuto.run_at) }) : t("还没有自动更新过。")} · ${t("电脑要开着、Chrome 要开着并登录爱家小助手，任务才能跑。")}</p>
    </div>
    <div class="toolbar shops-toolbar">
      <select data-run-src data-nosearch aria-label="${esc(t("按方式筛选"))}">${opt("", t("全部方式"), lf.src)}${Object.entries(RUN_SRC).map(([k, [i, l]]) => opt(k, `${i} ${t(l)}`, lf.src)).join("")}</select>
      <select data-run-shop data-nosearch aria-label="${esc(t("按商店筛选"))}">${opt("", t("全部商店"), lf.shop)}${(state.shops || []).map((x) => opt(x.id, x.name, lf.shop)).join("")}</select>
    </div>
    ${runs.length ? `<ul class="run-list">${runs.map((r) => {
      const [ic, sl] = RUN_SRC[r.source] || ["•", r.source], [cls, stl] = RUN_ST[r.status] || RUN_ST.ok;
      return `<li class="panel run-row"><div class="run-top"><b>${ic} ${t(sl)}</b><span class="tag ${cls}">${t(stl)}</span><span class="muted run-at">${fmtWhen(r.run_at)}</span></div>
        <ul class="run-stores">${(r.stores || []).map((x) => `<li>${x.shop_id && shopById(x.shop_id) ? `<a href="${shopHref(shopById(x.shop_id))}">${esc(x.name)}</a>` : esc(x.name || "?")}
          ${x.error ? `<span class="run-err">✕ ${esc(x.error)}</span>` : `<span class="muted">${t("加了 {n} 条", { n: x.added ?? 0 })}${x.replaced ? ` · ${t("替换 {m} 条", { m: x.replaced })}` : ""}</span>`}</li>`).join("")}</ul>
        ${r.note ? `<p class="muted run-note">${esc(r.note)}</p>` : ""}</li>`;
    }).join("")}</ul>` : `<p class="muted shops-empty">${t("还没有更新记录。以后每次录入特价（自动、导入、拍照、手动）都会记在这里。")}</p>`}
  </section>`;
}
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "zh-CN", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
/* ───────────── 给每周定时任务（Claude Code 的 /pantry-deals auto）用的入口 ─────────────
 * 定时任务在已登录的爱家小助手标签页里调用：
 *   await hmhDeals.autoShops()          → 打开了自动更新、而且到了换广告日还没更新的商店（dealsDue；定时任务每天跑，周日换广告的周日更新）
 *                                          （含地址、ZIP、家里的 ZIP、广告链接、Flipp 链接、这一期起止日期）
 *   await hmhDeals.importAuto(json)     → json = {"stores":[…同 Claude 整理的格式…], "failed":[{"store":"","reason":""}], "note":""}
 *                                          每家先删掉现有的有效特价再存新的（特价本身记 source = claude——shop_deals 不认 auto）；没写日期的按换广告日补；写一条 source = auto 的更新记录；返回每家的结果
 * 只认 auto_update 打开的商店，别的店名一律跳过（记在记录里），所以任务不会改到手动维护的商店。
 * 例外：商店页上手动点「🤖 用脚本更新」（pantrydeals://run?shop=<id>）→ 脚本跑 /pantry-deals auto <id>，
 *   这时 autoShops({ id }) 只返回那一家、importAuto(json, { only: id }) 只录那一家——不管它开没开自动更新（是你自己点的）。 */
export function installAutoHook() {
  window.hmhDeals = {
    async autoShops({ id = null } = {}) {
      await loadShops();
      const watch = restockWatch(), item_names = myItemNames();   // 每家都一样：家里告急的 / 清单上的 / 常补的，读广告时优先找；物品名用来填 aka
      return (state.shops || []).filter((x) => (id ? x.id === id : !x.archived && x.auto_update && x.refresh === "weekly" && dealsDue(x)))
        .map((x) => ({ id: x.id, name: x.name, chain: x.chain, address: x.address, zip: x.zip || null, home_zip: savedZip()?.zip || null, ad_url: adUrl(x), flipp_url: flippUrl(x), refresh_dow: x.refresh_dow ?? 3, ...weekWindow(x), due: dealsDue(x), deals_at: x.deals_at,
          sections: FOCUS_SECTIONS[x.chain] || null, watch, item_names }));
    },
    async importAuto(j, { only = null } = {}) {
      if (typeof j === "string") j = parseLooseJson(j);
      await loadShops();
      const autos = new Set(only ? [only] : (state.shops || []).filter((x) => !x.archived && x.auto_update && x.refresh === "weekly").map((x) => x.id));
      const log = [];
      for (const g of importGroups(j)) {
        if (!g.shop || !autos.has(g.shop.id)) { log.push({ shop_id: g.shop?.id || null, name: g.store, added: 0, replaced: 0, error: t("不是自动更新的商店，跳过") }); continue; }
        try { log.push({ shop_id: g.shop.id, name: g.shop.name, ...(await applyDeals(g.shop, g.rows, { source: "claude", replace: true })) }); }
        catch (e) { log.push({ shop_id: g.shop.id, name: g.shop.name, added: 0, replaced: 0, error: String(e.message).slice(0, 200) }); }
      }
      for (const f of Array.isArray(j?.failed) ? j.failed : []) {
        const shop = (state.shops || []).find((x) => x.name === f.store || (chainOf(f.store) && x.chain === chainOf(f.store)));
        log.push({ shop_id: shop?.id || null, name: String(f.store || "?").slice(0, 60), added: 0, replaced: 0, error: String(f.reason || "failed").slice(0, 200) });
      }
      if (!log.length) log.push({ shop_id: null, name: "—", added: 0, replaced: 0, error: t("没有读到任何特价") });
      const note = [only ? t("在商店页手动触发") : "", j?.note ? String(j.note) : ""].filter(Boolean).join(" · ").slice(0, 500) || null;
      const run = await logRun("auto", log, note);
      R?.(false);
      return { ok: !!run || state.runsMissing, logged: !!run, stores: log };
    },
  };
}
