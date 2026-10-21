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
    { id: "vehicle_reg",    name: "车辆牌照 / 车贴",  icon: "🪪", essential: true },   // 州牌照年贴、village / city sticker、年检、车船税
    { id: "credit_card",    name: "信用卡",          icon: "💳", essential: true },
    { id: "subscription",   name: "订阅",            icon: "📺", essential: false },
    { id: "membership",     name: "会员",            icon: "🎫", essential: false },
    { id: "tuition",        name: "学费 / 托儿",     icon: "🎒", essential: true },
    { id: "parking",        name: "停车费",          icon: "🅿️", essential: true },
    // 以下是后加的：保险与贷款、家庭服务、孩子活动、出行、奉献、税、宠物（模板默认都不勾，按需添加）
    { id: "insurance_health", name: "健康险保费",     icon: "🩺", essential: true },
    { id: "insurance_life",   name: "人寿 / 重疾 / 伤残险", icon: "🛟", essential: true },
    { id: "insurance_other",  name: "伞险 / 租户险 / 其他保险", icon: "☂️", essential: true },
    { id: "student_loan",   name: "学生贷款",        icon: "🎓", essential: true },
    { id: "personal_loan",  name: "个人贷款 / 分期", icon: "🏧", essential: true },
    { id: "cable_tv",       name: "有线 / 卫星电视",  icon: "📡", essential: false },
    { id: "lawn",           name: "草坪 / 除雪 / 园艺", icon: "🌿", essential: false },
    { id: "cleaning",       name: "保洁 / 家政",     icon: "🧹", essential: false },
    { id: "pest",           name: "除虫 / 灭鼠",     icon: "🐜", essential: false },
    { id: "security",       name: "安防 / 监控",     icon: "🚨", essential: false },
    { id: "activities",     name: "课外班 / 夏令营 / 兴趣班", icon: "🎨", essential: false },
    { id: "toll",           name: "通行费（E-ZPass）", icon: "🛣️", essential: false },
    { id: "donation",       name: "奉献 / 捐款",     icon: "🙏", essential: false },
    { id: "income_tax",     name: "所得税 / 预缴税",  icon: "🧮", essential: true },
    { id: "pet",            name: "宠物（保险 / 寄养 / 美容）", icon: "🐾", essential: false },
    { id: "other",          name: "其他账单",        icon: "🧾", essential: false },
  ];
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  const FREQUENCIES = { weekly: "每周", biweekly: "每两周", monthly: "每月", quarterly: "每季度", semiannual: "每半年", annual: "每年", custom: "每 N 个月", one_time: "一次性" };
  const CHANNELS = { online: "网上缴费", autopay: "自动扣款", mail: "邮寄支票", phone: "电话缴费", in_person: "现场缴费", escrow: "Escrow 代缴（含在房贷月供里）" };
  const STATEMENTS = { email: "电子账单", mail: "纸质账单", app: "App 账单", none: "没有账单" };
  const PAYMENT_STATUS = { paid: "已缴费", verified: "已核对", skipped: "跳过" };
  const PROPERTY_KINDS = { sfh: "独栋", townhome: "联排", condo: "公寓", apartment: "租住公寓", other: "其他" };
  const PROPERTY_ROLES = { owner_occupied: "自住", landlord: "出租", tenant: "租住" };

  // 订阅 / 会员的种类标签：只用于清单分组和概览汇总，统计里仍合并为“订阅”一组
  const SUB_KINDS = { streaming: "流媒体", cloud: "云存储", ai: "AI 工具", software: "软件 / App", games: "游戏", news: "新闻 / 阅读", fitness: "健身", membership: "会员", other: "其他" };
  // 订阅模板的简写：与房产无关、非必要、默认不勾、自动续费
  const SUB = (kind, name, payee, frequency, note) => [{ category: "subscription", sub_kind: kind, group: "订阅与会员", name, payee, frequency, due_day: frequency === "monthly" ? 1 : null,
    amount_type: "fixed", autopay: true, property: false, essential: false, optional: true, reminder_days: frequency === "annual" ? [30, 7] : [7, 1], ...(note ? { note } : {}) }];

  // 模板的简写：默认不勾（optional），按分组显示；property = false 表示与房产无关
  const OPT = (group, category, name, payee, frequency, extra = {}) => [{ category, group, name, payee, frequency, due_day: frequency === "monthly" ? 1 : null, amount_type: "fixed", optional: true, property: false, ...extra }];
  // 模板：property = false 表示与房产无关（手机、车险等）；optional = true 默认不勾选；group 把模板分组显示（默认“常用账单”）
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
        note: "Cook County 第一期约 3 月 1 日，金额为上年的 55%。房产税走 escrow（由贷款行代缴）的，不要勾这两条，勾下面的“房产税（Escrow 代缴）”。" },
      { category: "property_tax", name: "房产税（第二期）", payee: "Cook County Treasurer", frequency: "annual", due_dates: ["08-01"], amount_type: "variable", statement: "mail", channel: "online", reminder_days: [30, 7, 1],
        note: "第二期日期每年公布，常在 8 月初到年底之间；收到账单后把到期日改准。" },
      { category: "property_tax", name: "房产税（Escrow 代缴）", payee: "", frequency: "annual", amount_type: "variable", channel: "escrow", optional: true,
        note: "房产税由贷款行从房贷月供里代缴时选这条，代替上面的第一期 / 第二期；金额填税单上的年额。不提醒到期，也不重复计入每月预算。" },
      { category: "mortgage", name: "房贷", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", autopay: true, grace_days: 15,
        note: "多数贷款 15 天宽限期；金额填含 Escrow 的总月供。escrow 每年分析后月供会调整，账单概览里可设年度提醒。" },
      { category: "rent", name: "房租", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", optional: true },
      { category: "insurance_home", name: "房屋保险", payee: "", frequency: "annual", amount_type: "fixed", statement: "mail", reminder_days: [30, 7],
        note: "续保通知一般提前 30–45 天；保费在 escrow 里由贷款行代缴的，勾下面的“房屋保险（Escrow 代缴）”。到期日建后补填。" },
      { category: "insurance_home", name: "房屋保险（Escrow 代缴）", payee: "", frequency: "annual", amount_type: "fixed", channel: "escrow", optional: true,
        note: "房屋保险由贷款行从房贷月供里代缴时选这条，代替上面的“房屋保险”；金额填保单上的年保费。" },
      { category: "insurance_auto", name: "车险", payee: "", frequency: "semiannual", amount_type: "fixed", autopay: true, property: false, reminder_days: [30, 7],
        note: "半年一续，续保前比价。到期日建后补填。" },
      { category: "car_loan", name: "车贷", payee: "", frequency: "monthly", due_day: 15, amount_type: "fixed", autopay: true, property: false, optional: true },
      { category: "vehicle_reg", name: "车辆牌照年贴（州）", payee: "Illinois Secretary of State", frequency: "annual", amount_type: "fixed", property: false, channel: "online", reminder_days: [30, 7],
        note: "伊州普通车约 $151 / 年（纯电 $251），到期月底前在线续，逾期罚款且排放没过不能续。到期月份在牌照贴纸上，建后补填；几辆车各建一条。" },
      { category: "vehicle_reg", name: "Village / City 车贴（sticker）", payee: "", frequency: "annual", amount_type: "fixed", property: false, optional: true, reminder_days: [30, 7],
        note: "很多 village 和 Chicago 市要求另买本镇车贴，一年一次，$30–$100 不等，有的按住址寄通知、有的要自己上网买；不收的镇不用建。" },
      { category: "credit_card", name: "信用卡", payee: "", frequency: "monthly", due_day: 25, amount_type: "variable", autopay: true, property: false,
        note: "设了全额自动还款也要核对账单有没有陌生消费；到期日 = 账单日 + 21–25 天。" },
      { category: "tuition", name: "托儿 / 学费", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", property: false, optional: true },
      // ── 订阅与会员：一个分类 + 种类标签；默认都不勾，勾了再补金额和到期日 ──
      ...SUB("streaming", "视频流媒体", "Netflix / Disney+ / YouTube Premium", "monthly", "年付常便宜 15–20%，但记得年付到期前决定续不续。"),
      ...SUB("streaming", "音乐", "Spotify / Apple Music", "monthly"),
      ...SUB("cloud", "Google One", "Google", "annual", "相册、Drive、Gmail 共用空间；满了先清理再升级。"),
      ...SUB("cloud", "iCloud+", "Apple", "monthly", "家庭共享一份 200GB / 2TB 比各买各的省。"),
      ...SUB("cloud", "Dropbox / OneDrive", "", "annual"),
      ...SUB("ai", "ChatGPT Plus", "OpenAI", "monthly", "按月付，不用的月份可以停。"),
      ...SUB("ai", "Claude Pro", "Anthropic", "monthly"),
      ...SUB("ai", "Copilot / Gemini", "", "monthly"),
      ...SUB("software", "Microsoft 365", "Microsoft", "annual", "家庭版可 6 人共享。"),
      ...SUB("software", "Adobe", "Adobe", "annual", "年约按月付的中途取消有违约金，到期前一个月决定。"),
      ...SUB("software", "密码管理器", "1Password / Bitwarden", "annual"),
      ...SUB("software", "杀毒 / VPN", "", "annual", "首年优惠价，第二年自动按原价续，最常被忽略的一项。"),
      ...SUB("software", "App 年费", "App Store / Google Play", "annual", "手机“订阅”页里把不用的取消。"),
      ...SUB("games", "游戏会员", "Xbox / PlayStation / Nintendo", "annual"),
      ...SUB("news", "新闻 / 阅读", "NYT / Kindle Unlimited", "monthly"),
      ...SUB("fitness", "健身房 / 健身 App", "", "monthly", "健身房年约注意取消条款。"),
      { category: "membership", sub_kind: "membership", group: "订阅与会员", name: "Costco / Sam's 会员", payee: "Costco", frequency: "annual", amount_type: "fixed", property: false, essential: false, optional: true },
      { category: "membership", sub_kind: "membership", group: "订阅与会员", name: "Amazon Prime", payee: "Amazon", frequency: "annual", amount_type: "fixed", autopay: true, property: false, essential: false, optional: true },
      // ── 后加的分类：默认都不勾，勾了再补金额和到期日 ──
      ...OPT("保险与贷款", "insurance_health", "健康险保费", "", "monthly", { note: "雇主扣的不用建；自己交的（市场险、COBRA、家人加保）每月一条。" }),
      ...OPT("保险与贷款", "insurance_life", "人寿 / 重疾 / 伤残险", "", "annual", { reminder_days: [30, 7] }),
      ...OPT("保险与贷款", "insurance_other", "伞险（Umbrella）", "", "annual", { reminder_days: [30, 7], note: "房险、车险的责任险不够时的补充，通常一年一续。" }),
      ...OPT("保险与贷款", "insurance_other", "租户险（Renters）", "", "annual", { reminder_days: [30, 7], note: "租房住才需要；自有住房用上面的“房屋保险”。", property: true }),
      ...OPT("保险与贷款", "student_loan", "学生贷款", "", "monthly", { autopay: true, note: "联邦贷款还款计划每年要重新认证收入，记得在备注里写认证月份。" }),
      ...OPT("保险与贷款", "personal_loan", "个人贷款 / 分期", "", "monthly", { autopay: true }),
      ...OPT("家庭服务", "cable_tv", "有线 / 卫星电视", "", "monthly", { property: true }),
      ...OPT("家庭服务", "lawn", "草坪 / 园艺", "", "monthly", { property: true, note: "季节性服务按实际月份调整，不做的月份可以停用。" }),
      ...OPT("家庭服务", "lawn", "除雪", "", "annual", { property: true, note: "按季合同或按次付费都可以；按次的记成每次一笔缴费。" }),
      ...OPT("家庭服务", "cleaning", "保洁 / 家政", "", "monthly", { property: true }),
      ...OPT("家庭服务", "pest", "除虫 / 灭鼠", "", "quarterly", { property: true }),
      ...OPT("家庭服务", "security", "安防 / 监控", "", "monthly", { property: true, autopay: true }),
      ...OPT("孩子与活动", "activities", "课外班 / 兴趣班", "", "monthly", { note: "按学期收费的改成“每 N 个月”。" }),
      ...OPT("孩子与活动", "activities", "夏令营", "", "annual", { reminder_days: [30, 7], note: "热门营报名早、定金不退，到期日填报名截止日。" }),
      ...OPT("出行与其他", "toll", "通行费（E-ZPass）", "Illinois Tollway", "monthly", { autopay: true, amount_type: "variable", note: "自动充值的卡过期会停用，设了“扣款卡过期”提醒。" }),
      ...OPT("出行与其他", "donation", "奉献 / 捐款", "", "monthly", { autopay: true, note: "固定的月捐、什一奉献；年终报税需要的收据在备注里记一下。" }),
      ...OPT("出行与其他", "income_tax", "预缴税（Estimated tax）", "IRS / State", "quarterly", { amount_type: "variable", reminder_days: [30, 7], note: "自雇或有额外收入才需要；联邦通常 4/15、6/15、9/15、1/15，到期日建后补填。" }),
      ...OPT("出行与其他", "pet", "宠物保险", "", "monthly", { autopay: true }),
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
      { category: "vehicle_reg", name: "年检 / 车船税", payee: "", frequency: "annual", amount_type: "fixed", property: false, optional: true, reminder_days: [30, 7], note: "车船税多随交强险一起交；年检按车龄 6 年内免检、之后每年或每两年一次，到期月份看行驶证。" },
      { category: "credit_card", name: "信用卡", payee: "", frequency: "monthly", due_day: 10, amount_type: "variable", autopay: true, property: false, note: "设了自动还款也核对账单。" },
      { category: "parking", name: "停车费", payee: "物业", frequency: "monthly", due_day: 1, amount_type: "fixed", optional: true },
      { category: "tuition", name: "托育 / 学费", payee: "", frequency: "monthly", due_day: 1, amount_type: "fixed", property: false, optional: true },
      ...SUB("streaming", "视频会员", "爱奇艺 / 腾讯视频 / B 站", "annual", "自动续费常比首年贵，到期前决定要不要续。"),
      ...SUB("streaming", "音乐会员", "网易云 / QQ 音乐", "annual"),
      ...SUB("cloud", "网盘", "百度网盘 / iCloud", "annual"),
      ...SUB("ai", "AI 助手", "豆包 / Kimi / ChatGPT", "monthly"),
      ...SUB("software", "软件 / App 年费", "", "annual", "手机“自动续费”页里把不用的关掉。"),
      ...SUB("fitness", "健身房 / 健身 App", "", "annual", "年卡注意退卡条款。"),
      { category: "membership", sub_kind: "membership", group: "订阅与会员", name: "电商会员", payee: "京东 PLUS / 88VIP", frequency: "annual", amount_type: "fixed", autopay: true, property: false, essential: false, optional: true },
      // ── 后加的分类：默认都不勾 ──
      ...OPT("保险与贷款", "insurance_health", "医疗险 / 重疾险", "", "annual", { reminder_days: [30, 7] }),
      ...OPT("保险与贷款", "insurance_life", "寿险 / 意外险", "", "annual", { reminder_days: [30, 7] }),
      ...OPT("保险与贷款", "personal_loan", "消费贷 / 分期", "", "monthly", { autopay: true }),
      ...OPT("家庭服务", "cleaning", "保洁 / 家政", "", "monthly", { property: true }),
      ...OPT("孩子与活动", "activities", "兴趣班 / 补习班", "", "monthly", { note: "按学期或按期收费的改成“每 N 个月”。" }),
      ...OPT("出行与其他", "donation", "奉献 / 捐款", "", "monthly", { autopay: true }),
      ...OPT("出行与其他", "pet", "宠物医疗 / 寄养", "", "annual"),
    ],
  };

  const isSubCat = (id) => id === "subscription" || id === "membership";
  window.BILLS = { CATEGORIES, catOf, FREQUENCIES, CHANNELS, STATEMENTS, PAYMENT_STATUS, PROPERTY_KINDS, PROPERTY_ROLES, TEMPLATES, SUB_KINDS, isSubCat };
  // 统计图里账单合并为一组
  window.BILLS_GROUP = { id: "bills", name: "账单", icon: "🧾", color: "#2f5d8a" };
})();
