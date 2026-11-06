/* ───────────── 花费分类树 + 经济性质 + 统计口径（唯一的规则来源） ─────────────
 * purchases.category 仍是一个扁平的「叶子分类」id（fresh、bill_electric、travel_flight…），一个也不改写；
 * 这里把每个叶子挂到 二级分类（L2）→ 一级分类（L1）下，并决定它算进哪些统计。图表、预算、筛选、记账下拉、
 * 数据库筛选参数的展开（叶子 id 列表）都从这里读，不要在别处另写一份分组规则。回滚 = 退回代码，数据不用动。
 *
 * 一级分类：
 *   living    生活消费   —— 日常生活成本（只算性质 = 日常消费 operating 的）+ 现金流出
 *   housing   房产住房   —— 持有成本（不算进「日常」，和日常一起显示成「含住房」）+ 现金流出
 *   wealth    投资理财   —— 只算现金流出（性质 = 投资）
 *   financial 财务及其他 —— 税、贷款利息手续费、保险、政务、捐款、工作进修：现金流出，不算日常
 *   transfer  转账       —— 信用卡还款、自己账户之间、投资账户内部：哪里都不算（不是花费、不是现金流出、不进预算），明细里带「转账」标记
 *
 * 经济性质（purchases.nature，空 = 按分类默认）：operating 日常消费 / capital 资本性 / investment 投资 / financing 融资还本 / transfer 转账。
 * 大多数叶子默认 operating；买车整付、装修项目、房产交易、其他资本性默认 capital；投资转入默认 investment；转账类默认 transfer。
 * 统计口径（bucketOf）：每一笔只落进一个桶，几个桶加起来 = 现金流出：
 *   转账 → 不算；资本性 → capital；投资（或 L1 = 投资理财）→ investment；融资 → financial（贷款还本：迁移 058 起房贷 / 车贷的本金单独一行，性质 = 融资）；
 *   其余按 L1：living → 日常，housing → 住房，financial → 财务。
 * 自定义分类（custom_categories，c_xxxxxxxx）：parent = 挂在哪个二级分类下；没填按空间（储藏 → 食品杂货，装备 → 家居家电，房屋耗材 → 维护与服务）；
 * 不认识的 id 一律算 生活消费 → 其他。
 *
 * 二级分类（2026-11 重整，参考美国 BLS 消费支出调查、国家统计局居民消费八大类）：买菜（食品杂货）和下馆子（餐饮）分开；
 * 日用耗材、个护不算食品；衣物、数码、家居各自一组；按「买的是什么」分，不按在哪家店买。储藏的每个分类都是这里的一个三级分类（叶子），
 * 储藏页按这里的二级分组显示。旧的二级 food / shopping 只在读旧数据时出现：LEGACY_L2 / LEGACY_SPLIT 换算。 */
import { t } from "./i18n.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── 一级分类 ── */
export const L1S = [
  { id: "living",    name: "生活消费",   icon: "🏡", color: "#3b7fc4" },
  { id: "housing",   name: "房产住房",   icon: "🏠", color: "#b07a1a" },
  { id: "wealth",    name: "投资理财",   icon: "📈", color: "#24897d" },
  { id: "financial", name: "财务及其他", icon: "🏛️", color: "#8a5fb0" },
  { id: "transfer",  name: "转账",       icon: "🔁", color: "#64748b" },
];

