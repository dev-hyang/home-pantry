// 静态数据：物品分类、单位、存放位置、饮食模式、内置菜谱库
// 菜谱 ings 为“必需食材”，每项是同义词数组，库存物品名包含任一词即算有货。

window.CATEGORIES = [
  { id: "fresh",  name: "生鲜",     icon: "🥬", color: "#3f8f5a", loc: "冷藏",  subs: ["蔬菜", "水果", "肉禽", "水产", "蛋奶", "豆制品"] },
  { id: "frozen", name: "冷冻",     icon: "🧊", color: "#3b7fc4", loc: "冷冻",  subs: ["速冻面点", "冷冻肉禽", "冷冻水产", "冰品甜点"] },
  { id: "dry",    name: "干货粮油", icon: "🌾", color: "#b07a1a", loc: "常温",  subs: ["米面杂粮", "干货菌菇", "食用油", "调味品", "零食坚果", "冲饮"] },
  { id: "drink",  name: "饮品",     icon: "🧃", color: "#c75a85", loc: "常温",  subs: ["饮用水", "牛奶饮品", "茶咖啡", "果汁饮料"] },
  { id: "daily",  name: "日用品",   icon: "🧻", color: "#7563c0", loc: "储物间", subs: ["纸品", "清洁用品", "洗护用品", "厨房耗材"] },
  { id: "baby",   name: "母婴",     icon: "🍼", color: "#d4694c", loc: "储物间", subs: ["纸尿裤", "奶粉辅食", "湿巾", "哺乳用品"] },
  { id: "health", name: "药品健康", icon: "💊", color: "#24897d", loc: "常温",  subs: ["常备药", "维生素营养", "护理用品"] },
  { id: "study",  name: "学习文具", icon: "✏️", color: "#2f6fb0", loc: "储物间", subs: ["文具", "练习本", "打印纸墨", "美术用品", "学生用品"] },
  { id: "pet",    name: "宠物用品", icon: "🐾", color: "#9a6b3c", loc: "储物间", subs: ["主粮", "零食", "猫砂尿垫", "洗护", "玩具用品"] },
].map((c) => ({ ...c, space: "pantry" }));   // 房屋耗材分类在 data/house.js 里追加（space = "house"）；自定义分类由 js/core/categories.js 在加载数据后合并进来

// 装备：耐用品和工具（床品、电器、自行车、千斤顶、园艺工具…），只记数量和位置，
// 不算消耗、不提醒补货、不进采购提醒（space = "gear"）。需要保养周期的设备将来进第二期的设备档案。
window.GEAR_CATEGORIES = [
  { id: "gear_home",   name: "家居用品", icon: "🛏️", color: "#6b8e7a", loc: "储物间", subs: ["床上用品", "毛巾浴巾", "窗帘布艺", "季节电器", "节日装饰", "收纳杂物"] },   // 窗帘、圣诞装饰这类只记数量和位置的软装放这里；要保养的固定装置（百叶窗电机、吊扇）在 房屋 → 设备保养
  { id: "gear_kitchen", name: "厨房用品", icon: "🍽️", color: "#c0773a", loc: "厨房柜", subs: ["餐具碗盘", "锅具炊具", "烘焙工具", "烤盘托盘", "刀具砧板", "厨房小工具", "小家电", "保鲜收纳"] },   // 反复使用的厨具餐具：不算消耗，坏了才换新（卡片上有“损坏了，换新”）
  { id: "gear_clothes", name: "衣物",     icon: "🧥", color: "#b8576f", loc: "衣柜",   subs: ["冬衣", "秋衣", "春衣", "夏衣", "内衣袜子", "鞋靴", "帽围巾手套", "换季收纳"] },
  { id: "gear_travel", name: "户外与行李", icon: "🚲", color: "#4f7f9f", loc: "车库",   subs: ["旅行婴儿用品", "推车拖车", "自行车", "露营野餐", "行李箱包"] },
  { id: "gear_car",    name: "汽车装备", icon: "🚗", color: "#7a5c8e", loc: "车内",   subs: ["应急工具", "备胎", "车载电器", "车内收纳"] },
  { id: "gear_tools",  name: "工具",     icon: "🔧", color: "#8a6d3b", loc: "工具间", subs: ["手动工具", "电动工具", "五金配件", "梯子登高"] },
  { id: "gear_garden", name: "园艺工具", icon: "🌱", color: "#5a8f3f", loc: "车库",   subs: ["割草修剪", "浇水用品", "花盆土壤", "园艺手工具"] },
  { id: "gear_digital", name: "数码电子", icon: "💻", color: "#4f7f9f", loc: "书房",   subs: ["电脑平板", "手机配件", "相机", "耳机音响", "游戏机", "智能家居", "充电线材"] },   // 买一次用很久的电子产品（银行流水里的 Apple / Best Buy 归这里）
  { id: "gear_study",  name: "图书与学习", icon: "📚", color: "#4a5fb0", loc: "卧室",   subs: ["图书绘本", "教材教辅", "乐器", "学习机电子", "运动器材"] },
].map((c) => ({ ...c, space: "gear" }));
window.CATEGORIES.push(...window.GEAR_CATEGORIES);
window.GEAR_GROUP = { id: "gear", name: "装备", icon: "🧳", color: "#a0522d" };   // 统计图里合并显示
window.MEDICAL_GROUP = { id: "medical", name: "医疗", icon: "🏥", color: "#c2475f" };   // 医疗账单的付款（js/bills/medical.js 变成虚拟花费并进统计）

