/* 商店特价的详情页（#/shops/shop/<商店 id>?deal=<特价 id>）和编辑页（&edit=1）：只读分块，每块右上角有自己的「编辑」；右上 ⋯：加入清单、删除；下面是这条的价格历史。 */
import { dealCatName, dealMatches, dealTypeName, openShopping, priceHistory } from "./logic.js";
import { dealEditFormHtml, dealHref, histList, typeTags } from "./shop-detail.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { moreMenu } from "../core/more-menu.js";
import { crumbNav } from "../core/hub.js";
import { esc, fmtShort, money } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { unitMoney } from "./lite.js";
import { shopCat } from "./logic.js";
import { shopHref } from "./shops-common.js";

export function viewShopDeal(s, id, editing) {
  const d = (state.shopDeals || []).find((x) => x.id === id && x.shop_id === s.id), icon = shopCat(s.category)[2];
  const base = [{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }, { href: shopHref(s), label: s.name, icon }];
  if (!d) return `<section class="section shops-page">${crumbNav([...base, { label: t("特价") }])}<div class="panel empty"><strong>${t("找不到这条特价")}</strong><p><a class="btn btn-sm" href="${shopHref(s)}">${t("回到商店")}</a></p></div></section>`;
  if (editing) return `<section class="section shops-page form-page">${crumbNav([...base, { href: dealHref(s, d), label: d.name }, { label: t("编辑特价") }])}${dealEditFormHtml(d, s)}</section>`;
  const edit = (sec) => `${dealHref(s, d)}&edit=1&sec=${sec}`, m = dealMatches(d, openShopping()), h = priceHistory(d);
  const price = d.price != null ? money(d.price) : d.price_text || "";
  const menu = moreMenu([m.length ? null : { label: t("加入清单"), action: "shops-tolist", data: { deal: d.id }, first: true }, { label: t("删除"), action: "shops-deal-del", data: { deal: d.id }, danger: true }]);
  const info = dtBlock(t("商品信息"), edit("basic"), [dtRow(t("名称"), esc(d.name)), dtRow(t("规格"), esc(d.size || "")), dtRow(t("品牌"), esc(d.brand || "")), dtRow(t("分类"), d.category ? esc(t(dealCatName(d.category))) : ""), dtRow(t("通用叫法"), esc(d.aka || ""))]);
  const pr = dtBlock(t("价格"), edit("price"), [dtRow(t("价格"), `<b>${esc(price)}</b>`), dtRow(t("广告原文"), esc(d.price_text || "")), dtRow(t("原价"), d.regular_price ? `<s>${money(d.regular_price)}</s>` : ""), dtRow(t("单价"), d.unit_price != null ? `${unitMoney(d.unit_price)} ${esc(d.unit_label || "")}` : "")]);
  const valid = dtBlock(t("有效期与类型"), edit("valid"), [dtRow(t("到期"), d.valid_to ? esc(fmtShort(d.valid_to)) : ""), dtRow(t("折扣类型"), d.deal_type ? typeTags(d.deal_type) : ""), dtRow(t("清单里"), m.length ? esc(m.map((x) => x.name).join("、")) : "")]);
  const hist = h ? `<section class="panel dt-block"><div class="dt-head"><h3>${t("以前的价格")}</h3></div>${histList(d)}</section>` : "";
  return `<section class="section shops-page">${crumbNav([...base, { label: d.name }])}
    <div class="section-head"><div class="sh-title"><h2>${esc(d.name)}</h2><p>${esc(s.name)}${price ? ` · ${esc(price)}` : ""}</p></div><div class="head-acts">${menu}</div></div>
    ${info}${pr}${valid}${hist}</section>`;
}
