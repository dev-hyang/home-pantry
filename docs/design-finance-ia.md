# 财务信息架构（P1）设计

> 2026-11。范围只是**信息架构**：改名、分组、新的「资产」视图、去掉房屋资料里和账单重复的金额、权限边界。
> 借贷（P2）已在 2026-11 实现（迁移 058，设计见 [design-debt-lending.md](design-debt-lending.md)）；净资产（P3）也已实现（迁移 059，设计见 [design-net-worth.md](design-net-worth.md)）。相关：[design-bills.md](design-bills.md)、[design-house.md](design-house.md)、[design-cards.md](design-cards.md)、[design-income-ledger.md](design-income-ledger.md)。

## 1. 问题与成功标准

**问题**：钱相关的页面散在「账单」页签下（名字只说了账单），房产、车辆的买卖价格只在房屋 → 交易里能看到，
房屋资料里的保险年保费、HOA 月费和账单里的金额是两份数据，改了一处另一处不变；没有财务权限的家人在房屋页面里能看到买房价。

**成功标准**
- 底栏仍是 6 项，「账单」改名「财务 / Finance」；所有旧的 `#/bills/…` 网址（含查询参数、首页快捷操作、提醒链接、书签）照常打开。
- 财务目录按用途分组，层级不加深：底栏 → 目录 → 页面 → 页内标签。
- 新的「财务 → 资产」把房产、车辆、账户的钱的一面放在一起，每行链回原记录（单一真相来源）。
- 保险年保费、HOA 常规费用只有一个来源：账单。旧值不丢。
- 没有财务权限的家人看不到收入、预算、对账单、资产页，也看不到房屋页面里的价格。

## 2. 导航：之前 vs 之后

```
之前                                   之后
底栏：今日 储藏 房屋 账单 采购 我的     底栏：今日 储藏 房屋 财务 采购 我的
账单 (#/bills)                         财务 (#/bills，别名 #/finance)
├─ 概览                                ├─ 收支
├─ 周期性账单                          │  ├─ 花费
├─ 一次性账单                          │  ├─ 收入（→ 明细）            [财务权限]
├─ 花费                                │  ├─ 周期性账单
├─ 收入            [财务权限]          │  ├─ 一次性账单
├─ 对账单          [财务权限]          │  └─ 对账单                    [财务权限]
├─ 预算            [财务权限]          ├─ 账户与资产
└─ 卡与账户                            │  ├─ 卡与账户
                                       │  └─ 资产（新）                [财务权限]
房屋 (#/house)                         ├─ 借贷：贷款与借款              [财务权限，P2 已实现]
├─ 房产列表 → 房产目录                 ├─ 预算与计划
│  ├─ 概览 / 房屋资料 / 账单           │  └─ 预算                      [财务权限]
│  ├─ 季节任务 / 设备保养 / 交易       └─ 分析
└─ 车辆                                   ├─ 账单概览
                                          ├─ 收支总览（= 收入页第一个标签）[财务权限]
                                          └─ 净资产（P3）                [财务权限]
                                       房屋：不变
```

- 宽屏（≥ 760px）：分组是两栏卡片（CSS `columns`，DOM 顺序 = 读屏 / Tab 顺序：先左栏再右栏）；手机：一列分组列表。分组标题是 `h3`，每组 `section aria-labelledby`。
- 「借贷」原来是一张不可点的占位卡（P1），P2 起是真的页面 `#/bills/debts`（别名 `#/finance/debts`、`#/bills/loans`、`#/bills/debt`、`#/bills/lending`）；没有财务权限的人整组不显示。
- 「收支总览」不另做一页：就是收入页的第一个标签；收支组里的「收入」行直接进明细，避免两行进同一页。

### 旧网址
内部 section id 仍是 `bills`，所以旧链接**零迁移**；`#/finance/…` 在 `parseRoute` 里改写成 `#/bills/…`。

