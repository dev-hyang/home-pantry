# 借贷（财务 P2）设计

> 2026-11，迁移 058。相关：[design-finance-ia.md](design-finance-ia.md)（P1 信息架构和分期）、[design-income-ledger.md](design-income-ledger.md)（统一账本、收入分类）、[design-categories.md](design-categories.md)（花费分类和经济性质）。

## 1. 问题与成功标准

**问题**
- 房贷 / 车贷只是一条周期性账单：每月整笔记成「房产住房」或「财务及其他」的花费，本金（还债、攒净值）和利息（真正的成本）混在一起，「含住房」的消费被本金拉高。
- 没有余额、利率、期限，看不到还剩多少、什么时候还清。
- 车贷和车辆靠「账单名里含车名」猜关系；改个名字就对不上。
- 亲友借款藏在收入记录的「需要还」开关里，借出去的钱根本没有地方记。
- 房产买卖价、交易成交价、设备 / 车辆买价只是界面上藏起来，没有财务权限的家人通过 API 仍读得到（P1 遗留）。

**成功标准**
- 财务 → 借贷：资产融资 / 个人借贷 / 还款记录三个标签；每笔贷款有余额、利率、期限、每期还款、下次还款、关联资产。
- 有利率和本金（或某天的余额）的贷款，账单每笔缴费自动拆成 本金 / 利息 / Escrow；本金不算消费，总现金流出不变（**不重复、不丢**）。
- 历史还款一并拆分（回填），趋势不在某个月突然跳。
- 贷款按 id 挂房产 / 车辆；旧的名字匹配只作为一次性迁移建议，要用户确认。
- 收入里「需要还」的记录全部转成借款，原记录、还款、关联的花费都还在、都能点过去。
- 价格列在数据库层面只有财务权限能读；房屋表单照常可用。
- 所有旧网址照常打开。

## 2. 数据模型

```
debt_accounts（合同）                                debt_transactions（流水）
 id, household_id, name                              id, household_id, debt_id → debt_accounts（级联删）
 category  personal_lending | mortgage | auto_loan   txn_date, type  disbursement | principal_repayment |
           heloc | home_equity | personal_loan             interest_payment | interest_income | fee |
           student_loan | credit_line | other              escrow | adjustment | write_off
 direction receivable（借出）| payable（借入）           principal_amount（调整可带符号）, interest_amount,
 counterparty_name, person_id → household_people          fee_amount, escrow_amount, total
 lender_card_id → cards（kind = loan，可选）              bill_payment_id → bill_payments（唯一，级联删）
 original_principal, currency, interest_rate（年 %）      purchase_id → purchases（置空）
 term_months, start_date, maturity_date                   income_record_id → income_records（置空）
 payment_frequency, scheduled_payment（每期总额，含 Escrow）  income_repayment_id → income_repayments（置空）
 opening_balance + opening_balance_on（中途开始记）       split_source schedule | manual
 status active | paid_off | overdue | written_off | closed  source_key（迁移的稳定键）, notes
 property_id → properties, asset_id → assets（融资关系）
 financing_role, secured, link_confirmed, source_key, notes
bills.debt_id → debt_accounts（置空）：这条账单就是贷款的还款计划（提醒、自动扣款、缴费记录照旧）
```

**关系模型：列，不是关系表。** 一笔贷款最多对应一处资产（房贷 → 房子，车贷 → 车，HELOC → 房子），一处资产可以有多笔贷款（首贷 + HELOC）：一对多，`debt_accounts.property_id / asset_id` 两个外键就够，不需要 finance.md 里的 `AssetFinancing` 表。关系表只在「一笔贷款抵押多处资产」时才需要，家庭场景里没有；以后真要，可以加一张表而不动现有列。`financing_role`、`secured` 同样是合同上的属性。车辆是 `assets.kind = 'vehicle'`，用 `asset_id`。

**方向、类型、抵押是三个独立属性**（finance.md 的建议）：亲友借款可以有抵押，资产融资也可以无抵押。

**不重复的数据**：现金只在 `purchases`（流出）/ `income_records`（流入）里记一次；`debt_transactions` 是同一笔钱的借贷视角，用外键指回现金记录，不另记来源。`ledger_v`、`spend_rollup`、收入聚合都只读现金表，所以不会多算。

**余额** = 起点 ± 之后的流水：起点 = 某天的余额（`opening_balance`，只算那天之后的流水）；否则有放款流水就从 0 起算放款；否则用原始本金。放款 +，还本 / 核销 −，调整带符号。

