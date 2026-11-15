/* 按名称猜分类 / 小类（2026-11-14）：中英文关键词，一张表三处用——
 *   ① 添加物品时边打名字边选好大类、小类（没手动选过的话）；② 拍小票入库的新物品补上小类；
 *   ③ 迁移 070 把已有物品按新分类整理（supabase/migrations/070_category_refine.sql 由 scripts/gen-070.mjs 从这张表生成，规则只有一份）。
 * 每条：[从哪些分类来（null = 家居耐用品之间互相调整）, 正则, 新分类, 新小类]；新分类为 null = 例外，命中就不动。
 * 同一组里先具体后笼统，第一条命中的算。正则只用 PostgreSQL 也认的写法（不用 \b、后行断言），迁移里原样用 ~*（不区分大小写）。
 * 短英文词前后加边界 w()，免得 tea 命中 steak、egg 命中 eggplant、fan 命中 infant。 */
const w = (...words) => words.map((x) => `(^|[^a-z])${x}([^a-z]|$)`).join("|");
const FOOD = ["fresh", "meat_dairy", "dry", "snacks", "drink"];

export const RULES = [
  // ── 食品：先放例外和容易误判的 ──
  [FOOD, "鸡毛菜|牛蒡|鱼腥草|eggplant", "fresh", "蔬菜"],
  [FOOD, "牛油果|avocado", "fresh", "水果"],
  [FOOD, "奶油南瓜|butternut", "fresh", "蔬菜"],
  [FOOD, `料酒|蚝油|豉油|酱油|生抽|老抽|醋|味噌|miso|蜂蜜|honey|研磨盐|^盐|海盐|胡椒|调料|sauce|vinegar|ketchup|mayo|${w("salt")}`, "dry", "调味品"],
  [FOOD, "罐头|canned|罐装", "dry", "罐头"],
  [FOOD, "面粉|澄粉|粘米粉|绿豆粉|淀粉|酵母|泡打粉|小苏打|flour|yeast|baking", "dry", "烘焙原料"],
  [FOOD, "意大利面|意面|宽面|细面|面条|挂面|米粉|米线|粉丝|pasta|spaghetti|noodle|angel hair|linguine|fettuccine|ramen", "dry", "面条意面"],
  [FOOD, "食用油|橄榄油|菜籽油|花生油|玉米油|olive oil|cooking oil|canola", "dry", "食用油"],
  [FOOD, "干香菇|香菇干|木耳|银耳|干货|dried mushroom", "dry", "干货菌菇"],
  [FOOD, "巧克力|费列罗|chocolate|ferrero", "snacks", "巧克力"],
  [FOOD, "腰果|碧根果|杏仁|核桃|开心果|花生|瓜子|坚果|葡萄干|果干|cashew|pecan|almond|walnut|pistachio|peanut|raisin|trail mix|nuts", "snacks", "坚果果干"],
  [FOOD, "饼干|威化|糖果|薯片|曲奇|cookie|cracker|wafer|candy|chips|pretzel", "snacks", "饼干糖果"],
  [FOOD, "牛奶|鲜奶|脱脂|全脂|盒装奶|酸奶|豆浆|豆奶|milk|yogurt|yoghurt|kefir", "meat_dairy", "牛奶酸奶"],
  [FOOD, "奶酪|芝士|黄油|奶油|cheese|butter|cream", "meat_dairy", "奶酪黄油"],
  [FOOD, `鸡蛋|鸭蛋|鹌鹑蛋|^蛋$|${w("eggs?")}`, "meat_dairy", "鸡蛋"],
  [FOOD, "苹果酒|啤酒|葡萄酒|红酒|白酒|清酒|威士忌|伏特加|cider|beer|wine|whisk|vodka|sake", "drink", "酒"],
  [FOOD, `咖啡|茶|coffee|${w("teas?")}`, "drink", "茶咖啡冲饮"],
  [FOOD, "果汁|汽水|可乐|苏打|气泡水|juice|soda|cola|sparkling", "drink", "果汁汽水"],
  [FOOD, "瓶装水|矿泉水|纯净水|饮用水|water", "drink", "饮用水"],
  [FOOD, "菇|蘑|mushroom", "fresh", "菌菇"],
  [FOOD, "豆腐|豆干|腐竹|tofu", "fresh", "豆制品"],
  [FOOD, `鱼|虾|蟹|蛤|蚝|鱿|墨鱼|三文|鲑|海鲜|扇贝|tilapia|salmon|shrimp|prawn|crab|fish|scallop|clam|oyster|squid|${w("cod")}`, "meat_dairy", "水产"],
  [FOOD, `牛|猪|羊|鸡|鸭|鹅|火鸡|五花|排骨|里脊|肉|培根|火腿|香肠|肉肠|beef|pork|lamb|chicken|turkey|steak|bacon|sausage|brisket|meat|${w("ham", "ribs")}`, "meat_dairy", "肉禽"],
  [FOOD, `面包|吐司|贝果|皮塔|bread|bagel|pita|tortilla|croissant|${w("buns?")}`, "fresh", "面包烘焙"],
  [FOOD, `苹果|梨|葡萄|提子|香蕉|橙|柑|橘|柚|柿|李子|桃|樱桃|草莓|蓝莓|树莓|莓|芒果|菠萝|西瓜|哈密瓜|猕猴桃|奇异果|石榴|柠檬|apple|grape|banana|orange|mandarin|clementine|pomelo|persimmon|plum|peach|cherr|berr|mango|pineapple|melon|kiwi|pomegranate|lemon|${w("pears?", "limes?")}`, "fresh", "水果"],
  [FOOD, `大米|糙米|紫米|小米|燕麦|薏米|藜麦|红豆|赤小豆|绿豆|西米|杂粮|rice|quinoa|grain|${w("oats?", "oatmeal")}`, "dry", "米面杂粮"],
  // ── 冷冻：留在冷冻里，只换小类 ──
  [["frozen"], "冰淇淋|雪糕|冰棍|ice cream|popsicle|gelato", "frozen", "冰品甜点"],
  [["frozen"], "火锅丸|肉丸|牛肉丸|鱼丸|meatball", "frozen", "冷冻肉禽"],
  [["frozen"], "毛豆|蓝莓|草莓|南瓜|玉米|豌豆|西兰花|笋|蔬菜|水果|edamame|berr|veggie|vegetable|corn|peas|broccoli", "frozen", "冷冻蔬果"],
  [["frozen"], `鱼|虾|蟹|三文|鲑|海鲜|扇贝|salmon|shrimp|prawn|fish|scallop|${w("cod")}`, "frozen", "冷冻水产"],
  [["frozen"], "牛|猪|羊|鸡|鸭|火鸡|五花|排骨|肉|香肠|肉肠|beef|pork|lamb|chicken|turkey|steak|sausage|meat", "frozen", "冷冻肉禽"],
  [["frozen"], "饺子|馄饨|包子|馒头|汤圆|丸|饼|皮|dumpling|wonton", "frozen", "速冻面点"],
  // ── 母婴 ──
  [["baby"], "尿布桶|diaper genie|pail", null, null],   // 尿布桶袋子：是消耗品，但不是纸尿裤，不动
  [["baby"], "勺|碗|喂食器|奶瓶|吸奶器|spoon|feeder|bottle|pump", "gear_baby", "喂养用品"],
  [["baby"], "湿巾|wipes", "baby", "湿巾"],
  [["baby"], "尿布|纸尿裤|diaper|nappy", "baby", "纸尿裤"],
  // ── 纸品清洁 ──
  [["daily"], "冷冻袋|保鲜袋|保鲜膜|锡纸|垃圾袋|密封袋|foil|ziploc|zip ?lock|trash bag|garbage bag|plastic wrap|freezer bag", "daily", "厨房耗材"],
  [["daily"], "洗衣|oxiclean|detergent|laundry|softener|stain", "daily", "洗衣用品"],
  [["daily"], "纸巾|卫生纸|厨房纸|餐巾纸|抽纸|tissue|toilet paper|paper towel|napkin", "daily", "纸品"],
  // ── 放错进消耗品的耐用品（裤子、储物箱、擦手布）──
  [["daily"], "裤|裙|衣服|衬衫|外套|袜|pants|shirt|dress|jacket|socks", "gear_clothes", "裤裙"],
  [["daily"], "储物箱|收纳箱|收纳盒|storage bin|storage box|organizer", "gear_decor", "收纳箱"],
  [["daily"], "擦手布|毛巾|浴巾|towel", "gear_home", "毛巾浴巾"],
  // ── 家居耐用品（from = null：只在耐用品之间调整）──
  [null, "pack ?& ?play|pack ?n ?play|旅行床|travel crib", "gear_baby", "出行用品"],
  [null, "婴儿床|摇篮|尿布台|哺乳椅|crib|bassinet|changing table|glider|nursing chair", "gear_baby", "婴儿房"],
  [null, "床架|床垫|上下床|bed ?frame|mattress|bunk bed", "gear_furniture", "床架床垫"],
  [null, "床头柜|柜子|衣柜|书架|置物架|nightstand|dresser|cabinet|bookshelf|shelf", "gear_furniture", "柜子床头柜"],
  [null, "沙发|sofa|couch|loveseat", "gear_furniture", "沙发"],
  [null, "餐桌|书桌|椅|凳|desk|chair|stool|dining table", "gear_furniture", "桌椅"],
  [null, "台灯|落地灯|lamp", "gear_furniture", "灯具"],
  [null, "电热毯|electric blanket|heated blanket", "gear_home", "电热毯"],
  [null, "被子|枕|床单|被罩|四件套|床品|duvet|pillow|bed sheet|comforter|quilt", "gear_home", "床品被褥"],
  [null, `窗帘|地毯|地垫|curtain|carpet|${w("rugs?")}`, "gear_home", "窗帘地毯"],
  [null, "温湿度计|温度计|湿度计|hygrometer|thermometer", "gear_digital", "智能家居"],
  [null, `大富翁|桌游|拼图|monopoly|twister|board game|puzzle|${w("uno")}`, "gear_toys", "桌游"],
  [null, `乐高|积木|玩具|毛绒|lego|plush|${w("toys?")}`, "gear_toys", "玩具"],
  [null, "instant ?pot|电高压锅|电饭锅|微波炉|烤箱|空气炸锅|搅拌机|料理机|豆浆机|炒菜机|热水壶|电水壶|热水器|咖啡机|blender|microwave|oven|air fryer|toaster|kettle|rice cooker|coffee maker", "gear_appliance", "厨房电器"],
  [null, `吸尘器|扫地机|拖地机|vacuum|roomba|${w("mop")}`, "gear_appliance", "清洁电器"],
  [null, `电暖|取暖器|暖风机|电风扇|风扇|空调|除湿机|heater|dehumidifier|air conditioner|${w("fans?")}`, "gear_appliance", "空调取暖"],
  [null, `电视|音箱|音响|投影|television|speaker|soundbar|projector|${w("tv")}`, "gear_appliance", "影音"],
  [null, "靴|鞋|boot|shoe|sneaker|slipper", "gear_clothes", "鞋靴"],
  [null, "保暖内衣|内衣|袜|underwear|socks|thermal", "gear_clothes", "内衣袜子"],
  [null, "外套|夹克|羽绒|大衣|coat|jacket|parka", "gear_clothes", "外套"],
  [null, "打底裤|裤|裙|leggings|pants|jeans|skirt|shorts", "gear_clothes", "裤裙"],
  [null, `t恤|衬衫|上衣|毛衣|卫衣|t-shirt|shirt|sweater|hoodie|blouse|${w("tee")}`, "gear_clothes", "上衣"],
  [null, "圣诞|节日|装饰|万圣|decoration|ornament|christmas|halloween", "gear_decor", "节日装饰"],
  // ── 汽车房屋消耗品 ──
  [["house_water", "house_repair", "house_safety"], "把手|配件|零件|handle|replacement part", "house_repair", "替换零件"],
  [["house_safety"], `灯泡|灯管|bulb|${w("led")}`, "house_safety", "灯泡灯管"],
];

