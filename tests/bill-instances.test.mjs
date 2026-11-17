// 账单期展开 / 合计口径的测试（纯逻辑，不加载界面）：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { billInstances, summarize, nextDue, sortByDue, assetKeys, monthBounds, unpaidStatus, OVERDUE_CAP } from "../js/bills/instances.js";
import { advanceDue } from "../js/bills/dates.js";

const TODAY = "2026-11-17";
const bill = (o = {}) => ({ id: "b1", name: "电费", category: "electric", active: true, ended: false, frequency: "monthly", next_due_on: "2026-11-22", est: 100, amount_type: "variable", pays: [], ...o });
let seq = 0;
const pay = (o = {}) => ({ id: `p${++seq}`, status: "paid", amount: 90, due_on: "2026-10-22", paid_on: "2026-10-20", ...o });
const one = (o = {}) => ({ id: "o1", kind: "medical", provider: "医院", patient: "Amy", due_on: "2026-11-30", owed: 400, paid: 200, balance: 200, status: "partial", open: true, visibility: "family", ...o });
const run = (recurring, onetime, range = monthBounds("2026-11")) => billInstances({ recurring, onetime }, { ...range, today: TODAY });

test("monthBounds：月末天数", () => {
  assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthBounds("2026-11", "2027-01"), { from: "2026-11-01", to: "2027-01-31" });
});

test("月付：范围内每个月一期，只展开范围", () => {
  assert.equal(run([bill()]).rows.length, 1);
  const r = run([bill()], [], monthBounds("2026-11", "2027-01")).rows;
  assert.deepEqual(r.map((x) => x.dueOn), ["2026-11-22", "2026-12-22", "2027-01-22"]);
});