## 3. 迁移 058 的数据映射（可重复执行，`source_key` 防重复）

| 来源 | 变成 | 说明 |
|---|---|---|
| 周期性账单 category = mortgage / car_loan / student_loan / personal_loan（和 heloc / home_equity），应付 | 一笔 `payable` 贷款，`bills.debt_id` 指过去；`source_key = bill:<id>` | 名称 = 账单名；类型按对照表（car_loan → auto_loan）；贷款方 = 收款方；每期还款 = 账单的常规金额；频率按账单；房贷类带账单的房产；起始日 = 最早一笔缴费（没有就用建账单日）；状态：停用 → closed，过了结束日或房产已卖出 / 退租 / 归档 → paid_off，其余 active。**利率、原始本金没有来源，留空**：填上之前不拆分（数字不变） |
| 车贷 → 车辆 | `asset_id` + `link_confirmed = false` | 账单名里含车名、只对上一辆；或全家只有一辆「贷款中」的车。对不上 / 有歧义就留空。借贷页、资产页、提醒都标「待确认」，确认或改选后才算数 |
| 收入 `repay_required = true` | 一笔 `personal_lending` + `payable` 借款（`income:<id>`）| 对方 = 付款方，`person_id` = 收入记录的成员，金额 = 需要还的总额（空 = 到账金额，和原来「还差」一致），到期 = 还款到期日，已还够 → paid_off |
| 那条收入 | 放款流水（`income_record_id`），本金 = 需要还的总额，`total` = 到账金额 | 原收入记录不动（它在收入统计里本来就是 0：借款到账不算收入） |
| 每条 `income_repayments` | 还本流水（`income_repayment_id`、`purchase_id`），`irep:<id>` | 当时同时记的那笔花费性质改成「融资 / 还本」（只改没手动设过性质的）：还钱不是消费 |
| 信用卡账单 | **不转** | 信用卡是循环额度：没有固定本金、期限，余额天天变；还款本来就是「转账」（不算花费）。余额属于第三期（账户余额 / 净资产快照），那时和支票、储蓄账户一起做 |
| 价格列 | 旁表 | 见 §6 |

演示数据（浏览器本地）在第一次打开时按同一套规则转换（`js/core/debt-rules.js` 的 `migrateLegacyDebts`）。

## 4. 拆分规则

**怎么算**（`js/core/amortization.js`，纯函数；迁移 060 起按摊还表逐期对账）
- **本息只来自摊还表**：每期本息 = 对账单校准（`statement_check` 的本金 + 利息）> 等额本息公式（原始本金、年利率、期限）> 某天的余额 + 剩余期数；**从不从 Escrow 账单倒推**。
- **期数按日期对**：第 k 期还款日 = 第一期还款日（`first_payment_date`；没填 = 放款日 + 一个周期）往后 k−1 个周期；每笔缴费对到最近的那一期（早交、晚交几天都对得上），同一期两笔的后一笔顺延。
- **逐期利息**：余额按分记，利息 = 余额 × 年利率 ÷ 12，四舍五入到分（半分进位，用整数算，不受浮点误差影响），本金 = 本息 − 利息，最后一期把零头还清。没记缴费的期按计划（假定按时还了）。
- **Escrow** = 实付 − 本息 − 额外本金（滞纳金另记）。实付不够本息时先付利息再付本金，Escrow 0，表里标 ⚠。
- **额外本金**：多出的部分默认算在 Escrow 里；和银行的 Escrow 计划（`escrow_schedule`）比多了，表里给一个「多 X 记为额外本金」按钮，记在 `debt_transactions.extra_principal`（含在本金里），余额变少、之后每期利息重算。不和月供一起付的额外还本照旧记成单独的流水。
- **Escrow 参考**：房产上的 Escrow 代缴账单（保险 + 房产税 …）÷ 12 只显示在银行 Escrow 旁边做提示（缓冲 / 每年分析会让两者不同），不参与计算。
- **对账单校准**：填一期的还款日、本金、利息（可加还款后余额）→ 对到第几期、逐分对照；不一致时提示可能原因（第一期还款日差一个月、本息和公式不同、之前有额外本金），可以存成校准（本息以对账单为准）或作为记录起点（`opening_balance`）。
- **回填 / 重新拆分**：整段按上面的规则重算并写入；手动改过的保留，选「覆盖手动改过的」才重算（额外本金保留）。记一笔缴费时也整段重算，但只写有变化的几笔。
- 例（示意数字）：本金 200,000、6% 、360 期、第一期 3/1 → 本息 1,199.10；第 1 期 利息 1,000.00、本金 199.10，余额 199,800.90；实付 1,650.00 时 Escrow 450.90。
- **手动改**：每期可以按对账单改本金 / 额外本金 / 利息 / Escrow，存 `split_source = manual`；金额改了的那期自动回到按摊还表。

