/* 发布日志的数据（我的 → 发布日志；今日页顶上的「新版本」提示也读这里）。
 * 每次推送：升 js/core/version.js 的 APP_VERSION，同时在最上面加一条同版本号的记录（没有这一条就不出提示）。
 * 写给家里人看：一句话标题 + 1–4 条短要点，k = new 新功能 / better 改进 / fix 修复，不写技术词。 */
export const RELEASES = [
  { v: "2026-11-13.11", title: { zh: "单家商店也能用脚本更新；特价标出折扣类型", en: "Update one store with the script; deal types on deals" }, items: [
    { k: "new", zh: "商店页「🤖 用脚本更新」：在装了脚本的笔记本上点一下，就为这一家跑一次自动更新，方便测试（手机上没反应）", en: "\"Update with script\" on a store page: on the laptop with the script, run the auto-update for just this store — handy for testing (does nothing on a phone)" },
    { k: "new", zh: "特价标出折扣类型：Black Friday、Cyber Monday、节日、店内、网上、Rollback、清仓、电子券、会员价、买一送一、多件优惠、限时；可以按类型筛选，也可以手动改", en: "Deals show their type — Black Friday, Cyber Monday, holiday, in-store, online, Rollback, clearance, digital coupon, member price, BOGO, multi-buy, limited time; filter by type or edit it" }
  ] },
  { v: "2026-11-13.10", title: { zh: "自动更新读的是你家附近那家门店的广告", en: "Auto-update reads the ad for your nearby store" }, items: [
    { k: "better", zh: "每周四自动更新：广告页显示的不是你家附近的门店时，按 ZIP 搜最近的门店、选好后再读那家的广告", en: "Thursday auto-update: if the ad page shows a different store, it searches your ZIP for the nearest store and reads that store's ad" }
  ] },
  { v: "2026-11-13.9", title: { zh: "特价有效期自动补；每周四自动更新；更新记录", en: "Deal dates filled in; Thursday auto-update; update log" }, items: [
    { k: "better", zh: "每周换广告的商店：广告上没写日期时，按这家的换广告日自动补上这一期的起止日期；Costco 这类不是每周的，用每样东西自己的日期", en: "Weekly-ad stores: when the ad has no dates, this week's dates are filled in from the store's ad day; non-weekly stores like Costco keep each item's own dates" },
    { k: "new", zh: "商店编辑里可以打开「每周四自动更新」：电脑上的 Claude 定时任务自动打开广告、翻页、读取、录入（季节 / 节日类的保持手动）", en: "Turn on \"Update automatically every Thursday\" for a store: a Claude scheduled task on the computer opens the ad, pages through, reads and saves the deals (keep seasonal / holiday stores manual)" },
    { k: "new", zh: "常去的商店 → 📜 更新记录：每次录入特价（自动、导入、拍照、手动）的时间、哪几家、加了几条、失败原因", en: "My stores → Update log: when deals were saved (auto, import, photo, by hand), which stores, how many, and any failures" }
  ] },
  { v: "2026-11-13.8", title: { zh: "商店特价也用搜索 + 筛选", en: "Store deals use search and filters too" }, items: [
    { k: "better", zh: "商店页的本周特价：搜索框后面是「全部特价 / 对上清单 / 快过期」、分类、排序三个下拉，手机上收进「筛选」", en: "A store's deals: after the search box, menus for all / on my list / ending soon, category and sort; folded under Filters on phones" }
  ] },
  { v: "2026-11-13.7", title: { zh: "找附近的商店更快；商店列表改成搜索 + 筛选", en: "Faster nearby store search; store list uses search and filters" }, items: [
    { k: "better", zh: "找附近的商店：几秒内先列出附近的常见连锁店，完整结果（含小店）到了再换上；地图服务忙时也能用", en: "Nearby stores: common chain stores show up within seconds, then the full list (small shops too); still works when the map service is busy" },
    { k: "new", zh: "范围除了 5 / 10 / 15 / 20 英里，也可以自己填（最多 30 英里）", en: "Besides 5 / 10 / 15 / 20 miles, type your own range (up to 30 miles)" },
    { k: "better", zh: "常去的商店：搜索框 + 状态、分类、排序下拉，手机上收进「筛选」；改了筛选面板不会自己收起", en: "My stores: search plus status, category and sort menus, folded under Filters on phones; the filter panel stays open while you change it" }
  ] },
  { v: "2026-11-13.6", title: { zh: "修好：按 ZIP 加商店失败", en: "Fixed: adding stores by ZIP failed" }, items: [
    { k: "fix", zh: "修好：按 ZIP 加入商店时保存失败（数据库报错）", en: "Fixed: stores added by ZIP couldn't be saved (database error)" },
    { k: "fix", zh: "找附近门店的备用地图服务连不上时，不再一直等，改用另一个服务把门店找全", en: "When the backup map service can't be reached, nearby stores are found with the other service instead of waiting" }
  ] },
  { v: "2026-11-13.5", title: { zh: "拍照加入采购清单；清单改成搜索 + 筛选", en: "Add to the shopping list from a photo; search and filters on the list" }, items: [
    { k: "new", zh: "采购 →「拍照添加」：拍快用完的东西、空瓶空袋、手写清单或聊天截图，AI 认出要买什么，核对后加进采购清单（不动库存）", en: "Shopping → Add from photo: snap things running low, empty packages, a handwritten list or a chat; AI finds what to buy and you confirm before it goes on the list (inventory unchanged)" },
    { k: "better", zh: "采购首页分清两件事：「加入采购清单」（手动 / 拍照 / 补货提醒）和「买回来了，录入库存」（小票 / 网购订单）", en: "The shopping page now separates adding to the list (by hand / photo / restock reminders) from adding bought things to inventory (receipt / online order)" },
    { k: "better", zh: "采购清单：搜索框 + 状态、分类、排序下拉，默认加入最久的排在最前", en: "Shopping list: search plus status, category and sort menus; oldest items first by default" }
  ] },
  { v: "2026-11-13.4", title: { zh: "采购页改版：一眼看清要买什么", en: "Shopping redesigned: see what to buy at a glance" }, items: [
    { k: "better", zh: "采购首页变成看板：待购买（尚未认领 / 已认领）、家人认领、常去的商店与特价、近 30 天买到，点哪格进哪里", en: "Shopping now opens on a dashboard: to buy (unclaimed / claimed), claimed by family, stores & deals, bought in 30 days; tap a card to open it" },
    { k: "better", zh: "「手动添加」「扫描小票录入」放在最上面；手动添加是单独一页，加完一项可以接着加", en: "\"Add by hand\" and \"Scan a receipt\" are at the top; adding by hand has its own page so you can keep adding" },
    { k: "better", zh: "完整的采购清单按状态分页签：全部未买、尚未认领、已认领、我认领的、已买到", en: "The full list has tabs: all open, unclaimed, claimed, mine, bought" },
    { k: "fix", zh: "找附近的商店：地图服务忙时不再一直转圈，改为先列出附近的常见连锁店；一周内同样的搜索直接用上次的结果", en: "Nearby stores: when the map service is busy you now get nearby chain stores instead of an error; repeat searches within a week reuse the last result" }
  ] },
  { v: "2026-11-13.3", title: { zh: "用 Claude 整理特价、按清单比价", en: "Collect deals and compare your list with Claude" }, items: [
    { k: "new", zh: "常去的商店 →「用 Claude 整理」：复制指令给 Chrome 侧边栏里的 Claude，它只读你打开、搜好的广告页，按单价整理", en: "My stores → Ask Claude: copy instructions for Claude in the Chrome side panel; it reads only the ad pages you opened and sorts by unit price" },
    { k: "new", zh: "也可以复制「按采购清单比价」：让 Claude 找出清单上每样东西哪家最便宜", en: "Or copy \"compare my shopping list\": Claude finds the cheapest store for each item" },
    { k: "new", zh: "把 Claude 给的结果贴回来，一次导入几家的特价（核对后才保存）；单个商店页也能直接贴", en: "Paste Claude's result back to import several stores at once (saved after you check); also works on a single store's page" }
  ] },
  { v: "2026-11-13.2", title: { zh: "常去的商店和本周特价", en: "Your stores and this week's deals" }, items: [
    { k: "new", zh: "采购清单上面多了「常去的商店」：按分类筛选、搜索、排序，可以手动加、编辑，不想去的收进「不去了」，随时加回来", en: "\"My stores\" above the shopping list: filter by category, search, sort; add or edit stores, set aside the ones you stop using and add them back any time" },
    { k: "new", zh: "按 ZIP 或当前位置找附近 5 / 10 / 15 / 20 英里的超市、会员店、五金、汽配…，一键加入；第一次可以直接加 Jewel-Osco、Costco、ALDI 等 6 家最近的门店", en: "Find stores within 5–20 miles by ZIP or location and add them in one tap; start with the nearest Jewel-Osco, Costco, ALDI and more" },
    { k: "new", zh: "每家商店：本周广告、Flipp 链接；拍广告或截图让 AI 读出特价（单件价、单价、有效期），核对后保存；每周换广告那天提醒更新", en: "Each store: weekly ad and Flipp links; photograph the ad and AI reads the deals (price, unit price, dates) for you to confirm; reminders on the day the ad changes" },
    { k: "new", zh: "采购清单里的东西在哪家打折，直接标在那一项下面", en: "Shopping list items show which store has them on sale" }
  ] },
  { v: "2026-11-13.1", title: { zh: "修好：账单保存没反应", en: "Fixed: saving a bill did nothing" }, items: [
    { k: "fix", zh: "修好：编辑账单（比如 HOA 月费的付款账户与自动扣款）点保存没反应", en: "Fixed: tapping Save on a bill (e.g. HOA payment account and autopay) did nothing" }
  ] },
  { v: "2026-11-12.4", title: { zh: "单位更聪明：瓶、袋、盒自动选，补货自动换算", en: "Smarter units: bottle, bag, box picked for you; restocks convert" }, items: [
    { k: "better", zh: "录入购物和新建物品按东西猜单位：牛奶、酱油 → 瓶，大米、薯片 → 袋，鸡蛋 → 盒；猜不出来才是「个」", en: "Shopping scans and new items guess the unit from the name: milk → bottle, rice → bag, eggs → box; \"pc\" only when unsure" },
    { k: "better", zh: "补到已有物品时单位不一样：lb ↔ kg 自动换算，个 ↔ 瓶 按库存的单位记，每行和入库后都会说明换算了什么；换算不了的会提醒你改", en: "Adding to an existing item in a different unit: lb ↔ kg converts, pc ↔ bottle uses the stock's unit, and you're told what changed; if it can't convert you're asked to fix it" },
    { k: "better", zh: "单位列表两套都有：在美国也能选 mL、g（照包装上印的填），显示时按地区换算", en: "Unit list now has both systems: pick mL or g as printed on the package, shown in your region's units" }
  ] },
  { v: "2026-11-12.3", title: { zh: "今日页不再左右晃；家里一览在电脑上排满两列", en: "Today no longer scrolls sideways; home card fills both columns on laptops" }, items: [
    { k: "fix", zh: "修好：电脑上今日页底部多出一条横向滚动条，页面能被拖到右边", en: "Fixed: an extra horizontal scrollbar on Today that let the page drift sideways" },
    { k: "better", zh: "「家里 · 一览」在电脑上放 8 行，两列刚好排满", en: "The home card shows 8 rows on laptops so both columns are full" }
  ] },
  { v: "2026-11-12.2", title: { zh: "问咩咩可以带照片；家里一览多了房产和房屋入口", en: "Ask with photos; more home links on Today" }, items: [
    { k: "new", zh: "问咩咩可以拍几张照片或选 PDF 一起问，比如冰箱里的菜「这些能做什么？」；每张都能删", en: "Ask with photos or PDFs, e.g. what's in the fridge: \"what can I make?\"; remove any of them" },
    { k: "better", zh: "今日「家里 · 一览」：每套房产一行直接进概览，加上车辆、季节任务、东西坏了、房屋资料、耗材；放不下时底部「更多 › 房屋」", en: "Today's home card: one row per property, plus vehicles, seasonal tasks, repairs, home details and supplies; \"More › Home\" when it's full" }
  ] },
  { v: "2026-11-12.1", title: { zh: "AI 输入框跟着内容长高", en: "AI text boxes grow with what you paste" }, items: [
    { k: "better", zh: "录入购物、收入识别、报修、问 AI 等地方的文字框，粘贴多少就长多高，不用一开始就滑动", en: "Text boxes in shopping, income scan, repairs and Ask AI grow with the text, so you don't have to scroll right away" }
  ] },
  { v: "2026-11-09.2", title: { zh: "已经发生的事，日期不能选到未来", en: "Dates for things that already happened can't be in the future" }, items: [
    { k: "better", zh: "开卡日期、借贷往来、收入到账、还款、交易进展、里程记录等：晚于今天的日期变灰、不能选", en: "Card opening, debt records, income received, repayments, deal progress, odometer readings and the like: dates after today are greyed out" },
    { k: "better", zh: "手动填了未来的日期，保存时会提醒", en: "A future date typed by hand gets a reminder when you save" },
    { k: "better", zh: "到期日、保质期、预约和计划的日期不受影响，照样能选未来", en: "Due dates, expiry dates, appointments and plans are unchanged and can still be in the future" },
  ] },
  { v: "2026-11-09.1", title: { zh: "填表时没保存的内容不会再被刷新冲掉", en: "Unsaved form input no longer disappears" }, items: [
    { k: "fix", zh: "添加卡和账户时，填到一半的内容过两三秒被清空的问题已修好", en: "Fixed: when adding a card or account, what you had typed was cleared after a few seconds" },
    { k: "fix", zh: "所有表单都一样：后台刷新数据时，没保存的内容和光标都留着", en: "Same for every form: when data refreshes in the background, unsaved input and the cursor stay put" },
  ] },
  { v: "2026-11-08.2", title: { zh: "发布日志可以按天或按版本分组，补上了早期的更新记录", en: "Release notes group by day or version, with the full early history" }, items: [
    { k: "new", zh: "发布日志新增「分组」：按版本或按天，记住你的选择", en: "New \"Group\" option in release notes: by version or by day, remembered" },
    { k: "better", zh: "补上了从上线第一天起的更新记录", en: "Updates are now listed all the way back to the first day" },
  ] },
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
  { v: "2026-10-31.1", title: { zh: "收入分类更细，看法和花费一样", en: "Income gets subcategories and spending-style views" }, items: [
    { k: "new", zh: "收入分大类和小类", en: "Income has categories and subcategories" },
    { k: "better", zh: "收入的时间范围、点图看明细，和花费一致", en: "Income time ranges and tap-through charts work like spending" },
    { k: "better", zh: "付款方可以搜索和排序", en: "Payers can be searched and sorted" },
    { k: "fix", zh: "近 5 年的花费少算了一部分", en: "Spending over 5 years was undercounted" },
  ] },
  { v: "2026-10-28.7", title: { zh: "应用切换里加入「稻种账本」", en: "Rice Seed Ledger joins the app switcher" }, items: [
    { k: "new", zh: "右上角切换应用时可以打开「稻种账本」", en: "Open Rice Seed Ledger from the app switcher" },
  ] },
  { v: "2026-10-28.6", title: { zh: "收起不丢草稿，新增返回按钮", en: "Drafts stay when rows close; new Back button" }, items: [
    { k: "better", zh: "明细行收起时保留没填完的内容", en: "Closing a row keeps what you've typed" },
    { k: "new", zh: "记收入可以设默认付款方和类型", en: "Set a default payer and type for new income" },
    { k: "better", zh: "手机上库存用下拉选分类和小类", en: "On phones, pick category and subcategory from dropdowns" },
    { k: "new", zh: "路径旁加「‹ 返回」按钮", en: "A \"‹ Back\" button next to the page path" },
  ] },
  { v: "2026-10-28.5", title: { zh: "英文提示补齐", en: "English text filled in" }, items: [
    { k: "better", zh: "「再点一下收起」也有英文了", en: "\"Tap again to close\" now shows in English" },
  ] },
  { v: "2026-10-28.4", title: { zh: "展开的行再点一下就收起", en: "Tap an open row again to close it" }, items: [
    { k: "better", zh: "收入和花费明细里，再点一下正在编辑的行就收起", en: "In income and spending lists, tap the row you're editing to close it" },
  ] },
  { v: "2026-10-28.3", title: { zh: "手机上金额不再折行", en: "Amounts no longer wrap on phones" }, items: [
    { k: "better", zh: "手机上金额字号小一号，数字对得更齐", en: "Amounts are a size smaller on phones and line up neatly" },
  ] },
  { v: "2026-10-28.2", title: { zh: "所有金额都显示到分", en: "All amounts show cents" }, items: [
    { k: "fix", zh: "花费等页面上千的金额不再被四舍五入", en: "Amounts over 1,000 on spending and other pages are no longer rounded" },
  ] },
  { v: "2026-10-28.1", title: { zh: "收入金额显示到分", en: "Income amounts show cents" }, items: [
    { k: "fix", zh: "收入金额的小数被四舍五入的问题", en: "Income amounts were rounded to whole numbers" },
  ] },
  { v: "2026-10-27.22", title: { zh: "收入明细可以正常编辑了", en: "Income entries can be edited again" }, items: [
    { k: "fix", zh: "点收入行不能编辑、「手动记一笔」没反应", en: "Tapping an income row or \"Add manually\" did nothing" },
  ] },
  { v: "2026-10-27.21", title: { zh: "小更新", en: "Small update" }, items: [
    { k: "better", zh: "后台整理，使用上没有变化", en: "Behind-the-scenes tidy-up; nothing changes for you" },
  ] },
  { v: "2026-10-27.20", title: { zh: "加入家庭更安全", en: "Safer family joining" }, items: [
    { k: "new", zh: "邀请码 7 天过期，家主可重新生成或关闭", en: "Invite codes expire after 7 days; owners can renew or close them" },
    { k: "new", zh: "新加入的人要家主批准后才能看到数据", en: "New members see nothing until an owner approves them" },
  ] },
  { v: "2026-10-27.19", title: { zh: "新增「全部流水」", en: "New: all transactions" }, items: [
    { k: "new", zh: "花费和收入按时间排在一起看", en: "See spending and income together in date order" },
    { k: "better", zh: "可按时间、花费或收入筛选", en: "Filter by time range, spending or income" },
  ] },
  { v: "2026-10-27.18", title: { zh: "新增「对账单」", en: "New: statements" }, items: [
    { k: "new", zh: "一份对账单同时导入花费和收入", en: "One statement imports both spending and income" },
    { k: "new", zh: "花费、收入可以导出和打印", en: "Export and print spending and income" },
    { k: "fix", zh: "收入明细的两个小问题", en: "Two small problems in the income list" },
  ] },
  { v: "2026-10-27.17", title: { zh: "收入的入账账户可以直接选", en: "Pick the receiving account for income" }, items: [
    { k: "better", zh: "入到哪个账户改成下拉，和记花费一样", en: "The receiving account is a dropdown, same as for spending" },
  ] },
  { v: "2026-10-27.16", title: { zh: "收入明细更好用", en: "Easier income list" }, items: [
    { k: "better", zh: "点整行就能编辑收入", en: "Tap anywhere on a row to edit the income" },
    { k: "new", zh: "收入也能左滑删除", en: "Swipe left to delete income" },
  ] },
  { v: "2026-10-27.15", title: { zh: "交易清单可以跳过步骤", en: "Skip steps in a deal checklist" }, items: [
    { k: "new", zh: "用不上的步骤可以跳过，不算延误也不提醒", en: "Skip steps you don't need; they don't count as late or remind you" },
    { k: "better", zh: "每个阶段后面显示完成情况", en: "Each stage shows how much is done" },
  ] },
  { v: "2026-10-27.14", title: { zh: "更新后新功能马上能用", en: "New features work right after an update" }, items: [
    { k: "fix", zh: "更新后有些新页面还是旧的", en: "Some new pages still showed the old version after an update" },
  ] },
  { v: "2026-10-27.13", title: { zh: "记交易进展可以保存了", en: "Deal progress notes save again" }, items: [
    { k: "fix", zh: "「记一笔进展」点保存没反应", en: "Saving a deal progress note did nothing" },
  ] },
  { v: "2026-10-27.12", title: { zh: "交易的计划和实际分开看", en: "Deals show plan and actual separately" }, items: [
    { k: "new", zh: "房产和汽车交易记住原计划日期", en: "Home and car deals remember the original plan dates" },
    { k: "better", zh: "改了日期也能看出提前还是延误", en: "After dates change you can still see what's early or late" },
  ] },
  { v: "2026-10-27.11", title: { zh: "收入页打不开的问题", en: "Income page wouldn't open" }, items: [
    { k: "fix", zh: "点「收入」时应用出错", en: "Opening Income caused an error" },
  ] },
  { v: "2026-10-27.10", title: { zh: "收入页和花费页一样好用", en: "Income page works like spending" }, items: [
    { k: "better", zh: "收入分概览、明细、类型、付款方、收支对比", en: "Income has Overview, Records, Types, Payers and In vs out" },
    { k: "better", zh: "可以按时间和家人筛选", en: "Filter by time range and family member" },
  ] },
  { v: "2026-10-27.9", title: { zh: "导入的收入可以直接查看", en: "View imported income directly" }, items: [
    { k: "better", zh: "导入批次里有收入时，可以一键看这批收入", en: "If an import includes income, open just that batch's income" },
  ] },
  { v: "2026-10-27.8", title: { zh: "记收入有三种方式", en: "Three ways to record income" }, items: [
    { k: "new", zh: "手动记、拍照识别或导入对账单", en: "Enter by hand, scan a photo or import a statement" },
    { k: "new", zh: "可识别支票、工资条、转账截图", en: "Recognises checks, pay stubs and transfer screenshots" },
  ] },
  { v: "2026-10-27.7", title: { zh: "看看用了多少存储空间", en: "See how much storage is used" }, items: [
    { k: "new", zh: "设置 → 存储用量：快满时变黄、变红", en: "Settings → Storage: turns yellow, then red, as it fills up" },
  ] },
  { v: "2026-10-27.6", title: { zh: "收入只有一个入口", en: "One place for income" }, items: [
    { k: "better", zh: "预期收入和预算并入收入页，不用再去设置里找", en: "Expected income and budget planning moved into the Income page" },
  ] },
  { v: "2026-10-27.4", title: { zh: "收入页面排版修好", en: "Income page layout fixed" }, items: [
    { k: "fix", zh: "收入金额和明细行的显示错乱", en: "Income amounts and rows displayed wrongly" },
  ] },
  { v: "2026-10-27.3", title: { zh: "还给别人的钱也算进花费", en: "Money paid back counts as spending" }, items: [
    { k: "fix", zh: "还给个人的钱默认同时记一笔花费", en: "Paying someone back also records a spending entry by default" },
  ] },
  { v: "2026-10-27.2", title: { zh: "新增收入记录", en: "New: income" }, items: [
    { k: "new", zh: "记录每一笔进账，和花费分开", en: "Record money coming in, kept apart from spending" },
    { k: "new", zh: "家主看全家的，其他人只看自己记的", en: "Owners see the whole family's; others see only their own" },
  ] },
  { v: "2026-10-27.1", title: { zh: "注意事项按来源筛选更方便", en: "Easier filtering of alerts by source" }, items: [
    { k: "better", zh: "注意事项来源改成下拉，带数量", en: "Alert sources are a dropdown with counts" },
    { k: "better", zh: "「全部加入采购」只在看储藏时出现", en: "\"Add all to shopping\" only shows for Storage alerts" },
  ] },
  { v: "2026-10-26.94", title: { zh: "导入时可以取消误判的跳过", en: "Undo a wrong skip when importing" }, items: [
    { k: "new", zh: "核对后可把「疑似已记录」的那笔照样导入", en: "After checking, import entries flagged as possibly recorded" },
  ] },
  { v: "2026-10-26.93", title: { zh: "小更新", en: "Small update" }, items: [
    { k: "better", zh: "后台整理，使用上没有变化", en: "Behind-the-scenes tidy-up; nothing changes for you" },
  ] },
  { v: "2026-10-26.92", title: { zh: "重新导入不再误判", en: "Re-imports no longer misflag entries" }, items: [
    { k: "fix", zh: "撤销后重新导入，记录被误判为已记录", en: "After undoing an import, re-importing flagged entries as already recorded" },
  ] },
  { v: "2026-10-26.91", title: { zh: "导入批次可以改日期", en: "Change an import batch's dates" }, items: [
    { k: "new", zh: "批次的起止日期读错时可以手动改", en: "Fix a batch's start and end dates by hand if they were read wrong" },
  ] },
  { v: "2026-10-26.90", title: { zh: "Chase 对账单转账判断更准", en: "More accurate Chase transfers" }, items: [
    { k: "fix", zh: "只有自己账户之间的转账才不算花费", en: "Only transfers between your own accounts are left out of spending" },
  ] },
  { v: "2026-10-26.89", title: { zh: "转给别人的钱也记成花费", en: "Money sent to others counts as spending" }, items: [
    { k: "fix", zh: "转账给别人和取现不再被当成内部转账跳过", en: "Payments to others and cash withdrawals are no longer skipped as transfers" },
  ] },
  { v: "2026-10-26.88", title: { zh: "导入记录的文件名存得更全", en: "Longer file names in import history" }, items: [
    { k: "fix", zh: "一次导多份对账单时文件名能完整保存", en: "File names are kept in full when importing several statements" },
  ] },
  { v: "2026-10-26.87", title: { zh: "导入日期范围更准", en: "More accurate import date ranges" }, items: [
    { k: "fix", zh: "导入的日期范围不再出现无关的老年份", en: "Import date ranges no longer stretch back to unrelated years" },
  ] },
  { v: "2026-10-26.86", title: { zh: "各账户补到哪个月显示正确", en: "Statement coverage shows correctly" }, items: [
    { k: "fix", zh: "导入后「各账户已补到哪个月」没更新", en: "\"Covered up to\" per account didn't update after an import" },
  ] },
  { v: "2026-10-26.85", title: { zh: "小更新", en: "Small update" }, items: [
    { k: "better", zh: "后台整理，使用上没有变化", en: "Behind-the-scenes tidy-up; nothing changes for you" },
  ] },
  { v: "2026-10-26.84", title: { zh: "导入记录的文件名不再截断", en: "Import file names no longer cut off" }, items: [
    { k: "fix", zh: "导入多份对账单时文件名被截断", en: "File names were cut off when importing several statements" },
  ] },
  { v: "2026-10-26.83", title: { zh: "储藏里加了「采购」", en: "Shopping added under Storage" }, items: [
    { k: "new", zh: "储藏下多一页「采购」，带待买数量", en: "Storage gets a Shopping page with the number to buy" },
    { k: "better", zh: "导入记录的账户筛选更好用", en: "Easier account filter for imports" },
  ] },
  { v: "2026-10-26.82", title: { zh: "买到的东西自动从采购清单勾掉", en: "Bought items tick off the shopping list" }, items: [
    { k: "fix", zh: "记花费或拍小票后，清单里对应的项自动标成已买到", en: "Recording a purchase or scanning a receipt marks the list item as bought" },
  ] },
  { v: "2026-10-26.81", title: { zh: "操作提示更好读", en: "Easier-to-read messages" }, items: [
    { k: "better", zh: "操作结果提示改成卡片，分行显示", en: "Result messages show as a card, one point per line" },
  ] },
  { v: "2026-10-26.80", title: { zh: "记花费时提醒可能重复", en: "Duplicate warning when adding spending" }, items: [
    { k: "new", zh: "金额、日期相近的花费会提醒可能记重了", en: "Similar amount and date? You're warned it may be a duplicate" },
  ] },
  { v: "2026-10-26.79", title: { zh: "英文界面补全", en: "English text completed" }, items: [
    { k: "better", zh: "全站英文翻译补齐", en: "English translations filled in across the app" },
  ] },
  { v: "2026-10-26.78", title: { zh: "停用的卡更好找", en: "Easier to find retired cards" }, items: [
    { k: "better", zh: "停用的卡按种类计数，可以搜索和筛选", en: "Retired cards show counts by type and can be searched and filtered" },
  ] },
  { v: "2026-10-26.77", title: { zh: "用卡页整理礼品卡", en: "Gift cards organised on the Cards page" }, items: [
    { k: "new", zh: "礼品卡单独一组，显示余额合计", en: "Gift cards get their own group with a total balance" },
    { k: "better", zh: "删除卡时可以选花费记录怎么处理", en: "When deleting a card, choose what happens to its spending" },
  ] },
  { v: "2026-10-26.76", title: { zh: "每笔花费记下怎么付的", en: "Record how each purchase was paid" }, items: [
    { k: "new", zh: "记花费、采购、保养费用都能选付款方式", en: "Choose the payment method for spending, shopping and upkeep costs" },
  ] },
  { v: "2026-10-26.75", title: { zh: "设备坏了可以问「出了问题？」", en: "\"Something wrong?\" for home fixtures" }, items: [
    { k: "new", zh: "门窗、马桶、水龙头等固定装置单独管理", en: "Fixtures like doors, windows, toilets and faucets are tracked separately" },
    { k: "new", zh: "出了问题时给出排查和处理建议", en: "Get troubleshooting tips when something goes wrong" },
  ] },
  { v: "2026-10-26.74", title: { zh: "花费明细可以多选删除", en: "Delete several spending entries at once" }, items: [
    { k: "new", zh: "勾选多笔一起删，删除前确认笔数和合计", en: "Select several entries and delete them, after confirming count and total" },
  ] },
  { v: "2026-10-25.73", title: { zh: "导入批次的明细稳定显示", en: "Import batch details show reliably" }, items: [
    { k: "fix", zh: "查看导入批次时明细时有时无", en: "Import batch details sometimes disappeared" },
  ] },
  { v: "2026-10-25.72", title: { zh: "HOA 每月总计随时算好", en: "HOA monthly total updates as you type" }, items: [
    { k: "better", zh: "改任何一项费用，每月总计马上更新", en: "Change any fee and the monthly total updates right away" },
  ] },
  { v: "2026-10-25.71", title: { zh: "房屋资料新增产权、税务与车位", en: "Home info: ownership, tax and parking" }, items: [
    { k: "new", zh: "记房产税号、税务减免和车位", en: "Record the property tax number, exemptions and parking" },
  ] },
  { v: "2026-10-25.70", title: { zh: "随手问咩咩", en: "Ask Baa Baa anywhere" }, items: [
    { k: "new", zh: "房屋、账单每一项旁有小问号", en: "A small ? next to each home and bill item" },
    { k: "new", zh: "点开看为什么、怎么做、何时找人，也能一键提问", en: "See why, how and when to call someone, or ask with one tap" },
  ] },
  { v: "2026-10-25.69", title: { zh: "备份记录不再消失", en: "Backup history no longer disappears" }, items: [
    { k: "fix", zh: "Google 登录过期时备份记录被清空", en: "Backup history was wiped when the Google sign-in expired" },
    { k: "better", zh: "登录过期会提示重新授权", en: "You're prompted to sign in again when it expires" },
  ] },
  { v: "2026-10-25.68", title: { zh: "「小Y问」改名「咩咩咩」", en: "\"Ask Y\" is now \"Baa Baa\"" }, items: [
    { k: "better", zh: "助理改叫「咩咩」，换上卡通小羊图标", en: "The assistant is now called Baa Baa, with a cartoon sheep icon" },
  ] },
  { v: "2026-10-25.67", title: { zh: "同步、备份与恢复页更清楚", en: "Clearer Sync & backup page" }, items: [
    { k: "better", zh: "同步和备份各一块，状态和按钮放在一起", en: "Sync and backup each get one card with status and buttons together" },
  ] },
  { v: "2026-10-25.66", title: { zh: "备份频率设置修好", en: "Backup frequency setting fixed" }, items: [
    { k: "fix", zh: "「每隔几天」只在选自定义时出现", en: "\"Every N days\" only shows when Custom is chosen" },
  ] },
  { v: "2026-10-25.65", title: { zh: "同步和备份放在一起", en: "Sync and backup in one place" }, items: [
    { k: "better", zh: "同步状态和「立即同步」挪进「同步、备份与恢复」", en: "Sync status and \"Sync now\" moved into Sync & backup" },
  ] },
  { v: "2026-10-25.64", title: { zh: "Google Drive 选文件夹修好", en: "Google Drive folder picking fixed" }, items: [
    { k: "fix", zh: "选了 Drive 文件夹后备份可能写不进去", en: "Backups could fail after picking a Drive folder" },
  ] },
  { v: "2026-10-25.63", title: { zh: "可以在 Drive 里选文件夹了", en: "Pick a folder in Google Drive" }, items: [
    { k: "new", zh: "备份时能从 Google Drive 里选已有的文件夹", en: "Choose an existing Google Drive folder for backups" },
  ] },
  { v: "2026-10-25.62", title: { zh: "Drive 路径加了说明", en: "Tip for the Drive path" }, items: [
    { k: "better", zh: "说明怎样用 Drive 里已有的文件夹", en: "Explains how to use a folder that's already in Drive" },
  ] },
  { v: "2026-10-25.61", title: { zh: "云盘不用重新连接", en: "No need to reconnect cloud drives" }, items: [
    { k: "fix", zh: "升级后原来连好的云盘自动保留", en: "Connected cloud drives stay connected after the update" },
    { k: "better", zh: "备份结果显示 Google Drive、Dropbox 名称", en: "Backup results name Google Drive or Dropbox" },
  ] },
  { v: "2026-10-25.60", title: { zh: "恢复更安全，云盘连一次全通", en: "Safer restore; connect cloud drives once" }, items: [
    { k: "better", zh: "恢复只补缺的数据，不覆盖不删除", en: "Restore only fills in missing data; nothing is overwritten or deleted" },
    { k: "better", zh: "四个应用共用云盘连接，连一次就行", en: "All four apps share the cloud drive connection" },
  ] },
  { v: "2026-10-25.59", title: { zh: "可以连接 Google Drive", en: "Google Drive connection ready" }, items: [
    { k: "new", zh: "备份页能连接 Google Drive 了", en: "The backup page can now connect to Google Drive" },
  ] },
  { v: "2026-10-25.58", title: { zh: "备份可以直接存到云盘", en: "Back up straight to cloud drives" }, items: [
    { k: "new", zh: "备份可直连 Google Drive 或 Dropbox", en: "Back up directly to Google Drive or Dropbox" },
  ] },
  { v: "2026-10-25.57", title: { zh: "备份页重新排版", en: "Backup page redesigned" }, items: [
    { k: "better", zh: "状态卡、两个主按钮，频率一点就选", en: "Status card, two main buttons and one-tap frequency" },
    { k: "new", zh: "可以勾选备份到哪里", en: "Choose where backups go" },
  ] },
  { v: "2026-10-25.56", title: { zh: "小更新", en: "Small update" }, items: [
    { k: "better", zh: "后台整理，使用上没有变化", en: "Behind-the-scenes tidy-up; nothing changes for you" },
  ] },
  { v: "2026-10-25.55", title: { zh: "新增备份与恢复", en: "New: backup and restore" }, items: [
    { k: "new", zh: "全家数据一键备份或下载", en: "Back up or download all family data in one tap" },
    { k: "new", zh: "按周、按月自动备份", en: "Automatic weekly or monthly backups" },
  ] },
  { v: "2026-10-25.54", title: { zh: "缴费记录和到期日对得上", en: "Payments and due dates stay in step" }, items: [
    { k: "fix", zh: "编辑或补记缴费后，下次到期日不对", en: "The next due date was wrong after editing or adding a payment" },
  ] },
  { v: "2026-10-25.53", title: { zh: "扣款卡到期按卡提醒", en: "Card expiry reminders follow the card" }, items: [
    { k: "better", zh: "账单选了卡后，按那张卡的到期日提醒", en: "Bills paid by card remind you based on that card's expiry" },
  ] },
  { v: "2026-10-25.52", title: { zh: "银行账户也能登记", en: "Add bank accounts too" }, items: [
    { k: "new", zh: "用卡里能加支票和储蓄账户", en: "Add checking and savings accounts under Cards" },
    { k: "better", zh: "账单的扣款账户直接从卡和账户里选", en: "Pick a bill's payment account from your cards and accounts" },
  ] },
  { v: "2026-10-24.51", title: { zh: "导入记住的归类更聪明", en: "Smarter remembered import categories" }, items: [
    { k: "better", zh: "常用的归类留着，可一键清理多余的", en: "Frequently used rules are kept; clear extras in one tap" },
  ] },
  { v: "2026-10-24.50", title: { zh: "花费可以看「本月」", en: "Spending: This month" }, items: [
    { k: "new", zh: "时间范围加「本月」", en: "\"This month\" added to time ranges" },
    { k: "better", zh: "顶部数字随时间范围变化，带同期对比", en: "Top numbers follow the time range, with a comparison" },
  ] },
  { v: "2026-10-24.49", title: { zh: "导入老对账单后能看到明细", en: "Old statement imports show their entries" }, items: [
    { k: "fix", zh: "查看老对账单的导入批次时什么都没有", en: "Viewing an older statement's import showed nothing" },
  ] },
  { v: "2026-10-24.48", title: { zh: "导入记录更整齐", en: "Tidier import history" }, items: [
    { k: "better", zh: "最近 10 批直接显示，更早的折叠起来", en: "The latest 10 imports show; older ones are folded away" },
  ] },
  { v: "2026-10-24.47", title: { zh: "法律税务账单分类修正", en: "Legal & tax bills back in place" }, items: [
    { k: "fix", zh: "法律税务账单放回「政务与手续」", en: "Legal and tax bills moved back to Government & paperwork" },
  ] },
  { v: "2026-10-24.46", title: { zh: "新增「工作与专业」花费", en: "New: work & professional spending" }, items: [
    { k: "new", zh: "软件、考证、专业咨询、办公用品等单独一组", en: "Software, licences, professional fees and office supplies get their own group" },
  ] },
  { v: "2026-10-24.45", title: { zh: "花费页手机排版更顺", en: "Better spending layout on phones" }, items: [
    { k: "better", zh: "时间、数字、图表连在一起，其他入口放到下面", en: "Time range, numbers and charts sit together; other links move below" },
  ] },
  { v: "2026-10-24.44", title: { zh: "花费的时间和月份放在一条", en: "Time range and month in one bar" }, items: [
    { k: "better", zh: "时间范围和月份筛选合到同一条，不易漏看", en: "Time range and month filters share one bar so they're easy to spot" },
  ] },
  { v: "2026-10-24.43", title: { zh: "Costco 加油归类正确", en: "Costco gas sorted correctly" }, items: [
    { k: "fix", zh: "导入时加油站消费被归成超市", en: "Imported gas station purchases were sorted as groceries" },
  ] },
  { v: "2026-10-24.42", title: { zh: "花费可以看往年", en: "View spending from past years" }, items: [
    { k: "new", zh: "时间范围加今年和往年", en: "Time ranges include this year and past years" },
    { k: "better", zh: "记花费的三种方式并排：手动、拍小票、导入", en: "Three ways to add spending side by side: manual, receipt, import" },
  ] },
  { v: "2026-10-24.41", title: { zh: "花费页整理", en: "Spending page tidied" }, items: [
    { k: "better", zh: "「采购花费」改叫「花费」", en: "\"Shopping spend\" is now just \"Spending\"" },
    { k: "better", zh: "时间范围改成下拉", en: "The time range is a dropdown" },
  ] },
  { v: "2026-10-24.40", title: { zh: "花费分类重新整理", en: "Spending categories reorganised" }, items: [
    { k: "better", zh: "每个分类只属于一处，统计不再重复", en: "Each category belongs in one place, so totals don't overlap" },
  ] },
  { v: "2026-10-24.39", title: { zh: "商家名清理修好了", en: "Merchant name clean-up fixed" }, items: [
    { k: "fix", zh: "上一版没修好的商家名尾巴，这次去掉了", en: "Merchant name endings the last version missed are now removed" },
  ] },
  { v: "2026-10-24.38", title: { zh: "商家名清理", en: "Merchant name clean-up" }, items: [
    { k: "fix", zh: "导入时去掉商家名后面多余的尾巴", en: "Extra text at the end of imported merchant names is removed" },
  ] },
  { v: "2026-10-24.37", title: { zh: "Amazon 不再被归成会员", en: "Amazon no longer sorted as membership" }, items: [
    { k: "fix", zh: "常见商家按名字归类，不被猜错", en: "Well-known merchants are sorted by name, not guessed" },
    { k: "better", zh: "只记住你自己选的归类", en: "Only categories you pick yourself are remembered" },
  ] },
  { v: "2026-10-24.36", title: { zh: "下拉框可以直接打字找", en: "Type to search in dropdowns" }, items: [
    { k: "better", zh: "长下拉点进去就能打字筛选", en: "Tap a long dropdown and type to filter" },
  ] },
  { v: "2026-10-24.35", title: { zh: "导入归类更准", en: "More accurate import categories" }, items: [
    { k: "fix", zh: "Amazon、Costco 购物不再都被归成会员费", en: "Amazon and Costco purchases are no longer all sorted as memberships" },
  ] },
  { v: "2026-10-24.34", title: { zh: "导入的批次可以查看、修改、撤销", en: "View, edit or undo an import" }, items: [
    { k: "new", zh: "每批导入都能查看、逐笔修改或整批撤销", en: "Each import can be viewed, edited entry by entry or undone" },
  ] },
  { v: "2026-10-24.33", title: { zh: "出错提示更清楚", en: "Clearer error messages" }, items: [
    { k: "better", zh: "出错时直接说明该怎么处理", en: "Errors explain what to do next" },
  ] },
  { v: "2026-10-24.32", title: { zh: "手机上勾选框和文字更清楚", en: "Clearer checkboxes and text on phones" }, items: [
    { k: "fix", zh: "手机上勾选框变形、输入框文字显示不全", en: "Checkboxes looked odd and input text was cut off on phones" },
  ] },
  { v: "2026-10-24.31", title: { zh: "一次性账单页更简洁", en: "Simpler one-time bill page" }, items: [
    { k: "better", zh: "「记一笔付款」收成按钮，点了才展开", en: "\"Add payment\" is a button that opens the form when needed" },
  ] },
  { v: "2026-10-24.30", title: { zh: "再拍一张会新建账单", en: "Another photo starts a new bill" }, items: [
    { k: "fix", zh: "在已保存的账单页再拍照会改掉这张账单", en: "Taking a photo on a saved bill used to overwrite it" },
  ] },
  { v: "2026-10-24.29", title: { zh: "快捷操作可以直接替换", en: "Swap a shortcut in place" }, items: [
    { k: "better", zh: "编辑时点格子就能换成别的快捷操作", en: "While editing, tap a tile to change it to another shortcut" },
  ] },
  { v: "2026-10-24.28", title: { zh: "快捷操作长按拖动排序", en: "Long-press to reorder shortcuts" }, items: [
    { k: "new", zh: "长按快捷操作格子，拖到想要的位置", en: "Long-press a shortcut tile and drag it into place" },
  ] },
  { v: "2026-10-24.27", title: { zh: "快捷操作加入用卡", en: "Card shortcuts" }, items: [
    { k: "new", zh: "可加「该刷哪张卡」和「添加信用卡」", en: "Add \"Which card to use\" and \"Add credit card\" shortcuts" },
  ] },
  { v: "2026-10-24.26", title: { zh: "登录后的小问题修好", en: "Small sign-in fix" }, items: [
    { k: "fix", zh: "登录后偶尔出现的小错误", en: "A small error that sometimes appeared after signing in" },
  ] },
  { v: "2026-10-24.25", title: { zh: "花费能记用了哪张卡", en: "Record which card you used" }, items: [
    { k: "new", zh: "记花费、采购、导入都能选哪张卡", en: "Choose the card for spending, shopping and imports" },
    { k: "better", zh: "推荐会考虑开卡奖励、封顶和季度轮换", en: "Suggestions consider sign-up bonuses, caps and rotating categories" },
  ] },
  { v: "2026-10-24.24", title: { zh: "新增「用卡」：该刷哪张卡", en: "New: which card to use" }, items: [
    { k: "new", zh: "登记信用卡：常见卡一键选，也能手填", en: "Add credit cards: pick common ones or enter by hand" },
    { k: "new", zh: "按返现规则推荐这笔该刷哪张", en: "Suggests the best card for each purchase by its rewards" },
  ] },
  { v: "2026-10-24.23", title: { zh: "小更新", en: "Small update" }, items: [
    { k: "better", zh: "后台整理，使用上没有变化", en: "Behind-the-scenes tidy-up; nothing changes for you" },
  ] },
  { v: "2026-10-24.22", title: { zh: "导入对账单认出是哪个账户", en: "Imports recognise the account" }, items: [
    { k: "new", zh: "导入时自动认出银行和卡号末四位", en: "Imports detect the bank and card's last four digits" },
    { k: "better", zh: "每批导入记下账户和日期范围", en: "Each import records the account and date range" },
  ] },
  { v: "2026-10-24.21", title: { zh: "花钱分类重新设计", en: "Spending groups redesigned" }, items: [
    { k: "better", zh: "分成日常储备、装备、外出与服务三组", en: "Grouped into Supplies, Equipment, and Out & services" },
  ] },
  { v: "2026-10-24.20", title: { zh: "记一笔表单在电脑上不变形", en: "Spending form fixed on larger screens" }, items: [
    { k: "fix", zh: "电脑和 iPad 上「记一笔」按钮变形", en: "The \"Add\" button looked broken on computers and iPads" },
  ] },
  { v: "2026-10-24.19", title: { zh: "家庭开销分类补全", en: "More household spending categories" }, items: [
    { k: "new", zh: "新增外出就餐、网购、服装、个人护理等日常类别", en: "New everyday categories: dining out, online shopping, clothing, personal care and more" },
  ] },
  { v: "2026-10-24.18", title: { zh: "一次性账单新增「旅行」", en: "Trips added to one-time bills" }, items: [
    { k: "new", zh: "订机票、邮轮、酒店、旅行团，定金尾款分次付", en: "Book flights, cruises, hotels or tours, paying deposit and balance separately" },
  ] },
  { v: "2026-10-24.17", title: { zh: "旅行花费计入统计和预算", en: "Travel spending in stats and budget" }, items: [
    { k: "new", zh: "机票、住宿、租车等旅行花费可以分类记", en: "Record travel costs like flights, lodging and car rental by category" },
  ] },
  { v: "2026-10-24.16", title: { zh: "注意事项按钮更清爽", en: "Cleaner alert buttons" }, items: [
    { k: "better", zh: "每行只露一个主按钮，其他收进「⋯」", en: "Each alert shows one main button; the rest are under \"⋯\"" },
  ] },
  { v: "2026-10-24.15", title: { zh: "设置页顺序更顺手", en: "Handier Settings order" }, items: [
    { k: "better", zh: "常用的设置排在前面", en: "Settings you use most come first" },
    { k: "fix", zh: "自定义名称翻译在手机上排版错乱", en: "The custom name translations table was squashed on phones" },
  ] },
  { v: "2026-10-24.14", title: { zh: "采购改了单位，库存跟着换", en: "Stock follows a changed unit" }, items: [
    { k: "better", zh: "买到时换了单位，库存数量自动换算", en: "If you change the unit when buying, stock converts automatically" },
  ] },
  { v: "2026-10-24.13", title: { zh: "左滑删除不再误触", en: "Swipe-to-delete no longer misfires" }, items: [
    { k: "fix", zh: "注意事项被误当成可以左滑删除", en: "Alerts could be swiped away by mistake" },
  ] },
  { v: "2026-10-24.12", title: { zh: "删缴费记录后到期日退回", en: "Due date rolls back when a payment is deleted" }, items: [
    { k: "fix", zh: "删除一条缴费记录后，下次到期日退回原来那期", en: "Deleting a payment moves the next due date back" },
  ] },
  { v: "2026-10-24.11", title: { zh: "采购清单填写更顺手", en: "Smoother shopping list entry" }, items: [
    { k: "better", zh: "商店不再自动填上次的，单位可以改", en: "The store isn't pre-filled from last time, and the unit can be changed" },
    { k: "fix", zh: "左滑露出的删除按钮点了没反应", en: "The swipe delete button didn't respond" },
  ] },
  { v: "2026-10-24.10", title: { zh: "AI 模型列表可以手动刷新", en: "Refresh the AI model list" }, items: [
    { k: "better", zh: "设置里加「↻ 刷新模型列表」按钮", en: "A \"↻ Refresh model list\" button in Settings" },
  ] },
  { v: "2026-10-24.9", title: { zh: "左滑删除后列表排版恢复", en: "List layout restored after swipe-to-delete" }, items: [
    { k: "fix", zh: "左滑删除让明细列表排版乱了", en: "Swipe-to-delete broke the layout of record lists" },
  ] },
  { v: "2026-10-24.8", title: { zh: "左滑删除", en: "Swipe to delete" }, items: [
    { k: "new", zh: "采购、付款、保养、花费等列表可以左滑删除", en: "Swipe left to delete in shopping, payments, upkeep, spending and more" },
  ] },
  { v: "2026-10-24.7", title: { zh: "手机上滚动时站名条固定在顶部", en: "Site name stays on top while scrolling" }, items: [
    { k: "better", zh: "往下滚时顶部留一条站名，点一下回到顶部", en: "A slim title bar stays on top; tap it to jump back up" },
  ] },
  { v: "2026-10-24.6", title: { zh: "采购输入框不再超出", en: "Shopping inputs fit their card" }, items: [
    { k: "fix", zh: "待购买里的输入框超出卡片边界", en: "Inputs in To buy stuck out of the card" },
  ] },
  { v: "2026-10-24.5", title: { zh: "采购页重新布局", en: "Shopping page redesigned" }, items: [
    { k: "better", zh: "待购买、认领中、已买到三块，可以折叠", en: "To buy, Claimed and Bought sections that fold" },
  ] },
  { v: "2026-10-24.4", title: { zh: "装备新增「厨房用品」", en: "Kitchenware added to Equipment" }, items: [
    { k: "new", zh: "餐具、锅具、烘焙工具等记数量和位置", en: "Track dishes, pots and baking tools by count and place" },
  ] },
  { v: "2026-10-24.3", title: { zh: "手机上顶栏版本号排得下", en: "Header version fits on phones" }, items: [
    { k: "fix", zh: "窄屏时版本号放到同步状态下面", en: "On narrow screens the version sits under the sync status" },
  ] },
  { v: "2026-10-24.2", title: { zh: "顶栏显示同步状态", en: "Sync status in the header" }, items: [
    { k: "new", zh: "顶栏显示「家庭同步 · N 人」和绿点，出错变红", en: "The header shows family sync and a green dot, red if something's wrong" },
  ] },
  { v: "2026-10-24.1", title: { zh: "顶栏显示版本号", en: "Version number in the header" }, items: [
    { k: "better", zh: "版本号放在顶栏，不用翻到「我的」页底部", en: "The version is in the header, no need to scroll to the bottom of Me" },
  ] },
  { v: "2026-10-22.1", title: { zh: "开始有版本号", en: "Version numbers begin" }, items: [
    { k: "new", zh: "「我的」页底部显示版本号，方便确认更新", en: "The version shows at the bottom of Me, so you can check you're up to date" },
  ] },
  { v: "2026-10-22", title: { zh: "菜谱更贴心，提醒可以关掉", en: "Kinder recipes; mute reminders" }, items: [
    { k: "new", zh: "菜谱加追奶、产后恢复、先用旧食材", en: "Recipes for milk supply, postpartum recovery and using older food first" },
    { k: "new", zh: "不想补的物品可以「不再提醒」", en: "Mute restock reminders for items you don't want to buy again" },
    { k: "better", zh: "花费里账单按种类分开，也能合并同类", en: "Bills show by type in spending, or merged by group" },
  ] },
  { v: "2026-10-21", title: { zh: "医疗账单、可点的图表", en: "Medical bills and tappable charts" }, items: [
    { k: "new", zh: "新增医疗账单，以及宠物、法律、装修等一次性账单", en: "Medical bills, plus one-time bills for pets, legal and renovation" },
    { k: "new", zh: "花费和预算图表点一下就看到明细", en: "Tap a spending or budget chart to see the entries" },
    { k: "better", zh: "右上角九宫格切换应用，手机上更紧凑", en: "Switch apps from the grid button; more compact on phones" },
    { k: "better", zh: "加载更快，网不好也不会一直转圈", en: "Loads faster and doesn't spin forever on a bad connection" },
  ] },
  { v: "2026-10-20", title: { zh: "拍小票入库，新增预算", en: "Scan receipts; new budget" }, items: [
    { k: "new", zh: "拍小票或贴订单，自动识别记花费、入库", en: "Snap a receipt or paste an order to log spending and stock" },
    { k: "new", zh: "拍照填表：设备、车辆、账单拍一下就填好", en: "Photo fill: snap equipment, vehicles or bills to fill the form" },
    { k: "new", zh: "新增预算：按收入和固定账单算每月预算", en: "New budget based on income and regular bills" },
    { k: "better", zh: "今日快捷操作每人一份，可以自己改", en: "Everyone gets their own Today shortcuts to edit" },
  ] },
  { v: "2026-10-19", title: { zh: "季节任务按月看，分类可自定义", en: "Seasonal tasks by month; custom categories" }, items: [
    { k: "new", zh: "季节任务按月查看，可加自己的任务", en: "View seasonal tasks month by month and add your own" },
    { k: "new", zh: "房屋资料加应急信息：总水阀、配电箱等位置", en: "Emergency info: where the water shutoff, breaker panel and more are" },
    { k: "new", zh: "分类和小类可以改名、增删", en: "Rename, add or remove categories and subcategories" },
    { k: "better", zh: "设备模板补上北美常用家电和设施", en: "Equipment templates cover more common North American appliances" },
  ] },
  { v: "2026-10-18", title: { zh: "库存方块、AI 菜单和小Y问", en: "Stock tiles, AI menus and Ask Y" }, items: [
    { k: "new", zh: "手机上库存按分类方块，一眼看出缺什么", en: "On phones, stock shows as category tiles so gaps stand out" },
    { k: "new", zh: "AI 菜单助手：按库存配三餐，缺的进采购", en: "AI menu helper: plans meals from stock and adds what's missing to shopping" },
    { k: "new", zh: "「小Y问」：家里的事都可以问", en: "Ask Y: ask anything about your home" },
    { k: "better", zh: "表单离开自动保存；存放位置按房间分", en: "Forms save when you leave; storage places grouped by room" },
  ] },
  { v: "2026-10-17", title: { zh: "新增账单、车辆和房产买卖", en: "Bills, vehicles and home buying & selling" }, items: [
    { k: "new", zh: "账单与缴费：到期提醒，支持多套房产", en: "Bills and payments with due reminders, for several homes" },
    { k: "new", zh: "房产买卖、退租清单和提醒", en: "Checklists and reminders for buying, selling or moving out" },
    { k: "new", zh: "车辆档案、保养和检查", en: "Vehicle records, upkeep and inspections" },
    { k: "better", zh: "改名「爱家小助手」，可切换到姐妹应用", en: "Renamed Loving Home Helper, with links to sister apps" },
  ] },
  { v: "2026-10-16", title: { zh: "支持三种语言，家主管理成员", en: "Three languages and member management" }, items: [
    { k: "new", zh: "支持简体、繁體和英文", en: "Simplified Chinese, Traditional Chinese and English" },
    { k: "new", zh: "家主可以重置邀请码、设家主、移出成员", en: "Owners can reset invite codes, set owners and remove members" },
    { k: "new", zh: "家主可以改家人的称呼", en: "Owners can change family members' display names" },
  ] },
  { v: "2026-10-15", title: { zh: "设备保养和季节任务", en: "Equipment upkeep and seasonal tasks" }, items: [
    { k: "new", zh: "设备档案、保养记录和季节任务", en: "Equipment records, maintenance logs and seasonal tasks" },
    { k: "new", zh: "储藏新增「装备」：耐用品记数量和位置", en: "Equipment in Storage: track durable things by count and place" },
    { k: "new", zh: "手机验证码登录，或用邀请码直接进入", en: "Sign in with a phone code, or join directly with an invite code" },
    { k: "better", zh: "记录显示创建和更新时间", en: "Records show when they were created and updated" },
  ] },
  { v: "2026-10-14", title: { zh: "上线：家里的库存、采购和维护", en: "Launch: home stock, shopping and upkeep" }, items: [
    { k: "new", zh: "记下家里还有多少，按用量提醒补货", en: "Track what you have at home, with restock reminders based on use" },
    { k: "new", zh: "采购清单全家共享，认领后不会重复买", en: "A shared shopping list; claim an item so no one buys it twice" },
    { k: "new", zh: "按库存推荐一日三餐", en: "Meal ideas for the day based on what you have" },
    { k: "new", zh: "房屋维护：保养建议和常用耗材", en: "Home upkeep: maintenance tips and common supplies" },
  ] },
];
