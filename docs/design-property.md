# 房产生命周期设计：买入、持有、卖出与退出

## 1. 问题

现在的房产只有“存在 / 归档”两种状态。真实情况是：看房和签约阶段就有一堆带截止日期的事要盯（律师审查、验房、贷款承诺、交割）；卖出后账单的自动扣款要逐个取消，提醒要停，但历史记录（房产税、房贷、维修）报税时还要用。需要一个明确的状态机和退出流程，而不是直接删掉。

## 2. 状态机

```
looking（看房）→ buying（交易中·买入）→ owned（持有，自住 / 出租）→ selling（交易中·卖出）→ sold（已卖出）
                                            ↘ 租住：renting（租住）→ moved_out（已退租）
任何状态 → archived（归档，只读）→ 彻底删除（二次确认）
```

| 状态 | 房屋 / 设备 / 季节任务 | 账单 | 提醒 |
|---|---|---|---|
| looking / buying | 可建资料，推荐暂不生成设备和耗材 | 可建（定金、验房费、评估费等一次性账单） | 交易清单任务 + 账单 |
| owned / renting | 全部可用 | 全部可用 | 全部 |
| selling | 全部可用，多一份卖出清单 | 全部可用 | 全部 + 卖出清单 |
| sold / moved_out | 只读，保留历史 | 自动停用（`ends_on = 交割日`），保留记录 | 停止；只剩“退出清单”直到做完 |
| archived | 只读，不在切换条里（设置页可见） | 停用 | 无 |

**退出流程（sold / moved_out）**，一步向导，不是一个按钮：

1. 填交割日（或退租日）、成交价（可选）。
2. 列出挂在这套房产的账单：自动扣款的默认勾选“记得去取消自动扣款”，生成退出清单任务；全部账单 `ends_on` 设为交割日，到期日晚于它的不再提醒；水电气这类可能有最后一期账单的，允许把 `ends_on` 往后放 30–60 天。
3. 设备、季节任务、房屋资料：全部保留只读。房东场景还要“押金退还”“最后一期租金”两条任务。
4. 房产状态改为 sold，自动归档（切换条里消失，设置页“已归档”里能看）。
5. **彻底删除**只对已归档的房产开放，两步确认（再点一次 + 输入房产名）。删除级联：账单与缴费记录、设备与保养记录、季节任务、房屋资料；花费统计里的 `purchases` 保留（`purchase_id` 置空），因为报税和年度报表需要。界面明确写出这一点。

**建议默认不删**：卖房后两年内都可能用到房产税、房贷利息、维修改善支出（抬高成本基础，影响资本利得税）。归档已经满足“不再打扰”。

## 3. 伊利诺伊州买卖流程（简化版，作为清单模板）

伊州是律师参与的州，Multi-Board 7.0 合同有 5 个工作日的律师审查 / 验房期。以下是 B（buy）和 S（sell）两套模板的任务和相对日期；Chicago 市区另有几条。日期相对于“合同日”或“交割日”自动生成。

**买入（buy）**

| 阶段 | 任务 | 相对日期 |
|---|---|---|
| 准备 | 贷款预批（pre-approval）、确定律师和经纪人 | 看房期 |
| 签约 | 交定金（earnest money，通常 1–2%，签约后 1–2 个工作日） | 合同日 +2 |
| 审查 | 律师审查与验房期（attorney review / inspection，5 个工作日）；预约验房；氡气检测 | 合同日 +5 |
| 贷款 | 提交全部材料；评估（appraisal）；贷款承诺（mortgage commitment，通常合同日 +30） | 合同日 +30 |
| 过户前 | 房屋保险生效；产权保险与产权调查；HOA 文件（condo：22.1 披露、无欠费证明）；交割前一天最终查验（walk-through）；准备交割资金（电汇，警惕诈骗邮件） | 交割日 −7 / −1 |
| 交割 | 伊州转让税：州 $0.50 / $500、郡 $0.25 / $500 由卖方付；Chicago 买方 $3.75 / $500；Cook County 房产税滞后一年征收，卖方按 105–110% 给买方抵扣（prorated taxes） | 交割日 |
| 交割后 | 水电气网过户（ComEd、Peoples Gas、City water）；申请 Homestead Exemption（Cook County Assessor，每年可减税）；HOA 登记；地址变更和邮件转寄；换锁；留存 closing statement（ALTA / CD） | 交割日 +7 / +30 |

**卖出（sell）**

