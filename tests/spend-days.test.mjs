// 花费明细的日期筛选：node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
import { dayLabel, dayWindow, mergeSpan } from "../js/stats/spend-days.js";

const now = new Date(2026, 10, 27, 15, 0);   // 2026-11-27
const iso = (d) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
test("近 7 天 = 含今天往前 7 天；不含明天", () => {
  const w = dayWindow({ dpre: "7" }, now);
  assert.equal(iso(w.from), "2026-11-21"); assert.equal(iso(w.to), "2026-11-28");
});
test("自选一天：from = 当天 0 点，to = 次日 0 点；起止写反会对调", () => {
  const w = dayWindow({ dpre: "c", dfrom: "2026-11-23", dto: "2026-11-23" }, now);
  assert.equal(iso(w.from), "2026-11-23"); assert.equal(iso(w.to), "2026-11-24");
  assert.equal(iso(dayWindow({ dpre: "c", dfrom: "2026-11-25", dto: "2026-11-20" }, now).from), "2026-11-20");
});
test("没选 / 选了自选但没填 = 没有日期筛选；只填一端就是开区间", () => {
  assert.equal(dayWindow({ dpre: "all" }, now), null); assert.equal(dayWindow({ dpre: "c" }, now), null);
  const w = dayWindow({ dpre: "c", dfrom: "2026-11-20" }, now); assert.equal(w.to, null); assert.equal(iso(w.from), "2026-11-20");
});
test("和月份范围取交集", () => {
  const span = { from: new Date(2026, 10, 1).toISOString(), to: new Date(2026, 11, 1).toISOString() };
  const m = mergeSpan(span, dayWindow({ dpre: "c", dfrom: "2026-11-10", dto: "2026-11-12" }, now));
  assert.equal(m.from, new Date(2026, 10, 10).toISOString()); assert.equal(m.to, new Date(2026, 10, 13).toISOString());
  assert.deepEqual(mergeSpan(span, null), span);
});
test("标签文字", () => {
  assert.equal(dayLabel({ dpre: "c", dfrom: "2026-11-23", dto: "2026-11-23" }, now), "2026-11-23");
  assert.equal(dayLabel({ dpre: "c", dfrom: "2026-11-21", dto: "2026-11-27" }, now), "2026-11-21 → 2026-11-27");
});
