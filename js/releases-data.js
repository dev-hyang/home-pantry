/* 发布日志的数据（我的 → 发布日志；今日页顶上的「新版本」提示也读这里）。
 * 每次推送：升 js/core/version.js 的 APP_VERSION，同时在最上面加一条同版本号的记录（没有这一条就不出提示）。
 * 写给家里人看：一句话标题 + 1–4 条短要点，k = new 新功能 / better 改进 / fix 修复，不写技术词。 */
export const RELEASES = [
  { v: "2026-11-08.1", title: { zh: "新增「发布日志」：看看每次更新了什么", en: "New: release notes for every update" }, items: [
    { k: "new", zh: "我的 → 发布日志：按类型、时间筛选，列表或时间线查看", en: "Me → Release notes: filter by type or time, as a list or timeline" },
    { k: "new", zh: "有新版本时，今日页顶上会出现一条提示，点开就能看", en: "After an update, Today shows a short note at the top; tap it to see what changed" },
    { k: "better", zh: "顶栏的版本号点一下就到发布日志", en: "Tap the version number in the header to open the release notes" },
  ] },
  { v: "2026-11-07.10", title: { zh: "财务表格和图表里的金额也能遮住", en: "Amounts in finance tables and charts can be hidden too" }, items: [
    { k: "better", zh: "财务页表格、图表里的金额也会遮住，点一下看 10 秒", en: "Amounts in finance tables and charts are hidden too; tap to see them for 10 seconds" },
    { k: "better", zh: "今日「钱」卡第一行加上上月和涨跌", en: "Today's money card shows last month and the change on its first line" },
  ] },
  { v: "2026-11-07.9", title: { zh: "今日卡片自动切换更稳", en: "Today's cards advance more reliably" }, items: [
    { k: "fix", zh: "点过卡片后，进度条不会再停住不动", en: "The progress bar no longer stays paused after you tap a card" },
  ] },
  { v: "2026-11-07.8", title: { zh: "今日卡片切换快慢可以自己选", en: "Choose how fast Today's cards change" }, items: [
    { k: "new", zh: "点 ⚙ 选 5、10、15、30 秒或关闭，默认 10 秒", en: "Tap ⚙ to pick 5, 10, 15 or 30 seconds, or turn it off (default 10)" },
    { k: "fix", zh: "手机上自动切换偶尔卡住的问题", en: "Auto-advance sometimes got stuck on phones" },
  ] },
  { v: "2026-11-07.7", title: { zh: "金额遮挡分「外出」和「在家」两种", en: "Hide amounts: away and home modes" }, items: [
    { k: "new", zh: "外出：大数字模糊，点一个看 10 秒", en: "Away: big numbers are blurred; tap one to see it for 10 seconds" },
    { k: "new", zh: "在家：一直显示；离开 30 分钟后自动遮回去", en: "Home: always shown; hidden again after 30 minutes away" },
    { k: "better", zh: "眼睛按钮：单击看全部，双击或长按切换模式", en: "Eye button: tap to show all, double-tap or long-press to switch modes" },
  ] },
  { v: "2026-11-07.6", title: { zh: "今日卡片内容更丰富", en: "Today's cards show more" }, items: [
    { k: "better", zh: "卡片下面有进度条，到时间自动换下一张", en: "A progress bar under the cards moves on to the next one" },
    { k: "better", zh: "待办卡显示更多事项，钱卡一行看完主要数字", en: "The to-do card shows more items; the money card fits the key numbers on one line" },
    { k: "new", zh: "金额默认遮住，点一下看 10 秒", en: "Amounts are hidden by default; tap to see them for 10 seconds" },
  ] },
  { v: "2026-11-07.5", title: { zh: "今日卡片可以左右滑动", en: "Swipe through Today's cards" }, items: [
    { k: "new", zh: "卡片左右滑、循环播放、自动切换", en: "Cards swipe left and right, loop, and advance on their own" },
    { k: "new", zh: "设置里可以选温度单位（℉ / ℃）", en: "Pick the temperature unit (℉ / ℃) in Settings" },
    { k: "better", zh: "储藏的下拉默认打开「概览」", en: "The Storage menu opens Overview by default" },
  ] },
  { v: "2026-11-07.4", title: { zh: "今日卡片文字更清楚", en: "Clearer text on Today's cards" }, items: [
    { k: "better", zh: "待办卡标题改成「待办」", en: "The to-do card is now titled \"To-dos\"" },
    { k: "better", zh: "钱卡数字小一号，上月单独一行，数字右对齐", en: "Money card: slightly smaller amount, last month on its own line, numbers right-aligned" },
  ] },
  { v: "2026-11-07.3", title: { zh: "今日顶部显示日期、星期和天气", en: "Date, weekday and weather at the top of Today" }, items: [
    { k: "better", zh: "日期、星期、天气放在问候语上面", en: "Date, weekday and weather sit above the greeting" },
    { k: "better", zh: "待办卡标题旁只显示一个数字，像通知一样", en: "The to-do card shows one count next to its title, like a notification" },
  ] },
  { v: "2026-11-07.2", title: { zh: "物品不再重名", en: "No more duplicate item names" }, items: [
    { k: "better", zh: "同名物品自动合并，以后也加不出重复的", en: "Items with the same name are merged, and new duplicates can't be added" },
    { k: "new", zh: "添加卡、账单、设备时，名字重复会提醒", en: "You get a warning when a card, bill or equipment name is already used" },
    { k: "better", zh: "今日卡片在窄屏上排得更整齐", en: "Today's cards fit better on narrow screens" },
  ] },
  { v: "2026-11-07.1", title: { zh: "今日卡片和录入购物更顺手", en: "Handier Today cards and shopping entry" }, items: [
    { k: "better", zh: "卡片里的每一行都能直达对应页面", en: "Each row on the cards goes straight to its page" },
    { k: "new", zh: "录入购物可以手动一条条加", en: "Add purchases by hand, one by one" },
    { k: "better", zh: "从各处添加物品都会防止重名", en: "Adding an item from anywhere checks for duplicate names" },
  ] },
  { v: "2026-11-06.8", title: { zh: "新增「家里的数字」", en: "New: Home in numbers" }, items: [
    { k: "new", zh: "我的 → 家里的数字：年度回顾、最常用、补货节奏", en: "Me → Home in numbers: year in review, most used, restock rhythm" },
    { k: "new", zh: "看谁在出力、保养完成情况、一周里哪天最忙", en: "See who's helping, upkeep progress and the busiest days of the week" },
    { k: "new", zh: "扔掉的东西也能记下，看看浪费了多少", en: "Log what you throw away to see how much goes to waste" },
  ] },
  { v: "2026-11-06.7", title: { zh: "记录可以一键复制", en: "Copy records in one tap" }, items: [
    { k: "new", zh: "物品、设备、账单、保养、收入、花费都能复制一份再改", en: "Copy an item, equipment, bill, maintenance log, income or expense, then edit" },
    { k: "better", zh: "表单里不常用的按钮收进「⋯」菜单", en: "Less-used form buttons move into a ⋯ menu" },
  ] },
  { v: "2026-11-06.6", title: { zh: "界面更轻爽，今日改回卡片", en: "Lighter look; Today back to cards" }, items: [
    { k: "better", zh: "整体样式更轻、更干净", en: "A lighter, cleaner look throughout" },
    { k: "better", zh: "今日改成待办、家里、钱、快捷四张卡", en: "Today has four cards: to-dos, home, money and shortcuts" },
    { k: "better", zh: "储藏首页改成概览，顶上一排入口", en: "Storage opens on an overview with a row of shortcuts" },
  ] },
  { v: "2026-11-06.5", title: { zh: "分类调整后请你确认物品", en: "Confirm items after the category change" }, items: [
    { k: "new", zh: "分类重整时没把握的物品，在首页逐个请你确认", en: "Items we weren't sure how to re-file are listed on Today for you to confirm" },
  ] },
  { v: "2026-11-06.4", title: { zh: "新增洗衣、干洗、改衣分类", en: "New laundry, dry cleaning and alterations categories" }, items: [
    { k: "new", zh: "服饰鞋包下加了洗衣、干洗、改衣", en: "Laundry, dry cleaning and alterations added under Clothing" },
    { k: "better", zh: "导入银行账单时能自动认出这类花费", en: "Bank imports recognise these expenses automatically" },
  ] },
  { v: "2026-11-06.3", title: { zh: "花费分类重新整理", en: "Spending categories tidied up" }, items: [
    { k: "better", zh: "「食品杂货」和「餐饮」分开", en: "Groceries and dining out are now separate" },
    { k: "better", zh: "「购物日用」拆细，储藏的几个空间不再重叠", en: "Shopping & household is split up, and storage spaces no longer overlap" },
  ] },
  { v: "2026-11-06.2", title: { zh: "图表都能按月、季、年看", en: "Charts by month, quarter or year" }, items: [
    { k: "better", zh: "花费、收入、预算、净资产的图表都能选周期", en: "Spending, income, budget and net worth charts all let you pick the period" },
    { k: "better", zh: "时间很长时自动换成合适的周期，不挤成一团", en: "Long time ranges switch to a suitable period so charts don't get crowded" },
  ] },
  { v: "2026-11-06.1", title: { zh: "借贷页改版", en: "Loans page redesigned" }, items: [
    { k: "better", zh: "打开借贷先看「全部借贷」总览", en: "Loans opens on an all-loans overview" },
    { k: "new", zh: "可以切换视图，按条件筛选列表", en: "Switch views and filter the lists" },
  ] },
  { v: "2026-11-05.12", title: { zh: "记住「排除资本性 / 排除投资」", en: "Remembers \"exclude capital / investing\"" }, items: [
    { k: "better", zh: "这两个开关下次打开仍是你上次的选择", en: "These two switches keep your last choice next time" },
  ] },
  { v: "2026-11-05.11", title: { zh: "修复「全部历史」变成只看今年", en: "Fix: \"All history\" shrinking to this year" }, items: [
    { k: "fix", zh: "刷新页面后「全部历史」不会再缩成今年", en: "\"All history\" no longer shrinks to this year after a refresh" },
  ] },
  { v: "2026-11-05.10", title: { zh: "筛选下拉宽度更合适", en: "Better-sized filter dropdowns" }, items: [
    { k: "better", zh: "能搜索的筛选下拉不再太窄或太宽", en: "Searchable filter dropdowns are no longer too narrow or too wide" },
  ] },
  { v: "2026-11-05.9", title: { zh: "筛选下拉都能打字找", en: "Type to search in every filter dropdown" }, items: [
    { k: "fix", zh: "分类、收款方、类型的下拉都可以直接打字", en: "Category, payee and type dropdowns all accept typing" },
  ] },
  { v: "2026-11-05.8", title: { zh: "收款方能看 12 个月走势", en: "12-month trend for each payee" }, items: [
    { k: "new", zh: "每个收款方一行，看近 12 个月的变化", en: "Each payee has a row showing the last 12 months" },
    { k: "new", zh: "导入对账单后提示整理收款方名字", en: "After an import, you're reminded to tidy payee names" },
  ] },
  { v: "2026-11-05.7", title: { zh: "明细页的时间范围统一", en: "Same time ranges on every list" }, items: [
    { k: "better", zh: "各明细页的时间范围选项都一样了", en: "All detail lists offer the same time range options" },
  ] },
  { v: "2026-11-05.6", title: { zh: "财务页共用一个时间范围", en: "One time range across finance pages" }, items: [
    { k: "better", zh: "花费和收入看板用同一个时间范围，改一处都跟着变", en: "Spending and income dashboards share one time range" },
    { k: "new", zh: "可以选按周、月、季等周期来看", en: "View by week, month, quarter and more" },
  ] },
  { v: "2026-11-05.5", title: { zh: "付款方页面更好用", en: "Better payers page" }, items: [
    { k: "new", zh: "付款方页有数字卡片和图表", en: "The payers page has summary cards and charts" },
    { k: "new", zh: "可以多选合并，记住别名，下次自动归到一起", en: "Merge several at once; aliases are remembered for next time" },
  ] },
  { v: "2026-11-05.4", title: { zh: "今日和储藏加了「录入购物」入口", en: "Add purchases from Today and Storage" }, items: [
    { k: "new", zh: "首页咩咩咩卡和储藏概览都能直接录入购物", en: "Add purchases right from Today's Baa card or the Storage overview" },
  ] },
  { v: "2026-11-05.3", title: { zh: "收款方页面重做", en: "Payees page rebuilt" }, items: [
    { k: "new", zh: "收款方可以改名、合并、整理", en: "Rename, merge and tidy payees" },
    { k: "better", zh: "页面布局和其他财务页一致", en: "Layout matches the other finance pages" },
  ] },
  { v: "2026-11-05.2", title: { zh: "「商店」改叫「收款方」", en: "\"Stores\" are now \"Payees\"" }, items: [
    { k: "better", zh: "导入时自动统一收款方名字（如亚马逊的各种写法）", en: "Payee names are unified on import (e.g. all the Amazon variants)" },
    { k: "better", zh: "花费页的标签放不下时收进「更多」", en: "Spending tabs that don't fit go into \"More\"" },
  ] },
  { v: "2026-11-05.1", title: { zh: "为收款方和统一时间范围做准备", en: "Groundwork for payees and one time range" }, items: [
    { k: "better", zh: "规划好收款方页面和统一时间栏，接下来几版陆续上线", en: "Planned the payees page and a shared time bar, arriving over the next updates" },
  ] },
  { v: "2026-11-04.5", title: { zh: "花费明细的合计和概览对得上", en: "Spending totals now match the overview" }, items: [
    { k: "fix", zh: "明细顶部的合计按类别拆开，和概览数字一致", en: "The detail total is broken down by group and matches the overview" },
  ] },
  { v: "2026-11-04.4", title: { zh: "花费明细的日期写完整", en: "Full dates in spending details" }, items: [
    { k: "better", zh: "明细里的日期统一写完整", en: "Dates in the detail list are always shown in full" },
    { k: "new", zh: "可以自己选日期格式", en: "Choose your own date format" },
  ] },
  { v: "2026-11-04.3", title: { zh: "新增借贷总览", en: "New loans overview" }, items: [
    { k: "new", zh: "借贷总览：借入、借出、已还、还欠多少，按人看进度", en: "Loans overview: borrowed, lent, settled and still owed, with progress per person" },
    { k: "better", zh: "个人借贷可以按人搜索、筛选、排序", en: "Personal loans can be searched by person, filtered and sorted" },
    { k: "better", zh: "净资产的卡片能点进去看明细", en: "Net worth cards open their details" },
  ] },
  { v: "2026-11-04.2", title: { zh: "收到 Zelle 默认算「花费退回」", en: "Zelle received now counts as money back" }, items: [
    { k: "better", zh: "收到 Zelle / Venmo、报销，默认冲减花费而不是记收入", en: "Zelle / Venmo received and reimbursements reduce spending instead of counting as income" },
    { k: "better", zh: "转出的 Zelle 先等你归类", en: "Zelle sent waits for you to pick a category" },
    { k: "new", zh: "以前记成收入的 Zelle 可以批量整理", en: "Tidy up older Zelle income in one go" },
  ] },
  { v: "2026-11-04.1", title: { zh: "删除都先确认，改完不跳回顶部", en: "Deletes ask first; lists keep your place" }, items: [
    { k: "fix", zh: "花费左滑删除没反应的问题", en: "Swipe-to-delete on spending did nothing" },
    { k: "better", zh: "所有删除都会先确认一次", en: "Every delete asks for confirmation" },
    { k: "fix", zh: "改完一条，明细列表不再闪一下跳回顶部", en: "Lists no longer flash and jump to the top after an edit" },
  ] },
  { v: "2026-11-03.8", title: { zh: "交易时间线可以筛选和排序", en: "Filter and sort deal timelines" }, items: [
    { k: "new", zh: "按状态、阶段筛选，可排序，默认最新在前", en: "Filter by status or stage and sort; newest first by default" },
  ] },
  { v: "2026-11-03.7", title: { zh: "净现金流按账面算", en: "Net cash flow on a book basis" }, items: [
    { k: "better", zh: "卖房、借款等进来的钱也计入「净现金流（账面）」", en: "Money from sales, loans and the like now counts in net cash flow (book)" },
    { k: "better", zh: "只看收入的结余另外显示", en: "The income-only balance is shown separately" },
  ] },
  { v: "2026-11-03.6", title: { zh: "收支差额算得更完整", en: "More complete net cash flow" }, items: [
    { k: "fix", zh: "净现金流扣掉所有支出：税、保险、利息、捐款、投资等", en: "Net cash flow now subtracts all outflows: taxes, insurance, interest, donations, investing" },
    { k: "better", zh: "自定义日期可以直接打字，不会打一半就跳", en: "Custom dates can be typed without jumping mid-way" },
  ] },
  { v: "2026-11-03.5", title: { zh: "写清楚哪些内容会备份", en: "Clear list of what's backed up" }, items: [
    { k: "better", zh: "说明里写明哪些数据在备份里、哪些不在", en: "The guide lists which data is in the backup and which isn't" },
  ] },
  { v: "2026-11-03.4", title: { zh: "对账单按账户看导到了哪天", en: "See how far each account is imported" }, items: [
    { k: "better", zh: "每个账户显示最近导入到哪天，久没导的排在前面", en: "Each account shows its latest imported date; overdue ones come first" },
  ] },
  { v: "2026-11-03.3", title: { zh: "银行导入的转入不再重复记", en: "Incoming transfers no longer counted twice" }, items: [
    { k: "fix", zh: "收到的转账不会再同时记成一笔负花费", en: "Money transferred in is no longer also logged as negative spending" },
  ] },
  { v: "2026-11-03.2", title: { zh: "牧羊人的看病记录能带到账单", en: "Doctor visits from Shepherd fill in a bill" }, items: [
    { k: "new", zh: "从牧羊人一键填好一次性账单（医疗）", en: "Fill in a one-time medical bill from Shepherd in one tap" },
  ] },
  { v: "2026-11-03.1", title: { zh: "对账单覆盖情况按天算", en: "Statement coverage counted in days" }, items: [
    { k: "fix", zh: "覆盖表按天数算，不再按月粗算", en: "Coverage now counts days instead of whole months" },
  ] },
  { v: "2026-11-02.8", title: { zh: "牧羊人可以加东西到采购清单", en: "Shepherd can add to the shopping list" }, items: [
    { k: "new", zh: "在牧羊人里一键加到这里的采购清单", en: "Add things to this shopping list straight from Shepherd" },
  ] },
  { v: "2026-11-02.7", title: { zh: "应用切换里更新牧羊人的说明", en: "Updated Shepherd description in the app switcher" }, items: [
    { k: "better", zh: "牧羊人显示「身心灵 · 家人健康」", en: "Shepherd now reads \"Body, mind & spirit · family health\"" },
  ] },
  { v: "2026-11-02.6", title: { zh: "借贷记录读起来更像人话", en: "Loan records in plain words" }, items: [
    { k: "better", zh: "每条记录写成「Tom 还我」「借给 Tom」这样", en: "Each record reads like \"Tom paid me back\" or \"Lent to Tom\"" },
    { k: "better", zh: "选借贷时按借出、借入、贷款分组", en: "The loan picker is grouped into lent, borrowed and loans" },
    { k: "fix", zh: "关联列表的刷新按钮不灵", en: "The refresh button on the link list didn't work" },
  ] },
  { v: "2026-11-02.5", title: { zh: "贷款关联可以刷新", en: "Refresh loan link suggestions" }, items: [
    { k: "new", zh: "可关联的还款旁加了刷新按钮", en: "A refresh button next to the payments you can link" },
  ] },
  { v: "2026-11-02.4", title: { zh: "对账单「最近导入」的数字更准", en: "Accurate numbers in recent imports" }, items: [
    { k: "fix", zh: "每批的笔数和合计按现在的数据算，改过也对得上", en: "Each batch's count and total reflect later edits" },
    { k: "better", zh: "列表统一用「继续加载」", en: "The list uses the usual \"Load more\"" },
  ] },
  { v: "2026-11-02.3", title: { zh: "修复今日页超出屏幕", en: "Fix: Today wider than the screen" }, items: [
    { k: "fix", zh: "今日页不再超出屏幕宽度", en: "Today no longer overflows the screen" },
    { k: "better", zh: "记花费的表单排得更整齐", en: "Tidier spending form" },
  ] },
  { v: "2026-11-02.2", title: { zh: "页面更整齐，房屋首页有「资产」", en: "Tidier pages; Assets block on Home" }, items: [
    { k: "better", zh: "房屋首页一块「资产」，房屋和汽车都能折叠", en: "Home tab has an Assets block; houses and cars can be folded" },
    { k: "better", zh: "房贷拆分的操作就在那一行下面展开", en: "Mortgage split actions open right under their row" },
  ] },
  { v: "2026-11-02.1", title: { zh: "今日重新排序，房屋有待办总表", en: "Today reordered; house to-do board" }, items: [
    { k: "better", zh: "今日顺序：咩咩咩、待办、家里、钱、快捷", en: "Today order: Baa, to-dos, home, money, shortcuts" },
    { k: "new", zh: "房屋首页列出各房产要处理的事", en: "The Home tab lists what each property needs" },
    { k: "fix", zh: "待办按紧急程度排序和上色", en: "To-dos are sorted and coloured by urgency again" },
  ] },
  { v: "2026-11-01.4", title: { zh: "财务目录分组", en: "Finance menu in groups" }, items: [
    { k: "better", zh: "分成 分析 · 收支 · 借贷 · 预算与计划 · 账户与资产", en: "Grouped as Analysis · Money in & out · Loans · Budget · Accounts & assets" },
    { k: "fix", zh: "设备到期数在各处一致", en: "Equipment due counts match everywhere" },
  ] },
  { v: "2026-11-01.3", title: { zh: "今日改版，借贷详情更清楚", en: "Today redesigned; clearer loan details" }, items: [
    { k: "better", zh: "今日分区显示，带常用快捷入口", en: "Today is split into sections with shortcuts" },
    { k: "new", zh: "每个能筛选的页面都有「清除筛选」", en: "Every filtered page has \"Clear filters\"" },
    { k: "better", zh: "房贷按还款计划拆分本金和利息", en: "Mortgage payments split into principal and interest by schedule" },
  ] },
  { v: "2026-11-01.2", title: { zh: "新增净资产", en: "New: net worth" }, items: [
    { k: "new", zh: "财务 → 净资产：资产减负债，每月记一笔看走势", en: "Finance → Net worth: assets minus debts, with a monthly snapshot trend" },
    { k: "new", zh: "账户余额、房产和车辆估值可以随时更新", en: "Update account balances and home or car values any time" },
  ] },
  { v: "2026-11-01.1", title: { zh: "「账单」改名「财务」，新增借贷和资产", en: "Bills is now Finance, with Loans and Assets" }, items: [
    { k: "better", zh: "「账单」改叫「财务」，目录分组", en: "\"Bills\" is renamed \"Finance\", with a grouped menu" },
    { k: "new", zh: "财务 → 借贷：房贷、车贷、亲友借款和还款计划", en: "Finance → Loans: mortgage, car loans, family loans and schedules" },
    { k: "new", zh: "财务 → 资产：房、车、账户的买入价、估值和贷款", en: "Finance → Assets: purchase price, value and loans for homes, cars and accounts" },
    { k: "better", zh: "打开更快", en: "Opens faster" },
  ] },
  { v: "2026-10-31.3", title: { zh: "财务大升级：分类、收入、账户", en: "Big finance update: categories, income, accounts" }, items: [
    { k: "new", zh: "花费分三级分类，手动记和导入用同一套", en: "Three-level spending categories, the same for manual entry and imports" },
    { k: "new", zh: "收入分类，加上家庭收支总览", en: "Income categories and a household money overview" },
    { k: "new", zh: "卡与账户能记券商、退休、HSA、贷款账户", en: "Cards & accounts now include brokerage, retirement, HSA and loan accounts" },
    { k: "better", zh: "长列表分批加载更快；家人有自己的资料页", en: "Long lists load faster in batches; each family member has a profile page" },
  ] },
  { v: "2026-10-31.2", title: { zh: "财务权限、小家电和召回提醒", en: "Finance access, small appliances and recalls" }, items: [
    { k: "new", zh: "家主可以给每位家人开或关财务权限", en: "Owners can turn finance access on or off for each family member" },
    { k: "new", zh: "新增小家电和季节电器，带清洁和安全提醒", en: "Small and seasonal appliances, with cleaning and safety reminders" },
    { k: "new", zh: "设备召回：停用提醒和处理流程", en: "Equipment recalls: stop-use alerts and steps to resolve" },
    { k: "better", zh: "图表的日期不再挤在一起", en: "Chart dates no longer overlap" },
  ] },
];
