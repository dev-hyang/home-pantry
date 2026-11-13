/* 拍照加入采购清单（2026-11-13）：在家里拍快用完的东西、空瓶空袋、手写的清单或聊天截图 → AI 认出要买什么 → 核对后加进采购清单。
 * 和「录入购物」（js/pantry/scan.js，小票 → 入库 + 记花费）分开：这里只加采购清单，不动库存、不记花费。
 * 用设置里的 AI key；照片在手机上压缩后发给所选服务商，不保存原图；一律人工确认后才写入。 */
import { state } from "../core/state.js";
import { findItem, normName } from "../core/item-match.js";
import { Store } from "../core/store.js";
import { $, esc, num, spaceOf, toast } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { aiReady, askText } from "../core/ai.js";
import { attachHTML, attachPayload, attachReset } from "../core/attach.js";
import { categoryOptions } from "./views.js";

const ATT = "shopPhoto";
const ss = { busy: false, error: "", rows: null };   // rows：AI 认出来、等核对的 [{ include, name, quantity, unit, category, item_id }]
export const shopScanBusy = () => ss.busy;

function prompt() {
  const cats = window.CATEGORIES.filter((c) => c.space === "pantry" || c.space === "house").map((c) => `${c.id}=${c.name}`).join(", ");
  const pool = state.items.filter((i) => spaceOf(i.category) !== "gear").slice(0, 200).map((i) => `${i.name}|${i.unit || ""}`).join("\n");
  const system = [
    "You help a family build a SHOPPING LIST. The photos / text show things they need to buy: products running low or empty packages at home, a handwritten or typed list, a chat message, or a screenshot. Return ONLY JSON.",
    "List each distinct thing to buy once. Ignore background objects that are clearly not meant to be bought.",
    `Write names short and generic in ${lang === "en" ? "English" : "简体中文"} (e.g. "牛奶", "洗洁精"); keep the brand only if it is clearly important. If a name matches one of the existing household items below, use that exact name.`,
    "quantity = how many packages to buy (default 1, or the number written on the list). unit = the package type: bottle, bag, box, can, pack, roll, tube, cup, pc; or lb / kg / oz / g when the list gives a weight.",
    `category = one of: ${cats}; use "other" if unsure.`,
  ].join("\n");
  const user = ["Existing household items (name|unit):", pool || "(none)", 'Return exactly: {"items":[{"name":"","quantity":1,"unit":"","category":"other"}]}'].join("\n");
  return { system, user };
}
function parseJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(clean); } catch { /* 再试截取 */ }
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch { /* 下面报错 */ } }
  return null;
}
const openMatch = (name, item) => state.shopping.find((s) => s.status !== "bought" && (item ? s.item_id === item.id : normName(s.name) === normName(name)));
function toRows(j) {
  const seen = new Set();
  return (Array.isArray(j?.items) ? j.items : []).map((x) => {
    const name = String(x?.name || "").trim().slice(0, 60); if (!name || seen.has(normName(name))) return null; seen.add(normName(name));
    const item = findItem(name), dup = openMatch(name, item);
    const valid = window.CATEGORIES.some((c) => c.id === x.category && c.space !== "gear");
    return { include: !dup, dup: !!dup, name: item?.name || name, quantity: Math.max(0.1, num(x.quantity, 1)), unit: item?.unit || Units.normalize(x.unit) || Units.guess(name) || "",
      category: item?.category || (valid ? x.category : "other"), item_id: item?.id || null };
  }).filter(Boolean);
}
/** 核对表里改过的值记回 rows（重画前调用，免得改动被冲掉） */
function keep() {
  const f = $("#shopScanForm"); if (!f || !ss.rows) return;
  ss.rows.forEach((r, i) => {
    const g = (n) => f.querySelector(`[name="${n}"][data-i="${i}"]`);
    r.include = !!g("inc")?.checked;
    const name = g("name")?.value.trim(); if (name) r.name = name.slice(0, 60);
    r.quantity = Math.max(0.1, num(g("quantity")?.value, r.quantity));
    r.unit = Units.normalize(g("unit")?.value || "") || "";
    r.category = g("category")?.value || r.category;
  });
}