**怎么存（两行花费）**：一笔缴费原来是一行 `purchases`（`bill_payments.purchase_id`）。拆分后：
- 主行（还是 `bill_payments.purchase_id` 那行）= 利息 + Escrow + 滞纳金；
- 本金行 = 新的一行，挂在借贷流水的 `purchase_id` 上。
两行金额相加 = 实付，删缴费记录时一起删。选两行而不是「一行 + 拆分比例」：`ledger_v`、`spend_rollup`、`spend_page`、预算、报表都按 `purchases` 的「分类 + 性质」聚合，两行就能让所有统计自动正确，不用改一个聚合函数，也不会出现某个页面忘了按比例算。

## 5. 记账影响

| 现金 | 分类 | 性质 | 统计桶 | 消费？ | 收入？ |
|---|---|---|---|---|---|
| 房贷利息 + Escrow + 滞纳金 | bill_mortgage（房产住房 · 房贷） | 日常消费 | 住房 | ✓（含住房） | — |
| 房贷本金 | bill_mortgage | 融资 / 还本 | 财务及其他 | ✗ | — |
| 车贷利息 + 滞纳金 | **loan_interest_auto**（生活消费 · 交通 · 车贷利息，新） | 日常消费 | 日常 | ✓ | — |
| 车贷本金 | bill_car_loan | 融资 / 还本 | 财务及其他 | ✗ | — |
| 学生贷款 / 分期 / 其他的利息 | bill_<分类>（财务及其他 · 贷款利息与手续费） | 日常消费 | 财务及其他 | ✗（不进日常 / 住房） | — |
| 它们的本金 | bill_<分类> | 融资 / 还本 | 财务及其他 | ✗ | — |
| 借给亲友 | **debt_principal**（财务及其他 · 借贷本金，新，默认性质 = 融资） | 融资 | 财务及其他 | ✗ | — |
| 亲友还我本金 | 收入 returned_principal（资本与资产流入） | — | — | — | ✗（本金返还） |
| 亲友付我利息 | 收入 interest（投资收益） | — | — | — | ✓ |
| 向亲友借到钱 | 收入 loan_proceeds（资本与资产流入） | — | — | — | ✗ |
| 我还亲友本金 | debt_principal | 融资 | 财务及其他 | ✗ | — |
| 我付亲友利息 | life_fees（贷款利息与手续费） | 日常消费 | 财务及其他 | ✗ | — |

- **Escrow 只算一次**：Escrow 代缴的房产税 / 保险账单不记缴费、每月折算是 0（原来就这样），所以月供里的 Escrow 部分就是房产税和保险，留在住房消费里。finance.md 设想的「Escrow 先进资产、代付时再记费用」需要记录贷款方每次代付，现在没有这份数据；按现在的做法，不管哪种口径，同一笔钱都只出现一次，只是确认时点按月而不是按代付日。
- 均摊月均（统计页的「日常 / 含住房」）里，挂了贷款的账单的每月折算减去本金估算（`billExpenseMonthly`），和实际拆分口径一致。
- 没填利率 / 本金的贷款不拆分，数字和迁移前完全一样；填了以后整段历史一起拆，趋势不跳。
- **风险**：0% 的分期（Affirm 之类）填了利率 0 以后，整笔都是本金 → 不算消费。分期买的东西如果没另记一笔花费，消费就少了：这种分期建议不填利率（不拆分），或者把商品另记一笔花费。

## 6. 价格的数据库闸门

P1 只在界面上藏。058 选**旁表**：

| 原表 | 旁表（主键 = 原表 id） | 列 |
|---|---|---|
| properties | property_financials | purchase_price, sale_price |
| property_deals | deal_financials | price, earnest_money |
| assets | asset_financials | purchase_price, replacement_cost_estimate, sale_price（原 `vehicle->'sale_price'`） |