| 阶段 | 任务 | 相对日期 |
|---|---|---|
| 准备 | 伊州住宅物业披露表（Residential Real Property Disclosure）、氡气披露、1978 年前房子的含铅漆披露；Chicago 1–5 户住宅的分区证明（zoning certificate）和水费结清证明（full payment certificate）；condo 的 22.1 披露与付清证明（paid assessment letter） | 挂牌前 |
| 签约 | 收定金；律师审查 / 验房期应对买方要求 | 合同日 +5 |
| 过户前 | 向贷款行要还款函（payoff letter）；准备房产税抵扣；取消 / 转移房屋保险（交割后退保费）；最终查验前搬空 | 交割日 −7 |
| 交割 | 付转让税（州、郡；Chicago 卖方 $1.50 / $500 CTA 部分）；交钥匙 | 交割日 |
| 交割后 | 取消各账单自动扣款、结清最后一期水电气网；取消 HOA 自动扣款；邮件转寄；留存 closing statement 和改善支出凭证（报税：自住满 2 年可免 $250k / $500k 资本利得） | 交割日 +1 / +30 |

模板做成和季节任务同样的机制：模板在前端（`data/deals.js`），完成记录存数据库；每条任务有 `offset_days` 和基准（contract / closing），交易记录填了日期就算出到期日，进首页「今日」。

## 4. 数据模型

```
properties（已有）新增
  status text (looking/buying/owned/renting/selling/sold/moved_out) default 'owned'
  acquired_on date, purchase_price numeric, sold_on date, sale_price numeric

property_deals
  id, household_id, property_id, kind(buy/sell), stage(prep/contract/review/financing/pre_closing/closing/post_closing/done)
  contract_on date, review_deadline date, financing_deadline date, closing_on date
  price numeric, earnest_money numeric, notes
  parties: attorney, lender, agent, title_company, inspector（姓名 + 电话 / 邮箱文本，不存证件）
  created_at, updated_at

deal_task_done
  id, household_id, deal_id, task_key, done_on, done_by_name
  unique (deal_id, task_key)

bills 新增
  ends_on date   -- 晚于它的到期不再提醒；退出流程批量写入
```

状态 + `ends_on` 的组合让“卖出”不需要删除任何东西：提醒计算只看 `property.status in (owned, renting, selling, buying, looking)` 且 `bill.ends_on is null or next_due_on <= ends_on`。

## 5. 页面

- 设置页房产条目：状态徽章；按钮“开始买入流程 / 开始卖出流程 / 已卖出（退出向导） / 归档 / 彻底删除（仅已归档）”。
- 房屋 → 新二级页“交易”：当前交易的阶段条、关键日期、各方联系人、清单任务（按阶段分组、带到期日、可勾选）。没有交易时显示“开始买入 / 卖出”。
- 首页「今日」：交易任务并入现有任务段，标“交易”。
- 账单页：挂在已卖出 / 归档房产的账单显示“已结束”，默认折叠。

## 6. 分期

| 期 | 交付 |
|---|---|
| P1 | 房产状态字段与徽章；账单 `ends_on`；退出向导（交割日、账单批量停用与“取消自动扣款”清单、自动归档）；已归档房产的彻底删除（两步确认，说明保留花费记录）；迁移 007 |
| P2 | `property_deals` + `deal_task_done`；伊州买入 / 卖出清单模板（含 Chicago 条目）；交易页与首页接入；各方联系人 |
| P3 | 交割文件附件（Storage）；成本基础与资本利得工作表（买价 + 改善支出 + 卖出费用）；其他州模板 |

## 7. 已确认的决定与实现说明（P1 + P2 已实现）

1. 卖出后默认归档保留；彻底删除只对已归档房产开放，输入房产名确认，花费统计记录保留。
2. 看房、签约阶段可建房产（状态 looking / buying），买入清单从签约开始算。
3. 联系人只存文本（`property_deals` 的 attorney / lender / agent / title_company / inspector）。
4. P1 和 P2 一起上线：迁移 007；交易页在“房屋 → 交易”；清单模板 `data/deals.js`。
5. 停服务提醒按账单分类生成，优先级“必须”，到期日相对交割日（见 README“停服务提醒”）；退出向导把账单 `ends_on` 按分类错开（水电气 +30、水 +45、网络 +14、其余 = 交割日），`ends_on` 存在时以它判断“已结束”，否则看房产状态，保证最后一期账单仍会提醒。
6. 与第 3 节差异：阶段不单独存库，由任务模板的 stage 字段分组；`review_deadline` 填了合同日后按 5 个工作日自动补一个。
