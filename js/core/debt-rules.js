/* 借贷（财务 P2，迁移 058）的规则：类型、方向、账单分类 ↔ 贷款类型、还款拆分后各部分记到哪个花费分类 / 性质。
 * 纯函数，不碰 DOM / state / Store，node 里能直接 import 测试；数据库那边的同一份规则在 migrations/058_debt_lending.sql（数据迁移）。
 * 设计见 docs/design-debt-lending.md。 */

/** 贷款类型：group = 资产融资（asset）/ 个人借贷（personal）；role = 默认的融资关系；secured = 默认以资产抵押；bill = 对应的周期性账单分类 */
export const DEBT_CATS = {
  mortgage:         { name: "房贷",         icon: "🏦", group: "asset",    target: "property", role: "purchase_financing", secured: true,  bill: "mortgage" },
  heloc:            { name: "HELOC 房屋净值信用额度", icon: "🏠", group: "asset", target: "property", role: "equity_loan", secured: true, bill: "mortgage" },
  home_equity:      { name: "房屋净值贷款", icon: "🏠", group: "asset",    target: "property", role: "equity_loan",        secured: true,  bill: "mortgage" },
  auto_loan:        { name: "车贷",         icon: "🚙", group: "asset",    target: "vehicle",  role: "purchase_financing", secured: true,  bill: "car_loan" },
  student_loan:     { name: "学生贷款",     icon: "🎓", group: "asset",    target: null,       role: null,                 secured: false, bill: "student_loan" },
  personal_loan:    { name: "个人贷款 / 分期", icon: "🏧", group: "asset", target: null,       role: null,                 secured: false, bill: "personal_loan" },
  credit_line:      { name: "信用额度",     icon: "💳", group: "asset",    target: null,       role: null,                 secured: false, bill: "personal_loan" },
  other:            { name: "其他贷款",     icon: "📄", group: "asset",    target: null,       role: null,                 secured: false, bill: "personal_loan" },
  personal_lending: { name: "亲友借贷",     icon: "🤝", group: "personal", target: null,       role: null,                 secured: false, bill: null },
};
export const DEBT_CAT_IDS = Object.keys(DEBT_CATS);
export const debtCat = (id) => DEBT_CATS[id] || DEBT_CATS.other;
export const isPersonalDebt = (d) => d?.category === "personal_lending";
/** 页内标签：资产融资 = 除亲友借贷以外的全部（房贷、车贷、学生贷款、分期……），个人借贷 = 亲友之间 */
export const debtGroup = (d) => (isPersonalDebt(d) ? "personal" : "asset");

export const DIRECTIONS = { payable: { name: "借入（我欠）", short: "借入" }, receivable: { name: "借出（别人欠我）", short: "借出" } };
export const STATUSES = { active: { name: "还款中", cls: "b-ok" }, overdue: { name: "逾期", cls: "b-out" }, paid_off: { name: "已还清", cls: "" }, written_off: { name: "已核销", cls: "" }, closed: { name: "已关闭", cls: "" } };
export const ROLES = { purchase_financing: "购买融资", refinancing: "再融资", equity_loan: "净值贷款", repair_financing: "装修 / 维修融资" };
export const FREQS = { monthly: "每月", biweekly: "每两周", semimonthly: "每月两次", weekly: "每周", quarterly: "每季度", semiannual: "每半年", annual: "每年", none: "不定期 / 到期一次还" };
export const TXN_TYPES = {
  disbursement:        { name: "放款 / 借出", sign: +1 },
  principal_repayment: { name: "还款（本金）", sign: -1 },
  interest_payment:    { name: "付利息",     sign: 0 },
  interest_income:     { name: "收利息",     sign: 0 },
  fee:                 { name: "手续费",     sign: 0 },
  escrow:              { name: "Escrow",     sign: 0 },
  adjustment:          { name: "调整",       sign: +1 },   // principal_amount 带符号：+ 增加余额，− 减少
  write_off:           { name: "核销",       sign: -1 },
};
/** 已结束（不再提醒、不算未还） */
export const isClosedStatus = (s) => ["paid_off", "written_off", "closed"].includes(s);