- 旁表行级安全 = `my_finance_household_ids()`：没有财务权限的人读写不到，API 也一样。
- 迁移先复制再清空原表的价格列（列保留，恒为空），不丢数据。
- 原表加 AFTER 触发器：旧客户端、备份恢复、SQL 编辑器还往原表写价格时，有财务权限就搬进旁表（空值不覆盖），然后清掉原表；没权限写的价格直接丢弃。
- 应用（`store.js`）读的时候把旁表合并回原来的字段，所以房屋、交易、资产页的代码都不用改；写的时候主表不带价格、有财务权限才写旁表；没执行 058 时照旧用主表。
- **为什么不用列权限 + 视图**：PostgREST 的 `select=*` 碰到没权限的列整条请求失败，所有读这三张表的地方都要改成列出列名；还要给有权限的人另开视图 / 函数。旁表让行级安全按行生效，读写路径只改数据层一处。
- 备份包含旁表（备份本来就只给有财务权限的人）；恢复旧备份时原表里的价格被触发器搬进旁表。

## 7. 界面

- **财务 → 借贷**（`#/bills/debts`，别名 `#/finance/debts`、`#/bills/loans`、`#/bills/debt`、`#/bills/lending` → 个人借贷），财务权限：
  - 宽屏标签条 / 手机下拉（P1 同一套 `tabBar`）；资产融资：每笔贷款一张卡（贷款方、原始本金、未还、利率 / 期限、每期（含 Escrow）、下次还款、关联资产链回房屋 / 车辆、净值「P3」），已结束的收起；还没建贷款的贷款账单列在下面给「建贷款」。
  - 个人借贷：借出 / 借入两组（对方、金额、余额、到期 + 逾期、已还比例）。
  - 还款记录：全部流水，按 50 条一页。
- **详情** `?id=`：数字、每期拆分（每期一行可展开改）、按摊还表重新拆分、记一笔（额外还本 / 亲友还款 / 再借，可勾「同时记花费 / 收入」，对账单已导入就取消）、摊还表（折叠，24 期一页，手机上省掉本息列、表格可横滑并可用键盘聚焦）、关联账单 / 房产 / 车辆（按 id 下拉选），迁移猜的车辆「对 / 不对」。编辑 `?id=&edit=1`、新建 `?new=1&cat=&lender=&principal=&prop=&asset=&start=&bill=`。
- **资产页**：房产、车辆按 id 显示贷款（未还、每月、待确认）；没关联车辆的车贷、没建贷款的贷款账单列在下面提示关联。名字匹配删掉了。
- **收入**：转成借款的记录显示「已转为借款」和链接，还款去借贷里记；新勾「需要还」的收入自动建借款。收入页不再提醒这些记录（借贷提醒接手）。
- **交易**：买房 / 买车填了贷款行，交易页多一行「创建贷款」（预填贷款方、成交价 − 定金、房产 / 车辆 id、交割日）；卖房 / 卖车交割时，挂在上面的贷款标为已还清。
- **车辆**：车贷还款中 ↔ 车辆「贷款中」；还清 → 「持有」并写贷款结清日期。车辆资料的「贷款结清日期」旁显示车贷（有财务权限）。
- **提醒**（来源「借贷」，财务权限）：亲友借贷 / 不挂账单的贷款一个月内到期、逾期；迁移猜的车辆待确认。月供本身的到期 / 逾期仍是账单提醒。
- 所有点击目标 ≥ 44px（按钮、可展开的每期行），标签条和下拉共用一份定义，表格有 `role=region` + 标签。

## 8. 权限

| | 家主 / 有财务权限 | 没有财务权限 |
|---|---|---|
| 借贷页、借贷提醒、资产页里的贷款 | ✓ | ✗（目录、快捷操作、网址都挡；数据库读不到 `debt_*`） |
| 账单（含贷款账单的提醒和缴费） | ✓ | ✓ |
| 缴费拆分出来的两行花费 | ✓ | ✓（花费全家可见，和以前一样） |
| `bills.debt_id` | 可改 | 看得到 id，读不到贷款；保存账单不受影响 |
| 房产 / 交易 / 设备的价格 | ✓ | ✗（数据库层面） |

## 9. 没做 / 以后

- 余额快照、净值（房产估值 − 房贷）= P3：已实现（迁移 059，见 [design-net-worth.md](design-net-worth.md)）；信用卡欠款也在那里按余额历史算负债。
- HELOC / 信用额度的多次提款按放款流水记，没有单独的额度管理。
- 按日计息、可变利率：按对账单手动改每期拆分。
- 银行导入直接建的房贷花费（没有经过账单缴费）不会自动拆分。