/* 旅行出行：机票、船票、车票、燃油、租车、住宿、饭店、门票、旅行团……
 * 花费分类 id 是 travel_*（purchases.category 允许），统计里合并成“旅行出行”一组（点进去看明细时可以按具体类型筛）；
 * 预算里是单独一组“旅行出行”（不算“大件”，机票再贵也不会被当成家电）。
 * 行程：不加新表——花费名称写成「【行程名】项目」（例如「【东京 2026】机票」），按行程名汇总（统计 → 旅行标签）。 */
window.TRAVEL_GROUP = { id: "travel", name: "旅行专属", icon: "🧳", color: "#0f8b8d" };
window.TRAVEL_CATS = [   // 只放「不出门旅行就不会有」的花费；旅途中的吃饭、加油、门票记普通分类 + 「【行程】」标签，旅行页照样按行程汇总
  { id: "travel_flight",  name: "机票",                 icon: "✈️", color: "#0f6f8b" },
  { id: "travel_ship",    name: "船票 / 邮轮",          icon: "🚢", color: "#2a7fb5" },
  { id: "travel_ground",  name: "长途车票（火车 / 大巴）", icon: "🚆", color: "#4c8f6b" },
  { id: "travel_lodging", name: "住宿（酒店 / 民宿 / 营地）", icon: "🏨", color: "#b4506a" },
  { id: "travel_rental",  name: "租车",                 icon: "🚗", color: "#7f6bc4" },
  { id: "travel_tour",    name: "旅行团 / 套餐",        icon: "🗺️", color: "#5b7fa6" },
  { id: "travel_other",   name: "其他旅行花费",         icon: "🧭", color: "#8a948f" },
];
/* 旧分类 → 新分类（2026-10-24 重整）：旅行·餐饮 / 燃油 / 门票并入普通分类。读花费时自动按这张表换，所以没跑迁移 035 也不会乱 */
window.CAT_ALIAS = { travel_dining: "life_dining", travel_fuel: "vehicle_fuel", travel_tickets: "life_fun" };
window.canonCat = (id) => window.CAT_ALIAS[id] || id;
/* 花钱分几种，每个分类只属于一处（2026-10-24 重整，见 docs/design-categories.md）：
 *   日常储备 = 买回家吃的、用的、会用完的（食品、日用、药品、母婴、文具、宠物用品），进库存，少了提醒补货；
 *   装备     = 买回家长期用的（家居、厨具、衣物、数码、工具、户外行李、图书），只记数量和位置，不提醒补货；
 *   餐饮外食 = 在外吃喝（餐厅、外卖、咖啡）；休闲与个人 = 娱乐门票、美容理发、健身、礼物、课程；
 *   车与交通 = 车辆保养、燃油充电、打车公交停车过路费；政务与手续 = 证件罚单报税、银行手续费利息、法律税务、邮寄；
 *   旅行专属 = 机票、船票、长途车票、住宿、租车、旅行团（旅途中的吃饭加油门票记普通分类 + 行程标签）；
 *   待细分   = 综合购物（Amazon 这类看不出买了什么的），统计里归「其他」，有空再细分。
 * 银行 / 信用卡导入里看不出买了什么的超市单子 = 超市杂货（grocery_misc），归日常储备。 */