/* ── 二级分类：leaves = 内置叶子分类（顺序 = 下拉里的顺序）。每个内置叶子只能出现一次（校验脚本会查） ── */
export const L2S = [
  // 生活消费
  { id: "grocery",      p: "living", name: "食品杂货",     icon: "🛒", color: "#3f8f5a", leaves: ["fresh", "frozen", "dry", "drink", "grocery_misc"] },
  { id: "dining",       p: "living", name: "餐饮",         icon: "🍜", color: "#c0603a", leaves: ["life_dining"] },   // 只算下馆子：外出就餐、外卖、咖啡奶茶
  { id: "essentials",   p: "living", name: "日用个护",     icon: "🧴", color: "#7563c0", leaves: ["daily", "personal_care", "life_care"] },
  { id: "home_goods",   p: "living", name: "家居家电",     icon: "🛋️", color: "#6b8e7a", leaves: ["gear_home", "gear_kitchen", "gear_tools", "gear_garden"] },
  { id: "apparel",      p: "living", name: "服饰鞋包",     icon: "👕", color: "#b8576f", leaves: ["gear_clothes", "life_laundry"] },
  { id: "digital",      p: "living", name: "数码电子",     icon: "💻", color: "#4f7f9f", leaves: ["gear_digital"] },
  { id: "shop_misc",    p: "living", name: "综合购物（待细分）", icon: "🛍️", color: "#7a5c8e", leaves: ["life_shopping"] },   // Costco / Amazon / Target 看不出买了什么的，改了分类就从这里消失
  { id: "transport",    p: "living", name: "交通",         icon: "🚗", color: "#3b7fc4", leaves: ["vehicle_fuel", "life_transit", "vehicle_maint", "gear_car", "house_car", "bill_insurance_auto", "bill_vehicle_reg", "bill_parking", "bill_toll", "loan_interest_auto", "capital_vehicle"] },
  { id: "utilities",    p: "living", name: "水电网通讯",   icon: "💡", color: "#1f8a8a", leaves: ["bill_electric", "bill_gas", "bill_water", "bill_internet", "bill_mobile", "bill_cable_tv", "bill_heating_oil", "bill_solar"] },
  { id: "healthcare",   p: "living", name: "医疗健康",     icon: "🩺", color: "#c2475f", leaves: ["medical", "health", "bill_insurance_health"] },
  { id: "kids",         p: "living", name: "孩子与教育",   icon: "🎒", color: "#d4694c", leaves: ["baby", "study", "gear_baby", "gear_study", "bill_tuition", "bill_activities"] },
  { id: "travel",       p: "living", name: "旅行",         icon: "🧳", color: "#0f6f8b", leaves: ["travel_flight", "travel_ship", "travel_ground", "travel_lodging", "travel_rental", "travel_tour", "travel_other"] },
  { id: "fun",          p: "living", name: "休闲娱乐",     icon: "🎬", color: "#c75a85", leaves: ["life_fun", "life_fitness", "gear_travel", "bill_subscription", "bill_membership"] },
  { id: "personal",     p: "living", name: "个人与家庭",   icon: "💝", color: "#9a6b3c", leaves: ["life_gifts", "bill_family_support"] },
  { id: "pets",         p: "living", name: "宠物",         icon: "🐾", color: "#6b8e23", leaves: ["pet", "pet_care", "bill_pet"] },
  { id: "living_other", p: "living", name: "其他",         icon: "🧺", color: "#8a948f", leaves: ["life_other", "other", "bill_other"] },
  // 房产住房
  { id: "mortgage",       p: "housing", name: "房贷",         icon: "🏦", color: "#4a5fb0", leaves: ["bill_mortgage"] },
  { id: "rent",           p: "housing", name: "房租",         icon: "🔑", color: "#5b7fa6", leaves: ["bill_rent"] },
  { id: "property_tax",   p: "housing", name: "房产税",       icon: "🏛️", color: "#6b7280", leaves: ["bill_property_tax"] },
  { id: "home_insurance", p: "housing", name: "房屋保险",     icon: "🛡️", color: "#3f6c8f", leaves: ["bill_insurance_home"] },
  { id: "hoa",            p: "housing", name: "HOA / 物业费", icon: "🏘️", color: "#7a8f6b", leaves: ["bill_hoa"] },
  { id: "home_maint",     p: "housing", name: "维护与服务",   icon: "🧰", color: "#5c6b63", leaves: ["house_hvac", "house_water", "house_season", "house_pest", "house_safety", "house_repair", "house_care", "house_maint", "bill_lawn", "bill_cleaning", "bill_pest", "bill_security", "bill_pool", "bill_storage"] },
  { id: "home_improve",   p: "housing", name: "装修改善",     icon: "🔨", color: "#a0522d", leaves: ["project"] },
  { id: "property_deal",  p: "housing", name: "房产交易",     icon: "📜", color: "#4b5563", leaves: ["capital_home"] },
  // 投资理财
  { id: "investing",      p: "wealth", name: "投资储蓄",       icon: "📈", color: "#2c6a57", leaves: ["capital_invest"] },
  // 财务及其他
  { id: "taxes",          p: "financial", name: "税务",             icon: "🧮", color: "#8a6d3b", leaves: ["bill_income_tax"] },
  { id: "loans_fees",     p: "financial", name: "贷款利息与手续费", icon: "💳", color: "#b4506a", leaves: ["bill_student_loan", "bill_personal_loan", "bill_car_loan", "life_fees", "debt_principal"] },
  { id: "insurance",      p: "financial", name: "保险",             icon: "🛟", color: "#5f7fa8", leaves: ["bill_insurance_life", "bill_insurance_other"] },
  { id: "gov_admin",      p: "financial", name: "政务手续",         icon: "🏛️", color: "#6b7a8f", leaves: ["life_gov", "life_mail", "legal"] },
  { id: "donations",      p: "financial", name: "捐款奉献",         icon: "🙏", color: "#24897d", leaves: ["bill_donation"] },
  { id: "work",           p: "financial", name: "工作与进修",       icon: "💼", color: "#3f6c8f", leaves: ["work_software", "work_cert", "work_legal", "work_supplies", "work_other", "life_edu"] },
  { id: "capital_misc",   p: "financial", name: "其他资本性",       icon: "🧱", color: "#9ca3af", leaves: ["capital_other"] },
  // 转账
  { id: "transfers",      p: "transfer", name: "转账",             icon: "🔁", color: "#64748b", leaves: ["bill_credit_card", "transfer_account", "transfer_invest"] },
];
export const OTHER_L2 = "living_other";   // 不认识的分类、没挂父级的自定义分类都算这里