/** 周期性账单分类 → 贷款类型（迁移和「从账单建贷款」用）；不是贷款类账单返回 null。信用卡是循环额度（第三期的余额），不转 */
export const BILL_TO_DEBT = { mortgage: "mortgage", car_loan: "auto_loan", student_loan: "student_loan", personal_loan: "personal_loan", heloc: "heloc", home_equity: "home_equity" };
export const debtCatOfBill = (billCat) => BILL_TO_DEBT[billCat] || null;
export const isLoanBillCat = (billCat) => !!BILL_TO_DEBT[billCat];
/** 账单频率 → 还款频率（custom 按间隔月数） */
export function freqOfBill(b) {
  if (["weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"].includes(b?.frequency)) return b.frequency;
  if (b?.frequency === "custom") return { 3: "quarterly", 6: "semiannual", 12: "annual" }[b.interval_months] || "monthly";
  return "none";
}

/* ── 还款拆分后，各部分记成什么花费（ledger_v / spend_rollup / 统计都按 purchases 的分类 + 性质算，所以拆成两行 purchases） ──
 * 主行（bill_payments.purchase_id 指的那行）= 利息 + Escrow + 滞纳金：
 *   房贷 / HELOC → bill_mortgage（房产住房 · 房贷，日常消费）——Escrow 部分就是房产税 / 房屋保险，Escrow 账单本身不记缴费（不重复算）
 *   车贷 → loan_interest_auto（生活消费 · 交通 · 车贷利息）
 *   其他 → bill_<分类>（财务及其他 · 贷款利息与手续费）
 * 本金行 = bill_<分类>，性质 financing（融资 / 还本）：算现金流出（财务桶），不算消费、不进「日常」「含住房」 */
export function interestLeafOf(billCat, debtCategory = null) {
  if (debtCategory === "auto_loan" || (!debtCategory && billCat === "car_loan")) return "loan_interest_auto";
  return `bill_${billCat}`;
}
export const principalLeafOf = (billCat) => `bill_${billCat}`;
/** 亲友借贷的本金往来（借出、还给对方）：财务及其他 · 借贷本金，默认性质 = 融资 */
export const DEBT_PRINCIPAL_LEAF = "debt_principal";
/** 亲友借贷付的利息 */
export const DEBT_INTEREST_LEAF = "life_fees";

/* ── 演示数据的一次性迁移（和 058 的数据迁移同一套规则；云端由 SQL 做） ──
 * db = DemoStore.db；返回新建的贷款条数。stable key = source_key，重复执行不会重复建 */
