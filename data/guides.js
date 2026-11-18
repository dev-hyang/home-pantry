/* 买卖指南（买房 / 买车 / 卖房 / 卖车）：只读内容，不产生任何记录。设计见 docs/design-bills-overview.md §17。
 * 每个文本是 [中文, English] 一对。内容是「美国通用原则 + 伊利诺伊的特有项」，仅供参考，不是法律或财务建议；合同条款以你签的合同和你的律师 / 经纪人为准。
 * 结构：GUIDES[kind] = { icon, name, intro, stages: [{ id, title, why, steps: [文本], decisions: [{ q, options: [{ name, pros, cons }], ask: [文本] }], pitfalls: [文本], checklist: { title, items: [文本] }, tip }] }
 * checklist 的勾选只存在这台设备上（localStorage），不入库。 */
(() => {
  "use strict";
  const REGION = {
    note: ["以下以美国通用原则为主，并标出伊利诺伊（Illinois）常见做法；其他州的规定可能不同，请以当地律师 / 经纪人为准。", "Mostly general US principles, with Illinois practice marked; other states differ, so confirm with a local attorney or agent."],
  };

  const GUIDES = {
    /* ───────────── 买房 ───────────── */
    buy_home: {
      icon: "🏠", name: ["买房", "Buy a home"],
      intro: ["从「买得起多少」到「拿到钥匙」的完整路线。每一阶段告诉你：为什么要做、怎么做、常见的坑、需要你做的决定。这里只是指南，不会创建房产或任何记录。", "The whole road from “how much can I afford” to getting the keys. Each stage says why, how, common pitfalls and the decisions you need to make. This is a guide only: it creates no property or other record."],
      stages: [
        { id: "prep", title: ["① 准备：预算与贷款", "1. Prepare: budget and financing"],
          why: ["先知道自己能买多少，后面才不会白看房，也让卖家认真对待你的出价。", "Knowing your range first saves wasted viewings and makes sellers take your offer seriously."],
          steps: [["算每月能负担的总成本：月供 + 房产税 + 房屋保险 + HOA + 维护（每年约房价的 1%）。别只看房价。", "Work out the monthly total you can carry: mortgage + property tax + insurance + HOA + upkeep (about 1% of the price a year). Do not look at the price alone."],
            ["攒首付和交割费用（通常是房价的 2–5%）和一笔应急金，不要把现金全部压进首付。", "Save the down payment, closing costs (usually 2–5% of the price) and an emergency fund; do not put all your cash into the down payment."],
            ["向 2–3 家贷款机构（银行、信用社、贷款经纪）询价，比较利率、费用和点数（points），拿一份贷款预批信（pre-approval）。", "Get quotes from 2–3 lenders (banks, credit unions, brokers), compare rate, fees and points, and get a pre-approval letter."],
            ["查一下信用报告，提前处理错误；预批前后不要开新卡、换工作、做大额消费。", "Check your credit reports and fix errors early; avoid new cards, job changes or big purchases around pre-approval."]],
          decisions: [{ q: ["要不要找买方经纪人（buyer's agent）？", "Do you need a buyer's agent?"],
            options: [{ name: ["找经纪人", "Use an agent"], pros: ["帮你找房、约看房、写出价、谈判、盯合同期限；多数情况下买方不直接付佣金（由交易费用承担，以合同为准）。", "Finds homes, books viewings, writes offers, negotiates and tracks deadlines; the buyer often does not pay directly, but check your agreement."], cons: ["质量参差；要看签的买方代理协议（期限、佣金条款）。", "Quality varies; read the buyer agency agreement (term, commission clause)."] },
              { name: ["自己来（不找）", "Go without one"], pros: ["灵活；可能省下一些成本。", "Flexible; may save some cost."], cons: ["要自己懂流程和期限；谈判和文件风险大，小白不建议。", "You must know the process and deadlines yourself; negotiation and paperwork risk is high, so not advised for first-timers."] }],
            ask: [["你最近一年带过几位买家、成交多少套？我的价位和区域你熟吗？", "How many buyers have you helped in the past year? Do you know my price range and area?"], ["代理协议多久？可以中途终止吗？佣金怎么算、谁来付？", "How long is the agency agreement, can it be ended early, and how is the commission paid and by whom?"], ["你推荐哪几位贷款顾问、验房师、律师？是否有关联利益？", "Which lenders, inspectors and attorneys do you recommend, and do you have any link to them?"]] }],
          pitfalls: [["预批 ≠ 一定放贷：交割前贷款机构还会重新核实收入、资产和信用。", "Pre-approval is not a guarantee: the lender re-checks income, assets and credit before closing."], ["别只看「月供」：税、保险、HOA 会让总成本高出很多。", "Do not look only at the payment: tax, insurance and HOA can add a lot."]],
          tip: ["伊利诺伊：房产税按县征收（如 Cook County），同一价位不同社区税额差别很大，看房时就问清去年的税额。", "Illinois: property tax is set by county (e.g. Cook County) and varies a lot between areas at the same price; ask for last year’s tax when viewing."] },

        { id: "search", title: ["② 找房与看房", "2. Search and view"],
          why: ["把想要的变成清晰的条件，看房时才不会被装修和气氛迷惑。", "Turn what you want into clear criteria so staging and atmosphere do not sway you."],
          steps: [["写下「必须有」和「最好有」：地区、预算上限、卧室数、通勤、学区、院子 / 车位、房龄。", "Write down must-haves and nice-to-haves: area, budget cap, bedrooms, commute, schools, yard or parking, age."],
            ["常见渠道：Zillow、Redfin、Realtor.com、经纪人的 MLS 提醒、开放日（open house）；设好搜索提醒，热门房源几天就没。", "Common sources: Zillow, Redfin, Realtor.com, your agent’s MLS alerts and open houses; set saved-search alerts because good listings go in days."],
            ["第一次看房先看整体：采光、气味、噪音、街区；有意向再约第二次，换个时间段（晚上、雨天）。", "First visit: light, smells, noise, the street; for a second visit go at a different time (evening, rain)."],
            ["每套看完立刻用下面的清单打分、拍照，别等到晚上凭记忆。", "Score each one with the checklist right after the visit and take photos; do not rely on memory later."]],
          decisions: [],
          pitfalls: [["被「新装修」吸引：地板、墙漆会掩盖问题；重点看结构、屋顶、管道、电、地下室、排水。", "Falling for a fresh renovation: floors and paint can hide problems; focus on structure, roof, plumbing, electrical, basement and drainage."], ["忽略周边：噪音、航线、施工、洪水区、未来规划。", "Ignoring the surroundings: noise, flight paths, construction, flood zones, future plans."]],
          checklist: { title: ["看房清单", "Viewing checklist"], items: [["外观：屋顶有无翘瓦 / 青苔、排水沟、外墙裂缝、地基有无明显裂缝", "Exterior: roof shingles and moss, gutters, wall cracks, obvious foundation cracks"], ["地面坡度：雨水是否流向房子", "Grading: does rain run toward the house"], ["地下室 / 地基：潮味、水渍、白色盐渍、裂缝、地漏", "Basement and foundation: damp smell, water marks, white efflorescence, cracks, floor drain"], ["水：每个龙头水压、热水多久来、马桶冲水、下水是否慢", "Water: pressure at each tap, hot water delay, toilet flush, slow drains"], ["电：电箱年代和品牌、插座是否够用 / 有无接地、有无松动或发黑", "Electrical: panel age and brand, enough grounded outlets, loose or scorched outlets"], ["暖通：炉子和空调的年份、上次保养、是否有异响", "HVAC: age of furnace and A/C, last service, strange noises"], ["窗户和门：是否能正常开关、密封、有无结露或起雾", "Windows and doors: open and close properly, seals, condensation or fogging"], ["天花板 / 墙角水渍、霉斑、新刷过的一块（可能盖水渍）", "Ceiling and corner water stains, mold, a freshly painted patch (may hide a stain)"], ["气味：烟味、宠物味、霉味、过重的香氛", "Smells: smoke, pets, mold, heavy air fresheners"], ["采光和噪音：不同房间的光线；关窗后能听到什么", "Light and noise: light in each room; what you hear with windows closed"], ["厨房 / 卫浴：柜子、台面、排风扇、防水", "Kitchen and baths: cabinets, counters, fans, waterproofing"], ["储物、车位、院子、围栏、邻居的状态", "Storage, parking, yard, fences, state of the neighbours"], ["HOA（如果有）：月费、规章、特别评估、是否允许出租 / 养宠物", "HOA if any: dues, rules, special assessments, rental and pet rules"], ["向经纪人问：挂牌多久、降过价吗、卖家为何卖、去年水电费和房产税", "Ask the agent: days on market, price cuts, why selling, last year’s utilities and tax"]] } },

        { id: "compare", title: ["③ 比较几套", "3. Compare options"],
          why: ["用同一把尺子比，避免被最后看的那套带偏。", "Use the same yardstick so the last house you saw does not win by default."],
          steps: [["把每套的关键数字放在一起：价格、每月总成本、面积、房龄、HOA、房产税、通勤时间、需要马上花的钱（屋顶、炉子等）。", "Put the key numbers side by side: price, monthly total, size, age, HOA, tax, commute, and money needed soon (roof, furnace…)."],
            ["给每项打 1–5 分并给权重（你最在乎什么就给最高权重）；总分只是参考，直觉也算一项。", "Score each factor 1–5 with weights (highest for what matters most); the total is a guide, and gut feeling counts too."],
            ["把「买下后马上要花的钱」折进价格比较：一套便宜但要换屋顶的，未必更便宜。", "Add the money you must spend right after buying to the price: a cheaper house that needs a new roof may not be cheaper."],
            ["拿近期同区、同大小的成交价（comps）看这个价格合不合理，请经纪人出一份。", "Check recent comparable sales (comps) for the area and size; ask your agent for a comp report."]],
          decisions: [], pitfalls: [["只比挂牌价：成交价常和挂牌价不同，要看 comps。", "Comparing list prices only: sale prices often differ, so look at comps."]],
          tip: ["比较表和候选清单会在下一阶段（计划与候选）里做成可以保存、全家共享的表。", "The comparison table and shortlist will become a saved, shared feature in the next release."] },

        { id: "offer", title: ["④ 出价与谈判", "4. Offer and negotiation"],
          why: ["出价不只是价格，还有定金、条件和时间；条件写清楚才保护你。", "An offer is more than price: earnest money, contingencies and timing; clear conditions protect you."],
          steps: [["和经纪人一起看 comps、挂牌天数、卖家是否急着卖，定一个出价区间和你的底线。", "With your agent, review comps, days on market and seller urgency, then set an offer range and a walk-away number."],
            ["决定定金（earnest money，常见 1–2%）：多交显得更认真，但要确认退还条件。", "Decide the earnest money (often 1–2%): more shows seriousness, but confirm when it is refundable."],
            ["写进你要保留的条件（contingency）：律师审查、验房、贷款、评估；有的竞价会放弃部分条件，风险自己承担。", "List the contingencies you keep: attorney review, inspection, financing, appraisal; some bidding wars waive some, and the risk is yours."],
            ["卖家还价时，每一轮都回到你的底线和总成本，别被「再加一点点」一步步带过线。", "On each counter-offer return to your walk-away number and total cost; do not creep past it a little at a time."]],
          decisions: [{ q: ["竞价激烈时要不要放弃某些条件？", "In a bidding war, waive any contingency?"],
            options: [{ name: ["保留验房和贷款条件", "Keep inspection and financing"], pros: ["出问题可以退出或重谈，定金受保护。", "You can exit or renegotiate on problems and your deposit is protected."], cons: ["出价没那么有吸引力。", "A less attractive offer."] }, { name: ["放弃部分条件", "Waive some"], pros: ["更容易中标。", "More likely to win."], cons: ["出问题可能损失定金或被迫接受问题；先和律师、经纪人确认风险。", "You may lose the deposit or be stuck with the problem; confirm the risk with your attorney and agent first."] }],
            ask: [["放弃这一项最坏会怎样？我能承受吗？", "What is the worst case of waiving this, and can I afford it?"]] }],
          pitfalls: [["口头承诺不算数：一切以书面合同为准。", "Verbal promises do not count: everything must be in the written contract."], ["为赢而超预算：赢了出价却输了生活。", "Overbidding to win: you win the house and lose your finances."]] },

        { id: "contract", title: ["⑤ 合同期：各个 contingency 的倒计时", "5. Under contract: contingency countdowns"],
          why: ["签约后每一项条件都有截止日，错过可能失去退出的权利或定金。这一阶段最需要日历。", "After signing every condition has a deadline; missing one can cost you your right to exit or your deposit. This is the stage that needs a calendar."],
          steps: [["签约当天，把合同里每个截止日抄进日历（应用里的买入清单会按合同日自动排好）。", "On signing day copy every deadline from the contract into a calendar (the buy checklist in this app schedules them from the contract date)."],
            ["律师审查期：伊利诺伊常见约 5 个工作日（以合同为准）；律师可批准、提出修改或退出。", "Attorney review: about 5 business days is common in Illinois (check your contract); the attorney can approve, propose changes or cancel."],
            ["验房期：预约验房（结构、屋顶、管道、电、暖通），按需加测氡气、白蚁、下水管、化粪池 / 井水；拿到报告后在期限内书面提出修理或让价要求。", "Inspection period: book a home inspection (structure, roof, plumbing, electrical, HVAC), add radon, termite, sewer scope, septic or well tests as needed; make written repair or credit requests within the deadline."],
            ["贷款：按时交齐材料，拿到贷款承诺（commitment）；期间不要动资金和信用。", "Financing: deliver documents on time and get the commitment; do not move money or credit meanwhile."],
            ["评估（appraisal）：评估价低于成交价时，可以重谈、补差额或按合同退出。", "Appraisal: if it comes in below the price you can renegotiate, cover the gap or exit under the contract."],
            ["产权调查与产权保险（title）：律师 / 产权公司查有没有留置权、纠纷；HOA 文件和无欠费证明也在这一阶段拿。", "Title search and title insurance: the attorney or title company checks liens and disputes; get HOA documents and a paid-assessment letter in this stage."]],
          decisions: [], pitfalls: [["错过验房或贷款条件的期限：可能视为放弃该条件。", "Missing the inspection or financing deadline may count as waiving that condition."], ["期间换工作、开新卡、大额转账：贷款可能被取消。", "Changing jobs, opening cards or moving large sums can sink the loan."]],
          tip: ["把每个截止日的「错过会怎样」写在日历备注里，临近时更容易做决定。", "Put “what happens if I miss it” in each calendar note so deadlines are easier to act on."] },

        { id: "preclose", title: ["⑥ 交割前", "6. Before closing"],
          why: ["交割日前一周把钱、保险、水电、最终查验都安排好，避免最后一刻出岔子。", "Line up funds, insurance, utilities and the final walk-through the week before closing to avoid last-minute surprises."],
          steps: [["房屋保险：交割日生效，把保单发给贷款机构。", "Homeowner’s insurance effective on closing day; send the policy to the lender."], ["准备交割资金；电汇前一定打电话到已知号码核实账户，防诈骗邮件。", "Prepare closing funds; before wiring always call a known number to verify the account, because wire fraud emails are common."], ["预约水电燃气网络从交割日开户，办 USPS 地址变更。", "Schedule utilities and internet to start on closing day and file a USPS address change."], ["最终查验（walk-through）：确认约定的维修已完成、设备能用、没有新损坏。", "Final walk-through: confirm agreed repairs are done, appliances work and nothing new is damaged."], ["核对交割单（closing disclosure）：金额和你的预期是否一致，提前问清每一项费用。", "Check the closing disclosure: do the numbers match your expectations; ask about every fee beforehand."]],
          decisions: [], pitfalls: [["电汇给错账户几乎追不回来：永远用已知号码回拨确认。", "Money wired to the wrong account is almost impossible to recover: always confirm by calling a known number."]] },

        { id: "after", title: ["⑦ 交割与之后", "7. Closing and after"],
          why: ["拿到钥匙只是开始：换锁、建档案、设账单、申请减免。", "Getting the keys is just the beginning: locks, records, bills, exemptions."],
          steps: [["交割日：签字、付款、拿钥匙；留好 closing statement 和所有文件。", "Closing day: sign, pay, get keys; keep the closing statement and all documents."], ["当天换锁、测试烟雾和一氧化碳报警器。", "Change the locks and test smoke and CO alarms that day."], ["在本应用里：新建这套房产（状态选「持有」）、建设备档案和账单；买入清单里的「交割后」事项会提醒你。", "In this app: add the property (status Owned), set up equipment and bills; the post-closing items in the buy checklist will remind you."], ["伊利诺伊：自住房可申请 Homestead Exemption（以县评估办公室规定为准）；HOA 登记、停车位和门禁。", "Illinois: owner-occupied homes may claim the Homestead Exemption (per the county assessor); register with the HOA and set up parking and access."]],
          decisions: [], pitfalls: [] },
      ],
    },

    /* ───────────── 买车 ───────────── */
    buy_vehicle: {
      icon: "🚗", name: ["买车", "Buy a car"],
      intro: ["从决定买什么车到提车的路线：新车还是二手、怎么付、怎么谈、要办什么手续。这里只是指南，不会创建车辆或任何记录。", "From deciding what to buy to driving it home: new or used, how to pay, how to negotiate, what paperwork. This is a guide only and creates no vehicle or record."],
      stages: [
        { id: "prep", title: ["① 准备：预算与怎么付", "1. Prepare: budget and payment"],
          why: ["先定总预算和付款方式，经销商的月供游戏就不容易迷惑你。", "Fix your total budget and payment method first, so the dealer’s monthly-payment games do not confuse you."],
          steps: [["算总持有成本：车价 + 税费 + 保险 + 油 / 电 + 保养 + 折旧；月供只是其中一块。", "Estimate total ownership cost: price + taxes and fees + insurance + fuel or power + maintenance + depreciation; the payment is only a part."], ["先向银行或信用社拿一份预批贷款，当作和经销商谈判的底牌。", "Get pre-approved by a bank or credit union first and use it as a benchmark against the dealer."], ["提前问保险报价：同样的车不同车型保费差很多。", "Get insurance quotes early: premiums differ a lot between models."], ["确定电动车可以怎么充电（家里能不能装、附近公共桩）和是否有税收优惠（以当年政策为准）。", "For an EV, check where you can charge (home install, public chargers) and any incentives (check current rules)."]],
          decisions: [{ q: ["新车还是二手？", "New or used?"], options: [{ name: ["新车", "New"], pros: ["有完整保修、没有前任问题、可能有低利率促销。", "Full warranty, no previous owner issues, possible low-rate promotions."], cons: ["折旧快；价格和费用更高。", "Depreciates fast; higher price and fees."] }, { name: ["二手 / 认证二手", "Used / certified pre-owned"], pros: ["价格低、折旧慢；认证二手通常带延长保修。", "Lower price, slower depreciation; certified pre-owned often has an extended warranty."], cons: ["需要查事故和保养记录、做第三方验车。", "You need history reports and an independent inspection."] }], ask: [["这辆车有没有事故、泡水、召回未处理的记录？", "Any accident, flood or open-recall history?"]] },
            { q: ["全款、贷款还是租赁？", "Pay cash, finance or lease?"], options: [{ name: ["全款", "Cash"], pros: ["没有利息，最简单。", "No interest, simplest."], cons: ["占用大笔现金。", "Ties up cash."] }, { name: ["贷款", "Finance"], pros: ["现金灵活；车是你的。", "Keeps cash flexible; you own the car."], cons: ["有利息；注意期限别拉太长（贷款期过长容易车值低于欠款）。", "Interest; avoid very long terms, where you can owe more than the car is worth."] }, { name: ["租赁", "Lease"], pros: ["月付通常较低、总换新车。", "Lower monthly payment, regular new cars."], cons: ["有里程和损耗限制；到期不拥有这辆车。", "Mileage and wear limits; you do not own it at the end."] }], ask: [["总共要付多少钱（含所有费用和利息）？", "What is the total I will pay including all fees and interest?"]] }],
          pitfalls: [["只谈月供：经销商可以拉长期限让月供变低，总成本却更高。", "Negotiating only the monthly payment: a longer term lowers it but raises the total."]] },

        { id: "search", title: ["② 找车与试驾", "2. Find and test drive"],
          why: ["试驾是唯一能亲身感受车的机会，按清单来才不会漏项。", "A test drive is your only chance to feel the car; use a checklist so nothing is missed."],
          steps: [["列 2–4 款候选车型，比较可靠性、保养费、保险、二手保值率。", "Shortlist 2–4 models and compare reliability, maintenance cost, insurance and resale value."], ["经销商库存、私人卖家、认证二手各有渠道；二手车记下 VIN，查事故和保养历史报告。", "Check dealer stock, private sellers and certified pre-owned; for used cars note the VIN and pull a vehicle history report."], ["试驾尽量走你平时会走的路：市区、高速、坡道、停车。", "Drive the routes you really use: city, highway, hills, parking."], ["二手车花钱请独立修理厂做购买前检查（pre-purchase inspection），比卖家推荐的更可信。", "For a used car pay an independent shop for a pre-purchase inspection, which is more trustworthy than one the seller recommends."]],
          decisions: [], pitfalls: [["被时间压力催促（「今天才有这个价」）：好车和好价格不会只今天有。", "Time pressure (“only today”): a good car and price will not vanish today."]],
          checklist: { title: ["试驾与看车清单", "Test drive and inspection checklist"], items: [["外观：钣金不平、漆色不一致、缝隙不均（可能出过事故）", "Body: uneven panels, mismatched paint, uneven gaps (possible accident)"], ["轮胎：品牌是否一致、磨损是否均匀、生产日期（DOT 码）", "Tires: matching brand, even wear, manufacture date (DOT code)"], ["冷车启动：有无异响、仪表盘是否有故障灯", "Cold start: strange noises, any warning lights"], ["刹车：踏板力度、是否跑偏、有无异响", "Brakes: pedal feel, pulling, noises"], ["方向和悬挂：直线是否跑偏、过坎是否异响、高速是否抖动", "Steering and suspension: tracking, noises over bumps, shake at speed"], ["变速箱：换挡是否顺滑、有无冲击", "Transmission: smooth shifts, no jerking"], ["空调和暖风、所有电动窗、天窗、灯光", "A/C and heat, all windows, sunroof, lights"], ["内饰：座椅磨损、异味（烟味、霉味）、有无水渍", "Interior: seat wear, smells (smoke, mold), water stains"], ["电动车：电池健康度、实际续航、充电口和随车充电线", "EV: battery health, real range, charge port and cable"], ["文件：车主姓名与证件一致、车辆所有权文件（title）是否干净、有无留置权", "Papers: owner matches ID, clean title, no lien"], ["VIN 历史报告：事故、里程回拨、召回、保养记录", "VIN report: accidents, odometer rollback, recalls, service history"]] } },

        { id: "negotiate", title: ["③ 谈价格", "3. Negotiate the price"],
          why: ["谈「含税费的总价」，把车价、以旧换新、贷款分开谈，才看得清每一项。", "Negotiate the out-the-door price and handle car price, trade-in and financing separately so you can see each part."],
          steps: [["先用邮件 / 电话向多家经销商要「out-the-door（含全部费用）」书面报价，用最低的去谈。", "Ask several dealers for a written out-the-door price (all fees included) and use the lowest to negotiate."], ["先谈车价，再谈以旧换新：同时谈容易被「加一块减一块」搞糊涂。", "Negotiate the car price first and the trade-in second; doing both together lets numbers be shuffled."], ["以旧换新前先查你旧车的行情（几家报价、网上估值），私卖通常比折价高但更麻烦。", "Check your old car’s value (several quotes, online estimates) before trading in; a private sale usually pays more but is more work."], ["逐项看附加费：文件费、预备费、保护套餐、延长保修；不需要的可以拒绝。", "Review add-ons one by one: doc fee, prep fee, protection packages, extended warranty; decline what you do not need."]],
          decisions: [], pitfalls: [["贷款里夹带延长保修、间隙保险等：先搞清必要性，别在签字前才知道。", "Extended warranties or gap cover slipped into the loan: understand them before you sign, not after."]] },

        { id: "paperwork", title: ["④ 签约与手续", "4. Contract and paperwork"],
          why: ["签字前把每一页读完；提车当天保险就要生效。", "Read every page before signing; insurance must be active the day you drive away."],
          steps: [["核对买卖合同上的价格、费用、利率、期限和你谈好的一致；有出入当场改，不要「回头再改」。", "Check that price, fees, rate and term match what you negotiated; fix any difference on the spot, not “later”."], ["提车前保险生效，把保单给经销商 / 贷款机构。", "Have insurance active before pickup and give proof to the dealer or lender."], ["伊利诺伊：经销商通常代办产权（title）和牌照登记并收税费；私人买卖要自己到州务卿办公室（Secretary of State）过户并缴税，卖家要签车辆所有权文件。", "Illinois: dealers usually handle title and registration and collect the taxes; in a private sale you transfer the title and pay tax at the Secretary of State, with the seller signing the title."], ["留好所有文件：购买合同、贷款合同、产权 / 登记、保修、钥匙数量。", "Keep all documents: purchase and loan contracts, title and registration, warranty, number of keys."]],
          decisions: [], pitfalls: [["私人买卖：付款前先确认车主身份、车辆所有权文件和有无留置权。", "Private sale: before paying confirm the owner’s identity, the title and that there is no lien."]] },

        { id: "after", title: ["⑤ 提车之后", "5. After pickup"],
          why: ["把车记进应用，保养、牌照、保险到期都会提醒你。", "Add the car to the app so service, registration and insurance dates are tracked."],
          steps: [["在本应用里添加这辆车（油车 / 混动 / 纯电）：里程、车牌、保险、牌照到期；贷款可以在财务 → 借贷里记。", "Add the car in this app (gas, hybrid or EV): mileage, plates, insurance, registration due; record the loan under Finance, Lending."], ["新车 / 二手车提车后头几周留意异响和故障灯，在保修期内尽早处理。", "In the first weeks watch for noises and warning lights and handle issues while still under warranty."], ["设好第一次保养提醒；电动车关注电池和充电习惯。", "Set the first service reminder; with an EV watch battery and charging habits."]],
          decisions: [], pitfalls: [] },
      ],
    },

    /* ───────────── 卖房 ───────────── */
    sell_home: {
      icon: "🏡", name: ["卖房", "Sell a home"],
      intro: ["从决定卖到交割完成的路线。卖房流程从你名下已有的房产开始：在下面选一套房产，就能启动它的卖出清单。这里的指南本身不创建任何记录。", "The road from deciding to sell to closing. Selling starts from a property you already own: pick one below to start its sell checklist. The guide itself creates no record."],
      stages: [
        { id: "prep", title: ["① 准备：要不要卖、怎么定价", "1. Prepare: whether to sell and how to price"],
          why: ["把成本和税务算清楚，价格定得准，卖得快也卖得好。", "Know your costs and taxes and price it right to sell fast and well."],
          steps: [["算净得：成交价 − 贷款余额 − 佣金 − 过户 / 交割费 − 维修让利 − 搬家；别只看成交价。", "Work out your net: sale price − mortgage payoff − commissions − closing costs − repair credits − moving; not just the price."], ["让经纪人做一份 CMA（同区近期成交与在售对比）来定价；定高了挂牌久了反而难卖。", "Ask agents for a CMA (comparable sales and listings) to set the price; overpricing makes it sit and get harder to sell."], ["自住满 2 年的房子出售时，资本利得可能有免税额度（美国联邦规则，具体以报税时的规定为准）；留存改善支出凭证。", "For a home lived in two years, federal capital-gains exclusions may apply (check current rules when filing); keep receipts for improvements."], ["伊利诺伊：准备卖方披露表、氡气披露、1978 年前的含铅漆披露；Chicago 另有分区证明、水费结清证明等。", "Illinois: prepare the seller disclosure, radon disclosure and pre-1978 lead paint disclosure; Chicago also needs zoning and water certificates."]],
          decisions: [{ q: ["请经纪人还是自己卖（FSBO）？", "Use an agent or sell yourself (FSBO)?"], options: [{ name: ["请经纪人", "Agent"], pros: ["定价、拍照、刊登、谈判、文件都有人做，曝光更大。", "Pricing, photos, listing, negotiation and paperwork handled, wider exposure."], cons: ["要付佣金（可谈，以挂牌协议为准）。", "You pay a commission (negotiable, per the listing agreement)."] }, { name: ["自己卖", "FSBO"], pros: ["省佣金。", "Saves commission."], cons: ["曝光少；谈判、合同、法律风险都落在你身上，建议至少请律师。", "Less exposure; negotiation, contract and legal risk are all yours, so at least hire an attorney."] }], ask: [["佣金多少、包含什么服务、挂牌协议多久、能否中途终止？", "What is the commission, what is included, how long is the listing agreement and can it be ended early?"], ["你的挂牌价依据是什么？上次类似的房子多久卖掉？", "What supports your list price, and how fast did a similar home sell?"]] }],
          pitfalls: [["定价按「想卖多少」而不是「市场能给多少」。", "Pricing by what you want rather than what the market will pay."]] },
        { id: "list", title: ["② 整理与挂牌", "2. Prepare the home and list"],
          why: ["第一印象决定看房人数；好照片比小修小补更重要。", "First impressions drive showings; good photos matter more than small fixes."],
          steps: [["清理杂物、深度清洁、修掉小毛病（漏水龙头、坏灯泡、门把手）；大修先问经纪人值不值得。", "Declutter, deep clean and fix small things (dripping taps, bulbs, door handles); ask your agent whether big repairs are worth it."], ["专业摄影和户型图；写清楚卖点和费用（税、HOA）。", "Professional photos and a floor plan; state the selling points and costs (tax, HOA)."], ["有租客的要按租约通知并安排看房与押金转移。", "If tenants live there, give notice and arrange showings and deposit transfer per the lease."]],
          decisions: [], pitfalls: [["隐瞒已知问题：披露不全可能在成交后被追责。", "Hiding known problems: incomplete disclosure can bring liability after the sale."]] },
        { id: "offers", title: ["③ 收到出价与谈判", "3. Offers and negotiation"],
          why: ["比的不只是价格：条件、定金、交割日、买家贷款是否稳。", "Compare more than price: conditions, earnest money, closing date and how solid the buyer’s financing is."],
          steps: [["把几份出价按「净得 + 确定性 + 时间」比较：现金 / 大首付 / 少条件的更稳。", "Compare offers by net proceeds, certainty and timing: cash, big down payments and fewer conditions are safer."], ["还价时想清楚你愿意让步的和不能让步的；回复要在期限内。", "When countering decide what you can and cannot give, and reply within the deadline."], ["确认收到定金，并由谁托管。", "Confirm the earnest money is received and who holds it."]],
          decisions: [], pitfalls: [["只看最高价：买家贷款或评估不过，最后可能掉单。", "Taking only the highest price: if the buyer’s loan or appraisal fails the deal can fall through."]] },
        { id: "contract", title: ["④ 合同期", "4. Under contract"],
          why: ["回应买方验房和评估的要求，同时准备过户材料。", "Respond to the buyer’s inspection and appraisal requests while preparing transfer documents."],
          steps: [["律师审查与验房期：回应买方的修改与维修要求，决定修、让价还是拒绝。", "Attorney review and inspection period: answer the buyer’s repair requests and decide to fix, credit or refuse."], ["配合评估：评估低了可以重谈、让价或让买方补差额。", "Cooperate with the appraisal: if low you can renegotiate, give a credit or ask the buyer to cover the gap."], ["向贷款机构索取还款函（payoff letter）给律师 / 产权公司；Condo / HOA 索取付清证明。", "Get the payoff letter from your lender for the attorney or title company; for condos or HOAs get a paid-assessment letter."]],
          decisions: [], pitfalls: [["错过回复期限：可能被视为接受买方要求。", "Missing the response deadline may count as accepting the buyer’s requests."]] },
        { id: "closing", title: ["⑤ 交割与之后", "5. Closing and after"],
          why: ["确保交割后不再产生任何费用，并留好税务凭证。", "Make sure no charges continue after closing and keep tax records."],
          steps: [["通知水电燃气网络、保险、保洁草坪等服务交割日停止；交割后再取消自动扣款（不要提前）。", "Schedule utilities, internet, insurance and services to stop on closing day; cancel autopay after closing, not before."], ["搬空、最终查验；留下钥匙、遥控器、说明书、保修单。", "Move out for the final walk-through and leave keys, remotes, manuals and warranties."], ["留存交割单据和改善支出凭证；在应用里确认房产状态改为已卖出、账单自动结束。", "Keep the closing statement and improvement receipts; in the app mark the property sold and let its bills end."], ["确认贷款结清、escrow 退款到账。", "Confirm the loan is paid off and the escrow refund arrives."]],
          decisions: [], pitfalls: [] },
      ],
    },

    /* ───────────── 卖车 ───────────── */
    sell_vehicle: {
      icon: "🚙", name: ["卖车", "Sell a car"],
      intro: ["卖车流程从你名下已有的车开始：在下面选一辆车，就能启动它的卖车清单。这里的指南本身不创建任何记录。", "Selling starts from a car you already own: pick one below to start its sell checklist. The guide itself creates no record."],
      stages: [
        { id: "prep", title: ["① 卖还是以旧换新、怎么定价", "1. Sell or trade in, and price"],
          why: ["三种方式价格和麻烦程度不同，先选对。", "The three routes differ in price and effort, so choose first."],
          steps: [["比较三种价：经销商以旧换新、二手车商直接收购（如 CarMax 报价）、私人出售；私卖通常最高但最麻烦。", "Compare three prices: dealer trade-in, instant offers from used-car buyers, and private sale; private usually pays most but takes most effort."], ["用同车型同里程的成交行情定价，留一点谈价空间。", "Price from comparable sold listings of the same model and mileage and leave a little room to negotiate."], ["确认贷款余额：车有贷款时，卖车款要先还清才能过户。", "Check the loan payoff: if there is a loan it must be paid off for the title to transfer."]],
          decisions: [], pitfalls: [["把以旧换新和新车价格混在一起谈。", "Mixing the trade-in value with the new-car price in one negotiation."]] },
        { id: "list", title: ["② 整理与刊登", "2. Prepare and advertise"],
          why: ["干净的车加清晰照片，能多卖也卖得快。", "A clean car and clear photos sell for more and faster."],
          steps: [["洗车吸尘，补小瑕疵；整理保养记录和说明书、备用钥匙。", "Wash and vacuum, fix small flaws, gather service records, manuals and spare keys."], ["多角度光线好的照片；写清年款、里程、配置、保养、事故情况（如实）。", "Take photos from many angles in good light; state year, mileage, trim, service and accident history honestly."], ["刊登在常用平台；不要在广告里放完整 VIN 以外的敏感个人信息。", "List on common platforms and keep other personal details out of the ad."]],
          decisions: [], pitfalls: [] },
        { id: "buyers", title: ["③ 接待买家与安全", "3. Meeting buyers safely"],
          why: ["私人交易的主要风险是安全和付款诈骗。", "The main risks in a private sale are safety and payment fraud."],
          steps: [["在公共场所（比如警局停车场）见面，带人同行；试驾时你坐在车上，先看对方驾照。", "Meet in a public place (e.g. a police station lot), bring someone, ride along on test drives and check the driver’s license first."], ["收款优先在银行当面办理：银行本票、转账要在银行确认到账后再交钥匙；警惕假支票、多付再退款的骗局。", "Prefer to get paid at the bank: confirm cashier’s checks or transfers with the bank before handing over keys; beware fake checks and overpay-and-refund scams."]],
          decisions: [], pitfalls: [["对方多付钱让你退差额：几乎都是诈骗。", "A buyer who overpays and asks for a refund of the difference is almost always a scam."]] },
        { id: "paperwork", title: ["④ 文件与之后", "4. Paperwork and after"],
          why: ["过户和责任解除做对，才不会收到买家以后的罚单。", "Transfer and release of liability done right keeps you from the next owner’s tickets."],
          steps: [["签车辆所有权文件（title）、写买卖合同 / 收据（bill of sale，写明「按现状出售」和里程）。", "Sign the title and write a bill of sale (stating as-is and the mileage)."], ["伊利诺伊：向州务卿办公室提交出售通知（Notice of Sale）以解除你的责任；取下牌照按规定处理；保险在过户后再取消。", "Illinois: file the Notice of Sale with the Secretary of State to end your liability, handle the plates as required and cancel insurance only after the transfer."], ["在应用里把这辆车标成已卖出（记卖出价和日期），保养、牌照、保险提醒会自动停止。", "In the app mark the car sold with price and date; service, registration and insurance reminders stop automatically."]],
          decisions: [], pitfalls: [["过户前就取消保险或让买家开走：出事故你可能仍有责任。", "Cancelling insurance or letting the buyer drive off before the transfer: you may still be liable in an accident."]] },
      ],
    },
  };

  window.GUIDES = { REGION, GUIDES, KINDS: ["buy_home", "buy_vehicle", "sell_home", "sell_vehicle"] };
})();
