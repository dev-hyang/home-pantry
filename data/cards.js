/* 信用卡 · 静态数据（设计见 docs/design-cards.md）
 * - 奖励类别（发卡行口径）和小助手花费分类 → 奖励类别的映射
 * - 商家的网络限制（Costco 美国只收 Visa）
 * - 内置目录：常见卡的返现画像。全部是「% 返现等价」：积分卡按 point_value（每点多少美分）折算好了。
 *   规则会变，每张带 as_of；目录超过 90 天提示以发卡行为准。季度轮换类别（Chase Freedom、Discover it）每季不同，
 *   目录只标 rotating: true，具体类别进「用卡」页按季填（第二期可让 AI 起草）。
 * 文案是简体，界面显示时经 t() 翻译。 */
(() => {
  "use strict";

  const AS_OF = "2026-06-01";
  const REWARD_CATS = [
    ["grocery", "超市", "🛒"], ["wholesale", "仓储超市（Costco / Sam's）", "📦"], ["dining", "餐厅 / 外卖", "🍽️"], ["gas", "加油 / 充电", "⛽"],
    ["travel", "旅行（机票 / 酒店 / 租车）", "✈️"], ["online", "网购", "🛍️"], ["amazon", "Amazon", "📦"], ["drugstore", "药房", "💊"],
    ["streaming", "流媒体 / 订阅", "📺"], ["utilities", "水电气网话费", "💡"], ["transit", "交通 / 停车 / 通行费", "🚇"], ["entertainment", "娱乐", "🎬"],
    ["home", "家居建材", "🔨"], ["other", "其他", "🧾"],
  ];
  const NETWORKS = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover", unionpay: "银联", other: "其他" };
  // 商家只收哪些网络：推荐时不收的卡直接排除
  const MERCHANT_NETWORKS = [
    { re: /costco/i, accepts: ["visa"], note: "Costco（美国）只收 Visa" },
  ];
  // 商家名关键词 → 奖励类别（比花费分类更准）
  const MERCHANT_CATS = [
    [/costco|sam'?s club|bj'?s wholesale/i, "wholesale"], [/amazon|amzn/i, "amazon"], [/target|walmart|ikea|etsy|ebay|temu|shein|wayfair|淘宝|京东|拼多多|天猫/i, "online"],
    [/cvs|walgreens|rite aid|pharmacy|药房|药店/i, "drugstore"], [/netflix|spotify|hulu|disney|hbo|max\b|youtube|apple\.com\/bill|paramount|peacock/i, "streaming"],
    [/home depot|lowe'?s|menards|ace hardware/i, "home"], [/cinema|amc|regal|ticketmaster|stubhub|museum|zoo|theater|theatre/i, "entertainment"],
  ];
  /** 小助手花费分类（+ 商家名）→ 奖励类别 */
  function rewardCatOf(category, store) {
    const c = window.canonCat ? window.canonCat(String(category || "")) : String(category || ""), s = String(store || "");
    for (const [re, cat] of MERCHANT_CATS) if (re.test(s)) return cat;
    const pantry = (window.CATEGORIES || []).find((x) => x.id === c && x.space === "pantry");
    if (pantry || c === "grocery_misc") return "grocery";
    if (c === "life_dining") return "dining";
    if (c === "vehicle_fuel") return "gas";
    if (c === "life_transit") return "transit";
    if (/^travel_(flight|ship|ground|rental|lodging|tour|other)$/.test(c)) return "travel";
    if (c === "life_shopping" || c === "gear_digital" || c === "gear_clothes") return "online";
    if (c === "health" || c === "medical") return "drugstore";
    if (c === "bill_subscription" || c === "bill_cable_tv") return "streaming";
    if (/^bill_(electric|gas|water|internet|mobile)$/.test(c)) return "utilities";
    if (c === "bill_toll" || c === "bill_parking") return "transit";
    if (c === "life_fun") return "entertainment";
    if (c === "house_maint" || (window.CATEGORIES || []).some((x) => x.id === c && x.space === "house")) return "home";
    return "other";
  }

  // 目录：base / cats 已折算成 % 返现；caps = 封顶 { cat: { limit, period, then } }；rotating = 有季度轮换类别；merchants = 特定商家 %
  const C = (id, name, issuer, network, o) => ({ id, name, issuer, network, annual_fee: 0, foreign_fee: 0, point_value: 1, base: 1, cats: {}, caps: {}, rotating: false, merchants: {}, as_of: AS_OF, ...o });
  const CATALOG = [
    C("chase_freedom_unlimited", "Chase Freedom Unlimited", "Chase", "visa", { base: 1.5, cats: { dining: 3, drugstore: 3 }, foreign_fee: 3, note: "Chase Travel 订的旅行 5%（这里不单列）" }),
    C("chase_freedom_flex", "Chase Freedom Flex", "Chase", "mastercard", { base: 1, cats: { dining: 3, drugstore: 3 }, rotating: true, rotating_cap: 1500, foreign_fee: 3, note: "每季 5% 轮换类别要先激活" }),
    C("chase_sapphire_preferred", "Chase Sapphire Preferred", "Chase", "visa", { point_value: 1.25, base: 1.25, cats: { dining: 3.75, streaming: 3.75, travel: 2.5 }, annual_fee: 95, note: "UR 点数按 1.25¢ 算（Chase Travel 兑换）；线上买菜 3x" }),
    C("chase_sapphire_reserve", "Chase Sapphire Reserve", "Chase", "visa", { point_value: 1.5, base: 1.5, cats: { dining: 4.5, travel: 6 }, annual_fee: 795, note: "直订机票 / 酒店 4x、餐厅 3x；点数按 1.5¢ 算" }),
    C("amex_blue_cash_preferred", "Amex Blue Cash Preferred", "Amex", "amex", { base: 1, cats: { grocery: 6, streaming: 6, transit: 3, gas: 3 }, caps: { grocery: { limit: 6000, period: "year", then: 1 } }, annual_fee: 95, foreign_fee: 2.7, note: "美国超市 6%（年 $6,000 封顶）" }),
    C("amex_blue_cash_everyday", "Amex Blue Cash Everyday", "Amex", "amex", { base: 1, cats: { grocery: 3, online: 3, gas: 3 }, caps: { grocery: { limit: 6000, period: "year", then: 1 }, online: { limit: 6000, period: "year", then: 1 }, gas: { limit: 6000, period: "year", then: 1 } }, foreign_fee: 2.7 }),
    C("amex_gold", "Amex Gold", "Amex", "amex", { point_value: 1, base: 1, cats: { dining: 4, grocery: 4, travel: 3 }, caps: { dining: { limit: 50000, period: "year", then: 1 }, grocery: { limit: 25000, period: "year", then: 1 } }, annual_fee: 325, note: "MR 点数按 1¢ 算，转航空常能到 1.5¢+" }),
    C("citi_double_cash", "Citi Double Cash", "Citi", "mastercard", { base: 2, foreign_fee: 3 }),
    C("citi_custom_cash", "Citi Custom Cash", "Citi", "mastercard", { base: 1, cats: { grocery: 5, dining: 5, gas: 5, transit: 5, streaming: 5, drugstore: 5, home: 5 }, caps: { "*": { limit: 500, period: "month", then: 1 } }, foreign_fee: 3, note: "每个账单周期自动选花得最多的一类 5%（$500 封顶），不能同时多类" }),
    C("citi_strata_premier", "Citi Strata Premier", "Citi", "mastercard", { base: 1, cats: { grocery: 3, dining: 3, gas: 3, travel: 3 }, annual_fee: 95 }),
    C("discover_it_cash", "Discover it Cash Back", "Discover", "discover", { base: 1, rotating: true, rotating_cap: 1500, note: "每季 5% 轮换类别要先激活；第一年返现翻倍" }),
    C("discover_it_miles", "Discover it Miles", "Discover", "discover", { base: 1.5 }),
    C("capone_venture_x", "Capital One Venture X", "Capital One", "visa", { base: 2, cats: { travel: 2 }, annual_fee: 395, note: "Capital One Travel 订的旅行 5–10x（这里不单列）" }),
    C("capone_venture", "Capital One Venture", "Capital One", "visa", { base: 2, annual_fee: 95 }),
    C("capone_savor", "Capital One Savor", "Capital One", "mastercard", { base: 1, cats: { dining: 3, grocery: 3, streaming: 3, entertainment: 3 } }),
    C("capone_quicksilver", "Capital One Quicksilver", "Capital One", "mastercard", { base: 1.5 }),
    C("wf_active_cash", "Wells Fargo Active Cash", "Wells Fargo", "visa", { base: 2, foreign_fee: 3 }),
    C("wf_autograph", "Wells Fargo Autograph", "Wells Fargo", "visa", { base: 1, cats: { dining: 3, travel: 3, gas: 3, transit: 3, streaming: 3, utilities: 3 }, note: "话费 3%（放在水电气网话费一类里）" }),
    C("costco_anywhere_visa", "Costco Anywhere Visa (Citi)", "Citi", "visa", { base: 1, cats: { gas: 4, dining: 3, travel: 3, wholesale: 2 }, caps: { gas: { limit: 7000, period: "year", then: 1 } }, note: "要有 Costco 会员；返现一年一次以 Costco 代金券形式" }),
    C("amazon_prime_visa", "Amazon Prime Visa (Chase)", "Chase", "visa", { base: 1, cats: { amazon: 5, dining: 2, gas: 2, transit: 2 }, merchants: { "whole foods": 5 }, note: "要有 Prime 会员" }),
    C("target_circle_card", "Target Circle Card", "Target", "other", { base: 0, merchants: { target: 5 }, note: "只在 Target 用（有 Mastercard 版本可在外用 2%）" }),
    C("apple_card", "Apple Card", "Goldman Sachs", "mastercard", { base: 1, merchants: { apple: 3 }, note: "Apple Pay 付款 2%、Apple 自家 3%" }),
    C("bofa_customized_cash", "Bank of America Customized Cash", "Bank of America", "visa", { base: 1, cats: { online: 3, grocery: 2, wholesale: 2 }, caps: { "*": { limit: 2500, period: "quarter", then: 1 } }, foreign_fee: 3, note: "3% 类别自己选一个（默认按网购），季度 $2,500 封顶（含 2% 类别）" }),
    C("usbank_cash_plus", "U.S. Bank Cash+", "US Bank", "visa", { base: 1, cats: { utilities: 5, streaming: 5 }, caps: { "*": { limit: 2000, period: "quarter", then: 1 } }, foreign_fee: 3, note: "两个 5% 类别自己选（默认水电 / 流媒体），季度 $2,000 封顶" }),
    C("generic_cash", "现金返现卡（通用）", "", "other", { base: 1, note: "不在目录里的现金返现卡：自己填各类别的 %" }),
    C("generic_points", "积分卡（通用）", "", "other", { base: 1, point_value: 1, note: "不在目录里的积分卡：填每点值多少美分，各类别写折算后的 %" }),
    C("cn_points", "国内信用卡（积分，通用）", "", "unionpay", { base: 0.1, note: "国内多数积分卡折算下来 0.1%–0.3%；按自己的兑换价值改" }),
    C("debit", "借记卡 / 支付宝 / 微信（不返现）", "", "other", { base: 0, note: "参与比较用：返现 0" }),
  ];
  const catalogOf = (id) => CATALOG.find((c) => c.id === id) || null;

  window.CARDS = { AS_OF, REWARD_CATS, NETWORKS, MERCHANT_NETWORKS, MERCHANT_CATS, rewardCatOf, CATALOG, catalogOf };
})();
