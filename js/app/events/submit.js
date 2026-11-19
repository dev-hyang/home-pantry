/* 表单提交：保存物品 / 设备 / 账单 / 房屋资料等各个表单。 */
import { $, money, num, toast } from "../../core/util.js";
import { Store } from "../../core/store.js";
import { applyCloseout, assetTemplateItems, billTemplateItems, runAiPage, runFix, saveAssessForm, saveAssetForm, saveBillForm, saveBillPayForm, saveCandForm, saveDealEventForm, saveDealForm, saveDealTaskForm, saveItemForm, saveMaintForm, saveOfferForm, savePlanForm, saveRecallForm, saveSeasonForm, templateItems } from "../lazy-modules.js";
import { bigThreshold, groupForCategory } from "../../bills/budget.js";
import { canonName, canonSubs, newCatKey } from "../../core/categories.js";
import { cleanStore, patchSpendRow, rememberStore, spendList } from "../../stats/views.js";
import { doCreateHousehold, doJoinHousehold, dupNameCheck } from "../auth/household.js";
import { doLogin, doPhoneLogin, doQuickJoin, doVerifyOtp } from "../auth/login.js";
import { effNature, l1IdOf, l2IdOf } from "../../core/taxonomy.js";
import { familyHref, meId, profileErr, readMemberForm, reloadMembers } from "../../settings/members.js";
import { findItem, normName } from "../../core/item-match.js";
import { friendlyErr } from "../errors.js";
import { glossaryOf, t } from "../../core/i18n.js";
import { go, href } from "../../core/router.js";
import { hydrateModelSelect, saveAiForm } from "../../settings/views.js";
import { isRetired } from "../../house/assets-logic.js";
import { matchOpenShopping, showPurchaseDup } from "../../stats/dup-check.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { runAi } from "../../pantry/ai.js";
import { saveHouseForm } from "../actions/house-form.js";
import { saveLocationForm } from "../../core/locations.js";
import { savePersonForm } from "../../settings/family-people.js";
import { saveShopScan } from "../../pantry/shop-scan.js";
import { state } from "../../core/state.js";
import { saveMedBillForm, saveMedPayForm } from "../lazy-modules.js";
import { purchasePayFields, rememberCard } from "../../bills/card-picker.js";
import { saveCardForm } from "../lazy-modules.js";

