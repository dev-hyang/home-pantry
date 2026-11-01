# 收入、资金流入与统一账本（2026-10-31，迁移 056）

和花费的三级分类（[design-categories.md](design-categories.md)「三级分类与统计口径」）对称：收入也分一级 → 叶子，并且把「真正挣到的收入」和「只是进了账户的钱」分开。

## 问题

- 收入只有一个类型（`income_records.kind`），所有到账都当收入：卖房、卖股票的本金、借款到账、从自己储蓄账户转回来的钱都会把「月收入」「结余率」拉得很高。
- 原来的「额外类型」（国际电汇、个人赠与）是一个默认不勾的开关，口径不清楚，各页面还不一致。
- 入账账户只是一段文字，按账户看不了；`cards` 只有信用卡 / 借记卡 / 支票 / 储蓄 / 礼品卡，没有券商、退休账户、贷款。
- 收入页的「收支对比」要把一段时间的花费整表读进浏览器。

## 三个概念

| 概念 | 是什么 | 例子 |
|---|---|---|
| **收入 Income**（认定收入） | 真正赚到或获得的 | 工资、奖金、股息、利息、租金、已实现收益、退税、赠与 |
| **现金流入 Cash Inflow** | 进了银行 / 投资账户的钱 = 收入 + 资本流入 | 卖股票到账 $15,000，其中收入只有收益 $5,000 |
| **资产增长 Asset Growth** | 资产价值变化，不一定有现金流 | 401K 投入、房子涨价（第二期：净资产） |

| 交易 | 现金流入 | 收入 |
|---|---|---|
| 工资到账 $8,000 | +8,000 | 8,000 |
| 股票分红 $200 | +200 | 200 |
| 卖股票 $15,000（成本 10,000） | +15,000 | 5,000（填「其中已实现收益」） |
| 卖房 $180,000 | +180,000 | 只有填的收益部分 |
| 借款到账 $20,000 | +20,000 | 0 |
| 从储蓄账户转入 | +5,000（internal） | 0 |
| 信用卡退款 | 仍记成负花费（冲减消费） | — |

## 分类（规则只在 `js/core/income-taxonomy.js`）

`income_records.kind` 不改写，每个旧 id 都是叶子。

| 一级 | 算收入？ | 叶子（新增的加粗） |
|---|---|---|
| 工作收入 employment | ✓ | payroll 基本工资、bonus 奖金、package 雇主福利、**overtime 加班费**、**commission 佣金**、**rsu RSU / 股票薪酬**、**other_employment** |
| 投资收益 investment | ✓ | interest 利息 / 分红（旧的合并类型，保留）、**dividends 股息**、**bank_interest 银行利息**、**capital_gain 已实现收益**、**fund_dist 基金分配**、**bond_interest 债券利息** |
| 房产收入 property | ✓ | rental 租金、**parking_income 车位**、**storage_income 储藏间**、**property_reimb 房产相关报销**、**other_property** |
| 其他收入 other_income | ✓ | tax_refund 退税、insurance 理赔、cashback 返现、reimburse 报销、zelle Zelle / Venmo 转入、gift 个人赠与、other 其他、**gov_benefit 政府补助**、**side_business 副业** |
| 资本与资产流入 capital | ✗ | sale 出售所得、wire 国际电汇、**property_sale 卖房**、**stock_sale 卖股票**、**loan_proceeds 借款到账**、**returned_principal 本金返还**、**expense_refund 支出退回**、**xfer_savings 从储蓄转入**、**xfer_invest 从投资账户转入** |

旧 → 新：

| 旧大类 | 旧类型 | 新一级 |
|---|---|---|
| 工作收入 | payroll / bonus / package | 工作收入 |
| 投资与租金 | interest | 投资收益 |
| 投资与租金 | rental | 房产收入 |
| 退款与返还 | tax_refund / reimburse / insurance / cashback | 其他收入 |
| 转账与赠与 | zelle、gift | 其他收入（**赠与现在算收入**——你的决定） |
| 转账与赠与 | wire | 资本与资产流入（**国际电汇不算收入**——你的决定） |
| 其他收入 | sale | 资本与资产流入（卖的是资产；有赚的填收益） |
| 其他收入 | other | 其他收入 |

自定义类型（`_income_kinds[].parent`）读的时候换算：work → 工作收入，invest → 投资收益，refund / other / 空 → 其他收入，**transfer → 资本与资产流入**（看不出来的「转账」先保守地不算收入；在 明细 → 管理收入类型 里一键改回「其他收入」）。改过一级后存新 id。

「额外类型」开关（含国际电汇 / 个人赠与）去掉了：按一级的规则统一处理；明细里「不含资本流入」的筛选代替它（旧链接的 `ex=1` 也换成这个意思）。

## 认定收入 `income_records.income_amount`

- 可空，`0 ≤ income_amount ≤ amount`（数据库 check）。
- 空 = 默认：收入类一级 = 整笔；资本与资产流入 = 0。
- 表单里卖出类（出售所得、卖股票、卖房、已实现收益）显示「其中已实现收益」。填了就只有这部分算收入，其余是资本流入（本金返还）。
- 收益算到哪个一级：卖股票 / 卖房 / 已实现收益 → **投资收益**（资本利得；卖房的收益也放这里，「房产收入」留给租金这类经常性收入，以后做每套房的收支时不被一次性卖房款搅乱）；二手出售等 → 其他收入。
- **需要还的**（`repay_required`）一律当借款到账：收入 0，不管类型和填没填收益。