/* ── 经济性质 ── */
export const NATURES = [
  { id: "operating",  name: "日常消费",   short: "日常" },
  { id: "capital",    name: "资本性支出", short: "资本性" },
  { id: "investment", name: "投资",       short: "投资" },
  { id: "financing",  name: "融资 / 还本", short: "融资" },
  { id: "transfer",   name: "转账",       short: "转账" },
];
const NATURE_IDS = new Set(NATURES.map((n) => n.id));
/** 默认性质不是 operating 的叶子（其余全是 operating）；数据库筛选也用这张表（spend_filtered 的 natx） */
export const NATURE_DEFAULT = { capital_vehicle: "capital", project: "capital", capital_home: "capital", capital_other: "capital", capital_invest: "investment", debt_principal: "financing", bill_credit_card: "transfer", transfer_account: "transfer", transfer_invest: "transfer" };

/* ── 统计桶：每一笔只落进一个（转账不落），几个桶加起来 = 现金流出 ── */
export const BUCKETS = [
  { id: "living",     name: "日常生活",   color: "#3b7fc4" },
  { id: "housing",    name: "住房",       color: "#b07a1a" },
  { id: "financial",  name: "财务及其他", color: "#8a5fb0" },
  { id: "capital",    name: "资本性支出", color: "#c2475f" },
  { id: "investment", name: "投资",       color: "#24897d" },
];

/* ── 查找表（内置部分只建一次；自定义分类每次合并后 applyCustomCategories 会变，所以按需现查） ── */
const L1_BY = new Map(L1S.map((n) => [n.id, n]));
const L2_BY = new Map(L2S.map((n) => [n.id, { ...n, level: 2 }]));
for (const n of L1S) n.level = 1;
const BUILTIN_PARENT = new Map(L2S.flatMap((n) => n.leaves.map((id) => [id, n.id])));
/** 自定义分类（储藏 / 房屋耗材 / 装备的自建分类）按空间的默认父级 */
const SPACE_PARENT = { pantry: "grocery", gear: "home_goods", house: "home_maint" };
/** 旧的二级分类 id（2026-11 拆分前）→ 新的：自建分类的 parent 迁移 063 已经改了，这里兜底（演示模式、没跑迁移） */
export const LEGACY_L2 = { food: "grocery", shopping: "home_goods" };
const legacyParent = (p, space) => (p === "shopping" && space === "pantry" ? "essentials" : LEGACY_L2[p] || p);
const canon = (id) => (window.canonCat ? window.canonCat(id) : id);

