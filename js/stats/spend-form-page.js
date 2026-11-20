/* 花费的独立表单页：新记 / 编辑 / 复制（#/bills/spend?form=new | <花费 id>，&copy=<花费 id>）。
 * 不再在明细列表上方展开表单，也不在行里插表单：右下角圆形 ＋ → 手动记一笔，明细行的右键 / 长按菜单 → 编辑 / 复制，都来这一页。
 * 新记 / 复制用 id="purchaseForm"、编辑用 id="spendEditForm"：保存、重复提醒、分类联动的处理（app/events/submit.js、change.js、stats/dup-check.js）沿用原来的；
 * 表单带 data-page，保存成功后回到明细。 */
import { esc, fmtDay, num } from "../core/util.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { crumbNav } from "../core/hub.js";
import { natureOptions } from "../core/taxonomy.js";
import { categoryOptions } from "../pantry/meals-sync.js";
import { cardHintHtml } from "../bills/cards-review.js";
import { cardSelectHtml, payAcctValue } from "../bills/card-picker.js";
import { lastStore, storeDatalist } from "./store-lite.js";
import { activeProps } from "./add-lite-common.js";
import { propertyOptions } from "./add-lite.js";
import { tripDatalist } from "./spend-trips.js";
import { spendList } from "./spend-records.js";

export const spendRecordsHref = () => `${href("bills", "spend")}?tab=records`;
const loaded = new Map();   // 直接打开链接时明细还没读：单独读这一笔

/** 路由里的表单参数：null = 不是表单页；{ mode: "new" | "edit" | "copy", id } */
export function spendFormParams(q) {
  if (!q) return null;
  const f = q.get("form"), add = q.get("add");
  if (q.get("copy")) return { mode: "copy", id: q.get("copy") };
  if (f && f !== "new") return { mode: "edit", id: f };
  return f === "new" || add ? { mode: "new", id: null } : null;
}

function findRow(id) {
  const r = spendList.rows.find((x) => x.id === id) || loaded.get(id);
  if (r || loaded.has(id)) return r || null;
  loaded.set(id, undefined);
  Store.getPurchase(id).then((p) => { loaded.set(id, p || null); window.dispatchEvent(new Event("spend-data-loaded")); }).catch(() => { loaded.set(id, null); window.dispatchEvent(new Event("spend-data-loaded")); });
  return undefined;   // 还在读
}

const catSelect = (cat) => {
  const opts = categoryOptions(cat || undefined, { withOther: true, spend: true });
  return `<select name="category" aria-label="${esc(t("分类"))}">${cat && !opts.includes(`value="${cat}"`) ? `<option value="${esc(cat)}" selected>${esc(cat)}</option>` : ""}${opts}</select>`;
};

export function spendFormPage(P) {
  const q = state.route?.q, today = new Date().toISOString().slice(0, 10);
  const src = P.id ? findRow(P.id) : null, isEdit = P.mode === "edit";
  const title = isEdit ? t("编辑花费") : P.mode === "copy" ? t("复制花费") : t("记一笔花费");
  const crumb = crumbNav([{ href: spendRecordsHref(), label: t("花费记录") }, { label: title }]);
  if (P.id && src === undefined) return `<section class="section form-page">${crumb}<div class="panel empty"><strong>${t("加载中…")}</strong></div></section>`;
  if (P.id && !src) return `<section class="section form-page">${crumb}<div class="panel empty"><strong>${t("找不到这笔记录")}</strong><p><a class="btn btn-sm" href="${spendRecordsHref()}">${t("回到花费记录")}</a></p></div></section>`;
  const v = (k) => esc(src?.[k] ?? "");
  const amount = src?.amount != null ? (isEdit ? num(src.amount).toFixed(2) : Math.abs(num(src.amount)).toFixed(2)) : "";
  const day = isEdit ? String(src.purchased_at).slice(0, 10) : today;
  const cat = src?.category || q?.get("cat") || "";
  const card = src ? payAcctValue(src.card_id, src.method) : undefined;
  return `<section class="section form-page">${crumb}
    <div class="section-head"><h2>${esc(title)}</h2>${isEdit ? `<p>${esc(fmtDay(src.purchased_at))}</p>` : P.mode === "copy" ? `<p>${esc(t("已带上「{name}」，改一下金额或日期再记", { name: src.name }))}</p>` : `<p>${t("没走购物车的，在这里记")}</p>`}</div>
    ${storeDatalist()}
    <form id="${isEdit ? "spendEditForm" : "purchaseForm"}" class="panel" data-page="1" ${isEdit ? `data-id="${esc(src.id)}"` : ""} novalidate>
      <div class="form-grid">
        <label class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${v("name")}" placeholder="${esc(t("买了什么，例如：超市采购"))}"></label>
        <label>${t("分类")}${catSelect(cat)}</label>
        <label>${t("金额（{cur}）", { cur: src?.currency || Units.region.currency })}<input name="amount" type="number" ${isEdit ? "" : 'min="0"'} step="0.01" inputmode="decimal" required value="${amount}"><small>${isEdit ? t("退款 / 报销填负数") : t("退款 / 报销勾下面的选项")}</small></label>
        <label>${t("商店 / 收款方")}<input name="store" maxlength="40" list="storeList" value="${esc(src?.store ?? (isEdit ? "" : lastStore()))}"></label>
        <label>${t("日期")}<input name="date" type="date" max="${today}" value="${esc(day)}"></label>
        ${state.billsEnabled ? `<label>${t("怎么付的")}${cardSelectHtml("card_id", card)}</label>` : ""}
        <label>${t("经济性质")}<select name="nature" data-nosearch title="${esc(t("日常消费 / 资本性 / 投资 / 融资 / 转账：决定算进哪些统计；一般按分类默认就行"))}">${natureOptions(src?.nature || "", { leaf: cat || undefined })}</select><small>${t("决定算进哪些统计；一般按分类默认")}</small></label>
        ${activeProps().length ? `<label>${t("关联房产")}<select name="property_id" data-nosearch>${propertyOptions(src?.property_id || "")}</select></label>` : ""}
        ${isEdit ? "" : `<label>${t("行程（旅行）")}<input name="trip" maxlength="30" list="tripList" value="${esc(q?.get("trip") || "")}">${tripDatalist()}</label>
        <label class="check-inline span-2" title="${esc(t("退货退款、报销收回：记成负数，统计里按净额算"))}"><input type="checkbox" name="refund"><span>${t("退款 / 报销")}</span></label>`}
      </div>
      <p id="purchaseDupHint" class="dup-hint" role="status" hidden></p>
      ${isEdit ? "" : `<p id="purchaseCardHint" class="card-hint-line">${cardHintHtml("fresh", lastStore(), null)}</p>`}
      <div class="form-actions"><button type="submit" class="btn btn-primary">${isEdit ? t("保存修改") : t("记一笔")}</button><a class="btn btn-ghost" href="${spendRecordsHref()}">${t("取消")}</a></div>
    </form></section>`;
}