window.LIFE_GROUP = { id: "life", name: "休闲与个人", icon: "🎭", color: "#8a5fb0" };
window.DINING_GROUP = { id: "dining", name: "餐饮外食", icon: "🍔", color: "#c0603a" };
window.ADMIN_GROUP = { id: "admin", name: "政务与手续", icon: "🏛️", color: "#6b7280" };
window.WORK_GROUP = { id: "work", name: "工作与专业", icon: "💼", color: "#3f6c8f" };
window.WORK_CATS = [   // 和工作、职业直接相关的花费（个人订阅型的软件放账单里；房产交易的律师费在资本性支出）
  { id: "work_software", name: "付费软件 / 工具 / 云服务（一次性买断或年付）", icon: "💻", color: "#3f6c8f" },
  { id: "work_cert",     name: "考证 / 执照 / 专业会员 / 考试费", icon: "🎓", color: "#5b7fa6" },
  { id: "work_legal",    name: "律师 / 会计 / 法律咨询（非房产：移民、遗嘱、公司、劳动…）", icon: "⚖️", color: "#6b7a8f" },
  { id: "work_supplies", name: "办公 / 职业用品（耗材、工作服、名片、打印）", icon: "🗂️", color: "#7a8f6b" },
  { id: "work_other",    name: "其他工作花费（行业会议、差旅杂费…）", icon: "💼", color: "#8a948f" },
];
window.GROCERY_MISC = { id: "grocery_misc", name: "超市杂货（未细分）", icon: "🛒", color: "#3f8f5a" };
window.LIFE_CATS = [   // id 前缀都是 life_，归哪一组看 stats/views.js 的 statCat
  { id: "life_dining",   name: "外出就餐 / 外卖 / 咖啡", icon: "🍔", color: "#c0603a" },
  { id: "life_transit",  name: "交通出行（打车 / 公交地铁 / 停车 / 过路费）", icon: "🚕", color: "#4c8f6b" },
  { id: "life_fun",      name: "娱乐 / 门票 / 活动（电影 / 游戏 / 演出 / 景点）", icon: "🎬", color: "#5b7fa6" },
  { id: "life_care",     name: "个人护理 / 美容 / 理发", icon: "💇", color: "#d4694c" },
  { id: "life_fitness",  name: "运动健身",               icon: "🏋️", color: "#24897d" },
  { id: "life_gifts",    name: "礼物 / 节日 / 红包",     icon: "🎁", color: "#c75a85" },
  { id: "life_edu",      name: "课程 / 培训 / 学习服务（一次性的；周期性的课外班在账单里）", icon: "📖", color: "#2f6fb0" },
  { id: "life_gov",      name: "证件 / 罚单 / 政府收费 / 报税软件", icon: "🏛️", color: "#6b7280" },
  { id: "life_fees",     name: "银行手续费 / 利息 / 年费", icon: "🏦", color: "#8a948f" },
  { id: "life_mail",     name: "邮寄 / 快递",            icon: "📮", color: "#b07a1a" },
  { id: "life_shopping", name: "综合购物（待细分：Amazon / Target 这类看不出买了什么）", icon: "📦", color: "#7a5c8e" },
  { id: "life_other",    name: "其他生活开销",           icon: "🧺", color: "#8a948f" },
];
window.VEHICLE_FUEL = { id: "vehicle_fuel", name: "车辆燃油 / 充电 / 洗车", icon: "⛽", color: "#b0741a" };
/* 资本性支出：买房卖房的房款 / 首付 / 律师 / 中介 / Title / 过户税、买车整付、大额投资转入——金额巨大、几年一次，
 * 混进日常花费会把每月占比、预算、趋势全部拉歪。所以单独一组：记录保留（明细里能看、能按行程式的「【交易】」标签汇总），
 * 但默认不进花费统计的图和预算；花费页有「含资本性支出」开关可以看合计。卖房 / 卖车的收入不在这里记（这里只记支出）。 */
