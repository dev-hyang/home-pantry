/* 车辆：动力类型、保养模板（按月 / 按里程）、牌照与保险提醒
 * 车是挂在家庭上的一种设备（assets.kind = vehicle，property_id 为空）；设计：docs/design-vehicles.md */
(() => {
  // 动力类型 = 设备类型 id，决定保养模板
  const POWERTRAINS = {
    vehicle_gas:    { name: "油车",   en: "Gas",     icon: "🚗", ice: true,  ev: false },
    vehicle_hybrid: { name: "混动",   en: "Hybrid",  icon: "🚙", ice: true,  ev: false },
    vehicle_phev:   { name: "插混",   en: "Plug-in hybrid", icon: "🔌", ice: true, ev: true },
    vehicle_ev:     { name: "纯电",   en: "EV",      icon: "⚡", ice: false, ev: true },
  };

  // 保养项：months 按月、miles 按里程，两者取先到的；for: ice 只有内燃机的车、ev 带高压电池的车、all 全部
  const SERVICE_ITEMS = [
    { key: "oil",        name: "机油机滤",         months: 6,  miles: 7500,   for: "ice", note: "全合成可到 10,000 英里；短途多、极冷极热按 5,000。" },
    { key: "tires",      name: "轮胎轮换",         months: 6,  miles: 6000,   for: "all", note: "电车车重、扭矩大，更要按时换位；顺便看胎纹（4/32 英寸该换）和胎压。" },
    { key: "cabin",      name: "空调 / 车内滤芯",   months: 12, miles: 15000,  for: "all", note: "自己换最简单，副驾手套箱后面。" },
    { key: "air_filter", name: "发动机空滤",       months: 24, miles: 30000,  for: "ice" },
    { key: "wipers",     name: "雨刮片",           months: 12, miles: null,   for: "all", note: "入冬前换，玻璃水换防冻型。" },
    { key: "brake_fluid", name: "刹车油",          months: 36, miles: null,   for: "all", note: "电车刹车片耐用，但刹车油照样吸水，2–3 年一换。" },
    { key: "coolant",    name: "冷却液",           months: 60, miles: 60000,  for: "all", note: "电车为电池 / 电机冷却液，按手册。" },
    { key: "battery12v", name: "12V 小电瓶",        months: 48, miles: null,   for: "all", note: "电车最常见的趴窝原因就是 12V 电瓶，3–4 年主动换。" },
    { key: "spark",      name: "火花塞",           months: null, miles: 100000, for: "ice" },
    { key: "trans",      name: "变速箱油",         months: null, miles: 60000, for: "ice", note: "厂家说“终身免维护”的也建议 60k–100k 换。" },
    { key: "alignment",  name: "四轮定位",         months: 24, miles: 24000,  for: "all", note: "跑偏、轮胎偏磨、撞过坑就做。" },
    { key: "soh",        name: "电池健康度记录",   months: 12, miles: null,   for: "ev",  note: "记一次满电续航或 SoH%，年年比较；高压电池保修通常 8 年 / 10 万英里。" },
    { key: "charger",    name: "充电设备检查",     months: 12, miles: null,   for: "ev",  note: "看家用充电桩线缆、插头有没有发热变色、松动。" },
    { key: "recall",     name: "召回查询",         months: 12, miles: null,   for: "all", note: "NHTSA 网站按 VIN 查，召回维修免费。" },
    { key: "inspection", name: "整车检查",         months: 12, miles: 12000,  for: "all", note: "刹车片厚度、悬挂、灯光、底盘漏油 / 漏液。" },
    { key: "other",      name: "其他",             months: null, miles: null, for: "all" },
  ];
  const itemsFor = (type) => {
    const pt = POWERTRAINS[type]; if (!pt) return SERVICE_ITEMS;
    return SERVICE_ITEMS.filter((s) => s.for === "all" || (s.for === "ice" && pt.ice) || (s.for === "ev" && pt.ev));
  };
  const serviceItem = (key) => SERVICE_ITEMS.find((s) => s.key === key) || null;

  // 伊州 / 芝加哥默认：牌照年贴每年；排放检测车龄 4 年以上每两年，纯电免
  const REGION_NOTES = {
    na: ["牌照年贴每年续（伊州在线续费，到期月底前）。", "排放检测：伊州车龄 4 年以上每两年一次，纯电免；逾期不能续牌照。", "住 Chicago 市内另有 city sticker，可在账单里建提醒。"],
    cn: ["年检：6 年内免检（每两年网上申领标志），6–10 年每两年上线检测，10 年以上每年。", "交强险 + 商业险一年一续；车船税随交强险缴。"],
  };

  window.VEHICLES = { POWERTRAINS, SERVICE_ITEMS, itemsFor, serviceItem, REGION_NOTES };
  // 车辆维修保养的花费记到 purchases 时用的分类；统计里单独一组
  window.VEHICLE_CAT = { id: "vehicle_maint", name: "车辆维修保养", icon: "🚗", color: "#4a6fa5" };
  window.VEHICLE_GROUP = { id: "vehicle", name: "车辆", icon: "🚗", color: "#4a6fa5" };
})();
