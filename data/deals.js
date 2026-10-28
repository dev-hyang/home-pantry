/* 房产 / 车辆交易清单模板（伊利诺伊州 / 芝加哥，其他州按需加）
 * - 每条任务：key、name、base（contract 合同日 / closing 交割日）、offset（相对天数，负数 = 提前）、priority（must / should / optional）、stage、note
 * - when：全部满足才出现。写法 "bill:<账单分类>"（该房产挂着这类账单）、"kind:condo"、"role:landlord"、"autopay"（有自动扣款账单）
 * - sell 与 move_out 里的停服务任务按账单分类生成，是卖房 / 退租的“必须”项，保证交割后不再产生费用 */
(() => {
  "use strict";

  const KINDS = { buy: "买入", sell: "卖出", move_out: "退租", veh_buy: "买车", veh_sell: "卖车", veh_return: "租赁归还" };
  const VEHICLE_KINDS = ["veh_buy", "veh_sell", "veh_return"];
  const isVehicleKind = (k) => VEHICLE_KINDS.includes(k);
  const PRIORITY = { must: "必须", should: "建议", optional: "可选" };
  const STAGES = { prep: "准备", contract: "签约与审查", financing: "贷款与评估", pre_closing: "交割前", closing: "交割", post_closing: "交割后", special: "补充事项" };
  // 车辆交易几天到两周就走完，阶段少：准备 → 成交 → 提车 / 交车 → 之后
  const VEHICLE_STAGES = { prep: "准备", deal: "成交", handover: "提车 / 交车", after: "之后", special: "补充事项" };
  const stagesOf = (kind) => (isVehicleKind(kind) ? VEHICLE_STAGES : STAGES);
  // 两个基准日期在不同流程里的叫法（contract / closing 两列复用）
  const DATE_LABELS = {
    buy: ["签约（合同日）", "交割日"], sell: ["签约（合同日）", "交割日"], move_out: ["签约（合同日）", "退租日"],
    veh_buy: ["签约 / 下订日", "提车日"], veh_sell: ["成交 / 签协议日", "交车日"], veh_return: ["签约 / 下订日", "归还日"],
  };
  const PROPERTY_STATUS = { looking: "看房", buying: "交易中 · 买入", owned: "持有", renting: "租住", selling: "交易中 · 卖出", sold: "已卖出", moved_out: "已退租" };

  const TASKS = {
    buy: [
      { key: "b_preapproval", name: "贷款预批（pre-approval），确定律师和经纪人", base: "contract", offset: -14, priority: "should", stage: "prep" },
      { key: "b_earnest", name: "交定金（earnest money，通常 1–2%）", base: "contract", offset: 2, priority: "must", stage: "contract", note: "签约后 1–2 个工作日内交到经纪公司或律师的托管账户。" },
      { key: "b_review", name: "律师审查与验房期：预约验房、氡气检测，提出修改要求", base: "contract", offset: 5, priority: "must", stage: "contract", note: "Multi-Board 7.0 合同默认 5 个工作日，错过就视为接受原条款。" },
      { key: "b_loan_docs", name: "向贷款行提交全部材料", base: "contract", offset: 7, priority: "must", stage: "financing" },
      { key: "b_appraisal", name: "配合评估（appraisal）", base: "contract", offset: 14, priority: "should", stage: "financing" },
      { key: "b_commitment", name: "拿到贷款承诺（mortgage commitment）", base: "contract", offset: 30, priority: "must", stage: "financing", note: "合同里的贷款条款截止日，拿不到要请律师延期。" },
      { key: "b_hoa_docs", name: "索取 HOA 文件：22.1 披露、章程、财务、无欠费证明", base: "closing", offset: -10, priority: "must", stage: "pre_closing", when: ["kind:condo"] },
      { key: "b_insurance", name: "房屋保险：交割日生效，把保单发给贷款行", base: "closing", offset: -7, priority: "must", stage: "pre_closing" },
      { key: "b_title", name: "产权保险与产权调查（律师 / 产权公司跟进）", base: "closing", offset: -7, priority: "should", stage: "pre_closing" },
      { key: "b_utilities", name: "预约交割日起开户：电（ComEd）、燃气（Nicor / Peoples Gas）、水、网络", base: "closing", offset: -7, priority: "must", stage: "pre_closing", note: "电和燃气提前 3–5 个工作日预约，交割当天抄表分账。" },
      { key: "b_usps", name: "USPS 邮件转寄、地址变更", base: "closing", offset: -7, priority: "should", stage: "pre_closing" },
      { key: "b_funds", name: "准备交割资金；电汇前打电话核实账户，防诈骗邮件", base: "closing", offset: -2, priority: "must", stage: "pre_closing" },
      { key: "b_walkthrough", name: "最终查验（walk-through）", base: "closing", offset: -1, priority: "must", stage: "pre_closing" },
      { key: "b_closing", name: "交割：签字、付款、拿钥匙；留存 closing statement", base: "closing", offset: 0, priority: "must", stage: "closing", note: "卖方付州和郡转让税；Chicago 买方付 $3.75 / $500；房产税按上年 105–110% 由卖方抵扣。" },
      { key: "b_locks", name: "换锁、测试烟雾和一氧化碳报警器", base: "closing", offset: 3, priority: "should", stage: "post_closing" },
      { key: "b_setup", name: "在本应用建房屋资料、设备档案和账单", base: "closing", offset: 3, priority: "should", stage: "post_closing" },
      { key: "b_hoa_register", name: "HOA 登记、停车位和门禁", base: "closing", offset: 7, priority: "should", stage: "post_closing", when: ["kind:condo"] },
      { key: "b_homestead", name: "申请 Homestead Exemption（Cook County Assessor）", base: "closing", offset: 30, priority: "must", stage: "post_closing", note: "自住才能申请，每年减几百到上千美元房产税；交割后尽早办。" },
    ],
    sell: [
      { key: "s_disclosure", name: "准备披露：伊州住宅物业披露表、氡气披露、1978 年前含铅漆披露", base: "contract", offset: 0, priority: "must", stage: "prep" },
      { key: "s_zoning", name: "Chicago 1–5 户住宅：申请分区证明（zoning certificate）", base: "closing", offset: -30, priority: "should", stage: "prep", note: "只在芝加哥市区需要，郊区跳过。" },
      { key: "s_water_fpc", name: "申请水费结清证明（Chicago full payment certificate）", base: "closing", offset: -21, priority: "must", stage: "prep", when: ["bill:water"], note: "需要最终抄表，市里处理要 2–4 周，晚了会拖交割。" },
      { key: "s_condo_221", name: "Condo / HOA：索取 22.1 披露与付清证明（paid assessment letter）", base: "contract", offset: 7, priority: "must", stage: "contract", when: ["kind:condo"] },
      { key: "s_tenant", name: "通知租客，按租约安排看房与押金转移", base: "contract", offset: 3, priority: "must", stage: "contract", when: ["role:landlord"] },
      { key: "s_earnest", name: "确认收到定金", base: "contract", offset: 2, priority: "must", stage: "contract" },
      { key: "s_review", name: "律师审查与验房期：回应买方的修改与维修要求", base: "contract", offset: 5, priority: "must", stage: "contract" },
      { key: "s_appraisal", name: "配合买方评估", base: "contract", offset: 14, priority: "should", stage: "financing" },
      { key: "s_hoa_notify", name: "HOA / 物业：通知过户日期、索取付清证明、取消自动扣款", base: "closing", offset: -14, priority: "must", stage: "pre_closing", when: ["bill:hoa"] },
      { key: "s_services", name: "安防、草坪、除虫、清洁等服务：通知交割日停止", base: "closing", offset: -14, priority: "should", stage: "pre_closing" },
      { key: "s_payoff", name: "向贷款行索取还款函（payoff letter）给律师 / 产权公司", base: "closing", offset: -10, priority: "must", stage: "pre_closing", when: ["bill:mortgage"] },
      { key: "s_internet", name: "网络：预约交割日停机或迁到新地址；交割后 10 天内归还设备", base: "closing", offset: -7, priority: "must", stage: "pre_closing", when: ["bill:internet"] },
      { key: "s_usps", name: "USPS 邮件转寄", base: "closing", offset: -7, priority: "should", stage: "pre_closing" },
      { key: "s_electric", name: "电（ComEd）：预约交割日停止服务与最终抄表", base: "closing", offset: -5, priority: "must", stage: "pre_closing", when: ["bill:electric"], note: "提前 3–5 个工作日；不要提前断电，最终查验还要用。" },
      { key: "s_gas", name: "燃气（Nicor / Peoples Gas）：预约交割日最终抄表并关户", base: "closing", offset: -5, priority: "must", stage: "pre_closing", when: ["bill:gas"], note: "冬季不要提前停气，防止水管冻裂。" },
      { key: "s_water_stop", name: "水 / 排污 / 垃圾：预约最终抄表与销户", base: "closing", offset: -5, priority: "must", stage: "pre_closing", when: ["bill:water"] },
      { key: "s_insurance", name: "房屋保险：通知交割日生效取消（不要提前），交割后退保费", base: "closing", offset: -3, priority: "must", stage: "pre_closing", when: ["bill:insurance_home"] },
      { key: "s_walkthrough", name: "搬空、准备最终查验；留全部钥匙、遥控器、说明书、保修单", base: "closing", offset: -1, priority: "must", stage: "pre_closing" },
      { key: "s_closing", name: "交割：转让税、房产税抵扣、签字、交钥匙", base: "closing", offset: 0, priority: "must", stage: "closing", note: "卖方付州 $0.50 / $500、郡 $0.25 / $500；Chicago 卖方另付 $1.50 / $500（CTA）。" },
      { key: "s_autopay", name: "交割后逐条取消剩余自动扣款（账单页标“已结束”的）", base: "closing", offset: 1, priority: "must", stage: "post_closing", when: ["autopay"] },
      { key: "s_records", name: "留存交割单据和改善支出凭证（报税：自住满 2 年可免 $250k / $500k 资本利得）", base: "closing", offset: 7, priority: "should", stage: "post_closing" },
      { key: "s_final_bills", name: "结清最后一期水电气网账单，确认没有新费用", base: "closing", offset: 30, priority: "must", stage: "post_closing" },
      { key: "s_mortgage_refund", name: "确认贷款结清、escrow 退款到账", base: "closing", offset: 30, priority: "should", stage: "post_closing", when: ["bill:mortgage"] },
    ],
    move_out: [
      { key: "m_notice", name: "按租约书面通知房东（通常提前 30–60 天）", base: "closing", offset: -45, priority: "must", stage: "prep" },
      { key: "m_services", name: "安防、清洁等服务：通知停止", base: "closing", offset: -14, priority: "should", stage: "pre_closing" },
      { key: "m_internet", name: "网络：预约停机或迁到新地址；归还设备", base: "closing", offset: -7, priority: "must", stage: "pre_closing", when: ["bill:internet"] },
      { key: "m_usps", name: "USPS 邮件转寄", base: "closing", offset: -7, priority: "should", stage: "pre_closing" },
      { key: "m_electric", name: "电：预约退租日停止服务与最终抄表", base: "closing", offset: -5, priority: "must", stage: "pre_closing", when: ["bill:electric"] },
      { key: "m_gas", name: "燃气：预约退租日最终抄表并关户", base: "closing", offset: -5, priority: "must", stage: "pre_closing", when: ["bill:gas"] },
      { key: "m_water", name: "水 / 垃圾：销户或转回房东", base: "closing", offset: -5, priority: "must", stage: "pre_closing", when: ["bill:water"] },
      { key: "m_renters_ins", name: "租客保险：改地址或取消", base: "closing", offset: -3, priority: "should", stage: "pre_closing", when: ["bill:insurance_home"] },
      { key: "m_clean", name: "清洁、修补、拍照录像留证", base: "closing", offset: -1, priority: "must", stage: "pre_closing" },
      { key: "m_keys", name: "交钥匙、抄表读数、签退租确认", base: "closing", offset: 0, priority: "must", stage: "closing" },
      { key: "m_autopay", name: "取消房租和剩余自动扣款", base: "closing", offset: 1, priority: "must", stage: "post_closing", when: ["autopay"] },
      { key: "m_deposit", name: "押金退还（伊州 30–45 天内），未退或扣款不合理可追讨", base: "closing", offset: 45, priority: "should", stage: "post_closing" },
    ],
  };

  // ── 车辆（伊利诺伊州 / 芝加哥默认；when 另可写 "region:na"、"pt:ev" / "pt:ice"（动力类型）、"status:financed" / "status:leased"（拥有状态））──
  // 买车：contract = 签约 / 下订日，closing = 提车日
  TASKS.veh_buy = [
    { key: "vb_budget",   name: "定预算；向信用社 / 银行申请贷款预批，和车行利率比一比", base: "contract", offset: -14, priority: "should", stage: "prep" },
    { key: "vb_history",  name: "查 VIN 历史报告（Carfax / NMVTIS）和召回记录", base: "contract", offset: -3, priority: "must", stage: "prep", note: "二手车必查；新车只查召回。" },
    { key: "vb_ppi",      name: "试驾；二手车找独立技师做购前检查（PPI）", base: "contract", offset: -2, priority: "should", stage: "prep" },
    { key: "vb_quote",    name: "向保险公司要报价，确认能加进现有保单", base: "contract", offset: -1, priority: "should", stage: "prep" },
    { key: "vb_contract", name: "签购车合同 / 买卖协议（bill of sale）：核对 VIN、里程、价格和附加费", base: "contract", offset: 0, priority: "must", stage: "deal", note: "车行附加的延保、油漆保护、GAP 可以拒绝；逐项核对 doc fee 和税费。" },
    { key: "vb_pay",      name: "付定金 / 尾款或贷款放款；私人交易用银行本票，到银行当面交割", base: "contract", offset: 0, priority: "must", stage: "deal" },
    { key: "vb_title",    name: "产权证（title）：卖方签字并填里程申报；贷款车 title 由贷款行持有", base: "contract", offset: 0, priority: "must", stage: "deal", when: ["region:na"], note: "私人交易：卖方在 title 背面签字、填里程；车行代办。" },
    { key: "vb_insure",   name: "保险在提车前生效，把这辆车加进保单", base: "closing", offset: 0, priority: "must", stage: "handover", note: "没有保险不能上路；车行放车前通常要看保险卡。" },
    { key: "vb_pickup",   name: "提车：两把钥匙、手册、随车工具、临牌或原车牌；拍里程表和外观", base: "closing", offset: 0, priority: "must", stage: "handover" },
    { key: "vb_register", name: "申请产权与上牌、缴车辆使用税（伊州 VSD 190 + RUT-50；车行代办用 RUT-25），20 天内", base: "closing", offset: 20, priority: "must", stage: "handover", when: ["region:na"] },
    { key: "vb_emission", name: "排放检测（伊州车龄 4 年以上两年一次；逾期不能续牌照）", base: "closing", offset: 30, priority: "should", stage: "handover", when: ["region:na", "pt:ice"] },
    { key: "vb_sticker",  name: "Chicago / village 车贴（city sticker）：住市内 30 天内办", base: "closing", offset: 30, priority: "optional", stage: "handover", when: ["region:na"] },
    { key: "vb_app",      name: "在本应用补齐车辆档案：车牌、里程、年均里程、牌照 / 排放到期、保险", base: "closing", offset: 3, priority: "should", stage: "after" },
    { key: "vb_loan",     name: "车贷：建账单提醒或自动扣款；记下贷款合同和 title 存放位置", base: "closing", offset: 7, priority: "should", stage: "after" },
    { key: "vb_docs",     name: "留存购车发票、bill of sale、临牌回执", base: "closing", offset: 7, priority: "optional", stage: "after" },
    { key: "vb_first",    name: "查首保要求（里程 / 月份），到时记第一次保养", base: "closing", offset: 60, priority: "optional", stage: "after" },
  ];
  // 卖车：contract = 成交 / 签协议日，closing = 交车日
  TASKS.veh_sell = [
    { key: "vs_payoff",   name: "贷款中：向贷款行查还款余额（payoff）和 title 放行流程", base: "contract", offset: -7, priority: "must", stage: "prep", when: ["status:financed"] },
    { key: "vs_value",    name: "估价：KBB / Edmunds 与车行 / CarMax 报价，决定私卖还是置换", base: "contract", offset: -7, priority: "should", stage: "prep" },
    { key: "vs_docs",     name: "找齐 title、保养记录、两把钥匙、召回修复凭证", base: "contract", offset: -3, priority: "must", stage: "prep" },
    { key: "vs_clean",    name: "清洁、拍照、挂牌（写清里程、VIN、事故情况）", base: "contract", offset: -3, priority: "should", stage: "prep" },
    { key: "vs_meet",     name: "买家看车试驾：约在公共场所，查驾照和保险，自己陪驾", base: "contract", offset: 0, priority: "should", stage: "deal" },
    { key: "vs_bos",      name: "签 bill of sale（双方各留一份）；title 背面签字、填里程申报", base: "contract", offset: 0, priority: "must", stage: "deal", note: "伊州不强制 bill of sale，但能证明交车时间和“现状出售”。" },
    { key: "vs_pay",      name: "收款：银行本票到银行当面核验，或车行转账到账后再交车", base: "closing", offset: 0, priority: "must", stage: "deal", note: "不收个人支票，不接受先交车后付款。" },
    { key: "vs_plates",   name: "交车时拆下车牌（伊州车牌跟人不跟车），转到新车或退回", base: "closing", offset: 0, priority: "must", stage: "handover", when: ["region:na"] },
    { key: "vs_wipe",     name: "删除个人数据：导航里的家庭地址、蓝牙配对、车联网 / App 账号解绑、车库门遥控", base: "closing", offset: 0, priority: "must", stage: "handover" },
    { key: "vs_report",   name: "向车管所提交已售通知（伊州 Seller's Report of Sale，SOS 网站）", base: "closing", offset: 1, priority: "must", stage: "handover", when: ["region:na"], note: "不报的话，买家的罚单、过路费、事故可能找到你头上。" },
    { key: "vs_insurance", name: "从保单移除这辆车（交车之后办，不要提前）", base: "closing", offset: 1, priority: "must", stage: "handover" },
    { key: "vs_toll",     name: "过路费标签（I-PASS 账户里删车或转新车）、停车许可、小区车贴", base: "closing", offset: 1, priority: "should", stage: "handover", when: ["region:na"] },
    { key: "vs_loan",     name: "贷款中：确认贷款结清、lien release 到位，取消车贷自动扣款", base: "closing", offset: 14, priority: "must", stage: "after", when: ["status:financed"] },
    { key: "vs_archive",  name: "在本应用把这辆车标为已卖出（保留保养记录和花费）", base: "closing", offset: 1, priority: "should", stage: "after" },
    { key: "vs_refund",   name: "牌照剩余月份退费或转移到新车", base: "closing", offset: 7, priority: "optional", stage: "after", when: ["region:na"] },
    { key: "vs_records",  name: "留存 bill of sale、已售通知回执、收款凭证", base: "closing", offset: 7, priority: "should", stage: "after" },
  ];
  // 租赁归还：只用 closing = 归还日
  TASKS.veh_return = [
    { key: "vr_options",  name: "到期前 90 天：比较归还、买断（residual）、续租、置换", base: "closing", offset: -90, priority: "should", stage: "prep" },
    { key: "vr_preinspect", name: "预约租赁公司的免费预检（到期前 60–90 天）", base: "closing", offset: -60, priority: "must", stage: "prep" },
    { key: "vr_miles",    name: "核对里程上限和超里程费（通常每英里 $0.15–0.25），估算总额", base: "closing", offset: -45, priority: "must", stage: "prep" },
    { key: "vr_repair",   name: "按预检报告修明显损伤（自己修通常比租赁公司收费便宜）；换回原厂规格轮胎", base: "closing", offset: -30, priority: "should", stage: "prep" },
    { key: "vr_appoint",  name: "预约归还时间和地点（经销商），确认处置费（disposition fee）", base: "closing", offset: -14, priority: "must", stage: "prep" },
    { key: "vr_wipe",     name: "删除个人数据：导航、蓝牙配对、车联网账号", base: "closing", offset: -1, priority: "must", stage: "handover" },
    { key: "vr_items",    name: "带齐两把钥匙、手册、充电线 / 随车附件", base: "closing", offset: 0, priority: "must", stage: "handover" },
    { key: "vr_return",   name: "归还：签检查报告和里程申报，留回执；拍里程表和外观", base: "closing", offset: 0, priority: "must", stage: "handover" },
    { key: "vr_plates",   name: "拆下车牌（转新车或退回）", base: "closing", offset: 0, priority: "must", stage: "handover", when: ["region:na"] },
    { key: "vr_insurance", name: "从保单移除或转到新车", base: "closing", offset: 1, priority: "must", stage: "after" },
    { key: "vr_archive",  name: "在本应用把这辆车标为已归还", base: "closing", offset: 1, priority: "should", stage: "after" },
    { key: "vr_final",    name: "取消租金自动扣款；30 天内核对最终账单（处置费、超里程、磨损）", base: "closing", offset: 30, priority: "must", stage: "after" },
  ];

  // 前置依赖：key → 必须先完成的事项 key。某一步晚了，只顺延依赖它的后续步骤（保持模板里的间隔），不相干的步骤不动
  const DEPS = {
    buy: { b_review: ["b_earnest"], b_loan_docs: ["b_review"], b_appraisal: ["b_loan_docs"], b_commitment: ["b_appraisal"], b_insurance: ["b_commitment"], b_title: ["b_commitment"], b_hoa_docs: ["b_commitment"],
      b_funds: ["b_commitment"], b_walkthrough: ["b_funds"], b_closing: ["b_walkthrough", "b_funds", "b_commitment"], b_locks: ["b_closing"], b_setup: ["b_closing"], b_hoa_register: ["b_closing"], b_homestead: ["b_closing"] },
    sell: { s_review: ["s_earnest"], s_appraisal: ["s_review"], s_payoff: ["s_appraisal"], s_walkthrough: ["s_payoff"], s_closing: ["s_appraisal", "s_payoff", "s_walkthrough"],
      s_autopay: ["s_closing"], s_records: ["s_closing"], s_final_bills: ["s_closing"], s_mortgage_refund: ["s_closing"] },
    move_out: { m_keys: ["m_clean"], m_autopay: ["m_keys"], m_deposit: ["m_keys"] },
    veh_buy: { vb_contract: ["vb_history", "vb_ppi"], vb_pay: ["vb_contract"], vb_title: ["vb_contract"], vb_pickup: ["vb_pay", "vb_title", "vb_insure"], vb_register: ["vb_pickup"], vb_emission: ["vb_pickup"], vb_sticker: ["vb_pickup"],
      vb_app: ["vb_pickup"], vb_loan: ["vb_pickup"], vb_docs: ["vb_pickup"], vb_first: ["vb_pickup"] },
    veh_sell: { vs_meet: ["vs_clean"], vs_bos: ["vs_docs", "vs_meet"], vs_pay: ["vs_bos"], vs_plates: ["vs_pay"], vs_wipe: ["vs_pay"], vs_report: ["vs_plates"], vs_insurance: ["vs_pay"], vs_toll: ["vs_pay"],
      vs_loan: ["vs_pay"], vs_archive: ["vs_pay"], vs_refund: ["vs_plates"], vs_records: ["vs_pay"] },
    veh_return: { vr_preinspect: ["vr_options"], vr_miles: ["vr_preinspect"], vr_repair: ["vr_preinspect"], vr_appoint: ["vr_repair"], vr_return: ["vr_appoint", "vr_items", "vr_wipe"], vr_plates: ["vr_return"],
      vr_insurance: ["vr_return"], vr_archive: ["vr_return"], vr_final: ["vr_return"] },
  };
  // 里程碑：对比页顶部「原计划 → 预计」看的那一步（交割 / 提车 / 交车 / 归还）
  const MILESTONE = { buy: "b_closing", sell: "s_closing", move_out: "m_keys", veh_buy: "vb_pickup", veh_sell: "vs_pay", veh_return: "vr_return" };

  window.DEALS = { DEPS, MILESTONE, KINDS, VEHICLE_KINDS, isVehicleKind, PRIORITY, STAGES, VEHICLE_STAGES, stagesOf, DATE_LABELS, PROPERTY_STATUS, TASKS };
})();