/** 是不是分类树上的节点（一级 / 二级） */
export const isNode = (id) => L1_BY.has(id) || L2_BY.has(id);
export const nodeOf = (id) => L1_BY.get(id) || L2_BY.get(id) || null;
export const l2List = (l1) => L2S.filter((n) => !l1 || n.p === l1).map((n) => L2_BY.get(n.id));

/** 一个叶子分类的名称 / 图标 / 颜色（data.js、data/house.js、data/bills.js、data/vehicles.js 里定义的，加上自定义分类） */
let leafCache = null, leafCacheKey = "";
function leafMap() {
  const W = window, C = W.CATEGORIES || [];
  const key = `${C.length}|${C.filter((c) => c.custom).map((c) => `${c.id}:${c.name}:${c.parent || ""}`).join(",")}`;   // 自定义分类变了就重建
  if (leafCache && leafCacheKey === key) return leafCache;
  const list = [...C, W.MAINT_CAT, W.VEHICLE_CAT, ...(W.BILLS_GROUP?.cats?.() || []), ...(W.TRAVEL_CATS || []), ...(W.LIFE_CATS || []), ...(W.WORK_CATS || []), ...(W.CAPITAL_CATS || []),
    ...(W.TRANSFER_CATS || []), ...(W.LOAN_CATS || []), W.GROCERY_MISC, W.VEHICLE_FUEL, W.MEDICAL_GROUP, W.PET_CARE_CAT, W.LEGAL_CAT, W.PROJECT_CAT, W.OTHER_CAT].filter(Boolean);
  leafCache = new Map(); for (const c of list) if (!leafCache.has(c.id)) leafCache.set(c.id, c);
  leafCacheKey = key; return leafCache;
}
const FALLBACK = { id: "other", name: "其他", icon: "🧺", color: "#8a948f" };
export const leafInfo = (id) => leafMap().get(canon(id)) || leafMap().get("other") || FALLBACK;
export const isKnownLeaf = (id) => leafMap().has(canon(id));
/** 全部叶子分类（名称 / 图标 / 颜色）：明细、CSV、打印按 id 找名字用 */
export const allLeaves = () => [...leafMap().values()];
/** 全部认识的叶子 id（含自定义、含旧别名）：数据库筛选里「认识的分类」 */
export const knownLeafIds = () => [...new Set([...leafMap().keys(), ...Object.keys(window.CAT_ALIAS || {})])];

/** 叶子 → 二级分类 id */
export function l2IdOf(leafId) {
  const id = canon(leafId), b = BUILTIN_PARENT.get(id);
  if (b) return b;
  const c = (window.CATEGORIES || []).find((x) => x.id === id && x.custom);
  if (c) { const p = legacyParent(c.parent, c.space); return L2_BY.has(p) ? p : SPACE_PARENT[c.space] || OTHER_L2; }
  return OTHER_L2;
}
export const l2Of = (leafId) => L2_BY.get(l2IdOf(leafId));
export const l1IdOf = (leafId) => L2_BY.get(l2IdOf(leafId)).p;
export const l1Of = (leafId) => L1_BY.get(l1IdOf(leafId));
/** [一级, 二级, 叶子]：面包屑、CSV 的 L1 / L2 列 */
export const pathOf = (leafId) => [l1Of(leafId), l2Of(leafId), leafInfo(leafId)];
/** 节点的上一级（叶子 → 二级，二级 → 一级，一级 → null） */
export const parentOf = (id) => (L1_BY.has(id) ? null : L2_BY.has(id) ? L2_BY.get(id).p : l2IdOf(id));