export async function onMainSubmit(e) {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.id === "itemForm") return saveItemForm(f);
    if (f.id === "aiForm") { render(); await runAi(f); return render(); }   // 先画“生成中”，再画结果
    if (f.id === "aiPageForm") { const p = runAiPage(f); render(); await p; return render(); }
    if (f.id === "fixForm") { const p = runFix(); render(); await p; return render(); }   // 出了问题？先画“诊断中”，再画结果
    if (f.id === "catForm") {   // 自定义分类：新建或改名 / 换图标颜色
      const fe = f.elements, name = fe.name.value.trim();
      if (!name) return toast(t("请填分类名"));
      if (CATEGORIES.some((c) => c.space === fe.space.value && t(c.name) === name && c.id !== state.catForm?.key)) return toast(t("已有同名分类"));
      const cf = state.catForm || {}, editing = !!cf.key, cur = cf.key ? CATEGORIES.find((c) => c.id === cf.key) : null;
      // 内置分类：没改的名称 / 小类还原成内置键（切换语言仍会翻译），改过的按原样存
      const subs = canonSubs(cur, fe.subs.value.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 12), t);
      const canon = cur && !cur.custom ? canonName(cur, name, t) : name;
      // 内置分类：key 用内置 id，这一行就是“覆盖”；自建分类：新 key
      const row = { id: cf.id, key: cf.key || newCatKey(), space: fe.space.value, name: canon, icon: fe.icon.value || "📦", color: fe.color.value || "#8a948f", loc: null, subs, hidden: !!cf.hidden, sort: cf.sort ?? CATEGORIES.filter((c) => c.custom).length };
      if (fe.parent && !(cur && !cur.custom)) row.parent = fe.parent.value || null;   // 自建分类：花费统计里挂在哪个二级分类下（空 = 按空间默认）
      if (cur && !cur.custom && !cf.hidden) {   // 内置分类保存时和默认完全一样：不留覆盖行（有就删掉），免得标“改过”
        const b = cur.base, same = canon === b.name && row.icon === b.icon && row.color === b.color && JSON.stringify(subs) === JSON.stringify(b.subs);
        if (same) { if (cf.id) await Store.deleteCategory(cf.id); state.catForm = null; toast(t("和默认一样，没有改动")); return refresh(); }
      }
      await Store.saveCategory(row);
      state.catForm = null; if (state.route.section !== "me") state.filter.cat = row.key;
      toast(editing ? t("分类已保存") : t("已添加分类 {name}", { name }));
      return refresh();
    }
    if (f.id === "aiSettingsForm") { await saveAiForm(f); toast(t("AI 设置已保存（只存在本机）")); render(); return hydrateModelSelect(); }
    if (f.id === "termsForm") {   // 自定义名称的翻译：每行 term + 简体 / English / 繁體；全空的行删掉
      let n = 0;
      for (const tr of f.querySelectorAll("[data-term]")) {
        const term = tr.dataset.term, v = (k) => tr.querySelector(`input[name="${k}"]`).value.trim() || null;
        const row = { term, zh: v("zh"), en: v("en"), hant: v("hant") };
        const was = glossaryOf(term) || {};
        if (row.zh === (was.zh || null) && row.en === (was.en || null) && row.hant === (was.hant || null)) continue;
        if (!row.zh && !row.en && !row.hant) { if (was.id) await Store.deleteTerm(term); } else await Store.saveTerm(row);
        n++;
      }
      toast(n ? t("已保存 {n} 条翻译", { n }) : t("没有改动")); return refresh();
    }
    if (f.id === "locForm") {   // 存放位置：新建或重命名（重命名会把用到旧名字的物品、设备一起改）
      const fe = f.elements;
      await saveLocationForm(state, state.locForm || {}, fe.name.value.trim(), fe.grp.value);
      state.locForm = null; return refresh();
    }
    if (f.id === "assetForm") return saveAssetForm(f);
    if (f.id === "recallForm" || f.id === "recallFixForm" || f.id === "recallRefundForm") return saveRecallForm(f, { refresh, render });   // 设备召回：登记 / 修好了 / 退款
    if (f.id === "maintForm") {
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      let ok = false;
      try { ok = await saveMaintForm(f); } finally { btn.disabled = false; }
      if (!ok) return;   // 校验没过（如车辆没选保养项目）：保留已填内容
      await refresh(); return go(`${href("asset", f.elements.asset_id.value)}?sec=log`, { replace: true });   // 记完 / 改完回到记录列表
    }
    if (f.id === "spendEditForm") {   // 花费记录就地编辑
      const e2 = f.elements, name = e2.name.value.trim(), amount = e2.amount.value === "" ? null : Math.round(num(e2.amount.value) * 100) / 100;   // 负数 = 退款 / 报销，照存
      if (!name) return toast(t("请填写名称"));
      const store = cleanStore(e2.store.value), day = e2.date.value, patch = { name, category: e2.category.value, amount, store };
      if (e2.card_id) Object.assign(patch, purchasePayFields(e2.card_id.value, spendList.rows.find((x) => x.id === f.dataset.id)));   // 原来的付款方式：用明细读到的那一行   // 卡 → card_id；现金 / 支票 / 礼品卡 / 其他 → method
      if (day) patch.purchased_at = new Date(`${day}T12:00:00`).toISOString();
      if (e2.nature) patch.nature = e2.nature.value || null;   // 经济性质：空 = 按分类默认（迁移 055）
      if (e2.property_id) patch.property_id = e2.property_id.value || null;
      await Store.updatePurchase(f.dataset.id, patch);
      const row = spendList.rows.find((x) => x.id === f.dataset.id), bp = e2.card_id && (state.billPayments.find((x) => x.purchase_id === f.dataset.id) || (row?.pay_id ? { id: row.pay_id, card_id: undefined } : null));   // 这笔是账单缴费记的花费：改了卡，缴费记录同步
      if (bp && (bp.card_id || null) !== (patch.card_id || null)) await Store.updateBillPayment(bp.id, { card_id: patch.card_id || null }).catch(() => {});
      if (store) rememberStore(store);
      patchSpendRow(f.dataset.id, patch);   // 先改明细里读到的那一行，页面立刻是新的
      if (state.spendDrafts) delete state.spendDrafts[f.dataset.id];
      state.spendEdit = null; toast(t("已保存修改")); render(); return refresh();
    }
    if (f.id === "billForm") return saveBillForm(f);
    if (f.id === "medBillForm") return saveMedBillForm(f);
    if (f.id === "cardForm") return saveCardForm(f);
    if (f.id === "medPayForm") return saveMedPayForm(f);
    if (f.id === "billPayForm") {
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      const billId = f.elements.bill_id.value;
      try { await saveBillPayForm(f); } finally { btn.disabled = false; }
      await refresh();
      return go(`${href("bill", billId)}?sec=pay`, { replace: true });   // 记完 / 改完都回到全部缴费记录
    }
    if (f.id === "personForm") { const isNew = !f.dataset.id; if (await savePersonForm(f)) { await refresh(); if (isNew) return go(familyHref(), { replace: true }); render(true); } return; }   // 家庭成员详情页：保存基本资料
    if (f.id === "assessForm") {
      const billId = f.dataset.bill; if (!(await saveAssessForm(f))) return;
      await refresh(); return go(`${href("bill", billId)}?sec=assess`, { replace: true });
    }
    if (f.id === "billTemplateForm") {
      const idx = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => +x.value);
      if (!idx.length) return toast(t("还没有勾选账单"));
      const list = billTemplateItems(idx);
      await Store.addBills(list);
      toast(t("已建立 {n} 条账单，记得补金额和到期日", { n: list.length }));
      go(href("bills", "all"));
      return refresh();
    }
    if (f.id === "propertyForm") {
      const fe = f.elements, name = fe.name.value.trim();
      if (!name) return toast(t("请填写房产名称"));
      const old = state.properties.find((p) => p.id === fe.property_id.value) || {};
      const saved = await Store.saveProperty({ ...old, id: fe.property_id.value || undefined, name, kind: fe.kind.value, role: fe.role.value, status: fe.status.value || old.status || "owned",
        address: fe.address.value.trim() || null, notes: fe.notes.value.trim() || null });
      state.editProperty = null; toast(t("房产已保存"));
      if (!old.id && saved?.id && state.route?.section === "house") {   // 房屋页新建的：直接切到新房产，接着填资料
        state.propertyId = saved.id; try { localStorage.setItem("hmh-property", saved.id); } catch { /* 忽略 */ }
        state.houseDraft = null;
      }
      return refresh();
    }
    if (f.id === "propertyDeleteForm") {   // 彻底删除已归档房产：输入房产名确认
      const p = state.properties.find((x) => x.id === f.elements.property_id.value);
      if (!p) return;
      if (f.elements.confirm_name.value.trim() !== p.name) return toast(t("输入的名称和房产名不一致"));
      await Store.deleteProperty(p.id);
      state.deleteProperty = null; toast(t("已彻底删除“{name}”及其账单、设备和资料；花费记录保留", { name: p.name })); return refresh();
    }
    if (f.id === "dealForm") {   // 交易信息保存后回交易首页（清单）；保留 ?asset= / ?deal=
      await saveDealForm(f); f.dataset.saved = "1"; state.dealView = "list"; await refresh();
      const q = new URLSearchParams(state.route.q); q.delete("sec"); return go(`${href("house", "deal")}${q.toString() ? `?${q}` : ""}`, { replace: true });
    }   // 已保存：刷新时不再当作未保存改动
    if (f.id === "planForm") { const pid = await savePlanForm(f); state.planEdit = null; await refresh(); if (!f.elements.rec_id.value) go(`${href("house", "plan")}?p=${pid}`); return; }
    if (f.id === "candForm") { await saveCandForm(f); state.planEdit = null; return refresh(); }
    if (f.id === "offerForm") { await saveOfferForm(f); state.planEdit = null; return refresh(); }
    if (f.id === "dealEventForm") { await saveDealEventForm(f); state.dealEventEdit = null; return refresh(); }
    if (f.id === "dealTaskForm") { await saveDealTaskForm(f); state.dealTaskEdit = null; return refresh(); }
    if (f.id === "seasonForm") { if (await saveSeasonForm(f)) { state.seasonForm = null; return refresh(); } return; }
    if (f.id === "closeoutForm") { await applyCloseout(f); go(href("house", "overview")); return refresh(); }
    if (f.id === "assetTemplateForm") {
      const ids = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!ids.length) return toast(t("还没有勾选设备"));
      const have = new Set((state.assets || []).filter((a) => a.property_id === state.propertyId && !isRetired(a)).map((a) => normName(a.name)));
      const all = await assetTemplateItems(ids), list = all.filter((x) => !have.has(normName(x.name)));   // 这套房产已有同名的跳过
      if (list.length) await Store.addAssets(list, state.propertyId);
      toast(t("已生成 {n} 台设备档案", { n: list.length }) + (all.length > list.length ? t("；{m} 台已经有了，跳过", { m: all.length - list.length }) : ""));
      go(href("house", "assets"));
      return refresh();
    }
    if (f.id === "houseForm") return saveHouseForm(f);
    if (f.id === "templateForm") {
      const keys = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!keys.length) return toast(t("还没有勾选耗材"));
      const all = (await templateItems(keys)).map((x) => ({ ...x, property_id: state.propertyId || null })), list = all.filter((x) => !findItem(x.name));   // 推荐的消耗品归属当前这套房产   // 已有同名（忽略大小写、空格、全角半角）的跳过，重复点不会建第二件
      if (list.length) await Store.addItems(list);
      toast(t("已添加 {n} 项汽车房屋消耗品", { n: list.length }) + (all.length > list.length ? t("；{m} 项库存里已有，跳过", { m: all.length - list.length }) : ""));
      Object.assign(state.filter, { space: "house", cat: "all", q: "", status: "all" });
      go(href("house", "supplies"));
      return refresh();
    }
    if (f.getAttribute("id") === "purchaseForm") {
      const e2 = f.elements, item = e2.name.value.trim(), amount = num(e2.amount.value, NaN);
      if (!item || !Number.isFinite(amount) || amount < 0) return toast(t("请填写名称和金额"));
      const name = TRIP.tag(e2.trip?.value.trim(), item);   // 旅行：名称写成「【行程】项目」，按行程汇总用
      const signed = e2.refund?.checked ? -amount : amount;   // “退款 / 报销”：记成负数，统计里按净额算
      const day = e2.date.value || new Date().toISOString().slice(0, 10);
      const store = cleanStore(e2.store.value);
      const dups = await showPurchaseDup(f);   // 疑似重复：第一次点只提醒，内容没改再点一次才记
      if (dups.length && f.dataset.dupAck !== "1") { f.dataset.dupAck = "1"; return toast(t("可能重复了（见表单下面的提醒）。确认不是，再点一次“记一笔”。")); }
      f.dataset.dupAck = "";
      if (store) rememberStore(store);
      const payV = e2.card_id?.value || ""; rememberCard(payV);
      // 经济性质：空 = 按分类默认（迁移 055）。以前的「大件」门槛现在只是记的时候问一句：金额较大、算进日常的，要不要标成资本性支出
      const cat = e2.category.value;
      let nature = e2.nature?.value || null;
      if (!nature && signed >= bigThreshold() && effNature(cat, null) === "operating" && ["home_goods", "digital", "apparel", "shop_misc", "home_maint", "transport"].includes(l2IdOf(cat)) && confirm(t("金额较大（{a}），标为资本性支出？\n资本性支出（大件、装修、买车…）不算进日常生活成本，现金流出里照样有。", { a: money(signed) }))) nature = "capital";
      // 关联房产：选了就记；没选、分类在「房产住房」下、家里只有一套房的，自动挂上这套
      const props = state.properties.filter((p) => !p.archived), property_id = e2.property_id?.value || (l1IdOf(cat) === "housing" && props.length === 1 ? props[0].id : null);
      const linkItem = findItem(item);   // 名称和已有物品写法一样：关联上这件（不新建物品、不加库存）
      await Store.addPurchase({ item_id: linkItem?.id || null, name, category: cat, quantity: null, unit: null, store,
        amount: Math.round(signed * 100) / 100, currency: Units.region.currency, purchased_at: new Date(`${day}T12:00:00`).toISOString(), ...purchasePayFields(payV),
        ...(nature ? { nature } : {}), ...(property_id ? { property_id } : {}) });
      const cart = signed > 0 ? matchOpenShopping({ name: item, at: new Date(`${day}T12:00:00`) }) : null;   // 购物车里有同名的未买项：顺手标成已买到
      if (cart) await Store.saveShopping({ id: cart.id, status: "bought", bought_at: new Date(`${day}T12:00:00`).toISOString(), amount: Math.round(signed * 100) / 100, claimed_by_name: cart.claimed_by_name || state.displayName });
      toast(t("已记录 {name} {m}", { name, m: money(signed) }) + (cart ? t("；购物车里的「{n}」已标成已买到", { n: cart.name }) : "")); return refresh();
    }
    if (f.id === "shopScanForm") return saveShopScan(refresh);
    if (f.id === "shopForm") {
      const name = f.elements.name.value.trim();
      if (!name) return;
      const linked = findItem(name);   // 写法一样就算同一件（以前要一字不差）
      const openSame = state.shopping.find((s) => s.status !== "bought" && (linked ? s.item_id === linked.id : normName(s.name) === normName(name)));
      if (openSame) return toast(t("{name} 已经在清单里了", { name: openSame.name }));
      await Store.saveShopping({ name, quantity: Math.max(0.1, num(f.elements.quantity.value, 1)), unit: Units.normalize(f.elements.unit.value) || linked?.unit || Units.guess(name) || "", item_id: linked?.id || null, category: f.elements.category.value || linked?.category || "other" });   // 没填单位：已有物品用它的，新的按名字猜（牛奶 → 瓶）
      { const est = num(f.elements.estimate?.value, NaN); state.shopAdvice = Number.isFinite(est) && est > 0 ? { name, estimate: est, group: groupForCategory(linked?.category || f.elements.category.value, est) } : null; }
      toast(t("已加入：{name}", { name }));
      if (state.route.sub === "add") { f.reset(); f.elements.name.focus(); }   // 加入清单页：清空表单接着加
      refresh();
    }
    if (f.id === "memberForm") {   // 成员资料：本人改自己的，家主改任何人的（数据库函数同样校验，迁移 052）
      const err = $("#memberErr"); if (err) err.textContent = "";
      try {
        const p = readMemberForm(f), id = f.dataset.id;
        dupNameCheck(p.display_name, id);
        await Store.setMemberProfile(id, p);
        if (id === meId()) state.displayName = p.display_name;
        await reloadMembers();
      } catch (ex) { if (err) { err.textContent = profileErr(friendlyErr(ex.message)); return; } throw ex; }
      toast(t("资料已保存")); return go(familyHref(), { replace: true });
    }
    if (f.id === "loginForm") return doLogin(f);
    if (f.id === "phoneForm") return doPhoneLogin(f);
    if (f.id === "otpForm") return doVerifyOtp(f);
    if (f.id === "quickForm") return doQuickJoin(f);
    if (f.id === "createHhForm") return doCreateHousehold(f);
    if (f.id === "joinHhForm") return doJoinHousehold(f);
  } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
}
