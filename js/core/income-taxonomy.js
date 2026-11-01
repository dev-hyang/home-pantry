/* ───────────── 收入分类 + 认定收入 + 现金流类型（收入一侧的唯一规则来源，和花费的 js/core/taxonomy.js 对称） ─────────────
 * income_records.kind 仍是一个「叶子」类型 id（payroll、interest、wire…），一个也不改写；这里把每个叶子挂到 5 个一级分类下，
 * 并决定这一笔里有多少算「收入」、多少只是「现金流入」。图表、筛选、记账下拉、CSV、数据库筛选参数（叶子 id 列表）都从这里读。
 * 设计见 docs/design-income-ledger.md。数据库视图 ledger_v（迁移 056）里有一份 SQL 镜像，给 SQL 报表用；应用里的统计一律按这里算。
 *
 * 一级分类：
 *   employment   工作收入        —— 收入
 *   investment   投资收益        —— 收入（利息、股息、已实现收益…）
 *   property     房产收入        —— 收入（租金、车位、储藏间…；卖房款不在这里）
 *   other_income 其他收入        —— 收入（退税、理赔、返现、报销、赠与、政府补助、副业…）
 *   capital      资本与资产流入  —— 只是现金流入，不算收入（卖房 / 卖股票的本金、借款、本金返还、自己账户转入、国际电汇…）
 *
 * 认定收入（recognized income）：
 *   · 需要还的（repay_required = 借款 / 要还的赠与）→ 一律当「借款到账」：收入 0，整笔是资本流入。
 *   · 填了「其中已实现收益」（income_amount，0 ≤ x ≤ amount）→ 收入 = 它，其余是资本流入（本金返还）。
 *   · 没填 → 收入类一级 = 整笔；资本流入 = 0。
 *   资本流入里填的收益算到哪：卖股票 / 卖房 / 已实现收益 → 投资收益（资本利得）；其余（二手出售等）→ 其他收入。
 * 自定义类型（_income_kinds，c_xxx）：parent = 一级分类 id；旧的大类（2026-10 之前）读的时候换算：
 *   work → 工作收入，invest → 投资收益，refund → 其他收入，other → 其他收入，transfer → 资本与资产流入（保守：看不出来的转账先不算收入）。 */
import { state } from "./state.js";
import { t } from "./i18n.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r2 = (v) => Math.round(v * 100) / 100;

/* ── 一级分类（income = 算不算收入） ── */
export const INC_L1S = [
  { id: "employment",   name: "工作收入",       icon: "💼", color: "#2c6a57", income: true },
  { id: "investment",   name: "投资收益",       icon: "📈", color: "#b07a1a", income: true },
  { id: "property",     name: "房产收入",       icon: "🏠", color: "#a0522d", income: true },
  { id: "other_income", name: "其他收入",       icon: "📥", color: "#7563c0", income: true },
  { id: "capital",      name: "资本与资产流入", icon: "🔁", color: "#64748b", income: false },
];
/* ── 内置叶子：[id, 名称, 图标, 颜色, 一级]；顺序 = 下拉 / 图表里的顺序。每个 id 只能出现一次 ── */
export const INC_LEAVES = [
  ["payroll", "基本工资", "💼", "#2c6a57", "employment"], ["bonus", "奖金 / 年终", "🎁", "#3f8f5a", "employment"], ["package", "雇主福利 / 福利包", "📦", "#5a9a7a", "employment"],
  ["overtime", "加班费", "⏱️", "#4a8a6a", "employment"], ["commission", "佣金 / 提成", "🤝", "#6aa07a", "employment"], ["rsu", "RSU / 股票薪酬", "📊", "#2f7f6f", "employment"],
  ["other_employment", "其他工作收入", "🧾", "#7aa58a", "employment"],
  ["interest", "利息 / 分红", "🏦", "#b07a1a", "investment"], ["dividends", "股息 / 基金分红", "💹", "#c08a1a", "investment"], ["bank_interest", "银行存款利息", "🏦", "#a06a10", "investment"],
  ["capital_gain", "已实现收益（资本利得）", "📈", "#d09a2a", "investment"], ["fund_dist", "基金分配", "🧺", "#b8862b", "investment"], ["bond_interest", "债券利息", "📜", "#9a7020", "investment"],
  ["rental", "租金收入", "🏠", "#a0522d", "property"], ["parking_income", "车位出租", "🅿️", "#b0623d", "property"], ["storage_income", "储藏间出租", "📦", "#c0724d", "property"],
  ["property_reimb", "房产相关报销 / 返还", "🧾", "#905030", "property"], ["other_property", "其他房产收入", "🏘️", "#b07a5a", "property"],
  ["tax_refund", "退税", "🧾", "#6b7280", "other_income"], ["insurance", "保险理赔", "🛡️", "#c75a85", "other_income"], ["cashback", "返现 / 奖励", "💳", "#3f6c8f", "other_income"],
  ["reimburse", "报销", "💵", "#d4694c", "other_income"], ["zelle", "Zelle / Venmo 转入", "👥", "#7563c0", "other_income"], ["gift", "个人赠与", "🎀", "#c0603a", "other_income"],
  ["gov_benefit", "政府补助 / 福利", "🏛️", "#5f7fa8", "other_income"], ["side_business", "副业收入", "🛠️", "#8a6d3b", "other_income"], ["other", "其他", "📥", "#8a948f", "other_income"],
  ["sale", "出售所得", "🏷️", "#8a5fb0", "capital"], ["stock_sale", "卖股票 / 基金所得", "📉", "#6b5fb0", "capital"], ["property_sale", "卖房所得", "🏡", "#5b4f90", "capital"],
  ["wire", "国际电汇", "🌐", "#3b7fc4", "capital"], ["loan_proceeds", "借款到账", "🏦", "#64748b", "capital"], ["returned_principal", "本金返还", "↩️", "#7a8494", "capital"],
  ["expense_refund", "支出退回", "🔙", "#8a94a4", "capital"], ["xfer_savings", "从储蓄账户转入", "🔁", "#5a6b7b", "capital"], ["xfer_invest", "从投资账户转入", "🔁", "#4a5b6b", "capital"],
];
/** 记录时可以填「其中已实现收益」的类型（表单里才显示那个框；规则本身对任何类型都成立） */
export const GAIN_KINDS = ["sale", "stock_sale", "property_sale", "capital_gain"];
/** 资本流入里认定的收益归哪个一级：卖股票 / 卖房 / 资本利得 → 投资收益，其余 → 其他收入 */
const GAIN_L1 = { stock_sale: "investment", property_sale: "investment", capital_gain: "investment" };
/** 自己账户之间转入（现金流方向 = internal，不是家庭外部的流入） */
export const INTERNAL_KINDS = ["xfer_savings", "xfer_invest"];
/** 旧的大类 id（2026-10 之前 _income_kinds[].parent、旧链接里的 g:xxx）→ 新的一级 */
export const LEGACY_INC_PARENT = { work: "employment", invest: "investment", refund: "other_income", transfer: "capital", other: "other_income" };
/** 2026-10 之前的「额外类型」（国际电汇、个人赠与）：只给旧链接 ex=1 换算用 */
export const LEGACY_EXTRA = ["wire", "gift"];