window.CAPITAL_GROUP = { id: "capital", name: "资本性支出（房产交易 / 买车整付，不计入日常）", icon: "🏦", color: "#4b5563" };
window.CAPITAL_CATS = [
  { id: "capital_home",    name: "房产交易（房款 / 首付 / 律师 / 中介 / Title / 过户税 / 检查）", icon: "🏠", color: "#4b5563" },
  { id: "capital_vehicle", name: "买车整付 / 大额车款",      icon: "🚘", color: "#6b7280" },
  { id: "capital_invest",  name: "投资 / 存款转入 / 大额一次性", icon: "📈", color: "#374151" },
  { id: "capital_other",   name: "其他资本性支出",            icon: "🧱", color: "#9ca3af" },
];
window.isCapital = (id) => String(id || "").startsWith("capital_");
/* 记花费的分类下拉怎么分组（日常储备 / 房屋耗材 / 装备三组由 categoryOptions 按空间生成，这里是后面的几组） */
window.SPEND_GROUPS = () => {
  const L = (id) => window.LIFE_CATS.find((c) => c.id === id);
  return [
    ["餐饮外食", [L("life_dining")]],
    ["车与交通", [window.VEHICLE_FUEL, L("life_transit"), window.VEHICLE_CAT]],
    ["休闲与个人", ["life_fun", "life_care", "life_fitness", "life_gifts", "life_edu"].map(L)],
    ["工作与专业（付费软件 · 考证 · 律师会计 · 办公用品）", window.WORK_CATS],
    ["政务与手续（证件罚单报税 · 手续费 · 邮寄）", ["life_gov", "life_fees", "life_mail"].map(L)],
    ["旅行专属（旅途中的吃饭 / 加油 / 门票记上面的普通分类，再填行程）", window.TRAVEL_CATS],
    ["待细分 / 其他", [L("life_shopping"), L("life_other")]],
    ["资本性支出（房产交易、买车整付——不进日常统计和预算）", window.CAPITAL_CATS],
  ];
};

window.TRIP = {
  isTravel: (id) => String(id || "").startsWith("travel_"),
  /** 「【行程】项目」→ { trip, item }；没有行程前缀的 trip 为空 */
  parse: (name) => { const m = String(name || "").match(/^【([^】]{1,30})】\s*(.*)$/); return m ? { trip: m[1].trim(), item: m[2].trim() } : { trip: "", item: String(name || "") }; },
  /** 以前记成“其他”的花费，按名称 / 商店里的关键词猜是哪种旅行花费（猜不到返回 null，只用来给出“归类建议”，不会自动改） */
  guess: (name, store) => {
    const s = `${name || ""} ${store || ""}`.toLowerCase();
    const R = [["travel_flight", /机票|航空|航班|飞机|airline|flight|delta|united|american air|southwest|jetblue|alaska air/], ["travel_ship", /船票|邮轮|渡轮|轮渡|cruise|ferry/],
      ["travel_ground", /火车|高铁|动车|长途|大巴|amtrak|greyhound|\btrain\b/], ["vehicle_fuel", /加油|油费|燃油|充电|汽油|gas station|shell|chevron|exxon|\bbp\b|fuel|supercharg/],
      ["life_transit", /地铁|公交|打车|滴滴|停车|uber|lyft|taxi|parking|parkmobile|spothero|metra|\bcta\b|\bmta\b|transit|bus pass|\bbus\b/], ["travel_rental", /租车|hertz|avis|enterprise rent|rental car|turo/],
      ["travel_lodging", /酒店|旅馆|旅店|民宿|客栈|住宿|hotel|motel|airbnb|marriott|hilton|hyatt|booking\.com|\binn\b|resort|campground|营地/],
      ["life_fun", /门票|景点|游乐|乐园|票务|ticket|museum|disney|universal|park pass|admission|\btour\b/], ["travel_tour", /旅行团|跟团|旅游|旅行|vacation|trip|package/],
      ["life_dining", /饭店|餐厅|餐馆|酒楼|restaurant|diner|dining|bistro/]];
    return (R.find(([, re]) => re.test(s)) || [])[0] || null;
  },
  /** 行程 + 项目 → 花费名称（最长 60 字） */
  tag: (trip, item) => (trip ? `【${String(trip).trim().slice(0, 30)}】${String(item || "").trim()}`.slice(0, 60) : String(item || "")),
};

