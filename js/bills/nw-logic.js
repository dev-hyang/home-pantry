/* 净资产（财务 P3，迁移 059）· 读写与快照：余额历史、估值历史、每月快照三张小表启动时整表读进内存（state.balances / valuations / nwSnapshots），
 * 计算全在 js/stats/net-worth.js（纯函数）。这里把内存里的表拼成它的输入、写余额 / 估值、按月自动存快照。
 * 自动快照：有财务权限的人打开「财务」，本月还没有快照就在内存里算好写一行（source = auto）；本月里再打开、数字变了就更新这一行；
 * 手动「保存本月快照」/「重建某月」写 source = manual，自动的不再覆盖。不需要定时任务。设计见 docs/design-net-worth.md。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { todayISO } from "../core/util.js";
import { financeOk } from "../core/finance-access.js";
import { computeNetWorth, monthEnd, snapshotNeeded, toSnapshot } from "../stats/net-worth.js";

const cur = () => Units.region.currency;
export const STALE_DAYS = 60;
export const thisMonth = () => todayISO().slice(0, 7);

/** 读三张表；没执行迁移 059（表不存在）或没有财务权限：空，nwOk = false（净资产页给提示，资产页 / 卡页不显示余额区块） */
export async function loadNetWorth() {
  if (!financeOk()) { Object.assign(state, { balances: [], valuations: [], nwSnapshots: [], nwOk: false, nwErr: "" }); return; }
  try {
    const [balances, valuations, snaps] = await Promise.all([Store.listBalances(), Store.listValuations(), Store.listSnapshots()]);
    Object.assign(state, { balances: balances.map(normBal), valuations: valuations.map(normVal), nwSnapshots: snaps, nwOk: true, nwErr: "" });
  } catch (e) { Object.assign(state, { balances: [], valuations: [], nwSnapshots: [], nwOk: false, nwErr: e.message || String(e) }); }
}
const normBal = (b) => ({ ...b, balance: Number(b.balance) || 0 });
const normVal = (v) => ({ ...v, value: Number(v.value) || 0 });

/** 计算的输入：全是内存里的小表；借贷没读到（没执行 058）时贷款为空，页面上提示 */
export const nwInput = () => ({ cards: state.cards || [], balances: state.balances || [], properties: state.properties || [], assets: state.assets || [],
  valuations: state.valuations || [], debts: state.debtsOk ? state.debts || [] : [], txns: state.debtsOk ? state.debtTxns || [] : [] });
/** 现在的净资产（按今天） */
export const liveNetWorth = () => computeNetWorth(nwInput(), { asOf: todayISO(), cur: cur(), today: todayISO(), staleDays: STALE_DAYS, live: true });
/** 截至某月月底（重建快照）：余额 / 估值取那天及以前最新的、贷款只算那天以前的流水、房产 / 车辆按买卖日期 */
export const netWorthAt = (month) => computeNetWorth(nwInput(), { asOf: monthEnd(month), cur: cur(), today: todayISO(), staleDays: STALE_DAYS, live: false });
const hasData = (r) => r.accounts.some((a) => !a.missing) || r.equity.length > 0 || r.debts.length > 0;

/** 某账户 / 某资产的历史（新 → 旧） */
export const balancesOf = (cardId) => (state.balances || []).filter((b) => b.card_id === cardId).sort((a, b) => b.as_of.localeCompare(a.as_of));
export const valuationsOf = (kind, id) => (state.valuations || []).filter((v) => (kind === "property" ? v.property_id === id : v.asset_id === id)).sort((a, b) => b.as_of.localeCompare(a.as_of));
export const snapshotOf = (month) => (state.nwSnapshots || []).find((s) => s.month === month) || null;

export async function reloadNetWorth() { await loadNetWorth(); }

export async function saveBalance({ id = null, card_id, as_of, balance, notes = null, currency = null }) {
  await Store.saveBalance({ id, card_id, as_of, balance, notes, currency: currency || cur(), source: "manual" });
  await loadNetWorth();
}
export async function deleteBalance(id) { await Store.deleteBalance(id); await loadNetWorth(); }
export async function saveValuation({ id = null, kind, target, as_of, value, source = "manual", notes = null, currency = null }) {
  // 同一资产同一天只有一行（部分唯一索引）：已有就改那一行
  const same = id ? null : valuationsOf(kind, target).find((v) => v.as_of === as_of);
  await Store.saveValuation({ id: id || same?.id || null, property_id: kind === "property" ? target : null, asset_id: kind === "property" ? null : target, as_of, value, source, notes, currency: currency || cur() });
  await loadNetWorth();
}
export async function deleteValuation(id) { await Store.deleteValuation(id); await loadNetWorth(); }

/** 手动保存本月快照（覆盖本月，source = manual） */
export async function saveMonthSnapshot() {
  await Store.saveSnapshot(toSnapshot(liveNetWorth(), thisMonth(), "manual"));
  await loadNetWorth();
}
/** 重建过去某月：只用那个月月底以前的数据（见 netWorthAt），source = manual，meta.rebuilt = true */
export async function rebuildSnapshot(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > thisMonth()) throw new Error("month");
  const snap = month === thisMonth() ? toSnapshot(liveNetWorth(), month, "manual") : toSnapshot(netWorthAt(month), month, "manual", { rebuilt: true });
  await Store.saveSnapshot(snap);
  await loadNetWorth();
}
export async function deleteSnapshot(id) { await Store.deleteSnapshot(id); await loadNetWorth(); }

/** 自动快照：财务页每次画的时候调；条件不满足立即返回，写过一次同样的数字就不再写（snapshotNeeded 比对本月那一行） */
let autoBusy = false, autoFailed = null;   // 写失败（比如权限刚被收回）：这个月本次打开不再重试
export async function maybeAutoSnapshot() {
  if (autoBusy || autoFailed === thisMonth() || !state.nwOk || !state.debtsOk || !financeOk()) return false;
  const live = liveNetWorth(), m = thisMonth(), snap = toSnapshot(live, m, "auto");
  if (!snapshotNeeded(snapshotOf(m), snap, hasData(live))) return false;
  autoBusy = true;
  try { await Store.saveSnapshot(snap, { auto: true }); await loadNetWorth(); return true; }
  catch (e) { autoFailed = m; console.warn("[net-worth] auto snapshot", e.message); return false; }
  finally { autoBusy = false; }
}