## 卡与账户

`cards.kind` 新增 `brokerage` 券商、`retirement` 退休（401K / IRA）、`hsa`、`loan` 贷款（负债）、`cash` 现金。它们和支票 / 储蓄一样是「账户」：没有返现、不参与推荐，列在「银行与投资账户」。页面改名「卡与账户」。

`income_records.account_id`（→ cards，删账户置空，触发器保证同一个家庭）：收入表单、银行导入写它；文字列 `account` 保留做显示兜底。迁移按原文字（「名称」/「名称 ••尾号」/ 文字里带尾号）一次性回填。余额、估值留给第二期。

## 统一账本 `ledger_v`（第一步）

`security_invoker = true` 的视图（行级安全照常），把 purchases、事件型账单的付款（规则同 `spend_feed`）、income_records 合成一条流水：

`source, id, household_id, occurred_at, occurred_on, name, counterparty, amount（流入 +、流出 −）, currency, type, cash_flow_direction, category, l1, nature, repay_required, income_amount, expense_amount, account_id, property_id, person_id, created_by, import_batch`

- `type`：income / expense / transfer / investment / asset_purchase / asset_sale / loan。花费按性质：转账 → transfer，资本性 → asset_purchase，投资 → investment，融资 → loan，其余 expense；收入：收入类 → income，卖出 → asset_sale，借款 / 需要还 → loan，本金返还 → investment，支出退回 → expense，其余（转入、电汇）→ transfer。
- `cash_flow_direction`：inflow / outflow / internal（转账、自己账户转入）。
- `income_amount` = 认定收入；`expense_amount` = 认定消费（生活消费 + 房产住房里性质是日常消费的，退款为负）。
- 分类规则在 SQL 里有一份镜像（`spend_l1`、`spend_nature_default`、`income_kind_l1`），给 SQL 报表用；应用里的统计按前端规则算。改分类时两边一起改（校验脚本对比过）。

聚合：

- `inc_rollup(household, from, to, tz)` → 月 × 类型 × 成员 × 账户 × 币种 × 是否需要还：`amount_sum`、`income_sum`（填了收益的认定额）、`dflt_sum`（没填的到账额）、`n`；前端 `splitAmounts` 决定 dflt 算不算收入。
- `ledger_rollup(household, from, to, tz, unit, anchor)` → 周期（月 / 双周）× 来源 × 类型 × 方向 × 分类 × 性质 × 成员 × 币种。收支对比的花费一侧用它。
- `inc_stats` 多 `income_sum` / `cap_sum`（前端传 `capk` = 默认不算收入的类型）；`inc_filtered` 可按 `acct` 筛。

## 收支总览的指标

| 指标 | 公式 |
|---|---|
| 收入 Gross Income | Σ 认定收入 |
| 消费 Consumption | 日常（生活消费 × 日常消费）/ 含住房（+ 房产住房 × 日常消费），和花费页同一口径 |
| 净现金流 Net Cash Flow | 收入 − 消费（含住房），在投资之前 |
| 储蓄率 Savings Rate | （收入 − 消费）÷ 收入 |
| 投资率 Investment Rate | 投资（性质 = 投资的现金流出）÷ 收入 |

现金流瀑布：收入 − 日常 − 住房 = 净现金流 − 财务及其他 − 资本性支出 − 投资 = 剩余现金。资本流入单独一行说明，不进剩余现金（不然卖一次房，「剩余现金」就失真了）。花费不分人：选了某个成员时只看收入。

## 各标签

- **收支总览**：五个指标、现金流瀑布、近 12 个月收入 vs 消费（虚线 = 投资）、收入按一级排行（带 %）、资本流入单列、主要付款方、按成员、最近到账、待还。
- **明细**：类型树筛选（一级 / 叶子）+ 账户筛选；合计显示到账、认定收入、资本流入；表单的类型按「一级 · 叶子」分组，账户从「卡与账户」选，卖出类有「其中已实现收益」。
- **类型**：一级 → 叶子逐层（面包屑），排行 + 每月柱状图，和花费的「分类」一样；资本流入在第一层单列「不计收入」。
- **付款方**：合计 = 认定收入，资本流入另列。
- **收支对比**：收入（认定）vs 消费（含住房）、投资、净现金流、储蓄率，双周 / 月 / 季 / 年；花费读 `ledger_rollup`，不再读花费整表。
- **导出**：明细 CSV 多「一级分类」「认定收入」「资本流入」「账户」。
- **预算与计划**：计划（member_incomes）vs 实际认定收入。
- 原来的「权限」标签代码删掉（`income_access` 表留着，不删数据）。
- 对账单 → 全部流水：读 `ledger_v`；收入 KPI 是认定收入，资本流入另列。

## 第二期（这次不做）

- 净资产：账户余额 / 估值、房产 / 车辆市值、贷款余额 → `NetWorth = TotalAssets − TotalLiabilities`。
- 会计分录（Journal entries）：一笔卖股票拆成 现金 +15,000 / 投资资产 −10,000 / 已实现收益 +5,000；`ledger_v` 是这一步之前的统一视图。
- 每套房的收支（租金 − 持有成本）。
- 应收账单（receivable bills）和房产收入关联。
