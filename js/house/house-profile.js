/* 房屋资料：分区列表（带完成度）→ 点进去只改一块，各分区的表单字段。 */
import { EMERGENCY_FIELDS, emergencyOf, houseDraft } from "./house-draft.js";
import { PARKING_TYPES, RENT_POLICIES, STORAGE_TYPES, TAX_EXEMPTIONS, amountSource, hoaFact, hoaMonthly, hoaOf, curPid, insurancePremium, labelOf, noteArea, ownershipOf, refSection } from "./house-fees.js";
import { PROFILE_ASK, PROFILE_SECTIONS, insuranceRows, sectionStatus } from "./house-sections.js";
import { ctx as askCtx, askInline } from "../core/ask.js";
import { autofillBar } from "../core/autofill.js";
import { canManageHome } from "../settings/members.js";
import { currentProp, statusText } from "./deals.js";
import { esc, money } from "../core/util.js";
import { hoaFieldset } from "./house-overview.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { H } from "./asset-common.js";
import { isNewProp, isReviewing, newBar, newSteps, viewNewReview } from "./house-new.js";

/* ── 房屋资料：分区列表（带完成度）→ 点进去只改一块 ── */
export function viewHouseProfile() {
  const sec = state.route?.q?.get("sec");
  if (isReviewing()) return viewNewReview(sectionFacts);
  if (sec && PROFILE_SECTIONS.some((s) => s.id === sec)) return viewProfileSection(sec);
  const d = houseDraft(), first = !state.houseProfile;
  // 每个分区一个卡片（section container）：标题 + 完成度 + 「编辑」（进这一块自己的编辑页）+ 现在填的内容，整套房子的基本信息在这一页看全
  const cards = PROFILE_SECTIONS.map((s) => {
    const st = sectionStatus(d, s.id), edit = `${href("house", "profile")}?sec=${s.id}`;
    return `<section class="panel prof-card" aria-labelledby="pc-${s.id}">
      <header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span>
        <div class="prof-t"><h3 id="pc-${s.id}">${t(s.name)}</h3><small>${esc(st.text)}</small></div>
        <a class="ui-btn prof-edit" data-size="sm" data-tone="ghost" href="${edit}" aria-label="${esc(t("编辑 {name}", { name: t(s.name) }))}">${first && s.id === "type" ? t("开始") : t("编辑")}</a></header>
      ${st.pct != null ? `<span class="mprog"><i style="width:${st.pct}%"></i></span>` : ""}
      ${first && s.id !== "type" ? `<p class="muted prof-empty">${t("未填")}</p>` : sectionFacts(d, s.id)}
    </section>`;
  }).join("");
  return `<section class="section menu-page">
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">${first ? t("先选地区和房型，保存后其余分区随时补") : t("每一块各自编辑、各自保存")}</p>
    <div class="prof-grid">${cards}</div>
    ${first ? `<p class="hint">${t("房型决定推荐什么耗材、生成哪些设备、每月有什么季节任务；其余分区（地址、保险、HOA、材料）可以之后再补。")}</p>` : ""}
    <div class="ui-acts" style="margin-top:14px">${state.houseProfile ? `<a class="ui-btn" data-tone="ghost" href="${href("house", "overview")}">${t("返回房屋概览")}</a>` : `<a class="ui-btn" data-tone="primary" href="${href("house", "profile")}?sec=type">${t("开始：选地区和房型")}</a>`}</div>
  </section>`;
}
/** 资料页每个卡片里的内容：只读摘要（没填的显示「未填」） */
export function sectionFacts(d, id) {
  const Hh = H(), none = `<span class="muted">${t("未填")}</span>`;
  const tags = (names, soft) => (names.length ? `<span class="tagline">${names.map((n) => `<span class="tag${soft ? " tag-soft" : ""}">${esc(n)}</span>`).join("")}</span>` : "");
  const dl = (rows) => { const r = rows.filter(([, v]) => v); return r.length ? `<dl class="fact-grid one">${r.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : `<p class="muted prof-empty">${t("未填")}</p>`; };
  const names = (group, ids) => ids.map((x) => Hh.MATERIALS[group].find((m) => m.id === x)).filter(Boolean).map((m) => t(m.name));
  switch (id) {
    case "type": { const ht = Hh.typeOf(d.region, d.house_type); const B = window.BILLS, cp = isNewProp() ? d.prop : currentProp(); return dl([[t("房产名称"), cp ? esc(cp.name) : ""], [t("地区"), esc(t(Hh.REGIONS[d.region]?.name || ""))], [t("房型"), ht ? `${ht.icon} ${esc(t(ht.name))}` : ""], [t("类型"), cp ? esc(t(B.PROPERTY_KINDS[cp.kind] || "")) : ""], [t("用途"), cp ? esc(t(B.PROPERTY_ROLES[cp.role] || "")) : ""], [t("状态"), cp ? esc(isNewProp() ? t(window.DEALS.PROPERTY_STATUS[cp.status] || "") : statusText(cp)) : ""]]); }
    case "address": return dl([[t("地址"), esc(d.address || "")], [t("建成年份"), d.year_built ? `${d.year_built}${t("（约 {age} 年房龄）", { age: new Date().getFullYear() - d.year_built })}` : ""]]);
    case "insurance": { if (!d.insured) return `<p class="muted prof-empty">${t("未投保")}</p>`; return dl(insuranceRows(d)); }
    case "hoa": {
      const h = hoaOf(d), f = hoaFact(d); if (!f) return `<p class="muted prof-empty">${t("无 {label}", { label: t(Hh.assocOf(d.house_type).label) })}</p>`;
      const contact = [h.phone && esc(h.phone), h.email && esc(h.email), h.url && esc(h.url)].filter(Boolean).join(" · ");
      return dl([[t("概况"), f.v], [t("联系方式"), contact], [t("出租规则"), h.rent_policy && h.rent_policy !== "unknown" ? labelOf(RENT_POLICIES, h.rent_policy) : ""], [t("须知 / 规章"), h.rules ? `<span class="pre">${esc(h.rules)}</span>` : ""], [t("诉讼"), h.lawsuit ? `${t("有")}${h.lawsuit_note ? ` · ${esc(h.lawsuit_note)}` : ""}` : ""]]);
    }
    case "ownership": {
      const o = ownershipOf(d);
      const parking = o.parking_type ? [labelOf(PARKING_TYPES, o.parking_type), o.parking_no ? esc(o.parking_no) : "", o.parking_deeded ? t("独立产权") : "", o.parking_pin ? t("缴税号 {n}", { n: esc(o.parking_pin) }) : ""].filter(Boolean).join(" · ") : "";
      return dl([[t("缴税号"), o.pin ? esc(o.pin) : ""], [t("税务减免"), (o.tax_exemptions || []).length ? `${o.tax_exemptions.map((k) => labelOf(TAX_EXEMPTIONS, k)).join("、")}${o.tax_notes ? ` · ${esc(o.tax_notes)}` : ""}` : ""],
        [t("车位"), parking], [t("储物间"), o.storage_type ? `${labelOf(STORAGE_TYPES, o.storage_type)}${o.storage_no ? ` · ${esc(o.storage_no)}` : ""}` : ""], [t("屋顶"), o.roof_access ? t("可以上 / 有使用权") : ""]]);
    }
    case "emergency": { const em = emergencyOf(d); return dl(EMERGENCY_FIELDS.filter((f) => em[f.id]).map((f) => [`${f.icon} ${t(f.name)}`, `<span class="pre">${esc(em[f.id])}</span>`])); }
    case "features": { const n = Hh.FEATURES.filter((f) => (d.features || []).includes(f.id)).map((f) => t(f.name)); return n.length ? `<div class="prof-tags">${tags(n, true)}</div>` : `<p class="muted prof-empty">${t("未填")}</p>`; }
    case "materials": return dl([[t("外墙"), tags(names("exterior", d.exterior || []))], [t("屋面"), tags(d.roof ? names("roof", [d.roof]) : [])], [t("地面"), tags(names("flooring", d.flooring || []))]]);
    default: return none;
  }
}
/** 房产的类型 / 用途 / 状态三个下拉（原来在「编辑房产」里，现在放进资料的「地区、房型与用途」） */
function propSelects(p) {
  const B = window.BILLS, opts = (obj, cur) => Object.entries(obj).map(([k, n]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${t(n)}</option>`).join("");
  return `<label class="span-2">${t("房产名称")}<input name="prop_name" required maxlength="40" placeholder="${t("例如：芝加哥的家 / 出租房 1")}" value="${esc(p?.name || "")}"></label>
    <label>${t("类型")}<select name="prop_kind">${opts(B.PROPERTY_KINDS, p?.kind || "other")}</select></label>
    <label>${t("用途")}<select name="prop_role">${opts(B.PROPERTY_ROLES, p?.role || "owner_occupied")}</select></label>
    <label class="span-2">${t("状态")}<select name="prop_status">${opts(window.DEALS.PROPERTY_STATUS, p?.status || "owned")}</select><small>${t("看房或签约阶段可先建房产；买卖和退租在“房屋 → 交易”里走流程")}</small></label>`;
}
/** 单个分区的表单页：只渲染这一块的字段，保存后回到分区列表 */
function viewProfileSection(sec) {
  const d = houseDraft(), Hh = H();
  const types = Hh.HOUSE_TYPES[d.region] || [];
  const check = (name, list, sel) => list.map((x) => `<label class="check"><input type="checkbox" name="${name}" value="${x.id}" ${sel.includes(x.id) ? "checked" : ""}><span>${esc(t(x.name))}</span></label>`).join("");
  const thisYear = new Date().getFullYear();
  const meta = PROFILE_SECTIONS.find((s) => s.id === sec);
  const np = isNewProp(), rv = np && state.route?.q?.get("rv") === "1";   // 添加房产向导：全程在内存草稿里，确认后才建（house-new.js）
  if (np && !canManageHome()) return `<div class="panel empty"><strong>${t("只有家主可以新增房产")}</strong></div>`;
  const steps = np && !rv ? newSteps(sec) : "";
    const body = {
    type: () => `
        <fieldset>
          <legend>${t("地区")}</legend>
          <div class="seg-radio">${Object.values(Hh.REGIONS).map((r) => `<label class="radio-pill"><input type="radio" name="region" value="${r.id}" ${d.region === r.id ? "checked" : ""}><span>${t(r.name)}<small>${t(r.hint)}</small></span></label>`).join("")}</div>
          <p class="hint">${t("决定房型、材料和耗材推荐用哪一套；和显示单位的地区设置相互独立。")}</p>
        </fieldset>
        <fieldset>
          <legend>${t("房型")}</legend>
          <div class="type-grid">${types.map((x) => `<label class="type-card"><input type="radio" name="house_type" value="${x.id}" ${d.house_type === x.id ? "checked" : ""}>
            <span class="type-body"><span class="type-ico" aria-hidden="true">${x.icon}</span><b>${esc(t(x.name))}</b>${lang === "en" ? "" : `<small>${esc(x.en)}</small>`}<em>${esc(t(x.desc))}</em></span></label>`).join("")}</div>
          <p class="hint">${t("切换房型会按该房型重新预选设施，可以再调整。")}</p>
        </fieldset>
        <fieldset>
          <legend>${t("房产类型与用途")}</legend>
          <div class="form-grid">${propSelects(np ? d.prop : currentProp())}</div>
        </fieldset>`,
    address: () => `
        <fieldset>
          <legend>${t("地址与建成年份")}</legend>
          <div class="form-grid">
            <label class="span-2">${t("地址")}<input name="address" maxlength="120" placeholder="${t("街道、城市、州 / 省")}" value="${esc(d.address || "")}"></label>
            <label>${t("建成年份（可选）")}<input name="year_built" type="number" inputmode="numeric" min="1850" max="${thisYear}" placeholder="${t("例如 1998")}" value="${d.year_built ?? ""}"></label>
          </div>
        </fieldset>`,
    insurance: () => insuranceFieldset(d),
    hoa: () => hoaFieldset(d),
    emergency: () => emergencyFieldset(d),
    ownership: () => ownershipFieldset(d),
    features: () => `
        <fieldset>
          <legend>${t("家里有这些设施")}</legend>
          <div class="check-grid">${check("features", Hh.forRegion(Hh.FEATURES, d.region), d.features || [])}</div>
        </fieldset>`,
    materials: () => `
        <fieldset>
          <legend>${t("外墙材料（可多选）")}</legend>
          <div class="check-grid">${check("exterior", Hh.forRegion(Hh.MATERIALS.exterior, d.region), d.exterior || [])}</div>
        </fieldset>
        <fieldset>
          <legend>${t("屋面")}</legend>
          <div class="check-grid">
            <label class="check"><input type="radio" name="roof" value="" ${!d.roof ? "checked" : ""}><span>${t("不清楚 / 不用管")}</span></label>
            ${Hh.forRegion(Hh.MATERIALS.roof, d.region).map((m) => `<label class="check"><input type="radio" name="roof" value="${m.id}" ${d.roof === m.id ? "checked" : ""}><span>${esc(t(m.name))}</span></label>`).join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>${t("地面材料（可多选）")}</legend>
          <div class="check-grid">${check("flooring", Hh.forRegion(Hh.MATERIALS.flooring, d.region), d.flooring || [])}</div>
        </fieldset>`,
  }[sec]();
  return `
    <section class="section form-page house-form">
      ${sec === "insurance" ? autofillBar("insurance", "#houseForm") : ""}
      ${steps}
      <form id="houseForm" class="panel" data-sec="${sec}" ${np ? `data-newwiz="1" ${rv ? `data-rv="1"` : ""}` : "data-autosave"} novalidate>
        ${np ? "" : askInline({ id: `profile-${state.propertyId}-${sec}`, title: t(meta?.name || sec), question: PROFILE_ASK[sec] ? t(PROFILE_ASK[sec]) : t("这一块该填什么、去哪里找？"), context: () => askCtx.property(state.propertyId) })}
        ${body}
        <p id="houseFormError" class="form-error" role="alert"></p>
        ${np ? newBar(sec, rv) : `<div class="ui-acts sticky-actions">
          <a class="ui-btn" data-tone="ghost" href="${href("house", "profile")}" data-action="house-cancel">${t("取消")}</a>
          ${sec === "hoa" ? `<span class="hoa-mini">${t("每月总计")} <b data-hoa-total-mini>${money(hoaMonthly(hoaOf(d)).total)}</b></span>` : ""}
          <button type="submit" class="ui-btn" data-tone="primary">${t("保存")}</button>
        </div>`}
      </form>
    </section>`;
}
/** 产权、税务与车位 */
function ownershipFieldset(d) {
  const o = ownershipOf(d), sel = (name, list, cur) => `<select name="${name}">${list.map(([k, n]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select>`;
  return `<fieldset>
    <legend>${t("缴税号与减免")}</legend>
    <div class="form-grid">
      <label>${t("房产缴税号（PIN / 税号）")}<input name="own_pin" maxlength="40" placeholder="${t("例如 17-10-200-001-1234")}" value="${esc(o.pin || "")}"><small>${t("在房产税账单或县评估办网站上能查到；一个单元一个号")}</small></label>
      <div class="span-2 form-field"><span class="field-label">${t("已申请的税务减免")}</span><div class="check-grid">${TAX_EXEMPTIONS.map(([k, n]) => `<label class="check"><input type="checkbox" name="own_tax" value="${k}" ${(o.tax_exemptions || []).includes(k) ? "checked" : ""}><span>${t(n)}</span></label>`).join("")}</div><small>${t("库克县等地自住减免要主动申请、换房后重新申请；老年减免每年续")}</small></div>
      <label class="span-2">${t("说明")}${noteArea("own_tax_notes", o.tax_notes, t("例如：2026 年起自住减免已生效；老年冻结 2027 再续"))}</label>
    </div>
  </fieldset>
  <fieldset>
    <legend>${t("车位")}</legend>
    <div class="form-grid">
      <label>${t("车位类型")}${sel("own_parking_type", [["", t("未填")], ...PARKING_TYPES], o.parking_type || "")}</label>
      <label>${t("车位编号")}<input name="own_parking_no" maxlength="40" placeholder="${t("例如 P-12 / 2 个")}" value="${esc(o.parking_no || "")}"></label>
      <label class="check-inline span-2"><input type="checkbox" name="own_parking_deeded" ${o.parking_deeded ? "checked" : ""}><span>${t("车位有独立产权（deeded）——转手时单独过户，常有自己的缴税号")}</span></label>
      <label>${t("车位缴税号（有独立产权才有）")}<input name="own_parking_pin" maxlength="40" value="${esc(o.parking_pin || "")}"></label>
    </div>
  </fieldset>
  <fieldset>
    <legend>${t("储物与屋顶")}</legend>
    <div class="form-grid">
      <label>${t("储物间")}${sel("own_storage_type", [["", t("未填")], ...STORAGE_TYPES], o.storage_type || "")}</label>
      <label>${t("储物间编号")}<input name="own_storage_no" maxlength="40" value="${esc(o.storage_no || "")}"></label>
      <label class="check-inline span-2"><input type="checkbox" name="own_roof" ${o.roof_access ? "checked" : ""}><span>${t("可以上屋顶 / 有屋顶露台使用权")}</span></label>
    </div>
  </fieldset>`;
}
/** 概览里的「产权、税务与车位」参考块（填了才显示） */
function ownershipBlock(p) {
  const o = ownershipOf(p);
  const has = o.pin || o.parking_type || o.storage_type || (o.tax_exemptions || []).length || o.roof_access; if (!has) return "";
  const row = (k, v) => (v ? `<div class="fact wide"><dt>${k}</dt><dd>${v}</dd></div>` : "");
  const parking = o.parking_type ? [labelOf(PARKING_TYPES, o.parking_type), o.parking_no ? esc(o.parking_no) : "", o.parking_deeded ? t("独立产权") : "", o.parking_pin ? t("缴税号 {n}", { n: esc(o.parking_pin) }) : ""].filter(Boolean).join(" · ") : "";
  const hint = [o.pin ? t("PIN {n}", { n: o.pin }) : "", o.parking_type ? labelOf(PARKING_TYPES, o.parking_type) : "", (o.tax_exemptions || []).length ? t("减免 {n} 项", { n: o.tax_exemptions.length }) : ""].filter(Boolean).join(" · ");
  return refSection("house-ownership", { title: `📜 ${t("产权、税务与车位")}`, hint, body: `<p style="margin:0 0 6px;text-align:right"><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "profile")}?sec=ownership">${t("修改")}</a></p>
    <dl class="fact-grid one">
      ${row(t("缴税号"), o.pin ? esc(o.pin) : "")}
      ${row(t("税务减免"), (o.tax_exemptions || []).length ? `${o.tax_exemptions.map((k) => labelOf(TAX_EXEMPTIONS, k)).join("、")}${o.tax_notes ? ` · ${esc(o.tax_notes)}` : ""}` : "")}
      ${row(t("车位"), parking)}
      ${row(t("储物间"), o.storage_type ? `${labelOf(STORAGE_TYPES, o.storage_type)}${o.storage_no ? ` · ${esc(o.storage_no)}` : ""}` : "")}
      ${row(t("屋顶"), o.roof_access ? t("可以上 / 有使用权") : "")}
    </dl>` });
}
/** 应急信息与关键位置：全是文本，爆水管 / 跳闸时家人打开手机就能看 */
function emergencyFieldset(d) {
  const em = emergencyOf(d);
  const field = (f) => f.multi
    ? `<label class="span-2">${f.icon} ${t(f.name)}<textarea name="em_${f.id}" rows="3" maxlength="1000" placeholder="${esc(t(f.ph))}">${esc(em[f.id] || "")}</textarea></label>`
    : `<label class="${f.wide ? "span-2" : ""}">${f.icon} ${t(f.name)}<input name="em_${f.id}" maxlength="300" placeholder="${esc(t(f.ph))}" value="${esc(em[f.id] || "")}"></label>`;
  return `
        <fieldset>
          <legend>${t("应急信息与关键位置")}</legend>
          <p class="hint" style="margin-top:0">${t("爆水管、跳闸、闻到燃气味时要立刻找到的东西。写清“在哪、怎么关”，家人都能看到；密码只写存放处，别写密码本身。")}</p>
          <div class="form-grid">${EMERGENCY_FIELDS.map(field).join("")}</div>
        </fieldset>`;
}
function insuranceFieldset(d) {
  return `
        <fieldset>
          <legend>${t("房屋保险")}</legend>
          <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="insured" ${d.insured ? "checked" : ""}><span>${t("有房屋保险（租住填租客保险）")}</span></label>
          <div class="form-grid">
            <label>${t("保险公司")}<input name="insurance_provider" maxlength="60" placeholder="${t("例如：State Farm")}" value="${esc(d.insurance_provider || "")}"></label>
            <label>${t("保单号")}<input name="insurance_policy" maxlength="60" value="${esc(d.insurance_policy || "")}"></label>
            <label>${t("生效日")}<input name="insurance_from" type="date" value="${esc(d.insurance_from || "")}"></label>
            <label>${t("到期日")}<input name="insurance_to" type="date" value="${esc(d.insurance_to || "")}"><small>${t("到期前 30 天提醒续保")}</small></label>
            <label class="span-2">${t("保障范围")}<input name="insurance_coverage" maxlength="200" placeholder="${t("例如：房屋 $400k、责任 $300k、自付额 $1,000")}" value="${esc(d.insurance_coverage || "")}"></label>
            ${premiumReadonly(d)}
          </div>
          <h4 class="sub-legend">${t("理赔代理")}<small>${t("出险时直接联系的人，概览里可一键拨打 / 发邮件")}</small></h4>
          <div class="form-grid">
            <label>${t("代理 / 经纪人")}<input name="insurance_agent" maxlength="60" placeholder="${t("姓名或办公室")}" value="${esc(d.insurance_agent || "")}"></label>
            <label>${t("理赔电话")}<input name="insurance_phone" type="tel" maxlength="40" value="${esc(d.insurance_phone || "")}"></label>
            <label class="span-2">${t("理赔邮箱")}<input name="insurance_email" type="email" maxlength="120" value="${esc(d.insurance_email || "")}"></label>
          </div>
          <p class="hint">${t("只记摘要，不存保单文件；保费以账单里的“房屋保险”为准（缴费提醒也在那里），这里负责到期续保提醒。")}</p>
        </fieldset>`;
}
/** 资料表单里的年保费：只读，来自保险账单；旧值放在隐藏字段里原样保存（不丢），并给「创建账单」 */
function premiumReadonly(d) {
  const pr = insurancePremium(curPid(), d);
  const val = pr.amount != null ? `<b>${money(pr.amount)}</b>` : `<span class="muted">${t("未填")}</span>`;
  const link = amountSource(pr.src, pr.bill, "insurance_home", curPid(), { amount: pr.src === "profile" ? pr.amount : null, freq: "annual", name: t("房屋保险"), payee: d.insurance_provider || "" });
  return `<input type="hidden" name="insurance_premium" value="${d.insurance_premium ?? ""}">
    <div class="form-field ro-field"><span class="field-label">${t("年保费")}</span><span>${val} · ${link}</span><small>${t("金额在账单里改：账单是唯一来源，预算和现金流都按它算")}</small></div>`;
}