// 单位列表按地区区分，见 units.js（Units.list()）
window.OTHER_CAT = { id: "other", name: "其他", icon: "🧺", color: "#8a948f" };
// 存放位置：按房间分组（下拉里用 optgroup，不会一长串）；家庭可在 设置 → 存放位置 里新增、重命名（如“客卧 1 衣柜”改成“Emma 的房间”）
window.LOCATION_GROUPS = [
  { id: "kitchen", name: "厨房与餐厅", locs: ["常温", "冷藏", "冷冻", "厨房柜", "食品储藏间", "餐厅柜"] },
  { id: "living", name: "起居", locs: ["客厅电视柜", "玄关柜", "过道柜", "书房", "游戏室"] },
  { id: "bedroom", name: "卧室", locs: ["卧室", "衣柜", "主卧衣柜", "客卧 1 衣柜", "客卧 2 衣柜", "儿童房"] },
  { id: "bath", name: "卫浴与洗衣", locs: ["卫生间", "主卫", "客卫", "洗衣房柜"] },
  { id: "storage", name: "储物", locs: ["储物间", "壁橱", "楼梯下", "阁楼", "地下室"] },
  { id: "outdoor", name: "室外与车", locs: ["车库", "工具间", "车内", "阳台", "院子 / 棚屋"] },
];
window.LOCATIONS = window.LOCATION_GROUPS.flatMap((g) => g.locs);   // 平铺列表（旧代码兼容；加载自定义后由 locations.js 重算）

window.DIETS = {
  general: {
    name: "普通家庭", icon: "🍚",
    tips: [
      "食物多样：谷薯、蔬果、蛋奶、鱼禽肉、豆类每天都有。",
      "蔬菜每天 300–500 克，深色蔬菜占一半左右。",
      "少盐少油控糖，优先蒸、煮、快炒。",
    ],
  },
  pregnancy: {
    name: "孕期", icon: "🤰",
    tips: [
      "孕中晚期适当增加鱼、禽、蛋、瘦肉和奶类，补充优质蛋白、钙和铁。",
      "每周 2–3 次鱼类（优选鲈鱼、三文鱼等低汞鱼），每周 1–2 次动物肝脏或血补铁，注意适量。",
      "食物彻底煮熟：避免生鱼片、溏心蛋、未消毒奶和酒精。",
      "叶酸、碘、钙等补充剂请按医嘱，日常使用碘盐。",
    ],
  },
  gdm: {
    name: "妊娠糖尿病", icon: "🩸",
    tips: [
      "少量多餐：3 次正餐 + 2–3 次加餐，单次主食不过量。",
      "主食定量、粗细搭配（杂粮饭、燕麦、全麦），少吃白粥、糯米和甜点。",
      "可尝试进餐顺序：先吃蔬菜，再吃肉蛋，最后吃主食。",
      "水果放在两餐之间，小份低 GI（苹果、柚子、莓果）。",
      "务必遵医嘱监测血糖；具体份量以医生或注册营养师的方案为准。",
    ],
  },
  postpartum: {
    name: "产后恢复", icon: "🌸",
    tips: [
      "产后初期清淡易消化，再逐步过渡到正常饮食。",
      "保证优质蛋白（鱼、蛋、瘦肉、豆制品）和含铁食物。",
      "蔬菜水果照常吃，有助预防便秘。",
      "汤水撇去浮油，汤和肉一起吃；剖宫产或有并发症请遵医嘱。",
    ],
  },
  lactation: {
    name: "哺乳追奶", icon: "🤱",
    tips: [
      "哺乳期每天约比孕前多需要 500 千卡，并需要更多优质蛋白。",
      "每餐搭配汤水或饮品，保证充足饮水。",
      "鲫鱼汤、猪蹄黄豆汤、花生等是传统“下奶”菜，可作营养补充，但科学证据有限。",
      "奶量最关键的是勤吸吮、有效排空乳房；担心奶量请咨询医生或国际认证泌乳顾问（IBCLC）。",
      "少喝浓茶咖啡，避免饮酒。",
    ],
  },
};

const ALL = ["general", "pregnancy", "gdm", "postpartum", "lactation"];