const L1_BY = new Map(INC_L1S.map((n) => [n.id, n]));
const BUILTIN = new Map(INC_LEAVES.map(([id, name, icon, color, l1]) => [id, { id, name, icon, color, l1, custom: false }]));
const CUSTOM_COLORS = ["#2f8f9d", "#9a6b3c", "#b0527a", "#6a8f2f", "#4f5fc0", "#c08a1a"];
/** 旧大类 / 新一级 → 新一级（不认识 = 其他收入） */
export const normParent = (p) => (L1_BY.has(p) ? p : LEGACY_INC_PARENT[p] || "other_income");

/** 自定义类型（存在预算设置 _income_kinds：{ id, name, icon, parent }），parent 已换算成新一级 */
export function customIncomeKinds() {
  const raw = state.budget?.cat_budgets?._income_kinds;
  return (Array.isArray(raw) ? raw : []).filter((k) => k && /^c_[a-z0-9]{1,20}$/.test(k.id)).map((k, i) => ({ ...k, rawParent: k.parent || null, parent: normParent(k.parent), color: k.color || CUSTOM_COLORS[i % CUSTOM_COLORS.length] }));
}
/** 全部叶子（内置 + 自定义），按一级排好；每个带 l1 */
export function incLeaves() {
  const cs = customIncomeKinds().map((k) => ({ id: k.id, name: k.name, icon: k.icon || "🏷️", color: k.color, l1: k.parent, custom: true }));
  return INC_L1S.flatMap((l1) => [...INC_LEAVES.filter((x) => x[4] === l1.id).map((x) => BUILTIN.get(x[0])), ...cs.filter((k) => k.l1 === l1.id)]);
}
export const incL1 = (id) => L1_BY.get(id) || null;
export const isIncL1 = (id) => L1_BY.has(id);
/** 叶子的名称 / 图标 / 颜色 / 一级（不认识的 id = 其他收入下的「其他」样式，名字用 id 本身） */
export function incLeaf(id) {
  if (BUILTIN.has(id)) return BUILTIN.get(id);
  const c = customIncomeKinds().find((k) => k.id === id);
  if (c) return { id, name: c.name, icon: c.icon || "🏷️", color: c.color, l1: c.parent, custom: true };
  return { id, name: id || "其他", icon: "📥", color: "#8a948f", l1: "other_income", custom: false, unknown: true };
}
export const incL1Of = (kind) => incLeaf(kind).l1;
/** 这个类型的一级算不算收入（资本与资产流入不算） */
export const isIncomeKind = (kind) => !!L1_BY.get(incL1Of(kind))?.income;
/** 一个一级下的叶子 id（含自定义）；数据库筛选（inc_filtered 的 kinds）用它展开 */
export const incLeavesOf = (l1) => incLeaves().filter((k) => k.l1 === l1).map((k) => k.id);
/** 「默认收入为 0」的叶子 = 资本与资产流入下的全部（数据库统计 inc_stats 的 capk 参数） */
export const capitalKinds = () => incLeavesOf("capital");