/** from = null 的规则作用在哪些分类上：只在家居耐用品里互相调整，不去动食品 */
export const DURABLE_FROM = ["gear_home", "gear_kitchen", "gear_baby", "gear_clothes", "gear_tools", "gear_garden", "gear_digital", "gear_travel", "gear_study", "gear_car",
  "gear_furniture", "gear_appliance", "gear_toys", "gear_decor"];
const COMPILED = RULES.map(([from, re, cat, sub]) => [from, new RegExp(re, "i"), cat, sub]);
const applies = (from, cat) => (from ? from.includes(cat) : DURABLE_FROM.includes(cat));

/** 已有物品：按名称和现在的分类猜新的 [分类, 小类]；猜不到 / 命中例外返回 null。蔬果没有小类的默认蔬菜 */
export function guessFor(name, curCat, curSub = null) {
  const s = String(name || "");
  for (const [from, re, cat, sub] of COMPILED) if (applies(from, curCat) && re.test(s)) return cat ? [cat, sub] : null;
  return curCat === "fresh" && !curSub ? ["fresh", "蔬菜"] : null;
}
/** 新物品：在选定的空间里猜（spaceOf：分类 → 空间）；猜不到返回 null */
export function guessNew(name, space, spaceOf) {
  const s = String(name || ""); if (!s.trim()) return null;
  if (space === "pantry" && /冷冻|速冻|frozen/i.test(s)) {   // 名字里写了冷冻：放冷冻，再按冷冻的小类猜
    for (const [from, re, cat, sub] of COMPILED) if (from && from[0] === "frozen" && from.length === 1 && re.test(s)) return [cat, sub];
    return ["frozen", "速冻面点"];
  }
  for (const [from, re, cat, sub] of COMPILED) {
    if (!cat || spaceOf(cat) !== space) continue;
    if (from && !from.some((c) => spaceOf(c) === space)) continue;
    if (re.test(s)) return [cat, sub];
  }
  return null;
}