// ings 每组关键词中英文都有（英文匹配不区分大小写），显示时取第一个并按语言翻译
window.RECIPES = [
  // 早餐
  { name: "燕麦牛奶配水煮蛋", meal: "breakfast", ings: [["燕麦", "oat"], ["牛奶", "milk"], ["鸡蛋", "egg"]], diets: ALL,
    note: "控糖人群选纯燕麦片，不选即食甜燕麦。" },
  { name: "全麦鸡蛋生菜三明治", meal: "breakfast", ings: [["全麦面包", "吐司", "bread", "toast"], ["鸡蛋", "egg"], ["生菜", "lettuce"]], diets: ["general", "pregnancy", "gdm"],
    note: "鸡蛋全熟；可加一片奶酪补钙。" },
  { name: "小米南瓜粥配蒸蛋羹", meal: "breakfast", ings: [["小米", "millet"], ["南瓜", "pumpkin", "squash"], ["鸡蛋", "egg"]], diets: ["general", "pregnancy", "postpartum", "lactation"],
    note: "粥类升糖快，控糖人群不建议。" },
  { name: "杂粮馒头配豆浆", meal: "breakfast", ings: [["馒头", "杂粮", "bun", "mantou"], ["豆浆", "黄豆", "soy milk", "soybean"]], diets: ["general", "pregnancy", "postpartum", "lactation"],
    note: "自制豆浆务必煮透。" },
  { name: "菠菜鸡蛋面", meal: "breakfast", ings: [["面条", "挂面", "noodle"], ["菠菜", "spinach"], ["鸡蛋", "egg"]], diets: ["general", "pregnancy", "postpartum", "lactation"],
    note: "菠菜先焯水去草酸。" },
  { name: "蒸红薯配无糖酸奶和坚果", meal: "breakfast", ings: [["红薯", "sweet potato", "yam"], ["酸奶", "yogurt", "yoghurt"], ["坚果", "核桃", "杏仁", "nut", "walnut", "almond"]], diets: ["general", "pregnancy", "gdm"],
    note: "妊娠糖尿病：红薯算主食，小份即可。" },

  // 正餐（午/晚）
  { name: "番茄炒蛋", meal: "main", ings: [["番茄", "西红柿", "tomato"], ["鸡蛋", "egg"]], diets: ALL, note: "少糖版本更适合控糖。" },
  { name: "清蒸鲈鱼", meal: "main", ings: [["鲈鱼", "鳕鱼", "鱼", "bass", "cod", "fish"]], diets: ALL, note: "低汞鱼，富含优质蛋白和 DHA。" },
  { name: "鲫鱼豆腐汤", meal: "main", ings: [["鲫鱼", "crucian", "carp"], ["豆腐", "tofu"]], diets: ["general", "pregnancy", "postpartum", "lactation"],
    note: "传统哺乳期汤品，鱼肉和汤一起吃。" },
  { name: "西兰花炒虾仁", meal: "main", ings: [["西兰花", "broccoli"], ["虾", "shrimp", "prawn"]], diets: ALL, note: "虾仁务必炒熟。" },
  { name: "番茄炖牛腩", meal: "main", ings: [["牛腩", "牛肉", "beef", "brisket"], ["番茄", "西红柿", "tomato"]], diets: ALL, note: "红肉补铁；控糖人群少放土豆。" },
  { name: "黄豆炖猪蹄", meal: "main", ings: [["猪蹄", "pork trotter", "pig feet"], ["黄豆", "soybean"]], diets: ["postpartum", "lactation"],
    note: "脂肪较高，炖好撇去浮油，每周一两次即可。" },
  { name: "清炒时蔬", meal: "main", ings: [["青菜", "菠菜", "油麦菜", "生菜", "白菜", "芥蓝", "菜心", "greens", "spinach", "lettuce", "bok choy", "cabbage", "kale"]], diets: ALL,
    note: "每餐至少一份蔬菜。" },
  { name: "香菇蒸鸡", meal: "main", ings: [["鸡腿", "鸡肉", "鸡", "chicken"], ["香菇", "shiitake", "mushroom"]], diets: ALL, note: "鸡肉去皮更清淡。" },
  { name: "冬瓜排骨汤", meal: "main", ings: [["冬瓜", "winter melon"], ["排骨", "pork rib", "spare rib"]], diets: ALL, note: "汤清淡，适合全家。" },
  { name: "猪肝菠菜汤", meal: "main", ings: [["猪肝", "pork liver", "liver"], ["菠菜", "spinach"]], diets: ["general", "pregnancy", "postpartum"],
    note: "补铁好选择；孕期每周 1–2 次、适量，肝脏要煮熟。" },
  { name: "木耳炒山药", meal: "main", ings: [["木耳", "wood ear", "black fungus"], ["山药", "chinese yam", "nagaimo"]], diets: ["general", "pregnancy", "postpartum"],
    note: "山药淀粉较多，可替代部分主食。" },
  { name: "凉拌黄瓜鸡丝", meal: "main", ings: [["黄瓜", "cucumber"], ["鸡胸", "鸡肉", "chicken"]], diets: ["general", "pregnancy", "gdm"],
    note: "低脂高蛋白，适合控糖晚餐。" },
  { name: "豆腐青菜汤", meal: "main", ings: [["豆腐", "tofu"], ["青菜", "菠菜", "小白菜", "greens", "spinach", "bok choy"]], diets: ALL, note: "植物蛋白加钙。" },
  { name: "杂粮饭", meal: "main", ings: [["大米", "米", "rice"], ["糙米", "杂粮", "燕麦米", "小米", "brown rice", "whole grain", "quinoa", "millet"]], diets: ALL,
    note: "作为主食；控糖人群按医嘱定量。" },

  // 加餐
  { name: "无糖酸奶配莓果", meal: "snack", ings: [["酸奶", "yogurt", "yoghurt"], ["蓝莓", "草莓", "莓", "blueberr", "strawberr", "berr"]], diets: ["general", "pregnancy", "gdm", "lactation"],
    note: "选配料表无添加糖的酸奶。" },
  { name: "原味坚果一小把", meal: "snack", ings: [["坚果", "核桃", "杏仁", "腰果", "nut", "walnut", "almond", "cashew"]], diets: ALL, note: "约一小把（15–20 克）。" },
  { name: "两餐间水果", meal: "snack", ings: [["苹果", "猕猴桃", "橙", "柚子", "apple", "kiwi", "orange", "grapefruit", "pomelo"]], diets: ALL, note: "妊娠糖尿病：小份、放在两餐之间。" },
  { name: "木瓜炖牛奶", meal: "snack", ings: [["木瓜", "papaya"], ["牛奶", "milk"]], diets: ["lactation", "postpartum"],
    note: "传统追奶甜品，证据有限；控糖人群不建议。" },
  { name: "黑芝麻核桃糊", meal: "snack", ings: [["黑芝麻", "black sesame", "sesame"], ["核桃", "walnut"]], diets: ["lactation", "postpartum"], note: "不另外加糖。" },
];