export function shopScanHtml() {
  if (ss.rows) {
    const n = ss.rows.filter((r) => r.include).length;
    return `<form class="panel shop-scan-rv" id="shopScanForm" aria-label="${esc(t("核对要加的东西"))}">
      <b>${t("认出 {n} 样，核对一下", { n: ss.rows.length })}</b>
      <p class="muted shop-add-tip">${t("名称、数量都能改；不要的取消勾选。已经在清单里的默认不勾。")}</p>
      <ul class="ssr-list">${ss.rows.map((r, i) => `<li class="ssr-row">
        <input type="checkbox" name="inc" data-i="${i}" ${r.include ? "checked" : ""} aria-label="${esc(t("加入 {name}", { name: r.name }))}">
        <input name="name" data-i="${i}" value="${esc(r.name)}" maxlength="60" list="itemNames" aria-label="${esc(t("名称"))}">
        <input name="quantity" data-i="${i}" type="number" min="0.1" step="0.1" inputmode="decimal" value="${r.quantity}" aria-label="${esc(t("数量"))}">
        <input name="unit" data-i="${i}" list="unitList" maxlength="10" value="${esc(t(r.unit))}" placeholder="${esc(t("单位"))}" aria-label="${esc(t("单位"))}">
        <select name="category" data-i="${i}" aria-label="${esc(t("分类"))}">${categoryOptions(r.category)}</select>
        ${r.dup || r.item_id ? `<small class="ssr-note">${r.dup ? t("已在清单里") : t("库存里有，买到后自动入库")}</small>` : ""}
      </li>`).join("")}</ul>
      <div class="form-actions"><button type="submit" class="btn btn-primary">${t("加入清单（{n} 项）", { n })}</button><button type="button" class="btn btn-ghost" data-action="shopscan-cancel">${t("放弃")}</button></div>
    </form>`;
  }
  const ready = aiReady();
  return `<div class="panel shop-scan">
    ${attachHTML(ATT, { t, esc, textLabel: t("也可以粘贴文字（家人发来的清单、聊天记录）"), ph: t("例如：鸡蛋两盒、牛奶、洗洁精"), rows: 2,
      hint: t("拍快用完的东西、空瓶空袋，或手写的清单、聊天截图都行。只加进采购清单，不动库存。") })}
    ${ss.error ? `<p class="form-error" role="alert">${esc(ss.error)}</p>` : ""}
    ${ready ? "" : `<p class="muted shop-add-tip">${t("要先在设置里填 AI key 才能认照片。")}</p>`}
    <div class="form-actions"><button type="button" class="btn btn-primary" data-action="shopscan-read" ${ss.busy || !ready ? "disabled" : ""}>${ss.busy ? t("正在认…（几十秒）") : t("认出要买的东西")}</button></div>
  </div>`;
}

export async function shopScanAction(action, el, { render }) {
  if (action === "shopscan-cancel") { ss.rows = null; ss.error = ""; return render(); }
  if (action === "shopscan-read") {
    const { images, text } = attachPayload(ATT);
    if (!images.length && !text.trim()) { ss.error = t("先拍几张照片，或粘贴文字。"); return render(); }
    ss.busy = true; ss.error = ""; render();
    try {
      const p = prompt();
      const raw = await askText(p.system, `${p.user}${text.trim() ? `\nPasted text:\n${text.trim().slice(0, 6000)}` : ""}`, { json: true, images, temperature: 0.2, maxTokens: 1500 });
      const rows = toRows(parseJson(raw));
      if (!rows.length) ss.error = t("没认出要买的东西。换一张更清楚的照片，或直接手动添加。");
      else { ss.rows = rows; attachReset(ATT); }
    } catch (e) { ss.error = e.message; }
    ss.busy = false; return render();
  }
}
/** 核对表提交：勾了的逐个加进采购清单（同名已在清单里的跳过） */
export async function saveShopScan(refresh) {
  keep();
  const pick = (ss.rows || []).filter((r) => r.include && r.name);
  if (!pick.length) return toast(t("没有勾选任何一条。"));
  let added = 0, skipped = 0;
  for (const r of pick) {
    const item = findItem(r.name);
    if (openMatch(r.name, item)) { skipped++; continue; }
    await Store.saveShopping({ name: r.name, quantity: r.quantity, unit: r.unit || item?.unit || Units.guess(r.name) || "", item_id: item?.id || null, category: r.category || item?.category || "other" });
    added++;
  }
  ss.rows = null;
  toast(t("已加入采购清单 {n} 项", { n: added }) + (skipped ? t("；{m} 项已在清单里，跳过", { m: skipped }) : ""));
  refresh();
}
export const keepShopScan = keep;