| 旧网址 | 现在 |
|---|---|
| `#/bills` | 财务目录（分组） |
| `#/bills/overview`、`recurring`、`onetime`、`spend`、`income`、`statements`、`budget`、`cards`、`template` | 同一页（不变） |
| `#/bills/list`、`#/bills/history`、`#/bills/medical` | 原有别名照旧（周期性账单 → 清单 / 记录；一次性账单） |
| `#/bills/spend?tab=import` | 财务 → 对账单（原有别名） |
| `#/bills/income?tab=report` | 收入 → 收支对比（原有别名） |
| `#/me/settings?sec=income` | 收入 → 预算与计划（原有别名） |
| `#/finance/<sub>?…` | 新别名 = `#/bills/<sub>?…` |
| `#/bills/assets` / `#/finance/assets` | 新：财务 → 资产 |
| `#/bills/debts`（`?tab=asset｜personal｜txns`、`?id=`）/ `#/finance/debts` / `#/bills/loans` / `#/bills/debt` / `#/bills/lending` | P2：财务 → 借贷 |
| `#/bills/networth`（`?range=12｜24｜all`）/ `#/finance/net-worth` / `#/finance/networth` / `#/bills/net-worth` / `#/bills/nw` | P3：财务 → 分析 → 净资产 |

## 3. 什么留在房屋，为什么

房屋是**运营**的家：东西在哪、谁维护、什么时候做。财务是**钱**的视角。资产页只是把房屋里已有的数字拿来看，不复制。

| 内容 | 放在 | 理由 |
|---|---|---|
| 房产（名称、类型、用途、状态） | 房屋 | 运营主档；财务 → 资产只读引用 |
| 房屋资料（房型、材料、应急、产权、保险联系人、HOA 规则） | 房屋 | 维护和应急要用 |
| 保险年保费、HOA 常规费用 | **账单**（唯一来源），房屋资料只读显示 | 预算、现金流、提醒都按账单算 |
| HOA 特殊评估 | 房屋资料 | 一次性摊派、有截止日；账单里有对应缴费记录时不再提醒（`saHandledByBill`） |
| 季节任务、设备与保养、出了问题 | 房屋 | 纯运营 |
| 交易流程（买 / 卖 / 退租、车辆买卖） | 房屋 | 清单和日期是运营；成交价是财务字段，只给有权限的人看 |
| 车辆档案（牌照、保养、车险联系人） | 房屋 → 车辆 | 运营；买价 / 卖价 / 贷款到期在资产页汇总 |
| 卡与账户 | 财务 | 钱 |

## 4. 关系图

```
properties ──< bills.property_id ──< bill_payments ──> purchases (缴费记的花费)
     │                                               ▲
     ├──< purchases.property_id ─────────────────────┘ (今年这套房的花费：spend_rollup 按房产聚合)
     ├──< property_deals.property_id  (price / earnest_money → 交割时写 properties.purchase_price / sale_price)
     └──< assets.property_id ──< maintenance_logs.purchase_id ──> purchases
assets(kind=vehicle) ──< property_deals.asset_id (车辆交易：price → assets.purchase_price / vehicle.sale_price)
                     ──< debt_accounts.asset_id   （P2：车贷按 id 挂车辆；原来按账单名里的车名猜）
properties ──< debt_accounts.property_id ──< debt_transactions >── bill_payments / purchases / income_records
bills.debt_id ──> debt_accounts（贷款的还款计划）
cards ──< purchases.card_id      cards ──< income_records.account_id      cards.bill_id → bills（信用卡还款提醒）
```

## 5. 资产页（P1）

- **房产**：状态、买入 / 卖出（价格 + 日期，来自交易交割）、关联账单每月（`bills.property_id`，自己交的 + Escrow 代缴分开写）、今年挂在这套房上的花费（排除「转账」性质；数据来自统计页同一份 `spend_rollup` 缓存，不新增查询）、估值「P3」。链接：在房屋里打开、账单清单（按房产筛）、花费明细（按房产 + 年份）。
- **车辆**：拥有状态（含贷款中 / 租赁）、买入 / 卖出 / 归还、贷款或租约到期、车贷账单（`category = car_loan`，名字含车名的归到那辆车，其余列在区块底部）、估值「P3」。
- **账户**：卡与账户里 kind ∈ 支票 / 储蓄 / 券商 / 退休 / HSA / 贷款 / 现金，「余额：P3」。
- 数据量：房产、车辆、账单、卡都是启动时整表读进内存的小表；只有花费要扫明细，用已有的聚合 RPC。
- **没加估值字段**（`properties.market_value` 等）：P1 没有地方用它算东西，加了只是多一个要维护的数字；和余额一起放到 P3（净资产快照）一次设计。所以这次**没有迁移**。