/** 节点包含的叶子 id（一级 = 所有二级的叶子；二级 = 内置叶子 + 挂在它下面的自定义分类；叶子 = 自己 + 旧别名） */
export function leavesOf(id) {
  if (L1_BY.has(id)) return L2S.filter((n) => n.p === id).flatMap((n) => leavesOf(n.id));
  if (L2_BY.has(id)) return [...L2_BY.get(id).leaves, ...(window.CATEGORIES || []).filter((c) => c.custom && l2IdOf(c.id) === id).map((c) => c.id)];
  return [id, ...Object.entries(window.CAT_ALIAS || {}).filter(([, v]) => v === id).map(([k]) => k)];
}
/** 节点是否包含「不认识的分类」（不认识的一律算 生活消费 → 其他） */
export const coversUnknown = (id) => id === "living" || id === OTHER_L2 || id === "other";
/** 子节点：一级 → 二级；二级 → 叶子（内置 + 自定义）；叶子 → [] */
export const childrenOf = (id) => (L1_BY.has(id) ? l2List(id) : L2_BY.has(id) ? leavesOf(id).filter((x) => !(x in (window.CAT_ALIAS || {}))).map(leafInfo) : []);

/* ── 性质与统计桶 ── */
export const defaultNature = (leafId) => NATURE_DEFAULT[canon(leafId)] || "operating";
/** 这一笔的实际性质：记了就用记的，没记（null）按分类默认 */
export const effNature = (leafId, nature) => (NATURE_IDS.has(nature) ? nature : defaultNature(leafId));
export const natureName = (id) => NATURES.find((n) => n.id === id)?.name || id;
/** 转账：性质是转账，或者分类在「转账」一级下面 */
export const isTransfer = (leafId, nature) => effNature(leafId, nature) === "transfer" || l1IdOf(leafId) === "transfer";
/** 统计桶：living / housing / financial / capital / investment；转账返回 null */
export function bucketOf(leafId, nature) {
  const n = effNature(leafId, nature), l1 = l1IdOf(leafId);
  if (n === "transfer" || l1 === "transfer") return null;
  if (n === "capital") return "capital";
  if (n === "investment" || l1 === "wealth") return "investment";
  if (n === "financing") return "financial";
  return l1 === "living" ? "living" : l1 === "housing" ? "housing" : "financial";
}
/** 统计开关（排除资本性 / 排除投资）下这一笔算不算 */
export const counted = (leafId, nature, { exCap = false, exInv = false } = {}) => {
  const b = bucketOf(leafId, nature);
  return !!b && !(exCap && b === "capital") && !(exInv && b === "investment");
};
/** 数据库筛选用：默认性质不是 operating 的叶子（含自定义分类挂到转账下的）、转账一级下的全部叶子 */
export const natureParams = () => ({ natx: { ...NATURE_DEFAULT }, xfer: leavesOf("transfer") });

/* ── 预算：可支配预算的分组 = 二级分类（固定账单另算一组 bills；转账、资本性、投资不进预算） ── */
/** 能做可支配预算的二级分类：有不是账单、默认是日常消费的叶子；不含 投资理财 / 转账 */
export const budgetL2s = () => l2List().filter((n) => n.p !== "transfer" && n.p !== "wealth" && leavesOf(n.id).some((id) => !String(id).startsWith("bill_") && defaultNature(id) === "operating"));
/** 一笔花费在预算里归哪一组：transfer / capital / investment（都不进预算）、bills（固定账单）、medical（医疗不计入可支配时）或二级分类 id */
export function budgetGroupOf(leafId, nature, { medInPool = false, inclCapital = false } = {}) {
  const b = bucketOf(leafId, nature);
  if (!b) return "transfer";
  if (b === "capital" && !inclCapital) return "capital";
  if (b === "investment") return "investment";
  const id = canon(leafId);
  if (String(id).startsWith("bill_")) return "bills";
  if (id === "medical" && !medInPool) return "medical";
  return l2IdOf(id);
}
/** 旧的预算分组键（2026-10 之前存在 cat_budgets 里的）→ 二级分类；读的时候换算，不改存储（相同目标的几个旧键相加） */
export const LEGACY_BUDGET = { groceries: "grocery", house: "home_maint", big: "home_goods", gear: "home_goods", vehicle: "transport", life: "fun", work: "work", admin: "gov_admin", travel: "travel", other: "living_other", medical: "healthcare" };
/** 2026-11 拆开的二级分类：旧键的预算按过去 6 个月这几组的实际花费比例分下去（没有历史按默认权重） */
export const LEGACY_SPLIT = { food: ["grocery", "dining"], shopping: ["essentials", "home_goods", "apparel", "digital", "shop_misc"] };
/** 旧的统计分组 id（书签、旧钻取链接里的 cat=dining…）→ 新的节点 / 叶子；dining 现在本身就是二级分类（餐饮），不再换 */
export const LEGACY_STAT = { vehicle: "transport", life: "fun", admin: "gov_admin", house: "home_maint", gear: "home_goods", capital: "property_deal", food: "grocery", shopping: "shop_misc" };