test("月末 31 日截断、半年固定日期", () => {
  const rows = run([bill({ due_day: 31, next_due_on: "2026-11-30" })], [], monthBounds("2026-11", "2027-02")).rows;
  assert.deepEqual(rows.map((x) => x.dueOn), ["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
  const tax = bill({ frequency: "semiannual", due_dates: ["03-01", "08-01"], next_due_on: "2026-03-01", category: "property_tax" });
  assert.equal(advanceDue(tax, "2026-03-01"), "2026-08-01");
  assert.equal(advanceDue(tax, "2026-08-01"), "2027-03-01");
});

test("没缴的期从 next_due_on 起，之前的月份不凭空造逾期（刚建的账单）", () => {
  const { rows } = run([bill({ next_due_on: "2026-11-25" })], [], monthBounds("2026-06", "2026-11"));
  assert.deepEqual(rows.map((x) => x.dueOn), ["2026-11-25"]);
});

test("已缴的期按缴费记录；同一到期日不重复生成", () => {
  const b = bill({ next_due_on: "2026-12-22", pays: [pay({ due_on: "2026-11-22", paid_on: "2026-11-20", amount: 123.4 })] });
  const { rows } = run([b], [], monthBounds("2026-11", "2026-12"));
  assert.deepEqual(rows.map((x) => [x.dueOn, x.status, x.amount]), [["2026-11-22", "paid", 123.4], ["2026-12-22", "pending", 100]]);
  const dup = bill({ next_due_on: "2026-11-22", pays: [pay({ due_on: "2026-11-22", amount: 80 })] });
  assert.equal(run([dup]).rows.length, 1);
});

test("缴费记录删掉后，这一期退回待缴（期是算出来的，不是存的）", () => {
  assert.equal(run([bill({ pays: [] })]).rows[0].status, "soon");
});

test("滞纳金计入已缴金额；跳过不计入合计", () => {
  const b = bill({ next_due_on: "2026-12-22", pays: [pay({ due_on: "2026-11-05", amount: 100, late_fee: 5 }), pay({ status: "skipped", due_on: "2026-11-10", amount: null })] });
  const S = summarize(run([b]).rows, { cur: "USD", today: TODAY });
  assert.equal(S.paid.amount, 105);
  assert.equal(S.skippedN, 1);
  assert.equal(S.total.n, 1);
});

test("逾期不受范围限制，且最多展开 OVERDUE_CAP 期（超出记 truncated）", () => {
  const { rows, truncated } = run([bill({ next_due_on: "2026-06-22" })]);   // 6~10 月都没记录，范围只有 11 月
  const overdue = rows.filter((x) => x.status === "overdue");
  assert.equal(overdue.length, OVERDUE_CAP);
  assert.deepEqual(overdue.map((x) => x.dueOn), ["2026-08-22", "2026-09-22", "2026-10-22"]);
  assert.equal(truncated, 2);
  assert.ok(rows.some((x) => x.dueOn === "2026-11-22"));
});

test("自动扣款：过了到期日没记录 = 待核对，不算逾期，但仍在剩余里", () => {
  const { rows } = run([bill({ autopay: true, next_due_on: "2026-11-10" })]);
  assert.equal(rows[0].status, "verify");
  const S = summarize(rows, { cur: "USD", today: TODAY });
  assert.equal(S.overdue.n, 0);
  assert.equal(S.remaining.amount, 100);
});

test("Escrow 代缴不计入合计、单独一栏；应收不出行；停用的账单没有新期但保留历史", () => {
  const esc = bill({ id: "e", pay_channel: "escrow", category: "property_tax" });
  const rent = bill({ id: "r", direction: "receivable" });
  const off = bill({ id: "x", active: false, pays: [pay({ due_on: "2026-11-03", amount: 50 })] });
  const { rows } = run([esc, rent, off]);
  const S = summarize(rows, { cur: "USD", today: TODAY });
  assert.equal(rows.filter((r) => r.billId === "r").length, 0);
  assert.equal(S.escrow.n, 1);
  assert.equal(S.total.n, 1);   // 只有停用账单的历史缴费
  assert.equal(S.total.amount, 50);
});

test("恒等式：合计 = 已缴 + 剩余（含部分已付、估算、一次性）", () => {
  const rec = [bill({ next_due_on: "2026-11-05", est: 120.5 }), bill({ id: "b2", pays: [pay({ due_on: "2026-11-02", amount: 70.25 })], next_due_on: "2026-12-02" })];
  const { rows } = run(rec, [one(), one({ id: "o2", status: "paid", owed: 300, paid: 300, balance: 0, open: false, due_on: "2026-11-12" })]);
  const S = summarize(rows, { cur: "USD", today: TODAY });
  assert.equal(S.total.amount, Math.round((S.paid.amount + S.remaining.amount) * 100) / 100);
  assert.equal(S.partial.n, 1);
  assert.equal(S.paid.n, 2);    // 已结清：b2 那条 + o2；部分已付不计入已缴笔数
  assert.equal(S.estimatedN, 1);
});

test("一次性：逾期优先于部分已付；等保险理赔、金额未知不乱猜", () => {
  assert.equal(run([], [one({ due_on: "2026-11-30" })]).rows[0].status, "partial");
  assert.equal(run([], [one({ due_on: "2026-11-01" })]).rows[0].status, "overdue");
  const unk = run([], [one({ owed: null, paid: 0, balance: null, status: "awaiting_insurance", open: true })]).rows[0];
  assert.equal(unk.status, "awaiting_insurance");
  assert.equal(unk.amountUnknown, true);
  assert.equal(unk.amount, 0);
});

test("一次性逾期的账单即使到期日在范围之前也出现", () => {
  const rows = run([], [one({ due_on: "2026-08-01" })]).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "overdue");
});

test("私密账单：没权限的人行和合计里都不含", () => {
  const priv = one({ visibility: "private" });
  const r = billInstances({ onetime: [priv] }, { ...monthBounds("2026-11"), today: TODAY, canSee: (b) => b.visibility !== "private" });
  assert.equal(r.rows.length, 0);
  assert.equal(run([], [priv]).rows[0].isPrivate, true);
});

test("币种：只汇总当前币种，其余计数提示", () => {
  const S = summarize(run([bill(), bill({ id: "c", currency: "CNY" })]).rows, { cur: "USD", today: TODAY });
  assert.equal(S.total.n, 1);
  assert.equal(S.otherCurrency, 1);
});

test("即将到期 = 7 天内未缴（含今天），逾期另算；宽限期内不算逾期", () => {
  const { rows } = run([bill({ next_due_on: "2026-11-17", id: "a" }), bill({ next_due_on: "2026-11-24", id: "b" }), bill({ next_due_on: "2026-11-25", id: "c" }), bill({ next_due_on: "2026-11-10", id: "d" })]);
  const S = summarize(rows, { cur: "USD", today: TODAY });
  assert.equal(S.soon.n, 2);    // 17 号（今天）和 24 号（正好 7 天）
  assert.equal(S.overdue.n, 1);
  assert.equal(unpaidStatus({ dueOn: "2026-11-10", graceDays: 10 }, TODAY), "due");
});

test("默认排序：没缴的到期近的在前（逾期最前），已缴放最后", () => {
  const { rows } = run([bill({ id: "a", name: "A", next_due_on: "2026-11-28" }), bill({ id: "b", name: "B", next_due_on: "2026-11-05" }), bill({ id: "c", name: "C", next_due_on: "2026-12-30", pays: [pay({ due_on: "2026-11-01" })] })]);
  assert.deepEqual(sortByDue(rows).map((r) => `${r.name}:${r.status}`), ["B:overdue", "A:pending", "C:paid"]);
});

test("下一笔到期：今天起最近一笔没缴的", () => {
  const { rows } = run([bill({ id: "a", next_due_on: "2026-11-28" }), bill({ id: "b", next_due_on: "2026-11-05" }), bill({ id: "c", next_due_on: "2026-11-20", name: "水" })], [], monthBounds("2026-11", "2026-12"));
  assert.equal(nextDue(rows, { today: TODAY, cur: "USD" }).name, "水");
  assert.equal(nextDue([], { today: TODAY }), null);
});

test("资产键：房产 / 车辆 / 资产 / 医疗 / 项目 / 通用", () => {
  assert.deepEqual(assetKeys({ property_id: "p1", category: "electric" }, "recurring"), ["property:p1"]);
  assert.deepEqual(assetKeys({ category: "insurance_auto" }, "recurring"), ["vehicle"]);
  assert.deepEqual(assetKeys({ category: "car_loan", asset_id: "v1" }, "recurring"), ["asset:v1", "vehicle"]);
  assert.deepEqual(assetKeys({ kind: "project", property_id: "p1" }, "onetime"), ["property:p1", "project"]);
  assert.deepEqual(assetKeys({ kind: "medical", patient_id: "m1" }, "onetime"), ["medical", "person:m1"]);
  assert.deepEqual(assetKeys({ category: "subscription" }, "recurring"), ["general"]);
});

// ── 账单 ↔ 资产挂靠建议 ──
import { suggestAssetLinks, assetChoices } from "../js/bills/asset-suggest.js";
const car = (id, name) => ({ id, name, kind: "vehicle" });

test("挂靠建议：账单名里恰好含一辆车的名字才建议；多辆 / 零辆 / 已挂的不建议", () => {
  const assets = [car("v1", "Honda Odyssey"), car("v2", "Tesla"), { id: "e1", name: "Furnace", kind: "equipment" }, car("v3", "X")];
  const bills = [
    bill({ id: "1", name: "Honda Odyssey 车险", category: "insurance_auto" }),
    bill({ id: "2", name: "车贷", payee: "Tesla Finance", category: "car_loan" }),
    bill({ id: "3", name: "Honda Odyssey + Tesla 合并保单", category: "insurance_auto" }),
    bill({ id: "4", name: "车险", category: "insurance_auto" }),
    bill({ id: "5", name: "Honda Odyssey 车险", category: "insurance_auto", asset_id: "v1" }),
    bill({ id: "6", name: "Honda Odyssey 车险（停用）", category: "insurance_auto", active: false }),
    bill({ id: "7", name: "Honda Odyssey 订阅", category: "subscription" }),
    bill({ id: "8", name: "X 车险", category: "insurance_auto" }),   // 车名只有 1 个字：不猜
  ];
  assert.deepEqual(suggestAssetLinks(bills, assets).map((s) => [s.billId, s.assetId]), [["1", "v1"], ["2", "v2"]]);
});

test("关联资产下拉：只列车辆和设备，车辆在前；已选的旧值保留", () => {
  const assets = [{ id: "e1", name: "Furnace", kind: "equipment" }, { id: "t1", name: "Drill", kind: "tool" }, car("v1", "Car")];
  assert.deepEqual(assetChoices(assets).map((a) => a.id), ["v1", "e1"]);
  assert.deepEqual(assetChoices(assets, "t1").map((a) => a.id), ["v1", "e1", "t1"]);
});

// ── 全部账单页：时间范围、筛选、排序 ──
import { rangeBounds, filterRows, sortRows, catKey } from "../js/bills/instances.js";

test("时间范围：本月 / 上月 / 下月 / 未来 30 天 / 近 3 个月 / 今年 / 全部", () => {
  assert.deepEqual(rangeBounds("m", TODAY), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(rangeBounds("pm", TODAY), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(rangeBounds("nm", "2026-12-20"), { from: "2027-01-01", to: "2027-01-31" });
  assert.deepEqual(rangeBounds("30d", TODAY), { from: "2026-11-17", to: "2026-12-17" });
  assert.deepEqual(rangeBounds("3", TODAY), { from: "2026-09-01", to: "2026-11-30" });
  assert.deepEqual(rangeBounds("y", TODAY), { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(rangeBounds("all", TODAY).to, "2027-11-17");
  assert.deepEqual(rangeBounds("乱写", TODAY), rangeBounds("m", TODAY));
});

test("筛选：搜索 / 资产 / 类型 / 分类 / 状态 / 付款方式；卡片的状态口径 = 列表", () => {
  const { rows } = run([bill({ id: "a", name: "电费", property_id: "p1", next_due_on: "2026-11-05" }), bill({ id: "c", name: "车险", category: "insurance_auto", autopay: true, next_due_on: "2026-11-20", payee: "GEICO" }),
    bill({ id: "e", name: "房产税", pay_channel: "escrow", category: "property_tax" })], [one(), one({ id: "o2", kind: "project", provider: "屋顶", status: "paid", owed: 500, paid: 500, balance: 0, open: false, due_on: "2026-11-02", property_id: "p1" })]);
  const ids = (f) => filterRows(rows, f).map((r) => r.billId).sort().join(",");
  assert.equal(ids({ q: "geico" }), "c");
  assert.equal(ids({ asset: "property:p1" }), "a,o2");
  assert.equal(ids({ asset: "vehicle" }), "c");
  assert.equal(ids({ type: "onetime" }), "o1,o2");
  assert.equal(ids({ cat: "o:project" }), "o2");
  assert.equal(ids({ cat: "r:insurance_auto" }), "c");
  assert.equal(ids({ status: "overdue" }), "a");
  assert.equal(ids({ status: "unpaid" }), "a,c,o1");          // Escrow 不算「未缴」；已缴不算
  assert.equal(ids({ status: "paid" }), "o2");
  assert.equal(ids({ pay: "auto" }), "c");
  assert.equal(ids({ pay: "escrow" }), "e");
  assert.equal(ids({ status: "乱写" }), "a,c,e,o1,o2");        // 不认识的条件当不限
  assert.equal(catKey({ kind: "onetime", category: "pet" }), "o:pet");
});

test("排序：到期日（默认）/ 金额 / 名称", () => {
  const { rows } = run([bill({ id: "a", name: "B", est: 50, next_due_on: "2026-11-25" }), bill({ id: "b", name: "A", est: 300, next_due_on: "2026-11-28" })]);
  assert.deepEqual(sortRows(rows).map((r) => r.name), ["B", "A"]);
  assert.deepEqual(sortRows(rows, "amount").map((r) => r.name), ["A", "B"]);
  assert.deepEqual(sortRows(rows, "name").map((r) => r.name), ["A", "B"]);
});

// ── 账单概览：按资产汇总、按月走势 ──
import { assetBreakdown, monthlySeries, seriesMonths } from "../js/bills/instances.js";

test("按资产汇总：主资产归组，口径和六张卡一致（不含 Escrow / 跳过）", () => {
  const { rows } = run([bill({ id: "a", property_id: "p1", next_due_on: "2026-11-05", est: 100 }), bill({ id: "c", category: "insurance_auto", next_due_on: "2026-11-20", est: 200 }), bill({ id: "e", pay_channel: "escrow", property_id: "p1" }), bill({ id: "g", category: "mobile", next_due_on: "2026-11-21", est: 50 })],
    [one({ kind: "project", property_id: "p1", owed: 500, paid: 100, balance: 400, status: "partial" })]);
  const g = assetBreakdown(rows, { cur: "USD" });
  assert.deepEqual(g.map((x) => [x.key, x.n, x.total, x.paid, x.remaining]), [["property:p1", 2, 600, 100, 500], ["vehicle", 1, 200, 0, 200], ["general", 1, 50, 0, 50]]);
  const S = summarize(rows, { cur: "USD", today: TODAY });
  assert.equal(g.reduce((s, x) => s + x.total, 0), S.total.amount);
});

test("按月走势：按到期月归；月份区间", () => {
  assert.deepEqual(seriesMonths("2026-11-17", 1, 1), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(seriesMonths("2026-01-05", 1, 0), ["2025-12", "2026-01"]);
  const { rows } = run([bill({ next_due_on: "2026-11-22", est: 100, pays: [pay({ due_on: "2026-10-22", amount: 90 })] })], [], monthBounds("2026-10", "2026-12"));
  const s = monthlySeries(rows, seriesMonths(TODAY, 1, 1), { cur: "USD" });
  assert.deepEqual(s.map((x) => [x.m, x.due, x.paid, x.n]), [["2026-10", 90, 90, 1], ["2026-11", 100, 0, 1], ["2026-12", 100, 0, 1]]);
});

// ── 没有任何日期的一次性账单：不丢，始终显示在未缴的最后 ──
test("一次性账单没有任何日期：始终显示、排在未缴最后；已付清的不出现", () => {
  const nodate = one({ id: "nd", due_on: null, bill_date: null, service_date: null, status: "open", paid: 0, balance: 400, open: true });
  const done = one({ id: "nd2", due_on: null, bill_date: null, service_date: null, status: "paid", paid: 400, balance: 0, open: false });
  const { rows } = run([bill({ id: "a", next_due_on: "2026-11-28" })], [nodate, done]);
  assert.deepEqual(sortByDue(rows).map((r) => r.billId), ["a", "nd"]);
  assert.equal(rows.find((r) => r.billId === "nd").undated, true);
  const other = run([], [nodate], monthBounds("2030-01")).rows;   // 换一个远处的范围也在
  assert.equal(other.length, 1);
});
