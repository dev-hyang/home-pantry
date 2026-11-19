/* 物品详情页（#/item/<id>）：点库存里的物品先进这里，不再直接进编辑表单。
 * 第一块：名称（靠左）+ 状态标志（缺货 / 少货 / 已加入购物车…，跟在名称后面）+ 右上角 ⋯（拍包装录入、加入 / 移出购物车、复制为新物品、删除）；
 * 下面每一块（基本信息 / 数量与提醒 / 备注）各带自己的「编辑」，点进去只改这一块（#/item/<id>?edit=basic|qty|notes，表单在 item-form.js）。
 * 详情页没有底部保存栏，底部导航保留。 */
import { state } from "../core/state.js";
import { aliasesOf } from "../core/item-match.js";
import { moreMenu } from "../core/more-menu.js";
import { MUTE_FOREVER, catOf, du, esc, fmt, fmtDate, num, spaceOf, stampText, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { crumbNav } from "../core/hub.js";
import { memberName, openShopFor } from "../core/logic.js";
import { t } from "../core/i18n.js";
import { Store } from "../core/store.js";
import { cartTag, statusTag } from "./inventory-items.js";
import { ownerKey, ownerName, showOwner } from "./owner.js";
import { assetLabel, linkableAssets } from "./item-form-common.js";

const fact = (k, val) => (val ? `<div class="fact"><dt>${k}</dt><dd>${val}</dd></div>` : "");
const dl = (rows) => { const r = rows.filter(Boolean); return r.length ? `<dl class="fact-grid one">${r.join("")}</dl>` : `<p class="muted prof-empty">${t("未填")}</p>`; };

function basicFacts(it, spaceInfo) {
  const sp = spaceOf(it.category), info = spaceInfo.find(([s]) => s === sp), gear = sp === "gear", c = catOf(it.category);
  const assets = Array.isArray(it.asset_ids) ? linkableAssets().filter((a) => it.asset_ids.includes(a.id)).map(assetLabel) : [];
  const ok = ownerKey(it);
  return dl([fact(t("别名"), aliasesOf(it.id).map(esc).join("、")), fact(t("组别"), info ? `${info[1]} ${esc(t(info[2]))}` : ""), fact(t("大类"), `${c.icon || ""} ${esc(t(c.name))}`.trim()), fact(t("小类"), it.subcategory ? esc(t(it.subcategory)) : ""),
    fact(t("位置"), it.location ? esc(it.location) : ""), gear ? "" : fact(t("保质期至"), it.expiry_date ? esc(fmtDate(it.expiry_date)) : ""),
    sp === "house" && showOwner() && ok ? fact(t("归属"), esc(ownerName(ok))) : "", sp === "house" && assets.length ? fact(t("关联设备"), assets.map(esc).join("、")) : ""]);
}
function qtyFacts(it) {
  const gear = spaceOf(it.category) === "gear", f = Units.factor(it.unit), dv = (x) => (x == null || x === "" ? "" : fmt(num(x) * f)), unit = esc(t(du(it.unit)));
  const remind = (num(it.min_quantity) > 0 || num(it.lead_days) > 0) && it.alert_mute_until !== MUTE_FOREVER;
  const mute = it.alert_mute_until === MUTE_FOREVER ? t("不再提醒") : it.alert_mute_until && it.alert_mute_until >= todayISO() ? t("暂停到 {d}", { d: esc(fmtDate(it.alert_mute_until)) }) : "";
  return dl([fact(t("当前数量"), `${dv(it.quantity ?? 0)} ${unit}`),
    gear ? "" : fact(t("提醒补货"), remind ? t("开：少货线 {a}，提前 {d} 天", { a: `${dv(it.min_quantity ?? 0)} ${unit}`, d: num(it.lead_days) }) : t("关")),
    gear || !mute ? "" : fact(t("补货提醒"), mute), gear || it.avg_daily_use == null || it.avg_daily_use === "" ? "" : fact(t("每天大约用量"), `${dv(it.avg_daily_use)} ${unit}`)]);
}

/** it：这件物品；ctx = { crumbBase（面包屑前半段）, spaceInfo（SPACE_INFO）} */
export function viewItemDetail(it, ctx) {
  state.editingCat = it.category;
  const base = href("item", it.id), gear = spaceOf(it.category) === "gear", e = state.enriched.find((x) => x.id === it.id), inList = !!openShopFor(it.id), c = catOf(it.category);
  const flags = `${e && !gear ? statusTag(e) : ""}${inList ? cartTag() : ""}`;
  const menu = moreMenu([
    { label: t("拍包装录入"), href: `${base}?edit=basic`, first: true },
    e ? { label: inList ? t("移出购物车") : t("加入购物车"), action: inList ? "shop-remove-item" : "shop-add-item", data: { id: it.id } } : null,
    { label: gear ? t("复制为新家居耐用品") : t("复制为新物品"), href: `${href("item", "new")}?copy=${encodeURIComponent(it.id)}&space=${spaceOf(it.category)}` },
    gear ? { label: t("升级为设备档案"), href: `#/asset/new?from_item=${encodeURIComponent(it.id)}` } : null,
    { label: t("删除物品"), action: "item-delete", danger: true }], { label: `${it.name} · ${t("更多操作")}` });
  const SECS = [{ id: "basic", icon: "🏷️", name: "基本信息", body: basicFacts(it, ctx.spaceInfo) }, { id: "qty", icon: "📦", name: gear ? "数量" : "数量与提醒", body: qtyFacts(it) },
    { id: "notes", icon: "📝", name: "备注", body: it.notes ? `<p class="pre" style="margin:0">${esc(it.notes)}</p>` : `<p class="muted prof-empty">${t("未填")}</p>` }];
  const cards = SECS.map((s) => `<section class="panel prof-card" aria-labelledby="idc-${s.id}"><header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="idc-${s.id}">${t(s.name)}</h3></div>
      <a class="btn btn-sm btn-ghost prof-edit" href="${base}?edit=${s.id}" aria-label="${esc(t("编辑 {name}", { name: t(s.name) }))}">${t("编辑")}</a></header>${s.body}</section>`).join("");
  return `<section class="section">
    ${crumbNav([...ctx.crumbBase, { label: it.name, icon: c.icon }])}
    <div class="panel item-head"><div class="ih-top"><div class="ih-main"><div class="ih-id"><span class="mi" aria-hidden="true">${c.icon || "📦"}</span><h2 class="ih-name">${esc(it.name)}</h2></div>${flags ? `<span class="ih-flags">${flags}</span>` : ""}</div>${menu}</div></div>
    <div class="prof-grid bill-detail-grid">${cards}</div>
    ${stampText(it) ? `<p class="record-meta">${esc(stampText(it))}${Store.mode === "cloud" && memberName(it.updated_by) ? `（${esc(memberName(it.updated_by))}）` : ""}</p>` : ""}
  </section>`;
}
