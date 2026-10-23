# 账单与缴费模块设计（三期）

## 1. 问题与目标

**问题**：没有设自动扣款的账单容易忘记，产生滞纳金、停服甚至影响信用；设了自动扣款的也会忘记核对金额是否异常、卡是否过期。账单来源分散（网站、邮箱、纸质账单、App），家里没有一张总表说明“每月要交什么、谁交、交了没有”。

**目标**：在现有家庭协作框架里加一张家庭账单总表，按频率提醒缴费或核对，留下缴费记录，看支出趋势，并为多套房产（房东场景）留好扩展口。

**成功标准**

- 新家庭 5 分钟内用模板建好全部常见账单（水电气、网络、HOA、房产税、房贷、保险）。
- 到期前按设定的提前天数出现在首页「今日」；手动缴费的提示“去缴费”，自动扣款的提示“核对账单”。
- 每笔缴费有记录（日期、金额、方式、确认号），可按账单看月度趋势，可导出年度 CSV。
- 账单与现有花费统计共用“花费”口径，但单独分组，不干扰买菜的统计。
- 数据模型从第一天就带 `property_id`、`direction` 字段，房东多套房产可在第三期打开，不需要迁数据。

## 2. 范围与非目标

**范围**：家庭层面的周期性应付账单（也含一次性，如 HOA 特别评估）；缴费提醒；缴费记录与报表；自动扣款状态管理；房东的应收（租金）作为第三期扩展。

**非目标**：不连接银行或缴费网站自动扣款或抓取账单（没有公开 API，且涉及凭据安全）；不保存账号密码、完整账号、银行卡号；不做记账软件的全量收支（买菜等仍走采购清单与花费统计）。

**安全边界**：账单只存付款方名称、账号尾号、登录提示（例如“用 Gmail 登录”）、缴费链接；凭据永远不进数据库。

## 3. 核心概念

| 概念 | 说明 |
|---|---|
| 账单项目（bill） | 一项周期性的应付或应收，例如“ComEd 电费”“Cook County 房产税”“房贷”。 |
| 到期规则 | 频率 + 到期日规则，算出下一次到期日 `next_due_on`。 |
| 缴费方式 | 自动扣款 / 手动在线 / 邮寄支票 / 电话 / 现场。自动扣款的也要“核对”。 |
| 缴费记录（payment） | 某次到期对应的实际支付：日期、金额、方式、确认号、滞纳金。 |
| 提醒窗口 | 到期前 N 天列表（可多档，如 7 天和 1 天）；逾期持续提醒直到记录缴费或跳过。 |
| 核对模式 | 自动扣款账单到期日前后提示“看一眼账单金额有没有异常、卡有没有过期”，确认后自动写一条缴费记录。 |

## 4. 数据模型

全部挂 `household_id`，RLS 与现有表一致。

```
properties（第三期启用；第一期只建表并插入一条默认房产）
  id, household_id, name, kind(sfh/townhome/condo/apartment/other), role(owner_occupied/landlord/tenant),
  address_line, city, region_code, is_default, archived, notes

bills
  id, household_id, property_id (nullable → 第一期默认房产；也可 null 表示与房产无关，如手机费)
  name, category, payee, account_last4, login_hint, pay_url, pay_channel(online/autopay/mail/phone/in_person)
  direction(payable/receivable)            -- 第三期房东收租用 receivable
  amount_type(fixed/variable), typical_amount, currency
  frequency(weekly/biweekly/monthly/quarterly/semiannual/annual/custom/one_time), interval_months
  due_day (1–31，月末用 31 并按月截断), due_dates (text[]，半年 / 年度账单的固定日期，如 ["03-01","08-01"])
  next_due_on date, grace_days int, late_fee_note
  autopay bool, autopay_method (例如 "Chase 1234" / "Visa 5678"), autopay_card_expires (YYYY-MM，提前提示换卡)
  statement_channel(email/mail/app/none), reminder_days int[] (默认 [7,1])
  assigned_to uuid (谁负责交，可空), essential bool, active bool, notes
  created_by, created_at, updated_at

bill_payments
  id, household_id, bill_id, due_on, paid_on, amount, currency, method, confirmation_ref,
  late_fee numeric, status(paid/skipped/verified), paid_by uuid, notes,
  purchase_id uuid (写入 purchases 以便并入花费统计与年度 CSV)
  created_at
```

**与现有表的关系**

