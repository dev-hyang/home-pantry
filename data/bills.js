/* 账单与缴费 · 静态数据（B1）
 * - 分类：图标、名称、是否“必要支出”
 * - 频率 / 缴费渠道 / 账单渠道 / 房产类型与角色的文案
 * - 模板：按地区（北美 / 中国）一次建好常见账单；金额留空由用户填
 * 文案是简体，界面显示时经 t() 翻译。 */
(() => {
  "use strict";

  const CATEGORIES = [
    { id: "electric",       name: "电费",            icon: "⚡", essential: true },
    { id: "gas",            name: "燃气费",          icon: "🔥", essential: true },
    { id: "water",          name: "水费 / 排污 / 垃圾", icon: "💧", essential: true },
    { id: "internet",       name: "网络",            icon: "📶", essential: true },
    { id: "mobile",         name: "手机",            icon: "📱", essential: true },
    { id: "hoa",            name: "HOA / 物业费",    icon: "🏘️", essential: true },
    { id: "property_tax",   name: "房产税",          icon: "🏛️", essential: true },
    { id: "mortgage",       name: "房贷",            icon: "🏦", essential: true },
    { id: "rent",           name: "房租",            icon: "🔑", essential: true },
    { id: "insurance_home", name: "房屋保险",        icon: "🛡️", essential: true },
    { id: "insurance_auto", name: "车险",            icon: "🚗", essential: true },
    { id: "car_loan",       name: "车贷",            icon: "🚙", essential: true },
    { id: "credit_card",    name: "信用卡",          icon: "💳", essential: true },
    { id: "subscription",   name: "订阅",            icon: "📺", essential: false },
    { id: "membership",     name: "会员",            icon: "🎫", essential: false },
    { id: "tuition",        name: "学费 / 托儿",     icon: "🎒", essential: true },
    { id: "parking",        name: "停车费",          icon: "🅿️", essential: true },
    { id: "other",          name: "其他账单",        icon: "🧾", essential: false },
  ];
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  const FREQUENCIES = { weekly: "每周", biweekly: "每两周", monthly: "每月", quarterly: "每季度", semiannual: "每半年", annual: "每年", custom: "每 N 个月", one_time: "一次性" };
  const CHANNELS = { online: "网上缴费", autopay: "自动扣款", mail: "邮寄支票", phone: "电话缴费", in_person: "现场缴费" };
  const STATEMENTS = { email: "电子账单", mail: "纸质账单", app: "App 账单", none: "没有账单" };
  const PAYMENT_STATUS = { paid: "已缴费", verified: "已核对", skipped: "跳过" };
  const PROPERTY_KINDS = { sfh: "独栋", townhome: "联排", condo: "公寓", apartment: "租住公寓", other: "其他" };
  const PROPERTY_ROLES = { owner_occupied: "自住", landlord: "出租", tenant: "租住" };

  // 模板：property = false 表示与房产无关（手机、车险等）；optional = true 默认不勾选；
  // due_day 月度到期日；due_dates 固定日期（半年 / 年度）；没有的由用户建后填下次到期日
  const TEMPLATES = {
    na: [
      { category: "electric", name: "电费", payee: "ComEd", frequency: "monthly", due_day: 20, amount_type: "variable", statement: "email",
        note: "账单金额随季节变化，设了自动扣款也看一眼夏冬的峰值。" },
      { category: "gas", name: "燃气费", payee: "Peoples Gas / Nicor", frequency: "monthly", due_day: 20, amount_type: "variable", statement: "email" },
      { category: "water", name: "水费 / 排污 / 垃圾", payee: "City Utility", frequency: "custom", interval_months: 2, due_day: 15, amount_type: "variable", statement: "mail",
        note: "芝加哥市区水费一般两个月一张账单；郊区各镇不同。" },
      { category: "internet", name: "网络", payee: "Xfinity / AT&T", frequency: "monthly", due_day: 10, amount_type: "fixed", autopay: true,
        note: "促销价通常 12 个月后上涨，记录里会标“涨价了”。" },
      { category: "mobile", name: "手机", payee: "", frequency: "monthly", due_day: 5, amount_type: "fixed", autopay: true, property: false },
      { category: "hoa", name: "HOA 月费", payee: "HOA", frequency: "monthly", due_day: 1, amount_type: "fixed", statement: "mail", optional: true,
        note: "独栋多数没有 HOA；联排、公寓按章程，有的是季付。特别评估另建一条一次性账单。" },
      { category: "property_tax", name: "房产税（第一期）", payee: "Cook County Treasurer", frequency: "annual", due_dates: ["03-01"], amount_type: "variable", statement: "mail", channel: "online", reminder_days: [30, 7, 1],
        note: "Cook County 第一期约 3 月 1 日，金额为上年的 55%。在 escrow 里由贷款行代缴的，记成“已核对”即可。" },
      { category: "property_tax", name: "房产税（第二期）", payee: "Cook County Treasurer", frequency: "annual", due_dates: ["08-01"], amount_type: "variable", statement: "mail", channel: "online", reminder_days: [30, 7, 1],
        note: "第二期日期每年公布，常在 8 月初到年底之间；收到账单后把到期日改准。" },
      { category: "mortgage", name: "房贷", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", autopay: true, grace_days: 15,
        note: "多数贷款 15 天宽限期；escrow 变化时月供会调整，核对一下。" },
      { category: "rent", name: "房租", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", optional: true },
      { category: "insurance_home", name: "房屋保险", payee: "", frequency: "annual", amount_type: "fixed", statement: "mail", reminder_days: [30, 7],
        note: "续保通知一般提前 30–45 天；在 escrow 里的记成核对。到期日建后补填。" },
      { category: "insurance_auto", name: "车险", payee: "", frequency: "semiannual", amount_type: "fixed", autopay: true, property: false, reminder_days: [30, 7],
        note: "半年一续，续保前比价。到期日建后补填。" },
      { category: "car_loan", name: "车贷", payee: "", frequency: "monthly", due_day: 15, amount_type: "fixed", autopay: true, property: false, optional: true },
      { category: "credit_card", name: "信用卡", payee: "", frequency: "monthly", due_day: 25, amount_type: "variable", autopay: true, property: false,
        note: "设了全额自动还款也要核对账单有没有陌生消费；到期日 = 账单日 + 21–25 天。" },
      { category: "subscription", name: "流媒体订阅", payee: "Netflix / Spotify", frequency: "monthly", due_day: 1, amount_type: "fixed", autopay: true, property: false, essential: false, optional: true },
      { category: "membership", name: "Costco 会员", payee: "Costco", frequency: "annual", amount_type: "fixed", property: false, essential: false, optional: true },
      { category: "tuition", name: "托儿 / 学费", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", property: false, optional: true },
    ],
    cn: [
      { category: "electric", name: "电费", payee: "国家电网", frequency: "monthly", due_day: 25, amount_type: "variable", statement: "app", note: "预付费电表的记成“充值”，按余额提醒。" },
      { category: "gas", name: "燃气费", payee: "燃气公司", frequency: "monthly", due_day: 25, amount_type: "variable", statement: "app" },
      { category: "water", name: "水费", payee: "自来水公司", frequency: "monthly", due_day: 25, amount_type: "variable", statement: "app" },
      { category: "internet", name: "宽带", payee: "", frequency: "annual", amount_type: "fixed", note: "多数按年包，续费前比价。到期日建后补填。" },
      { category: "mobile", name: "手机话费", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", autopay: true, property: false },
      { category: "hoa", name: "物业费", payee: "物业", frequency: "quarterly", due_day: 1, amount_type: "fixed", statement: "app", note: "有的小区按年或半年预收，按实际改频率。" },
      { category: "mortgage", name: "房贷", payee: "", frequency: "monthly", due_day: 20, amount_type: "fixed", autopay: true, note: "提前一天把钱转到扣款卡。" },
      { category: "rent", name: "房租", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", optional: true },
      { category: "insurance_auto", name: "车险", payee: "", frequency: "annual", amount_type: "fixed", property: false, reminder_days: [30, 7], note: "交强险 + 商业险一年一续。到期日建后补填。" },
      { category: "credit_card", name: "信用卡", payee: "", frequency: "monthly", due_day: 10, amount_type: "variable", autopay: true, property: false, note: "设了自动还款也核对账单。" },
      { category: "parking", name: "停车费", payee: "物业", frequency: "monthly", due_day: 1, amount_type: "fixed", optional: true },
      { category: "subscription", name: "视频会员", payee: "", frequency: "annual", amount_type: "fixed", autopay: true, property: false, essential: false, optional: true, note: "自动续费常比首年贵，到期前决定要不要续。" },
      { category: "tuition", name: "托育 / 学费", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", property: false, optional: true },
    ],
  };

  window.BILLS = { CATEGORIES, catOf, FREQUENCIES, CHANNELS, STATEMENTS, PAYMENT_STATUS, PROPERTY_KINDS, PROPERTY_ROLES, TEMPLATES };
  // 统计图里账单合并为一组
  window.BILLS_GROUP = { id: "bills", name: "账单", icon: "🧾", color: "#2f5d8a" };
})();