/* ── 一笔（或一组合计）拆成「认定收入」和「资本流入」 ──
 * set = 填了「其中已实现收益」的那部分认定额（已夹在 0..amount），dflt = 没填的那部分到账金额；repay = 需要还（借款）。
 * 单条记录：set = income_amount 有值 ? min(income_amount, amount) : 0；dflt = income_amount 为空 ? amount : 0。数据库 inc_rollup 按同样口径给出两个合计。 */
export function splitAmounts({ kind, repay = false, amount = 0, set = 0, dflt = 0 }) {
  const income = repay ? 0 : r2(set + (isIncomeKind(kind) ? dflt : 0));
  const l1 = isIncomeKind(kind) ? incL1Of(kind) : GAIN_L1[kind] || "other_income";
  const cap = r2(amount - income);
  const capLeaf = repay ? "loan_proceeds" : isIncomeKind(kind) ? "returned_principal" : kind;   // 收入类型里没认定的那部分 = 本金返还
  return { income, l1, cap, capLeaf };
}
/** 单条记录的拆分 */
export function splitRecord(r) {
  const amount = +r.amount || 0, has = r.income_amount != null && r.income_amount !== "";
  return splitAmounts({ kind: r.kind, repay: !!r.repay_required, amount, set: has ? Math.min(Math.max(0, +r.income_amount || 0), amount) : 0, dflt: has ? 0 : amount });
}
export const recognized = (r) => splitRecord(r).income;
/** 这笔的「实际类型」：需要还的一律当「借款到账」 */
export const effKind = (r) => (r.repay_required ? "loan_proceeds" : r.kind);

/* ── 统一账本（ledger_v）里的交易类型 / 现金流方向：和迁移 056 的 SQL 一致 ── */
const CAP_TYPE = { sale: "asset_sale", stock_sale: "asset_sale", property_sale: "asset_sale", loan_proceeds: "loan", returned_principal: "investment", expense_refund: "expense", xfer_savings: "transfer", xfer_invest: "transfer", wire: "transfer" };
export function incomeLedgerType(r) {
  if (r.repay_required) return "loan";
  return isIncomeKind(r.kind) ? "income" : CAP_TYPE[r.kind] || "transfer";
}
export const incomeDirection = (r) => (INTERNAL_KINDS.includes(r.kind) ? "internal" : "inflow");
export const TX_TYPES = [["income", "收入"], ["expense", "消费"], ["transfer", "转账"], ["investment", "投资"], ["asset_purchase", "资产购入"], ["asset_sale", "资产出售"], ["loan", "借贷"]];

/* ── 显示与下拉 ── */
/** 「一级 · 叶子」（已翻译） */
export const incLeafLabel = (id) => { const k = incLeaf(id); return `${t(incL1(k.l1)?.name || "")} · ${t(k.name)}`; };
/** 记账下拉：按一级分组（optgroup）；groups = 每组前面多一个「全部 X」（筛选用，值 g:一级），all = 最前面「全部」 */
export function incKindOptions(sel, { all = false, groups = false, allLabel = "" } = {}) {
  const opt = (v, label, short = "") => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}${short ? ` data-short="${esc(short)}"` : ""}>${esc(label)}</option>`;
  const ks = incLeaves();
  return `${all ? opt("all", allLabel || t("全部")) : ""}${INC_L1S.map((g) => { const cs = ks.filter((k) => k.l1 === g.id); return cs.length ? `<optgroup label="${esc(`${g.icon} ${t(g.name)}${g.income ? "" : ` · ${t("不计收入")}`}`)}">${groups ? opt(`g:${g.id}`, t("全部「{g}」", { g: t(g.name) }), t("全部{g}", { g: t(g.name) })) : ""}${cs.map((k) => opt(k.id, `${k.icon} ${t(g.name)} · ${t(k.name)}`, `${k.icon} ${t(k.name)}`)).join("")}</optgroup>` : ""; }).join("")}`;
}
/** 给 AI 的类型表（拍照识别、银行导入）：id=名称（一级） */
export const incAiCatalog = () => incLeaves().filter((k) => !k.custom).map((k) => `${k.id}=${k.name}（${incL1(k.l1).name}${incL1(k.l1).income ? "" : "，不算收入"}）`).join("; ");
