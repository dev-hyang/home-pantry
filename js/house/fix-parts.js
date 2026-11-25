/* 出了问题：设备候选、配件 ↔ 库存 / 购物车匹配、常见小毛病。 */
import { STATUS, state } from "../core/state.js";
import { Store } from "../core/store.js";
import { activeVehicles, isVehicle } from "./assets.js";
import { esc, num, toast } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { myAssets } from "./asset-common.js";
import { C, PARTS, SHOP_CAT, STORES, VEH_STORES, fx, region, repaint } from "./fix-common.js";

/* ── 设备候选：当前房产的设备 + 全家的车 ── */
export const candidates = () => [...myAssets(), ...activeVehicles()];
export const current = () => candidates().find((a) => a.id === fx().asset) || state.assetsEnriched.find((a) => a.id === fx().asset) || null;
/* ── 配件 ↔ 库存 / 购物车：按名字匹配，宁可漏不可错（“马桶止水皮”不能对上“马桶纸”）──
 * 命中规则：① 一方包含另一方；② 纯英文：配件名末尾的名词整词出现在库存名里（flapper / lubricant），前面的形容词不算；
 * ③ 带数字 / 连字符的型号词整词相同（wd-40、a23、16x25x1）；④ 中文：共享两个及以上双字词（“炉子滤网”对“新风滤网”只共享“滤网”，不算） */
const norm = (s) => String(s || "").toLowerCase().trim();
const toks = (s) => norm(s).split(/[\s/／,，、()（）+·]+/).filter(Boolean);
const bigrams = (s) => { const b = new Set(), c = norm(s).replace(/[^㐀-鿿]/g, ""); for (let i = 0; i + 1 < c.length; i++) b.add(c.slice(i, i + 2)); return b; };
function matchScore(partName, itemName) {
  const n = norm(partName), i = norm(itemName); if (!n || !i) return 0;
  if (i.includes(n) || n.includes(i)) return 3;
  const pt = toks(n), it = new Set(toks(i));
  if (pt.some((x) => x.length >= 3 && /\d|-/.test(x) && it.has(x))) return 2;
  if (/^[\x00-\x7f]+$/.test(n)) { const head = pt.at(-1) || ""; return head.length >= 4 && it.has(head) ? 2 : 0; }
  const pb = bigrams(n), ib = bigrams(i); let shared = 0; for (const b of pb) if (ib.has(b)) shared++;
  return shared >= 2 ? 1 : 0;
}
export function findStock(name) {
  return state.enriched.filter((it) => it.qty > 0 && matchScore(name, it.name) > 0).sort((a, b) => matchScore(name, b.name) - matchScore(name, a.name))[0] || null;
}
export const inShop = (label) => state.shopping.find((s) => s.status !== "bought" && String(s.name).trim().toLowerCase() === label.trim().toLowerCase());
export const partLabel = (p) => `${t(p.name)}${p.spec ? ` · ${t(p.spec)}`.slice(0, 60 - t(p.name).length) : ""}`.slice(0, 60);
/** “$8–15” → 8（取区间下限做预估金额，预算提示用） */
const priceNum = (s) => { const m = String(s || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/); return m ? Math.round(parseFloat(m[0]) * 100) / 100 : null; };
const storeLinks = (p) => {
  const q = encodeURIComponent(region() === "cn" ? t(p.name) : p.q || (lang === "en" ? p.name : `${p.name}`));
  return ((isVehicle(current()) ? VEH_STORES : STORES)[region()] || (isVehicle(current()) ? VEH_STORES : STORES).na).map(([n, u]) => `<a class="chip" href="${u}${q}" target="_blank" rel="noopener noreferrer">${esc(n)}</a>`).join("");
};
/** 一个配件：家里有 → 显示在哪、剩多少；已在采购 → 标记；否则「加入采购」+ 在哪买 */
export function partRow(p, key) {
  PARTS.set(key, p);
  const have = findStock(p.name), label = partLabel(p), open = inShop(label) || (have && state.shopping.find((s) => s.item_id === have.id && s.status !== "bought"));
  const meta = [p.spec ? t(p.spec) : "", p.qty ? `${num(p.qty)} ${t(p.unit || "个")}` : "", p.price ? `≈ ${t(p.price)}` : ""].filter(Boolean).join(" · ");
  const haveLine = have ? `<small class="fix-have">✓ ${t("家里有：{name}", { name: have.name })}${have.location ? ` · 📍${esc(t(have.location))}` : ""} · ${t("剩 {q} {u}", { q: Math.round(have.dqty * 100) / 100, u: t(have.du) })}${have.status !== "ok" ? ` <span class="badge ${STATUS[have.status].cls}">${t(STATUS[have.status].label)}</span>` : ""}</small>` : "";
  const act = fx().added[key] || open ? `<span class="badge b-ok">${t("已在购物车")}</span>`
    : `<button type="button" class="ui-btn" data-size="sm" data-tone="${have ? "ghost" : "primary"}" data-action="fix-part-add" data-key="${esc(key)}">${have ? t("还是买一个") : t("加入购物车")}</button>`;
  return `<li class="fix-part"><div class="grow"><b>${esc(t(p.name))}</b>${meta ? `<small>${esc(meta)}</small>` : ""}${haveLine}
      <details class="fix-where"><summary>${t("在哪买")}</summary><div class="chips" style="margin:4px 0 0">${storeLinks(p)}</div></details></div>${act}</li>`;
}
export async function addPart(key) {
  const p = PARTS.get(key); if (!p) return;
  const label = partLabel(p);
  if (inShop(label)) { fx().added[key] = true; toast(t("已经在清单里了")); return repaint(); }
  await Store.saveShopping({ item_id: null, name: label, quantity: num(p.qty) > 0 ? num(p.qty) : 1, unit: String(t(p.unit || "个")).slice(0, 10), category: SHOP_CAT, amount: priceNum(p.price) });
  fx().added[key] = true;
  toast(t("已加入购物车：{name}", { name: label }));
}
/* ── 常见小毛病（第 ① 层）── */
export function quickFixes(a) {
  const list = a ? C().fixesOf(a.type) : [];
  if (!list.length) return "";
  return `<section class="section"><div class="section-head"><h2>🔎 ${t("常见小毛病：先看这里")}</h2><p>${t("不用问 AI；配件能直接加采购")}</p></div>
    <div class="panel fix-quick">${list.map((q, i) => `<details class="care-card"><summary>${esc(t(q.s))}</summary>
      <p><b>${t("多半是")}</b>${esc(t(q.why))}</p>
      ${q.diy?.length ? `<div class="care-sec care-diy"><h4>${t("自己能做")}</h4><ol class="tips">${q.diy.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ol></div>` : ""}
      ${q.parts?.length ? `<div class="care-sec"><h4>${t("要买什么")}</h4><ul class="restock-list fix-parts">${q.parts.map((p, j) => partRow(p, `q-${a.type}-${i}-${j}`)).join("")}</ul></div>` : ""}
      ${q.pro ? `<div class="care-sec care-pro"><h4>${t("什么时候叫人")}</h4><p style="padding:0">${esc(t(q.pro))}</p></div>` : ""}
      ${q.note ? `<p class="care-meta"><b>${t("提醒")}</b>${esc(t(q.note))}</p>` : ""}
    </details>`).join("")}</div></section>`;
}
