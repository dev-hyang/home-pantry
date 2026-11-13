/* 地区与单位
 * - 地区根据设备时区自动检测（时区取的是手机/电脑的系统设置，而不是 GPS 定位），用户可在设置页手动改。
 * - 北美（美国、加拿大）用美制单位 lb / oz / fl oz / qt / gal；中国用公制 kg / g / 斤 / L / mL。
 * - 数据库里每件物品按“录入时的单位”保存，不做批量改写；界面显示时再换算成当前地区单位。
 *   这样不同地区的家人共享同一份清单，各自看到熟悉的单位，消耗日志也始终和存储单位一致。
 */
(() => {
  "use strict";

  const REGIONS = {
    us: { id: "us", name: "美国", system: "us",     currency: "USD", locale: "en-US" },
    ca: { id: "ca", name: "加拿大", system: "us",   currency: "CAD", locale: "en-CA" },
    cn: { id: "cn", name: "中国", system: "metric", currency: "CNY", locale: "zh-CN" },
  };

  const CA_TZ = /^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Yellowknife|Iqaluit|Rankin_Inlet|Resolute|Cambridge_Bay|Swift_Current|Dawson|Dawson_Creek|Fort_Nelson|Creston|Atikokan|Thunder_Bay|Nipigon|Rainy_River|Inuvik|Pangnirtung)$|^Canada\//;
  const US_TZ = /^America\/(New_York|Detroit|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Juneau|Boise|Sitka|Yakutat|Nome|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)$|^Pacific\/Honolulu$|^US\//;
  const CN_TZ = /^Asia\/(Shanghai|Chongqing|Chungking|Harbin|Urumqi|Kashgar)$|^PRC$/;

  function timeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
  }

  function detect() {
    const tz = timeZone();
    if (CA_TZ.test(tz)) return "ca";
    if (US_TZ.test(tz)) return "us";
    if (CN_TZ.test(tz)) return "cn";
    const lang = (navigator.language || "").toLowerCase();   // 时区无法判断时退回浏览器语言
    if (lang === "en-us") return "us";
    if (lang.endsWith("-ca")) return "ca";
    return "cn";
  }

  // 可换算的计量单位：[类别, 换算到基准单位（g 或 mL）的系数]
  const MEASURES = {
    g: ["mass", 1], kg: ["mass", 1000], "斤": ["mass", 500],
    oz: ["mass", 28.349523125], lb: ["mass", 453.59237],
    mL: ["vol", 1], ml: ["vol", 1], L: ["vol", 1000],
    "fl oz": ["vol", 29.5735295625], qt: ["vol", 946.352946], gal: ["vol", 3785.411784],
  };

  // 跨制式显示映射（固定一对一，避免数量一大就换单位导致 +/- 步长跳变）
  const DISPLAY_MAP = {
    us:     { g: "oz", kg: "lb", "斤": "lb", mL: "fl oz", ml: "fl oz", L: "fl oz" },
    metric: { oz: "g", lb: "kg", "fl oz": "mL", qt: "L", gal: "L", ml: "mL" },
  };

  const COUNT_UNITS = ["个", "盒", "袋", "包", "瓶", "罐", "杯", "条", "把", "卷", "片", "提", "板", "支"];
  const UNIT_SETS = {
    metric: [...COUNT_UNITS, "斤", "kg", "g", "L", "mL"],
    us:     [...COUNT_UNITS, "lb", "oz", "fl oz", "qt", "gal"],
  };

  // 每次点 −/+ 的步长（按显示单位）
  const STEPS = { kg: 0.5, "斤": 1, g: 100, L: 0.5, mL: 250, lb: 1, oz: 4, "fl oz": 8, qt: 1, gal: 0.5 };

  let current = null;
  let override = null;
  try { override = localStorage.getItem("hmh-region"); } catch { /* 忽略 */ }

  function setRegion(id) {
    override = REGIONS[id] ? id : null;
    try { override ? localStorage.setItem("hmh-region", override) : localStorage.removeItem("hmh-region"); } catch { /* 忽略 */ }
    current = REGIONS[override || detect()];
    return current;
  }
  setRegion(override);

  function convert(q, from, to) {
    if (from === to) return q;
    const a = MEASURES[from], b = MEASURES[to];
    if (!a || !b || a[0] !== b[0]) return null;
    return (q * a[1]) / b[1];
  }

  const displayUnit = (u) => DISPLAY_MAP[current.system][u] || u;
  const factor = (u) => { const d = displayUnit(u); return d === u ? 1 : convert(1, u, d); };

  // 2026-11-12：英文界面、AI、小票里写的各种叫法 → 库里统一存的单位（显示时再按语言翻译，瓶 → bottle）
  const ALIASES = {
    pc: "个", pcs: "个", piece: "个", pieces: "个", ea: "个", each: "个", ct: "个", count: "个", unit: "个", "件": "个", "只": "个", "颗": "个",
    box: "盒", boxes: "盒", carton: "盒", tub: "盒", bag: "袋", bags: "袋", sack: "袋",
    pack: "包", pk: "包", pkg: "包", package: "包", packet: "包", bottle: "瓶", bottles: "瓶", btl: "瓶", jug: "瓶",
    can: "罐", cans: "罐", jar: "罐", tin: "罐", cup: "杯", roll: "卷", rolls: "卷", tube: "支", stick: "支", bunch: "把", sheet: "片", slice: "片", bar: "条", loaf: "条", tray: "盒",
    lbs: "lb", pound: "lb", pounds: "lb", ounce: "oz", ounces: "oz", floz: "fl oz", "fl. oz": "fl oz", "fl.oz": "fl oz", "fluid ounce": "fl oz",
    gallon: "gal", gallons: "gal", quart: "qt", quarts: "qt", l: "L", liter: "L", litre: "L", liters: "L", ml: "mL", milliliter: "mL", gram: "g", grams: "g", kilogram: "kg", kgs: "kg",
    "公斤": "kg", "千克": "kg", "克": "g", "升": "L", "毫升": "mL", "磅": "lb", "盎司": "oz",
  };
  const ALL = new Set([...COUNT_UNITS, ...Object.keys(MEASURES)]);
  /** 统一成库里用的写法；不认识的原样返回（用户自定义的单位照样能用） */
  function normalize(u) {
    const s = String(u ?? "").trim().replace(/\s+/g, " ");
    if (!s) return "";
    if (s === "ml") return "mL";
    if (ALL.has(s)) return s;
    return ALIASES[s.toLowerCase()] || ALIASES[s.toLowerCase().replace(/\.$/, "")] || s;
  }
  // 按物品名猜包装单位（中英文关键词，先具体后笼统）；猜不出来返回 null，调用方再退回「个」
  const GUESS = [
    ["卷", /卫生纸|厕纸|卷纸|厨房纸|纸巾卷|保鲜膜|锡纸|铝箔|胶带|toilet paper|paper towel|bath tissue|plastic wrap|cling|foil|tape\b/i],
    ["支", /牙膏|唇膏|护手霜|toothpaste|lip balm|chapstick/i],
    ["罐", /罐头|可乐|雪碧|汽水|啤酒|果酱|花生酱|奶粉|咖啡粉|canned|\bsoda\b|\bcoke\b|sprite|\bbeer\b|\bjam\b|peanut butter|nutella|\bjar\b|formula/i],
    ["瓶", /酱油|生抽|老抽|醋|料酒|蚝油|食用油|橄榄油|菜籽油|麻油|香油|调料汁|沙拉酱|番茄酱|蜂蜜|糖浆|饮料|果汁|牛奶|矿泉水|纯净水|苏打水|葡萄酒|红酒|白酒|洗洁精|洗衣液|柔顺剂|洗发水|护发素|沐浴露|洗手液|漂白|消毒液|清洁剂|喷雾|漱口水|soy sauce|vinegar|\boil\b|ketchup|mustard|mayo|dressing|\bsauce\b|honey|syrup|juice|\bmilk\b|\bwater\b|wine|liquor|vodka|whisk|kombucha|dish soap|detergent|softener|shampoo|conditioner|body wash|hand soap|bleach|cleaner|spray|mouthwash|lotion/i],
    ["袋", /大米|糙米|小米|面粉|白糖|红糖|盐|薯片|零食|坚果|瓜子|冷冻|速冻|饺子|汤圆|面包|吐司|土豆|洋葱|胡萝卜|橙子|猫砂|狗粮|猫粮|\brice\b|flour|sugar|\bsalt\b|chips|snack|nuts|almond|frozen|dumpling|bread|bagel|potato|onion|carrot|orange|litter|dog food|cat food|pretzel|popcorn/i],
    ["盒", /鸡蛋|豆腐|麦片|燕麦|饼干|草莓|蓝莓|树莓|茶叶|茶包|垃圾袋|保鲜袋|冰淇淋|蛋糕|\beggs?\b|tofu|cereal|oat|cookie|cracker|berr|\btea\b|trash bag|garbage bag|zip ?loc|ice cream|cake|tissue box|kleenex|butter|cream cheese|mushroom/i],
    ["包", /方便面|泡面|挂面|面条|意面|米粉|纸巾|抽纸|湿巾|尿布|纸尿裤|卫生巾|酵母|instant noodle|ramen|noodle|pasta|spaghetti|napkin|tissue|wipes|diaper|\bpads?\b|yeast/i],
    ["杯", /酸奶|布丁|果冻|yogurt|pudding|jello/i],
  ];
  function guess(name) {
    const s = String(name || "");
    for (const [u, re] of GUESS) if (re.test(s)) return u;
    return null;
  }
  const isCount = (u) => COUNT_UNITS.includes(normalize(u));
  /** 追加到已有物品时，这一笔的单位和库存单位合不合得上：
   *  same 一样；convert 能换算（qty 换成库存单位）；count 都是计数单位（个 ↔ 瓶，按 1:1 记）；mismatch 换算不了（瓶 ↔ fl oz、lb ↔ 袋） */
  function fit(from, to) {
    const a = normalize(from), b = normalize(to);
    if (!a || !b || a === b) return { kind: "same", factor: 1 };
    const c = convert(1, a, b);
    if (c != null) return { kind: "convert", factor: c };
    if (isCount(a) && isCount(b)) return { kind: "count", factor: 1 };
    return { kind: "mismatch", factor: null };
  }

  window.Units = {
    REGIONS, UNIT_SETS, MEASURES,
    get region() { return current; },
    get override() { return override; },
    detected: () => REGIONS[detect()],
    timeZone, setRegion, convert: (q, from, to) => convert(q, normalize(from), normalize(to)), displayUnit: (u) => displayUnit(normalize(u) || u), factor: (u) => factor(normalize(u) || u),
    normalize, guess, fit, isCount,
    // 本地区的单位排前面，另一套也能选（美国包装上常印 mL / g），存的就是选的那个，显示时按地区换算
    list: () => [...UNIT_SETS[current.system], ...UNIT_SETS[current.system === "us" ? "metric" : "us"].filter((u) => !UNIT_SETS[current.system].includes(u) && u !== "斤")],
    step: (displayU) => STEPS[displayU] || 1,
    // short=true：坐标轴等空间紧张处，不显示小数；不带 short 一律显示两位小数（3344.12 不能显示成 3344）；exact 参数保留，行为已和默认一致
    money(v, currency = current.currency, short = false, exact = false) {
      const loc = { USD: "en-US", CAD: "en-CA", CNY: "zh-CN" }[currency] || current.locale;
      const digits = short ? 0 : 2;   // 只有 short（紧凑模式）省小数；其余一律显示到分
      try { return new Intl.NumberFormat(loc, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v); }
      catch { return `${currency} ${Number(v).toFixed(2)}`; }
    },
  };
})();