/* ── 记账下拉：按 一级 · 二级 分组（optgroup），叶子在组里；手动记一笔、就地编辑、导入对账单、设备召回退款都用这一份 ── */
export function spendOptions(selected, { withOther = true } = {}) {
  const sel = canon(selected || "");
  const opt = (c) => `<option value="${esc(c.id)}" ${c.id === sel ? "selected" : ""}>${esc(`${c.icon || ""} ${t(c.name)}`.trim())}</option>`;
  const hidden = new Set((window.CATEGORIES || []).filter((c) => c.hidden && c.id !== sel).map((c) => c.id));   // 隐藏的内置分类不列（当前选中的除外）
  return L1S.map((l1) => l2List(l1.id).map((l2) => {
    const leaves = childrenOf(l2.id).filter((c) => !hidden.has(c.id) && (withOther || c.id !== "other"));
    return leaves.length ? `<optgroup label="${esc(`${t(l1.name)} · ${t(l2.name)}`)}">${leaves.map(opt).join("")}</optgroup>` : "";
  }).join("")).join("");
}
/** 筛选下拉（明细页）：一级、二级、用到的叶子，缩进表示层级；used = 有记录的叶子 id 集合（没给就列全部） */
export function treeOptions(selected, used = null) {
  const o = (id, label, depth) => `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${"　".repeat(depth)}${esc(label)}</option>`;
  return L1S.map((l1) => o(l1.id, `${l1.icon} ${t(l1.name)}`, 0) + l2List(l1.id).map((l2) => {
    const leaves = childrenOf(l2.id).filter((c) => !used || used.has(c.id) || c.id === selected);
    if (used && !leaves.length && l2.id !== selected) return "";
    return o(l2.id, t(l2.name), 1) + (leaves.length > 1 || leaves.some((c) => c.id === selected) ? leaves.map((c) => o(c.id, t(c.name), 2)).join("") : "");
  }).join("")).join("");
}
/** 性质下拉；auto = 第一项是「按分类默认」（存 null） */
export function natureOptions(selected, { auto = true, leaf = null } = {}) {
  const def = leaf ? natureName(defaultNature(leaf)) : null;
  return `${auto ? `<option value="" ${!selected ? "selected" : ""}>${esc(def ? t("按分类默认（{n}）", { n: t(def) }) : t("按分类默认"))}</option>` : ""}${NATURES.map((n) => `<option value="${n.id}" ${n.id === selected ? "selected" : ""}>${esc(t(n.name))}</option>`).join("")}`;
}
/** 给 AI 的分类表（银行导入）：id=名称（一级 / 二级） */
export function aiCatalog() {
  const items = L1S.flatMap((l1) => l2List(l1.id).flatMap((l2) => childrenOf(l2.id).filter((c) => !c.custom).map((c) => ({ id: c.id, text: `${c.id}=${t(c.name)}（${t(l1.name)} / ${t(l2.name)}）` }))));
  return { text: items.map((x) => x.text).join("; "), ids: new Set(items.map((x) => x.id)) };
}
/** 叶子的显示：「二级 · 叶子」（叶子名本身就是二级名时只显示一个） */
export const leafLabel = (leafId) => { const c = leafInfo(leafId), l2 = l2Of(leafId); return `${c.icon || ""} ${t(l2.name)} · ${t(c.name)}`.trim(); };
