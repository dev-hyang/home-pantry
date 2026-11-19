/* 自动填表：每种表单要问什么、怎么填。 */
import { num, todayISO } from "./util.js";
import { state } from "./state.js";
import { suggestAssetLinks } from "../bills/asset-suggest.js";
import { t } from "./i18n.js";
import { B, H, MED, SYSTEM, clean, idList, isDate, last4, numOr } from "./autofill-common.js";

/* ───────────── 每种表单：要问什么、怎么填 ───────────── */
export const KINDS = {
  asset: {
    label: "拍铭牌 / 保修卡 / 购买小票", hint: "设备机身上的铭牌、保修卡或购买凭证：识别品牌、型号、序列号、出厂年份、保修到期、价格",
    prompt(form) {
      const veh = form.classList.contains("is-vehicle");
      if (veh) return { system: SYSTEM, user: [
        "Photos of a VEHICLE: odometer / dashboard, registration card or sticker, insurance card, or window sticker.",
        "Return exactly: " + JSON.stringify({ brand: null, model: null, manufacture_year: null, odometer: null, plate: null, plate_state: null, registration_due: null, emissions_due: null,
          ins_provider: null, ins_policy: null, ins_from: null, ins_to: null, ins_agent: null, ins_phone: null, ins_coverage: null }),
        "odometer = the reading as a number (miles or km as shown). plate_state = 2-letter state/province if shown." ].join("\n") };
      const types = H().ASSET_TYPES.filter((x) => x.kind !== "vehicle").map((x) => ({ id: x.id, name: x.name }));
      return { system: SYSTEM, user: [
        "Photos of an appliance / equipment NAMEPLATE (rating label), a warranty card, or a purchase receipt for it.",
        `type = the best matching id from: ${idList(types)}; null if unsure.`,
        "manufacture_year: from a printed manufacture date; if you only derived it from the serial number code, still give it and set year_is_guess=true.",
        "installed_on = purchase or installation date if shown. warranty_until / labor_warranty_until = warranty end dates if shown.",
        "notes = one short line of key ratings (capacity, BTU, voltage, filter size, refrigerant); do not repeat brand/model/serial. name = short display name like \"Carrier furnace\".",
        "Return exactly: " + JSON.stringify({ type: null, name: null, brand: null, model: null, serial: null, manufacture_year: null, year_is_guess: false, installed_on: null,
          warranty_until: null, labor_warranty_until: null, purchase_price: null, notes: null }) ].join("\n") };
    },
    apply({ form, d, fill, isNew }) {
      const veh = form.classList.contains("is-vehicle"), yr = numOr(d.manufacture_year), yrOk = yr != null && yr >= 1950 && yr <= new Date().getFullYear();
      if (veh) {
        fill("brand", clean(d.brand), t("品牌")); fill("model", clean(d.model), t("型号"));
        if (yrOk) fill("manufacture_year", yr, t("年份"));
        const odo = numOr(d.odometer);
        if (odo != null && odo >= 0 && fill("veh_odometer", Math.round(odo), t("里程"), { force: true })) fill("veh_odometer_on", todayISO(), t("里程日期"), { force: true });
        fill("veh_plate", clean(d.plate).toUpperCase(), t("车牌")); fill("veh_plate_state", clean(d.plate_state).toUpperCase().slice(0, 2), t("州"));
        for (const [k, name, label] of [["registration_due", "veh_registration_due", "牌照到期"], ["emissions_due", "veh_emissions_due", "排放检测到期"], ["ins_from", "veh_ins_from", "保险起"], ["ins_to", "veh_ins_to", "保险止"]]) if (isDate(d[k])) fill(name, d[k], t(label));
        for (const [k, name, label] of [["ins_provider", "veh_ins_provider", "保险公司"], ["ins_policy", "veh_ins_policy", "保单号"], ["ins_agent", "veh_ins_agent", "代理"], ["ins_phone", "veh_ins_phone", "代理电话"], ["ins_coverage", "veh_ins_coverage", "保障"]]) fill(name, clean(d[k]), t(label));
        return;
      }
      const at = d.type ? H().assetType(d.type) : null;
      if (isNew && at && at.kind !== "vehicle") fill("type", at.id, t("类型"), { force: true });   // 触发类型联动：带出寿命、保养周期、默认负责方
      const nameEl = form.elements.name, auto = nameEl?.dataset.auto;
      const cur = H().assetType(form.elements.type?.value);
      const nm = clean(d.name) || [clean(d.brand), cur ? t(cur.name) : ""].filter(Boolean).join(" ");
      if (nm && nameEl && (!nameEl.value.trim() || nameEl.value === auto)) fill("name", nm.slice(0, 60), t("名称"), { force: true });
      fill("brand", clean(d.brand), t("品牌")); fill("model", clean(d.model), t("型号")); fill("serial", clean(d.serial), t("序列号"));
      if (yrOk) fill("manufacture_year", yr, t("出厂年份"), { guess: !!d.year_is_guess });
      if (isDate(d.installed_on) && d.installed_on <= todayISO()) fill("installed_on", d.installed_on, t("安装 / 购买日期"));
      if (isDate(d.warranty_until)) fill("warranty_until", d.warranty_until, t("保修到期"));
      if (isDate(d.labor_warranty_until)) fill("labor_warranty_until", d.labor_warranty_until, t("人工保修到期"));
      const price = numOr(d.purchase_price); if (price != null && price >= 0) fill("purchase_price", price, t("购买价格"));
      fill("notes", clean(d.notes).slice(0, 500), t("备注"));
    },
  },

  bill: {
    label: "拍账单", hint: "纸质账单、PDF 或邮件截图：识别账单名称、分类、收款方、账号尾号（只取后 4 位）、金额、周期、到期日",
    prompt() {
      const cats = B().CATEGORIES.map((c) => ({ id: c.id, name: c.name })), freqs = Object.entries(B().FREQUENCIES).map(([id, name]) => ({ id, name }));
      return { system: SYSTEM, user: [
        "Photos / screenshots of a BILL, statement or notice LETTER (utility, internet, insurance renewal, tax notice, mortgage, subscription, HOA...).",
        `category = best id from: ${idList(cats)}. frequency = best id from: ${idList(freqs)} (monthly if it is a regular monthly bill).`,
        "name = short bill name like \"Gas bill\". payee = who is paid. account_last4 = last 4 characters of the account number only. amount = amount due (number). due_date = the due date. autopay = true only if it says autopay/auto-pay/will be drafted.",
        "Return exactly: " + JSON.stringify({ name: null, category: null, payee: null, account_last4: null, amount: null, frequency: null, due_date: null, autopay: null, pay_url: null, currency: null, notes: null }) ].join("\n") };
    },
    apply({ form, d, fill, isNew }) {
      if (isNew && d.category && B().CATEGORIES.some((c) => c.id === d.category)) fill("category", d.category, t("分类"), { force: true });
      fill("name", clean(d.name).slice(0, 60), t("名称")); fill("payee", clean(d.payee).slice(0, 60), t("收款方"));
      const a4 = last4(d.account_last4); if (a4) fill("account_last4", a4, t("账号尾号"));
      const amt = numOr(d.amount); if (amt != null && amt >= 0) fill("typical_amount", Math.round(amt * 100) / 100, t("金额"));
      if (d.frequency && B().FREQUENCIES[d.frequency]) fill("frequency", d.frequency, t("周期"), { force: isNew });
      if (isDate(d.due_date)) fill("next_due_on", d.due_date, t("下次到期日"));
      if (d.autopay === true) fill("autopay", true, t("自动扣款"));
      if (/^https?:\/\//i.test(clean(d.pay_url))) fill("pay_url", clean(d.pay_url), t("缴费链接"));
      if (/^[A-Za-z]{3}$/.test(clean(d.currency))) fill("currency", clean(d.currency).toUpperCase(), t("币种"));
      fill("notes", clean(d.notes).slice(0, 500), t("备注"));
      // 车险 / 车贷这类：账单名或收款方里恰好有一辆车的名字，就挂到那辆车上（规则同账单清单里的「可能属于某辆车」）
      const hit = suggestAssetLinks([{ id: "scan", name: clean(d.name), payee: clean(d.payee), category: clean(d.category), active: true }], state.assets)[0];
      if (hit) fill("asset_id", hit.assetId, t("关联资产"));
    },
  },

  // 医疗 / 宠物 / 法律 / 装修账单：拍账单、保险说明（EOB）、发票；识别商家、日期、金额、保险已付、自付金额。不读诊断和治疗代码
  medbill: {
    label: "拍账单 / 保险说明（EOB）", hint: "医院、化验所、兽医、律所、承包商的账单或保险说明（EOB）：识别商家、患者、账单号、理赔号、日期、总额、保险已付、自付金额",
    prompt(form) {
      const kind = form.elements.kind?.value || "medical", K = MED()[kind] || MED().medical;
      const subs = K.subs.map(([id, name]) => ({ id, name }));
      return { system: SYSTEM, user: [
        `Photos / screenshots of a ${kind === "medical" ? "MEDICAL" : kind === "pet" ? "VET / PET-CARE" : kind === "legal" ? "LEGAL / TAX-PREPARATION" : kind === "travel" ? "TRAVEL BOOKING (airline, hotel, cruise, tour operator, rental car)" : "CONTRACTOR / PROJECT"} bill, statement or invoice${K.insurance ? ", or an insurance Explanation of Benefits (EOB)" : ""}.`,
        "provider = the business that billed (hospital, clinic, lab, vet, law firm, contractor). " + (K.insurance ? "patient = the person (or pet) the service was for. guarantor = the responsible party if shown. " : "patient = the client or project name if shown. "),
        `subkind = best id from: ${idList(subs)}; null if unsure.`,
        "bill_ref = statement / invoice / account number (copy exactly as printed, it is a reference not a secret). claim_ref = insurance claim number if shown.",
        "service_date = date of service. bill_date = statement / invoice date. due_on = payment due date.",
        "billed_amount = total charges before insurance. insurance_paid = amount the insurer paid. adjustment = contractual adjustment / discount / write-off total. patient_amount = what the patient (customer) owes now: 'patient responsibility', 'amount due' or 'balance due'.",
        "NEVER extract diagnoses, procedure / ICD codes, medications or any clinical details. notes should stay null unless there is a payment-plan or due-date remark worth keeping (one short line).",
        "Return exactly: " + JSON.stringify({ provider: null, patient: null, guarantor: null, subkind: null, bill_ref: null, claim_ref: null, insurer: null, service_date: null, bill_date: null, due_on: null,
          billed_amount: null, insurance_paid: null, adjustment: null, patient_amount: null, notes: null }) ].join("\n") };
    },
    apply({ form, d, fill }) {
      const kind = form.elements.kind?.value || "medical", K = MED()[kind] || MED().medical;
      fill("provider", clean(d.provider).slice(0, 60), t(K.provider)); fill("patient", clean(d.patient).slice(0, 40), t(K.who));
      if (K.guarantor) fill("guarantor", clean(d.guarantor).slice(0, 40), t("担保人"));
      if (d.subkind && K.subs.some(([id]) => id === d.subkind)) fill("subkind", d.subkind, t("小类"));
      fill("bill_ref", clean(d.bill_ref).slice(0, 60), t("账单号"));
      if (K.insurance) { fill("claim_ref", clean(d.claim_ref).slice(0, 60), t("理赔号")); fill("insurer", clean(d.insurer).slice(0, 60), t("保险公司")); }
      for (const [k, name, label] of [["service_date", "service_date", "就诊日期"], ["bill_date", "bill_date", "账单日期"], ["due_on", "due_on", "付款截止日"]]) if (isDate(d[k])) fill(name, d[k], t(label));
      for (const [k, name, label] of [["billed_amount", "billed_amount", K.billed], ["insurance_paid", "insurance_paid", "保险已付"], ["adjustment", "adjustment", "折扣 / 冲减"], ["patient_amount", "patient_amount", K.owed]]) {
        if (!K.insurance && k === "insurance_paid") continue;
        const n = numOr(d[k]); if (n != null && n >= 0) fill(name, Math.round(n * 100) / 100, t(label), { force: num(form.elements[name]?.value) === 0 });   // 表单默认是 0 的（保险已付、折扣）也要能填
      }
      fill("notes", clean(d.notes).slice(0, 500), t("备注"));
    },
  },

  maint: {
    label: "拍发票", hint: "维修 / 保养发票：识别日期、类型、花费、维修商、做了什么（车辆还有里程）",
    prompt() {
      return { system: SYSTEM, user: [
        "Photos of a service / repair INVOICE or work order for a home appliance, house system or vehicle.",
        "kind = one of: inspect (inspection only), service (maintenance), repair, replace (replaced a part/unit). done_on = service date. cost = total paid (number). vendor = company or technician. notes = one short line on what was done / parts. odometer = vehicle mileage if shown.",
        "Return exactly: " + JSON.stringify({ done_on: null, kind: null, cost: null, vendor: null, notes: null, odometer: null }) ].join("\n") };
    },
    apply({ form, d, fill }) {
      if (isDate(d.done_on) && d.done_on <= todayISO()) fill("done_on", d.done_on, t("日期"), { force: form.elements.done_on.value === todayISO() });
      if (d.kind && H().MAINT_KINDS[d.kind]) fill("kind", d.kind, t("类型"), { force: form.elements.kind.value === "service" });
      const cost = numOr(d.cost); if (cost != null && cost >= 0) fill("cost", Math.round(cost * 100) / 100, t("花费"));
      fill("vendor", clean(d.vendor).slice(0, 40), t("谁做的")); fill("notes", clean(d.notes).slice(0, 500), t("备注"));
      const odo = numOr(d.odometer); if (odo != null && odo >= 0) fill("odometer", Math.round(odo), t("里程"));
    },
  },

  insurance: {
    label: "拍保险单", hint: "保险单首页：只识别摘要（保险公司、保单号、起止日、保费、理赔电话），不存保单文件",
    prompt() {
      return { system: SYSTEM, user: [
        "Photos of the first page / declarations page of a HOME insurance policy.",
        "Only extract a summary. coverage = one short line (e.g. dwelling coverage amount). premium = annual premium as a number (if the premium is monthly, multiply by 12).",
        "Return exactly: " + JSON.stringify({ provider: null, policy: null, from: null, to: null, coverage: null, premium: null, agent: null, phone: null, email: null }) ].join("\n") };
    },
    apply({ d, fill }) {
      if (clean(d.provider) || clean(d.policy)) fill("insured", true, t("已投保"));   // “已投保”是个勾选框，不是被保险人姓名
      fill("insurance_provider", clean(d.provider).slice(0, 60), t("保险公司"));
      fill("insurance_policy", clean(d.policy).slice(0, 60), t("保单号"));
      if (isDate(d.from)) fill("insurance_from", d.from, t("保险起")); if (isDate(d.to)) fill("insurance_to", d.to, t("保险止"));
      fill("insurance_coverage", clean(d.coverage).slice(0, 120), t("保障"));
      const p = numOr(d.premium); if (p != null && p >= 0) fill("insurance_premium", Math.round(p * 100) / 100, t("年保费"));
      fill("insurance_agent", clean(d.agent).slice(0, 60), t("代理")); fill("insurance_phone", clean(d.phone).slice(0, 40), t("理赔电话"));
      if (/^\S+@\S+\.\S+$/.test(clean(d.email))) fill("insurance_email", clean(d.email), t("理赔邮箱"));
    },
  },

  item: {
    label: "拍包装 / 物品", hint: "药品、食品包装或一件家居耐用品：识别名称、分类、保质期（家居耐用品没有保质期）",
    prompt() {
      const cats = window.CATEGORIES.filter((c) => c.id !== "other").map((c) => ({ id: c.id, name: c.name, subs: c.subs }));
      return { system: SYSTEM, user: [
        "A photo of a product package / label (food, medicine, household supply) or of a durable item (clothing, tool, gear).",
        `category = best id from: ${cats.map((c) => `${c.id}=${c.name}[${(c.subs || []).join("/")}]`).join("; ")}. subcategory = one of that category's subcategories, or null.`,
        "name = short generic product name (include size/volume only if useful, e.g. \"Ibuprofen 200mg\"). expiry_date = best-before / EXP date if printed, else null (month-only dates: use the last day of that month).",
        "Return exactly: " + JSON.stringify({ name: null, category: null, subcategory: null, expiry_date: null, notes: null }) ].join("\n") };
    },
    apply({ form, d, fill }) {
      const catOk = d.category && window.CATEGORIES.some((c) => c.id === d.category);
      fill("name", clean(d.name).slice(0, 60), t("名称"));
      if (catOk && !form.elements.item_id.value) { fill("category", d.category, t("大类"), { force: true }); fill("subcategory", clean(d.subcategory), t("小类"), { force: true }); }
      if (isDate(d.expiry_date) && !form.classList.contains("is-gear")) fill("expiry_date", d.expiry_date, t("保质期至"));
      fill("notes", clean(d.notes).slice(0, 500), t("备注"));
    },
  },
};
// 车辆：识别逻辑和设备共用（按表单是不是车辆分支），只是按钮文案不同
KINDS.vehicle = { ...KINDS.asset, label: "拍里程表 / 行驶证 / 保险卡", hint: "里程表、登记证或行驶证、保险卡：识别当前里程、车牌、牌照和排放到期、保险公司和起止日" };
