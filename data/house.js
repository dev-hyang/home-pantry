/* 房屋维护 · 静态数据（第一期）
 * - 房型模板：北美 / 中国两套，可在“房屋资料”里自由切换
 * - 责任归属：不同房型下，各部位通常由谁负责维护（以 HOA 章程、物业合同、租约为准）
 * - 材料保养：外墙、屋面、地面的保养建议
 * - 耗材模板：根据房屋资料推荐“房屋耗材”，用户勾选后批量加入库存，之后照常增删改查
 * 所有周期和寿命都是常见经验值，实际以产品说明书和专业人士的判断为准。
 */
(() => {
  "use strict";

  // ── 房屋耗材分类（追加到全局 CATEGORIES，space = "house"）──
  const HOUSE_CATEGORIES = [
    { id: "house_hvac",   name: "暖通与空气", icon: "🌀", color: "#3b7fc4", loc: "地下室", subs: ["炉子滤网", "加湿器滤芯", "新风滤网", "空调配件"] },
    { id: "house_water",  name: "水与管道",   icon: "🚰", color: "#24897d", loc: "地下室", subs: ["净水滤芯", "软水盐", "疏通除臭", "浴缸水疗"] },
    { id: "house_season", name: "季节与庭院", icon: "❄️", color: "#5f7fa8", loc: "车库",   subs: ["融雪用品", "草坪花园", "防潮除湿"] },
    { id: "house_pest",   name: "防虫防鼠",   icon: "🐜", color: "#b07a1a", loc: "车库",   subs: ["捕鼠", "防虫诱饵", "驱蚊"] },
    { id: "house_safety", name: "安全与电力", icon: "🔋", color: "#c75a85", loc: "储物间", subs: ["电池", "灯泡灯管", "保险丝"] },
    { id: "house_repair", name: "维修耗材",   icon: "🧰", color: "#7563c0", loc: "工具间", subs: ["密封胶", "修补材料", "润滑防锈", "胶带五金"] },
    { id: "house_care",   name: "外墙地面养护", icon: "🧽", color: "#8a6d3b", loc: "储物间", subs: ["地板护理", "外墙清洁", "木作防护", "瓷砖石材"] },
    { id: "house_car",    name: "汽车养护",   icon: "🛢️", color: "#7a5c8e", loc: "车库",   subs: ["油液", "雨刮与灯泡", "清洁美容", "应急耗材"] },
  ].map((c) => ({ ...c, space: "house" }));
  window.CATEGORIES.push(...HOUSE_CATEGORIES);
  window.HOUSE_GROUP = { id: "house", name: "房屋维护", icon: "🏠", color: "#5c6b63" };  // 统计图里合并显示

  // ── 地区 ──
  const REGIONS = {
    na: { id: "na", name: "北美", hint: "美国、加拿大" },
    cn: { id: "cn", name: "中国", hint: "中国大陆" },
  };

  // ── 设施与特征（勾选后决定推荐哪些耗材；第二期也用于生成设备档案）──
  const FEATURES = [
    { id: "forced_air",     name: "暖风炉（Furnace）",   region: "na" },
    { id: "boiler",         name: "锅炉 + 暖气片",        region: "na" },
    { id: "heat_pump",      name: "热泵",                region: "na" },
    { id: "central_ac",     name: "中央空调",            region: "both" },
    { id: "humidifier",     name: "全屋加湿器",          region: "na" },
    { id: "water_softener", name: "软水机",              region: "both" },
    { id: "sump_pump",      name: "排水泵（Sump pump）", region: "na" },
    { id: "basement",       name: "地下室",              region: "both" },
    { id: "snow",           name: "冬季下雪",            region: "both" },
    { id: "floor_heating",  name: "地暖",                region: "cn" },
    { id: "wall_boiler",    name: "壁挂炉",              region: "cn" },
    { id: "central_heat",   name: "集中供暖暖气片",      region: "cn" },
    { id: "fresh_air",      name: "新风系统",            region: "cn" },
    { id: "water_purifier", name: "净水器",              region: "both" },
    { id: "humid_season",   name: "梅雨 / 回南天",       region: "cn" },
    { id: "gas",            name: "天然气 / 燃气",       region: "both" },
    { id: "garage",         name: "车库",                region: "both" },
    { id: "driveway",       name: "自家车道",            region: "na" },
    { id: "car",            name: "有汽车",              region: "both" },
    { id: "lawn",           name: "草坪 / 花园",         region: "both" },
    { id: "deck",           name: "木平台 / 露台",       region: "both" },
    { id: "fireplace",      name: "壁炉",                region: "na" },
    { id: "hot_tub",        name: "热水浴缸",            region: "both" },
    { id: "septic",         name: "化粪池（不接市政下水）", region: "na" },
    { id: "well",           name: "自家水井",            region: "na" },
    { id: "security",       name: "安防 / 门铃摄像头",   region: "both" },
  ];

  // ── 材料 ──
  const MATERIALS = {
    exterior: [
      { id: "brick",        name: "砖 / 石材（Masonry）", region: "both", tips: [
        "每年春秋检查灰缝，松动、脱落处需要勾缝修补（tuckpointing）。",
        "清洗用低压水和软刷，高压水枪会冲坏灰缝。",
        "芝加哥这类冻融地区，渗进砖里的水结冰会让砖面剥落：保持排水槽和落水管把水引离墙面。",
        "是否涂防水剂先咨询专业人士，不透气的涂层会把湿气封在砖里。",
      ] },
      { id: "vinyl",        name: "乙烯基外墙板（Vinyl siding）", region: "na", tips: [
        "每年用温和肥皂水和软毛刷自上而下清洗一次，不要用高压水对着接缝冲。",
        "大风、冰雹后检查有没有松脱或开裂的板材。",
        "烧烤炉离墙远一点，高温会让板材变形。",
      ] },
      { id: "wood",         name: "木质外墙", region: "both", tips: [
        "通常 3–7 年重新上漆或染色一次，日晒多的一面更快。",
        "每年检查腐朽、开裂和缝隙，及时打胶。",
        "植物和土壤与墙面保持距离，减少受潮。",
      ] },
      { id: "fiber_cement", name: "纤维水泥板（如 Hardie）", region: "na", tips: [
        "漆面比木材耐久，重新上漆周期较长，以厂家说明为准。",
        "定期检查接缝和窗边的密封胶。",
      ] },
      { id: "stucco",       name: "灰泥（Stucco）", region: "na", tips: [
        "每年检查裂缝；细小裂缝可用专用填补剂处理。",
        "较大裂缝、鼓包或墙内潮湿，请专业人士检查是否渗水。",
      ] },
      { id: "cn_coating",   name: "外墙涂料 / 真石漆", region: "cn", tips: [
        "公寓外墙一般由物业统一维护，发现渗水、起皮、空鼓及时报修。",
        "别墅自管时，通常 8–10 年翻新一次，以涂料说明为准。",
      ] },
      { id: "cn_tile",      name: "外墙瓷砖", region: "cn", tips: [
        "瓷砖空鼓、松动有坠落风险，发现后立即报物业或请专业人员处理。",
      ] },
    ],
    roof: [
      { id: "asphalt", name: "沥青瓦", region: "both", tips: [
        "每年春秋以及大风冰雹后，从地面目视检查缺瓦、翘边、裸露的钉子。",
        "排水槽每年至少清理两次：春季一次，秋季落叶后一次。",
        "冬季注意屋檐冰坝（ice dam），根本办法是做好阁楼保温和通风。",
        "常见寿命约 20–25 年。",
      ] },
      { id: "metal",   name: "金属屋面", region: "both", tips: ["定期检查螺钉和密封垫圈是否老化。", "寿命较长，常见 40 年以上。"] },
      { id: "tile",    name: "陶瓦 / 水泥瓦", region: "both", tips: ["瓦片易碎，不要随意踩踏。", "大风后检查有无碎瓦、移位。"] },
      { id: "flat",    name: "平屋面（防水层）", region: "both", tips: [
        "每年检查是否积水、防水层是否起鼓开裂，保持排水口通畅。",
        "公寓顶层发现屋面漏水，先报物业或 HOA；公共屋面通常由维修基金或 HOA 负责。",
      ] },
    ],
    flooring: [
      { id: "hardwood",   name: "实木地板", region: "both", tips: [
        "日常吸尘或干拖；清洁用中性木地板清洁剂，拖把拧到微湿，不要用蒸汽拖把。",
        "家具脚贴毛毡垫，门口放地垫挡砂石。",
        "室内湿度保持约 35%–55%；北方冬季暖气干燥容易出现缝隙，可开加湿器。",
        "表面磨损时约 3–5 年做一次表层翻新（screen & recoat），深度划痕再考虑整体打磨。",
      ] },
      { id: "engineered", name: "实木复合地板", region: "both", tips: [
        "保养方式同实木，但表层较薄，整体打磨的次数有限。",
        "有地暖时选标明适用地暖的产品，升温要缓慢分段。",
      ] },
      { id: "laminate",   name: "强化复合地板", region: "both", tips: ["只能微湿拖，避免积水，遇水容易膨胀。", "不需要打蜡或抛光。"] },
      { id: "lvp",        name: "乙烯基地板（LVP / SPC）", region: "both", tips: ["耐水，可以湿拖；避免钢丝球等研磨工具。", "部分橡胶底地垫会让地板变色。"] },
      { id: "tile",       name: "瓷砖", region: "both", tips: ["填缝约 1–2 年做一次封护，视使用强度。", "卫生间发霉的玻璃胶及时铲掉重打。"] },
      { id: "stone",      name: "大理石 / 石材", region: "both", tips: ["用中性清洁剂，避免醋、柠檬等酸性清洁剂。", "一般每年做一次防护，视石材种类。"] },
      { id: "carpet",     name: "地毯", region: "both", tips: ["每周吸尘。", "约 12–18 个月深度清洁一次。"] },
    ],
  };

  // ── 责任归属：部位 × 房型 ──
  // self 自己｜hoa HOA｜landlord 房东｜property 物业｜varies 看章程/合同｜na 通常没有
  const OWNERS = {
    self:     { name: "自己",           cls: "o-self" },
    hoa:      { name: "HOA",            cls: "o-hoa" },
    landlord: { name: "房东",           cls: "o-hoa" },
    property: { name: "物业 / 维修基金", cls: "o-hoa" },
    varies:   { name: "看章程或合同",   cls: "o-varies" },
    na:       { name: "通常没有",       cls: "o-na" },
  };
  const SYSTEMS = [
    { id: "roof",     name: "屋顶 / 屋面" },
    { id: "exterior", name: "外墙" },
    { id: "gutters",  name: "排水槽、落水管" },
    { id: "windows",  name: "门窗" },
    { id: "yard",     name: "除雪、草坪园林" },
    { id: "hvac",     name: "户内暖通（炉子、空调）" },
    { id: "water_heater", name: "热水器" },
    { id: "plumbing", name: "户内水管" },
    { id: "common",   name: "公共管道、电梯、走廊" },
    { id: "sump",     name: "地下室排水泵" },
  ];

  const HOUSE_TYPES = {
    na: [
      { id: "sfh", name: "独栋别墅", en: "Single-family home", icon: "🏡",
        desc: "里里外外都由自己负责，维护项目最多。",
        features: ["forced_air", "central_ac", "humidifier", "gas", "basement", "sump_pump", "garage", "driveway", "lawn", "snow"],
        owners: { roof: "self", exterior: "self", gutters: "self", windows: "self", yard: "self", hvac: "self", water_heater: "self", plumbing: "self", common: "na", sump: "self" } },
      { id: "townhome", name: "联排别墅", en: "Townhome", icon: "🏘️",
        desc: "外墙、屋顶常由 HOA 统一负责，户内自己负责；各小区章程差别较大。",
        features: ["forced_air", "central_ac", "gas", "garage", "snow"],
        owners: { roof: "varies", exterior: "varies", gutters: "hoa", windows: "varies", yard: "hoa", hvac: "self", water_heater: "self", plumbing: "self", common: "hoa", sump: "varies" } },
      { id: "condo", name: "公寓", en: "Condo", icon: "🏢",
        desc: "建筑外部和公共区域由 HOA 负责，户内设备自己负责。",
        features: ["forced_air", "central_ac", "snow"],
        owners: { roof: "hoa", exterior: "hoa", gutters: "hoa", windows: "varies", yard: "hoa", hvac: "self", water_heater: "self", plumbing: "varies", common: "hoa", sump: "hoa" } },
      { id: "rental", name: "租住公寓", en: "Apartment (rental)", icon: "🔑",
        desc: "大部分维修找房东；换滤网、电池等日常小事按租约约定。",
        features: ["central_ac", "snow"],
        owners: { roof: "landlord", exterior: "landlord", gutters: "landlord", windows: "landlord", yard: "landlord", hvac: "varies", water_heater: "landlord", plumbing: "landlord", common: "landlord", sump: "landlord" } },
    ],
    cn: [
      { id: "cn_highrise", name: "电梯公寓", en: "商品房 · 高层", icon: "🏢",
        desc: "外墙、屋面、电梯、公共管道由物业负责（大修动用维修基金），户内自己负责。",
        features: ["water_purifier", "gas"],
        owners: { roof: "property", exterior: "property", gutters: "property", windows: "self", yard: "property", hvac: "self", water_heater: "self", plumbing: "self", common: "property", sump: "na" } },
      { id: "cn_walkup", name: "多层 / 老小区", en: "步梯房", icon: "🏬",
        desc: "公共部分可能没有专业物业，屋面漏水、管道老化常需和邻居、社区协调。",
        features: ["gas"],
        owners: { roof: "varies", exterior: "varies", gutters: "varies", windows: "self", yard: "varies", hvac: "self", water_heater: "self", plumbing: "self", common: "varies", sump: "na" } },
      { id: "cn_townhouse", name: "联排 / 叠拼", en: "Townhouse", icon: "🏘️",
        desc: "外立面通常物业统一，露台、花园、户内设备多为自己负责。",
        features: ["floor_heating", "wall_boiler", "fresh_air", "water_purifier", "gas", "lawn"],
        owners: { roof: "varies", exterior: "property", gutters: "varies", windows: "self", yard: "self", hvac: "self", water_heater: "self", plumbing: "self", common: "property", sump: "self" } },
      { id: "cn_villa", name: "独栋别墅", en: "Villa", icon: "🏡",
        desc: "基本都由自己负责，小区道路和公共绿化归物业。",
        features: ["floor_heating", "wall_boiler", "fresh_air", "water_purifier", "central_ac", "gas", "lawn", "garage"],
        owners: { roof: "self", exterior: "self", gutters: "self", windows: "self", yard: "self", hvac: "self", water_heater: "self", plumbing: "self", common: "property", sump: "self" } },
    ],
  };

  // ── 耗材模板 ──
  // every：大约多少天用掉 1 个单位（换算为“每天大约用多少”，用于即将告罄提醒）；不填则只按少货线提醒
  // when：满足任一条件即推荐；条件写法 "f:特征" "ext:外墙" "roof:屋面" "floor:地面" "type:房型" "*"（总是）
  const SUPPLIES = {
    na: [
      { name: "炉子滤网", category: "house_hvac", sub: "炉子滤网", unit: "片", qty: 2, min: 1, every: 90, loc: "地下室", when: ["f:forced_air"],
        note: "1 英寸滤网一般 1–3 个月换一次，有宠物或装修时更勤；尺寸印在旧滤网边框上，买前记下来。" },
      { name: "加湿器滤芯", category: "house_hvac", sub: "加湿器滤芯", unit: "片", qty: 1, min: 0, every: 365, loc: "地下室", when: ["f:humidifier"],
        note: "每个采暖季开始前换一次。" },
      { name: "软水盐", category: "house_water", sub: "软水盐", unit: "袋", qty: 2, min: 1, every: 30, loc: "地下室", when: ["f:water_softener"],
        note: "常见 40 lb 一袋，用量随家庭用水量变化，盐位低于水位线就该加了。" },
      { name: "冰箱滤芯", category: "house_water", sub: "净水滤芯", unit: "个", qty: 1, min: 0, every: 180, loc: "厨房柜", when: ["*"],
        note: "多数冰箱建议约 6 个月更换，型号见冰箱说明书。" },
      { name: "净水器滤芯", category: "house_water", sub: "净水滤芯", unit: "支", qty: 1, min: 0, every: 180, loc: "厨房柜", when: ["f:water_purifier"],
        note: "不同滤芯寿命不同，以说明书为准。" },
      { name: "热水浴缸水质试纸", category: "house_water", sub: "浴缸水疗", unit: "瓶", qty: 1, min: 1, every: 60, loc: "储物间", when: ["f:hot_tub"],
        note: "建议每周测一次水质；每 3–4 个月换一次水。" },
      { name: "热水浴缸消毒剂", category: "house_water", sub: "浴缸水疗", unit: "瓶", qty: 1, min: 1, every: 45, loc: "储物间", when: ["f:hot_tub"] },
      { name: "融雪盐", category: "house_season", sub: "融雪用品", unit: "袋", qty: 2, min: 1, loc: "车库", when: ["f:snow"],
        note: "入冬前备好；有宠物可选宠物友好型。" },
      { name: "草坪肥料", category: "house_season", sub: "草坪花园", unit: "袋", qty: 1, min: 0, every: 180, loc: "车库", when: ["f:lawn"],
        note: "芝加哥地区常见春、秋两季施肥。" },
      { name: "捕鼠器", category: "house_pest", sub: "捕鼠", unit: "个", qty: 4, min: 2, loc: "车库", when: ["type:sfh", "type:townhome", "f:basement", "f:garage"],
        note: "秋季天冷后老鼠容易进屋，地下室、车库角落提前布置。" },
      { name: "蚂蚁诱饵", category: "house_pest", sub: "防虫诱饵", unit: "盒", qty: 2, min: 1, loc: "储物间", when: ["*"] },
      { name: "驱蚊液", category: "house_pest", sub: "驱蚊", unit: "瓶", qty: 1, min: 1, every: 60, loc: "储物间", when: ["f:lawn", "f:deck"] },
      { name: "9V 电池（烟雾报警器）", category: "house_safety", sub: "电池", unit: "节", qty: 4, min: 2, every: 365, loc: "储物间", when: ["*"],
        note: "报警器每月按测试键检查；密封锂电池款无需换电池，到期整机更换。" },
      { name: "AA 电池", category: "house_safety", sub: "电池", unit: "节", qty: 8, min: 4, loc: "储物间", when: ["*"] },
      { name: "LED 灯泡", category: "house_safety", sub: "灯泡灯管", unit: "个", qty: 4, min: 2, loc: "储物间", when: ["*"] },
      { name: "硅胶密封胶（Caulk）", category: "house_repair", sub: "密封胶", unit: "支", qty: 1, min: 1, loc: "工具间", when: ["*"] },
      { name: "墙面修补膏（Spackle）", category: "house_repair", sub: "修补材料", unit: "盒", qty: 1, min: 0, loc: "工具间", when: ["*"] },
      { name: "WD-40 润滑防锈剂", category: "house_repair", sub: "润滑防锈", unit: "瓶", qty: 1, min: 0, loc: "工具间", when: ["type:sfh", "type:townhome", "f:garage"] },
      { name: "木地板清洁剂", category: "house_care", sub: "地板护理", unit: "瓶", qty: 1, min: 1, every: 120, loc: "储物间", when: ["floor:hardwood", "floor:engineered"],
        note: "选中性、标明适用木地板的产品。" },
      { name: "外墙清洁剂", category: "house_care", sub: "外墙清洁", unit: "瓶", qty: 1, min: 0, every: 365, loc: "车库", when: ["ext:vinyl"] },
      { name: "木平台防护油 / 染色剂", category: "house_care", sub: "木作防护", unit: "罐", qty: 1, min: 0, loc: "车库", when: ["f:deck"],
        note: "木平台通常 2–3 年重新涂一次，视日晒和产品。" },
      { name: "填缝封护剂", category: "house_care", sub: "瓷砖石材", unit: "瓶", qty: 1, min: 0, loc: "储物间", when: ["floor:tile"] },
      { name: "石材中性清洁剂", category: "house_care", sub: "瓷砖石材", unit: "瓶", qty: 1, min: 1, every: 180, loc: "储物间", when: ["floor:stone"] },
      { name: "玻璃水", category: "house_car", sub: "油液", unit: "瓶", qty: 1, min: 1, every: 60, loc: "车库", when: ["f:car"],
        note: "冬季选防冻型（-20℃ 以下）。" },
      { name: "机油", category: "house_car", sub: "油液", unit: "瓶", qty: 1, min: 0, every: 180, loc: "车库", when: ["f:car"],
        note: "粘度按保养手册选；多数车约 5000–7500 英里或半年换一次。自己不换油的话可以删掉这项。" },
      { name: "雨刮片", category: "house_car", sub: "雨刮与灯泡", unit: "副", qty: 1, min: 0, every: 365, loc: "车库", when: ["f:car"],
        note: "刮不干净或有跳动时更换，尺寸见车主手册。" },
    ],
    cn: [
      { name: "净水器滤芯", category: "house_water", sub: "净水滤芯", unit: "支", qty: 1, min: 0, every: 180, loc: "厨房柜", when: ["f:water_purifier"],
        note: "PP 棉、活性炭一般 3–6 个月，RO 膜更久，以说明书为准。" },
      { name: "新风滤网", category: "house_hvac", sub: "新风滤网", unit: "片", qty: 1, min: 0, every: 120, loc: "储物间", when: ["f:fresh_air"],
        note: "一般 3–6 个月更换，雾霾季更勤。" },
      { name: "软水盐", category: "house_water", sub: "软水盐", unit: "袋", qty: 2, min: 1, every: 30, loc: "储物间", when: ["f:water_softener"] },
      { name: "下水道疏通剂", category: "house_water", sub: "疏通除臭", unit: "瓶", qty: 1, min: 1, loc: "卫生间", when: ["*"] },
      { name: "防霉玻璃胶", category: "house_repair", sub: "密封胶", unit: "支", qty: 1, min: 1, loc: "工具间", when: ["*"],
        note: "卫生间、厨房台面接缝发霉时铲掉重打。" },
      { name: "蟑螂胶饵", category: "house_pest", sub: "防虫诱饵", unit: "支", qty: 2, min: 1, loc: "储物间", when: ["*"] },
      { name: "电蚊香液", category: "house_pest", sub: "驱蚊", unit: "瓶", qty: 2, min: 1, every: 30, loc: "储物间", when: ["*"] },
      { name: "除湿袋", category: "house_season", sub: "防潮除湿", unit: "袋", qty: 6, min: 2, every: 30, loc: "储物间", when: ["f:humid_season", "f:basement"],
        note: "梅雨季、回南天放在衣柜和储物间。" },
      { name: "花肥", category: "house_season", sub: "草坪花园", unit: "袋", qty: 1, min: 0, every: 180, loc: "阳台", when: ["f:lawn"] },
      { name: "融雪剂", category: "house_season", sub: "融雪用品", unit: "袋", qty: 1, min: 0, loc: "车库", when: ["f:snow"] },
      { name: "5 号电池", category: "house_safety", sub: "电池", unit: "节", qty: 8, min: 4, loc: "储物间", when: ["*"] },
      { name: "7 号电池", category: "house_safety", sub: "电池", unit: "节", qty: 8, min: 4, loc: "储物间", when: ["*"] },
      { name: "LED 灯泡", category: "house_safety", sub: "灯泡灯管", unit: "个", qty: 2, min: 1, loc: "储物间", when: ["*"] },
      { name: "墙面修补膏", category: "house_repair", sub: "修补材料", unit: "盒", qty: 1, min: 0, loc: "工具间", when: ["*"] },
      { name: "木地板清洁剂", category: "house_care", sub: "地板护理", unit: "瓶", qty: 1, min: 1, every: 120, loc: "储物间", when: ["floor:hardwood", "floor:engineered"] },
      { name: "木地板精油", category: "house_care", sub: "地板护理", unit: "瓶", qty: 1, min: 0, loc: "储物间", when: ["floor:hardwood"] },
      { name: "填缝封护剂", category: "house_care", sub: "瓷砖石材", unit: "瓶", qty: 1, min: 0, loc: "储物间", when: ["floor:tile"] },
      { name: "石材中性清洁剂", category: "house_care", sub: "瓷砖石材", unit: "瓶", qty: 1, min: 1, every: 180, loc: "储物间", when: ["floor:stone"] },
      { name: "木平台防护油", category: "house_care", sub: "木作防护", unit: "罐", qty: 1, min: 0, loc: "阳台", when: ["f:deck"] },
      { name: "玻璃水", category: "house_car", sub: "油液", unit: "瓶", qty: 1, min: 1, every: 60, loc: "车库", when: ["f:car"],
        note: "北方冬季选防冻型。" },
      { name: "雨刮片", category: "house_car", sub: "雨刮与灯泡", unit: "副", qty: 1, min: 0, every: 365, loc: "车库", when: ["f:car"] },
    ],
  };

  // ── 设备 ↔ 耗材：设备类型 id → 它用到的耗材（名称与上面 SUPPLIES 模板一致，设备页“相关耗材”按名称对应库存里的房屋耗材）──
  const ASSET_SUPPLIES = {
    furnace: ["炉子滤网"], ac: ["炉子滤网"], heat_pump: ["炉子滤网"],
    humidifier: ["加湿器滤芯"], fresh_air: ["新风滤网"],
    water_softener: ["软水盐"], water_purifier: ["净水器滤芯"], refrigerator: ["冰箱滤芯"],
    hot_tub: ["热水浴缸水质试纸", "热水浴缸消毒剂"],
    smoke_alarm: ["9V 电池（烟雾报警器）", "5 号电池"], thermostat: ["AA 电池", "5 号电池"],
    leak_sensor: ["AA 电池", "5 号电池"], security_system: ["AA 电池", "5 号电池"],
    deck: ["木平台防护油 / 染色剂", "木平台防护油"], garage_door: ["WD-40 润滑防锈剂"],
    generator: ["机油"],
  };

  // ── 设备档案模板（第二期）──
  // life：常见寿命（年）作为默认值；interval：建议保养间隔（月）；system：对应责任归属表的部位，默认负责方从房型取
  // when 写法同耗材模板；optional = true 的项在生成页默认不勾选；lifeByRoof 按屋面材料覆盖寿命
  const ASSET_TYPES = [
    { id: "furnace",        name: "暖风炉",           en: "Furnace",            icon: "🔥", kind: "equipment", life: 18, interval: 12, system: "hvac",         region: "na",   when: ["f:forced_air"],   tip: "每年采暖季前检修一次；滤网 1–3 个月换。" },
    { id: "boiler",         name: "锅炉",             en: "Boiler",             icon: "♨️", kind: "equipment", life: 20, interval: 12, system: "hvac",         region: "na",   when: ["f:boiler"],       tip: "每年采暖季前检修、给暖气片放气。" },
    { id: "heat_pump",      name: "热泵",             en: "Heat pump",          icon: "🌡️", kind: "equipment", life: 15, interval: 12, system: "hvac",         region: "na",   when: ["f:heat_pump"],    tip: "每年检修一次，室外机保持通风。" },
    { id: "ac",             name: "中央空调",         en: "Central AC",         icon: "❄️", kind: "equipment", life: 15, interval: 12, system: "hvac",         region: "both", when: ["f:central_ac"],   tip: "每年入夏前检修，清洗室外机翅片。" },
    { id: "wall_boiler",    name: "壁挂炉",           en: "Wall-hung boiler",   icon: "♨️", kind: "equipment", life: 12, interval: 12, system: "hvac",         region: "cn",   when: ["f:wall_boiler"],  tip: "每年供暖前年检、补水、清洗换热器。" },
    { id: "floor_heating",  name: "地暖",             en: "Floor heating",      icon: "🔥", kind: "equipment", life: 30, interval: 24, system: "hvac",         region: "cn",   when: ["f:floor_heating"], tip: "每 2–3 年清洗一次管路。" },
    { id: "fresh_air",      name: "新风系统",         en: "Fresh air system",   icon: "🌬️", kind: "equipment", life: 12, interval: 4,  system: "hvac",         region: "cn",   when: ["f:fresh_air"],    tip: "3–6 个月换滤网，雾霾季更勤。" },
    { id: "humidifier",     name: "全屋加湿器",       en: "Whole-house humidifier", icon: "💧", kind: "equipment", life: 12, interval: 12, system: "hvac",   region: "na",   when: ["f:humidifier"],   tip: "采暖季前换滤芯、清理水垢。" },
    { id: "water_heater",   name: "热水器",           en: "Water heater",       icon: "🚿", kind: "equipment", life: 10, interval: 12, system: "water_heater", region: "both", when: ["*"],              tip: "储水式每年排污一次；镁棒 3–5 年检查。" },
    { id: "sump_pump",      name: "排水泵",           en: "Sump pump",          icon: "⛽", kind: "equipment", life: 8,  interval: 6,  system: "sump",         region: "na",   when: ["f:sump_pump"],    tip: "每半年倒水测试；建议配备用电池。" },
    { id: "water_softener", name: "软水机",           en: "Water softener",     icon: "🧂", kind: "equipment", life: 12, interval: 12, system: "plumbing",     region: "both", when: ["f:water_softener"], tip: "每年清洗盐箱，检查再生周期。" },
    { id: "water_purifier", name: "净水器",           en: "Water purifier",     icon: "🚰", kind: "equipment", life: 8,  interval: 6,  system: "plumbing",     region: "both", when: ["f:water_purifier"], tip: "按滤芯寿命更换。" },
    { id: "roof",           name: "屋顶",             en: "Roof",               icon: "🏠", kind: "equipment", life: 22, interval: 12, system: "roof",         region: "both", when: ["type:sfh", "type:townhome", "type:cn_villa", "type:cn_townhouse"], lifeByRoof: { asphalt: 22, metal: 50, tile: 50, flat: 18 }, tip: "每年春秋目视检查，大风冰雹后补查。" },
    { id: "garage_door",    name: "车库门开门器",     en: "Garage door opener", icon: "🚪", kind: "equipment", life: 12, interval: 12, system: null,           region: "both", when: ["f:garage"],       tip: "每年润滑导轨、测试自动回弹。" },
    { id: "driveway_asphalt",  name: "沥青车道",      en: "Asphalt driveway",   icon: "🛣️", kind: "equipment", life: 20, interval: 12, system: "exterior",     region: "na",   when: ["f:driveway"],     tip: "每年春秋查裂缝并填缝；每 2–3 年封层；12–15 年重铺面层；20–25 年整体更换。" },
    { id: "driveway_concrete", name: "混凝土车道",    en: "Concrete driveway",  icon: "🛣️", kind: "equipment", life: 30, interval: 12, system: "exterior",     region: "na",   when: ["f:driveway"], optional: true, tip: "每年查裂缝和错台；3–5 年刷渗透型防护剂；第一年冬天不撒盐。" },
    // 车辆：挂在家庭上（不按房产），不自动推荐；类型 = 动力类型，决定保养模板（data/vehicles.js）
    { id: "vehicle_gas",    name: "油车",             en: "Gas car",            icon: "🚗", kind: "vehicle",   life: 15, interval: 6,  system: null,           region: "both", when: [] },
    { id: "vehicle_hybrid", name: "混动",             en: "Hybrid",             icon: "🚙", kind: "vehicle",   life: 15, interval: 6,  system: null,           region: "both", when: [] },
    { id: "vehicle_phev",   name: "插混",             en: "Plug-in hybrid",     icon: "🔌", kind: "vehicle",   life: 15, interval: 6,  system: null,           region: "both", when: [] },
    { id: "vehicle_ev",     name: "纯电",             en: "EV",                 icon: "⚡", kind: "vehicle",   life: 15, interval: 6,  system: null,           region: "both", when: [] },
    { id: "hot_tub",        name: "热水浴缸",         en: "Hot tub",            icon: "🛁", kind: "equipment", life: 12, interval: 3,  system: "plumbing",     region: "both", when: ["f:hot_tub"],      tip: "每 3–4 个月换水、清洗滤芯。" },
    { id: "fireplace",      name: "壁炉 / 烟囱",      en: "Fireplace",          icon: "🧱", kind: "equipment", life: null, interval: 12, system: "hvac",       region: "na",   when: ["f:fireplace"],    tip: "每年烧季前清扫烟囱。" },
    { id: "smoke_alarm",    name: "烟雾 / CO 报警器", en: "Smoke & CO alarm",   icon: "🚨", kind: "equipment", life: 10, interval: 12, system: null,           region: "both", when: ["*"],              tip: "每月按测试键；整机约 10 年更换。" },
    // ── 厨房 / 洗衣房家电（两地都有；寿命按北美常见统计）──
    { id: "range",          name: "灶具 / 烤箱",      en: "Range / oven",       icon: "🥘", kind: "equipment", life: 15, interval: 12, system: null,           region: "both", when: ["*"],              tip: "燃气灶每年看火焰是否为蓝色、查软管接头；电灶查加热盘和线路。烤箱自清洁功能别频繁用，高温伤电路板。" },
    { id: "range_hood",     name: "抽油烟机",         en: "Range hood",         icon: "🍳", kind: "equipment", life: 10, interval: 6,  system: null,           region: "both", when: ["*"],              tip: "每半年深度清洗。" },
    { id: "refrigerator",   name: "冰箱",             en: "Refrigerator",       icon: "🧊", kind: "equipment", life: 13, interval: 6,  system: null,           region: "both", when: ["*"],              tip: "每半年吸一次冷凝器线圈、查门封条；有制冰 / 饮水的 6 个月换滤芯。" },
    { id: "dishwasher",     name: "洗碗机",           en: "Dishwasher",         icon: "🍽️", kind: "equipment", life: 10, interval: 6,  system: "plumbing",     region: "both", when: ["*"],              tip: "每月清底部滤网；每半年查进水软管、门封，空机跑一次清洁程序。" },
    { id: "disposal",       name: "垃圾处理器",       en: "Garbage disposal",   icon: "🌀", kind: "equipment", life: 10, interval: 6,  system: "plumbing",     region: "na",   when: ["*"],              tip: "别倒油脂、骨头、咖啡渣；冰块加柠檬皮清洁；卡住先断电，用底部六角扳手转动。" },
    { id: "microwave",      name: "微波炉",           en: "Microwave",          icon: "📻", kind: "equipment", life: 9,  interval: null, system: null,         region: "both", when: ["*"], optional: true },
    { id: "washer",         name: "洗衣机",           en: "Washer",             icon: "🫧", kind: "equipment", life: 11, interval: 12, system: "plumbing",     region: "both", when: ["*"],              tip: "进水软管每 5 年换（建议不锈钢编织管）；每月擦门胶圈、跑一次清洁程序；长时间不用关水阀。" },
    { id: "dryer",          name: "烘干机",           en: "Dryer",              icon: "🌪️", kind: "equipment", life: 13, interval: 12, system: null,           region: "both", when: ["*"],              tip: "每次用完清绒毛滤网；每年清一次排气管道（烘干机火灾的主因），查外墙排气口挡板能否开合。" },
    // ── 其他北美常见设备（按设施出现，多数默认不勾）──
    { id: "gutters",        name: "排水槽 / 落水管",  en: "Gutters & downspouts", icon: "🪣", kind: "equipment", life: 20, interval: 6, system: "gutters",     region: "na",   when: ["type:sfh", "type:townhome"], tip: "春秋各清一次；查接缝漏水、挂钩松动，落水管出口离地基至少 1.5 米。" },
    { id: "deck",           name: "木平台 / 露台",    en: "Deck",               icon: "🪵", kind: "equipment", life: 20, interval: 12, system: "exterior",     region: "both", when: ["f:deck"],         tip: "每年查松动板、翘起的钉子和连接房屋的 ledger board；2–3 年刷一次防护油。" },
    { id: "irrigation",     name: "草坪灌溉系统",     en: "Sprinkler system",   icon: "💦", kind: "equipment", life: 20, interval: 12, system: "yard",         region: "na",   when: ["f:lawn"], optional: true, tip: "春天开启时逐区查喷头、调方向；上冻前吹空管路（winterize），否则会冻裂。" },
    { id: "ejector_pump",   name: "污水提升泵",       en: "Ejector pump",       icon: "🕳️", kind: "equipment", life: 10, interval: 12, system: "plumbing",     region: "na",   when: ["f:basement"], optional: true, tip: "地下室卫生间 / 洗衣房用；每年听运行声音、查密封盖和通气管，有异味多是密封坏了。" },
    { id: "radon_fan",      name: "氡气排放系统",     en: "Radon mitigation",   icon: "🌬️", kind: "equipment", life: 10, interval: 12, system: null,           region: "na",   when: ["f:basement"], optional: true, tip: "看 U 形压力计两边液面是否不齐（齐了 = 风扇停了）；风扇 5–10 年换；每 2 年复测一次氡。" },
    { id: "ev_charger",     name: "家用充电桩",       en: "EV charger",         icon: "🔌", kind: "equipment", life: 10, interval: 12, system: null,           region: "both", when: ["f:car"], optional: true, tip: "查线缆、插头有没有发热变色或松动；留意厂商固件更新。" },
    { id: "generator",      name: "备用发电机",       en: "Standby generator",  icon: "🔋", kind: "equipment", life: 20, interval: 12, system: null,           region: "na",   when: ["*"], optional: true, tip: "每年换机油、火花塞、空滤；每月自检要能听到它跑；久不用的油要加稳定剂。" },
    // ── 电力与网络 ──
    { id: "electrical_panel", name: "配电箱",         en: "Electrical panel",   icon: "⚡", kind: "equipment", life: 35, interval: 12, system: null,           region: "both", when: ["*"],              tip: "每年开盖看有没有烧痕、发热、嗡嗡声，回路标签写全；Federal Pacific、Zinsco 这类老牌子建议直接换。" },
    { id: "surge_protector", name: "全屋浪涌保护器",  en: "Whole-house surge protector", icon: "🛡️", kind: "equipment", life: 8, interval: 12, system: null,  region: "na",   when: ["*"], optional: true, tip: "装在配电箱旁；指示灯灭了说明已经挡过大浪涌、要换。" },
    { id: "thermostat",     name: "温控器",           en: "Thermostat",         icon: "🎛️", kind: "equipment", life: 10, interval: null, system: "hvac",       region: "both", when: ["f:forced_air", "f:heat_pump", "f:central_ac", "f:boiler"], optional: true, tip: "电池款每年换电池；智能款记下账号和 Wi‑Fi 重连方法。" },
    { id: "router",         name: "路由器 / Mesh",    en: "Router / mesh Wi‑Fi", icon: "📶", kind: "equipment", life: 6,  interval: 12, system: null,           region: "both", when: ["*"],              tip: "备注里记各节点位置、管理地址和后台密码存放处；每年查一次固件更新，5–7 年换代。" },
    { id: "modem",          name: "光猫 / Modem",     en: "Modem / ONT",        icon: "📡", kind: "equipment", life: 6,  interval: null, system: null,         region: "both", when: ["*"], optional: true, tip: "运营商的设备要记归属，退网、搬家要归还；自购的记型号方便换运营商。" },
    { id: "security_system", name: "安防 / 门铃摄像头", en: "Security & doorbell cameras", icon: "📷", kind: "equipment", life: 7, interval: 12, system: null, region: "both", when: ["f:security"],     tip: "每年换传感器电池、擦镜头、查订阅到期；面板主密码存放处写进应急信息。" },
    { id: "leak_sensor",    name: "漏水传感器",       en: "Water leak sensors", icon: "💧", kind: "equipment", life: 5,  interval: 12, system: null,           region: "both", when: ["*"], optional: true, tip: "放热水器、洗衣机、水槽下、排水泵旁；每年换电池、按测试键。" },
    // ── 水路 ──
    { id: "prv",            name: "减压阀与膨胀罐",   en: "PRV & expansion tank", icon: "🔩", kind: "equipment", life: 10, interval: 12, system: "plumbing",   region: "na",   when: ["*"],              tip: "水压忽高忽低、热水器安全阀滴水多半是它俩；每年测一次水压（40–60 psi），膨胀罐敲上半截应是空响。" },
    { id: "backflow",       name: "灌溉回流防止器",   en: "Backflow preventer", icon: "🚰", kind: "equipment", life: 15, interval: 12, system: "yard",         region: "na",   when: ["f:lawn"], optional: true, tip: "很多镇要求每年由持证人员检测并备案；上冻前随灌溉一起排空。" },
    { id: "sewer_line",     name: "下水主管",         en: "Sewer line",         icon: "🕳️", kind: "equipment", life: 50, interval: 36, system: "plumbing",     region: "na",   when: ["type:sfh", "type:townhome"], optional: true, tip: "老房子多是粘土管，树根易侵入：每 3–5 年摄像检查一次；地下室地漏返水是第一信号。" },
    { id: "septic",         name: "化粪池系统",       en: "Septic system",      icon: "🛢️", kind: "equipment", life: 30, interval: 36, system: "plumbing",     region: "na",   when: ["f:septic"],       tip: "每 3–5 年抽一次；排水场上别停车、别种树；少用垃圾处理器。" },
    { id: "well_pump",      name: "井泵与压力罐",     en: "Well pump & pressure tank", icon: "⛲", kind: "equipment", life: 12, interval: 12, system: "plumbing", region: "na", when: ["f:well"],       tip: "每年验水质（细菌、硝酸盐）；压力罐气压比启动压力低 2 psi；泵频繁启停多半是压力罐坏了。" },
    // ── 建筑 ──
    { id: "windows",        name: "门窗",             en: "Windows & doors",    icon: "🪟", kind: "equipment", life: 25, interval: 12, system: "windows",      region: "both", when: ["*"],              tip: "每年查密封条、排水孔；双层玻璃中间起雾 = 密封失效。" },
    { id: "bath_fan",       name: "浴室排风扇",       en: "Bathroom exhaust fans", icon: "🌀", kind: "equipment", life: 10, interval: 12, system: null,        region: "both", when: ["*"],              tip: "每年拆格栅清灰；一张纸贴不住格栅就是风量不够了。" },
    { id: "attic",          name: "阁楼通风与保温",   en: "Attic ventilation & insulation", icon: "🏚️", kind: "equipment", life: 25, interval: 12, system: "roof", region: "na", when: ["type:sfh", "type:townhome"], optional: true, tip: "每年看一次：有没有漏水痕迹、保温层塌陷、通风口被堵；冬天屋檐结冰坝多半是阁楼太热。" },
    { id: "fence",          name: "栅栏 / 挡土墙",    en: "Fence / retaining wall", icon: "🪵", kind: "equipment", life: 20, interval: 12, system: "exterior",   region: "na",   when: ["type:sfh"], optional: true, tip: "每年查立柱松动、底部腐烂；挡土墙鼓出、排水孔堵塞要尽早处理。" },
    { id: "exterior_paint", name: "外墙漆 / 木饰面",  en: "Exterior paint / trim", icon: "🎨", kind: "equipment", life: 8, interval: 12, system: "exterior",    region: "na",   when: ["ext:wood"],       tip: "每年查起皮、开裂、窗框密封胶；7–10 年整体重刷。" },
    { id: "lawn_mower",     name: "割草机",           en: "Lawn mower",         icon: "🌿", kind: "tool",      life: 10, interval: 12, system: "yard",         region: "both", when: ["f:lawn"],         tip: "每季换机油、磨刀片；入冬放空汽油。" },
    { id: "snow_blower",    name: "除雪机",           en: "Snow blower",        icon: "🌨️", kind: "tool",      life: 10, interval: 12, system: "yard",         region: "na",   when: ["f:snow"], optional: true },
    { id: "pressure_washer", name: "高压清洗机",      en: "Pressure washer",    icon: "💦", kind: "tool",      life: 8,  interval: null, system: null,         region: "na",   when: ["type:sfh", "type:townhome"], optional: true },
    { id: "ladder",         name: "梯子",             en: "Ladder",             icon: "🪜", kind: "tool",      life: null, interval: null, system: null,       region: "both", when: [], legacy: true },
    { id: "drill",          name: "电钻",             en: "Drill",              icon: "🔩", kind: "tool",      life: null, interval: null, system: null,       region: "both", when: [], legacy: true },
    { id: "other_equipment", name: "其他设备",        en: "Other",              icon: "⚙️", kind: "equipment", life: null, interval: null, system: null,      region: "both", when: [] },
    { id: "other_tool",     name: "其他工具",         en: "Other tool",         icon: "🧰", kind: "tool",      life: null, interval: null, system: null,       region: "both", when: [] },
  ];
  const ASSET_KINDS = { equipment: { name: "设备", icon: "⚙️" }, tool: { name: "工具", icon: "🧰" }, vehicle: { name: "车辆", icon: "🚗" } };
  const MAINT_KINDS = { inspect: "检查", service: "保养", repair: "维修", replace: "更换" };
  // 设备维修保养的花费记到 purchases 时用的分类（不在物品分类里，统计并入“房屋维护”；车辆另有 VEHICLE_CAT）
  window.MAINT_CAT = { id: "house_maint", name: "设备维修保养", icon: "🔧", color: "#5c6b63" };

  // ── 季节任务模板（第二期）──
  // months：出现的月份；连续的月份算同一个窗口，窗口内勾一次即可；12 个月都有的算每月任务
  const SEASONAL_TASKS = {
    na: [
      { key: "na_fall_furnace",  months: [9, 10],   name: "炉子 / 锅炉采暖季前检修",         when: ["f:forced_air", "f:boiler", "f:heat_pump"], note: "顺手换滤网；有壁炉一起约烟囱清扫。" },
      { key: "na_fall_chimney",  months: [9, 10],   name: "壁炉烟囱清扫检查",               when: ["f:fireplace"] },
      { key: "na_fall_hose",     months: [10],      name: "关闭室外水龙头、排空软管",       when: ["type:sfh", "type:townhome"], note: "芝加哥一般 10 月底前完成，防止冻裂。" },
      { key: "na_fall_gutter",   months: [10, 11],  name: "清理排水槽和落水管",             when: ["type:sfh", "type:townhome"], note: "落叶落完后再清一次。" },
      { key: "na_fall_driveway", months: [9, 10],   name: "车道上冻前填缝、看要不要封层",   when: ["f:driveway"], note: "裂缝宽过 1/8 英寸就填；表面发灰、不成水珠就该封层（2–3 年一次）。", card: "driveway_asphalt" },
      { key: "na_spring_driveway", months: [4, 5],  name: "车道解冻后查裂缝、积水、错台",   when: ["f:driveway"], note: "冬天冻融后最容易出新裂缝；雨后 2 小时还积水说明基层下沉。", card: "driveway_asphalt" },
      { key: "na_fall_sump",     months: [10],      name: "测试排水泵和备用电池",           when: ["f:sump_pump"] },
      { key: "na_fall_salt",     months: [11],      name: "备好融雪盐和铲雪工具",           when: ["f:snow"] },
      { key: "na_fall_mice",     months: [9, 10],   name: "封堵外墙缝隙、布置捕鼠器",       when: ["type:sfh", "type:townhome", "f:garage"] },
      { key: "na_fall_lawn",     months: [10, 11],  name: "草坪最后一次修剪和秋季施肥",     when: ["f:lawn"] },
      { key: "na_fall_ac",       months: [10],      name: "室外空调机清理、盖罩",           when: ["f:central_ac"] },
      { key: "na_fall_humid",    months: [10],      name: "加湿器换滤芯、打开水阀",         when: ["f:humidifier"] },
      { key: "na_win_vent",      months: [12, 1, 2], name: "大雪后清理高效炉进排气口",      when: ["f:forced_air"], note: "被雪堵住会停炉甚至一氧化碳倒灌。" },
      { key: "na_win_icedam",    months: [12, 1, 2], name: "留意屋檐冰坝和屋顶积雪",        when: ["type:sfh", "type:townhome"] },
      { key: "na_win_pipes",     months: [1, 2],    name: "极寒天防冻管：水龙头滴水、打开水槽柜门", when: ["f:snow"] },
      { key: "na_win_radon",     months: [1],       name: "做一次氡气检测",                 when: ["type:sfh", "type:townhome", "f:basement"], note: "伊利诺伊州氡气偏高，冬季门窗紧闭时测最准。" },
      { key: "na_spr_sump",      months: [3, 4],    name: "雨季前测试排水泵和备用电池",     when: ["f:sump_pump"] },
      { key: "na_spr_ac",        months: [4, 5],    name: "空调 / 热泵入夏前检修、换滤网",   when: ["f:central_ac", "f:heat_pump"] },
      { key: "na_spr_roof",      months: [4],       name: "冬后检查屋顶、排水槽和外墙",     when: ["type:sfh", "type:townhome"] },
      { key: "na_spr_grade",     months: [4, 5],    name: "检查地基周边排水坡度和落水管出口", when: ["type:sfh", "type:townhome", "f:basement"], note: "水要引离地基至少 1.5 米。" },
      // ── 电力 / 水路例行检查 ──
      { key: "na_gfci",        months: [1, 4, 7, 10], name: "按一遍 GFCI / AFCI 插座和断路器的测试键", when: ["*"], note: "按 TEST 应跳、按 RESET 应复位；不跳的换掉。" },
      { key: "na_main_valve",  months: [4],       name: "转一转总水阀和各处角阀，防锁死",           when: ["*"], note: "关到底再开到底；锈死的阀门漏水时就关不上了。" },
      { key: "na_breakers",    months: [10],      name: "断路器全部拨一遍，补齐回路标签",           when: ["*"], note: "拨之前关掉电脑等设备；顺手把标签写进应急信息。" },
      { key: "na_water_pressure", months: [4],    name: "测一次水压（40–60 psi）",                 when: ["type:sfh", "type:townhome"], note: "外水龙头拧上压力表就行；高了伤水管和电器，是减压阀的事。" },
      { key: "na_batteries",   months: [11],      name: "换烟雾 / CO 报警器和漏水传感器的电池",     when: ["*"], note: "时钟回拨那周一起换，顺手按测试键。" },
      { key: "na_bath_fan",    months: [3],       name: "清洗浴室排风扇格栅和叶片",                 when: ["*"] },
      { key: "na_spr_hose",      months: [4],       name: "打开室外水龙头，检查漏水",       when: ["type:sfh", "type:townhome"] },
      { key: "na_spr_deck",      months: [5],       name: "检查木平台，需要时重新上油",     when: ["f:deck"] },
      { key: "na_sum_filter",    months: [6, 7, 8], name: "换空调 / 炉子滤网",             when: ["f:central_ac", "f:forced_air", "f:heat_pump"] },
      { key: "na_sum_dehum",     months: [6, 7, 8], name: "地下室除湿、检查墙角渗水",       when: ["f:basement"] },
      { key: "na_sum_water",     months: [6, 7, 8], name: "清除院子积水防蚊",               when: ["f:lawn", "f:deck"] },
      { key: "na_all_alarm",     months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], name: "测试烟雾和一氧化碳报警器", when: ["*"] },
      { key: "na_all_heater",    months: [5],       name: "热水器排污（放水除沉淀）",       when: ["*"] },
      { key: "na_all_dryer",     months: [3, 9],    name: "清理烘干机排气管",               when: ["type:sfh", "type:townhome", "type:condo"] },
      { key: "na_all_extinguisher", months: [1],    name: "检查灭火器压力表",               when: ["*"] },
      { key: "na_all_hottub",    months: [1, 4, 7, 10], name: "热水浴缸换水、清洗滤芯",     when: ["f:hot_tub"] },
      { key: "na_all_softener",  months: [6],       name: "软水机清洗盐箱",                 when: ["f:water_softener"] },
    ],
    cn: [
      { key: "cn_rcd",         months: [1, 4, 7, 10], name: "按一遍漏电保护器的试验按钮",            when: ["*"], note: "按下应立刻跳闸，不跳要换。" },
      { key: "cn_main_valve",  months: [4],       name: "转一转进户总阀和各处角阀，防锁死",         when: ["*"] },
      { key: "cn_batteries",   months: [11],      name: "换烟雾报警器、漏水传感器电池",             when: ["*"] },
      { key: "cn_spr_ac",        months: [4, 5],    name: "空调清洗滤网和室内机、试运行",   when: ["*"] },
      { key: "cn_spr_humid",     months: [3, 4, 5, 6], name: "回南天 / 梅雨：除湿、衣柜防霉、检查墙面渗水", when: ["f:humid_season"] },
      { key: "cn_spr_lawn",      months: [3, 4],    name: "草坪花园春季施肥、修剪",         when: ["f:lawn"] },
      { key: "cn_spr_deck",      months: [5],       name: "露台木作检查、上油",             when: ["f:deck"] },
      { key: "cn_sum_fresh",     months: [6, 7, 8], name: "新风滤网更换",                   when: ["f:fresh_air"] },
      { key: "cn_sum_mosquito",  months: [5, 6, 7, 8, 9], name: "清理阳台积水、检查纱窗",   when: ["*"] },
      { key: "cn_sum_drain",     months: [6],       name: "地漏、下水道疏通除臭",           when: ["*"] },
      { key: "cn_fall_heating",  months: [10, 11],  name: "供暖前：暖气片排气、地暖试水",   when: ["f:central_heat", "f:floor_heating"] },
      { key: "cn_fall_boiler",   months: [10],      name: "壁挂炉年检、补水",               when: ["f:wall_boiler"] },
      { key: "cn_fall_floor",    months: [10],      name: "地暖管路清洗（每 2–3 年）",      when: ["f:floor_heating"] },
      { key: "cn_fall_lawn",     months: [10],      name: "草坪花园秋季施肥、过冬准备",     when: ["f:lawn"] },
      { key: "cn_win_pipes",     months: [12, 1],   name: "寒潮：阳台水管保温，长期外出排空", when: ["f:snow"] },
      { key: "cn_win_gas",       months: [11, 12, 1, 2], name: "燃气软管、接口检查，使用时开窗", when: ["f:gas"] },
      { key: "cn_win_drain",     months: [12],      name: "年末地漏、下水道清理",           when: ["*"] },
      { key: "cn_all_purifier",  months: [1, 7],    name: "净水器换滤芯",                   when: ["f:water_purifier"] },
      { key: "cn_all_hood",      months: [3, 9],    name: "抽油烟机深度清洗",               when: ["*"] },
      { key: "cn_all_heater",    months: [5],       name: "热水器清洗除垢",                 when: ["*"] },
      { key: "cn_all_alarm",     months: [1, 4, 7, 10], name: "测试烟感和燃气报警器",       when: ["f:gas"] },
      { key: "cn_all_hottub",    months: [1, 4, 7, 10], name: "热水浴缸换水、清洗滤芯",     when: ["f:hot_tub"] },
      { key: "cn_all_softener",  months: [6],       name: "软水机清洗盐箱",                 when: ["f:water_softener"] },
    ],
  };

  function matches(cond, p) {
    if (cond === "*") return true;
    const [k, v] = cond.split(":");
    if (k === "f") return (p.features || []).includes(v);
    if (k === "ext") return (p.exterior || []).includes(v);
    if (k === "floor") return (p.flooring || []).includes(v);
    if (k === "roof") return p.roof === v;
    if (k === "type") return p.house_type === v;
    return false;
  }

  /** 根据房屋资料生成推荐耗材（已换算出每天用量），按分类排序 */
  function recommendSupplies(profile) {
    const list = SUPPLIES[profile.region] || [];
    const order = HOUSE_CATEGORIES.map((c) => c.id);
    return list.filter((s) => s.when.some((c) => matches(c, profile)))
      // 少货线必须低于初始数量，否则刚加入就会提示“少货”
      .map((s) => ({ ...s, min: Math.min(s.min || 0, Math.max(0, s.qty - 1)), avg_daily_use: s.every ? Math.round((1 / s.every) * 1000) / 1000 : null }))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  }

  // ── 业主协会 / 物业：按房型给默认值和须知（Condo、联排与独栋的差别主要在这里）──
  // on：该房型默认有 HOA / 物业；label：叫法；tips：概览“HOA / 物业”面板里的须知
  const ASSOC = {
    sfh: { label: "HOA", on: false, tips: [
      "不少郊区小区也有 HOA：管外观、围栏、房屋颜色、垃圾桶摆放；买房时核对 covenants（契约限制）。",
    ] },
    townhome: { label: "HOA", on: true, tips: [
      "先看章程（Declaration / Bylaws）：外墙、屋顶、车道、围栏谁修；月费包含什么（水、垃圾、除雪、草坪）。",
      "储备金（reserve）不够时会摊特殊评估（special assessment）；伊州买卖前要索取 22.1 披露和付清证明。",
      "外观改动（门窗颜色、露台、卫星天线）通常要先提交审批。",
    ] },
    condo: { label: "HOA", on: true, tips: [
      "月费通常含水、垃圾、公共区域保险（master policy）；户内和个人财产要自己买 HO-6 保险。",
      "特殊评估（special assessment）：储备金不够大修（屋顶、电梯、外墙、停车场）时按份额摊，可分期；伊州买卖要 22.1 披露。",
      "常见规则：宠物（数量、体重）、出租限制（rental cap、最短租期）、装修审批与施工时段、停车位、安静时段、搬家预约与押金。",
      "每年看一次：预算、储备金研究（reserve study）、董事会会议记录、诉讼和保险续保情况。",
      "墙内管线、窗户、阳台的责任划分各楼不同，以章程为准。",
    ] },
    rental: { label: "物业 / 房东", on: false, tips: [
      "大楼规则（宠物、安静时段、搬家预约、包裹）和房东、物业的联系方式记在这里。",
    ] },
    cn_highrise: { label: "物业", on: true, tips: [
      "物业费按建筑面积、按季或按年预收；公共维修基金（大修基金）动用要业主表决。",
      "业委会 / 业主大会负责物业选聘、公共收益（广告、停车位）和维修基金使用。",
      "常见规则：装修押金与施工时段、垃圾分类、电动车充电、停车位管理、高空抛物。",
    ] },
    cn_walkup: { label: "物业 / 社区", on: false, tips: [
      "老小区可能没有专业物业；屋面漏水、管道老化常需和邻居、社区、街道协调，旧改政策留意。",
    ] },
    cn_townhouse: { label: "物业", on: true, tips: [
      "外立面、小区道路、绿化归物业；露台、花园、围栏改动通常要报备。",
      "物业费按面积；别墅区物业费标准和服务内容在物业服务合同里。",
    ] },
    cn_villa: { label: "物业", on: true, tips: [
      "小区道路、公共绿化、安保归物业；自家院内自己负责。",
    ] },
  };
  const DUES_PERIODS = { monthly: "每月", quarterly: "每季", yearly: "每年" };

  const forRegion = (list, region) => list.filter((x) => x.region === "both" || x.region === region);
  const typeOf = (region, id) => (HOUSE_TYPES[region] || []).find((t) => t.id === id);
  const assocOf = (houseType) => ASSOC[houseType] || { label: "HOA / 物业", on: false, tips: [] };
  const assetType = (id) => ASSET_TYPES.find((t) => t.id === id) || null;

  /** 根据房屋资料推荐设备档案：寿命按屋面材料覆盖，默认负责方取自房型的责任归属表 */
  function recommendAssets(profile) {
    const ht = typeOf(profile.region, profile.house_type);
    return forRegion(ASSET_TYPES, profile.region)
      .filter((t) => t.when.some((c) => matches(c, profile)))
      .map((t) => ({
        ...t,
        life: t.lifeByRoof && profile.roof && t.lifeByRoof[profile.roof] != null ? t.lifeByRoof[profile.roof] : t.life,
        owner: t.system && ht?.owners?.[t.system] ? ht.owners[t.system] : "self",
      }));
  }

  /** 该家庭适用的季节任务（按地区和设施过滤） */
  function seasonalTasksFor(profile) {
    if (!profile) return [];
    return (SEASONAL_TASKS[profile.region] || []).filter((t) => t.when.some((c) => matches(c, profile)));
  }

  window.HOUSE = { REGIONS, FEATURES, MATERIALS, OWNERS, SYSTEMS, HOUSE_TYPES, SUPPLIES, ASSET_SUPPLIES, HOUSE_CATEGORIES, recommendSupplies, forRegion, typeOf,
    ASSET_TYPES, ASSET_KINDS, MAINT_KINDS, SEASONAL_TASKS, assetType, recommendAssets, seasonalTasksFor, ASSOC, DUES_PERIODS, assocOf };
})();
