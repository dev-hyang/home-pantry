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
  { id: "pet",    name: "宠物",     icon: "🐾", color: "#9a6b3c", loc: "储物间", subs: ["主粮", "零食", "猫砂尿垫", "洗护", "玩具用品"] },
].map((c) => ({ ...c, space: "pantry" }));   // 房屋耗材分类在 data/house.js 里追加（space = "house"）；自定义分类由 js/core/categories.js 在加载数据后合并进来

// 装备：耐用品和工具（床品、电器、自行车、千斤顶、园艺工具…），只记数量和位置，
// 不算消耗、不提醒补货、不进采购提醒（space = "gear"）。需要保养周期的设备将来进第二期的设备档案。
window.GEAR_CATEGORIES = [
  { id: "gear_home",   name: "家居用品", icon: "🛏️", color: "#6b8e7a", loc: "储物间", subs: ["床上用品", "毛巾浴巾", "季节电器", "收纳杂物"] },
  { id: "gear_travel", name: "出行户外", icon: "🚲", color: "#4f7f9f", loc: "车库",   subs: ["旅行婴儿用品", "推车拖车", "自行车", "露营野餐", "行李箱包"] },
  { id: "gear_car",    name: "汽车装备", icon: "🚗", color: "#7a5c8e", loc: "车内",   subs: ["应急工具", "备胎", "车载电器", "车内收纳"] },
  { id: "gear_tools",  name: "工具",     icon: "🔧", color: "#8a6d3b", loc: "工具间", subs: ["手动工具", "电动工具", "五金配件", "梯子登高"] },
  { id: "gear_garden", name: "园艺工具", icon: "🌱", color: "#5a8f3f", loc: "车库",   subs: ["割草修剪", "浇水用品", "花盆土壤", "园艺手工具"] },
  { id: "gear_study",  name: "图书与学习", icon: "📚", color: "#4a5fb0", loc: "卧室",   subs: ["图书绘本", "教材教辅", "乐器", "学习机电子", "运动器材"] },
].map((c) => ({ ...c, space: "gear" }));
window.CATEGORIES.push(...window.GEAR_CATEGORIES);
window.GEAR_GROUP = { id: "gear", name: "装备", icon: "🧳", color: "#a0522d" };   // 统计图里合并显示

// 单位列表按地区区分，见 units.js（Units.list()）
window.OTHER_CAT = { id: "other", name: "其他", icon: "🧺", color: "#8a948f" };
window.LOCATIONS = ["常温", "冷藏", "冷冻", "储物间", "卫生间", "厨房柜", "卧室", "衣柜", "地下室", "车库", "车内", "工具间", "阳台"];

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
];
