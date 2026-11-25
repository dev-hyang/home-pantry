/* 发布日志的数据（我的 → 发布日志；今日页顶上的「新版本」提示也读这里）。
 * 每次推送：升 js/core/version.js 的 APP_VERSION，同时在最上面加一条同版本号的记录（没有这一条就不出提示）。
 * 写给家里人看：一句话标题 + 1–4 条短要点，k = new 新功能 / better 改进 / fix 修复，不写技术词。 */
export const RELEASES = [
  { v: "2026-11-24.59", title: { zh: "发布日志的箭头换成共用箭头控件", en: "Release-notes arrow uses the shared arrow control" }, items: [
    { k: "better", zh: "发布日志入口的箭头换成和其他页面同一个箭头控件，和三个姊妹应用保持一致（界面几乎不变）。", en: "The arrow on the release-notes entry now uses the same arrow control as the rest of the app, matching the sister apps (nearly no visible change)." },
  ] },
  { v: "2026-11-24.58", title: { zh: "花费排行恢复整齐，税务汇总可折叠", en: "Spending rankings tidy again; tax summary folds" }, items: [
    { k: "fix", zh: "花费 → 分类 / 收款方里的排行：名称、金额、占比重新分列，金额靠右，下面一条进度条；分类页顶上的金额回到标题同一行右边。", en: "Rankings in Spending → Categories / Payees: name, amount and share are in separate columns again, amount on the right with the bar below; the total sits on the title line." },
    { k: "fix", zh: "税务「今年」：收入报税累计标题旁的 i 贴回标题后面。", en: "Tax · This year: the i next to the income summary title is back beside the title." },
    { k: "better", zh: "花费 → 收款方：去掉重复的标题，说明收进第一张卡片的 i 里。", en: "Spending → Payees: removed the duplicate title; the note is now in the first card's i." },
    { k: "better", zh: "税务 → 汇总：每个分组默认折叠，折叠时能看到「几项已核对 / 几项待核对」。", en: "Tax → Summary: each group is folded by default and shows “N verified / M to verify”." },
  ] },
  { v: "2026-11-24.57", title: { zh: "按钮条的「取消」判断改用共用模块", en: "Button-row Cancel detection moved to a shared module" }, items: [
    { k: "better", zh: "表单底部按钮条判断哪个是「取消」的规则，改成和三个姊妹应用共用的同一份（界面不变）。", en: "The rule that decides which button is Cancel in form button rows is now shared with the sister apps (no visible change)." },
  ] },
  { v: "2026-11-24.56", title: { zh: "共用按钮样式多了主按钮色和圆角变量", en: "Shared button style gains primary-colour and radius variables" }, items: [
    { k: "better", zh: "共用样式表的按钮可以由各站设置主按钮底色、字色和圆角（本站不变）。", en: "The shared stylesheet lets each app set its primary-button colours and corner radius (unchanged here)." },
  ] },
  { v: "2026-11-24.55", title: { zh: "特价、小票核对、问咩咩清单：行样式统一", en: "Deals, receipt review and Baa Baa lists: one row style" }, items: [
    { k: "better", zh: "特价一览、商店特价、小票核对、问咩咩的勾选清单这几处的行，换成和其他列表一样的行控件：同样的分隔线和最小高度。", en: "Rows in the deals overview, shop deals, receipt review and Baa Baa's tick lists now use the same row control as other lists: same dividers and minimum height." },
  ] },
  { v: "2026-11-24.54", title: { zh: "Closing Disclosure 自动填：地税分摊和 lender credit 不再算进 credit", en: "Closing Disclosure auto-fill: tax prorations and lender credits no longer counted as credits" }, items: [
    { k: "fix", zh: "地税分摊和 Aggregate Adjustment 归到「预付 / Escrow」，不再被当成 ③ 里的 credit。", en: "Property-tax prorations and the Aggregate Adjustment now go under prepaid / escrow instead of being treated as a ③ credit." },
    { k: "better", zh: "贷款方 credit 默认不勾（对应的贷款费用本来就不进成本基础），要加可以自己勾上。", en: "Lender credits are unticked by default (the loan costs they offset are not in the cost basis); tick one to add it." },
  ] },
  { v: "2026-11-24.53", title: { zh: "表单底部的按钮条换成统一控件", en: "Form button rows now use the standard row control" }, items: [
    { k: "better", zh: "所有表单、对话框、税务小表单底部的按钮条换成同一个按钮条控件：一个按钮靠右，两个按钮取消靠左、保存靠右。", en: "Every form, dialog and small tax form now uses one button-row control: one button on the right, with two Cancel on the left and Save on the right." },
    { k: "better", zh: "税务小表单里「取消」改到左边、主操作在右边，和其他表单一致。", en: "In the small tax forms Cancel is now on the left and the main action on the right, like everywhere else." },
  ] },
  { v: "2026-11-24.52", title: { zh: "所有按钮换成统一的新按钮控件", en: "Every button now uses the one standard button control" }, items: [
    { k: "better", zh: "全站约 650 处按钮（保存、取消、小按钮、主按钮、危险按钮…）换成同一个按钮控件，样式只在一处定义。", en: "About 650 buttons across the app (save, cancel, small, primary, danger…) now use a single button control, styled in one place." },
    { k: "fix", zh: "如果哪个页面的按钮看起来不对（颜色、大小、位置），请告诉我，这次是整体替换。", en: "If a button looks wrong on any page (colour, size, position), please tell me; this was a wholesale replacement." },
  ] },
  { v: "2026-11-24.51", title: { zh: "成本基础：提醒别把首付重复填进去", en: "Cost basis: don't re-enter the down payment" }, items: [
    { k: "better", zh: "「买入时付的费用」的说明写清楚：只填房价之外的费用，不要填首付、wire 总额或 Cash to Close，否则房价会被算两遍。", en: "The \"costs paid at purchase\" note now says to enter only costs on top of the price, not the down payment, total wire or Cash to Close, which would count the price twice." },
  ] },
  { v: "2026-11-24.46", title: { zh: "清理没用的旧样式", en: "Removed unused old styles" }, items: [
    { k: "better", zh: "删掉了已经没有页面在用的旧时间线和列表样式，界面不变。", en: "Removed old timeline and list styles that no page uses any more; nothing changes on screen." },
  ] },
  { v: "2026-11-24.50", title: { zh: "页头：路径写全 + 标题行，采购页也置顶", en: "Header: full path + title line; Shopping pages sticky too" }, items: [
    { k: "better", zh: "路径行写出完整路径（包含当前页，如 财务 / 分析 / 税务 / 买卖与成本基础），不放 ⓘ；下面一行再写一遍页面名，ⓘ 在名字右上角，筛选靠右。", en: "The path row now shows the complete path including the current page (e.g. Finance / Analysis / Tax / Sales & cost basis) with no ⓘ; the line below repeats the page name with its ⓘ at the top-right and the Filter on the right." },
    { k: "new", zh: "采购各页（购物车、加入购物车、商店…）的页头改成同样两行，路径行滚动时固定在顶上。", en: "Shopping pages (cart, add to cart, stores…) use the same two-row header, with the path row sticky while scrolling." },
    { k: "better", zh: "花费明细页去掉重复的「花费记录」标题；买卖详情卡片里不再重复资产名；买卖页头右边有筛选（金额显示）按钮。", en: "Removed the duplicate \"Spending records\" heading on the spending list and the repeated asset name inside the sales detail card; the sales header has its Filter (amount visibility) button." },
  ] },
  { v: "2026-11-24.49", title: { zh: "页头统一：路径置顶，页面名单独一行", en: "Unified page header: sticky path, title on its own line" }, items: [
    { k: "new", zh: "财务各页的路径行（目录 + 财务 / 分类 / 页面）滚动时固定在顶上，房屋、储藏、我的的目录行也一样。", en: "On finance pages the path row (menu + Finance / group / page) now stays at the top while scrolling; the same for the House, Pantry and Me menu rows." },
    { k: "better", zh: "路径下面单独一行写当前页面名，说明的 ⓘ 在名字右上角，筛选按钮靠右；路径行里不再放 ⓘ。", en: "The current page name sits on its own line under the path, with its ⓘ at the name's top-right and the Filter button on the right; no ⓘ in the path row any more." },
  ] },
  { v: "2026-11-24.48", title: { zh: "搜索框和筛选按钮统一", en: "Search box and Filter button unified" }, items: [
    { k: "better", zh: "全站的搜索框、下拉、「筛选」按钮统一成 40px 高、同样的圆角和字号，和按钮对齐；手机上点按区域仍不小于 44px。", en: "Search boxes, dropdowns and Filter buttons now share one 40 px height, corner radius and font size, in line with buttons; tap areas stay at least 44 px on phones." },
    { k: "better", zh: "有多个筛选项的列表页，电脑上也收成「搜索框 + 筛选」一行，下拉放进点开的面板，页面更简洁。", en: "On list pages with several filters, desktop now also shows one row of search box + Filter, with the dropdowns inside the panel." },
  ] },
  { v: "2026-11-24.47", title: { zh: "买卖与成本基础：一张卡片一个资产", en: "Sales & cost basis: one card per asset" }, items: [
    { k: "new", zh: "每套房、每辆已卖出的车一张卡片，直接看买入价、卖出价和收益；点卡片进去看和填详细清单。", en: "Each home and each sold car gets a card showing purchase price, sale price and gain; tap a card to open its detailed lists." },
    { k: "better", zh: "页面不再被好几套房的长清单撑得很长；面包屑多一层资产名，能一层层回到卡片列表。", en: "The page is no longer stretched by several long property lists; the breadcrumb gains the asset name so you can step back to the cards." },
  ] },
  { v: "2026-11-24.46", title: { zh: "买卖与成本基础：列表更短、搜索按需出现", en: "Sales & cost basis: shorter lists, search on demand" }, items: [
    { k: "better", zh: "「从收入记录里选」默认只列关联了这套房的收入；需要时点「显示全部收入」。", en: "\"Pick from income records\" now lists only income linked to this property by default; tap \"Show all income\" when needed." },
    { k: "better", zh: "搜索和金额筛选不再一直摆在那里，点「搜索」才展开；装修翻新等清单里不再放搜索框。", en: "Search and amount filter no longer sit there all the time; tap \"Search\" to open them. Lists such as renovations have no search box." },
    { k: "better", zh: "去掉页内单独的「金额显示」眼睛行，眼睛已经在页头的筛选按钮里。", en: "Removed the separate in-page eye row; the eye is already inside the header's Filter button." },
  ] },
  { v: "2026-11-24.45", title: { zh: "按钮高度全站统一", en: "One button height across the app" }, items: [
    { k: "better", zh: "去掉各页面单独写死的按钮高度（32 到 48px 不等），统一用标准：默认 40px、小号 34px。", en: "Removed per-page hard-coded button heights (32 to 48 px) in favour of the standard: 40 px default, 34 px small." },
    { k: "better", zh: "手机上按钮视觉高度不变，点按区域仍不小于 44px；图标小按钮、和输入框并排的按钮保持原样。", en: "On phones the visible height stays the same while the tap area is still at least 44 px; icon buttons and buttons beside input fields are unchanged." },
  ] },
  { v: "2026-11-24.44", title: { zh: "表单底部按钮：取消靠左、保存靠右", en: "Form buttons: Cancel on the left, Save on the right" }, items: [
    { k: "better", zh: "表单、对话框、税务小表单底部的按钮：一个按钮靠右；两个按钮取消靠左、保存靠右，不再各自拉满一行。", en: "Buttons at the bottom of forms, dialogs and small tax forms: one button sits on the right; with two, Cancel is on the left and Save on the right instead of both stretching." },
    { k: "better", zh: "手机上两个按钮并排等宽，一个按钮占满一行；上一步 / 下一步 / 保存 这类三个以上的仍然平分。", en: "On phones two buttons sit side by side at equal width and a single one fills the row; three or more (Back / Next / Save) still share the row." },
  ] },
  { v: "2026-11-24.43", title: { zh: "按钮统一成标准高度", en: "Buttons now share one standard height" }, items: [
    { k: "better", zh: "按钮标准高度：默认 40px、小号 34px（以前实际量出来 32 到 60px 都有），手机上小按钮的点按区域仍不小于 44px。", en: "Standard button heights: 40 px default, 34 px small (it used to range from 32 to 60 px); small buttons still keep a 44 px tap area on phones." },
    { k: "better", zh: "新增按钮条规则：一个按钮靠右；两个按钮取消靠左、保存靠右（下一版起逐页换上）。", en: "New button-row rule: one button on the right; with two, Cancel on the left and Save on the right (rolled out page by page from the next version)." },
  ] },
  { v: "2026-11-24.42", title: { zh: "交易清单做完后能直接完成；税务买入价取自交易", en: "Finish a deal from the checklist; tax uses the deal purchase price" }, items: [
    { k: "better", zh: "总进度卡片右上角的 ⋯ 菜单加了「完成交割 / 已提车 / 退出向导」；清单全做完时卡片里也会提示并带完成按钮。", en: "The ⋯ menu on the progress card now has Complete closing / Picked up / Exit wizard; when every item is done the card also prompts you." },
    { k: "fix", zh: "交易清单里「 · 」隔开的说明，一段中文太长时不再撑出屏幕，会在段内换行。", en: "In deal checklists, a long Chinese segment between “ · ” separators no longer runs off the screen; it wraps." },
    { k: "better", zh: "税务 → 买卖：买入价在房屋记录还没有时，先用买入交易里填的价格，并标明来源。", en: "Tax → Sales: if the property has no purchase price yet, the price from the buy deal is used and the source is shown." },
    { k: "better", zh: "「买入时收到的退款」的「从收入记录里选」现在直接带搜索，去掉了单独的「按金额 / 日期找」；这一页的按钮也调矮了。", en: "Credits at purchase: “Pick from income records” now has search built in; the separate “Find by amount / date” button is gone, and buttons on this page are shorter." },
  ] },
  { v: "2026-11-24.41", title: { zh: "共用控件样式整理：箭头、行、选项搬进共用样式表", en: "Shared control styles tidied: arrows, rows and options moved into the shared stylesheet" }, items: [
    { k: "better", zh: "箭头、记录行、可选项、底部弹窗变量和数字框的样式搬进 shared/ui.css，界面不变。", en: "Arrow, row, option, sheet-variable and number-field styles moved into shared/ui.css; the interface looks the same." },
  ] },
  { v: "2026-11-24.40", title: { zh: "交易页更整齐：买入 / 卖出各一个卡片，详情右上角有 ⋯ 菜单", en: "Tidier deals page: Buy / Sell cards, and a ⋯ menu on deal details" }, items: [
    { k: "better", zh: "买入、卖出各自一个卡片：标题、说明、最近一笔、按钮和展开的历史都在里面；「查看历史」靠左，「记录…交易」靠右。", en: "Buy and Sell are now one card each: title, description, latest deal, buttons and the expanded history. “View history” on the left, “Record…” on the right." },
    { k: "better", zh: "交易详情的总进度卡片右上角加了 ⋯ 菜单：已取消的可以恢复 / 删除，进行中和已完成的可以取消，都能回到交易首页。历史行上的已取消交易只保留「恢复」。", en: "The progress card on deal details has a ⋯ menu: restore / delete for cancelled deals, cancel for open or completed ones, and back to the deals home. Cancelled rows in history keep only “Restore”." },
    { k: "fix", zh: "事项编辑页的「取消 / 保存」不再套一层灰底边框。", en: "The task edit page no longer wraps “Cancel / Save” in an extra grey box." },
  ] },
  { v: "2026-11-24.39", title: { zh: "交易页：查看历史、恢复和删除，去掉单独的买入 / 卖出页", en: "Deals: view history, restore and delete; no separate Buy / Sell pages" }, items: [
    { k: "better", zh: "每一类交易旁边多了「查看历史」按钮，点开能看到全部已完成和已取消的交易（从近到远）。", en: "Each deal type now has a “View history” button listing all completed and cancelled deals, newest first." },
    { k: "better", zh: "已取消的交易可以「恢复」（变回进行中）或「删除」，交易详情里也有这两个按钮。", en: "Cancelled deals can be restored (back to in progress) or deleted, also from the deal details page." },
    { k: "better", zh: "不再有单独的「买入交易页 / 卖出交易页」，统一回到交易首页。", en: "The separate Buy and Sell pages are gone; everything goes back to the deals home." },
    { k: "fix", zh: "交易事项的编辑页，底部只剩「取消 / 保存」一行；标题很长时，「编辑」按钮也固定在右上角。", en: "On the task edit page only one “Cancel / Save” row remains; the Edit button stays top-right even for long titles." },
  ] },
  { v: "2026-11-24.38", title: { zh: "税务：报税累计默认折叠，内容更简洁", en: "Tax: the year income summary is folded by default and simpler" }, items: [
    { k: "better", zh: "「收入报税累计」默认折叠；展开后第一行是「要报的收入合计（不含工资）」。", en: "The income summary is folded by default; open it to see “Reportable income (excluding wages)” first." },
    { k: "better", zh: "下面按 工资、投资收益、租金、副业 / 稿酬、看情况、一般不用报、亲友赠与 各一行，显示小计，点开才看明细。", en: "Below, one row each for wages, investment, rent, side income, maybe, usually not reportable and gifts, with subtotals; tap to see details." },
  ] },
  { v: "2026-11-24.37", title: { zh: "交易页：买入、卖出各自成一块，历史交易折叠", en: "Deals page: Buy and Sell are now their own sections, history is folded" }, items: [
    { k: "better", zh: "每一块标题写明有几笔交易；没有交易就只有「记录买入 / 卖出交易」按钮；有交易先显示进行中的一笔，没有进行中的显示最近一笔。", en: "Each section shows how many deals it has. No deals: just a “record buy/sell deal” button. Otherwise it shows the open deal, or the latest one." },
    { k: "better", zh: "其余交易折叠成「其他交易」，展开后按日期从近到远，点一行看详情。", en: "Other deals fold into “Other deals”, newest first; tap a row for details." },
    { k: "better", zh: "只有「已取消」的交易能删除；已交割的先点「取消」再删除。", en: "Only cancelled deals can be deleted; completed ones must be cancelled first." },
  ] },
  { v: "2026-11-24.36", title: { zh: "修正：家庭成员页顶部路径重复", en: "Fix: duplicated path at the top of family member pages" }, items: [
    { k: "fix", zh: "设置 → 家庭与成员 → 某位成员的页面，顶部原来有两行路径和一个「‹ 返回」；现在合并成一行「我的 / 设置 / 家庭与成员 / 姓名」。", en: "Family member pages had two path rows and a “‹ Back” button. They are now one row: Me / Settings / Family & members / Name." },
  ] },
  { v: "2026-11-24.35", title: { zh: "收入详情：关联了房产会显示在「账户与归属」里", en: "Income details: a linked property now shows under “Account & owner”" }, items: [
    { k: "better", zh: "收入详情页的「账户与归属」多了「关联房产」一行，点一下直接去那套房产。", en: "The “Account & owner” block on an income record now shows the linked property; tap it to open that property." },
  ] },
  { v: "2026-11-24.34", title: { zh: "修正：手机上报税页「名称：内容」被居中了", en: "Fix: label-and-value rows on the tax page were centred on phones" }, items: [
    { k: "fix", zh: "手机上，报税和详情页里「名称」和「内容」上下排列的行，上一版误成了居中；现在恢复靠左对齐。电脑上不受影响。", en: "On phones, the stacked label-and-value rows on the tax and detail pages had become centred in the last update. They are left-aligned again; desktop is unchanged." },
  ] },
  { v: "2026-11-24.33", title: { zh: "底部弹出的面板支持键盘：Esc 关闭，Tab 不会跑到背后", en: "Bottom panels now work with the keyboard: Esc closes, Tab stays inside" }, items: [
    { k: "better", zh: "「属于哪位家庭成员」选人面板可以按 Esc 关闭；长按菜单和选人面板打开后，Tab 键只在面板里切换，关闭后焦点回到原来的位置。", en: "The “which family member” panel closes with Esc. In it and in the long-press menu, Tab now stays inside the panel, and focus returns to where it was when the panel closes." },
    { k: "better", zh: "读屏软件打开面板时会直接读出面板名字。", en: "Screen readers announce the panel name as soon as it opens." },
  ] },
  { v: "2026-11-24.32", title: { zh: "清理了一批不再使用的旧样式", en: "Removed a batch of unused old styles" }, items: [
    { k: "better", zh: "删掉了已经没有页面在用的旧样式（约 50 行），页面外观没有变化，加载的样式文件略小一点。", en: "Removed old styles that no page uses any more (about 50 lines). Pages look the same and the style file is slightly smaller." },
  ] },
  { v: "2026-11-24.31", title: { zh: "这一版没有界面变化", en: "No visible changes in this version" }, items: [
    { k: "better", zh: "整理了一份控件说明文档，记录每个控件怎么用；日期框和搜索框检查过，已经是统一的，没有改动。", en: "Added a reference document for the shared controls. Date and search boxes were checked and were already consistent, so nothing changed." },
  ] },
  { v: "2026-11-24.30", title: { zh: "底部弹出的面板外观统一", en: "Bottom pop-up panels share one look" }, items: [
    { k: "better", zh: "长按菜单、「属于哪位家庭成员」选人面板，和手机上从底部弹出的对话框，圆角、遮罩深浅、阴影用同一套数值；面板内边距和标题字号也对齐。", en: "Long-press menus, the “which family member” panel and the dialogs that slide up from the bottom on phones now share corner radius, backdrop darkness and shadow; padding and title size are aligned too." },
    { k: "better", zh: "长按菜单和选人面板略高一点（最高占屏幕 88%），选项多时能多看几行。", en: "Long-press and picker panels can be a little taller (up to 88% of the screen), showing more rows when there are many options." },
  ] },
  { v: "2026-11-24.29", title: { zh: "下拉选项、目录项、弹窗选项的点按外观统一", en: "Dropdown, menu and pop-up options share one tap style" }, items: [
    { k: "better", zh: "可搜索下拉的选项、目录面板的条目、底部弹窗（长按菜单、选人）里的选项，高度都不低于 44px，悬停、键盘选中和当前项的底色一致。", en: "Options in searchable dropdowns, contents-panel entries and bottom-sheet options (long-press menus, picking a person) are all at least 44px tall, with the same hover, keyboard and current-item colours." },
    { k: "better", zh: "可搜索下拉里的选项从 40px 提到 44px，列表略长一点；目录里当前所在的一项底色改成和下拉一致的浅绿。", en: "Options in searchable dropdowns grow from 40px to 44px, so the list is a little longer; the current item in the contents panel now uses the same light green as dropdowns." },
  ] },
  { v: "2026-11-24.28", title: { zh: "菜单、任务、详情等列表行也换成统一外观", en: "Menu, task and detail rows share the same look too" }, items: [
    { k: "better", zh: "设置 / 财务等菜单行、任务和模板行、债务行统一成实线分隔、行高不低于 56px；报税和详情页的「名称：内容」行统一成不低于 44px，原来的上边线改为下边线。", en: "Menu rows, task and template rows and debt rows use a solid divider and at least 56px; the label-and-value rows on tax and detail pages are at least 44px, with the divider moved from above to below." },
    { k: "better", zh: "扫描结果和摊派记录这类带边框的卡片行用同一种边框和圆角；弹出菜单里的选项高度从 40px 提到 44px，更好点。", en: "Bordered card rows (scan results, assessments) share one border and corner radius; options in pop-up menus grow from 40px to 44px so they are easier to tap." },
    { k: "better", zh: "任务和模板行原来的虚线改成实线，单行任务会比以前略高。", en: "Dashed dividers under task and template rows are now solid, and single-line tasks are slightly taller." },
  ] },
  { v: "2026-11-24.27", title: { zh: "库存和账单的列表行换成统一的外观", en: "Inventory and bill list rows share one look" }, items: [
    { k: "better", zh: "库存行、账单行（含「全部账单」和买卖交易里的账单）用同一种实线分隔，行高不低于 56px，最后一行不再多画一条线。", en: "Inventory rows and bill rows (including All bills and bills inside a transaction) use the same solid divider, a minimum height of 56px, and no extra line under the last row." },
    { k: "better", zh: "库存行的最小高从 64px 调到 56px，列表更紧凑一点；账单行原来的虚线改成实线。", en: "Inventory rows go from 64px to 56px minimum for a slightly tighter list; the dashed line under bill rows is now solid." },
  ] },
  { v: "2026-11-24.26", title: { zh: "全站的展开 / 进入箭头统一了", en: "Expand and go arrows are now consistent everywhere" }, items: [
    { k: "better", zh: "菜单、卡片、可展开的区块上的「›」和「▾」箭头统一成同一套大小、颜色和转动动画；今日页卡片上的箭头从 18px 调到 20px，和别处一致。", en: "The › and ▾ arrows on menus, cards and expandable sections share one size, colour and rotation. Arrows on Today cards grow from 18px to 20px to match the rest." },
    { k: "better", zh: "搜索框在 iPhone 上和其他输入框同样的圆角和边框。", en: "Search boxes on iPhone now have the same corners and border as other inputs." },
  ] },
  { v: "2026-11-24.25", title: { zh: "全站的金额、数量、天数框都换成统一写法", en: "All amount, quantity and day boxes now share one setup" }, items: [
    { k: "better", zh: "其余表单里的数字框（约 120 个）也按统一规则输入：金额两位小数、天数整数、利率按百分比，手机上都弹数字键盘，数字等宽对齐。", en: "The remaining number boxes in all other forms (about 120) now follow the same rules: two decimals for money, whole numbers for days, percentages for rates, a numeric keypad on phones and even-width digits." },
    { k: "better", zh: "每个框原来的最小值、最大值、步长都保留，不会多出新的限制；外观和大小不变。", en: "Each box keeps its original min, max and step, so no new limits appear; look and size are unchanged." },
  ] },
  { v: "2026-11-24.24", title: { zh: "金额、天数框统一了写法（先从账单、贷款、收入三张表单开始）", en: "Amount and day boxes now share one setup (bills, loans, income forms first)" }, items: [
    { k: "better", zh: "账单、贷款、收入表单里的金额、利率、天数框，输入规则统一（金额两位小数、天数整数），数字用等宽字体，位数更整齐。", en: "Amount, rate and day boxes in the bill, loan and income forms follow the same rules (two decimals for money, whole numbers for days) and use even-width digits." },
    { k: "better", zh: "外观和输入框大小不变；其他表单会陆续换过来。", en: "Look and size are unchanged; other forms will follow." },
  ] },
  { v: "2026-11-24.23", title: { zh: "数字框点进去会整段选中，直接输入就覆盖", en: "Number boxes select everything on focus, so typing replaces it" }, items: [
    { k: "better", zh: "金额、天数这类数字框，不管是 0 还是原来有数（比如 12.50），点进去都会整段选中，直接输入新数就行；不输入就离开，原值不变。", en: "In amount and day-count boxes, whether the value is 0 or an existing number like 12.50, tapping in selects all of it so typing replaces it. Leave without typing and the value is unchanged." },
    { k: "better", zh: "想改其中某一位，再点一下数字就能放光标。所有表单一起生效。", en: "To edit one digit, tap the number again to place the cursor. Applies to every form." },
  ] },
  { v: "2026-11-24.22", title: { zh: "金额框里是 0 时，点进去直接输入就行", en: "Tap an amount box showing 0 and just type" }, items: [
    { k: "fix", zh: "金额、天数这类数字框，原来显示 0 或 0.00 时，输入 9 会变成 09 或 0.009；现在点进去会自动选中这个 0，直接输入就覆盖掉。", en: "In amount and day-count boxes showing 0 or 0.00, typing 9 used to give 09 or 0.009. Now the 0 is selected on focus, so typing replaces it." },
    { k: "better", zh: "不是 0 的值不会被选中，想在原来的数上改还是照常。所有表单一起生效。", en: "Non-zero values are not selected, so editing an existing number works as before. Applies to every form." },
  ] },
  { v: "2026-11-24.21", title: { zh: "「创建贷款」可以用刚识别的 Closing Disclosure 预填", en: "“Create loan” can be pre-filled from the Closing Disclosure you just read" }, items: [
    { k: "new", zh: "用文件自动填读到贷款金额、利率、期限、月供后，交易清单上的「创建贷款」会直接预填这些（月供 = 本金利息 + Escrow），你再核对一下就能保存。", en: "After auto-fill reads the loan amount, rate, term and payment, “Create loan” on the transaction checklist is pre-filled with them (payment = principal & interest + escrow) for you to double-check and save." },
    { k: "better", zh: "没读过文件时和以前一样：本金按成交价 − 定金估。识别结果只在当前页面有效，刷新后要重新识别。", en: "Without a document read it works as before: principal estimated as price − earnest money. A read lasts only for the current page session." },
  ] },
  { v: "2026-11-24.20", title: { zh: "交易信息可以用购房合同 / Closing Disclosure 自动填", en: "Transaction details can be auto-filled from the contract / Closing Disclosure" }, items: [
    { k: "new", zh: "交易信息页多了「用文件自动填」：拍或截图购房合同、Closing Disclosure、结算单（买车是购车协议），AI 读出合同日、交割日、价格、定金、贷款行、产权公司、经纪人、律师等，先列出来给你核对，再写入。", en: "The transaction details page has an auto-fill: photograph or screenshot the contract, Closing Disclosure or settlement statement (bill of sale for vehicles). The AI reads dates, price, deposit, lender, title company, agent and attorney and shows them for you to check before anything is saved." },
    { k: "new", zh: "现在没填的默认勾上；和现有不同的默认不勾，要改请自己勾；一致的只做提示。文件里有贷款金额就判为贷款，写明现金就判为现金，清单跟着变。", en: "Empty fields are ticked by default; ones that differ from what you have are not, so you decide. Matching ones are just shown. A loan amount means loan, \"cash\" means cash, and the checklist follows." },
    { k: "better", zh: "图片只发给你选的 AI 服务商、不保存，发之前会先问你；没设 AI 或所选服务商不能读图时按钮灰掉并说明。", en: "Images go only to the AI provider you chose and are not stored, and you are asked first. Without an AI key, or with a provider that cannot read images, the button is greyed out with a note." },
  ] },
  { v: "2026-11-24.19", title: { zh: "买卖交易可以选「付款方式」：现金 / 贷款，清单跟着变", en: "Buy / sell transactions have a payment method: cash or loan, and the checklist follows" }, items: [
    { k: "new", zh: "买入、卖出、买车、卖车多了「付款方式」（贷款 / 现金；卖出时是买家的付款方式，可以不选，按贷款算）。交易主页总结卡片上一点就切换，交易信息里也能改", en: "Buy, sell, buy-a-car and sell-a-car have a Payment method (loan / cash; for a sale it is the buyer's, and may be left unset = loan). Switch it on the transaction home or in the info" },
    { k: "new", zh: "现金买入没有贷款预批、提交贷款材料、评估、贷款承诺（整个「贷款与评估」阶段不再出现），改成资金证明、电汇核实；买家现金的卖出没有「配合买方评估」，多一条「要买家资金证明」；买车同理。已经勾过的事项切换后仍保留", en: "A cash purchase drops loan pre-approval, loan documents, appraisal and the commitment (the whole Financing & appraisal stage disappears) and gains proof of funds and wire verification; a sale to a cash buyer drops the appraisal and adds asking for proof of funds; the same for cars. Steps you already ticked are kept" },
    { k: "better", zh: "现金交易的交易信息里不再显示贷款条款截止和贷款行，「创建贷款」也不提示；现金买车完成时车不会标成贷款中。已有的交易没有选付款方式，行为不变（按贷款）", en: "For cash deals the info hides the loan deadline and lender, and “Create loan” is not offered; a cash car purchase is not marked as financed. Existing transactions have no payment method set and behave as before (loan)" },
  ] },
  { v: "2026-11-24.18", title: { zh: "交易页的筛选和搜索，换成和其他明细页一样的格式", en: "Transactions: the same search + filter bar as the other lists" }, items: [
    { k: "new", zh: "计划、实际、对比和阶段页顶部是「搜索框 + 筛选」：可以搜事项名称 / 备注 / 进展记录的内容，再按完成情况、阶段、排序筛；手机上收成「搜索框 + 筛选」按钮，有筛选时按钮上显示个数，可一键清除", en: "Plan, Actual, Compare and stage pages have the usual “search + filters” bar: search task names, notes and progress notes, then filter by status, stage and sort; on phones it collapses to a search box and a Filters button with a count and a clear button" },
    { k: "better", zh: "搜索在输入停顿后生效，输入框保持焦点；对比视图里「清单之外」的进展记录也能被搜到", en: "Search applies after you pause typing and keeps focus; progress notes outside the checklist show up in Compare when they match" },
  ] },
  { v: "2026-11-24.17", title: { zh: "交易页：右下角 ＋，每个操作都是独立页面", en: "Transactions: a ＋ button, and every action is its own page" }, items: [
    { k: "new", zh: "交易主页右下角有圆形 ＋：添加自定义事项、记一笔进展、退出向导 / 完成交割、取消这笔交易；清单和阶段页的 ＋ 是添加自定义事项，计划 / 实际 / 对比页的 ＋ 是记一笔进展；已完成的历史交易只有前两项", en: "The transaction home has a round ＋: add a custom task, log progress, exit wizard / complete closing, cancel the transaction. On List and stage pages it adds a custom task; on Plan / Actual / Compare it logs progress. Past transactions only have the first two" },
    { k: "new", zh: "记一笔进展、修改进展、退出向导、完成交割、取消交易都是独立页面（有面包屑，底部取消 / 保存或确认），不再在原页面里就地展开；清单页里原来的「完成」行和「取消这笔交易」按钮挪进了 ＋", en: "Logging or editing progress, the exit wizard, completing and cancelling are now separate pages with breadcrumbs and Cancel / Save (or Confirm) at the bottom, instead of expanding in place; the old Complete row and Cancel button on the List page moved into the ＋" },
    { k: "better", zh: "事项和进展保存后回到你来的那一页；取消页、完成页手机上按钮整行宽", en: "After saving a task or a progress note you return to where you came from; confirm buttons are full width on phones" },
  ] },
  { v: "2026-11-24.16", title: { zh: "交易：交易信息 / 事项都有详情页，阶段里的事项变成行卡片", en: "Transactions: info and tasks get detail pages; tasks in a stage become row cards" }, items: [
    { k: "new", zh: "「交易信息」先是一张只读的详情卡，右上角「编辑」进表单，底部「取消 / 保存」，保存后回到详情", en: "“Transaction info” is now a read-only detail card; Edit opens the form with Cancel / Save at the bottom and returns to the details after saving" },
    { k: "new", zh: "阶段页里每个事项是一张行卡片：左边勾一下标完成，点卡片进事项详情（状态、日期、备注、说明；可编辑、跳过、删除自定义事项）", en: "Each task in a stage is a row card: tick the box to mark it done, tap the card for its details (status, dates, notes; edit, skip, delete a custom task)" },
    { k: "new", zh: "清单页和每个阶段页的最后一行是「添加自定义事项」行卡片，点进独立的添加页面（底部取消 / 保存），不再在原页面展开", en: "The last row of the List page and of every stage page is “Add a custom task”, which opens its own page (Cancel / Save) instead of expanding in place" },
  ] },
  { v: "2026-11-24.15", title: { zh: "交易页：少一层目录，清单 / 计划 / 实际 / 对比各是一个子页", en: "Transactions: one less level; List / Plan / Actual / Compare are now sub-pages" }, items: [
    { k: "new", zh: "首页点「卖出进行中」直接进这笔交易，不再多一层「卖出」目录页；只有 1 笔历史也直接进，多笔历史才进历史列表", en: "Tapping “Sale in progress” on the home page opens that transaction directly; a single past transaction opens directly too, several go to a history list" },
    { k: "new", zh: "交易主页：上面是只做统计的总结卡片（总进度、已完成、必须项、最近截止），下面是清单、计划、实际、对比四张带描述的行卡片，各进一个子页；原来的视图切换去掉了", en: "Transaction home: a summary card (progress, done, must-do, next due) and four described cards — List, Plan, Actual, Compare — each opening its own page; the view switcher is gone" },
    { k: "better", zh: "面包屑：房产 / 交易 / 卖出进行中 / 清单 / 交易信息", en: "Breadcrumbs: Home / Transactions / Sale in progress / List / Transaction info" },
  ] },
  { v: "2026-11-24.14", title: { zh: "买入和卖出可以同时进行（卖出进行中也能补录买入）", en: "Buy and sell can run at the same time (record a purchase while selling)" }, items: [
    { k: "new", zh: "一套房（或一辆车）同一时间可以有一笔进行中的买入和一笔进行中的卖出；同一类型还是只能一笔。卖出进行中，买入卡片上仍有「记录买入交易」，用来补录当初的买入", en: "A home (or car) can now have one buy and one sell in progress at the same time; a second one of the same kind is still not allowed. While selling, the Buy card still offers “Record purchase” so you can backfill the original purchase" },
    { k: "better", zh: "两笔同时进行时，房子状态以卖出优先显示「卖出中」；买入交割后仍是卖出中；取消卖出后，如果买入还在进行就变回「买入中」", en: "With both in progress the home shows “Selling”; closing the purchase keeps it Selling; cancelling the sale returns it to “Buying” if the purchase is still open" },
  ] },
  { v: "2026-11-24.13", title: { zh: "交易页重新整理：首页按类型分卡片，再往下才是详情", en: "Transactions page reorganised: one card per kind, details one level down" }, items: [
    { k: "new", zh: "房屋 / 车辆的「交易」首页改成一类一张卡片：买入、卖出（车辆：买车、卖车、归还；租房：退租）。没记过是空卡片和「记录…交易」按钮；进行中显示总进度和已完成；只有历史显示几笔和最近一笔", en: "The Transactions home is now one card per kind: buy and sell (vehicles: buy, sell, return; renting: move-out). Empty if nothing is recorded, with a “Record…” button; in progress shows overall progress; history shows the count and the latest one" },
    { k: "new", zh: "点卡片进这一类的子页：进行中那笔的入口 + 这一类的交易历史（一行一笔）；点进行中或某一行才进入交易详情（总进度、交易信息、各阶段清单）。原来挤在详情页底部的历史列表搬到了这里", en: "Tap a card for that kind: the in-progress entry plus its history, one row each; open the entry or a row to see the transaction details. The history list that used to sit under the details has moved here" },
    { k: "better", zh: "面包屑变成：房产 / 交易 / 买入 / 详情 / 子页；提醒和房屋页里的「进行中的交易」链接直接进详情", en: "Breadcrumbs: Home / Transactions / Buy / Details / Sub-page; alerts and house pages link straight to the details" },
  ] },
  { v: "2026-11-24.12", title: { zh: "花费 / 收入明细：按金额筛选", en: "Spending / income lists: filter by amount" }, items: [
    { k: "new", zh: "花费明细和收入明细的筛选里多了「金额」：全部金额（默认）、自定义、1000+、500–999、200–499、100–199、50–99、0–49；花费多一档「< 0」（退款 / 报销）", en: "Both lists have a new Amount filter: All amounts (default), Custom, 1000+, 500–999, 200–499, 100–199, 50–99, 0–49; spending also has “< 0” (refunds / reimbursements)" },
    { k: "new", zh: "选「自定义…」可以填最低和最高金额，只填一个也行；筛选后的笔数和合计一起变", en: "Choose “Custom…” to enter a minimum and/or maximum; counts and totals follow the filter" },
  ] },
  { v: "2026-11-24.11", title: { zh: "对账单导入：同一行不会再导入第二次", en: "Statement import: the same line is never imported twice" }, items: [
    { k: "new", zh: "每一行导入时会记一个「指纹」（账户尾号 + 日期 + 金额 + 描述）；同一份对账单再导入一次，或你改过金额 / 日期 / 分类之后再导入，已经导入过的行会被认出来，默认跳过", en: "Each imported line now gets a fingerprint (account last 4 + date + amount + description); importing the same statement again, even after you edited the amount, date or category, recognises the lines and skips them by default" },
    { k: "better", zh: "同一天有两条一模一样的流水不会被当成重复；没选账户时导入页会提醒防重复效果会差一些", en: "Two identical lines on the same day are not mistaken for duplicates; the import page warns that protection is weaker when no account is chosen" },
  ] },
  { v: "2026-11-24.10", title: { zh: "小票替换对账单整笔：少一次重复确认", en: "Replacing a statement line with a receipt: one fewer repeat confirmation" }, items: [
    { k: "better", zh: "录小票时，已经在小票上方提醒过的对账单整笔，不再在每一行下面重复提醒、也不再多要一次确认", en: "When a receipt matches a statement line, the note above the receipt is enough; the row-level duplicate warning and the extra confirmation are gone" },
    { k: "fix", zh: "英文界面的重复提示去掉了中文冒号；买卖页每套房的标题里，名字和「自住 / 出租」之间留出空隙", en: "English duplicate hints no longer use a Chinese colon; the home title on the Buy / sell page has a gap before “owner-occupied / rental”" },
  ] },
  { v: "2026-11-24.9", title: { zh: "修复：税务「从花费记录里选」打不开；小票查重更准；英文界面补全", en: "Fixes: Tax “pick from spending” would not open; better receipt matching; English strings filled in" }, items: [
    { k: "fix", zh: "税务 → 买卖与成本基础：「从花费记录里选」点了没反应（近几个版本），已修好", en: "Tax → Buy / sell: “Pick from spending records” did nothing in the last few versions; fixed" },
    { k: "fix", zh: "对账单导入认小票：一次拍了几张不同商店的小票时，以前会合成一张，合计对不上；现在按商店和日期分开", en: "Statement import: receipts from several stores scanned together used to be merged into one, so totals never matched; they are now split by store and date" },
    { k: "better", zh: "英文界面：新加的按钮和提示补上英文；查找 / 链接的按钮点按区域加大", en: "English UI: new buttons and hints now have English text; the find / link buttons have a bigger tap area" },
  ] },
  { v: "2026-11-24.8", title: { zh: "补录小票 / 缴费时，认出已经导入的对账单整笔", en: "Adding a receipt or payment now spots a statement line you already imported" }, items: [
    { k: "new", zh: "录入小票时，如果银行对账单里已经有一笔对得上的整笔（合计一样、商店对上），小票上方会提醒；选「用这张小票替换它」，确认入库后会删掉那一整笔，换成小票的明细，不会记两遍", en: "When you add a receipt and a matching whole-amount statement line already exists (same total, same store), a note appears above the receipt; choose “replace it with this receipt” and the statement line is removed once you confirm" },
    { k: "new", zh: "记账单缴费时，如果对账单里已经导入了对应的一笔，会问你要不要直接把它当作这次缴费，不再多记一笔花费", en: "When recording a bill payment and the matching statement line was already imported, you are asked whether to use it as this payment instead of adding another expense" },
  ] },
  { v: "2026-11-24.7", title: { zh: "对账单导入：认出已经记过的账单缴费", en: "Statement import: spot bill payments you already recorded" }, items: [
    { k: "new", zh: "对账单里的一笔，如果和你记过的账单缴费金额一样、收款方对得上（或日期相近），就当作已记录、默认不导入，写明对上的是哪笔缴费；医疗等一次性账单、房贷车贷的整笔缴费也能认出来", en: "A statement line that matches a bill payment you recorded (same amount, payee or nearby date) is skipped by default and shows which payment it matched; one-time (medical) bills and whole mortgage / car-loan payments are recognised too" },
    { k: "better", zh: "自动扣款常比你记的缴费日晚好几天入账，现在最多往后看 10 天；金额差一点（手续费）且收款方对上的，照常导入，只提醒「可能已记录过」", en: "Autopay often posts days after your recorded date, so up to 10 days later is now considered; if the amount is only slightly off and the payee matches, it is still imported with a “may already be recorded” note" },
  ] },
  { v: "2026-11-24.6", title: { zh: "对账单导入：认出已经按小票记过的花费", en: "Statement import: spot spending already entered from receipts" }, items: [
    { k: "new", zh: "对账单里的一整笔，如果和你已经记的某张小票（一行一个物品）合计对得上，商店也对得上，就当作已记录、默认不导入，并写明对上的是哪张小票；不是同一笔可以改成「仍然导入」", en: "A single statement line that matches the total of a receipt you already entered item by item (and the store matches) is treated as recorded and skipped by default, showing which receipt it matched; switch to “import anyway” if it is different" },
    { k: "better", zh: "合计只差一点（小费、折扣）且商店对上的，照常导入，只提醒「可能已按小票记录」；对账单选了卡的话，记在别的卡上的小票不会被当成同一笔", en: "If the total is only slightly off (tip, discount) and the store matches, it is still imported with a “may already be recorded” note; receipts paid with a different card are never treated as the same charge" },
    { k: "better", zh: "银行入账通常比消费日晚几天（pending），所以现在会往前多看 7 天的小票", en: "Banks often post a few days after the purchase (pending), so receipts up to 7 days earlier are now considered" },
  ] },
  { v: "2026-11-24.5", title: { zh: "税务买卖：按金额找收入、AI 识别查重", en: "Tax buy / sell: find income by amount, duplicate check for AI results" }, items: [
    { k: "new", zh: "「买入时收到的退款 / credit」多了「🔎 按金额 / 日期找」：填金额和大概日期（默认成交日），从所有收入记录里找出对得上的，勾选后链接，不用先给收入选房产", en: "“Refunds / credits at purchase” has “🔎 Find by amount / date”: enter an amount and rough date (defaults to closing day), pick from matching income records, and link — no need to tag income with a home first" },
    { k: "new", zh: "用 Closing Disclosure 自动填时，和清单里已有的项金额对上的会标出「很可能重复 / 金额相同」并默认不勾；不是同一笔再勾上", en: "When auto-filling from a Closing Disclosure, items whose amount matches an existing row are flagged “likely duplicate / same amount” and unticked by default; tick them if they are different" },
  ] },
  { v: "2026-11-24.4", title: { zh: "税务买卖清单：更好读、好找", en: "Tax buy / sell lists: easier to read and search" }, items: [
    { k: "new", zh: "页面右上多了「金额显示」眼睛：外出时金额模糊，单击露 10 秒", en: "New “amount display” eye on the page: amounts are blurred when you are out; tap to reveal for 10 seconds" },
    { k: "better", zh: "清单和「从记录里选」的框略深于背景；每行的日期、🔗、名称放在同一行，放不下才折行；最多显示约 6 行，多了可滚动", en: "Lists and the picker have a slightly darker box; date, 🔗 and name sit on one line (wrapping only if needed); about 6 rows show, then it scrolls" },
    { k: "new", zh: "记录多了（7 条以上）会出现搜索框和金额档位（全部金额、1000+、500–999…），快速定位", en: "With 7+ rows a search box and an amount filter (All, 1000+, 500–999…) appear for quick lookup" },
  ] },
  { v: "2026-11-24.3", title: { zh: "花费 / 收入明细：时间范围统一", en: "Spending / income lists: one time-range filter" }, items: [
    { k: "better", zh: "花费明细的时间范围里，「全部历史」和「自定义」排到最前面，默认仍是全部历史（默认时筛选计数为 0）", en: "In the spending list, “All time” and “Custom” now come first; default stays All time (filter count is 0 by default)" },
    { k: "better", zh: "收入明细把「全部年份 / 全部月份」两个下拉合并成和花费一样的一个时间范围：全部历史（默认）、自定义起止月份，以及本月、近几个月、某一年等", en: "The income list replaces the two “all years / all months” menus with the same single time range as spending: All time (default), Custom months, this month, recent months, a given year…" },
  ] },
  { v: "2026-11-24.2", title: { zh: "收入可以关联房产，税务里直接链接", en: "Income can link to a home; link it in Tax" }, items: [
    { k: "new", zh: "记收入时多了「关联房产」（可不填）：房产相关的报销 / 返还、credit、租金选上对应的房子", en: "Income records have an optional “Linked home”: pick the home for reimbursements, credits or rent" },
    { k: "new", zh: "税务 → 买卖与成本基础 →「买入时收到的退款 / credit」多了「🔗 从收入记录里选」：关联了这套房的收入直接带进来，不用手填金额", en: "Tax → Buy / sell: “Refunds / credits at purchase” has “🔗 Pick from income records”: income linked to this home comes in with its amount" },
  ] },
  { v: "2026-11-24.1", title: { zh: "邀请码加入：可以留话、申请财务权限", en: "Joining by invite code: leave a note, ask for finance access" }, items: [
    { k: "new", zh: "用邀请码加入时可以给家主留一句话，也可以勾选「我需要财务权限」；家主批准时能同时选「他是名册里的谁」和是否开财务权限", en: "When joining with an invite code you can leave the owner a note and tick “I need finance access”; the owner can pick who they are in the people list and grant finance access while approving" },
    { k: "new", zh: "加入以后，没有财务权限的家人可以在 设置 → 家庭 里随时申请、撤回；家主会收到提醒，一键同意或拒绝", en: "After joining, members without finance access can ask for it (or withdraw) in Settings → Family; the owner gets an alert and can approve or decline in one tap" },
    { k: "better", zh: "有了财务权限的家人可以自己关掉；打开只能家主同意", en: "Members can turn their own finance access off; only the owner can turn it on" },
  ] },
  { v: "2026-11-23.7", title: { zh: "税务：买卖清单可以链接花费记录", en: "Tax: link spending records into the buy / sell lists" }, items: [
    { k: "new", zh: "买卖与成本基础里，买入费用、装修翻新、卖出费用三张清单多了「🔗 从花费记录里选」：勾选这套房的花费，金额自动带进来，不用再手填", en: "In Buy / sell & cost basis, the closing-costs, improvements and selling-costs lists have “🔗 Pick from spending records”: tick this home’s spending and the amount comes in automatically" },
    { k: "better", zh: "链接的行金额跟着花费记录走（记录里改了这里也变）；记录被删了会标出来、不计入；点 × 只是解除链接，不会删花费记录", en: "Linked rows follow the spending record (edit it and the list updates); deleted records are flagged and not counted; × only unlinks, it never deletes the record" },
  ] },
  { v: "2026-11-23.6", title: { zh: "税务：按每笔借款判断算不算赠与", en: "Tax: each loan decides whether it counts as a gift" }, items: [
    { k: "new", zh: "标了「需要还」的赠与 / 电汇：关联的借贷填了「有书面借据」并有利息或还款计划，就按真借款处理，不计入赠与和 Form 3520；其余仍按赠与算", en: "Gifts or wires marked “must repay”: if the linked loan has a written note plus interest or a repayment plan it is treated as a real loan and left out of the gift and Form 3520 totals; the rest still count as gifts" },
    { k: "better", zh: "「工作收入」一组改成显示「到账 $X（报税以 W-2 为准）」，不再计入「要报的收入合计」；每条工资记录的小 i 先写明你记的是税后到账、不是应税工资", en: "The Employment group now shows “Take-home $X (file from the W-2)” and is left out of the taxable total; each pay item's i first says what you record is take-home pay, not taxable wages" },
    { k: "better", zh: "卡片底部的勾选框保留，取消勾选 = 整年都不算赠与；每笔下面会标是按赠与还是按借款算", en: "The box at the bottom of the card stays (untick = nothing counts as a gift that year); each item says whether it counts as a gift or a loan" },
  ] },

  { v: "2026-11-23.5", title: { zh: "借贷：亲友借款可以记「有没有借据」", en: "Loans: record whether a family loan has a written note" }, items: [
    { k: "new", zh: "亲友借贷多了「借款凭证」（有书面借据 / 口头约定 / 什么都没有）和「借据放在哪」，借贷列表里有小徽标显示有没有借据", en: "Family loans now have an Agreement field (written note / verbal / none) and a note on where the paper is kept, with a small badge in the loans list" },
    { k: "better", zh: "只是记录，借款余额和还款记录不变；下一步税务页会按这个判断一笔「借款」算不算正式借款", en: "Records only: balances and repayments are unchanged; next, the tax page will use this to decide whether a loan counts as formal" },
  ] },

  { v: "2026-11-23.4", title: { zh: "买房成本基础：closing 退款的提示更清楚", en: "Home cost basis: clearer note for closing refunds" }, items: [
    { k: "better", zh: "税务 → 买卖与成本基础 的「买入时收到的退款 / credit」写明：中介退回的佣金、title 退回的 closing 多收款、贷款方 credit 都记在这里，会降低成本基础，不是收入", en: "In Tax → Sales & cost basis, the “refunds / credits at purchase” step now says agent commission refunds, title refunds and lender credits go here: they lower the cost basis and are not income" },
    { k: "better", zh: "有退款时，结果下面会提示「closing 退款已调整成本基础」和扣掉的金额", en: "When there are refunds, the result shows a note with the amount deducted from the cost basis" },
  ] },

  { v: "2026-11-23.3", title: { zh: "小 i 提示改成文字右上角的角标，有大中小三种", en: "Info tips are now corner badges at the top-right of the text, in three sizes" }, items: [
    { k: "better", zh: "收入报税累计里所有的小 i，改成贴在文字右上角的小角标：不再单独占一格，整行都能点", en: "In the income-for-tax card every i is now a small badge at the top-right of its text: no separate slot, and the whole row stays clickable" },
    { k: "better", zh: "小 i 现在有小 / 中 / 大三种尺寸，也可以改回单独占位的圆形按钮；以后新页面默认用右上角角标", en: "The i comes in small / medium / large, and can still be a standalone round button; new pages default to the corner badge" },
  ] },

  { v: "2026-11-23.2", title: { zh: "税务：标了「需要还」的赠与 / 电汇也算进赠与累计", en: "Tax: gifts and wires marked “must repay” now count toward the gift total" }, items: [
    { k: "fix", zh: "税务上看实质：标了「需要还」（或关联了借贷）的个人赠与 / 国际电汇，默认也算进「收入报税累计」的亲友赠与和 Form 3520 合计", en: "Tax looks at substance: gifts and international wires marked “must repay” (or linked to a loan) now count in the family-gifts total and the Form 3520 total by default" },
    { k: "better", zh: "借贷里的还款记录、余额完全不变；真是正式借款的，在赠与那一组底部取消勾选就不算", en: "Loan balances and repayment records are untouched; for a genuine formal loan, untick the box at the bottom of the gifts group" },
  ] },

  { v: "2026-11-23.1", title: { zh: "税务「今年」：收入报税累计，每笔都有说明", en: "Tax · This year: income for tax, with a note on every item" }, items: [
    { k: "new", zh: "原来的「亲友赠与累计」改成「收入报税累计」：工资、投资、租金、副业 / 稿酬、看情况的入账、亲友赠与，按大类和收入类型分组，各有小计", en: "The family-gifts card is now “Income for tax”: wages, investments, rent, side work / honoraria, case-by-case items and family gifts, grouped with subtotals" },
    { k: "new", zh: "每一笔旁边有个小 i：为什么要报、TurboTax 在哪填、汇总页有没有这一项；对方不寄 1099 的稿酬 / 副业收入也会列出来；每个分类的说明收进分类旁的小 i，页面更清爽", en: "Every item has an i: why it is reportable, where to enter it in TurboTax and whether the summary page lists it; honoraria with no 1099 are included; each group's description sits behind its own i" },
    { k: "better", zh: "收入类型新增「稿酬 / 酬金」；汇总页多了「副业 / 稿酬收入」一行，车位 / 储藏间出租并进租金", en: "New income type “Honorarium / fee”; the summary page gets a Side work / honoraria row, and parking / storage rent now counts as rent" },
  ] },

  { v: "2026-11-22.25", title: { zh: "储藏概览重排：三张组别卡片 + 录入购物，底部问咩咩", en: "Pantry overview redesigned: group cards + Log shopping, Ask at the bottom" }, items: [
    { k: "new", zh: "概览最上面是仪表卡片：日常消耗品、汽车房屋消耗品、家居耐用品（缺货 / 少货 / 临期各几件，共几件），点一张进库存下对应的二级页；旁边多一张「录入购物」", en: "The top of the overview is now a row of cards: Everyday supplies, Car & home supplies and Home durables (out / low / expiring counts and the total), each opening its page under Inventory, plus a Log shopping card" },
    { k: "new", zh: "最下面是「问咩咩」：几个现成的问题（怎么安排采购、快过期的怎么吃、总缺货怎么办……），默认折叠，点开再问", en: "At the bottom, Ask: ready-made questions (plan the shopping, use up what is expiring, things that keep running out…), collapsed by default" },
    { k: "better", zh: "去掉概览底部原来的各组别列表，以及概览页右下角的「＋」（添加物品只在库存页保留）", en: "Removed the old group lists at the bottom of the overview and the + button there (adding items stays on the Inventory page)" },
  ] },

  { v: "2026-11-22.24", title: { zh: "储藏目录：库存下多了三个二级入口", en: "Pantry menu: three sub-pages under Inventory" }, items: [
    { k: "new", zh: "储藏的「目录」里，库存下面多了：日常消耗品、汽车房屋消耗品、家居耐用品（带要补货的件数）；点进去只看这一组，页面和库存首页一样，物品 / 分类两种视图都能用", en: "Under Inventory in the Pantry menu there are now Everyday supplies, Car & home supplies and Home durables (with restock counts); each opens just that group, with the same page and both Items / Categories views as the Inventory home" },
    { k: "better", zh: "页头路径跟着走：储藏 / 库存 / 日常消耗品，点「库存」回到全部", en: "The header path follows: Pantry / Inventory / Everyday supplies; tap Inventory to go back to all" },
  ] },

  { v: "2026-11-22.23", title: { zh: "买卖与成本基础：每一项都能记日期", en: "Sales & cost basis: every item can have a date" }, items: [
    { k: "better", zh: "买入费用、买入退款 / credit、装修翻新、卖出费用，每一项添加时都多一个「日期（可不填）」，清单里会把日期写在前面，方便和 closing 文件逐项对账", en: "Buying costs, buying refunds / credits, improvements and selling costs now each take an optional date when you add an item, shown first in the list so you can match them against your closing documents" },
    { k: "new", zh: "买卖与成本基础里的房子卡片，可以用买房的 Closing Disclosure 自动填（可选，也可以照旧手填）：拍 / 截图费用明细页，AI 读出买家付的每一项费用和 credit，先给你核对（能取消勾选、改金额），点「加进清单」才写进「买入时付的费用」和「退款 / credit」。房贷积分、贷款相关费用、预付和 Escrow 不计入成本基础，只列出来给你看", en: "The home card in Sales & cost basis can now be filled from your purchase Closing Disclosure (optional; manual entry still works): photograph or screenshot the cost-detail pages, the AI reads each fee the buyer paid and each credit, shows them for you to check (untick, edit amounts) and only Add to the list writes them into Buying costs and Refunds / credits. Mortgage points, loan fees, prepaids and escrow are not added to cost basis and are only listed for reference" },
    { k: "fix", zh: "清单里的 × 按钮缩小成正常大小（点按区域仍有 44px），「添加一项」「添加」「取消」改成正常大小的按钮；表单里的输入框不再越出边框，没有错误时不再留一块空白", en: "The × buttons are now a normal size (the tap area is still 44px), Add an item / Add / Cancel are normal-sized buttons, inputs no longer spill out of the form box and there is no blank gap when there is no error" },
  ] },

  { v: "2026-11-22.22", title: { zh: "买卖与成本基础：一步一步、一项一项填；不再自动折叠你正在填的房", en: "Sales & cost basis: step by step, one item at a time; no more collapsing the home you are filling" }, items: [
    { k: "fix", zh: "修复：每保存一次，页面会自动把第一套房折叠、展开第二套。现在展开 / 折叠记在页面里，你点开的房子保存后仍然开着", en: "Fixed: after every save the first home collapsed and the second opened. Open / closed is now remembered, so the home you opened stays open" },
    { k: "better", zh: "房子的卡片改成 ①→⑦ 一步一步：买入价（只读）→ 买入费用 → 买入退款 / credit → 装修翻新 → 卖出价（只读）→ 卖出费用 → 自住满 2 年 → 结果。费用、退款、装修都是一条条的清单，点「＋ 添加一项」才展开小表单（内容 + 金额，装修的日期可不填），一次加一项，每项右边有 ×", en: "A home card now runs step by step 1 to 7: purchase price (read-only) → buying costs → buying refunds / credits → improvements → sale price (read-only) → selling costs → lived 2 years → result. Costs, refunds and improvements are lists; tap Add an item to open a small form (description + amount, date optional for improvements), one item at a time, each with a ×" },
    { k: "fix", zh: "填写内容或金额漏了时，会在表单里直接写出原因（以前日期没填就悄悄点不了「添加」，不知道是哪个字段）；日期不再是必填", en: "A missing description or amount now shows the reason right in the form (before, a missing date silently disabled Add without saying which field); the date is no longer required" },
  ] },

  { v: "2026-11-22.21", title: { zh: "税务：买房时收到的退款 / 贷款方 credit 不算收入，冲减成本", en: "Tax: closing refunds and lender credits are not income, they reduce cost" }, items: [
    { k: "new", zh: "税务 → 买卖与成本基础：房子多了「买入时收到的退款 / 贷款方 credit」一栏，会从成本基础里减掉（以前只能记费用，退款没地方放）", en: "Tax → Sales & cost basis: each home has a new field for refunds / lender credits received at purchase, subtracted from the cost basis" },
    { k: "better", zh: "事件指南「买房」补了一条：closing 多收事后退款、贷款方 credit 一般不算收入；要向对方要书面说明并存好", en: "The Buying a home guide now explains that closing refunds and lender credits are generally not income and that you should get a written note and keep it" },
  ] },

  { v: "2026-11-22.20", title: { zh: "税务四期：汇总表导出、和去年对比、预缴税参考", en: "Tax phase 4: export the summary, compare with last year, estimated-tax reference" }, items: [
    { k: "new", zh: "税务 → 汇总：可以导出成 CSV（Excel 直接打开，带 TurboTax 里在哪填、来源、是否已核对、去年的数）或打印 / 存成 PDF", en: "Tax → Summary can be exported as CSV (opens in Excel, with where to enter it in TurboTax, origin, checked, prior-year value) or printed / saved as PDF" },
    { k: "new", zh: "每一行旁边小字显示去年的数和相差多少，一眼看出哪一项变化大", en: "Each row shows last year's value and the difference in small text, so big changes stand out" },
    { k: "new", zh: "预缴税参考（联邦，提醒级）：填本年预计税额和去年税额，按「本年 90% / 去年 100%（高收入 110%）取小」减去已扣和已缴的，算出还差多少、每期约多少。不是申报，规则待核对", en: "Estimated-tax reference (federal, reminder level): enter this year's expected tax and last year's tax and it works out the shortfall and the per-quarter amount using the lesser of 90% of this year or 100% of last year (110% for high income) minus withholding and payments made. Not a filing; verify the rules" },
  ] },

  { v: "2026-11-22.19", title: { zh: "税务三期：买卖与成本基础（卖房 / 卖车的收益参考）", en: "Tax phase 3: sales and cost basis (home / car sale gain reference)" }, items: [
    { k: "new", zh: "税务 → 买卖与成本基础：房子的成本基础 = 买入价 + 买入费用 + 装修翻新（你逐条记），收益 = 卖价 − 卖出费用 − 成本基础，自住满 2 年按合并报税排除 50 万美元后算应税收益；亏损的自住房提示不能抵税。出租房另给折旧年额参考（27.5 年，去掉土地）", en: "Tax → Sales & cost basis: a home's cost basis = purchase price + buying costs + improvements (you log them), gain = sale price − selling costs − basis, with the $500,000 joint exclusion when you lived there 2 years; losses on a home you lived in are flagged as not deductible. Rentals also get a yearly depreciation reference (27.5 years, land removed)" },
    { k: "new", zh: "已卖出的车：买入价、卖出价对比，亏损提示不能抵税；买卖价格来自 房屋 / 车辆 里已有的记录，装修、费用、住满与否记在税务页", en: "Sold cars: purchase vs sale price, with a note that a loss is not deductible; prices come from your Home / Vehicles records, while improvements, costs and the 2-year test are recorded on the Tax page" },
    { k: "fix", zh: "修复：金额遮挡开着时，税务页里的勾选框、按钮要点两下才有反应（第一下被当成「露出金额」）。现在税务页的金额只逐个遮挡，勾选和按钮一下就生效", en: "Fixed: with amounts hidden, checkboxes and buttons on the Tax pages needed two taps (the first was treated as revealing amounts). Amounts on Tax are now hidden one by one, so ticks and buttons work on the first tap" },
  ] },

  { v: "2026-11-22.18", title: { zh: "税务二期：数字汇总表、标准 / 逐项扣除对比、境外账户 FBAR 预判", en: "Tax phase 2: number summary, standard vs itemized comparison, FBAR check" }, items: [
    { k: "new", zh: "税务 → 汇总：这一年和报税有关的数字，按 TurboTax 的顺序排。自动算的来自你已有的记录（利息 / 股息 / 卖出收益 / 租金、房贷利息、房产税、预缴税、赠与累计）；工资、捐款、医疗、HSA / IRA / 401K 这些记录里没有来源的手填。每行有来源链接、TurboTax 里在哪填、「已核对」勾选", en: "Tax → Summary: this year's tax-related numbers in TurboTax order. Automatic ones come from your records (interest, dividends, sale gains, rent, mortgage interest, property tax, estimated payments, gifts); wages, donations, medical and HSA / IRA / 401K are typed in. Each row has a source link, where to enter it in TurboTax and a Checked tick" },
    { k: "new", zh: "标准扣除 vs 逐项扣除对比（合并报税）：逐项 = 房贷利息 + 房产税和州税（有上限）+ 捐款，和标准扣除比，告诉你哪个更划算（参考）", en: "Standard vs itemized deduction comparison (joint filing): itemized = mortgage interest + property and state tax (capped) + donations, compared with the standard deduction (reference)" },
    { k: "new", zh: "境外账户（可选）：在「账户与开户」里给境外账户打勾，汇总页按年内最高余额预判是否超过 FBAR 的 1 万美元线", en: "Foreign accounts (optional): tick them under Accounts & opening and Summary checks their year-high balances against the $10,000 FBAR line" },
  ] },

  { v: "2026-11-22.17", title: { zh: "税务：家庭情况按年度存快照", en: "Tax: household details are saved per year" }, items: [
    { k: "better", zh: "家庭情况（孩子人数、配偶证件、要打开的提醒）改成每个税务年度各存一份：2025 年 1 个孩子、2026 年 2 个互不影响；某年没单独存过就沿用上一年的，改任何一项才存成那一年自己的", en: "Household details (children, spouse ID, reminders) are now saved per tax year: one child in 2025 and two in 2026 do not affect each other; a year you have not saved reuses the previous year until you change something" },
    { k: "better", zh: "税务日历、单据清单、「容易漏的」和提醒都按那一年的快照来", en: "The tax calendar, document list, easy-to-miss tips and reminders all use that year's snapshot" },
  ] },

  { v: "2026-11-22.16", title: { zh: "通勤福利单独成账户类型；个人赠与标「赠与人」（需先执行两条数据库迁移）", en: "Commuter benefits become their own account type; gifts get a donor mark (two database migrations to run first)" }, items: [
    { k: "new", zh: "账户类型多了「通勤福利（公交 / 停车）」，和 FSA 分开，归在投资账户里；「FSA」类型名字恢复成「FSA 弹性支出」。需要先执行 supabase/migrations/102_commuter_kind.sql（只放宽类型清单，不动已有数据）", en: "New account type Commuter benefits (transit / parking), separate from FSA and listed under Investment accounts; the FSA type is back to “FSA”. Run supabase/migrations/102_commuter_kind.sql first (it only widens the type list, no data changes)" },
    { k: "new", zh: "收入里的「个人赠与」多了「赠与人是」：非美国人 / 美国人。税务页的赠与累计按它分：非美国人的才算 Form 3520 门槛，美国人的单列不算；没标的先按非美国人算并提示。可以同时勾「需要还」（个人用），统计里会单独说明其中标了需要还的金额。需要先执行 supabase/migrations/103_income_gift_donor.sql（只加一列）", en: "Gift income now asks who the donor is: non-US person or US person. The Tax gift total splits by it: only non-US donors count toward the Form 3520 threshold, US donors are listed separately, and unmarked ones count as non-US with a prompt. You can also tick Needs repaying for your own use; the card states how much of the total is marked that way. Run supabase/migrations/103_income_gift_donor.sql first (it adds one column)" },
  ] },

  { v: "2026-11-22.15", title: { zh: "税务：赠与累计的明细链接带上筛选，去掉 ＋", en: "Tax: gift total links carry their filter; removed the + buttons" }, items: [
    { k: "fix", zh: "「亲友赠与累计」里点「国际电汇」或「个人赠与」，收入明细现在会筛成这个类型和这一年（以前显示全部）", en: "Tapping International wire or Personal gift in the family-gifts total now opens the income records filtered to that type and year (it used to show everything)" },
    { k: "better", zh: "去掉每一项末尾的 ＋ 按钮；卡片里说明：美国境内的借款 / 赠与不在这里算，要私下还的记成「借款到账」", en: "Removed the + at the end of each line; the card now explains that loans or gifts inside the US are not counted, and one you will repay privately should be recorded as loan received" },
  ] },

  { v: "2026-11-22.14", title: { zh: "修复：财务目录里账户的数字都算到了「信用卡」一行", en: "Fix: Finance menu counted every account under Credit cards" }, items: [
    { k: "fix", zh: "财务 → 账户目录里，「信用卡」一行的数字原来是所有账户的总数，银行账户、投资账户、电子钱包与礼品卡三行没有数字。现在每一行只数自己那一类，「账户」分组的总数是这四行相加", en: "In the Finance → Accounts menu the Credit cards row showed the total number of all accounts while Bank, Investment and E-wallet rows had none. Each row now counts only its own kind, and the Accounts group total is the sum of the four" },
  ] },

  { v: "2026-11-22.13", title: { zh: "税务页改版：年份进筛选、家庭情况单独一页、赠与累计按类型汇总；账户统计问题", en: "Tax page redesign: year in the filter, Household on its own page, gifts totalled by type" }, items: [
    { k: "better", zh: "税务页去掉了页内标签条（页头的「目录」按钮已经能切换）；税务年度放进页头右边的「筛选」里", en: "Removed the in-page tab strip from Tax (the Menu button already switches pages); the tax year now lives in the Filter button" },
    { k: "better", zh: "家庭情况单独成一页（报税身份、配偶 ITIN、孩子人数、要打开的提醒），首页只放一张摘要卡，点右边的箭头进去改；长文字不再越出卡片", en: "Household is its own page (filing status, spouse ITIN, children, reminders); the home page keeps one summary card with an arrow, and long text no longer spills out of cards" },
    { k: "better", zh: "亲友赠与累计：不再排除「需要还」，「国际电汇」和「个人赠与」分开合计再加总（如 国际电汇 7.8 万 + 个人赠与 0.9 万 = 8.7 万），每一项点进去看明细，右边的 ＋ 直接按这个类型添加", en: "Family gifts: no longer excludes “needs repaying”; international wire and gift are totalled separately and added up, each line opens its records and the + adds a record of that type" },
    { k: "fix", zh: "账户概览里银行 / 投资账户的个数按账户本身数（以前按余额记录数，余额没读到时显示 0 个）", en: "Account counts for bank / investment accounts on the Accounts overview now count the accounts themselves (they used to count balance records and showed 0 when balances were not loaded)" },
  ] },

  { v: "2026-11-22.12", title: { zh: "电子钱包（Ventra、PayPal…）没有「返现规则」这一步了", en: "E-wallets (Ventra, PayPal…) no longer have a Rewards step" }, items: [
    { k: "better", zh: "添加电子钱包：类型 → 基本信息 → 备注 → 确认，去掉了「返现规则」（电子钱包本身没有返现）；信用卡和借记卡仍有返现规则", en: "Adding an e-wallet is now Type → Basics → Notes → Review without the Rewards step (e-wallets have no cash back); credit and debit cards keep it" },
    { k: "better", zh: "电子钱包的详情页也不再显示「返现规则」这一块（以前填过的数据还在，不会丢）", en: "An e-wallet's detail page no longer shows a Rewards block (anything entered earlier is kept)" },
    { k: "fix", zh: "电子钱包、银行 / 投资账户、礼品卡保存时返现一律记为 0（以前默认带着 1%，Ventra 会被当成 1% 返现的卡）；借记卡默认 0，信用卡默认 1%", en: "E-wallets, bank / investment accounts and gift cards now always save with 0% cash back (they used to carry a default 1%, so Ventra looked like a 1% card); debit cards default to 0, credit cards to 1%" },
    { k: "fix", zh: "修复：在 财务 → 投资账户点「添加 FSA / 通勤福利」，打开的表单类型是「礼品卡」。原因是上一次打开添加表单没保存的草稿被留下了，现在每次进添加页都从头开始", en: "Fixed: tapping Add FSA / commuter benefits under Finance → Investment accounts opened the form on Gift card, because an unsaved draft from an earlier visit was kept; each visit to an add page now starts fresh" },
    { k: "fix", zh: "添加账户时换类型，页头面包屑里的分组名和「添加 xxx」跟着变", en: "Changing the account type while adding now updates the group and “Add …” in the breadcrumb" },
  ] },

  { v: "2026-11-22.11", title: { zh: "税务：开账户前的提示和冲突检查（HSA + FSA、529、孩子账户）", en: "Tax: pre-opening notes and conflict checks (HSA + FSA, 529, child accounts)" }, items: [
    { k: "new", zh: "税务多了「账户与开户」页：自动检查 HSA 和普通医疗 FSA 是否冲突（自己的或配偶单位的都算），冲突时提醒「今日」；HSA、FSA / 通勤福利、529、孩子账户（Trump account / UTMA）、退休、券商、加密、储蓄各有一份开户前要先决定什么、税务怎么算、容易踩的坑", en: "Tax now has an Accounts & opening page: it checks whether an HSA conflicts with a general-purpose health FSA (yours or a spouse's) and reminds you in Today; HSA, FSA / commuter, 529, child accounts (Trump account / UTMA), retirement, brokerage, crypto and savings each get what to decide first, how it is taxed and common traps" },
    { k: "new", zh: "添加账户时选了 HSA / FSA / 529 / 孩子账户 / 退休 / 加密 / 券商，类型下面会出现一句税务提示，链到完整指南", en: "When you add an account of type HSA / FSA / 529 / child / retirement / crypto / brokerage, a one-line tax note appears under the type with a link to the full guide" },
  ] },

  { v: "2026-11-22.10", title: { zh: "新：财务 → 税务（参考用）；账户里加了通勤福利", en: "New: Finance → Tax (reference); commuter benefits in Accounts" }, items: [
    { k: "new", zh: "财务 → 分析 → 税务：税务日历（报税、预缴、单据到齐的日子）、每年的单据清单（勾已收到、记放在哪）、买卖房 / 车 / 股票和收到境外赠与等事件指南、知识库（W-2、1099、ITIN、标准扣除…）。参考用，不是报税软件，不存 SSN / ITIN / PIN", en: "Finance → Analysis → Tax: a tax calendar (filing, estimated payments, forms arriving), a yearly document checklist (tick received, note where), event guides for buying / selling a home, car or stocks and receiving foreign gifts, and a Learn section (W-2, 1099, ITIN, standard deduction…). Reference only, not tax software; never stores SSN / ITIN / PIN" },
    { k: "new", zh: "税务提醒进「今日」：报税 / 预缴截止临近、单据没收齐、境外亲友赠与累计接近 10 万美元（Form 3520 线）、年底税务检查", en: "Tax reminders appear in Today: filing / estimated deadlines, missing documents, foreign family gifts nearing $100,000 (the Form 3520 line), year-end tax check" },
    { k: "better", zh: "「FSA」账户类型改名「FSA / 通勤福利」：公交通勤福利账户记在这里；Ventra 交通卡记在电子钱包", en: "The FSA account type is now “FSA / commuter benefits”: record a transit commuter account there; the Ventra card itself goes under e-wallets" },
  ] },

  { v: "2026-11-22.9", title: { zh: "添加商店改成单独的页面", en: "Add shop is now its own page" }, items: [
    { k: "better", zh: "点「添加商店」进入单独的页面，分步填写、最后确认；不再在商店列表上展开表单。保存后直接进新商店的详情页", en: "Add shop opens its own page with the step-by-step flow and a final review, instead of unfolding a form on the shop list; after saving you land on the new shop" },
    { k: "fix", zh: "分步添加页面（商店、借贷、家庭成员）填写时，后台同步不会再把没保存的内容冲掉", en: "Background sync no longer wipes what you have typed on the step-by-step add pages (shop, loan, family member)" },
  ] },

  { v: "2026-11-22.8", title: { zh: "添加商店、添加家庭成员：分步填写，最后确认后才创建", en: "Add shop, add family member: step by step, created only after the final review" }, items: [
    { k: "better", zh: "添加商店（基本信息 → 特价更新）和添加家庭成员（基本资料 → 联系方式）也改成分步填写，最后一页「确认」列出全部信息，每一块带「编辑」，点「确认并创建」才真正建", en: "Adding a shop (Basics → Deal updates) and a family member (Profile → Contact) is now step by step; the last page lists everything with an Edit button on each block, and Confirm and create makes it" },
  ] },

  { v: "2026-11-22.7", title: { zh: "添加借贷：一步一页，最后确认后才创建", en: "Add loan: step by step, created only after the final review" }, items: [
    { k: "better", zh: "添加借贷改成一步一页（基本信息 → 金额与期限 → 还款安排 → 关联账户与资产 → 备注），最后一页「确认」列出全部信息，每一块带「编辑」，点「确认并创建」才真正建", en: "Adding a loan is now step by step (Basics → Amount & term → Repayment → Linked accounts & assets → Notes); the last page lists everything with an Edit button on each block, and Confirm and create makes it" },
    { k: "better", zh: "个人借贷（借给朋友 / 向朋友借）只有基本信息、金额与期限、备注三步", en: "Personal loans (to or from a friend) only have three steps: Basics, Amount & term, Notes" },
  ] },

  { v: "2026-11-22.6", title: { zh: "借贷、收入、花费、商店：详情页每一块的「编辑」只改这一块", en: "Loans, income, spending, shops: each block’s Edit now changes just that block" }, items: [
    { k: "better", zh: "收入、花费、商店详情页每一块右上角的「编辑」，现在打开的编辑页只显示这一块的字段（以前是整张表单，只是把光标放到那一块）", en: "On income, spending and shop details, a block’s Edit now opens a page with just that block’s fields (it used to open the whole form and only move the cursor)" },
    { k: "new", zh: "借贷详情页多了资料分块（基本信息、金额与期限、还款安排、关联账户与资产、备注），每块带「编辑」，只改这一块；个人借贷没有还款安排和关联两块", en: "Loan details now have blocks (Basics, Amount & term, Repayment, Linked accounts & assets, Notes), each with its own Edit; personal loans skip Repayment and Linked" },
    { k: "better", zh: "没改的字段原样保存，不会因为只编辑一块而丢掉别的内容", en: "Fields you did not touch are saved as they were, so editing one block never drops the rest" },
  ] },

  { v: "2026-11-22.5", title: { zh: "资产页：链接更准，名称直接点进去", en: "Assets page: better links, tap the name to open" }, items: [
    { k: "better", zh: "资产页每套房产、每辆车的「在房屋里打开」去掉了，名称本身就是链接（带下划线），点名称进入原记录", en: "Removed the “Open under Home” link on each property and vehicle in Assets; the underlined name itself now opens the record" },
    { k: "better", zh: "资产页顶上的链接：「房产列表」进房屋 / 房产，「管理车辆」改名「车辆列表」进房屋 / 车辆，「卡与账户」进财务 / 账户（不再只是信用卡）", en: "Assets page links: Properties opens Home / Properties, “Manage vehicles” is now Vehicles and opens Home / Vehicles, Cards & accounts opens Finance / Accounts (not just credit cards)" },
  ] },

  { v: "2026-11-22.4", title: { zh: "添加设备 / 工具：最后一步确认后才创建，每一块都能回头编辑", en: "Add equipment / tool: created only after the final review, every block editable" }, items: [
    { k: "better", zh: "添加设备和工具也改成一步一页，最后一页「确认」列出全部信息，每一块带「编辑」，点「确认并创建」才真正建好（和添加房产、车辆一致）", en: "Adding equipment and tools is now step by step too: the last page lists everything with an Edit button on each block, and Confirm and create makes it (same as adding a property or vehicle)" },
    { k: "fix", zh: "中途取消或退出，不会再自动存下一台只填了一半的设备", en: "Cancelling or leaving halfway no longer auto-saves a half-filled piece of equipment" },
  ] },

  { v: "2026-11-22.3", title: { zh: "添加车辆：最后一步确认后才创建，每一块都能回头编辑", en: "Add vehicle: created only after the final review, every block editable" }, items: [
    { k: "better", zh: "添加车辆改成一步一页，最后一页「确认」把整辆车的资料列出来，每一块带「编辑」，点「确认并创建」才真正建车", en: "Adding a vehicle is step by step; the last page lists every block with an Edit button, and Confirm and create finally makes the vehicle" },
    { k: "fix", zh: "中途取消或退出，不会再留下一辆只填了名字的车", en: "Cancelling or leaving halfway no longer leaves a vehicle with just a name behind" },
  ] },

  { v: "2026-11-22.2", title: { zh: "添加房产：最后一步确认后才创建，每一块都能回头编辑", en: "Add property: created only after the final review, every block editable" }, items: [
    { k: "better", zh: "添加房产改成一步一页，填的内容先只记在这一页里；最后一页「确认」把整套资料列出来，每一块带「编辑」，点「确认并创建」才真正建房产", en: "Adding a property is now step by step; nothing is saved until the last page, which lists every block with an Edit button, and Confirm and create finally makes the property" },
    { k: "fix", zh: "中途取消或退出，不会再留下一套只填了一半的房产", en: "Cancelling or leaving halfway no longer leaves a half-filled property behind" },
  ] },

  { v: "2026-11-22.1", title: { zh: "编辑 / 新建页的「取消 · 保存」统一：只在底部一条，取消靠左、保存靠右", en: "Edit / create pages: one Cancel · Save bar at the bottom, Cancel left, Save right" }, items: [
    { k: "better", zh: "编辑页顶上多出来的那一份「取消 / 保存」去掉了，只保留底部常驻的一条（长表单也不用滑到底）", en: "Removed the duplicate Cancel / Save bar at the top of edit pages; the bottom bar stays visible while you scroll" },
    { k: "better", zh: "所有表单的按钮条统一：取消靠左、保存 / 确认靠右、上一步 / 下一步在中间；按钮等宽排成一行，按钮越多字越小", en: "All form bars follow one layout: Cancel left, Save / Confirm right, Back / Next in the middle; equal widths on one row, smaller text when there are more buttons" },
    { k: "fix", zh: "房屋资料各分区、添加卡向导的按钮顺序改正（原来保存在前、取消在最右）", en: "Fixed button order on house profile sections and the add-card wizard (Save used to come first, Cancel last)" },
  ] },

  { v: "2026-11-21.26", title: { zh: "面包屑按层级补全：每一层都能点回上一层；有目录按钮就不要「返回」", en: "Breadcrumbs completed level by level: every level links to a real parent; no “Back” next to the Menu button" }, items: [
    { k: "fix", zh: "财务各页的路径补上「分组」这一层：财务 / 收支 / 收入 / 收支总览（点「收支」回到收支目录页）；账单、借贷、信用卡、账户、收入 / 花费详情和表单的路径同样补全（例如 财务 / 账户 / 投资账户 / 某个账户）", en: "Finance paths now include the group level: Finance / Money in & out / Income / Overview (tapping “Money in & out” opens that directory page); the same applies to bills, debts, cards, accounts and income / spending details and forms (e.g. Finance / Accounts / Investments / an account)" },
    { k: "fix", zh: "房屋各页的路径补上「房产」「汽车」目录页这一层：房屋 / 房产 / 某套房产 / 设备保养 / 某台设备；房屋 / 汽车 / 某辆车 / 保养记录；房产和车辆的账单、出了问题等页面也一样", en: "House paths now include the Houses / Cars directory pages: House / Houses / a property / Equipment / a device; House / Cars / a vehicle / Service log; bills and “Something's wrong” pages of properties and vehicles too" },
    { k: "better", zh: "页面上有「目录」按钮后，面包屑前面的「‹ 返回」去掉了（每一层本身就能点回上一层）；层级变长换行时只在「 / 」处断开", en: "With the Menu button present the “‹ Back” in front of the breadcrumb is gone (every level links to its parent); long paths wrap only at “ / ”" },
    { k: "fix", zh: "常用账单模板页的路径补上「周期性账单」这一层：财务 / 账单 / 周期性账单 / 常用账单", en: "The bill templates page path now includes Recurring bills: Finance / Bills / Recurring bills / Templates" },
  ] },

  { v: "2026-11-21.25", title: { zh: "深层页面也有「目录」按钮", en: "Deep pages get the Menu button too" }, items: [
    { k: "new", zh: "详情页、表单页和各种子页（车辆、账单、借贷、信用卡、收入 / 花费详情、商店详情、物品、成员…）原来只有「‹ 返回 …」面包屑，现在最前面多了一个「目录」按钮：打开是所在区域（财务 / 房屋 / 储藏 / 采购 / 我的）的同一棵目录，随时可以跳到别处；面包屑照旧保留", en: "Detail pages, forms and sub-pages (vehicles, bills, debts, cards, income / spending details, store details, items, members…) only had the “‹ Back …” breadcrumb; they now start with a Menu button that opens the same tree as its section (Finance / House / Storage / Shopping / Me), so you can jump anywhere; the breadcrumb stays" },
  ] },

  { v: "2026-11-21.24", title: { zh: "收尾：加入购物车的 ⋯ 并进目录；去掉重复的「其他功能」；清掉旧导航代码；补英文", en: "Clean-up: Add-to-cart ⋯ moves into the Menu; duplicate “More” rows removed; old navigation code removed; English filled in" }, items: [
    { k: "better", zh: "采购 → 加入购物车：页头右上角的 ⋯（扫描、补货提醒、买好了录入库存）取消，三项放进目录里「加入购物车」的下面", en: "Shopping → Add to cart: the ⋯ at the top right (Scan, Restock reminders, Log what I bought) is gone; the three items are under “Add to cart” in the Menu" },
    { k: "better", zh: "收入概览、花费概览、预算「本月」页底部那块「其他功能 / 更多」入口行去掉了（目录里都有）", en: "The “More” entry rows at the bottom of Income overview, Spending overview and Budget (this month) are gone (everything is in the Menu)" },
    { k: "better", zh: "清掉不再使用的旧导航代码（旧标签条、导航小卡片、一个每次画页面都会白跑的检测），页面略微更轻", en: "Removed unused old navigation code (the old tab strip, nav cards and a check that ran on every page draw), so pages are slightly lighter" },
    { k: "fix", zh: "补上 13 条缺少英文的文案（账户页的提示、「{n} 件待处理」「看花费明细」等）", en: "Added English for 13 strings that had none (account page hints, “{n} to handle”, “View spending details”…)" },
  ] },

  { v: "2026-11-21.23", title: { zh: "修买卖计划的路径", en: "Fix the Buy / sell plans path" }, items: [
    { k: "fix", zh: "买卖计划里的指南（我想买房 / 买车 / 卖房 / 卖车）和每个计划，路径原来写成「房屋 / 某套房产 / 买卖计划」，现在是「房屋 / 买卖计划 / 指南名」——买卖计划不属于哪一套房产", en: "The guides (I want to buy a home / buy a car / sell a home / sell a car) and each plan under Buy / sell plans showed the path “House / some property / Buy / sell plans”; it is now “House / Buy / sell plans / guide name” — plans don't belong to a particular property" },
  ] },

  { v: "2026-11-21.22", title: { zh: "财务四个一级目录页；采购下两页补上「目录」", en: "Four top-level Finance directory pages; two Shopping pages get the Menu" }, items: [
    { k: "new", zh: "财务首页变成四张入口卡片（分析、收支、账单、账户），点一张进它自己的目录页「财务 / 分析」等，里面一行一个页面；目录里点这四个一级入口也直接跳到对应的目录页，展开箭头才展开下一层", en: "The Finance home is four entry cards (Analysis, Money in & out, Bills, Accounts); each opens its own directory page (“Finance / Analysis”…) with one row per page; tapping those four sections in the Menu also jumps to the directory page, only the arrow expands the next level" },
    { k: "fix", zh: "采购 → 常去的商店 → 找附近的商店、更新记录：页头补上了「目录」按钮和「采购 / 常去的商店 / …」路径（原来漏换，还是旧的面包屑）", en: "Shopping → Favorite stores → Find nearby and Update log: the header now has the Menu button and the “Shopping / Favorite stores / …” path (they had been missed and still showed the old breadcrumb)" },
  ] },

  { v: "2026-11-21.21", title: { zh: "房屋目录重新设计：四个一级目录，房产和车辆各自往下分层", en: "House menu redesigned: four top-level sections, properties and cars each nest their own pages" }, items: [
    { k: "new", zh: "房屋首页变成四个入口：房产、汽车、买卖计划、注意事项，各自是独立的目录页（新增 房产 / 汽车 / 注意事项 三页；原来首页上的待办面板搬到「注意事项」页，旧的 ?todo= 链接照样能用）", en: "The House home page is now four entry cards — Houses, Cars, Buy / sell plans, Alerts — each its own directory page (new Houses, Cars and Alerts pages; the to-do board moved to “Alerts”, old ?todo= links still work)" },
    { k: "better", zh: "房屋的「目录」按这四个一级目录分层，点一级入口就跳到它自己的目录页，展开箭头才展开下一层", en: "The House menu follows the same four sections: tapping a section jumps to its own directory page, only the arrow expands the next level" },
    { k: "better", zh: "房屋下面是每一套房产，房产下面是它的概览 / 房屋资料 / 账单 / 季节任务 / 设备保养 / 交易；汽车下面是每一辆车，车下面也像房子一样分页：车辆概览 / 车辆资料 / 保养记录 / 保养时间表 / 账单 / 交易", en: "Under Houses is each property with its Overview / Profile / Bills / Tasks / Equipment / Deals; under Cars is each vehicle, which now has its own pages too: Overview / Profile / Service log / Schedule / Bills / Deals" },
    { k: "better", zh: "买卖计划下面直接列出四种指南（买房 / 买车 / 卖房 / 卖车）；待办与注意事项下面是四类（设备与车辆、季节任务、交易、耗材 · HOA · 保险）；买卖计划页也用同样的页头", en: "Buy / sell plans lists the four guides directly; To-dos and alerts lists the four categories; the plans page uses the same header" },
  ] },

  { v: "2026-11-21.20", title: { zh: "资产融资 / 个人借贷：筛选进页头，贷款行重新排版", en: "Asset financing / Personal lending: filters in the header, loan rows redesigned" }, items: [
    { k: "better", zh: "资产融资：状态、类型、排序挪进右上角的筛选按钮；搜索框和贷款行放在同一个容器里", en: "Asset financing: status, type and sort moved into the Filter button at the top right; the search box now sits in the same container as the loan rows" },
    { k: "better", zh: "个人借贷：搜索、方向、状态、排序都在右上角的筛选按钮里，下面只剩借贷行记录", en: "Personal lending: search, direction, status and sort are all in the Filter button; only the loan rows remain below" },
    { k: "better", zh: "贷款 / 借款每一行重新排版：第一行是名称（点进详情）· 最重要的金额 · ⋯，然后是标签，下面是整齐的两列（宽屏四列）小信息；⋯ 和长按（电脑右键）都是 详情 / 编辑 / 删除", en: "Loan and borrowing rows are re-laid out: name (opens details) · key amount · ⋯ on the first line, then tags, then a tidy two-column (four on desktop) grid of facts; ⋯ and long-press (right-click) both give Details / Edit / Delete" },
  ] },

  { v: "2026-11-21.19", title: { zh: "借贷三页：视图切换进页头，添加改成圆形 ＋", en: "Debts: view switch in the header, adding via the round ＋" }, items: [
    { k: "better", zh: "全部借贷、资产融资、个人借贷：「借入 / 借出」和「表格」两种视图改成页头右边的统一「切换」按钮（记在本机），页面里原来那两个小标签去掉了", en: "All debts, Asset financing and Personal lending: the “Borrowed / Lent” and “Table” views are now the shared switch button in the header (remembered on this device); the two small chips in the page are gone" },
    { k: "better", zh: "「添加贷款」「借出」「借入」按钮没有了，统一到右下角圆形 ＋（资产融资直接是 ＋，个人借贷点开选借出 / 借入）；页面里重复的标题行也去掉了", en: "The “Add loan”, “Lent” and “Borrowed” buttons are gone; adding is the round ＋ at the bottom right (a plain ＋ on Asset financing, a menu to pick Lent / Borrowed on Personal lending); the duplicate title rows are removed" },
    { k: "better", zh: "账单概览：去掉「统计范围：…」那句说明（时间范围和资产在右上角筛选里）", en: "Bills overview: the “Scope: …” sentence is gone (time range and asset are in the Filter at the top right)" },
  ] },

  { v: "2026-11-21.18", title: { zh: "房屋各页：「目录」按房产分层", en: "House pages: a Menu organised by property" }, items: [
    { k: "better", zh: "房屋首页、概览、房屋资料、季节任务、设备保养、交易、汽车房屋消耗品、车辆：页头统一成「[目录] 房屋 / 房产名 / 页面」；目录按房产分层（每套房产展开是它的概览 / 房屋资料 / 账单 / 季节任务 / 设备保养 / 交易），另有汽车；点另一套房产的页面直接切过去", en: "House home, Overview, House profile, Seasonal tasks, Equipment, Deals, Supplies and Vehicles share one header, “[Menu] House / property / page”; the menu is organised by property (each expands to its Overview / Profile / Bills / Tasks / Equipment / Deals), plus Cars; tapping a page of another property switches straight to it" },
  ] },

  { v: "2026-11-21.17", title: { zh: "「我的」各页：同一个「目录」", en: "My pages: one Menu" }, items: [
    { k: "better", zh: "我的首页、家里的数字、设置（每个分区）、介绍、发布日志：页头统一成「[目录] 我的 / 页面 / 分区」；目录里设置下面列着所有分区，打开就停在当前页；上面单独的一条路径取消了（家庭成员 / 家人详情仍带自己的路径）", en: "My home, Household numbers, Settings (every section), About and Release notes share one header, “[Menu] Me / page / section”; the menu lists every settings section and opens at the current page; the separate path bar is gone (member / person details keep their own path)" },
  ] },

  { v: "2026-11-21.16", title: { zh: "采购、购物车、常去的商店：同一个「目录」", en: "Shopping, Cart, Favorite stores: one Menu" }, items: [
    { k: "better", zh: "采购首页、购物车、加入购物车、常去的商店、特价一览：页头统一成「[目录] 采购 / 页面」；目录里「常去的商店」下面是商店列表、特价一览、找附近的商店、更新记录，购物车带没买的件数，打开就停在当前页", en: "Shopping home, Cart, Add to cart, Favorite stores and Deals share one header, “[Menu] Shopping / page”; the menu has Favorite stores → store list, deals, find nearby, update log, the cart shows the count still to buy, and it opens at the current page" },
  ] },

  { v: "2026-11-21.15", title: { zh: "储藏各页：导航小卡片换成「目录」按钮", en: "Storage pages: the navigation cards become a Menu button" }, items: [
    { k: "better", zh: "储藏每个页面顶上那排导航小卡片（概览 / 库存 / 菜单 / 录入购物）换成「目录」按钮，后面是路径「储藏 / 当前页」；库存的待补货件数在目录里；原来上面单独的一条路径取消了", en: "The row of navigation cards on every Storage page (Overview / Inventory / Menu / Log purchase) is now a “Menu” button followed by the path “Storage / current page”; the to-restock count is in the menu; the separate path bar above is gone" },
  ] },

  { v: "2026-11-21.14", title: { zh: "周期性账单卡片：第一行写明属于哪个资产", en: "Recurring bill cards: the first line says which asset it belongs to" }, items: [
    { k: "better", zh: "每张周期性账单卡片（清单里和详情页）最上面多了一行：属于哪个设备 / 车辆（🔧 🚗）、哪套房产（🏠），都没有就写「全家共用」；不用再靠账号尾号去猜", en: "Every recurring bill card (in the list and on the detail page) now starts with a line saying which device / vehicle (🔧 🚗) or property (🏠) it belongs to, or “Shared by the whole family” — no more guessing from the account digits" },
  ] },

  { v: "2026-11-21.13", title: { zh: "添加卡 / 账户改成分步向导 + 确认页；各账户页的取消、返回回到自己那一页", en: "Adding a card / account is now a step-by-step wizard with a review page; cancel and back return to the right page" }, items: [
    { k: "new", zh: "添加卡 / 账户改成一步一页：类型 → 基本信息 →（信用卡还有 还款 → 返现规则 → 开卡奖励 → 报销额度）→ 备注 → 确认；顶上显示第几步、进度条；回车 = 下一步", en: "Adding a card / account is one step per page: Type → Basics → (for credit cards also Repayment → Rewards → Sign-up bonus → Credits) → Notes → Review; the top shows the step and a progress bar; Enter = next" },
    { k: "new", zh: "最后一步是确认页：全部信息按块汇总，每一块有「编辑」回到对应那一步，核对无误再「确认并保存」", en: "The last step is a review page: everything grouped by section, each with an “Edit” button back to its step, then “Confirm and save”" },
    { k: "fix", zh: "投资 / 银行 / 钱包账户添加页上的取消、只读返回，原来都回到信用卡页，现在回到各自那一页；路径是「财务 / 投资账户 / 添加 某某账户」", en: "Cancel and read-only back on the add page of investment / bank / wallet accounts used to land on Credit cards; they now return to their own page, and the path reads “Finance / Investments / Add …”" },
    { k: "fix", zh: "收入 → 付款方、花费 → 收款方：搜索框下面的小提示拆成单独一行，不再把一长串字挤出边界", en: "Income → Payers and Spending → Payees: the small hint under the search box is now its own line so the long text no longer runs out of bounds" },
    { k: "better", zh: "账单明细：右上角的 ⋯ 和里面的功能（添加账单、批量标记已核对、导出 CSV）去掉了；添加账单用右下角的圆形 ＋", en: "Bills list: the ⋯ menu at the top right and its actions (Add bill, Mark as verified, Export CSV) are gone; add bills with the round ＋ at the bottom right" },
    { k: "better", zh: "账单概览：「时间范围」和「资产」两个下拉并进右上角的筛选按钮（带已改动的个数），页面顶上更清爽", en: "Bills overview: the “Time range” and “Asset” dropdowns moved into the Filter button at the top right (with a count of changed filters)" },
    { k: "better", zh: "花费 → 收款方：排序和「主要分类」并排放在搜索框右边，手机上收成统一的「筛选」按钮", en: "Spending → Payees: sort and “Main category” sit beside the search box and collapse into the shared Filter button on phones" },
  ] },

  { v: "2026-11-21.12", title: { zh: "修账户页路径和「保存余额」；收款方页和付款方页同一个玩法", en: "Fix account page path and “Save balance”; Payees works like Income payers" }, items: [
    { k: "fix", zh: "投资账户（HSA、401K…）、银行账户、钱包的详情 / 添加 / 编辑页，路径原来一律显示「信用卡」，现在是「财务 / 投资账户 / 名字」；添加或删除后回到所在的那一页", en: "Detail / add / edit pages of investment accounts (HSA, 401K…), banks and wallets always said “Credit cards” in the path; it now reads “Finance / Investments / name”, and add or delete returns to that page" },
    { k: "fix", zh: "账户详情页的「保存余额」点了没反应（净资产页的代码没加载）；现在能保存，资产页的「更新余额」也一样", en: "“Save balance” did nothing on account pages (the net-worth code was not loaded); it works now, and so does “Update balance” on the Assets page" },
    { k: "better", zh: "花费 → 收款方：「只看」（一级分类）挪进右上角的筛选按钮；行里的「走势」「改名 / 合并」和上面的「多选合并」「整理收款方」「撤销」「导出 CSV」都收进长按（电脑右键）菜单，和 收入 → 付款方 一样", en: "Spending → Payees: the “Only show” category filter moved into the Filter button; the row buttons (Trend, Rename / merge) and the tool buttons (Select to merge, Tidy, Undo, Export CSV) moved into the long-press (right-click) menu, like Income → Payers" },
  ] },

  { v: "2026-11-21.11", title: { zh: "卡与账户的行：图标缩小，和名称放在一行", en: "Card & account rows: smaller icon on the same line as the name" }, items: [
    { k: "better", zh: "信用卡、银行、投资、钱包、礼品卡的每一行：左边单独占一列的图标 / 卡组织标签缩小，挪到名称前面同一行，名称和说明有了更多空间", en: "On every card and account row the icon / card-network badge no longer takes its own column: it is smaller and sits right before the name, leaving more room for the name and details" },
    { k: "better", zh: "在别的页面里作为下拉选项出现的账户（付款账户、收入入账账户等），名称前面不再带图标", en: "Accounts shown as dropdown options on other pages (paying account, income account…) no longer carry an icon before the name" },
  ] },

  { v: "2026-11-21.10", title: { zh: "信用卡、银行、投资、钱包：添加账户统一到右下角圆形 ＋", en: "Cards, banks, investments, wallets: adding accounts is now the round + button" }, items: [
    { k: "better", zh: "银行账户、投资账户、电子钱包与礼品卡页底部那一排「＋ 某某账户」小标签没有了，统一成右下角的圆形 ＋（点开选账户种类）", en: "The row of “＋ account type” chips at the bottom of Banks, Investments and E-wallets & gift cards is gone — it is now the round ＋ at the bottom right (pick the account type)" },
    { k: "better", zh: "信用卡页：「添加信用卡」按钮改成圆形 ＋，页头的眼睛换成「筛选」按钮；「我的卡」放到最上面", en: "Credit cards: “Add credit card” is the round ＋, the header eye became the Filter button, and “My cards” comes first" },
  ] },

  { v: "2026-11-21.9", title: { zh: "修筛选条版面；预算的打印进目录；周期性账单换新页头", en: "Fix the filter bar layout; Budget’s Print moves into the Menu; Recurring bills gets the new header" }, items: [
    { k: "fix", zh: "电脑上账单明细、花费明细、借贷流水的筛选条里，「金额显示」的文字和说明摊在一行里把版面撑开；现在电脑上只留一个眼睛按钮，文字只在手机的筛选面板里出现", en: "On desktop the “Amounts” label and hint spilled into the filter row of Bills list, Spending records and Debt transactions and stretched the layout; now only the eye button shows there, the text only appears in the phone filter panel" },
    { k: "better", zh: "预算页的「打印」放进目录最下面的「本页操作」，⋯ 取消", en: "Budget’s “Print” moved into the bottom of the Menu (“This page”), and the ⋯ is gone" },
    { k: "better", zh: "账单概览里的「账单明细 ›」链接去掉（目录里就有）；周期性账单页换成和其他财务页一样的页头", en: "The “Bill list ›” link on Bills overview is gone (it is in the Menu); Recurring bills uses the same header as other Finance pages" },
  ] },

  { v: "2026-11-21.8", title: { zh: "财务各页同一个「目录」：财务 / 页面 / 页签，打开就停在当前页", en: "One Finance Menu on every Finance page: Finance / page / tab, opens right where you are" }, items: [
    { k: "new", zh: "财务下所有页面（收入、花费、预算、借贷、对账单、资产、账单概览 / 明细、账户各页、信用卡）顶上都是同一个「目录」按钮：点开是整个财务的目录，自动停在当前页，当前页签也展开", en: "Every Finance page now has the same Menu button: it opens the whole Finance map, already at the page you are on, with its tabs expanded" },
    { k: "better", zh: "页头路径合成一行：财务 / 收入 / 收支总览，每一段都能点；原来上面那条单独的路径取消了", en: "The path is now a single line in the header — Finance / Income / Overview — and every part is tappable; the separate path bar above is gone" },
  ] },

  { v: "2026-11-21.7", title: { zh: "财务首页改成四张大卡片，带「目录」按钮", en: "Finance home is now four big cards, with a Menu button" }, items: [
    { k: "better", zh: "财务首页分成四张大卡片：分析、收支、账单、账户；卡片头显示这一组要处理的总数，里面一行一个页面，点一下就进", en: "The Finance home is four big cards — Analysis, Money in & out, Bills, Accounts — each showing how many things need attention, with one row per page inside" },
    { k: "new", zh: "标题前面多了「目录」按钮：点开是整个财务的目录（组 → 页面 → 页内标签），下一版起每个财务页都有同一个", en: "A “Menu” button before the title opens the whole Finance map (group → page → tab); every Finance page gets the same one in the next version" },
    { k: "fix", zh: "资产、净资产、对账单这些页的 ⓘ 原来离标题有一段距离，现在和其他页一样紧贴标题最后一个字", en: "On Assets, Net worth, Statements and similar pages the ⓘ used to sit away from the title; it now hugs the last character like everywhere else" },
    { k: "better", zh: "「分析」里不再重复列「收支总览」（它是收入的第一页），现在只有资产和预算", en: "“Analysis” no longer lists Overview twice (it is Income’s first page) — just Assets and Budget now" },
  ] },

  { v: "2026-11-21.6", title: { zh: "标题旁的 ⓘ 变成右上角小角标", en: "The ⓘ next to titles becomes a small corner badge" }, items: [
    { k: "better", zh: "各页标题旁的 ⓘ 现在悬在文字右上角，像铃铛的提醒角标，不再占一个字的位置", en: "The ⓘ next to page titles now floats at the top-right of the text, like the bell badge, instead of taking up a character’s width" },
    { k: "new", zh: "新做了「嵌套目录」控件（组 → 页面 → 标签，打开就停在当前页），下一版先用在财务", en: "A new nested Menu control (group → page → tab, opens right at where you are) — Finance gets it next" },
  ] },

  { v: "2026-11-21.5", title: { zh: "商店页、账户页、账单页也换成目录 + 筛选", en: "Shops, Accounts and Bills pages get the Menu + Filter treatment too" }, items: [
    { k: "better", zh: "常去的商店、特价一览：导航小卡片换成标题前面的「目录」按钮，原来 ⋯ 里的「更新记录」放进目录，⋯ 取消；说明文字挪到标题下一行", en: "Shops and Deals: the navigation cards are now a “Menu” button before the title, “Update log” moved from the ⋯ menu into it (⋯ removed), and the description sits on its own line below" },
    { k: "better", zh: "账单概览、账户各页、周期性 / 一次性账单页：页头的眼睛换成最右的「筛选」按钮（里面是「金额显示」）；账单明细的眼睛在它自己的筛选条里", en: "Bills overview, account pages and recurring / one-time bills: the header eye is now a Filter button on the right (with “Amounts” inside); on the bills list the eye is in its own filter bar" },
    { k: "better", zh: "手机上各列表页的「筛选」按钮也带上同样的小图标", en: "On phones the Filter button on list pages now has the same small icon" },
  ] },

  { v: "2026-11-21.4", title: { zh: "花费、预算、借贷、对账单、资产页头：目录 + 筛选，和收入页一样", en: "Spending, Budget, Debts, Statements, Assets headers: Menu + Filter, like Income" }, items: [
    { k: "better", zh: "这几页顶上那排导航小卡片换成「目录」按钮（标题前面），时间范围等筛选收进最右的「筛选」按钮；标题改成「花费 / 概览」这样的路径，点前半截回第一页", en: "The navigation cards on these pages are now a “Menu” button before the title, time-range and other filters moved into the Filter button on the right; titles read like a path (“Spending / Overview”) and the first part goes back to the first page" },
    { k: "better", zh: "页头的眼睛并进「筛选」面板的「金额显示」；花费明细、借贷流水有自己的筛选条，眼睛就在那里面", en: "The header eye is now “Amounts” in the Filter panel; on Spending records and Debt transactions it lives in their own filter bar" },
  ] },

  { v: "2026-11-21.3", title: { zh: "收入页：目录按钮进标题行，眼睛并进筛选", en: "Income: Menu button joins the title row, the eye moves into Filter" }, items: [
    { k: "better", zh: "「目录」按钮不再单独占一行：放在标题「收入 / 收支总览」前面，筛选按钮在同一行最右", en: "The Menu button no longer takes its own row: it sits before the “Income / Overview” title, with the Filter button at the far right of the same row" },
    { k: "better", zh: "页头的眼睛没有了，并进筛选面板的「金额显示」：默认仍然遮挡，单击露 10 秒、双击或长按切到常显示，和以前一样；明细页的眼睛在明细自己的筛选里", en: "The eye in the header is now “Amounts” inside the Filter panel: still hidden by default, tap to show for 10 s, double-tap or long-press to keep shown, as before; on Records it lives in that page’s own filter" },
    { k: "fix", zh: "财务目录里点「收入」，现在进收支总览（原来直接进明细）", en: "Tapping “Income” in the Finance directory now opens the overview (it used to open Records)" },
  ] },

  { v: "2026-11-21.2", title: { zh: "收入页：新的「目录」按钮和筛选按钮并排", en: "Income: new Menu button next to the Filter button" }, items: [
    { k: "better", zh: "收入页顶上那排导航小卡片换成「目录」按钮（三条横线），靠左；点开选页面，当前页打 ✓；筛选按钮靠右，左边加了小图标", en: "The row of navigation cards on Income is now a “Menu” button (three lines) on the left; open it to pick a page, the current one is ticked; the Filter button sits on the right with a small icon" },
    { k: "better", zh: "「导出打印」从 ⋯ 菜单搬进目录，⋯ 取消；顶部路径「收入 / 页面名」随选择更新，点「收入」回到收支总览", en: "Export / print moved from the ⋯ menu into the Menu, and ⋯ is gone; the title path “Income / page” follows your choice, and tapping “Income” returns to the overview" },
  ] },

  { v: "2026-11-21.1", title: { zh: "卡片编号并进控制行：‹ 短划线 #3/21 ›", en: "Card number joins the control row: ‹ dashes #3/21 ›" }, items: [
    { k: "better", zh: "账单页的卡片编号不再单独占一行：直接显示在控制行里，短划线后面「#3/21」，滑动时跟着变；⚙ 里「显示卡片编号」仍可关", en: "The card number on the bills page no longer takes its own line: it sits in the control row after the dashes (“#3/21”) and updates as you swipe; the ⚙ “Show card numbers” switch still turns it off" },
    { k: "fix", zh: "版本号改回「当天日期 + 从 1 开始」（今天是 2026-11-21，之前误接着 11-20 往后排到 .41）", en: "Version numbers are back to “today's date + counter from 1” (today is 2026-11-21; they had wrongly kept counting on from 11-20 up to .41)" },
  ] },

  { v: "2026-11-20.41", title: { zh: "财务 → 账户：账户概览、信用卡、银行、投资、电子钱包与礼品卡各一页", en: "Finance → Accounts: overview, credit cards, banks, investments, e-wallets & gift cards" }, items: [
    { k: "new", zh: "「账户」组拆成五页：账户概览（四类账户一眼看：余额、数量、要更新的）、信用卡（原来的卡片、返现复盘、停用的默认折叠）、银行账户、投资账户、电子钱包与礼品卡", en: "The Accounts group is now five pages: Overview (four account types at a glance), Credit cards (cards, cash-back review, inactive folded), Bank accounts, Investment accounts and E-wallets & gift cards" },
    { k: "new", zh: "投资账户按用途分块：退休（401K / IRA）、教育（529）、孩子的投资账户（Trump account / UTMA）、医疗（HSA / FSA）、券商、加密货币；只记总值（在账户页「更新余额」，每月自动存快照），不记持仓和交易", en: "Investment accounts are grouped by purpose: retirement, education (529), kids’ accounts (Trump account / UTMA), health (HSA / FSA), brokerage and crypto; totals only (update the balance on the account page, monthly snapshots are automatic), no holdings or trades" },
    { k: "better", zh: "添加账户时多了四种类型：教育账户（529）、孩子的投资账户、FSA、加密货币账户；银行、礼品卡、电子钱包从信用卡页搬到各自的页面", en: "Four new account types when adding: Education (529), Kids’ investment, FSA and Crypto; banks, gift cards and e-wallets moved off the credit cards page into their own pages" },
  ] },

  { v: "2026-11-20.40", title: { zh: "收入 · 付款方：操作收进长按菜单", en: "Income · Payers: actions moved into the long-press menu" }, items: [
    { k: "better", zh: "付款方页面上的「走势」「改名 / 合并」「多选合并」「导出 CSV」按钮去掉了：长按一个付款方（电脑右键）→ 看收入明细 / 近 12 个月走势 / 改名·合并 / 多选合并 / 导出 CSV；多选合并进入后，勾选和「合并为」的操作条不变", en: "The Trend, Rename / merge, Select to merge and Export CSV buttons on the Payers page are gone: long-press a payer (right-click) → View income / 12-month trend / Rename·merge / Select to merge / Export CSV; once in merge mode the action bar works as before" },
  ] },

  { v: "2026-11-20.39", title: { zh: "每件物品可以手动设「采购方式」和「订阅周期」", en: "Set “How to buy” and a subscription interval per item" }, items: [
    { k: "new", zh: "物品编辑页多了「采购方式」（自动 / 线上订阅 / 批量 / 生鲜 / 其他）和「订阅 / 定期配送周期（天）」：购物车分组按你设的来，分错了改一次就记住；有周期的在购物车那一行写「约每 N 天」", en: "The item edit page has “How to buy” (Auto / Online / Bulk / Fresh / Other) and a subscription interval in days: the cart groups by what you set, fix a wrong group once and it sticks; items with an interval show “about every N days” in the cart" },
    { k: "better", zh: "需要先在数据库执行 supabase/migrations/100_item_buy_mode.sql（只给物品加两列）；没执行时物品其余保存照常，只会提示一句", en: "Run supabase/migrations/100_item_buy_mode.sql first (adds two columns to items); until then everything else saves normally and you just get one notice" },
  ] },

  { v: "2026-11-20.38", title: { zh: "财务目录重新分组：分析 · 收支 · 账单 · 账户", en: "Finance menu regrouped: Analysis · Cash flow · Bills · Accounts" }, items: [
    { k: "better", zh: "财务目录分成四组：分析（资产、收支总览、预算与计划）、收支（花费、收入、借贷、对账单）、账单（账单概览、账单明细、周期性账单）、账户（卡与账户）", en: "The Finance menu now has four groups: Analysis (Assets, Cash-flow overview, Budget & plans), Cash flow (Spending, Income, Loans, Statements), Bills (Overview, Bill details, Recurring bills) and Accounts (Cards & accounts)" },
    { k: "better", zh: "「全部账单」改名「账单明细」，「全部周期性账单」改名「周期性账单」", en: "“All bills” is now “Bill details” and “All recurring bills” is now “Recurring bills”" },
  ] },

  { v: "2026-11-20.37", title: { zh: "录入购物按钮条修复；展开后自动居中；库存「全部组别」；视图按钮矮一点", en: "Log shopping button bar fix; new sections scroll into view; Stock “All groups”; slimmer View button" }, items: [
    { k: "fix", zh: "录入购物手动添加的表单：顶部、底部的「取消 / 确认入库」又回到同一行（切换录入方式重画后会丢掉排版，现在会补回）", en: "Log shopping manual form: Cancel / Confirm at the top and bottom are on one row again (they used to lose their layout after switching the entry mode)" },
    { k: "better", zh: "点选后展开的新一块会自动滚到屏幕中间，手机上不用手滑往下找（录入购物先用上）", en: "A newly revealed section now scrolls to the middle of the screen, so you do not have to swipe down on a phone (Log shopping first)" },
    { k: "better", zh: "库存的范围下拉多了「全部组别」，物品视图默认就是它（一页看全部）；也可以选日常消耗品 / 汽车房屋消耗品 / 家居耐用品", en: "The Stock scope dropdown has “All groups”, the default in the item view (everything on one page); you can still pick one group" },
    { k: "better", zh: "所有页面的「视图」按钮矮了一点（和标题字一样高），点按区域仍是 44px", en: "The View button is slimmer on every page (same height as the title text) while the tap area is still 44px" },
  ] },

  { v: "2026-11-20.36", title: { zh: "购物车按采购方式分组，一页看完所有要买的", en: "Cart grouped by how to buy, everything on one page" }, items: [
    { k: "new", zh: "购物车默认按「采购方式」分成几组：线上订阅 / 网购（省钱）、批量采购（省时）、生鲜即买（保鲜，每周一次超市行程）；一页往下看完，不用切换；顶上一排小标签带数量，点一下跳到那一组，每组可折叠", en: "The cart is now grouped by how to buy: Online / subscribe (save money), Bulk (save time) and Fresh (stay fresh, one supermarket trip a week). One page, no switching; chips on top show counts and jump to a group, and each group can be folded" },
    { k: "better", zh: "分组按物品的分类自动推（生鲜、肉蛋奶、冷冻 → 生鲜；粮油干货、零食、饮品 → 批量；纸品清洁、个人护理、药品、母婴、宠物、房屋消耗品 → 线上订阅）；排序下拉里仍可换回「最近加入的在前」等", en: "Groups are inferred from each item's category; the sort dropdown still lets you switch back to Newest first and so on" },
  ] },

  { v: "2026-11-20.35", title: { zh: "录入购物：录入方式单独一块；手动添加的「记到哪里」和表单联动", en: "Log shopping: separate How-to-add block; manual Record-to now drives the form" }, items: [
    { k: "better", zh: "「录入方式」和「记到哪里」做成页面上方单独的一块表单；手动添加时它们也留在表单上面，标题行恢复原样", en: "“How to add” and “Record to” are now their own block above the form; in manual mode they stay above the form and the title row is back to normal" },
    { k: "better", zh: "手动添加默认「只入库」；选「只记花费」时，每行的「放进库存」固定成「只记花费，不入库」并变灰；选「只入库」时，「只记花费」选项不可选、「金额」变灰", en: "Manual add defaults to Stock only; Spend only locks every row's “Put in stock” to “Spend only, no stock” (greyed); Stock only disables the Spend-only choice and greys the amount" },
  ] },

  { v: "2026-11-20.34", title: { zh: "多选收进长按菜单；库存标题行更整齐", en: "Multi-select moves into the long-press menu; tidier Stock header" }, items: [
    { k: "better", zh: "购物车、库存页面上的「多选」按钮去掉了：长按一行（电脑右键）→「多选」进入，进入后的勾选、全选、批量操作不变；操作条里多了「完成」退出", en: "The Select button on Cart and Stock is gone: long-press a row (right-click on a computer) → Select; ticking, Select all and bulk actions work as before, and the action bar has a Done button" },
    { k: "better", zh: "库存页去掉「165 件」，换成标题「库存」，右边是「视图」切换，同一行", en: "The Stock page drops the “165 items” line; the “Stock” title and the View switch now share one row" },
  ] },

  { v: "2026-11-20.33", title: { zh: "录入购物：一步一步展开", en: "Log shopping: one step at a time" }, items: [
    { k: "better", zh: "录入方式（默认实体店小票）→ 点它展开「记到哪里」下拉（默认入库 + 花费）→ 点它展开上传照片 → 有照片后展开可跳过的文字描述 → 识别；没有照片可点「只用文字」", en: "How to add (store receipt by default) → tap it to reveal the “Record to” dropdown (Stock + spend by default) → tap it to reveal the photo upload → once there is a photo, the skippable text and Recognize appear; no photo? tap “Use text only”" },
  ] },

  { v: "2026-11-20.32", title: { zh: "咩咩的回答默认折叠", en: "Meh's answers are collapsed by default" }, items: [
    { k: "better", zh: "库存里「该补货了」等页面上的咩咩回答，默认收成一行「咩咩的回答 · 日期」，点开才看全文；刚问完会自动展开", en: "Meh's answers on pages like Restock now collapse into one line (“Meh's answer · date”); tap to read, and a fresh answer opens by itself" },
  ] },

  { v: "2026-11-20.31", title: { zh: "全部周期性账单（固定清单）；账单概览的分组切换换成统一的「视图」控件", en: "All recurring bills as a fixed list; the overview grouping uses the shared View switch" }, items: [
    { k: "new", zh: "财务页面目录里多了「全部周期性账单」：手机、房产税、房屋保险、车辆牌照、订阅……每张账单一张卡，不挂房产的也在，不随时间范围变", en: "Finance now lists “All recurring bills”: phone, property tax, home insurance, vehicle registration, subscriptions… one card per bill, including ones not tied to a property, independent of the time range" },
    { k: "better", zh: "账单概览里点「家庭通用」「车辆」那一行，进的也是这样的固定清单卡片", en: "On the bills overview, the General and Vehicle rows now open the same fixed card list" },
    { k: "better", zh: "「按资产 / 按周期」换成和其他页一样的「视图」切换按钮；卡片多时短划线按宽度平均分，⚙ 固定在右端不再压住按钮", en: "“By asset / By cycle” now uses the same View switch as other pages; with many cards the dashes share the width evenly and ⚙ keeps a fixed slot at the right" },
    { k: "fix", zh: "卡片上面的 ⚙ 下拉菜单不再被下面的卡片盖住（今日页和账单页）", en: "The ⚙ dropdown above the cards is no longer hidden behind the cards (Today and bills pages)" },
    { k: "fix", zh: "房屋里的「账单」页面包屑补回了房产名：房屋 / 房产名 / 账单", en: "The Bills page under a property shows the property again in its path: Home / property / Bills" },
    { k: "better", zh: "库存页：日常消耗品 / 汽车房屋消耗品 / 家居耐用品 收进工具条的「范围」下拉里，默认日常消耗品，物品视图一次只看一个范围", en: "Stock page: Daily supplies / Car & home supplies / Home durables now live in a Scope dropdown in the filter bar, defaulting to Daily supplies; the item view shows one scope at a time" },
    { k: "better", zh: "周期性账单页只留「时间范围 · 几张账单」一行，合计口径等长说明收进标题旁的 ⓘ", en: "The recurring bills page keeps one key line (range · number of bills); the longer explanation moved into the ⓘ next to the title" },
    { k: "better", zh: "账单页的短划线 ⚙ 里多了「显示卡片编号」：每张账单卡上面显示 #3 / 8，知道看到第几张（默认开，可关；今日页没有）", en: "The ⚙ on the bills page has a new “Show card numbers” option: each card shows #3 / 8 so you know which one you are on (on by default; not on Today)" },
    { k: "fix", zh: "账单里的「登录提示」只是文字：不再是链接、没有下划线，手机也不会把邮箱 / 网址自动识别成链接", en: "A bill's Login hint is now plain text: no link, no underline, and phones no longer auto-link emails or URLs in it" },
    { k: "better", zh: "「奉献 / 捐款」账单的图标换成 💝", en: "The Giving / Donation bill icon is now 💝" },
    { k: "better", zh: "录入购物：表单第一项是「录入方式」下拉（实体店小票 / 线上订单 / 手动添加），选了才展开上传照片；文字描述可选、可跳过，最后点「识别」。原来的「入库 / 花费」选择改名叫「记到哪里」", en: "Log shopping: the first field is now a “How to add” dropdown (store receipt / online order / manual); choosing one reveals the photo upload, the optional text can be skipped, then tap Recognize. The old stock / spend choice is now called “Record to”" },
  ] },

  { v: "2026-11-20.30", title: { zh: "今日页：「家里」卡片精简，滑动控制行挪到卡片上面", en: "Today: slimmer Home card, carousel controls moved above the cards" }, items: [
    { k: "better", zh: "「家里 · 一览」只留 储藏、每套房子、每辆车；每辆车一行，点进这辆车自己的首页（以前「车辆」一行会跳到房屋概览）", en: "The Home card now only lists Storage, each house and each vehicle; each vehicle opens its own home page (the old Vehicles row jumped to the house overview)" },
    { k: "better", zh: "今日页卡片的 ‹ 短划线 › 和 ⚙ 从卡片下面挪到卡片上面，⚙ 菜单向下弹出", en: "The ‹ dashes › and ⚙ controls on Today moved from below the cards to above them; the ⚙ menu opens downward" },
  ] },

  { v: "2026-11-20.29", title: { zh: "更多新建 / 编辑页也有了置顶的「取消 / 保存」", en: "More create / edit pages get the pinned Cancel / Save bar" }, items: [
    { k: "better", zh: "之前没有顶部按钮的新建、编辑页（借贷、商店、家庭成员、设备保养、季节任务等）现在和其他表单一样，顶部一行：取消靠左、保存靠右，不用滑到底", en: "Create and edit pages that had no top buttons (loans, shops, family members, maintenance, seasonal tasks…) now match the rest: one row on top, Cancel on the left, Save on the right" },
  ] },

  { v: "2026-11-20.28", title: { zh: "今日页的钱卡片去掉底部 4 个入口", en: "Today's money card loses its 4 bottom shortcuts" }, items: [
    { k: "better", zh: "「钱 · 本月」卡片底部的 对账单 / 记一笔花费 / 记一笔收入 / 预算 四个按钮去掉了，卡片更简洁；这些入口在「快捷操作」和右下角 ＋ 里还在", en: "The Statements / Log spending / Log income / Budget buttons at the bottom of the “Money · this month” card are gone for a cleaner card; the same entries remain in Quick actions and the ＋ button" },
  ] },

  { v: "2026-11-20.27", title: { zh: "房屋 / 车辆的账单页：只算这个资产，账单做成滑动卡片", en: "Property / vehicle bills page: only this asset, bills as swipeable cards" }, items: [
    { k: "better", zh: "页面上的应付 / 已付 / 余额只统计挂在这所房子（或这辆车）上的账单，别处的一次性账单不再混进来；有预估金额时标出「含预估」", en: "Due / paid / balance now count only bills attached to this property or vehicle, so other one-time bills no longer sneak in; estimated amounts are marked “incl. estimates”" },
    { k: "better", zh: "去掉了筛选框；下面是这个资产的全部账单，一张账单一张卡，标着「周期性」或「一次性」，左右滑动，也会自动换下一张；控制行和 ⚙ 在卡片上面，⚙ 和今日页一样", en: "Filters are gone; below is every bill of this asset, one card each, tagged Recurring or One-time. Swipe, or let it advance on its own; the controls and ⚙ sit above the card, same as on Today" },
    { k: "better", zh: "每张卡右上角的 ⋯ 和账单详情页一样：详情、记缴费、缴费记录、复制、删除等", en: "Each card's ⋯ menu matches the bill detail page: details, log payment, payments, copy, delete and more" },
  ] },

  { v: "2026-11-20.26", title: { zh: "视图切换配色", en: "View switch colour" }, items: [
    { k: "better", zh: "视图切换按钮改成和页面导航卡片同一个主题绿色，不再是黑白", en: "The view switch now uses the same theme green as the page navigation cards instead of black and white" },
  ] },

  { v: "2026-11-20.25", title: { zh: "视图切换换成深色按钮", en: "Dark pill view switch" }, items: [
    { k: "better", zh: "所有「视图」切换：深色圆角按钮「[切换图标] 视图名」，只显示名称，不再带各视图自己的小图标；点开选择，选完收起", en: "All view switches are now a dark rounded button with a switch icon and the view name only; tap to open, pick, and it collapses" },
  ] },

  { v: "2026-11-20.24", title: { zh: "缴费记录点一行进详情", en: "Payment rows open their detail" }, items: [
    { k: "better", zh: "缴费记录、一次性账单的缴费：点一行进详情（和花费、收入一致）；花费明细底部的提示文字同步更新", en: "Payment records and one-time-bill payments now open their detail on tap, like spending and income; the hint under the spending list is updated" },
  ] },

  { v: "2026-11-20.23", title: { zh: "记一笔收入也是单独的表单页", en: "Logging income is its own form page too" }, items: [
    { k: "better", zh: "记一笔收入 / 复制一笔：打开单独的表单页，顶部有置顶的取消 / 保存，保存后回到收入明细", en: "Log income / Copy now open a dedicated form page with pinned Cancel / Save and return to the income list after saving" },
  ] },

  { v: "2026-11-20.22", title: { zh: "商店：录入特价是单独的新增页", en: "Shops: entering deals is its own page" }, items: [
    { k: "fix", zh: "商店详情右下角 ＋ 的「录入特价」「手动加一条特价」现在会跳到单独的新增页（取消 / 保存后回到商店），不再停在原页面", en: "The shop page's ＋ menu now opens a dedicated page for entering deals (Cancel / Save return to the shop) instead of staying on the same page" },
    { k: "better", zh: "商店特价行、特价一览的每一条：名称不再带下划线，整行可点进详情", en: "Deal rows in a shop and in the weekly deals list: no underlined names, the whole row opens the detail" },
    { k: "fix", zh: "补上几处没有英文的新文字", en: "Added missing English text for recent screens" },
  ] },

  { v: "2026-11-20.21", title: { zh: "视图切换换成条状小控件，补货清单改成整页", en: "Slimmer view switch; restock list is now a page" }, items: [
    { k: "better", zh: "「视图」切换去掉文字和三点，改成一条小的条状控件「图标 当前视图 ⌄」，点开选择、选完收起；字更小，图标放进去", en: "The view switch drops the label and dots: a slim bar showing the icon and current view; tap to open, pick, and it collapses" },
    { k: "new", zh: "从补货清单加入购物车改成单独一页（可改每样的数量和单位、勾选），不再从底部弹出", en: "Adding from the restock list is now a full page (edit quantity and unit, tick items) instead of a bottom sheet" },
    { k: "fix", zh: "编辑 / 创建页：取消和保存同一行，底部导航不再遮住；花费明细的名称不再有下划线；交易清单里过长的文字会换行不越界", en: "Edit/create pages keep Cancel and Save on one row without the bottom tabs covering them; spend names have no underline; long deal-checklist text wraps" },
  ] },

  { v: "2026-11-20.20", title: { zh: "历史交易：整行点开", en: "Deal history: tap the row" }, items: [
    { k: "better", zh: "历史交易整行可点，进入那笔交易的清单、时间线和交易信息；长按菜单第一项是「详情」", en: "Deal history rows are fully tappable and open that deal's checklist, timeline and info; Details is first in the long-press menu" },
  ] },

  { v: "2026-11-20.19", title: { zh: "商店特价详情页", en: "Shop deal detail page" }, items: [
    { k: "new", zh: "商店里的每条特价点一下进详情：商品信息 / 价格 / 有效期与类型 三块各有「编辑」，下面是以前的价格；右上 ⋯ 有加入清单、删除", en: "Each shop deal opens a detail page: Item, Price and Validity & type blocks each have Edit, with past prices below; the ⋯ menu adds it to the list or deletes it" },
    { k: "better", zh: "特价行不再就地展开表单，编辑改成单独一页（取消 / 保存置顶）；行上去掉了「改」按钮和展开的历史价", en: "Deal rows no longer expand an inline form; editing is its own page, and the Edit button and inline price history are gone from rows" },
  ] },

  { v: "2026-11-20.18", title: { zh: "商店详情页重构", en: "Shop detail page reworked" }, items: [
    { k: "better", zh: "商店详情：标题右上 ⋯（本周广告、Flipp、用脚本更新、不去了 / 加回常去、删除）；分成「基本信息」「特价更新」两块，每块有自己的「编辑」", en: "Shop detail: a ⋯ menu (weekly ad, Flipp, script update, archive, delete) and two blocks, Basic info and Deal updates, each with its own Edit" },
    { k: "new", zh: "编辑商店是单独的表单页（取消 / 保存置顶），保存后回到详情；右下角圆形 ＋：录入特价、手动加一条特价", en: "Editing a shop is its own page (Cancel / Save pinned) that returns to the detail; a round ＋ adds deals (scan/paste or one by hand)" },
  ] },

  { v: "2026-11-20.17", title: { zh: "录入购物页面整理", en: "Log shopping page tidy-up" }, items: [
    { k: "better", zh: "实体店小票 / 线上订单 / 手动添加 换成标题行右边的「来源」小控件，不再单占一行", en: "Receipt / Online order / Manual is now a Source switch on the title row instead of its own row" },
    { k: "better", zh: "手动添加的每一行：先选「放进库存」（可输入搜索），名称、单位、分类自动跟着选中的物品；新物品的分类在名称下面", en: "Manual rows: pick the stock item first (searchable); name, unit and category follow it; the new-item category sits under the name" },
    { k: "better", zh: "底部按钮：取消 + 确认入库 同一行；手动添加点取消回到库存页", en: "Cancel and Confirm sit on one row; Cancel in manual mode returns to Inventory" },
  ] },

  { v: "2026-11-20.16", title: { zh: "加入购物车页面重构", en: "Add-to-cart page redesigned" }, items: [
    { k: "better", zh: "加入购物车首页：标题右上 ⋯（扫描 / 补货提醒 / 买好了录入库存）；一个块里「已有物品 / 新物品」两个入口，点开选扫描或手动；下面是最近加入的 8 条", en: "Add to cart: ⋯ menu (Scan / Restock alerts / Bought — log into stock); Existing item / New item entries that open Scan or Manual; the latest 8 added below" },
    { k: "new", zh: "手动加入是单独的表单页（取消 / 保存）。已有物品从库存下拉里选（按分类分组，可输入搜索），单位和分类自动跟着库存；新物品保存时发现库存里有相同或相近的，会问是否改成加已有物品", en: "Manual add is its own form page. Existing items are picked from a searchable, grouped stock list with unit and category filled in; new items that match stock prompt you to add the existing item instead" },
  ] },

  { v: "2026-11-20.15", title: { zh: "今日页：咩咩咩的三个入口", en: "Today: three quick entries under the assistant" }, items: [
    { k: "better", zh: "今日页「咩咩咩」下面的今天吃什么、加入购物车、录入购物，做成一行三张小卡片（手机上也是一行）", en: "Today page: What to eat, Add to cart and Log shopping are now three small cards in one row, also on phones" },
  ] },

  { v: "2026-11-20.14", title: { zh: "统一的「视图」切换", en: "One shared View switch" }, items: [
    { k: "better", zh: "特价一览、今日待办、历史交易、库存：原来各页并排的一组视图按钮，换成统一的靠右小控件「视图 | 当前 ⋮」，点开选择，选完收起", en: "Weekly deals, Today to-dos, deal history and inventory now share one right-aligned View control: tap to open, pick, and it collapses to the current view" },
  ] },

  { v: "2026-11-20.13", title: { zh: "常去的商店：整理首页", en: "Shops: tidier home page" }, items: [
    { k: "better", zh: "常去的商店首页：标题下是两张导航卡（商店列表 / 特价一览），不再有一排挤在一起的按钮；更新记录收进右上 ⋯", en: "Shops home: two navigation cards (Shop list / Weekly deals) replace the crowded button row; Update log moved into the ⋯ menu" },
    { k: "new", zh: "右下角圆形 ＋：手动添加商店、找附近的商店、录入特价、用 Claude 整理", en: "Round ＋ button: add a shop, find nearby shops, enter deals, tidy with Claude" },
  ] },

  { v: "2026-11-20.12", title: { zh: "编辑页的取消 / 保存置顶", en: "Cancel / Save pinned to the top of edit pages" }, items: [
    { k: "better", zh: "所有编辑页：页面顶部（面包屑下面）有一条粘住的「取消 / 保存」，不用再滑到最底部，也不会被底部导航挡住", en: "Every edit page has a sticky Cancel / Save bar at the top, so you no longer scroll to the bottom or get blocked by the bottom tabs" },
    { k: "fix", zh: "保养记录的编辑页：取消回到保养记录列表（以前回到一张空白表单）；新记一笔也有取消", en: "Service-record edit page: Cancel now returns to the record list (it used to open a blank form); new records have Cancel too" },
  ] },

  { v: "2026-11-20.11", title: { zh: "历史交易、商店、本周特价：多选删除", en: "Deal history, shops and weekly deals: multi-select delete" }, items: [
    { k: "new", zh: "历史交易、常去的商店、商店里的本周特价：长按菜单里「删除」后面有「多选删除」，进入后点行就是勾选", en: "Deal history, shops and a shop's weekly deals get \"Select & delete\" after Delete in the long-press menu" },
  ] },

  { v: "2026-11-20.10", title: { zh: "保养记录：详情页和多选删除", en: "Service records: detail page and multi-select delete" }, items: [
    { k: "new", zh: "保养记录点一行进详情页，分块显示（基本信息 / 花费与收款方 / 备注），每块有自己的「编辑」；右上 ⋯ 有复制、删除", en: "Tapping a service record opens a detail page with its own Edit button per block; the ⋯ menu has Copy and Delete" },
    { k: "new", zh: "长按菜单：详情、编辑、复制、删除、多选删除；行上单独的「复制」按钮去掉了", en: "Long-press menu: Details, Edit, Copy, Delete, Select & delete; the separate Copy button on rows is gone" },
  ] },

  { v: "2026-11-20.9", title: { zh: "详情页的 ⋯ 菜单，面包屑合成一行", en: "Detail-page ⋯ menu, single-line breadcrumb" }, items: [
    { k: "new", zh: "花费详情、收入详情的标题右边有 ⋯：复制、删除（收入底部原来的按钮挪到这里）", en: "Spend and income detail pages have a ⋯ menu (Copy, Delete) next to the title; the old bottom buttons moved there" },
    { k: "better", zh: "花费 / 收入的详情页和编辑页，面包屑合成一行「财务 / 花费 / 明细 / 这条」，不再叠两层", en: "Spend and income detail and edit pages show one breadcrumb line instead of two stacked ones" },
    { k: "better", zh: "花费明细点一行进详情（编辑在详情每块的「编辑」里）", en: "Tapping a spend row now opens its detail page; editing is in each block's Edit button" },
  ] },

  { v: "2026-11-20.8", title: { zh: "周期挪到图表上", en: "Chart interval moved onto the charts" }, items: [
    { k: "better", zh: "花费、收入、净资产的走势图：「自动 / 月 / 季 / 年」切换现在在图的标题行右边，筛选条里不再有「周期」", en: "Spending, income and net-worth trend charts now have an Auto / Month / Quarter / Year switch in their title row; the filter bar no longer has Interval" },
    { k: "better", zh: "筛选数字和「清除筛选」只算真正过滤数据的条件；预算页固定按月", en: "The filter count and Clear filters only count real filters; the budget page is always monthly" },
  ] },

  { v: "2026-11-20.7", title: { zh: "收入明细：点一行进详情", en: "Income records: tap a row for details" }, items: [
    { k: "better", zh: "收入明细每一行：第一行是「日期 图标 名字」，点一行直接进详情，不再在当前页展开表单", en: "Income rows now read \"date, icon, name\"; tapping a row opens its detail page instead of an inline form" },
    { k: "new", zh: "收入详情页：分块显示，每块有自己的「编辑」；借款的还款也在详情里记", en: "Income detail page with its own Edit button per section; loan repayments are recorded there too" },
    { k: "better", zh: "编辑收入改成单独一页，保存后回到详情；去掉了行右边的 ▾", en: "Editing an income record is now its own page and returns to the detail after saving; the ▾ is gone" },
  ] },

  { v: "2026-11-20.6", title: { zh: "缴费记录、收入详情和多选删除", en: "Payment and income details, multi-select delete" }, items: [
    { k: "new", zh: "缴费记录、一次性账单的缴费有了详情页，分块显示，每块带编辑", en: "Payment records and one-time-bill payments have detail pages, one editable block at a time" },
    { k: "new", zh: "缴费记录的长按菜单里，「删除」后面有「多选删除」", en: "Payment records get \"Select & delete\" in the long-press menu" },
  ] },

  { v: "2026-11-20.5", title: { zh: "花费详情页", en: "Spend record detail page" }, items: [
    { k: "new", zh: "花费明细长按菜单第一项是「详情」，详情分块显示，每块有自己的「编辑」", en: "Spend rows have \"Details\" first in the long-press menu; each block has its own Edit button" },
  ] },

  { v: "2026-11-20.4", title: { zh: "账单菜单改名", en: "Bill menu renames" }, items: [
    { k: "better", zh: "账单的 ⋯ 菜单：「缴费」改为「记缴费」，「查看缴费记录」改为「缴费记录」", en: "Bill ⋯ menu: \"Pay\" is now \"Log a payment\" and \"View payment history\" is \"Payment history\"" },
    { k: "better", zh: "打印里去掉了「按筛选打印」", en: "Removed \"print current filter\" from printing" },
  ] },

  { v: "2026-11-20.3", title: { zh: "花费明细整理", en: "Spend list cleanup" }, items: [
    { k: "better", zh: "花费明细：整行可点；去掉了多选删除 / 打印 / 导出按钮，多选删除改到长按菜单里", en: "Spend list: whole row is clickable; select-and-delete moved into the long-press menu" },
    { k: "fix", zh: "缴费表单打开后光标直接在金额框，不再停在页头", en: "The payment form now focuses the amount field" },
  ] },

  { v: "2026-11-20.2", title: { zh: "房屋 / 车辆里的「账单」：这个资产自己的账单清单页", en: "Bills inside a property or vehicle: a bills list page for that asset" }, items: [
    { k: "new", zh: "房屋 → 账单、车辆 → 账单，现在进入这个资产自己的账单页：周期性和一次性账单都在里面，默认看本月，顶上有 应付 / 已付 / 余额 三张小卡片，可以按时间、类型、状态筛选", en: "Property → Bills and Vehicle → Bills now open a page for that asset only: recurring and one-time bills together, this month by default, with Due / Paid / Balance cards on top and filters for time, type and status" }
  ] },

  { v: "2026-11-20.1", title: { zh: "行记录去掉 ⋯，记一笔花费改成独立表单页，收入页的入口收进圆形 ＋", en: "Rows lose the ⋯ menu, spending gets its own form page, and income actions move into the round ＋" }, items: [
    { k: "better", zh: "缴费记录、一次性账单缴费、摊派缴费、花费明细的每一行去掉了 ⋯ 和 ▾：手机长按、电脑右键点那一行，弹出 编辑 / 复制 / 删除；缴费记录第一行是日期 + 状态，下面按组排，金额不会被拆开", en: "Payment and spending rows no longer have ⋯ or ▾: long-press on a phone or right-click on a computer for Edit / Copy / Delete. A payment row starts with date and status, then grouped details; amounts are never split" },
    { k: "better", zh: "花费：右下角 ＋ 的菜单里选「手动记一笔 / 拍小票识别 / 导入对账单」；记一笔、编辑、复制都打开同一个独立的表单页，不再在明细里插表单；收入页的 ＋ 菜单是「手动记一笔 / 拍照识别 / 银行导入」，导航卡片里的「银行导入」换成「预算与计划」，导入对账单入口去掉，收入明细右上角只留导出打印", en: "Spending: the round ＋ now offers Add by hand / Scan receipt / Import statement, and adding, editing and copying all open one separate form page. Income: ＋ offers Add by hand / Scan / Bank import; the nav card “Bank import” became “Budget & plan”, and the statement-import entry is gone" },
    { k: "fix", zh: "花费概览卡片里的金额不再每个都单独占一行；「A · B · C」这类信息放不下时，整段落到下一行，不再从中间拆开（全站统一）", en: "Amounts inside the spending overview cards no longer each take a full line, and “A · B · C” lines now wrap only at the dots (everywhere)" },
    { k: "fix", zh: "「筛选 (n)」的数字不再把默认值算进去（花费概览默认「本月」，明细默认「全部历史」，清除筛选后回到 0）；银行卡尾号写成「Chase Checking **0934」", en: "The Filter (n) counter no longer counts default values (overview defaults to This month, records to All time), and card endings read “Chase Checking **0934”" }
  ] },

  { v: "2026-11-19.44", title: { zh: "「A · B · C」信息排不下时，只在「·」处换行", en: "When “A · B · C” lines do not fit, they now wrap only at the dots" }, items: [
    { k: "better", zh: "一次性账单综合信息卡里的日期、保险、算式，以及缴费记录行下面的小字：一行放不下时，整条信息（比如「到期 2026-11-30」）落到下一行，不再从中间拆开；卡片里的信息靠右对齐", en: "In the one-time bill summary card (dates, insurance, formula) and the small text under payment rows, an item that does not fit moves whole to the next line instead of breaking in the middle; the card's values are right-aligned" }
  ] },

  { v: "2026-11-19.43", title: { zh: "借贷详情页：编辑、记一笔还款、删除收进右上角 ⋯", en: "Loan details: Edit, Log repayment and Delete moved into the ⋯ menu" }, items: [
    { k: "better", zh: "借贷详情页右上角的「编辑」改成 ⋯ 菜单（编辑、记一笔还款、删除）；页面底部的「删除这笔借贷」去掉；个人借贷的「记一笔还款」按钮只在还没有记录时显示", en: "The Edit button on a loan's page is now a ⋯ menu (Edit, Log repayment, Delete); the Delete button at the bottom is gone; Log repayment on personal loans only shows as a button while there are no records" }
  ] },

  { v: "2026-11-19.42", title: { zh: "新图标：青绿底的房子 + 爱心", en: "New icon: a teal tile with a house and a heart" }, items: [
    { k: "better", zh: "爱家小助手的图标从罐子换成青绿色圆角方块里的白色房子 + 爱心（页面左上角和浏览器标签页图标都换了）", en: "The app icon changes from a jar to a white house with a heart on a teal rounded tile (top-left of the page and the browser tab icon)" }
  ] },

  { v: "2026-11-19.41", title: { zh: "一次性账单重构：综合信息卡 + 缴费记录，缴费各有独立页", en: "One-time bills redesigned: summary card plus payment records, each payment on its own page" }, items: [
    { k: "better", zh: "首页只有两块：综合信息卡（账单、日期、保险、应付 / 已付 / 余额）和缴费记录；卡片 ⋯ 里是 详情、缴费、复制、删除；原来的分块信息搬到「详情」，每块各自编辑", en: "The home page is now a summary card (bill, dates, insurance, due / paid / balance) and the payment records; the card menu has Details, Pay, Copy, Delete; the block-by-block info moved to Details, each block editable on its own" },
    { k: "better", zh: "缴费记录的行和周期性账单一样：点一下进独立的编辑页，⋯ / 长按有 编辑、复制、删除；没有记录时区里有「记一笔缴费」，其他地方的这个按钮去掉了", en: "Payment rows match recurring bills: tap to edit on a separate page, Edit / Copy / Delete in ⋯ or long-press; the Log payment button only appears in the empty section" },
    { k: "new", zh: "保险信息记在每张账单上：保险公司、计划类型（PPO / HMO 等）、理赔号、是否已理赔；新建账单时按同一位患者最近一张账单带入保险公司和计划类型", en: "Insurance is stored per bill: insurer, plan type (PPO / HMO …), claim number and claim status; a new bill prefills insurer and plan type from the patient's latest bill" }
  ] },

  { v: "2026-11-19.40", title: { zh: "周期性账单首页的缴费记录，行和「全部缴费记录」一样", en: "Payment records on a recurring bill's home page use the same rows as the full list" }, items: [
    { k: "better", zh: "账单首页缴费记录里的每一行：点一下进编辑页，⋯ / 长按有编辑、复制、删除，样子和「全部缴费记录」里的行一致", en: "Each row in the payment records section now opens its edit page on tap, with Edit / Copy / Delete in ⋯ or long-press, matching the full list" }
  ] },

  { v: "2026-11-19.39", title: { zh: "添加账单页分成「自动创建」和「手工创建」两块", en: "Add bill page split into Create automatically and Create manually" }, items: [
    { k: "better", zh: "自动创建在前：AI 扫描（带按钮和介绍）、常用账单模板；手工创建在后：周期性账单（分步）、一次性账单（分步）、一次填完（整页）；每个入口一整行卡片", en: "Create automatically comes first (AI scan with its button and intro, common bill templates), then Create manually (recurring step by step, one-time step by step, one page); each option is a full-width row card" }
  ] },

  { v: "2026-11-19.38", title: { zh: "账单菜单更简洁；账单有了详情页，每块单独编辑；账号尾号可填 100 位", en: "Simpler menus; bills get a details page with per-block editing; account digits up to 100" }, items: [
    { k: "better", zh: "所有「⋯」菜单里的名字简化：记一笔缴费 → 缴费，复制为新 xx → 复制，删除 xx → 删除", en: "Menu labels are simpler everywhere: Log payment → Pay, Copy as new … → Copy, Delete … → Delete" },
    { k: "new", zh: "周期性账单菜单的第一项「编辑」改为「详情」：打开详情页，按「这是什么账单 / 多少钱、多久一次 / 怎么付 / 提醒与其他」分块显示，每块有自己的「编辑」，只改这一块", en: "The first item in a recurring bill's menu is now Details: it lists the bill in blocks (What it is / Amount and schedule / How it is paid / Reminders & other), each with its own Edit" },
    { k: "better", zh: "账单的账号尾号最多可填 100 个字符（需要先在数据库执行 098 迁移）", en: "A bill's account digits can now be up to 100 characters (run migration 098 on the database first)" }
  ] },

  { v: "2026-11-19.37", title: { zh: "全部账单的合计卡：手机上金额字号调大一档", en: "All bills totals: slightly larger amounts on phones" }, items: [
    { k: "fix", zh: "手机上「应付 / 已付 / 余额」三张卡的金额字号从 15px 调到 16px，和其他页面更接近，不再显得偏小", en: "On phones the Due / Paid / Balance amounts go from 15px to 16px, closer to other pages and no longer looking small" }
  ] },

  { v: "2026-11-19.36", title: { zh: "各页标题下面的说明文字，统一收进标题后面的 ⓘ", en: "Descriptions under page titles now live in an ⓘ after the title" }, items: [
    { k: "better", zh: "各页各块标题下面那句说明（比如「竖线是本月已过去的进度…」「可用 Excel 打开」）改成标题后面的小 ⓘ，电脑悬停、手机点一下看；页面更紧凑", en: "The explanatory line under each section title is now a small ⓘ after the title (hover on laptop, tap on phone), so pages are more compact" },
    { k: "better", zh: "带数字或链接的统计 / 状态行（如「3 张在用」）仍然直接显示", en: "Lines with numbers or links (like “3 in use”) are still shown inline" }
  ] },

  { v: "2026-11-19.35", title: { zh: "收入、花费的时间条改成靠右的「筛选」按钮", en: "Income and Spending time bars are now a right-aligned Filters button" }, items: [
    { k: "better", zh: "收入和花费页的时间范围、周期、月份、「排除资本性 / 投资」开关，都收进靠右的「筛选」按钮；点开面板第一行是「筛选」字样和清除筛选，开关也在里面", en: "Time range, interval, month and the exclude capital / investments switches now live in a right-aligned Filters button; the panel starts with a Filters title and a clear button" },
    { k: "better", zh: "改了筛选后面板保持打开，按钮上显示改动了几项；电脑和手机一个样子", en: "The panel stays open after you change a filter, the button shows how many are set, and it looks the same on laptop and phone" }
  ] },

  { v: "2026-11-19.34", title: { zh: "财务首页以「资产」开头；资产 / 净资产合成一处；眼睛统一放到页头最右", en: "Finance home starts with Assets; Assets and Net worth live together; the eye sits at the right of every header" }, items: [
    { k: "better", zh: "财务首页的目录第一项是「资产」；资产页和净资产页顶上有「资产概览 / 净资产」两张导航小卡片，净资产不再单列", en: "The first entry on the Finance home is Assets; the Assets and Net worth pages share two navigation cards (Assets overview / Net worth), and Net worth is no longer listed separately" },
    { k: "better", zh: "资产页、净资产页第一行是页面名 + 说明 ⓘ；顶部的统计数字只显示，不再跳转", en: "The first row of Assets and Net worth is the page name plus an ⓘ for the description; the figures at the top are display-only (no links)" },
    { k: "better", zh: "所有有金额的页面，眼睛都在页头第一行最右边；有 ⋯ 的页面，眼睛在 ⋯ 的左边", en: "On every page with amounts the eye is at the far right of the first header row, to the left of ⋯ when there is one" },
    { k: "better", zh: "资产页的房产、车辆卡片重新排版，像周期性账单那样：名称 + 状态在左、市值和净值在右，下面一行一项（买入、账单、贷款、花费），不再乱折行", en: "Property and vehicle cards on Assets now look like recurring-bill rows: name and status on the left, value and equity on the right, then one line per item" }
  ] },

  { v: "2026-11-19.33", title: { zh: "花费、预算、借贷、对账单：页头和导航卡片和收入页统一", en: "Spending, Budget, Loans and Statements: same header and navigation cards as Income" }, items: [
    { k: "better", zh: "这四页的页头统一成「标题 · 当前页签」+ 眼睛 + 右上角 ⋯，页签改成导航小卡片（和储藏页、收入页一样），次要页签和页面自己的操作（预算的打印）收进 ⋯", en: "These four pages now share one header: Title · current tab, the eye, and a ⋯ menu; tabs are navigation cards like Pantry and Income, and secondary tabs and page actions (Budget print) live in ⋯" },
    { k: "better", zh: "花费的「记一笔花费」改成右下角圆形 ＋；对账单页顶上那段说明收进标题旁的 ⓘ", en: "Log spending is now a round + button at the bottom right; the Statements description moved into an ⓘ next to the title" }
  ] },

  { v: "2026-11-19.32", title: { zh: "收入页重新整理：导航小卡片、眼睛挪到标题旁、右下角 ＋ 记一笔收入", en: "Income page reorganized: navigation cards, the eye next to the title, a + button to log income" }, items: [
    { k: "better", zh: "页头是「收入 · 当前页签」，眼睛紧跟在标题后面；右上角 ⋯ 里放导出打印、预算与计划，明细页里的多选删除、打印、导出 CSV 也收进这里", en: "The header reads Income · current tab with the eye right after it; the ⋯ menu holds Export & print, Budget & plan, and on Details the multi-select delete, print and CSV export" },
    { k: "better", zh: "原来的页签下拉改成导航小卡片（和储藏页一样），手机上 3 × 2；记一笔收入改成右下角圆形 ＋", en: "The tab dropdown became navigation cards like the Pantry page (3 × 2 on phones); Log income is now a round + button at the bottom right" },
    { k: "better", zh: "时间范围 / 周期 / 谁的 那一排改成统一的筛选条，手机上收成「筛选」按钮", en: "The time range / interval / whose row became the standard filter bar; on phones it collapses into a Filters button" },
    { k: "better", zh: "所有有金额的页面，眼睛都放到页面标题旁边", en: "On every page with amounts, the eye now sits next to the page title" }
  ] },

  { v: "2026-11-19.31", title: { zh: "账单概览卡片更清爽；全部账单的合计不再随筛选变；净资产说明收进 ⓘ", en: "Cleaner overview cards; All bills totals no longer shrink with filters; Net worth note in an ⓘ" }, items: [
    { k: "better", zh: "账单概览的卡片改成白底线框、彩色小图标，和别的页面的卡片一致，也和页面底色拉开了对比；去掉了右边的箭头", en: "Bills overview cards are now white with a border and a colored icon like cards on other pages, stand out from the page background, and no longer have a right arrow" },
    { k: "fix", zh: "全部账单：选了搜索 / 资产 / 类型 / 状态等筛选后，上面「应付 / 已付 / 余额」三张合计卡不再跟着变小，始终是所选时间范围的总数；筛选出来的笔数和小计显示在列表上方", en: "All bills: the Due / Paid / Balance cards no longer shrink when you filter; they always show the totals for the chosen time range, and the filtered count and subtotals appear above the list" },
    { k: "better", zh: "净资产页顶上那段说明文字收进「净资产」卡片上的 ⓘ，点一下或悬停查看", en: "The note at the top of Net worth moved into an ⓘ on the Net worth card (tap or hover)" }
  ] },

  { v: "2026-11-19.30", title: { zh: "一次性账单的编辑页：保存 + 取消，复制和删除都在 ⋯ 里", en: "One-time bill edit pages: Save + Cancel; copy and delete live in the ⋯ menu" }, items: [
    { k: "better", zh: "点某一块的「编辑」进入的页面，底部是「保存」和「取消」（取消回到详情页）；复制为新账单、删除这张账单只在详情页右上角 ⋯ 里，不再重复出现", en: "The page from a block's Edit ends with Save and Cancel (Cancel returns to the details); Copy as new and Delete now live only in the ⋯ menu" }
  ] },

  { v: "2026-11-19.29", title: { zh: "一次性账单：页头汇总卡、⋯ 菜单，保险理赔单独成块", en: "One-time bills: summary header, ⋯ menu, insurance in its own block" }, items: [
    { k: "better", zh: "一次性账单详情页顶部是汇总卡：提供方、状态 / 到期徽章，右上角 ⋯（记缴费、复制为新账单、删除），下面一排「应付 / 已付 / 余额」加进度条和算式", en: "The one-time bill page now opens with a summary card: provider, status / due badges, a ⋯ menu (log payment, copy as new, delete) and a Due / Paid / Balance row with a progress bar" },
    { k: "better", zh: "保险公司、理赔号、保险已付单独成一块「保险理赔」（医疗、宠物），各块仍各带自己的「编辑」", en: "Insurer, claim # and insurance paid are now their own Insurance & claim block (medical, pets); every block keeps its own Edit" },
    { k: "better", zh: "「付款记录」统一叫「缴费记录」；退款显示红色负数并带「退款」标签", en: "Payment records are consistently called Payments; refunds show as red negatives with a Refund tag" }
  ] },

  { v: "2026-11-19.28", title: { zh: "卡与账户：先看详情，每一块各自编辑", en: "Cards & accounts: details first, each block edited on its own" }, items: [
    { k: "better", zh: "点一张卡或账户，先进详情页；右上角 ⋯ 有停用 / 启用、复制为新卡、删除；原来表单底部的删除按钮搬到这里", en: "Tapping a card or account opens a details page first; the ⋯ menu has Deactivate / Activate, Copy as new and Delete (the Delete button moved here from the bottom of the form)" },
    { k: "better", zh: "这张卡 / 还款 / 返现规则 / 开卡奖励 / 报销额度 / 备注，每块带自己的「编辑」，点进去只改这一块，保存后回到详情页", en: "The card, Repayment, Rewards, Sign-up bonus, Credits and Notes blocks each have their own Edit that changes only that block and returns to the details" },
    { k: "new", zh: "新增「复制为新卡」：把返现规则、网络、年费、持卡人带过去，末四位、到期、账单日、奖励不带", en: "New Copy as new card: it carries over rewards, network, annual fee and holder, but not the last four digits, expiry, due days or bonus" }
  ] },

  { v: "2026-11-19.27", title: { zh: "物品详情页名称排版更整齐；单块编辑页不再折叠", en: "Tidier item name layout; single-block edit pages no longer fold" }, items: [
    { k: "better", zh: "物品详情页：图标和名称连在一起，只有名称太长才换行；缺货等标志跟在名称后面，整组不拆开（一行放不下就整组换到第二行）；⋯ 固定在右边、上下居中", en: "Item details: the icon stays with the name (the name wraps only when it is too long); stock flags follow it as one group (the whole group drops to line two if it does not fit); the ⋯ button stays at the right, centered" },
    { k: "better", zh: "点某一块的「编辑」进入的页面，这一块直接平铺显示，不再有折叠箭头，基本信息上也不再显示缺货等标志", en: "The page you get from a block's Edit shows that block flat, with no fold arrow and no stock flags on Basics" }
  ] },

  { v: "2026-11-19.26", title: { zh: "库存物品：先看详情，每一块各自编辑", en: "Inventory items: details first, each block edited on its own" }, items: [
    { k: "better", zh: "点库存里的物品，现在先进详情页，不再直接进编辑表单；第一块是名称（靠左）和缺货 / 少货等标志，右上角 ⋯ 里有拍包装录入、加入购物车、复制为新物品、删除", en: "Tapping an inventory item now opens a details page instead of the edit form; the first block shows the name with its stock flags and a ⋯ menu (scan packaging, add to cart, copy as new, delete)" },
    { k: "better", zh: "基本信息、数量与提醒、备注三块各带自己的「编辑」，点进去只改这一块；详情页底部导航不再被遮挡", en: "Basics, Quantity & reminders and Notes each have their own Edit that changes only that block; the details page keeps the bottom tabs" }
  ] },

  { v: "2026-11-19.25", title: { zh: "房屋 / 车辆概览：表头的「编辑」换成 ⋯ 里的「详情」；车辆资料页展开成完整信息", en: "House / vehicle overview: the header Edit became Details in the ⋯ menu; the vehicle profile shows full details" }, items: [
    { k: "better", zh: "房屋概览和车辆概览表头不再有「编辑」按钮：右上角 ⋯ 的第一项是「详情」，进去就是基本资料页，每一块各自带「编辑」，只改这一块", en: "The house and vehicle overviews no longer have an Edit button in the header: the first item in the ⋯ menu is Details, which opens the profile page where each block has its own Edit" },
    { k: "better", zh: "车辆资料页每一块都展开显示填过的全部信息（车牌与里程、证照、车险、年款与保修…），和房屋资料页一样", en: "Each block of the vehicle profile now lists everything you filled in (plate & mileage, documents, insurance, year & warranty…), like the house profile" }
  ] },

  { v: "2026-11-19.24", title: { zh: "房屋首页：买卖计划可折叠；各房产要处理的事改成 4 张小卡片", en: "House home: Buy / sell plans collapse; things to handle are four small cards" }, items: [
    { k: "better", zh: "买卖计划默认折叠，点一下展开（展开或收起会记在这台设备上）", en: "Buy / sell plans are collapsed by default; tap to expand (remembered on this device)" },
    { k: "better", zh: "“各房产要处理的事”不再用下拉，改成 4 张小卡片（设备与车辆、季节任务、交易、耗材 · HOA · 保险），每张显示件数，点一张只看这一类，再点一次回到全部", en: "Things to handle no longer uses a dropdown: four small cards (assets & vehicles, seasonal tasks, deals, supplies · HOA · insurance) with counts; tap one to filter, tap again to see all" }
  ] },

  { v: "2026-11-19.23", title: { zh: "往上滑时，底部中央出现「回到顶部」", en: "A Back to top button appears at the bottom center while you scroll up" }, items: [
    { k: "new", zh: "页面滚下去一段后，手势持续往上滑，底部中央会冒出一个圆形的「回到顶部」按钮，点一下平滑回到顶部；往下滑、停下几秒或已经在顶部附近就自动收起", en: "After scrolling down, keep scrolling up and a round Back to top button appears at the bottom center; tap it to glide to the top. It hides when you scroll down, pause for a few seconds, or are near the top" }
  ] },

  { v: "2026-11-19.22", title: { zh: "底部导航只在有“取消 / 保存”栏的表单里才隐藏", en: "The bottom tab bar is hidden only on forms that have a Cancel / Save bar" }, items: [
    { k: "fix", zh: "房屋资料页、账单的缴费记录页和特别摊派列表页，以前底部导航被藏起来了，现在保留；只有底部带“取消 / 保存”栏的表单才隐藏导航，让保存栏贴底", en: "House profile, bill payment records and the special assessment list used to hide the bottom tabs; they now keep them. Only forms with a bottom Cancel / Save bar hide the tabs so the bar sits at the bottom" }
  ] },

  { v: "2026-11-19.21", title: { zh: "筛选条统一：缴费记录页、商店页的清除筛选也收进手机的筛选面板", en: "Filters unified: Clear filters on the payment records and Shops pages now live inside the phone filter panel" }, items: [
    { k: "better", zh: "账单的缴费记录页、常去的商店、商店特价、特价一览：手机上点开「筛选」，第一行是「筛选」字样和右边的「清除筛选」，和其他页面一样", en: "Bill payment records, Shops, Shop deals and Deals overview: on a phone, Filters now opens with a title row and Clear filters on the right, like the other pages" },
    { k: "fix", zh: "商店页的「筛选」按钮原来跑到搜索框前面，现在在搜索框后面", en: "On the Shops pages the Filters button used to sit before the search box; it now comes after it" }
  ] },

  { v: "2026-11-19.20", title: { zh: "只交特别摊派的缴费，不再把本期到期日往后推", en: "Payments that only cover a special assessment no longer move the due date forward" }, items: [
    { k: "fix", zh: "记缴费时只勾了特别摊派的期、本期金额留空（或填 0）：这笔缴费不再算作交了本期，下次到期日不变，也不再把本期标成已缴", en: "When a payment only ticks special assessment installments and the period amount is empty or 0, it no longer counts as paying this period: the next due date stays and the period is not marked paid" }
  ] },

  { v: "2026-11-19.19", title: { zh: "特别摊派：一次性结清、加一期分期、撤销，重新生成只换没缴的", en: "Special assessments: pay off, add an installment, undo; regenerate only replaces unpaid ones" }, items: [
    { k: "new", zh: "摊派卡片的 ⋯ 新增「一次性结清」：打开记缴费表单，已勾上这笔摊派所有没缴的期、合计就是剩余余额；提交后这些期合并成一行“一次性结清”，缴费记录里看到的是已缴的分期 + 结清", en: "New Pay off in the assessment ⋯ menu: the payment form opens with all unpaid installments ticked (the total is what is left); on submit they merge into one Payoff row" },
    { k: "new", zh: "新增「加一期分期」：打开编辑页，末尾预置一行新的分期（日期是最后一期往后一个月，金额同上一期）", en: "New Add an installment: opens the edit page with a new row at the end (a month after the last one, same amount)" },
    { k: "new", zh: "已缴的一期有 ⋯：只标了“已缴（无缴费记录）”的可以直接撤销改回待缴；交在某笔缴费里的，跳到那笔缴费取消勾选", en: "Paid installments have a ⋯ menu: ones marked paid without a payment can be undone directly; ones paid by a payment jump to that payment to untick" },
    { k: "better", zh: "编辑页的「重新生成」只替换没缴的分期（已缴的和结清行不动），总额默认是剩余未缴，替换前会确认；删除摊派时会说明有几笔缴费会保留", en: "Regenerate on the edit page only replaces unpaid installments (total defaults to what is left, with a confirmation); deleting an assessment says how many payments are kept" }
  ] },

  { v: "2026-11-19.18", title: { zh: "特别摊派有了自己的缴费记录页，能搜索和筛选", en: "Special assessments get their own payment records page with search and filters" }, items: [
    { k: "new", zh: "摊派卡片的 ⋯ 菜单（或「已缴」小节下面）新增「缴费记录」：已缴的每一期一行，能按日期、金额、摊派名称搜索，按类型（分期 / 一次性结清）、年份筛选，也能换排序", en: "New Payment records page from the ⋯ menu (or under the Paid section): one row per paid installment, searchable, filterable by type and year, sortable" },
    { k: "better", zh: "有缴费记录的行可以点进那笔缴费；同一账单有多笔摊派时，可以在页面上切换看哪一笔或全部", en: "Rows with a payment record open that payment; with several assessments on one bill you can switch between them or see all" }
  ] },

  { v: "2026-11-19.17", title: { zh: "特别摊派卡片更清爽：待缴 / 已缴分开折叠，操作收进 ⋯", en: "Cleaner special assessment cards: Unpaid / Paid sections, actions in ⋯" }, items: [
    { k: "better", zh: "每笔摊派的卡片去掉了整张折叠的箭头，改成「待缴」「已缴」两个小节，各自折叠（默认收起）", en: "Each assessment card no longer collapses as a whole; it now has Unpaid and Paid sections that collapse separately (closed by default)" },
    { k: "better", zh: "卡片上直接看到：未缴多少（几笔、几笔按分期）、已缴多少、最近一次缴费、即将到期的一期；备注收进名称旁的 ⓘ", en: "The card shows unpaid and paid totals, the last payment and the next due; notes moved into an ⓘ next to the name" },
    { k: "better", zh: "右上角的「编辑」换成 ⋯ 菜单（编辑、复制为新摊派、删除），手机上长按整张卡也能打开", en: "The Edit button became a ⋯ menu (Edit, Copy as new, Delete); long-press the card on a phone to open it too" }
  ] },

  { v: "2026-11-19.16", title: { zh: "长按一行弹出操作，其他页面也能用了", en: "Long-press row actions now work on the other pages too" }, items: [
    { k: "new", zh: "手机上长按一行，底部弹出这一行能做的事：库存、补货、购物清单、花费记录、收入记录、保养记录、设备和车辆、卡与账户、医疗付款、储蓄目标、商店和特价、历史交易", en: "On a phone, long-press a row for its actions: Inventory, Restock, Shopping, Spending and Income records, Maintenance logs, Assets and vehicles, Cards and accounts, Medical payments, Savings goals, Shops and deals, Deal history" },
    { k: "better", zh: "每页的菜单按各自的业务来：购物清单有「我来买 / 已买到」，库存有「加入购物车」，卡有「停用 / 启用」，商店有「本周广告 / 更新特价」等", en: "Each page has its own actions: Shopping has I'll buy / Bought, Inventory has Add to cart, Cards have Deactivate / Activate, Shops have This week's ad / Update deals" }
  ] },

  { v: "2026-11-19.15", title: { zh: "手机上长按一行，弹出这一行的更多操作", en: "Long-press a row on your phone for its more actions" }, items: [
    { k: "new", zh: "缴费记录、全部账单、家庭成员的登录设备：在手机上长按一行，底部弹出这一行能做的事（编辑、复制、删除、记缴费、查看详情等）；电脑上用每行右边的 ⋯", en: "Payment records, All bills and Family devices: long-press a row on a phone for a bottom sheet of actions (edit, copy, delete, log payment, details…); on desktop use the ⋯ on each row" },
    { k: "new", zh: "缴费记录新增「复制为新一笔」：带入这笔的金额和方式，日期改成今天，再改一改就能记新的一笔", en: "Payment records get Copy as new payment: it brings in the amount and method with today's date, ready to adjust and save" },
    { k: "better", zh: "缴费记录每一行右边多了 ⋯ 菜单（编辑 / 复制 / 删除），电脑上也能删了", en: "Each payment record now has a ⋯ menu (edit / copy / delete), so you can delete on desktop too" }
  ] },

  { v: "2026-11-19.14", title: { zh: "手机上的筛选更整齐：「清除筛选」收进筛选面板", en: "Tidier filters on phones: Clear filters now lives inside the filter panel" }, items: [
    { k: "better", zh: "手机上点开「筛选」，面板第一行是「筛选」字样，右边是「清除筛选」（没改过筛选时不显示），不再单独占一行把搜索框和下拉隔开", en: "On phones, opening Filters shows a header row with the title and Clear filters on the right (hidden until a filter is set), instead of a separate row between the search box and the dropdowns" },
    { k: "better", zh: "点「清除筛选」后面板保持打开，马上能看到已恢复默认", en: "The panel stays open after Clear filters so you can see everything back at default" }
  ] },

  { v: "2026-11-19.13", title: { zh: "修复：深色主题下「已选 n 个」这类浅底数字角标的字看不清", en: "Fix: soft count badges unreadable in the dark theme" }, items: [
    { k: "fix", zh: "手动选深色主题时，「已选 n 个」这类浅底数字角标变成深字配深底、几乎看不见，现在恢复清楚", en: "With the dark theme picked manually, soft count badges (like '3 selected') showed dark text on a dark fill; they are readable again" }
  ] },
  { v: "2026-11-19.12", title: { zh: "补上财务首页「全部账单」的英文说明", en: "Added the English description for All bills on the Finance home" }, items: [
    { k: "fix", zh: "英文界面下，财务首页「全部账单」那一行的说明不再显示中文", en: "In English, the All bills description on the Finance home is no longer shown in Chinese" }
  ] },

  { v: "2026-11-19.11", title: { zh: "深色主题下数字角标的字看得清了", en: "Count badges readable in the dark theme" }, items: [
    { k: "fix", zh: "手动选了深色主题时，数字角标里的字几乎看不清，现在清楚了", en: "With the dark theme picked manually, the numbers inside count badges were nearly unreadable; they are clear now" }
  ] },
  { v: "2026-11-19.10", title: { zh: "全部账单页更简洁：操作收进 ⋯，说明收进 ⓘ，右下角加号加账单", en: "Cleaner All bills page: actions in ⋯, notes in ⓘ, + button to add" }, items: [
    { k: "better", zh: "全部账单：第一行只留眼睛和 ⋯（添加账单、批量标记已核对、导出 CSV）；原来的“全部标为已核对”按钮去掉，右下角加了圆形 ＋ 添加账单", en: "All bills: the top row keeps just the eye and ⋯ (Add bill, Mark checked in bulk, Export CSV); the Mark all checked button is gone and a round + button adds a bill" },
    { k: "better", zh: "页面上长长的说明文字改成 ⓘ：标题旁是时间范围说明，“含估算 / Escrow”等说明放在对应的“应付”“余额”卡片旁，悬停或点一下查看", en: "Long notes became ⓘ tips: the time-range note sits beside the title, and estimate / Escrow notes sit on the Total due and Balance cards (hover or tap)" },
    { k: "better", zh: "账单概览：眼睛挪到第一行，在“全部账单”链接左边", en: "Bills overview: the eye moved to the first row, left of the All bills link" }
  ] },

  { v: "2026-11-19.9", title: { zh: "修复：家庭成员里「登出」别的设备没反应", en: "Fix: Log out on another device in Family members did nothing" }, items: [
    { k: "fix", zh: "我的 → 家庭成员 → 登录设备里，点 ⋯ → 登出别的设备，现在会弹出确认，确认后设备马上从列表里消失", en: "In Me → Family members → Devices, ⋯ → Log out on another device now asks for confirmation and the device disappears from the list right away" }
  ] },

  { v: "2026-11-19.8", title: { zh: "数字小圆标统一样式；库存里的「全部加入购物车」在手机上更好点", en: "Count badges share one style; Add all to cart is easier to tap on phones" }, items: [
    { k: "better", zh: "库存「全部加入购物车」按钮上的红色数字、物品表单里「关联设备」已选个数，改用统一的数字小圆标", en: "The red number on Add all to cart and the selected count on Linked devices now use the shared count badge" },
    { k: "fix", zh: "库存「全部加入购物车」按钮在手机上加高到 44px，更容易点", en: "The Add all to cart button on Inventory is now 44px tall on phones" }
  ] },

  { v: "2026-11-19.7", title: { zh: "库存卡片的状态标签和其他标签统一样式", en: "Inventory card status tags now match other tags" }, items: [
    { k: "better", zh: "库存页每个分类卡片上的「缺货 / 少货 / 充足 / 空」标签，字号和圆角和其他页面的标签一致", en: "The Out / Low / OK / Empty tags on the Inventory category cards now match the tags used on other pages in size and shape" }
  ] },

  { v: "2026-11-19.6", title: { zh: "电脑上选项多的下拉，可以直接打字筛选", en: "Longer dropdowns can be filtered by typing on desktop" }, items: [
    { k: "better", zh: "电脑上，选项超过 8 个的下拉（资产、位置、付款账户等）现在可以直接打字筛选；选项少的仍然点一下就选。手机不变", en: "On desktop, dropdowns with more than 8 options (assets, locations, payment accounts, etc.) can now be filtered by typing; short ones still work with a click. Phones are unchanged" },
    { k: "fix", zh: "月份、人员、账户等本来就不需要搜索的下拉，保持原来点选的样子", en: "Month, person, account and similar dropdowns that never needed searching keep their plain click-to-select behavior" }
  ] },

  { v: "2026-11-19.5", title: { zh: "关联资产、房产的下拉改用统一的可搜索下拉", en: "Asset and property dropdowns now use the shared searchable dropdown" }, items: [
    { k: "better", zh: "账单里的「关联资产」「房产」和概览的「按资产筛选」，现在和物品里的大类下拉一样：电脑上直接打字筛选，手机上点开是底部弹层", en: "The Linked asset, Property and Filter by asset dropdowns now behave like the category dropdown: type to filter on desktop, a bottom sheet on phones" },
    { k: "fix", zh: "下拉里打字筛选、没有匹配项时，不再残留上一个分组的标题", en: "When a dropdown filter finds no match, a leftover group heading is no longer shown" }
  ] },

  { v: "2026-11-19.4", title: { zh: "手机上的小按钮更好点", en: "Small buttons are easier to tap on phones" }, items: [
    { k: "better", zh: "手机上各页面的小按钮（如商店的「更新特价」、账单的「已核对」）加高到更容易点按；电脑上保持原样", en: "Small buttons on phones (e.g. Update deals in Shops, Mark checked in Bills) are taller and easier to tap; desktop is unchanged" }
  ] },

  { v: "2026-11-19.3", title: { zh: "整理：新增统一的徽标、铃铛、提示样式和控件图鉴页", en: "Housekeeping: shared badge, bell and hint styles, plus a controls gallery page" }, items: [
    { k: "better", zh: "新增一套统一的徽标、提醒铃铛（带数字 / 红点角标）和问号提示的样式，还有一个展示它们的图鉴页（styleguide.html）；现在的页面还没用上，外观不变", en: "Added shared badge, notification bell (with count / dot) and hint styles, and a gallery page (styleguide.html) that shows them; existing pages don't use them yet, so nothing looks different" }
  ] },

  { v: "2026-11-19.2", title: { zh: "表单里的输入框、下拉、日期大小统一", en: "Form fields now share one size" }, items: [
    { k: "better", zh: "添加 / 编辑物品、设备等表单里的输入框、下拉和日期，字号和高度和其他页面一致（以前电脑上表单里的字偏小）", en: "Inputs, dropdowns and dates in the add / edit forms now match the rest of the app in text size and height (they were slightly smaller on desktop)" }
  ] },

  { v: "2026-11-19.1", title: { zh: "启动更快：花费明细和统计页面改成用到时才加载", en: "Faster start: the Spending records and Stats pages now load only when opened" }, items: [
    { k: "better", zh: "花费明细、花费统计这几个页面的程序不再在打开应用时下载，进到对应页面才加载；功能和以前一样", en: "The Spending records and Stats pages are no longer downloaded when the app opens, only when you visit them; features are unchanged" }
  ] },

  { v: "2026-11-18.53", title: { zh: "启动更快：设置和家庭成员页面改成用到时才加载", en: "Faster start: Settings and Family pages now load only when opened" }, items: [
    { k: "better", zh: "设置页和家庭成员页的程序不再在打开应用时下载，进到设置才加载，启动少下载约 50KB；功能和以前一样", en: "The Settings and Family pages are no longer downloaded when the app opens, only when you visit them (about 50KB less at start); features are unchanged" }
  ] },

  { v: "2026-11-18.52", title: { zh: "启动更快：信用卡页面改成用到时才加载", en: "Faster start: the Cards pages now load only when opened" }, items: [
    { k: "better", zh: "信用卡页面和卡表单的程序不再在打开应用时下载，进到卡页面才加载，启动少下载约 40KB；功能和以前一样", en: "The Cards page and card form are no longer downloaded when the app opens, only when you visit them (about 40KB less at start); features are unchanged" }
  ] },

  { v: "2026-11-18.51", title: { zh: "修复：发新版后旧页面点进新页面提示 404", en: "Fix: an already-open page showed a 404 error after a new release" }, items: [
    { k: "fix", zh: "应用更新后，之前就开着的页面点进房屋等页面会提示加载失败；现在会自动刷新一次换成新版，不用手动刷新", en: "After an update, a page that was already open could show a load error when opening House and other pages; it now refreshes itself once to get the new version" }
  ] },

  { v: "2026-11-18.50", title: { zh: "启动更快：库存、购物车、菜单、补货页面改成用到时才加载", en: "Faster start: Inventory, Shopping, Meals and Restock pages now load only when opened" }, items: [
    { k: "better", zh: "库存、购物车、菜单、补货这几个页面的程序不再在打开应用时下载，进到对应页面才加载，启动少下载约 50KB；功能和以前一样", en: "The programs for the Inventory, Shopping, Meals and Restock pages are no longer downloaded when the app opens, only when you visit them (about 50KB less at start); features are unchanged" }
  ] },

  { v: "2026-11-18.49", title: { zh: "启动更快：净资产页面改成用到时才加载", en: "Faster start: the Net worth page now loads only when opened" }, items: [
    { k: "better", zh: "净资产页面的程序不再在打开应用时下载，进到净资产页才加载；卡里的余额面板照常显示", en: "The Net worth page is no longer downloaded when the app opens, only when you visit it; the balance panel on cards works as before" }
  ] },

  { v: "2026-11-18.48", title: { zh: "启动更快：医疗 / 一次性账单页面改成用到时才加载", en: "Faster start: the one-time (medical) bills pages now load only when opened" }, items: [
    { k: "better", zh: "一次性（医疗）账单页面的程序不再在打开应用时下载，进到这类页面才加载，首页启动少下载约 70KB；功能和以前一样", en: "The one-time (medical) bill pages are no longer downloaded when the app opens, only when you visit them (about 70KB less at start); features are unchanged" }
  ] },

  { v: "2026-11-18.47", title: { zh: "内部整理：物品表单的程序文件拆小", en: "Under the hood: the item form program split into smaller files" }, items: [
    { k: "better", zh: "把物品表单的程序文件按保存、独立字段拆成几个小文件；页面和操作和以前一样", en: "The item form program is split into save and field files; pages and actions work as before" }
  ] },

  { v: "2026-11-18.46", title: { zh: "内部整理：数据读写层的大程序文件拆小", en: "Under the hood: the data-layer program split into smaller files" }, items: [
    { k: "better", zh: "把一千四百多行的数据读写程序，按储藏、商店、花费、房产、账单、财务、成员分成十几个小文件；页面和操作和以前一样", en: "The 1,400-line data-layer program is split by area (pantry, shops, spending, house, bills, finance, members) into small files; pages and actions work as before" }
  ] },

  { v: "2026-11-18.45", title: { zh: "内部整理：咩咩咩、录入购物、设置、借贷等十个程序文件拆小", en: "Under the hood: Ask AI, Receipt entry, Settings, Debts and six more programs split into smaller files" }, items: [
    { k: "better", zh: "把咩咩咩、录入购物、设置、借贷、自动填表、出了问题、收款方、商店逻辑等十个三四百到五百多行的程序文件，按功能拆成一百多行的小文件；页面和操作和以前一样", en: "Ten programs of 300–560 lines (Ask AI, Receipt entry, Settings, Debts, autofill, Fix, Payees, Stores logic…) are split by function into files of about a hundred lines; pages and actions work as before" }
  ] },

  { v: "2026-11-18.44", title: { zh: "内部整理：储藏、花费统计、卡与账户、预算几个大程序文件拆小", en: "Under the hood: Pantry, Spending stats, Cards and Budget programs split into smaller files" }, items: [
    { k: "better", zh: "把储藏页面、花费统计、卡与账户、预算这几个五六百到近九百行的程序文件，按功能拆成一两百行的小文件；页面和操作和以前一样", en: "The Pantry pages, Spending stats, Cards & accounts and Budget programs, each 500 to nearly 900 lines, are split by function into files of one to two hundred lines; pages and actions work as before" }
  ] },

  { v: "2026-11-18.43", title: { zh: "内部整理：银行导入、借贷、账单表单、交易几个大程序文件拆小", en: "Under the hood: bank import, debts, bill forms and deals programs split into smaller files" }, items: [
    { k: "better", zh: "把银行对账单导入、借贷、账单表单、房屋交易这几个六七百行的程序文件，按功能拆成一两百行的小文件；页面和操作和以前一样", en: "Bank statement import, Debts, Bill forms and House deals, each 600–800 lines, are split by function into files of one to two hundred lines; pages and actions work as before" }
  ] },

  { v: "2026-11-18.42", title: { zh: "内部整理：收入、设备、房屋资料、商店几个大程序文件拆小", en: "Under the hood: large Income, Assets, House profile and Stores files split into smaller ones" }, items: [
    { k: "better", zh: "把收入页、设备页、房屋资料页、常去的商店页这几个一千行上下的程序文件，按功能（总览、明细、表单、导出、保存…）拆成一两百行的小文件，以后改动更不容易出错；页面和操作和以前一样", en: "The Income, Assets, House profile and Favorite stores programs, each around a thousand lines, are now split by function (overview, records, forms, export, saving…) into files of one to two hundred lines; pages and actions work as before" }
  ] },

  { v: "2026-11-18.41", title: { zh: "打开更快：财务的账单概览页点进去才下载", en: "Faster to open: the Finance bills overview downloads only when you open it" }, items: [
    { k: "better", zh: "财务里的账单概览页，以及它带进来的账单表单、向导等程序，第一次点进去才下载，打开应用和看今日页、储藏时不再带上；页面和操作和以前一样", en: "The Finance bills overview, along with the bill forms and wizards it pulls in, now downloads the first time you open it, not at launch; pages and actions work as before" }
  ] },

  { v: "2026-11-18.40", title: { zh: "打开更快：收入页和常去的商店页点进去才下载", en: "Faster to open: Income and Favorite stores pages download only when you open them" }, items: [
    { k: "better", zh: "收入（明细、类型、付款方）和常去的商店这两大块程序，第一次点进去才下载，打开应用、看今日页、储藏、账单时不再带上；页面和操作和以前一样", en: "The Income pages and the Favorite stores pages now download the first time you open them, not at launch; pages and actions work as before" }
  ] },

  { v: "2026-11-18.39", title: { zh: "内部整理：主程序再拆小，用法不变", en: "Under the hood: main program split further, nothing changes for you" }, items: [
    { k: "better", zh: "把处理点击、表单提交、下拉选择的大段程序按领域（储藏、房屋、财务、家庭设置、今日页）拆成小文件，主程序文件从两千多行缩到一百多行；页面和操作和以前一样", en: "Click, form-submit and select handling is now split by area (pantry, house, finance, family settings, Today) into small files, and the main program file shrank from 2,000+ lines to about 150; pages and actions work as before" }
  ] },

  { v: "2026-11-18.38", title: { zh: "内部整理：发布用的程序文件处理方式调整，用法不变", en: "Under the hood: release file handling tweaked, nothing changes for you" }, items: [
    { k: "better", zh: "发布时程序文件的换行符不再被系统自动改写，避免检查「是不是最新版」时误报；页面和操作和以前一样", en: "Line endings of the released program files are no longer rewritten automatically, which avoids false \"out of date\" warnings; pages and actions work as before" }
  ] },

  { v: "2026-11-18.37", title: { zh: "打开应用明显更快：程序文件打包发布", en: "Much faster to open: app files are now bundled" }, items: [
    { k: "better", zh: "第一次打开时要下载的文件从一百多个合并成十几个，下载量也少了三分之一以上；慢网络下打开快了一半左右", en: "The first open now downloads a handful of files instead of 150+, with over a third less data; on slow connections it opens about twice as fast" },
    { k: "better", zh: "页面和操作和以前一样；没访问过的页面仍然点进去才下载", en: "Pages and actions work as before; pages you haven't visited still download only when you open them" }
  ] },

  { v: "2026-11-18.36", title: { zh: "内部整理：主程序拆成更小的文件，用法不变", en: "Under the hood: main program split into smaller files, nothing changes for you" }, items: [
    { k: "better", zh: "把最大的一个程序文件拆成按职责分开的小文件（读数据、渲染、路由、登录、购物车操作等），以后改东西更不容易出错；页面和操作和以前一样", en: "The largest program file is now split into small files by job (data loading, rendering, routing, sign-in, cart actions…) so future changes are safer; pages and actions work as before" }
  ] },

  { v: "2026-11-18.35", title: { zh: "房屋相关页面点进去才下载，打开应用更快", en: "House pages now download only when you open them" }, items: [
    { k: "better", zh: "设备、保养记录、季节任务、交易、买卖计划、房屋资料这些房屋页面，第一次点进房屋页签才下载，打开应用和看今日页、储藏、账单时不再带上", en: "House pages (assets, maintenance, seasonal tasks, deals, buy/sell plans, house profile) now download the first time you open the House tab, not when the app starts" },
    { k: "better", zh: "标签页标题和浏览器通知里的提醒数，现在只统计储藏补货和周期账单；设备、季节任务、交易的提醒在「全部待办和提醒」里看", en: "The tab-title and notification count now covers pantry restocks and recurring bills only; maintenance, seasonal and deal alerts are under All to-dos and alerts" }
  ] },

  { v: "2026-11-18.34", title: { zh: "今日页更轻：只放能立刻看到的几件事", en: "Lighter Today page: only what can be shown right away" }, items: [
    { k: "better", zh: "今日页的「待办」只放购物车、储藏补货、待缴账单；设备保养、季节任务、预算等各模块的提醒，点「全部待办和提醒」再看", en: "Today's To-do card now shows only the cart, pantry restocks and unpaid bills; alerts from other areas (maintenance, seasonal tasks, budget…) are under All to-dos and alerts" },
    { k: "better", zh: "今日页的「钱 · 本月」只读最近两个月的统计，不再带净资产（去 财务 → 净资产 看）", en: "Today's Money card reads only the last two months and no longer shows net worth (see Finance → Net worth)" },
    { k: "better", zh: "「全部待办和提醒」这一页点进去才下载，打开应用时不再带上", en: "The All to-dos and alerts page now downloads only when you open it" }
  ] },

  { v: "2026-11-18.33", title: { zh: "首次打开更快：有些页面点进去才下载", en: "Faster first open: some pages now download only when you open them" }, items: [
    { k: "better", zh: "录入购物、对账单、借贷、财务资产、出了问题、物品表单、咩咩咩、介绍这些页面，第一次点进去才下载，打开应用时不再带上", en: "Receipt entry, statements, debts, financial assets, Fix, the item form, Ask AI and About now download only the first time you open them, not at launch" },
    { k: "better", zh: "网络不好时，页面没下载下来会提示并给一个「重试」按钮", en: "If a page can't be downloaded on a weak connection, you now see a message with a Retry button" }
  ] },

  { v: "2026-11-18.32", title: { zh: "首次打开更快：不再提前下载用不到的东西", en: "Faster first open: no more downloading things you don't use" }, items: [
    { k: "better", zh: "第一次打开时，英文界面的词库只有选了 English 才会下载，中文用户少下载约一半的数据", en: "The English word list is now downloaded only when the app is set to English, so Chinese users skip a large chunk of data on first open" },
    { k: "better", zh: "发布日志的内容改成点开发布日志页或有新版本提示时才加载，不再每次打开都带上", en: "Release notes now load only when you open the Release notes page or a new-version banner is due, not on every launch" }
  ] },

  { v: "2026-11-18.31", title: { zh: "拍小票 / AI 录入：退货会扣库存，不再当成又买了一份", en: "Receipt / AI entry: returns now take stock off instead of adding it" }, items: [
    { k: "fix", zh: "小票里的退货 / 退款，数量记成负数：库存里有这件东西就扣掉（扣到 0 为止），花费记负数；以前会当成又买了一份，库存反而多加", en: "A returned or refunded product is now a negative quantity: it takes stock off the matching item (down to 0) and records a negative spend; before, it was added to stock as if bought again" },
    { k: "fix", zh: "同一张小票里买了又整件退掉的同名商品，不再被当成折扣合并成一行（以前金额抵消了、库存却照加）；只退一部分钱的优惠仍然合并", en: "A product bought and fully returned on the same receipt is no longer merged as a discount (the amount cancelled but stock still went up); partial price cuts are still merged" },
    { k: "better", zh: "退货行下面会提示「库存会减掉几件」；只想记花费、不动库存，把「放进库存」改成「只记花费，不入库」；库存里没有的退货默认只记花费，也不会把购物车里的项目标成已买到", en: "Return lines say how many will come off stock; choose Spend only to leave stock alone; returns with no matching item default to spend-only and no longer tick off a shopping-list item" }
  ] },

  { v: "2026-11-18.30", title: { zh: "全部账单：合计卡片上面不再多出一只眼睛", en: "All bills: no duplicate eye icon above the totals" }, items: [
    { k: "fix", zh: "全部账单的三张合计小卡上面多了一只「隐藏金额」的眼睛，和页面右上角那只重复，已去掉（右上角那只照常管这页的金额）", en: "Removed the duplicate hide-amounts eye that appeared above the three totals cards; the one at the top right still controls this page" }
  ] },

  { v: "2026-11-18.29", title: { zh: "全部账单：合计改成三张小卡，放在搜索框上面", en: "All bills: the totals are now three small cards above the search box" }, items: [
    { k: "better", zh: "「共 N 笔、应付、已付、余额」不再是搜索框下面的一行粗体字，改成应付 / 已付 / 余额三张小卡，放在搜索框上面；手机上也是并排三张", en: "The count, total due, paid and balance are now three small cards above the search box instead of a bold line below it; they stay side by side on phones" },
    { k: "better", zh: "「全部标为已核对」按钮挪到筛选条下面，不再夹在合计和搜索框中间", en: "The mark-all-verified button moved below the filters so it no longer sits between the totals and the search box" }
  ] },

  { v: "2026-11-18.28", title: { zh: "共同花费分摊改成按家庭成员算", en: "Shared-expense split now works per family member" }, items: [
    { k: "better", zh: "「家庭分摊」按家庭成员（人）算：一个人有几台设备，记的账合在一起；占比也按家庭成员设置（原来按设备设的占比会自动带过来）；还没链接家庭成员的设备各算一个参与者", en: "The family split works per family member: a person's devices are combined; shares are set per family member (shares previously set per device carry over); a device not linked to a family member counts as its own participant" }
  ] },

  { v: "2026-11-18.27", title: { zh: "交易信息保存后回交易首页（清单）；全应用「谁做的」统一显示家庭成员的名字", en: "Saving deal info returns to the deal home (checklist); who-did-it names are now the family member everywhere" }, items: [
    { k: "fix", zh: "房屋 → 交易：在「交易信息」里保存后，回到交易首页，并默认进「清单」，不再停在编辑页", en: "Home → Deals: saving the Deal info page returns to the deal home on the Checklist tab instead of staying on the edit page" },
    { k: "better", zh: "全应用统一：显示「谁做的」（交易进展、清单完成人、购物认领、季节任务、今日问候…）都用家庭成员的名字，设备没链接家庭成员才用设备名；以后记下来的名字也都是家庭成员的名字，原来记成设备名的几条（比如「Hang IPhone 13」「妈妈-设备2」）已改成家庭成员的名字", en: "One rule everywhere: who-did-it names (deal progress, checklist completion, shopping claims, seasonal tasks, the Today greeting…) use the family member's name, falling back to the device name only if the device is not linked; names saved from now on are family-member names too, and the few saved as device names (such as Hang IPhone 13 and Mom device 2) were corrected" }
  ] },

  { v: "2026-11-18.26", title: { zh: "账单页的摊派块：每一行可以点，直接打开那笔摊派", en: "The assessments block on a bill page: each row opens that assessment" }, items: [
    { k: "better", zh: "HOA 账单页里「特别摊派」那块，每一行（名称、进度、剩余金额）整行可点，进入摊派页并自动展开、滚到那一笔，其余摊派收起", en: "On the HOA bill page every row of the Special assessment block (name, progress, remaining) opens the assessment page at that assessment, expanded and scrolled into view, with the others collapsed" }
  ] },

  { v: "2026-11-18.25", title: { zh: "特别摊派列表：每笔摊派一张可折叠的卡片，已缴的各期单独折叠", en: "Special assessment list: one collapsible card per assessment, paid rows in their own fold" }, items: [
    { k: "better", zh: "HOA 的特别摊派做成列表：每笔摊派是一张可折叠展开的卡片，头部一直显示名称、进度、描述和编辑按钮；展开后先是还没缴的各期，已缴的各期收在下面一个单独的折叠里（默认收起，标题写着已缴几期、多少钱）", en: "HOA special assessments are a list: each is a collapsible card whose header always shows the name, progress, description and Edit; unpaid rows come first and the paid rows sit in a separate fold below (collapsed by default, titled with how many were paid and the amount)" }
  ] },

  { v: "2026-11-18.24", title: { zh: "全部缴费记录「加载更多」；推送后不再看到旧版本；补录 HOA 2024–2025 缴费记录", en: "All payments: Load more; no more stale versions after a release; HOA 2024–2025 payments backfilled" }, items: [
    { k: "better", zh: "账单的「全部缴费记录」页一次显示 20 条，「加载更多」再加 20 条；搜索 / 筛选后回到第一页，合计仍是全部符合条件的", en: "A bill's All payments page shows 20 at a time with Load more for 20 more; searching or filtering goes back to the first page and the total still covers everything that matches" },
    { k: "fix", zh: "推送新版本后，浏览器有时还在用 10 分钟内缓存的旧脚本，出现「改动没生效」；现在每次打开都会核对脚本和样式有没有更新（没变时几乎不花流量）", en: "After a release the browser sometimes kept using scripts cached for up to 10 minutes, so changes seemed not to apply; every load now checks scripts and styles for updates (almost no traffic when unchanged)" },
    { k: "new", zh: "补录 HOA 月费 2024 年 1–11 月、2025 年 1–7 月的缴费记录（参照已有记录复制、改日期），并关联到银行已导入的同月花费，不重复计入花费统计", en: "Backfilled HOA payments for Jan–Nov 2024 and Jan–Jul 2025 (copied from the existing ones with dates changed) and linked them to the matching bank-imported spending so spending is not counted twice" }
  ] },

  { v: "2026-11-18.23", title: { zh: "摊派下拉每个选项一行：勾选框 + 第几期 · 日期 · 金额；修正 HOA 10 / 11 月两笔缴费的重复计算", en: "Assessment dropdown: one line per option (checkbox + No. n · date · amount); fixed the double count on HOA's October and November payments" }, items: [
    { k: "better", zh: "「特别摊派」下拉里每个选项一行：勾选框、「第 N 期 · 日期 · 金额」，不再把勾选框和文字拆成两行；有多笔摊派时前面加摊派名", en: "Each option in the Special assessment dropdown is one line: checkbox plus No. n · date · amount; with several assessments the name is added in front" },
    { k: "fix", zh: "HOA 月费 10 月、11 月两笔缴费的「金额」里已经含了摊派（和 11 月的手续费），总金额被多算；已改成本期金额 363.20（单元费 347.36 + 车位费 15.84），摊派、手续费另列，花费统计里对应的两笔也改成 430.89 和 433.88", en: "HOA's October and November payments had the assessment (and November's fee) already inside the amount, so the total was counted twice; the amount is now 363.20 (unit 347.36 + parking 15.84) with the assessment and fee listed separately, and the matching spending entries are now 430.89 and 433.88" }
  ] },

  { v: "2026-11-18.22", title: { zh: "修复：有缴费记录的账单点开没反应；一次性账单保存报错", en: "Fix: bills with payments did not open; saving a one-time bill failed" }, items: [
    { k: "fix", zh: "点开有缴费记录的账单（比如 HOA 月费）没反应，是上个版本漏了一处引用造成的，现在修好", en: "Opening a bill that has payments (for example the HOA fee) did nothing because a reference was missing in the previous version; fixed" },
    { k: "fix", zh: "一次性账单的保存、记付款、新增就诊人也受同类遗漏影响，已一并修好", en: "Saving a one-time bill, logging a payment and adding a patient were hit by the same kind of omission and are fixed too" }
  ] },

  { v: "2026-11-18.21", title: { zh: "记缴费的特别摊派下拉：独占一行、默认不勾选、点开定位到第一个勾选的期", en: "Payment form assessment dropdown: full row, nothing ticked by default, opens at the first ticked row" }, items: [
    { k: "better", zh: "「特别摊派」下拉独占一整行，不会越出表单；默认「未勾选」（以前会自动勾上本期到期的），列表第一项是「未勾选 · 这次不交摊派」，点它就清空", en: "The Special assessment dropdown takes a full row and stays inside the form; it defaults to None selected (it used to tick what was due) and the first entry clears the selection" },
    { k: "better", zh: "点开下拉：有勾选的，列表停在第一个勾选的那一期；没勾选的，从第一期往下看", en: "Opening the dropdown: if some rows are ticked it lands on the first ticked one, otherwise it starts from the first row" }
  ] },

  { v: "2026-11-18.20", title: { zh: "记缴费的金额合成一组并加好总金额；摊派改成下拉；HOA 金额拆成单元费 + 车位费；缴费记录行显示总金额", en: "Payment amounts grouped with a live total; assessments as a dropdown; HOA dues split into unit and parking; payment rows show the total" }, items: [
    { k: "better", zh: "记缴费 / 编辑缴费的金额放进一个「金额」组：本期金额（或 HOA 的单元费 + 车位费）、滞纳金、手续费、税、特别摊派，最后一行是加好的「总金额」，改任何一项都实时更新；所有周期性账单都一样", en: "Log / edit payment now has one Amount group: amount (or HOA unit + parking), late fee, service fee, tax and special assessment, ending in a live Total; the same for every recurring bill" },
    { k: "better", zh: "「这次交的特别摊派」改成下拉（可多选），显示「几期 · 金额」；缴费记录列表和账单页里每一行显示的是总金额，明细写在下面一行小字里", en: "The assessment picker is now a multi-select dropdown showing rows · amount; payment rows in the history and on the bill page show the total, with the breakdown on the line below" },
    { k: "new", zh: "HOA 的单元费和车位费下面有一行「HOA 小计」（两者之和，实时更新）；顶部卡片的算式也写成「HOA：单元费 + 车位费」", en: "Under the HOA unit and parking fees there is an HOA subtotal row (their sum, updated live); the top card formula shows it as HOA: unit + parking" },
    { k: "new", zh: "HOA 账单可以把金额细分成单元费（Unit assessment）和车位费（Parking assessment）：在账单编辑里设置，通常金额自动 = 两者之和，记缴费时默认带入，也可以逐次修改；现有 HOA 账单已按房屋资料里的 347.36 + 15.84 迁好", en: "An HOA bill can split its amount into Unit assessment and Parking assessment: set in the bill's edit page, the usual amount becomes their sum, payments pre-fill them and each can be changed; the existing HOA bill was migrated from 347.36 + 15.84 in the property profile" }
  ] },

  { v: "2026-11-18.19", title: { zh: "今日页问候用家庭成员的名字；账单概览「按资产」改名「账单分组」，可切换按资产 / 按周期", en: "Today greets the family member by name; Bills overview By asset is now Bill groups with a By asset / By cycle switch" }, items: [
    { k: "fix", zh: "今日页「中午好，…」显示家庭成员的名字，不再是设备的名字（这台设备还没链接家庭成员时才用设备的称呼）", en: "The Today greeting shows the family member's name instead of the device's name (the device name is only used when the device is not linked to a family member)" },
    { k: "new", zh: "财务 → 账单概览的「按资产」改名「账单分组」，默认还是按资产；多了「按周期」视图：周期性（再按每月、每季度、每年细分）和一次性各一行，有金额才显示", en: "Finance → Bills overview: By asset is renamed Bill groups and still defaults to assets; a new By cycle view shows Recurring (split by monthly, quarterly, yearly…) and One-time, each only when it has an amount" }
  ] },

  { v: "2026-11-18.18", title: { zh: "修复：打印页里账单的负责人名字又显示出来了", en: "Fix: a bill's owner name shows again in the print view" }, items: [
    { k: "fix", zh: "打印账单时，没有显示「谁负责」的名字（旧字段删除后漏改了一处），现在修好", en: "Printing bills did not show the owner's name after the old field was removed; fixed" }
  ] },

  { v: "2026-11-18.17", title: { zh: "清理：删除账单「谁负责」和信用卡「持卡人」的旧设备字段", en: "Cleanup: removed the old device fields behind a bill's owner and a card's holder" }, items: [
    { k: "better", zh: "账单的「谁负责」、信用卡的「持卡人」现在只关联家庭成员，旧的设备字段已删除（数据早已迁到家庭成员）；旧备份文件恢复时会自动忽略这两个旧字段", en: "A bill's owner and a card's holder now link only to family members and the old device fields are gone (the data was already migrated); restoring an old backup ignores those two fields" }
  ] },

  { v: "2026-11-18.16", title: { zh: "清理：去掉账单路径整理后不再使用的旧页面代码", en: "Cleanup: removed old page code left over from the bills path change" }, items: [
    { k: "better", zh: "去掉旧的周期性账单清单、缴费记录列表、一次性账单目录和年度报表、旧的家庭成员页对应的代码；每次刷新不再多向服务器要一次缴费记录列表，页面行为不变", en: "Removed code for the old recurring bill list, payment list, one-time directory and annual report, and the old family page; refreshes no longer make an extra server request for the payment list, and pages behave the same" }
  ] },

  { v: "2026-11-18.15", title: { zh: "信用卡持卡人和「谁在买」改成显示家庭成员；更多长下拉可以搜索", en: "Card holders and Who is buying now show family members; more long lists are searchable" }, items: [
    { k: "better", zh: "信用卡的「持卡人 / 户主」关联家庭成员，不再是登录设备；购物车「我来买」、「最后修改」这些地方显示的名字，链接了家庭成员的设备就显示家庭成员的名字", en: "A credit card's holder is now a family member, not a login device; names shown for Who is buying and Last edited use the family member when the device is linked" },
    { k: "new", zh: "账单表单里的房产和关联资产下拉也可以输入文字搜索", en: "The property and linked-asset lists in the bill form are searchable too" }
  ] },

  { v: "2026-11-18.14", title: { zh: "登录设备行加 ⋯ 菜单：重命名、关联、登出", en: "Login device rows get a ⋯ menu: Rename, Link, Sign out" }, items: [
    { k: "new", zh: "每台登录设备右边有 ⋯：重命名（直接在名字上改，回车保存，点别处取消）、关联（底部弹出「属于哪位家庭成员」，点一位就自动保存，底部取消按钮占整行）、登出（自己这台 = 退出登录；别的设备 = 从家庭里移出，下次要重新登录）", en: "Each login device has a ⋯ menu: Rename (edit the name in place, Enter saves, tapping elsewhere cancels), Link (a bottom sheet for which family member; tapping one saves it, with a full-width Cancel) and Sign out (this device = sign out; another device = removed from the household and must sign in again)" },
    { k: "better", zh: "设备行不再有常驻的「移除」按钮和选择框，更清爽", en: "Device rows no longer carry a standing Remove button and selector" }
  ] },

  { v: "2026-11-18.13", title: { zh: "家庭成员详情页：块不再折叠、编辑按钮和房屋资料一样大、设备只留「移除」、登录记录切范围不回顶部、可疑记录有菜单", en: "Member page: blocks no longer collapse, Edit is the same size as in Home profile, devices keep only Remove, switching sign-in scope stays put, suspicious sign-ins have a menu" }, items: [
    { k: "better", zh: "三个块不再能折叠；编辑按钮和房屋资料里的一样大（之前大了一圈）；登录设备块不再有编辑和详情按钮，每行只有「移除」，「属于哪位家庭成员」直接在行里选", en: "The three blocks no longer collapse; Edit is the same size as in Home profile (it was oversized); Login devices has no Edit or Details button, each row only has Remove and the family-member selector sits in the row" },
    { k: "better", zh: "登录记录里点「只看某人 / 全家」或「加载更多」，停留在原来的位置，不再跳回页面顶端", en: "Tapping Only / Everyone or Load more in the sign-in history stays where you are instead of jumping to the top" },
    { k: "new", zh: "可疑的登录记录显示红点 +「可疑」标签，右边有 ⋯ 菜单：确认是家人、移出设备", en: "A suspicious sign-in shows a red dot and a Suspicious label, with a ⋯ menu: Confirm it's family or Remove device" }
  ] },

  { v: "2026-11-18.12", title: { zh: "家庭成员页优化：＋添加改成表单页、卡片可点、家主可移出；成员详情页控件和其他页面统一；所有表单取消靠左、保存靠右", en: "Family page polish: + Add is a form page, cards are tappable, the owner can remove people; member page controls match the rest of the app; every form has Cancel on the left and Save on the right" }, items: [
    { k: "better", zh: "「添加家庭成员」改成「＋ 添加」，打开一个新建家庭成员的表单页；点整张成员卡片直接进详情页；卡片 ⋯ 里家主多了「移出」（把名下设备移出家庭并删除这个人）", en: "Add family members is now + Add and opens a form page; tapping a member card opens its page; the owner gets Remove in the card's ⋯ menu (removes the person's devices and deletes the person)" },
    { k: "better", zh: "成员详情页的块、编辑按钮、「只看某人 / 全家」切换改成和别的页面一样的样式和大小，折叠有右上角箭头", en: "The member page's blocks, Edit buttons and Only / Everyone toggle now look and size like the rest of the app, and collapsing has an arrow at the top right" },
    { k: "better", zh: "所有表单的底部按钮统一：取消靠左、保存靠右，同一行", en: "Every form's bottom bar is unified: Cancel on the left, Save on the right, on one row" },
    { k: "fix", zh: "还没有登录记录的成员（对方还没打开过新版本）改成提示「还没有登录记录」，不再说「最近 60 天没有」", en: "Members with no recorded sign-ins yet (they have not opened the new version) now say No sign-ins recorded yet instead of none in 60 days" }
  ] },

  { v: "2026-11-18.11", title: { zh: "家庭与成员页重做：成员卡片 + 成员详情页（资料 / 登录设备 / 登录记录）；修好设备关联选了又切回的问题", en: "Family & members page redone: member cards and a member detail page (profile / devices / sign-ins); fixed device linking snapping back" }, items: [
    { k: "fix", zh: "修好「属于哪位家庭成员」选了又自动切回「还没链接」：关联其实已经保存，只是读设备列表时没读回来；这台设备的「这台设备是谁？」提示也不会再反复出现", en: "Fixed Belongs to family member snapping back to not linked: the link was saved but not read back when listing devices; the Who uses this device? prompt no longer keeps returning" },
    { k: "better", zh: "家庭与成员页：邀请码紧跟在同步与备份下面；「这台设备是谁？」可折叠，链接过就不再显示；家庭成员是一张张卡片（男 / 女 / 孩子 / 宠物图标、联系方式、最近登录的时间 · 设备 · 国家 · IP），右边 ⋯ 里有详情、合并、退出", en: "Family & members: the invite code sits right under Sync & backup; Who uses this device? can be collapsed and disappears once linked; members are cards (gender / child / pet icon, contact, last sign-in time · device · country · IP) with Details, Merge and Sign out under ⋯" },
    { k: "new", zh: "成员详情页分三块（都能折叠，右上角各有编辑）：基本资料（名字、性别、联系方式、角色）、登录设备（每页 6 台、加载更多，标出自己的设备，能改属于谁、看这台的登录详情、移除可疑设备）、登录记录（可疑的标红，家主看全家）", en: "The member page has three collapsible blocks, each with Edit: Basic info (name, gender, contact, role), Login devices (6 per page, your own device marked, change whose it is, see its sign-ins, remove a suspicious one) and Sign-in history (suspicious ones in red; the owner sees everyone)" },
    { k: "better", zh: "原来单独的「登录设备」和「登录记录」两块并进了成员页；「地点」只能显示国家（服务器拿不到城市）", en: "The separate Login devices and Sign-in history blocks moved into the member page; Location shows the country only (the server cannot see the city)" }
  ] },

  { v: "2026-11-18.10", title: { zh: "登录记录和陌生登录提醒：看谁、用什么设备、什么时候登录", en: "Sign-in history and unfamiliar sign-in alerts: who signed in, on what device, and when" }, items: [
    { k: "new", zh: "设置 → 家庭与成员 多了「登录记录」：每次登录的时间、设备（iPhone、Android、Windows / Mac 电脑…）、浏览器、IP；默认最近 6 天，可以「加载更多」再往前 6 天；家主看全家，其他人只看自己", en: "Settings → Family & members has Sign-in history: time, device (iPhone, Android, Windows / Mac computer…), browser and IP of each sign-in; the last 6 days by default with Load more for 6 earlier days; the owner sees everyone, others only themselves" },
    { k: "new", zh: "出现没见过的设备或网络登录，会在「注意事项」里提醒，并告诉你可能账号被盗时怎么办（换邀请码、移出设备、检查邮箱 / 手机）；确认是家里人后提醒消失", en: "A device or network not seen before raises an alert in Alerts with what to do if the account may be compromised (new invite code, remove the device, check email / phone); confirming it is family clears the alert" }
  ] },

  { v: "2026-11-18.9", title: { zh: "家庭成员和登录设备分开：一个人可以有多台设备，账单「谁负责」关联的是人", en: "Family members and login devices are separate: one person can have several devices, and a bill's owner is a person" }, items: [
    { k: "new", zh: "设置 → 家庭与成员 分成两块：「家庭成员」（人：大人、孩子、宠物，家主新建 / 改名 / 合并 / 删除）和「登录设备」；一位成员可以有多台设备，设备资料页里选它属于谁", en: "Settings → Family & members now has Family members (people: adults, kids, pets; the owner adds, renames, merges, deletes) and Login devices; a person can have several devices and each device page says whose it is" },
    { k: "new", zh: "第一次用一台新设备登录会问「这台设备是谁？」：选已有的人，或新建；以后换设备选同一个人就不会多出一个人", en: "A new device asks Who uses this device?: pick an existing person or create one; on the next device pick the same person and no duplicate appears" },
    { k: "better", zh: "账单「谁负责」、今日页「只看我负责的」都按家庭成员算；除家主外，每个人只能看到自己和自己的设备；已有数据已迁移（妈妈的两台设备合并成一个人）", en: "A bill's owner and Today's Only mine now follow family members; apart from the owner, each person sees only themselves and their own devices; existing data was migrated (Mom's two devices became one person)" }
  ] },

  { v: "2026-11-18.8", title: { zh: "账单路径整理：财务 / 账单概览 / 资产 / 账单；取消周期性、一次性账单目录页", en: "Bills path tidied: Finance / Bills overview / asset / bill; the recurring and one-time directory pages are gone" }, items: [
    { k: "better", zh: "账单详情页的路径统一成「财务 / 账单概览 / 房产（车辆、设备、患者）/ 账单名」；第二级回概览（默认筛选），第三级回概览并按这个资产筛选", en: "Bill pages now show Finance / Bills overview / property (vehicle, equipment, patient) / bill; the second level returns to the overview with default filters, the third filters it by that asset" },
    { k: "new", zh: "账单概览的资产筛选写进网址（#/bills/overview/资产），可以直接分享、刷新；资产下拉能输入文字搜索，选项很多也好找", en: "The overview's asset filter is part of the address (#/bills/overview/asset), so it can be shared and survives a refresh; the asset list is searchable" },
    { k: "better", zh: "「周期性账单」「一次性账单」两个目录页取消：列表用「全部账单」按类型筛选，缴费趋势放进账单概览；旧链接自动跳转；一次性账单详情页的网址改成 #/otbill/…", en: "The Recurring and One-time directory pages are removed: use All bills filtered by type, and the payment trend now lives in the overview; old links redirect; one-time bill pages moved to #/otbill/…" }
  ] },

  { v: "2026-11-18.7", title: { zh: "特别摊派的编辑页排版整理：每一期一张整齐的小卡片", en: "Special assessment edit page tidied up: one neat card per row" }, items: [
    { k: "better", zh: "每一期是一张卡片：上面选类型和删除，下面到期日、金额并排，再下面是「已缴（无缴费记录）」；已关联缴费的期收成一行只读", en: "Each row is a card: type and delete on top, due date and amount side by side, then Paid (no payment record); rows tied to a payment collapse to one read-only line" },
    { k: "fix", zh: "修好勾选框变成大方块、说明文字竖着折行、日期被截断的问题；宽屏两列排开", en: "Fixed the oversized checkbox, the vertically wrapped label and the truncated dates; wide screens show two columns" }
  ] },

  { v: "2026-11-18.6", title: { zh: "特殊评估从房屋资料搬进 HOA 账单的「特别摊派」", en: "Special assessments moved from the property profile into the HOA bill" }, items: [
    { k: "better", zh: "房屋资料里不再填特殊评估；原来的那一笔（Garage support panel 维修，30 期 × $67.69）已搬进 HOA 月费账单的「特别摊派」，金额和历史都在账单里", en: "The property profile no longer holds special assessments; the existing one (Garage support panel, 30 x $67.69) is now in the HOA bill's Special assessment, with amounts and history" },
    { k: "new", zh: "摊派的每一期可以标「已缴（无缴费记录）」，用于开始记账前就交过的期", en: "Each assessment row can be marked Paid (no payment record) for rows settled before tracking began" },
    { k: "better", zh: "房屋页的 HOA 面板、每月总计和提醒改读账单里的摊派：每月分期跟账单自己的提醒走，一次性结清和逾期的期才会单独提醒", en: "The Home page HOA panel, monthly total and alerts now read the bill's assessments: monthly installments follow the bill's own reminders, only payoffs and overdue rows alert separately" }
  ] },

  { v: "2026-11-18.5", title: { zh: "账单新增「特别摊派」：分期、一次性结清、或前几期分期最后一次结清，每笔都有迹可寻", en: "Bills now track special assessments: installments, a one-time payoff, or installments then a final payoff, fully traceable" }, items: [
    { k: "new", zh: "账单详情页菜单里的「特别摊派」：新建一笔摊派，付款计划一期一行（日期、金额、分期或一次性结清），可以「快速生成分期」，也可以最后加一笔一次性结清", en: "Special assessment in the bill menu: create one with a payment schedule, one row per payment (date, amount, installment or payoff); generate installments quickly and add a final payoff" },
    { k: "new", zh: "记缴费时会列出还没交的摊派期，本期到期的默认勾上；勾上的金额记在这笔缴费里，回头能查每一期是哪次交的", en: "Logging a payment lists unpaid assessment rows, with the ones due this period ticked; ticked amounts are saved on that payment so every row shows which payment settled it" },
    { k: "better", zh: "顶部卡片的「费用总额」把本期的摊派（分期、一次性分开写）加进算式；缴费记录、花费统计也包含它", en: "The total on the top card adds this period's assessment (installment and payoff shown separately); payment history and spending include it too" }
  ] },

  { v: "2026-11-18.4", title: { zh: "账单可以记手续费和税：每次缴费填实际值，账单上填估算值", en: "Bills can record service fees and tax: actual values per payment, an estimate on the bill" }, items: [
    { k: "new", zh: "记缴费时多了「手续费」和「税」两栏（和滞纳金分开），每次可以不一样；编辑缴费记录也能改", en: "Logging a payment now has Service fee and Tax fields (separate from late fees), different each time and editable afterwards" },
    { k: "new", zh: "账单里可以填「通常手续费」「通常税」的估算值：没缴之前用它们估费用总额，记缴费时当默认值", en: "A bill can hold a typical fee and typical tax estimate: used for the total before paying and as the default when logging a payment" },
    { k: "better", zh: "顶部卡片的「费用总额」把固定金额、手续费、税加起来并写出算式；缴费记录的合计、花费统计里的那一笔也包含它们", en: "The Total on the top card adds the fixed amount, fee and tax with the formula shown; payment totals and the spending entry include them too" }
  ] },

  { v: "2026-11-18.3", title: { zh: "账单详情页顶部卡片：标题带账号尾号，加「HOA / 服务商」和「付费」两块小表", en: "Bill page summary card: account digits in the title, plus HOA / Provider and Payment mini tables" }, items: [
    { k: "better", zh: "标题写成「HOA 月费（**9406）」；下面分两块：HOA（公司、联系方式、官网 / 缴费网站，读房屋资料里填过的）和付费（付费方式、费用总额）", en: "The title reads HOA fee (**9406); below are two blocks: HOA (company, contact, website, read from the property profile) and Payment (method, total)" },
    { k: "better", zh: "其他账单的第一块是「服务商」：收款方、缴费网站、登录提示；每行左边是项目、右边是内容，不再是一长串文字", en: "Other bills show a Provider block with payee, payment website and login hint; each row has the label on the left and the value on the right" }
  ] },

  { v: "2026-11-18.2", title: { zh: "账单缴费记录：独立的全部记录页（搜索 / 筛选），新建和编辑也各有独立页面", en: "Bill payment history: a full records page with search and filters, and separate pages to add and edit" }, items: [
    { k: "new", zh: "账单详情页的「全部」和菜单里的「查看缴费记录」进同一个页面：能按关键词搜索，按状态、年份筛选，按日期或金额排序，并显示合计；右下角圆形「＋」新建一笔", en: "All and View payment history open the same page: search by keyword, filter by status and year, sort by date or amount, with a total; the round + button adds a payment" },
    { k: "better", zh: "点一条记录直接进入编辑页，不再在列表上方弹出表格；取消在左、保存在右，保存或取消后都回到全部记录", en: "Tapping a record opens its own edit page instead of a form above the list; Cancel is on the left, Save on the right, and both return to the records page" },
    { k: "better", zh: "比 400 天更早的缴费记录也能在这一页看到和编辑", en: "Payments older than 400 days can now be seen and edited on this page too" }
  ] },

  { v: "2026-11-18.1", title: { zh: "周期性账单详情页：顶部改成汇总卡片，菜单里能编辑整张表单", en: "Recurring bill page: a summary card on top, and a menu that edits the whole form" }, items: [
    { k: "better", zh: "顶部卡片集中显示名称、下次到期、账号、付费方式、每次金额、折合每月和添加 / 更新时间，「记缴费」独占一行", en: "The top card shows name, next due date, account, payment method, amount per payment, monthly equivalent and added / updated times, with Record payment on its own row" },
    { k: "new", zh: "卡片右上角的「⋯」菜单：编辑、记缴费、查看缴费记录、去服务商缴费、复制、删除", en: "The ⋯ menu on the card: Edit, Record payment, View payment history, Pay at provider, Copy, Delete" },
    { k: "new", zh: "详情页只留顶部汇总卡片和缴费记录，不再重复列各项资料；要改资料，点菜单里的「编辑」一次打开整张表单", en: "The page keeps just the summary card and payment history, with no repeated detail cards; to change details use Edit in the menu, which opens the whole form at once" }
  ] },

  { v: "2026-11-17.32", title: { zh: "买卖计划：问咩咩帮你比较候选、想出价思路、补充看房 / 看车清单", en: "Buy / sell plans: ask the assistant to compare candidates, think through an offer and add to your checklist" }, items: [
    { k: "new", zh: "计划页底部有三个「问咩咩」：比较候选的取舍、出价 / 谈价思路、补充看房 / 看车要查的地方；没填 AI 密钥时变成「复制提示词」", en: "The bottom of a plan has three Ask buttons: compare the candidates, offer or negotiation strategy, and extra things to check; without an AI key they become Copy prompt" },
    { k: "better", zh: "只有你点按钮才会发出内容；发出的只有计划里的候选名称、价格、打分、对比字段、优缺点和出价，不含地址和链接", en: "Nothing is sent unless you tap a button; only candidate names, prices, scores, comparison fields, pros, cons and offers are included, never addresses or links" }
  ] },

  { v: "2026-11-17.31", title: { zh: "买卖计划：选定一个候选，一键建好房产 / 车辆并开始买入清单", en: "Buy / sell plans: pick a candidate and create the property or car with its buying checklist in one tap" }, items: [
    { k: "new", zh: "候选卡片上的「就买这套 / 就买这辆」：新建房产（交易中 · 买入）或车辆（选购中），带上名称、地址、年款、价格，并开始对应的买入清单", en: "The Buy this one button on a candidate creates the property (Buying) or car (Shopping) with its name, address, year and price, and starts the matching checklist" },
    { k: "better", zh: "选定后计划和候选自动标成「已买到 / 拿下了」；点按钮要再点一次确认，避免误建", en: "The plan and candidate are then marked Bought / Won; the button asks for a second tap so nothing is created by accident" }
  ] },

  { v: "2026-11-17.30", title: { zh: "买卖计划：记下候选的房子 / 车，打分、并排对比、记录出价，全家共享", en: "Buy / sell plans: keep candidate homes and cars, score and compare them side by side, log offers; shared by the family" }, items: [
    { k: "new", zh: "买房 / 买车指南页有「我的计划」：新建一个计划（预算、备注），里面加候选的房子或车——名称、地址、链接、报价、打分、优缺点、面积 / 年款 / 里程等", en: "The buy guides have My plans: create a plan (budget, notes) and add candidate homes or cars with name, address, link, price, score, pros and cons, size, year, mileage and more" },
    { k: "new", zh: "两个以上候选时，宽屏显示并排对比表（标出最低价）；手机上用卡片，信息一样", en: "With two or more candidates a side-by-side table appears on wide screens (lowest price marked); on phones the cards show the same details" },
    { k: "new", zh: "每个候选可以记出价：日期、我的出价、对方还价、条件、结果；记了出价，候选自动标成「已出价」", en: "Each candidate has an offer log: date, my offer, counter-offer, conditions and result; logging an offer marks the candidate as Offer made" },
    { k: "better", zh: "价格只给有财务权限的人看和填；计划、候选、出价都已加入备份和恢复", en: "Prices are visible and editable only with finance access; plans, candidates and offers are included in backup and restore" }
  ] },

  { v: "2026-11-17.29", title: { zh: "新增「买卖计划」：买房 / 买车 / 卖房 / 卖车的分步指南，不再先建「选购中」的占位车", en: "New Buy / sell plans: step-by-step guides for buying or selling a home or car; no more placeholder \u201cShopping\u201d car" }, items: [
    { k: "new", zh: "房屋首页多了「买卖计划」：我想买房 / 买车 / 卖房 / 卖车。每个都是分阶段的指南（准备、找、比较、出价、合同期、交割…），写清为什么、怎么做、常见的坑和要做的决定", en: "The Home page has Buy / sell plans: buy a home, buy a car, sell a home, sell a car. Each is a staged guide (prepare, search, compare, offer, under contract, closing…) with why, how, common pitfalls and the decisions you need to make" },
    { k: "new", zh: "看房清单、试驾 / 看车清单可以逐项勾选（只保存在这台设备上）；内容以美国通用原则为主，并标出伊利诺伊的做法，仅供参考", en: "Viewing and test-drive checklists can be ticked off item by item (saved on this device only); content follows general US practice with Illinois specifics marked, for reference only" },
    { k: "better", zh: "「添加房产 / 添加车辆」只用来记录你已经有的；还没买的，用「买卖计划」，不会再生成一辆「选购中」的占位车", en: "Add property / Add vehicle are only for what you already own; for things you have not bought yet use Buy / sell plans, which no longer create a placeholder car" },
    { k: "new", zh: "卖房 / 卖车指南里可以直接选一套房产或一辆车，进入它的交易页开始卖出清单", en: "In the sell guides you can pick a property or car and go straight to its deal page to start the sell checklist" }
  ] },

  { v: "2026-11-17.28", title: { zh: "取消「房屋 / 车辆」列表页：车辆都在房屋首页的「汽车」区", en: "The Home / Vehicles list page is gone: vehicles live in the Cars section on the Home page" }, items: [
    { k: "better", zh: "不再有单独的车辆列表页：房屋首页的「汽车」区就是入口，旧链接、书签会自动回到房屋首页", en: "There is no separate vehicles list page any more: the Cars section on the Home page is the entry, and old links and bookmarks land on Home" },
    { k: "better", zh: "「添加车辆」和「开始买车流程」两个入口并排放在「汽车」区；已卖出 / 已归还的车折叠在「历史车辆」里", en: "Add vehicle and Start buying a car sit side by side in the Cars section; sold or returned vehicles are folded under Past vehicles" },
    { k: "better", zh: "本地须知（牌照、年检、保险等当地规定）移到每辆车页面的最底部；车辆的保养提醒只留在房屋首页的待办里", en: "Local notes (plates, inspections, insurance rules) moved to the bottom of each vehicle page; vehicle service reminders now live only in the Home page to-do list" }
  ] },

  { v: "2026-11-17.27", title: { zh: "账单行再优化：估算写在金额旁、信息不拆行、标志放名称后；所有账单列表一致", en: "Bill rows polished: estimate beside the amount, details never split, flags after the name; same in every bill list" }, items: [
    { k: "better", zh: "估算的金额写成「（估算）$123.22」，在金额左边同一行，不再放到金额下面", en: "Estimated amounts read \u201c(est.) $123.22\u201d on the same line, to the left of the amount, instead of underneath" },
    { k: "better", zh: "所属资产 / 患者后面直接接到期日；这一行的每一项都不会被拆成两行，放不下时只在「·」后面换到下一行", en: "The asset or patient is followed straight by the due date; no item on that line is split across two lines, and when space runs out it wraps only after a dot" },
    { k: "better", zh: "🔒 等小标志放在名称后面；名称的下划线只在文字下面，图标下面没有下划线", en: "The lock and other small flags sit after the name; the underline is only under the name text, not under the icon" },
    { k: "better", zh: "新格式也用在周期性账单清单、一次性账单清单、缴费记录，各页账单行一致", en: "The same format is used in the recurring bills list, the one-time bills list and the payment history" }
  ] },

  { v: "2026-11-17.26", title: { zh: "全部账单的行重新排版：分期一笔一行；有眼睛；「清除筛选」靠右", en: "All bills rows re-laid out: one line per installment, an eye button, and Clear filters on the right" }, items: [
    { k: "better", zh: "每行第一行是类别图标、名称和状态（逾期 / 待缴 / Escrow 代缴 / 已缴…），金额靠右；金额是估算的，在金额下面用小字写「估算金额」", en: "Each row now starts with the category icon, name and status (overdue, unpaid, paid via escrow, paid\u2026) with the amount on the right; estimated amounts say Estimated amount in small print underneath" },
    { k: "better", zh: "第二行写所属资产或患者、到期日、周期性 / 一次性、收款方；已缴的这行改写缴费日期", en: "The second line shows the asset or patient, due date, recurring or one-time, and payee; for paid bills it shows the payment date instead" },
    { k: "new", zh: "分期付款的账单每一笔占一行：分期 #1 日期 金额 余额，分期 #2 日期 金额 余额……", en: "A bill paid in installments shows one line per payment: Split #1 date amount balance, Split #2 date amount balance\u2026" },
    { k: "new", zh: "全部账单顶上有眼睛：点一下全部显示 10 秒，双击或长按切换常显示 / 遮挡，不用一个个点金额", en: "All bills has the eye button: tap to show every amount for 10 seconds, double-tap or long-press to switch between always shown and masked, no need to tap each amount" },
    { k: "better", zh: "所有页面的「清除筛选」按钮都靠右对齐", en: "The Clear filters button is right-aligned on every page" }
  ] },

  { v: "2026-11-17.25", title: { zh: "车辆页可以直接问咩咩：常见车辆问题点一下就问", en: "Ask Baa from the vehicle page: tap a common car problem to ask right away" }, items: [
    { k: "new", zh: "车辆页右上角「⋯」菜单新增「问咩咩」，进到和「出了问题？」一样的页面，但这次默认就是这辆车，不用再选设备", en: "The vehicle page\u2019s ... menu has a new Ask Baa entry that opens the same page as Something wrong, already set to this vehicle with no device to pick" },
    { k: "new", zh: "页面上有一排常见车辆问题按钮（发动机故障灯、胎压灯、刹车异响、方向盘抖动、打不着火、空调不制冷…，电动车还有充电和续航），点一下就直接问咩咩，不用打字", en: "A row of common car problem buttons (check engine light, tire pressure, brake noise, steering shake, won\u2019t start, A/C, and for EVs charging and range): tap one to ask right away without typing" },
    { k: "better", zh: "咩咩会按这辆车的年款、品牌、动力类型和里程来回答，涉及刹车、转向、过热等会先提醒你停车找人；买配件的链接换成汽配店", en: "Baa answers for this car\u2019s year, make, powertrain and mileage, tells you to stop and get help for brakes, steering or overheating, and parts links go to auto-parts stores" }
  ] },

  { v: "2026-11-17.24", title: { zh: "历史交易可以删除：手机左滑，笔记本点「删除」", en: "Past deals can be deleted: swipe left on a phone, tap Delete on a laptop" }, items: [
    { k: "new", zh: "交易页的「历史交易」每一行可以删除：手机上向左滑，笔记本上点行里的「删除」；删之前会问你", en: "Each row under Past deals can now be deleted: swipe left on a phone, or tap Delete on a laptop; you are asked first" },
    { k: "better", zh: "只删这条交易记录和它的清单、时间线；房产 / 车辆现在的状态不会变，已经记进花费的款项也不会删", en: "Only the deal record and its checklist and timeline are deleted; the property or vehicle status does not change and payments already in spending are kept" }
  ] },

  { v: "2026-11-17.23", title: { zh: "车辆、设备、账单页不再藏起底部导航；全部账单的合计也会遮挡", en: "Vehicle, equipment and bill pages keep the bottom tabs; the All bills totals are masked too" }, items: [
    { k: "fix", zh: "手机上，车辆页、设备页、账单详情页的底部导航不再消失：只有真正在编辑的表单页（新建、编辑某一块、记缴费、向导）才隐藏导航", en: "On phones the bottom tabs no longer disappear on vehicle, equipment and bill pages; only real edit forms (new, edit a section, log a payment, the guides) hide them" },
    { k: "fix", zh: "「全部账单」顶上的合计（笔数、应付、已付、余额）和账单概览卡片下面的小字里的金额，也会和别处一样被遮挡，点一下露出来", en: "The totals line at the top of All bills and the small lines under the overview cards now mask their amounts like everywhere else; tap to reveal" }
  ] },

  { v: "2026-11-17.22", title: { zh: "全部账单：默认的时间「全部」不再算成筛选", en: "All bills: the default time \u201cAll\u201d no longer counts as a filter" }, items: [
    { k: "fix", zh: "「全部账单」的时间默认是「全部」，手机上「筛选」旁边的数字和「清除筛选」不再把它当成一个筛选；选了本月、下月等才算", en: "In All bills the default time is All, and on phones the number next to Filters and the Clear filters button no longer count it as a filter; only picking this month, next month and so on does" }
  ] },

  { v: "2026-11-17.21", title: { zh: "账单概览：金额遮挡一致、按资产跟着筛选；房屋 / 车辆页直达账单", en: "Bills overview: masked amounts, by-asset follows the filter; Home and Vehicle pages open their bills" }, items: [
    { k: "fix", zh: "账单概览的大数字现在和别的财务页一样会被遮挡（点眼睛显示 / 隐藏）", en: "The big numbers on the Bills overview are now masked like the other finance pages (tap the eye to show or hide)" },
    { k: "fix", zh: "在账单概览里选了某个资产，下面的「按资产」也只剩这个资产，不再显示全部", en: "When you pick an asset on the Bills overview, the By asset section now shows only that asset instead of everything" },
    { k: "better", zh: "「全部账单」从目录直接打开：时间是「全部」、状态也是「全部」；从概览卡片点进来则带着卡片的本月 / 资产 / 状态", en: "Opening All bills from the menu now shows all time and all statuses; opening it from an overview card keeps that card\u2019s month, asset and status" },
    { k: "new", zh: "房屋里的「账单」和车辆页新增的「账单」都直接进账单概览，选好那套房产 / 那辆车，时间默认本月；车辆页的「账单」在「车辆资料」下面、「保养记录」上面", en: "Bills on a property and the new Bills tile on a vehicle open the Bills overview with that property or vehicle selected and this month as the time range; the vehicle tile sits between Vehicle profile and Service log" },
    { k: "better", zh: "添加一次性账单时，医疗和宠物的「患者」改成从家庭成员里选（医疗：大人和孩子，宠物：宠物）", en: "When adding a one-time bill, the patient for medical and pet bills is now chosen from your family members (adults and children for medical, pets for pet)" }
  ] },

  { v: "2026-11-17.20", title: { zh: "一次性账单也是五步向导；账单页一次滑动看全，每块单独编辑", en: "One-time bills get the five-step guide too; the bill page shows everything and each section edits on its own" }, items: [
    { k: "new", zh: "添加一次性账单（医疗、宠物、法律税务、装修工程、旅行）改成五步：哪一类 → 谁收的、关于谁 → 多少钱、什么时候 → 挂在哪、谁能看 → 确认；完成后直接进这张账单的页面", en: "Adding a one-time bill (medical, pet, legal and tax, renovation, travel) is now five steps: which kind, who billed, how much and when, where it belongs and who sees it, confirm; it then opens the new bill" },
    { k: "better", zh: "一次性账单的页面也像房屋资料页：「这是什么账单」「金额与日期」「挂靠与其他」三张卡一次看全，每张有自己的「编辑」，下面是付款记录", en: "The one-time bill page now works like the house profile: three cards (what it is, amount and dates, attachments and other) with their own Edit buttons, and payments below" },
    { k: "better", zh: "扫描创建的一次性账单会在页面顶上提示「由扫描创建」，并可撤销创建", en: "A one-time bill created from a scan shows a note at the top and can be undone" },
    { k: "fix", zh: "修复手机上向导页面偶尔出现横向滚动条的问题", en: "Fixed a horizontal scrollbar that could appear on the guide pages on phones" }
  ] },

  { v: "2026-11-17.19", title: { zh: "扫描信件 / 账单：直接建好，打开这张账单给你核对", en: "Scan a letter or bill: the bill is created and opened for you to check" }, items: [
    { k: "new", zh: "扫描信件或账单后不再停在一张表单里：读到的内容直接建成账单，并打开这张账单的页面；顶上写明「由扫描创建」，不对的地方点对应那一块的「编辑」，整张读错了点「撤销创建」", en: "After scanning a letter or bill you no longer land on a form: what was read becomes a bill and its page opens; a note says it came from a scan, each section has Edit for fixes, and Undo creation removes it if it was misread" },
    { k: "better", zh: "读不出到期日时不乱建，会打开向导，已读到的名字、金额、付款方都带上，从缺的那一步开始问；已经有类似的账单时先问你是仍然新建还是打开已有的", en: "If the due date cannot be read nothing is guessed: the guide opens with what was read and asks from the missing step; if a similar bill already exists you are asked whether to create another or open the existing one" }
  ] },

  { v: "2026-11-17.18", title: { zh: "添加周期性账单变成五步向导，完成后直接看到这张账单", en: "Adding a recurring bill is now a five-step guide that ends on the new bill" }, items: [
    { k: "new", zh: "添加周期性账单不再是一整页字段：一步一个问题——这是什么账单、多久交一次多少钱、怎么付、挂在哪、确认；选了分类就带出常用的频率和付款方式，名字也帮你起好", en: "Adding a recurring bill is no longer one long page of fields: one question per step (what it is, how often and how much, how it is paid, where it belongs, confirm); the category brings sensible defaults and a suggested name" },
    { k: "new", zh: "填每月几号，立刻显示「下次到期：…」；每一步都能上一步，已填的内容不会丢；返回键也是上一步", en: "Enter the day of the month and the next due date shows straight away; every step has Back, nothing you typed is lost, and the back gesture goes to the previous step" },
    { k: "better", zh: "完成后直接进到这张账单的页面，顶上告诉你还有哪几项没填，随时补；想一次填完的，每一步下面都有「整页表单」入口", en: "When finished you land on the new bill with a note of what is still blank; if you prefer one page, every step links to the full form" }
  ] },

  { v: "2026-11-17.17", title: { zh: "账单详情页：往下一滑就能看全，每一块单独编辑", en: "Bill page: scroll to see everything, edit each section on its own" }, items: [
    { k: "better", zh: "点开一张周期性账单，现在是一页卡片：这是什么账单、多少钱多久一次、怎么付、提醒与其他、缴费记录，每块的内容直接看得到，没填的写「未填」", en: "Opening a recurring bill now shows one page of cards: what it is, how much and how often, how it is paid, reminders, and payments, with the content visible and unfilled items marked Not set" },
    { k: "better", zh: "每张卡右上角有「编辑」，只改这一块，保存后回到这一页；记缴费、去缴费、复制、删除都在顶上", en: "Each card has its own Edit button, saving returns to this page; Log payment, Pay online, Copy and Delete are at the top" }
  ] },

  { v: "2026-11-17.16", title: { zh: "手机上所有搜索页：搜索框至少 185px，「清除筛选」换到下一行", en: "On phones every search page keeps the search box at least 185px; Clear filters moves to its own row" }, items: [
    { k: "fix", zh: "手机上库存、采购、账单、花费等带搜索的页面，搜索框不再被「筛选」和「清除筛选」挤窄；放不下时「清除筛选」单独放在下一行，并带上文字", en: "On phones the search box on inventory, shopping, bills, spending and other pages is no longer squeezed by the Filters and Clear filters buttons; when there is no room, Clear filters sits on its own row with its label" }
  ] },

  { v: "2026-11-17.15", title: { zh: "批量核对自动扣款账单；今日页待缴账单口径统一；去掉导出到日历", en: "Verify autopay bills in one go; Today's unpaid bills match All bills; calendar export removed" }, items: [
    { k: "new", zh: "全部账单里，有自动扣款、过了日子还没核对的账单时，出现「全部标为已核对」：确认后每张记一条已核对的缴费并推到下一期", en: "When autopay bills are past their date and not yet verified, All bills shows Mark all as verified: after you confirm, each gets a verified payment and moves to the next period" },
    { k: "better", zh: "今日页的「未来 30 天账单」改成「待缴账单（含逾期）」，笔数和金额与点进去的全部账单一致（含一次性账单）", en: "Today\u2019s next-30-days bills row is now Unpaid bills (incl. overdue); its count and amount match the All bills list it opens (one-time bills included)" },
    { k: "better", zh: "去掉了「导出到日历」，账单的提醒请用今日页和待办", en: "Export to calendar is gone; use Today and the to-do list for bill reminders" }
  ] },

  { v: "2026-11-17.14", title: { zh: "全部账单可以导出 CSV；手机上搜索框不再被挤窄", en: "Export All bills to CSV; the search box no longer gets squeezed on phones" }, items: [
    { k: "new", zh: "全部账单页右上角多了「导出 CSV」：按当前的筛选，一行一期，Excel 能直接打开", en: "All bills has an Export CSV button: it follows your current filters, one row per due date, and opens in Excel" },
    { k: "fix", zh: "手机上列表页的「清除筛选」只显示一个 ✕，把宽度让给搜索框，不再把搜索框挤成一条缝（各页都一样）", en: "On phones the Clear filters button on list pages shows just a cross, so the search box is no longer squeezed to a sliver (all pages)" }
  ] },

  { v: "2026-11-17.13", title: { zh: "周期性账单概览瘦身：重复的列表交给「全部账单」", en: "Recurring bills overview slimmed down: lists moved to All bills" }, items: [
    { k: "better", zh: "周期性账单的概览只留周期性专属的内容（每月固定支出、自动扣款、订阅、卡快过期、Escrow、导出到日历）；「要处理 / 本月账单 / 未来 30 天」那几块改成一个入口，点进「全部账单」看", en: "The recurring bills overview keeps only recurring-specific items (monthly total, autopay, subscriptions, expiring cards, escrow, calendar export); the needs-attention, this-month and next-30-days lists are replaced by a link to All bills" }
  ] },

  { v: "2026-11-17.12", title: { zh: "扫描信件 / 账单，自动判断类型并填好表单", en: "Scan a letter or bill: the type is detected and the form is filled in" }, items: [
    { k: "new", zh: "添加账单的第一页多了「扫描信件 / 账单」：拍一封信或账单，自动判断是周期性还是一次性，进到对应的表单并填好，你核对后再保存", en: "The first Add bill page has Scan a letter or bill: photograph one and it works out whether it is recurring or one-time, opens that form already filled in, and you check and save" },
    { k: "better", zh: "车险、车贷这类账单，名字里有你的某辆车时，会自动挂到那辆车上", en: "Car insurance or loan bills that mention one of your vehicles are linked to that vehicle automatically" },
    { k: "better", zh: "医疗、法律类账单（以及还不知道类型的扫描）发给 AI 之前，每次都会先让你确认；图片不保存", en: "Before a medical or legal bill (or a scan of unknown type) is sent to the AI you are asked to confirm each time; images are never stored" }
  ] },

  { v: "2026-11-17.11", title: { zh: "账单表单重排；「全部账单」从目录进来默认只看未缴", en: "Bill form reordered; All bills opens on unpaid bills from the menu" }, items: [
    { k: "better", zh: "周期性账单表单按顺序分成四步：① 这是什么账单 → ② 多少钱、多久一次 → ③ 怎么付 → ④ 提醒与其他；缴费方式、付款链接、账号尾号都归到「怎么付」里", en: "The recurring bill form now follows four steps: what it is, how much and how often, how it is paid, reminders and other; payment method, link and account digits all sit under How it is paid" },
    { k: "better", zh: "从目录直接打开「全部账单」默认只看未缴的；从概览卡片点进来则按卡片的条件", en: "Opening All bills from the menu shows unpaid bills by default; opening it from an overview card follows that card" },
    { k: "fix", zh: "一次性账单没填任何日期时不再消失，会一直显示在未缴的最后", en: "One-time bills with no dates no longer disappear; they stay at the end of the unpaid list" }
  ] },

  { v: "2026-11-17.10", title: { zh: "添加账单先选类型；记缴费时分清估算和实际金额", en: "Add a bill by choosing its type first; payments tell estimates from actual amounts" }, items: [
    { k: "new", zh: "点「添加账单」先选账单类型：周期性账单（水电气网、房贷、保险、订阅）或一次性账单（医疗、装修工程、法律、旅行），再进对应的表单", en: "Add bill now starts by choosing the type: recurring (utilities, mortgage, insurance, subscriptions) or one-time (medical, renovation, legal, travel)" },
    { k: "better", zh: "记缴费时会写明本期是固定金额还是预估（按最近几次的均值），填上实际金额，这一期就变成真实数字", en: "When logging a payment it now says whether the period uses a fixed amount or an estimate (recent average); enter the actual amount and it becomes a real number" },
    { k: "new", zh: "固定金额的账单涨价了：记缴费时可以勾选「用这次的金额更新通常金额」，下次就按新金额算", en: "If a fixed bill goes up, tick \u201cupdate the usual amount\u201d when logging a payment and later periods use the new amount" }
  ] },

  { v: "2026-11-17.9", title: { zh: "账单概览重做：六张卡片，点哪张就看哪些账单", en: "Bills overview rebuilt: six cards, tap one to see exactly those bills" }, items: [
    { k: "new", zh: "账单概览顶上是六张卡片：全部账单、逾期、已缴、下一笔到期、即将到期、剩余待缴；每张都能点，点进去就是对应的账单列表，笔数和金额对得上", en: "The overview opens with six cards: all bills, overdue, paid, next due, due soon and remaining balance; each opens the matching bill list with the same count and total" },
    { k: "new", zh: "可以选时间范围（默认本月）和资产（默认全部）；逾期没缴的不受时间限制，一直计入；下面有要处理的账单、按资产汇总和按月走势", en: "Pick a time range (this month by default) and an asset (all by default); unpaid overdue bills always count. Below: bills needing attention, a by-asset summary and a month-by-month chart" },
    { k: "better", zh: "添加账单改成右下角的圆形「＋」，点开选周期性账单或一次性账单；「花费速览」和「导出到日历」不再放在概览里", en: "Adding a bill is now a round + button at the bottom right (recurring or one-time); the spending summary and calendar export are no longer on the overview" }
  ] },

  { v: "2026-11-17.8", title: { zh: "新页面「全部账单」：所有账单一行一期，搜索筛选都有", en: "New All bills page: every bill, one row per due date, with search and filters" }, items: [
    { k: "new", zh: "财务 → 账单概览 → 全部账单：周期性和一次性账单排在一起，到期近的在前，已缴的放最后；每期显示状态、金额、已付和余额", en: "Finance → Bills overview → All bills lists recurring and one-time bills together, soonest due first and paid ones last, with status, amount, paid and balance" },
    { k: "new", zh: "可以搜索，也可以按时间（本月、下月、未来 30 天…）、资产（房产、车辆、设备、家人、项目）、状态、付款方式筛选；逾期没缴的不受时间限制，一直显示", en: "Search, or filter by time (this month, next month, next 30 days…), asset (property, vehicle, equipment, person, project), status and payment method; unpaid overdue bills always show" },
    { k: "better", zh: "页面顶上的合计（应付、已付、余额）随筛选变化；金额是估算的会标出来", en: "Totals (due, paid, balance) follow your filters, and estimated amounts are marked" }
  ] },

  { v: "2026-11-17.7", title: { zh: "账单可以挂在某辆车、某件设备上", en: "Bills can be attached to a vehicle or equipment" }, items: [
    { k: "new", zh: "周期性账单和一次性账单的表单里多了「关联资产」：车险、车贷、保养、维修的账单可以挂在对应的车或设备上", en: "Recurring and one-time bill forms have a new Linked asset field, so car insurance, loans, servicing and repairs can be attached to the vehicle or equipment" },
    { k: "new", zh: "账单清单顶上会提示「这几张账单可能属于某辆车」，点「确认」就挂上，不对就「忽略」，不会自动改", en: "The bill list suggests which bills may belong to a vehicle; tap Confirm to attach or Ignore to dismiss. Nothing changes automatically" }
  ] },

  { v: "2026-11-17.6", title: { zh: "账单概览重构的第一块地基（页面不变）", en: "Groundwork for the bills overview rebuild (no visible change)" }, items: [
    { k: "better", zh: "后台新增「账单按期计算」：周期性账单按需算出每一期的状态和金额，为接下来的「全部账单」页和新的账单概览做准备；现在看到的页面和功能不变", en: "Behind the scenes, bills are now worked out period by period (status and amount per due date), ready for the upcoming All bills page and new Bills overview; nothing you see changes yet" }
  ] },

  { v: "2026-11-17.5", title: { zh: "账单概览只讲账单", en: "Bills overview is about bills only" }, items: [
    { k: "better", zh: "财务里的「概览」改名「账单概览」，页面上去掉了「花费速览」，只留账单；花费请到 财务 → 花费 看", en: "Finance → Overview is now “Bills overview” and no longer shows the spending summary; find spending under Finance → Spending" }
  ] },

  { v: "2026-11-17.4", title: { zh: "账单数据表统一命名：周期性账单、一次性账单", en: "Bill tables renamed: recurring bills and one-time bills" }, items: [
    { k: "better", zh: "后台把账单的两张数据表改成更清楚的名字（周期性账单、一次性账单），看到的页面和功能不变", en: "Behind the scenes the two bill tables now have clearer names (recurring bills, one-time bills); what you see and do is unchanged" },
    { k: "better", zh: "以前导出的备份文件照样能恢复，不用重新导出", en: "Backups exported earlier can still be restored; no need to export again" }
  ] },

  { v: "2026-11-17.3", title: { zh: "房产视角看一次性账单：装修、翻新一目了然", en: "See one-time bills per property: renovations at a glance" }, items: [
    { k: "new", zh: "房屋里点某套房的「账单」，在周期性账单概览下面多了「一次性账单 / 项目」：应付合计、已付、余额，和最近的几张账单，还能直接「记一张」", en: "Open Bills from a property under Home and the recurring overview now ends with One-time bills / projects: total owed, paid, balance and the latest bills, plus a quick Add" },
    { k: "new", zh: "一次性账单列表多了「房产」筛选；财务 → 资产里每套房的「关联账单」也会写上一次性账单的数量和余额", en: "The one-time bills list has a Property filter, and each property under Finance → Assets now shows its one-time bill count and balance" }
  ] },

  { v: "2026-11-17.2", title: { zh: "一次性账单可以挂在某套房子上", en: "One-time bills can be linked to a property" }, items: [
    { k: "new", zh: "记一次性账单（装修、医疗、宠物等）时多了「房产」一栏，装修 / 项目账单默认选当前这套房，其他种类默认「与房产无关」，都可以改", en: "One-time bills (renovation, medical, pet…) now have a Property field; renovation / project bills default to the current property, other kinds to none, and you can change either" },
    { k: "better", zh: "已有的账单不受影响，需要的话打开账单补选房产即可", en: "Existing bills are unchanged; open one and pick a property if you want to link it" }
  ] },

  { v: "2026-11-17.1", title: { zh: "为「房产账单」打好数据基础", en: "Groundwork for per-property bills" }, items: [
    { k: "better", zh: "数据库新增「一次性账单挂房产」的字段（装修、翻新、屋顶等工程之后可以归到某套房子）；这一版界面没有变化，已有账单也不受影响", en: "The database can now link one-time bills (renovations, roof work…) to a property; nothing changes on screen yet and existing bills are untouched" }
  ] },

  { v: "2026-11-16.41", title: { zh: "车辆总览只有一辆车时卡片占满一行", en: "A single vehicle card fills the whole row" }, items: [
    { k: "better", zh: "车辆总览里只有一辆车时，这张卡占满一整行；两辆以上照常分两列，手机始终单列", en: "With a single vehicle the card fills the row; two or more still sit in columns, and phones stay single-column" }
  ] },

  { v: "2026-11-16.40", title: { zh: "? 展开不再撑宽卡片；「更多」圆钮改用 ⋮ 字符并统一成正圆", en: "The ? panel no longer widens the card; More buttons use the ⋮ glyph, always a true circle" }, items: [
    { k: "fix", zh: "车辆卡片里点 ? 展开后，说明里的问题文字不换行，把卡片撑宽、⋯ 圆钮和日期被挤出卡片；现在文字换行，卡片宽度不变（电脑和手机都在浏览器里实测过）", en: "On vehicle cards the unwrapped question text widened the card and pushed the menu and dates out when a ? opened; it now wraps and the card keeps its width (checked in the browser on laptop and phone widths)" },
    { k: "fix", zh: "全站「更多」圆钮不再用 CSS 画三个点，改用 ⋮ 字符，和 ? 圆钮同一字体、同一大小；提醒行里被拉成椭圆的圆钮也改回 32px 正圆", en: "Every More button now uses the ⋮ character instead of CSS-drawn dots, matching the ? circle; the ones stretched into ovals inside alert rows are true 32px circles again" }
  ] },

  { v: "2026-11-16.39", title: { zh: "修复 ? 一点全部展开、说明框越界", en: "Fix ? opening every row and the panel overflowing" }, items: [
    { k: "fix", zh: "车辆 / 设备卡片里「接下来的保养」每一行的 ? 现在各管各的：点一个只展开这一项（以前中文项目名都被当成同一个编号，一点全部展开）", en: "On vehicle and equipment cards each ? now opens only its own row (Chinese item names used to share one id, so one tap opened them all)" },
    { k: "fix", zh: "? 展开的说明框不再超出卡片边界", en: "The ? explanation panel no longer overflows the card" }
  ] },

  { v: "2026-11-16.38", title: { zh: "车辆卡片的操作收进右上角 ⋯；全站「更多」按钮统一样式", en: "Vehicle card actions move into the top-right menu; one style for every More button" }, items: [
    { k: "better", zh: "车辆总览的车辆卡片：记保养、详情合并进右上角的 ⋯ 菜单（第一项是记保养）", en: "On the vehicles page each card now has Log service and Details in a top-right menu (Log service first)" },
    { k: "better", zh: "全站所有「更多操作」按钮统一成房屋概览那种：32px 圆形、横排三点；原来有些地方是竖排三点", en: "Every More-actions button now looks like the one on the house overview: a 32px circle with horizontal dots (some places used vertical dots)" }
  ] },

  { v: "2026-11-16.37", title: { zh: "修复车辆卡片里 ? 圆钮的排版", en: "Fix the ? button layout on vehicle cards" }, items: [
    { k: "fix", zh: "车辆总览的车辆卡片：「接下来的保养」每行的 ? 圆钮错位、大小不一，现在是 名称 | 日期 | ? 同一行垂直居中，大小和其他圆钮一致；点开的说明另起一整行", en: "Vehicle cards: the ? button in each upcoming-service row was misplaced and mis-sized; it now sits on the same row as name and date, centered and sized like the other circles, with its explanation on its own line" }
  ] },

  { v: "2026-11-16.36", title: { zh: "添加车辆改为分步向导", en: "Add vehicle is now a step-by-step wizard" }, items: [
    { k: "new", zh: "添加车辆和添加房产一样改成分步向导：先填基本信息（动力类型、名称、品牌型号），点「下一步」才建车；再依次填车牌与里程、拥有状态与证照、车险、年份与保修、费用、备注", en: "Add vehicle works like Add property: basics first (type, name, brand and model), the car is created on Next, then plate and mileage, ownership and papers, insurance, years and warranty, cost and notes" },
    { k: "better", zh: "每步底部固定：上一步 / 跳过 / 保存并下一步在同一行，下面一行「全部跳过，稍后再填」", en: "Each step keeps a sticky bar: Back / Skip / Save and next on one row and Skip all, fill in later below" }
  ] },

  { v: "2026-11-16.35", title: { zh: "概览标题去下划线；车辆记保养进菜单；保养时间表改成卡片", en: "No underline on overview titles; Log service in the menu; schedule as cards" }, items: [
    { k: "better", zh: "房屋 / 车辆概览标题不再有下划线；车辆概览的「记保养」按钮放进名称旁 ⋮ 菜单（第一项）", en: "House and vehicle overview titles lose the underline; the vehicle overview Log service button moves into the menu next to the name (first item)" },
    { k: "fix", zh: "车辆保养时间表：原来的五列表格在手机上又挤又要左右滑，改成一项一张卡（周期 / 上次 / 下次 + 逾期或几天后标签 + 记一次）", en: "Vehicle service schedule: the cramped five-column table is now one card per item (cycle / last / next, an overdue or days-left badge, and Log)" }
  ] },

  { v: "2026-11-16.34", title: { zh: "车辆概览参考房屋概览重构", en: "Vehicle overview rebuilt like the house overview" }, items: [
    { k: "better", zh: "车辆概览：第一块是基本信息卡（名称、状态标签、车牌、里程、牌照、车险，右上「编辑」和 ⋮ 删除车辆），下面是导航豆腐块：车辆资料（完成度）、保养记录、保养时间表、买卖 / 归还、汽车房屋消耗品、出了问题", en: "Vehicle overview: a basics card (name, status tags, plate, mileage, registration, insurance, Edit and a menu with Delete) followed by nav tiles with stats: Vehicle profile, Service log, Schedule, Buy/sell/return, Supplies, Something wrong" },
    { k: "new", zh: "新的「车辆资料」页：每个分区一张卡，带完成度和各自的「编辑」，和房屋资料一样", en: "A new Vehicle profile page: one card per section with its own progress and Edit, like the home profile" }
  ] },

  { v: "2026-11-16.33", title: { zh: "向导的按钮和每月总计一起固定在底部", en: "Wizard buttons and monthly total stick together" }, items: [
    { k: "better", zh: "添加房产向导：每月总计（HOA 步骤）靠右排在最上，下面是按钮行和「全部跳过，稍后再填」，整块一起固定在页面底部", en: "Add-property wizard: the monthly total (HOA step) sits top-right, then the button row and Skip all, fill in later, all stuck to the bottom" }
  ] },

  { v: "2026-11-16.32", title: { zh: "向导按钮同一行等宽；第二行合成一个按钮", en: "Wizard buttons on one equal-width row; one button on row two" }, items: [
    { k: "better", zh: "添加房产向导：上一步、跳过、保存并下一步等宽排在同一行；第一页是取消、下一步一行；第二行合成一个占满整行的「全部跳过，稍后再填」", en: "Add-property wizard: Back, Skip and Save and next share one equal-width row; page one is Cancel and Next; row two is a single full-width Skip all, fill in later" }
  ] },

  { v: "2026-11-16.31", title: { zh: "添加房产向导按钮重新排列", en: "Add-property wizard buttons rearranged" }, items: [
    { k: "better", zh: "向导第一行按钮：上一步、跳过、保存并下一步；第 2 步起第二行是「全部跳过」（不保存这一步直接回概览）和「稍后再填」（保存这一步再回概览）", en: "Wizard row one: Back, Skip, Save and next; from step 2 a second row has Skip all (discard this step, go to the overview) and Fill in later (save this step, go to the overview)" }
  ] },

  { v: "2026-11-16.30", title: { zh: "添加房产向导可以返回上一步", en: "The add-property wizard has a Back button" }, items: [
    { k: "better", zh: "添加房产向导从第 2 步起多了「上一步」，已填的内容会保存，回去还能改", en: "The add-property wizard has Back from step 2; what you entered is saved and you can edit it" }
  ] },

  { v: "2026-11-16.29", title: { zh: "添加房产改为分步向导；概览路径去掉「概览」", en: "Add property is now a step-by-step wizard; overview path drops Overview" }, items: [
    { k: "new", zh: "房屋首页「添加房产」不再弹表单，直接进分步向导：先选地区、房型和用途（建房产），再依次填地址与建成年份、保险、HOA、产权、应急、设施、材料，每步可「跳过」或「稍后再填」", en: "Add property no longer pops a form: a step-by-step wizard starts with region, home type and use, then address, insurance, HOA, ownership, emergency, systems and materials; each step can be skipped or left for later" },
    { k: "better", zh: "房屋概览顶部路径只显示「房屋 / 房产名」，不再多一级「概览」；各处指向房产的链接都直接进概览", en: "The overview path shows Home / property name without an extra Overview level; links to a property open its overview directly" },
    { k: "better", zh: "概览里房产名不再是编辑链接，编辑请用旁边的「编辑」", en: "The property name on the overview is no longer an edit link; use the Edit button" }
  ] },

  { v: "2026-11-16.28", title: { zh: "消耗品可以属于某套房产或某辆车", en: "Supplies can belong to a property or a car" }, items: [
    { k: "new", zh: "汽车房屋消耗品多了「属于」：全家共用（默认）、某套房产或某辆车；添加 / 编辑物品时选，按房屋资料推荐加入的会归当前这套房产", en: "Home & car supplies now have Belongs to: shared (default), a property or a car; set it when adding or editing, and suggested supplies go to the current property" },
    { k: "new", zh: "有多套房产或车辆时，库存行上显示属于谁的小标签，筛选条多一个「属于」下拉", en: "With several properties or cars, inventory rows show who a supply belongs to and the filter bar has a Belongs to dropdown" },
    { k: "better", zh: "房屋概览的消耗品一行和消耗品页只看这套房产的（含全家共用）；车辆页也有自己的消耗品入口；「看全部」进库存时带上筛选", en: "The overview supplies row and page show only this property (plus shared); vehicles get their own entry; See all opens Inventory with the filter applied" }
  ] },

  { v: "2026-11-16.27", title: { zh: "修复房屋概览打不开", en: "Fix the house overview not opening" }, items: [
    { k: "fix", zh: "修复房屋概览页打不开（⋮ 菜单缺少引用）", en: "Fixed the house overview failing to open (missing menu import)" }
  ] },

  { v: "2026-11-16.26", title: { zh: "房产的归档 / 删除放进概览 ⋮；只有家主能管理；房产卡加用途标志", en: "Archive / delete in the overview ⋮; owner only; role flag on property cards" }, items: [
    { k: "better", zh: "房屋概览「编辑」旁多了 ⋮：归档、删除（默认房产也可以，会先换一套默认）；删除前会说明账单、花费、借贷保留但不再关联房产，资料、设备、任务、交易随房产一起删除", en: "The overview has a ⋮ next to Edit with Archive and Delete (the default property too; a new default is set first); the confirmation says bills, spending and loans are kept but unlinked, while profile, equipment, tasks and deals go with it" },
    { k: "better", zh: "设置里的「房产」去掉，房产只在房屋页管理；只有家主能新增、归档、恢复、删除", en: "Properties are gone from Settings and managed on the Home tab; only the owner can add, archive, restore or delete" },
    { k: "new", zh: "房屋首页每张房产卡上方有用途标志（自住 / 出租 / 租住，默认自住），默认房产带 ★", en: "Each property card on Home shows a role flag (Owner-occupied by default, Rented out, Renting) and a star for the default" }
  ] },

  { v: "2026-11-16.25", title: { zh: "房产只归档不删除；房屋首页可看已归档的房产", en: "Properties are archived, not deleted; see them on Home" }, items: [
    { k: "better", zh: "去掉设置里的「彻底删除」房产，避免账单、设备等数据失去对应房产；不再持有或租住的房产一律归档，数据都保留", en: "The permanent-delete option for properties is gone from Settings, so bills and equipment never lose their property; archive instead and everything is kept" },
    { k: "new", zh: "房屋首页多一个折叠块「已归档的房产」，点开能看到并一键恢复；房屋概览右上角也有「归档」", en: "Home has a fold, Archived properties, to view and restore them; the overview header also has Archive" }
  ] },

  { v: "2026-11-16.24", title: { zh: "消耗品页不再跳走，推荐功能随时都在", en: "Supplies page stays put; suggestions always available" }, items: [
    { k: "better", zh: "汽车房屋消耗品页：「手动添加」「按房屋设备资料推荐」随时都在，下面是缺货 / 少货和分类方块，「看全部」进库存；有物品后不再自动跳走", en: "The supplies page keeps Add manually and Suggest from profile in view, with low-stock items and category tiles below; See all opens Inventory; it no longer jumps away" }
  ] },

  { v: "2026-11-16.23", title: { zh: "概览精简；新增消耗品入口；应急信息并入第一块", en: "Slimmer overview; supplies entry; emergency info in the first card" }, items: [
    { k: "new", zh: "房屋概览的豆腐块下面加一行「汽车房屋消耗品」；还没有物品时点进去是空白页：手动添加 / 按房屋设备资料推荐，右下角 ＋ 也能选；有物品后直接进库存", en: "A supplies row under the overview tiles; the empty page offers Add manually / Suggest from profile (also via the ＋); once you have items it opens Inventory" },
    { k: "better", zh: "应急信息与关键位置并进第一块的折叠「材料设施应急」", en: "Emergency info now lives in the first card, in the fold Materials, systems & emergency" },
    { k: "better", zh: "概览去掉与豆腐块重复的交易清单、季节任务、设备档案、消耗品提醒；参考只留「哪些部位归谁维护」「材料保养建议」", en: "The overview drops the checklists, tasks, equipment and supply sections that repeat the tiles; Reference keeps who-maintains-what and material care" }
  ] },

  { v: "2026-11-16.22", title: { zh: "点房产直接进概览；概览加导航豆腐块；首页分区加边框", en: "Property opens its overview; nav tiles; bordered sections" }, items: [
    { k: "better", zh: "房屋首页的「房屋」「汽车」各放进一个带边框的分区，一眼分开", en: "Houses and Cars on the house home each sit in a bordered section" },
    { k: "better", zh: "点一套房产直接进概览，取消中间那层页面目录（旧链接照样能用）", en: "Tapping a property opens its overview directly; the page-directory step is gone (old links still work)" },
    { k: "new", zh: "概览第一块仍是基本信息；第二块是导航豆腐块：房屋资料（完成度）、季节任务（本月没做 / 总数）、账单（待处理 / 总数）、设备保养、交易（进度）、花费（本月明细）", en: "The overview keeps the basics first, then nav tiles with their own stats: profile (% complete), seasonal tasks, bills, equipment, deals and this month's spending" }
  ] },
  { v: "2026-11-16.21", title: { zh: "「？」和三点菜单按钮同样大小", en: "The ? and three-dot buttons are the same size" }, items: [
    { k: "fix", zh: "各房产要处理的事等提醒行里，三点菜单按钮和「？」统一成同样大小的圆（点按区域仍不小于 44px）", en: "On alert rows (including each property's to-dos) the three-dot button and the ? are now the same round size, with the tap area still at least 44px" }
  ] },
  { v: "2026-11-16.20", title: { zh: "房屋首页：房屋、汽车各一个分区，用卡片", en: "House home: Houses and Cars as separate card sections" }, items: [
    { k: "better", zh: "去掉「资产」那一层；房屋和汽车各是一个分区，每套房产、每辆车是一张卡片，只显示名称、状态、地址 / 车牌这些基本信息，不再放统计数字", en: "The Assets wrapper is gone; Houses and Cars are separate sections of cards showing basics only (name, status, address / plate), with no statistics" },
    { k: "new", zh: "每个分区最后一张空白的「＋ 添加」卡：添加房产 / 添加车辆", en: "The last card in each section is a blank + card to add a property or vehicle" }
  ] },
  { v: "2026-11-16.19", title: { zh: "保养记录页：以记录为主、右下角 ＋ 记保养", en: "Service records page: records first, ＋ button to log service" }, items: [
    { k: "better", zh: "保养记录页现在先看记录：最近的在前，有搜索（项目、收款方、备注）和类型 / 年份筛选，一次显示一批，点「继续加载」看更早的", en: "The service records page now leads with the records: newest first, with search and type / year filters, loaded in batches" },
    { k: "new", zh: "右下角一个圆形「＋」，点一下进「记保养」表单；记完或改完自动回到记录列表", en: "A round ＋ button at the bottom right opens the Log service form; saving returns to the list" },
    { k: "better", zh: "记录整行可点进编辑，行上只留「复制」；左滑仍可删除", en: "Tap anywhere on a record to edit it; only Copy stays on the row, and swipe left still deletes" }
  ] },
  { v: "2026-11-16.18", title: { zh: "设备保养页：提醒行和设备卡片重新排版", en: "Equipment page: alert rows and equipment cards reworked" }, items: [
    { k: "better", zh: "设备保养页顶部的提醒行和首页一致：实心圆点 + 名字旁的状态标签 + 右边「记保养」", en: "Alert rows on the equipment page match the home page: solid dot, status tag by the name, Log service on the right" },
    { k: "better", zh: "设备卡片整张都能点（进编辑），去掉「详情」按钮；「记保养」放在右边居中", en: "The whole equipment card is tappable (opens edit); the Details button is gone and Log service sits at the right, centered" },
    { k: "new", zh: "手机上设备卡片可以手势：向左滑 = 记保养（召回的是处理召回），向右滑 = 删除设备（会先确认）", en: "On phones: swipe an equipment card left to log service (or handle recall), right to delete it (after confirming)" }
  ] },
  { v: "2026-11-16.17", title: { zh: "房屋概览：名称、状态放进卡片顶部", en: "House overview: name and status inside the card header" }, items: [
    { k: "better", zh: "概览卡片顶部是 图标 + 房产名称（点一下就能改名称、类型、用途）+ 靠右的「编辑」；下面一行「状态 / 类型 / 用途」标签更醒目", en: "The card header is icon + property name (tap to edit name, type, use) with Edit on the right; the Status / Type / Use tags below stand out more" },
    { k: "better", zh: "「修改资料」改名「编辑」；去掉重复的房型名称行（如 独栋别墅）", en: "\"Edit profile\" is now \"Edit\"; the duplicate house-type name line is gone" }
  ] },
  { v: "2026-11-16.16", title: { zh: "房产名称也能在房屋资料里改", en: "Rename the property from the house profile" }, items: [
    { k: "new", zh: "房屋资料的「地区、房型与用途」里可以改房产名称，和设置里的房产是同一份，改一处两边都变", en: "Property name can be edited in the profile's Region, house type & use; it is the same record as in Settings" }
  ] },
  { v: "2026-11-16.15", title: { zh: "设备 / 车辆提醒：操作多了全收进三点菜单", en: "Equipment / vehicle alerts: many actions go into one menu" }, items: [
    { k: "better", zh: "设备和车辆的提醒行，操作超过 2 个时全部收进竖三点菜单（第一项加粗 = 默认要做的），手机上不再挤；2 个以内还是直接显示按钮", en: "On equipment and vehicle alert rows, more than 2 actions all go into the vertical three-dot menu (first item in bold = the default); 2 or fewer stay as buttons" },
    { k: "better", zh: "三点菜单按钮全站统一成 44px 的圆形，大小不再忽大忽小", en: "The three-dot button is now one 44px circle everywhere" }
  ] },
  { v: "2026-11-16.14", title: { zh: "所有编辑页：分区标题统一成带底色的横栏", en: "All edit pages: section headings share one tinted bar style" }, items: [
    { k: "better", zh: "房屋资料、账单、卡与账户、设备等编辑页的分区标题改成粗体、带浅绿底色的横栏，和下面的字段一眼分得开；样式和物品编辑页一致", en: "Section headings on the house profile, bills, cards, equipment… edit pages are now bold on a light green bar, matching the item page" }
  ] },
  { v: "2026-11-16.13", title: { zh: "房屋保险分行显示；概览去掉「编辑房产」", en: "Insurance shown line by line; Edit property removed from overview" }, items: [
    { k: "better", zh: "房屋保险分成几行：状态和有效期、保险公司、保单号、保障范围、年保费、理赔代理；资料页和概览页格式一致", en: "Home insurance is split into lines (status and dates, company, policy no., coverage, yearly premium, claims agent), the same on the profile page and the overview" },
    { k: "better", zh: "概览去掉「编辑房产」；房产的类型、用途、状态挪到资料里的「地区、房型与用途」", en: "Edit property is gone from the overview; type, use and status now live in the profile's Region, house type & use" },
    { k: "better", zh: "「修改资料」按钮放到卡片上面一行，标题不再被挤得换行", en: "The Edit profile button sits on its own row above, so the title no longer wraps" }
  ] },
  { v: "2026-11-16.12", title: { zh: "房屋资料：每一块一个卡片", en: "House profile: one card per section" }, items: [
    { k: "better", zh: "房屋资料页把每个分区（房型、地址、保险、HOA、产权、应急、设施、材料）做成一张卡片，直接显示现在填的内容和完成度，一页看全这套房子的基本信息", en: "The house profile page shows each section (type, address, insurance, HOA, ownership, emergency, features, materials) as a card with what is filled in and its progress" },
    { k: "better", zh: "每张卡片右上角有「编辑」，只进这一块自己的编辑页，各自保存", en: "Each card has its own Edit button that opens just that section" }
  ] },
  { v: "2026-11-16.11", title: { zh: "加入购物车页、设备提醒行重新排版", en: "Add-to-cart page; tidier equipment alert rows" }, items: [
    { k: "better", zh: "「加入清单」页改名「加入购物车」，「补货提醒」按钮放到「拍照」「手动」旁边", en: "\"Add to list\" page is now \"Add to cart\"; the Restock alerts button sits next to Photo and Manual" },
    { k: "better", zh: "设备和车辆的提醒行：左边是实心圆点（颜色表示紧急程度），状态标签（停止使用、召回、逾期…）紧跟在名字旁边；右边是处理召回 / 记保养，其余操作和「？怎么做」收进竖三点菜单", en: "Equipment and vehicle alert rows: a solid dot shows urgency, the status tag (Stop using, Recall, Overdue…) sits next to the name; the main action stays on the right and the rest, with the ? how-to, move into a vertical three-dot menu" }
  ] },
  { v: "2026-11-16.10", title: { zh: "采购看板整理、从看板进清单筛选重新开始", en: "Shopping board tidy-up; lists start fresh from the board" }, items: [
    { k: "better", zh: "录入购物的「录入方式」默认「入库 + 花费」，并排在最前面", en: "Log a purchase: \"Stock + spend\" is now the default and listed first" },
    { k: "better", zh: "采购看板去掉「加入购物车」那一行；「常去的商店与特价」拆成两格：「常去的商店」（几家、哪几家待更新）和「商店特价一览」", en: "The Add-to-cart row is gone from the Shopping board; Stores & deals is split into My stores (count, which need updating) and Store deals" },
    { k: "fix", zh: "从首页看板点进购物车、设备、账单、花费等清单，筛选回到默认，不再带着上次的筛选（如「家人认领」）", en: "Opening the cart, equipment, bills, spending… from a board tile now starts with default filters, not the last ones (e.g. Claimed)" }
  ] },
  { v: "2026-11-16.9", title: { zh: "录入购物：总额对得上小票", en: "Log a purchase: totals that match the receipt" }, items: [
    { k: "new", zh: "读到了小票合计、而商品和税费加起来还差一截时，自动补一行「差额（税费等）」，让记下的总额等于真实扣款；可以改金额或取消勾选", en: "When the receipt total is read and items plus fees fall short, a \"Difference (tax, fees…)\" line is added so the recorded total matches the charge; edit or untick it" },
    { k: "better", zh: "「税费及其他」下面多了「＋ 加一行税费」，金额先填成还差的那部分；合计对不上时，提示差多少", en: "\"＋ Add a tax / fee line\" under the fees block, prefilled with what's still missing; when totals differ it says by how much" }
  ] },
  { v: "2026-11-16.8", title: { zh: "录入购物：税费、小费、配送费也记下来", en: "Log a purchase: tax, tip and delivery fees are recorded too" }, items: [
    { k: "new", zh: "AI 识别时，税、小费、配送费、服务费、袋子费不再丢掉：确认页商品下面多一块「税费及其他」，每行可改金额、可取消勾选，记花费时一起记上，总额更接近真实扣款", en: "Tax, tip, delivery, service and bag fees are no longer dropped: a \"Tax, fees & other\" block under the items lets you edit or untick each line, and they're logged so the total is closer to what was actually charged" },
    { k: "new", zh: "新增花费分类「税费及服务费」（生活消费下），这些行归在这里，商品价格不受影响", en: "New spending category \"Tax, fees & service\" (under Living) holds these lines, so item prices stay accurate" }
  ] },
  { v: "2026-11-16.7", title: { zh: "「组别」选中的更醒目", en: "Selected Group stands out" }, items: [
    { k: "better", zh: "展开「组别」后，选中的那张是深绿边 + 浅绿底 + 右上角 ✓；没选的是白底浅灰边，一眼分得出", en: "In the open Group list the chosen card has a green border, tinted fill and a ✓; the others are plain white with a light border" }
  ] },
  { v: "2026-11-16.6", title: { zh: "编辑页：「组别」、购物车按钮改文字", en: "Item page: Group, text cart button" }, items: [
    { k: "better", zh: "「放在哪一类」改叫「组别」，下面一句话说明 组别 › 大类 › 小类 的关系；收起的一行像下拉框，说明完整显示；展开的卡片放在浅底色的框里", en: "\"Which group\" is now \"Group\", with a line explaining Group › Category › Subcategory; the folded row looks like a dropdown, descriptions show in full, and the options sit in a light box" },
    { k: "better", zh: "拍照旁的购物车按钮改成文字：「加入购物车」，已加入的变成「移出购物车」", en: "The cart button next to the photo button now says \"Add to cart\", or \"Remove from cart\" once it's in" }
  ] },
  { v: "2026-11-16.5", title: { zh: "「放在哪一类」改成卡片下拉", en: "\"Which group\" is now a card dropdown" }, items: [
    { k: "better", zh: "物品编辑页的「放在哪一类」收起时只占一行，显示选中的那一类和说明；点开是带说明的大卡片，选中后自动收起。新建物品默认展开，编辑已有物品默认收起", en: "\"Which group\" on the item page folds to a single row showing the chosen group and its description; open it to pick from big cards with descriptions. Expanded for new items, folded when editing" }
  ] },
  { v: "2026-11-16.4", title: { zh: "录入购物：选「只记花费 / 入库 + 花费 / 只入库」", en: "Log a purchase: choose Spend only / Stock + spend / Stock only" }, items: [
    { k: "new", zh: "图片下面多了「录入方式」：默认只记花费、不入库；也可以选入库 + 花费，或只入库、不记花费", en: "A new \"How to record\" choice under the photos: spend only by default; or stock + spend, or stock only with no spending logged" },
    { k: "better", zh: "线上订单的「订单文字」默认折叠，点标题展开再粘贴", en: "The online order's order text is folded by default; tap its title to paste" }
  ] },
  { v: "2026-11-16.3", title: { zh: "物品编辑页：状态、购物车一眼可见", en: "Item page: stock status and cart at a glance" }, items: [
    { k: "new", zh: "物品编辑页「基本信息」标题右边显示库存状态和 ✓🛒（已加入购物车）；拍照按钮旁边多了一个 🛒 按钮，点一下加入购物车，已加入的点一下移出", en: "The item page's Basics header shows the stock status and ✓🛒 when it's in the cart; next to the photo button there's a 🛒 button to add it to the cart (tap again to remove)" },
    { k: "better", zh: "库存里的 ✓🛒 靠右对齐，和概览一致", en: "✓🛒 in Inventory is right-aligned, like the overview" }
  ] },
  { v: "2026-11-16.2", title: { zh: "编辑页分区更清楚；备注框不再超出", en: "Clearer sections on the item page; notes box no longer overflows" }, items: [
    { k: "better", zh: "物品编辑页的几个分区各是一张卡片，标题是带底色的横栏，一眼看出有几块", en: "Each section of the item page is now its own card with a tinted header bar" },
    { k: "fix", zh: "手机上备注输入框不再超出屏幕右边", en: "The notes box no longer sticks out past the right edge on phones" },
    { k: "better", zh: "库存里的「已加入购物车」缩短成 ✓🛒 小图标", en: "\"In cart\" in Inventory is now a short ✓🛒 icon" }
  ] },
  { v: "2026-11-16.1", title: { zh: "库存行：提醒设置直接在行上改", en: "Inventory rows: set reminders right on the row" }, items: [
    { k: "better", zh: "库存里去掉 🔔 按钮：没设提醒的物品显示「不提醒」，点一下弹出小框，只填少货线和提前几天；设了提醒的显示「少货线 · 提前几天」，点一下可以改；少货、缺货时由对应的标签取代", en: "The 🔔 button is gone from Inventory: items without a reminder show \"No reminder\" — tap it for a small box with just the low-stock line and days ahead; items with a reminder show them on the same tag, tap to change; Low / Out tags take its place when stock runs down" },
    { k: "better", zh: "库存里的「已在清单」改叫「已加入购物车」，颜色和概览一样，只是标签不能点", en: "\"On the list\" in Inventory is now \"In cart\", colored like the overview tag (display only)" },
    { k: "better", zh: "概览「该补货了」：「未加入 / 已加入」靠右，名字加了下划线表示可点开编辑；说明里写明点标签也能加入 / 移出", en: "Overview \"Time to restock\": the Added / Not added tag sits at the right, names are underlined to show they open for editing, and the tip says tapping the tag also adds or removes" }
  ] },
  { v: "2026-11-15.14", title: { zh: "采购首页去掉重复的待买列表", en: "Shopping home drops the repeated to-buy list" }, items: [
    { k: "better", zh: "采购首页不再重复列出待买的东西：点「待购买」卡片进购物车，认领、买到、滑动、多选都在那里", en: "The Shopping home no longer repeats the to-buy list: tap the To buy card to open the cart, where claim, bought, swipe and multi-select all live" }
  ] },
  { v: "2026-11-15.13", title: { zh: "购物车按钮直达购物车；手势说明", en: "Cart button goes straight to the cart; gesture tips" }, items: [
    { k: "better", zh: "储藏概览的「购物车」按钮直接打开购物车；购物车顶上一行说明：左滑删除、右滑标成已买到", en: "The overview's Cart button opens the cart directly; the cart has a one-line tip: swipe left to delete, right to mark bought" }
  ] },
  { v: "2026-11-15.12", title: { zh: "购物车卡片更清爽", en: "Cleaner cart cards" }, items: [
    { k: "better", zh: "名字旁边是「几号加入」，名字下面是「建议用哪张卡」；「我来买」在左下角，数量和单位在右下角", en: "The date added sits next to the name and the suggested card under it; \"I'll buy it\" is at the bottom left, quantity and unit at the bottom right" },
    { k: "better", zh: "花费、在哪买、付款方式收进「记一笔花费（可选）」，需要时点开；填了照样在买到时记进花费", en: "Cost, store and payment are folded into \"Log the cost (optional)\"; anything you fill in is still recorded when you mark it bought" }
  ] },
  { v: "2026-11-15.11", title: { zh: "购物车：右下角 ＋ 添加", en: "Cart: add with the ＋ at the bottom right" }, items: [
    { k: "better", zh: "购物车的「添加」和「拍照添加」合成右下角一个圆形 ＋：默认拍照添加，可以切到手动", en: "The Cart's \"Add\" and \"Add from photo\" are now one round ＋ at the bottom right: photo by default, or switch to manual" }
  ] },
  { v: "2026-11-15.10", title: { zh: "购物车可以批量移出", en: "Remove several items from the cart at once" }, items: [
    { k: "new", zh: "购物车点「多选」，点行勾选（或「全选」），再点「移出购物车」，确认后一起移出；左滑、右滑照旧", en: "In the Cart, tap \"Select\", tick rows (or Select all), then \"Remove from cart\" and confirm; swiping still works as before" }
  ] },
  { v: "2026-11-15.9", title: { zh: "「采购清单」改叫「购物车」", en: "\"Shopping list\" is now \"Cart\"" }, items: [
    { k: "better", zh: "全应用的「采购清单」都改叫「购物车」，用法不变；购物车标题旁边显示有几项，搜索、筛选时跟着变", en: "\"Shopping list\" is called \"Cart\" everywhere and works the same; the Cart title shows how many items, following your search and filters" }
  ] },
  { v: "2026-11-15.8", title: { zh: "「该补货了」：滑动加入 / 移出购物车", en: "Time to restock: swipe to add or remove" }, items: [
    { k: "better", zh: "每件名字旁边显示「已加入」或「未加入」；手机上左滑加入购物车、右滑移出（移出前先确认），电脑上点这个标签", en: "Each item shows \"Added\" or \"Not added\" by its name; on phones swipe left to add to the cart and right to remove (you confirm first), on a computer tap the tag" },
    { k: "better", zh: "「全部加入采购清单」改叫「全部加入购物车」，换成淡黄色", en: "\"Add all to shopping list\" is now \"Add all to cart\" in light yellow" }
  ] },
  { v: "2026-11-15.7", title: { zh: "发新版后不会再因为旧缓存打不开", en: "No more blank page from an old cache after an update" }, items: [
    { k: "fix", zh: "发新版时，浏览器缓存里的所有脚本都会重新下载一遍，不会再出现新旧文件混在一起、页面打不开的情况；万一还是打不开，会自动再刷新一次", en: "After an update, every cached script is downloaded again, so old and new files no longer mix and break the page; if it still won't start, it refreshes once more by itself" }
  ] },
  { v: "2026-11-15.4", title: { zh: "录入购物页更简洁", en: "Simpler Log a purchase page" }, items: [
    { k: "better", zh: "只留下面一个「识别」按钮，拍了照或写了字才能点；小票的补充文字默认折叠，点开再写", en: "Just one \"Read it\" button at the bottom, active once there's a photo or text; the receipt's extra text is folded until you open it" },
    { k: "better", zh: "去掉了这一页的购买日期：识别后的确认页每张小票都可以改日期", en: "The purchase date is gone from this page: you can set it per receipt on the confirm page" }
  ] },
  { v: "2026-11-15.3", title: { zh: "「该补货了」的两个按钮更清楚", en: "Clearer buttons on Time to restock" }, items: [
    { k: "better", zh: "「全部加入采购清单」不再用醒目的黄色；旁边的购物车按钮写上「购物车」和件数，更容易看到", en: "\"Add all to shopping list\" is no longer bright yellow; the cart button next to it now says \"Cart\" with the count, so it's easier to spot" }
  ] },
  { v: "2026-11-15.2", title: { zh: "概览的添加物品改成右下角 ＋", en: "Overview: add items with the ＋ at the bottom right" }, items: [
    { k: "better", zh: "储藏概览和库存一样，用右下角的圆形 ＋ 添加物品（先选是哪一类）", en: "Like Inventory, the Pantry overview adds items with the round ＋ at the bottom right (pick the group first)" }
  ] },
  { v: "2026-11-15.1", title: { zh: "录入购物搬进储藏", en: "Log a purchase moves into Pantry" }, items: [
    { k: "better", zh: "「录入购物」成了储藏顶上的一张页面卡片（菜单旁边），手机上四张卡片排成两行；以前的链接和快捷操作照样能打开", en: "\"Log a purchase\" is now a page card at the top of Pantry, next to Meals; on phones the four cards sit in two rows. Old links and shortcuts still open it" },
    { k: "fix", zh: "录入购物的来源按钮在手机上换行，不再左右滑", en: "The source buttons on Log a purchase wrap on phones instead of scrolling sideways" }
  ] },
  { v: "2026-11-14.24", title: { zh: "物品表单的下拉和日期不再越界", en: "Item form dropdowns and dates fit again" }, items: [
    { k: "fix", zh: "手机上大类、小类、存放位置的下拉不再超出边框，和其他输入框一样宽、一样高；日期框也对齐了", en: "On phones, the Category, Subcategory and Location dropdowns no longer spill past the edge and match the other fields in width and height; date fields line up too" }
  ] },
  { v: "2026-11-14.23", title: { zh: "分类视图：每个大类可以一键加入采购清单", en: "Category view: add a whole category to the shopping list" }, items: [
    { k: "new", zh: "库存的分类视图里，每个大类标题旁有「🛒 全部加入采购清单」和要补货的件数，加之前确认数量", en: "In Inventory's category view, each category heading has \"🛒 Add all to shopping list\" with the number to restock; you confirm quantities first" }
  ] },
  { v: "2026-11-14.22", title: { zh: "物品表单的下拉可以打字筛选", en: "Type to filter in the item form's dropdowns" }, items: [
    { k: "better", zh: "添加 / 编辑物品时，大类、小类、存放位置可以打字筛选：电脑上点进去直接打字；手机上点了从底部弹出「搜索 + 清单」，不用滑很久", en: "When adding or editing an item, Category, Subcategory and Location can be filtered by typing: on a computer just type; on a phone a panel with a search box and the list slides up" }
  ] },
  { v: "2026-11-14.21", title: { zh: "按名字自动选分类和小类", en: "Category and subcategory picked from the name" }, items: [
    { k: "new", zh: "添加物品时边打名字边选好大类和小类（中英文都认：牛排 / steak → 肉蛋奶 · 肉禽，床垫 → 家具）；自己改过就不再动", en: "When adding an item, the category and subcategory are picked as you type the name (Chinese or English: steak → Meat, eggs & dairy, mattress → Furniture); once you change it yourself it stays" },
    { k: "better", zh: "拍小票新建的物品也会按名字补上小类", en: "Items created from a receipt scan get a subcategory from their name too" },
    { k: "better", zh: "已有物品按新分类整理后，搬过的会列在概览「请确认分类」里，可以一键「没错」或「改回」", en: "After existing items are re-sorted into the new categories, the moved ones are listed under \"Check categories\" on the overview, with one tap to confirm or move back" }
  ] },
  { v: "2026-11-14.20", title: { zh: "储藏分三类，名字说清楚用途", en: "Pantry in three clearly named groups" }, items: [
    { k: "better", zh: "三类改名：日常消耗品（吃的用的，会用完）、汽车房屋消耗品（房子院子车要换的）、家居耐用品（长期用的，只记几件、放哪）", en: "Three groups, renamed: Groceries & daily consumables, Home & car supplies, Household durables" },
    { k: "new", zh: "新分类：肉蛋奶、零食、家具、家用电器、玩具游戏、装饰收纳；婴童用品加「婴儿房」，常用的小类也补齐了", en: "New categories: Meat, eggs & dairy; Snacks; Furniture; Appliances; Toys & games; Decor & storage; Baby & kids gear gets Nursery, plus more subcategories" },
    { k: "better", zh: "点 ＋ 添加物品先选是哪一类，再进表单；表单里大类只列这一类的。概览也有了家居耐用品", en: "Tapping ＋ asks which group first, then opens the form with only that group's categories; the overview now shows Household durables too" },
    { k: "better", zh: "单位补齐：件、套、双、对、张、台、只、块、本、打等，衣服、鞋子、床品、家具、电器按名字自动选", en: "More units: piece, set, pair, table, unit, dozen and more, picked automatically for clothes, shoes, bedding, furniture and appliances" }
  ] },
  { v: "2026-11-14.19", title: { zh: "储藏概览更简洁；装备并进库存", en: "Simpler Pantry overview; Gear joins Inventory" }, items: [
    { k: "better", zh: "概览把「该补货了」放在最前；日常储备、房屋耗材只显示缺货 / 少货统计和分类卡片，多了一张「全部分类」", en: "The overview puts \"Time to restock\" first; Everyday stock and Home supplies just show the out / low counts and category cards, plus an \"All categories\" card" },
    { k: "new", zh: "库存的物品视图里，每一块都有「全部加入采购清单」，把这一块要补货的一起加进去（加之前确认数量）", en: "In the Inventory item view, each block has \"Add all to shopping list\" for the items that need restocking (you confirm quantities first)" },
    { k: "better", zh: "装备并进了库存，作为第三块，同样默认物品视图；点概览的分类卡片，库存按那个分类筛好", en: "Gear is now the third block in Inventory, with the item view by default; tapping a category card on the overview opens Inventory filtered to it" },
    { k: "better", zh: "采购清单默认最近加入的在前，刚加的一眼能看到", en: "The shopping list now shows the most recently added first, so you can see what you just added" }
  ] },
  { v: "2026-11-14.18", title: { zh: "加入采购清单前确认数量和单位", en: "Confirm quantity and unit before adding to the shopping list" }, items: [
    { k: "better", zh: "点任何「加入采购清单」（行上的按钮、右滑、全部加入、多选）都会先弹出一个框，确认每件买多少、什么单位；多件在同一个框里，不要的取消勾选", en: "Every \"Add to shopping list\" (row button, swipe, add all, multi-select) first opens a box to confirm how much and which unit; several items share one box, untick what you don't need" }
  ] },
  { v: "2026-11-14.17", title: { zh: "提醒开关更清楚；采购清单输入不再放大页面", en: "Clearer reminder switch; shopping list no longer zooms when typing" }, items: [
    { k: "better", zh: "库存行上的 🔔 改成圆形按钮，不提醒时整圈变黄；补货不会再自动改回提醒，设成什么就是什么", en: "The 🔔 on inventory rows is now a round button that turns yellow when muted; restocking no longer turns reminders back on" },
    { k: "fix", zh: "手机上点采购清单里的输入框（在哪买、价格、数量），页面不再被放大", en: "On phones, tapping a shopping list field (store, price, quantity) no longer zooms the page" },
    { k: "better", zh: "单位加了「箱」；储藏顶上的页面卡片去掉了采购清单（底部导航就有），库存只留右下角一个 ＋", en: "Added \"case\" as a unit; the Pantry page cards drop Shopping list (it's in the bottom bar), and Inventory keeps just the ＋ at the bottom right" },
    { k: "better", zh: "采购首页「待购买」整张卡片点进清单，尚未认领 / 已认领只作说明", en: "On the Shopping home, the whole \"To buy\" card opens the list; unclaimed / claimed are shown as info" }
  ] },
  { v: "2026-11-14.16", title: { zh: "列表里点整行就能打开", en: "Tap anywhere on a list row to open it" }, items: [
    { k: "better", zh: "账单、设备、补货提醒、分类视图的物品等列表：点这一行任何空白处就打开编辑，不用非点名字", en: "Bills, equipment, restock reminders, items in the category view and other lists: tap anywhere on the row to open it, not just the name" }
  ] },
  { v: "2026-11-14.15", title: { zh: "添加物品：默认不提醒，分块可折叠，单位用下拉", en: "Add item: no reminders by default, foldable sections, unit dropdown" }, items: [
    { k: "better", zh: "新物品默认不提醒；在「数量与提醒」里勾上「提醒补货」，才出现少货线和提前几天提醒", en: "New items have no reminders by default; tick \"Restock reminders\" under Quantity & reminders to set the low-stock line and days ahead" },
    { k: "better", zh: "表单按块折叠 / 展开（基本信息、数量与提醒、备注、花费）", en: "The form folds into sections (Basics, Quantity & reminders, Notes, Spending)" },
    { k: "better", zh: "单位改成下拉，袋、瓶、包、条、个、盒排在前面，也能选「其他…」手填；大类选「冷冻」默认小类是冷冻肉禽", en: "Unit is a dropdown with bag, bottle, pack, bar, piece and box first, or \"Other…\" to type one; choosing Frozen defaults the subcategory to Frozen meat" }
  ] },
  { v: "2026-11-14.14", title: { zh: "库存可以多选", en: "Select several items in Inventory" }, items: [
    { k: "new", zh: "库存点「多选」，再点行选中几件，一起加入采购清单、设成不提醒或删除；「全选」按当前筛选选", en: "Tap \"Select\" in Inventory, then tap rows to pick several items and add them to the shopping list, mute or delete them together; \"Select all\" follows the current filters" }
  ] },
  { v: "2026-11-14.13", title: { zh: "库存：一件一行，点行就能改", en: "Inventory: one row per item, tap to edit" }, items: [
    { k: "new", zh: "库存默认按物品一行行列出，日常储备、房屋耗材各一个大块；右上角可以切回原来的分类视图", en: "Inventory now lists one row per item, with Everyday stock and Home supplies as two big blocks; switch back to the category view at the top right" },
    { k: "better", zh: "点这一行任何地方就进编辑；数量、单位直接在行里改，单位是下拉，也能选「其他…」手填", en: "Tap anywhere on a row to edit it; change quantity and unit right in the row (unit is a dropdown, or pick \"Other…\" to type one)" },
    { k: "new", zh: "每行有个 🔔，点一下就不提醒，行上显示「不提醒」；手机上左滑删除、右滑加入采购清单", en: "Each row has a 🔔: tap it to stop reminders and the row shows \"Muted\"; on phones swipe left to delete, right to add to the shopping list" },
    { k: "better", zh: "右下角大号 ＋ 直接添加物品", en: "A big ＋ at the bottom right adds an item" }
  ] },
  { v: "2026-11-14.12", title: { zh: "储藏：页面导航卡片，概览更清楚", en: "Pantry: page cards on top, a clearer overview" }, items: [
    { k: "new", zh: "储藏的每个页面顶上都有一排页面卡片（概览 / 库存 / 采购清单 / 装备 / 菜单），当前页高亮", en: "Every Pantry page has a row of page cards on top (Overview / Inventory / Shopping list / Gear / Meals), with the current one highlighted" },
    { k: "better", zh: "概览只留「日常储备」「房屋耗材」两个大卡片，点标题折叠 / 展开；里面的缺货、少货等点一下直接看那些物品", en: "The overview has just two big cards, Everyday stock and Home supplies; tap the title to fold or open, and tap Out, Low and so on to see those items" },
    { k: "better", zh: "「录入购物」旁边加了「添加物品」，两个按钮都更大", en: "\"Add item\" now sits next to \"Log a purchase\", and both buttons are bigger" }
  ] },
  { v: "2026-11-14.11", title: { zh: "更正重复小票时，多出来的行由你决定删不删", en: "When correcting a duplicate receipt, you choose which extra lines to delete" }, items: [
    { k: "better", zh: "选「以这次为准」后，那次录了、这次没有的行默认保留，要删的自己勾上", en: "After \"Use this one\", lines only in the earlier entry are kept by default; tick the ones to delete" }
  ] },
  { v: "2026-11-14.10", title: { zh: "同一张小票录第二遍会提醒，可以更正第一次", en: "Logging the same receipt twice is caught, and can fix the first entry" }, items: [
    { k: "fix", zh: "家人先录了同一张小票、每行金额差几分（比如 Target 折扣分法不同）也能认出来：小票上方提醒是谁、哪天录的、合计多少", en: "If a family member already logged the same receipt, it's caught even when each line differs by a few cents (e.g. Target discounts split differently): a note at the top shows who logged it, when, and the total" },
    { k: "new", zh: "可以选「以这次为准」：更正那次的名称和金额，不记两遍、库存不重复加；或者「两次都留」", en: "Choose \"Use this one\" to correct the earlier names and amounts without counting twice or adding stock again, or \"Keep both\"" }
  ] },
  { v: "2026-11-14.9", title: { zh: "特价一览：看法切换移到左上角", en: "All deals: view switch moved to the top left" }, items: [
    { k: "better", zh: "「按商品 / 列表 / 卡片」单独放在标题下面的左上角，和搜索、筛选分开", en: "\"By item / List / Cards\" now sits on its own at the top left, separate from search and filters" }
  ] },
  { v: "2026-11-14.8", title: { zh: "Target 小票识别更准", en: "Better Target receipt reading" }, items: [
    { k: "fix", zh: "Target 小票：商品下面的 Circle Offer 优惠并进那件商品；Target Circle Card / RedCard 5% 这类整单折扣按金额比例分到每件商品，合计和小票对得上，不再全扣在最后一件上", en: "Target receipts: a Circle Offer under an item is taken off that item; whole-receipt discounts like Target Circle Card / RedCard 5% are spread across the items so the total matches, instead of all coming off the last item" },
    { k: "fix", zh: "「You saved」「Circle earnings」这类说明行、部门标题不再被当成商品；「2 @ $1.99」按 2 件、合计 3.98 记", en: "\"You saved\", \"Circle earnings\" and department headers are no longer read as items; \"2 @ $1.99\" is read as 2 items totalling 3.98" }
  ] },
  { v: "2026-11-14.7", title: { zh: "特价一览打得开了；小票折扣并进商品；财务金额遮挡补齐", en: "All deals opens; receipt discounts merge into items; money masking filled in" }, items: [
    { k: "fix", zh: "「特价一览」和采购清单的「比一比」打不开的问题修好了；看板上改成「几样清单上的有特价」，并写出是哪几样", en: "\"All deals\" and \"Compare\" on the shopping list now open; the dashboard shows how many list items are on sale and names them" },
    { k: "fix", zh: "采购清单选了特价后自动填的「在哪买」不会再被刷新冲掉", en: "The store filled in after picking a deal no longer disappears on refresh" },
    { k: "fix", zh: "录入小票：Costco 这类单独一行的折扣（/Pomegranate 3.00-）会并进那件商品，记成一条「石榴 8.99」；退货的负数金额不再被记成 0", en: "Receipts: separate discount lines (Costco \"/Pomegranate 3.00-\") merge into the item — one line \"Pomegranates 8.99\"; refund amounts are no longer saved as 0" },
    { k: "better", zh: "花费明细：去掉上面的统计和悬停「删除」，金额不遮；右边 ▾ 展开编辑 / 复制 / 删除。收入明细金额遮挡、去掉「N 笔，到账…」；借贷、预算、资产、收支总览里写在句子和按钮里的金额也会遮挡", en: "Spending details: no summary or hover Delete, amounts not masked, ▾ opens Edit / Copy / Delete. Income amounts are masked and the \"N records…\" line is gone; amounts in sentences and buttons on debts, budget, assets and the overview are masked too" }
  ] },
  { v: "2026-11-14.6", title: { zh: "特价一览按商品分组；今日页钱卡和咩咩咩小改", en: "All deals grouped by item; small Today tweaks" }, items: [
    { k: "better", zh: "特价一览默认「按商品」：同一样东西各家的特价放在一组比（巧克力：ALDI、Walmart、Costco…），清单上有的排在前面；列表、卡片两种看法还在", en: "All deals now groups by item by default: each item's deals from every store together (chocolate: ALDI, Walmart, Costco…), items on your list first; list and card views are still there" },
    { k: "better", zh: "今日页钱卡的每一行和其他卡片一样是浅灰底的圆角块；咩咩咩多了「加入采购清单」", en: "Money card rows on Today look like the other cards' rows; Baa Baa gets an \"Add to shopping list\" button" }
  ] },
  { v: "2026-11-14.5", title: { zh: "今日页卡片不再「卡住」点不动", en: "Today cards no longer get stuck" }, items: [
    { k: "fix", zh: "今日页的卡片自动换到第一张之后，有时点什么都没反应；现在每次换完都会回到可以点的那张，点链接一定有反应", en: "After the Today cards wrapped back to the first card, taps sometimes did nothing; the cards now always settle on a tappable copy" }
  ] },
  { v: "2026-11-14.4", title: { zh: "特价一览：各家特价放在一起比，采购清单可以选用哪一家", en: "All deals side by side; pick which store's deal each list item uses" }, items: [
    { k: "new", zh: "新的「特价一览」：各家有效期内的特价按商品列出，带价格、单价、商店；可搜索、按商店 / 分类 / 折扣类型筛选，列表和卡片两种看法。看板上「项特价对上清单」直接打开这里", en: "New \"All deals\": live deals from every store by item, with price, unit price and store; search, filter by store / category / deal type, list or card view. \"Deals on your list\" on the dashboard opens it" },
    { k: "better", zh: "采购清单每一项的特价改成下拉：可以自己选一家；旁边「比一比」看这一项在各家的特价，点「用这家」就显示在卡片上", en: "Each shopping-list item now has a dropdown of deals to pick from; \"Compare\" shows that item's deals at every store and \"Use this\" puts one on the card" },
    { k: "better", zh: "默认显示哪家：单价最低的；单价差不多时，先看清单上写的牌子，再看你常去的商店，再看远近。只写了「省 $4」没有价格的排在最后", en: "Default pick: lowest unit price; when similar, the brand on your list, then stores you use often, then distance. Deals showing only \"save $4\" come last" }
  ] },
  { v: "2026-11-14.3", title: { zh: "Costco 特价按分区读全", en: "Costco deals read section by section" }, items: [
    { k: "fix", zh: "Costco 用脚本更新时会一个一个打开分区：Grocery、Health & Personal Care、Apparel、Electronics，以及「See more」里的 Household、Optical、Pharmacy，不再漏掉整个 Grocery", en: "Updating Costco with the script now opens each section — Grocery, Health & Personal Care, Apparel, Electronics, plus Household, Optical and Pharmacy under \"See more\" — so Grocery is no longer missed" },
    { k: "better", zh: "更新记录里写出每个分区读到几条，少了哪个一眼看得出；特价分类多了「服装」「眼镜光学」", en: "The update log shows how many deals each section had, so a missing one stands out; new deal categories Apparel and Optical" }
  ] },
  { v: "2026-11-14.2", title: { zh: "今日页卡片更好点：钱卡每行可点、多了常用入口", en: "Today cards: tap each money row, more shortcuts" }, items: [
    { k: "fix", zh: "点卡片里的链接时，下面的进度条不再从头开始；只有左右滑动换卡时才重新计时", en: "Tapping a link in a card no longer restarts the progress bar; only swiping to another card does" },
    { k: "better", zh: "待办的每一行和其他卡片一样是浅灰底的圆角块，要紧的是淡红底", en: "To-do rows look like the other cards' rows; urgent ones are tinted red" },
    { k: "better", zh: "钱 · 本月：每一行点进对应的明细；下面多了对账单、记一笔花费、记一笔收入、预算", en: "Money · this month: each row opens its details; shortcuts below for statements, log spending, log income and budget" },
    { k: "new", zh: "快捷操作新加「加入采购清单」「拍照加入采购清单」「常去的商店」；前两个已经自动放进你的快捷操作，不要的可以在「编辑」里删", en: "Quick actions: new \"Add to shopping list\", \"Photo to shopping list\" and \"My stores\"; two are added to your list once — remove them in Edit if you don't want them" }
  ] },
  { v: "2026-11-14.1", title: { zh: "今日页的待办可以一条一条点进去", en: "Tap each to-do on the Today page" }, items: [
    { k: "better", zh: "今日 → 待办：每一行直接进那个模块（采购清单、账单、设备保养…）；点标题或底部「全部 N 件」进完整的待办页", en: "Today → To-dos: each row opens its own module (shopping list, bills, maintenance…); tap the title or \"All N\" for the full to-do page" }
  ] },
  { v: "2026-11-13.19", title: { zh: "采购清单右滑「已买到」；「不买了」改叫「取消认领」", en: "Swipe right for \"Bought\" on the shopping list; \"Not buying\" is now \"Unclaim\"" }, items: [
    { k: "better", zh: "手机上采购清单的一行：向右滑就是已买到（先确认），向左滑删除；「已买到」按钮在手机上不再显示", en: "On a phone, swipe a shopping-list row right to mark it bought (asks first), left to delete; the Bought button no longer shows on phones" },
    { k: "better", zh: "认领后的「不买了」改名「取消认领」：东西还在清单上，只是不再算你在买", en: "\"Not buying\" after claiming is now \"Unclaim\": the item stays on the list, it's just no longer marked as yours" }
  ] },
  { v: "2026-11-13.18", title: { zh: "特价列表在手机上更简洁：左滑删除、右滑加入清单", en: "Simpler deal list on phones: swipe left to delete, right to add to the list" }, items: [
    { k: "better", zh: "手机上特价那一行不再放按钮：向左滑删除、向右滑加入采购清单（都会先确认），点商品名称就能修改", en: "On a phone, deal rows have no buttons: swipe left to delete, right to add to the shopping list (both ask first), tap the name to edit" },
    { k: "better", zh: "修改特价时，折扣类型改成下拉选择，可以勾选好几个", en: "When editing a deal, the deal type is now a dropdown where you can tick several" }
  ] },
  { v: "2026-11-13.17", title: { zh: "商店卡片左滑删除；网格里直接添加商店", en: "Swipe left to delete a store; add a store right in the grid" }, items: [
    { k: "new", zh: "常去的商店：手机上商店卡片向左滑就能删除，删除前照样会确认", en: "My stores: on a phone, swipe a store card left to delete it — you still confirm first" },
    { k: "new", zh: "商店列表最后多了一张「＋ 添加商店」空白卡，点一下就在那里展开表单；右上角「手动添加」再点一次就收起", en: "A blank \"+ Add store\" card at the end of the list opens the form right there; tap \"Add by hand\" again to close it" }
  ] },
  { v: "2026-11-13.16", title: { zh: "商店卡片上标出每周几换广告", en: "Store cards show the weekly ad day" }, items: [
    { k: "better", zh: "常去的商店：设了每周换广告的商店，卡片上显示「每周三换广告」这样的标签；打开了自动更新的前面带 🤖", en: "My stores: stores with a weekly ad show a tag like \"New ad every Wed\"; ones with auto-update have a 🤖 in front" }
  ] },
  { v: "2026-11-13.15", title: { zh: "自动更新跟着每家的换广告日走", en: "Auto-update follows each store's ad day" }, items: [
    { k: "better", zh: "自动更新不再固定周四：每天早上看一次，哪家到了换广告日（周日、周三…）就更新哪家", en: "Auto-update is no longer Thursdays only: it checks every morning and updates each store on its own ad day (Sunday, Wednesday…)" },
    { k: "better", zh: "那天电脑没开或者读失败了，第二天会再试", en: "If the laptop was off or a read failed, it tries again the next day" }
  ] },
  { v: "2026-11-13.14", title: { zh: "英文特价对上家里的中文物品；不同牌子合在一起比", en: "English deals matched to your own item names; brands compared together" }, items: [
    { k: "better", zh: "录入特价时自动对上储藏里的物品名（中文也行），不同牌子的同一样东西（比如各家的鸡蛋）按同一个名字比价、看以前的价格", en: "New deals are matched to your storage item names (Chinese too), so the same thing from different brands — eggs from any store — is compared under one name" },
    { k: "fix", zh: "首页采购看板：「6 家待更新」在手机上不再被拆成两行", en: "Shopping dashboard: \"6 to update\" no longer splits across two lines on phones" }
  ] },
  { v: "2026-11-13.13", title: { zh: "特价旁边看以前的价格；长期特价换广告时不再被删", en: "Earlier prices next to each deal; long-running deals survive a new ad" }, items: [
    { k: "new", zh: "每条特价下面显示以前的价格：现在是不是 6 个月最低；不是的话写出以前最低多少、哪家、哪天，点开看最近 10 次", en: "Each deal shows earlier prices: whether it's a 6-month low, or the earlier low, store and date — tap to see the last 10" },
    { k: "better", zh: "换新一周的广告时，到期更晚、这次广告里没出现的特价（比如 Costco「到 12/7」）会留着，不再一起删掉", en: "When a new week's ad comes in, deals that end later and aren't in the new ad (like Costco's \"through 12/7\") are kept" },
    { k: "better", zh: "过期超过 6 个月的特价自动清掉", en: "Deals that ended more than 6 months ago are cleared automatically" }
  ] },
  { v: "2026-11-13.12", title: { zh: "脚本更新 Walmart 不再报错；特价只看吃的、日用、宝宝用品", en: "Walmart script update fixed; deals focus on food, household and baby" }, items: [
    { k: "fix", zh: "商店页「🤖 用脚本更新」和每周四自动更新：读完的特价存不进去（报 shop_deals_source_check）的问题修好了", en: "\"Update with script\" and the Thursday auto-update could not save the deals they read (shop_deals_source_check error) — fixed" },
    { k: "better", zh: "Walmart 这类大店只读 Food、Food savings、Household essentials savings、Baby savings 几个分区，跳过电视、家电、玩具", en: "Big stores like Walmart: only the Food, Food savings, Household essentials savings and Baby savings sections are read — TVs, appliances and toys are skipped" },
    { k: "better", zh: "读特价时先找家里告急的、采购清单上的、储藏里常补的东西", en: "Reading deals looks first for what is running low, what is on the shopping list, and what you restock often" }
  ] },
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