export function migrateLegacyDebts(db, { uid, today, vehicleName = (a) => a.name }) {
  db.debt_accounts ||= []; db.debt_transactions ||= [];
  const have = new Set(db.debt_accounts.map((d) => d.source_key).filter(Boolean));
  const haveTx = new Set(db.debt_transactions.map((x) => x.source_key).filter(Boolean));
  const now = new Date().toISOString();
  let n = 0;
  const vehicles = (db.assets || []).filter((a) => a.kind === "vehicle");
  const proposeVehicle = (bill) => {
    const nameHit = vehicles.filter((a) => { const v = String(vehicleName(a) || "").trim().toLowerCase(); return v.length >= 2 && String(bill.name || "").toLowerCase().includes(v); });
    if (nameHit.length === 1) return nameHit[0].id;
    const fin = vehicles.filter((a) => a.vehicle?.status === "financed");
    return fin.length === 1 ? fin[0].id : null;
  };
  for (const b of db.bills || []) {
    const cat = debtCatOfBill(b.category); if (!cat || b.direction === "receivable") continue;
    const key = `bill:${b.id}`;
    if (!have.has(key)) {
      const pays = (db.bill_payments || []).filter((p) => p.bill_id === b.id).map((p) => p.paid_on).filter(Boolean).sort();
      const prop = (db.properties || []).find((p) => p.id === b.property_id);
      const onProp = ["mortgage", "heloc", "home_equity"].includes(cat);
      const asset = cat === "auto_loan" ? proposeVehicle(b) : null;
      const status = !b.active ? "closed" : (b.ends_on && b.ends_on < today) || (onProp && prop && (prop.archived || ["sold", "moved_out"].includes(prop.status))) ? "paid_off" : "active";
      const d = { id: uid(), name: b.name, category: cat, direction: "payable", counterparty_name: b.payee || null, person_id: null, lender_card_id: null, original_principal: null,
        currency: b.currency || "USD", interest_rate: null, term_months: null, start_date: pays[0] || (b.created_at || now).slice(0, 10), maturity_date: null,
        payment_frequency: freqOfBill(b), scheduled_payment: b.typical_amount ?? null, opening_balance: null, opening_balance_on: null, status,
        property_id: onProp ? b.property_id || null : null, asset_id: asset, financing_role: debtCat(cat).role, secured: debtCat(cat).secured, link_confirmed: !asset,
        source_key: key, notes: null, created_by: "demo", created_at: now, updated_at: now };
      db.debt_accounts.push(d); have.add(key); n++;
    }
    if (!b.debt_id) b.debt_id = db.debt_accounts.find((d) => d.source_key === key)?.id || null;
  }
  for (const r of db.income_records || []) {
    if (!r.repay_required) continue;
    const key = `income:${r.id}`, principal = r.repay_amount || r.amount;
    const reps = (db.income_repayments || []).filter((p) => p.record_id === r.id);
    if (!have.has(key)) {
      const paid = reps.reduce((s, p) => s + Number(p.amount || 0), 0);
      db.debt_accounts.push({ id: uid(), name: String(r.source_name || "").slice(0, 60), category: "personal_lending", direction: "payable", counterparty_name: r.source_name, person_id: r.person_id || null,
        lender_card_id: null, original_principal: principal, currency: r.currency || "USD", interest_rate: null, term_months: null, start_date: r.received_on, maturity_date: r.repay_due_on || null,
        payment_frequency: "none", scheduled_payment: null, opening_balance: null, opening_balance_on: null, status: paid >= principal - 0.005 ? "paid_off" : "active",
        property_id: null, asset_id: null, financing_role: null, secured: false, link_confirmed: true, source_key: key, notes: r.notes || null, created_by: r.created_by || "demo", created_at: now, updated_at: now });
      have.add(key); n++;
    }
    const debt = db.debt_accounts.find((d) => d.source_key === key);
    if (!haveTx.has(key)) {
      db.debt_transactions.push({ id: uid(), debt_id: debt.id, txn_date: r.received_on, type: "disbursement", principal_amount: principal, interest_amount: 0, fee_amount: 0, escrow_amount: 0, total: r.amount,
        bill_payment_id: null, purchase_id: null, income_record_id: r.id, income_repayment_id: null, split_source: "schedule", source_key: key, notes: null, created_at: now, updated_at: now });
      haveTx.add(key);
    }
    for (const p of reps) {
      const k = `irep:${p.id}`; if (haveTx.has(k)) continue;
      db.debt_transactions.push({ id: uid(), debt_id: debt.id, txn_date: p.paid_on, type: "principal_repayment", principal_amount: Number(p.amount), interest_amount: 0, fee_amount: 0, escrow_amount: 0, total: Number(p.amount),
        bill_payment_id: null, purchase_id: p.purchase_id || null, income_record_id: null, income_repayment_id: p.id, split_source: "schedule", source_key: k, notes: p.method || p.notes || null, created_at: now, updated_at: now });
      haveTx.add(k);
      const pu = p.purchase_id && (db.purchases || []).find((x) => x.id === p.purchase_id);
      if (pu && !pu.nature) pu.nature = "financing";
    }
  }
  return n;
}