## 6. 保险 / HOA 金额：单一来源与旧数据

- `linkedBill(pid, cat)`：先找挂在这套房产上的在用账单，再找没挂房产的（和以前 HOA 链接的规则一致）。修了旧代码里按不存在的 `bills.archived` 过滤的问题。
- 有账单：资料表单、房屋卡片、HOA 参考块只读显示账单金额（保险折成每年；HOA 显示每期金额 + 频率，每月总计按折合每月 + 进行中的特殊评估分期），链到账单去改。
- 只有旧值（资料里填过 `insurance_premium` / `hoa.dues*`，没有账单）：照样显示，标「资料里的旧值」，给预填好的「创建账单」：`#/bill/new?category=…&prop=…&amount=…&freq=…&name=…&payee=…`（账单表单新认这几个参数）。
- 旧值放在隐藏字段里随表单原样保存，**不会被清掉**；建好账单后显示自动切到账单。以后确认都迁完了再考虑清理字段（不在 P1）。

## 7. 权限（方案 a）

| | 家主 / 有财务权限 | 没有财务权限 |
|---|---|---|
| 财务页签、目录 | ✓ | ✓（只显示能看的行） |
| 花费、周期性 / 一次性账单、账单概览 | ✓ | ✓ |
| 卡与账户 | 可改 | 只读，不能添加 |
| 收入、收支总览、对账单、预算 | ✓ | ✗（目录、快捷操作、直接打开网址都挡） |
| 资产（新） | ✓ | ✗ |
| 借贷、净资产（P3：余额 / 估值 / 快照三张表也是数据库层面挡） | ✓ | ✗ |
| 房屋里的房产买入 / 卖出价、交易成交价 / 定金、设备买价 / 更换估价、车辆卖出价 | ✓ | 不显示；表单里是隐藏字段（保存不清空原值）；JSON 导出也去掉 |
| 备份 | ✓ | ✗（原有） |

**P1 只是界面闸门；P2（迁移 058）起数据库层面也挡住**：价格搬到 `property_financials` / `deal_financials` / `asset_financials` 旁表，只有财务权限能读写，见 [design-debt-lending.md](design-debt-lending.md) §6。以下是 P1 当时的说明：
**建议（以后的迁移）**：把价格列移到只有 `finance_can_see()` 能读的旁表（如 `property_financials(property_id, purchase_price, sale_price, …)`、`deal_financials`、`asset_financials`），或者给这几张表加 `security_invoker` 视图、撤掉基表的直接 select，前端改读视图。旁表方案最干净（行级安全天然按行生效，不需要列级权限）。

## 8. 分期

- **P1（本次）**：改名、分组目录、资产页、保险 / HOA 单一来源、价格界面闸门。没有迁移。
- **P2 借贷（已实现，迁移 058，见 design-debt-lending.md）**：`debt_accounts`（贷款方、本金、利率、期限、起始日、还款日；可挂 `property_id` / `asset_id` = 资产的融资关系；方向：借入 / 借出）；`debt_transactions`（每期还款：本金、利息、Escrow、其他）。按摊还表自动拆本金 / 利息，允许手动改（对账单上的实际数为准）；Escrow 部分对应房产税 / 保险账单（现有 `pay_channel = escrow`）。还款记的花费性质用「融资 / 还本」。车贷账单可以挂到具体车辆（替代现在的名字匹配）。
- **P3 净资产（已实现，迁移 059，见 design-net-worth.md）**：没有在原表上加 `market_value`，而是两张历史表（`account_balances` 账户余额、`asset_valuations` 房产 / 车辆估值，最新一行 = 当前值）+ 每月快照 `net_worth_snapshots`（打开财务时自动存本月，可手动保存 / 重建过去某月）；资产 − 负债（P2 的未还本金 + 信用卡欠款）= 净资产，按月趋势、财富增长 vs 消费、每处资产的净值。资产页的「估值 P3」「余额：P3」已换成真的数字和就地更新。