- `house_profiles`、`assets`、`maintenance_logs`、`seasonal_tasks` 第三期加 `property_id`（可空，迁移时全部指向默认房产）。
- 缴费记录同时写一条 `purchases`（分类 `bill_<category>`），统计页按具体种类分项（电费、燃气费、房贷…，同类同色相；花费页有“同一大类账单合并显示”开关，打开后合成水电气网通讯 / 住房 / 车等 6 大类，选择记在本机 localStorage；明细筛选另有“账单”= 全部账单，预算仍把全部账单算一组）；无需数据库迁移；年度明细 CSV 自然包含。删除缴费记录时一起删，和保养记录的做法一致。

**分类与模板**（按地区）

| 分类 | 北美默认频率 / 到期 | 中国默认 |
|---|---|---|
| 电 electric | 月付，变动金额 | 月付或按卡充值 |
| 燃气 gas | 月付，变动 | 月付 / 充值 |
| 水 / 排污 / 垃圾 water | 月或双月 | 月付 |
| 网络 internet、手机 mobile | 月付，固定 | 月付 |
| HOA / 物业费 hoa | 月付或季付，固定；特别评估一次性 | 物业费年付或季付 |
| 房产税 property_tax | 半年两期（Cook County 约 3 月 1 日、8 月 1 日，第二期日期每年公布） | 无 |
| 房贷 mortgage / 房租 rent | 月付，固定 | 月付 |
| 房屋保险 insurance_home、车险 insurance_auto | 半年或年付，可能随 escrow | 年付 |
| 车贷 car_loan、信用卡 credit_card | 月付；信用卡“到期日 = 账单日 + 21–25 天” | 月付 |
| 订阅 subscription、会员 membership | 月付 / 年付（Costco、流媒体、云存储） | 同 |
| 托儿 / 学费 tuition、其他 other | 月付 / 学期 | 同 |

模板给默认频率、提醒天数、是否通常自动扣款；金额留空由用户填。

## 5. 计算规则

- **下一次到期**：按 `frequency` 从上一次到期日推；`due_day` 超过当月天数时取月末；`due_dates` 列表的按年循环取下一个未过日期。记录缴费（或核对）后自动推到下一期；一次性账单记录后归档。
- **状态**：`overdue`（过了 `next_due_on + grace_days` 仍无记录）> `due`（今天）> `soon`（在任一提醒档内）> `verify`（自动扣款账单到期 ±3 天，提示核对）> `ok`。
- **金额估算**：变动金额账单用最近 6 次记录的平均值做预算；记录金额比平均高 15% 以上时标“涨价了”。
- **每月固定支出**：所有活跃账单折算成月等值（年付 ÷ 12，半年 ÷ 6，季 ÷ 3，双周 × 26 ÷ 12）求和，分“必要 / 非必要”两档。
- **卡到期**：`autopay_card_expires` 距今 ≤ 45 天时提醒“自动扣款的卡快过期，去更新”。
- **首页「今日」**：新增“账单”段：逾期（红）、今天到期、提醒窗口内（黄）、待核对的自动扣款（灰）；每行有“去缴费”（打开 `pay_url`）和“已缴 / 已核对”。

## 6. 提醒如何真正送达

网页只在打开时能提醒，这是现有通知的局限。按成本从低到高给三层：

1. **第一期**：首页「今日」+ 浏览器通知（打开时）+ **日历订阅**：生成 `.ics`（每条账单的到期日 + 提前提醒），家人加到手机日历，系统日历负责响铃，不依赖网页是否打开。零成本、最可靠。
2. **第二期**：Supabase `pg_cron` 每天早上调用 Edge Function，用 Resend（免费额度 3,000 封/月）发“本周账单”邮件摘要给家庭成员；可选 Telegram / 企业微信机器人。
3. **第二期可选**：PWA + Web Push（需要 Service Worker、VAPID 密钥、Edge Function 发推送；iOS 要求“添加到主屏幕”后才支持）。

## 7. 页面与信息架构

```
底部导航：今日 / 储藏 / 房屋 / 账单 / 装备 / 采购 / 我的   （7 项；设置里可关闭账单模块；手机上验证挤不挤，挤则把“装备”并入“储藏”的二级页）
账单
├── 概览   本月待办（逾期 / 到期 / 提醒中 / 待核对）、本月日历（按日期放账单和金额）、每月固定支出 KPI、卡到期提醒
├── 清单   全部账单按分类分组：名称、付款方、下次到期、金额、自动扣款开关（直接切换）、负责人；筛选：自动 / 手动、房产、负责人
├── 记录   缴费历史（按账单、月份、方式筛选）、滞纳金合计、导出 CSV
└── 分析   单账单月度趋势（电费冬夏）、分类年度对比、同比；必要 / 非必要占比；订阅盘点（半年没用的提示取消）
#/bill/new?category=xx、#/bill/<id>   整页表单；编辑页下方“记一笔缴费 / 已核对”和历史列表（同设备档案的交互）
```

