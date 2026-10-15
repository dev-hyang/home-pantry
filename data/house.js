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
    { id: "car",            name: "有汽车",              region: "both" },
    { id: "lawn",           name: "草坪 / 花园",         region: "both" },
    { id: "deck",           name: "木平台 / 露台",       region: "both" },
    { id: "fireplace",      name: "壁炉",                region: "na" },
    { id: "hot_tub",        name: "热水浴缸",            region: "both" },
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
        features: ["forced_air", "central_ac", "humidifier", "gas", "basement", "sump_pump", "garage", "lawn", "snow"],
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

  const forRegion = (list, region) => list.filter((x) => x.region === "both" || x.region === region);
  const typeOf = (region, id) => (HOUSE_TYPES[region] || []).find((t) => t.id === id);

  window.HOUSE = { REGIONS, FEATURES, MATERIALS, OWNERS, SYSTEMS, HOUSE_TYPES, SUPPLIES, HOUSE_CATEGORIES, recommendSupplies, forRegion, typeOf };
})();