window.MEAL_SLOTS = [
  { id: "breakfast", name: "早餐", meal: "breakfast", count: 1 },
  { id: "lunch",     name: "午餐", meal: "main",      count: 2 },
  { id: "snack",     name: "加餐", meal: "snack",     count: 1 },
  { id: "dinner",    name: "晚餐", meal: "main",      count: 2 },
];

// ── 姐妹站点：顶栏站名旁的「‹ 上一个」「下一个 ›」胶囊和设置页列表都从这里读；顺序是三站共用的循环顺序，id 与 GitHub Pages 路径一致 ──
window.SISTER_APPS = [
  { id: "baby-log",    name: "小月亮",         short: "小月亮", sub: "母婴记录",            icon: "🌙", url: "https://dev-hyang.github.io/baby-log/" },
  { id: "homeschool",  name: "家庭学堂",       short: "学堂",   sub: "在家教育",            icon: "📚", url: "https://dev-hyang.github.io/homeschool/" },
  { id: "home-pantry", name: "爱家小助手", short: "小助手", sub: "储藏 · 房屋 · 账单", icon: "🥫", url: "https://dev-hyang.github.io/home-pantry/" },
  { id: "shepherd",    name: "牧羊人",         short: "牧羊人", sub: "身心灵记录",          icon: "🐑", url: "https://dev-hyang.github.io/shepherd/" },
];