账单清单的“自动扣款”是可以直接点的开关，切换时提示补充扣款卡尾号；关闭自动扣款会把核对模式改回“去缴费”并保留提醒。

## 8. 借鉴的成熟做法

- **账单日历与“未来 30 天要交多少”**（Prism、Rocket Money）：概览页的日历和 KPI。
- **多档提醒 + 稍后再提醒**（Bills Organizer）：`reminder_days` 数组，“推迟到明天”按钮。
- **自动扣款也要核对**（Copilot、Mint）：核对模式和“涨价了”标记。
- **订阅盘点**（Rocket Money）：分析页列出订阅类账单的年化费用，标记长期未用。
- **谁负责**（Splitwise 的责任人概念）：`assigned_to`，首页只对负责人高亮，其他家人可见。
- **到期前更换过期卡**（信用卡 App）：`autopay_card_expires`。
- **纸质账单检查清单**：`statement_channel = mail` 的账单在每月固定日子提示“查信箱”。
- **滞纳金追踪**：记录里的 `late_fee` 单独汇总，年度报告写明“今年多付了多少滞纳金 / 省下多少”。
- **年度税务汇总**：房产税、房贷（只汇总金额，利息以 1098 为准）、保险分类年度合计，方便报税。
- **安全提示**：不存凭据、不存完整账号；缴费链接只到付款方官网；RLS 隔离。

## 9. 多套房产与房东扩展（第三期）

- `properties` 表启用，房屋 / 账单 / 设备 / 季节任务都挂 `property_id`；顶部加“房产切换”和“全部房产”汇总。
- 房东：账单 `direction = receivable` 表示租金应收；按月到期、记录收款；逾期同样提醒。加 `tenants`（租客姓名、联系方式、租期、押金）和租约到期提醒。
- 每套房产的损益：租金收入 − 房贷 − 房产税 − HOA − 保险 − 维修保养（已有 `maintenance_logs`），按年汇总，可导出。
- 共享成本分摊（多套房公用一份车险等）第三期不做。

## 10. 期次与验收

| 期 | 交付 | 验收要点 |
|---|---|---|
| B1 | `properties`（默认一条）、`bills`、`bill_payments` 表与迁移；分类模板（北美 / 中国）；账单清单、编辑页、记一笔缴费 / 已核对；到期与状态计算；首页「今日」账单段；自动扣款开关；缴费写入 `purchases` 并入统计“账单”组；记录页与年度 CSV；日历 `.ics` 导出；设置里的模块开关 | 用模板 5 分钟建好 8 条账单；把一条账单到期日改成昨天 → 首页显示逾期；记录缴费后下次到期自动推一期；自动扣款账单到期前出现“待核对”；统计页出现“账单”组；导出的 .ics 在手机日历能看到到期提醒 |
| B2 | 概览页日历视图；分析页趋势与同比；涨价检测；卡到期提醒；负责人与稍后提醒；订阅盘点；滞纳金汇总；邮件摘要（pg_cron + Edge Function + Resend） | 电费 12 个月折线正确；金额高于均值 15% 标记；邮件每天早上到达 |
| B3 | 多房产：房产切换、房屋 / 设备 / 季节任务挂房产；房东应收租金、租客与租约；每套房产年度损益；账单附件（Storage） | 两套房产各自的账单互不混淆；“全部房产”汇总正确；租金逾期提醒 |

每期交付后先验收，确认无误后再开始下一期。

## 11. 已确认的决定与 B1 实现说明

1. 导航：“装备”并入“储藏”二级页（储藏：概览 / 库存 / 装备 / 菜单），底部标签为 今日 / 储藏 / 房屋 / 账单 / 采购 / 我的；旧链接 `#/gear` 自动转到 `#/pantry/gear`。
2. 模板：北美（Cook County 房产税 03-01 / 08-01）和中国两套，按当前房产的房屋资料地区选，没有资料时按单位地区。
3. 提醒送达：B1 做了 .ics 导出（下载文件，加入手机日历）；邮件摘要留在 B2。
4. 多房产：B1 一并上线。`properties` 表 + 默认房产；`house_profiles` 主键改为 `property_id`，`assets`、`seasonal_tasks` 加 `property_id`（迁移时全部归到默认房产）；账单 `property_id` 可空；房屋和账单页有房产切换条。房东应收（`direction = receivable`）字段已建，租客与租约、每套房产损益放 B3。
5. 其他与第 4 节设计的差异：缴费记录的 `late_fee` 计入 purchases 金额；`bill_payments.status` 为 paid / verified / skipped；记录页的趋势图只做单账单折线，分类对比放 B2。
