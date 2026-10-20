/* 房产交易清单模板（伊利诺伊州 / 芝加哥，其他州按需加）
 * - 每条任务：key、name、base（contract 合同日 / closing 交割日）、offset（相对天数，负数 = 提前）、priority（must / should / optional）、stage、note
 * - when：全部满足才出现。写法 "bill:<账单分类>"（该房产挂着这类账单）、"kind:condo"、"role:landlord"、"autopay"（有自动扣款账单）
 * - sell 与 move_out 里的停服务任务按账单分类生成，是卖房 / 退租的“必须”项，保证交割后不再产生费用 */
(() => {
  "use strict";

  const KINDS = { buy: "买入", sell: "卖出", move_out: "退租" };
  const PRIORITY = { must: "必须", should: "建议", optional: "可选" };
  const STAGES = { prep: "准备", contract: "签约与审查", financing: "贷款与评估", pre_closing: "交割前", closing: "交割", post_closing: "交割后", special: "补充事项" };
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

  window.DEALS = { KINDS, PRIORITY, STAGES, PROPERTY_STATUS, TASKS };
})();
